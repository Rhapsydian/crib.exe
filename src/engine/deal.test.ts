import { describe, it, expect } from 'vitest';
import { createDeck, shuffle } from './deck';
import { createRng } from './rng';
import { deal, discardToCrib, discardLowestTwo, cut, hisHeels } from './deal';
import type { Card } from './cards';

describe('deal', () => {
  it('deals 6 cards to each of 2 players and leaves 40 in stock', () => {
    const deck = shuffle(createDeck(), createRng(1));
    const { hands, stock } = deal(deck);
    expect(hands[0]).toHaveLength(6);
    expect(hands[1]).toHaveLength(6);
    expect(stock).toHaveLength(40);
  });

  it('deals no duplicate cards across hands and stock', () => {
    const deck = shuffle(createDeck(), createRng(2));
    const { hands, stock } = deal(deck);
    const all = [...hands[0], ...hands[1], ...stock];
    const keys = new Set(all.map((c) => `${c.rank}-${c.suit}`));
    expect(keys.size).toBe(52);
  });
});

describe('discardToCrib', () => {
  it('keeps 4 cards and discards 2', () => {
    const deck = shuffle(createDeck(), createRng(3));
    const { hands } = deal(deck);
    const { keptHand, discarded } = discardToCrib(hands[0], discardLowestTwo);
    expect(keptHand).toHaveLength(4);
    expect(discarded).toHaveLength(2);
  });

  it('discards the two lowest-ranked cards', () => {
    const hand: Card[] = [
      { rank: 10, suit: 0 },
      { rank: 2, suit: 1 },
      { rank: 7, suit: 2 },
      { rank: 1, suit: 3 },
      { rank: 13, suit: 0 },
      { rank: 5, suit: 1 },
    ];
    const { discarded, keptHand } = discardToCrib(hand, discardLowestTwo);
    const discardedRanks = discarded.map((c) => c.rank).sort((a, b) => a - b);
    expect(discardedRanks).toEqual([1, 2]);
    expect(keptHand).toHaveLength(4);
  });

  it('throws if the strategy returns cards not in the hand', () => {
    const hand: Card[] = [
      { rank: 1, suit: 0 },
      { rank: 2, suit: 0 },
      { rank: 3, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
    ];
    expect(() =>
      discardToCrib(hand, () => [
        { rank: 9, suit: 3 },
        { rank: 10, suit: 3 },
      ]),
    ).toThrow();
  });
});

describe('cut', () => {
  it('removes the starter from the stock', () => {
    const deck = shuffle(createDeck(), createRng(4));
    const { stock } = deal(deck);
    const { starter, stock: rest } = cut(stock, createRng(99));
    expect(rest).toHaveLength(stock.length - 1);
    expect(rest.some((c) => c.rank === starter.rank && c.suit === starter.suit)).toBe(false);
  });

  it('is deterministic for the same rng seed', () => {
    const deck = shuffle(createDeck(), createRng(5));
    const { stock } = deal(deck);
    const a = cut(stock.slice(), createRng(11));
    const b = cut(stock.slice(), createRng(11));
    expect(a.starter).toEqual(b.starter);
  });

  it('throws when the stock is empty', () => {
    expect(() => cut([], createRng(1))).toThrow();
  });
});

describe('hisHeels', () => {
  it('scores 2 when the starter is a Jack, regardless of suit', () => {
    for (let suit = 0; suit < 4; suit++) {
      expect(hisHeels({ rank: 11, suit: suit as Card['suit'] })).toBe(2);
    }
  });

  it('scores 0 for any non-Jack starter', () => {
    for (let rank = 1; rank <= 13; rank++) {
      if (rank === 11) continue;
      expect(hisHeels({ rank: rank as Card['rank'], suit: 0 })).toBe(0);
    }
  });
});
