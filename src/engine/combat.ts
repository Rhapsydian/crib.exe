import { createRng, deriveAiNoiseSeed } from './rng';
import type { Card } from './cards';
import { createDeck, shuffle } from './deck';
import { deal, discardToCrib, discardLowestTwo, discardHighestTwo, cut, biasedCut, hisHeels, type DiscardStrategy, type CutStrategy } from './deal';
import { playPegging, playLowestLegal, type PlayStrategy } from './pegging';
import { countHandEvents, countCribEvents } from './scoring';
import type { HandResult, PlayerIndex } from './game';
import type { SubroutineDefinition, HandLifecycleMoment } from './subroutine-types';
import type { ClassId } from './classes';
import type { EnemyPassiveId } from './enemies';
import type { ModId } from './mod-types';
import type { BurnerId } from './burner-types';
import { BURNER_DEFINITIONS } from './burners';
import {
  updateSubroutineState,
  updateSuitTallyState,
  occurrencesFromPeggingEvent,
  occurrencesFromHandEvents,
  occurrenceFromHisHeels,
  suitPlayedFromPeggingEvent,
  type ScoringOccurrence,
  type SuitPlayed,
} from './triggers';
import { addPoints, shrinkDuelThreshold, type InitiativeGauge } from './gauges';
import {
  applyEnemyGaugeCross50Passives,
  applyModGaugeCross50Passives,
  applyModOnCombatStartPassives,
  accumulatorThresholdMultiplier,
  occurrenceThresholdReduction,
  applyFootholdBonus,
  applyThrottled,
  clearHandKnowledge,
  consumePendingCribbageManipulation,
  createCombatState,
  fireHandLifecycleSubroutines,
  fireHandOutcomeSubroutines,
  fireNewlyReadyReactiveSubroutines,
  fireRareOccurrenceSubroutines,
  fireReadySubroutines,
  refreshTriggerReadiness,
  resolvePayload,
  resolvePendingSabotage,
  tickCastersTurnPulse,
  tickDebuffDurations,
  tickGlobalPulse,
  type CombatState,
  type CombatSideState,
  type FireEvent,
} from './resolve';

/**
 * The combat orchestrator (session 17 checkpoint F): loops playOneHand,
 * feeds each hand's scoring into both sides' gauges and subroutine
 * trigger state one discrete event at a time (in the real chronological
 * order they happen: his heels at the cut, then pegging play-by-play,
 * then non-dealer hand / dealer hand / crib at the show), fires ready
 * subroutines the instant a side's gauge crosses its threshold, and
 * continues until Breach/Containment resolves.
 */

export interface CombatOptions {
  seed: number;
  /** Per-side initiative-gauge threshold (session 40: was one shared
   * scalar applied to both sides; gauges.ts's InitiativeGauge always
   * modeled a side's own threshold independently, the symmetry was only
   * ever imposed here). Index 0 is the player's own, index 1 the
   * enemy's. */
  gaugeThreshold: [number, number];
  /** Per-side threshold for each side's own win-gauge (gauges.ts's
   * DuelGauge) -- independent per side (session 40 redesign; previously
   * one shared scalar, see gaugeThreshold's own note above). Defaults to
   * [100, 100], mirroring the old shared scalar's scale, though it's an
   * independent TBD/playtesting number now, not tied to any 0-100 shared
   * axis. */
  winThreshold?: [number, number];
  /** Per-side discard/play strategies (session 24, tunable-skill AI
   * checkpoint A) -- each side gets its own, rather than one shared
   * function used for both. Both default to `[discardLowestTwo,
   * discardLowestTwo]` / `[playLowestLegal, playLowestLegal]`,
   * preserving every existing call site's behavior exactly. */
  discardStrategies?: [DiscardStrategy, DiscardStrategy];
  playStrategies?: [PlayStrategy, PlayStrategy];
  startingDealer?: PlayerIndex;
  /** Which starting passive (if any) to check at its hook points --
   * Phase 4 checkpoint B. Only side 0 (the player) ever has a class. */
  classId?: ClassId;
  /** Which passive(s) side 1 (the enemy) carries this combat -- Phase 5
   * checkpoint B. Defaults to none, same "absent = no passives active"
   * treatment classId already gets. */
  enemyPassiveIds?: EnemyPassiveId[];
  /** Which Mod(s) side 0 (the player) owns this combat, beyond the
   * current class's own guaranteed class-exclusive one (see
   * resolve.ts's createCombatState) -- Phase 5 Mods checkpoint B.
   * Defaults to none. */
  ownedModIds?: ModId[];
  /** Which Burner(s) side 0 (the player) is carrying into this combat,
   * already filtered to combat-context ones -- Phase 5 Burners
   * checkpoint B, mirroring ownedModIds' side-0-only convention.
   * Defaults to none. */
  carriedBurnerIds?: BurnerId[];
  /** Per-side Burner-activation strategy (checkpoint C wires the actual
   * call site) -- mirrors discardStrategies/playStrategies' per-side
   * tuple shape. Side 1 (the enemy) has no Burner economy and should
   * always return null; both default to `() => null` (no Burner ever
   * activated), preserving every existing call site's behavior exactly. */
  burnerActivationStrategies?: [BurnerActivationStrategy, BurnerActivationStrategy];
}

