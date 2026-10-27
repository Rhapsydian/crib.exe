import type { MapNode, NodeState } from './map-types';
import { tallyStars } from './skill';
import type { Rng } from './rng';
import { scaledProcess, type SubroutineDefinition } from './subroutine-types';
import type { RunPlayerState } from './run';
import type { SecurityRules } from './meta';
import { GATEKEEPER_MODS, type GatekeeperModId } from './gatekeeper-mods';
import { createRng } from './rng';
import { combatGenerator, neverActivateBurner, type BurnerActivationStrategy, type CombatAnswer, type CombatOptions, type CombatResult } from './combat';
import { ask, driveWithFallbacks, type RunRequest, type ShopAction, type ShopSlate, type ShopVisit } from './run-requests';
import { discardSkillStrategy, pegSkillStrategy } from './ai';
import { discardLowestTwo, type DiscardStrategy } from './deal';
import { playLowestLegal, type PlayStrategy } from './pegging';
import { SYSTEM_STRAIN_LOSSES, currentHeatCeiling, eventHeat, fightBaselineHeat, fightPerformanceHeat, flawlessHeatWaiver, heatFromLoss } from './heat';
import { drawCacheRewardOptions, drawRewardOptions, drawUpgradedRewardOptions, rewardPoolForClass, rarityOf, type RewardTier } from './rewards';
import { dataForTier } from './data';
import { MERGE_RANK_CAP, pickMergeTarget, preferMergeWhenAvailable, type MergeTargetStrategy, type SafehouseStrategy } from './merge';
import {
  pickRegularOrEliteEnemy,
  gatekeeperEnemyForNode,
  enemySkill,
  magnitudeScalerFor,
  gaugeThresholdFor,
  winThresholdFor,
  scaledEnemyLoadout,
  enemyById,
  type EnemyDefinition,

  type EnemyId,
  winGaugeScaleFor,
} from './enemies';
import {
  shopOfferingsForClass,
  modOfferingsForClass,
  burnerOfferingsForClass,
  buyCheapestAffordable,
  buyCheapestAffordableMod,
  buyCheapestAffordableBurner,
  rerollIfNothingAffordable,
  rerollModIfNothingAffordable,
  rerollBurnerIfNothingAffordable,
  neverActivateShopBurner,
  REROLL_COST,
  type ShopOffering,
  type ShopStrategy,
  type ShopRerollStrategy,
  type ModOffering,
  type ModShopStrategy,
  type ModShopRerollStrategy,
  type BurnerOffering,
  type BurnerShopStrategy,
  type BurnerShopRerollStrategy,
  type ShopBurnerStrategy,
  subroutineSellPrice,
  burnerSellPrice,
} from './shop';
import type { ModDefinition, ModId } from './mod-types';
import { drawModRewardOptions, applyOnWinEncounterResolvedMods, shopModifiersForOwnedMods, modPoolForClass, BLACK_MARKET_VISIT_HEAT } from './mods';
import type { BurnerId, BurnerDefinition } from './burner-types';
import { burnerCapOf, BURNER_DEFINITIONS, shopModifiersForActivatedBurner, drawBurnerRewardOptions, generalBurnerPool, isSellOnly } from './burners';
import type { ClassId } from './classes';
import type { EventDefinition, EventChoice, EventGrant, EventRiskTier, Grant } from './event-types';
import { EVENT_ROSTER, choiceUnavailable, eventStillOffers } from './events';

/**
 * Node encounter resolution (session 19/20 checkpoint E, player loadout
 * wired in at Phase 4 checkpoint A; real enemy selection/skill-dial
 * wired in at Phase 5 checkpoint C): the point where Phase 3 calls Phase
 * 2's real playCombat() rather than an injected win/loss stub, against a
 * real named enemy (enemies.ts) instead of the old flat single-piece
 * dummy loadouts.
 */

// Was 20 against the old run-long cap of 100; a layer's allowance is now
// ~30-40 (heat.ts), so Rest keeps roughly the same share of the budget.
export const REST_HEAT_REDUCTION = 12; // TBD/playtesting
/** A Safehouse rest's Heat, with the rest upgrade (session 71, MP7). */
export function restHeatFor(playerState: Pick<RunPlayerState, 'meta' | 'security'>): number {
  return (REST_HEAT_REDUCTION + (playerState.meta?.restHeat ?? 0)) * (playerState.security?.rest ?? 1);
}

// Phase 5 checkpoint C replaced the old flat single-burst-per-tier
// dummy loadouts with real named-enemy selection (enemies.ts) -- see
// resolveFight below. GAUGE_THRESHOLD/WIN_THRESHOLD were tuned against
// the old flat shape (Phase 4 checkpoint E), and real per-enemy
// retuning against the actual roster was left for this phase's own
// checkpoint E -- which, per session 39's audit, never actually
// re-validated these two thresholds themselves (it focused on enemy
// magnitudes and structural bugs). (The third member of this old trio,
// FIGHT_MAX_HANDS, was removed in session 39 -- see combat.ts's
// HARD_RESOLUTION_HAND.)
// Exported (session 39) so diagnostic scripts can reuse the single real
// source of truth instead of copying these two numbers by hand.
//
// Session 48 finally re-validated it, and raised it 8 -> 12.
//
// What 8 actually bought, measured rather than assumed: real per-side
// Cribbage scoring is ~13.4 pts/hand for a skill-0.85 player and ~12.4
// for the enemy roster (scripts/occurrence-frequency.ts -- dealer hand
// 7.94 + crib 4.62 + pegging 2.99, non-dealer 7.74 + 2.99). With
// overshoot carrying, a threshold of 8 is ~1.6 turns per side per hand,
// and 3.2-4.6 subroutine *fires* per hand for the player. 12 takes that
// to ~1.12 turns/hand (player) and ~1.03 (enemy) -- just over one.
//
// The tempo *ratio* between the two sides is scale-invariant (both carry
// overshoot), so outscoring the enemy still buys ~8% more turns at 12
// exactly as it did at 8 -- good Cribbage play keeps its full edge. Only
// the absolute count shrinks, ~1.9 -> ~1.4 extra turns over a 15-hand
// fight.
//
// Why raise it at all, then: 8 left threshold-manipulation content
// nowhere to live. Against a reduction floor at 4, every reducing piece
// in the game collapsed to "go to the floor" -- there was no granularity
// to grade content across. 12 against the same floor gives that space a
// real 3x range, and lets meta-progression sell a lower personal
// threshold as a meaningful purchase. See session 48's decision record.
//
// This IS a global player nerf and is meant to be: four of six classes
// measured above the 10-20% target band before it. Rebalancing on the
// post-change numbers is explicitly follow-on work.
export const GAUGE_THRESHOLD = 12;
// Same empirical sweep as above -- 50 gave fast (~10-25 hand),
// consistent convergence across the whole competitive magnitude range
// while still leaving enough resolution for the amount-differences
// between tiers to matter. TBD/playtesting, same as every numeric
// constant in this project, but now grounded in the new model's actual
// behavior rather than carried over from the old one.
//
// Session 48 split the single WIN_THRESHOLD into the two races it was
// always seeding. Each side runs its own DuelGauge toward its own win
// (gauges.ts): side 0's is Breach progress -- the player exploiting the
// vulnerability -- and side 1's is Containment -- the enemy patching it
// in time. One constant fed both, which was fine while they could never
// differ and wrong the moment meta-progression can move them
// independently. Both still 50, so this is behaviour-neutral today.
//
// Lowering BREACH means the player needs less progress to win; raising
// CONTAINMENT means the enemy needs more. Both are player buffs, pulling
// in different directions -- an offensive and a defensive upgrade track.
export const BREACH_THRESHOLD = 50;
export const CONTAINMENT_THRESHOLD = 50;

/**
 * Resolves all four per-side combat thresholds for one fight (session
 * 48) -- the single place the flat constants, a gatekeeper's own
 * authored values, and the player's meta-progression sockets meet.
 * Extracted from resolveFight's playCombat call so the socket is
 * testable without driving a whole stochastic fight to observe it.
 *
 * Player side reads its own meta-progression value when set, falling
 * back to the flat constant. Enemy side resolves per-identity
 * (gatekeeper-only overrides, falling back to the flat constant) and is
 * then scaled by the player's Containment upgrade if any -- a
 * multiplier, so "every enemy needs 20% more Containment to beat me"
 * composes with Null Session's authored 65 instead of flattening every
 * enemy in the game to one number. See RunPlayerState's own note.
 */
/** The subroutines the player owns, installed or benched (S13: reward
 * draws favour them, so Merge copies turn up). */
function ownedSubroutineIds(playerState: RunPlayerState): string[] {
  return [...playerState.installedLoadout, ...playerState.bench].map((p) => p.id);
}

/** A Security Level's extra enemy Mods (MP14): elite-tier rules for
 * regulars and elites, any tier for gatekeepers, never one the enemy has.
 * Chosen by the enemy's id and the level, so the same fight always draws
 * the same Mods. */
