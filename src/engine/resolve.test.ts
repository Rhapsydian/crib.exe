import { describe, it, expect } from 'vitest';
import type { Alpha, Archetype, Beta, Effect, SubroutineDefinition } from './subroutine-types';
import {
  BRIDGE_DAEMON_HONEYPOT_CAP,
  BRIDGE_DAEMON_OVERCLOCK_STEPS,
  BRIDGE_EXPLOIT_DAEMON_SUPPRESS,
  BRIDGE_EXPLOIT_OVERCLOCK_EMPOWER,
  BRIDGE_OVERCLOCK_HONEYPOT_WARD,
  applyOccurrence,
  createCombatState,
  fireImmediateBetas,
  fireTurn,
  resolveEffect,
  takePendingDisrupt,
  type CombatState,
} from './resolve';

// Session 51: rewritten for the seven verbs and the alpha/beta turn. The
// old 2,000-line payload-kind suite (DoT/HoT ticks, debuffs, sabotage,
// the six old class passives, the 34 enemy passives) retired with those
// mechanics; see docs/design-history.md.

function piece(id: string, alpha: Alpha, beta?: Beta, extra: Partial<SubroutineDefinition> = {}, archetype: Archetype = 'exploit'): SubroutineDefinition {
  return { id, name: id, archetype, alpha, beta, ...extra };
}

/** A fresh combat with the given loadouts, gauge thresholds 12 and win
 * thresholds 100 -- large enough that nothing resolves by accident. */
function fight(player: SubroutineDefinition[] = [], enemy: SubroutineDefinition[] = []): CombatState {
  return createCombatState(player, enemy, [12, 12], undefined, [100, 100]);
}

const progress = (state: CombatState, side: 0 | 1) => state.sides[side].winGauge.progress;
const charges = (state: CombatState, side: 0 | 1, index: number) => state.sides[side].loadout[index].state.charges;

function withWard(state: CombatState, side: 0 | 1, ward: number): CombatState {
  const sides = state.sides.slice() as CombatState['sides'];
  sides[side] = { ...sides[side], wardShield: ward };
  return { ...state, sides };
}

function withProgress(state: CombatState, side: 0 | 1, amount: number): CombatState {
  const sides = state.sides.slice() as CombatState['sides'];
  sides[side] = { ...sides[side], winGauge: { ...sides[side].winGauge, progress: amount } };
  return { ...state, sides };
}

describe('resolveEffect -- Credit', () => {
  it('credits the caster, after the target\'s Ward absorbs what it can', () => {
    const state = resolveEffect({ verb: 'credit', amount: 10 }, withWard(fight(), 1, 4), 0);
    expect(progress(state, 0)).toBe(6);
    expect(state.sides[1].wardShield).toBe(0);
  });

  it('absorbed Ward charges the defender\'s absorbed-progress betas (Honeypot\'s fuel)', () => {
    const honeypot = piece('hp', { verb: 'ward', amount: 1 }, { source: 'progress', metric: 'absorbed', per: 2, shape: 'graded', cap: 9, effect: { verb: 'enhance', amount: 1 } }, {}, 'honeypot');
    const state = resolveEffect({ verb: 'credit', amount: 10 }, withWard(fight([], [honeypot]), 1, 5), 0);
    expect(charges(state, 1, 0)).toBe(2);
  });

  it('piercing ignores Ward entirely', () => {
    const state = resolveEffect({ verb: 'credit', amount: 10, piercing: true }, withWard(fight(), 1, 4), 0);
    expect(progress(state, 0)).toBe(10);
    expect(state.sides[1].wardShield).toBe(4);
  });

  it("from: 'ward' spends the caster's own Ward 1:1, crediting only what was there", () => {
    const state = resolveEffect({ verb: 'credit', amount: 10, from: 'ward' }, withWard(fight(), 0, 6), 0);
    expect(progress(state, 0)).toBe(6);
    expect(state.sides[0].wardShield).toBe(0);
  });

  it("from: 'opponent' takes from the opponent's gauge, capped at what they had", () => {
    const state = resolveEffect({ verb: 'credit', amount: 10, from: 'opponent' }, withProgress(fight(), 1, 4), 0);
    expect(progress(state, 0)).toBe(4);
    expect(progress(state, 1)).toBe(0);
  });
});

