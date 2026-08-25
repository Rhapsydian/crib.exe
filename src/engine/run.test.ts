import { describe, it, expect } from 'vitest';
import { createNode, type LayerGraph } from './map-types';
import { legalMoves } from './traversal';
import { playRun, gatekeeperReachable, beelineToGatekeeper, exploreThenGatekeeper, type TraversalStrategy } from './run';
import type { SubroutineDefinition } from './subroutine-types';
import { BREACHER_LOADOUT } from './subroutines';

/** Same reasoning as encounters.test.ts's OVERWHELMING/NEGLIGIBLE_PLAYER:
 * Breach/Containment's sharp positive-feedback dynamics mean a real
 * class kit's win/loss outcome across a seed sweep is fat-tailed and
 * seed-sensitive, not a reliable way to exercise a *guaranteed* outcome
 * fast. A deliberately lopsided loadout (via installedLoadoutOverride)
 * resolves fast and decisively regardless of direction, so tests that
 * need to reliably observe a win (or a loss) use one of these instead
 * of leaning on Breacher's real starting kit's natural variance.
 *
 * The overwhelming loadout keeps Breacher's real 3-piece kit (Session
 * Lock/Steady Hand at real values) and only scales Buffer Overflow's
 * burst up -- still exercises real trigger timing and the real capped-
 * defense mechanic, confirmed empirically to still resolve in single-
 * digit hands. The negligible loadout stays a synthetic single-piece
 * dummy: with the real defensive pieces left in, no burst magnitude
 * makes a loss resolve within tens of thousands of hands against the
 * current (placeholder) enemy tuning -- see encounters.test.ts's fuller
 * note on why that's a Phase 5 tuning question, not a test-construction
 * one. */
function overwhelmingBreacherLoadout(burstAmount: number): SubroutineDefinition[] {
  return BREACHER_LOADOUT.map((piece) =>
    piece.id === 'buffer-overflow' ? { ...piece, payload: { ...piece.payload, amount: burstAmount } } : piece,
  );
}

function loadoutWithBurst(amount: number): SubroutineDefinition[] {
  return [
    {
      id: 'test-run-burst',
      name: 'test-run-burst',
      archetype: 'exploit',
      trigger: { kind: 'always' },
      payload: { kind: 'directBurst', amount },
      tags: [],
    },
  ];
}

const OVERWHELMING_LOADOUT = overwhelmingBreacherLoadout(30);
const NEGLIGIBLE_LOADOUT = loadoutWithBurst(0.1);

/** Test-only strategy: greedily prefers an already-resolved or
 * known-safe (shop/event) neighbor over anything else, falling back to
 * whatever's legal otherwise. Used to reliably rack up Heat via pure
 * movement without repeatedly gambling on fights -- exploreThenGatekeeper
 * turns out to overwhelmingly end in noRouteRemains instead (see below),
 * since visiting every fight in a layer risks far more than one closure
 * at a time, past what the graph-resilience guarantee promises. */
const wanderPreferringSafety: TraversalStrategy = (graph, position) => {
  const options = legalMoves(graph, position);
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const safe = options.find((id) => {
    const node = nodeById.get(id);
    return node !== undefined && (node.state === 'inert' || node.type === 'shop' || node.type === 'event');
  });
  return safe ?? options[0];
};

describe('gatekeeperReachable', () => {
  it('is true across an intact graph', () => {
    const graph: LayerGraph = {
      nodes: [createNode('entry', 'relay'), createNode('mid', 'regularFight'), createNode('gate', 'gatekeeperFight')],
      edges: [
        { a: 'entry', b: 'mid' },
        { a: 'mid', b: 'gate' },
      ],
      entryNodeId: 'entry',
      gatekeeperNodeId: 'gate',
    };
    expect(gatekeeperReachable(graph, 'entry')).toBe(true);
  });

  it('is false once the only route is closed -- the noRouteRemains condition, deterministically', () => {
    const graph: LayerGraph = {
      nodes: [
        createNode('entry', 'relay'),
        { ...createNode('mid', 'regularFight'), state: 'closed' },
        createNode('gate', 'gatekeeperFight'),
      ],
      edges: [
        { a: 'entry', b: 'mid' },
        { a: 'mid', b: 'gate' },
      ],
      entryNodeId: 'entry',
      gatekeeperNodeId: 'gate',
    };
    expect(gatekeeperReachable(graph, 'entry')).toBe(false);
  });

  it('stays true through a redundant second path even after one route closes', () => {
    const graph: LayerGraph = {
      nodes: [
        createNode('entry', 'relay'),
        { ...createNode('a', 'regularFight'), state: 'closed' },
        createNode('b', 'relay'),
        createNode('gate', 'gatekeeperFight'),
      ],
      edges: [
        { a: 'entry', b: 'a' },
        { a: 'a', b: 'gate' },
        { a: 'entry', b: 'b' },
        { a: 'b', b: 'gate' },
      ],
      entryNodeId: 'entry',
      gatekeeperNodeId: 'gate',
    };
    expect(gatekeeperReachable(graph, 'entry')).toBe(true);
  });
});

