import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createNode } from './map-types';
import { totalHeatSources, NO_HEAT_SOURCES, resolveEncounter, combatThresholdsFor, GAUGE_THRESHOLD, BREACH_THRESHOLD, CONTAINMENT_THRESHOLD } from './encounters';
import { ENEMY_ROSTER, type EnemyDefinition, type EnemyId } from './enemies';
import { discardLowestTwo, type DiscardStrategy } from './deal';
import { playLowestLegal, type PlayStrategy } from './pegging';
import { playRun, opportunisticTraversal, type RunPlayerState } from './run';
import { ALL_CLASS_IDS, type ClassId } from './classes';
import type { SubroutineDefinition } from './subroutine-types';
import { CLASS_STARTING_LOADOUTS } from './subroutines';
import { REWARD_OPTIONS_COUNT } from './rewards';
import { dataForTier } from './data';
import { REROLL_COST, buyCheapestAffordable, type ShopRerollStrategy } from './shop';
import { preferMergeWhenAvailable } from './merge';
import { postedFightRisk } from './heat';

/**
 * Session 51 port: fixtures moved to the redesigned model. The win side
 * is now the 'exploit-overclock' class's real starting kit (Probe,
 * Voltage Boost, Burst Clock) with only Probe's credit alpha scaled up;
 * the loss side is a lone beta-less verb-alpha credit piece; the pinned
 * enemies are skeleton-roster ids; class sweeps read ALL_CLASS_IDS. The
 * historical notes below describe the pre-session-51 kits they were
 * written against and are kept for the reasoning, not the piece names.
 *
 * Breach/Containment is a sharp positive-feedback race (session 20's own
 * finding, confirmed again at Phase 4 checkpoint A): a near-symmetric
 * matchup can take anywhere from tens to tens of thousands of hands to
 * resolve, with no reliable "sometimes wins, sometimes loses, resolves
 * quickly" zone in between -- swept seeds against one borderline test
 * loadout turned out to be a flaky, slow way to exercise both outcomes.
 * Using two deliberately lopsided constructions instead -- a huge edge
 * resolves fast and decisively regardless of direction (see game.test.ts/
 * combat.test.ts's own similar patterns) -- tests resolveEncounter's own
 * wiring (Heat/reward-tier/quarantine mechanics) directly, without
 * needing seed-sweep luck to hit both outcomes.
 *
 * The win side uses Breacher's *real* starting kit with only Buffer
 * Overflow's magnitude scaled up -- Session Lock and Lock Fatigue (session
 * 29's replacement for Steady Hand) stay at their real, unscaled values,
 * so this still exercises real trigger timing (Occurrence: Run, Self-state:
 * isDealer) and the real capped instantCounterPush/midpoint-cap mechanic,
 * not just a synthetic single-piece stand-in. Confirmed empirically (debug
 * sweep) to still resolve in single-digit hands at this magnitude.
 *
 * The loss side can't use the same trick: even with Lock Fatigue now
 * giving Session Lock's suppression an eventual real-credit outlet
 * (session 29), pinning Buffer Overflow's burst near zero still leaves no
 * reliably fast, deterministic loss for a real Breacher kit -- Lock
 * Fatigue's own accumulator threshold means convergence time still depends
 * on dealer-turn timing, not a clean small-vs-large magnitude contrast the
 * way the win side has. Forcing a fast loss would require either stripping
 * the defensive/Lock-Fatigue pieces (no longer "real Breacher shape") or an
 * enemy stronger than any fight tier currently uses -- both are tuning
 * questions for Phase 5, not something to bake into this test. Falls back
 * to a synthetic single-piece negligible dummy instead.
 */
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

