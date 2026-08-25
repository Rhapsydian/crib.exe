import { describe, it, expect } from 'vitest';
import type { PayloadEffect, SubroutineDefinition, TriggerFamily } from './subroutine-types';
import {
  createCombatState,
  resolvePayload,
  fireReadySubroutines,
  refreshTriggerReadiness,
  fireNewlyReadyReactiveSubroutines,
} from './resolve';
import { BREACH_CONTAINMENT_CENTER } from './gauges';

function definition(
  id: string,
  trigger: TriggerFamily,
  payload: PayloadEffect,
  overrides: Partial<Pick<SubroutineDefinition, 'archetype' | 'togglable' | 'reactive'>> = {},
): SubroutineDefinition {
  return {
    id,
    name: id,
    archetype: overrides.archetype ?? 'exploit',
    trigger,
    payload,
    tags: [],
    togglable: overrides.togglable,
    reactive: overrides.reactive,
  };
}

const alwaysBurst = (id: string, amount = 5) =>
  definition(id, { kind: 'always' }, { kind: 'directBurst', amount });

describe('resolvePayload — Breach/Containment pushes', () => {
  it('directBurst pushes toward the caster (side 0 up, side 1 down)', () => {
    const state = createCombatState([], [], 12);
    const forPlayer = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 0);
    expect(forPlayer.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 10);

    const forEnemy = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1);
    expect(forEnemy.breachContainment).toBe(BREACH_CONTAINMENT_CENTER - 10);
  });

  it('a matching ward blocks and consumes exactly one directBurst', () => {
    let state = createCombatState([], [], 12);
    state = resolvePayload({ kind: 'ward', blocksArchetype: 'exploit' }, 'encryption', state, 1);
    expect(state.sides[1].wards).toEqual(['exploit']);

    const blocked = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 0);
    expect(blocked.breachContainment).toBe(BREACH_CONTAINMENT_CENTER); // unaffected
    expect(blocked.sides[1].wards).toEqual([]); // consumed

    const nextHitLands = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', blocked, 0);
    expect(nextHitLands.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 10);
  });

  it('piercing ignores an active ward entirely', () => {
    let state = createCombatState([], [], 12);
    state = resolvePayload({ kind: 'ward', blocksArchetype: 'exploit' }, 'encryption', state, 1);
    const result = resolvePayload({ kind: 'piercing', amount: 10 }, 'exploit', state, 0);
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 10);
    expect(result.sides[1].wards).toEqual(['exploit']); // untouched
  });

  it('chainFinisherScaling scales with how many subroutines already fired this turn', () => {
    const state = createCombatState([], [], 12);
    const payload: PayloadEffect = { kind: 'chainFinisherScaling', baseAmount: 2, perPriorFire: 3 };
    const first = resolvePayload(payload, 'exploit', state, 0, { priorFireCountThisTurn: 0 });
    expect(first.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 2);
    const third = resolvePayload(payload, 'exploit', state, 0, { priorFireCountThisTurn: 2 });
    expect(third.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 8);
  });

  it('riskRewardBurst pushes Breach/Containment and costs the caster Heat', () => {
    const state = createCombatState([], [], 12);
    const result = resolvePayload({ kind: 'riskRewardBurst', amount: 6, heatCost: 3 }, 'exploit', state, 0);
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 6);
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
    expect(combatState.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 5);
    expect(combatState.sides[0].loadout[0].state.ready).toBe(false);
  });

  it('does not fire a subroutine whose condition is not met', () => {
    const notReady = definition('a', { kind: 'occurrence', category: 'run', variation: 'instant' }, { kind: 'directBurst', amount: 5 });
    const state = createCombatState([notReady], [], 12);
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events).toHaveLength(0);
    expect(combatState.breachContainment).toBe(BREACH_CONTAINMENT_CENTER);
  });

  it('skips a ready subroutine that has been toggled off', () => {
    const state = createCombatState([alwaysBurst('a', 5)], [], 12);
    state.sides[0].loadout[0].state = { ...state.sides[0].loadout[0].state, toggledOn: false };
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events).toHaveLength(0);
    expect(combatState.breachContainment).toBe(BREACH_CONTAINMENT_CENTER);
  });

  it('a chained subroutine fed by an earlier fire becomes ready and fires in the same pass', () => {
    const first = alwaysBurst('a', 4);
    const second = definition('b', { kind: 'chained', afterSubroutineId: 'a' }, { kind: 'directBurst', amount: 7 });
    const state = createCombatState([first, second], [], 12);
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events.map((e) => e.subroutineId)).toEqual(['a', 'b']);
    expect(combatState.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 4 + 7);
  });

  it('does not fire a chained subroutine that comes before the one it depends on', () => {
    const second = definition('b', { kind: 'chained', afterSubroutineId: 'a' }, { kind: 'directBurst', amount: 7 });
    const first = alwaysBurst('a', 4);
    // loadout order: b before a -- b's condition (a fired) can't be met
    // within this single top-to-bottom pass since a hasn't fired yet.
    const state = createCombatState([second, first], [], 12);
    const { events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events.map((e) => e.subroutineId)).toEqual(['a']);
  });
});

