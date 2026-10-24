import { fightHeatOutlook } from './heat';
import { GHOST_CREDENTIALS_FIGHT_HEAT } from './mods';
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
  type GatekeeperOverride,
} from './run';
import { eligibleEnemies } from './enemies';
import type { SubroutineDefinition } from './subroutine-types';
import { CLASS_STARTING_LOADOUTS } from './subroutines';
import { INSTALLED_SLOT_CAP } from './loadout';
import type { DiscardStrategy } from './deal';
import type { PlayStrategy } from './pegging';
import { layerHeatAllowance, postedFightRisk, HEAT_PER_MOVE, HEAT_HIGH_FRACTION, HEAT_LOW_FRACTION } from './heat';
import { MATERIAL_HIGH_THRESHOLD } from './merge';
import { DATA_HIGH_THRESHOLD, DATA_LOW_THRESHOLD } from './shop';

// Session 52: Heat is a per-layer allowance; a player state built outside a
// run plans against layer 1's (heat.ts's currentHeatCeiling).
const HEAT_MAX = layerHeatAllowance(0);

/** Session 51 port: fixtures moved to the redesigned model. The
 * overwhelming loadout is now the 'exploit-overclock' starting kit
 * (Probe, Voltage Boost, Burst Clock) with only Probe's credit alpha
 * scaled up; the negligible loadout is a lone beta-less verb-alpha
 * credit piece; class ids are the archetype-pair ids. The notes below
 * predate the port and describe the old kits -- kept for the reasoning.
 *
 * Same reasoning as encounters.test.ts's OVERWHELMING/NEGLIGIBLE_PLAYER:
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
 * Every playRun() call using NEGLIGIBLE_LOADOUT passes classId:
 * 'daemon-honeypot' explicitly, not the default ('exploit-overclock') --
 * a class with no Exploit half, so its placeholder bridge passive (which
 * acts only when the class's first archetype fires elevated) can never
 * touch this beta-less Exploit dummy's trajectory -- inert. */
function overwhelmingStarterLoadout(creditAmount: number): SubroutineDefinition[] {
  // Step 3: the real 'exploit-overclock' (Blackhat) starting kit, Port
  // Scan's credit alpha scaled up; Cache Hit's Empower stays real. Fuzzer's
  // feed is stripped so the kit gives the enemy nothing (the Heat window
  // assertions below rely on that).
  return CLASS_STARTING_LOADOUTS['exploit-overclock'].map((piece): SubroutineDefinition => {
    if (piece.id === 'port-scan') return { ...piece, alpha: { verb: 'credit', amount: creditAmount } };
    if (piece.id === 'fuzzer' && piece.beta && piece.beta.effect.verb === 'enhance') return { ...piece, beta: { ...piece.beta, effect: { verb: 'enhance', amount: piece.beta.effect.amount } } };
    return piece;
  });
}

function loadoutWithBurst(amount: number): SubroutineDefinition[] {
  return [
    {
      id: 'test-run-burst',
      name: 'test-run-burst',
      archetype: 'exploit',
      alpha: { verb: 'credit', amount },
    },
  ];
}

