import type { PlayerIndex } from './pegging';
import type { Card, Suit } from './cards';
import type { Archetype, DebuffKind, HandLifecycleMoment, PayloadEffect, SubroutineDefinition, TickCadence } from './subroutine-types';
import type { ClassId } from './classes';
import { CLASS_DEFINITIONS } from './classes';
import type { EnemyPassiveId } from './enemies';
import type { ModId } from './mod-types';
import { reactiveModSubroutines, MOD_SMALL, MOD_MEDIUM, OVERCLOCKED_ACCUMULATOR_REDUCTION, TAGGED_FIRMWARE_TAG } from './mods';
import type { BurnerId } from './burner-types';
import { easeTriggerCondition, improvedPayloadMagnitude } from './merge';
import {
  createInitialState,
  evaluateEnemyState,
  evaluateSelfState,
  isReady,
  resetAfterFire,
  updateSuitTallyState,
  updateMitigationBankedState,
  type SubroutineRuntimeState,
  type TriggerContext,
} from './triggers';
import { createInitiativeGauge, createDuelGauge, addDuelProgress, reduceDuelProgress, type InitiativeGauge, type DuelGauge } from './gauges';
import { bestCardToForce } from './ai';

/**
 * Fire-on-turn resolution (session 17 checkpoint E): given that a side's
 * turn has already been triggered (Checkpoint F's job, via the
 * initiative gauge), iterate that side's loadout top-to-bottom, fire
 * every subroutine that's ready and not toggled off, and resolve its
 * payload against the acting side's or opposing side's state.
 *
 * Breach/Containment redesign (session 22+): each side races toward its
 * own win independently (gauges.ts's DuelGauge) instead of both pushing
 * one shared scalar -- see gauges.ts's own header for why. Offense
 * credits the caster's own gauge; Encryption's mitigation (HoT,
 * instantCounterPush) reduces the *opponent's* gauge directly instead of
 * pushing a shared value back toward center, so "mitigation can't win
 * alone" is now a free structural property rather than something needing
 * an artificial cap.
 */

export interface ActiveDebuff {
  debuffId: DebuffKind;
  magnitude: number;
  remainingDuration: number;
}

/** A registered DoT/HoT tick. Ticked by tickCastersTurnPulse/
 * tickGlobalPulse below, driven from combat.ts's orchestration loop. */
export interface ActiveTick {
  amountPerTick: number;
  cadence: TickCadence;
  remainingDuration: number;
  /** Whose subroutine this is -- caster's-turn-pulse ticks fire when
   * THIS side gets a turn, regardless of whether the tick itself is
   * stored under dots (the target's array) or hots (the caster's own). */
  casterSide: PlayerIndex;
  /** globalPulse only: how many combined points (either side) trigger
   * the next tick, and how many have accumulated since the last one. */
  pointsPerTick?: number;
  accumulatedPoints?: number;
  /** Redundant Ticks (Mods checkpoint C/H) has already spent this
   * specific tick instance's one free extra tick before expiring --
   * per-tick-instance, unlike Failsafe Cascade's per-fight one-shot
   * (tracked via the usual passiveState flag instead). */
  redundantTickUsed?: boolean;
}

export interface LoadoutEntry {
  definition: SubroutineDefinition;
  state: SubroutineRuntimeState;
}

export interface CombatSideState {
  gauge: InitiativeGauge;
  /** This side's own progress toward its own win -- see gauges.ts's
   * DuelGauge. Only this side's own offense ever credits it; nothing
   * else on this side reduces it (that would defeat the point of
   * decoupling the two races) -- only the *opponent's* mitigation
   * reduces it, applied to the opponent's CombatSideState.winGauge, not
   * this one. */
  winGauge: DuelGauge;
  heat: number;
  loadout: LoadoutEntry[];
  debuffs: ActiveDebuff[];
  /** Accumulating shield (Ward payloads add to it) -- absorbs the
   * opponent's future non-Piercing directBurst offense, denying the
   * gauge-fill it would otherwise cause, until depleted. No longer
   * archetype-scoped (session 22+ redesign) -- Piercing already
   * supplies the one counter-play axis that matters. */
  wardShield: number;
  dots: ActiveTick[];
  hots: ActiveTick[];
  /** Recon-revealed intel, valid for the current hand only (session 24
   * checkpoint C) -- cleared at the start of every hand (clearHandKnowledge
   * below) since a new deal makes stale intel meaningless. `knownOpponentHand`
   * is written by both revealOpponentHand (the opponent's full 6-card
   * dealt hand, deal-time) and revealOpponentKeptHand (their 4-card kept
   * hand, play-phase-start) -- the same field deliberately, since the
   * later, smaller reveal naturally supersedes the earlier one exactly
   * when it becomes the relevant one (pegging cares about their kept
   * hand, not their original 6 cards). `knownCrib` is written by
   * revealCrib -- one shared crib, not opponent-specific, so both sides'
   * copies would agree if both happened to reveal it. */
  knownOpponentHand?: Card[];
  knownCrib?: Card[];
  /** A forced discard pair for this hand only (session 24 checkpoint D
   * -- Root's "force a specific card" manipulation), set on the
   * *target* side (whoever got manipulated), consumed by combat.ts when
   * constructing that side's discard for this hand -- same hand-scoped
   * lifecycle as knownOpponentHand/knownCrib above, cleared by
   * clearHandKnowledge. */
  forcedDiscardPair?: [Card, Card];
  /** Generic per-side scratch bookkeeping for enemy passives (Phase 5
   * checkpoint B) -- one-shot flags (0/1), stack counters, banked
   * amounts, keyed by whatever string each passive implementation
   * chooses (by convention `${passiveId}:${field}`). Deliberately
   * untyped-per-passive, unlike the 6 player class passives' dedicated
   * fields (passiveTriggered, etc.) -- 34 passives don't each get a
   * bespoke CombatState field the way 6 did (session 21's own
   * reasoning for why 6 stayed hand-coded doesn't scale to this many).
   * Always empty for side 0 in practice (player passives keep using
   * classId/passiveTriggered, untouched by this). */
  passiveState: Record<string, number>;
}

/** A Root scheduledSabotage payload fired now but resolves at a future
 * Cribbage-flow checkpoint (e.g. next deal) -- resolvePendingSabotage
 * below, driven from combat.ts's hand-boundary hook, consumes and clears
 * these. `archetype` is captured from the casting subroutine at
 * registration time (needed for the wrapped effect's own ward-matching,
 * same as any other resolvePayload call). */
export interface PendingSabotage {
  casterSide: PlayerIndex;
  archetype: Archetype;
  effect: PayloadEffect;
}

/** A Root cribbageLayerManipulation payload -- always resolves at the
 * next deal (see CribbageLayerManipulationPayload's own doc comment for
 * what each action does). consumePendingCribbageManipulation below,
 * driven from combat.ts's hand-boundary hook, consumes and clears
 * these. */
export interface PendingCribbageManipulation {
  casterSide: PlayerIndex;
  action: 'forceDiscard' | 'peekCrib' | 'skewCut' | 'markSuit';
  suit?: Suit;
}

export interface CombatState {
  sides: [CombatSideState, CombatSideState];
  pendingSabotage: PendingSabotage[];
  pendingCribbageManipulation: PendingCribbageManipulation[];
  /** The player's class, if any -- drives the 6 starting-passive hooks
   * (Phase 4 checkpoint B), scattered through this file and combat.ts's
   * step(). Always side 0; enemy loadouts are plain data with no class
   * of their own. Absent for any fight/test that doesn't care about
   * passives -- every hook below guards on this matching the specific
   * class it belongs to, so an unset classId is just "no passives
   * active," no separate branch needed anywhere. */
  classId?: ClassId;
  /** Whether this combat's one-shot starting passive has already fired
   * -- Foothold, Zero Day, Sleeper Cell, and Primed are each "the first
   * time X happens," so a single flag suffices (only one class's
   * passive is ever active in a given combat). Feedback Loop and Return
   * to Sender are persistent modifiers instead, checked directly against
   * classId at their own hook points -- not gated by this flag. */
  passiveTriggered: boolean;
  /** Which passive(s) side 1 (the enemy) carries this combat -- Phase 5
   * checkpoint B. Always empty for any fight/test that doesn't care
   * about enemy passives. Mirrors classId's implicit "side 0 only"
   * convention: this is implicitly "side 1 only," so no separate side
   * tag is needed. */
  enemyPassiveIds: EnemyPassiveId[];
  /** Which Mod(s) side 0 (the player) owns this combat -- Phase 5 Mods
   * checkpoint B, mirroring enemyPassiveIds' side-1-only convention.
   * createCombatState always folds in the current class's own
   * class-exclusive starting-passive Mod on top of whatever's passed in
   * here, so every existing classId-driven call site keeps working
   * unchanged (checkpoint D's zero-regression guarantee) -- this list is
   * genuinely "every other owned Mod, plus the guaranteed class one." */
  ownedModIds: ModId[];
  /** Which Burner(s) side 0 (the player) is carrying into this combat --
   * Phase 5 Burners checkpoint B, mirroring ownedModIds' side-0-only
   * convention. A snapshot taken at combat start (createCombatState),
   * already filtered by run.ts to just this player's combat-context
   * Burners; checkpoint C's activation strategy picks from this list,
   * and a used Burner is surfaced back out via CombatResult.
   * burnersUsedThisCombat rather than mutated out of this array
   * directly. */
  carriedBurnerIds: BurnerId[];
}

export function createCombatSideState(definitions: SubroutineDefinition[], gaugeThreshold: number, winThreshold: number): CombatSideState {
  return {
    gauge: createInitiativeGauge(gaugeThreshold),
    winGauge: createDuelGauge(winThreshold),
    heat: 0,
    loadout: definitions.map((definition) => ({ definition, state: createInitialState() })),
    debuffs: [],
    wardShield: 0,
    dots: [],
    hots: [],
    knownOpponentHand: undefined,
    knownCrib: undefined,
    forcedDiscardPair: undefined,
    passiveState: {},
  };
}

/** Clears both sides' recon-revealed intel and any forced-discard
 * override -- called once per hand, before that hand's onDealt gap
 * fires, so a side whose recon/manipulation didn't fire this hand
 * (toggled off, conditional trigger not met, etc.) doesn't keep using
 * stale data from a previous hand. */
export function clearHandKnowledge(combatState: CombatState): CombatState {
  const sides = combatState.sides.map((sideState) => ({
    ...sideState,
    knownOpponentHand: undefined,
    knownCrib: undefined,
    forcedDiscardPair: undefined,
  })) as [CombatSideState, CombatSideState];
  return { ...combatState, sides };
}

export function createCombatState(
  playerLoadout: SubroutineDefinition[],
  enemyLoadout: SubroutineDefinition[],
  gaugeThreshold: number,
  classId?: ClassId,
  winThreshold: number = 100,
  enemyPassiveIds: EnemyPassiveId[] = [],
  ownedModIds: ModId[] = [],
  carriedBurnerIds: BurnerId[] = [],
): CombatState {
  // The class's own exclusive starting-passive Mod is always active
  // whenever classId is set (checkpoint D) -- folded in here rather than
  // required from every caller, so every pre-existing call site that
  // only ever passed classId (the whole test suite, before Mods existed)
  // keeps getting that class's passive with zero behavior change.
  const classModId = classId ? CLASS_DEFINITIONS[classId].startingPassiveId : undefined;
  const effectiveModIds = classModId && !ownedModIds.includes(classModId) ? [...ownedModIds, classModId] : ownedModIds;
  // Reactive-subroutine Mods (session 30's "fires outside the loadout
  // entirely" bucket) are simply appended to side 0's real loadout here
  // -- no slot, no order, no cap, but otherwise an ordinary loadout
  // entry as far as fireReadySubroutines/fireNewlyReadyReactiveSubroutines/
  // fireHandLifecycleSubroutines are concerned, so none of those need any
  // change to also fire these.
  const playerLoadoutWithMods = [...playerLoadout, ...reactiveModSubroutines(effectiveModIds)];
  return {
    sides: [
      createCombatSideState(playerLoadoutWithMods, gaugeThreshold, winThreshold),
      createCombatSideState(enemyLoadout, gaugeThreshold, winThreshold),
    ],
    pendingSabotage: [],
    pendingCribbageManipulation: [],
    classId,
    passiveTriggered: false,
    enemyPassiveIds,
    ownedModIds: effectiveModIds,
    carriedBurnerIds,
  };
}

