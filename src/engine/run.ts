import { createRng } from './rng';
import { isReachable, neighborsOf, type LayerGraph, type MapNode, type NodeType, type RunPosition } from './map-types';
import { generateLayer } from './map-gen';
import { assignGatekeeperEnemy, gatekeeperEnemyForNode, type EnemyDefinition, type EnemyId } from './enemies';
import { move } from './traversal';
import { resolveEncounter, alwaysFirstEventChoice, type EncounterOutcome, type EventChoiceStrategy } from './encounters';
import { addHeat, HEAT_MAX, HEAT_PER_MOVE, HEAT_HIGH_FRACTION, HEAT_LOW_FRACTION } from './heat';
import { CLASS_DEFINITIONS, DEFAULT_CLASS_ID, type ClassId } from './classes';
import type { SubroutineDefinition } from './subroutine-types';
import { acquireSubroutine, alwaysAcquireFirst, installGrantedSubroutine, INSTALLED_SLOT_CAP, type AcquisitionStrategy } from './loadout';
import { mergeSubroutine, preferMergeWhenAvailable, opportunisticSafehouseStrategy, MATERIAL_HIGH_THRESHOLD, type SafehouseStrategy } from './merge';
import {
  buyCheapestAffordable,
  rerollIfNothingAffordable,
  DATA_HIGH_THRESHOLD,
  DATA_LOW_THRESHOLD,
  buyCheapestAffordableMod,
  rerollModIfNothingAffordable,
  buyCheapestAffordableBurner,
  rerollBurnerIfNothingAffordable,
  neverActivateShopBurner,
  type ShopStrategy,
  type ShopRerollStrategy,
  type ModShopStrategy,
  type ModShopRerollStrategy,
  type ShopBurnerStrategy,
  type BurnerShopStrategy,
  type BurnerShopRerollStrategy,
} from './shop';
import type { DiscardStrategy } from './deal';
import type { PlayStrategy } from './pegging';
import type { ModDefinition, ModId } from './mod-types';
import {
  MOD_DEFINITIONS,
  applyOnMoveMods,
  applyQuietHoursMod,
  applyOnSubroutineAcquiredMods,
  applyOnModAcquiredMods,
  alwaysAcquireFirstMod,
  type ModAcquisitionStrategy,
} from './mods';
import type { BurnerDefinition, BurnerId } from './burner-types';
import { BURNER_CAP, BURNER_DEFINITIONS, alwaysAcquireFirstBurner, type BurnerAcquisitionStrategy } from './burners';
import type { BurnerActivationStrategy } from './combat';

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

/** Removes exactly one instance of `burnerId` from carriedBurnerIds --
 * duplicates aren't deduplicated (checkpoint B), so this only ever
 * consumes the one copy actually used, same one-for-one bookkeeping
 * combat.ts's own remainingBurnerIds helper uses. */
function removeOneCarriedBurner(playerState: RunPlayerState, burnerId: BurnerId): RunPlayerState {
  const remaining = [...playerState.carriedBurnerIds];
  const index = remaining.indexOf(burnerId);
  if (index !== -1) remaining.splice(index, 1);
  return { ...playerState, carriedBurnerIds: remaining };
}

export type RunOutcome = 'heatMaxed' | 'quarantined' | 'noRouteRemains' | 'victory';

export type RunEvent =
  | { type: 'layerGenerated'; layerIndex: number; nodeCount: number }
  | { type: 'move'; layerIndex: number; from: string; to: string; heatCost: number; heatAfter: number }
  | { type: 'mapBurnerActivated'; layerIndex: number; burnerId: BurnerId; targetNodeId?: string }
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
 * scripted discard/play strategies. `playerState` is optional -- added
 * for opportunisticTraversal below, which needs to see material/Data
 * alongside Heat; beelineToGatekeeper/exploreThenGatekeeper both ignore
 * it, the same way beelineToGatekeeper already ignores `heat` itself
 * (a function with fewer declared params still satisfies a wider type). */
export type TraversalStrategy = (graph: LayerGraph, position: RunPosition, heat: number, playerState?: RunPlayerState) => string;

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

// TBD/playtesting -- extra Heat headroom (beyond the raw detour cost)
// opportunisticTraversal insists on keeping in reserve before taking any
// non-fight detour, so exploring never itself strands the player short of
// the gatekeeper. Roughly 2 moves' worth of cushion.
const OPPORTUNISTIC_RESERVE_MARGIN = 2 * HEAT_PER_MOVE;