describe('resolveEffect -- Suppress, Ward, Trace', () => {
  it("Suppress pushes the opponent's gauge back, floored at 0", () => {
    expect(progress(resolveEffect({ verb: 'suppress', amount: 3 }, withProgress(fight(), 1, 10), 0), 1)).toBe(7);
    expect(progress(resolveEffect({ verb: 'suppress', amount: 30 }, withProgress(fight(), 1, 10), 0), 1)).toBe(0);
  });

  it("Ward adds to the caster's own shield", () => {
    expect(resolveEffect({ verb: 'ward', amount: 5 }, fight(), 0).sides[0].wardShield).toBe(5);
  });

  it("a feed adds straight to the opponent's win gauge, past their Ward", () => {
    const warded = resolveEffect({ verb: 'ward', amount: 5 }, fight(), 1);
    const fed = resolveEffect({ verb: 'ward', amount: 1, feed: 3 }, warded, 0);
    expect(fed.sides[1].winGauge.progress).toBe(3);
    expect(fed.sides[1].wardShield).toBe(5);
    expect(fed.sides[0].winGauge.progress).toBe(0);
  });
});

describe('resolveEffect -- Tempo (session 48 units)', () => {
  it('own gauge mode adds a fraction of a turn against the live threshold', () => {
    expect(resolveEffect({ verb: 'tempo', target: 'own', mode: 'gauge', amount: 0.5 }, fight(), 0).sides[0].gauge.progress).toBe(6);
  });

  it('opponent gauge mode drains a fraction of their turn, floored at 0', () => {
    expect(resolveEffect({ verb: 'tempo', target: 'opponent', mode: 'gauge', amount: 0.5 }, fight(), 0).sides[1].gauge.progress).toBe(0);
  });

  it('threshold mode moves by a fraction of the STARTING threshold, so repeats add rather than compound', () => {
    let state = fight();
    state = resolveEffect({ verb: 'tempo', target: 'opponent', mode: 'threshold', amount: 0.25 }, state, 0);
    state = resolveEffect({ verb: 'tempo', target: 'opponent', mode: 'threshold', amount: 0.25 }, state, 0);
    expect(state.sides[1].gauge.threshold).toBe(18);
  });

  it('lowering your own threshold floors at a third of the starting threshold', () => {
    const state = resolveEffect({ verb: 'tempo', target: 'own', mode: 'threshold', amount: 5 }, fight(), 0);
    expect(state.sides[0].gauge.threshold).toBe(4);
  });

  it('a timed threshold change reverts by exactly what it applied, after that many of the affected side\'s turns', () => {
    // The old `choked`. Side 1's threshold rises for 2 of side 1's turns.
    let state = resolveEffect({ verb: 'tempo', target: 'opponent', mode: 'threshold', amount: 0.5, duration: 2 }, fight(), 0);
    expect(state.sides[1].gauge.threshold).toBe(18);
    state = fireTurn(state, 1, { isDealer: false }).combatState;
    expect(state.sides[1].gauge.threshold).toBe(18);
    state = fireTurn(state, 1, { isDealer: false }).combatState;
    expect(state.sides[1].gauge.threshold).toBe(12);
    expect(state.sides[1].timedTempo).toEqual([]);
  });
});