function opponentOf(side: PlayerIndex): PlayerIndex {
  return (1 - side) as PlayerIndex;
}

function replaceSide(
  sides: [CombatSideState, CombatSideState],
  side: PlayerIndex,
  newState: CombatSideState,
): [CombatSideState, CombatSideState] {
  const copy = sides.slice() as [CombatSideState, CombatSideState];
  copy[side] = newState;
  return copy;
}

/** Credits `side`'s own winGauge with `amount` progress toward its own
 * win. The one and only way a gauge ever advances -- offense payloads,
 * DoT ticks, and Foothold/Feedback Loop/Return to Sender's bonuses all
 * route through this. Exported for the enemy-passive implementations
 * below (Phase 5 checkpoint B), same reuse as every player passive
 * already gets by living in this file. */
export function creditWinGauge(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  if (amount <= 0) return combatState;
  const sideState = combatState.sides[side];
  const { gauge } = addDuelProgress(sideState.winGauge, amount);
  const sides = replaceSide(combatState.sides, side, { ...sideState, winGauge: gauge });
  return { ...combatState, sides };
}

/** Reduces `side`'s own winGauge by `amount` -- Encryption's mitigation
 * tools (HoT, instantCounterPush) call this against the *opponent's*
 * gauge, never their own. Floored at 0 by gauges.ts's reduceDuelProgress
 * -- no upper cap needed the way the old shared scalar's midpoint was.
 * Exported for the enemy-passive implementations below. */
export function reduceWinGauge(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  if (amount <= 0) return combatState;
  const sideState = combatState.sides[side];
  const gauge = reduceDuelProgress(sideState.winGauge, amount);
  const sides = replaceSide(combatState.sides, side, { ...sideState, winGauge: gauge });
  return { ...combatState, sides };
}

const CORRUPTED_MULTIPLIER = 0.5; // TBD/playtesting

/** Corrupted (a debuff kind) reduces the magnitude of the debuffed
 * side's own fired payloads -- checked dynamically at the moment each
 * payload resolves (or each tick fires), not frozen at cast time, so
 * gaining or losing the debuff mid-match immediately affects what's
 * already active. Scoped to payloads with a genuine "how hard do I hit"
 * magnitude (bursts, ticks, instant manipulation) -- not applied to
 * Ward/Cleanse/debuff-application, which aren't that kind of output. */
function corruptionMultiplier(combatState: CombatState, side: PlayerIndex): number {
  return combatState.sides[side].debuffs.some((d) => d.debuffId === 'corrupted') ? CORRUPTED_MULTIPLIER : 1;
}

const THROTTLED_REDUCTION = 4; // x -- TBD/playtesting
const THROTTLED_FLOOR = 1; // y -- TBD/playtesting

/** Floor for *any* reduction to a side's own initiative-gauge threshold
 * -- must stay above 0, since gauges.ts's addPoints loops "while
 * progress >= threshold," and a threshold of exactly 0 (or negative)
 * loops forever the next time any points at all are credited. Originally
 * scoped just to Haste's own reduction (session 24), but Choked's
 * un-floored reversal-on-expiry/early-cleanse (tickDebuffDurations, the
 * 'cleanse' case below) turned out to need the exact same guard: Choked
 * raises a threshold by a fixed amount and later reverts it by that same
 * fixed amount, with no awareness of whatever *else* touched the same
 * threshold in between (Haste's own floored reduction, most concretely)
 * -- found as a genuine engine hang (session 28, checkpoint E's balance
 * sweep), not a hypothetical: Botnet's Choked raised Ghost in the
 * Machine's threshold, DNS Poisoning's Haste then floor-reduced it, and
 * Choked's natural expiry reverted its own original bump unconditionally,
 * landing exactly on 0 and spinning addPoints forever. TBD/playtesting
 * beyond that hard floor. */
const MIN_INITIATIVE_THRESHOLD = 1;

/** Throttled (a debuff kind) dents points about to be credited to a
 * side's gauge -- a flat reduction with a floor, clamped so it can
 * never exceed (inflate) the original value. No-op if `side` has no
 * active Throttled debuff. Deliberately separate from Corrupted: this
 * targets tempo (denying gauge fill), not power. Call right before
 * feeding points into gauges.ts's addPoints -- not applied to
 * tickGlobalPulse's combined-points accumulation, which is a different
 * mechanic Throttled doesn't touch. */
export function applyThrottled(combatState: CombatState, side: PlayerIndex, points: number): number {
  const throttled = combatState.sides[side].debuffs.some((d) => d.debuffId === 'throttled');
  if (!throttled) return points;
  return Math.min(points, Math.max(THROTTLED_FLOOR, points - THROTTLED_REDUCTION));
}

/** Absorbs up to `amount` of incoming non-Piercing offense against
 * `sideState`'s own wardShield, floored at 0 -- returns how much was
 * absorbed and how much got through. */
function absorbWithShield(sideState: CombatSideState, amount: number): { sideState: CombatSideState; absorbed: number; remaining: number } {
  const absorbed = Math.min(sideState.wardShield, amount);
  const remaining = amount - absorbed;
  return { sideState: { ...sideState, wardShield: sideState.wardShield - absorbed }, absorbed, remaining };
}

export interface ResolveContext {
  /** How many other subroutines already fired earlier this same turn --
   * chainFinisherScaling's payoff for loadout sequencing. */
  priorFireCountThisTurn: number;
  /** The cards a revealOpponentHand/revealCrib/revealOpponentKeptHand/
   * forceDiscardCard payload should read (session 24) -- supplied by
   * combat.ts's fireHandLifecycleSubroutines call, since which cards
   * are "the opponent's hand" or "the crib" only exists as combat.ts's
   * own local state during a hand, never persisted into CombatState.
   * Irrelevant to every other payload kind. */
  revealedCards?: Card[];
  /** Whether the *target's* own crib is this hand's crib -- only
   * meaningful to forceDiscardCard (checkpoint D), which needs
   * scoreDiscard signed from the target's own perspective, not the
   * caster's. */
  targetIsOwnCrib?: boolean;
}

// ---------------------------------------------------------------------
// Starting passives (Phase 4 checkpoint B, retranslated for the
// Breach/Containment redesign session 22+) -- 6 bespoke hooks, not a
// generic framework (session 21's own reasoning: 6 heterogeneous
// one-offs don't justify one). Foothold/Zero Day/Sleeper Cell/Primed are
// one-shot ("the first time X"), gated by CombatState.passiveTriggered;
// Feedback Loop and Return to Sender are persistent modifiers checked
// directly against classId at their own hook points. All 6 only ever
// apply to side 0 -- enemy loadouts have no class.
// ---------------------------------------------------------------------

const FOOTHOLD_BONUS_FRACTION = 0.1; // TBD/playtesting -- X% of threshold, applied to both gauges
const SLEEPER_CELL_ADVANCE_AMOUNT = 3; // TBD/playtesting
// TBD/playtesting -- 4 -> 2 (session 39 balance fix): Silent Worm's DoT
// is Saboteur's only credit-capable payload at all, and this flat bonus
// stacking on top of every one of its ticks unconditionally was doing
// most of the class's heavy lifting (full-run win rate 24.3% at 4, 4.0%
// at 0 -- overshoots -- 12.0% at 2, landing in StS's ascension-0 9-15%
// band). Now equal to Silent Worm's own base tick size (COMMON.tick).
const SLEEPER_CELL_CREDIT_AMOUNT = 2;
const PRIMED_THRESHOLD_REDUCTION = 2; // TBD/playtesting
const PRIMED_MAGNITUDE_BONUS = 3; // TBD/playtesting -- payload magnitude bump, session 25 rework
// Flat amount queued as a bonus for the caster's next tick of the
// opposite type, every time a HoT or DoT tick fires -- deliberately a
// fixed step, not a fraction of the triggering tick's own size (tried
// first, rejected -- see applyFeedbackLoopAmplification's own comment
// for why proportional-to-self growth compounds too fast). Empirically
// tuned against a full-run sweep, same target as the per-layer scaler:
// 1 -> 23.3%, 0.5 -> 17.0%, 0.3/0.25 -> 15.0%, 0.15 -> 13.7% (StS's
// ascension-0 9-15% band). TBD/playtesting, revisit if the wider
// per-class balance pass finds it needs another adjustment.
const FEEDBACK_LOOP_AMPLIFICATION_AMOUNT = 0.15;
const RETURN_TO_SENDER_RATIO = 0.5; // TBD/playtesting -- portion of absorbed/reduced amount redirected to Ghost's own gauge

/** Breacher's Foothold: the first time the player's own gauge reaches
 * 50% of its threshold this combat, a one-time symmetric bonus -- X% of
 * threshold credited to the player's own gauge (Exploit side) *and* a
 * matching reduction to the enemy's gauge (Encryption side). Not
 * relative-lead (comparing against the enemy's own progress) -- a flat,
 * standard, self-contained confirmation bonus, reading truer to "hit
 * hard, then hold the position you just took" than a race-relative
 * trigger would. Engages both of Breacher's archetypes in one trigger,
 * same as Warden's Feedback Loop and Ghost's Return to Sender already
 * do by nature. Exported for combat.ts's step() to call after every
 * state-changing step, since a crossing can come from any payload kind
 * or tick, not just one. */
export function applyFootholdBonus(combatState: CombatState): CombatState {
  if (combatState.classId !== 'breacher' || combatState.passiveTriggered) return combatState;
  const playerGauge = combatState.sides[0].winGauge;
  if (playerGauge.progress < playerGauge.threshold / 2) return combatState;
  const bonus = playerGauge.threshold * FOOTHOLD_BONUS_FRACTION;
  const boosted = creditWinGauge(combatState, 0, bonus);
  const pushed = reduceWinGauge(boosted, 1, bonus);
  return { ...pushed, passiveTriggered: true };
}

/** Operator's Primed (reworked, session 25): every time a Root
 * subroutine fires this combat, both eases the caster's next Exploit
 * subroutine's trigger condition (the original one-shot effect) *and*
 * boosts that Exploit subroutine's payload magnitude (new) -- "next"
 * taken as the first Exploit-archetype entry in the caster's own
 * loadout, by array order, same targeting as before. No longer gated
 * by passiveTriggered: "Root primes the field, Exploit cashes in"
 * reads most literally as making the eventual strike land *bigger*,
 * not just sooner, and readiness alone was proven to produce zero
 * marginal win-rate value (session 24 sweep). Applies generically
 * after any Root payload resolves, not gated by payload kind, since
 * Root's payload catalog spans several kinds. Reuses merge.ts's
 * easeTriggerCondition and (newly exported for this)
 * improvedPayloadMagnitude -- the same generic per-payload-kind bump
 * Merge itself uses for permanent upgrades, applied here to the next
 * fire instead. improvedPayloadMagnitude returns null for a payload
 * with no magnitude field (Ward/Cleanse/etc.) -- the trigger-ease
 * still applies in that case, same "has nothing to boost against some
 * shapes" behavior the original had. */
function applyPrimedPassive(combatState: CombatState, firedArchetype: Archetype, caster: PlayerIndex): CombatState {
  if (firedArchetype !== 'root' || caster !== 0 || combatState.classId !== 'operator') {
    return combatState;
  }
  const sideState = combatState.sides[0];
  const index = sideState.loadout.findIndex((entry) => entry.definition.archetype === 'exploit');
  if (index === -1) return combatState;
  const entry = sideState.loadout[index];
  const easedTrigger = easeTriggerCondition(entry.definition.trigger, PRIMED_THRESHOLD_REDUCTION);
  const boostedPayload = improvedPayloadMagnitude(entry.definition.payload, PRIMED_MAGNITUDE_BONUS) ?? entry.definition.payload;
  const loadout = sideState.loadout.slice();
  loadout[index] = { ...entry, definition: { ...entry.definition, trigger: easedTrigger, payload: boostedPayload } };
  const sides = replaceSide(combatState.sides, 0, { ...sideState, loadout });
  return { ...combatState, sides };
}