// classId: 'daemon-honeypot' here, deliberately a class with no Exploit
// half -- the class passive must stay inert against this single-piece
// dummy's own trajectory. Session 51's placeholder bridge passive only
// acts when a piece of the class's first archetype fires elevated; this
// dummy is an Exploit piece with no beta, so it can never fire elevated
// and is never the feeder archetype either -- doubly inert.
function playerWithBurst(amount: number): RunPlayerState {
  return {
    classId: 'daemon-honeypot',
    installedLoadout: [
      {
        id: 'test-player-burst',
        name: 'test-player-burst',
        archetype: 'exploit',
        alpha: { verb: 'credit', amount },
      } satisfies SubroutineDefinition,
    ],
    data: 0,
    bench: [],
    material: {},
    rank: {},
    ownedModIds: [],
    grantedByMod: {},
    maxHeatBonus: 0,
    modRunState: {},
    carriedBurnerIds: [],
  };
}

describe('combatThresholdsFor -- the meta-progression sockets (session 48)', () => {
  // No authored gatekeeper sets a Containment override, so the
  // authored-65 gatekeeper is a fixture built on a real one rather than a
  // roster lookup.
  const plainGate = ENEMY_ROSTER.find((e) => e.id === 'the-concierge')!; // no overrides at all
  const nullSession: EnemyDefinition = { ...ENEMY_ROSTER.find((e) => e.id === 'root-authority')!, winThreshold: 65 };
  const base = playerWithBurst(1);

  it('falls back to the flat constants when nothing is socketed -- the state of every run today', () => {
    expect(plainGate.winThreshold).toBeUndefined();
    expect(plainGate.gaugeThresholdScaler).toBeUndefined();
    expect(combatThresholdsFor(base, plainGate, 1, 5)).toEqual({
      gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
      winThreshold: [BREACH_THRESHOLD, CONTAINMENT_THRESHOLD],
    });
  });

  it("still reads a gatekeeper's own authored Containment when the player has socketed nothing", () => {
    expect(combatThresholdsFor(base, nullSession, 4, 20).winThreshold).toEqual([BREACH_THRESHOLD, 65]);
  });

  it('applies the player\'s own initiative and Breach values as absolute overrides', () => {
    const upgraded: RunPlayerState = { ...base, initiativeThreshold: 9, breachThreshold: 40 };
    const { gaugeThreshold, winThreshold } = combatThresholdsFor(upgraded, plainGate, 1, 5);
    expect(gaugeThreshold[0]).toBe(9);
    expect(winThreshold[0]).toBe(40);
    // Neither touches the enemy's own side of either pair.
    expect(gaugeThreshold[1]).toBe(GAUGE_THRESHOLD);
    expect(winThreshold[1]).toBe(CONTAINMENT_THRESHOLD);
  });

  it('scales Containment rather than overriding it, so a gatekeeper keeps its own identity', () => {
    // The reason this socket is a multiplier and the other two are not:
    // Containment is the *enemy's* number, and gatekeepers author it
    // individually. An absolute player-side override would flatten Null
    // Session's 65 to the same value every other enemy in the game gets.
    const defensive: RunPlayerState = { ...base, containmentThresholdScaler: 1.2 };
    expect(combatThresholdsFor(defensive, plainGate, 1, 5).winThreshold[1]).toBe(60); // 50 * 1.2
    expect(combatThresholdsFor(defensive, nullSession, 4, 20).winThreshold[1]).toBe(78); // 65 * 1.2, identity preserved
  });

  it('floors a scaled Containment at 1 -- gauges.ts never sees a zero bar', () => {
    const absurd: RunPlayerState = { ...base, containmentThresholdScaler: 0.001 };
    expect(combatThresholdsFor(absurd, plainGate, 1, 5).winThreshold[1]).toBe(1);
  });
});

const OVERWHELMING_PLAYER: RunPlayerState = {
  classId: 'exploit-overclock',
  // D11-A raised the bar: every enemy piece now fires every turn, so 30
  // burst no longer reliably out-races a gatekeeper. The fixture's job is
  // to win dependably, so the number moves rather than the assertion.
  installedLoadout: overwhelmingStarterLoadout(90),
  data: 0,
  bench: [],
  material: {},
  rank: {},
  ownedModIds: [],
  grantedByMod: {},
  maxHeatBonus: 0,
  modRunState: {},
  carriedBurnerIds: [],
};
const NEGLIGIBLE_PLAYER = playerWithBurst(0.1);
const SEEDS = [1, 2, 3];

