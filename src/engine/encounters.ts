import type { MapNode, NodeState } from './map-types';
import type { Rng } from './rng';
import type { SubroutineDefinition } from './subroutine-types';
import type { RunPlayerState } from './run';
import { playCombat, type BurnerActivationStrategy, type CombatResult } from './combat';
import { discardSkillStrategy, pegSkillStrategy } from './ai';
import { discardLowestTwo, type DiscardStrategy } from './deal';
import { playLowestLegal, type PlayStrategy } from './pegging';
import { heatFromLoss, HEAT_MAX } from './heat';
import { drawRewardOptions, drawUpgradedRewardOptions, rewardPoolForClass, rarityOf, type RewardTier } from './rewards';
import { dataForTier } from './data';
import { pickMergeTarget, preferMergeWhenAvailable, type MergeTargetStrategy, type SafehouseStrategy } from './merge';
import {
  pickRegularOrEliteEnemy,
  gatekeeperEnemyForNode,
  enemySkill,
  magnitudeScalerFor,
  gaugeThresholdFor,
  winThresholdFor,
  scaledEnemyLoadout,
  ENEMY_ROSTER,
  type EnemyDefinition,
  type EnemyId,
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
} from './shop';
import type { ModDefinition, ModId } from './mod-types';
import { drawModRewardOptions, applyOnWinEncounterResolvedMods, shopModifiersForOwnedMods, modPoolForClass } from './mods';
import type { BurnerId, BurnerDefinition } from './burner-types';
import { BURNER_DEFINITIONS, shopModifiersForActivatedBurner, drawBurnerRewardOptions, generalBurnerPool } from './burners';
import type { ClassId } from './classes';
import type { EventDefinition, EventChoice, EventRiskTier, Grant } from './event-types';
import { EVENT_ROSTER } from './events';

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
export function combatThresholdsFor(
  playerState: RunPlayerState,
  enemy: EnemyDefinition,
  layerIndex: number,
  fightNumber: number,
): { gaugeThreshold: [number, number]; winThreshold: [number, number] } {
  const containment = winThresholdFor(enemy, layerIndex, fightNumber, CONTAINMENT_THRESHOLD);
  return {
    gaugeThreshold: [
      playerState.initiativeThreshold ?? GAUGE_THRESHOLD,
      gaugeThresholdFor(enemy, layerIndex, fightNumber, GAUGE_THRESHOLD),
    ],
    winThreshold: [
      playerState.breachThreshold ?? BREACH_THRESHOLD,
      Math.max(1, Math.round(containment * (playerState.containmentThresholdScaler ?? 1))),
    ],
  };
}

/**
 * Where an encounter's `heatDelta` came from (session 50).
 *
 * Heat had three inflows and no attribution: a lost regular/elite fight,
 * Trace carried out of combat, and the per-move cost. Only the last was
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
  /** Trace carried out of combat, added on wins and losses alike. */
  trace: number;
  /** Negative. `heat-sink`'s refund on an elite/gatekeeper win. */
  refund: number;
  /** Negative. Rest at a Safehouse. */
  rest: number;
  /** Heat an Event applied directly. An Event's bonus fight is NOT
   * counted here -- its Heat is folded into the real categories above,
   * so "Heat from Containment losses" stays true wherever the fight
   * happened. */
  event: number;
}

export const NO_HEAT_SOURCES: HeatSources = {
  containmentLoss: 0,
  attritionLoss: 0,
  trace: 0,
  refund: 0,
  rest: 0,
  event: 0,
};

export function addHeatSources(a: HeatSources, b: HeatSources): HeatSources {
  return {
    containmentLoss: a.containmentLoss + b.containmentLoss,
    attritionLoss: a.attritionLoss + b.attritionLoss,
    trace: a.trace + b.trace,
    refund: a.refund + b.refund,
    rest: a.rest + b.rest,
    event: a.event + b.event,
  };
}