export function securityMods(enemy: EnemyDefinition, kind: FightKind, layerIndex: number, security: SecurityRules | undefined, dailyEliteMods = 0): GatekeeperModId[] {
  const x = security?.extraMods ?? { regular: 0, elite: 0, gatekeeper: 0, finalGatekeeper: 0 };
  // Hardened Elites (a daily Advisory) adds to an elite's.
  const count = kind === 'regular' ? x.regular : kind === 'elite' ? Math.max(x.elite, dailyEliteMods) : (layerIndex >= 3 ? x.gatekeeper : 0) + (layerIndex === 4 ? x.finalGatekeeper : 0);
  if (!count) return [];
  const pool = (Object.keys(GATEKEEPER_MODS) as GatekeeperModId[]).filter((id) => (kind === 'gatekeeper' || GATEKEEPER_MODS[id].tier === 'elite') && !(enemy.mods ?? []).includes(id));
  const rng = createRng([...enemy.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) + (security?.level ?? 0));
  const picked: GatekeeperModId[] = [];
  while (picked.length < count && picked.length < pool.length) {
    const id = pool[rng.nextInt(pool.length)];
    if (!picked.includes(id)) picked.push(id);
  }
  return picked;
}

/** Restore Point's retry plays a different deal from the lost fight. */
const RESTORE_POINT_SEED_STEP = 7919;

export function combatThresholdsFor(
  playerState: RunPlayerState,
  enemy: EnemyDefinition,
  layerIndex: number,
  fightNumber: number,
): { gaugeThreshold: [number, number]; winThreshold: [number, number] } {
  const containment = winThresholdFor(enemy, layerIndex, fightNumber, CONTAINMENT_THRESHOLD);
  // An elite's layer sets both gauges' size (session 67, E5: fights last).
  const gauges = winGaugeScaleFor(enemy, layerIndex);
  return {
    gaugeThreshold: [
      playerState.initiativeThreshold ?? GAUGE_THRESHOLD,
      gaugeThresholdFor(enemy, layerIndex, fightNumber, GAUGE_THRESHOLD),
    ],
    winThreshold: [
      Math.round((playerState.breachThreshold ?? BREACH_THRESHOLD) * gauges),
      Math.max(1, Math.round(containment * gauges * (playerState.containmentThresholdScaler ?? 1))),
    ],
  };
}

/**
 * Where an encounter's `heatDelta` came from (session 50).
 *
 * Heat had three inflows and no attribution: a lost regular/elite fight,
 * Trace carried out of combat (removed in session 58), and the per-move
 * cost. Only the last was
 * separable, because `move` log entries carry their own `heatCost` --
 * the other two were fused into a single `heatDelta` and could not be
 * told apart after the fact.
 *
 * **Every field sums to `heatDelta`**, and `encounters.test.ts` asserts
 * exactly that over real runs. Negative fields are outflows.
 *
 * The loss split is the point of this type rather than an extra: a fight
 * lost because the enemy filled its own Containment gauge and a fight
 * lost to the `HARD_RESOLUTION_HAND` deadline are different events that
 * currently cost identical Heat (`heatFromLoss` reads neither). Tuning
 * "Heat from Containment" needs them separated first; `CombatResult`
 * already knows via `resolvedBy`, but that never used to escape
 * `combat.ts`.
 */
export interface HeatSources {
  /** A regular/elite fight the enemy won by genuinely filling its own
   * Containment gauge (`resolvedBy: 'threshold'`). */
  containmentLoss: number;
  /** A regular/elite fight lost at the deadline instead -- the enemy
   * denied a breach without ever filling Containment
   * (`resolvedBy: 'attrition'`). Same Heat cost today; separated here so
   * that is a choice rather than an accident. */
  attritionLoss: number;
  /** The node's posted baseline on a win (D1, D2). A loss's charge
   * already includes it (R7), so a loss books it there instead. */
  baseline: number;
  /** Heat the enemy's alarms (`heatPressure`, Spotlight) raised during the
   * fight, win or lose. */
  alarm: number;
  /** R6's performance term on a win: Heat from how close the enemy came,
   * read off its final Containment fill. For a gatekeeper this is most of
   * R8's toll. */
  performance: number;
  /** Negative. `heat-sink`'s refund on an elite/gatekeeper win. */
  refund: number;
  /** Negative. Rest at a Safehouse. */
  rest: number;
  /** Negative. A map Burner's cut (session 64): Proxy Chain on the next
   * fight, Spoofed Credentials / Golden Ticket on the next gatekeeper's toll. */
  burner: number;
  /** A double-edged Mod's Heat (session 65): Ghost Credentials' extra on
   * each fight, Black Market Ties' on each Shop visit. */
  mod: number;
  /** Negative. The fight Heat upgrade's cut (session 71, MP7). */
  upgrade: number;
  /** A Security Level's extra Heat (session 71, MP14). */
  security: number;
  /** Heat an Event applied directly. An Event's bonus fight is NOT
   * counted here -- its Heat is folded into the real categories above,
   * so "Heat from Containment losses" stays true wherever the fight
   * happened. */
  event: number;
}

export const NO_HEAT_SOURCES: HeatSources = {
  containmentLoss: 0,
  attritionLoss: 0,
  baseline: 0,
  alarm: 0,
  performance: 0,
  refund: 0,
  rest: 0,
  burner: 0,
  mod: 0,
  upgrade: 0,
  security: 0,
  event: 0,
};

export function addHeatSources(a: HeatSources, b: HeatSources): HeatSources {
  return {
    containmentLoss: a.containmentLoss + b.containmentLoss,
    attritionLoss: a.attritionLoss + b.attritionLoss,
    baseline: a.baseline + b.baseline,
    alarm: a.alarm + b.alarm,
    performance: a.performance + b.performance,
    refund: a.refund + b.refund,
    rest: a.rest + b.rest,
    burner: a.burner + b.burner,
    mod: a.mod + b.mod,
    upgrade: a.upgrade + b.upgrade,
    security: a.security + b.security,
    event: a.event + b.event,
  };
}

export function totalHeatSources(s: HeatSources): number {
  return s.containmentLoss + s.attritionLoss + s.baseline + s.alarm + s.performance + s.refund + s.rest + s.burner + s.mod + s.upgrade + s.security + s.event;
}

export interface EncounterOutcome {
  newState: NodeState;
  heatDelta: number;
  /** Attribution for `heatDelta` -- see HeatSources. Required, not
   * optional, so a new construction site cannot silently report zero. */
  heatSources: HeatSources;
  /**
   * How a real fight at this node resolved (session 50). Absent for any
   * non-fight node -- absence means "no fight happened", which is why
   * this is optional where `heatSources` is not.
   *
   * Exists because `heatSources` alone cannot answer the questions it
   * was built for. `heatFromLoss` is `BASE * (1 - peakFillFraction)`, so
   * a Containment loss the player nearly won charges *zero* Heat and is
   * indistinguishable, by Heat alone, from a loss that never happened.
   * Counting loss *kinds* needs `resolvedBy`; costing the near-miss
   * scaler counterfactually needs `peakFillFraction`. Both were computed
   * inside `resolveFight` and thrown away.
   */
  fight?: {
    /** Which enemy was actually fought -- the run log otherwise records
     * that a fight happened but not against whom, so any per-enemy
     * balance question needed a bespoke script. Same rationale as
     * summarizeRunLoadout (session 46). */
     enemyId: EnemyId;
    tier: 'regular' | 'elite' | 'gatekeeper';
    resolvedBy: 'threshold' | 'attrition';
    /** Both sides' peak win-gauge fill, 0-1. Index 0 is the player's
     * Breach, index 1 the enemy's Containment. The enemy's peak is how
     * *close* the fight actually was: a 99% win rate where side 1 never
     * clears 0.1 is not a fight at all, and win rate alone cannot say
     * so. */
    peakFillFraction: [number, number];
    /** Both sides' FINAL win-gauge fill, 0-1 (session 63: a trace
     * evasion's head start reads the enemy's). */
    finalFillFraction: [number, number];
    /** Hands actually played, for the same reason. */
    hands: number;
    /** A Flawless Cribbage rating (session 72): the Heat this fight
     * waived (heat.ts FLAWLESS_HEAT). */
    flawlessWaived?: number;
  };
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
  shopPurchases: ShopOffering[];
  /** What a Shop visit sold (session 61): benched subroutine ids and
   * carried Burner ids, applied by playRun before the purchases (whose
   * Data the sales may have paid for). */
  shopSales?: { subroutine: string[]; copy: string[]; burner: BurnerId[] };
  /** The subroutine and Mod rewards are one choice, not two (elite wins,
   * session 62). */
  eliteChoice?: boolean;
  /** REROLL_COST if a Shop visit spent Data to reroll its slate once,
   * else 0 -- checkpoint F follow-up. Same split as the other
   * playerState-affecting fields: this just records the cost incurred;
   * playRun() applies it. */
  rerollCost: number;
  /** The additive Mod-choice reward actually offered on an elite/
   * gatekeeper win (Phase 5 Mods checkpoint G) -- empty for a regular
   * win, a loss, or any non-fight outcome. Never competes with
   * rewardOptions; playRun() applies whichever (if either) gets picked. */
  modRewardOptions: ModDefinition[];
  /** What a Shop visit bought from the Mod slate, or null -- mirrors
   * shopPurchase for the parallel, independently-generated/rerolled Mod
   * slate (session 30). */
  modShopPurchases: ModOffering[];
  /** REROLL_COST if a Shop visit spent Data to reroll the Mod slate
   * once, else 0 -- mirrors rerollCost for the Mod slate's own
   * independent reroll decision. */
  modRerollCost: number;
  /** Which carried Burner(s) side 0 actually activated during this
   * encounter's combat, if any -- Phase 5 Burners checkpoint B, mirrors
   * CombatResult.burnersUsedThisCombat straight through. Always empty
   * for a non-fight outcome (Safehouse/Shop/Event -- no combat
   * happened). run.ts's loop uses this to remove used Burners from
   * RunPlayerState.carriedBurnerIds once the encounter resolves. */
  burnersUsedThisCombat: BurnerId[];
  /** Which carried shop-context "coupon" Burner (if any) was spent on
   * this Shop visit -- Phase 5 Burners checkpoint E. Always null for any
   * non-Shop node. Same "recorded, not applied" split as shopPurchase/
   * modShopPurchase: run.ts's loop removes it from RunPlayerState.
   * carriedBurnerIds since resolveEncounter is a pure function that
   * doesn't hold RunPlayerState itself. */
  shopBurnerUsed: BurnerId | null;
  /** The additive Burner-choice reward actually offered on a fight win --
   * Phase 5 Burners checkpoint F. Unlike modRewardOptions (elite/
   * gatekeeper only), offered on **every** fight tier including regular
   * (DESIGN.md's Burners section). Empty for a loss, a non-win outcome,
   * or any non-fight node. */
  burnerRewardOptions: BurnerDefinition[];
  /** What a Shop visit bought from the Burner slate, or null -- mirrors
   * shopPurchase/modShopPurchase for the third, independently-generated/
   * rerolled slate (checkpoint F). */
  burnerShopPurchases: BurnerOffering[];
  /** REROLL_COST (or 0 if Loyalty Token's freeReroll was active) if a
   * Shop visit spent Data to reroll the Burner slate once -- mirrors
   * rerollCost/modRerollCost for the Burner slate's own independent
   * reroll decision. */
  burnerRerollCost: number;
  /** What an Event's resolved choice granted, if anything -- checkpoint
   * H. Deliberately optional and distinct in shape from *RewardOptions
   * (burnerRewardOptions/modRewardOptions/rewardOptions): an Event grant
   * is a direct single item a script never picks between, not an
   * offered N-of-M choice, so there's no parallel acquisition-strategy
   * step in run.ts -- the grant (if any) is just applied outright. Only
   * ever set on an 'event' node; every other node omits the field
   * entirely rather than setting it to an empty object. */
  eventGrant?: EventGrant;
  /** The Event met here (session 65): never met again this run. */
  eventId?: string;
  /** Burners a Cache's bundle hands over outright (M8); only ever set on
   * a 'cache' node. */
  cacheBurners?: BurnerDefinition[];
}

