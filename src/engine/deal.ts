import type { Card } from './cards';
import { cardsEqual, isJack } from './cards';
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

/** Discards the two highest-ranked cards -- deliberately the worst
 * legal-but-bad choice. Implements Root's forceDiscard Cribbage-layer
 * manipulation: a forced-bad-discard effect on the target, not a
 * literal "pick this exact card" mechanic (this is a fully-simulated
 * engine with no hidden-information concept to target a specific card
 * against). */
export const discardHighestTwo: DiscardStrategy = (hand) => {
  const sorted = hand.slice().sort((a, b) => b.rank - a.rank);
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

export type CutStrategy = (stock: Card[], rng: Rng) => CutResult;

/** Cuts the starter card from the remaining stock. */
export const cut: CutStrategy = (stock, rng) => {
  if (stock.length === 0) {
    throw new Error('cannot cut from an empty stock');
  }
  const index = rng.nextInt(stock.length);
  const starter = stock[index];
  const rest = stock.slice();
  rest.splice(index, 1);
  return { starter, stock: rest };
};

/** A cut biased toward (or away from) drawing a Jack -- implements
 * Root's skewCut Cribbage-layer manipulation. His Heels only ever
 * credits the dealer, so combat.ts resolves which direction actually
 * favors the caster before constructing this. Falls back to a uniform
 * cut over the whole stock if the requested bias can't be satisfied
 * (no Jack to bias toward, or the stock is nothing but Jacks to bias
 * away from -- vanishingly rare, handled for correctness). */
export function biasedCut(bias: 'towardJack' | 'awayFromJack'): CutStrategy {
  return (stock, rng) => {
    if (stock.length === 0) {
      throw new Error('cannot cut from an empty stock');
    }
    const jacks = stock.filter(isJack);
    const nonJacks = stock.filter((c) => !isJack(c));
    const pool = bias === 'towardJack' ? (jacks.length > 0 ? jacks : stock) : nonJacks.length > 0 ? nonJacks : stock;
    const starter = pool[rng.nextInt(pool.length)];
    const rest = stock.slice();
    rest.splice(
      rest.findIndex((c) => cardsEqual(c, starter)),
      1,
    );
    return { starter, stock: rest };
  };
}

/** "His heels" — the dealer scores 2 if the starter card is a Jack. */
export function hisHeels(starter: Card): number {
  return isJack(starter) ? 2 : 0;
}