/** Advances the first loadout entry matching `matches`'s banked
 * progress by `amount` -- shared shape with instantManipulation's
 * subroutineProgress target (resolvePayload below), but keyed by a
 * predicate instead of a fixed id, since Sleeper Cell has no single
 * fixed target the way Priority Override does. */
function advanceFirstMatchingSubroutine(
  combatState: CombatState,
  side: PlayerIndex,
  matches: (definition: SubroutineDefinition) => boolean,
  amount: number,
): CombatState {
  const sideState = combatState.sides[side];
  const index = sideState.loadout.findIndex((entry) => matches(entry.definition));
  if (index === -1) return combatState;
  const entry = sideState.loadout[index];
  const loadout = sideState.loadout.slice();
  loadout[index] = { ...entry, state: { ...entry.state, accumulatedProgress: entry.state.accumulatedProgress + amount } };
  const sides = replaceSide(combatState.sides, side, { ...sideState, loadout });
  return { ...combatState, sides };
}

/** Saboteur's Sleeper Cell (reworked, session 25): every Malware DoT
 * tick or debuff application the caster applies also credits a direct
 * amount to Saboteur's own gauge, alongside the original effect
 * (advancing the first Root subroutine's banked progress) --
 * persistent, not gated by passiveTriggered like the original one-shot
 * version. Broadened from "first Malware debuff only," which was
 * unreachable from Saboteur's own starting kit (Silent Worm is a DoT,
 * not a debuff) -- `isMalwareEffect` lets either call site (the
 * 'debuff' case below, or applyTickPush's DoT branch) qualify. */
function applySleeperCellPassive(combatState: CombatState, casterSide: PlayerIndex, isMalwareEffect: boolean): CombatState {
  if (!isMalwareEffect || casterSide !== 0 || !hasMod(combatState, 'sleeper-cell')) return combatState;
  const amount = SLEEPER_CELL_CREDIT_AMOUNT * corruptionMultiplier(combatState, casterSide);
  const credited = creditWinGauge(combatState, casterSide, amount);
  return advanceFirstMatchingSubroutine(credited, casterSide, (def) => def.archetype === 'root', SLEEPER_CELL_ADVANCE_AMOUNT);
}

/** Ghost's Return to Sender: whenever Ghost's own wardShield actually
 * absorbs some of an incoming non-Piercing hit, a proportional portion
 * of the absorbed amount also credits Ghost's own gauge -- continuous,
 * per-absorb, not gated on the shield fully depleting (a full-break-only
 * trigger would be unreliable, and DESIGN.md's original "a portion...
 * carries through" phrasing already reads as ongoing). Persistent, not
 * one-shot -- not gated by passiveTriggered, same treatment as Feedback
 * Loop. `shieldOwnerSide` is whoever's wardShield just absorbed the hit
 * (the defender in this exchange, not the attacker). */
function applyReturnToSenderPassive(combatState: CombatState, shieldOwnerSide: PlayerIndex, absorbed: number): CombatState {
  if (absorbed <= 0 || shieldOwnerSide !== 0 || !hasMod(combatState, 'return-to-sender')) return combatState;
  return creditWinGauge(combatState, 0, absorbed * RETURN_TO_SENDER_RATIO);
}

/** Return to Sender, reworked (session 25): the Ward-absorb hook above
 * was Ghost's only trigger, but none of Ghost's own 3 starting pieces
 * ever casts Ward -- it was completely inert until a Ward piece got
 * acquired mid-run. Adds two more reachable triggers, same ratio/
 * identity ("whatever Ghost does to hold the enemy back, some of that
 * effort redirects to Ghost's own progress"): every instantCounterPush
 * that reduces the enemy's gauge also credits a portion back --
 * reachable turn one via Null Session. */
function applyReturnToSenderCounterPushPassive(combatState: CombatState, casterSide: PlayerIndex, amount: number): CombatState {
  if (casterSide !== 0 || !hasMod(combatState, 'return-to-sender')) return combatState;
  return creditWinGauge(combatState, 0, amount * RETURN_TO_SENDER_RATIO);
}

/** Return to Sender's third trigger (session 25): every HoT tick that
 * reduces the enemy's gauge also credits a portion back to Ghost's own
 * gauge. Ghost's own starting kit has no HoT piece, but HoT is
 * Encryption -- Ghost's own archetype -- so this pays off naturally
 * once one is acquired. Called from applyTickPush alongside Feedback
 * Loop's own hook -- both gated on their own distinct classId, so they
 * coexist with no conflict (only one classId is ever active). */
function applyReturnToSenderTickPassive(combatState: CombatState, tick: ActiveTick, listKey: 'dots' | 'hots', amount: number): CombatState {
  if (listKey !== 'hots' || tick.casterSide !== 0 || !hasMod(combatState, 'return-to-sender')) return combatState;
  return creditWinGauge(combatState, 0, amount * RETURN_TO_SENDER_RATIO);
}

// ---------------------------------------------------------------------
// Enemy passives (Phase 5 checkpoint B, session 27's roster design) --
// 34 named passives across the 32-enemy roster (DESIGN.md's "The
// Roster"). Unlike the 6 player class passives above (hand-coded,
// gated by classId, one bespoke CombatState field each), these are
// dispatched generically off CombatState.enemyPassiveIds -- a light
// registry, not a full generic DSL: each passive's actual logic is
// still hand-written below, many sharing a small set of parameterized
// shapes (first-fire bonus, tick magnitude bonus, gauge-cross push/
// pull, Root-fire gauge drain, tick-expiry resist) reused across
// several enemies by calling with different ids/amounts, same reuse
// discipline the 6 player passives get by living in this file. Always
// side-1-only, mirroring classId's implicit "side 0 only" convention --
// no separate side tag needed since enemyPassiveIds is simply empty for
// any fight that doesn't care about them.
//
// A few mechanics were corrected from their original DESIGN.md phrasing
// once checked against the real payload semantics: Cleanse only ever
// removes the *caster's own* debuff (never an opponent's, and never a
// DoT/HoT tick -- those only end via natural expiry), so "resists a
// cleanse" (Held Together, Redundant Kernel) became "resists natural
// expiry" instead, and "punishes the player's cleanse" (Adaptive
// Defense) triggers off the player cleansing their *own* debuff, the
// only real Cleanse target. Ward-amount boosts (Locked Down, part of No
// Way In/No Exceptions) are just bigger numbers in the enemy's own Ward
// subroutine data (checkpoint D), not passive logic -- only "refreshes"
// is real behavior here.
// ---------------------------------------------------------------------

function hasEnemyPassive(combatState: CombatState, id: EnemyPassiveId): boolean {
  return combatState.enemyPassiveIds.includes(id);
}

/** Mirrors hasEnemyPassive for the player-side Mod list -- Phase 5 Mods
 * checkpoint C. Always side 0 in practice, same implicit convention
 * ownedModIds itself documents. */
function hasMod(combatState: CombatState, id: ModId): boolean {
  return combatState.ownedModIds.includes(id);
}

function passiveStat(combatState: CombatState, side: PlayerIndex, key: string): number {
  return combatState.sides[side].passiveState[key] ?? 0;
}

function setPassiveStat(combatState: CombatState, side: PlayerIndex, key: string, value: number): CombatState {
  const sideState = combatState.sides[side];
  const passiveState = { ...sideState.passiveState, [key]: value };
  return { ...combatState, sides: replaceSide(combatState.sides, side, { ...sideState, passiveState }) };
}

/** Reduces `side`'s own initiative gauge progress by `amount`, floored
 * at 0 -- same shape as instantManipulation's 'enemyGauge' target
 * inline in resolvePayloadCore, factored out for the Root-fire-drain
 * family of enemy passives below (Digital Ghost, Dead Drop Protocol,
 * Total Access). */
function reduceInitiativeGaugeProgress(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  const sideState = combatState.sides[side];
  const progress = Math.max(0, sideState.gauge.progress - amount);
  return { ...combatState, sides: replaceSide(combatState.sides, side, { ...sideState, gauge: { ...sideState.gauge, progress } }) };
}

// All TBD/playtesting, same placeholder convention as every other
// numeric constant in this project -- untuned until checkpoint E's
// sweep exists.
const EP_SMALL = 2;
const EP_MEDIUM = 4;
const EP_LARGE = 7;
const EP_GROW_CAP = 5;
const EP_GAUGE_CROSS_FRACTION = 0.5;

/** Shape 1: first fire matching `wantArchetype` this combat gets a flat
 * bonus credited on top of whatever the fire already did. Used by Lucky
 * Guess (Script Kiddie) and Fresh Exploit (Zero-Day Broker). */
function firstFireBonus(
  combatState: CombatState,
  id: EnemyPassiveId,
  archetype: Archetype,
  caster: PlayerIndex,
  wantArchetype: Archetype,
  amount: number,
): CombatState {
  if (caster !== 1 || archetype !== wantArchetype || !hasEnemyPassive(combatState, id)) return combatState;
  if (passiveStat(combatState, 1, `${id}:fired`) > 0) return combatState;
  return creditWinGauge(setPassiveStat(combatState, 1, `${id}:fired`, 1), 1, amount);
}

/** Shape: every fire matching `wantArchetype` this combat gets a flat
 * bonus, capped at EP_GROW_CAP occurrences -- Infection Vector's
 * "every Exploit fire also progresses its Malware DoT," simplified to a
 * direct capped credit rather than needing a live DoT tick to boost. */
function everyFireBonusCapped(combatState: CombatState, id: EnemyPassiveId, archetype: Archetype, caster: PlayerIndex, wantArchetype: Archetype, amount: number): CombatState {
  if (caster !== 1 || archetype !== wantArchetype || !hasEnemyPassive(combatState, id)) return combatState;
  const count = passiveStat(combatState, 1, `${id}:count`);
  if (count >= EP_GROW_CAP) return combatState;
  return creditWinGauge(setPassiveStat(combatState, 1, `${id}:count`, count + 1), 1, amount);
}

/** Shape: a pending one-shot-per-arming bonus, armed by some condition
 * and consumed by the *next* side-1 fire (any kind). Used by Opportunist
 * (armed when the player's own gauge crosses 50%), Hold the Line (armed
 * when this enemy's own gauge crosses 50%), and Total Access (armed
 * right after a Root fire -- "guaranteed free" reinterpreted as "next
 * fire gets a bonus," since enemies have no Heat cost to waive). */
function armPendingBonus(combatState: CombatState, id: EnemyPassiveId): CombatState {
  return setPassiveStat(combatState, 1, `${id}:pending`, 1);
}
function consumePendingBonus(combatState: CombatState, id: EnemyPassiveId, caster: PlayerIndex, amount: number): CombatState {
  if (caster !== 1 || !hasEnemyPassive(combatState, id)) return combatState;
  if (passiveStat(combatState, 1, `${id}:pending`) <= 0) return combatState;
  return creditWinGauge(setPassiveStat(combatState, 1, `${id}:pending`, 0), 1, amount);
}

/** Shape 2: DoT/HoT tick magnitude bonus, optionally growing per-tick
 * (capped) and/or nudging the caster's own initiative gauge (a flavor
 * tempo nudge, same "overshoot carries to the next natural check"
 * simplification instantManipulation's 'ownGauge' target already
 * documents). Used by Still Spreading through Total Quarantine below. */
