import { createRng } from './rng';
import { isReachable, neighborsOf, type LayerGraph, type NodeType, type RunPosition } from './map-types';
import { generateLayer } from './map-gen';
import { move } from './traversal';
import { resolveEncounter, type EncounterOutcome } from './encounters';
import { addHeat } from './heat';
import { CLASS_DEFINITIONS, DEFAULT_CLASS_ID, type ClassId } from './classes';
import type { SubroutineDefinition } from './subroutine-types';
import { acquireSubroutine, alwaysAcquireFirst, INSTALLED_SLOT_CAP, type AcquisitionStrategy } from './loadout';
import { mergeSubroutine, preferMergeWhenAvailable, type SafehouseStrategy } from './merge';
import { buyCheapestAffordable, type ShopStrategy } from './shop';

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
 * a second copy. */
export interface RunPlayerState {
  classId: ClassId;
  installedLoadout: SubroutineDefinition[];
  data: number;
  bench: SubroutineDefinition[];
  material: Record<string, number>;
  rank: Record<string, number>;
}

export function createInitialPlayerState(classId: ClassId): RunPlayerState {
  return { classId, installedLoadout: CLASS_DEFINITIONS[classId].startingLoadout, data: 0, bench: [], material: {}, rank: {} };
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
  /** Which (if any) of a won fight's reward options a script acquires --
   * checkpoint D. Defaults to alwaysAcquireFirst (legal-not-good, no
   * rarity/synergy judgment). */
  acquisitionStrategy?: AcquisitionStrategy;
  /** Slot cap for installedLoadout -- checkpoint D. */
  installedSlotCap?: number;
  /** Rest-vs-Merge choice at a Safehouse -- checkpoint E. Defaults to
   * preferMergeWhenAvailable (legal-not-good). */
  safehouseStrategy?: SafehouseStrategy;
  /** What (if anything) a script buys at the Shop -- checkpoint F.
   * Defaults to buyCheapestAffordable (legal-not-good). */
  shopStrategy?: ShopStrategy;
}

export function playRun(options: RunOptions): RunResult {
  const {
    seed,
    classId = DEFAULT_CLASS_ID,
    layerNodeCounts = DEFAULT_LAYER_NODE_COUNTS,
    traversalStrategy = beelineToGatekeeper,
    installedLoadoutOverride,
    acquisitionStrategy = alwaysAcquireFirst,
    installedSlotCap = INSTALLED_SLOT_CAP,
    safehouseStrategy = preferMergeWhenAvailable,
    shopStrategy = buyCheapestAffordable,
  } = options;

  const rng = createRng(seed);
  const log: RunEvent[] = [];
  let heat = 0;
  let layersCompleted = 0;
  let playerState = installedLoadoutOverride
    ? { classId, installedLoadout: installedLoadoutOverride, data: 0, bench: [], material: {}, rank: {} }
    : createInitialPlayerState(classId);

  const finish = (outcome: RunOutcome): RunResult => ({ outcome, layersCompleted, finalHeat: heat, log, playerState });

  for (let layerIndex = 0; layerIndex < layerNodeCounts.length; layerIndex++) {
    let graph = generateLayer({ rng, nodeCount: layerNodeCounts[layerIndex] });
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

      const afterMove = addHeat(heat, moveResult.heatCost);
      heat = afterMove.heat;
      log.push({ type: 'move', layerIndex, from: fromNodeId, to: position.nodeId, heatCost: moveResult.heatCost, heatAfter: heat });
      if (afterMove.maxed) {
        log.push({ type: 'runEnded', outcome: 'heatMaxed' });
        return finish('heatMaxed');
      }

      const node = graph.nodes.find((n) => n.id === position.nodeId);
      if (!node) throw new Error(`playRun: node "${position.nodeId}" is missing from its own layer graph`);
      if (node.state !== 'unresolved') continue; // already resolved -- just passing through

      const outcome = resolveEncounter(node, rng, playerState, safehouseStrategy, shopStrategy);
      graph = { ...graph, nodes: graph.nodes.map((n) => (n.id === node.id ? { ...n, state: outcome.newState } : n)) };
      const afterEncounter = addHeat(heat, outcome.heatDelta);
      heat = afterEncounter.heat;
      if (outcome.dataAwarded > 0) playerState = { ...playerState, data: playerState.data + outcome.dataAwarded };
      if (outcome.rewardOptions.length > 0) {
        const picked = acquisitionStrategy(outcome.rewardOptions, playerState);
        if (picked) playerState = acquireSubroutine(playerState, picked, installedSlotCap);
      }
      if (outcome.mergeTargetId) playerState = mergeSubroutine(playerState, outcome.mergeTargetId);
      if (outcome.shopPurchase) {
        playerState = { ...playerState, data: playerState.data - outcome.shopPurchase.cost };
        playerState = acquireSubroutine(playerState, outcome.shopPurchase.piece, installedSlotCap);
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