/** The "middle ground" traversal strategy (session 39, `/decision-session`
 * -- banked since session 35's beeline/explore sweep comparison, which
 * found neither extreme reflects DESIGN.md's own stated ideal: "a middle
 * ground between beelining and fully exploring a layer, managing Heat
 * along the way"). Priority, resolved live one tier at a time:
 *
 * 1. Reachable fight nodes (regular/elite) always win -- direct,
 *    reliable power, no state-dependence.
 * 2. Heat pressure: if current Heat is already high, a reachable
 *    Safehouse outranks everything below (Heat is the run-ending
 *    resource -- relieving it is safety-critical in a way the other
 *    detours below aren't; opportunisticSafehouseStrategy, merge.ts,
 *    carries the same Heat-wins-the-tie call into the Rest-vs-Merge
 *    decision once there).
 * 3. Otherwise, banked material or high Data each pull toward their own
 *    node type (Safehouse->Merge, Shop) -- co-equal tiers, both real
 *    (if less direct than a fight's) power gains the user specifically
 *    corrected this session's first draft to include, rather than
 *    scoping the strategy to fights-only. Nearest reachable candidate
 *    wins if both fire at once.
 * 4. If Heat, material, and Data are *all* low together, an Event is the
 *    one node type left worth a gamble-driven detour.
 * 5. Otherwise: beeline the rest of the way, same fallback
 *    exploreThenGatekeeper already uses.
 *
 * Every detour (any tier above) is additionally gated by a safety
 * reserve: a node is only ever a candidate if reaching it, then taking
 * the shortest remaining path from there to the gatekeeper, keeps total
 * Heat spent under HEAT_MAX (plus any maxHeatBonus) with
 * OPPORTUNISTIC_RESERVE_MARGIN to spare -- this strategy never explores
 * its way into a Heat-maxed dead end. */
export const opportunisticTraversal: TraversalStrategy = (graph, position, heat, playerState) => {
  if (!playerState) return beelineToGatekeeper(graph, position, heat);

  const live = withoutClosedNodes(graph);
  const maxHeat = HEAT_MAX + playerState.maxHeatBonus;

  const detourHeatCost = (targetId: string): number | null => {
    const toTarget = shortestPath(live, position.nodeId, targetId);
    if (toTarget.length < 2) return null;
    const toGatekeeper = targetId === graph.gatekeeperNodeId ? [targetId] : shortestPath(live, targetId, graph.gatekeeperNodeId);
    if (toGatekeeper.length === 0) return null;
    return (toTarget.length - 1 + toGatekeeper.length - 1) * HEAT_PER_MOVE;
  };
  const withinReserve = (targetId: string): boolean => {
    const cost = detourHeatCost(targetId);
    return cost !== null && heat + cost + OPPORTUNISTIC_RESERVE_MARGIN <= maxHeat;
  };
  /** Next hop toward whichever of `nodes` has the shortest path, or null
   * if none are reachable within the safety reserve. */
  const nearestOf = (nodes: MapNode[]): string | null => {
    let best: { nextHop: string; length: number } | null = null;
    for (const node of nodes) {
      if (!withinReserve(node.id)) continue;
      const path = shortestPath(live, position.nodeId, node.id);
      if (path.length >= 2 && (!best || path.length < best.length)) best = { nextHop: path[1], length: path.length };
    }
    return best?.nextHop ?? null;
  };
  const unresolvedOfType = (type: NodeType): MapNode[] => graph.nodes.filter((n) => n.state === 'unresolved' && n.type === type);

  const fightTarget = nearestOf([...unresolvedOfType('regularFight'), ...unresolvedOfType('eliteFight')]);
  if (fightTarget) return fightTarget;

  const heatHigh = heat >= HEAT_HIGH_FRACTION * maxHeat;
  if (heatHigh) {
    const safehouseTarget = nearestOf(unresolvedOfType('safehouse'));
    if (safehouseTarget) return safehouseTarget;
  }

  const totalMaterial = Object.values(playerState.material).reduce((sum, count) => sum + count, 0);
  const materialHigh = totalMaterial >= MATERIAL_HIGH_THRESHOLD;
  const dataHigh = playerState.data >= DATA_HIGH_THRESHOLD;
  if (materialHigh || dataHigh) {
    const candidates = [...(materialHigh ? unresolvedOfType('safehouse') : []), ...(dataHigh ? unresolvedOfType('shop') : [])];
    const target = nearestOf(candidates);
    if (target) return target;
  }

  const heatLow = heat <= HEAT_LOW_FRACTION * maxHeat;
  const materialLow = totalMaterial === 0;
  const dataLow = playerState.data <= DATA_LOW_THRESHOLD;
  if (heatLow && materialLow && dataLow) {
    const eventTarget = nearestOf(unresolvedOfType('event'));
    if (eventTarget) return eventTarget;
  }

  return beelineToGatekeeper(graph, position, heat);
};