function tickBonus(
  combatState: CombatState,
  id: EnemyPassiveId,
  tick: ActiveTick,
  listKey: 'dots' | 'hots',
  amount: number,
  opts?: { grow?: boolean; nudgeInitiative?: boolean },
): CombatState {
  if (tick.casterSide !== 1 || !hasEnemyPassive(combatState, id)) return combatState;
  let state = combatState;
  let magnitude = amount;
  if (opts?.grow) {
    const stacks = Math.min(passiveStat(state, 1, `${id}:stacks`) + 1, EP_GROW_CAP);
    state = setPassiveStat(state, 1, `${id}:stacks`, stacks);
    magnitude = amount * stacks;
  }
  state = listKey === 'hots' ? reduceWinGauge(state, 0, magnitude) : creditWinGauge(state, 1, magnitude);
  if (opts?.nudgeInitiative) {
    const sideState = state.sides[1];
    state = { ...state, sides: replaceSide(state.sides, 1, { ...sideState, gauge: { ...sideState.gauge, progress: sideState.gauge.progress + EP_SMALL } }) };
  }
  return state;
}

/** Shape: this enemy's own tick would naturally expire (only removal
 * path ticks have -- Cleanse never touches dots/hots, see the section
 * header above) -- extend it by one more use instead, once per combat.
 * Used by Still Spreading, Held Together, and Redundant Kernel. */
function tickExpiryExtendOnce(combatState: CombatState, id: EnemyPassiveId, tick: ActiveTick): { combatState: CombatState; extend: boolean } {
  if (tick.casterSide !== 1 || !hasEnemyPassive(combatState, id)) return { combatState, extend: false };
  if (passiveStat(combatState, 1, `${id}:used`) > 0) return { combatState, extend: false };
  return { combatState: setPassiveStat(combatState, 1, `${id}:used`, 1), extend: true };
}

/** Shape 3 (the ward half): re-casts a just-fired Ward payload
 * `extraCasts` more times this combat -- the bigger base amount for
 * Locked Down/No Way In/No Exceptions lives in the enemy's own Ward
 * subroutine data instead (checkpoint D), not here. */
function wardRefresh(combatState: CombatState, id: EnemyPassiveId, payload: PayloadEffect, archetype: Archetype, caster: PlayerIndex, extraCasts: number): CombatState {
  if (caster !== 1 || payload.kind !== 'ward' || !hasEnemyPassive(combatState, id)) return combatState;
  const used = passiveStat(combatState, 1, `${id}:used`);
  if (used >= extraCasts) return combatState;
  const state = setPassiveStat(combatState, 1, `${id}:used`, used + 1);
  return resolvePayloadCore(payload, archetype, state, caster, { priorFireCountThisTurn: 0 });
}

/** Shape 4: the Foothold shape itself, parameterized -- a one-shot
 * push+pull the first time `side`'s own win-gauge crosses
 * EP_GAUGE_CROSS_FRACTION of its threshold. `pushSide`/`pullSide` let
 * Null Session invert it (watching the *player's* gauge, crediting
 * *this enemy's* own progress) while Cover Your Tracks/Hold the
 * Line/Foothold Reinforced/Reception Protocol use it the normal way
 * (watching their own gauge). */
function gaugeCross50PushPull(combatState: CombatState, id: EnemyPassiveId, watchSide: PlayerIndex, pushSide: PlayerIndex, pullSide: PlayerIndex, amount: number): CombatState {
  if (!hasEnemyPassive(combatState, id)) return combatState;
  if (passiveStat(combatState, 1, `${id}:fired`) > 0) return combatState;
  const gauge = combatState.sides[watchSide].winGauge;
  if (gauge.progress < gauge.threshold * EP_GAUGE_CROSS_FRACTION) return combatState;
  const marked = setPassiveStat(combatState, 1, `${id}:fired`, 1);
  const pushed = creditWinGauge(marked, pushSide, amount);
  return reduceWinGauge(pushed, pullSide, amount);
}

/** Dispatches every registered onFire passive -- called from
 * resolvePayload's wrapper, after any payload resolves (mirrors
 * applyPrimedPassive's own call site/shape). `payload`/`archetype` are
 * the just-fired subroutine's own; `caster` is whoever fired it (a
 * passive only ever activates when caster === 1, checked inside each
 * shape/case below). */
function applyEnemyOnFirePassives(combatState: CombatState, payload: PayloadEffect, archetype: Archetype, caster: PlayerIndex): CombatState {
  let state = combatState;
  state = firstFireBonus(state, 'lucky-guess', archetype, caster, 'exploit', EP_SMALL);
  state = firstFireBonus(state, 'fresh-exploit', archetype, caster, 'exploit', EP_MEDIUM);
  state = firstFireBonus(state, 'smash-and-grab', archetype, caster, 'exploit', EP_SMALL);
  state = firstFireBonus(state, 'long-runtime', archetype, caster, 'malware', EP_SMALL);
  state = everyFireBonusCapped(state, 'trial-and-error', archetype, caster, 'exploit', EP_SMALL);
  state = everyFireBonusCapped(state, 'infection-vector', archetype, caster, 'exploit', EP_SMALL);

  // Opportunist/Hold the Line/Total Access arm a pending bonus elsewhere
  // (gauge-cross or a Root fire below); this is where any of the three
  // gets consumed, on the very next side-1 fire of any kind.
  state = consumePendingBonus(state, 'opportunist', caster, EP_SMALL);
  state = consumePendingBonus(state, 'hold-the-line', caster, EP_SMALL);
  state = consumePendingBonus(state, 'total-access', caster, EP_MEDIUM);
  state = consumePendingBonus(state, 'adaptive-defense', caster, EP_SMALL);

  if (archetype === 'root' && caster === 1) {
    if (hasEnemyPassive(state, 'digital-ghost')) state = reduceInitiativeGaugeProgress(state, 0, EP_SMALL);
    if (hasEnemyPassive(state, 'dead-drop-protocol')) state = reduceInitiativeGaugeProgress(state, 0, EP_SMALL);
    if (hasEnemyPassive(state, 'off-the-grid')) {
      const sideState = state.sides[1];
      state = { ...state, sides: replaceSide(state.sides, 1, { ...sideState, wardShield: sideState.wardShield + EP_SMALL }) };
    }
    if (hasEnemyPassive(state, 'sleeper-network')) state = creditWinGauge(state, 1, EP_SMALL);
    if (hasEnemyPassive(state, 'total-access')) {
      state = reduceInitiativeGaugeProgress(state, 0, EP_LARGE);
      state = armPendingBonus(state, 'total-access');
    }
    if (hasEnemyPassive(state, 'primed-to-strike')) state = applyPrimedForSide1(state);
  }

  if (payload.kind === 'ward') {
    state = wardRefresh(state, 'no-way-in', payload, archetype, caster, 1);
    state = wardRefresh(state, 'no-exceptions', payload, archetype, caster, 1);
  }

  if (payload.kind === 'cleanse' && caster === 0 && hasEnemyPassive(state, 'adaptive-defense')) {
    state = armPendingBonus(state, 'adaptive-defense');
  }

  if (payload.kind === 'chainFinisherScaling' && caster === 1 && hasEnemyPassive(state, 'highest-bidder')) {
    const count = passiveStat(state, 1, 'highest-bidder:count');
    state = creditWinGauge(state, 1, count * EP_SMALL);
  }
  if (archetype === 'exploit' && caster === 1 && hasEnemyPassive(state, 'highest-bidder')) {
    state = setPassiveStat(state, 1, 'highest-bidder:count', passiveStat(state, 1, 'highest-bidder:count') + 1);
  }

  if (caster === 1 && hasEnemyPassive(state, 'total-corruption')) {
    state = crossFeedProgress(state, 'rootkit-deployment', 'epidemic', payload);
    state = crossFeedProgress(state, 'epidemic', 'rootkit-deployment', payload);
  }

  return state;
}

/** Total Corruption (Silent Corruption): the first time one of its two
 * named rare pieces fires, the other's banked progress gets a one-time
 * boost -- reinterpreted from DESIGN.md's "accumulates 50% faster"
 * (which would need touching triggers.ts's suit-tally credit path) into
 * a reachable, self-contained "the two feed each other" mechanic, same
 * family as Sleeper Cell/Sleeper Network. `sourceId` is checked against
 * `payload` indirectly via a companion firedId flag set by the caller's
 * two symmetric calls -- simplified here to just always attempt both
 * directions once each, gated by their own one-shot flags. */
function crossFeedProgress(combatState: CombatState, _sourceId: string, targetId: string, _payload: PayloadEffect): CombatState {
  const key = `total-corruption:${targetId}:boosted`;
  if (passiveStat(combatState, 1, key) > 0) return combatState;
  const sideState = combatState.sides[1];
  const index = sideState.loadout.findIndex((entry) => entry.definition.id === targetId);
  if (index === -1) return combatState;
  const entry = sideState.loadout[index];
  const loadout = sideState.loadout.slice();
  loadout[index] = { ...entry, state: { ...entry.state, accumulatedProgress: entry.state.accumulatedProgress + EP_MEDIUM } };
  const state = { ...combatState, sides: replaceSide(combatState.sides, 1, { ...sideState, loadout }) };
  return setPassiveStat(state, 1, key, 1);
}

/** Primed to Strike (Zero-Sum), reusing applyPrimedPassive's exact
 * mechanism (ease + boost the caster's own next Exploit entry) against
 * side 1's own loadout instead of side 0's classId-gated version. */
function applyPrimedForSide1(combatState: CombatState): CombatState {
  const sideState = combatState.sides[1];
  const index = sideState.loadout.findIndex((entry) => entry.definition.archetype === 'exploit');
  if (index === -1) return combatState;
  const entry = sideState.loadout[index];
  const easedTrigger = easeTriggerCondition(entry.definition.trigger, PRIMED_THRESHOLD_REDUCTION);
  const boostedPayload = improvedPayloadMagnitude(entry.definition.payload, PRIMED_MAGNITUDE_BONUS) ?? entry.definition.payload;
  const loadout = sideState.loadout.slice();
  loadout[index] = { ...entry, definition: { ...entry.definition, trigger: easedTrigger, payload: boostedPayload } };
  return { ...combatState, sides: replaceSide(combatState.sides, 1, { ...sideState, loadout }) };
}

/** Dispatches every registered onTick passive -- called from
 * applyTickPush, after any DoT/HoT tick resolves. */
function applyEnemyOnTickPassives(combatState: CombatState, tick: ActiveTick, listKey: 'dots' | 'hots', _amount: number): CombatState {
  let state = combatState;
  if (listKey === 'dots') state = tickBonus(state, 'grinds-you-down', tick, listKey, EP_SMALL);
  if (listKey === 'hots') state = tickBonus(state, 'grinds-you-down', tick, listKey, EP_SMALL);
  if (listKey === 'hots') state = tickBonus(state, 'steady-state', tick, listKey, EP_SMALL);
  state = tickBonus(state, 'attrition', tick, listKey, EP_SMALL);
  state = tickBonus(state, 'escalating-demand', tick, listKey, EP_SMALL, { grow: true });
  state = tickBonus(state, 'total-quarantine', tick, listKey, EP_SMALL, { nudgeInitiative: true });

  if (listKey === 'dots' && tick.casterSide === 1) {
    const cascadeCount = passiveStat(state, 1, 'cascading-failure:ticks') + (hasEnemyPassive(state, 'cascading-failure') ? 1 : 0);
    if (hasEnemyPassive(state, 'cascading-failure')) {
      state = setPassiveStat(state, 1, 'cascading-failure:ticks', cascadeCount);
      if (cascadeCount >= 3 && passiveStat(state, 1, 'cascading-failure:boosted') === 0) {
        state = setPassiveStat(state, 1, 'cascading-failure:boosted', 1);
        const targetState = state.sides[0];
        const dots = targetState.dots.map((d) => (d.casterSide === 1 ? { ...d, amountPerTick: d.amountPerTick + EP_SMALL } : d));
        state = { ...state, sides: replaceSide(state.sides, 0, { ...targetState, dots }) };
      }
    }
  }
  return state;
}

/** Dispatches Stubborn Default -- the only onIncomingDirectBurst
 * passive in the roster, mitigating a flat amount off the first hit
 * `target` (side 1) takes each combat, checked before shield absorption
 * so it applies regardless of whether a Ward is also up. Returns both
 * the (possibly reduced) amount and the updated state, since the
 * one-shot flag has to be recorded regardless of whether this resolves
 * through the normal state-threading the rest of resolvePayloadCore
 * uses. */
