import { describe, it, expect } from 'vitest';
import { EVASION_HANDS, evasionGame, evasionHeadStart, playEvasion } from './evasion';
import { playCribbageGame } from './basic-cribbage';

// Session 63, docs/design/trace-evasion.md.
describe('trace evasion', () => {
  it('TE1: the head start is a point per 10% of the Containment it had, 0-9', () => {
    expect(evasionHeadStart(0)).toBe(0);
    expect(evasionHeadStart(0.0999)).toBe(0);
    expect(evasionHeadStart(0.1)).toBe(1);
    expect(evasionHeadStart(0.52)).toBe(5);
    expect(evasionHeadStart(0.7)).toBe(7);
    expect(evasionHeadStart(0.999)).toBe(9);
    expect(evasionHeadStart(1)).toBe(9);
  });

  it('TE2: three hands from its head start, you dealing the 1st and 3rd', () => {
    const r = playEvasion(7, 5, [0.85, 0.78]);
    const hands = r.timeline.filter((b) => b.kind === 'hand');
    expect(hands).toHaveLength(EVASION_HANDS);
    expect(hands.map((b) => (b.kind === 'hand' ? b.dealer : -1))).toEqual([0, 1, 0]);
    expect(hands[0].scores).toEqual([0, 5]);
  });

  it('TE3: you escape only by finishing strictly ahead; a tie goes to the network', () => {
    let ties = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = playEvasion(seed, 3, [0.6, 0.78]);
      expect(r.escaped).toBe(r.finalScores[0] > r.finalScores[1]);
      if (r.finalScores[0] === r.finalScores[1]) ties++;
    }
    expect(ties).toBeGreaterThan(0);
  });

  it('pauses for both sides, like a fight, and ends after the third hand', () => {
    const game = evasionGame(3, 2);
    let step = game.next();
    const sides = new Set<number>();
    while (!step.done) {
      const r = step.value;
      sides.add(r.side);
      step = game.next(r.kind === 'discard' ? [r.context.hand[0], r.context.hand[1]] : r.context.legalCards[0]);
    }
    expect([...sides].sort()).toEqual([0, 1]);
    expect(step.value.timeline.filter((b) => b.kind === 'hand')).toHaveLength(3);
  });

  it("the two cribs are the runner's edge: even players, no head start, you finish ahead more often", () => {
    let ahead = 0;
    for (let seed = 1; seed <= 300; seed++) if (playEvasion(seed, 0, [0.8, 0.8]).escaped) ahead++;
    expect(ahead / 300).toBeGreaterThan(0.5);
  });

  it('leaves the ordinary game alone: still a race to 121', () => {
    const r = playCribbageGame({ seed: 5, skills: [0.8, 0.8] });
    expect(Math.max(...r.finalScores)).toBe(121);
  });
}, 60_000);