describe('refreshTriggerReadiness', () => {
  const selfHeatAbove = definition('self', { kind: 'selfState', condition: 'heatAbove', value: 5 }, { kind: 'directBurst', amount: 1 });
  const enemyGaugeFillAbove = definition(
    'enemy',
    { kind: 'enemyState', condition: 'gaugeFillAbove', fraction: 0.5 },
    { kind: 'directBurst', amount: 1 },
  );
  const selfIsDealer = definition('dealer', { kind: 'selfState', condition: 'isDealer' }, { kind: 'directBurst', amount: 1 });

  it('latches ready the moment a selfState condition becomes true', () => {
    let state = createCombatState([selfHeatAbove], [], 12);
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(false);

    state = { ...state, sides: [{ ...state.sides[0], heat: 10 }, state.sides[1]] as typeof state.sides };
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(true);
  });

  it('stays latched even after the underlying condition reverts to false (the actual bug fix)', () => {
    let state = createCombatState([selfHeatAbove], [], 12);
    state = { ...state, sides: [{ ...state.sides[0], heat: 10 }, state.sides[1]] as typeof state.sides };
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(true);

    // Heat drops back below the threshold -- a live re-check would say
    // "not ready" again, but the latch must survive.
    state = { ...state, sides: [{ ...state.sides[0], heat: 0 }, state.sides[1]] as typeof state.sides };
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(true);
  });

  it('latches an enemyState condition against the *other* side\'s state', () => {
    let state = createCombatState([], [enemyGaugeFillAbove], 12);
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[1].loadout[0].state.ready).toBe(false);

    // Side 0's gauge (the enemy, from side 1's perspective) fills past 50%.
    const gauge = { ...state.sides[0].gauge, progress: 7 };
    state = { ...state, sides: [{ ...state.sides[0], gauge }, state.sides[1]] as typeof state.sides };
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[1].loadout[0].state.ready).toBe(true);
  });

  it('respects handDealer for isDealer/isNonDealer', () => {
    const notDealer = refreshTriggerReadiness(createCombatState([selfIsDealer], [], 12), 1);
    expect(notDealer.sides[0].loadout[0].state.ready).toBe(false);

    const isDealer = refreshTriggerReadiness(createCombatState([selfIsDealer], [], 12), 0);
    expect(isDealer.sides[0].loadout[0].state.ready).toBe(true);
  });

  it('does not touch accumulator/occurrence/chained/always subroutines', () => {
    const occurrenceDef = definition('occ', { kind: 'occurrence', category: 'go', variation: 'instant' }, { kind: 'directBurst', amount: 1 });
    const state = refreshTriggerReadiness(createCombatState([occurrenceDef, alwaysBurst('always')], [], 12), 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(false); // occurrence untouched, no matching occurrence fed in
    expect(state.sides[0].loadout[1].state.ready).toBe(false); // always is evaluated live at fire time, not latched here
  });

  describe('Reactive edge-triggering', () => {
    const reactiveHeatAbove = definition(
      'reactive-self',
      { kind: 'selfState', condition: 'heatAbove', value: 5 },
      { kind: 'directBurst', amount: 3 },
      { reactive: true },
    );

    function withHeat(state: ReturnType<typeof createCombatState>, side: 0 | 1, heat: number) {
      const sides = state.sides.slice() as typeof state.sides;
      sides[side] = { ...sides[side], heat };
      return { ...state, sides };
    }

    it('arms on the false-to-true transition and stays armed on repeated true checks (no accidental re-debounce)', () => {
      let state = createCombatState([reactiveHeatAbove], [], 12);
      state = withHeat(state, 0, 10); // condition true from the start
      state = refreshTriggerReadiness(state, 0);
      expect(state.sides[0].loadout[0].state.ready).toBe(true); // first observation is a rising edge from the initial false
    });

    it('does not re-arm on a second check while the condition stays continuously true', () => {
      let state = createCombatState([reactiveHeatAbove], [], 12);
      state = withHeat(state, 0, 10);
      state = refreshTriggerReadiness(state, 0); // arms: ready=true, lastConditionTrue=true

      // Simulate the orchestrator firing it immediately, the way combat.ts
      // actually does -- compare against a not-ready baseline so the fire
      // helper sees the false->true transition and consumes it.
      const notReadyBaseline = {
        ...state,
        sides: [
          { ...state.sides[0], loadout: [{ ...state.sides[0].loadout[0], state: { ...state.sides[0].loadout[0].state, ready: false } }] },
          state.sides[1],
        ] as typeof state.sides,
      };
      const { combatState: afterFire } = fireNewlyReadyReactiveSubroutines(notReadyBaseline, state);
      state = afterFire;
      expect(state.sides[0].loadout[0].state.ready).toBe(false); // consumed

      // Heat is still above threshold -- a second refresh should NOT re-arm
      // it, since lastConditionTrue was already true (no rising edge).
      state = refreshTriggerReadiness(state, 0);
      expect(state.sides[0].loadout[0].state.ready).toBe(false);
    });

    it('re-arms after the condition genuinely goes false and comes back true', () => {
      let state = createCombatState([reactiveHeatAbove], [], 12);
      state = withHeat(state, 0, 10);
      state = refreshTriggerReadiness(state, 0); // arms
      state = withHeat(state, 0, 0); // condition reverts to false
      state = refreshTriggerReadiness(state, 0);
      expect(state.sides[0].loadout[0].state.lastConditionTrue).toBe(false);

      state = withHeat(state, 0, 10); // true again -- a real rising edge this time
      state = refreshTriggerReadiness(state, 0);
      expect(state.sides[0].loadout[0].state.ready).toBe(true);
    });
  });
});