// Phase 5 checkpoint D: layerIndex/fightNumber only matter for the
// skill-dial cosmetic and for the real random tier/layer pick, which
// these tests bypass entirely via enemyIdOverride below -- real content
// includes several kits that, by design, mirror the player-side Ghost
// class's "never wins outright alone" property (little or no
// win-gauge-crediting offense against a sufficiently weak/passive
// opponent -- Encryption-only mitigation kits, Root-only denial/recon
// kits), so "any randomly-picked enemy of this tier reliably wins/loses"
// is no longer a valid universal assumption to test against. Each
// override below was picked for having real, frequent win-gauge-
// crediting offense (occurrence:pair/thirtyOne/fifteen triggers are
// common in real Cribbage play) so these wiring tests stay deterministic
// regardless of which enemy real selection would have produced.
const TEST_LAYER = 4;
const TEST_FIGHT_NUMBER = 10;
// Session 51: every skeleton enemy carries a credit-alpha piece that
// fires every turn (D11), so each pick below credits its own gauge
// reliably; these are the skeleton ids with the most credit in the kit.
const RELIABLE_ENEMY_ID: Record<'regularFight' | 'eliteFight' | 'gatekeeperFight', EnemyId> = {
  regularFight: 'pentest-script', // Port Scan + Buffer Overflow: plain credit
  eliteFight: 'zero-day-broker', // credit alphas and a Charge, no Mod that blunts the player
  gatekeeperFight: 'root-authority', // layer 4's own gatekeeper, matching TEST_LAYER
};
// Both sides pinned to the dumb baseline explicitly -- an explicit
// override always wins outright over checkpoint C's computed skill-dial
// default (see encounters.ts's strategiesForFight), so this restores
// these pre-checkpoint-C tests' original "both sides equally dumb"
// premise. Skill-dial correctness is a separate concern, covered by
// ai.test.ts and enemies.ts's own eventual tests -- these tests only
// care about resolveEncounter's Heat/reward/quarantine wiring.
const BASELINE_STRATEGIES: [DiscardStrategy, DiscardStrategy] = [discardLowestTwo, discardLowestTwo];
const BASELINE_PLAY_STRATEGIES: [PlayStrategy, PlayStrategy] = [playLowestLegal, playLowestLegal];

function winOutcomes(nodeType: 'regularFight' | 'eliteFight' | 'gatekeeperFight') {
  const node = createNode('n', nodeType);
  return SEEDS.map((seed) =>
    resolveEncounter(
      node,
      createRng(seed),
      OVERWHELMING_PLAYER,
      undefined,
      undefined,
      undefined,
      BASELINE_STRATEGIES,
      BASELINE_PLAY_STRATEGIES,
      TEST_LAYER,
      TEST_FIGHT_NUMBER,
      RELIABLE_ENEMY_ID[nodeType],
    ),
  );
}

function lossOutcomes(nodeType: 'regularFight' | 'eliteFight' | 'gatekeeperFight') {
  const node = createNode('n', nodeType);
  return SEEDS.map((seed) =>
    resolveEncounter(
      node,
      createRng(seed),
      NEGLIGIBLE_PLAYER,
      undefined,
      undefined,
      undefined,
      BASELINE_STRATEGIES,
      BASELINE_PLAY_STRATEGIES,
      TEST_LAYER,
      TEST_FIGHT_NUMBER,
      RELIABLE_ENEMY_ID[nodeType],
    ),
  );
}

