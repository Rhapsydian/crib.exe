import type { Card } from './cards';
import { createDeck, shuffle } from './deck';
import { createRng, type Rng } from './rng';
import { deal, discardToCrib, discardLowestTwo, discardHighestTwo, cut, hisHeels, type DiscardStrategy, type CutStrategy } from './deal';
import { playPegging, playLowestLegal, type PlayStrategy, type PeggingEvent } from './pegging';
import { countHandEvents, countCribEvents, type HandScoreEvent } from './scoring';

export type PlayerIndex = 0 | 1;

export interface HandResult {
  dealer: PlayerIndex;
  starter: Card;
  hisHeelsPoints: number;
  peggingScores: [number, number];
  nonDealerHandScore: number;
  dealerHandScore: number;
  cribScore: number;
  /** Cumulative scores after this hand fully resolves. */
  scoresAfter: [number, number];
  /** Raw, ordered scoring events underlying the summed fields above —
   * additive (Phase 2 prep, session 17 checkpoint F): combat.ts feeds
   * these into initiative gauges and Occurrence triggers one at a time,
   * the same discrete/sequential treatment pegging already had and
   * hand-counting gained in the checkpoint C/D revision. */
  peggingEvents: PeggingEvent[];
  nonDealerHandEvents: HandScoreEvent[];
  dealerHandEvents: HandScoreEvent[];
  cribEvents: HandScoreEvent[];
}

export interface GameOptions {
  seed: number;
  discardStrategy?: DiscardStrategy;
  playStrategy?: PlayStrategy;
  startingDealer?: PlayerIndex;
}

export interface GameResult {
  hands: HandResult[];
  finalScores: [number, number];
}

/**
 * Plays out one hand: deal, discard-to-crib, cut (incl. his heels),
 * pegging, then counting non-dealer hand / dealer hand / crib. Takes the
 * cumulative scores going in and returns scoresAfter reflecting this
 * hand's points added on top — callers (playHands below, combat.ts's
 * playCombat) drive dealer alternation and cumulative-score threading
 * themselves.
 *
 * `cutStrategy` and `forcedDiscardSide` are injection points for Root's
 * Cribbage-layer manipulation (skewCut / forceDiscard, resolved a hand
 * ahead by combat.ts via resolve.ts's consumePendingCribbageManipulation)
 * — both default to normal, unmanipulated play.
 */
export function playOneHand(
  dealer: PlayerIndex,
  priorScores: [number, number],
  rng: Rng,
  discardStrategy: DiscardStrategy = discardLowestTwo,
  playStrategy: PlayStrategy = playLowestLegal,
  cutStrategy: CutStrategy = cut,
  forcedDiscardSide?: PlayerIndex,
): HandResult {
  const nonDealer: PlayerIndex = (1 - dealer) as PlayerIndex;
  const scores: [number, number] = [...priorScores];

  const shuffled = shuffle(createDeck(), rng);
  const { hands: dealtHands, stock } = deal(shuffled);

  const d0 = discardToCrib(dealtHands[0], forcedDiscardSide === 0 ? discardHighestTwo : discardStrategy);
  const d1 = discardToCrib(dealtHands[1], forcedDiscardSide === 1 ? discardHighestTwo : discardStrategy);
  const crib = [...d0.discarded, ...d1.discarded];

  const { starter } = cutStrategy(stock, rng);
  const heelsPoints = hisHeels(starter);
  scores[dealer] += heelsPoints;

  const kept: [Card[], Card[]] = [d0.keptHand, d1.keptHand];
  const { scores: peggingScores, events: peggingEvents } = playPegging(kept[0], kept[1], nonDealer, playStrategy);
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

  return {
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
}

/**
 * Plays out `handCount` full hands, alternating dealer each time.
 * Deliberately has no target-score/winner concept — crib.exe doesn't use
 * race-to-121 as its win condition (see DESIGN.md Combat System,
 * Breach/Containment), so that's not this engine's job to invent; this just
 * plays the underlying card game correctly.
 */
export function playHands(handCount: number, options: GameOptions): GameResult {
  const {
    seed,
    discardStrategy = discardLowestTwo,
    playStrategy = playLowestLegal,
    startingDealer = 0,
  } = options;

  const rng = createRng(seed);
  let dealer: PlayerIndex = startingDealer;
  let scores: [number, number] = [0, 0];
  const hands: HandResult[] = [];

  for (let i = 0; i < handCount; i++) {
    const hand = playOneHand(dealer, scores, rng, discardStrategy, playStrategy);
    hands.push(hand);
    scores = hand.scoresAfter;
    dealer = (1 - dealer) as PlayerIndex;
  }

  return { hands, finalScores: scores };
}
