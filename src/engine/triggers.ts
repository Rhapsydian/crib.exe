import type { PeggingEvent, PlayerIndex } from './pegging';
import type { HandScoreBreakdown } from './scoring';
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
}

export function createInitialState(): SubroutineRuntimeState {
  return { accumulatedProgress: 0, bankedOccurrences: 0, ready: false, toggledOn: true };
}

/** Clears banked/accumulated progress and the ready flag after an actual
 * fire — DESIGN.md's universal "fire, then reset and wait again" rule,
 * shared by every trigger family that banks anything. Does not touch
 * `toggledOn`, which is a separate manual switch. */
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

/** Adapts a show/count-phase hand or crib breakdown into occurrences. */
export function occurrencesFromHandBreakdown(
  breakdown: HandScoreBreakdown,
  player: PlayerIndex,
): ScoringOccurrence[] {
  const occurrences: ScoringOccurrence[] = [];
  if (breakdown.fifteens > 0) occurrences.push({ category: 'fifteen', player, magnitude: breakdown.fifteens });
  if (breakdown.pairs > 0) occurrences.push({ category: 'pair', player, magnitude: breakdown.pairs });
  if (breakdown.runs > 0) occurrences.push({ category: 'run', player, magnitude: breakdown.runs });
  if (breakdown.flush > 0) occurrences.push({ category: 'flush', player, magnitude: breakdown.flush });
  if (breakdown.nobs > 0) occurrences.push({ category: 'hisNobs', player, magnitude: breakdown.nobs });
  return occurrences;
}

/** His Heels scores at the cut, not from either breakdown — sourced
 * directly from deal.ts's hisHeels(), always credited to the dealer. */
export function occurrenceFromHisHeels(heelsPoints: number, dealer: PlayerIndex): ScoringOccurrence | null {
  return heelsPoints > 0 ? { category: 'hisHeels', player: dealer, magnitude: heelsPoints } : null;
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
    // Suit-tally wiring needs suit-level scoring info no adapter above
    // produces yet — a later content pass, not this checkpoint's job.
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
  controlBreach: number;
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
    case 'controlBreachBelow':
      return context.controlBreach < trigger.value;
    case 'controlBreachAbove':
      return context.controlBreach > trigger.value;
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
 * occurrence families, live context evaluation for the other four. */
export function isReady(
  definition: SubroutineDefinition,
  state: SubroutineRuntimeState,
  context: TriggerContext,
): boolean {
  const trigger = definition.trigger;
  switch (trigger.kind) {
    case 'accumulator':
    case 'occurrence':
      return state.ready;
    case 'selfState':
      return evaluateSelfState(trigger, context.self);
    case 'enemyState':
      return evaluateEnemyState(trigger, context.enemy);
    case 'chained':
      return evaluateChained(trigger, context.firedSubroutineIdsThisTurn);
    case 'always':
      return evaluateAlways(trigger);
  }
}
