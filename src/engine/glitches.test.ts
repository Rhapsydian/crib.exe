import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from './cards';
import { repriceOccurrence } from './triggers';
import { advancePegging, playPeggingCard, scoreCardPlay, startPegging } from './pegging';
import { playCombat, type CombatOptions } from './combat';
import { CLASS_STARTING_LOADOUTS } from './subroutines';
import { BREACH_THRESHOLD, GAUGE_THRESHOLD } from './encounters';
import { dailyGlitches, type DailyMod } from './daily';
import { discardSkillStrategy, pegSkillStrategy } from './ai';

// Session 72 (docs/daily-runs-design.md DR10): the daily Glitches.
const c = (rank: number, suit = 0): Card => ({ rank: rank as Rank, suit: suit as Suit });
const plan = (...mods: DailyMod[]) => ({ date: 't', seed: 1, classId: 'exploit-overclock' as const, mods });

describe('Glitches', () => {
  it('scoring Glitches reprice for a side, on top of a Fold', () => {
    const rule = dailyGlitches(plan({ id: 'fifteen-flood' }, { id: 'running-wild' }, { id: 'nobs-and-heels' }))!.rule!;
    expect(repriceOccurrence({ category: 'fifteen', player: 0, magnitude: 2 }, rule).points).toBe(4);
    expect(repriceOccurrence({ category: 'fifteen', player: 0, magnitude: 2 }, { fifteen: 3, ...rule }).points).toBe(6);
    expect(repriceOccurrence({ category: 'run', player: 0, magnitude: 3 }, rule).points).toBe(6);
    expect(repriceOccurrence({ category: 'pair', player: 0, magnitude: 6 }, rule).points).toBe(3); // a royal: three pairs at 1
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

  it("a Turncoat Crib fight counts the crib for the non-dealer", () => {
    const r = fight({ turncoatCrib: true });
    const cribShows = r.timeline.filter((b) => b.kind === 'show' && b.owner === 'crib');
    const hands = r.timeline.filter((b) => b.kind === 'hand');
    expect(cribShows.length).toBeGreaterThan(0);
    cribShows.forEach((b, i) => {
      const hand = hands[i];
      if (b.kind === 'show' && hand.kind === 'hand') expect(b.player).toBe(1 - hand.dealer);
    });
  });

  it('Lucky Sevens and Suit Surge change a fight; no Glitches changes nothing', () => {
    const plain = fight();
    expect(fight(undefined).log.length).toBe(plain.log.length);
    expect(JSON.stringify(fight({ luckySevens: 3 }).timeline)).not.toBe(JSON.stringify(plain.timeline));
    expect(JSON.stringify(fight({ suitSurge: 'overclock' }).timeline)).not.toBe(JSON.stringify(plain.timeline));
  });
});
