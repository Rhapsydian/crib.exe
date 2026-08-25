import type { MapNode, NodeState } from './map-types';
import type { Rng } from './rng';
import type { SubroutineDefinition } from './subroutine-types';
import type { RunPlayerState } from './run';
import { playCombat } from './combat';
import { heatFromLoss } from './heat';
import { drawRewardOptions, type RewardTier } from './rewards';
import { dataForTier } from './data';
import { pickMergeTarget, preferMergeWhenAvailable, type SafehouseStrategy } from './merge';
import {
  shopOfferingsForClass,
  buyCheapestAffordable,
  rerollIfNothingAffordable,
  REROLL_COST,
  type ShopOffering,
  type ShopStrategy,
  type ShopRerollStrategy,
} from './shop';

/**
 * Node encounter resolution (session 19/20 checkpoint E, player loadout
 * wired in at Phase 4 checkpoint A): the point where Phase 3 calls Phase
 * 2's real playCombat() rather than an injected win/loss stub. The
 * enemy side is still a small representative loadout -- tuning real
 * per-node enemy difficulty is later content work (Phase 5), same
 * "infrastructure-complete, content-partial" scope Phase 2 itself
 * shipped enemies with.
 */

const REST_HEAT_REDUCTION = 20; // TBD/playtesting

// Small representative enemy loadouts (same alwaysBurst-style pattern as
// combat.test.ts) -- symmetric for a regular fight, so the outcome
// genuinely rides on the Cribbage play; the elite enemy loadout is
// deliberately heavier, for a fight that's actually harder to win.
function burstSubroutine(id: string, amount: number): SubroutineDefinition {
  return {
    id,
    name: id,
    archetype: 'exploit',
    trigger: { kind: 'always' },
    payload: { kind: 'directBurst', amount },
    tags: [],
  };
}

// Retuned at Phase 4 checkpoint A: these were originally balanced
// against a symmetric single-piece dummy player loadout, amount-for-
// amount. Now that a real class's starting kit (3 pieces, including
// capped-at-midpoint defensive pieces alongside sparser uncapped
// damage) drives fights instead, that old 5-vs-5 matchup left the
// player on a near-guaranteed loss, and Breach/Containment's sharp
// positive-feedback dynamics (a small per-fire edge compounds hard --
// see session 20's own finding) meant there was no wide "sometimes
// wins, sometimes loses, resolves quickly" zone to find by further
// tuning alone -- empirically it's a narrow band between "wins almost
// always" and "loses almost always, and takes drastically longer to
// resolve either way." Gatekeeper now gets its own tier, harder than
// Elite: reusing Regular (the pre-Phase-4 behavior) left it winnable
// too reliably to ever exercise quarantine at all once a real loadout
// replaced the old dummy. Real balance (including making Regular
// genuinely competitive, not just winnable) is Phase 5's job -- re-run
// session 20's playRun() sweep once Phase 4's acquisition system lets
// the loadout actually grow across a run.
const ENEMY_LOADOUT_REGULAR: SubroutineDefinition[] = [burstSubroutine('enemy-burst', 2.5)];
const ENEMY_LOADOUT_ELITE: SubroutineDefinition[] = [burstSubroutine('enemy-elite-burst', 2.55)];
const ENEMY_LOADOUT_GATEKEEPER: SubroutineDefinition[] = [burstSubroutine('enemy-gatekeeper-burst', 2.8)];
const GAUGE_THRESHOLD = 8;

export interface EncounterOutcome {
  newState: NodeState;
  heatDelta: number;
  quarantined: boolean;
  rewardTier: RewardTier;
  /** Data awarded, tiered via rewardTier (data.ts) -- 0 for any non-win
   * outcome. */
  dataAwarded: number;
  /** The subroutine-choice reward actually offered (rewards.ts),
   * rarity-weighted by rewardTier -- empty for any non-win outcome.
   * Not yet installed/benched anywhere; Checkpoint D is what a script
   * does with an offer like this. */
  rewardOptions: SubroutineDefinition[];
  /** The subroutine id a Safehouse Merge action spent material on, or
   * null for a Rest visit (or any non-Safehouse node) -- checkpoint E.
   * The actual mutation (merge.ts's mergeSubroutine) happens in
   * playRun(), which owns RunPlayerState; this just records which id it
   * should apply to. */
  mergeTargetId: string | null;
  /** What a Shop visit bought, or null for a decline (or any non-Shop
   * node) -- checkpoint F. Same split as mergeTargetId: this just
   * records the pick; playRun() applies the actual Data spend and
   * acquisition, since it's the one place holding RunPlayerState. */
  shopPurchase: ShopOffering | null;
  /** REROLL_COST if a Shop visit spent Data to reroll its slate once,
   * else 0 -- checkpoint F follow-up. Same split as the other
   * playerState-affecting fields: this just records the cost incurred;
   * playRun() applies it. */
  rerollCost: number;
}

type FightKind = 'regular' | 'elite' | 'gatekeeper';

// A real class kit still converges slower than combat.ts's own
// conservative default (500, tuned for small test loadouts) -- typical
// fights at the retuned magnitudes above land in the low thousands of
// hands, with rare outliers into the tens of thousands (Gatekeeper's
// tighter margin especially). Generous headroom over that.
const FIGHT_MAX_HANDS = 80_000;