/** Context passed to a BurnerActivationStrategy for one turn's decision
 * -- mirrors DiscardStrategy/PlayStrategy/CutStrategy's plain-function-
 * over-one-context-object shape (deal.ts/pegging.ts). availableBurnerIds
 * (checkpoint C) is combatState.carriedBurnerIds with this combat's
 * already-used copies removed one-for-one -- carriedBurnerIds itself is
 * a fixed start-of-combat snapshot (checkpoint B), so this is the field
 * a strategy should actually pick from. */
export interface BurnerActivationContext {
  combatState: CombatState;
  side: PlayerIndex;
  isDealer: boolean;
  availableBurnerIds: BurnerId[];
}

/** Picks which (if any) available Burner to activate this turn, or null
 * to activate none. Called once per turn-loop iteration (checkpoint C's
 * call site, this file's per-occurrence turn loop), before that
 * iteration's fireReadySubroutines call -- an "opening move" framing.
 * Returning an id not present in ctx.availableBurnerIds is treated the
 * same as null (silently ignored). */
export type BurnerActivationStrategy = (ctx: BurnerActivationContext) => BurnerId | null;

/** Default for both sides until checkpoint C gives scripts a real
 * choice to make -- never activates a Burner. */
export const neverActivateBurner: BurnerActivationStrategy = () => null;

export interface CombatResult {
  winner: PlayerIndex;
  log: FireEvent[];
  hands: HandResult[];
  /** Each side's own highest win-gauge fill fraction (progress/threshold,
   * 0-1) reached at any point in the match -- session 9's "how far the
   * player pushed toward their own win before losing" idea, ported to the
   * two-gauge redesign (session 22+). A side's gauge only ever increases
   * via its own offense and never decreases on its own (unlike the old
   * shared scalar, which could get dragged back), so this peak is really
   * "how close did this side get before the match ended," used by Phase 3's
   * Heat formula for margin-of-loss. Index 0 is the player's own peak. */
  peakFillFraction: [number, number];
  /** Trace the player side (side 0) accumulated during this fight --
   * raised by riskRewardBurst payloads' traceCost, lowered by
   * traceReduction. CombatSideState.trace resets each combat, so the
   * outer run orchestrator needs this surfaced to fold it into
   * persistent run Heat, same reason peakFillFraction exists. This IS
   * the Trace-to-Heat conversion: encounters.ts adds it to heatDelta.
   * Side 1 never accumulates Trace -- Heat is player-only (session 43).
   */
  traceGenerated: number;
  /** How the match actually ended (session 27, checkpoint E): 'threshold'
   * -- a side genuinely crossed its own win-gauge threshold, the normal
   * way. 'attrition' -- neither side had, by HARD_RESOLUTION_HAND, so
   * the defender (side 1) won by having successfully denied the
   * attacker (side 0) a breach in time, not by generating any progress
   * of its own. Surfaced so a balance sweep can tell "real offense" wins
   * apart from "successfully stalled" wins -- see resolveHardTiebreak's
   * own doc comment for why an attrition win no longer needs the
   * defender to have any win-gauge progress at all. */
  resolvedBy: 'threshold' | 'attrition';
  /** Which carried Burner(s) side 0 actually activated this combat --
   * Phase 5 Burners checkpoint B, mirroring traceGenerated's own
   * three-hop pattern (combat.ts -> encounters.ts's EncounterOutcome ->
   * run.ts, which removes these from RunPlayerState.carriedBurnerIds
   * once the fight resolves). Always empty until checkpoint C's
   * activation strategy is actually wired up and used. */
  burnersUsedThisCombat: BurnerId[];
}

function replaceSideGauge(combatState: CombatState, side: PlayerIndex, gauge: InitiativeGauge): CombatState {
  const sides = combatState.sides.slice() as [CombatSideState, CombatSideState];
  sides[side] = { ...sides[side], gauge };
  return { ...combatState, sides };
}

/** carriedBurnerIds minus already-used copies, one-for-one (not a Set
 * difference -- duplicate ids are legal, checkpoint B). Same logic
 * run.ts's own end-of-encounter removal uses, scoped here to one
 * in-progress combat instead of a whole run. */
function remainingBurnerIds(carried: BurnerId[], used: BurnerId[]): BurnerId[] {
  const remaining = [...carried];
  for (const usedId of used) {
    const index = remaining.indexOf(usedId);
    if (index !== -1) remaining.splice(index, 1);
  }
  return remaining;
}

/** Advances every subroutine on both sides against one occurrence --
 * updateSubroutineState already no-ops for the side that doesn't own the
 * occurrence, so this is safe to call unconditionally for both sides. */
function applyOccurrenceToState(combatState: CombatState, occurrence: ScoringOccurrence): CombatState {
  const sides = combatState.sides.map((sideState, side) => ({
    ...sideState,
    loadout: sideState.loadout.map((entry) => ({
      ...entry,
      state: updateSubroutineState(
        entry.state,
        entry.definition,
        occurrence,
        side as PlayerIndex,
        accumulatorThresholdMultiplier(combatState, side as PlayerIndex),
        occurrenceThresholdReduction(combatState, side as PlayerIndex),
      ),
    })),
  })) as [CombatSideState, CombatSideState];
  return { ...combatState, sides };
}

