import { createRng } from './rng';
import { isReachable, neighborsOf, type LayerGraph, type NodeType, type RunPosition } from './map-types';
import { generateLayer } from './map-gen';
import { assignGatekeeperEnemy } from './enemies';
import { move } from './traversal';
import { resolveEncounter, type EncounterOutcome } from './encounters';
import { addHeat, HEAT_MAX } from './heat';
import { CLASS_DEFINITIONS, DEFAULT_CLASS_ID, type ClassId } from './classes';
import type { SubroutineDefinition } from './subroutine-types';
import { acquireSubroutine, alwaysAcquireFirst, installGrantedSubroutine, INSTALLED_SLOT_CAP, type AcquisitionStrategy } from './loadout';
import { mergeSubroutine, preferMergeWhenAvailable, type SafehouseStrategy } from './merge';
import {
  buyCheapestAffordable,
  rerollIfNothingAffordable,
  buyCheapestAffordableMod,
  rerollModIfNothingAffordable,
  type ShopStrategy,
  type ShopRerollStrategy,
  type ModShopStrategy,
  type ModShopRerollStrategy,
} from './shop';
import type { DiscardStrategy } from './deal';
import type { PlayStrategy } from './pegging';
import type { ModDefinition, ModId } from './mod-types';
import {
  MOD_DEFINITIONS,
  applyOnMoveMods,
  applyOnSubroutineAcquiredMods,
  applyOnModAcquiredMods,
  alwaysAcquireFirstMod,
  type ModAcquisitionStrategy,
} from './mods';
import type { BurnerDefinition, BurnerId } from './burner-types';
import { BURNER_CAP } from './burners';

/**
 * The run orchestrator (session 19/20 checkpoint F): ties layer
 * generation, free-roam traversal, Heat, and real combat resolution
 * together into a full 4-layer run, playable end-to-end by script with
 * zero UI -- mirroring how Phase 1/2's orchestrators were driven by
 * legal-not-good scripted players.
 */

const DEFAULT_LAYER_NODE_COUNTS: [number, number, number, number] = [10, 12, 12, 8]; // TBD/playtesting

/** The player's own state for the run, threaded into every encounter
 * (Phase 4 checkpoint A). `data` (checkpoint C) accumulates Data awarded
 * from combat wins. `bench` (checkpoint D, loadout.ts) holds owned-but-
 * uninstalled pieces -- only `installedLoadout` is evaluated each
 * fight. `material`/`rank` (checkpoint E, merge.ts) track banked
 * duplicate material and current Merge rank, both keyed by subroutine
 * id -- acquiring an already-owned id banks material instead of adding
 * a second copy. `ownedModIds`/`grantedByMod`/`maxHeatBonus`/
 * `modRunState` (Phase 5 Mods checkpoints B/E/F) track every Mod owned
 * this run (beyond the class's own guaranteed starting one -- see
 * resolve.ts's createCombatState), which installedLoadout subroutine
 * (if any) was granted by which Mod, any permanent max-Heat raise
 * (Backup Generator), and generic one-shot/counter scratch bookkeeping
 * for run-scoped Mods (mirrors resolve.ts's per-combat passiveState). */
export interface RunPlayerState {
  classId: ClassId;
  installedLoadout: SubroutineDefinition[];
  data: number;
  bench: SubroutineDefinition[];
  material: Record<string, number>;
  rank: Record<string, number>;
  ownedModIds: ModId[];
  grantedByMod: Record<string, string>;
  maxHeatBonus: number;
  modRunState: Record<string, number>;
  /** Every Burner currently carried this run (Phase 5 Burners checkpoint
   * B) -- a capped, unordered inventory, no bench/installed split (see
   * burner-types.ts's own header). Duplicates are allowed to stack
   * (unlike ownedModIds' uniqueness), since a Burner is a consumable
   * item, not a permanent passive. */
  carriedBurnerIds: BurnerId[];
}

export function createInitialPlayerState(classId: ClassId): RunPlayerState {
  return {
    classId,
    installedLoadout: CLASS_DEFINITIONS[classId].startingLoadout,
    data: 0,
    bench: [],
    material: {},
    rank: {},
    ownedModIds: [CLASS_DEFINITIONS[classId].startingPassiveId],
    grantedByMod: {},
    maxHeatBonus: 0,
    modRunState: {},
    carriedBurnerIds: [],
  };
}

