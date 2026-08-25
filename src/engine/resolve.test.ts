import { describe, it, expect } from 'vitest';
import type { PayloadEffect, SubroutineDefinition, TriggerFamily } from './subroutine-types';
import {
  createCombatState,
  resolvePayload,
  fireReadySubroutines,
  refreshTriggerReadiness,
  fireNewlyReadyReactiveSubroutines,
  tickCastersTurnPulse,
  tickGlobalPulse,
  resolvePendingSabotage,
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
    expect(result.sides[1].dots).toEqual([
      { amountPerTick: 2, cadence: 'globalPulse', remainingDuration: 3, casterSide: 0, pointsPerTick: undefined, accumulatedPoints: 0 },
    ]);
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

describe('instantCounterPush -- Breach/Containment midpoint cap', () => {
  it('caps a push that would cross center at exactly center', () => {
    const state = createCombatState([], [], 12);
    const result = resolvePayload({ kind: 'instantCounterPush', amount: 999 }, 'encryption', state, 0);
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER);
  });

  it('is a no-op once already at or past center in the caster\'s favor', () => {
    let state = createCombatState([], [], 12);
    state = { ...state, breachContainment: 80 }; // side 0 already well past center
    const result = resolvePayload({ kind: 'instantCounterPush', amount: 10 }, 'encryption', state, 0);
    expect(result.breachContainment).toBe(80);
  });

  it('applies the plain uncapped push when bypassBreachContainmentCap is set', () => {
    const state = createCombatState([], [], 12);
    const result = resolvePayload({ kind: 'instantCounterPush', amount: 20 }, 'encryption', state, 0, {
      priorFireCountThisTurn: 0,
      bypassBreachContainmentCap: true,
    });
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 20);
  });

  it('caps correctly for side 1 too (favor is the low end)', () => {
    const state = createCombatState([], [], 12);
    const result = resolvePayload({ kind: 'instantCounterPush', amount: 999 }, 'encryption', state, 1);
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER);
  });
});

describe('tickCastersTurnPulse', () => {
  it('ticks a DoT (stored on the target) when its caster gets a turn, not the target', () => {
    const state = createCombatState([], [], 12);
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 2 },
      'malware',
      state,
      0, // side 0 casts a DoT onto side 1
    );

    // Side 1 getting a turn should NOT tick side 0's DoT.
    const notCastersTurn = tickCastersTurnPulse(withDot, 1);
    expect(notCastersTurn.breachContainment).toBe(BREACH_CONTAINMENT_CENTER);
    expect(notCastersTurn.sides[1].dots).toHaveLength(1);

    // Side 0 (the caster) getting a turn ticks it.
    const castersTurn = tickCastersTurnPulse(withDot, 0);
    expect(castersTurn.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 5);
    expect(castersTurn.sides[1].dots).toEqual([expect.objectContaining({ remainingDuration: 1 })]);
  });

  it('removes the tick once its duration is exhausted', () => {
    const state = createCombatState([], [], 12);
    let withDot = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 2 }, 'malware', state, 0);
    withDot = tickCastersTurnPulse(withDot, 0);
    withDot = tickCastersTurnPulse(withDot, 0);
    expect(withDot.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 10);
    expect(withDot.sides[1].dots).toEqual([]);
  });

  it('caps a caster\'s-turn-pulse HoT at the midpoint, unlike an uncapped DoT', () => {
    const state = createCombatState([], [], 12);
    const withHot = resolvePayload(
      { kind: 'hot', amountPerTick: 999, cadence: 'castersTurnPulse', duration: 1 },
      'encryption',
      state,
      0,
    );
    const result = tickCastersTurnPulse(withHot, 0);
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER);
  });

  it('does not tick a globalPulse tick', () => {
    const state = createCombatState([], [], 12);
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 2, pointsPerTick: 10 },
      'malware',
      state,
      0,
    );
    const result = tickCastersTurnPulse(withDot, 0);
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER);
    expect(result.sides[1].dots).toHaveLength(1);
  });
});