describe('resolveEffect -- Disrupt and Charge', () => {
  it('Disrupt arms for the next hand; takePendingDisrupt hands it over and clears it', () => {
    const armed = resolveEffect({ verb: 'disrupt', action: 'forceDiscard' }, fight(), 0);
    const taken = takePendingDisrupt(armed);
    expect(taken.pending).toEqual([['forceDiscard'], []]);
    expect(taken.combatState.sides[0].pendingDisrupt).toEqual([]);
  });

  it('Charge feeds self, the next piece (no wrap-around), or every other piece', () => {
    const banking: Beta = { source: 'cards', category: 'go', shape: 'graded', cap: 9, effect: { verb: 'enhance', amount: 1 } };
    const loadout = [0, 1, 2].map((i) => piece(`p${i}`, { verb: 'credit', amount: 1 }, banking));
    const charge = (target: 'self' | 'next' | 'all', index: number) =>
      resolveEffect({ verb: 'charge', amount: 2, target }, fight(loadout), 0, index).sides[0].loadout.map((e) => e.state.charges);
    expect(charge('self', 1)).toEqual([0, 2, 0]);
    expect(charge('next', 1)).toEqual([0, 0, 2]);
    expect(charge('next', 2)).toEqual([0, 0, 0]);
    expect(charge('all', 1)).toEqual([2, 0, 2]);
  });
});

describe('fireTurn -- alphas', () => {
  it('fires every installed piece, top to bottom (D11)', () => {
    const fired = fireTurn(fight([piece('a', { verb: 'credit', amount: 2 }), piece('b', { verb: 'credit', amount: 3 })]), 0, { isDealer: false });
    expect(fired.events.map((e) => e.subroutineId)).toEqual(['a', 'b']);
    expect(progress(fired.combatState, 0)).toBe(5);
  });

  it('skips a piece whose points cooldown is outstanding, and arms the cooldown on fire', () => {
    const cooled = piece('c', { verb: 'credit', amount: 2 }, undefined, { pointsCooldown: 10 });
    const once = fireTurn(fight([cooled]), 0, { isDealer: false });
    expect(once.events).toHaveLength(1);
    expect(fireTurn(once.combatState, 0, { isDealer: false }).events).toHaveLength(0);
  });

  it('alpha growth makes each fire stronger, up to its cap (Ramp)', () => {
    const ramp = piece('r', { verb: 'credit', amount: 1, growth: 1, growthCap: 2 }, undefined, {}, 'daemon');
    let state = fight([ramp]);
    const amounts: number[] = [];
    for (let i = 0; i < 4; i++) {
      const fired = fireTurn(state, 0, { isDealer: false });
      amounts.push((fired.events[0].alpha as Extract<Effect, { verb: 'credit' }>).amount);
      state = fired.combatState;
    }
    expect(amounts).toEqual([1, 2, 3, 3]);
  });
});