function applyEnemyIncomingDirectBurstPassives(
  combatState: CombatState,
  target: PlayerIndex,
  amount: number,
): { combatState: CombatState; amount: number } {
  if (target !== 1 || !hasEnemyPassive(combatState, 'stubborn-default')) return { combatState, amount };
  if (passiveStat(combatState, 1, 'stubborn-default:used') > 0) return { combatState, amount };
  const state = setPassiveStat(combatState, 1, 'stubborn-default:used', 1);
  return { combatState: state, amount: Math.max(0, amount - EP_SMALL) };
}

/** Dispatches every registered onTickExpiring passive -- called from
 * processTickList right where a tick's remainingDuration would hit 0. */
function applyEnemyOnTickExpiringPassives(combatState: CombatState, tick: ActiveTick, _listKey: 'dots' | 'hots'): { combatState: CombatState; extend: boolean } {
  const stillSpreading = tickExpiryExtendOnce(combatState, 'still-spreading', tick);
  if (stillSpreading.extend) return stillSpreading;
  const heldTogether = tickExpiryExtendOnce(stillSpreading.combatState, 'held-together', tick);
  if (heldTogether.extend) return heldTogether;
  return tickExpiryExtendOnce(heldTogether.combatState, 'redundant-kernel', tick);
}

/** Dispatches every registered onGaugeCross50 passive -- called from
 * combat.ts's step() alongside applyFootholdBonus, checked after every
 * state-changing step regardless of what caused it (same reasoning
 * Foothold's own doc comment gives). */
export function applyEnemyGaugeCross50Passives(combatState: CombatState): CombatState {
  let state = combatState;
  state = gaugeCross50PushPull(state, 'cover-your-tracks', 1, 1, 0, EP_SMALL);
  state = gaugeCross50PushPull(state, 'foothold-reinforced', 1, 1, 0, EP_MEDIUM);
  state = gaugeCross50PushPull(state, 'reception-protocol', 1, 1, 0, EP_LARGE);
  if (hasEnemyPassive(state, 'reception-protocol') && passiveStat(state, 1, 'reception-protocol:cleansed') === 0) {
    const gauge = state.sides[1].winGauge;
    if (gauge.progress >= gauge.threshold * EP_GAUGE_CROSS_FRACTION) {
      const sideState = state.sides[1];
      if (sideState.debuffs.length > 0) {
        const debuffs = sideState.debuffs.slice(1);
        state = { ...state, sides: replaceSide(state.sides, 1, { ...sideState, debuffs }) };
      }
      state = setPassiveStat(state, 1, 'reception-protocol:cleansed', 1);
    }
  }

  // Null Session watches the *player's* gauge, crediting this enemy's
  // own progress -- Return to Sender's exact shape, inverted.
  if (hasEnemyPassive(state, 'null-session-passive') && passiveStat(state, 1, 'null-session-passive:fired') === 0) {
    const gauge = state.sides[0].winGauge;
    if (gauge.progress >= gauge.threshold * EP_GAUGE_CROSS_FRACTION) {
      state = creditWinGauge(setPassiveStat(state, 1, 'null-session-passive:fired', 1), 1, EP_LARGE);
    }
  }

  // Opportunist/Hold the Line arm here (own or the player's gauge
  // crossing 50%), consumed by the next side-1 fire in
  // applyEnemyOnFirePassives above.
  if (hasEnemyPassive(state, 'opportunist') && passiveStat(state, 1, 'opportunist:armed') === 0) {
    const gauge = state.sides[0].gauge; // the PLAYER's own initiative gauge
    if (gauge.progress >= gauge.threshold * EP_GAUGE_CROSS_FRACTION) {
      state = armPendingBonus(setPassiveStat(state, 1, 'opportunist:armed', 1), 'opportunist');
    }
  }
  if (hasEnemyPassive(state, 'hold-the-line') && passiveStat(state, 1, 'hold-the-line:armed') === 0) {
    const gauge = state.sides[1].winGauge;
    if (gauge.progress >= gauge.threshold * EP_GAUGE_CROSS_FRACTION) {
      state = armPendingBonus(setPassiveStat(state, 1, 'hold-the-line:armed', 1), 'hold-the-line');
    }
  }

  return state;
}

// ---------------------------------------------------------------------
// Mods (Phase 5 checkpoint C, session 30-33's design) -- combat-scoped
// hook dispatch, dual-sided sibling to the enemy-passive dispatchers
// above: same `{id, hookPoint, fn}` light-registry shape, checked
// against CombatState.ownedModIds (side 0 only) instead of
// enemyPassiveIds (side 1 only). Kept as separate functions rather than
// interleaved into the enemy dispatchers themselves -- each hook point
// still fires exactly once per event either way (both are called from
// the same call site), but this keeps the well-tested 34-passive enemy
// fold completely untouched.
// ---------------------------------------------------------------------

const MOD_EARLY_MOMENTUM_AMOUNT = MOD_SMALL; // TBD/playtesting

/** Overclocked Accumulator's onTriggerEvaluate hook (the 12th hook,
 * session 32) -- the effective threshold multiplier fed into
 * triggers.ts's updateSubroutineState/updateSuitTallyState/
 * updateMitigationBankedState, all 3 of an AccumulatorTrigger's metrics.
 * Exported for combat.ts's applyOccurrenceToState/applySuitPlayedToState
 * (which iterate both sides generically) and this file's own
 * applySuitTallyCredit/creditMitigationBanked to share. */
export function accumulatorThresholdMultiplier(combatState: CombatState, side: PlayerIndex): number {
  return side === 0 && hasMod(combatState, 'overclocked-accumulator') ? 1 - OVERCLOCKED_ACCUMULATOR_REDUCTION : 1;
}

/** Warm Boot's onCombatStart hook -- called once per fight from
 * combat.ts's playCombat, right after createCombatState, before the
 * first hand. */
export function applyModOnCombatStartPassives(combatState: CombatState): CombatState {
  if (!hasMod(combatState, 'warm-boot')) return combatState;
  const sideState = combatState.sides[0];
  return { ...combatState, sides: replaceSide(combatState.sides, 0, { ...sideState, wardShield: sideState.wardShield + MOD_SMALL }) };
}

/** Early Momentum's onGaugeCross50 hook -- called from combat.ts's
 * step() alongside applyEnemyGaugeCross50Passives/applyFootholdBonus. A
 * push only (session 32: "small one-time push"), not Foothold's
 * push+pull shape. */
export function applyModGaugeCross50Passives(combatState: CombatState): CombatState {
  if (!hasMod(combatState, 'early-momentum') || passiveStat(combatState, 0, 'early-momentum:fired') > 0) return combatState;
  const gauge = combatState.sides[0].winGauge;
  if (gauge.progress < gauge.threshold * EP_GAUGE_CROSS_FRACTION) return combatState;
  return creditWinGauge(setPassiveStat(combatState, 0, 'early-momentum:fired', 1), 0, MOD_EARLY_MOMENTUM_AMOUNT);
}

/** Tagged Firmware/Malware Amplifier's onFire hook -- called from
 * resolvePayload after any payload resolves, side 0 only.
 * `firingDefinition` is only available from call sites that already
 * have the full SubroutineDefinition on hand (every real fire path);
 * resolvePendingSabotage's wrapped-effect replay doesn't carry one, so
 * Tagged Firmware (which needs `.tags`) simply can't fire from a
 * sabotage replay -- Malware Amplifier (archetype-only) still can. */
function applyModOnFirePassives(combatState: CombatState, archetype: Archetype, caster: PlayerIndex, firingDefinition?: SubroutineDefinition): CombatState {
  if (caster !== 0) return combatState;
  let state = combatState;
  if (hasMod(state, 'tagged-firmware') && firingDefinition?.tags.includes(TAGGED_FIRMWARE_TAG)) {
    state = creditWinGauge(state, 0, MOD_MEDIUM);
  }
  if (hasMod(state, 'malware-amplifier') && archetype === 'malware') {
    state = creditWinGauge(state, 0, MOD_MEDIUM);
  }
  return state;
}

/** Static Shield's onIncomingDirectBurst hook -- called from
 * resolvePayloadCore's 'directBurst' case, checked before shield
 * absorption (same as Stubborn Default), but uncapped -- mitigates
 * every incoming hit, not just the first. */
function applyModIncomingDirectBurstPassives(combatState: CombatState, target: PlayerIndex, amount: number): { combatState: CombatState; amount: number } {
  if (target !== 0 || !hasMod(combatState, 'static-shield')) return { combatState, amount };
  return { combatState, amount: Math.max(0, amount - MOD_SMALL) };
}

/** Dispatches every registered onTick passive -- Mods' sibling to
 * applyEnemyOnTickPassives, called from the same applyTickPush site.
 * No current Mod content hooks plain onTick (only onTickExpiring, via
 * Redundant Ticks/Failsafe Cascade below) -- wired in now regardless so
 * the hook point genuinely exists for future content, same "deliberately
 * a starting catalog, not a closed one" treatment session 31 gave the
 * whole catalog. */
function applyModOnTickPassives(combatState: CombatState, _tick: ActiveTick, _listKey: 'dots' | 'hots'): CombatState {
  return combatState;
}

/** Redundant Ticks/Failsafe Cascade's onTickExpiring hook -- called from
 * processTickList right where a tick's remainingDuration would hit 0,
 * only if no enemy onTickExpiring passive already claimed the extension
 * (mirrors how the 3 enemy onTickExpiring passives themselves chain via
 * early-return). Redundant Ticks extends *every* tick once (tracked per-
 * tick-instance via ActiveTick.redundantTickUsed, since a fight can have
 * several DoTs/HoTs active); Failsafe Cascade extends only the first
 * tick to expire *each fight*, any tick (tracked via the usual
 * passiveState one-shot flag, same shape as the enemy tickExpiryExtendOnce
 * passives). Checked in that order -- Redundant Ticks first, since it's
 * the more common effect and doesn't consume Failsafe Cascade's one-shot. */
function applyModOnTickExpiringPassives(
  combatState: CombatState,
  tick: ActiveTick,
): { combatState: CombatState; extend: boolean; tickPatch: Partial<ActiveTick> } {
  if (tick.casterSide !== 0) return { combatState, extend: false, tickPatch: {} };
  if (hasMod(combatState, 'redundant-ticks') && !tick.redundantTickUsed) {
    return { combatState, extend: true, tickPatch: { redundantTickUsed: true } };
  }
  if (hasMod(combatState, 'failsafe-cascade') && passiveStat(combatState, 0, 'failsafe-cascade:used') === 0) {
    return { combatState: setPassiveStat(combatState, 0, 'failsafe-cascade:used', 1), extend: true, tickPatch: {} };
  }
  return { combatState, extend: false, tickPatch: {} };
}

/** Resolves one subroutine's payload against the acting side's or
 * opposing side's state. `archetype` comes from the firing subroutine's
 * definition (payloads themselves don't carry it) -- needed for
 * scheduledSabotage's wrapped-effect bookkeeping. Wraps
 * resolvePayloadCore (the actual per-payload-kind switch) with Primed,
 * the one passive hook that applies generically by archetype rather
 * than by a specific payload kind -- see the passives block above. */
export function resolvePayload(
  payload: PayloadEffect,
  archetype: Archetype,
  combatState: CombatState,
  caster: PlayerIndex,
  context: ResolveContext = { priorFireCountThisTurn: 0 },
  /** The full firing SubroutineDefinition, when the caller has one on
   * hand (every real fire path does) -- Mods checkpoint C's onFire
   * widening, needed by tag-affinity Mods (Tagged Firmware) that
   * `archetype` alone can't support. Absent from resolvePendingSabotage's
   * wrapped-effect replay, which only ever captured `archetype`. */
  firingDefinition?: SubroutineDefinition,
): CombatState {
  const base = resolvePayloadCore(payload, archetype, combatState, caster, context);
  const withPrimed = applyPrimedPassive(base, archetype, caster);
  const withEnemy = applyEnemyOnFirePassives(withPrimed, payload, archetype, caster);
  return applyModOnFirePassives(withEnemy, archetype, caster, firingDefinition);
}

