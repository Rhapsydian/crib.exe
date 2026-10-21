import { describe, it, expect } from 'vitest';
import type { Alpha, Beta, SubroutineDefinition } from './subroutine-types';
import { ENEMY_ONLY_VERBS, isValidBeta, scaledDefinition } from './subroutine-types';
import { createCombatState, resolveEffect, type CombatState } from './resolve';
import { ALL_POOL_SUBROUTINES } from './subroutines';
import { ENEMY_SUBROUTINES } from './content/enemy-subroutines';

// Session 60, CP1: the enemy-only effects Trace, Wipe and Strip. Side 1
// casts them on side 0.

const piece = (id: string, alpha: Alpha, beta?: Beta): SubroutineDefinition => ({ id, name: id, archetype: 'exploit', alpha, beta });
const hooked = piece('h', { verb: 'credit', amount: 1 }, { source: 'cards', category: 'pair', shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 } });
const state = (): CombatState => createCombatState([hooked], [piece('e', { verb: 'credit', amount: 1 })], [12, 12], undefined, [100, 100]);

describe('enemy-only effects (CP1)', () => {
  it('Trace adds Heat to the opponent', () => {
    expect(resolveEffect({ verb: 'trace', amount: 2 }, state(), 1, 0).sides[0].heat).toBe(2);
  });

  it("Wipe takes counts from each of the opponent's Hooks, never below 0", () => {
    let s = state();
    s = { ...s, sides: [{ ...s.sides[0], loadout: [{ ...s.sides[0].loadout[0], state: { ...s.sides[0].loadout[0].state, charges: 2 } }] }, s.sides[1]] };
    expect(resolveEffect({ verb: 'wipe', amount: 1 }, s, 1, 0).sides[0].loadout[0].state.charges).toBe(1);
    expect(resolveEffect({ verb: 'wipe', amount: 5 }, s, 1, 0).sides[0].loadout[0].state.charges).toBe(0);
  });

  it("Strip removes the opponent's Ward, never below 0", () => {
    let s = state();
    s = { ...s, sides: [{ ...s.sides[0], wardShield: 3 }, s.sides[1]] };
    expect(resolveEffect({ verb: 'strip', amount: 2 }, s, 1, 0).sides[0].wardShield).toBe(1);
    expect(resolveEffect({ verb: 'strip', amount: 5 }, s, 1, 0).sides[0].wardShield).toBe(0);
  });

  it("an enemy's layer scale grows Strip but never Trace (Heat) or Wipe (whole counts)", () => {
    const strip = scaledDefinition(piece('s', { verb: 'strip', amount: 2 }), 1.5);
    const trace = scaledDefinition(piece('t', { verb: 'trace', amount: 1 }), 1.5);
    const wipe = scaledDefinition(piece('w', { verb: 'credit', amount: 1 }, { source: 'cards', category: 'pair', shape: 'graded', cap: 1, effect: { verb: 'wipe', amount: 1 } }), 1.5);
    expect(strip.alpha).toMatchObject({ amount: 3 });
    expect(trace.alpha).toMatchObject({ amount: 1 });
    expect(wipe.beta?.effect).toMatchObject({ amount: 1 });
  });

  it('an enemy\'s layer scale keeps Charge (Hook counts) whole (session 63: Ping showed 1.68)', () => {
    const charge = (m: number) =>
      scaledDefinition(piece('c', { verb: 'credit', amount: 1 }, { source: 'cards', category: 'fifteen', shape: 'graded', cap: 1, effect: { verb: 'charge', amount: 1, target: 'next' } }), m).beta?.effect;
    expect(charge(1.68)).toMatchObject({ amount: 2 });
    expect(charge(2.17)).toMatchObject({ amount: 2 });
    expect(charge(1.05)).toMatchObject({ amount: 1 });
    expect(charge(0.4)).toMatchObject({ amount: 1 });
  });

  it('the enemy-only effects never appear in the player pool', () => {
    for (const p of ALL_POOL_SUBROUTINES) {
      expect(ENEMY_ONLY_VERBS, p.id).not.toContain(p.alpha.verb);
      if (p.beta) expect(ENEMY_ONLY_VERBS, p.id).not.toContain(p.beta.effect.verb);
    }
  });

  it('the twelve enemy subroutines: three per archetype, each new effect four times, ids unique', () => {
    expect(ENEMY_SUBROUTINES).toHaveLength(12);
    for (const a of ['exploit', 'daemon', 'overclock', 'honeypot']) expect(ENEMY_SUBROUTINES.filter((p) => p.archetype === a), a).toHaveLength(3);
    for (const v of ENEMY_ONLY_VERBS) expect(ENEMY_SUBROUTINES.filter((p) => p.beta?.effect.verb === v), v).toHaveLength(4);
    for (const p of ENEMY_SUBROUTINES) expect(p.beta && isValidBeta(p.beta), p.id).toBe(true);
    const ids = new Set([...ALL_POOL_SUBROUTINES, ...ENEMY_SUBROUTINES].map((p) => p.id));
    expect(ids.size).toBe(ALL_POOL_SUBROUTINES.length + ENEMY_SUBROUTINES.length);
  });
});
