import { describe, it, expect } from 'vitest';
import type { Card } from './cards';
import type { Alpha, Beta, SubroutineDefinition } from './subroutine-types';
import { HOOK_ONLY_VERBS } from './subroutine-types';
import { countHandEvents } from './scoring';
import { occurrenceCount, occurrencesFromHandEvents } from './triggers';
import { applyOccurrence, createCombatState, fireTurn, resolveEffect, type CombatState } from './resolve';
import { playCombat, STRAIN_FROM } from './combat';
import { rankThreeBonus, upgradedDefinition } from './merge';
import { ALL_POOL_SUBROUTINES } from './subroutines';
import { ENEMY_SUBROUTINES } from './content/enemy-subroutines';
import { RANK_THREE_PROCESS_SHARE } from './content/rank-three';
import { describeHook } from '../ui/describe';

// Session 66's foundations (docs/subroutines-design.md S4, S5, S8, S12).

const card = (rank: number, suit = 0): Card => ({ rank, suit } as Card);
const piece = (id: string, alpha: Alpha, beta?: Beta): SubroutineDefinition => ({ id, name: id, archetype: 'exploit', alpha, beta });

describe('S8: each run in a run group counts', () => {
  const runs = (hand: number[], starter: number) => {
    const events = countHandEvents(hand.map((r, i) => card(r, i % 4)), card(starter, 3));
    return occurrencesFromHandEvents(events, 0).filter((o) => o.category === 'run');
  };

  it('a double, triple and double-double run count 2, 3 and 4; points unchanged', () => {
    const double = runs([4, 4, 5, 6], 13);
    expect(double.map(occurrenceCount)).toEqual([2]);
    expect(double[0].magnitude).toBe(6);
    expect(runs([4, 4, 4, 5], 6).map(occurrenceCount)).toEqual([3]);
    expect(runs([4, 4, 5, 5], 6).map(occurrenceCount)).toEqual([4]);
    expect(runs([4, 5, 6, 7], 12).map(occurrenceCount)).toEqual([1]);
  });

  it('a pegging run of 6 is one run', () => {
    expect(occurrenceCount({ category: 'run', player: 0, magnitude: 6 })).toBe(1);
  });

  it('Run Splicer: a double run gives four pairs', () => {
    const pairHook: Beta = { source: 'cards', category: 'pair', shape: 'graded', cap: 9, effect: { verb: 'enhance', amount: 1 } };
    const s = createCombatState([piece('a', { verb: 'credit', amount: 1 }, pairHook)], [], [12, 12], undefined, [100, 100], [], ['run-splicer']);
    expect(applyOccurrence(s, { category: 'run', player: 0, magnitude: 6, runs: 2 }).sides[0].loadout[0].state.charges).toBe(4);
  });
});

describe('S5: Suspend', () => {
  it('skips the enemy bottom subroutine for its next turn only', () => {
    const enemy = [piece('top', { verb: 'credit', amount: 1 }), piece('bottom', { verb: 'credit', amount: 5 })];
    let s: CombatState = createCombatState([piece('a', { verb: 'credit', amount: 1 })], enemy, [12, 12], undefined, [100, 100]);
    s = resolveEffect({ verb: 'suspend', amount: 1 }, s, 0);
    s = fireTurn(s, 1, { isDealer: false }).combatState;
    expect(s.sides[1].winGauge.progress).toBe(1);
    s = fireTurn(s, 1, { isDealer: false }).combatState;
    expect(s.sides[1].winGauge.progress).toBe(1 + 6);
  });

  it('is a Hook effect only, never a Process', () => {
    for (const p of [...ALL_POOL_SUBROUTINES, ...ENEMY_SUBROUTINES]) expect(HOOK_ONLY_VERBS, p.id).not.toContain(p.alpha.verb);
  });

  it('reads as what happens to the enemy, and a Merge loosens it instead of adding turns', () => {
    const kill = piece('k', { verb: 'credit', amount: 2 }, { source: 'cards', category: 'fifteen', shape: 'stepped', at: 3, effect: { verb: 'suspend', amount: 1 } });
    expect(describeHook(kill)).toContain('their bottom subroutine skips its next turn');
    const merged = upgradedDefinition(kill);
    expect(merged.beta?.effect).toEqual({ verb: 'suspend', amount: 1 });
    expect(merged.beta?.shape === 'stepped' && merged.beta.at).toBe(2);
  });
});

