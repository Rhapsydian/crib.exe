import type { Card, Rank } from './cards';
import { SUITS } from './cards';
import type { Rng } from './rng';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ rank: rank as Rank, suit });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle, driven by an injected Rng — never Math.random,
 * so a game replayed from the same seed is reproducible. */
export function shuffle(deck: Card[], rng: Rng): Card[] {
  const result = deck.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