describe('resolveEncounter -- regularFight', () => {
  it('a win goes inert, never quarantines, costs its posted Heat window, grants a standard reward with Data and options', () => {
    // Session 52 (D1, R6): a won fight is no longer free -- it costs at
    // least the posted baseline and at most the posted worst-case win
    // (this kit makes no noise of its own).
    const risk = postedFightRisk('regular', TEST_LAYER - 1);
    for (const outcome of winOutcomes('regularFight')) {
      expect(outcome.newState).toBe('inert');
      expect(outcome.quarantined).toBe(false);
      expect(outcome.heatDelta).toBeGreaterThanOrEqual(risk.cleanWin - 1e-9);
      expect(outcome.heatDelta).toBeLessThanOrEqual(risk.worstWin + 1e-9);
      expect(outcome.rewardTier).toBe('standard');
      expect(outcome.dataAwarded).toBeGreaterThan(0);
      expect(outcome.rewardOptions).toHaveLength(REWARD_OPTIONS_COUNT);
    }
  });

  it("a loss costs at least LOSS_MULTIPLIER x the node's posted worst-case win (R7), more than any win could", () => {
    const risk = postedFightRisk('regular', TEST_LAYER - 1);
    for (const outcome of lossOutcomes('regularFight')) {
      expect(outcome.heatDelta).toBeGreaterThanOrEqual(risk.loss! - 1e-9);
      expect(outcome.heatDelta).toBeGreaterThan(risk.worstWin);
    }
  });

  it('a loss closes the node, costs Heat, grants no reward, Data, or options', () => {
    for (const outcome of lossOutcomes('regularFight')) {
      expect(outcome.newState).toBe('closed');
      expect(outcome.quarantined).toBe(false);
      expect(outcome.heatDelta).toBeGreaterThan(0);
      expect(outcome.rewardTier).toBe('none');
      expect(outcome.dataAwarded).toBe(0);
      expect(outcome.rewardOptions).toEqual([]);
    }
  });
});

describe('resolveEncounter -- eliteFight', () => {
  it('a win goes inert and grants a better reward with more Data than a regular win', () => {
    for (const outcome of winOutcomes('eliteFight')) {
      expect(outcome.newState).toBe('inert');
      expect(outcome.rewardTier).toBe('better');
      expect(outcome.dataAwarded).toBeGreaterThan(dataForTier('standard'));
      expect(outcome.rewardOptions).toHaveLength(REWARD_OPTIONS_COUNT);
    }
  });

  it('a loss closes the node, costs Heat, grants no reward, Data, or options', () => {
    for (const outcome of lossOutcomes('eliteFight')) {
      expect(outcome.newState).toBe('closed');
      expect(outcome.heatDelta).toBeGreaterThan(0);
      expect(outcome.rewardTier).toBe('none');
      expect(outcome.dataAwarded).toBe(0);
      expect(outcome.rewardOptions).toEqual([]);
    }
  });
});

describe('resolveEncounter -- gatekeeperFight', () => {
  it('quarantines on a loss with zero Heat cost, regardless of margin, and grants no reward or Data', () => {
    for (const outcome of lossOutcomes('gatekeeperFight')) {
      expect(outcome.quarantined).toBe(true);
      expect(outcome.heatDelta).toBe(0);
      expect(outcome.rewardTier).toBe('none');
      expect(outcome.dataAwarded).toBe(0);
      expect(outcome.rewardOptions).toEqual([]);
    }
  });

  it('grants a better reward tier and never quarantines on a win', () => {
    for (const outcome of winOutcomes('gatekeeperFight')) {
      expect(outcome.newState).toBe('inert');
      expect(outcome.quarantined).toBe(false);
      expect(outcome.rewardTier).toBe('better');
      expect(outcome.dataAwarded).toBeGreaterThan(0);
      expect(outcome.rewardOptions).toHaveLength(REWARD_OPTIONS_COUNT);
    }
  });
});

