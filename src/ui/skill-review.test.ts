import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../engine/cards';
import { predictBestDiscard } from '../engine/ai';
import { rateSkill, skillLabel, type SkillDecision } from './skill-review';
import { discardLoss } from './coach';

const c = (rank: number, suit = 0): Card => ({ rank: rank as Rank, suit: suit as Suit });

// Session 70: the review coach's rating and mistakes.
describe('the review coach', () => {
  const hand = [c(5), c(5, 1), c(11, 2), c(12, 3), c(13), c(2, 2)];
  const discard = (thrown: [Card, Card]): SkillDecision => ({ kind: 'discard', handIndex: 2, hand, thrown, ownCrib: false });

  it('labels the ladder at its edges', () => {
    expect([0, 59, 60, 74, 75, 87, 88, 95, 96, 100].map(skillLabel)).toEqual(['Learning', 'Learning', 'Steady', 'Steady', 'Sharp', 'Sharp', 'Expert', 'Expert', 'Flawless', 'Flawless']);
  });

  it("rates the coach's own discard 100, with no mistakes", () => {
    const best = predictBestDiscard(hand, false);
    expect(rateSkill([discard(best)])).toMatchObject({ rating: 100, label: 'Flawless', decisions: 1, mistakes: [] });
  });

  it('names a costly discard, with its hand and the points it gave up', () => {
    // Throwing both fives away is a big loss.
    const r = rateSkill([discard([c(5), c(5, 1)])])!;
    expect(r.rating).toBeLessThan(50);
    expect(r.mistakes).toHaveLength(1);
    expect(r.mistakes[0]).toMatchObject({ kind: 'discard', hand: 3 });
    expect(r.mistakes[0].lost).toBeGreaterThan(1);
    expect(r.mistakes[0].text).toContain('I would have kept');
  });

  it("skips a play that didn't matter, and has nothing to rate with nothing asked", () => {
    const only: SkillDecision = { kind: 'play', handIndex: 0, spot: { legal: [c(4)], count: 20, sequence: [c(10), c(10, 1)], known: [c(4)], opponentCards: 2 }, played: c(4), hand: [c(4)] };
    expect(rateSkill([only])).toBeNull();
    expect(rateSkill([])).toBeNull();
  });

  it('keeps a slot for the worst pegging play, even when discards cost more', () => {
    const spot = { legal: [c(5), c(4, 1)], count: 0, sequence: [], known: [c(5), c(4, 1), c(9, 2), c(9, 3)], opponentCards: 4 };
    const bigDiscards = [0, 1, 3].map((h) => ({ ...discard([c(5), c(5, 1)]), handIndex: h }));
    const r = rateSkill([...bigDiscards, { kind: 'play', handIndex: 4, spot, played: c(5), hand: [c(5), c(4, 1)] }])!;
    expect(r.mistakes.map((m) => m.kind)).toEqual(['discard', 'discard', 'play']);
  });

  // Session 72 (the user): plain arithmetic, 100 less 10 for each point
  // given up per hand; only whole-point mistakes are listed.
  const pairs = hand.flatMap((a, i) => hand.slice(i + 1).map((b) => [a, b] as [Card, Card]));
  const lossOf = (p: [Card, Card]) => discardLoss(hand, p, false);

  it('rates 100 less 10 for each point given up per hand', () => {
    const [x, y] = [pairs[0], pairs[5]];
    const r = rateSkill([discard(x), { ...discard(y), handIndex: 3 }])!;
    expect(r.hands).toBe(2);
    expect(r.lostPerHand).toBeCloseTo((lossOf(x) + lossOf(y)) / 2, 9);
    expect(r.rating).toBe(Math.max(0, Math.round(100 - 10 * r.lostPerHand)));
  });

  it("doesn't list a choice that gave up less than a whole point", () => {
    const small = pairs.find((p) => lossOf(p) > 0 && lossOf(p) < 1)!;
    expect(small).toBeDefined();
    const r = rateSkill([discard(small)])!;
    expect(r.rating).toBeLessThan(100);
    expect(r.mistakes).toEqual([]);
  });

  it("counts a run's hands across fights (each fight starts again at hand 1)", () => {
    const best = predictBestDiscard(hand, false);
    const play: SkillDecision = { kind: 'play', handIndex: 0, spot: { legal: [c(5), c(4, 1)], count: 0, sequence: [], known: [c(5), c(4, 1)], opponentCards: 4 }, played: c(4, 1), hand: [c(5), c(4, 1)] };
    const r = rateSkill([{ ...discard(best), handIndex: 0 }, play, { ...discard(best), handIndex: 0 }, play])!;
    expect(r.hands).toBe(2);
  });

  it('marks a pegging play that hands over a fifteen', () => {
    // Leading a 5 invites any ten-card for 15; a 4 can't be made 15.
    const spot = { legal: [c(5), c(4, 1)], count: 0, sequence: [], known: [c(5), c(4, 1), c(9, 2), c(9, 3)], opponentCards: 4 };
    const bad = rateSkill([{ kind: 'play', handIndex: 1, spot, played: c(5), hand: [c(5), c(4, 1)] }])!;
    const good = rateSkill([{ kind: 'play', handIndex: 1, spot, played: c(4, 1), hand: [c(5), c(4, 1)] }])!;
    expect(good.rating).toBe(100);
    expect(bad.rating).toBeLessThan(good.rating);
    expect(bad.mistakes[0]?.kind).toBe('play');
  });
});