/** Context passed to a MapBurnerStrategy for one traversal-loop
 * iteration's decision -- mirrors combat.ts's BurnerActivationContext
 * shape. availableBurnerIds is playerState.carriedBurnerIds filtered to
 * map-context ones (no per-move "already used" bookkeeping needed here,
 * unlike combat -- a used map Burner is removed from carriedBurnerIds
 * immediately, in the same loop iteration, since there's no nested
 * combat round-trip to surface usage back out of). closedNodeIds is the
 * live target list for a reopenClosedNode pick. */
export interface MapBurnerActivationContext {
  graph: LayerGraph;
  position: RunPosition;
  heat: number;
  playerState: RunPlayerState;
  availableBurnerIds: BurnerId[];
  closedNodeIds: string[];
}

/** Picks which (if any) available map-context Burner to activate before
 * this iteration's traversal decision, or null to activate none.
 * `targetNodeId` is only consulted for a reopenClosedNode pick (ignored,
 * not required, for freeMove/revealUpcoming) and must be one of
 * ctx.closedNodeIds -- an id outside that list is treated as null. */
export type MapBurnerStrategy = (ctx: MapBurnerActivationContext) => { burnerId: BurnerId; targetNodeId?: string } | null;

/** Default until a script actually wants to spend a map Burner --
 * mirrors combat.ts's neverActivateBurner. */
export const neverActivateMapBurner: MapBurnerStrategy = () => null;

/** Snapshot passed to onBeforeGatekeeperFight (session 39): the player's
 * real accumulated state at the exact moment a gatekeeper fight is about
 * to resolve -- whatever combat rewards/Shop purchases/Merges/Mods/
 * Burners the run actually picked up getting here, not a bare starting
 * kit. `layerIndex` is 1-based (enemies.ts's own convention) and
 * `fightsResolved` is the run's running fight counter as of this exact
 * fight -- both are exactly what a real resolveFight call would feed
 * enemySkill/strategiesForFight, so a diagnostic script can reproduce
 * the real skill-dial AI this fight would actually use. */