function resolvePayloadCore(
  payload: PayloadEffect,
  archetype: Archetype,
  combatState: CombatState,
  caster: PlayerIndex,
  context: ResolveContext,
): CombatState {
  const target = opponentOf(caster);

  switch (payload.kind) {
    case 'directBurst': {
      // The only offense payload Ward's shield intercepts (matches its
      // pre-redesign scope -- piercing/chainFinisherScaling/
      // riskRewardBurst never checked wards either).
      const rawAmount = payload.amount * corruptionMultiplier(combatState, caster);
      const afterEnemy = applyEnemyIncomingDirectBurstPassives(combatState, target, rawAmount);
      const incoming = applyModIncomingDirectBurstPassives(afterEnemy.combatState, target, afterEnemy.amount);
      const amount = incoming.amount;
      const targetState = incoming.combatState.sides[target];
      const { sideState, absorbed, remaining } = absorbWithShield(targetState, amount);
      const sides = replaceSide(incoming.combatState.sides, target, sideState);
      let state = { ...incoming.combatState, sides };
      state = applyReturnToSenderPassive(state, target, absorbed);
      return creditWinGauge(state, caster, remaining);
    }
    case 'piercing': {
      // Ignores wards entirely -- Exploit's counter to defense-heavy builds.
      const amount = payload.amount * corruptionMultiplier(combatState, caster);
      return creditWinGauge(combatState, caster, amount);
    }
    case 'chainFinisherScaling': {
      const base = payload.baseAmount + payload.perPriorFire * context.priorFireCountThisTurn;
      const amount = base * corruptionMultiplier(combatState, caster);
      return creditWinGauge(combatState, caster, amount);
    }
    case 'riskRewardBurst': {
      const amount = payload.amount * corruptionMultiplier(combatState, caster);
      const casterState = combatState.sides[caster];
      // Blackhat's Zero Day: the first Heat-costing Exploit fire each
      // combat waives its Heat cost entirely.
      const zeroDay = caster === 0 && hasMod(combatState, 'zero-day') && !combatState.passiveTriggered && payload.heatCost > 0;
      const heat = zeroDay ? casterState.heat : casterState.heat + payload.heatCost;
      const sides = replaceSide(combatState.sides, caster, { ...casterState, heat });
      const state = { ...combatState, sides, passiveTriggered: zeroDay || combatState.passiveTriggered };
      return creditWinGauge(state, caster, amount);
    }
    case 'dot': {
      const targetState = combatState.sides[target];
      const dots = [
        ...targetState.dots,
        {
          amountPerTick: payload.amountPerTick,
          cadence: payload.cadence,
          remainingDuration: payload.duration,
          casterSide: caster,
          pointsPerTick: payload.pointsPerTick,
          accumulatedPoints: 0,
        },
      ];
      const sides = replaceSide(combatState.sides, target, { ...targetState, dots });
      return { ...combatState, sides };
    }
    case 'debuff': {
      const targetState = combatState.sides[target];
      const debuffs = [
        ...targetState.debuffs,
        { debuffId: payload.debuffId, magnitude: payload.magnitude, remainingDuration: payload.duration },
      ];
      // Choked's threshold bump applies immediately, alongside the
      // debuff record -- tickDebuffDurations reverts it on natural
      // expiry, 'cleanse' below reverts it on early removal.
      const gauge =
        payload.debuffId === 'choked'
          ? { ...targetState.gauge, threshold: targetState.gauge.threshold + payload.magnitude }
          : targetState.gauge;
      const sides = replaceSide(combatState.sides, target, { ...targetState, debuffs, gauge });
      const withDebuff = { ...combatState, sides };
      return applySleeperCellPassive(withDebuff, caster, archetype === 'malware');
    }
    case 'instantCounterPush': {
      // Reduces the *opponent's* gauge directly -- Encryption's instant
      // mitigation tool, the one-shot counterpart to HoT's gradual
      // version. Not blockable by Ward: Ward protects against offense
      // that would credit the attacker's own gauge, and this is a
      // different kind of effect (direct suppression of the opponent's
      // progress, not gauge-seeking offense on the caster's behalf).
      const amount = payload.amount * corruptionMultiplier(combatState, caster);
      const pushed = reduceWinGauge(combatState, target, amount);
      const withReturnToSender = applyReturnToSenderCounterPushPassive(pushed, caster, amount);
      return creditMitigationBanked(withReturnToSender, caster, amount);
    }
    case 'ward': {
      const casterState = combatState.sides[caster];
      const sides = replaceSide(combatState.sides, caster, { ...casterState, wardShield: casterState.wardShield + payload.amount });
      return creditMitigationBanked({ ...combatState, sides }, caster, payload.amount);
    }
    case 'hot': {
      const casterState = combatState.sides[caster];
      const hots = [
        ...casterState.hots,
        {
          amountPerTick: payload.amountPerTick,
          cadence: payload.cadence,
          remainingDuration: payload.duration,
          casterSide: caster,
          pointsPerTick: payload.pointsPerTick,
          accumulatedPoints: 0,
        },
      ];
      const sides = replaceSide(combatState.sides, caster, { ...casterState, hots });
      // Circuit Breaker banks HoT's full potential (amountPerTick *
      // duration) at cast time, same as Ward/instantCounterPush credit
      // immediately -- simpler than hooking applyTickPush's per-tick
      // path separately, and "generated" reads fine as "committed," not
      // strictly "already realized."
      return creditMitigationBanked({ ...combatState, sides }, caster, payload.amountPerTick * payload.duration);
    }
    case 'cleanse': {
      const casterState = combatState.sides[caster];
      const index = payload.debuffId
        ? casterState.debuffs.findIndex((d) => d.debuffId === payload.debuffId)
        : casterState.debuffs.length > 0
          ? 0
          : -1;
      if (index === -1) return combatState;
      const removed = casterState.debuffs[index];
      const debuffs = casterState.debuffs.slice();
      debuffs.splice(index, 1);
      // Cleansing a Choked debuff early must revert its threshold bump
      // too, same as natural expiry does (tickDebuffDurations) -- it
      // shouldn't outlive the debuff record that caused it. Floored at
      // MIN_INITIATIVE_THRESHOLD, same as Haste's own reduction -- an
      // un-floored revert can land at or below 0 if something else
      // (most concretely, Haste) also reduced this threshold in the
      // meantime, which would hang gauges.ts's addPoints forever.
      const gauge =
        removed.debuffId === 'choked'
          ? { ...casterState.gauge, threshold: Math.max(MIN_INITIATIVE_THRESHOLD, casterState.gauge.threshold - removed.magnitude) }
          : casterState.gauge;
      const sides = replaceSide(combatState.sides, caster, { ...casterState, debuffs, gauge });
      return { ...combatState, sides };
    }
    case 'instantManipulation': {
      const amount = payload.amount * corruptionMultiplier(combatState, caster);
      if (payload.target === 'enemyGauge') {
        const targetState = combatState.sides[target];
        const progress = Math.max(0, targetState.gauge.progress - amount);
        const sides = replaceSide(combatState.sides, target, { ...targetState, gauge: { ...targetState.gauge, progress } });
        return { ...combatState, sides };
      }
      if (payload.target === 'enemyGaugeThreshold') {
        // Permanent, non-expiring -- the counterpart to Malware's
        // temporary 'choked' debuff (see the 'debuff' case above).
        const targetState = combatState.sides[target];
        const gauge = { ...targetState.gauge, threshold: targetState.gauge.threshold + amount };
        const sides = replaceSide(combatState.sides, target, { ...targetState, gauge });
        return { ...combatState, sides };
      }
      if (payload.target === 'ownGauge') {
        // Haste (session 24): speeds up the caster's own initiative
        // gauge -- the mirror of enemyGauge's slow. Direct addition, no
        // upper clamp: an addition that pushes progress past threshold
        // isn't lost or wasted -- gauges.ts's addPoints already carries
        // overflow correctly (its while-loop doesn't assume progress
        // starts below threshold), so the resulting turn(s) fire on the
        // very next natural scoring event rather than this instant --
        // a deliberate, documented simplification (this payload resolves
        // from resolvePayload, which has no access to combat.ts's
        // fire-and-check-winner loop to grant an immediate extra turn).
        const casterState = combatState.sides[caster];
        const progress = casterState.gauge.progress + amount;
        const sides = replaceSide(combatState.sides, caster, { ...casterState, gauge: { ...casterState.gauge, progress } });
        return { ...combatState, sides };
      }
      if (payload.target === 'ownGaugeThreshold') {
        // Haste's other half -- the mirror of enemyGaugeThreshold's
        // permanent raise, floored so it can never reach a threshold of
        // 0 (see MIN_INITIATIVE_THRESHOLD's own comment for why that
        // specifically would be unsafe, not just undesirable).
        const casterState = combatState.sides[caster];
        const threshold = Math.max(MIN_INITIATIVE_THRESHOLD, casterState.gauge.threshold - amount);
        const sides = replaceSide(combatState.sides, caster, { ...casterState, gauge: { ...casterState.gauge, threshold } });
        return { ...combatState, sides };
      }
      if (payload.target === 'subroutineProgress' && payload.targetSubroutineId) {
        const casterState = combatState.sides[caster];
        const index = casterState.loadout.findIndex((entry) => entry.definition.id === payload.targetSubroutineId);
        if (index === -1) return combatState;
        const entry = casterState.loadout[index];
        const loadout = casterState.loadout.slice();
        loadout[index] = {
          ...entry,
          state: { ...entry.state, accumulatedProgress: entry.state.accumulatedProgress + amount },
        };
        const sides = replaceSide(combatState.sides, caster, { ...casterState, loadout });
        return { ...combatState, sides };
      }
      if (payload.target === 'suitTally') {
        // Generic, suit-agnostic boost to every one of the caster's own
        // suitTally Accumulator subroutines, regardless of which suit
        // each one watches -- deliberately distinct from
        // cribbageLayerManipulation's markSuit (a specific single-suit
        // +1 credit). Reuses `amount` rather than needing a new field.
        const casterState = combatState.sides[caster];
        const loadout = casterState.loadout.map((entry) => {
          const trigger = entry.definition.trigger;
          if (trigger.kind !== 'accumulator' || trigger.metric !== 'suitTally') return entry;
          const accumulatedProgress = entry.state.accumulatedProgress + amount;
          return {
            ...entry,
            state: { ...entry.state, accumulatedProgress, ready: entry.state.ready || accumulatedProgress >= trigger.threshold },
          };
        });
        const sides = replaceSide(combatState.sides, caster, { ...casterState, loadout });
        return { ...combatState, sides };
      }
      return combatState;
    }
    case 'cribbageLayerManipulation':
      // Always resolves at the next deal, same as scheduledSabotage --
      // see consumePendingCribbageManipulation below and
      // CribbageLayerManipulationPayload's own doc comment.
      return {
        ...combatState,
        pendingCribbageManipulation: [
          ...combatState.pendingCribbageManipulation,
          { casterSide: caster, action: payload.action, suit: payload.suit },
        ],
      };
    case 'scheduledSabotage':
      return {
        ...combatState,
        pendingSabotage: [...combatState.pendingSabotage, { casterSide: caster, archetype, effect: payload.effect }],
      };
    case 'selfHeatReduction': {
      const casterState = combatState.sides[caster];
      const amount = payload.amount * corruptionMultiplier(combatState, caster);
      const heat = Math.max(payload.floor, casterState.heat - amount);
      const sides = replaceSide(combatState.sides, caster, { ...casterState, heat });
      return { ...combatState, sides };
    }
    // Recon (session 24 checkpoint C): firesAt-only, no-op unless
    // combat.ts supplied revealedCards for this exact fire (it always
    // does when these fire through fireHandLifecycleSubroutines at
    // their matching moment -- the guard is defensive, not expected to
    // bind in practice).
    case 'revealOpponentHand':
    case 'revealOpponentKeptHand': {
      if (!context.revealedCards) return combatState;
      const casterState = combatState.sides[caster];
      const sides = replaceSide(combatState.sides, caster, { ...casterState, knownOpponentHand: context.revealedCards });
      return { ...combatState, sides };
    }
    case 'revealCrib': {
      if (!context.revealedCards) return combatState;
      const casterState = combatState.sides[caster];
      const sides = replaceSide(combatState.sides, caster, { ...casterState, knownCrib: context.revealedCards });
      return { ...combatState, sides };
    }
    case 'forceDiscardCard': {
      // context.revealedCards is the target's own dealt hand here (the
      // same data recon's revealOpponentHand would use) -- no recon
      // prerequisite needed (decision 3): payload resolution already
      // has full state access to compute this adversarially.
      if (!context.revealedCards) return combatState;
      const forcedPair = bestCardToForce(context.revealedCards, context.targetIsOwnCrib ?? false);
      const targetState = combatState.sides[target];
      const sides = replaceSide(combatState.sides, target, { ...targetState, forcedDiscardPair: forcedPair });
      return { ...combatState, sides };
    }
  }
}