describe('fireTurn -- betas', () => {
  it('a graded enhance beta adds per banked charge, up to its cap, then spends them', () => {
    const spike = piece('spike', { verb: 'credit', amount: 2 }, { source: 'cards', category: 'fifteen', shape: 'graded', cap: 2, effect: { verb: 'enhance', amount: 3 } });
    let state = fight([spike]);
    for (let i = 0; i < 3; i++) state = applyOccurrence(state, { category: 'fifteen', player: 0, magnitude: 2 });
    const fired = fireTurn(state, 0, { isDealer: false });
    expect(fired.events[0].elevated).toBe(true);
    expect(progress(fired.combatState, 0)).toBe(2 + 3 * 2);
    expect(charges(fired.combatState, 0, 0)).toBe(0);
  });

  it("records the beta's raw, uncapped charge count on the fire event", () => {
    const capped = piece('cap', { verb: 'credit', amount: 1 }, { source: 'cards', category: 'fifteen', shape: 'graded', cap: 2, effect: { verb: 'enhance', amount: 1 } });
    let state = fight([capped]);
    for (let i = 0; i < 5; i++) state = applyOccurrence(state, { category: 'fifteen', player: 0, magnitude: 2 });
    const fired = fireTurn(state, 0, { isDealer: false });
    expect(fired.events[0].charges).toBe(5);
    expect(progress(fired.combatState, 0)).toBe(1 + 2); // the beta still applied at its cap of 2
  });

  it('a stepped different-effect beta adds its own effect once `at` charges have banked', () => {
    const daemon = piece('d', { verb: 'credit', amount: 1 }, { source: 'progress', metric: 'fires', per: 1, shape: 'stepped', at: 2, effect: { verb: 'suppress', amount: 5 } }, {}, 'daemon');
    let state = withProgress(fight([daemon]), 1, 20);
    const first = fireTurn(state, 0, { isDealer: false });
    expect(first.events[0].elevated).toBe(false);
    state = fireTurn(first.combatState, 0, { isDealer: false }).combatState;
    const third = fireTurn(state, 0, { isDealer: false });
    expect(third.events[0].elevated).toBe(true);
    expect(third.events[0].beta).toEqual({ verb: 'suppress', amount: 5 });
    expect(progress(third.combatState, 1)).toBe(15);
  });

  it('a whileTrue state beta applies only while its condition holds', () => {
    const dealerBonus = piece('db', { verb: 'credit', amount: 1 }, { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 4 } });
    expect(progress(fireTurn(fight([dealerBonus]), 0, { isDealer: true }).combatState, 0)).toBe(5);
    expect(progress(fireTurn(fight([dealerBonus]), 0, { isDealer: false }).combatState, 0)).toBe(1);
  });

  it('Honeypot conversion: a Ward alpha with a wardAbove beta spends its shield as credit', () => {
    const tarpit = piece('t', { verb: 'ward', amount: 3 }, { source: 'state', condition: { kind: 'wardAbove', amount: 5 }, shape: 'whileTrue', effect: { verb: 'credit', amount: 4, from: 'ward' } }, {}, 'honeypot');
    let state = withWard(fight([tarpit]), 0, 6);
    state = fireTurn(state, 0, { isDealer: false }).combatState;
    // Ward 6 -> 9 from the alpha, then the beta spends 4 of it as credit.
    expect(progress(state, 0)).toBe(4);
    expect(state.sides[0].wardShield).toBe(5);
  });

  it('adjacent counts the neighbour BELOW too, even though it has not fired yet (A12)', () => {
    const daemon = piece('d', { verb: 'ward', amount: 1 }, undefined, {}, 'daemon');
    const wantsDaemon = piece('w', { verb: 'credit', amount: 1 }, { source: 'sequence', reach: 'adjacent', match: { archetype: 'daemon' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 5 } });
    expect(progress(fireTurn(fight([wantsDaemon, daemon]), 0, { isDealer: false }).combatState, 0)).toBe(6);
  });

  it('adjacent sequence betas depend on loadout order (D13)', () => {
    const daemon = piece('d', { verb: 'ward', amount: 1 }, undefined, {}, 'daemon');
    const wantsDaemon = piece('w', { verb: 'credit', amount: 1 }, { source: 'sequence', reach: 'adjacent', match: { archetype: 'daemon' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 5 } });
    const filler = piece('f', { verb: 'ward', amount: 1 });
    expect(progress(fireTurn(fight([daemon, wantsDaemon]), 0, { isDealer: false }).combatState, 0)).toBe(6);
    expect(progress(fireTurn(fight([daemon, filler, wantsDaemon]), 0, { isDealer: false }).combatState, 0)).toBe(1);
  });

  it('anyPrior counts only pieces that fired elevated', () => {
    const elevatedPiece = piece('e', { verb: 'ward', amount: 1 }, { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 1 } });
    const finisher = piece('fin', { verb: 'credit', amount: 1 }, { source: 'sequence', reach: 'anyPrior', match: { verb: 'ward' }, shape: 'graded', cap: 5, effect: { verb: 'enhance', amount: 2 } });
    const loadout = [elevatedPiece, elevatedPiece, finisher];
    expect(progress(fireTurn(fight(loadout), 0, { isDealer: true }).combatState, 0)).toBe(1 + 2 * 2);
    expect(progress(fireTurn(fight(loadout), 0, { isDealer: false }).combatState, 0)).toBe(1);
  });
});