describe('resolveEncounter -- non-fight nodes', () => {
  it('Safehouse Rest reduces Heat and goes inert when there is no Merge material banked', () => {
    const outcome = resolveEncounter(createNode('n', 'safehouse'), createRng(1), OVERWHELMING_PLAYER);
    expect(outcome).toEqual({
      newState: 'inert',
      heatDelta: -12, // session 52: Rest scaled with the per-layer allowance (was 20 of 100)
      heatSources: { ...NO_HEAT_SOURCES, rest: -12 },
      quarantined: false,
      rewardTier: 'none',
      dataAwarded: 0,
      rewardOptions: [],
      mergeTargetId: null,
      shopPurchase: null,
      rerollCost: 0,
      modRewardOptions: [],
      modShopPurchase: null,
      modRerollCost: 0,
      burnersUsedThisCombat: [],
      shopBurnerUsed: null,
      burnerRewardOptions: [],
      burnerShopPurchase: null,
      burnerRerollCost: 0,
    });
  });

  it('Safehouse merges instead of resting when Merge material is banked -- costs 0 Heat', () => {
    const playerWithMaterial: RunPlayerState = { ...OVERWHELMING_PLAYER, material: { 'port-scan': 1 } };
    const outcome = resolveEncounter(createNode('n', 'safehouse'), createRng(1), playerWithMaterial);
    expect(outcome).toEqual({
      newState: 'inert',
      heatDelta: 0,
      heatSources: NO_HEAT_SOURCES,
      quarantined: false,
      rewardTier: 'none',
      dataAwarded: 0,
      rewardOptions: [],
      mergeTargetId: 'port-scan',
      shopPurchase: null,
      rerollCost: 0,
      modRewardOptions: [],
      modShopPurchase: null,
      modRerollCost: 0,
      burnersUsedThisCombat: [],
      shopBurnerUsed: null,
      burnerRewardOptions: [],
      burnerShopPurchase: null,
      burnerRerollCost: 0,
    });
  });

  it('resolves a real Event outcome deterministically per seed (checkpoint H, replacing the old always-inert stub)', () => {
    const outcome1 = resolveEncounter(createNode('n', 'event'), createRng(1), OVERWHELMING_PLAYER);
    expect(outcome1.newState).toBe('inert');
    expect(outcome1.quarantined).toBe(false);
    expect(outcome1.rewardTier).toBe('none');
    expect(outcome1.mergeTargetId).toBeNull();
    expect(outcome1.shopPurchase).toBeNull();
    expect(outcome1.modShopPurchase).toBeNull();
    expect(outcome1.burnerShopPurchase).toBeNull();
    expect(outcome1.eventGrant).toBeDefined();

    // Same seed -> same resolved outcome (deterministic, no hidden
    // nondeterminism in the event/choice/outcome/grant pick chain).
    const outcome1Again = resolveEncounter(createNode('n', 'event'), createRng(1), OVERWHELMING_PLAYER);
    expect(outcome1Again).toEqual(outcome1);

    // A real rng-driven resolution (not a static stub) varies across
    // seeds -- swept since any single pair could coincidentally match.
    const shapes = Array.from({ length: 10 }, (_, i) => {
      const o = resolveEncounter(createNode('n', 'event'), createRng(i + 1), OVERWHELMING_PLAYER);
      return JSON.stringify({ heatDelta: o.heatDelta, dataAwarded: o.dataAwarded, eventGrant: o.eventGrant });
    });
    expect(new Set(shapes).size).toBeGreaterThan(1);
  });

  it('Shop declines and goes inert when nothing is affordable', () => {
    const brokePlayer: RunPlayerState = { ...OVERWHELMING_PLAYER, data: 0 };
    const outcome = resolveEncounter(createNode('n', 'shop'), createRng(1), brokePlayer);
    expect(outcome).toEqual({
      newState: 'inert',
      heatDelta: 0,
      heatSources: NO_HEAT_SOURCES,
      quarantined: false,
      rewardTier: 'none',
      dataAwarded: 0,
      rewardOptions: [],
      mergeTargetId: null,
      shopPurchase: null,
      rerollCost: 0,
      // 0 Data affords nothing on either slate -- both decline.
      modRewardOptions: [],
      modShopPurchase: null,
      modRerollCost: 0,
      burnersUsedThisCombat: [],
      shopBurnerUsed: null,
      burnerRewardOptions: [],
      burnerShopPurchase: null,
      burnerRerollCost: 0,
    });
  });

  it('Shop buys the cheapest affordable offering and goes inert', () => {
    const richPlayer: RunPlayerState = { ...OVERWHELMING_PLAYER, data: 1000 };
    const outcome = resolveEncounter(createNode('n', 'shop'), createRng(1), richPlayer);
    expect(outcome.newState).toBe('inert');
    expect(outcome.shopPurchase).not.toBeNull();
    expect(outcome.shopPurchase!.cost).toBeLessThanOrEqual(1000);
  });

  it('rerolls once when the first slate has nothing affordable but the reroll itself is', () => {
    // Exactly REROLL_COST and nothing else -- can afford the reroll but
    // not even a common (20) either before or after it.
    const player: RunPlayerState = { ...OVERWHELMING_PLAYER, data: REROLL_COST };
    const outcome = resolveEncounter(createNode('n', 'shop'), createRng(1), player);
    expect(outcome.rerollCost).toBe(REROLL_COST);
    expect(outcome.shopPurchase).toBeNull();
  });

  it("the post-reroll purchase decision correctly declines when only the pre-reroll balance would have afforded something", () => {
    const alwaysReroll: ShopRerollStrategy = () => true;
    // 25 Data: enough to look "affordable" against a common's 20-cost
    // measured against the pre-reroll balance, but not against what's
    // actually left after paying REROLL_COST (25 - 10 = 15 < 20). If the
    // purchase decision were (incorrectly) given the pre-reroll balance,
    // this would buy a common it can no longer actually afford.
    const player: RunPlayerState = { ...OVERWHELMING_PLAYER, data: REROLL_COST + 15 };
    const outcome = resolveEncounter(createNode('n', 'shop'), createRng(1), player, preferMergeWhenAvailable, buyCheapestAffordable, alwaysReroll);
    expect(outcome.rerollCost).toBe(REROLL_COST);
    expect(outcome.shopPurchase).toBeNull();
  });

  it('the post-reroll purchase decision still succeeds when genuinely affordable after the reroll cost', () => {
    const alwaysReroll: ShopRerollStrategy = () => true;
    // REROLL_COST (10) + one common's cost (20) exactly.
    const player: RunPlayerState = { ...OVERWHELMING_PLAYER, data: REROLL_COST + 20 };
    const outcome = resolveEncounter(createNode('n', 'shop'), createRng(1), player, preferMergeWhenAvailable, buyCheapestAffordable, alwaysReroll);
    expect(outcome.rerollCost).toBe(REROLL_COST);
    expect(outcome.shopPurchase).not.toBeNull();
    expect(outcome.shopPurchase!.cost).toBeLessThanOrEqual(20);
  });

  it('throws for a Relay -- it has no encounter to resolve', () => {
    expect(() => resolveEncounter(createNode('n', 'relay'), createRng(1), OVERWHELMING_PLAYER)).toThrow();
  });
});

