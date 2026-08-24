/** Generic suit slot — no theming at this phase, see DESIGN.md Theming. */
export type Suit = 0 | 1 | 2 | 3;
export const SUITS: readonly Suit[] = [0, 1, 2, 3];

/** 1 = Ace, 11 = Jack, 12 = Queen, 13 = King. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  rank: Rank;
  suit: Suit;
}

/** Cribbage scoring value: face cards count as 10, Ace as 1. */
export function cardValue(card: Card): number {
  return Math.min(card.rank, 10);
}

export function isJack(card: Card): boolean {
  return card.rank === 11;
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}
