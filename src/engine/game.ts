import type { Card } from './cards';
import { createDeck, shuffle } from './deck';
import { createRng } from './rng';
import { deal, discardToCrib, discardLowestTwo, cut, hisHeels, type DiscardStrategy } from './deal';
import { playPegging, playLowestLegal, type PlayStrategy } from './pegging';
import { countHand, countCrib } from './scoring';

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
 * Plays out `handCount` full hands: deal, discard-to-crib, cut (incl. his
 * heels), pegging, then counting non-dealer hand / dealer hand / crib,
 * alternating dealer each time. Deliberately has no target-score/winner
 * concept — crib.exe doesn't use race-to-121 as its win condition (see
 * DESIGN.md Combat System, Control/Breach), so that's not this engine's
 * job to invent; this just plays the underlying card game correctly.
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
  const scores: [number, number] = [0, 0];
  const hands: HandResult[] = [];

  for (let i = 0; i < handCount; i++) {
    const nonDealer: PlayerIndex = (1 - dealer) as PlayerIndex;

    const shuffled = shuffle(createDeck(), rng);
    const { hands: dealtHands, stock } = deal(shuffled);

    const d0 = discardToCrib(dealtHands[0], discardStrategy);
    const d1 = discardToCrib(dealtHands[1], discardStrategy);
    const crib = [...d0.discarded, ...d1.discarded];

    const { starter } = cut(stock, rng);
    const heelsPoints = hisHeels(starter);
    scores[dealer] += heelsPoints;

    const kept: [Card[], Card[]] = [d0.keptHand, d1.keptHand];
    const { scores: peggingScores } = playPegging(kept[0], kept[1], nonDealer, playStrategy);
    scores[0] += peggingScores[0];
    scores[1] += peggingScores[1];

    const nonDealerHand = countHand(kept[nonDealer], starter);
    scores[nonDealer] += nonDealerHand.total;

    const dealerHand = countHand(kept[dealer], starter);
    scores[dealer] += dealerHand.total;

    const cribScore = countCrib(crib, starter);
    scores[dealer] += cribScore.total;

    hands.push({
      dealer,
      starter,
      hisHeelsPoints: heelsPoints,
      peggingScores,
      nonDealerHandScore: nonDealerHand.total,
      dealerHandScore: dealerHand.total,
      cribScore: cribScore.total,
      scoresAfter: [scores[0], scores[1]],
    });

    dealer = nonDealer;
  }

  return { hands, finalScores: scores };
}
