import type { PeggingEvent, PlayerIndex } from './pegging';
import type { HandScoreEvent } from './scoring';
import type { Suit } from './cards';
import type {
  AlwaysTrigger,
  Archetype,
  ChainedTrigger,
  EnemyStateTrigger,
  OccurrenceCategory,
  SelfStateTrigger,
  SubroutineDefinition,
  Tag,
} from './subroutine-types';

/**
 * Per-subroutine-instance runtime state (one per subroutine in a
 * loadout, carried across the whole match). `ready` is sticky once set —
 * it only clears via resetAfterFire, called once the subroutine has
 * actually fired.
 */
export interface SubroutineRuntimeState {
  accumulatedProgress: number;
  bankedOccurrences: number;
  ready: boolean;
  toggledOn: boolean;
  /** Last-known live truth value of a selfState/enemyState condition —
   * only meaningful for Reactive subroutines on those two trigger
   * families, used to arm edge-triggered (rising-edge only) instead of
   * refiring on every continuous-evaluation pass while the condition
   * stays true. Ignored by every other trigger family and by
   * non-Reactive subroutines. */
  lastConditionTrue: boolean;
  /** How many times this subroutine has actually fired so far this
   * combat (session 39) — incremented in resetAfterFire, checked against
   * SubroutineDefinition.maxFiresPerCombat wherever that cap applies.
   * Tracked for every subroutine unconditionally (cheap), even though
   * only a `maxFiresPerCombat`-bearing definition ever reads it. */
  fireCount: number;
  /** Points this side must still score before this piece may fire again
   * (session 47) -- set from SubroutineDefinition.pointsCooldown on each
   * fire, ticked down by the owning side's own scoring occurrences, and
   * checked in isReady. 0 means no cooldown outstanding, which is also
   * the starting state, so a piece is never gated before its first
   * fire. */
  cooldownRemaining: number;
}

export function createInitialState(): SubroutineRuntimeState {
  return { accumulatedProgress: 0, bankedOccurrences: 0, ready: false, toggledOn: true, lastConditionTrue: false, fireCount: 0, cooldownRemaining: 0 };
}

/** Clears banked/accumulated progress and the ready flag after an actual
 * fire — DESIGN.md's universal "fire, then reset and wait again" rule,
 * shared by every trigger family that banks anything. Does not touch
 * `toggledOn`, a separate manual switch, or `lastConditionTrue`, which
 * must survive the fire/reset boundary for edge-detection to keep
 * working correctly (resetting it would look like a false→true
 * transition on the very next check if the condition is still true).
 * Does increment `fireCount` — this function is only ever called once a
 * fire has genuinely happened (see its call sites in resolve.ts), and
 * arms `pointsCooldown` for the same reason. */
export function resetAfterFire(state: SubroutineRuntimeState, pointsCooldown = 0): SubroutineRuntimeState {
  return {
    ...state,
    accumulatedProgress: 0,
    bankedOccurrences: 0,
    ready: false,
    fireCount: state.fireCount + 1,
    cooldownRemaining: pointsCooldown,
  };
}

/**
 * The unification point DESIGN.md calls for: a single occurrence shape
 * fed by both the pegging play phase and the show/count phase, so
 * Occurrence triggers don't need separate play-vs-show variants.
 */
export interface ScoringOccurrence {
  category: OccurrenceCategory;
  player: PlayerIndex;
  magnitude: number;
}

/** Adapts pegging events into occurrences. Only 'play' (via its
 * breakdown) and 'go-point' events produce occurrences — a bare 'go'
 * (pass) scores nothing. */
export function occurrencesFromPeggingEvent(event: PeggingEvent): ScoringOccurrence[] {
  if (event.type === 'play') {
    const { breakdown, player } = event;
    const occurrences: ScoringOccurrence[] = [];
    if (breakdown.fifteen > 0) occurrences.push({ category: 'fifteen', player, magnitude: breakdown.fifteen });
    if (breakdown.pair > 0) occurrences.push({ category: 'pair', player, magnitude: breakdown.pair });
    if (breakdown.run > 0) occurrences.push({ category: 'run', player, magnitude: breakdown.run });
    if (breakdown.thirtyOne > 0) occurrences.push({ category: 'thirtyOne', player, magnitude: breakdown.thirtyOne });
    return occurrences;
  }
  if (event.type === 'go-point') {
    return [{ category: 'go', player: event.player, magnitude: 1 }];
  }
  return [];
}