/** What a Cache holds (M8, the user's call): an elite-tier subroutine
 * pick, a bundle of Data plus 1-2 Burners, or -- on later layers only, and
 * rarely -- a Mod pick. Odds by layer (Claude's starting numbers, to
 * tune): [subroutine, bundle, mod]. */
const CACHE_ODDS: Record<number, [number, number, number]> = { 1: [0.6, 0.4, 0], 2: [0.6, 0.4, 0], 3: [0.55, 0.4, 0.05], 4: [0.55, 0.4, 0.05] };
/** A Cache bundle's Data: an elite win's. */
/** The chance a win offers a Burner (session 63, the user's calls): a
 * regular fight 20%, an elite 50%; gatekeeper wins always do. */
export const BURNER_FIGHT_CHANCE = { regular: 0.2, elite: 0.5 } as const;

const CACHE_BUNDLE_DATA = dataForTier('better');

type FightKind = 'regular' | 'elite' | 'gatekeeper';

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
    const found = enemyById(enemyIdOverride);
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
  /** Player-side (side 0) skill dial, decoupled from the enemy's own --
   * session 39's "never interlocked" rule. The enemy's skill below is
   * always computed from enemySkill(kind, layerIndex, fightNumber)
   * regardless of this value; this only ever changes side 0's strategy.
   * Undefined keeps side 0 at playCombat's baseline default
   * (discardLowestTwo/playLowestLegal), same as before this parameter
   * existed. */
  playerSkill?: number,
  /** A Security Level's lift to enemy skill (MP14, levels 4 and 8). */
  skillOffset = 0,
): { discardStrategies?: [DiscardStrategy, DiscardStrategy]; playStrategies?: [PlayStrategy, PlayStrategy] } {
  if (discardStrategies || playStrategies) return { discardStrategies, playStrategies };
  const skill = Math.min(1, enemySkill(kind, layerIndex, fightNumber) + skillOffset);
  const playerDiscard = playerSkill === undefined ? discardLowestTwo : discardSkillStrategy(playerSkill);
  const playerPeg = playerSkill === undefined ? playLowestLegal : pegSkillStrategy(playerSkill);
  return {
    discardStrategies: [playerDiscard, discardSkillStrategy(skill)],
    playStrategies: [playerPeg, pegSkillStrategy(skill)],
  };
}

/**
 * Diagnostic-only synthetic gatekeeper (session 49) -- resolves a
 * gatekeeper fight by a weighted coin instead of playCombat, so
 * gatekeeper difficulty can be pinned at a known value while something
 * else is measured.
 *
 * Exists because a lost gatekeeper fight returns `quarantined: true`
 * below and ends the run outright, which makes every layer's population
 * strictly "whoever beat the previous layer" -- so any per-layer or
 * per-class number is measured on a cohort pre-selected by exactly the
 * thing being measured. Setting every layer to `passRate: 1` produces
 * the first genuinely unfiltered cohort at all four layers; setting a
 * designed curve holds the roster flat while class balance is read.
 *
 * `heatGenerated` is NOT optional on purpose. It feeds Heat on a win
 * (see the win branch below), and Heat is its own run-ending path, so a
 * synthetic that silently generated none would lengthen runs for a
 * reason unrelated to gatekeepers -- the same invisible-second-effect
 * shape as session 48's `choked` rescale. Since session 58 it is only the
 * gatekeeper's alarm Heat (Spotlight, a tracer), so 0 for most.
 *
 * Prefer the ARRAY form where it is skewed: feeding the mean as a
 * constant deletes the tail that drives Heat deaths (session 49's
 * checkpoint 2 measured `heatMaxed` falling 12.5% -> 10.5% purely from
 * that, back when this was Trace).
 */
export interface SyntheticGatekeeper {
  /** Probability in [0, 1] that the player passes. */
  passRate: number;
  /** Alarm Heat the real fight would have raised on a win. A single
   * number is a fixed value; an array is an empirical sample drawn from
   * uniformly (see syntheticCombatResult for why that draw costs no
   * extra RNG). */
  heatGenerated: number | number[];
}

/**
 * The stub `CombatResult` a synthetic gatekeeper resolves to. Only four
 * of CombatResult's fields are ever read downstream of the playCombat
 * call in resolveFight -- winner, heatGenerated, peakFillFraction[0]
 * and burnersUsedThisCombat -- so the rest are inert placeholders rather
 * than a fabricated fight record, deliberately: an empty `hands`/`log`
 * makes it obvious at a glance that no Cribbage was played here, where
 * plausible-looking fake data would not.
 *
 * `seed` is the same `rng.nextInt(2 ** 31)` draw the real path spends on
 * playCombat, reused as the coin so the synthetic consumes exactly as
 * much of the run's RNG stream as a real fight does. That keeps a
 * synthetic run seed-aligned with a real one right up until the first
 * outcome that genuinely differs (after which the win branch's reward
 * draws diverge the streams, unavoidably).
 *
 * peakFillFraction and a losing heatGenerated are unobservable in
 * practice -- a gatekeeper loss takes the `quarantined` branch, which
 * reads neither -- but are set coherently rather than left at zero.
 */
function syntheticCombatResult(spec: SyntheticGatekeeper, seed: number): CombatResult {
  const won = seed / 2 ** 31 < spec.passRate;
  // The Heat sample index is derived from `seed` by a multiplicative
  // hash rather than drawn from the Rng, so supplying an empirical
  // distribution still costs exactly the one draw a real fight costs and
  // the "seed-aligned until outcomes differ" property survives. Hashed
  // rather than taken modulo directly, so the index does not correlate
  // with the coin, which reads the same integer.
  // The posted baseline is charged by resolveFight, as for a real fight. A
  // synthetic win reports the enemy's final fill as 0, so it pays no
  // performance term -- a synthetic gatekeeper prices R8's toll at its
  // floor.
  const heat = Array.isArray(spec.heatGenerated)
    ? (spec.heatGenerated[(Math.imul(seed, 2654435761) >>> 0) % spec.heatGenerated.length] ?? 0)
    : spec.heatGenerated;
  return {
    winner: won ? 0 : 1,
    log: [],
    timeline: [],
    hands: [],
    peakFillFraction: won ? [1, 0] : [0, 1],
    finalFillFraction: won ? [1, 0] : [0, 1],
    heatGenerated: won ? heat : 0,
    resolvedBy: 'threshold',
    burnersUsedThisCombat: [],
  };
}

/**
 * Runs a fight as part of the pausable run: the enemy's requests are
 * answered here, with the same strategies playCombat would use, and the
 * player's surface as 'combat' RunRequests whose fallback is that same
 * strategy call -- so a simulated fight is byte-identical to playCombat.
 */
function* fightRequests(loadouts: [SubroutineDefinition[], SubroutineDefinition[]], options: CombatOptions): Generator<RunRequest, CombatResult, unknown> {
  const discard = options.discardStrategies ?? [discardLowestTwo, discardLowestTwo];
  const play = options.playStrategies ?? [playLowestLegal, playLowestLegal];
  const burner = options.burnerActivationStrategies ?? [neverActivateBurner, neverActivateBurner];
  const fight = combatGenerator(loadouts, options);
  let step = fight.next();
  while (!step.done) {
    const r = step.value;
    const auto = (): CombatAnswer =>
      r.kind === 'discard' ? discard[r.side](r.context) : r.kind === 'play' ? play[r.side](r.context) : burner[r.side](r.context);
    const answer = r.side === 0 ? yield* ask({ kind: 'combat', request: r, fallback: auto }) : auto();
    step = fight.next(answer);
  }
  return step.value;
}

