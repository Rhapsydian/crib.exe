import type { Card } from './cards';
import { isJack } from './cards';
import type { Rng } from './rng';

export interface DealResult {
  hands: [Card[], Card[]];
  stock: Card[];
}

/** Deals 6 cards to each of 2 players from an already-shuffled deck. */
export function deal(shuffledDeck: Card[]): DealResult {
  const hands: [Card[], Card[]] = [shuffledDeck.slice(0, 6), shuffledDeck.slice(6, 12)];
  const stock = shuffledDeck.slice(12);
  return { hands, stock };
}

export type DiscardStrategy = (hand: Card[]) => [Card, Card];

/**
 * Legal-not-good: discards the two lowest-ranked cards. Good enough for
 * Phase 1 engine testing — real strategic discarding is a later concern.
 */
export const discardLowestTwo: DiscardStrategy = (hand) => {
  const sorted = hand.slice().sort((a, b) => a.rank - b.rank);
  return [sorted[0], sorted[1]];
};

export interface DiscardResult {
  keptHand: Card[];
  discarded: [Card, Card];
}

export function discardToCrib(hand: Card[], strategy: DiscardStrategy): DiscardResult {
  const discarded = strategy(hand);
  const discardedKeys = new Set(discarded.map((c) => `${c.rank}-${c.suit}`));
  const keptHand = hand.filter((c) => !discardedKeys.has(`${c.rank}-${c.suit}`));
  if (keptHand.length !== hand.length - 2) {
    throw new Error('discard strategy must return 2 cards actually present in the hand');
  }
  return { keptHand, discarded };
}

export interface CutResult {
  starter: Card;
  stock: Card[];
}

/** Cuts the starter card from the remaining stock. */
export function cut(stock: Card[], rng: Rng): CutResult {
  if (stock.length === 0) {
    throw new Error('cannot cut from an empty stock');
  }
  const index = rng.nextInt(stock.length);
  const starter = stock[index];
  const rest = stock.slice();
  rest.splice(index, 1);
  return { starter, stock: rest };
}

/** "His heels" — the dealer scores 2 if the starter card is a Jack. */
export function hisHeels(starter: Card): number {
  return isJack(starter) ? 2 : 0;
}
