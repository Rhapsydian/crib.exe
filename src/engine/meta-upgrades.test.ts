import { describe, expect, it } from 'vitest';
import { applyUpgrades, UPGRADE_TRACKS, upgradeLevel, libraryOffers, LIBRARY_PRICE, STARTING_BURNERS } from './meta';
import { createInitialPlayerState, playRun, runRequests, type RunEvent, type RunPlayerState } from './run';
import { BREACH_THRESHOLD, combatThresholdsFor, restHeatFor, REST_HEAT_REDUCTION, totalHeatSources } from './encounters';
import { burnerCapOf, BURNER_CAP } from './burners';
import { slotCapOf, INSTALLED_SLOT_CAP } from './loadout';
import { scaledProcess } from './subroutine-types';
import { ENEMY_ROSTER } from './enemies';
import { ALL_SUBROUTINES, ARCHETYPE_POOLS } from './subroutines';

// Session 71 (docs/meta-progression-design.md MP7-MP9): the upgrades
// inside a run.
const MAXED = Object.fromEntries(Object.entries(UPGRADE_TRACKS).map(([id, t]) => [id, t.levels]));

describe('upgrades in a run', () => {
  it('leaves a fresh player untouched', () => {
    const fresh = createInitialPlayerState('exploit-overclock');
    expect(applyUpgrades(fresh, {})).toBe(fresh);
    expect(applyUpgrades(fresh, undefined)).toBe(fresh);
  });

  it('clamps levels to each track', () => {
    expect(upgradeLevel({ breach: 99 }, 'breach')).toBe(5);
    expect(upgradeLevel({ breach: -2 }, 'breach')).toBe(0);
  });

  it('shrinks your Breach and grows enemy Containment', () => {
    const s = applyUpgrades(createInitialPlayerState('exploit-overclock'), MAXED);
    expect(s.breachThreshold).toBe(Math.round(BREACH_THRESHOLD * 0.85));
    expect(s.containmentThresholdScaler).toBeCloseTo(1.15);
    const enemy = ENEMY_ROSTER.find((e) => e.tier === 'regular')!;
    const plain = combatThresholdsFor(createInitialPlayerState('exploit-overclock'), enemy, 1, 5);
    const up = combatThresholdsFor(s, enemy, 1, 5);
    expect(up.winThreshold[0]).toBeLessThan(plain.winThreshold[0]);
    expect(up.winThreshold[1]).toBeGreaterThan(plain.winThreshold[1]);
  });

  it('raises the caps, the rest, and cuts fight Heat and Shop prices', () => {
    const s = applyUpgrades(createInitialPlayerState('exploit-overclock'), MAXED);
    expect(burnerCapOf(s)).toBe(BURNER_CAP + 2);
    expect(slotCapOf(s)).toBe(INSTALLED_SLOT_CAP + 1);
    expect(restHeatFor(s)).toBe(REST_HEAT_REDUCTION + 12);
    expect(s.meta?.fightHeat).toBeCloseTo(0.8);
    expect(s.meta?.shopPrice).toBeCloseTo(0.8);
    expect(s.meta?.process.honeypot).toBeCloseTo(1.2);
  });

  it("strengthens a subroutine's Process, never its Hook", () => {
    const piece = ALL_SUBROUTINES.find((p) => p.beta && p.alpha.verb === 'credit')!;
    const up = scaledProcess(piece, 1.2);
    expect((up.alpha as { amount: number }).amount).toBeCloseTo((piece.alpha as { amount: number }).amount * 1.2);
    expect(up.beta).toBe(piece.beta);
  });

  it('starts a run with the 4th starter and the starting Burner', () => {
    const starter = ALL_SUBROUTINES.find((p) => p.archetype === 'honeypot')!;
    const r = playRun({ seed: 3, classId: 'exploit-overclock', setup: { starter: starter.id, burner: 'flash-drive' }, layerNodeCounts: [3] });
    // The run's first fight saw four installed; the Burner was carried
    // until used or kept.
    const fresh = playRun({ seed: 3, classId: 'exploit-overclock', layerNodeCounts: [3] });
    expect(r.playerState.installedLoadout.concat(r.playerState.bench).some((p) => p.id === starter.id)).toBe(true);
    expect(fresh.log).not.toEqual(r.log);
  });

  it('books the fight Heat cut as upgrade Heat, and the sources still add up', () => {
    const r = playRun({ seed: 11, classId: 'exploit-overclock', setup: { upgrades: { fightHeat: 5 } } });
    const fights = r.log.filter((e): e is Extract<RunEvent, { type: 'encounter' }> => e.type === 'encounter' && e.outcome.heatDelta !== 0);
    expect(fights.some((e) => e.outcome.heatSources.upgrade < 0)).toBe(true);
    for (const e of fights) expect(totalHeatSources(e.outcome.heatSources)).toBeCloseTo(e.outcome.heatDelta);
  });
});

describe('the library and starting Burners (MP8-MP9)', () => {
  it('offers one per archetype, every common before any uncommon, every uncommon before the rares', () => {
    const first = libraryOffers([]);
    expect(first).toHaveLength(4);
    expect(first.every((o) => o.rarity === 'common')).toBe(true);
    expect(new Set(first.map((o) => o.piece.archetype)).size).toBe(4);
    // Every Exploit common unlocked: three archetypes still offer commons.
    const exploitCommons = ARCHETYPE_POOLS.exploit.commons.map((p) => p.id);
    expect(libraryOffers(exploitCommons).map((o) => o.piece.archetype).sort()).toEqual(['daemon', 'honeypot', 'overclock']);
    const allCommons = Object.values(ARCHETYPE_POOLS).flatMap((p) => p.commons.map((c) => c.id));
    expect(libraryOffers(allCommons).every((o) => o.rarity === 'uncommon')).toBe(true);
    const allButRares = Object.values(ARCHETYPE_POOLS).flatMap((p) => [...p.commons, ...p.uncommons].map((c) => c.id));
    expect(libraryOffers(allButRares).every((o) => o.rarity === 'rare' && o.price === LIBRARY_PRICE.rare)).toBe(true);
    expect(libraryOffers(ALL_SUBROUTINES.map((p) => p.id))).toEqual([]);
  });

  it('starting Burners are the general commons', () => {
    expect(STARTING_BURNERS.length).toBe(6);
    expect(STARTING_BURNERS).toContain('flash-drive');
  });

  it("a starter the class already has arrives as a Merge copy", () => {
    const own = createInitialPlayerState('exploit-overclock').installedLoadout[0];
    const first = runRequests({ seed: 3, classId: 'exploit-overclock', setup: { starter: own.id } }).next().value as { playerState: RunPlayerState };
    expect(first.playerState.installedLoadout.filter((p) => p.id === own.id)).toHaveLength(1);
    expect(first.playerState.material[own.id]).toBe(1);
  });
});