function* resolveFight(
  kind: FightKind,
  node: MapNode,
  layerIndex: number,
  fightNumber: number,
  rng: Rng,
  playerState: RunPlayerState,
  discardStrategies?: [DiscardStrategy, DiscardStrategy],
  playStrategies?: [PlayStrategy, PlayStrategy],
  enemyIdOverride?: EnemyId,
  /** Per-side combat-context Burner activation (checkpoint C's own
   * mechanism, threaded all the way through here -- checkpoint J
   * verification caught that resolveFight never actually passed this to
   * playCombat, meaning a real playRun fight had no way to reach it at
   * all until now). Defaults to playCombat's own [neverActivateBurner,
   * neverActivateBurner] when omitted. */
  burnerActivationStrategies?: [BurnerActivationStrategy, BurnerActivationStrategy],
  /** Player-side skill dial, decoupled from the enemy's own -- see
   * strategiesForFight's own doc comment. Same append-at-the-end
   * treatment as every prior checkpoint's new param. */
  playerSkill?: number,
  /** Diagnostic-only (session 49) -- when set AND this is a gatekeeper
   * fight, the fight resolves by weighted coin instead of playCombat.
   * See SyntheticGatekeeper above. Deliberately gated on `kind` so an
   * Event's bonus fight (which routes through this same function) always
   * resolves for real, whatever the layer's gatekeeper is doing. Same
   * append-at-the-end treatment as every prior checkpoint's new param. */
  syntheticGatekeeper?: SyntheticGatekeeper,
): Generator<RunRequest, EncounterOutcome, unknown> {
  const enemy = enemyForFight(kind, node, layerIndex, fightNumber, rng, enemyIdOverride);
  const security = playerState.security;
  const strategies = strategiesForFight(kind, layerIndex, fightNumber, discardStrategies, playStrategies, playerSkill, security?.skillOffset);
  const seed = rng.nextInt(2 ** 31);
  // Per-layer difficulty scaler (session 39) -- applied here, not baked
  // into ENEMY_ROSTER's own authored data, so that data stays static and
  // regular/elite (which can appear at several layers) get a fresh scale
  // each encounter rather than a fixed one.
  // A Security Level makes every enemy stronger (MP14).
  const scaledLoadout = scaledEnemyLoadout(enemy.loadout, magnitudeScalerFor(enemy, layerIndex, fightNumber) * (security?.enemyStrength ?? 1));
  // Gated on `kind` so an Event's bonus fight, which reaches this same
  // function, is never synthesised along with the layer's gatekeeper.
  const synthetic = kind === 'gatekeeper' ? syntheticGatekeeper : undefined;
  // D1/D2: the node's posted baseline Heat, by tier x layer. layerIndex
  // is 1-based here (enemies.ts's numbering); heat.ts's tables are 0-based.
  const layer0 = layerIndex - 1;
  const baseline = fightBaselineHeat(kind, layer0);
  yield* ask({ kind: 'fightStart', enemy, tier: kind, layer: layerIndex, playerState, fallback: () => null });
  // The archetype power upgrades (session 71, MP7) strengthen each
  // subroutine's Process by its archetype.
  const process = playerState.meta?.process;
  const playerLoadout = process ? playerState.installedLoadout.map((p) => scaledProcess(p, process[p.archetype])) : playerState.installedLoadout;
  const fight = (fightSeed: number) => fightRequests([playerLoadout, scaledLoadout], {
        seed: fightSeed,
        ...combatThresholdsFor(playerState, enemy, layerIndex, fightNumber),
        classId: playerState.classId,
        gatekeeperMods: [[], [...(enemy.mods ?? []), ...securityMods(enemy, kind, layerIndex, security, playerState.daily?.eliteMods)]],
        glitches: playerState.daily?.glitches,
        ownedModIds: playerState.ownedModIds,
        classModUpgraded: playerState.classModUpgraded,
        strainHeat: eventHeat(SYSTEM_STRAIN_LOSSES, layer0),
        benched: playerState.bench,
        fightTier: kind,
        // Filtered to combat-context Burners only -- a carried map/shop-only
        // Burner has nothing to activate here (checkpoint C).
        carriedBurnerIds: playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('combat')),
        discardStrategies: strategies.discardStrategies,
        playStrategies: strategies.playStrategies,
        burnerActivationStrategies,
      });
  let result: CombatResult = synthetic ? syntheticCombatResult(synthetic, seed) : yield* fight(seed);
  yield* ask({ kind: 'fightEnd', enemy, tier: kind, result, fallback: () => null });

  // Restore Point (session 68, E18): a lost gatekeeper fight starts over,
  // once, and the Burner is used up. The lost attempt costs no Heat (a
  // gatekeeper loss never did); the toll is still due on a win.
  if (kind === 'gatekeeper' && result.winner !== 0 && !synthetic && playerState.carriedBurnerIds.includes('restore-point')) {
    const spent = [...result.burnersUsedThisCombat, 'restore-point' as BurnerId];
    yield* ask({ kind: 'burnerSaved', burnerId: 'restore-point', enemy, fallback: () => null });
    yield* ask({ kind: 'fightStart', enemy, tier: kind, layer: layerIndex, playerState, fallback: () => null });
    const retry = yield* fight(seed + RESTORE_POINT_SEED_STEP);
    result = { ...retry, burnersUsedThisCombat: [...spent, ...retry.burnersUsedThisCombat] };
    yield* ask({ kind: 'fightEnd', enemy, tier: kind, result, fallback: () => null });
  }
  // Clean work leaves fewer traces (session 72, the user's idea): a
  // Flawless Cribbage rating takes FLAWLESS_HEAT off the fight's baseline,
  // win or lose. A lost gatekeeper is Quarantine, with no Heat to waive.
  const waived = result.skill && tallyStars(result.skill) === 5 && !(kind === 'gatekeeper' && result.winner !== 0) ? flawlessHeatWaiver(kind, layer0) : 0;
  const fightInfo = { enemyId: enemy.id, tier: kind, resolvedBy: result.resolvedBy, peakFillFraction: result.peakFillFraction, finalFillFraction: result.finalFillFraction, hands: result.hands.length, ...(waived ? { flawlessWaived: waived } : {}) };
  if (result.winner === 0) {
    const rewardTier: RewardTier = kind === 'regular' ? 'standard' : 'better';
    // Additive Mod-choice reward on elite/gatekeeper wins only (session
    // 30) -- never on a regular win, alongside Petty Cache/Black Budget's
    // onEncounterResolved hooks (Phase 5 Mods checkpoint E).
    const modRewardOptions = kind === 'regular' ? [] : drawModRewardOptions(playerState.classId, playerState.ownedModIds, rng);
    // Additive Burner-choice reward on EVERY fight tier including regular
    // (checkpoint F -- unlike modRewardOptions above, no kind gate).
    // Session 63 (the user's call; was every fight): a gatekeeper win always
    // offers a Burner, a regular or elite one BURNER_FIGHT_CHANCE of the
    // time -- players collected far more than they used.
    const burnerRewardOptions = kind === 'gatekeeper' || rng.next() < BURNER_FIGHT_CHANCE[kind] ? drawBurnerRewardOptions(rng) : [];
    const modified = applyOnWinEncounterResolvedMods(
      playerState.ownedModIds,
      dataForTier(rewardTier),
      // An elite's subroutines are uncommon or better (session 62): it
      // now offers a subroutine OR a Mod, so its subroutines must compete.
      kind === 'elite' ? drawCacheRewardOptions(playerState.classId, rng, ownedSubroutineIds(playerState)) : drawRewardOptions(playerState.classId, rewardTier, rng, ownedSubroutineIds(playerState)),
      kind,
      rng,
      (r) => drawUpgradedRewardOptions(playerState.classId, r, ownedSubroutineIds(playerState)),
    );
    // R6: a win pays the posted baseline plus the performance term, read
    // off the enemy's FINAL Containment, plus whatever its alarms raised.
    // For a gatekeeper this is R8's toll -- charged here, after the fight;
    // run.ts checks it against the layer's allowance and resets Heat if it
    // is survived.
    const performance = fightPerformanceHeat(kind, layer0, result.finalFillFraction[1]);
    const alarm = result.heatGenerated;
    return {
      newState: 'inert',
      heatDelta: baseline - waived + alarm + performance - modified.heatRefund, // Heat Sink (session 44); addHeat already floors at 0
      heatSources: { ...NO_HEAT_SOURCES, baseline: baseline - waived, alarm, performance, refund: -modified.heatRefund },
      fight: fightInfo,
      quarantined: false,
      rewardTier,
      dataAwarded: modified.dataAwarded,
      // Security Level 5+ offers fewer choices (MP14).
      rewardOptions: modified.rewardOptions.slice(0, security?.rewardChoices ?? undefined),
      mergeTargetId: null,
      shopPurchases: [],
      rerollCost: 0,
      modRewardOptions: modRewardOptions.slice(0, security?.rewardChoices ?? undefined),
      // Session 62 (the user's call): an elite win offers a subroutine OR
      // a Mod, one choice, not both.
      eliteChoice: kind === 'elite' ? true : undefined,
      modShopPurchases: [],
      modRerollCost: 0,
      burnersUsedThisCombat: result.burnersUsedThisCombat,
      shopBurnerUsed: null,
      burnerRewardOptions,
      burnerShopPurchases: [],
      burnerRerollCost: 0,
    };
  }
  if (kind === 'gatekeeper') {
    // Quarantine ends the run outright -- no Heat cost, and the node's
    // state doesn't matter (there's no run left to route around it in).
    return {
      newState: 'unresolved',
      heatDelta: 0,
      // A gatekeeper loss bypasses Heat entirely (heat.ts) -- nothing to attribute.
      heatSources: NO_HEAT_SOURCES,
      fight: fightInfo,
      quarantined: true,
      rewardTier: 'none',
      dataAwarded: 0,
      rewardOptions: [],
      mergeTargetId: null,
      shopPurchases: [],
      rerollCost: 0,
      modRewardOptions: [],
      modShopPurchases: [],
      modRerollCost: 0,
      burnersUsedThisCombat: result.burnersUsedThisCombat,
      shopBurnerUsed: null,
      burnerRewardOptions: [],
      burnerShopPurchases: [],
      burnerRerollCost: 0,
    };
  }
  // R7: a loss pays the baseline plus LOSS_MULTIPLIER x the performance
  // weight, plus whatever the enemy's alarms raised.
  const lossHeat = heatFromLoss(kind, layer0) - waived;
  const alarm = result.heatGenerated;
  return {
    newState: 'closed',
    heatDelta: lossHeat + alarm,
    // resolvedBy 'threshold' on a player loss means the enemy genuinely
    // filled its own Containment gauge; 'attrition' means it ran out the
    // HARD_RESOLUTION_HAND clock without ever doing so. heatFromLoss
    // charges the same for both -- separated here so that stays a choice.
    heatSources: {
      ...NO_HEAT_SOURCES,
      containmentLoss: result.resolvedBy === 'threshold' ? lossHeat : 0,
      attritionLoss: result.resolvedBy === 'threshold' ? 0 : lossHeat,
      alarm,
    },
    fight: fightInfo,
    quarantined: false,
    rewardTier: 'none',
    dataAwarded: 0,
    rewardOptions: [],
    mergeTargetId: null,
    shopPurchases: [],
    rerollCost: 0,
    modRewardOptions: [],
    modShopPurchases: [],
    modRerollCost: 0,
    burnersUsedThisCombat: result.burnersUsedThisCombat,
    shopBurnerUsed: null,
    burnerRewardOptions: [],
    burnerShopPurchases: [],
    burnerRerollCost: 0,
  };
}

