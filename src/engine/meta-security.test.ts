import { describe, expect, it } from 'vitest';
import { applySecurity, repForRun, securityRules, SECURITY_MAX } from './meta';
import { createInitialPlayerState, playRun, type RunEvent, type RunResult } from './run';
import { BREACH_THRESHOLD, securityMods, totalHeatSources } from './encounters';
import { ENEMY_ROSTER } from './enemies';

// Session 71 (docs/meta-progression-design.md MP13-MP14): Security Levels.
describe('Security Levels', () => {
  it('level 0 changes nothing; levels stack and clamp to 10', () => {
    const fresh = createInitialPlayerState('exploit-overclock');
    expect(applySecurity(fresh, 0)).toBe(fresh);
    expect(securityRules(99).level).toBe(SECURITY_MAX);
    const r = securityRules(10);
    expect(r).toMatchObject({ rewardChoices: 2, skillOffset: 0.1, shopPrice: 1.3, allowance: 0.9 });
    expect(r.containment).toBeCloseTo(0.85);
    expect(r.breach).toBeCloseTo(1.15);
    expect(securityRules(1)).toMatchObject({ rewardChoices: 3, heatCarry: 0, extraMods: { elite: 1, gatekeeper: 0, regular: 0 } });
  });

  it('offsets the gauges on top of upgrades (levels 2, 5, 8)', () => {
    const s = applySecurity(createInitialPlayerState('exploit-overclock'), 8);
    expect(s.breachThreshold).toBe(Math.round(BREACH_THRESHOLD * 1.15));
    expect(s.containmentThresholdScaler).toBeCloseTo(0.85);
  });

  it('pays +15% Rep a level', () => {
    const result = { outcome: 'quarantined', layersCompleted: 1, finalHeat: 0, log: [{ type: 'layerCleared', layerIndex: 0 } as RunEvent], playerState: {} } as unknown as RunResult;
    expect(repForRun(result, 4).total).toBe(10 + Math.round(10 * 0.6));
    expect(repForRun(result, 4).lines.at(-1)?.label).toBe('Security Level 4 ×1.60');
    expect(repForRun(result, 0).lines).toHaveLength(1);
  });

  it('extra enemy Mods: the same draw every time, none the enemy has, the final gatekeeper three in all', () => {
    const elite = ENEMY_ROSTER.find((e) => e.tier === 'elite' && e.mods?.length)!;
    const a = securityMods(elite, 'elite', 2, securityRules(10));
    expect(a).toEqual(securityMods(elite, 'elite', 2, securityRules(10)));
    expect(a).toHaveLength(2);
    expect(a.some((id) => elite.mods!.includes(id))).toBe(false);
    const final = ENEMY_ROSTER.find((e) => e.tier === 'gatekeeper' && e.minLayer === 4)!;
    expect((final.mods?.length ?? 0) + securityMods(final, 'gatekeeper', 4, securityRules(10)).length).toBe(3);
    expect(securityMods(final, 'gatekeeper', 1, securityRules(7))).toEqual([]);
    expect(securityMods(elite, 'elite', 2, undefined)).toEqual([]);
  });

  it('books its extra Heat, and the sources still add up', () => {
    const r = playRun({ seed: 5, classId: 'exploit-overclock', setup: { securityLevel: 6 } });
    const enc = r.log.filter((e): e is Extract<RunEvent, { type: 'encounter' }> => e.type === 'encounter' && e.outcome.heatDelta !== 0);
    expect(enc.some((e) => e.outcome.heatSources.security > 0)).toBe(true);
    for (const e of enc) expect(totalHeatSources(e.outcome.heatSources)).toBeCloseTo(e.outcome.heatDelta);
  });
});