/** Advances every suitTally Accumulator subroutine on both sides against
 * one card played -- parallel to applyOccurrenceToState above, updating
 * a different, non-scoring signal. */
function applySuitPlayedToState(combatState: CombatState, suitPlayed: SuitPlayed): CombatState {
  const sides = combatState.sides.map((sideState, side) => ({
    ...sideState,
    loadout: sideState.loadout.map((entry) => ({
      ...entry,
      state: updateSuitTallyState(
        entry.state,
        entry.definition,
        suitPlayed,
        side as PlayerIndex,
        accumulatorThresholdMultiplier(combatState, side as PlayerIndex),
      ),
    })),
  })) as [CombatSideState, CombatSideState];
  return { ...combatState, sides };
}

/** Every card played during this hand's pegging phase, suit-tagged --
 * processed as its own pass (see the loop in playCombat) rather than
 * interleaved into occurrencesForHand's combined stream, since a
 * non-scoring play produces no ScoringOccurrence at all but still
 * counts toward a suit tally. */
function suitsPlayedForHand(hand: HandResult): SuitPlayed[] {
  return hand.peggingEvents.map(suitPlayedFromPeggingEvent).filter((s): s is SuitPlayed => s !== null);
}

/** A side wins the instant its own win-gauge reaches its own threshold.
 * If both sides somehow cross in the same step (including from an
 * escalation-driven threshold shrink), side 0 resolves first --
 * deterministic, matches the engine's existing fixed side-processing
 * order elsewhere. */
function resolution(combatState: CombatState): PlayerIndex | null {
  const [side0, side1] = combatState.sides;
  if (side0.winGauge.progress >= side0.winGauge.threshold) return 0;
  if (side1.winGauge.progress >= side1.winGauge.threshold) return 1;
  return null;
}

/** Fires any Reactive subroutine that just became ready between `before`
 * and `combatState` (comparing via fireNewlyReadyReactiveSubroutines),
 * appends its events to `log`, and reports whether the match resolved as
 * a result -- Reactive fires push Breach/Containment just like a normal
 * fire, so they can end the match too. Call after every step that can
 * change readiness directly (applying an occurrence -- accumulator/
 * occurrence -- or ticking). */
function checkReactive(
  before: CombatState,
  combatState: CombatState,
  log: FireEvent[],
): { combatState: CombatState; winner: PlayerIndex | null } {
  const reactive = fireNewlyReadyReactiveSubroutines(before, combatState);
  log.push(...reactive.events);
  return { combatState: reactive.combatState, winner: resolution(reactive.combatState) };
}

/** Refreshes self/enemy-state readiness against `combatState`, then
 * checkReactive against the refreshed result. Call after anything that
 * could change Heat, Breach/Containment, a gauge, or a debuff -- which
 * is virtually every step in this loop. */
function advance(
  combatState: CombatState,
  handDealer: PlayerIndex,
  log: FireEvent[],
): { combatState: CombatState; winner: PlayerIndex | null } {
  return checkReactive(combatState, refreshTriggerReadiness(combatState, handDealer), log);
}

// Escalation (session 22+): a match still resolves faster once it's
// gone on long enough that "genuinely competitive" tuning can afford
// to be patient early on -- see BACKLOG.md for the sharp positive-
// feedback/stalemate risk this exists to bound. Retuned session 26:
// starts at hand 10 (this project's own empirical finding is that
// normal, healthy fights already converge in ~10-25 hands on their
// own -- close to a real Cribbage game's typical 9-12 -- so this is
// squarely a stalemate rescue for the slow tail, not a broad tempo
// pacer for the typical case), and shrinks fast enough to reach the
// floor by hand 20 -- "effectively sudden death" by then, not just a
// gentle nudge. The shrink rate (4/hand) is calibrated against
// encounters.ts's real WIN_THRESHOLD (50): (50 - 10 floor) / 10 hands
// of escalation = 4. Since a side's own banked progress never resets
// when its threshold shrinks, reaching the floor while either side
// already has meaningful progress banked resolves the match almost
// immediately -- that's what makes hand 20 feel like sudden death for
// most fights. It's not a guarantee on its own, though -- see
// HARD_RESOLUTION_HAND below for the actual backstop that makes hand
// 20 a true, unconditional deadline. All TBD/playtesting, same
// placeholder convention as everywhere else in this project.
const ESCALATION_START_HAND = 10;
const ESCALATION_SHRINK_PER_HAND = 4;
const ESCALATION_MIN_THRESHOLD = 10;

/** Shrinks both sides' own win-gauge thresholds by ESCALATION_SHRINK_PER_HAND,
 * floored at ESCALATION_MIN_THRESHOLD -- never touches progress. Called
 * once per hand once the match has run at least ESCALATION_START_HAND
 * hands, so even a slow trickle of progress eventually crosses the
 * (shrinking) bar. */
