import { describe, it, expect } from 'vitest';
import type { Alpha, Archetype, Beta, SubroutineDefinition } from './subroutine-types';
import { clearHandKnowledge, createCombatState, creditWinGauge, fireTurn, resolveEffect, type CombatState } from './resolve';
import { NO_WAY_IN_CAP, SPOTLIGHT_HEAT, ZERO_SUM_SHARE, ZERO_SUM_THRESHOLD, ADAPTATION_EVERY, ADAPTATION_STEP, type GatekeeperModId } from './gatekeeper-mods';

// Step 3, E4: the eight gatekeeper Mods. Side 1 carries the Mod (a
// gatekeeper); side 0 is the player it acts on, unless noted.

function piece(id: string, alpha: Alpha, beta?: Beta, archetype: Archetype = 'exploit'): SubroutineDefinition {
  return { id, name: id, archetype, alpha, beta };
}
const credit = (id: string, amount = 1, archetype: Archetype = 'exploit') => piece(id, { verb: 'credit', amount }, undefined, archetype);

function withMods(player: SubroutineDefinition[], gatekeeper: SubroutineDefinition[], mods: GatekeeperModId[]): CombatState {
  return createCombatState(player, gatekeeper, [12, 12], undefined, [100, 100], [], [], [], undefined, [[], mods]);
}
const progress = (s: CombatState, side: 0 | 1) => s.sides[side].winGauge.progress;

describe('gatekeeper Mods (step 3, E4)', () => {
  it('No Way In caps what the player gains in one turn', () => {
    let s = withMods([credit('a')], [credit('g')], ['no-way-in']);
    s = creditWinGauge(s, 0, 4);
    s = creditWinGauge(s, 0, 4);
    expect(progress(s, 0)).toBe(NO_WAY_IN_CAP);
    // A new turn of the player's resets the cap.
    s = fireTurn(s, 0, { isDealer: false }).combatState;
    expect(progress(s, 0)).toBe(NO_WAY_IN_CAP + 1);
  });

  it('Zero-Sum feeds the owner a share of what the player gains past the threshold', () => {
    const s = creditWinGauge(withMods([credit('a')], [credit('g')], ['zero-sum']), 0, ZERO_SUM_THRESHOLD + 2);
    expect(progress(s, 0)).toBe(ZERO_SUM_THRESHOLD + 2);
    expect(progress(s, 1)).toBe(2 * ZERO_SUM_SHARE);
  });

  it('Null Session discards the first Credit the player would gain each turn', () => {
    let s = withMods([credit('a')], [credit('g')], ['null-session']);
    s = creditWinGauge(s, 0, 3);
    expect(progress(s, 0)).toBe(0);
    s = creditWinGauge(s, 0, 3);
    expect(progress(s, 0)).toBe(3);
  });

  it("Containment: the owner's Ward absorbs piercing Credit too", () => {
    let s = withMods([credit('a')], [credit('g')], ['containment']);
    s = { ...s, sides: [s.sides[0], { ...s.sides[1], wardShield: 5 }] };
    const after = resolveEffect({ verb: 'credit', amount: 3, piercing: true }, s, 0, 0);
    expect(progress(after, 0)).toBe(0);
    expect(after.sides[1].wardShield).toBe(2);
    // Without the Mod, piercing goes straight through.
    const plain = { ...s, sideMods: [[], []] as [GatekeeperModId[], GatekeeperModId[]] };
    expect(progress(resolveEffect({ verb: 'credit', amount: 3, piercing: true }, plain, 0, 0), 0)).toBe(3);
  });

  it("Spotlight: every fire of the owner's pieces adds Heat to the player", () => {
    const s = withMods([credit('a')], [credit('g1'), credit('g2')], ['spotlight']);
    expect(fireTurn(s, 1, { isDealer: false }).combatState.sides[0].heat).toBe(2 * SPOTLIGHT_HEAT);
  });

  it("Reception Protocol: the owner's first Exploit beta each hand applies twice", () => {
    const dealer: Beta = { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 2 } };
    const s = withMods([credit('a')], [piece('g', { verb: 'credit', amount: 1 }, dealer)], ['reception-protocol']);
    const first = fireTurn(s, 1, { isDealer: true });
    expect(first.events[0].alpha).toMatchObject({ amount: 1 + 2 * 2 });
    const second = fireTurn(first.combatState, 1, { isDealer: true });
    expect(second.events[0].alpha).toMatchObject({ amount: 1 + 2 });
    // It resets each hand.
    expect(fireTurn(clearHandKnowledge(second.combatState), 1, { isDealer: true }).events[0].alpha).toMatchObject({ amount: 5 });
  });

  it("Root Access: the owner's first turn each hand fires the loadout twice", () => {
    const s = withMods([credit('a')], [credit('g', 2)], ['root-access']);
    const first = fireTurn(s, 1, { isDealer: false });
    expect(first.events).toHaveLength(2);
    expect(fireTurn(first.combatState, 1, { isDealer: false }).events).toHaveLength(1);
    expect(fireTurn(clearHandKnowledge(first.combatState), 1, { isDealer: false }).events).toHaveLength(2);
  });

  it("Adaptation: every few hands, the owner's growth caps rise", () => {
    let s = withMods([credit('a')], [piece('g', { verb: 'credit', amount: 1, growth: 0.5, growthCap: 2 }, undefined, 'daemon')], ['adaptation']);
    for (let i = 0; i < ADAPTATION_EVERY; i++) s = clearHandKnowledge(s);
    expect(s.sides[1].loadout[0].definition.alpha.growthCap).toBe(2 + ADAPTATION_STEP);
  });
});