export function buildTriggerContext(
  combatState: CombatState,
  side: PlayerIndex,
  firedSubroutineIdsThisTurn: ReadonlySet<string>,
  isDealer: boolean,
): TriggerContext {
  const own = combatState.sides[side];
  const enemy = combatState.sides[opponentOf(side)];
  // The enemy's own progress toward *their* win, as a percentage of
  // their own threshold -- the two-gauge redesign's replacement for the
  // old shared-scalar "enemy's favor position" reading. "Enemy behind"
  // (old: shared scalar tilted toward the caster) becomes "enemy's own
  // fill percentage is low"; "enemy ahead" becomes "enemy's own fill
  // percentage is high" -- both preserve the original intent (how close
  // is the enemy to winning) without needing the old side-0-vs-side-1
  // inversion, since this is now symmetric by construction.
  const enemyFillPercent = (enemy.winGauge.progress / enemy.winGauge.threshold) * 100;
  return {
    self: { heat: own.heat, isDealer },
    enemy: {
      breachContainment: enemyFillPercent,
      gaugeFillFraction: enemy.gauge.progress / enemy.gauge.threshold,
      activeDebuffIds: enemy.debuffs.map((d) => d.debuffId),
    },
    firedSubroutineIdsThisTurn,
  };
}

/**
 * Latches `ready` for every selfState/enemyState-triggered subroutine on
 * both sides whose live condition is currently true -- the sticky-latch
 * fix isReady() above now depends on. Non-Reactive subroutines never
 * have `ready` unset once latched (matches accumulator/occurrence's
 * existing "banked, not re-checked" behavior). Reactive subroutines on
 * these two families arm edge-triggered instead: `lastConditionTrue` is
 * tracked every pass regardless of whether it's already ready, so a
 * Reactive piece only latches on an actual false→true transition, not
 * on every call while the condition stays continuously true (it fires
 * immediately once armed -- see fireNewlyReadyReactiveSubroutines below
 * -- so re-latching on every pass would refire it constantly).
 *
 * Safe and cheap to call after any state change that could affect a
 * condition: a gauge update, a payload resolution (Heat/win-gauge/
 * debuffs), or a new hand's dealer becoming known. firedSubroutineIdsThisTurn
 * is irrelevant here (chained/always aren't touched) so an empty set is
 * passed to buildTriggerContext.
 */
export function refreshTriggerReadiness(combatState: CombatState, handDealer: PlayerIndex): CombatState {
  let state = combatState;
  for (const side of [0, 1] as PlayerIndex[]) {
    const sideState = state.sides[side];
    const context = buildTriggerContext(state, side, EMPTY_FIRED_SET, side === handDealer);
    const loadout = sideState.loadout.map((entry) => {
      const trigger = entry.definition.trigger;
      if (trigger.kind !== 'selfState' && trigger.kind !== 'enemyState') return entry;

      const conditionTrue =
        trigger.kind === 'selfState' ? evaluateSelfState(trigger, context.self) : evaluateEnemyState(trigger, context.enemy);
      const justArmed = entry.definition.reactive ? conditionTrue && !entry.state.lastConditionTrue : conditionTrue;

      return {
        ...entry,
        state: { ...entry.state, ready: entry.state.ready || justArmed, lastConditionTrue: conditionTrue },
      };
    });
    state = { ...state, sides: replaceSide(state.sides, side, { ...sideState, loadout }) };
  }
  return state;
}

const EMPTY_FIRED_SET: ReadonlySet<string> = new Set();

/**
 * Fires every subroutine whose `ready` flag just flipped false→true
 * between `before` and `after` (comparing loadout entries index-by-
 * index, both sides) and is Reactive -- bypassing the normal turn-gate
 * entirely. Call right after any step that can change readiness
 * (applying an occurrence, or refreshTriggerReadiness) so Reactive
 * pieces fire the instant they arm rather than waiting for the owning
 * side's next turn. Processes side 0 then side 1, loadout order within
 * each side, the same deterministic order fireReadySubroutines uses.
 * priorFireCountThisTurn is always 0 here -- chain-finisher scaling's
 * "how many fired earlier this turn" concept doesn't apply to a fire
 * that isn't happening on anyone's turn.
 */
export function fireNewlyReadyReactiveSubroutines(
  before: CombatState,
  after: CombatState,
): { combatState: CombatState; events: FireEvent[] } {
  let state = after;
  const events: FireEvent[] = [];
  for (const side of [0, 1] as PlayerIndex[]) {
    const beforeLoadout = before.sides[side].loadout;
    const loadoutLength = state.sides[side].loadout.length;
    for (let i = 0; i < loadoutLength; i++) {
      const entry = state.sides[side].loadout[i];
      const justBecameReady = !beforeLoadout[i].state.ready && entry.state.ready;
      // firesAt-tagged entries only ever fire via fireHandLifecycleSubroutines
      // below, never via the normal turn-gate or the reactive path.
      if (entry.definition.firesAt) continue;
      if (!justBecameReady || !entry.definition.reactive) continue;

      state = resolvePayload(
        entry.definition.payload,
        entry.definition.archetype,
        state,
        side,
        { priorFireCountThisTurn: 0 },
        entry.definition,
      );
      events.push({ subroutineId: entry.definition.id, side, payload: entry.definition.payload });
      state = updateLoadoutEntryState(state, side, i, resetAfterFire(state.sides[side].loadout[i].state));
    }
  }
  return { combatState: state, events };
}

function updateLoadoutEntryState(
  combatState: CombatState,
  side: PlayerIndex,
  index: number,
  newState: SubroutineRuntimeState,
): CombatState {
  const sideState = combatState.sides[side];
  const loadout = sideState.loadout.slice();
  loadout[index] = { ...loadout[index], state: newState };
  const sides = replaceSide(combatState.sides, side, { ...sideState, loadout });
  return { ...combatState, sides };
}

/** Applies one tick's effect: DoT ticks (listKey === 'dots') credit the
 * tick's caster's own gauge, uncapped -- a DoT can win the match
 * outright, same as any other Malware payload. HoT ticks (listKey ===
 * 'hots') reduce the *opponent's* gauge directly instead, Encryption's
 * gradual mitigation tool -- no cap needed, reduceWinGauge already
 * floors at 0. Corrupted is re-checked at every individual tick (not
 * frozen at registration), same as any other payload resolution.
 * Feedback Loop's amplification (below) runs first and can boost this
 * tick's own effective amount before the base effect applies. */
function applyTickPush(combatState: CombatState, tick: ActiveTick, listKey: 'dots' | 'hots'): CombatState {
  const baseAmount = tick.amountPerTick * corruptionMultiplier(combatState, tick.casterSide);
  const amplified = applyFeedbackLoopAmplification(combatState, tick, listKey, baseAmount);
  const amount = amplified.amount;
  const state =
    listKey === 'hots'
      ? reduceWinGauge(amplified.combatState, opponentOf(tick.casterSide), amount)
      : creditWinGauge(amplified.combatState, tick.casterSide, amount);
  const withReturnToSender = applyReturnToSenderTickPassive(state, tick, listKey, amount);
  const withSleeperCell = applySleeperCellPassive(withReturnToSender, tick.casterSide, listKey === 'dots');
  const withEnemyTick = applyEnemyOnTickPassives(withSleeperCell, tick, listKey, amount);
  return applyModOnTickPassives(withEnemyTick, tick, listKey);
}

/** Warden's Feedback Loop, redesigned (session 39): HoT and Malware's
 * DoT reciprocally amplify each other's *magnitude* instead of a flat
 * per-tick win-gauge bonus -- every HoT tick queues a flat bonus onto
 * the caster's own *next* DoT tick, and every DoT tick queues a flat
 * bonus onto the caster's own *next* HoT tick, each first consuming
 * whatever bonus is already queued for itself. A flat step per tick
 * (not a fraction of the tick's own current size, which was tried first
 * and rejected -- proportional-to-self growth compounds multiplicatively
 * rather than linearly, and even a modest-looking ratio made the whole
 * kit noticeably *stronger* than before any fix, empirically, once a
 * real match's worth of ticks had a chance to compound). Self-
 * reinforcing, but genuinely requires sustaining *both* archetypes'
 * ticking to keep growing -- a queued bonus just sits (in
 * CombatSideState.passiveState, no expiry) until the opposite type
 * ticks again, unlike the original flat-bonus version it replaces.
 *
 * Replaces the original flat FEEDBACK_LOOP_DOT_AMOUNT bonus (session 22+),
 * found this session to conceptually overlap with Ghost's own Return to
 * Sender, which already hooks HoT ticks (session 25) -- this makes
 * Feedback Loop a genuinely distinct mechanic instead of a smaller,
 * narrower echo of a passive another class already owns more fully.
 * Session 25's own second proposed fix for this passive, tried after the
 * simpler magnitude/dealer-gating options either undershot or overlapped.
 *
 * Returns the tick's boosted amount for the caller to apply the base
 * effect with (not the raw one) and the updated state (queue consumed/
 * refreshed). A no-op pass-through for every non-Warden combat. */
function applyFeedbackLoopAmplification(
  combatState: CombatState,
  tick: ActiveTick,
  listKey: 'dots' | 'hots',
  baseAmount: number,
): { combatState: CombatState; amount: number } {
  if (tick.casterSide !== 0 || !hasMod(combatState, 'feedback-loop')) return { combatState, amount: baseAmount };
  const ownKey = listKey === 'hots' ? 'feedback-loop:pendingHotBonus' : 'feedback-loop:pendingDotBonus';
  const otherKey = listKey === 'hots' ? 'feedback-loop:pendingDotBonus' : 'feedback-loop:pendingHotBonus';
  const queuedBonus = passiveStat(combatState, 0, ownKey);
  const amount = baseAmount + queuedBonus;
  let state = queuedBonus > 0 ? setPassiveStat(combatState, 0, ownKey, 0) : combatState;
  const otherQueued = passiveStat(state, 0, otherKey);
  state = setPassiveStat(state, 0, otherKey, otherQueued + FEEDBACK_LOOP_AMPLIFICATION_AMOUNT);
  return { combatState: state, amount };
}

/** Shared by both tick drivers below: walks the tick list stored at
 * `combatState.sides[storageSide][listKey]`, applying `tickOnce` to
 * decide how many times (0 or more) each tick fires this pass, pushing
 * once per fire and decrementing remainingDuration, dropping any tick
 * whose duration is exhausted. */
function processTickList(
  combatState: CombatState,
  storageSide: PlayerIndex,
  listKey: 'dots' | 'hots',
  tickOnce: (tick: ActiveTick) => { fires: number; updated: ActiveTick },
): CombatState {
  let state = combatState;
  const remaining: ActiveTick[] = [];
  for (const tick of state.sides[storageSide][listKey]) {
    const { fires, updated } = tickOnce(tick);
    let remainingDuration = updated.remainingDuration;
    for (let n = 0; n < fires && remainingDuration > 0; n++) {
      state = applyTickPush(state, tick, listKey);
      remainingDuration -= 1;
    }
    if (remainingDuration > 0) {
      remaining.push({ ...updated, remainingDuration });
    } else {
      const extended = applyEnemyOnTickExpiringPassives(state, tick, listKey);
      state = extended.combatState;
      if (extended.extend) {
        remaining.push({ ...updated, remainingDuration: 1 });
      } else {
        const modExtended = applyModOnTickExpiringPassives(state, tick);
        state = modExtended.combatState;
        if (modExtended.extend) remaining.push({ ...updated, ...modExtended.tickPatch, remainingDuration: 1 });
      }
    }
  }
  const sideState = state.sides[storageSide];
  state = { ...state, sides: replaceSide(state.sides, storageSide, { ...sideState, [listKey]: remaining }) };
  return state;
}