const ENEMY_LOADOUTS: Record<FightKind, SubroutineDefinition[]> = {
  regular: ENEMY_LOADOUT_REGULAR,
  elite: ENEMY_LOADOUT_ELITE,
  gatekeeper: ENEMY_LOADOUT_GATEKEEPER,
};

function resolveFight(kind: FightKind, rng: Rng, playerState: RunPlayerState): EncounterOutcome {
  const enemyLoadout = ENEMY_LOADOUTS[kind];
  const seed = rng.nextInt(2 ** 31);
  const result = playCombat([playerState.installedLoadout, enemyLoadout], {
    seed,
    gaugeThreshold: GAUGE_THRESHOLD,
    maxHands: FIGHT_MAX_HANDS,
    classId: playerState.classId,
  });

  if (result.winner === 0) {
    const rewardTier: RewardTier = kind === 'regular' ? 'standard' : 'better';
    return {
      newState: 'inert',
      heatDelta: result.playerHeatGenerated,
      quarantined: false,
      rewardTier,
      dataAwarded: dataForTier(rewardTier),
      rewardOptions: drawRewardOptions(playerState.classId, rewardTier, rng),
      mergeTargetId: null,
      shopPurchase: null,
      rerollCost: 0,
    };
  }
  if (kind === 'gatekeeper') {
    // Quarantine ends the run outright -- no Heat cost, and the node's
    // state doesn't matter (there's no run left to route around it in).
    return {
      newState: 'unresolved',
      heatDelta: 0,
      quarantined: true,
      rewardTier: 'none',
      dataAwarded: 0,
      rewardOptions: [],
      mergeTargetId: null,
      shopPurchase: null,
      rerollCost: 0,
    };
  }
  return {
    newState: 'closed',
    heatDelta: heatFromLoss(kind, result.peakBreachContainment) + result.playerHeatGenerated,
    quarantined: false,
    rewardTier: 'none',
    dataAwarded: 0,
    rewardOptions: [],
    mergeTargetId: null,
    shopPurchase: null,
    rerollCost: 0,
  };
}

export function resolveEncounter(
  node: MapNode,
  rng: Rng,
  playerState: RunPlayerState,
  safehouseStrategy: SafehouseStrategy = preferMergeWhenAvailable,
  shopStrategy: ShopStrategy = buyCheapestAffordable,
  shopRerollStrategy: ShopRerollStrategy = rerollIfNothingAffordable,
): EncounterOutcome {
  switch (node.type) {
    case 'regularFight':
      return resolveFight('regular', rng, playerState);
    case 'eliteFight':
      return resolveFight('elite', rng, playerState);
    case 'gatekeeperFight':
      return resolveFight('gatekeeper', rng, playerState);
    case 'safehouse': {
      // DESIGN.md's deliberate Rest-vs-Merge trade-off: one action per
      // visit (the node goes inert either way). Falls back to Rest if
      // the strategy chose 'merge' but nothing is actually banked to
      // spend -- 'merge' with no material would otherwise waste the
      // visit entirely.
      const targetId = safehouseStrategy(playerState) === 'merge' ? pickMergeTarget(playerState) : null;
      if (targetId) {
        return {
          newState: 'inert',
          heatDelta: 0,
          quarantined: false,
          rewardTier: 'none',
          dataAwarded: 0,
          rewardOptions: [],
          mergeTargetId: targetId,
          shopPurchase: null,
          rerollCost: 0,
        };
      }
      return {
        newState: 'inert',
        heatDelta: -REST_HEAT_REDUCTION,
        quarantined: false,
        rewardTier: 'none',
        dataAwarded: 0,
        rewardOptions: [],
        mergeTargetId: null,
        shopPurchase: null,
        rerollCost: 0,
      };
    }
    case 'shop': {
      const firstSlate = shopOfferingsForClass(playerState.classId, rng);
      // "Once": the reroll strategy is only ever asked against the
      // first slate, never against a slate it already produced.
      const rerolled = playerState.data >= REROLL_COST && shopRerollStrategy(firstSlate, playerState);
      const offerings = rerolled ? shopOfferingsForClass(playerState.classId, rng) : firstSlate;
      const rerollCost = rerolled ? REROLL_COST : 0;
      // The purchase decision needs to see the post-reroll Data balance
      // -- otherwise a strategy could "spend" the reroll cost and then
      // still buy up to the full pre-reroll balance, overspending.
      const stateAfterReroll = rerollCost > 0 ? { ...playerState, data: playerState.data - rerollCost } : playerState;
      const shopPurchase = shopStrategy(offerings, stateAfterReroll);
      return {
        newState: 'inert',
        heatDelta: 0,
        quarantined: false,
        rewardTier: 'none',
        dataAwarded: 0,
        rewardOptions: [],
        mergeTargetId: null,
        shopPurchase,
        rerollCost,
      };
    }
    case 'event':
      return {
        newState: 'inert',
        heatDelta: 0,
        quarantined: false,
        rewardTier: 'none',
        dataAwarded: 0,
        rewardOptions: [],
        mergeTargetId: null,
        shopPurchase: null,
        rerollCost: 0,
      };
    case 'relay':
      throw new Error('resolveEncounter should never be called on a Relay node -- it has no encounter');
  }
}
