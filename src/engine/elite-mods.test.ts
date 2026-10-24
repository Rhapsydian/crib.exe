import { describe, it, expect } from 'vitest';
import type { Alpha, Beta, SubroutineDefinition } from './subroutine-types';
import type { GatekeeperModId } from './gatekeeper-mods';
import { COLLECTION_KEEP, HARD_LIMIT_WARD, INTERFERENCE_LOSS, PURGE_COUNTS } from './gatekeeper-mods';
import { applyHandEndMods, applyOccurrence, clearHandKnowledge, createCombatState, fireImmediateBetas, fireTurn, resolveEffect, type CombatState } from './resolve';

// Session 67's elite Mods (docs/enemies-design.md E4): side 1 carries the
// Mod, side 0 (the player) feels it.

const piece = (id: string, alpha: Alpha, beta?: Beta): SubroutineDefinition => ({ id, name: id, archetype: 'exploit', alpha, beta });
const credit = (id: string, amount: number, beta?: Beta) => piece(id, { verb: 'credit', amount }, beta);
function fight(mod: GatekeeperModId, player: SubroutineDefinition[] = [credit('a', 1)], enemy: SubroutineDefinition[] = [credit('e', 1)]): CombatState {
  return createCombatState(player, enemy, [12, 12], undefined, [100, 100], [], [], [], undefined, [[], [mod]]);
}
const breach = (s: CombatState) => s.sides[0].winGauge.progress;

describe('session 67 elite Mods', () => {
  it('Interference: an Instant Hook going off costs the player Breach', () => {
    const instant = credit('i', 1, { source: 'cards', category: 'pair', shape: 'immediate', at: 1, effect: { verb: 'enhance', amount: 0 } });
    let s = fight('interference', [instant]);
    s = { ...s, sides: [{ ...s.sides[0], winGauge: { ...s.sides[0].winGauge, progress: 10 } }, s.sides[1]] };
    s = fireImmediateBetas(applyOccurrence(s, { category: 'pair', player: 0, magnitude: 2 }), 0).combatState;
    expect(breach(s)).toBe(10 + 1 - INTERFERENCE_LOSS);
  });

  it('Hard Limit: the player Ward stops at its cap', () => {
    let s = fight('hard-limit');
    for (let i = 0; i < 5; i++) s = resolveEffect({ verb: 'ward', amount: 2 }, s, 0);
    expect(s.sides[0].wardShield).toBe(HARD_LIMIT_WARD);
  });

  it('Lockout: every second enemy turn, the player top subroutine skips their next turn', () => {
    let s = fight('lockout', [credit('top', 5), credit('below', 1)]);
    s = fireTurn(s, 1, { isDealer: false }).combatState;
    s = fireTurn(s, 0, { isDealer: false }).combatState;
    expect(breach(s)).toBe(6);
    s = fireTurn(s, 1, { isDealer: false }).combatState;
    s = fireTurn(s, 0, { isDealer: false }).combatState;
    expect(breach(s)).toBe(6 + 1);
    s = fireTurn(s, 0, { isDealer: false }).combatState;
    expect(breach(s)).toBe(6 + 1 + 6);
  });

  it('Purge: each player Hook loses counts at the start of a hand', () => {
    const banking = credit('b', 1, { source: 'cards', category: 'pair', shape: 'graded', cap: 9, effect: { verb: 'enhance', amount: 1 } });
    let s = fight('purge', [banking]);
    s = applyOccurrence(applyOccurrence(s, { category: 'pair', player: 0, magnitude: 2 }), { category: 'pair', player: 0, magnitude: 2 });
    expect(clearHandKnowledge(s).sides[0].loadout[0].state.charges).toBe(2 - PURGE_COUNTS);
  });

  it('Collection: the player growing subroutines lose half their growth at the end of a hand', () => {
    let s = fight('collection', [piece('g', { verb: 'credit', amount: 1, growth: 1, growthCap: 9 })]);
    s = fireTurn(fireTurn(s, 0, { isDealer: false }).combatState, 0, { isDealer: false }).combatState;
    const grown = s.sides[0].loadout[0].state.growthTotal;
    expect(applyHandEndMods(s).sides[0].loadout[0].state.growthTotal).toBe(grown * COLLECTION_KEEP);
  });
});

describe('Fast Path (session 67)', () => {
  it('its pegging points fill its initiative faster, and it says so', async () => {
    const { playCombat } = await import('./combat');
    const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = [[credit('a', 0.1)], [credit('e', 0.1)]];
    const turns = (mods: GatekeeperModId[]) => {
      let n = 0, noted = 0;
      for (let seed = 0; seed < 20; seed++) {
        const r = playCombat(loadouts, { seed, gaugeThreshold: [12, 12], winThreshold: [1000, 1000], gatekeeperMods: [[], mods] });
        n += r.timeline.filter((b) => b.kind === 'turn' && b.side === 1).length;
        noted += r.timeline.filter((b) => b.kind === 'mod' && b.side === 1).length;
      }
      return { n, noted };
    };
    const fast = turns(['fast-path']);
    expect(fast.n).toBeGreaterThan(turns([]).n);
    expect(fast.noted).toBeGreaterThan(0);
  });
});
