import { describe, it, expect } from 'vitest';
import { playBasicCribbageGame } from './basic-cribbage';

describe('playBasicCribbageGame', () => {
  it('ends with the winning side at or above 121', () => {
    const result = playBasicCribbageGame({ seed: 1 });
    expect(result.finalScores[result.winner]).toBeGreaterThanOrEqual(121);
  });

  it('is fully deterministic for the same seed', () => {
    const a = playBasicCribbageGame({ seed: 42 });
    const b = playBasicCribbageGame({ seed: 42 });
    expect(a).toEqual(b);
  });

  it('diverges for a different seed', () => {
    const a = playBasicCribbageGame({ seed: 1 });
    const b = playBasicCribbageGame({ seed: 2 });
    expect(a.finalScores).not.toEqual(b.finalScores);
  });

  it('respects a non-default starting dealer', () => {
    const result = playBasicCribbageGame({ seed: 5, startingDealer: 1 });
    expect(result.hands[0].dealer).toBe(1);
  });

  it('defaults to starting dealer 0', () => {
    const result = playBasicCribbageGame({ seed: 5 });
    expect(result.hands[0].dealer).toBe(0);
  });

  it('flags a skunk when the loser finishes under 91', () => {
    // Overwhelming skill gap -- side 1 (skill 1) should regularly blow
    // side 0 (skill 0) out well past skunk range.
    const seeds = Array.from({ length: 30 }, (_, i) => i);
    const results = seeds.map((seed) => playBasicCribbageGame({ seed, playerSkill: 0, enemySkill: 1 }));
    expect(results.some((r) => r.skunk)).toBe(true);
  });

  it('a double skunk always implies a skunk (61 < 91)', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => i);
    const results = seeds.map((seed) => playBasicCribbageGame({ seed, playerSkill: 0, enemySkill: 1 }));
    for (const r of results) {
      if (r.doubleSkunk) expect(r.skunk).toBe(true);
    }
  });

  it('never flags a skunk when the loser finishes at or above 91', () => {
    const result = playBasicCribbageGame({ seed: 5 });
    const loserScore = result.finalScores[1 - result.winner];
    if (loserScore >= 91) expect(result.skunk).toBe(false);
  });

  describe('never-interlocked skill dial (session 39)', () => {
    it('playerSkill alone shifts outcomes without needing enemySkill set', () => {
      const withSkill = playBasicCribbageGame({ seed: 3, playerSkill: 1 });
      const withoutSkill = playBasicCribbageGame({ seed: 3 });
      expect(withSkill.finalScores).not.toEqual(withoutSkill.finalScores);
    });

    it('enemySkill alone shifts outcomes without needing playerSkill set', () => {
      const withSkill = playBasicCribbageGame({ seed: 3, enemySkill: 1 });
      const withoutSkill = playBasicCribbageGame({ seed: 3 });
      expect(withSkill.finalScores).not.toEqual(withoutSkill.finalScores);
    });

    it("changing enemySkill leaves side 0's own kept-hand scoring untouched, holding playerSkill fixed", () => {
      // Isolates that the two dials are truly independent, not just that
      // both happen to move the score. playerSkill is pinned at 1 (the
      // one skill value with zero mistake-injection temperature, session
      // 26) specifically so side 0's own decisions never touch the
      // shared aiRng stream at all -- at any other skill value, side 1's
      // own softmax draws from that same stream would shift its position
      // for side 0's later draws too, which is real shared-RNG-stream
      // behavior but not what this test is isolating. With playerSkill
      // pinned at 1, side 0's argmax choices are provably independent of
      // aiRng's position, hence independent of whatever enemySkill does
      // to it. Side 0's own hand-count events (dealerHandEvents when
      // it's dealer that hand, nonDealerHandEvents otherwise) must then
      // be identical between the two runs. Games can differ in LENGTH
      // (enemySkill legitimately changes how fast side 1 scores), so
      // this only compares the common prefix -- a length difference is
      // an expected downstream consequence, not evidence the two dials
      // are coupled.
      const low = playBasicCribbageGame({ seed: 8, playerSkill: 1, enemySkill: 0 });
      const high = playBasicCribbageGame({ seed: 8, playerSkill: 1, enemySkill: 1 });
      const side0Events = (result: typeof low) => result.hands.map((h) => (h.dealer === 0 ? h.dealerHandEvents : h.nonDealerHandEvents));
      const commonLength = Math.min(low.hands.length, high.hands.length);
      expect(side0Events(low).slice(0, commonLength)).toEqual(side0Events(high).slice(0, commonLength));
    });
  });

  it('plays a long run end-to-end without throwing, with zero UI involved', () => {
    const seeds = Array.from({ length: 30 }, (_, i) => i);
    expect(() => seeds.forEach((seed) => playBasicCribbageGame({ seed }))).not.toThrow();
  });
});
