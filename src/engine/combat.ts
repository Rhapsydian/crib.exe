import { createRng } from './rng';
import { discardLowestTwo, type DiscardStrategy } from './deal';
import { playLowestLegal, type PlayStrategy } from './pegging';
import { playOneHand, type HandResult, type PlayerIndex } from './game';
import type { SubroutineDefinition } from './subroutine-types';
import {
  updateSubroutineState,
  occurrencesFromPeggingEvent,
  occurrencesFromHandEvents,
  occurrenceFromHisHeels,
  type ScoringOccurrence,
} from './triggers';
import { addPoints, BREACH_CONTAINMENT_MAX, BREACH_CONTAINMENT_MIN, type InitiativeGauge } from './gauges';
import {
  createCombatState,
  fireNewlyReadyReactiveSubroutines,
  fireReadySubroutines,
  refreshTriggerReadiness,
  resolvePendingSabotage,
  tickCastersTurnPulse,
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
  gaugeThreshold: number;
  discardStrategy?: DiscardStrategy;
  playStrategy?: PlayStrategy;
  startingDealer?: PlayerIndex;
  /** Safety cap against a combat that never resolves (e.g. an empty
   * loadout whose gauge can never trigger a turn) -- real content always
   * scores *something* each hand, so this should never bind in practice. */
  maxHands?: number;
}

export interface CombatResult {
  winner: PlayerIndex;
  log: FireEvent[];
  hands: HandResult[];
  /** The highest Breach/Containment value reached at any point in the
   * match (session 9's "how far the player pushed the meter toward their
   * own win before the enemy dragged it back" -- Breach/Containment stops
   * dead at 0/100 with no overshoot, so the *final* value alone carries no
   * margin-of-loss information; this running peak is what Phase 3's Heat
   * formula needs instead). */
  peakBreachContainment: number;
  /** Heat the player side (side 0) accumulated in-combat from
   * riskRewardBurst payloads -- CombatSideState.heat resets each combat,
   * so the outer run orchestrator needs this surfaced to fold it into
   * persistent run Heat, same reason peakBreachContainment exists. */
  playerHeatGenerated: number;
}

function replaceSideGauge(combatState: CombatState, side: PlayerIndex, gauge: InitiativeGauge): CombatState {
  const sides = combatState.sides.slice() as [CombatSideState, CombatSideState];
  sides[side] = { ...sides[side], gauge };
  return { ...combatState, sides };
}

/** Advances every subroutine on both sides against one occurrence --
 * updateSubroutineState already no-ops for the side that doesn't own the
 * occurrence, so this is safe to call unconditionally for both sides. */
function applyOccurrenceToState(combatState: CombatState, occurrence: ScoringOccurrence): CombatState {
  const sides = combatState.sides.map((sideState, side) => ({
    ...sideState,
    loadout: sideState.loadout.map((entry) => ({
      ...entry,
      state: updateSubroutineState(entry.state, entry.definition, occurrence, side as PlayerIndex),
    })),
  })) as [CombatSideState, CombatSideState];
  return { ...combatState, sides };
}

function resolution(combatState: CombatState): PlayerIndex | null {
  if (combatState.breachContainment >= BREACH_CONTAINMENT_MAX) return 0;
  if (combatState.breachContainment <= BREACH_CONTAINMENT_MIN) return 1;
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
    discardStrategy = discardLowestTwo,
    playStrategy = playLowestLegal,
    startingDealer = 0,
    maxHands = 500,
  } = options;

  const rng = createRng(seed);
  let dealer: PlayerIndex = startingDealer;
  let scores: [number, number] = [0, 0];
  let combatState = createCombatState(loadouts[0], loadouts[1], gaugeThreshold);
  const hands: HandResult[] = [];
  const log: FireEvent[] = [];
  let peakBreachContainment = combatState.breachContainment;

  const finish = (winner: PlayerIndex): CombatResult => ({
    winner,
    log,
    hands,
    peakBreachContainment,
    playerHeatGenerated: combatState.sides[0].heat,
  });

  /** Applies one step's result, tracks the running Breach/Containment
   * peak, and returns the winner if the step resolved the match --
   * every state-changing step in this loop goes through this so peak
   * tracking and resolution checks stay uniform. */
  const step = (result: { combatState: CombatState; winner: PlayerIndex | null }): PlayerIndex | null => {
    combatState = result.combatState;
    peakBreachContainment = Math.max(peakBreachContainment, combatState.breachContainment);
    return result.winner;
  };

  for (let i = 0; i < maxHands; i++) {
    const hand = playOneHand(dealer, scores, rng, discardStrategy, playStrategy);
    hands.push(hand);
    scores = hand.scoresAfter;

    // Scheduled Sabotage "resolves at next deal" -- right here, before
    // anything else in this new hand happens. advance() afterward also
    // covers the new hand's dealer: self-state's isDealer/isNonDealer
    // needs a chance to latch even in the unlikely case nothing else in
    // this hand touches Heat/Breach-Containment/gauges before this
    // side's own turn.
    let winner = step(advance(resolvePendingSabotage(combatState), hand.dealer, log));
    if (winner !== null) return finish(winner);

    for (const occurrence of occurrencesForHand(hand)) {
      const beforeOccurrence = combatState;
      winner = step(checkReactive(beforeOccurrence, applyOccurrenceToState(combatState, occurrence), log));
      if (winner !== null) return finish(winner);

      // Global-pulse DoT/HoT ticks watch combined scoring from either
      // side, independent of whose turn it is -- feed this occurrence's
      // magnitude in regardless of which side scored it.
      winner = step(advance(tickGlobalPulse(combatState, occurrence.magnitude), hand.dealer, log));
      if (winner !== null) return finish(winner);

      const { gauge, turnsTriggered } = addPoints(combatState.sides[occurrence.player].gauge, occurrence.magnitude);
      // The gauge that just moved is watched by the *other* side's
      // gauge-fill-above enemy-state pieces -- refresh now, not just at
      // fire time.
      winner = step(advance(replaceSideGauge(combatState, occurrence.player, gauge), hand.dealer, log));
      if (winner !== null) return finish(winner);

      for (let turn = 0; turn < turnsTriggered; turn++) {
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
  }

  throw new Error(`playCombat did not resolve within ${maxHands} hands`);
}