const HAND_EVENT_CATEGORY: Record<HandScoreEvent['category'], OccurrenceCategory> = {
  fifteen: 'fifteen',
  pair: 'pair',
  run: 'run',
  flush: 'flush',
  nobs: 'hisNobs',
};

/**
 * Adapts the show/count phase's discrete event list (scoring.ts's
 * countHandEvents/countCribEvents) into occurrences, one-to-one — unlike
 * a lumped breakdown, this correctly produces 2 separate 'fifteen'
 * occurrences for 2 distinct 15-combinations in the same hand, or 2
 * separate 'pair' occurrences for 2 different-rank pairs, while still
 * keeping a pair royal as the single magnitude-variant event it already
 * is at the scoring.ts level.
 */
export function occurrencesFromHandEvents(events: HandScoreEvent[], player: PlayerIndex): ScoringOccurrence[] {
  return events.map((event) => ({
    category: HAND_EVENT_CATEGORY[event.category],
    player,
    magnitude: event.points,
  }));
}

/** His Heels scores at the cut, not from either breakdown — sourced
 * directly from deal.ts's hisHeels(), always credited to the dealer. */
export function occurrenceFromHisHeels(heelsPoints: number, dealer: PlayerIndex): ScoringOccurrence | null {
  return heelsPoints > 0 ? { category: 'hisHeels', player: dealer, magnitude: heelsPoints } : null;
}

/** A card of a given suit being played during pegging — the signal
 * suit-tally Accumulators watch. Deliberately separate from
 * ScoringOccurrence: a play that scores nothing still counts toward a
 * suit tally, but produces no ScoringOccurrence at all (see
 * occurrencesFromPeggingEvent above), so suit-tally can't be threaded
 * through that stream. Scoped to pegging plays only, not the show/count
 * phase's hand/crib cards -- extracting per-card suit info from
 * scoring.ts's combinatorial fifteen/pair/run event generation would be
 * a much larger rework of already-tested Phase 1 code for a currently
 * unused, untuned mechanic; a real gap if the show phase turns out to
 * matter later, not this checkpoint's job. */
export interface SuitPlayed {
  suit: Suit;
  player: PlayerIndex;
}

/** Adapts a pegging event into a suit-played signal, independent of
 * whether the play scored anything. Null for non-play pegging events
 * (go/go-point) and implicitly for the show phase (no adapter exists
 * for it -- see SuitPlayed's own doc comment). */
export function suitPlayedFromPeggingEvent(event: PeggingEvent): SuitPlayed | null {
  return event.type === 'play' ? { suit: event.card.suit, player: event.player } : null;
}

/**
 * Advances a suitTally Accumulator subroutine's banked progress from one
 * card played of a given suit -- parallel to updateSubroutineState
 * below, which only handles points-based Accumulator/Occurrence progress
 * from scoring events. No-op for every other trigger kind/metric, a
 * suitTally trigger watching a different suit, or a play belonging to
 * the other side.
 */
/** `thresholdMultiplier` (Phase 5 Mods checkpoint C, session 33's 12th
 * hook, `onTriggerEvaluate`): Overclocked Accumulator scales an
 * Accumulator trigger's effective threshold before this comparison,
 * rather than intercepting `triggers.ts`'s `isReady` (which only reads
 * an already-latched boolean) -- see mods.ts's OVERCLOCKED_ACCUMULATOR_REDUCTION.
 * Defaults to 1 (no change) for every caller that doesn't own the Mod. */
export function updateSuitTallyState(
  state: SubroutineRuntimeState,
  definition: SubroutineDefinition,
  suitPlayed: SuitPlayed,
  side: PlayerIndex,
  thresholdMultiplier: number = 1,
): SubroutineRuntimeState {
  if (suitPlayed.player !== side) return state;
  const trigger = definition.trigger;
  if (trigger.kind !== 'accumulator' || trigger.metric !== 'suitTally' || trigger.suit !== suitPlayed.suit) return state;
  const accumulatedProgress = state.accumulatedProgress + 1;
  return { ...state, accumulatedProgress, ready: state.ready || accumulatedProgress >= trigger.threshold * thresholdMultiplier };
}

/**
 * Advances a mitigationBanked Accumulator subroutine's banked progress
 * by `amount` -- session 28's Neutral Archetype (Circuit Breaker), fed
 * from resolve.ts's creditMitigationBanked whenever the *same side*
 * casts a Ward/instantCounterPush/hot payload, parallel to
 * updateSuitTallyState above (a non-scoring-event-driven Accumulator
 * variant). No-op for every other trigger kind/metric.
 */