function applyEscalation(combatState: CombatState): CombatState {
  const sides = combatState.sides.map((sideState) => ({
    ...sideState,
    winGauge: shrinkDuelThreshold(sideState.winGauge, ESCALATION_SHRINK_PER_HAND, ESCALATION_MIN_THRESHOLD),
  })) as [CombatSideState, CombatSideState];
  return { ...combatState, sides };
}

// Hard resolution deadline (session 26, continued): escalation alone
// only makes hand 20 *feel* like sudden death -- it lowers the bar,
// but can't force either gauge upward, so a genuinely mutual
// stalemate (both sides suppressing each other's progress as fast as
// it accumulates, or a kit that can never land a hit at all -- see
// subroutines.test.ts's solo-Encryption-pool case) can still run past
// whatever hand-count bound existed at the time without ever crossing
// either threshold, throwing instead of returning a result. Found as a
// real, if rare, occurrence in this session's own 500-seed re-sweep
// (Ghost, once its passive rework let it genuinely contest). The user's
// call: no fight should ever fail to resolve, full stop -- so at the
// end of hand 20 (the same hand escalation's own shrink schedule
// already reaches its floor by), force a real winner regardless of
// whether either threshold was actually crossed. This made the old
// FIGHT_MAX_HANDS/maxHands concept vestigial from this point on --
// every real fight resolves well before it could ever matter -- and it
// was finally removed outright in session 39 rather than kept as an
// unreachable defensive bound.
const HARD_RESOLUTION_HAND = 20;

/**
 * Consecutive turns one side may take without the other acting before
 * the fight is declared systemically broken (session 47).
 *
 * A turn is normally bought by *scoring*, so one side taking dozens in a
 * row is not a difficulty outlier -- it means something is granting turns
 * faster than they are consumed. That is exactly what session 47 found:
 * Cold Call Hastes its own initiative gauge, and once Merge lifts it to
 * the gauge threshold one fire buys a whole turn, which fires it again.
 * Grants compound across occurrences (1, 2, 4, ...) until the process
 * dies on a 4GB heap.
 *
 * Deliberately a **loud, fatal throw rather than a silent cap**. A cap
 * would convert this class of bug into a quiet dominant strategy and
 * hide the next one -- and there has already been a next one: session 28
 * found the Choked/Haste threshold variant the same way. scripts/sweep.ts
 * documents killing a hung sweep from outside and reading the last
 * printed line; this turns that into an immediate, located failure with
 * the state needed to reproduce it.
 *
 * Sized to catch *non-termination*, not merely strong tempo. The first
 * run of this detector immediately found a second, milder degeneracy: a
 * side whose initiative threshold has been ground down to
 * MIN_INITIATIVE_THRESHOLD (1) takes a turn per point scored, and was
 * observed taking 53 in a row. That case still terminates -- it is
 * bounded by points actually scored in the hand -- so it is a balance
 * problem, not a hang, and must not be fatal. A true runaway compounds
 * without bound (the Cold Call case reached a 4GB heap), so it blows
 * through any threshold set above the bounded cases.
 */
const MAX_CONSECUTIVE_TURNS = 200;

/** Forces a winner at the hard resolution deadline (session 27,
 * checkpoint E revision): the defender, side 1, unconditionally --
 * "attrition." Reaching this function at all already means side 0 (the
 * attacker) failed to cross its own Breach threshold in time (normal
 * resolution() would have ended the match already if it had), so under
 * the Breach/Containment fiction that's containment achieved, full
 * stop -- not a race decided by whoever's *closer*. This replaces
 * session 26's fraction-comparison version (only an exact tie went to
 * the defender; a side 0 with any nonzero fractional lead, however
 * thin, used to win outright without ever actually breaching) --
 * "closer" was never the right question once a stalemate itself is the
 * defense's real win condition, particularly for kits with no
 * win-gauge-crediting offense of their own (an Encryption-only or
 * Root-only kit can *only* ever win this way, by design -- see
 * DESIGN.md). Real difficulty consequence, not scoped to those kits:
 * *every* fight the attacker hasn't already closed out by hand 20 is
 * now a loss, where previously a narrow fractional lead could still
 * win it. */
function resolveHardTiebreak(): PlayerIndex {
  return 1;
}

/** The ordered sequence of scoring occurrences for one hand, in the
 * order they actually happen at the table: cut (his heels), pegging
 * play-by-play, then the show (non-dealer hand, dealer hand, crib). */
function occurrencesForHand(hand: HandResult): ScoringOccurrence[] {
  const nonDealer: PlayerIndex = (1 - hand.dealer) as PlayerIndex;
  const heels = occurrenceFromHisHeels(hand.hisHeelsPoints, hand.dealer);
  return [
    ...(heels ? [heels] : []),
    ...hand.peggingEvents.flatMap(occurrencesFromPeggingEvent),
    ...occurrencesFromHandEvents(hand.nonDealerHandEvents, nonDealer),
    ...occurrencesFromHandEvents(hand.dealerHandEvents, hand.dealer),
    ...occurrencesFromHandEvents(hand.cribEvents, hand.dealer),
  ];
}

