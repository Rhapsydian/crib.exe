import { describe, it, expect } from 'vitest';
import { DIFFICULTIES, WIN_SCORE, cribbageGame, playBasicCribbageGame, playCribbageGame, skunkOf } from './basic-cribbage';

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

// Milestone 4: the playable game (cribbageGame / playCribbageGame).
describe('cribbageGame (milestone 4)', () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

  it('ends the moment the winner reaches 121: winner on exactly 121, loser below', () => {
    for (const seed of seeds) {
      const r = playCribbageGame({ seed, skills: [0.75, 0.75] });
      expect(r.finalScores[r.winner]).toBe(WIN_SCORE);
      expect(r.finalScores[(1 - r.winner) as 0 | 1]).toBeLessThan(WIN_SCORE);
      expect(r.timeline[r.timeline.length - 1].scores).toEqual(r.finalScores);
      expect(r.skunk).toBe(skunkOf(r.finalScores[(1 - r.winner) as 0 | 1]));
    }
  });

  it('can end mid-pegging, not only after a whole hand', () => {
    const endings = new Set(seeds.map((seed) => playCribbageGame({ seed, skills: [0.75, 0.75] }).timeline.at(-1)!.kind));
    expect(endings).toContain('peg');
    expect(endings).toContain('show');
  });

  it('is deterministic per seed, and the scores only ever climb by what each beat scored', () => {
    for (const seed of seeds.slice(0, 10)) {
      const a = playCribbageGame({ seed, skills: [0.4, 1] });
      expect(JSON.stringify(playCribbageGame({ seed, skills: [0.4, 1] }))).toBe(JSON.stringify(a));
      let prev: [number, number] = [0, 0];
      for (const beat of a.timeline) {
        const gained = [beat.scores[0] - prev[0], beat.scores[1] - prev[1]];
        const points = beat.kind === 'cut' ? beat.heels : beat.kind === 'show' ? beat.total : beat.kind === 'peg' ? (beat.event.type === 'play' ? beat.event.score : beat.event.type === 'go-point' ? 1 : 0) : 0;
        const scorer = beat.kind === 'cut' ? beat.dealer : beat.kind === 'show' ? beat.player : beat.kind === 'peg' ? beat.event.player : 0;
        // The last beat may be capped at 121.
        expect(gained[scorer]).toBeLessThanOrEqual(points);
        if (beat !== a.timeline.at(-1)) expect(gained[scorer]).toBe(points);
        expect(gained[1 - scorer]).toBe(0);
        prev = beat.scores;
      }
    }
  });

  it("counts the show in order: non-dealer's hand, dealer's hand, the crib", () => {
    const r = playCribbageGame({ seed: 3, skills: [0.75, 0.75] });
    const handsBeats = r.timeline.filter((b) => b.kind === 'hand');
    const first = handsBeats[0];
    if (first.kind !== 'hand') throw new Error('unreachable');
    const show = r.timeline.filter((b) => b.kind === 'show').slice(0, 3);
    expect(show.map((b) => (b.kind === 'show' ? `${b.owner}:${b.player === first.dealer ? 'dealer' : 'non'}` : ''))).toEqual(['hand:non', 'hand:dealer', 'crib:dealer']);
  });

  it('pauses for both sides: a six-card discard each hand, then each pegging card', () => {
    const game = cribbageGame({ seed: 5 });
    let step = game.next();
    const kinds: string[] = [];
    for (let i = 0; i < 10 && !step.done; i++) {
      const r = step.value;
      kinds.push(`${r.kind}${r.side}`);
      if (r.kind === 'discard') {
        expect(r.context.hand).toHaveLength(6);
        step = game.next([r.context.hand[0], r.context.hand[1]]);
      } else step = game.next(r.context.legalCards[0]);
    }
    expect(kinds.slice(0, 2)).toEqual(['discard0', 'discard1']);
    expect(kinds.slice(2).every((k) => k === 'play0' || k === 'play1')).toBe(true);
  });

  it('the better player wins more often', () => {
    let strongWins = 0;
    for (let seed = 1; seed <= 200; seed++) if (playCribbageGame({ seed, skills: [1, 0.2], startingDealer: (seed % 2) as 0 | 1 }).winner === 0) strongWins++;
    expect(strongWins).toBeGreaterThan(110);
  });

  it('defines the four difficulty levels in rising skill, the coach on only for Learn to play', () => {
    const levels = Object.values(DIFFICULTIES);
    expect(levels.map((l) => l.name)).toEqual(['Learn to play', 'Easy', 'Normal', 'Hard']);
    for (let i = 1; i < levels.length; i++) expect(levels[i].skill).toBeGreaterThan(levels[i - 1].skill);
    expect(levels.map((l) => l.coach)).toEqual([true, false, false, false]);
  });
});
