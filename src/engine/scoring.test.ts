import { describe, it, expect } from 'vitest';
import type { Card } from './cards';
import { countHand, countCrib } from './scoring';

describe('countHand — the maximum hand', () => {
  it('scores 29 for 5-5-5-J with a matching-suit 5 starter', () => {
    const hand: Card[] = [
      { rank: 5, suit: 0 },
      { rank: 5, suit: 1 },
      { rank: 5, suit: 2 },
      { rank: 11, suit: 3 },
    ];
    const starter: Card = { rank: 5, suit: 3 };
    const score = countHand(hand, starter);
    expect(score.fifteens).toBe(16);
    expect(score.pairs).toBe(12);
    expect(score.runs).toBe(0);
    expect(score.flush).toBe(0);
    expect(score.nobs).toBe(1);
    expect(score.total).toBe(29);
  });
});

describe('countHand — fifteens', () => {
  it('scores 2 per combination summing to 15, counting every combination', () => {
    // Cards 10, 2, 4, 6, 5 — two distinct combinations sum to 15:
    // {10, 5} and {4, 6, 5}. 2 combos * 2 points = 4.
    const hand: Card[] = [
      { rank: 10, suit: 0 },
      { rank: 2, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 6, suit: 0 },
    ];
    const starter: Card = { rank: 5, suit: 1 };
    const score = countHand(hand, starter);
    expect(score.fifteens).toBe(4);
  });
});

describe('countHand — pairs', () => {
  it('scores 0 for no pairs', () => {
    const hand: Card[] = [
      { rank: 2, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 9, suit: 0 },
    ];
    const starter: Card = { rank: 12, suit: 1 };
    expect(countHand(hand, starter).pairs).toBe(0);
  });

  it('scores 2 for a single pair', () => {
    const hand: Card[] = [
      { rank: 2, suit: 0 },
      { rank: 2, suit: 1 },
      { rank: 6, suit: 0 },
      { rank: 9, suit: 0 },
    ];
    const starter: Card = { rank: 12, suit: 1 };
    expect(countHand(hand, starter).pairs).toBe(2);
  });
});

describe('countHand — runs', () => {
  it('scores 3 for a single run of 3', () => {
    const hand: Card[] = [
      { rank: 4, suit: 0 },
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 9, suit: 0 },
    ];
    const starter: Card = { rank: 12, suit: 1 };
    expect(countHand(hand, starter).runs).toBe(3);
  });

  it('scores a double run of 3 (run length 3, twice, from the duplicated rank)', () => {
    const hand: Card[] = [
      { rank: 4, suit: 0 },
      { rank: 4, suit: 1 },
      { rank: 5, suit: 0 },
      { rank: 6, suit: 0 },
    ];
    const starter: Card = { rank: 12, suit: 1 };
    const score = countHand(hand, starter);
    expect(score.runs).toBe(6); // run of 3, scored twice (one per copy of the 4)
    expect(score.pairs).toBe(2); // the duplicated 4s, counted separately from runs
  });
});

describe('countHand — flush', () => {
  it('scores 4 when the 4 hand cards match suit but the starter does not', () => {
    const hand: Card[] = [
      { rank: 2, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 9, suit: 0 },
    ];
    const starter: Card = { rank: 12, suit: 1 };
    expect(countHand(hand, starter).flush).toBe(4);
  });

  it('scores 5 when the starter also matches', () => {
    const hand: Card[] = [
      { rank: 2, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 9, suit: 0 },
    ];
    const starter: Card = { rank: 12, suit: 0 };
    expect(countHand(hand, starter).flush).toBe(5);
  });

  it('scores 0 when the 4 hand cards do not all match, even if 3 do', () => {
    const hand: Card[] = [
      { rank: 2, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 9, suit: 1 },
    ];
    const starter: Card = { rank: 12, suit: 0 };
    expect(countHand(hand, starter).flush).toBe(0);
  });
});

describe('countCrib — stricter flush', () => {
  it('scores 0 when only the 4 crib cards match but the starter does not (unlike a hand)', () => {
    const crib: Card[] = [
      { rank: 2, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 9, suit: 0 },
    ];
    const starter: Card = { rank: 12, suit: 1 };
    expect(countCrib(crib, starter).flush).toBe(0);
  });

  it('scores 5 when all 5 cards match suit', () => {
    const crib: Card[] = [
      { rank: 2, suit: 0 },
      { rank: 4, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 9, suit: 0 },
    ];
    const starter: Card = { rank: 12, suit: 0 };
    expect(countCrib(crib, starter).flush).toBe(5);
  });
});

describe('countHand/countCrib — his nobs', () => {
  it('scores 1 when holding the Jack matching the starter suit', () => {
    const hand: Card[] = [
      { rank: 11, suit: 2 },
      { rank: 4, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 9, suit: 0 },
    ];
    const starter: Card = { rank: 3, suit: 2 };
    expect(countHand(hand, starter).nobs).toBe(1);
  });

  it('scores 0 when the held Jack does not match the starter suit', () => {
    const hand: Card[] = [
      { rank: 11, suit: 1 },
      { rank: 4, suit: 0 },
      { rank: 6, suit: 0 },
      { rank: 9, suit: 0 },
    ];
    const starter: Card = { rank: 3, suit: 2 };
    expect(countHand(hand, starter).nobs).toBe(0);
  });
});

describe('countHand/countCrib — input validation', () => {
  it('throws if given anything other than 4 cards', () => {
    const starter: Card = { rank: 3, suit: 2 };
    expect(() => countHand([{ rank: 4, suit: 0 }], starter)).toThrow();
  });
});
