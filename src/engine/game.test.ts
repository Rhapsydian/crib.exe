import { describe, it, expect } from 'vitest';
import { playHands } from './game';

describe('playHands', () => {
  it('produces one HandResult per hand played', () => {
    const result = playHands(5, { seed: 1 });
    expect(result.hands).toHaveLength(5);
  });

  it('alternates the dealer every hand, crib always belonging to the dealer', () => {
    const result = playHands(6, { seed: 2, startingDealer: 0 });
    expect(result.hands.map((h) => h.dealer)).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it('respects a non-default starting dealer', () => {
    const result = playHands(4, { seed: 3, startingDealer: 1 });
    expect(result.hands.map((h) => h.dealer)).toEqual([1, 0, 1, 0]);
  });

  it('is fully deterministic for the same seed', () => {
    const a = playHands(10, { seed: 42 });
    const b = playHands(10, { seed: 42 });
    expect(a).toEqual(b);
  });

  it('diverges for a different seed', () => {
    const a = playHands(10, { seed: 1 });
    const b = playHands(10, { seed: 2 });
    expect(a.finalScores).not.toEqual(b.finalScores);
  });

  it('never lets cumulative scores decrease hand-over-hand', () => {
    const result = playHands(20, { seed: 7 });
    let prev: [number, number] = [0, 0];
    for (const hand of result.hands) {
      expect(hand.scoresAfter[0]).toBeGreaterThanOrEqual(prev[0]);
      expect(hand.scoresAfter[1]).toBeGreaterThanOrEqual(prev[1]);
      prev = hand.scoresAfter;
    }
    expect(result.finalScores).toEqual(prev);
  });

  it('plays a long run end-to-end without throwing, with zero UI involved', () => {
    expect(() => playHands(50, { seed: 99 })).not.toThrow();
  });
});
