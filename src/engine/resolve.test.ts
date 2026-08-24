import { describe, it, expect } from 'vitest';
import type { PayloadEffect, SubroutineDefinition, TriggerFamily } from './subroutine-types';
import { createCombatState, resolvePayload, fireReadySubroutines } from './resolve';
import { CONTROL_BREACH_CENTER } from './gauges';

function definition(
  id: string,
  trigger: TriggerFamily,
  payload: PayloadEffect,
  overrides: Partial<Pick<SubroutineDefinition, 'archetype' | 'togglable'>> = {},
): SubroutineDefinition {
  return {
    id,
    name: id,
    archetype: overrides.archetype ?? 'exploit',
    trigger,
    payload,
    tags: [],
    togglable: overrides.togglable,
  };
}

const alwaysBurst = (id: string, amount = 5) =>
  definition(id, { kind: 'always' }, { kind: 'instantBurst', amount });

describe('resolvePayload — Control/Breach pushes', () => {
  it('instantBurst pushes toward the caster (side 0 up, side 1 down)', () => {
    const state = createCombatState([], [], 12);
    const forPlayer = resolvePayload({ kind: 'instantBurst', amount: 10 }, 'exploit', state, 0);
    expect(forPlayer.controlBreach).toBe(CONTROL_BREACH_CENTER + 10);

    const forEnemy = resolvePayload({ kind: 'instantBurst', amount: 10 }, 'exploit', state, 1);
    expect(forEnemy.controlBreach).toBe(CONTROL_BREACH_CENTER - 10);
  });

  it('a matching ward blocks and consumes exactly one instantBurst', () => {
    let state = createCombatState([], [], 12);
    state = resolvePayload({ kind: 'ward', blocksArchetype: 'exploit' }, 'encryption', state, 1);
    expect(state.sides[1].wards).toEqual(['exploit']);

    const blocked = resolvePayload({ kind: 'instantBurst', amount: 10 }, 'exploit', state, 0);
    expect(blocked.controlBreach).toBe(CONTROL_BREACH_CENTER); // unaffected
    expect(blocked.sides[1].wards).toEqual([]); // consumed

    const nextHitLands = resolvePayload({ kind: 'instantBurst', amount: 10 }, 'exploit', blocked, 0);
    expect(nextHitLands.controlBreach).toBe(CONTROL_BREACH_CENTER + 10);
  });

  it('piercingBurst ignores an active ward entirely', () => {
    let state = createCombatState([], [], 12);
    state = resolvePayload({ kind: 'ward', blocksArchetype: 'exploit' }, 'encryption', state, 1);
    const result = resolvePayload({ kind: 'piercingBurst', amount: 10 }, 'exploit', state, 0);
    expect(result.controlBreach).toBe(CONTROL_BREACH_CENTER + 10);
    expect(result.sides[1].wards).toEqual(['exploit']); // untouched
  });

  it('chainFinisherScaling scales with how many subroutines already fired this turn', () => {
    const state = createCombatState([], [], 12);
    const payload: PayloadEffect = { kind: 'chainFinisherScaling', baseAmount: 2, perPriorFire: 3 };
    const first = resolvePayload(payload, 'exploit', state, 0, { priorFireCountThisTurn: 0 });
    expect(first.controlBreach).toBe(CONTROL_BREACH_CENTER + 2);
    const third = resolvePayload(payload, 'exploit', state, 0, { priorFireCountThisTurn: 2 });
    expect(third.controlBreach).toBe(CONTROL_BREACH_CENTER + 8);
  });

  it('riskRewardBurst pushes Control/Breach and costs the caster Heat', () => {
    const state = createCombatState([], [], 12);
    const result = resolvePayload({ kind: 'riskRewardBurst', amount: 6, heatCost: 3 }, 'exploit', state, 0);
    expect(result.controlBreach).toBe(CONTROL_BREACH_CENTER + 6);
    expect(result.sides[0].heat).toBe(3);
  });
});

describe('resolvePayload — status effects', () => {
  it('dot applies to the opposing side', () => {
    const state = createCombatState([], [], 12);
    const result = resolvePayload(
      { kind: 'dot', amountPerTick: 2, cadence: 'globalPulse', duration: 3 },
      'malware',
      state,
      0,
    );
    expect(result.sides[1].dots).toEqual([{ amountPerTick: 2, cadence: 'globalPulse', remainingDuration: 3 }]);
    expect(result.sides[0].dots).toEqual([]);
  });

  it('debuff applies to the opposing side', () => {
    const state = createCombatState([], [], 12);
    const result = resolvePayload(
      { kind: 'debuff', debuffId: 'slowed', magnitude: 1, duration: 2 },
      'malware',
      state,
      1,
    );
    expect(result.sides[0].debuffs).toEqual([{ debuffId: 'slowed', magnitude: 1, remainingDuration: 2 }]);
  });

  it('cleanse removes a debuff from the caster\'s own side', () => {
    let state = createCombatState([], [], 12);
    state = resolvePayload({ kind: 'debuff', debuffId: 'slowed', magnitude: 1, duration: 2 }, 'malware', state, 1);
    expect(state.sides[0].debuffs).toHaveLength(1);
    const cleansed = resolvePayload({ kind: 'cleanse', debuffId: 'slowed' }, 'encryption', state, 0);
    expect(cleansed.sides[0].debuffs).toEqual([]);
  });
});

describe('fireReadySubroutines', () => {
  it('fires a single ready subroutine and resets its state afterward', () => {
    const state = createCombatState([alwaysBurst('a', 5)], [], 12);
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events).toHaveLength(1);
    expect(events[0].subroutineId).toBe('a');
    expect(combatState.controlBreach).toBe(CONTROL_BREACH_CENTER + 5);
    expect(combatState.sides[0].loadout[0].state.ready).toBe(false);
  });

  it('does not fire a subroutine whose condition is not met', () => {
    const notReady = definition('a', { kind: 'occurrence', category: 'run', variation: 'instant' }, { kind: 'instantBurst', amount: 5 });
    const state = createCombatState([notReady], [], 12);
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events).toHaveLength(0);
    expect(combatState.controlBreach).toBe(CONTROL_BREACH_CENTER);
  });

  it('skips a ready subroutine that has been toggled off', () => {
    const state = createCombatState([alwaysBurst('a', 5)], [], 12);
    state.sides[0].loadout[0].state = { ...state.sides[0].loadout[0].state, toggledOn: false };
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events).toHaveLength(0);
    expect(combatState.controlBreach).toBe(CONTROL_BREACH_CENTER);
  });

  it('a chained subroutine fed by an earlier fire becomes ready and fires in the same pass', () => {
    const first = alwaysBurst('a', 4);
    const second = definition('b', { kind: 'chained', afterSubroutineId: 'a' }, { kind: 'instantBurst', amount: 7 });
    const state = createCombatState([first, second], [], 12);
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events.map((e) => e.subroutineId)).toEqual(['a', 'b']);
    expect(combatState.controlBreach).toBe(CONTROL_BREACH_CENTER + 4 + 7);
  });

  it('does not fire a chained subroutine that comes before the one it depends on', () => {
    const second = definition('b', { kind: 'chained', afterSubroutineId: 'a' }, { kind: 'instantBurst', amount: 7 });
    const first = alwaysBurst('a', 4);
    // loadout order: b before a -- b's condition (a fired) can't be met
    // within this single top-to-bottom pass since a hasn't fired yet.
    const state = createCombatState([second, first], [], 12);
    const { events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events.map((e) => e.subroutineId)).toEqual(['a']);
  });
});