// ---------------------------------------------------------------------
// Event choice resolution (Phase 5 Events checkpoint H) -- lives
// directly here rather than in events.ts (which is roster data only) or
// event-types.ts (pure types), matching this checkpoint's own file-
// organization note: no registry/hook-fan-out shape here the way Mods
// needed one.
// ---------------------------------------------------------------------

/** Decides which of an Event's choices a script takes -- mirrors
 * ShopStrategy/AcquisitionStrategy's "legal-not-good scripted decision"
 * shape, but picks from a fixed list rather than an offered slate. */
export type EventChoiceStrategy = (event: EventDefinition, playerState: RunPlayerState, heat: number) => EventChoice;

/** Legal-not-good default: always takes the first listed choice, no
 * risk/reward judgment. Ignores `heat`, same as beelineToGatekeeper
 * ignores TraversalStrategy's own -- a function with fewer declared
 * params still satisfies the wider type, so this stays valid unchanged. */
export const alwaysFirstEventChoice: EventChoiceStrategy = (event) => event.choices[0];

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint I) -- a real
// risk-tolerance heuristic for Event choices.
//
// Deliberately its own heuristic rather than the item ladder used by
// every other acquisition decision this session added: an Event choice
// is a risk-tiered narrative option, not an item, so credit-gap /
// archetype / rarity mean nothing here.
//
// Shaped as a factory rather than a constant, mirroring ai.ts's
// discardSkillStrategy(skill) -- the established way this codebase makes
// a strategy configurable. Config is explicit named parameters rather
// than a single continuous "risk appetite" dial, for the same reason the
// ladder beat numeric weights: a continuous scalar would need a
// calibration target that doesn't exist.
//
// `heat` was added to EventChoiceStrategy for this checkpoint. The type
// only ever received (event, playerState), so gambleSafetyMargin had
// nothing to check -- resolveEncounter already had currentHeat in hand
// and simply wasn't passing it. Exactly the precedent SafehouseStrategy
// set when it gained its own heat param; every existing implementation
// stays valid.
// ---------------------------------------------------------------------

export interface EventRiskConfig {
  /** The riskiest tier this profile will ever take. */
  maxRiskTier: EventRiskTier;
  /** Heat ceiling, as a fraction of this run's own max Heat, above which
   * a gamble-tier choice is refused however permissive maxRiskTier is.
   * Reuses the Heat safety-reserve framing opportunisticSafehouseStrategy
   * and opportunisticTraversal already share, so the profile has one
   * notion of "safe enough to take a risk" rather than two. */
  gambleSafetyMargin: number;
}

/** Higher index is riskier -- and, per DESIGN.md's Events section, gates
 * a higher reward ceiling, which is what makes "take the riskiest
 * allowed tier" the right default shape rather than a reckless one. */
const RISK_TIER_ORDER: EventRiskTier[] = ['transparent', 'visibleOdds', 'gamble'];

/** Picks the highest-reward-ceiling choice this profile's risk tolerance
 * permits. Falls back to the first listed choice if an Event somehow
 * offers nothing at or under the cap -- every shipped Event has at least
 * one transparent choice, so this is defensive rather than expected. */
export function synergyAwareEventChoice(config: EventRiskConfig): EventChoiceStrategy {
  return (event, playerState, heat) => {
    const maxIndex = RISK_TIER_ORDER.indexOf(config.maxRiskTier);
    const heatCeiling = config.gambleSafetyMargin * currentHeatCeiling(playerState);
    const gambleAllowed = heat < heatCeiling;

    const permitted = event.choices.filter((choice) => {
      const tierIndex = RISK_TIER_ORDER.indexOf(choice.riskTier);
      if (tierIndex > maxIndex) return false;
      // A gamble can end a run outright (bonusFight, heatDelta), so the
      // safety reserve overrides the tier cap rather than combining with
      // it -- being *allowed* to gamble isn't the same as it being a
      // sane moment to.
      if (choice.riskTier === 'gamble' && !gambleAllowed) return false;
      return true;
    });
    if (permitted.length === 0) return event.choices[0];

    return permitted.reduce((best, choice) =>
      RISK_TIER_ORDER.indexOf(choice.riskTier) > RISK_TIER_ORDER.indexOf(best.riskTier) ? choice : best,
    );
  };
}

/** Rolls one of a choice's weighted outcomes against `rng` -- a
 * `transparent` choice's single outcome (probability 1) always "rolls"
 * true on the first iteration, so this needs no special-casing per risk
 * tier. Same cumulative-roll-with-fallback shape as rewards.ts's/
 * mods.ts's/burners.ts's own weighted-sampling helpers, guarding against
 * a probability sum that lands a hair under 1 by floating-point error. */
function rollWeightedOutcome(outcomes: EventChoice['outcomes'], rng: Rng): EventChoice['outcomes'][number] {
  let roll = rng.next();
  for (const outcome of outcomes) {
    roll -= outcome.probability;
    if (roll <= 0) return outcome;
  }
  return outcomes[outcomes.length - 1];
}

/** Resolves a subroutineGrant -- a named piece outright, or a uniform
 * random pick from the player's class reward pool filtered by rarity
 * (rewards.ts's rewardPoolForClass/rarityOf, the same pool combat
 * rewards draw from). Undefined if a randomFromRarity draw finds nothing
 * at that rarity for this class -- a real possibility for a narrow pool,
 * treated as "no grant" rather than throwing. */
function resolveSubroutineGrant(grant: Grant<SubroutineDefinition>, classId: ClassId, rng: Rng): SubroutineDefinition | undefined {
  if ('specific' in grant) return grant.specific;
  const filtered = rewardPoolForClass(classId).filter((piece) => rarityOf(piece.id) === grant.randomFromRarity);
  if (filtered.length === 0) return undefined;
  return filtered[rng.nextInt(filtered.length)];
}

/** Mirrors resolveSubroutineGrant for Mods -- modPoolForClass (mods.ts)
 * already excludes owned ids, so a randomFromRarity draw never hands
 * back a duplicate. */
function resolveModGrant(grant: Grant<ModDefinition>, classId: ClassId, ownedModIds: ModId[], rng: Rng): ModDefinition | undefined {
  if ('specific' in grant) return grant.specific;
  const filtered = modPoolForClass(classId, ownedModIds).filter((mod) => mod.rarity === grant.randomFromRarity);
  if (filtered.length === 0) return undefined;
  return filtered[rng.nextInt(filtered.length)];
}

/** Mirrors resolveSubroutineGrant/resolveModGrant for Burners -- no
 * class scoping needed (archetype-agnostic pool, same as checkpoint F's
 * burnerOfferingsForClass). */
function resolveBurnerGrant(grant: Grant<BurnerDefinition> | { contraband: true }, rng: Rng): BurnerDefinition | undefined {
  if ('specific' in grant) return grant.specific;
  if ('contraband' in grant) {
    const contraband = Object.values(BURNER_DEFINITIONS).filter((b) => b.contraband);
    return contraband[rng.nextInt(contraband.length)];
  }
  const filtered = generalBurnerPool().filter((burner) => burner.rarity === grant.randomFromRarity);
  if (filtered.length === 0) return undefined;
  return filtered[rng.nextInt(filtered.length)];
}

/** resolveEncounterRequests, answered by its fallbacks (the simulation):
 * byte-identical to the synchronous resolveEncounter this used to be. */