const OVERWHELMING_LOADOUT = overwhelmingStarterLoadout(30);
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

  it('falls back to beelineToGatekeeper when no playerState is given', () => {
    expect(opportunisticTraversal(starGraph(), position, lowHeat)).toBe('gate');
  });

  // Session 52: detours are priced at their posted Heat and the reserve
  // holds the gatekeeper's toll, so a "high Heat" player on layer 1's
  // tight allowance can afford nothing. These two pin PRIORITY, so they
  // give the player a roomy allowance where high Heat is still affordable.
  const ROOMY = 60;
  const roomyHighHeat = Math.ceil(HEAT_HIGH_FRACTION * ROOMY);

  it('prefers a reachable fight node over everything else, regardless of state', () => {
    const player = { ...createInitialPlayerState('exploit-overclock'), heatAllowance: ROOMY, material: { a: MATERIAL_HIGH_THRESHOLD }, data: DATA_HIGH_THRESHOLD };
    expect(opportunisticTraversal(starGraph(), position, roomyHighHeat, player)).toBe('fight');
  });

  it('pulls toward the Safehouse when Heat is high and no fight is available', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    const player = { ...createInitialPlayerState('exploit-overclock'), heatAllowance: ROOMY, data: DATA_HIGH_THRESHOLD }; // Data also high, Heat should still win
    expect(opportunisticTraversal(graph, position, roomyHighHeat, player)).toBe('safehouse');
  });

  it('skips a fight whose posted worst-case win would eat the gatekeeper reserve (session 52)', () => {
    // The flip side of pricing detours: on layer 1's own allowance, a high
    // Heat player can no longer afford the fight plus the toll, and goes
    // straight to the gatekeeper instead.
    const player = { ...createInitialPlayerState('exploit-overclock'), material: { a: MATERIAL_HIGH_THRESHOLD }, data: DATA_HIGH_THRESHOLD };
    // Set from the costs themselves (milestone 3 raised the allowances):
    // room for the gatekeeper's toll and three moves, not a fight as well.
    const tightHeat = HEAT_MAX - postedFightRisk('gatekeeper', 0).worstWin - 3 * HEAT_PER_MOVE;
    expect(opportunisticTraversal(starGraph(), position, tightHeat, player)).toBe('gate');
  });

  it('pulls toward the Safehouse when banked material is high (Heat not high)', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    const player = { ...createInitialPlayerState('exploit-overclock'), material: { a: MATERIAL_HIGH_THRESHOLD } };
    expect(opportunisticTraversal(graph, position, lowHeat, player)).toBe('safehouse');
  });

  it('pulls toward the Shop when Data is high (Heat and material not high)', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    const player = { ...createInitialPlayerState('exploit-overclock'), data: DATA_HIGH_THRESHOLD };
    expect(opportunisticTraversal(graph, position, lowHeat, player)).toBe('shop');
  });

  it('pulls toward the Event when Heat, material, and Data are all low', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    const player = { ...createInitialPlayerState('exploit-overclock'), data: DATA_LOW_THRESHOLD };
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
    const player = { ...createInitialPlayerState('exploit-overclock'), data: Math.round((DATA_HIGH_THRESHOLD + DATA_LOW_THRESHOLD) / 2) };
    expect(opportunisticTraversal(graph, position, midHeat, player)).toBe('gate');
  });

  it('never takes a detour that would risk stranding it short of the gatekeeper -- falls through to beeline instead', () => {
    const graph = { ...starGraph(), nodes: starGraph().nodes.map((n) => (n.type === 'regularFight' ? { ...n, state: 'inert' as const } : n)) };
    const player = { ...createInitialPlayerState('exploit-overclock'), material: { a: MATERIAL_HIGH_THRESHOLD } };
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
        classId: 'exploit-overclock',
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
      classId: 'exploit-overclock',
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
        classId: 'daemon-honeypot',
      }).outcome,
    );
    expect(outcomes).toContain('quarantined');
  });

  it('a victorious run clears all 4 layers, matching layersCompleted to the log', () => {
    // Scans a wide seed range because the point is "find a victorious
    // run and check its shape," not "seed N wins."
    //
    // Session 50 (D11-A): a FLOOR-strategy player now wins in none of
    // 500 seeds -- unconditional firing revived more dead enemy content
    // than player content, so the game got harder. The player is given
    // the project's standing diagnostic skill (0.85) rather than the
    // scan being widened: the test's subject is a victory's SHAPE, and
    // "a floor player can win at all" was never what it asserted. First
    // victory now lands at seed 7. (Session 51: seed 6 on the skeleton
    // roster; a floor player still wins none of the first 50.)
    const victorySeed = Array.from({ length: 500 }, (_, seed) => seed).find(
      (seed) => playRun({ seed, layerNodeCounts: TINY_LAYERS, traversalStrategy: beelineToGatekeeper, playerSkill: 0.85 }).outcome === 'victory',
    );
    expect(victorySeed).toBeDefined();
    const result = playRun({ seed: victorySeed!, layerNodeCounts: TINY_LAYERS, traversalStrategy: beelineToGatekeeper, playerSkill: 0.85 });
    expect(result.layersCompleted).toBe(4);
    expect(result.log.filter((e) => e.type === 'layerCleared')).toHaveLength(4);
    // 4 gatekeeper wins (checkpoint C) each award Data -- confirms it
    // actually accumulates on RunPlayerState across a real run, not just
    // in a single resolveEncounter() call (encounters.test.ts).
    expect(result.playerState.data).toBeGreaterThan(0);
    // Checkpoint D: the default acquisitionStrategy takes a reward from
    // each of those 4 wins, growing the loadout beyond the default class's
    // starting 3-piece kit -- exactly what makes session 20's original
    // static-loadout sweep no longer representative (see BACKLOG.md).
    const totalOwned = result.playerState.installedLoadout.length + result.playerState.bench.length;
    expect(totalOwned).toBeGreaterThan(3);
    // Mod-granted pieces (Backdoor Access, Auxiliary Process) are
    // always-slotted by design and sit outside the cap.
    const slotted = result.playerState.installedLoadout.filter((p) => !result.playerState.grantedByMod[p.id]);
    expect(slotted.length).toBeLessThanOrEqual(INSTALLED_SLOT_CAP);
  });

  it('onBeforeGatekeeperFight (session 39) fires once per gatekeeper fight with the real accumulated state at that moment', () => {
    // Scans a wide seed range because the point is "find a victorious
    // run and check its shape," not "seed N wins."
    //
    // Session 50 (D11-A): a FLOOR-strategy player now wins in none of
    // 500 seeds -- unconditional firing revived more dead enemy content
    // than player content, so the game got harder. The player is given
    // the project's standing diagnostic skill (0.85) rather than the
    // scan being widened: the test's subject is a victory's SHAPE, and
    // "a floor player can win at all" was never what it asserted. First
    // victory now lands at seed 7. (Session 51: seed 6 on the skeleton
    // roster; a floor player still wins none of the first 50.)
    const victorySeed = Array.from({ length: 500 }, (_, seed) => seed).find(
      (seed) => playRun({ seed, layerNodeCounts: TINY_LAYERS, traversalStrategy: beelineToGatekeeper, playerSkill: 0.85 }).outcome === 'victory',
    );
    expect(victorySeed).toBeDefined();
    const captures: GatekeeperFightContext[] = [];
    const result = playRun({
      seed: victorySeed!,
      layerNodeCounts: TINY_LAYERS,
      traversalStrategy: beelineToGatekeeper,
      playerSkill: 0.85,
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
    // yet, so the loadout is still exactly the default class's starting 3
    // pieces.
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
      playRun({ seed, traversalStrategy: exploreThenGatekeeper, installedLoadoutOverride: NEGLIGIBLE_LOADOUT, classId: 'daemon-honeypot' }).outcome,
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
      const result = playRun({ seed, layerNodeCounts: TINY_LAYERS, installedLoadoutOverride: NEGLIGIBLE_LOADOUT, classId: 'daemon-honeypot' });
      if (result.outcome !== 'quarantined') continue;
      sawQuarantine = true;
      const quarantineEvent = result.log.find((e) => e.type === 'encounter' && e.outcome.quarantined);
      expect(quarantineEvent).toBeDefined();
      expect(quarantineEvent && quarantineEvent.type === 'encounter' ? quarantineEvent.outcome.heatDelta : -1).toBe(0);
    }
    expect(sawQuarantine).toBe(true);
  });
});

