import type { PeggingEvent, PlayerIndex } from './pegging';
import type { HandScoreEvent } from './scoring';
import type { Suit } from './cards';
import {
  ARCHETYPE_SUITS,
  matchesSequence,
  type Beta,
  type BetaSource,
  type OccurrenceCategory,
  type SubroutineDefinition,
} from './subroutine-types';

/**
 * Beta criteria (session 51, A5): charge bookkeeping and condition
 * evaluation for a subroutine's beta. Nothing here decides *whether* a
 * piece acts -- since session 50's D11 every piece fires its alpha on
 * every turn its side gets. This decides whether the beta applies and how
 * hard, and is the descendant of D11-B's `chargesFor` and D15's "a
 * condition is a charge of 1".
 *
 * Charges come from the beta's source:
 *
 * - `cards` / `progress` bank a counter here, in SubroutineRuntimeState.
 * - `state` is evaluated live against a TriggerContext -- 1 while true.
 * - `sequence` is evaluated live against what fired earlier this turn.
 *
 * The old trigger families (`accumulator`, `occurrence` and its three
 * variations, `selfState`, `enemyState`, `chained`, `always`,
 * `rareOccurrence`, `handOutcome`) and the readiness latch that gated
 * firing on them are gone; see docs/archive/design-history.md.
 */

/** Per-subroutine-instance runtime state, one per loadout entry, carried
 * across the whole combat. */
export interface SubroutineRuntimeState {
  /** Charges banked toward the beta (cards/progress sources only).
   * Spent -- reset to 0 -- whenever the beta applies. */
  charges: number;
  /** Raw progress banked toward the *next* charge, for `progress`
   * sources: points scored, Ward absorbed, fires made. One charge per
   * `per` units; the remainder carries. */
  progressBank: number;
  /** Fires so far this combat (alpha fires, including immediate extra
   * fires). Checked against maxFiresPerCombat. */
  fireCount: number;
  /** Points this side must still score before this piece may fire again
   * (session 47's pointsCooldown). Ticked down by the owning side's own
   * scoring; 0 means no cooldown outstanding. */
  cooldownRemaining: number;
  /** Total alpha growth accrued so far (A5's `growth`), capped at the
   * alpha's `growthCap`. */
  growthTotal: number;
  /** Last-known truth of a `state` condition -- an `immediate` state beta
   * fires only on the false -> true edge, not on every check while the
   * condition stays true. */
  lastConditionTrue: boolean;
}

export function createInitialState(): SubroutineRuntimeState {
  return { charges: 0, progressBank: 0, fireCount: 0, cooldownRemaining: 0, growthTotal: 0, lastConditionTrue: false };
}

// ---------------------------------------------------------------------
// Scoring occurrences -- the one stream fed by both the pegging play
// phase and the show/count phase.
// ---------------------------------------------------------------------

/** Every scoring category the engine produces. His Heels still scores
 * real points -- so it still feeds the initiative gauge -- but is not a
 * category a beta can watch (OccurrenceCategory excludes it, A5). */
export type ScoringCategory = OccurrenceCategory | 'hisHeels';

export interface ScoringOccurrence {
  category: ScoringCategory;
  player: PlayerIndex;
  magnitude: number;
}

/** Adapts pegging events into occurrences. Only 'play' (via its
 * breakdown) and 'go-point' events produce occurrences -- a bare 'go'
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

/** Adapts the show/count phase's discrete event list one-to-one -- two
 * distinct 15-combinations are two 'fifteen' occurrences, while a pair
 * royal stays the single magnitude-variant event scoring.ts makes it. */
export function occurrencesFromHandEvents(events: HandScoreEvent[], player: PlayerIndex): ScoringOccurrence[] {
  return events.map((event) => ({ category: HAND_EVENT_CATEGORY[event.category], player, magnitude: event.points }));
}

/** His Heels scores at the cut, always for the dealer. */
export function occurrenceFromHisHeels(heelsPoints: number, dealer: PlayerIndex): ScoringOccurrence | null {
  return heelsPoints > 0 ? { category: 'hisHeels', player: dealer, magnitude: heelsPoints } : null;
}

/** A card of a given suit being played during pegging -- the signal a
 * `cards`/`suit` beta watches. Separate from ScoringOccurrence because a
 * play that scores nothing still counts toward a suit tally. Pegging
 * plays only, not the show phase (a deliberate scope limit inherited
 * from the old suit-tally accumulator). */
export interface SuitPlayed {
  suit: Suit;
  player: PlayerIndex;
}

export function suitPlayedFromPeggingEvent(event: PeggingEvent): SuitPlayed | null {
  return event.type === 'play' ? { suit: event.card.suit, player: event.player } : null;
}

// ---------------------------------------------------------------------
// Banking charges
// ---------------------------------------------------------------------

/** Adds `n` whole charges -- the Charge verb's entry point, and what every
 * banking path below funnels into. A beta whose source doesn't bank
 * (state/sequence) has nothing to hold charges, so this is a no-op for
 * it rather than a silent store nobody reads. */