/** Finalizes a Mod acquisition (reward pick or Shop purchase alike) --
 * Phase 5 Mods checkpoints E/F: records ownership, runs onModAcquired
 * (Backup Generator's max-Heat raise), and inserts a granted-subroutine
 * Mod's own piece (Auxiliary Process) into installedLoadout, cap-exempt
 * and removal-locked. The uniqueness guard is defensive -- every Mod
 * pool draw already excludes owned ids (mods.ts's modPoolForClass), so
 * this should never actually trigger against real content. */
function acquireMod(playerState: RunPlayerState, mod: ModDefinition): RunPlayerState {
  if (playerState.ownedModIds.includes(mod.id)) return playerState;
  let state: RunPlayerState = { ...playerState, ownedModIds: [...playerState.ownedModIds, mod.id] };
  state = applyOnModAcquiredMods(state, mod.id);
  if (mod.grantedSubroutine) state = installGrantedSubroutine(state, mod.grantedSubroutine, mod.id);
  return state;
}

/** Finalizes a Burner acquisition (reward pick, Shop purchase, or a
 * future Event grant alike) -- Phase 5 Burners checkpoint B, mirroring
 * acquireMod's real shape/location above (not burners.ts -- see
 * burner-types.ts's own header). Declines (no-op) once BURNER_CAP is
 * reached -- no swap/bench fallback this pass (DESIGN.md's "Inventory":
 * a hard cap, no owned-but-not-carried state). Unlike acquireMod,
 * duplicates aren't deduplicated -- a Burner is a consumable item, not a
 * unique permanent passive, so carrying two of the same one is legal. */
function acquireBurner(playerState: RunPlayerState, burner: BurnerDefinition): RunPlayerState {
  if (playerState.carriedBurnerIds.length >= BURNER_CAP) return playerState;
  return { ...playerState, carriedBurnerIds: [...playerState.carriedBurnerIds, burner.id] };
}

export type RunOutcome = 'heatMaxed' | 'quarantined' | 'noRouteRemains' | 'victory';

export type RunEvent =
  | { type: 'layerGenerated'; layerIndex: number; nodeCount: number }
  | { type: 'move'; layerIndex: number; from: string; to: string; heatCost: number; heatAfter: number }
  | { type: 'encounter'; layerIndex: number; nodeId: string; nodeType: NodeType; outcome: EncounterOutcome; heatAfter: number }
  | { type: 'layerCleared'; layerIndex: number }
  | { type: 'runEnded'; outcome: RunOutcome };

export interface RunResult {
  outcome: RunOutcome;
  layersCompleted: number;
  finalHeat: number;
  log: RunEvent[];
  /** The player's state as of run end -- lets a caller/test confirm
   * which class actually drove the run and inspect its loadout. */
  playerState: RunPlayerState;
}

/** Decides the next node to move to, given the current layer graph,
 * position, and Heat. Must always return a node in legalMoves(graph,
 * position) -- "legal-not-good," the same contract as Phase 1/2's
 * scripted discard/play strategies. */
export type TraversalStrategy = (graph: LayerGraph, position: RunPosition, heat: number) => string;

/** Rush straight for the gatekeeper by shortest path, ignoring
 * everything else in the layer. */
export const beelineToGatekeeper: TraversalStrategy = (graph, position) => {
  const path = shortestPath(withoutClosedNodes(graph), position.nodeId, graph.gatekeeperNodeId);
  if (path.length < 2) {
    throw new Error('beelineToGatekeeper: no path to the gatekeeper from the current position');
  }
  return path[1];
};

/** Visit every still-unresolved node in the layer (nearest first) before
 * finally heading for the gatekeeper. */
export const exploreThenGatekeeper: TraversalStrategy = (graph, position, heat) => {
  const live = withoutClosedNodes(graph);
  const unresolvedTargets = graph.nodes.filter((n) => n.state === 'unresolved' && n.id !== graph.gatekeeperNodeId);
  for (const target of unresolvedTargets) {
    const path = shortestPath(live, position.nodeId, target.id);
    if (path.length >= 2) return path[1];
  }
  return beelineToGatekeeper(graph, position, heat);
};