export function updateMitigationBankedState(
  state: SubroutineRuntimeState,
  definition: SubroutineDefinition,
  amount: number,
  thresholdMultiplier: number = 1,
): SubroutineRuntimeState {
  const trigger = definition.trigger;
  if (trigger.kind !== 'accumulator' || trigger.metric !== 'mitigationBanked' || amount <= 0) return state;
  const accumulatedProgress = state.accumulatedProgress + amount;
  return { ...state, accumulatedProgress, ready: state.ready || accumulatedProgress >= trigger.threshold * thresholdMultiplier };
}

/**
 * Advances an Accumulator or Occurrence subroutine's banked progress
 * from one incoming occurrence. Occurrences belonging to the other side
 * are ignored — both families are scoped to the caster's own scoring
 * (DESIGN.md). No-op for the other 4 trigger families, which aren't
 * occurrence-driven — see evaluateSelfState/evaluateEnemyState/
 * evaluateChained/evaluateAlways below.
 */
export function updateSubroutineState(
  state: SubroutineRuntimeState,
  definition: SubroutineDefinition,
  occurrence: ScoringOccurrence,
  side: PlayerIndex,
  thresholdMultiplier: number = 1,
  /** Threshold Exploit's onTriggerEvaluate hook (session 44) -- a flat
   * fraction shaved off an Occurrence-Threshold trigger's own bankTarget,
   * floored at 1 (a subroutine can never need *zero* banked occurrences).
   * Independent from thresholdMultiplier above, which only ever applies
   * to Accumulator's raw-magnitude threshold -- Occurrence's bankTarget
   * is a small integer count, a different shape that needs its own
   * reduction rather than reusing the multiplier verbatim. */
  occurrenceBankTargetReduction: number = 0,
): SubroutineRuntimeState {
  if (occurrence.player !== side) return state;

  // Points cooldown (session 47) ticks on this side's own real scoring,
  // whatever the trigger family -- deliberately ahead of the per-family
  // branching below, which returns early for kinds that bank nothing.
  if (state.cooldownRemaining > 0) {
    state = { ...state, cooldownRemaining: Math.max(0, state.cooldownRemaining - occurrence.magnitude) };
  }

  const trigger = definition.trigger;

  if (trigger.kind === 'accumulator') {
    // suitTally is handled by the separate updateSuitTallyState above,
    // fed from actual card plays rather than scoring occurrences.
    if (trigger.metric !== 'points') return state;
    const accumulatedProgress = state.accumulatedProgress + occurrence.magnitude;
    return { ...state, accumulatedProgress, ready: state.ready || accumulatedProgress >= trigger.threshold * thresholdMultiplier };
  }

  if (trigger.kind === 'occurrence') {
    if (occurrence.category !== trigger.category) return state;
    if (trigger.variation === 'instant') {
      return { ...state, ready: true };
    }
    const bankedOccurrences =
      trigger.variation === 'scaling'
        ? Math.min(state.bankedOccurrences + 1, trigger.cap)
        : state.bankedOccurrences + 1;
    const effectiveBankTarget =
      trigger.variation === 'threshold' ? Math.max(1, Math.round(trigger.bankTarget * (1 - occurrenceBankTargetReduction))) : 0;
    const ready = trigger.variation === 'threshold' ? bankedOccurrences >= effectiveBankTarget : true;
    return { ...state, bankedOccurrences, ready: state.ready || ready };
  }

  return state;
}

export interface SelfStateContext {
  /** Trace -- in-fight noise, not the run's Heat. See
   * resolve.ts's CombatSideState.trace. */
  trace: number;
  isDealer: boolean;
}

export interface EnemyStateContext {
  breachContainment: number;
  gaugeFillFraction: number;
  activeDebuffIds: string[];
}

export function evaluateSelfState(trigger: SelfStateTrigger, context: SelfStateContext): boolean {
  switch (trigger.condition) {
    case 'traceAbove':
      return context.trace > trigger.value;
    case 'traceBelow':
      return context.trace < trigger.value;
    case 'isDealer':
      return context.isDealer;
    case 'isNonDealer':
      return !context.isDealer;
  }
}

export function evaluateEnemyState(trigger: EnemyStateTrigger, context: EnemyStateContext): boolean {
  switch (trigger.condition) {
    case 'breachContainmentBelow':
      return context.breachContainment < trigger.value;
    case 'breachContainmentAbove':
      return context.breachContainment > trigger.value;
    case 'gaugeFillAbove':
      return context.gaugeFillFraction > trigger.fraction;
    case 'hasDebuff':
      if (trigger.debuffId === 'any') return context.activeDebuffIds.length > 0;
      return context.activeDebuffIds.includes(trigger.debuffId);
  }
}