export interface GatekeeperFightContext {
  playerState: RunPlayerState;
  layerIndex: number;
  fightsResolved: number;
  enemy: EnemyDefinition;
}

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
  /** Test-only escape hatch, same treatment as ownedModIdsOverride --
   * lets a test start a run with specific Burners already carried,
   * rather than depending on real acquisition (checkpoint F, not built
   * yet as of checkpoint D). Routed through acquireBurner so BURNER_CAP
   * is still respected. */
  carriedBurnerIdsOverride?: BurnerId[];
  /** Per-traversal-iteration map-context Burner activation (checkpoint
   * D) -- called once per while-loop iteration, before that iteration's
   * traversalStrategy call. Defaults to neverActivateMapBurner. */
  mapBurnerStrategy?: MapBurnerStrategy;
  /** Which (if any) of a won fight's reward options a script acquires --
   * checkpoint D. Defaults to alwaysAcquireFirst (legal-not-good, no
   * rarity/synergy judgment). */
  acquisitionStrategy?: AcquisitionStrategy;
  /** Which (if any) of an elite/gatekeeper win's additive Mod-reward
   * options a script acquires (Phase 5 Mods checkpoint G) -- same
   * legal-not-good default treatment as acquisitionStrategy. */
  modAcquisitionStrategy?: ModAcquisitionStrategy;
  /** Which (if any) of a won fight's additive Burner-reward options a
   * script acquires (Burners checkpoint F) -- offered on every fight
   * tier including regular, unlike modAcquisitionStrategy's elite/
   * gatekeeper-only reward. Cap-respecting via acquireBurner. Defaults
   * to alwaysAcquireFirstBurner (legal-not-good). */
  burnerAcquisitionStrategy?: BurnerAcquisitionStrategy;
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
  /** Which (if any) carried shop-context "coupon" Burner a script spends
   * on a Shop visit (Burners checkpoint E). Defaults to
   * neverActivateShopBurner. */
  shopBurnerStrategy?: ShopBurnerStrategy;
  /** Mirrors shopStrategy/shopRerollStrategy (and modShopStrategy/
   * modShopRerollStrategy) for the Burner slate's own third independent
   * draw/reroll (checkpoint F). */
  burnerShopStrategy?: BurnerShopStrategy;
  burnerShopRerollStrategy?: BurnerShopRerollStrategy;
  /** Which of an Event's choices a script takes (Events checkpoint H --
   * missed in that checkpoint's own pass, caught and fixed here while
   * verifying checkpoint I's bonus-fight path end-to-end via playRun).
   * Defaults to alwaysFirstEventChoice. */
  eventChoiceStrategy?: EventChoiceStrategy;
  /** Per-side combat-context Burner activation for every real fight the
   * run resolves (Burners checkpoint C -- missed threading past
   * combat.ts in that checkpoint's own pass, caught and fixed here at
   * checkpoint J while writing the smoke test that needed it). Defaults
   * to playCombat's own [neverActivateBurner, neverActivateBurner]. */
  burnerActivationStrategies?: [BurnerActivationStrategy, BurnerActivationStrategy];
  /** Test-only escape hatch (session 24, tunable-skill AI checkpoint A),
   * same treatment as installedLoadoutOverride above -- lets a sweep
   * exercise a skilled opponent (either side) in real fights via
   * resolveEncounter/resolveFight. Real per-tier enemy skill selection
   * for shipped content remains a separate, later decision; undefined
   * here falls all the way through to playCombat's own baseline
   * defaults. */
  discardStrategies?: [DiscardStrategy, DiscardStrategy];
  playStrategies?: [PlayStrategy, PlayStrategy];
  /** Player-side (side 0) skill dial, decoupled from the enemy's own --
   * session 39's "never interlocked" rule. Enemy skill is always
   * computed from enemySkill(tier, layerIndex, fightNumber) regardless
   * of this value; this only ever changes the player's own strategy.
   * Ignored when discardStrategies/playStrategies above are set (that
   * escape hatch still wins outright). Undefined keeps the player at
   * playCombat's baseline default (discardLowestTwo/playLowestLegal),
   * same as before this option existed -- so every full-run metric
   * generated without setting this is a floor-skill-player number, not
   * a "the player" number; say so explicitly when reporting one. */
  playerSkill?: number;
  /** Gatekeepers to exclude from selection entirely at every layer
   * (session 39) -- lets a diagnostic ablate one gatekeeper at a time to
   * isolate whether it's a difficulty outlier vs. its layer-mates.
   * Undefined/empty changes nothing, the default. */
  excludedGatekeeperIds?: EnemyId[];
  /** Observational only -- called once per gatekeeper fight, right
   * before it resolves, with the player's real accumulated state at
   * that moment (session 39: the "realistic difficulty" diagnostic
   * banked while investigating Null Session's kit-only floor numbers).
   * Never consumed or awaited; has zero effect on how the run actually
   * plays out. Purely a way for a script to snapshot (playerState,
   * layerIndex, fightsResolved, enemy) for a *separate* playCombat call
   * against the same enemy using the real production skill-dial AI,
   * rather than replaying the run's own outcome. Undefined by default --
   * a no-op for every existing caller. */
  onBeforeGatekeeperFight?: (context: GatekeeperFightContext) => void;
}