export interface RunOptions {
  seed: number;
  /** Defaults to Breacher, the designed starting/onboarding class
   * (session 8) -- see classes.ts's DEFAULT_CLASS_ID. */
  classId?: ClassId;
  layerNodeCounts?: [number, number, number, number];
  traversalStrategy?: TraversalStrategy;
  /** Test-only escape hatch: replaces the class's real starting loadout.
   * A real class kit's Breach/Containment convergence time is sharply
   * seed-sensitive (session 20/Phase 4 checkpoint A finding), which
   * makes tests that need a *guaranteed* win or loss unable to rely on
   * natural variance across classId-driven seeds -- same reasoning
   * that led encounters.test.ts to a deliberately lopsided player
   * construction instead of a seed sweep. Never used outside tests. */
  installedLoadoutOverride?: SubroutineDefinition[];
  /** Test-only escape hatch, same treatment as installedLoadoutOverride
   * -- lets a test start a run with a specific set of Mods already
   * owned (beyond the class's own guaranteed starting one), rather than
   * depending on natural elite/gatekeeper reward luck across a seed. */
  ownedModIdsOverride?: ModId[];
  /** Which (if any) of a won fight's reward options a script acquires --
   * checkpoint D. Defaults to alwaysAcquireFirst (legal-not-good, no
   * rarity/synergy judgment). */
  acquisitionStrategy?: AcquisitionStrategy;
  /** Which (if any) of an elite/gatekeeper win's additive Mod-reward
   * options a script acquires (Phase 5 Mods checkpoint G) -- same
   * legal-not-good default treatment as acquisitionStrategy. */
  modAcquisitionStrategy?: ModAcquisitionStrategy;
  /** Slot cap for installedLoadout -- checkpoint D. */
  installedSlotCap?: number;
  /** Rest-vs-Merge choice at a Safehouse -- checkpoint E. Defaults to
   * preferMergeWhenAvailable (legal-not-good). */
  safehouseStrategy?: SafehouseStrategy;
  /** What (if anything) a script buys at the Shop -- checkpoint F.
   * Defaults to buyCheapestAffordable (legal-not-good). */
  shopStrategy?: ShopStrategy;
  /** Whether a script spends Data to reroll the Shop's slate once
   * before buying -- checkpoint F follow-up. Defaults to
   * rerollIfNothingAffordable (legal-not-good). */
  shopRerollStrategy?: ShopRerollStrategy;
  /** Mirrors shopStrategy/shopRerollStrategy for the parallel Mod slate
   * (Phase 5 Mods checkpoint G). */
  modShopStrategy?: ModShopStrategy;
  modShopRerollStrategy?: ModShopRerollStrategy;
  /** Test-only escape hatch (session 24, tunable-skill AI checkpoint A),
   * same treatment as installedLoadoutOverride above -- lets a sweep
   * exercise a skilled opponent (either side) in real fights via
   * resolveEncounter/resolveFight. Real per-tier enemy skill selection
   * for shipped content remains a separate, later decision; undefined
   * here falls all the way through to playCombat's own baseline
   * defaults. */
  discardStrategies?: [DiscardStrategy, DiscardStrategy];
  playStrategies?: [PlayStrategy, PlayStrategy];
}