describe('S4: Merge rank III buffs the Process', () => {
  it('ranks I and II leave the Process; rank III adds its share', () => {
    const p = ALL_POOL_SUBROUTINES.find((q) => q.id === 'buffer-overflow')!;
    const once = upgradedDefinition(p);
    const twice = upgradedDefinition(once);
    const thrice = upgradedDefinition(twice);
    expect(once.alpha).toEqual(p.alpha);
    expect(twice.alpha).toEqual(p.alpha);
    expect(thrice.alpha.verb !== 'disrupt' && thrice.alpha.amount).toBe((p.alpha as { amount: number }).amount + rankThreeBonus(p));
    expect(rankThreeBonus(p)).toBeGreaterThan(0);
  });

  it('every pool subroutine has an authored share within 50-150%', () => {
    for (const p of ALL_POOL_SUBROUTINES) {
      expect(RANK_THREE_PROCESS_SHARE[p.id], p.id).toBeGreaterThanOrEqual(0.5);
      expect(RANK_THREE_PROCESS_SHARE[p.id], p.id).toBeLessThanOrEqual(1.5);
    }
  });
});

describe('S12: system strain', () => {
  it('the player’s third turn in a row and after add rising Heat; none without strainHeat', () => {
    const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = [[piece('a', { verb: 'credit', amount: 0.1 })], [piece('e', { verb: 'credit', amount: 0.1 })]];
    // A tiny player bar: many turns in a row.
    const strained = playCombat(loadouts, { seed: 1, gaugeThreshold: [2, 1000], winThreshold: [1000, 1000], strainHeat: 4 });
    const beats = strained.timeline.flatMap((b) => (b.kind === 'strain' ? [b] : []));
    expect(beats.length).toBeGreaterThan(0);
    expect(beats.every((b) => b.turns >= STRAIN_FROM && b.heat === 4 * 2 ** (b.turns - STRAIN_FROM))).toBe(true);
    expect(strained.heatGenerated).toBeGreaterThan(0);
    const calm = playCombat(loadouts, { seed: 1, gaugeThreshold: [2, 1000], winThreshold: [1000, 1000] });
    expect(calm.timeline.some((b) => b.kind === 'strain')).toBe(false);
  });
});

describe("session 66's sixteen (S1, S6)", () => {
  it('52 pool subroutines, 13 per archetype (5 common, 5 uncommon, 3 rare)', async () => {
    const { ARCHETYPE_POOLS } = await import('./subroutines');
    expect(ALL_POOL_SUBROUTINES).toHaveLength(52);
    for (const pool of Object.values(ARCHETYPE_POOLS)) expect([pool.commons.length, pool.uncommons.length, pool.rares.length]).toEqual([5, 5, 3]);
  });

  it('no subroutine shares a name with another subroutine, a Burner, a Mod or an enemy', async () => {
    const { BURNER_DEFINITIONS } = await import('./burners');
    const { MOD_DEFINITIONS } = await import('./mods');
    const { ENEMY_ROSTER } = await import('./enemies');
    const others = new Set([...ENEMY_SUBROUTINES, ...Object.values(BURNER_DEFINITIONS), ...Object.values(MOD_DEFINITIONS), ...ENEMY_ROSTER].map((x) => x.name));
    const names = ALL_POOL_SUBROUTINES.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(others.has(n), n).toBe(false);
  });
});