describe('gatekeeperOverrides (session 49) -- the synthetic gatekeeper diagnostic', () => {
  const TINY_LAYERS: [number, number, number, number] = [2, 2, 2, 2];
  const ALWAYS: GatekeeperOverride = { kind: 'synthetic', passRate: 1, heatGenerated: 0 };
  const NEVER: GatekeeperOverride = { kind: 'synthetic', passRate: 0, heatGenerated: 0 };

  const gatekeeperEntries = (result: ReturnType<typeof playRun>) =>
    result.log.filter((e) => e.type === 'encounter' && e.nodeType === 'gatekeeperFight');

  it('leaves every run byte-identical when unset', () => {
    // The guard that matters most: this option must be inert by default.
    // Proven empirically across 100 seeds x 6 classes at the standing
    // diagnostic config when it was built; kept here as a cheap
    // permanent version of the same check.
    for (let seed = 0; seed < 5; seed++) {
      expect(playRun({ seed, layerNodeCounts: TINY_LAYERS })).toEqual(playRun({ seed, layerNodeCounts: TINY_LAYERS, gatekeeperOverrides: undefined }));
    }
  });

  it('passRate 1 carries a loadout that could never win a real fight past the gatekeeper', () => {
    // NEGLIGIBLE_LOADOUT reliably LOSES a real gatekeeper fight, so
    // clearing layer 1 with it is direct proof the fight was synthesised
    // rather than played -- not merely that an outcome was favourable.
    let cleared = 0;
    for (let seed = 0; seed < 10; seed++) {
      const result = playRun({
        seed,
        layerNodeCounts: TINY_LAYERS,
        installedLoadoutOverride: NEGLIGIBLE_LOADOUT,
        gatekeeperOverrides: [ALWAYS, ALWAYS, ALWAYS, ALWAYS],
      });
      expect(result.outcome).not.toBe('quarantined');
      if (result.layersCompleted > 0) cleared++;
    }
    expect(cleared).toBeGreaterThan(0);
  });

  it('passRate 0 quarantines a loadout that would reliably win a real fight', () => {
    // The mirror of the above, and the reason both exist: a one-sided
    // test could pass because the synthetic did nothing at all.
    let asserted = 0;
    for (let seed = 0; seed < 10; seed++) {
      const result = playRun({
        seed,
        layerNodeCounts: TINY_LAYERS,
        installedLoadoutOverride: OVERWHELMING_LOADOUT,
        gatekeeperOverrides: [NEVER, NEVER, NEVER, NEVER],
      });
      if (result.outcome === 'heatMaxed' || result.outcome === 'noRouteRemains') continue; // died before reaching it
      expect(result.outcome).toBe('quarantined');
      expect(result.layersCompleted).toBe(0);
      asserted++;
    }
    // Without this the `continue` above could skip every seed and leave
    // the test asserting nothing -- the shape session 48's instrument
    // audit found in burners.test.ts.
    expect(asserted).toBeGreaterThan(0);
  });

  it('applies per layer, leaving unset layers on real fights', () => {
    const result = playRun({
      seed: 3,
      layerNodeCounts: TINY_LAYERS,
      installedLoadoutOverride: NEGLIGIBLE_LOADOUT,
      gatekeeperOverrides: [ALWAYS],
    });
    // Layer 1 is synthesised so it clears; layer 2 is a real fight this
    // loadout cannot win, so the run cannot get past it.
    expect(result.layersCompleted).toBe(1);
  });

  it('folds heatGenerated into the run Heat a synthetic win costs', () => {
    // Same seed either side, so the RNG stream and any owned heat-sink
    // refund are identical up to the layer-1 gatekeeper -- the whole
    // difference in its heatDelta is the alarm Heat supplied.
    const withoutAlarm = playRun({ seed: 7, layerNodeCounts: TINY_LAYERS, gatekeeperOverrides: [ALWAYS] });
    const withAlarm = playRun({ seed: 7, layerNodeCounts: TINY_LAYERS, gatekeeperOverrides: [{ kind: 'synthetic', passRate: 1, heatGenerated: 25 }] });
    const a = gatekeeperEntries(withoutAlarm)[0];
    const b = gatekeeperEntries(withAlarm)[0];
    expect(a && a.type === 'encounter' && b && b.type === 'encounter' ? b.outcome.heatDelta - a.outcome.heatDelta : 0).toBe(25);
  });

  it('samples an empirical alarm-Heat distribution rather than collapsing it to a mean', () => {
    // A skewed sample fed as its mean deletes the tail that drives Heat
    // deaths.
    // The array form must actually spread across the samples, not pick
    // one deterministically for every fight.
    const samples = [0, 0, 0, 40];
    const seen = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      const result = playRun({
        seed,
        layerNodeCounts: TINY_LAYERS,
        gatekeeperOverrides: [{ kind: 'synthetic', passRate: 1, heatGenerated: samples }],
      });
      const first = gatekeeperEntries(result)[0];
      if (first && first.type === 'encounter') seen.add(first.outcome.heatDelta);
    }
    // Both a zero and a tail draw must appear; a single value here
    // would mean the index is constant and the distribution is fiction.
    expect(seen.size).toBeGreaterThan(1);
    expect(Math.max(...seen)).toBeGreaterThan(Math.min(...seen));
  });

  it('honours the pass rate over a seed sweep, and stays deterministic per seed', () => {
    const HALF: GatekeeperOverride = { kind: 'synthetic', passRate: 0.5, heatGenerated: 0 };
    let reached = 0;
    let passed = 0;
    for (let seed = 0; seed < 300; seed++) {
      const result = playRun({ seed, layerNodeCounts: TINY_LAYERS, gatekeeperOverrides: [HALF, HALF, HALF, HALF] });
      const first = gatekeeperEntries(result)[0];
      if (!first || first.type !== 'encounter') continue;
      reached++;
      if (!first.outcome.quarantined) passed++;
    }
    expect(reached).toBeGreaterThan(100);
    expect(passed / reached).toBeGreaterThan(0.38);
    expect(passed / reached).toBeLessThan(0.62);
    expect(playRun({ seed: 11, gatekeeperOverrides: [HALF, HALF, HALF, HALF] })).toEqual(playRun({ seed: 11, gatekeeperOverrides: [HALF, HALF, HALF, HALF] }));
    // 300 tiny runs plus two full ones: longer since milestone 3's bigger
    // layers, so past vitest's 5 s default under a parallel full suite.
  }, 20_000);

  it('pins a layer to one real gatekeeper without touching the fight itself', () => {
    const target = eligibleEnemies('gatekeeper', 1)[0].id;
    const captures: GatekeeperFightContext[] = [];
    for (let seed = 0; seed < 20; seed++) {
      playRun({
        seed,
        layerNodeCounts: TINY_LAYERS,
        gatekeeperOverrides: [{ kind: 'pinned', enemyId: target }],
        onBeforeGatekeeperFight: (ctx) => captures.push(ctx),
      });
    }
    const layerOne = captures.filter((c) => c.layerIndex === 1);
    expect(layerOne.length).toBeGreaterThan(0);
    expect(layerOne.every((c) => c.enemy.id === target)).toBe(true);
  });

  it('rejects pinning a gatekeeper that is not in that layer stable, naming the stable', () => {
    const notInLayerOne = eligibleEnemies('gatekeeper', 4)[0].id;
    expect(() => playRun({ seed: 1, gatekeeperOverrides: [{ kind: 'pinned', enemyId: notInLayerOne }] })).toThrow(/layer 1/);
  });
});