export function playRun(options: RunOptions): RunResult {
  const {
    seed,
    classId = DEFAULT_CLASS_ID,
    layerNodeCounts = DEFAULT_LAYER_NODE_COUNTS,
    traversalStrategy = beelineToGatekeeper,
    installedLoadoutOverride,
    ownedModIdsOverride,
    acquisitionStrategy = alwaysAcquireFirst,
    modAcquisitionStrategy = alwaysAcquireFirstMod,
    installedSlotCap = INSTALLED_SLOT_CAP,
    safehouseStrategy = preferMergeWhenAvailable,
    shopStrategy = buyCheapestAffordable,
    shopRerollStrategy = rerollIfNothingAffordable,
    modShopStrategy = buyCheapestAffordableMod,
    modShopRerollStrategy = rerollModIfNothingAffordable,
    discardStrategies,
    playStrategies,
  } = options;

  const rng = createRng(seed);
  const log: RunEvent[] = [];
  let heat = 0;
  let layersCompleted = 0;
  // Phase 5 checkpoint A/C: counts real combats resolved this run
  // (win or loss both count -- "a combat happened," not "a combat was
  // won"), regardless of layer -- feeds the opener-window override
  // (enemies.ts's pickRegularOrEliteEnemy/enemySkill) so the first few
  // fights of a run are easy regardless of which node the player visits
  // first (layer 1 is free-roam, so "the first node" isn't well-defined
  // by position).
  let fightsResolved = 0;
  let playerState = installedLoadoutOverride
    ? { ...createInitialPlayerState(classId), installedLoadout: installedLoadoutOverride }
    : createInitialPlayerState(classId);
  // Routed through the same acquireMod each real Mod pickup uses (not a
  // raw ownedModIds splice), so onModAcquired's real side effects
  // (Backup Generator's max-Heat raise, Auxiliary Process's granted
  // subroutine) apply exactly as they would from a real acquisition.
  for (const modId of ownedModIdsOverride ?? []) {
    const mod = MOD_DEFINITIONS[modId];
    if (mod) playerState = acquireMod(playerState, mod);
  }

  const finish = (outcome: RunOutcome): RunResult => ({ outcome, layersCompleted, finalHeat: heat, log, playerState });

  for (let layerIndex = 0; layerIndex < layerNodeCounts.length; layerIndex++) {
    let graph = generateLayer({ rng, nodeCount: layerNodeCounts[layerIndex] });
    // Fixes this layer's gatekeeper identity for the whole run (Phase 5
    // checkpoint C) -- kept as a separate post-processing step rather
    // than a generateLayer option, so map-gen.ts itself stays
    // content-agnostic (its own "pure topology" scope). enemies.ts's
    // layer numbering is 1-based (minLayer/eligibleEnemies), while this
    // loop's layerIndex is 0-based -- +1 here is the only place that
    // conversion needs to happen.
    graph = assignGatekeeperEnemy(graph, layerIndex + 1, rng);
    log.push({ type: 'layerGenerated', layerIndex, nodeCount: graph.nodes.length });
    let position: RunPosition = { layerIndex, nodeId: graph.entryNodeId };
    let layerCleared = false;

    while (!layerCleared) {
      if (!gatekeeperReachable(graph, position.nodeId)) {
        log.push({ type: 'runEnded', outcome: 'noRouteRemains' });
        return finish('noRouteRemains');
      }

      const fromNodeId = position.nodeId;
      const targetId = traversalStrategy(graph, position, heat);
      const moveResult = move(graph, position, targetId);
      position = moveResult.position;

      // Light Footing (Phase 5 Mods checkpoint E): discounts the flat
      // per-move Heat cost before it's applied.
      const moveHeatCost = applyOnMoveMods(playerState.ownedModIds, moveResult.heatCost);
      const maxHeat = HEAT_MAX + playerState.maxHeatBonus; // Backup Generator (checkpoint E)
      const afterMove = addHeat(heat, moveHeatCost, maxHeat);
      heat = afterMove.heat;
      log.push({ type: 'move', layerIndex, from: fromNodeId, to: position.nodeId, heatCost: moveHeatCost, heatAfter: heat });
      if (afterMove.maxed) {
        log.push({ type: 'runEnded', outcome: 'heatMaxed' });
        return finish('heatMaxed');
      }

      const node = graph.nodes.find((n) => n.id === position.nodeId);
      if (!node) throw new Error(`playRun: node "${position.nodeId}" is missing from its own layer graph`);
      if (node.state !== 'unresolved') continue; // already resolved -- just passing through

      const isFightNode = node.type === 'regularFight' || node.type === 'eliteFight' || node.type === 'gatekeeperFight';
      const outcome = resolveEncounter(
        node,
        rng,
        playerState,
        safehouseStrategy,
        shopStrategy,
        shopRerollStrategy,
        discardStrategies,
        playStrategies,
        layerIndex + 1, // enemies.ts's layer numbering is 1-based
        fightsResolved,
        undefined, // enemyIdOverride -- test-only, never set by real play
        modShopStrategy,
        modShopRerollStrategy,
      );
      if (isFightNode) fightsResolved++;
      graph = { ...graph, nodes: graph.nodes.map((n) => (n.id === node.id ? { ...n, state: outcome.newState } : n)) };
      const afterEncounter = addHeat(heat, outcome.heatDelta, HEAT_MAX + playerState.maxHeatBonus);
      heat = afterEncounter.heat;
      // Removes any Burner(s) actually activated in this encounter's
      // combat (checkpoint C wires the real activation) -- removes one
      // instance per use, not every copy, so a duplicate-stacked Burner
      // isn't wiped out by using just one.
      if (outcome.burnersUsedThisCombat.length > 0) {
        const remaining = [...playerState.carriedBurnerIds];
        for (const usedId of outcome.burnersUsedThisCombat) {
          const index = remaining.indexOf(usedId);
          if (index !== -1) remaining.splice(index, 1);
        }
        playerState = { ...playerState, carriedBurnerIds: remaining };
      }
      if (outcome.dataAwarded > 0) playerState = { ...playerState, data: playerState.data + outcome.dataAwarded };
      if (outcome.rewardOptions.length > 0) {
        const picked = acquisitionStrategy(outcome.rewardOptions, playerState);
        if (picked) {
          playerState = acquireSubroutine(playerState, picked, installedSlotCap);
          // Salvage Protocol (checkpoint E) -- checked against every
          // acquired piece, reward or Shop alike, per its own no-op guards.
          playerState = applyOnSubroutineAcquiredMods(playerState, picked);
        }
      }
      // Mod-choice reward (checkpoint G) -- additive, elite/gatekeeper
      // wins only, never competing with the subroutine reward above.
      if (outcome.modRewardOptions.length > 0) {
        const pickedMod = modAcquisitionStrategy(outcome.modRewardOptions, playerState);
        if (pickedMod) playerState = acquireMod(playerState, pickedMod);
      }
      if (outcome.mergeTargetId) playerState = mergeSubroutine(playerState, outcome.mergeTargetId);
      if (outcome.rerollCost > 0) playerState = { ...playerState, data: playerState.data - outcome.rerollCost };
      if (outcome.shopPurchase) {
        playerState = { ...playerState, data: playerState.data - outcome.shopPurchase.cost };
        playerState = acquireSubroutine(playerState, outcome.shopPurchase.piece, installedSlotCap);
        playerState = applyOnSubroutineAcquiredMods(playerState, outcome.shopPurchase.piece);
      }
      if (outcome.modRerollCost > 0) playerState = { ...playerState, data: playerState.data - outcome.modRerollCost };
      if (outcome.modShopPurchase) {
        playerState = { ...playerState, data: playerState.data - outcome.modShopPurchase.cost };
        playerState = acquireMod(playerState, outcome.modShopPurchase.mod);
      }
      log.push({ type: 'encounter', layerIndex, nodeId: node.id, nodeType: node.type, outcome, heatAfter: heat });

      if (outcome.quarantined) {
        log.push({ type: 'runEnded', outcome: 'quarantined' });
        return finish('quarantined');
      }
      if (afterEncounter.maxed) {
        log.push({ type: 'runEnded', outcome: 'heatMaxed' });
        return finish('heatMaxed');
      }
      if (node.type === 'gatekeeperFight' && outcome.newState === 'inert') {
        layersCompleted++;
        log.push({ type: 'layerCleared', layerIndex });
        layerCleared = true;
      }
    }
  }

  log.push({ type: 'runEnded', outcome: 'victory' });
  return finish('victory');
}