/** What's needed to evaluate any of ChainedTrigger's three match modes
 * against a piece that fired earlier in the current turn's own pass. */
export interface FiredSubroutineInfo {
  id: string;
  archetype: Archetype;
  tags: Tag[];
}

/** A chained subroutine becomes ready the moment something matching its
 * chosen match mode (id / archetype / tag — session 41) fires, within the
 * same turn's resolution pass. */
export function evaluateChained(trigger: ChainedTrigger, firedThisTurn: readonly FiredSubroutineInfo[]): boolean {
  if ('afterSubroutineId' in trigger) return firedThisTurn.some((f) => f.id === trigger.afterSubroutineId);
  if ('afterArchetype' in trigger) return firedThisTurn.some((f) => f.archetype === trigger.afterArchetype);
  return firedThisTurn.some((f) => f.tags.includes(trigger.afterTag));
}

export function evaluateAlways(_trigger: AlwaysTrigger): boolean {
  return true;
}

export interface TriggerContext {
  self: SelfStateContext;
  enemy: EnemyStateContext;
  firedThisTurn: readonly FiredSubroutineInfo[];
}

/** The single entry point turn-resolution logic (Checkpoint E) uses to
 * decide whether a subroutine fires: banked state for accumulator/
 * occurrence/self-state/enemy-state (all four now latch `ready` via
 * banked progress or refreshTriggerReadiness below, rather than being
 * live-checked here), live context evaluation only for chained/always
 * (no banked state to latch -- a chain reference or "always" is
 * meaningless to cache).
 *
 * Self-state/enemy-state used to be live-checked right here, only at
 * fire time -- which missed real cases: a condition (e.g. the enemy's
 * gauge sitting above some fraction) could be true for a genuine
 * stretch of game-time and revert before this side's own turn ever came
 * up to check it, silently losing the opportunity even though the
 * condition really was true at some point. refreshTriggerReadiness
 * fixes this by latching `ready` the moment the condition is ever true
 * -- the same "banked, not re-checked" semantics accumulator/occurrence
 * already had. */
export function isReady(
  definition: SubroutineDefinition,
  state: SubroutineRuntimeState,
  context: TriggerContext,
): boolean {
  // maxFiresPerCombat (session 39) was only ever enforced on the reactive
  // selfState/enemyState path (resolve.ts) and the rareOccurrence/
  // handOutcome paths (fireRareOccurrenceSubroutines/
  // fireHandOutcomeSubroutines) -- SubroutineDefinition's own doc comment
  // flagged this as a known gap ("not yet checked for accumulator/
  // occurrence trigger re-arming; extend there too if a future piece
  // needs the same cap on a non-reactive trigger"). Session 43 hit it for
  // real: an occurrence:threshold gatekeeper piece with an uncapped
  // permanent-threshold-raise payload turned out to be a genuine runaway
  // spiral over a long fight (found via a real regression sweep, not
  // theorized) once maxFiresPerCombat alone on the definition didn't
  // actually stop it. Checked here, the one real choke point every normal
  // (non-reactive, non-rareOccurrence/handOutcome) firing path already
  // funnels through, so the cap now applies uniformly regardless of
  // trigger kind instead of needing a bespoke check per family.
  if (definition.maxFiresPerCombat !== undefined && state.fireCount >= definition.maxFiresPerCombat) return false;
  // Points cooldown (session 47) -- checked at the same choke point and
  // for the same reason as the cap above: it has to hold regardless of
  // trigger family, and this is where every normal firing path converges.
  if (state.cooldownRemaining > 0) return false;
  const trigger = definition.trigger;
  switch (trigger.kind) {
    case 'accumulator':
    case 'occurrence':
    case 'selfState':
    case 'enemyState':
      return state.ready;
    case 'chained':
      return evaluateChained(trigger, context.firedThisTurn);
    case 'always':
      return evaluateAlways(trigger);
    case 'rareOccurrence':
    case 'handOutcome':
      // Never ready via the normal pipeline (session 40 continued) --
      // both bypass it entirely, fired directly by
      // resolve.ts's fireRareOccurrenceSubroutines/
      // fireHandOutcomeSubroutines instead. Neither has anything to do
      // with turn-based readiness.
      return false;
  }
}
