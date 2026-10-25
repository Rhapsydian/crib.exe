import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from './cards';
import { repriceOccurrence } from './triggers';
import { advancePegging, playPeggingCard, scoreCardPlay, startPegging } from './pegging';
import { combatGenerator, playCombat, type CombatOptions } from './combat';
import { CLASS_STARTING_LOADOUTS } from './subroutines';
import { BREACH_THRESHOLD, GAUGE_THRESHOLD } from './encounters';
import { dailyGlitches, type DailyMod } from './daily';
import { discardSkillStrategy, pegSkillStrategy, scoreDiscard } from './ai';

// Session 72 (docs/daily-runs-design.md DR10): the daily Glitches.
const c = (rank: number, suit = 0): Card => ({ rank: rank as Rank, suit: suit as Suit });
const plan = (...mods: DailyMod[]) => ({ date: 't', seed: 1, classId: 'exploit-overclock' as const, mods });

describe('Glitches', () => {
  it('scoring Glitches reprice for a side, on top of a Fold', () => {
    const rule = dailyGlitches(plan({ id: 'fifteen-flood' }, { id: 'running-wild' }, { id: 'nobs-and-heels' }))!.rule!;
    expect(repriceOccurrence({ category: 'fifteen', player: 0, magnitude: 2 }, rule).points).toBe(3);
    expect(repriceOccurrence({ category: 'run', player: 0, magnitude: 3 }, rule).points).toBe(6);
    expect(repriceOccurrence({ category: 'pair', player: 0, magnitude: 6 }, rule).points).toBe(3); // a royal: three pairs at 1
    // On top of a Fold, never overwriting it: Fifteen Fold's fifteens 3 -> 4
    // (its pairs stay 1, the floor); Pair Fold's fifteens 1 -> 2, pairs 5 -> 4.
    expect(repriceOccurrence({ category: 'fifteen', player: 0, magnitude: 2 }, { fifteen: 3, pair: 1, ...rule }).points).toBe(4);
    expect(repriceOccurrence({ category: 'pair', player: 0, magnitude: 2 }, { fifteen: 3, pair: 1, ...rule }).points).toBe(1);
    expect(repriceOccurrence({ category: 'fifteen', player: 0, magnitude: 2 }, { fifteen: 1, pair: 5, ...rule }).points).toBe(2);
    expect(repriceOccurrence({ category: 'pair', player: 0, magnitude: 2 }, { fifteen: 1, pair: 5, ...rule }).points).toBe(4);
    expect(repriceOccurrence({ category: 'hisNobs', player: 0, magnitude: 1 }, rule).points).toBe(4);
    expect(repriceOccurrence({ category: 'hisHeels', player: 1, magnitude: 2 }, rule).points).toBe(4);
  });

  it('Short Count: 21 is the 31 -- it scores 2, resets the count, and caps what can be played', () => {
    expect(scoreCardPlay([c(10), c(11)], 21, 21).thirtyOne).toBe(2);
    expect(scoreCardPlay([c(10), c(11)], 21).thirtyOne).toBe(0);
    const state = startPegging([c(10), c(5)], [c(6), c(9)], 0, 21);
    let step = advancePegging(state);
    expect(step.decision?.limit).toBe(21);
    playPeggingCard(state, c(10)); // 10
    step = advancePegging(state);
    expect(step.decision!.legalCards).toEqual([c(6), c(9)]); // 10+6=16, 10+9=19
    playPeggingCard(state, c(6)); // 16
    step = advancePegging(state);
    const hit = playPeggingCard(state, c(5)); // 21
    expect(hit.breakdown.thirtyOne).toBe(2);
    expect(state.count).toBe(0);
  });

  const kits = [CLASS_STARTING_LOADOUTS['exploit-overclock'], CLASS_STARTING_LOADOUTS['daemon-honeypot']] as const;
  const fight = (glitches?: CombatOptions['glitches']) =>
    playCombat([kits[0], kits[1]], {
      seed: 7,
      gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
      winThreshold: [BREACH_THRESHOLD, BREACH_THRESHOLD],
      classId: 'exploit-overclock',
      discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.6)],
      playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.6)],
      glitches,
    });

  it('a Short Count fight never pegs past 21', () => {
    const r = fight({ countLimit: 21 });
    const counts = r.hands.flatMap((h) => h.peggingEvents.flatMap((e) => (e.type === 'play' ? [e.count] : [])));
    expect(Math.max(...counts)).toBe(21);
  });

  it('an Early Cut fight turns the starter before the discard, and the hand cuts that same card', () => {
    const gen = combatGenerator([kits[0], kits[1]], { seed: 7, gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD], winThreshold: [BREACH_THRESHOLD, BREACH_THRESHOLD], classId: 'exploit-overclock', glitches: { earlyCut: true } });
    const known: Card[] = [];
    const ai = [discardSkillStrategy(0.85), discardSkillStrategy(0.6)];
    const peg = [pegSkillStrategy(0.85), pegSkillStrategy(0.6)];
    let step = gen.next();
    while (!step.done) {
      const r = step.value;
      if (r.kind === 'discard' && r.side === 0) known.push(r.context.starter!);
      step = gen.next(r.kind === 'discard' ? ai[r.side](r.context) : r.kind === 'play' ? peg[r.side](r.context) : null);
    }
    const cuts = step.value.timeline.flatMap((b) => (b.kind === 'cut' ? [b.starter] : []));
    expect(known.length).toBe(cuts.length);
    expect(known).toEqual(cuts);
    // The AI discards with it: the kept hand is scored exactly.
    const hand = [c(5), c(5, 1), c(10), c(2), c(9), c(13)];
    expect(scoreDiscard(hand, [c(2), c(9)], true, undefined, undefined, c(5, 2))).toBeGreaterThan(scoreDiscard(hand, [c(2), c(9)], true));
  });

  it('a daily effect that acts leaves a daily beat for the screen to flash', () => {
    const ids = (g: CombatOptions['glitches']) => fight(g).timeline.flatMap((b) => (b.kind === 'daily' ? [b.id] : []));
    expect(ids({ countLimit: 21 })).toContain('short-count');
    expect(ids({ luckySevens: 3 })).toContain('lucky-sevens');
    expect(ids({ rule: { fifteenPlus: 1 } })).toContain('fifteen-flood');
    expect(ids({ earlyCut: true }).filter((id) => id === 'early-cut').length).toBe(fight({ earlyCut: true }).hands.length);
    expect(ids(undefined)).toEqual([]);
  });

  it('Lucky Sevens and Suit Surge change a fight; no Glitches changes nothing', () => {
    const plain = fight();
    expect(fight(undefined).log.length).toBe(plain.log.length);
    expect(JSON.stringify(fight({ luckySevens: 3 }).timeline)).not.toBe(JSON.stringify(plain.timeline));
    expect(JSON.stringify(fight({ suitSurge: 'overclock' }).timeline)).not.toBe(JSON.stringify(plain.timeline));
  });
});
