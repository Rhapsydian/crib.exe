import { describe, it, expect } from 'vitest';
import type { Alpha, Beta, SubroutineDefinition } from './subroutine-types';
import { applyCombatBurner, applyOccurrence, clearHandKnowledge, createCombatState, fireTurn, takeSkippedTurn, tickTempSubroutines, type CombatState } from './resolve';
import { BURNER_DEFINITIONS, generalBurnerPool } from './burners';
import type { BurnerId } from './burner-types';
import type { ScoringOccurrence } from './triggers';

// Session 64 (docs/burners-events-design.md BE1-BE7): the reworked combat
// Burners, on a bare fight. Side 0 is the player.

function piece(id: string, alpha: Alpha, beta?: Beta): SubroutineDefinition {
  return { id, name: id, archetype: 'exploit', alpha, beta };
}
const credit = (id: string, amount = 1) => piece(id, { verb: 'credit', amount });
const fight = (player: SubroutineDefinition[] = [credit('a')], enemy: SubroutineDefinition[] = [credit('e')]): CombatState =>
  createCombatState(player, enemy, [12, 12], undefined, [100, 100], [], [], [], undefined, [[], []]);
const burn = (s: CombatState, id: BurnerId) => applyCombatBurner(s, 0, id, BURNER_DEFINITIONS[id].combat!.effect);
const progress = (s: CombatState, side: 0 | 1) => s.sides[side].winGauge.progress;
const occurrence = (category: 'fifteen' | 'pair', player: 0 | 1 = 0): ScoringOccurrence => ({ category, player, magnitude: 2 }) as ScoringOccurrence;

