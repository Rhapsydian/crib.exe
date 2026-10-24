import { describe, it, expect } from 'vitest';
import type { Alpha, Archetype, Beta, SubroutineDefinition } from './subroutine-types';
import { applyOccurrence, clearHandKnowledge, createCombatState, creditWinGauge, fireTurn, resolveEffect, type CombatState } from './resolve';
import { STATEFUL_INSPECTION_THRESHOLD, STATEFUL_INSPECTION_KEEP, RATE_LIMIT_THRESHOLD, SPOTLIGHT_HEAT, ZERO_SUM_SHARE, ZERO_SUM_THRESHOLD, ADAPTATION_EVERY, ADAPTATION_STEP, ESCALATION_MAX, POWER_SIPHON_GROWTH, ROLLBACK_TO, type GatekeeperModId } from './gatekeeper-mods';

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
  it('Stateful Inspection halves what the player gains past the threshold in one turn (session 68)', () => {
    let s = withMods([credit('a')], [credit('g')], ['stateful-inspection']);
    s = creditWinGauge(s, 0, STATEFUL_INSPECTION_THRESHOLD - 2);
    s = creditWinGauge(s, 0, 4);
    expect(progress(s, 0)).toBe(STATEFUL_INSPECTION_THRESHOLD + 2 * STATEFUL_INSPECTION_KEEP);
  });

  it("Rate Limit (the tutorial's) is Stateful Inspection with a looser threshold", () => {
    let s = withMods([credit('a')], [credit('g')], ['rate-limit']);
    s = creditWinGauge(s, 0, RATE_LIMIT_THRESHOLD + 2);
    expect(progress(s, 0)).toBe(RATE_LIMIT_THRESHOLD + 2 * STATEFUL_INSPECTION_KEEP);
    expect(RATE_LIMIT_THRESHOLD).toBeGreaterThan(STATEFUL_INSPECTION_THRESHOLD);
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

// Session 60, EM1-EM4: the four elite Mods (same shape: side 1 carries it).
describe('elite Mods (session 60)', () => {
  it("Reverse Engineering: the player's fifteens and pairs count toward the owner's Hooks", () => {
    const hooked = piece('h', { verb: 'credit', amount: 1 }, { source: 'cards', category: 'pair', shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 } });
    const s = withMods([credit('a')], [hooked], ['reverse-engineering']);
    const pair = { category: 'pair', player: 0, magnitude: 2 } as const;
    expect(applyOccurrence(s, pair).sides[1].loadout[0].state.charges).toBe(1);
    expect(applyOccurrence(s, { ...pair, category: 'run', magnitude: 3 }).sides[1].loadout[0].state.charges).toBe(0);
    const plain = { ...s, sideMods: [[], []] as [GatekeeperModId[], GatekeeperModId[]] };
    expect(applyOccurrence(plain, pair).sides[1].loadout[0].state.charges).toBe(0);
  });

  it("Rollback: the first time the player's gauge passes the mark it drops back, once a fight", () => {
    let s = withMods([credit('a')], [credit('g')], ['rollback']);
    s = creditWinGauge(s, 0, 80);
    expect(progress(s, 0)).toBe(100 * ROLLBACK_TO);
    s = creditWinGauge(s, 0, 30);
    expect(progress(s, 0)).toBe(80);
    // A gain that goes straight to full still wins.
    expect(progress(creditWinGauge(withMods([credit('a')], [credit('g')], ['rollback']), 0, 100), 0)).toBe(100);
  });

  it("Power Siphon: an absorption grows the owner's growing subroutines", () => {
    const grower = piece('gr', { verb: 'credit', amount: 1, growth: 0.5, growthCap: 2 }, undefined, 'daemon');
    let s = withMods([credit('a')], [grower], ['power-siphon']);
    s = { ...s, sides: [s.sides[0], { ...s.sides[1], wardShield: 5 }] };
    const after = resolveEffect({ verb: 'credit', amount: 3 }, s, 0, 0);
    expect(after.sides[1].loadout[0].state.growthTotal).toBe(0.5 * POWER_SIPHON_GROWTH);
  });

  it("Escalation: each of the owner's turns lowers its initiative threshold, up to the cap", () => {
    let s = withMods([credit('a')], [credit('g')], ['escalation']);
    for (let i = 0; i < 8; i++) s = fireTurn(s, 1, { isDealer: false }).combatState;
    expect(s.sides[1].gauge.threshold).toBeCloseTo(12 * (1 - ESCALATION_MAX));
    expect(s.sides[0].gauge.threshold).toBe(12);
  });

  it('Evidence Chain: Heat the owner gives the player also Credits the owner', () => {
    const s = withMods([credit('a')], [credit('g')], ['evidence-chain']);
    const after = resolveEffect({ verb: 'trace', amount: 2 }, s, 1, 0);
    expect(after.sides[0].heat).toBe(2);
    expect(progress(after, 1)).toBe(2);
    // Alarms count too.
    const alarmed = withMods([credit('a')], [{ ...credit('g'), heatPressure: 1 }], ['evidence-chain']);
    expect(progress(fireTurn(alarmed, 1, { isDealer: false }).combatState, 1)).toBe(1 + 1);
  });

  it("Resource Quota: the player's bottom installed subroutine doesn't fire", () => {
    const s = withMods([credit('top', 1), credit('bottom', 5)], [credit('g')], ['resource-quota']);
    const turn = fireTurn(s, 0, { isDealer: false });
    expect(turn.events.map((e) => e.subroutineId)).toEqual(['top']);
    expect(progress(turn.combatState, 0)).toBe(1);
    // The owner's own loadout is unaffected.
    expect(fireTurn(s, 1, { isDealer: false }).events.map((e) => e.subroutineId)).toEqual(['g']);
  });
});
