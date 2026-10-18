import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../engine/cards';
import { discardHint, discardReview, keepScore, pegHint, pegReview, phaseIntro, showSummary } from './coach';
import { playCribbageGame } from '../engine/basic-cribbage';

const c = (rank: number, suit = 0): Card => ({ rank: rank as Rank, suit: suit as Suit });

// Milestone 4 checkpoint 4: the coach's advice, checked on known hands.
describe('the coach', () => {
  it('scores a keep before the cut, part by part', () => {
    expect(keepScore([c(9), c(6), c(9, 1), c(6, 1)])).toEqual({ pts: 12, parts: ['4 fifteens for 8', 'a pair of 9s for 2', 'a pair of 6s for 2'] });
    expect(keepScore([c(4), c(4, 1), c(5, 2), c(6)])).toEqual({ pts: 12, parts: ['2 fifteens for 4', 'a pair of 4s for 2', '2 runs 4-5-6 for 6'] });
    expect(keepScore([c(2), c(4), c(8), c(12)])).toEqual({ pts: 4, parts: [expect.stringContaining('flush for 4')] });
    expect(keepScore([c(1), c(3, 1), c(7, 2), c(12, 3)]).pts).toBe(0);
  });

  it("agrees with an obviously right discard, and explains a worse one", () => {
    // 5 5 J Q K 2: keep the fives and two ten-cards; throw the junk.
    const hand = [c(5), c(5, 1), c(11, 2), c(12, 3), c(13), c(2, 2)];
    expect(discardReview(hand, [c(13), c(2, 2)], true).same).toBe(true);
    expect(discardHint(hand, true)).toMatch(/^Keep 5 5 .*: \d+ points in hand \(.*\), plus about \d\.\d more on average from the cut\. Throw .* into your crib\.$/);
    const bad = discardReview(hand, [c(5), c(5, 1)], true);
    expect(bad.same).toBe(false);
    expect(bad.text).toMatch(/I would have kept/);
  });

  /** A pegging spot: the legal cards (the whole hand here), the count
   * and the cards on the table, and the cut. */
  const spot = (legal: Card[], count: number, sequence: Card[], starter = c(13, 3), opponentCards = 3) => ({ legal, count, sequence, known: [...legal, ...sequence, starter], opponentCards });

  it('pegging hint: takes an immediate score, leads under 5', () => {
    expect(pegHint(spot([c(5), c(9)], 10, [c(10)]))).toBe('Play 5: fifteen for 2.');
    expect(pegHint(spot([c(7), c(3)], 7, [c(7, 1)]))).toMatch(/^Play 7: a pair/);
    expect(pegHint(spot([c(3), c(10)], 0, []))).toMatch(/^Lead 3: they can't make 15/);
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

  it('reviews your last pegging card in the past tense, judging what it handed them', () => {
    expect(pegReview(spot([c(5), c(9)], 10, [c(10)]), c(5)).text).toMatch(/^Good play: 5 \(fifteen for 2/);
    const missed = pegReview(spot([c(5), c(9)], 10, [c(10)]), c(9));
    expect(missed.same).toBe(false);
    expect(missed.text).toMatch(/^You played 9 \(no score.*\)\. I would have played 5 \(fifteen for 2/);
    // Leading a 5 hands them fifteens off any ten-card; a 2 doesn't.
    const lead = pegReview(spot([c(5), c(2)], 0, []), c(5));
    expect(lead.same).toBe(false);
    expect(lead.text).toMatch(/I would have played 2/);
    // The quiet trap: neither card scores, but a 2 on a 9 leaves 11, where
    // any 4 makes 15 -- the K leaves 19, where nothing makes 15 or 31.
    const trap = pegReview(spot([c(13), c(2)], 9, [c(9)]), c(2));
    expect(trap.same).toBe(false);
    expect(trap.text).toMatch(/You played 2 \(no score; then any 4 would give them fifteen for 2\)\. I would have played K/);
    expect(pegReview(spot([c(13), c(2)], 9, [c(9)]), c(13)).same).toBe(true);
  });
});