export function resolveEncounter(...args: Parameters<typeof resolveEncounterRequests>): EncounterOutcome {
  return driveWithFallbacks(resolveEncounterRequests(...args));
}

/** One node's encounter, pausing at each decision (see run-requests.ts). */
export function* resolveEncounterRequests(
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
  /** Mirrors shopStrategy/shopRerollStrategy for the parallel Mod slate
   * (Phase 5 Mods checkpoint G) -- appended at the end rather than
   * inserted alongside the subroutine-shop params above, so every
   * existing positional call site stays valid unchanged. */
  modShopStrategy: ModShopStrategy = buyCheapestAffordableMod,
  modShopRerollStrategy: ModShopRerollStrategy = rerollModIfNothingAffordable,
  /** Which (if any) carried shop-context "coupon" Burner a script spends
   * on a Shop visit (checkpoint E) -- same append-at-the-end treatment
   * as modShopStrategy/modShopRerollStrategy above. Defaults to
   * neverActivateShopBurner. */
  shopBurnerStrategy: ShopBurnerStrategy = neverActivateShopBurner,
  /** Mirrors shopStrategy/shopRerollStrategy (and modShopStrategy/
   * modShopRerollStrategy) for the Burner slate's own third independent
   * draw/reroll -- checkpoint F. Defaults to buyCheapestAffordableBurner/
   * rerollBurnerIfNothingAffordable. */
  burnerShopStrategy: BurnerShopStrategy = buyCheapestAffordableBurner,
  burnerShopRerollStrategy: BurnerShopRerollStrategy = rerollBurnerIfNothingAffordable,
  /** Which of an Event's choices a script takes (checkpoint H) --
   * same append-at-the-end treatment as every prior checkpoint's new
   * strategy param. Defaults to alwaysFirstEventChoice. */
  eventChoiceStrategy: EventChoiceStrategy = alwaysFirstEventChoice,
  /** Per-side combat-context Burner activation for every real fight this
   * encounter resolves, event bonus fights included -- checkpoint J
   * verification caught that this was never threaded past combat.ts at
   * all (fixed here). Defaults to playCombat's own
   * [neverActivateBurner, neverActivateBurner] when omitted. */
  burnerActivationStrategies?: [BurnerActivationStrategy, BurnerActivationStrategy],
  /** The run's current Heat at the moment of this node's visit -- same
   * append-at-the-end treatment as every prior checkpoint's new param.
   * Only consulted by the Safehouse case below (a Heat-aware
   * SafehouseStrategy can't decide Rest-vs-Merge without it); defaults to
   * 0 for any pre-existing caller that doesn't care (matches
   * preferMergeWhenAvailable, which ignores it entirely). */
  currentHeat: number = 0,
  /** Player-side skill dial, decoupled from the enemy's own -- same
   * append-at-the-end treatment as every prior checkpoint's new param.
   * See strategiesForFight's doc comment for the "never interlocked"
   * rule this exists to enforce. */
  playerSkill?: number,
  /** Which banked id a 'merge' Safehouse action spends itself on
   * (session 46, Gameplay Simulation Heuristics checkpoint E) -- same
   * append-at-the-end treatment as every prior checkpoint's new param.
   * Defaults to pickMergeTarget, the legal-not-good behavior this call
   * site hardcoded before now. Note the Safehouse case below already
   * falls back to Rest on a null return, so a strategy that declines
   * (merge.ts's synergyAwareMergeTarget does, for a rank-capped id)
   * recovers the visit rather than wasting it. */
  mergeTargetStrategy: MergeTargetStrategy = pickMergeTarget,
  /** Diagnostic-only (session 49) -- resolves THIS node's gatekeeper
   * fight by weighted coin instead of playCombat. See
   * SyntheticGatekeeper above for why. Reaches only the gatekeeperFight
   * case below; the Event bonus-fight call site deliberately does not
   * forward it. Same append-at-the-end treatment as every prior
   * checkpoint's new param. */
  syntheticGatekeeper?: SyntheticGatekeeper,
  /** The simulated player shops like a person (session 62; RunOptions'
   * shopSpendFreely). Same append-at-the-end treatment. */
  shopSpendFreely = false,
): Generator<RunRequest, EncounterOutcome, unknown> {
  switch (node.type) {
    case 'regularFight':
      return yield* resolveFight('regular', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride, burnerActivationStrategies, playerSkill);
    case 'eliteFight':
      return yield* resolveFight('elite', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride, burnerActivationStrategies, playerSkill);
    case 'gatekeeperFight':
      return yield* resolveFight('gatekeeper', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride, burnerActivationStrategies, playerSkill, syntheticGatekeeper);
    case 'safehouse': {
      // DESIGN.md's deliberate Rest-vs-Merge trade-off: one action per
      // visit (the node goes inert either way). Falls back to Rest if
      // the strategy chose 'merge' but nothing is actually banked to
      // spend -- 'merge' with no material would otherwise waste the
      // visit entirely.
      const action = yield* ask({ kind: 'safehouse', playerState, heat: currentHeat, fallback: () => safehouseStrategy(playerState, currentHeat) });
      const targetId = action === 'merge' ? yield* ask({ kind: 'mergeTarget', playerState, fallback: () => mergeTargetStrategy(playerState) }) : null;
      if (targetId) {
        return {
          newState: 'inert',
          heatDelta: 0,
          heatSources: NO_HEAT_SOURCES,
          quarantined: false,
          rewardTier: 'none',
          dataAwarded: 0,
          rewardOptions: [],
          mergeTargetId: targetId,
          shopPurchases: [],
          rerollCost: 0,
          modRewardOptions: [],
          modShopPurchases: [],
          modRerollCost: 0,
          burnersUsedThisCombat: [],
          shopBurnerUsed: null,
          burnerRewardOptions: [],
          burnerShopPurchases: [],
          burnerRerollCost: 0,
        };
      }
      return {
        newState: 'inert',
        heatDelta: -restHeatFor(playerState),
        heatSources: { ...NO_HEAT_SOURCES, rest: -restHeatFor(playerState) },
        quarantined: false,
        rewardTier: 'none',
        dataAwarded: 0,
        rewardOptions: [],
        mergeTargetId: null,
        shopPurchases: [],
        rerollCost: 0,
        modRewardOptions: [],
        modShopPurchases: [],
        modRerollCost: 0,
        burnersUsedThisCombat: [],
        shopBurnerUsed: null,
        burnerRewardOptions: [],
        burnerShopPurchases: [],
        burnerRerollCost: 0,
      };
    }
    case 'shop': {
      // Shop-context Burner activation (checkpoint E), decided before
      // either slate is generated -- same timing as Vendor Discount/Bulk
      // Buyer's own onShopSlateGenerated hook below, just a one-shot
      // carried item instead of a standing owned Mod.
      const availableShopBurnerIds = playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('shop'));
      const chosenShopBurnerId =
        availableShopBurnerIds.length > 0
          ? yield* ask({ kind: 'shopBurner', burnerIds: availableShopBurnerIds, playerState, fallback: () => shopBurnerStrategy(availableShopBurnerIds, playerState) })
          : null;
      const activatedShopBurner =
        chosenShopBurnerId && availableShopBurnerIds.includes(chosenShopBurnerId) ? BURNER_DEFINITIONS[chosenShopBurnerId] : undefined;
      const shopBurnerUsed = activatedShopBurner ? activatedShopBurner.id : null;
      // The visit sees you without the Burner just used (session 63, the
      // user's catch: it was still offered for sale). run.ts removes it
      // for good after the encounter, from outcome.shopBurnerUsed.
      const shopper: RunPlayerState = shopBurnerUsed
        ? { ...playerState, carriedBurnerIds: playerState.carriedBurnerIds.filter((_, i) => i !== playerState.carriedBurnerIds.indexOf(shopBurnerUsed)) }
        : playerState;
      const burnerModifiers = shopModifiersForActivatedBurner(activatedShopBurner);

      // Vendor Discount/Bulk Buyer (Phase 5 Mods checkpoint E) apply to
      // both independent slates equally -- a Shop-wide effect, not
      // subroutine-only. A Burner coupon's discount doesn't stack with
      // Vendor Discount (the larger of the two applies, not a compounded
      // multiply -- see burners.ts's shopModifiersForActivatedBurner).
      const { discountFraction: modDiscountFraction, extraCommons, extraUncommons } = shopModifiersForOwnedMods(playerState.ownedModIds);
      // The Shop price upgrade (session 71, MP7) multiplies whatever
      // discount applies, so prices can't fall to nothing.
      // A Security Level raises prices (MP14, levels 3 and 7).
      const discountFraction = 1 - (1 - Math.max(modDiscountFraction, burnerModifiers.discountFraction)) * (playerState.meta?.shopPrice ?? 1) * (playerState.security?.shopPrice ?? 1);
      // Black Market Ties (session 65): a contraband Burner on every Burner
      // slate, and each visit adds Heat.
      const blackMarket = playerState.ownedModIds.includes('black-market-ties');
      const rarityFloor = burnerModifiers.rarityFloor;
      const rerollCostThisVisit = burnerModifiers.freeReroll ? 0 : REROLL_COST;
      // Milestone 3 checkpoint 4 (the user's call: buy freely): all three
      // slates are drawn up front and the visit is one loop of actions --
      // buy any offering you can afford (each once), reroll each slate
      // once, leave. The simulated player's answers (shopFallback) replay
      // its old sequence exactly: the three reroll decisions against the
      // first slates, then at most one buy per slate, then leave.
      const purchases = { subroutine: [] as ShopOffering[], mod: [] as ModOffering[], burner: [] as BurnerOffering[] };
      // A rerolled Mod slate leaves out Mods bought earlier this visit, as
      // it does owned ones (session 63, the user's catch: a reroll offered
      // the Mod just bought).
      const drawSlate = (slate: ShopSlate) =>
        slate === 'subroutine'
          ? shopOfferingsForClass(playerState.classId, rng, extraCommons, extraUncommons, discountFraction, rarityFloor)
          : slate === 'mod'
            ? modOfferingsForClass(playerState.classId, [...playerState.ownedModIds, ...purchases.mod.map((o) => o.mod.id)], rng, extraCommons, extraUncommons, discountFraction, rarityFloor)
            : burnerOfferingsForClass(playerState.classId, rng, extraCommons, extraUncommons, discountFraction, rarityFloor, blackMarket ? 1 : 0);
      const visit: ShopVisit = {
        slates: { subroutine: drawSlate('subroutine') as ShopOffering[], mod: drawSlate('mod') as ModOffering[], burner: drawSlate('burner') as BurnerOffering[] },
        bought: { subroutine: [], mod: [], burner: [] },
        rerolled: { subroutine: false, mod: false, burner: false },
        data: playerState.data,
        rerollCost: rerollCostThisVisit,
        sold: { subroutine: [], copy: [], burner: [] },
      };
      const rerollCosts: Record<ShopSlate, number> = { subroutine: 0, mod: 0, burner: 0 };
      const strategies = { shopRerollStrategy, modShopRerollStrategy, burnerShopRerollStrategy, shopStrategy, modShopStrategy, burnerShopStrategy, spendFreely: shopSpendFreely };
      let simPhase = 0;
      for (;;) {
        const snapshot: ShopVisit = {
          ...visit,
          slates: { ...visit.slates },
          bought: { subroutine: [...visit.bought.subroutine], mod: [...visit.bought.mod], burner: [...visit.bought.burner] },
          rerolled: { ...visit.rerolled },
          sold: { subroutine: [...visit.sold.subroutine], copy: [...visit.sold.copy], burner: [...visit.sold.burner] },
        };
        const phaseAtAsk = simPhase;
        const action = yield* ask({ kind: 'shop', shop: snapshot, playerState: shopper, fallback: () => shopFallback(snapshot, shopper, phaseAtAsk, strategies).action });
        const sim = shopFallback(snapshot, shopper, phaseAtAsk, strategies);
        simPhase = sameShopAction(action, sim.action) ? sim.phase + 1 : simPhase;
        if (action.kind === 'leave') break;
        if (action.kind === 'reroll') {
          if (visit.rerolled[action.slate] || visit.data < visit.rerollCost) continue;
          visit.rerolled[action.slate] = true;
          visit.data -= visit.rerollCost;
          rerollCosts[action.slate] += visit.rerollCost;
          visit.bought[action.slate] = [];
          if (action.slate === 'subroutine') visit.slates.subroutine = drawSlate('subroutine') as ShopOffering[];
          else if (action.slate === 'mod') visit.slates.mod = drawSlate('mod') as ModOffering[];
          else visit.slates.burner = drawSlate('burner') as BurnerOffering[];
          continue;
        }
        if (action.kind === 'sell') {
          // Selling (session 61): a benched subroutine, a banked copy or a
          // carried Burner not already sold this visit; its price joins
          // this visit's Data.
          const sold = visit.sold[action.item] as string[];
          const ownedCount =
            action.item === 'subroutine'
              ? playerState.bench.filter((p) => p.id === action.id).length
              : action.item === 'copy'
                ? (playerState.material[action.id] ?? 0)
                : shopper.carriedBurnerIds.filter((id) => id === action.id).length;
          if (ownedCount <= sold.filter((id) => id === action.id).length) continue;
          sold.push(action.id);
          visit.data +=
            action.item === 'burner'
              ? burnerSellPrice(BURNER_DEFINITIONS[action.id])
              : subroutineSellPrice(action.id, action.item === 'subroutine' ? (playerState.bench.find((p) => p.id === action.id)?.rank ?? 0) : 0);
          continue;
        }
        const offering = visit.slates[action.slate][action.index];
        if (!offering || visit.bought[action.slate].includes(action.index) || offering.cost > visit.data) continue;
        visit.bought[action.slate].push(action.index);
        visit.data -= offering.cost;
        if (action.slate === 'subroutine') purchases.subroutine.push(offering as ShopOffering);
        else if (action.slate === 'mod') purchases.mod.push(offering as ModOffering);
        else purchases.burner.push(offering as BurnerOffering);
      }

      return {
        newState: 'inert',
        heatDelta: blackMarket ? BLACK_MARKET_VISIT_HEAT : 0,
        heatSources: blackMarket ? { ...NO_HEAT_SOURCES, mod: BLACK_MARKET_VISIT_HEAT } : NO_HEAT_SOURCES,
        quarantined: false,
        rewardTier: 'none',
        dataAwarded: 0,
        rewardOptions: [],
        mergeTargetId: null,
        shopPurchases: purchases.subroutine,
        shopSales: visit.sold.subroutine.length + visit.sold.copy.length + visit.sold.burner.length > 0 ? { ...visit.sold } : undefined,
        rerollCost: rerollCosts.subroutine,
        modRewardOptions: [],
        modShopPurchases: purchases.mod,
        modRerollCost: rerollCosts.mod,
        burnersUsedThisCombat: [],
        shopBurnerUsed,
        burnerRewardOptions: [],
        burnerShopPurchases: purchases.burner,
        burnerRerollCost: rerollCosts.burner,
      };
    }
    case 'event': {
      // Random pick at resolution time, not a persisted map-gen-time
      // assignment -- mirrors enemyForFight's regular/elite treatment
      // (gatekeeperEnemyForNode's persisted-identity treatment doesn't
      // apply here: an Event, like a regular/elite fight, is one-and-
      // done, never needing a stable identity across revisits).
      // Session 64: an Event can be held back to deeper layers.
      // Never one already met this run (session 65, the user's rule); should
      // a run ever exhaust them, the rule gives way rather than the node.
      const fresh = EVENT_ROSTER.filter((e) => (e.minLayer ?? 1) <= layerIndex && eventStillOffers(e, playerState));
      const unseen = fresh.filter((e) => !(playerState.seenEventIds ?? []).includes(e.id));
      const eligibleEvents = unseen.length > 0 ? unseen : fresh;
      const eventDef = eligibleEvents[rng.nextInt(eligibleEvents.length)];
      // A choice that pays in Data is only available when you can pay, one
      // granting a Mod you hold isn't (session 65); the simulated player
      // picks among the available ones.
      const affordable = (c: EventChoice) => choiceUnavailable(c, playerState) === null;
      const offered: EventDefinition = { ...eventDef, choices: eventDef.choices.filter(affordable) };
      const asked = yield* ask({ kind: 'event', event: eventDef, playerState, heat: currentHeat, layer: layerIndex, fallback: () => eventChoiceStrategy(offered, playerState, currentHeat) });
      const choice = affordable(asked) ? asked : eventChoiceStrategy(offered, playerState, currentHeat);
      const { effect, text: outcomeText } = rollWeightedOutcome(choice.outcomes, rng);

      const eventGrant: EventGrant = {};
      if (effect.classModUpgrade) eventGrant.classModUpgrade = true;
      if (effect.subroutineGrant) eventGrant.subroutine = resolveSubroutineGrant(effect.subroutineGrant, playerState.classId, rng);
      if (effect.modGrant) eventGrant.mod = resolveModGrant(effect.modGrant, playerState.classId, playerState.ownedModIds, rng);
      if (effect.burnerGrant) eventGrant.burner = resolveBurnerGrant(effect.burnerGrant, rng);
      yield* ask({ kind: 'eventResult', event: eventDef, choice, effect, text: outcomeText, grant: eventGrant, heat: eventHeat(effect.heatLosses ?? 0, layerIndex - 1), fallback: () => null });

      // Bonus fight (checkpoint I) -- a classic gamble-tier beat, reusing
      // resolveFight's existing machinery directly (same module, no
      // export needed -- checkpoint H already put Event resolution in
      // this file, so the "export it" step the spec anticipated turned
      // out unnecessary). `node` is passed through but never actually
      // consulted for a 'regular'/'elite' kind (only gatekeeperEnemyForNode
      // reads it, gated on kind === 'gatekeeper', which a bonus fight can
      // never be -- confirmed against enemyForFight above). The Event
      // node's own newState/quarantined stay fixed (DESIGN.md: "inert
      // after one resolved encounter, same as every other stub node
      // type") regardless of whether the bonus fight is won or lost --
      // losing a bonus fight costs Heat like any lost fight, it just
      // doesn't close the Event tile itself the way a real lost
      // regular/eliteFight node would. Not folded into run.ts's
      // fightsResolved opener-window counter -- a deliberate, narrow-
      // scope call (the checkpoint's own text scopes this to producing a
      // correct EncounterOutcome, not to opener-window bookkeeping),
      // banked as a real open question rather than silently decided.
      const bonusFightOutcome = effect.bonusFight
        ? yield* resolveFight(effect.bonusFight.tier, node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, undefined, burnerActivationStrategies, playerSkill)
        : undefined;

      const directHeat = eventHeat(effect.heatLosses ?? 0, layerIndex - 1); // heat.ts is 0-based
      return {
        eventId: eventDef.id,
        newState: 'inert',
        heatDelta: directHeat + (bonusFightOutcome?.heatDelta ?? 0),
        // The bonus fight's own Heat keeps its real attribution -- only
        // the Event's direct Heat counts as `event`, so "Heat from
        // Containment losses" stays true wherever the fight happened.
        heatSources: addHeatSources(bonusFightOutcome?.heatSources ?? NO_HEAT_SOURCES, { ...NO_HEAT_SOURCES, event: directHeat }),
        quarantined: false,
        rewardTier: bonusFightOutcome?.rewardTier ?? 'none',
        dataAwarded: (effect.dataDelta ?? 0) + (bonusFightOutcome?.dataAwarded ?? 0),
        rewardOptions: bonusFightOutcome?.rewardOptions ?? [],
        mergeTargetId: null,
        shopPurchases: [],
        rerollCost: 0,
        modRewardOptions: bonusFightOutcome?.modRewardOptions ?? [],
        modShopPurchases: [],
        modRerollCost: 0,
        burnersUsedThisCombat: bonusFightOutcome?.burnersUsedThisCombat ?? [],
        shopBurnerUsed: null,
        burnerRewardOptions: bonusFightOutcome?.burnerRewardOptions ?? [],
        burnerShopPurchases: [],
        burnerRerollCost: 0,
        eventGrant,
      };
    }
    case 'cache': {
      // A free reward, no fight; its price was the detour (M8). The node
      // goes inert once opened, like any resolved encounter.
      const [subroutineOdds, bundleOdds] = CACHE_ODDS[layerIndex] ?? CACHE_ODDS[4];
      const roll = rng.next();
      const base = {
        newState: 'inert' as const,
        heatDelta: 0,
        heatSources: NO_HEAT_SOURCES,
        quarantined: false,
        mergeTargetId: null,
        shopPurchases: [],
        rerollCost: 0,
        modShopPurchases: [],
        modRerollCost: 0,
        burnersUsedThisCombat: [],
        shopBurnerUsed: null,
        burnerShopPurchases: [],
        burnerRerollCost: 0,
      };
      if (roll < subroutineOdds) {
        const rewardOptions = drawCacheRewardOptions(playerState.classId, rng, ownedSubroutineIds(playerState));
        yield* ask({ kind: 'cacheOpened', contents: 'subroutine', data: 0, burners: [], fallback: () => null });
        // Every Cache holds a Burner (session 63): a choice alongside this one.
        return { ...base, rewardTier: 'better', dataAwarded: 0, rewardOptions, modRewardOptions: [], burnerRewardOptions: drawBurnerRewardOptions(rng) };
      }
      if (roll < subroutineOdds + bundleOdds) {
        const burners = drawBurnerRewardOptions(rng).slice(0, 1 + rng.nextInt(2));
        yield* ask({ kind: 'cacheOpened', contents: 'bundle', data: CACHE_BUNDLE_DATA, burners, fallback: () => null });
        return { ...base, rewardTier: 'none', dataAwarded: CACHE_BUNDLE_DATA, rewardOptions: [], modRewardOptions: [], burnerRewardOptions: [], cacheBurners: burners };
      }
      const modRewardOptions = drawModRewardOptions(playerState.classId, playerState.ownedModIds, rng);
      yield* ask({ kind: 'cacheOpened', contents: 'mod', data: 0, burners: [], fallback: () => null });
      return { ...base, rewardTier: 'none', dataAwarded: 0, rewardOptions: [], modRewardOptions, burnerRewardOptions: drawBurnerRewardOptions(rng) };
    }
    case 'relay':
      throw new Error('resolveEncounter should never be called on a Relay node -- it has no encounter');
  }
}