describe('per-layer Heat economy (session 52: D4, D5, R8)', () => {
  const runs = (classId: 'exploit-overclock' | 'exploit-daemon', seeds: number) =>
    Array.from({ length: seeds }, (_, seed) => playRun({ seed, classId, playerSkill: 0.85, traversalStrategy: opportunisticTraversal }));

  it('resets Heat after a gatekeeper is cleared and survived (D4)', () => {
    let checked = 0;
    for (const result of runs('exploit-daemon', 20)) {
      result.log.forEach((event, i) => {
        if (event.type !== 'layerCleared') return;
        const nextMove = result.log.slice(i + 1).find((e) => e.type === 'move');
        if (!nextMove || nextMove.type !== 'move') return;
        // The next layer's first move starts from 0.
        expect(nextMove.heatAfter).toBeLessThanOrEqual(nextMove.heatCost);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  }, 20_000);

  it("never lets Heat exceed the layer's own allowance (D5)", () => {
    for (const result of runs('exploit-overclock', 20)) {
      for (const event of result.log) {
        if (event.type === 'move' || event.type === 'encounter') {
          expect(event.heatAfter).toBeLessThanOrEqual(layerHeatAllowance(event.layerIndex, result.playerState.maxHeatBonus));
        }
      }
    }
  });

  it('"breached, then caught": a gatekeeper win whose toll maxes Heat ends the run, counted as a breach (R8)', () => {
    // 150 runs (was 60): rarer since session 62's Shop prices.
    const caught = runs('exploit-overclock', 150).filter((r) => r.outcome === 'breachedThenCaught');
    expect(caught.length).toBeGreaterThan(0);
    for (const result of caught) {
      const encounters = result.log.filter((e) => e.type === 'encounter');
      const last = encounters[encounters.length - 1];
      if (last.type !== 'encounter') throw new Error('unreachable');
      expect(last.nodeType).toBe('gatekeeperFight');
      expect(last.outcome.newState).toBe('inert');
      // Caught at the ceiling the player went INTO the fight with: the toll
      // is checked before the gatekeeper's rewards are collected, so a
      // Backup Generator won from this very fight (+allowance) arrives
      // after the catch. Hence a range, not the final allowance exactly.
      expect(last.heatAfter).toBeGreaterThanOrEqual(layerHeatAllowance(last.layerIndex, 0));
      expect(last.heatAfter).toBeLessThanOrEqual(layerHeatAllowance(last.layerIndex, result.playerState.maxHeatBonus));
      // The breached layer counts.
      expect(result.layersCompleted).toBe(result.log.filter((e) => e.type === 'layerCleared').length);
    }
  }, 75_000); // 150 full runs

  it("the fight screen's Heat outlook charges a win or a loss exactly as the run does (session 63)", () => {
    let checked = 0;
    let losses = 0;
    // Weaker play too, so regular and elite losses turn up.
    const weak = Array.from({ length: 40 }, (_, seed) => playRun({ seed, classId: 'exploit-daemon', playerSkill: 0.3, traversalStrategy: opportunisticTraversal }));
    for (const result of [...runs('exploit-daemon', 40), ...weak]) {
      for (const e of result.log) {
        if (e.type !== 'encounter' || !e.outcome.fight) continue;
        const tier = e.outcome.fight.tier;
        const won = e.outcome.newState === 'inert';
        if (!won && tier === 'gatekeeper') continue;
        const o = fightHeatOutlook({
          heat: 100,
          allowance: 999,
          tier,
          layerIndex: e.layerIndex,
          alarm: e.outcome.heatSources.alarm,
          enemyFill: e.outcome.fight.finalFillFraction[1],
          refund: -e.outcome.heatSources.refund,
          multiplier: e.outcome.heatSources.mod > 0 ? GHOST_CREDENTIALS_FIGHT_HEAT : 1,
        });
        // Before any map Burner's cut (booked as `burner` Heat, session 64).
        expect(won ? o.winGain : o.loseGain!).toBeCloseTo(e.outcome.heatDelta - e.outcome.heatSources.burner, 6);
        if (!won) losses++;
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
    expect(losses).toBeGreaterThan(0);
  }, 150_000);

  it('trace evasion (session 63): a maxed toll after a gatekeeper win plays an evasion; escape goes on, a loss is caught', () => {
    let escaped = 0;
    let traced = 0;
    for (const result of [...runs('exploit-overclock', 150), ...runs('exploit-daemon', 150)]) {
      result.log.forEach((event, i) => {
        if (event.type !== 'evasion') return;
        const before = result.log[i - 1];
        expect(before.type === 'encounter' && before.nodeType === 'gatekeeperFight' && before.outcome.newState === 'inert').toBe(true);
        expect(event.escaped).toBe(event.finalScores[0] > event.finalScores[1]);
        const after = result.log.slice(i + 1);
        if (event.escaped) {
          escaped++;
          // On to the next layer, or the run is won.
          expect(after.some((e) => e.type === 'layerGenerated') || result.outcome === 'victory').toBe(true);
        } else {
          traced++;
          expect(result.outcome).toBe('breachedThenCaught');
          expect(after.filter((e) => e.type === 'encounter')).toHaveLength(0);
        }
      });
      // A run only ends "breached, then caught" after losing an evasion.
      if (result.outcome === 'breachedThenCaught') expect(result.log.some((e) => e.type === 'evasion' && !e.escaped)).toBe(true);
    }
    expect(escaped).toBeGreaterThan(0);
    expect(traced).toBeGreaterThan(0);
  }, 150_000);
});