/**
 * Ticks every active caster's-turn-pulse dot/hot whose caster is `side`
 * -- call whenever `side` gets a turn, alongside fireReadySubroutines.
 * Dots this side applied to the opponent live on the opponent's `dots`
 * array; hots this side applied to themself live on their own `hots`.
 */
export function tickCastersTurnPulse(combatState: CombatState, side: PlayerIndex): CombatState {
  const tickOnce = (tick: ActiveTick) => ({
    fires: tick.cadence === 'castersTurnPulse' && tick.casterSide === side ? 1 : 0,
    updated: tick,
  });
  let state = combatState;
  state = processTickList(state, opponentOf(side), 'dots', tickOnce);
  state = processTickList(state, side, 'hots', tickOnce);
  return state;
}

/**
 * Feeds `points` (one scoring occurrence's magnitude, "combined points
 * scored by either side" per DESIGN.md) into every active globalPulse
 * dot/hot on both sides, ticking however many times the accumulated
 * total crosses `pointsPerTick` -- a single large occurrence can trigger
 * more than one tick, mirroring gauges.ts's addPoints overflow-carry
 * pattern. Call once per occurrence, regardless of which side scored it.
 */
export function tickGlobalPulse(combatState: CombatState, points: number): CombatState {
  if (points <= 0) return combatState;
  const tickOnce = (tick: ActiveTick) => {
    if (tick.cadence !== 'globalPulse' || !tick.pointsPerTick) return { fires: 0, updated: tick };
    const total = (tick.accumulatedPoints ?? 0) + points;
    const fires = Math.floor(total / tick.pointsPerTick);
    const accumulatedPoints = total - fires * tick.pointsPerTick;
    return { fires, updated: { ...tick, accumulatedPoints } };
  };
  let state = combatState;
  for (const storageSide of [0, 1] as PlayerIndex[]) {
    state = processTickList(state, storageSide, 'dots', tickOnce);
    state = processTickList(state, storageSide, 'hots', tickOnce);
  }
  return state;
}

/**
 * Decrements every active debuff's remainingDuration by 1 -- debuff
 * duration is measured in hands (unlike DoT/HoT ticks, which are
 * measured in actual applications), so call once per hand alongside
 * resolvePendingSabotage. Removes any debuff that expires; a Choked
 * debuff expiring reverts the gauge-threshold bump it applied when cast
 * (see the 'debuff' case in resolvePayload) -- it's temporary, unlike
 * Root's permanent enemyGaugeThreshold manipulation.
 */
export function tickDebuffDurations(combatState: CombatState): CombatState {
  let state = combatState;
  for (const side of [0, 1] as PlayerIndex[]) {
    const sideState = state.sides[side];
    const remaining: ActiveDebuff[] = [];
    let gauge = sideState.gauge;
    for (const debuff of sideState.debuffs) {
      const remainingDuration = debuff.remainingDuration - 1;
      if (remainingDuration > 0) {
        remaining.push({ ...debuff, remainingDuration });
      } else if (debuff.debuffId === 'choked') {
        // Floored at MIN_INITIATIVE_THRESHOLD -- see that constant's own
        // doc comment for the real hang this guards against.
        gauge = { ...gauge, threshold: Math.max(MIN_INITIATIVE_THRESHOLD, gauge.threshold - debuff.magnitude) };
      }
    }
    state = { ...state, sides: replaceSide(state.sides, side, { ...sideState, debuffs: remaining, gauge }) };
  }
  return state;
}

/**
 * Resolves and clears every pending Scheduled Sabotage effect -- call
 * once at the start of each hand (the "next deal" after they were
 * registered, per ScheduledSabotagePayload.resolvesAt). Each wrapped
 * effect resolves through the normal resolvePayload path using the
 * archetype/caster captured at registration time, so a wrapped effect
 * that's itself a scheduledSabotage just re-schedules for a future deal
 * rather than needing special-casing -- the fresh, empty
 * pendingSabotage list this starts from only accumulates entries meant
 * for a later resolution, never colliding with the batch being cleared.
 */
export function resolvePendingSabotage(combatState: CombatState): CombatState {
  let state = { ...combatState, pendingSabotage: [] as PendingSabotage[] };
  for (const pending of combatState.pendingSabotage) {
    state = resolvePayload(pending.effect, pending.archetype, state, pending.casterSide);
  }
  return state;
}

/** What this hand's discard/cut should do differently, derived from
 * whichever Cribbage-layer manipulations were pending -- combat.ts uses
 * this to construct the discardStrategy/cutStrategy it passes into
 * playOneHand, since those can't be resolved as ordinary CombatState
 * mutations (they influence game.ts's card-dealing mechanics instead).
 * If more than one forceDiscard or skewCut somehow queued for the same
 * hand, the last one processed wins -- stacking either in one deal is
 * expected to be rare, and there's no meaningful way to "stack" a
 * forced discard or cut bias further anyway. */
export interface CribbageManipulationForHand {
  forcedDiscardSide?: PlayerIndex;
  cutBias?: 'towardJack' | 'awayFromJack';
}

/**
 * Consumes and clears combatState.pendingCribbageManipulation. markSuit
 * applies its suit-tally credit immediately, right here, same as any
 * other instant CombatState effect. forceDiscard/skewCut can't apply to
 * CombatState directly, so they're returned as data for combat.ts to
 * build this hand's discard/cut strategies from. peekCrib has no
 * mechanical effect in this engine (see
 * CribbageLayerManipulationPayload's doc comment) and is simply
 * dropped.
 */
export function consumePendingCribbageManipulation(
  combatState: CombatState,
  handDealer: PlayerIndex,
): { combatState: CombatState; forHand: CribbageManipulationForHand } {
  let state = { ...combatState, pendingCribbageManipulation: [] as PendingCribbageManipulation[] };
  const forHand: CribbageManipulationForHand = {};
  for (const pending of combatState.pendingCribbageManipulation) {
    switch (pending.action) {
      case 'forceDiscard':
        forHand.forcedDiscardSide = opponentOf(pending.casterSide);
        break;
      case 'skewCut':
        // His Heels only ever credits the dealer, so the bias always
        // favors the caster: toward a Jack if they're dealing this
        // hand, away from one otherwise.
        forHand.cutBias = pending.casterSide === handDealer ? 'towardJack' : 'awayFromJack';
        break;
      case 'markSuit':
        if (pending.suit !== undefined) {
          state = applySuitTallyCredit(state, pending.casterSide, pending.suit);
        }
        break;
      case 'peekCrib':
        break;
    }
  }
  return { combatState: state, forHand };
}

function applySuitTallyCredit(combatState: CombatState, side: PlayerIndex, suit: Suit): CombatState {
  const sideState = combatState.sides[side];
  const multiplier = accumulatorThresholdMultiplier(combatState, side);
  const loadout = sideState.loadout.map((entry) => ({
    ...entry,
    state: updateSuitTallyState(entry.state, entry.definition, { suit, player: side }, side, multiplier),
  }));
  return { ...combatState, sides: replaceSide(combatState.sides, side, { ...sideState, loadout }) };
}

/** Session 28's Neutral Archetype (Circuit Breaker): advances every
 * mitigationBanked Accumulator subroutine on `side`'s own loadout by
 * `amount`, called wherever that side casts Ward/instantCounterPush/hot
 * -- parallel to applySuitTallyCredit above. */
function creditMitigationBanked(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  const sideState = combatState.sides[side];
  const multiplier = accumulatorThresholdMultiplier(combatState, side);
  const loadout = sideState.loadout.map((entry) => ({
    ...entry,
    state: updateMitigationBankedState(entry.state, entry.definition, amount, multiplier),
  }));
  return { ...combatState, sides: replaceSide(combatState.sides, side, { ...sideState, loadout }) };
}

export interface FireEvent {
  subroutineId: string;
  side: PlayerIndex;
  payload: PayloadEffect;
}

/**
 * Iterates `side`'s loadout top-to-bottom, firing every subroutine that
 * is both ready and not toggled off. Chained triggers fed by an earlier
 * fire in this same pass are re-evaluated for later subroutines
 * immediately (loadout-order sequencing), but each subroutine is only
 * evaluated once per pass -- not re-scanned after firing.
 */
export function fireReadySubroutines(
  combatState: CombatState,
  side: PlayerIndex,
  selfContext: { isDealer: boolean },
): { combatState: CombatState; events: FireEvent[] } {
  let state = combatState;
  const events: FireEvent[] = [];
  const firedIds = new Set<string>();
  const loadoutLength = state.sides[side].loadout.length;

  for (let i = 0; i < loadoutLength; i++) {
    const entry = state.sides[side].loadout[i];
    // firesAt-tagged entries only ever fire via fireHandLifecycleSubroutines
    // below, never via the normal turn-gate.
    if (entry.definition.firesAt) continue;
    const triggerContext = buildTriggerContext(state, side, firedIds, selfContext.isDealer);
    if (!isReady(entry.definition, entry.state, triggerContext)) continue;
    if (!entry.state.toggledOn) continue;

    state = resolvePayload(
      entry.definition.payload,
      entry.definition.archetype,
      state,
      side,
      { priorFireCountThisTurn: events.length },
      entry.definition,
    );
    events.push({ subroutineId: entry.definition.id, side, payload: entry.definition.payload });
    firedIds.add(entry.definition.id);
    state = updateLoadoutEntryState(state, side, i, resetAfterFire(entry.state));
  }

  return { combatState: state, events };
}

/**
 * Fires every ready, not-toggled-off subroutine on `side` whose
 * `firesAt` matches `moment` -- the Root mechanical redesign's engine
 * seam (session 24 checkpoint B), driven from combat.ts at the three
 * real Cribbage lifecycle points (deal, crib selection, play-phase
 * start) rather than the normal turn-gate. Readiness (via the normal
 * trigger-family evaluation) still governs whether an entry is *armed*
 * -- most `firesAt` content is expected to use `{ kind: 'always' }` so
 * it's simply always armed, but nothing stops a more conditional
 * trigger from gating one. Mirrors fireReadySubroutines' shape closely,
 * minus per-pass chained-trigger bookkeeping (EMPTY_FIRED_SET) -- a
 * hand-lifecycle moment isn't "anyone's turn," so chaining within the
 * same pass isn't a concept that applies here yet.
 */
export function fireHandLifecycleSubroutines(
  combatState: CombatState,
  side: PlayerIndex,
  moment: HandLifecycleMoment,
  selfContext: { isDealer: boolean },
  revealedCards?: Card[],
  targetIsOwnCrib?: boolean,
): { combatState: CombatState; events: FireEvent[] } {
  let state = combatState;
  const events: FireEvent[] = [];
  const loadoutLength = state.sides[side].loadout.length;

  for (let i = 0; i < loadoutLength; i++) {
    const entry = state.sides[side].loadout[i];
    if (entry.definition.firesAt !== moment) continue;
    const triggerContext = buildTriggerContext(state, side, EMPTY_FIRED_SET, selfContext.isDealer);
    if (!isReady(entry.definition, entry.state, triggerContext)) continue;
    if (!entry.state.toggledOn) continue;

    state = resolvePayload(
      entry.definition.payload,
      entry.definition.archetype,
      state,
      side,
      { priorFireCountThisTurn: events.length, revealedCards, targetIsOwnCrib },
      entry.definition,
    );
    events.push({ subroutineId: entry.definition.id, side, payload: entry.definition.payload });
    state = updateLoadoutEntryState(state, side, i, resetAfterFire(entry.state));
  }

  return { combatState: state, events };
}