function withoutClosedNodes(graph: LayerGraph): LayerGraph {
  const closedIds = new Set(graph.nodes.filter((n) => n.state === 'closed').map((n) => n.id));
  return { ...graph, edges: graph.edges.filter((e) => !closedIds.has(e.a) && !closedIds.has(e.b)) };
}

/** The live, state-aware version of the graph-resilience question: is
 * the gatekeeper still reachable from here, given whatever has closed so
 * far? Exported so it can be unit-tested directly against hand-built
 * graphs, independent of generateLayer's randomness. */
export function gatekeeperReachable(graph: LayerGraph, fromNodeId: string): boolean {
  return isReachable(withoutClosedNodes(graph), fromNodeId, graph.gatekeeperNodeId);
}

function shortestPath(graph: LayerGraph, fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId];
  const cameFrom = new Map<string, string>();
  const visited = new Set<string>([fromId]);
  const queue = [fromId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const neighbor of neighborsOf(graph, current)) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      cameFrom.set(neighbor, current);
      if (neighbor === toId) return reconstructPath(cameFrom, fromId, toId);
      queue.push(neighbor);
    }
  }
  return [];
}

function reconstructPath(cameFrom: Map<string, string>, fromId: string, toId: string): string[] {
  const path = [toId];
  let node = toId;
  while (node !== fromId) {
    node = cameFrom.get(node) as string;
    path.push(node);
  }
  return path.reverse();
}