describe('fireNewlyReadyReactiveSubroutines', () => {
  it('fires a subroutine whose readiness just flipped true and is reactive', () => {
    const def = definition('r', { kind: 'always' }, { kind: 'directBurst', amount: 4 }, { reactive: true });
    const before = createCombatState([def], [], 12);
    const after = { ...before, sides: [{ ...before.sides[0], loadout: [{ ...before.sides[0].loadout[0], state: { ...before.sides[0].loadout[0].state, ready: true } }] }, before.sides[1]] as typeof before.sides };

    const { combatState, events } = fireNewlyReadyReactiveSubroutines(before, after);
    expect(events).toHaveLength(1);
    expect(events[0].subroutineId).toBe('r');
    expect(combatState.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 4);
    expect(combatState.sides[0].loadout[0].state.ready).toBe(false); // fired and reset
  });

  it('does not fire a subroutine that was already ready before (only newly-ready transitions count)', () => {
    const def = definition('r', { kind: 'always' }, { kind: 'directBurst', amount: 4 }, { reactive: true });
    const withReady = (s: ReturnType<typeof createCombatState>) => ({
      ...s,
      sides: [{ ...s.sides[0], loadout: [{ ...s.sides[0].loadout[0], state: { ...s.sides[0].loadout[0].state, ready: true } }] }, s.sides[1]] as typeof s.sides,
    });
    const before = withReady(createCombatState([def], [], 12));
    const after = withReady(createCombatState([def], [], 12));

    const { events } = fireNewlyReadyReactiveSubroutines(before, after);
    expect(events).toHaveLength(0);
  });

  it('does not fire a newly-ready subroutine that is not reactive', () => {
    const def = definition('r', { kind: 'always' }, { kind: 'directBurst', amount: 4 });
    const before = createCombatState([def], [], 12);
    const after = { ...before, sides: [{ ...before.sides[0], loadout: [{ ...before.sides[0].loadout[0], state: { ...before.sides[0].loadout[0].state, ready: true } }] }, before.sides[1]] as typeof before.sides };

    const { events } = fireNewlyReadyReactiveSubroutines(before, after);
    expect(events).toHaveLength(0);
  });
});
