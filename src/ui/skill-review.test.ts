import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../engine/cards';
import { predictBestDiscard } from '../engine/ai';
import { rateSkill, type SkillDecision } from './skill-review';
import { starsFor, starLabel, starText } from '../engine/skill';
import { discardLoss } from './coach';

const c = (rank: number, suit = 0): Card => ({ rank: rank as Rank, suit: suit as Suit });

// Session 70: the review coach's rating and mistakes.
describe('the review coach', () => {
  const hand = [c(5), c(5, 1), c(11, 2), c(12, 3), c(13), c(2, 2)];
  const discard = (thrown: [Card, Card]): SkillDecision => ({ kind: 'discard', handIndex: 2, hand, thrown, ownCrib: false });

  // Stars (session 72): the most points given up per hand each allows.
  it('gives stars by points given up per hand, at the edges', () => {
    expect([0, 0.4, 0.41, 1.2, 1.21, 2.5, 2.51, 4.0, 4.01, 9].map(starsFor)).toEqual([5, 5, 4, 4, 3, 3, 2, 2, 1, 1]);
    expect([1, 2, 3, 4, 5].map((s) => starLabel(s as 1))).toEqual(['Learning', 'Steady', 'Sharp', 'Expert', 'Flawless']);
    expect(starText(4)).toBe('★★★★☆');
  });

  it("rates the coach's own discard 5 stars, with no mistakes", () => {
    const best = predictBestDiscard(hand, false);
    expect(rateSkill([discard(best)])).toMatchObject({ stars: 5, label: 'Flawless', decisions: 1, mistakes: [] });
  });

  it('names a costly discard, with its hand and the points it gave up', () => {
    // Throwing both fives away is a big loss.
    const r = rateSkill([discard([c(5), c(5, 1)])])!;
    expect(r.stars).toBeLessThanOrEqual(2);
    expect(r.mistakes).toHaveLength(1);
    expect(r.mistakes[0]).toMatchObject({ kind: 'discard', hand: 3 });
    expect(r.mistakes[0].lost).toBeGreaterThan(1);
  });

  it("skips a play that didn't matter, and has nothing to rate with nothing asked", () => {
    const only: SkillDecision = { kind: 'play', handIndex: 0, spot: { legal: [c(4)], count: 20, sequence: [c(10), c(10, 1)], known: [c(4)], opponentCards: 2 }, played: c(4), hand: [c(4)] };
    expect(rateSkill([only])).toBeNull();
    expect(rateSkill([])).toBeNull();
  });

  // Session 72 (the user): the three costliest, whatever they cost; no
  // slot kept for pegging.
  it('lists the three costliest choices, most first, with no slot kept for pegging', () => {
    const spot = { legal: [c(5), c(4, 1)], count: 0, sequence: [], known: [c(5), c(4, 1), c(9, 2), c(9, 3)], opponentCards: 4 };
    const bigDiscards = [0, 1, 3].map((h) => ({ ...discard([c(5), c(5, 1)]), handIndex: h }));
    const r = rateSkill([...bigDiscards, { kind: 'play', handIndex: 4, spot, played: c(5), hand: [c(5), c(4, 1)] }])!;
    expect(r.mistakes.map((m) => m.kind)).toEqual(['discard', 'discard', 'discard']);
  });

  // Session 72 (the user): plain arithmetic, 100 less 10 for each point
  // given up per hand; only whole-point mistakes are listed.
  const pairs = hand.flatMap((a, i) => hand.slice(i + 1).map((b) => [a, b] as [Card, Card]));
  const lossOf = (p: [Card, Card]) => discardLoss(hand, p, false);

  it('rates by the points given up per hand', () => {
    const [x, y] = [pairs[0], pairs[5]];
    const r = rateSkill([discard(x), { ...discard(y), handIndex: 3 }])!;
    expect(r.hands).toBe(2);
    expect(r.lostPerHand).toBeCloseTo((lossOf(x) + lossOf(y)) / 2, 9);
    expect(r.stars).toBe(starsFor(r.lostPerHand));
  });

  it('lists a choice that gave up less than a whole point, too', () => {
    const small = pairs.find((p) => lossOf(p) > 0 && lossOf(p) < 1)!;
    expect(small).toBeDefined();
    const r = rateSkill([discard(small)])!;
    expect(r.mistakes).toHaveLength(1);
    expect(r.mistakes[0].lost).toBeLessThan(1);
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
    expect(good.stars).toBe(5);
    expect(bad.lostPerHand).toBeGreaterThan(good.lostPerHand);
    expect(bad.mistakes[0]?.kind).toBe('play');
  });
});