export function addCharges(state: SubroutineRuntimeState, definition: SubroutineDefinition, n: number): SubroutineRuntimeState {
  const source = definition.beta?.source;
  if (n <= 0 || (source !== 'cards' && source !== 'progress')) return state;
  return { ...state, charges: state.charges + n };
}

/** Takes up to `n` banked charges away -- the Wipe verb (CP1), Charge's
 * opposite. Live sources hold none, so it can't touch them. */
export function removeCharges(state: SubroutineRuntimeState, n: number): SubroutineRuntimeState {
  if (n <= 0 || state.charges <= 0) return state;
  return { ...state, charges: Math.max(0, state.charges - n) };
}

/** Banks raw progress toward a `progress` beta of the given metric,
 * converting each whole `per` into a charge and carrying the remainder. */
function bankProgress(
  state: SubroutineRuntimeState,
  definition: SubroutineDefinition,
  metric: Extract<BetaSource, { source: 'progress' }>['metric'],
  amount: number,
): SubroutineRuntimeState {
  const beta = definition.beta;
  if (!beta || beta.source !== 'progress' || beta.metric !== metric || amount <= 0 || beta.per <= 0) return state;
  const total = state.progressBank + amount;
  const gained = Math.floor(total / beta.per);
  return { ...state, charges: state.charges + gained, progressBank: total - gained * beta.per };
}

/**
 * Feeds one scoring occurrence into one piece's beta, from the point of
 * view of `side` (the piece's owner):
 *
 * - a `cards` beta watching this category banks a charge if the scorer
 *   matches its `watch` (default: its own side) and the magnitude clears
 *   `minMagnitude`;
 * - a `progress`/`points` beta banks its own side's points;
 * - every piece's points cooldown ticks down on its own side's scoring,
 *   whatever its beta -- the cooldown is a firing gate, not a criterion.
 */
export function chargeFromOccurrence(
  state: SubroutineRuntimeState,
  definition: SubroutineDefinition,
  occurrence: ScoringOccurrence,
  side: PlayerIndex,
): SubroutineRuntimeState {
  const own = occurrence.player === side;
  let next = state;
  if (own && next.cooldownRemaining > 0) {
    next = { ...next, cooldownRemaining: Math.max(0, next.cooldownRemaining - occurrence.magnitude) };
  }

  const beta = definition.beta;
  if (!beta) return next;
  if (beta.source === 'progress') return own ? bankProgress(next, definition, 'points', occurrence.magnitude) : next;
  if (beta.source !== 'cards' || beta.category === 'suit' || beta.category !== occurrence.category) return next;

  const watch = beta.watch ?? 'own';
  const watched = watch === 'either' || (watch === 'own') === own;
  if (!watched || occurrence.magnitude < (beta.minMagnitude ?? 0)) return next;
  return addCharges(next, definition, 1);
}

/** Feeds one pegging play into a `cards`/`suit` beta: a charge per card
 * of the piece's own archetype's suit played by its own side (A1). */
export function chargeFromSuitPlayed(
  state: SubroutineRuntimeState,
  definition: SubroutineDefinition,
  suitPlayed: SuitPlayed,
  side: PlayerIndex,
): SubroutineRuntimeState {
  const beta = definition.beta;
  if (!beta || beta.source !== 'cards' || beta.category !== 'suit') return state;
  if (suitPlayed.player !== side || suitPlayed.suit !== ARCHETYPE_SUITS[definition.archetype]) return state;
  return addCharges(state, definition, 1);
}

/** Feeds Ward absorbed by the piece's own side into a
 * `progress`/`absorbed` beta -- Honeypot's conversion fuel. */
export function chargeFromAbsorbed(state: SubroutineRuntimeState, definition: SubroutineDefinition, amount: number): SubroutineRuntimeState {
  return bankProgress(state, definition, 'absorbed', amount);
}

// ---------------------------------------------------------------------
// Evaluating a beta
// ---------------------------------------------------------------------

/** One piece that fired earlier in the current turn, in firing order --
 * what a `sequence` beta reads. `elevated` is whether its beta applied. */
export interface FiredThisTurn {
  definition: SubroutineDefinition;
  elevated: boolean;
}

/** The live fight state a `state` or `sequence` beta reads. Gauge
 * fractions are real **win** gauge progress over threshold, never the
 * cyclical initiative gauge (session 40's gaugeFillAbove lesson).
 * `neighbours` are the pieces in the loadout slots directly above and
 * below this one (A12) -- empty outside a loadout context. */
export interface TriggerContext {
  isDealer: boolean;
  ownWard: number;
  ownGaugeFraction: number;
  opponentGaugeFraction: number;
  /** Points this side has scored so far this hand. */
  ownHandPoints: number;
  firedThisTurn: readonly FiredThisTurn[];
  neighbours: readonly SubroutineDefinition[];
}

