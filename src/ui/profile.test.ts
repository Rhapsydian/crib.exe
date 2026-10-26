import { describe, expect, it } from 'vitest';
import { freshProfile, migrate, profile, PROFILE_VERSION } from './profile.svelte';
import { CLASS_FALLBACK_REP, CLASS_ORDER, TUTORIAL_REP, libraryOffers } from '../engine/meta';
import { ARCHETYPE_POOLS } from '../engine/subroutines';

// Session 71 (docs/meta-progression-design.md MP10): the profile.
describe('the profile', () => {
  it('starts with Blackhat and no Rep', () => {
    expect(freshProfile()).toMatchObject({ rep: 0, classes: ['exploit-overclock'], runsFinished: 0 });
  });

  it('brings an older profile forward, keeping what it has', () => {
    const old = { version: 0, rep: 55, classes: ['exploit-overclock', 'exploit-honeypot'] } as never;
    expect(migrate(old)).toMatchObject({ version: PROFILE_VERSION, rep: 55, classes: ['exploit-overclock', 'exploit-honeypot'], upgrades: {} });
  });

  it('unlocks the next class by milestone, and sells only the next locked one (MP2, MP6)', () => {
    profile.awardRun('run-unlock', [], 'exploit-honeypot');
    expect(profile.hasClass('exploit-honeypot')).toBe(true);
    expect(profile.lastAward?.unlocked).toBe('exploit-honeypot');
    expect(profile.nextLocked).toBe('exploit-daemon');
    profile.data = { ...profile.data, rep: CLASS_FALLBACK_REP - 1 };
    expect(profile.buyClass('exploit-daemon')).toBe(false);
    profile.data = { ...profile.data, rep: CLASS_FALLBACK_REP + 5 };
    expect(profile.buyClass('daemon-overclock')).toBe(false);
    expect(profile.buyClass('exploit-daemon')).toBe(true);
    expect(profile.data.rep).toBe(5);
    expect(profile.nextLocked).toBe('daemon-honeypot');
  });

  it('buys upgrades level by level, library offers only, Burners once (MP7-MP9)', () => {
    profile.data = { ...profile.data, rep: 1000 };
    expect(profile.buyUpgrade('subroutineSlot')).toBe(true);
    expect(profile.buyUpgrade('subroutineSlot')).toBe(false); // bought out
    expect(profile.data.upgrades.subroutineSlot).toBe(1);
    const offer = libraryOffers(profile.data.library)[0].piece.id;
    const notOffered = ARCHETYPE_POOLS.exploit.rares[0].id;
    expect(profile.buyLibrary(notOffered)).toBe(false);
    expect(profile.buyLibrary(offer)).toBe(true);
    expect(profile.data.library).toContain(offer);
    expect(profile.buyBurner('flash-drive')).toBe(true);
    expect(profile.buyBurner('flash-drive')).toBe(false);
    expect(profile.buyBurner('kill-switch')).toBe(false); // not a starting Burner
    profile.data = { ...profile.data, rep: 0 };
    expect(profile.buyUpgrade('breach')).toBe(false);
  });

  it('opens Security Levels once every class is unlocked and a run is won, then one by one (MP13, MP15)', () => {
    profile.data = { ...profile.data, classes: ['exploit-overclock'], victories: 0, securityOpen: 0, securityBest: {} };
    profile.awardRun('sec-1', [], null, { classId: 'exploit-overclock', securityLevel: 0, won: true });
    expect(profile.data.securityOpen).toBe(0); // not every class yet
    profile.data = { ...profile.data, classes: [...CLASS_ORDER] };
    profile.awardRun('sec-2', [], null, { classId: 'exploit-overclock', securityLevel: 0, won: false });
    expect(profile.data.securityOpen).toBe(1);
    expect(profile.lastAward?.securityOpened).toBe(1);
    profile.awardRun('sec-3', [], null, { classId: 'exploit-daemon', securityLevel: 1, won: true });
    expect(profile.data.securityOpen).toBe(2);
    expect(profile.data.securityBest['exploit-daemon']).toBe(1);
    profile.awardRun('sec-4', [], null, { classId: 'exploit-daemon', securityLevel: 1, won: true });
    expect(profile.data.securityOpen).toBe(2); // only the highest open level opens the next
  });

  it('dailies: the first attempt counts and pays Rep; later ones are practice with a best; a streak and history (DR1, DR6, DR9)', () => {
    profile.data = { ...profile.data, rep: 0, daily: {} };
    expect(profile.startDaily('2026-10-24')).toBe(false); // the scored attempt
    expect(profile.startDaily('2026-10-24')).toBe(true); // already started: practice
    profile.finishDaily('d-1', '2026-10-24', false, [{ label: 'Layer 1 breached', points: 1000 }], 3, [{ label: 'Layer 1 breached', rep: 10 }]);
    expect(profile.data.daily['2026-10-24'].scored).toBe(1000);
    expect(profile.data.rep).toBe(10);
    profile.finishDaily('d-2', '2026-10-24', true, [{ label: 'Layers', points: 2500 }], 3, [{ label: 'x', rep: 25 }]);
    expect(profile.data.daily['2026-10-24']).toMatchObject({ scored: 1000, best: 2500 });
    expect(profile.data.rep).toBe(10); // practice pays none
    expect(profile.lastDaily).toMatchObject({ practice: true, total: 2500 });
    profile.finishDaily('d-3', '2026-10-23', false, [{ label: 'x', points: 500 }], null, []);
    expect(profile.dailyStreak('2026-10-25')).toBe(2); // today not played yet: counts from yesterday
    expect(profile.dailyStreak('2026-10-24')).toBe(2);
    const history = profile.dailyHistory('2026-10-24', 3);
    expect(history.map((h) => h.date)).toEqual(['2026-10-24', '2026-10-23', '2026-10-22']);
    expect(history[2].record).toBeUndefined();
  });

  it('awards a run once, and the tutorial grant only the first time', () => {
    profile.data = { ...profile.data, rep: 0 };
    const before = profile.data.rep;
    profile.awardRun('run-a', [{ label: 'Layer 1 breached', rep: 10 }]);
    profile.awardRun('run-a', [{ label: 'Layer 1 breached', rep: 10 }]);
    expect(profile.data.rep).toBe(before + 10);
    expect(profile.lastAward?.lines).toHaveLength(1);
    profile.finishTutorial('tut-1');
    profile.finishTutorial('tut-2');
    expect(profile.data.rep).toBe(before + 10 + TUTORIAL_REP);
    expect(profile.data.runsFinished).toBe(11);
  });
});
