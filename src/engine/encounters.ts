import type { MapNode, NodeState } from './map-types';
import type { Rng } from './rng';
import type { SubroutineDefinition } from './subroutine-types';
import type { RunPlayerState } from './run';
import { playCombat } from './combat';
import { discardSkillStrategy, pegSkillStrategy } from './ai';
import { discardLowestTwo, type DiscardStrategy } from './deal';
import { playLowestLegal, type PlayStrategy } from './pegging';
import { heatFromLoss } from './heat';
import { drawRewardOptions, type RewardTier } from './rewards';
import { dataForTier } from './data';
import { pickMergeTarget, preferMergeWhenAvailable, type SafehouseStrategy } from './merge';
import { pickRegularOrEliteEnemy, gatekeeperEnemyForNode, enemySkill, ENEMY_ROSTER, type EnemyDefinition, type EnemyId } from './enemies';
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
 * wired in at Phase 4 checkpoint A; real enemy selection/skill-dial
 * wired in at Phase 5 checkpoint C): the point where Phase 3 calls Phase
 * 2's real playCombat() rather than an injected win/loss stub, against a
 * real named enemy (enemies.ts) instead of the old flat single-piece
 * dummy loadouts.
 */

const REST_HEAT_REDUCTION = 20; // TBD/playtesting

// Phase 5 checkpoint C replaced the old flat single-burst-per-tier
// dummy loadouts with real named-enemy selection (enemies.ts) -- see
// resolveFight below. GAUGE_THRESHOLD/WIN_THRESHOLD/FIGHT_MAX_HANDS
// were tuned against the old flat shape (Phase 4 checkpoint E); real
// per-enemy retuning against the actual roster is checkpoint E's job.
const GAUGE_THRESHOLD = 8;
// Same empirical sweep as above -- 50 gave fast (~10-25 hand),
// consistent convergence across the whole competitive magnitude range
// while still leaving enough resolution for the amount-differences
// between tiers to matter. TBD/playtesting, same as every numeric
// constant in this project, but now grounded in the new model's actual
// behavior rather than carried over from the old one.
const WIN_THRESHOLD = 50;

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

// The two-gauge redesign's race-to-threshold dynamics converge fast and
// consistently (empirically ~10-25 hands at the magnitudes above, even
// at the extremes of the swept range) -- a generous but no longer
// enormous margin over that. Escalation (checkpoint B) starts at hand
// 100 as a backstop for any matchup this placeholder tuning didn't
// anticipate (e.g. a heavily-grown late-run loadout), well under this.
const FIGHT_MAX_HANDS = 5_000;

/** Picks the real named enemy for this fight (enemies.ts, checkpoint C):
 * gatekeeper reads the identity map-gen already fixed onto the node;
 * regular/elite pick randomly from the eligible tier+layer pool
 * (or the opener-window override), every time. `enemyIdOverride` is a
 * test-only escape hatch (same treatment as run.ts's
 * installedLoadoutOverride/this file's discardStrategies) -- real
 * content varies enough in solo offense (some kits, by design, mirror
 * the player-side Ghost class's "never wins outright alone" property)
 * that a test needing a *specific*, reliably-offensive or reliably-weak
 * matchup can't depend on the random tier/layer pick landing on one. */
function enemyForFight(kind: FightKind, node: MapNode, layerIndex: number, fightNumber: number, rng: Rng, enemyIdOverride?: EnemyId): EnemyDefinition {
  if (enemyIdOverride) {
    const found = ENEMY_ROSTER.find((e) => e.id === enemyIdOverride);
    if (!found) throw new Error(`encounters.ts: no enemy with id "${enemyIdOverride}"`);
    return found;
  }
  return kind === 'gatekeeper' ? gatekeeperEnemyForNode(node) : pickRegularOrEliteEnemy(kind, layerIndex, fightNumber, rng);
}

/** Builds this fight's discard/play strategies from the enemy's
 * skill-dial level -- only when the caller didn't already supply an
 * explicit override. The session-24 test escape hatch stays
 * authoritative: an explicit override always wins outright, real
 * content only ever supplies a *default*. */
function strategiesForFight(
  kind: FightKind,
  layerIndex: number,
  fightNumber: number,
  discardStrategies?: [DiscardStrategy, DiscardStrategy],
  playStrategies?: [PlayStrategy, PlayStrategy],
): { discardStrategies?: [DiscardStrategy, DiscardStrategy]; playStrategies?: [PlayStrategy, PlayStrategy] } {
  if (discardStrategies || playStrategies) return { discardStrategies, playStrategies };
  // Only the enemy (side 1) gets a skill-derived strategy -- side 0
  // (the player) keeps playCombat's own baseline default exactly
  // (discardLowestTwo/playLowestLegal), same as before this checkpoint.
  const skill = enemySkill(kind, layerIndex, fightNumber);
  return {
    discardStrategies: [discardLowestTwo, discardSkillStrategy(skill)],
    playStrategies: [playLowestLegal, pegSkillStrategy(skill)],
  };
}

function resolveFight(
  kind: FightKind,
  node: MapNode,
  layerIndex: number,
  fightNumber: number,
  rng: Rng,
  playerState: RunPlayerState,
  discardStrategies?: [DiscardStrategy, DiscardStrategy],
  playStrategies?: [PlayStrategy, PlayStrategy],
  enemyIdOverride?: EnemyId,
): EncounterOutcome {
  const enemy = enemyForFight(kind, node, layerIndex, fightNumber, rng, enemyIdOverride);
  const strategies = strategiesForFight(kind, layerIndex, fightNumber, discardStrategies, playStrategies);
  const seed = rng.nextInt(2 ** 31);
  const result = playCombat([playerState.installedLoadout, enemy.loadout], {
    seed,
    gaugeThreshold: GAUGE_THRESHOLD,
    winThreshold: WIN_THRESHOLD,
    maxHands: FIGHT_MAX_HANDS,
    classId: playerState.classId,
    enemyPassiveIds: enemy.passiveIds,
    discardStrategies: strategies.discardStrategies,
    playStrategies: strategies.playStrategies,
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
    heatDelta: heatFromLoss(kind, result.peakFillFraction[0]) + result.playerHeatGenerated,
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
  /** Test-only escape hatch (session 24, tunable-skill AI checkpoint A) --
   * an explicit override always wins outright over the real skill-dial
   * default checkpoint C now computes from the enemy/layer (see
   * strategiesForFight above). */
  discardStrategies?: [DiscardStrategy, DiscardStrategy],
  playStrategies?: [PlayStrategy, PlayStrategy],
  /** Which layer this node lives in (checkpoint C) -- feeds both
   * eligibleEnemies' minLayer filter and the skill-dial formula.
   * Defaults to 1 for any pre-checkpoint-C caller (none currently
   * exist outside tests that don't care). */
  layerIndex: number = 1,
  /** How many real combats this run has already resolved (checkpoint A/
   * C's opener-window fight counter) -- 0 means this is the very first
   * fight of the run. */
  fightNumber: number = 0,
  /** Test-only escape hatch (checkpoint D) -- forces a specific named
   * enemy instead of the real tier/layer selection, for tests that need
   * a matchup guaranteed to be reliably offensive (or reliably weak),
   * not whichever real enemy the random pick happens to land on. */
  enemyIdOverride?: EnemyId,
): EncounterOutcome {
  switch (node.type) {
    case 'regularFight':
      return resolveFight('regular', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride);
    case 'eliteFight':
      return resolveFight('elite', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride);
    case 'gatekeeperFight':
      return resolveFight('gatekeeper', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride);
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