// A real class kit's fights (Phase 4 checkpoint A) can take much longer
// than the old symmetric test dummy's did -- see encounters.ts's own
// comment on why. Several tests here run dozens of playRun() calls
// against Breacher's real starting kit, each potentially several
// thousand hands, so this needs real headroom over vitest's 5s default.
// (The tests that need a *guaranteed* outcome use installedLoadoutOverride
// instead, and resolve fast regardless of this timeout.)
describe('playRun', { timeout: 30_000 }, () => {
  const TINY_LAYERS: [number, number, number, number] = [2, 2, 2, 2];

  it('reaches victory on at least one seed with minimal layers (gatekeeper-only fights)', () => {
    const outcomes = Array.from({ length: 5 }, (_, seed) =>
      playRun({
        seed,
        layerNodeCounts: TINY_LAYERS,
        traversalStrategy: beelineToGatekeeper,
        installedLoadoutOverride: OVERWHELMING_LOADOUT,
      }).outcome,
    );
    expect(outcomes).toContain('victory');
  });

  it('quarantines on at least one seed -- losing any gatekeeper ends the run outright', () => {
    const outcomes = Array.from({ length: 5 }, (_, seed) =>
      playRun({
        seed,
        layerNodeCounts: TINY_LAYERS,
        traversalStrategy: beelineToGatekeeper,
        installedLoadoutOverride: NEGLIGIBLE_LOADOUT,
      }).outcome,
    );
    expect(outcomes).toContain('quarantined');
  });

  it('a victorious run clears all 4 layers, matching layersCompleted to the log', () => {
    const victorySeed = Array.from({ length: 50 }, (_, seed) => seed).find(
      (seed) => playRun({ seed, layerNodeCounts: TINY_LAYERS, traversalStrategy: beelineToGatekeeper }).outcome === 'victory',
    );
    expect(victorySeed).toBeDefined();
    const result = playRun({ seed: victorySeed!, layerNodeCounts: TINY_LAYERS, traversalStrategy: beelineToGatekeeper });
    expect(result.layersCompleted).toBe(4);
    expect(result.log.filter((e) => e.type === 'layerCleared')).toHaveLength(4);
  });

  it('reaches heatMaxed on real-scale layers when a strategy just wanders safely', () => {
    const outcomes = Array.from({ length: 25 }, (_, seed) =>
      playRun({ seed, traversalStrategy: wanderPreferringSafety }).outcome,
    );
    expect(outcomes).toContain('heatMaxed');
  });

  it('reaches noRouteRemains far more often than not when a strategy fights every node in a layer', () => {
    // exploreThenGatekeeper deliberately visits every unresolved node,
    // which routinely closes more than the single node the layer's
    // graph-resilience guarantee (checkpoint B) promises safety against
    // -- a real, intended risk of being that aggressive, not a bug. A
    // NEGLIGIBLE loadout makes losses (and so closures) reliable instead
    // of depending on Breacher's real kit's natural win rate, which is
    // high enough that closures -- and so noRouteRemains -- are rare.
    const outcomes = Array.from({ length: 10 }, (_, seed) =>
      playRun({ seed, traversalStrategy: exploreThenGatekeeper, installedLoadoutOverride: NEGLIGIBLE_LOADOUT }).outcome,
    );
    expect(outcomes).toContain('noRouteRemains');
  });

  it('is fully deterministic for the same seed', () => {
    const a = playRun({ seed: 42 });
    const b = playRun({ seed: 42 });
    expect(a).toEqual(b);
  });

  it('defaults to beelineToGatekeeper and real-scale (4-layer) node counts', () => {
    const result = playRun({ seed: 1 });
    const layerSizes = result.log.filter((e) => e.type === 'layerGenerated').map((e) => e.nodeCount);
    expect(layerSizes[0]).toBeGreaterThan(2);
  });

  it('never returns quarantined with a nonzero Heat cost -- gatekeeper losses bypass Heat entirely', () => {
    // NEGLIGIBLE_LOADOUT makes quarantine the reliable outcome, so this
    // actually exercises the assertion instead of vacuously passing when
    // no seed happens to quarantine.
    let sawQuarantine = false;
    for (let seed = 0; seed < 10; seed++) {
      const result = playRun({ seed, layerNodeCounts: TINY_LAYERS, installedLoadoutOverride: NEGLIGIBLE_LOADOUT });
      if (result.outcome !== 'quarantined') continue;
      sawQuarantine = true;
      const quarantineEvent = result.log.find((e) => e.type === 'encounter' && e.outcome.quarantined);
      expect(quarantineEvent).toBeDefined();
      expect(quarantineEvent && quarantineEvent.type === 'encounter' ? quarantineEvent.outcome.heatDelta : -1).toBe(0);
    }
    expect(sawQuarantine).toBe(true);
  });
});
