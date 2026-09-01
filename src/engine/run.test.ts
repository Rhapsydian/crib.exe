import { describe, it, expect } from 'vitest';
import { createNode, type LayerGraph } from './map-types';
import { legalMoves } from './traversal';
import {
  playRun,
  gatekeeperReachable,
  beelineToGatekeeper,
  exploreThenGatekeeper,
  opportunisticTraversal,
  createInitialPlayerState,
  type TraversalStrategy,
  type GatekeeperFightContext,
} from './run';
import type { SubroutineDefinition } from './subroutine-types';
import { BREACHER_LOADOUT } from './subroutines';
import { INSTALLED_SLOT_CAP } from './loadout';
import type { DiscardStrategy } from './deal';
import type { PlayStrategy } from './pegging';
import { HEAT_MAX, HEAT_PER_MOVE, HEAT_HIGH_FRACTION, HEAT_LOW_FRACTION } from './heat';
import { MATERIAL_HIGH_THRESHOLD } from './merge';
import { DATA_HIGH_THRESHOLD, DATA_LOW_THRESHOLD } from './shop';

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
 * Lock/Lock Fatigue -- session 29's replacement for Steady Hand -- at
 * real values) and only scales Buffer Overflow's burst up -- still
 * exercises real trigger timing and the real capped-defense mechanic,
 * confirmed empirically to still resolve in single-digit hands. The
 * negligible loadout stays a synthetic single-piece dummy: pinning Buffer
 * Overflow near zero still doesn't make a real Breacher kit lose fast and
 * reliably (Lock Fatigue's own accumulator threshold ties convergence to
 * dealer-turn timing rather than a clean magnitude contrast) -- see
 * encounters.test.ts's fuller note on why that's a Phase 5 tuning
 * question, not a test-construction one.
 *
 * Every playRun() call using NEGLIGIBLE_LOADOUT passes classId: 'ghost'
 * explicitly, not the default ('breacher') -- Phase 4 checkpoint B wired
 * Foothold in to hook every Breach/Containment crossing regardless of
 * payload kind, which could inject an unwanted bonus into this single-
 * piece dummy's trajectory. Ghost's own passive only touches
 * instantCounterPush payloads, which this dummy never fires -- inert. */
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

