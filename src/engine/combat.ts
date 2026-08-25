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
  fireReadySubroutines,
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

  for (let i = 0; i < maxHands; i++) {
    const hand = playOneHand(dealer, scores, rng, discardStrategy, playStrategy);
    hands.push(hand);
    scores = hand.scoresAfter;

    for (const occurrence of occurrencesForHand(hand)) {
      combatState = applyOccurrenceToState(combatState, occurrence);

      const { gauge, turnsTriggered } = addPoints(combatState.sides[occurrence.player].gauge, occurrence.magnitude);
      combatState = replaceSideGauge(combatState, occurrence.player, gauge);

      for (let turn = 0; turn < turnsTriggered; turn++) {
        const fired = fireReadySubroutines(combatState, occurrence.player, {
          isDealer: occurrence.player === hand.dealer,
        });
        combatState = fired.combatState;
        log.push(...fired.events);
        peakBreachContainment = Math.max(peakBreachContainment, combatState.breachContainment);

        const winner = resolution(combatState);
        if (winner !== null) {
          return { winner, log, hands, peakBreachContainment, playerHeatGenerated: combatState.sides[0].heat };
        }
      }
    }

    dealer = (1 - dealer) as PlayerIndex;
  }

  throw new Error(`playCombat did not resolve within ${maxHands} hands`);
}
