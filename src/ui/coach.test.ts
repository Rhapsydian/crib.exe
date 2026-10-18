import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../engine/cards';
import { discardReview, keepNotes, pegHint, phaseIntro, showSummary } from './coach';
import { playCribbageGame } from '../engine/basic-cribbage';

const c = (rank: number, suit = 0): Card => ({ rank: rank as Rank, suit: suit as Suit });

// Milestone 4 checkpoint 4: the coach's advice, checked on known hands.
describe('the coach', () => {
  it('names what a keep scores among itself', () => {
    expect(keepNotes([c(5), c(5, 1), c(10), c(13)])).toEqual(['4 fifteens (8)', 'a pair of 5s (2)']);
    expect(keepNotes([c(4), c(5, 1), c(6, 2), c(9)])).toContain('a run 4-5-6 (3)');
    expect(keepNotes([c(2), c(4), c(8), c(12)]).some((n) => n.includes('flush'))).toBe(true);
    expect(keepNotes([c(1, 0), c(3, 1), c(5, 2), c(12, 3)])).toEqual(['a fifteen (2)']);
  });

  it("agrees with an obviously right discard, and explains a worse one", () => {
    // 5 5 J Q K 2: keep the fives and two ten-cards; throw the junk.
    const hand = [c(5), c(5, 1), c(11, 2), c(12, 3), c(13), c(2, 2)];
    const good = discardReview(hand, [c(13), c(2, 2)], true);
    expect(good.coach.kept.some((k) => k.rank === 5)).toBe(true);
    const bad = discardReview(hand, [c(5), c(5, 1)], true);
    expect(bad.same).toBe(false);
    expect(bad.coach.average).toBeGreaterThan(bad.yours.average);
    expect(bad.text).toMatch(/I'd keep/);
  });

  it('pegging: takes an immediate score, warns off 5 and 21, leads under 5', () => {
    expect(pegHint([c(5), c(9)], 10, [c(10)])).toBe('Play 5: fifteen for 2.');
    expect(pegHint([c(7), c(3)], 7, [c(7, 1)])).toMatch(/^Play 7: a pair/);
    expect(pegHint([c(1), c(9)], 4, [c(4)])).toMatch(/Careful: A leaves the count on 5/);
    expect(pegHint([c(3), c(10)], 0, [])).toMatch(/under 5/);
  });

  it('walks through the last count, one line per hand counted', () => {
    const game = playCribbageGame({ seed: 3, skills: [0.75, 0.75] });
    const firstShowEnd = game.timeline.findIndex((b, i) => b.kind === 'hand' && i > 0);
    const lines = showSummary(game.timeline.slice(0, firstShowEnd + 1));
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(line).toMatch(/^(Your|Their) (hand|crib): .*(= \d+|nothing)/);
  });

  it('introduces each phase, shorter after the first time', () => {
    for (const phase of ['discard', 'peg', 'show'] as const) expect(phaseIntro(phase, true, true).length).toBeGreaterThan(phaseIntro(phase, true, false).length);
    expect(phaseIntro('discard', false, false)).toMatch(/theirs/);
  });
});