describe('fireTurn -- Empower', () => {
  it("'next' boosts only the next piece; 'rest' boosts every later piece this turn", () => {
    const credit = (id: string) => piece(id, { verb: 'credit', amount: 1 });
    const next = fireTurn(fight([piece('n', { verb: 'empower', amount: 2, scope: 'next' }), credit('a'), credit('b')]), 0, { isDealer: false });
    expect(progress(next.combatState, 0)).toBe(3 + 1);
    const rest = fireTurn(fight([piece('r', { verb: 'empower', amount: 2, scope: 'rest' }), credit('a'), credit('b')]), 0, { isDealer: false });
    expect(progress(rest.combatState, 0)).toBe(3 + 3);
  });

  it('never boosts Tempo -- a flat bonus on a fraction would mean whole extra turns (session 48)', () => {
    const fired = fireTurn(fight([piece('n', { verb: 'empower', amount: 5, scope: 'next' }), piece('t', { verb: 'tempo', target: 'own', mode: 'gauge', amount: 0.25 })]), 0, { isDealer: false });
    expect(fired.combatState.sides[0].gauge.progress).toBe(3);
  });

  it('does not carry into the next turn', () => {
    const turn1 = fireTurn(fight([piece('a', { verb: 'credit', amount: 1 }), piece('r', { verb: 'empower', amount: 5, scope: 'rest' })]), 0, { isDealer: false });
    const turn2 = fireTurn(turn1.combatState, 0, { isDealer: false });
    expect(progress(turn2.combatState, 0) - progress(turn1.combatState, 0)).toBe(1);
  });
});

describe('fireImmediateBetas', () => {
  it("an immediate enhance beta is an extra, elevated fire of the alpha (D12's extra fire)", () => {
    const extra = piece('x', { verb: 'credit', amount: 2 }, { source: 'cards', category: 'pair', shape: 'immediate', at: 1, effect: { verb: 'enhance', amount: 3 } });
    const charged = applyOccurrence(fight([extra]), { category: 'pair', player: 0, magnitude: 2 });
    const fired = fireImmediateBetas(charged, 0);
    expect(fired.events).toEqual([expect.objectContaining({ subroutineId: 'x', immediate: true, elevated: true })]);
    expect(progress(fired.combatState, 0)).toBe(5);
    expect(charges(fired.combatState, 0, 0)).toBe(0);
  });

  it('a different-effect immediate beta fires its own effect, not the alpha', () => {
    const counter = piece('c', { verb: 'ward', amount: 9 }, { source: 'cards', category: 'pair', watch: 'opponent', shape: 'immediate', effect: { verb: 'suppress', amount: 4 } });
    const charged = applyOccurrence(withProgress(fight([counter]), 1, 10), { category: 'pair', player: 1, magnitude: 2 });
    const fired = fireImmediateBetas(charged, 0);
    expect(progress(fired.combatState, 1)).toBe(6);
    expect(fired.combatState.sides[0].wardShield).toBe(0);
  });

  it('a state immediate beta fires once per false -> true edge, not continuously', () => {
    const onBehind = piece('b', { verb: 'credit', amount: 1 }, { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'immediate', effect: { verb: 'ward', amount: 5 } });
    let state = withProgress(fight([onBehind]), 1, 60);
    const first = fireImmediateBetas(state, 0);
    expect(first.events).toHaveLength(1);
    state = fireImmediateBetas(first.combatState, 0).combatState;
    expect(state.sides[0].wardShield).toBe(5);
    // Dropping below and crossing again re-arms it.
    state = fireImmediateBetas(withProgress(state, 1, 10), 0).combatState;
    expect(fireImmediateBetas(withProgress(state, 1, 60), 0).events).toHaveLength(1);
  });

  it('respects maxFiresPerCombat', () => {
    const capped = piece('cap', { verb: 'credit', amount: 1 }, { source: 'cards', category: 'pair', shape: 'immediate', effect: { verb: 'enhance', amount: 1 } }, { maxFiresPerCombat: 1 });
    let state = fight([capped]);
    let fires = 0;
    for (let i = 0; i < 3; i++) {
      const fired = fireImmediateBetas(applyOccurrence(state, { category: 'pair', player: 0, magnitude: 2 }), 0);
      fires += fired.events.length;
      state = fired.combatState;
    }
    expect(fires).toBe(1);
  });
});