describe('tickGlobalPulse', () => {
  it('ticks once combined points cross pointsPerTick', () => {
    const state = createCombatState([], [], 12);
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 3, pointsPerTick: 10 },
      'malware',
      state,
      0,
    );
    const under = tickGlobalPulse(withDot, 6);
    expect(under.breachContainment).toBe(BREACH_CONTAINMENT_CENTER); // 6 < 10, no tick yet
    const over = tickGlobalPulse(under, 5); // 6 + 5 = 11, crosses 10
    expect(over.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 5);
    expect(over.sides[1].dots).toEqual([expect.objectContaining({ remainingDuration: 2, accumulatedPoints: 1 })]);
  });

  it('fires multiple times from a single large occurrence, carrying overshoot', () => {
    const state = createCombatState([], [], 12);
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 5, pointsPerTick: 10 },
      'malware',
      state,
      0,
    );
    const result = tickGlobalPulse(withDot, 25); // 2 full crossings, 5 left over
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 10);
    expect(result.sides[1].dots).toEqual([expect.objectContaining({ remainingDuration: 3, accumulatedPoints: 5 })]);
  });

  it('is combined across both sides -- points scored by either side count', () => {
    const state = createCombatState([], [], 12);
    // Side 1 casts the dot (onto side 0), but side 0's own scoring should still feed it.
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 1, pointsPerTick: 10 },
      'malware',
      state,
      1,
    );
    const result = tickGlobalPulse(withDot, 10);
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER - 5); // pushed toward side 1's favor
  });

  it('ignores a castersTurnPulse tick and one with no pointsPerTick', () => {
    const state = createCombatState([], [], 12);
    let withDots = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 1 }, 'malware', state, 0);
    withDots = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 1 }, 'malware', withDots, 0); // no pointsPerTick
    const result = tickGlobalPulse(withDots, 100);
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER);
    expect(result.sides[1].dots).toHaveLength(2);
  });

  it('removes the tick once duration is exhausted mid-batch', () => {
    const state = createCombatState([], [], 12);
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 2, pointsPerTick: 10 },
      'malware',
      state,
      0,
    );
    const result = tickGlobalPulse(withDot, 35); // would cross 3 times, but only 2 duration
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 10);
    expect(result.sides[1].dots).toEqual([]);
  });
});

describe('scheduledSabotage / resolvePendingSabotage', () => {
  it('registers a pending entry instead of resolving immediately', () => {
    const state = createCombatState([], [], 12);
    const result = resolvePayload(
      { kind: 'scheduledSabotage', resolvesAt: 'nextDeal', effect: { kind: 'directBurst', amount: 15 } },
      'root',
      state,
      0,
    );
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER); // not yet applied
    expect(result.pendingSabotage).toEqual([
      { casterSide: 0, archetype: 'root', effect: { kind: 'directBurst', amount: 15 } },
    ]);
  });

  it('resolves and clears a pending effect', () => {
    const state = createCombatState([], [], 12);
    const scheduled = resolvePayload(
      { kind: 'scheduledSabotage', resolvesAt: 'nextDeal', effect: { kind: 'directBurst', amount: 15 } },
      'root',
      state,
      0,
    );
    const result = resolvePendingSabotage(scheduled);
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 15);
    expect(result.pendingSabotage).toEqual([]);
  });

  it('is a no-op on an empty list', () => {
    const state = createCombatState([], [], 12);
    expect(resolvePendingSabotage(state)).toEqual(state);
  });

  it('resolves multiple pending effects from both casters', () => {
    let state = createCombatState([], [], 12);
    state = resolvePayload(
      { kind: 'scheduledSabotage', resolvesAt: 'nextDeal', effect: { kind: 'directBurst', amount: 10 } },
      'root',
      state,
      0,
    );
    state = resolvePayload(
      { kind: 'scheduledSabotage', resolvesAt: 'nextDeal', effect: { kind: 'directBurst', amount: 4 } },
      'root',
      state,
      1,
    );
    const result = resolvePendingSabotage(state);
    expect(result.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 10 - 4);
  });

  it('a wrapped scheduledSabotage re-schedules for a future deal instead of resolving now', () => {
    const state = createCombatState([], [], 12);
    const scheduled = resolvePayload(
      {
        kind: 'scheduledSabotage',
        resolvesAt: 'nextDeal',
        effect: { kind: 'scheduledSabotage', resolvesAt: 'nextDeal', effect: { kind: 'directBurst', amount: 15 } },
      },
      'root',
      state,
      0,
    );
    const afterFirstDeal = resolvePendingSabotage(scheduled);
    expect(afterFirstDeal.breachContainment).toBe(BREACH_CONTAINMENT_CENTER); // still not applied
    expect(afterFirstDeal.pendingSabotage).toHaveLength(1); // rescheduled for the deal after

    const afterSecondDeal = resolvePendingSabotage(afterFirstDeal);
    expect(afterSecondDeal.breachContainment).toBe(BREACH_CONTAINMENT_CENTER + 15);
    expect(afterSecondDeal.pendingSabotage).toEqual([]);
  });
});