export function totalHeatSources(s: HeatSources): number {
  return s.containmentLoss + s.attritionLoss + s.trace + s.refund + s.rest + s.event;
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
    /** Hands actually played, for the same reason. */
    hands: number;
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
  shopPurchase: ShopOffering | null;
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
  modShopPurchase: ModOffering | null;
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
  burnerShopPurchase: BurnerOffering | null;
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
  eventGrant?: { subroutine?: SubroutineDefinition; mod?: ModDefinition; burner?: BurnerDefinition };
}

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
  /** Player-side (side 0) skill dial, decoupled from the enemy's own --
   * session 39's "never interlocked" rule. The enemy's skill below is
   * always computed from enemySkill(kind, layerIndex, fightNumber)
   * regardless of this value; this only ever changes side 0's strategy.
   * Undefined keeps side 0 at playCombat's baseline default
   * (discardLowestTwo/playLowestLegal), same as before this parameter
   * existed. */
  playerSkill?: number,
): { discardStrategies?: [DiscardStrategy, DiscardStrategy]; playStrategies?: [PlayStrategy, PlayStrategy] } {
  if (discardStrategies || playStrategies) return { discardStrategies, playStrategies };
  const skill = enemySkill(kind, layerIndex, fightNumber);
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
 * `traceGenerated` is NOT optional on purpose. It feeds Heat on a win
 * (see the win branch below), and Heat is its own run-ending path, so a
 * synthetic that silently generated none would lengthen runs for a
 * reason unrelated to gatekeepers -- the same invisible-second-effect
 * shape as session 48's `choked` rescale. Measured values at the
 * standing diagnostic config are ~2.8/2.6/1.2/0.8 by layer (small, but
 * supply them rather than assume).
 *
 * Prefer the ARRAY form. Real gatekeeper trace is heavily skewed --
 * mean ~2.8 but median 0 -- so feeding the mean as a constant deletes
 * the tail that drives Heat deaths: session 49's checkpoint 2 measured
 * `heatMaxed` falling 12.5% -> 10.5% purely from that. Passing the
 * empirical samples instead reproduces the distribution, not just its
 * first moment.
 */
export interface SyntheticGatekeeper {
  /** Probability in [0, 1] that the player passes. */
  passRate: number;
  /** Trace the real fight would have generated on a win. A single
   * number is a fixed value; an array is an empirical sample drawn from
   * uniformly (see syntheticCombatResult for why that draw costs no
   * extra RNG). */
  traceGenerated: number | number[];
}

/**
 * The stub `CombatResult` a synthetic gatekeeper resolves to. Only four
 * of CombatResult's fields are ever read downstream of the playCombat
 * call in resolveFight -- winner, traceGenerated, peakFillFraction[0]
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
 * peakFillFraction and a losing traceGenerated are unobservable in
 * practice -- a gatekeeper loss takes the `quarantined` branch, which
 * reads neither -- but are set coherently rather than left at zero.
 */
function syntheticCombatResult(spec: SyntheticGatekeeper, seed: number): CombatResult {
  const won = seed / 2 ** 31 < spec.passRate;
  // The trace sample index is derived from `seed` by a multiplicative
  // hash rather than drawn from the Rng, so supplying an empirical
  // distribution still costs exactly the one draw a real fight costs and
  // the "seed-aligned until outcomes differ" property survives. Hashed
  // rather than taken modulo directly, so the index does not correlate
  // with the coin, which reads the same integer.
  const trace = Array.isArray(spec.traceGenerated)
    ? (spec.traceGenerated[(Math.imul(seed, 2654435761) >>> 0) % spec.traceGenerated.length] ?? 0)
    : spec.traceGenerated;
  return {
    winner: won ? 0 : 1,
    log: [],
    hands: [],
    peakFillFraction: won ? [1, 0] : [0, 1],
    traceGenerated: won ? trace : 0,
    resolvedBy: 'threshold',
    burnersUsedThisCombat: [],
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
): EncounterOutcome {
  const enemy = enemyForFight(kind, node, layerIndex, fightNumber, rng, enemyIdOverride);
  const strategies = strategiesForFight(kind, layerIndex, fightNumber, discardStrategies, playStrategies, playerSkill);
  const seed = rng.nextInt(2 ** 31);
  // Per-layer difficulty scaler (session 39) -- applied here, not baked
  // into ENEMY_ROSTER's own authored data, so that data stays static and
  // regular/elite (which can appear at several layers) get a fresh scale
  // each encounter rather than a fixed one.
  const scaledLoadout = scaledEnemyLoadout(enemy.loadout, magnitudeScalerFor(enemy, layerIndex, fightNumber));
  // Gated on `kind` so an Event's bonus fight, which reaches this same
  // function, is never synthesised along with the layer's gatekeeper.
  const synthetic = kind === 'gatekeeper' ? syntheticGatekeeper : undefined;
  const result: CombatResult = synthetic
    ? syntheticCombatResult(synthetic, seed)
    : playCombat([playerState.installedLoadout, scaledLoadout], {
        seed,
        ...combatThresholdsFor(playerState, enemy, layerIndex, fightNumber),
        classId: playerState.classId,
        enemyPassiveIds: enemy.passiveIds,
        ownedModIds: playerState.ownedModIds,
        // Filtered to combat-context Burners only -- a carried map/shop-only
        // Burner has nothing to activate here (checkpoint C).
        carriedBurnerIds: playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('combat')),
        discardStrategies: strategies.discardStrategies,
        playStrategies: strategies.playStrategies,
        burnerActivationStrategies,
      });

  if (result.winner === 0) {
    const rewardTier: RewardTier = kind === 'regular' ? 'standard' : 'better';
    // Additive Mod-choice reward on elite/gatekeeper wins only (session
    // 30) -- never on a regular win, alongside Petty Cache/Black Budget's
    // onEncounterResolved hooks (Phase 5 Mods checkpoint E).
    const modRewardOptions = kind === 'regular' ? [] : drawModRewardOptions(playerState.classId, playerState.ownedModIds, rng);
    // Additive Burner-choice reward on EVERY fight tier including regular
    // (checkpoint F -- unlike modRewardOptions above, no kind gate).
    const burnerRewardOptions = drawBurnerRewardOptions(rng);
    const modified = applyOnWinEncounterResolvedMods(
      playerState.ownedModIds,
      dataForTier(rewardTier),
      drawRewardOptions(playerState.classId, rewardTier, rng),
      kind,
      rng,
      (r) => drawUpgradedRewardOptions(playerState.classId, r),
    );
    return {
      newState: 'inert',
      heatDelta: result.traceGenerated - modified.heatRefund, // Failover (session 44); addHeat already floors at 0 (proven by Rest's own negative heatDelta)
      heatSources: { ...NO_HEAT_SOURCES, trace: result.traceGenerated, refund: -modified.heatRefund },
      fight: { enemyId: enemy.id, tier: kind, resolvedBy: result.resolvedBy, peakFillFraction: result.peakFillFraction, hands: result.hands.length },
      quarantined: false,
      rewardTier,
      dataAwarded: modified.dataAwarded,
      rewardOptions: modified.rewardOptions,
      mergeTargetId: null,
      shopPurchase: null,
      rerollCost: 0,
      modRewardOptions,
      modShopPurchase: null,
      modRerollCost: 0,
      burnersUsedThisCombat: result.burnersUsedThisCombat,
      shopBurnerUsed: null,
      burnerRewardOptions,
      burnerShopPurchase: null,
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
      fight: { enemyId: enemy.id, tier: kind, resolvedBy: result.resolvedBy, peakFillFraction: result.peakFillFraction, hands: result.hands.length },
      quarantined: true,
      rewardTier: 'none',
      dataAwarded: 0,
      rewardOptions: [],
      mergeTargetId: null,
      shopPurchase: null,
      rerollCost: 0,
      modRewardOptions: [],
      modShopPurchase: null,
      modRerollCost: 0,
      burnersUsedThisCombat: result.burnersUsedThisCombat,
      shopBurnerUsed: null,
      burnerRewardOptions: [],
      burnerShopPurchase: null,
      burnerRerollCost: 0,
    };
  }
  const lossHeat = heatFromLoss(kind);
  return {
    newState: 'closed',
    heatDelta: lossHeat + result.traceGenerated,
    // resolvedBy 'threshold' on a player loss means the enemy genuinely
    // filled its own Containment gauge; 'attrition' means it ran out the
    // HARD_RESOLUTION_HAND clock without ever doing so. heatFromLoss
    // charges the same for both -- separated here so that stays a choice.
    heatSources: {
      ...NO_HEAT_SOURCES,
      containmentLoss: result.resolvedBy === 'threshold' ? lossHeat : 0,
      attritionLoss: result.resolvedBy === 'threshold' ? 0 : lossHeat,
      trace: result.traceGenerated,
    },
    fight: { enemyId: enemy.id, tier: kind, resolvedBy: result.resolvedBy, peakFillFraction: result.peakFillFraction, hands: result.hands.length },
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
    burnersUsedThisCombat: result.burnersUsedThisCombat,
    shopBurnerUsed: null,
    burnerRewardOptions: [],
    burnerShopPurchase: null,
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
    const heatCeiling = config.gambleSafetyMargin * (HEAT_MAX + playerState.maxHeatBonus);
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
function resolveBurnerGrant(grant: Grant<BurnerDefinition>, rng: Rng): BurnerDefinition | undefined {
  if ('specific' in grant) return grant.specific;
  const filtered = generalBurnerPool().filter((burner) => burner.rarity === grant.randomFromRarity);
  if (filtered.length === 0) return undefined;
  return filtered[rng.nextInt(filtered.length)];
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
): EncounterOutcome {
  switch (node.type) {
    case 'regularFight':
      return resolveFight('regular', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride, burnerActivationStrategies, playerSkill);
    case 'eliteFight':
      return resolveFight('elite', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride, burnerActivationStrategies, playerSkill);
    case 'gatekeeperFight':
      return resolveFight('gatekeeper', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride, burnerActivationStrategies, playerSkill, syntheticGatekeeper);
    case 'safehouse': {
      // DESIGN.md's deliberate Rest-vs-Merge trade-off: one action per
      // visit (the node goes inert either way). Falls back to Rest if
      // the strategy chose 'merge' but nothing is actually banked to
      // spend -- 'merge' with no material would otherwise waste the
      // visit entirely.
      const targetId = safehouseStrategy(playerState, currentHeat) === 'merge' ? mergeTargetStrategy(playerState) : null;
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
        };
      }
      return {
        newState: 'inert',
        heatDelta: -REST_HEAT_REDUCTION,
        heatSources: { ...NO_HEAT_SOURCES, rest: -REST_HEAT_REDUCTION },
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
      };
    }
    case 'shop': {
      // Shop-context Burner activation (checkpoint E), decided before
      // either slate is generated -- same timing as Vendor Discount/Bulk
      // Buyer's own onShopSlateGenerated hook below, just a one-shot
      // carried item instead of a standing owned Mod.
      const availableShopBurnerIds = playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('shop'));
      const chosenShopBurnerId =
        availableShopBurnerIds.length > 0 ? shopBurnerStrategy(availableShopBurnerIds, playerState) : null;
      const activatedShopBurner =
        chosenShopBurnerId && availableShopBurnerIds.includes(chosenShopBurnerId) ? BURNER_DEFINITIONS[chosenShopBurnerId] : undefined;
      const shopBurnerUsed = activatedShopBurner ? activatedShopBurner.id : null;
      const burnerModifiers = shopModifiersForActivatedBurner(activatedShopBurner);

      // Vendor Discount/Bulk Buyer (Phase 5 Mods checkpoint E) apply to
      // both independent slates equally -- a Shop-wide effect, not
      // subroutine-only. A Burner coupon's discount doesn't stack with
      // Vendor Discount (the larger of the two applies, not a compounded
      // multiply -- see burners.ts's shopModifiersForActivatedBurner).
      const { discountFraction: modDiscountFraction, extraCommons, extraUncommons } = shopModifiersForOwnedMods(playerState.ownedModIds);
      const discountFraction = Math.max(modDiscountFraction, burnerModifiers.discountFraction);
      const rarityFloor = burnerModifiers.rarityFloor;
      const rerollCostThisVisit = burnerModifiers.freeReroll ? 0 : REROLL_COST;
      const firstSlate = shopOfferingsForClass(playerState.classId, rng, extraCommons, extraUncommons, discountFraction, rarityFloor);
      // "Once": the reroll strategy is only ever asked against the
      // first slate, never against a slate it already produced.
      const rerolled = playerState.data >= REROLL_COST && shopRerollStrategy(firstSlate, playerState);
      const offerings = rerolled
        ? shopOfferingsForClass(playerState.classId, rng, extraCommons, extraUncommons, discountFraction, rarityFloor)
        : firstSlate;
      const rerollCost = rerolled ? rerollCostThisVisit : 0;

      // The Mod slate (session 30: "two independent slates in one Shop
      // visit... both spending from the same Data pool") -- its own
      // separately-generated, separately-rerollable draw. Insider Tip's
      // rarityFloor/Loyalty Token's freeReroll apply here too -- a
      // Burner coupon is Shop-wide, same as Vendor Discount/Bulk Buyer/
      // Scrap Merchant (session 44).
      const firstModSlate = modOfferingsForClass(playerState.classId, playerState.ownedModIds, rng, extraCommons, extraUncommons, discountFraction, rarityFloor);
      const modRerolled = playerState.data >= REROLL_COST && modShopRerollStrategy(firstModSlate, playerState);
      const modOfferings = modRerolled
        ? modOfferingsForClass(playerState.classId, playerState.ownedModIds, rng, extraCommons, extraUncommons, discountFraction, rarityFloor)
        : firstModSlate;
      const modRerollCost = modRerolled ? rerollCostThisVisit : 0;

      // The Burner slate (checkpoint F) -- the third independent slate,
      // same shape/reroll treatment as the Mod slate above. classId is
      // accepted for call-site symmetry only (burnerOfferingsForClass is
      // archetype-agnostic, see shop.ts's own header).
      const firstBurnerSlate = burnerOfferingsForClass(playerState.classId, rng, extraCommons, extraUncommons, discountFraction, rarityFloor);
      const burnerSlateRerolled = playerState.data >= REROLL_COST && burnerShopRerollStrategy(firstBurnerSlate, playerState);
      const burnerOfferingsSlate = burnerSlateRerolled
        ? burnerOfferingsForClass(playerState.classId, rng, extraCommons, extraUncommons, discountFraction, rarityFloor)
        : firstBurnerSlate;
      const burnerRerollCost = burnerSlateRerolled ? rerollCostThisVisit : 0;

      // The purchase decisions need to see the post-reroll Data balance
      // -- otherwise a strategy could "spend" the reroll cost and then
      // still buy up to the full pre-reroll balance, overspending. All
      // three rerolls (if any happened) are deducted before any
      // purchase decision is made.
      const stateAfterRerolls =
        rerollCost + modRerollCost + burnerRerollCost > 0
          ? { ...playerState, data: playerState.data - rerollCost - modRerollCost - burnerRerollCost }
          : playerState;
      const shopPurchase = shopStrategy(offerings, stateAfterRerolls);
      const stateAfterShopPurchase = shopPurchase ? { ...stateAfterRerolls, data: stateAfterRerolls.data - shopPurchase.cost } : stateAfterRerolls;
      const modShopPurchase = modShopStrategy(modOfferings, stateAfterShopPurchase);
      const stateAfterModPurchase = modShopPurchase ? { ...stateAfterShopPurchase, data: stateAfterShopPurchase.data - modShopPurchase.cost } : stateAfterShopPurchase;
      const burnerShopPurchase = burnerShopStrategy(burnerOfferingsSlate, stateAfterModPurchase);

      return {
        newState: 'inert',
        heatDelta: 0,
        heatSources: NO_HEAT_SOURCES,
        quarantined: false,
        rewardTier: 'none',
        dataAwarded: 0,
        rewardOptions: [],
        mergeTargetId: null,
        shopPurchase,
        rerollCost,
        modRewardOptions: [],
        modShopPurchase,
        modRerollCost,
        burnersUsedThisCombat: [],
        shopBurnerUsed,
        burnerRewardOptions: [],
        burnerShopPurchase,
        burnerRerollCost,
      };
    }
    case 'event': {
      // Random pick at resolution time, not a persisted map-gen-time
      // assignment -- mirrors enemyForFight's regular/elite treatment
      // (gatekeeperEnemyForNode's persisted-identity treatment doesn't
      // apply here: an Event, like a regular/elite fight, is one-and-
      // done, never needing a stable identity across revisits).
      const eventDef = EVENT_ROSTER[rng.nextInt(EVENT_ROSTER.length)];
      const choice = eventChoiceStrategy(eventDef, playerState, currentHeat);
      const { effect } = rollWeightedOutcome(choice.outcomes, rng);

      const eventGrant: { subroutine?: SubroutineDefinition; mod?: ModDefinition; burner?: BurnerDefinition } = {};
      if (effect.subroutineGrant) eventGrant.subroutine = resolveSubroutineGrant(effect.subroutineGrant, playerState.classId, rng);
      if (effect.modGrant) eventGrant.mod = resolveModGrant(effect.modGrant, playerState.classId, playerState.ownedModIds, rng);
      if (effect.burnerGrant) eventGrant.burner = resolveBurnerGrant(effect.burnerGrant, rng);

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
        ? resolveFight(effect.bonusFight.tier, node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, undefined, burnerActivationStrategies, playerSkill)
        : undefined;

      return {
        newState: 'inert',
        heatDelta: (effect.heatDelta ?? 0) + (bonusFightOutcome?.heatDelta ?? 0),
        // The bonus fight's own Heat keeps its real attribution -- only
        // the Event's direct heatDelta counts as `event`, so "Heat from
        // Containment losses" stays true wherever the fight happened.
        heatSources: addHeatSources(bonusFightOutcome?.heatSources ?? NO_HEAT_SOURCES, { ...NO_HEAT_SOURCES, event: effect.heatDelta ?? 0 }),
        quarantined: false,
        rewardTier: bonusFightOutcome?.rewardTier ?? 'none',
        dataAwarded: (effect.dataDelta ?? 0) + (bonusFightOutcome?.dataAwarded ?? 0),
        rewardOptions: bonusFightOutcome?.rewardOptions ?? [],
        mergeTargetId: null,
        shopPurchase: null,
        rerollCost: 0,
        modRewardOptions: bonusFightOutcome?.modRewardOptions ?? [],
        modShopPurchase: null,
        modRerollCost: 0,
        burnersUsedThisCombat: bonusFightOutcome?.burnersUsedThisCombat ?? [],
        shopBurnerUsed: null,
        burnerRewardOptions: bonusFightOutcome?.burnerRewardOptions ?? [],
        burnerShopPurchase: null,
        burnerRerollCost: 0,
        eventGrant,
      };
    }
    case 'relay':
      throw new Error('resolveEncounter should never be called on a Relay node -- it has no encounter');
  }
}
