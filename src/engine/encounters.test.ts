import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createNode } from './map-types';
import { resolveEncounter } from './encounters';
import type { EnemyId } from './enemies';
import { discardLowestTwo, type DiscardStrategy } from './deal';
import { playLowestLegal, type PlayStrategy } from './pegging';
import type { RunPlayerState } from './run';
import type { SubroutineDefinition } from './subroutine-types';
import { BREACHER_LOADOUT } from './subroutines';
import { REWARD_OPTIONS_COUNT } from './rewards';
import { dataForTier } from './data';
import { REROLL_COST, buyCheapestAffordable, type ShopRerollStrategy } from './shop';
import { preferMergeWhenAvailable } from './merge';

/**
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
function overwhelmingBreacherLoadout(burstAmount: number): SubroutineDefinition[] {
  return BREACHER_LOADOUT.map((piece) =>
    piece.id === 'buffer-overflow' ? { ...piece, payload: { ...piece.payload, amount: burstAmount } } : piece,
  );
}

// classId: 'ghost' here, deliberately NOT 'breacher' -- Phase 4
// checkpoint B wired starting passives in, and Foothold (Breacher's)
// hooks into every Breach/Containment crossing regardless of payload
// kind, which could inject an unwanted bonus push into this single-
// piece dummy's own trajectory. Ghost's Return to Sender only touches
// instantCounterPush payloads, which this dummy never fires -- inert,
// same as every other class's passive would be against a lone
// directBurst piece.
function playerWithBurst(amount: number): RunPlayerState {
  return {
    classId: 'ghost',
    installedLoadout: [
      {
        id: 'test-player-burst',
        name: 'test-player-burst',
        archetype: 'exploit',
        trigger: { kind: 'always' },
        payload: { kind: 'directBurst', amount },
        tags: [],
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
  };
}

const OVERWHELMING_PLAYER: RunPlayerState = {
  classId: 'breacher',
  installedLoadout: overwhelmingBreacherLoadout(30),
  data: 0,
  bench: [],
  material: {},
  rank: {},
  ownedModIds: [],
  grantedByMod: {},
  maxHeatBonus: 0,
  modRunState: {},
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
const RELIABLE_ENEMY_ID: Record<'regularFight' | 'eliteFight' | 'gatekeeperFight', EnemyId> = {
  regularFight: 'drive-by-kit', // off-by-one (thirtyOne) + ransomware (accumulator DoT)
  eliteFight: 'zero-day-broker', // zero-day-chain fires on any Pair
  // total-compromise's rare fires reactively whenever the *player's*
  // fill is low -- true almost the whole match against NEGLIGIBLE_PLAYER,
  // false almost immediately against OVERWHELMING_PLAYER's rush, which
  // is exactly the behavior both win/loss scenarios below need.
  gatekeeperFight: 'total-compromise',
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
  it('a win goes inert, never quarantines, costs 0 Heat, grants a standard reward with Data and options', () => {
    for (const outcome of winOutcomes('regularFight')) {
      expect(outcome.newState).toBe('inert');
      expect(outcome.quarantined).toBe(false);
      expect(outcome.heatDelta).toBe(0);
      expect(outcome.rewardTier).toBe('standard');
      expect(outcome.dataAwarded).toBeGreaterThan(0);
      expect(outcome.rewardOptions).toHaveLength(REWARD_OPTIONS_COUNT);
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
      heatDelta: -20,
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
    });
  });

  it('Safehouse merges instead of resting when Merge material is banked -- costs 0 Heat', () => {
    const playerWithMaterial: RunPlayerState = { ...OVERWHELMING_PLAYER, material: { 'buffer-overflow': 1 } };
    const outcome = resolveEncounter(createNode('n', 'safehouse'), createRng(1), playerWithMaterial);
    expect(outcome).toEqual({
      newState: 'inert',
      heatDelta: 0,
      quarantined: false,
      rewardTier: 'none',
      dataAwarded: 0,
      rewardOptions: [],
      mergeTargetId: 'buffer-overflow',
      shopPurchase: null,
      rerollCost: 0,
      modRewardOptions: [],
      modShopPurchase: null,
      modRerollCost: 0,
    });
  });

  it('Event is a no-op stub that goes inert', () => {
    const outcome = resolveEncounter(createNode('n', 'event'), createRng(1), OVERWHELMING_PLAYER);
    expect(outcome).toEqual({
      newState: 'inert',
      heatDelta: 0,
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
    });
  });

  it('Shop declines and goes inert when nothing is affordable', () => {
    const brokePlayer: RunPlayerState = { ...OVERWHELMING_PLAYER, data: 0 };
    const outcome = resolveEncounter(createNode('n', 'shop'), createRng(1), brokePlayer);
    expect(outcome).toEqual({
      newState: 'inert',
      heatDelta: 0,
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
