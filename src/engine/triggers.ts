import type { PeggingEvent, PlayerIndex } from './pegging';
import type { HandScoreEvent } from './scoring';
import type { Suit } from './cards';
import type {
  AlwaysTrigger,
  ChainedTrigger,
  EnemyStateTrigger,
  OccurrenceCategory,
  SelfStateTrigger,
  SubroutineDefinition,
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
}

export function createInitialState(): SubroutineRuntimeState {
  return { accumulatedProgress: 0, bankedOccurrences: 0, ready: false, toggledOn: true, lastConditionTrue: false };
}

/** Clears banked/accumulated progress and the ready flag after an actual
 * fire — DESIGN.md's universal "fire, then reset and wait again" rule,
 * shared by every trigger family that banks anything. Does not touch
 * `toggledOn`, a separate manual switch, or `lastConditionTrue`, which
 * must survive the fire/reset boundary for edge-detection to keep
 * working correctly (resetting it would look like a false→true
 * transition on the very next check if the condition is still true). */
export function resetAfterFire(state: SubroutineRuntimeState): SubroutineRuntimeState {
  return { ...state, accumulatedProgress: 0, bankedOccurrences: 0, ready: false };
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
export function updateSuitTallyState(
  state: SubroutineRuntimeState,
  definition: SubroutineDefinition,
  suitPlayed: SuitPlayed,
  side: PlayerIndex,
): SubroutineRuntimeState {
  if (suitPlayed.player !== side) return state;
  const trigger = definition.trigger;
  if (trigger.kind !== 'accumulator' || trigger.metric !== 'suitTally' || trigger.suit !== suitPlayed.suit) return state;
  const accumulatedProgress = state.accumulatedProgress + 1;
  return { ...state, accumulatedProgress, ready: state.ready || accumulatedProgress >= trigger.threshold };
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
): SubroutineRuntimeState {
  if (occurrence.player !== side) return state;
  const trigger = definition.trigger;

  if (trigger.kind === 'accumulator') {
    // suitTally is handled by the separate updateSuitTallyState above,
    // fed from actual card plays rather than scoring occurrences.
    if (trigger.metric !== 'points') return state;
    const accumulatedProgress = state.accumulatedProgress + occurrence.magnitude;
    return { ...state, accumulatedProgress, ready: state.ready || accumulatedProgress >= trigger.threshold };
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
    const ready = trigger.variation === 'threshold' ? bankedOccurrences >= trigger.bankTarget : true;
    return { ...state, bankedOccurrences, ready: state.ready || ready };
  }

  return state;
}

export interface SelfStateContext {
  heat: number;
  isDealer: boolean;
}

export interface EnemyStateContext {
  breachContainment: number;
  gaugeFillFraction: number;
  activeDebuffIds: string[];
}

export function evaluateSelfState(trigger: SelfStateTrigger, context: SelfStateContext): boolean {
  switch (trigger.condition) {
    case 'heatAbove':
      return context.heat > trigger.value;
    case 'heatBelow':
      return context.heat < trigger.value;
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
      return context.activeDebuffIds.includes(trigger.debuffId);
  }
}

/** A chained subroutine becomes ready the moment the subroutine it
 * references fires, within the same turn's resolution pass. */
export function evaluateChained(trigger: ChainedTrigger, firedSubroutineIdsThisTurn: ReadonlySet<string>): boolean {
  return firedSubroutineIdsThisTurn.has(trigger.afterSubroutineId);
}

export function evaluateAlways(_trigger: AlwaysTrigger): boolean {
  return true;
}

export interface TriggerContext {
  self: SelfStateContext;
  enemy: EnemyStateContext;
  firedSubroutineIdsThisTurn: ReadonlySet<string>;
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
  const trigger = definition.trigger;
  switch (trigger.kind) {
    case 'accumulator':
    case 'occurrence':
    case 'selfState':
    case 'enemyState':
      return state.ready;
    case 'chained':
      return evaluateChained(trigger, context.firedSubroutineIdsThisTurn);
    case 'always':
      return evaluateAlways(trigger);
  }
}
