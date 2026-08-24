import { describe, it, expect } from 'vitest';
import { createDeck, shuffle } from './deck';
import { createRng } from './rng';

function key(card: { rank: number; suit: number }): string {
  return `${card.rank}-${card.suit}`;
}

describe('createDeck', () => {
  it('has 52 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(key)).size).toBe(52);
  });
});

describe('shuffle', () => {
  it('is deterministic for the same seed', () => {
    const deck = createDeck();
    const a = shuffle(deck, createRng(42));
    const b = shuffle(deck, createRng(42));
    expect(a).toEqual(b);
  });

  it('diverges for different seeds', () => {
    const deck = createDeck();
    const a = shuffle(deck, createRng(1));
    const b = shuffle(deck, createRng(2));
    expect(a).not.toEqual(b);
  });

  it('preserves all 52 cards, just reordered', () => {
    const deck = createDeck();
    const shuffled = shuffle(deck, createRng(7));
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map(key))).toEqual(new Set(deck.map(key)));
  });

  it('does not mutate the input deck', () => {
    const deck = createDeck();
    const before = deck.map(key);
    shuffle(deck, createRng(3));
    expect(deck.map(key)).toEqual(before);
  });
});