export function playRun(options: RunOptions): RunResult {
  const {
    seed,
    classId = DEFAULT_CLASS_ID,
    layerNodeCounts = DEFAULT_LAYER_NODE_COUNTS,
    traversalStrategy = beelineToGatekeeper,
    installedLoadoutOverride,
    ownedModIdsOverride,
    carriedBurnerIdsOverride,
    mapBurnerStrategy = neverActivateMapBurner,
    acquisitionStrategy = alwaysAcquireFirst,
    modAcquisitionStrategy = alwaysAcquireFirstMod,
    burnerAcquisitionStrategy = alwaysAcquireFirstBurner,
    installedSlotCap = INSTALLED_SLOT_CAP,
    safehouseStrategy = preferMergeWhenAvailable,
    shopStrategy = buyCheapestAffordable,
    shopRerollStrategy = rerollIfNothingAffordable,
    modShopStrategy = buyCheapestAffordableMod,
    modShopRerollStrategy = rerollModIfNothingAffordable,
    shopBurnerStrategy = neverActivateShopBurner,
    burnerShopStrategy = buyCheapestAffordableBurner,
    burnerShopRerollStrategy = rerollBurnerIfNothingAffordable,
    eventChoiceStrategy = alwaysFirstEventChoice,
    burnerActivationStrategies,
    discardStrategies,
    playStrategies,
    playerSkill,
    excludedGatekeeperIds,
    onBeforeGatekeeperFight,
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
  // Same treatment for Burners (checkpoint D's test-only escape hatch,
  // routed through acquireBurner so BURNER_CAP is still respected).
  for (const burnerId of carriedBurnerIdsOverride ?? []) {
    const burner = BURNER_DEFINITIONS[burnerId];
    if (burner) playerState = acquireBurner(playerState, burner);
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
    graph = assignGatekeeperEnemy(graph, layerIndex + 1, rng, excludedGatekeeperIds);
    log.push({ type: 'layerGenerated', layerIndex, nodeCount: graph.nodes.length });
    let position: RunPosition = { layerIndex, nodeId: graph.entryNodeId };
    let layerCleared = false;

    while (!layerCleared) {
      const fromNodeId = position.nodeId;

      // Map-context Burner activation (checkpoint D), before both this
      // iteration's traversal decision AND the no-route-remains check
      // right below -- checkpoint J verification found that checking
      // reachability first defeated Skeleton Key's entire purpose: the
      // moment a closing node cuts off the last route, the run ended
      // before the player ever got a chance to reopen it, even carrying
      // the one Burner designed to save exactly that situation.
      // DESIGN.md's own framing for this ("recoverable, not automatic,"
      // resolving the session-9 banked node-bypass idea) only holds if
      // reopening can happen before the run gives up, not after.
      let freeMoveActivated = false;
      const availableMapBurnerIds = playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('map'));
      if (availableMapBurnerIds.length > 0) {
        const closedNodeIds = graph.nodes.filter((n) => n.state === 'closed').map((n) => n.id);
        const picked = mapBurnerStrategy({ graph, position, heat, playerState, availableBurnerIds: availableMapBurnerIds, closedNodeIds });
        const burnerDef = picked && availableMapBurnerIds.includes(picked.burnerId) ? BURNER_DEFINITIONS[picked.burnerId] : undefined;
        if (picked && burnerDef?.mapEffect) {
          if (burnerDef.mapEffect.kind === 'reopenClosedNode' && picked.targetNodeId && closedNodeIds.includes(picked.targetNodeId)) {
            const targetNodeId = picked.targetNodeId;
            graph = reopenNode(graph, targetNodeId);
            playerState = removeOneCarriedBurner(playerState, picked.burnerId);
            log.push({ type: 'mapBurnerActivated', layerIndex, burnerId: picked.burnerId, targetNodeId });
          } else if (burnerDef.mapEffect.kind === 'freeMove') {
            freeMoveActivated = true;
            playerState = removeOneCarriedBurner(playerState, picked.burnerId);
            log.push({ type: 'mapBurnerActivated', layerIndex, burnerId: picked.burnerId });
          } else if (burnerDef.mapEffect.kind === 'revealUpcoming') {
            // Genuine no-op: every node's real type is already visible to
            // traversalStrategy via `graph` itself -- this engine has no
            // fog-of-war/hidden-map concept for a script to reveal into,
            // the same "no AI/UI consumes it yet" treatment
            // subroutine-types.ts's peekCrib documents for the analogous
            // Cribbage-layer case. Still consumes the Burner.
            playerState = removeOneCarriedBurner(playerState, picked.burnerId);
            log.push({ type: 'mapBurnerActivated', layerIndex, burnerId: picked.burnerId });
          }
        }
      }

      if (!gatekeeperReachable(graph, position.nodeId)) {
        log.push({ type: 'runEnded', outcome: 'noRouteRemains' });
        return finish('noRouteRemains');
      }

      const targetId = traversalStrategy(graph, position, heat, playerState);
      const moveResult = move(graph, position, targetId);
      position = moveResult.position;

      // Light Footing (Phase 5 Mods checkpoint E) and Ghost Protocol
      // (Burners checkpoint D) both discount/waive the flat per-move Heat
      // cost before it's applied -- a free move skips the charge outright,
      // same floored-at-0 treatment applyOnMoveMods already gives Light
      // Footing (a move can never refund Heat, only discount/waive it).
      const moveHeatCost = freeMoveActivated ? 0 : applyOnMoveMods(playerState.ownedModIds, moveResult.heatCost);
      playerState = applyQuietHoursMod(playerState); // session 44: Data trickle every QUIET_HOURS_MOVE_INTERVAL moves
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
      if (node.type === 'gatekeeperFight' && onBeforeGatekeeperFight) {
        onBeforeGatekeeperFight({
          playerState,
          layerIndex: layerIndex + 1, // enemies.ts's layer numbering is 1-based, same conversion resolveEncounter's own call below uses
          fightsResolved,
          enemy: gatekeeperEnemyForNode(node),
        });
      }
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
        shopBurnerStrategy,
        burnerShopStrategy,
        burnerShopRerollStrategy,
        eventChoiceStrategy,
        burnerActivationStrategies,
        heat,
        playerSkill,
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
      // Shop-context "coupon" Burner (checkpoint E) -- same "recorded,
      // not applied" split as shopPurchase/modShopPurchase below.
      if (outcome.shopBurnerUsed) {
        playerState = removeOneCarriedBurner(playerState, outcome.shopBurnerUsed);
      }
      // !== 0, not > 0: combat/Data-tier rewards are always non-negative
      // in practice, but an Event's dataDelta (checkpoint H) is a
      // genuine signed delta -- a future negative-cost Event choice
      // should still apply correctly, not get silently dropped.
      if (outcome.dataAwarded !== 0) playerState = { ...playerState, data: playerState.data + outcome.dataAwarded };
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
      // Burner-choice reward (checkpoint F) -- additive, every fight tier
      // including regular, never competing with the subroutine/Mod
      // rewards above.
      if (outcome.burnerRewardOptions.length > 0) {
        const pickedBurner = burnerAcquisitionStrategy(outcome.burnerRewardOptions, playerState);
        if (pickedBurner) playerState = acquireBurner(playerState, pickedBurner);
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
      if (outcome.burnerRerollCost > 0) playerState = { ...playerState, data: playerState.data - outcome.burnerRerollCost };
      if (outcome.burnerShopPurchase) {
        playerState = { ...playerState, data: playerState.data - outcome.burnerShopPurchase.cost };
        playerState = acquireBurner(playerState, outcome.burnerShopPurchase.burner);
      }
      // An Event grant (checkpoint H) is a direct single item, applied
      // outright -- no acquisitionStrategy step, unlike the *RewardOptions
      // fields above (those are offered choices; this isn't).
      if (outcome.eventGrant?.subroutine) {
        playerState = acquireSubroutine(playerState, outcome.eventGrant.subroutine, installedSlotCap);
        playerState = applyOnSubroutineAcquiredMods(playerState, outcome.eventGrant.subroutine);
      }
      if (outcome.eventGrant?.mod) playerState = acquireMod(playerState, outcome.eventGrant.mod);
      if (outcome.eventGrant?.burner) playerState = acquireBurner(playerState, outcome.eventGrant.burner);
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

/** Reopens a closed node back to 'unresolved' -- the real engine gap
 * Skeleton Key's map effect needed (session 37's exploration:
 * map-types.ts's NodeState previously only ever tightened, unresolved ->
 * inert/closed, never the reverse). No-ops (returns graph unchanged) if
 * nodeId isn't currently closed -- same defensive-guard treatment as
 * every other "declines if invalid" pick in this file. Exported so it's
 * directly unit-testable against a hand-built graph, same precedent
 * gatekeeperReachable set above. */
export function reopenNode(graph: LayerGraph, nodeId: string): LayerGraph {
  const target = graph.nodes.find((n) => n.id === nodeId);
  if (!target || target.state !== 'closed') return graph;
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, state: 'unresolved' } : n)) };
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
