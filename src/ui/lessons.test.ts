import { describe, expect, it } from 'vitest';
import { cardValue } from '../engine/cards';
import { LESSONS, findTargets, handTotal, pegGoalMet } from './lessons';

// Milestone 4 checkpoint 5: the lessons can't teach a wrong count -- every
// answer is checked against the engine's own scoring.
describe('the lessons', () => {
  const key = (c: { rank: number; suit: number }) => `${c.rank}-${c.suit}`;

  it('are five, each with steps, ids unique', () => {
    expect(LESSONS).toHaveLength(5);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(5);
    for (const l of LESSONS) expect(l.steps.length).toBeGreaterThan(2);
  });

  it("every count asked for is the engine's count", () => {
    let counted = 0;
    for (const l of LESSONS)
      for (const s of l.steps) {
        if (s.kind !== 'choice') continue;
        expect(s.answer).toBeLessThan(s.options.length);
        if (s.prompt.startsWith('Count') && s.cards && s.starter) {
          expect(Number(s.options[s.answer]), `${l.id}: ${s.prompt}`).toBe(handTotal(s.cards, s.starter));
          expect(s.explain).toContain(`Total ${handTotal(s.cards, s.starter)}`);
          counted++;
        }
      }
    expect(counted).toBe(3);
  });

  it('every find step has something to find, and says how many fifteens', () => {
    for (const l of LESSONS)
      for (const s of l.steps) {
        if (s.kind !== 'find') continue;
        expect(findTargets(s).length).toBeGreaterThan(0);
      }
    const fifteens = LESSONS[1].steps.find((s) => s.kind === 'find' && s.category === 'fifteen');
    if (fifteens?.kind !== 'find') throw new Error('unreachable');
    expect(findTargets(fifteens)).toHaveLength(3);
  });

  it('every pegging step has a right card and a wrong one, all playable', () => {
    for (const l of LESSONS)
      for (const s of l.steps) {
        if (s.kind !== 'peg') continue;
        const count = s.sequence.reduce((sum, x) => sum + cardValue(x), 0);
        for (const card of s.hand) expect(count + cardValue(card), `${l.id}: ${s.prompt}`).toBeLessThanOrEqual(31);
        expect(s.hand.some((card) => pegGoalMet(s, card)), s.prompt).toBe(true);
        expect(s.hand.some((card) => !pegGoalMet(s, card)), s.prompt).toBe(true);
      }
  });

  it('no step shows the same card twice', () => {
    for (const l of LESSONS)
      for (const s of l.steps) {
        const cards = [...('hand' in s ? s.hand : []), ...('cards' in s && s.cards ? s.cards : []), ...('starter' in s && s.starter ? [s.starter] : []), ...('sequence' in s ? s.sequence : [])];
        expect(new Set(cards.map(key)).size, `${l.id}: ${'prompt' in s ? s.prompt : s.text.slice(0, 30)}`).toBe(cards.length);
        if (s.kind === 'discard') expect(s.hand).toHaveLength(6);
      }
  });
});
