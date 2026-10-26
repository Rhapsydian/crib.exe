import { describe, expect, it } from 'vitest';
import { addCribbage, addRun, dailyRecords, freshStats, runTally } from './records';
import { migrate } from './profile.svelte';
import { playRun } from '../engine/run';

// Go-live step 6: records.
describe('records', () => {
  it('tallies a run: fights won by tier, layers, the outcome', () => {
    const result = playRun({ seed: 4, classId: 'exploit-daemon', playerSkill: 1 });
    const t = runTally(result, 'exploit-daemon', false, []);
    const won = result.log.filter((e) => e.type === 'encounter' && e.outcome.fight && e.outcome.newState === 'inert');
    expect(t.fights).toBe(won.length);
    expect(t.layers).toBe(result.layersCompleted);
    expect(t.won).toBe(result.outcome === 'victory');
    // A full-strength player is Flawless every fight.
    expect(t.flawless).toBeGreaterThanOrEqual(t.fights);
  });

  it('adds runs by class (not a Daily), and the deepest overall', () => {
    const base = { fights: 5, elites: 1, gatekeepers: 1, flawless: 2, lost: 3, hands: 6 };
    let s = addRun(freshStats(), { classId: 'exploit-daemon', daily: false, won: true, layers: 4, ...base });
    s = addRun(s, { classId: 'exploit-daemon', daily: false, won: false, layers: 2, ...base });
    s = addRun(s, { classId: 'daemon-honeypot', daily: true, won: false, layers: 3, ...base });
    expect(s.byClass['exploit-daemon']).toEqual({ runs: 2, wins: 1, deepest: 4 });
    expect(s.byClass['daemon-honeypot']).toBeUndefined();
    expect(s).toMatchObject({ deepest: 4, fights: 15, elites: 3, flawless: 6, skill: { lost: 9, hands: 18 } });
    s = addCribbage(s, 'hard', true, { lost: 1, hands: 9 });
    expect(s.cribbage.hard).toEqual({ played: 1, won: 1 });
    expect(s.skill).toEqual({ lost: 10, hands: 27 });
  });

  it('reads the Daily history: days played, the best streak, the best score', () => {
    const r = dailyRecords({
      '2026-10-20': { scored: 3000 },
      '2026-10-21': { scored: 4100 },
      '2026-10-22': { scored: 2000 },
      '2026-10-24': { scored: 3500 },
      '2026-10-25': { started: true },
    });
    expect(r).toEqual({ played: 4, bestStreak: 3, best: { score: 4100, date: '2026-10-21' } });
  });

  it('gives an older profile empty stats', () => {
    expect(migrate({ rep: 5 } as never).stats).toEqual(freshStats());
  });
});