export function playCombat(loadouts: [SubroutineDefinition[], SubroutineDefinition[]], options: CombatOptions): CombatResult {
  const {
    seed,
    gaugeThreshold,
    winThreshold = [100, 100],
    discardStrategies = [discardLowestTwo, discardLowestTwo],
    playStrategies = [playLowestLegal, playLowestLegal],
    startingDealer = 0,
    classId,
    enemyPassiveIds = [],
    ownedModIds = [],
    carriedBurnerIds = [],
    burnerActivationStrategies = [neverActivateBurner, neverActivateBurner],
  } = options;

  const rng = createRng(seed);
  // Session 26: a separate, decorrelated stream for AI-decision noise
  // (see rng.ts's deriveAiNoiseSeed) -- never consumed by
  // shuffles/cuts, so adding or changing how often the AI "rolls dice"
  // can't perturb `rng`'s own sequence, which many existing tests
  // assert exact deals/starters against.
  const aiRng = createRng(deriveAiNoiseSeed(seed));
  let dealer: PlayerIndex = startingDealer;
  // Loop detector bookkeeping (session 47) -- see MAX_CONSECUTIVE_TURNS.
  // Spans the whole fight rather than resetting per hand: a runaway
  // compounds across occurrences and hands alike.
  let consecutiveTurns = 0;
  let lastTurnSide: PlayerIndex | null = null;
  let scores: [number, number] = [0, 0];
  let combatState = applyModOnCombatStartPassives(
    createCombatState(loadouts[0], loadouts[1], gaugeThreshold, classId, winThreshold, enemyPassiveIds, ownedModIds, carriedBurnerIds),
  );
  const hands: HandResult[] = [];
  const log: FireEvent[] = [];
  let peakFillFraction: [number, number] = [0, 0];
  // Checkpoint C populates this from the real activation call site --
  // always empty until burnerActivationStrategies is actually wired up.
  const burnersUsedThisCombat: BurnerId[] = [];

  const finish = (winner: PlayerIndex, resolvedBy: 'threshold' | 'attrition' = 'threshold'): CombatResult => ({
    winner,
    log,
    hands,
    peakFillFraction,
    traceGenerated: combatState.sides[0].trace,
    resolvedBy,
    burnersUsedThisCombat,
  });

  /** Applies one step's result, tracks each side's running win-gauge
   * fill-fraction peak, and returns the winner if the step resolved the
   * match -- every state-changing step in this loop goes through this so
   * peak tracking and resolution checks stay uniform. Also checks
   * Breacher's Foothold passive (the one hook that needs to see every
   * step uniformly, regardless of what caused it -- see
   * applyFootholdBonus's own doc comment) and re-derives the winner
   * afterward, since Foothold's own bonus can finish the match. */
  const step = (result: { combatState: CombatState; winner: PlayerIndex | null }): PlayerIndex | null => {
    combatState = applyModGaugeCross50Passives(applyEnemyGaugeCross50Passives(applyFootholdBonus(result.combatState)));
    const [side0, side1] = combatState.sides;
    peakFillFraction = [
      Math.max(peakFillFraction[0], side0.winGauge.progress / side0.winGauge.threshold),
      Math.max(peakFillFraction[1], side1.winGauge.progress / side1.winGauge.threshold),
    ];
    return result.winner !== null ? result.winner : resolution(combatState);
  };

  /** Fires every side's `firesAt`-tagged subroutines for one hand-
   * lifecycle moment (session 24 checkpoint B), side 0 then side 1 --
   * same deterministic order as everywhere else -- routing each side's
   * fire through step() so peak-tracking/resolution stays uniform.
   * Returns the winner the instant either side's fire resolves the
   * match, same early-exit contract step() already has. */
  const fireLifecycleGap = (
    moment: HandLifecycleMoment,
    revealedCardsForSide: (side: PlayerIndex) => Card[] | undefined,
    targetIsOwnCribForSide?: (side: PlayerIndex) => boolean,
  ): PlayerIndex | null => {
    for (const side of [0, 1] as PlayerIndex[]) {
      const fired = fireHandLifecycleSubroutines(
        combatState,
        side,
        moment,
        { isDealer: side === dealer },
        revealedCardsForSide(side),
        targetIsOwnCribForSide?.(side),
      );
      log.push(...fired.events);
      const winner = step({ combatState: fired.combatState, winner: resolution(fired.combatState) });
      if (winner !== null) return winner;
    }
    return null;
  };

  /** Root offense (session 40 continued): fires every handOutcome-
   * triggered subroutine once per hand, both sides, right after that
   * hand's HandResult is built -- same "route through step() so peak-
   * tracking/resolution stays uniform" contract fireLifecycleGap above
   * already has. */
  const fireHandOutcomeGap = (hand: HandResult): PlayerIndex | null => {
    for (const side of [0, 1] as PlayerIndex[]) {
      const fired = fireHandOutcomeSubroutines(combatState, side, hand);
      log.push(...fired.events);
      const winner = step({ combatState: fired.combatState, winner: resolution(fired.combatState) });
      if (winner !== null) return winner;
    }
    return null;
  };

  /** Root offense (session 40 continued): fires every rareOccurrence-
   * triggered subroutine matching `occurrence`, both sides, watching
   * either side's own scoring per each piece's own watchSide field. Same
   * step()-routing contract as fireHandOutcomeGap above. */
  const fireRareOccurrenceGap = (occurrence: ScoringOccurrence): PlayerIndex | null => {
    for (const side of [0, 1] as PlayerIndex[]) {
      const fired = fireRareOccurrenceSubroutines(combatState, side, occurrence);
      log.push(...fired.events);
      const winner = step({ combatState: fired.combatState, winner: resolution(fired.combatState) });
      if (winner !== null) return winner;
    }
    return null;
  };

  // HARD_RESOLUTION_HAND is the only real bound -- its own unconditional
  // check below always returns by the loop's last iteration, so there's
  // no separate "maxHands" concept above it anymore (removed: user
  // request, session 39 -- FIGHT_MAX_HANDS/maxHands had been vestigial
  // since session 27 introduced the hard deadline, "left in place as a
  // defensive outer bound" at the time rather than removed).
  for (let i = 0; i < HARD_RESOLUTION_HAND; i++) {
    let winner: PlayerIndex | null = null;

    // Escalation: once the match has run long enough, both sides' own
    // win-gauge thresholds start shrinking each hand -- a shrink can
    // itself resolve the match if banked progress already exceeds the
    // new, lower threshold, and can also newly arm an enemyState
    // breachContainmentBelow/Above trigger purely from the changed fill
    // percentage (advance() re-checks readiness, not just resolution).
    if (i >= ESCALATION_START_HAND) {
      winner = step(advance(applyEscalation(combatState), dealer, log));
      if (winner !== null) return finish(winner);
    }

    // Cribbage-layer manipulation (skewCut/forceDiscard/markSuit) has to
    // be consumed BEFORE this hand is dealt, since it changes how this
    // hand's own deal/discard/cut behaves -- unlike Scheduled Sabotage/
    // debuff-duration ticking below, which only touch combat state and
    // can happen any time within the "next deal" window. markSuit's
    // suit-tally credit applies immediately, right here.
    const beforeManipulation = combatState;
    const manipulation = consumePendingCribbageManipulation(combatState, dealer);
    combatState = manipulation.combatState;
    winner = step(checkReactive(beforeManipulation, combatState, log));
    if (winner !== null) return finish(winner);

    const cutStrategy: CutStrategy = manipulation.forHand.cutBias ? biasedCut(manipulation.forHand.cutBias) : cut;

    // Hand-lifecycle decomposition (session 24 checkpoint B): combat.ts
    // now orchestrates game.ts's granular pieces directly instead of
    // calling playOneHand as one opaque step, so Root's recon/
    // manipulation subroutines can fire in the gaps between them (see
    // the decision session's plan for why this shape was chosen over
    // injecting callbacks into playOneHand itself). Phase 1's
    // playHands still uses playOneHand unchanged; nothing there needs
    // these hooks.
    const nonDealer: PlayerIndex = (1 - dealer) as PlayerIndex;
    // Clear last hand's recon intel before this hand's own onDealt gap
    // can repopulate it -- a side whose recon didn't fire this hand
    // (toggled off, conditional trigger unmet) must not keep seeing
    // stale intel from a previous hand.
    combatState = clearHandKnowledge(combatState);
    const shuffled = shuffle(createDeck(), rng);
    const { hands: dealtHands, stock } = deal(shuffled);

    winner = fireLifecycleGap(
      'onDealt',
      (side) => dealtHands[(1 - side) as PlayerIndex],
      (side) => dealer === ((1 - side) as PlayerIndex),
    );
    if (winner !== null) return finish(winner);

    // forcedDiscardPair (checkpoint D's "force a specific card") takes
    // precedence over the older, blunter forcedDiscardSide (whole-pair
    // discardHighestTwo override) -- more specific manipulation wins if
    // both were somehow active on the same hand, though real content is
    // never expected to stack them.
    const strategy0: DiscardStrategy = combatState.sides[0].forcedDiscardPair
      ? () => combatState.sides[0].forcedDiscardPair as [Card, Card]
      : manipulation.forHand.forcedDiscardSide === 0
        ? discardHighestTwo
        : discardStrategies[0];
    const strategy1: DiscardStrategy = combatState.sides[1].forcedDiscardPair
      ? () => combatState.sides[1].forcedDiscardPair as [Card, Card]
      : manipulation.forHand.forcedDiscardSide === 1
        ? discardHighestTwo
        : discardStrategies[1];
    const d0 = discardToCrib({ hand: dealtHands[0], isOwnCrib: dealer === 0, knownOpponentHand: combatState.sides[0].knownOpponentHand, rng: aiRng }, strategy0);
    const d1 = discardToCrib({ hand: dealtHands[1], isOwnCrib: dealer === 1, knownOpponentHand: combatState.sides[1].knownOpponentHand, rng: aiRng }, strategy1);
    const crib = [...d0.discarded, ...d1.discarded];

    winner = fireLifecycleGap('onCribSelected', () => crib);
    if (winner !== null) return finish(winner);

    const { starter } = cutStrategy(stock, rng);
    const heelsPoints = hisHeels(starter);
    scores[dealer] += heelsPoints;

    const keptForSide: [Card[], Card[]] = [d0.keptHand, d1.keptHand];
    winner = fireLifecycleGap('onPlayPhaseStart', (side) => keptForSide[(1 - side) as PlayerIndex]);
    if (winner !== null) return finish(winner);

    const kept: [Card[], Card[]] = [d0.keptHand, d1.keptHand];
    // Genuinely per-side now (session 24 tunable-skill AI checkpoint A)
    // -- each side's own strategy sees only its own recon, not the
    // other side's.
    const { scores: peggingScores, events: peggingEvents } = playPegging(
      kept[0],
      kept[1],
      nonDealer,
      playStrategies,
      [combatState.sides[0].knownCrib, combatState.sides[1].knownCrib],
      [combatState.sides[0].knownOpponentHand, combatState.sides[1].knownOpponentHand],
      aiRng,
    );
    scores[0] += peggingScores[0];
    scores[1] += peggingScores[1];

    const nonDealerHandEvents = countHandEvents(kept[nonDealer], starter);
    const nonDealerHandScore = nonDealerHandEvents.reduce((sum, e) => sum + e.points, 0);
    scores[nonDealer] += nonDealerHandScore;

    const dealerHandEvents = countHandEvents(kept[dealer], starter);
    const dealerHandScore = dealerHandEvents.reduce((sum, e) => sum + e.points, 0);
    scores[dealer] += dealerHandScore;

    const cribEvents = countCribEvents(crib, starter);
    const cribScore = cribEvents.reduce((sum, e) => sum + e.points, 0);
    scores[dealer] += cribScore;

    const hand: HandResult = {
      dealer,
      starter,
      hisHeelsPoints: heelsPoints,
      peggingScores,
      nonDealerHandScore,
      dealerHandScore,
      cribScore,
      scoresAfter: scores,
      peggingEvents,
      nonDealerHandEvents,
      dealerHandEvents,
      cribEvents,
    };
    hands.push(hand);

    // Root offense (session 40 continued): handOutcome traps resolve
    // against this hand's own just-computed totals, before anything
    // else about the new hand (sabotage/debuff-duration resolution,
    // the occurrence loop) happens -- conceptually this is still part
    // of *this* hand finishing, not the next one starting.
    winner = fireHandOutcomeGap(hand);
    if (winner !== null) return finish(winner);

    // Scheduled Sabotage "resolves at next deal," and debuff durations
    // (measured in hands, unlike DoT/HoT ticks) count down -- both right
    // here, before anything else in this new hand happens. advance()
    // afterward also covers the new hand's dealer: self-state's
    // isDealer/isNonDealer needs a chance to latch even in the unlikely
    // case nothing else in this hand touches Trace/Breach-Containment/
    // gauges before this side's own turn.
    winner = step(advance(tickDebuffDurations(resolvePendingSabotage(combatState)), hand.dealer, log));
    if (winner !== null) return finish(winner);

    // Suit-tally Accumulators watch cards played, not scoring events --
    // processed as its own pass since a non-scoring play produces no
    // ScoringOccurrence at all. Runs ahead of this hand's occurrence
    // loop below (pegging always precedes the show phase anyway); the
    // two mechanics don't otherwise interact, so no finer interleaving
    // is needed.
    for (const suitPlayed of suitsPlayedForHand(hand)) {
      const beforeSuitPlayed = combatState;
      winner = step(checkReactive(beforeSuitPlayed, applySuitPlayedToState(combatState, suitPlayed), log));
      if (winner !== null) return finish(winner);
    }

    for (const occurrence of occurrencesForHand(hand)) {
      const beforeOccurrence = combatState;
      winner = step(checkReactive(beforeOccurrence, applyOccurrenceToState(combatState, occurrence), log));
      if (winner !== null) return finish(winner);

      // Root offense (session 40 continued): rareOccurrence watchers
      // check this occurrence directly, independent of the readiness
      // state applyOccurrenceToState/checkReactive just updated above --
      // this trigger family never touches that machinery at all.
      winner = fireRareOccurrenceGap(occurrence);
      if (winner !== null) return finish(winner);

      // Global-pulse DoT/HoT ticks watch combined scoring from either
      // side, independent of whose turn it is -- feed this occurrence's
      // magnitude in regardless of which side scored it.
      winner = step(advance(tickGlobalPulse(combatState, occurrence.magnitude), hand.dealer, log));
      if (winner !== null) return finish(winner);

      // Throttled dents points right as they're credited to the gauge --
      // not applied to tickGlobalPulse above, which is a separate
      // mechanic Throttled doesn't touch.
      const throttledMagnitude = applyThrottled(combatState, occurrence.player, occurrence.magnitude);
      const { gauge, turnsTriggered } = addPoints(combatState.sides[occurrence.player].gauge, throttledMagnitude);
      // The gauge that just moved is watched by the *other* side's
      // gauge-fill-above enemy-state pieces -- refresh now, not just at
      // fire time.
      winner = step(advance(replaceSideGauge(combatState, occurrence.player, gauge), hand.dealer, log));
      if (winner !== null) return finish(winner);

      if (turnsTriggered > 0) {
        consecutiveTurns = occurrence.player === lastTurnSide ? consecutiveTurns + turnsTriggered : turnsTriggered;
        lastTurnSide = occurrence.player;
        if (consecutiveTurns > MAX_CONSECUTIVE_TURNS) {
          const side = occurrence.player;
          const g = combatState.sides[side].gauge;
          throw new Error(
            `playCombat: side ${side} has taken ${consecutiveTurns} consecutive turns without the opponent acting -- ` +
              `a systemic turn loop, not legitimate play (see MAX_CONSECUTIVE_TURNS). ` +
              `hand=${i} seed=${seed} classId=${classId ?? 'none'} ` +
              `gauge=${g.progress}/${g.threshold} turnsTriggeredThisOccurrence=${turnsTriggered} ` +
              `loadout=[${combatState.sides[side].loadout.map((e) => e.definition.id).join(' ')}]`,
          );
        }
      }

      for (let turn = 0; turn < turnsTriggered; turn++) {
        // Burner activation (checkpoint C): an "opening move" resolved
        // before this turn's automatic subroutine fires. Side 1 (the
        // enemy) has no Burner economy -- its strategy defaults to
        // neverActivateBurner, so this is a genuine no-op for it, not a
        // special case.
        const availableBurnerIds = remainingBurnerIds(combatState.carriedBurnerIds, burnersUsedThisCombat);
        if (availableBurnerIds.length > 0) {
          const chosenBurnerId = burnerActivationStrategies[occurrence.player]({
            combatState,
            side: occurrence.player,
            isDealer: occurrence.player === hand.dealer,
            availableBurnerIds,
          });
          const burnerDef = chosenBurnerId && availableBurnerIds.includes(chosenBurnerId) ? BURNER_DEFINITIONS[chosenBurnerId] : undefined;
          if (chosenBurnerId && burnerDef?.combatEffect) {
            burnersUsedThisCombat.push(chosenBurnerId);
            const afterBurner = resolvePayload(burnerDef.combatEffect, 'neutral', combatState, occurrence.player);
            winner = step({ combatState: afterBurner, winner: resolution(afterBurner) });
            if (winner !== null) return finish(winner);
          }
        }

        const fired = fireReadySubroutines(combatState, occurrence.player, {
          isDealer: occurrence.player === hand.dealer,
        });
        log.push(...fired.events);
        winner = step({ combatState: fired.combatState, winner: resolution(fired.combatState) });
        if (winner !== null) return finish(winner);

        // Caster's-turn-pulse ticks fire whenever their caster gets a
        // turn, gated exactly like a normal subroutine fire.
        winner = step(advance(tickCastersTurnPulse(combatState, occurrence.player), hand.dealer, log));
        if (winner !== null) return finish(winner);
      }
    }

    dealer = (1 - dealer) as PlayerIndex;

    if (i + 1 >= HARD_RESOLUTION_HAND) return finish(resolveHardTiebreak(), 'attrition');
  }

  // Provably unreachable: the loop runs exactly HARD_RESOLUTION_HAND
  // iterations, and the `i + 1 >= HARD_RESOLUTION_HAND` check above
  // always returns by the last one, unconditionally. Kept only to
  // satisfy TypeScript's control-flow analysis (it can't prove that on
  // its own) -- not a real safety net anymore.
  throw new Error('playCombat: unreachable -- HARD_RESOLUTION_HAND always forces a result before this point');
}

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint H) -- the
// combat-context half of Burner activation. Before this, Burners were
// not merely used badly by scripted runs but never used at all:
// neverActivateBurner here, neverActivateMapBurner in run.ts and
// neverActivateShopBurner in shop.ts were the only strategies that
// existed anywhere in production code, so any sweep measuring class
// balance was measuring a player with a third of their toolkit
// permanently switched off.
//
// Deliberately unconditional on the first own-turn opportunity, with no
// hoarding logic. Reserving combat Burners for elite/gatekeeper fights
// was considered and explicitly deferred by session 45 -- it's a
// second-order heuristic layered on top of activation itself, and worth
// building only if sweep data shows it matters. The user's own framing
// for shipping the simple version: "any use is better than no use."
// ---------------------------------------------------------------------

/** Activates the first available combat-context Burner each turn the
 * player gets. Side 1 (the enemy) has no Burner economy at all and
 * always declines, matching the tuple's own documented contract.
 *
 * availableBurnerIds is this combat's carried inventory minus copies
 * already spent (combat.ts's own remainingBurnerIds bookkeeping), so
 * "first available" naturally spends one per turn until they run out
 * rather than trying to fire the same one repeatedly. Map- and
 * shop-context Burners are filtered out here: they're carried in the
 * same inventory but have no combatEffect to resolve. */
export const synergyAwareCombatBurnerActivation: BurnerActivationStrategy = (ctx) => {
  if (ctx.side !== 0) return null;
  const combatBurner = ctx.availableBurnerIds.find((id) => BURNER_DEFINITIONS[id].contexts.includes('combat'));
  return combatBurner ?? null;
};
