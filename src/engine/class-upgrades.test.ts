import { describe, it, expect } from 'vitest';
import type { Archetype, SubroutineDefinition } from './subroutine-types';
import type { ClassId } from './classes';
import {
  applyModOnCombatStartPassives,
  applyOccurrence,
  bridgeUpgradedFor,
  createCombatState,
  resolveEffect,
  BRIDGE_II_BREACHER_SHARE,
  BRIDGE_II_WARDEN_WARD,
  BRIDGE_II_WRAITH_INITIATIVE,
  BRIDGE_EXPLOIT_DAEMON_FIRST,
  BRIDGE_EXPLOIT_DAEMON_SUPPRESS,
  type CombatState,
} from './resolve';
import { classModFor } from '../ui/kit';

// The class Mod upgrades (session 65, docs/mods-design.md M10).

const credit = (id: string, amount: number, archetype: Archetype = 'exploit', extra: Partial<SubroutineDefinition['alpha']> = {}): SubroutineDefinition => ({
  id, name: id, archetype, alpha: { verb: 'credit', amount, ...extra } as SubroutineDefinition['alpha'],
});
function fight(classId: ClassId, upgraded: boolean, loadout: SubroutineDefinition[] = [credit('a', 1)]): CombatState {
  return { ...createCombatState(loadout, [credit('enemy', 1)], [12, 12], classId, [100, 100]), bridgeUpgraded: [upgraded, false] };
}
const withSides = (s: CombatState, patch: (sides: CombatState['sides']) => CombatState['sides']) => ({ ...s, sides: patch(s.sides) });

describe('class Mod upgrades (II)', () => {
  it('Lateral Movement II is the Blackhat class Mod upgraded', () => {
    expect(bridgeUpgradedFor(fight('exploit-overclock', true), 0, 'exploit-overclock')).toBe(true);
    expect(bridgeUpgradedFor(fight('exploit-overclock', false), 0, 'exploit-overclock')).toBe(false);
    expect(bridgeUpgradedFor(fight('exploit-daemon', true), 0, 'exploit-overclock')).toBe(false);
  });

  it('Backdoor Maintenance II: a go point counts as a fifteen', () => {
    const withEnemy = (up: boolean) => withSides(fight('exploit-daemon', up), (sides) => [sides[0], { ...sides[1], winGauge: { ...sides[1].winGauge, progress: 5 } }]);
    const go = { category: 'go', player: 0, magnitude: 1 } as const;
    expect(applyOccurrence(withEnemy(true), go).sides[1].winGauge.progress).toBe(5 - BRIDGE_EXPLOIT_DAEMON_SUPPRESS - BRIDGE_EXPLOIT_DAEMON_FIRST);
    expect(applyOccurrence(withEnemy(false), go).sides[1].winGauge.progress).toBe(5);
  });

  it("Invocation II: the Daemon subroutines start with one fire's growth", () => {
    const daemon = credit('d', 1, 'daemon', { growth: 1, growthCap: 4 });
    expect(applyModOnCombatStartPassives(fight('daemon-overclock', true, [daemon])).sides[0].loadout[0].state.growthTotal).toBe(1);
    expect(applyModOnCombatStartPassives(fight('daemon-overclock', false, [daemon])).sides[0].loadout[0].state.growthTotal).toBe(0);
  });

  it('Foothold II: Ward that blocks a hit Credits a third of it', () => {
    const s = withSides(fight('exploit-honeypot', true), (sides) => [{ ...sides[0], wardShield: 6 }, sides[1]]);
    const hit = resolveEffect({ verb: 'credit', amount: 6 }, s, 1);
    expect(hit.sides[0].winGauge.progress).toBeCloseTo(6 * BRIDGE_II_BREACHER_SHARE);
  });

  it('Hardened Perimeter II: each pair the enemy scores gives Ward (a royal three times)', () => {
    const s = fight('daemon-honeypot', true);
    expect(applyOccurrence(s, { category: 'pair', player: 1, magnitude: 2 }).sides[0].wardShield).toBe(BRIDGE_II_WARDEN_WARD);
    expect(applyOccurrence(s, { category: 'pair', player: 1, magnitude: 6 }).sides[0].wardShield).toBe(3 * BRIDGE_II_WARDEN_WARD);
    expect(applyOccurrence(fight('daemon-honeypot', false), { category: 'pair', player: 1, magnitude: 2 }).sides[0].wardShield).toBe(0);
  });

  it('Phase Shift II: Ward that fully blocks a hit adds initiative; a partial block does not', () => {
    const s = withSides(fight('overclock-honeypot', true), (sides) => [{ ...sides[0], wardShield: 4 }, sides[1]]);
    expect(resolveEffect({ verb: 'credit', amount: 3 }, s, 1).sides[0].gauge.progress).toBeCloseTo(BRIDGE_II_WRAITH_INITIATIVE);
    expect(resolveEffect({ verb: 'credit', amount: 5 }, s, 1).sides[0].gauge.progress).toBe(0);
  });

  it('the II name and text extend the class Mod', () => {
    const base = classModFor('exploit-overclock');
    const upgraded = classModFor('exploit-overclock', true);
    expect(upgraded.name).toBe(`${base.name} II`);
    expect(upgraded.text.startsWith(base.text)).toBe(true);
  });
});
