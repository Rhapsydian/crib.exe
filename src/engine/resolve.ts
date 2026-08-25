import type { PlayerIndex } from './pegging';
import type { Card, Suit } from './cards';
import type { Archetype, DebuffKind, HandLifecycleMoment, PayloadEffect, SubroutineDefinition, TickCadence } from './subroutine-types';
import type { ClassId } from './classes';
import { easeTriggerCondition } from './merge';
import {
  createInitialState,
  evaluateEnemyState,
  evaluateSelfState,
  isReady,
  resetAfterFire,
  updateSuitTallyState,
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
): CombatState {
  return {
    sides: [
      createCombatSideState(playerLoadout, gaugeThreshold, winThreshold),
      createCombatSideState(enemyLoadout, gaugeThreshold, winThreshold),
    ],
    pendingSabotage: [],
    pendingCribbageManipulation: [],
    classId,
    passiveTriggered: false,
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
 * route through this. */
function creditWinGauge(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  if (amount <= 0) return combatState;
  const sideState = combatState.sides[side];
  const { gauge } = addDuelProgress(sideState.winGauge, amount);
  const sides = replaceSide(combatState.sides, side, { ...sideState, winGauge: gauge });
  return { ...combatState, sides };
}

/** Reduces `side`'s own winGauge by `amount` -- Encryption's mitigation
 * tools (HoT, instantCounterPush) call this against the *opponent's*
 * gauge, never their own. Floored at 0 by gauges.ts's reduceDuelProgress
 * -- no upper cap needed the way the old shared scalar's midpoint was. */
function reduceWinGauge(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
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

/** Floor for ownGaugeThreshold's reduction (session 24 haste) -- must
 * stay above 0, since gauges.ts's addPoints loops "while progress >=
 * threshold," and a threshold of exactly 0 would loop forever the next
 * time any points at all are credited. TBD/playtesting beyond that hard
 * floor. */
const HASTE_MIN_INITIATIVE_THRESHOLD = 1;

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
const PRIMED_THRESHOLD_REDUCTION = 2; // TBD/playtesting
const FEEDBACK_LOOP_DOT_AMOUNT = 2; // TBD/playtesting
const RETURN_TO_SENDER_RATIO = 0.5; // TBD/playtesting -- portion of absorbed amount redirected to Ghost's own gauge

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

/** Operator's Primed: the first time a Root subroutine fires this
 * combat, reduce the next Exploit subroutine's trigger threshold --
 * "next" taken as the first Exploit-archetype entry in the caster's own
 * loadout, by array order (there's no other natural "next" to pick
 * against, since firing order isn't itself sequenced by archetype).
 * Applies generically after any Root payload resolves, not gated by
 * payload kind, since Root's payload catalog spans several kinds.
 * Reuses merge.ts's easeTriggerCondition -- the same "make this
 * condition easier to satisfy" rule Merge's own trigger-knob fallback
 * uses (Accumulator's threshold, Occurrence: threshold's bankTarget,
 * Self-state's heatAbove/Below value). Occurrence: scaling and the
 * non-numeric trigger kinds have no such knob and are left untouched --
 * Primed still consumes its one-shot use, it just has nothing to
 * reduce against those shapes. Real effect depends on which Exploit
 * piece Operator's loadout actually has -- "infrastructure-complete,
 * content-partial," same as everywhere else this pattern shows up. */
function applyPrimedPassive(combatState: CombatState, firedArchetype: Archetype, caster: PlayerIndex): CombatState {
  if (firedArchetype !== 'root' || caster !== 0 || combatState.classId !== 'operator' || combatState.passiveTriggered) {
    return combatState;
  }
  const sideState = combatState.sides[0];
  const index = sideState.loadout.findIndex((entry) => entry.definition.archetype === 'exploit');
  if (index === -1) return { ...combatState, passiveTriggered: true };
  const entry = sideState.loadout[index];
  const loadout = sideState.loadout.slice();
  loadout[index] = { ...entry, definition: { ...entry.definition, trigger: easeTriggerCondition(entry.definition.trigger, PRIMED_THRESHOLD_REDUCTION) } };
  const sides = replaceSide(combatState.sides, 0, { ...sideState, loadout });
  return { ...combatState, sides, passiveTriggered: true };
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
  if (absorbed <= 0 || shieldOwnerSide !== 0 || combatState.classId !== 'ghost') return combatState;
  return creditWinGauge(combatState, 0, absorbed * RETURN_TO_SENDER_RATIO);
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
): CombatState {
  const base = resolvePayloadCore(payload, archetype, combatState, caster, context);
  return applyPrimedPassive(base, archetype, caster);
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
      const amount = payload.amount * corruptionMultiplier(combatState, caster);
      const targetState = combatState.sides[target];
      const { sideState, absorbed, remaining } = absorbWithShield(targetState, amount);
      const sides = replaceSide(combatState.sides, target, sideState);
      let state = { ...combatState, sides };
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
      const zeroDay = caster === 0 && combatState.classId === 'blackhat' && !combatState.passiveTriggered && payload.heatCost > 0;
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
      // Saboteur's Sleeper Cell: the first Malware debuff applied each
      // combat also advances the first Root subroutine in the caster's
      // own loadout, by array order (no fixed target the way Priority
      // Override has one).
      const sleeperCell = caster === 0 && archetype === 'malware' && combatState.classId === 'saboteur' && !combatState.passiveTriggered;
      if (!sleeperCell) return withDebuff;
      const advanced = advanceFirstMatchingSubroutine(withDebuff, 0, (def) => def.archetype === 'root', SLEEPER_CELL_ADVANCE_AMOUNT);
      return { ...advanced, passiveTriggered: true };
    }
    case 'instantCounterPush': {
      // Reduces the *opponent's* gauge directly -- Encryption's instant
      // mitigation tool, the one-shot counterpart to HoT's gradual
      // version. Not blockable by Ward: Ward protects against offense
      // that would credit the attacker's own gauge, and this is a
      // different kind of effect (direct suppression of the opponent's
      // progress, not gauge-seeking offense on the caster's behalf).
      const amount = payload.amount * corruptionMultiplier(combatState, caster);
      return reduceWinGauge(combatState, target, amount);
    }
    case 'ward': {
      const casterState = combatState.sides[caster];
      const sides = replaceSide(combatState.sides, caster, { ...casterState, wardShield: casterState.wardShield + payload.amount });
      return { ...combatState, sides };
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
      return { ...combatState, sides };
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
      // shouldn't outlive the debuff record that caused it.
      const gauge =
        removed.debuffId === 'choked'
          ? { ...casterState.gauge, threshold: casterState.gauge.threshold - removed.magnitude }
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
        // 0 (see HASTE_MIN_INITIATIVE_THRESHOLD's own comment for why
        // that specifically would be unsafe, not just undesirable).
        const casterState = combatState.sides[caster];
        const threshold = Math.max(HASTE_MIN_INITIATIVE_THRESHOLD, casterState.gauge.threshold - amount);
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

      state = resolvePayload(entry.definition.payload, entry.definition.archetype, state, side, {
        priorFireCountThisTurn: 0,
      });
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
 * frozen at registration), same as any other payload resolution. */
function applyTickPush(combatState: CombatState, tick: ActiveTick, listKey: 'dots' | 'hots'): CombatState {
  const amount = tick.amountPerTick * corruptionMultiplier(combatState, tick.casterSide);
  const state =
    listKey === 'hots' ? reduceWinGauge(combatState, opponentOf(tick.casterSide), amount) : creditWinGauge(combatState, tick.casterSide, amount);
  return applyFeedbackLoopPassive(state, tick, listKey);
}

/** Warden's Feedback Loop: every Encryption HoT tick also credits a
 * small, uncapped Malware-flavored bonus to the caster's own gauge --
 * persistent, unlike the 4 one-shot passives above, so not gated by
 * passiveTriggered. Only HoT ticks qualify; DoT ticks are already
 * uncapped Malware damage on their own, nothing to "add." */
function applyFeedbackLoopPassive(combatState: CombatState, tick: ActiveTick, listKey: 'dots' | 'hots'): CombatState {
  if (listKey !== 'hots' || tick.casterSide !== 0 || combatState.classId !== 'warden') return combatState;
  const amount = FEEDBACK_LOOP_DOT_AMOUNT * corruptionMultiplier(combatState, tick.casterSide);
  return creditWinGauge(combatState, tick.casterSide, amount);
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
    if (remainingDuration > 0) remaining.push({ ...updated, remainingDuration });
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
        gauge = { ...gauge, threshold: gauge.threshold - debuff.magnitude };
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
  const loadout = sideState.loadout.map((entry) => ({
    ...entry,
    state: updateSuitTallyState(entry.state, entry.definition, { suit, player: side }, side),
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

    state = resolvePayload(entry.definition.payload, entry.definition.archetype, state, side, {
      priorFireCountThisTurn: events.length,
    });
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

    state = resolvePayload(entry.definition.payload, entry.definition.archetype, state, side, {
      priorFireCountThisTurn: events.length,
      revealedCards,
      targetIsOwnCrib,
    });
    events.push({ subroutineId: entry.definition.id, side, payload: entry.definition.payload });
    state = updateLoadoutEntryState(state, side, i, resetAfterFire(entry.state));
  }

  return { combatState: state, events };
}