describe('class bridge passives (step 3, C1)', () => {
  const dealerExploit = piece('ex', { verb: 'credit', amount: 1 }, { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 1 } });
  const credit = (id: string, archetype: Archetype = 'exploit') => piece(id, { verb: 'credit', amount: 1 }, undefined, {}, archetype);
  const state = (loadout: SubroutineDefinition[], classId?: 'exploit-overclock' | 'exploit-daemon' | 'daemon-overclock' | 'exploit-honeypot' | 'daemon-honeypot' | 'overclock-honeypot') =>
    createCombatState(loadout, [credit('enemy')], [12, 12], classId, [100, 100]);

  it('Exploit + Overclock: an Exploit beta that applies Empowers the next piece', () => {
    const fire = (classId?: 'exploit-overclock') => fireTurn(state([dealerExploit, credit('next', 'overclock')], classId), 0, { isDealer: true }).events[1].alpha;
    expect(fire('exploit-overclock')).toMatchObject({ amount: 1 + BRIDGE_EXPLOIT_OVERCLOCK_EMPOWER });
    expect(fire(undefined)).toMatchObject({ amount: 1 });
  });

  it('Exploit + Daemon: a fifteen you score also Suppresses the opponent', () => {
    let s = state([credit('a')], 'exploit-daemon');
    s = { ...s, sides: [s.sides[0], { ...s.sides[1], winGauge: { ...s.sides[1].winGauge, progress: 5 } }] };
    const after = applyOccurrence(s, { category: 'fifteen', player: 0, magnitude: 2 });
    expect(after.sides[1].winGauge.progress).toBe(5 - BRIDGE_EXPLOIT_DAEMON_SUPPRESS);
    expect(applyOccurrence(s, { category: 'pair', player: 0, magnitude: 2 }).sides[1].winGauge.progress).toBe(5);
  });

  it('Daemon + Overclock: an Overclock beta that applies grows each Daemon piece extra steps', () => {
    const daemon = piece('dm', { verb: 'credit', amount: 1, growth: 0.5, growthCap: 4 }, undefined, {}, 'daemon');
    const oc = piece('oc', { verb: 'credit', amount: 1 }, { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 1 } }, {}, 'overclock');
    // The Daemon piece grows once from its own fire, plus the bridge's steps.
    const after = fireTurn(state([oc, daemon], 'daemon-overclock'), 0, { isDealer: true }).combatState;
    expect(after.sides[0].loadout[1].state.growthTotal).toBe(0.5 * (1 + BRIDGE_DAEMON_OVERCLOCK_STEPS));
  });

  it('Exploit + Honeypot: a pair you score banks Ward', () => {
    const after = applyOccurrence(state([credit('a')], 'exploit-honeypot'), { category: 'pair', player: 0, magnitude: 2 });
    expect(after.sides[0].wardShield).toBe(1);
  });

  it('Daemon + Honeypot: Suppress you deal banks that much Ward, capped per turn', () => {
    const suppress = piece('sup', { verb: 'suppress', amount: 3 }, undefined, {}, 'daemon');
    const after = fireTurn(state([suppress], 'daemon-honeypot'), 0, { isDealer: false }).combatState;
    expect(after.sides[0].wardShield).toBe(Math.min(3, BRIDGE_DAEMON_HONEYPOT_CAP));
  });

  it('Overclock + Honeypot: each turn you take banks Ward', () => {
    const after = fireTurn(state([credit('a', 'overclock')], 'overclock-honeypot'), 0, { isDealer: false }).combatState;
    expect(after.sides[0].wardShield).toBe(BRIDGE_OVERCLOCK_HONEYPOT_WARD);
  });

  it('a bridge can sit on side 1 for pricing duels', () => {
    const s = createCombatState([credit('a')], [credit('b')], [12, 12], undefined, [100, 100], [], [], [], 'overclock-honeypot');
    expect(fireTurn(s, 1, { isDealer: false }).combatState.sides[1].wardShield).toBe(BRIDGE_OVERCLOCK_HONEYPOT_WARD);
    expect(fireTurn(s, 0, { isDealer: false }).combatState.sides[0].wardShield).toBe(0);
  });
});