type StateCondition = Extract<BetaSource, { source: 'state' }>['condition'];

export function evaluateStateCondition(condition: StateCondition, context: TriggerContext): boolean {
  switch (condition.kind) {
    case 'dealer':
      return context.isDealer;
    case 'nonDealer':
      return !context.isDealer;
    case 'wardAbove':
      return context.ownWard > condition.amount;
    case 'ownGaugeAbove':
      return context.ownGaugeFraction > condition.fraction;
    case 'ownGaugeBelow':
      return context.ownGaugeFraction < condition.fraction;
    case 'opponentGaugeAbove':
      return context.opponentGaugeFraction > condition.fraction;
    case 'opponentGaugeBelow':
      return context.opponentGaugeFraction < condition.fraction;
    case 'handPointsAtLeast':
      return context.ownHandPoints >= condition.amount;
  }
}

/**
 * How many charges a beta has right now. Banked for cards/progress; for
 * `state`, 1 while true (D15); for `sequence`, the number of matching
 * pieces that fired elevated earlier this turn (`anyPrior` -- so a graded
 * sequence beta is the old chain-finisher), or the number of matching
 * neighbours, above and below (`adjacent`, A12 -- 0, 1 or 2, so a graded
 * adjacent beta rewards being flanked). Adjacency is positional: it reads
 * the arrangement, not what fired, so a neighbour that hasn't fired yet
 * (or was skipped by its cooldown) still counts.
 */
export function betaCharges(definition: SubroutineDefinition, state: SubroutineRuntimeState, context: TriggerContext): number {
  const beta = definition.beta;
  if (!beta) return 0;
  switch (beta.source) {
    case 'cards':
    case 'progress':
      return state.charges;
    case 'state':
      return evaluateStateCondition(beta.condition, context) ? 1 : 0;
    case 'sequence': {
      if (beta.reach === 'adjacent') return context.neighbours.filter((n) => matchesSequence(beta.match, n)).length;
      return context.firedThisTurn.filter((f) => f.elevated && matchesSequence(beta.match, f.definition)).length;
    }
  }
}

/**
 * The multiplier a beta applies at on the turn's fire, given its charges
 * -- 0 means it does not apply. Graded scales by charges up to its cap;
 * stepped and whileTrue are all-or-nothing. An `immediate` beta never
 * applies on the turn's fire: it fires on its own, outside the turn (see
 * immediateBetaReady).
 */
export function betaScale(beta: Beta, charges: number): number {
  switch (beta.shape) {
    case 'graded':
      return Math.min(charges, beta.cap);
    case 'stepped':
      return charges >= beta.at ? 1 : 0;
    case 'whileTrue':
      return charges >= 1 ? 1 : 0;
    case 'immediate':
      return 0;
  }
}

/** Whether an `immediate` beta should fire right now: banked charges
 * reaching `at` (default 1) for cards/progress, or a `state` condition
 * turning true since the last check (edge, not level). */
export function immediateBetaReady(definition: SubroutineDefinition, state: SubroutineRuntimeState, context: TriggerContext): boolean {
  const beta = definition.beta;
  if (!beta || beta.shape !== 'immediate') return false;
  if (beta.source === 'state') return evaluateStateCondition(beta.condition, context) && !state.lastConditionTrue;
  if (beta.source === 'cards' || beta.source === 'progress') return state.charges >= (beta.at ?? 1);
  return false;
}

/** Clears banked charges once a beta has applied -- the universal
 * "fire, then reset and wait again" rule, now scoped to the beta. The
 * progress remainder carries, since it is progress toward a charge not
 * yet banked. */
export function spendCharges(state: SubroutineRuntimeState): SubroutineRuntimeState {
  return { ...state, charges: 0 };
}

// ---------------------------------------------------------------------
// Firing gates and post-fire bookkeeping
// ---------------------------------------------------------------------

/** The only two gates left on a piece acting at all: the per-combat fire
 * cap and the points cooldown (session 47). Everything else is beta. */
export function withinFiringGates(definition: SubroutineDefinition, state: SubroutineRuntimeState): boolean {
  if (definition.maxFiresPerCombat !== undefined && state.fireCount >= definition.maxFiresPerCombat) return false;
  return state.cooldownRemaining <= 0;
}

/** Bookkeeping after a piece's alpha fires: count the fire, arm its
 * cooldown, accrue its alpha growth (capped), and bank a charge toward a
 * `progress`/`fires` beta -- Ramp's own clock. */
export function recordFire(state: SubroutineRuntimeState, definition: SubroutineDefinition): SubroutineRuntimeState {
  const { growth, growthCap } = definition.alpha;
  const growthTotal = growth === undefined ? state.growthTotal : Math.min(state.growthTotal + growth, growthCap ?? Infinity);
  const next = { ...state, fireCount: state.fireCount + 1, cooldownRemaining: definition.pointsCooldown ?? 0, growthTotal };
  return bankProgress(next, definition, 'fires', 1);
}