describe('heatSources (session 50) -- Heat attribution', () => {
  it('always sums to heatDelta, across real runs of every class', () => {
    // The whole type is worthless if the parts do not reconstruct the
    // whole, so this is asserted over real play rather than unit-built
    // outcomes -- it has to hold for every construction site including
    // the ones a hand-written test would not think to reach (Rest, Shop,
    // an Event carrying a bonus fight).
    let checked = 0;
    let sawNonZero = 0;
    for (const classId of ALL_CLASS_IDS) {
      // 30 rather than 15 since D11-A: runs end sooner, so a fixed seed
      // count yields fewer non-zero Heat encounters. Seeds go up rather
      // than the non-vacuity floor coming down -- lowering that floor
      // would weaken the guard instead of feeding it.
      for (let seed = 0; seed < 30; seed++) {
        const result = playRun({ seed, classId, playerSkill: 0.85 });
        for (const entry of result.log) {
          if (entry.type !== 'encounter') continue;
          expect(totalHeatSources(entry.outcome.heatSources)).toBe(entry.outcome.heatDelta);
          checked++;
          if (entry.outcome.heatDelta !== 0) sawNonZero++;
        }
      }
    }
    // Non-vacuity: a run of all-zero encounters would satisfy the sum
    // trivially and prove nothing.
    expect(checked).toBeGreaterThan(200);
    expect(sawNonZero).toBeGreaterThan(25);
  }, 30_000);

  it('splits a lost fight by whether the enemy actually filled Containment', () => {
    // Counts, not summed Heat. heatFromLoss is BASE * (1 - peakFill), so
    // a Containment loss the player nearly won charges ZERO Heat -- summing
    // amounts cannot tell "never happened" from "cost nothing".
    let containmentLosses = 0;
    let attritionLosses = 0;
    for (const classId of ['exploit-overclock', 'daemon-honeypot', 'overclock-honeypot'] as ClassId[]) {
      // Step 3: 40 seeds (was 25) -- the bespoke bridges made the classes
      // a little stronger, which thinned the loss count to the floor.
      for (let seed = 0; seed < 40; seed++) {
        // Session 51: floor player skill rather than 0.85. Against the
        // skeleton roster a skill-0.85 player lost 2 regular/elite fights
        // in 150 runs (all six classes), so the non-vacuity floor below
        // could not be fed by more seeds within budget; at floor skill the
        // same three classes lose ~20 in 75 runs. The split being asserted
        // is skill-independent, so the input moves rather than the floor.
        for (const entry of playRun({ seed, classId, traversalStrategy: opportunisticTraversal }).log) {
          if (entry.type !== 'encounter') continue;
          const { heatSources, fight } = entry.outcome;
          // At most one loss bucket can ever be charged per encounter.
          expect(heatSources.containmentLoss === 0 || heatSources.attritionLoss === 0).toBe(true);
          if (!fight || entry.outcome.newState !== 'closed') continue; // not a lost regular/elite fight
          if (fight.resolvedBy === 'threshold') containmentLosses++;
          else attritionLosses++;
          // Whichever bucket is charged must match how the fight resolved.
          const charged = fight.resolvedBy === 'threshold' ? heatSources.attritionLoss : heatSources.containmentLoss;
          expect(charged).toBe(0);
        }
      }
    }
    // Lost regular/elite fights are RARE in real runs -- most end at a
    // gatekeeper, and since step 3's layer-1 gatekeepers a floor player
    // rarely survives long enough to lose many. So the sample is topped
    // up with guaranteed losses: a near-empty player against every
    // regular and elite node, checked by the same rules.
    const node = (type: 'regularFight' | 'eliteFight') => createNode('n', type);
    for (const type of ['regularFight', 'eliteFight'] as const) {
      for (let seed = 0; seed < 10; seed++) {
        const outcome = resolveEncounter(node(type), createRng(seed), playerWithBurst(0.1), undefined, undefined, undefined, BASELINE_STRATEGIES, BASELINE_PLAY_STRATEGIES, TEST_LAYER, TEST_FIGHT_NUMBER);
        const { heatSources, fight } = outcome;
        expect(heatSources.containmentLoss === 0 || heatSources.attritionLoss === 0).toBe(true);
        if (!fight || outcome.newState !== 'closed') continue;
        if (fight.resolvedBy === 'threshold') containmentLosses++;
        else attritionLosses++;
        const charged = fight.resolvedBy === 'threshold' ? heatSources.attritionLoss : heatSources.containmentLoss;
        expect(charged).toBe(0);
      }
    }
    expect(containmentLosses + attritionLosses).toBeGreaterThan(5);
  }, 30_000);

  it('never charges Heat for a gatekeeper loss', () => {
    // Gatekeeper losses bypass Heat entirely and go to Quarantine
    // (heat.ts) -- so they must contribute nothing to any bucket.
    let seen = 0;
    for (const classId of ['exploit-overclock', 'daemon-honeypot'] as ClassId[]) {
      for (let seed = 0; seed < 40; seed++) {
        for (const entry of playRun({ seed, classId, playerSkill: 0.85 }).log) {
          if (entry.type !== 'encounter' || !entry.outcome.quarantined) continue;
          expect(entry.outcome.heatSources).toEqual(NO_HEAT_SOURCES);
          seen++;
        }
      }
    }
    expect(seen).toBeGreaterThan(0);
  }, 30_000);
});
