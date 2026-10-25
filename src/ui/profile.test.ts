import { describe, expect, it } from 'vitest';
import { freshProfile, migrate, profile, PROFILE_VERSION } from './profile.svelte';
import { CLASS_FALLBACK_REP, TUTORIAL_REP, libraryOffers } from '../engine/meta';
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
    expect(profile.data.runsFinished).toBe(4);
  });
});