describe('combat Burners (session 64)', () => {
  it('lumps: Flash Drive Credits 10', () => {
    expect(progress(burn(fight(), 'flash-drive'), 0)).toBe(10);
  });

  it('Packet Storm: each fifteen you score this hand also Credits 2, until the next deal', () => {
    let s = burn(fight(), 'packet-storm');
    s = applyOccurrence(s, occurrence('fifteen'));
    s = applyOccurrence(s, occurrence('fifteen'));
    s = applyOccurrence(s, occurrence('pair'));
    s = applyOccurrence(s, occurrence('fifteen', 1)); // the enemy's: no bonus
    expect(progress(s, 0)).toBe(4);
    s = clearHandKnowledge(s);
    s = applyOccurrence(s, occurrence('fifteen'));
    expect(progress(s, 0)).toBe(4);
  });

  it('Overclock Script: next turn, the loadout fires twice, then the flag is spent', () => {
    let s = burn(fight([credit('a', 3)]), 'overclock-script');
    s = fireTurn(s, 0, { isDealer: false }).combatState;
    expect(progress(s, 0)).toBe(6);
    s = fireTurn(s, 0, { isDealer: false }).combatState;
    expect(progress(s, 0)).toBe(9);
  });

  it("Zero-Day: next turn, each Hook that goes off applies twice", () => {
    // A Hook that always goes off: +2 Credit on every fire (a live state source).
    const hooked = piece('h', { verb: 'credit', amount: 1 }, { source: 'state', condition: { kind: 'nonDealer' }, shape: 'whileTrue', effect: { verb: 'credit', amount: 2 } });
    const plain = fireTurn(fight([hooked]), 0, { isDealer: false }).combatState;
    const doubled = fireTurn(burn(fight([hooked]), 'zero-day'), 0, { isDealer: false }).combatState;
    expect(progress(doubled, 0) - progress(plain, 0)).toBe(progress(plain, 0) - 1);
  });

  it("Denial of Service: the enemy's next turn is skipped, once", () => {
    const s = burn(fight(), 'denial-of-service');
    const first = takeSkippedTurn(s, 1);
    expect(first.skipped).toBe(true);
    expect(takeSkippedTurn(first.combatState, 1).skipped).toBe(false);
    expect(takeSkippedTurn(s, 0).skipped).toBe(false);
  });

  it("Kill Switch: the enemy's Containment drops by half", () => {
    let s = fight();
    s = { ...s, sides: [s.sides[0], { ...s.sides[1], winGauge: { ...s.sides[1].winGauge, progress: 40 } }] };
    expect(progress(burn(s, 'kill-switch'), 1)).toBe(20);
  });

  it('temporary subroutines: an extra slot at the top or bottom, one at a time, gone after its turns', () => {
    let s = fight([credit('a'), credit('b')]);
    s = burn(s, 'bootstrap-loader');
    expect(s.sides[0].loadout.map((e) => e.definition.id)).toEqual(['burner-bootstrap-loader', 'a', 'b']);
    expect(s.sides[0].loadout[0].temp).toEqual({ firesLeft: 3, burnerId: 'bootstrap-loader' });
    // A second replaces the first, at its own position.
    s = burn(s, 'honeynet-shim');
    expect(s.sides[0].loadout.map((e) => e.definition.id)).toEqual(['a', 'b', 'burner-honeynet-shim']);
    for (let turn = 0; turn < 3; turn++) s = tickTempSubroutines(s, 0);
    expect(s.sides[0].loadout.map((e) => e.definition.id)).toEqual(['a', 'b']);
  });

  it("Logic Bomb's Hook Credits 1 per subroutine that fired its Hook earlier that turn", () => {
    const hooked = (id: string) =>
      piece(id, { verb: 'credit', amount: 0 }, { source: 'state', condition: { kind: 'nonDealer' }, shape: 'whileTrue', effect: { verb: 'credit', amount: 0 } });
    let s = burn(fight([hooked('x'), hooked('y'), credit('z', 0)]), 'logic-bomb');
    s = fireTurn(s, 0, { isDealer: false }).combatState;
    // Logic Bomb: Credit 2, plus 1 for each of x and y.
    expect(progress(s, 0)).toBe(4);
  });

  it('the pool: 24 Burners, 4 of them contraband and never offered outside Events', () => {
    expect(Object.keys(BURNER_DEFINITIONS)).toHaveLength(24);
    expect(Object.values(BURNER_DEFINITIONS).filter((b) => b.contraband)).toHaveLength(4);
    expect(generalBurnerPool()).toHaveLength(20);
    for (const b of Object.values(BURNER_DEFINITIONS)) expect(b.text.length).toBeGreaterThan(10);
  });
});

describe('when combat Burners are offered (session 64, BE2)', () => {
  it('"Now" Burners right after your discard or card; "Next turn" ones at the start of your turns', async () => {
    const { combatGenerator } = await import('./combat');
    const { discardLowestTwo } = await import('./deal');
    const { playLowestLegal } = await import('./pegging');
    const game = combatGenerator([[credit('a', 2)], [credit('e', 2)]], { seed: 3, gaugeThreshold: [8, 8], carriedBurnerIds: ['packet-storm', 'flash-drive'] });
    let step = game.next();
    let last: string | null = null;
    const offers: { timing: string; after: string | null }[] = [];
    while (!step.done) {
      const r = step.value;
      if (r.kind === 'burner') {
        offers.push({ timing: r.context.timing, after: last });
        expect(r.side).toBe(0);
        for (const id of r.context.availableBurnerIds) expect(BURNER_DEFINITIONS[id].combat!.timing).toBe(r.context.timing);
        step = game.next(null);
        continue;
      }
      if (r.side === 0) last = r.kind;
      step = game.next(r.kind === 'discard' ? discardLowestTwo(r.context) : playLowestLegal(r.context));
    }
    const now = offers.filter((o) => o.timing === 'now');
    expect(now.length).toBeGreaterThan(0);
    // Each "Now" offer follows one of your decisions.
    for (const o of now) expect(['discard', 'play']).toContain(o.after);
    expect(offers.some((o) => o.timing === 'nextTurn')).toBe(true);
  });
});