/** The strategies a simulated Shop visit uses. */
interface ShopStrategies {
  shopRerollStrategy: ShopRerollStrategy;
  modShopRerollStrategy: ModShopRerollStrategy;
  burnerShopRerollStrategy: BurnerShopRerollStrategy;
  shopStrategy: ShopStrategy;
  modShopStrategy: ModShopStrategy;
  burnerShopStrategy: BurnerShopStrategy;
  spendFreely: boolean;
}

/**
 * The simulated player's next Shop action from `phase` on, replaying the
 * pre-checkpoint-4 sequence: phases 0-2 decide each slate's reroll
 * (against the visit's opening state, as before), 3-5 buy at most one
 * offering per slate (seeing the Data left), 6 leaves. Returns the action
 * and the phase it came from; a phase with nothing to do is skipped.
 */
function shopFallback(visit: ShopVisit, playerState: RunPlayerState, phase: number, s: ShopStrategies): { action: ShopAction; phase: number } {
  const slates: ShopSlate[] = ['subroutine', 'mod', 'burner'];
  const now = { ...playerState, data: visit.data };
  for (let p = phase; p < 6; p++) {
    // Spending freely (session 62): after the reroll decisions, one open
    // phase -- sell what can't be used, then buy until nothing is wanted.
    if (s.spendFreely && p >= 3) return spendFreelyAction(visit, playerState, s);
    const slate = slates[p % 3];
    if (p < 3) {
      if (visit.rerolled[slate] || playerState.data < REROLL_COST || visit.data < visit.rerollCost) continue;
      const reroll =
        slate === 'subroutine'
          ? s.shopRerollStrategy(visit.slates.subroutine, playerState)
          : slate === 'mod'
            ? s.modShopRerollStrategy(visit.slates.mod, playerState)
            : s.burnerShopRerollStrategy(visit.slates.burner, playerState);
      if (reroll) return { action: { kind: 'reroll', slate }, phase: p };
      continue;
    }
    const pick =
      slate === 'subroutine' ? s.shopStrategy(visit.slates.subroutine, now) : slate === 'mod' ? s.modShopStrategy(visit.slates.mod, now) : s.burnerShopStrategy(visit.slates.burner, now);
    const index = pick ? (visit.slates[slate] as { cost: number }[]).indexOf(pick) : -1;
    if (index !== -1 && pick!.cost <= visit.data) return { action: { kind: 'buy', slate, index }, phase: p };
  }
  return { action: { kind: 'leave' }, phase: 6 };
}