describe('opportunisticTraversal', () => {
  // Star topology centered on entry: every candidate node type is one hop
  // from entry, and (with no other edges) two hops from gate via entry --
  // enough to exercise the safety-reserve calculation without needing a
  // more elaborate graph.
  function starGraph(): LayerGraph {
    return {
      nodes: [
        createNode('entry', 'relay'),
        createNode('fight', 'regularFight'),
        createNode('safehouse', 'safehouse'),
        createNode('shop', 'shop'),
        createNode('event', 'event'),
        createNode('gate', 'gatekeeperFight'),
      ],
      edges: [
        { a: 'entry', b: 'fight' },
        { a: 'entry', b: 'safehouse' },
        { a: 'entry', b: 'shop' },
        { a: 'entry', b: 'event' },
        { a: 'entry', b: 'gate' },
      ],
      entryNodeId: 'entry',
      gatekeeperNodeId: 'gate',
    };
  }
  const position = { layerIndex: 0, nodeId: 'entry' };
  const lowHeat = 0;
  const highHeat = Math.ceil(HEAT_HIGH_FRACTION * HEAT_MAX);

  it('falls back to beelineToGatekeeper when no playerState is given', () => {
    expect(opportunisticTraversal(starGraph(), position, lowHeat)).toBe('gate');
  });

  it('prefers a reachable fight node over everything else, regardless of state', () => {
    const player = { ...createInitialPlayerState('breacher'), material: { a: MATERIAL_HIGH_THRESHOLD }, data: DATA_HIGH_THRESHOLD };
    expect(opportunisticTraversal(starGraph(), position, highHeat, player)).toBe('fight');
  });

  it('pulls toward the Safehouse when Heat is high and no fight is available', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    const player = { ...createInitialPlayerState('breacher'), data: DATA_HIGH_THRESHOLD }; // Data also high, Heat should still win
    expect(opportunisticTraversal(graph, position, highHeat, player)).toBe('safehouse');
  });

  it('pulls toward the Safehouse when banked material is high (Heat not high)', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    const player = { ...createInitialPlayerState('breacher'), material: { a: MATERIAL_HIGH_THRESHOLD } };
    expect(opportunisticTraversal(graph, position, lowHeat, player)).toBe('safehouse');
  });

  it('pulls toward the Shop when Data is high (Heat and material not high)', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    const player = { ...createInitialPlayerState('breacher'), data: DATA_HIGH_THRESHOLD };
    expect(opportunisticTraversal(graph, position, lowHeat, player)).toBe('shop');
  });

  it('pulls toward the Event when Heat, material, and Data are all low', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    const player = { ...createInitialPlayerState('breacher'), data: DATA_LOW_THRESHOLD };
    expect(opportunisticTraversal(graph, position, lowHeat, player)).toBe('event');
  });

  it('beelines when Safehouse/Shop/Event are all still available but no pull condition is active', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    // Mid-range Heat/Data, no material banked: not high enough to pull
    // toward Safehouse/Shop, not low enough (all three) to pull toward
    // Event -- Safehouse/Shop/Event are all still genuinely reachable and
    // unresolved here, so this proves the algorithm actively declines
    // them rather than just having nothing left to pull toward.
    const midHeat = Math.round(((HEAT_HIGH_FRACTION + HEAT_LOW_FRACTION) / 2) * HEAT_MAX);
    const player = { ...createInitialPlayerState('breacher'), data: Math.round((DATA_HIGH_THRESHOLD + DATA_LOW_THRESHOLD) / 2) };
    expect(opportunisticTraversal(graph, position, midHeat, player)).toBe('gate');
  });

  it('never takes a detour that would risk stranding it short of the gatekeeper -- falls through to beeline instead', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    const player = { ...createInitialPlayerState('breacher'), material: { a: MATERIAL_HIGH_THRESHOLD } };
    // Detouring to safehouse costs 3 hops (entry->safehouse->entry->gate)
    // worth of Heat -- pin current Heat close enough to HEAT_MAX that the
    // reserve can't cover it, even though material is high.
    const nearMaxHeat = HEAT_MAX - 3 * HEAT_PER_MOVE + 1;
    expect(opportunisticTraversal(graph, position, nearMaxHeat, player)).toBe('gate');
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
        classId: 'breacher',
      }).outcome,
    );
    expect(outcomes).toContain('victory');
  });

  it('threads discardStrategies/playStrategies through resolveEncounter into real fights (session 24 tunable-skill AI checkpoint A)', () => {
    let discardCalls = 0;
    let playCalls = 0;
    const spyDiscard: DiscardStrategy = (ctx) => {
      discardCalls++;
      const sorted = ctx.hand.slice().sort((a, b) => a.rank - b.rank);
      return [sorted[0], sorted[1]];
    };
    const spyPlay: PlayStrategy = (ctx) => {
      playCalls++;
      return ctx.legalCards[0];
    };
    playRun({
      seed: 1,
      layerNodeCounts: TINY_LAYERS,
      traversalStrategy: beelineToGatekeeper,
      installedLoadoutOverride: OVERWHELMING_LOADOUT,
      classId: 'breacher',
      discardStrategies: [spyDiscard, spyDiscard],
      playStrategies: [spyPlay, spyPlay],
    });
    expect(discardCalls).toBeGreaterThan(0);
    expect(playCalls).toBeGreaterThan(0);
  });

  it('quarantines on at least one seed -- losing any gatekeeper ends the run outright', () => {
    const outcomes = Array.from({ length: 5 }, (_, seed) =>
      playRun({
        seed,
        layerNodeCounts: TINY_LAYERS,
        traversalStrategy: beelineToGatekeeper,
        installedLoadoutOverride: NEGLIGIBLE_LOADOUT,
        classId: 'ghost',
      }).outcome,
    );
    expect(outcomes).toContain('quarantined');
  });

  it('a victorious run clears all 4 layers, matching layersCompleted to the log', () => {
    // Scans a wide seed range because the point is "find a victorious
    // run and check its shape," not "seed N wins." Widened from 50 in
    // session 46: adding the 18 Neutral pieces to every class's reward
    // pool shifted which seeds win, and a floor-strategy player
    // (alwaysAcquireFirst, beeline, no skill dial) wins rarely enough
    // that the first victory now lands at seed 96.
    const victorySeed = Array.from({ length: 500 }, (_, seed) => seed).find(
      (seed) => playRun({ seed, layerNodeCounts: TINY_LAYERS, traversalStrategy: beelineToGatekeeper }).outcome === 'victory',
    );
    expect(victorySeed).toBeDefined();
    const result = playRun({ seed: victorySeed!, layerNodeCounts: TINY_LAYERS, traversalStrategy: beelineToGatekeeper });
    expect(result.layersCompleted).toBe(4);
    expect(result.log.filter((e) => e.type === 'layerCleared')).toHaveLength(4);
    // 4 gatekeeper wins (checkpoint C) each award Data -- confirms it
    // actually accumulates on RunPlayerState across a real run, not just
    // in a single resolveEncounter() call (encounters.test.ts).
    expect(result.playerState.data).toBeGreaterThan(0);
    // Checkpoint D: the default acquisitionStrategy takes a reward from
    // each of those 4 wins, growing the loadout beyond Breacher's
    // starting 3-piece kit -- exactly what makes session 20's original
    // static-loadout sweep no longer representative (see BACKLOG.md).
    const totalOwned = result.playerState.installedLoadout.length + result.playerState.bench.length;
    expect(totalOwned).toBeGreaterThan(3);
    expect(result.playerState.installedLoadout.length).toBeLessThanOrEqual(INSTALLED_SLOT_CAP);
  });

  it('onBeforeGatekeeperFight (session 39) fires once per gatekeeper fight with the real accumulated state at that moment', () => {
    // Scans a wide seed range because the point is "find a victorious
    // run and check its shape," not "seed N wins." Widened from 50 in
    // session 46: adding the 18 Neutral pieces to every class's reward
    // pool shifted which seeds win, and a floor-strategy player
    // (alwaysAcquireFirst, beeline, no skill dial) wins rarely enough
    // that the first victory now lands at seed 96.
    const victorySeed = Array.from({ length: 500 }, (_, seed) => seed).find(
      (seed) => playRun({ seed, layerNodeCounts: TINY_LAYERS, traversalStrategy: beelineToGatekeeper }).outcome === 'victory',
    );
    expect(victorySeed).toBeDefined();
    const captures: GatekeeperFightContext[] = [];
    const result = playRun({
      seed: victorySeed!,
      layerNodeCounts: TINY_LAYERS,
      traversalStrategy: beelineToGatekeeper,
      onBeforeGatekeeperFight: (ctx) => captures.push(ctx),
    });
    expect(result.outcome).toBe('victory');
    // One capture per layer cleared -- fires right before the gatekeeper
    // fight resolves, not after, so this can't just be re-deriving the
    // 4 layerCleared log entries after the fact.
    expect(captures).toHaveLength(4);
    expect(captures.map((c) => c.layerIndex)).toEqual([1, 2, 3, 4]);
    for (const c of captures) expect(c.enemy.tier).toBe('gatekeeper');
    // fightsResolved should be non-decreasing across captures (each
    // layer's regular/elite fights along the way bump it before the
    // next layer's gatekeeper capture) -- same counter a real
    // resolveFight call would see for this exact fight.
    for (let i = 1; i < captures.length; i++) expect(captures[i].fightsResolved).toBeGreaterThanOrEqual(captures[i - 1].fightsResolved);
    // The very first capture happens before this run's first-ever fight
    // resolves (TINY_LAYERS' layer 1 is gatekeeper-only, matching the
    // "gatekeeper-only fights" framing above) -- proves this is a live
    // mid-run snapshot, not just the final RunResult.playerState handed
    // back four times: at this exact moment nothing has been acquired
    // yet, so the loadout is still exactly Breacher's starting 3 pieces.
    expect(captures[0].fightsResolved).toBe(0);
    expect(captures[0].playerState.installedLoadout).toHaveLength(3);
    expect(captures[0].playerState.bench).toHaveLength(0);
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
      playRun({ seed, traversalStrategy: exploreThenGatekeeper, installedLoadoutOverride: NEGLIGIBLE_LOADOUT, classId: 'ghost' }).outcome,
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
      const result = playRun({ seed, layerNodeCounts: TINY_LAYERS, installedLoadoutOverride: NEGLIGIBLE_LOADOUT, classId: 'ghost' });
      if (result.outcome !== 'quarantined') continue;
      sawQuarantine = true;
      const quarantineEvent = result.log.find((e) => e.type === 'encounter' && e.outcome.quarantined);
      expect(quarantineEvent).toBeDefined();
      expect(quarantineEvent && quarantineEvent.type === 'encounter' ? quarantineEvent.outcome.heatDelta : -1).toBe(0);
    }
    expect(sawQuarantine).toBe(true);
  });
});
