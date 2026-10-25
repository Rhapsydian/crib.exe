import { describe, expect, it } from 'vitest';
import { freshProfile, migrate, profile, PROFILE_VERSION } from './profile.svelte';
import { TUTORIAL_REP } from '../engine/meta';

// Session 71 (docs/meta-progression-design.md MP10): the profile.
describe('the profile', () => {
  it('starts with Blackhat and no Rep', () => {
    expect(freshProfile()).toMatchObject({ rep: 0, classes: ['exploit-overclock'], runsFinished: 0 });
  });

  it('brings an older profile forward, keeping what it has', () => {
    const old = { version: 0, rep: 55, classes: ['exploit-overclock', 'exploit-honeypot'] } as never;
    expect(migrate(old)).toMatchObject({ version: PROFILE_VERSION, rep: 55, classes: ['exploit-overclock', 'exploit-honeypot'], upgrades: {} });
  });

  it('awards a run once, and the tutorial grant only the first time', () => {
    const before = profile.data.rep;
    profile.awardRun('run-a', [{ label: 'Layer 1 breached', rep: 10 }]);
    profile.awardRun('run-a', [{ label: 'Layer 1 breached', rep: 10 }]);
    expect(profile.data.rep).toBe(before + 10);
    expect(profile.lastAward?.lines).toHaveLength(1);
    profile.finishTutorial('tut-1');
    profile.finishTutorial('tut-2');
    expect(profile.data.rep).toBe(before + 10 + TUTORIAL_REP);
    expect(profile.data.runsFinished).toBe(3);
  });
});