/** One step of a person-like Shop visit (session 62): sell the first thing
 * the simulated player can't use, else buy the first offering its
 * strategies want and can afford (each slate's strategy sees only what's
 * still for sale), else leave. Stateless: it reads the visit's sold and
 * bought lists, so replaying it is safe. */
function spendFreelyAction(visit: ShopVisit, playerState: RunPlayerState, s: ShopStrategies): { action: ShopAction; phase: number } {
  const SPEND = 3;
  const left = <T extends string>(ids: readonly T[], sold: readonly T[]) => {
    const pool = [...sold];
    return ids.filter((id) => {
      const i = pool.indexOf(id);
      if (i === -1) return true;
      pool.splice(i, 1);
      return false;
    });
  };
  // Sell: the bench (pieces already swapped out), banked copies that can't
  // become a Merge (rank capped, or no longer owned), and sell-only Burners.
  const bench = left(playerState.bench.map((p) => p.id), visit.sold.subroutine);
  if (bench.length) return { action: { kind: 'sell', item: 'subroutine', id: bench[0] }, phase: SPEND };
  const stillOwned = new Set([...playerState.installedLoadout.map((p) => p.id), ...bench]);
  for (const [id, n] of Object.entries(playerState.material)) {
    const unusable = !stillOwned.has(id) || (playerState.rank[id] ?? 0) >= MERGE_RANK_CAP;
    if (unusable && n > visit.sold.copy.filter((c) => c === id).length) return { action: { kind: 'sell', item: 'copy', id }, phase: SPEND };
  }
  const wallets = left(playerState.carriedBurnerIds, visit.sold.burner).filter((id) => isSellOnly(BURNER_DEFINITIONS[id]));
  if (wallets.length) return { action: { kind: 'sell', item: 'burner', id: wallets[0] }, phase: SPEND };
  // Buy: whatever each slate's strategy wants among what's still for sale
  // -- Mods first (what a person spends on: the user's 22-Mod run), then
  // subroutines, then Burners while there's room under the carry cap (a
  // Burner past it only asks for a swap).
  const now = { ...playerState, data: visit.data };
  const burnerRoom = burnerCapOf(playerState) - (wallets.length + left(playerState.carriedBurnerIds, visit.sold.burner).filter((id) => BURNER_DEFINITIONS[id].contexts.length > 0).length) - visit.bought.burner.length;
  for (const slate of ['mod', 'subroutine', 'burner'] as ShopSlate[]) {
    if (slate === 'burner' && burnerRoom <= 0) continue;
    const all = visit.slates[slate] as { cost: number }[];
    const forSale = all.filter((_, i) => !visit.bought[slate].includes(i));
    const pick =
      slate === 'subroutine'
        ? s.shopStrategy(forSale as ShopOffering[], now)
        : slate === 'mod'
          ? s.modShopStrategy(forSale as ModOffering[], now)
          : s.burnerShopStrategy(forSale as BurnerOffering[], now);
    const index = pick ? all.indexOf(pick) : -1;
    if (index !== -1 && pick!.cost <= visit.data && !visit.bought[slate].includes(index)) return { action: { kind: 'buy', slate, index }, phase: SPEND };
  }
  return { action: { kind: 'leave' }, phase: 6 };
}

function sameShopAction(a: ShopAction, b: ShopAction): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'leave') return true;
  if (a.kind === 'reroll') return a.slate === (b as typeof a).slate;
  if (a.kind === 'sell') return a.item === (b as typeof a).item && a.id === (b as typeof a).id;
  return a.slate === (b as typeof a).slate && a.index === (b as typeof a).index;
}
