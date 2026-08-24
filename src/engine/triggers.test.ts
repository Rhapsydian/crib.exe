import { describe, it, expect } from 'vitest';
import type { PegPlayEvent, PegGoEvent, PegGoPointEvent } from './pegging';
import type { HandScoreBreakdown } from './scoring';
import type { PayloadEffect, SubroutineDefinition, TriggerFamily } from './subroutine-types';
import {
  createInitialState,
  resetAfterFire,
  updateSubroutineState,
  occurrencesFromPeggingEvent,
  occurrencesFromHandBreakdown,
  occurrenceFromHisHeels,
  evaluateSelfState,
  evaluateEnemyState,
  evaluateChained,
  evaluateAlways,
  isReady,
  type ScoringOccurrence,
  type SelfStateContext,
  type EnemyStateContext,
  type TriggerContext,
} from './triggers';

const dummyPayload: PayloadEffect = { kind: 'instantBurst', amount: 5 };

function definitionWith(trigger: TriggerFamily): SubroutineDefinition {
  return { id: 'sub-1', name: 'Test Subroutine', archetype: 'exploit', trigger, payload: dummyPayload, tags: [] };
}

const emptyContext: TriggerContext = {
  self: { heat: 0, isDealer: false },
  enemy: { controlBreach: 50, gaugeFillFraction: 0, activeDebuffIds: [] },
  firedSubroutineIdsThisTurn: new Set(),
};

describe('updateSubroutineState — accumulator', () => {
  it('becomes ready once accumulated points cross the threshold', () => {
    const def = definitionWith({ kind: 'accumulator', metric: 'points', threshold: 5 });
    let state = createInitialState();
    state = updateSubroutineState(state, def, { category: 'pair', player: 0, magnitude: 2 }, 0);
    expect(state.ready).toBe(false);
    expect(state.accumulatedProgress).toBe(2);
    state = updateSubroutineState(state, def, { category: 'fifteen', player: 0, magnitude: 2 }, 0);
    expect(state.ready).toBe(false);
    state = updateSubroutineState(state, def, { category: 'run', player: 0, magnitude: 3 }, 0);
    expect(state.ready).toBe(true);
    expect(state.accumulatedProgress).toBe(7);
  });

  it('ignores occurrences belonging to the other side', () => {
    const def = definitionWith({ kind: 'accumulator', metric: 'points', threshold: 5 });
    const state = updateSubroutineState(createInitialState(), def, { category: 'pair', player: 1, magnitude: 10 }, 0);
    expect(state).toEqual(createInitialState());
  });
});

describe('updateSubroutineState — occurrence: instant', () => {
  it('fires immediately on the matching category and ignores others', () => {
    const def = definitionWith({ kind: 'occurrence', category: 'run', variation: 'instant' });
    let state = updateSubroutineState(createInitialState(), def, { category: 'pair', player: 0, magnitude: 2 }, 0);
    expect(state.ready).toBe(false);
    state = updateSubroutineState(state, def, { category: 'run', player: 0, magnitude: 3 }, 0);
    expect(state.ready).toBe(true);
  });
});

describe('updateSubroutineState — occurrence: threshold', () => {
  it('banks occurrences silently until bankTarget is reached', () => {
    const def = definitionWith({ kind: 'occurrence', category: 'pair', variation: 'threshold', bankTarget: 3 });
    let state = createInitialState();
    for (let i = 0; i < 2; i++) {
      state = updateSubroutineState(state, def, { category: 'pair', player: 0, magnitude: 2 }, 0);
      expect(state.ready).toBe(false);
    }
    state = updateSubroutineState(state, def, { category: 'pair', player: 0, magnitude: 2 }, 0);
    expect(state.ready).toBe(true);
    expect(state.bankedOccurrences).toBe(3);
  });
});

describe('updateSubroutineState — occurrence: scaling', () => {
  it('banks up to a cap and is ready from the first occurrence onward', () => {
    const def = definitionWith({ kind: 'occurrence', category: 'fifteen', variation: 'scaling', cap: 3 });
    let state = createInitialState();
    state = updateSubroutineState(state, def, { category: 'fifteen', player: 0, magnitude: 2 }, 0);
    expect(state.ready).toBe(true);
    expect(state.bankedOccurrences).toBe(1);
    state = updateSubroutineState(state, def, { category: 'fifteen', player: 0, magnitude: 2 }, 0);
    state = updateSubroutineState(state, def, { category: 'fifteen', player: 0, magnitude: 2 }, 0);
    state = updateSubroutineState(state, def, { category: 'fifteen', player: 0, magnitude: 2 }, 0);
    expect(state.bankedOccurrences).toBe(3); // clamped at cap despite 4 occurrences
  });
});

describe('resetAfterFire', () => {
  it('clears banked/accumulated progress and ready, but leaves toggledOn alone', () => {
    const fired = { accumulatedProgress: 7, bankedOccurrences: 2, ready: true, toggledOn: false };
    expect(resetAfterFire(fired)).toEqual({
      accumulatedProgress: 0,
      bankedOccurrences: 0,
      ready: false,
      toggledOn: false,
    });
  });
});

describe('contextual evaluators', () => {
  it('evaluateSelfState checks heat and dealer conditions', () => {
    const ctx: SelfStateContext = { heat: 10, isDealer: true };
    expect(evaluateSelfState({ kind: 'selfState', condition: 'heatAbove', value: 5 }, ctx)).toBe(true);
    expect(evaluateSelfState({ kind: 'selfState', condition: 'heatBelow', value: 5 }, ctx)).toBe(false);
    expect(evaluateSelfState({ kind: 'selfState', condition: 'isDealer' }, ctx)).toBe(true);
    expect(evaluateSelfState({ kind: 'selfState', condition: 'isNonDealer' }, ctx)).toBe(false);
  });

  it('evaluateEnemyState checks Control/Breach, gauge fill, and debuff presence', () => {
    const ctx: EnemyStateContext = { controlBreach: 30, gaugeFillFraction: 0.8, activeDebuffIds: ['slowed'] };
    expect(evaluateEnemyState({ kind: 'enemyState', condition: 'controlBreachBelow', value: 50 }, ctx)).toBe(true);
    expect(evaluateEnemyState({ kind: 'enemyState', condition: 'controlBreachAbove', value: 50 }, ctx)).toBe(false);
    expect(evaluateEnemyState({ kind: 'enemyState', condition: 'gaugeFillAbove', fraction: 0.5 }, ctx)).toBe(true);
    expect(evaluateEnemyState({ kind: 'enemyState', condition: 'hasDebuff', debuffId: 'slowed' }, ctx)).toBe(true);
    expect(evaluateEnemyState({ kind: 'enemyState', condition: 'hasDebuff', debuffId: 'stunned' }, ctx)).toBe(false);
  });

  it('evaluateChained fires only once the referenced subroutine has fired this turn', () => {
    const trigger = { kind: 'chained' as const, afterSubroutineId: 'sub-a' };
    expect(evaluateChained(trigger, new Set())).toBe(false);
    expect(evaluateChained(trigger, new Set(['sub-a']))).toBe(true);
  });

  it('evaluateAlways is always true', () => {
    expect(evaluateAlways({ kind: 'always' })).toBe(true);
  });
});

describe('isReady dispatcher', () => {
  it('reads banked state for accumulator/occurrence families', () => {
    const def = definitionWith({ kind: 'occurrence', category: 'go', variation: 'instant' });
    const notReady = createInitialState();
    const ready = updateSubroutineState(notReady, def, { category: 'go', player: 0, magnitude: 1 }, 0);
    expect(isReady(def, notReady, emptyContext)).toBe(false);
    expect(isReady(def, ready, emptyContext)).toBe(true);
  });

  it('evaluates always/selfState/enemyState/chained live from context, ignoring stored state', () => {
    const alwaysDef = definitionWith({ kind: 'always' });
    expect(isReady(alwaysDef, createInitialState(), emptyContext)).toBe(true);

    const selfDef = definitionWith({ kind: 'selfState', condition: 'isDealer' });
    expect(isReady(selfDef, createInitialState(), emptyContext)).toBe(false);
    expect(
      isReady(selfDef, createInitialState(), { ...emptyContext, self: { heat: 0, isDealer: true } }),
    ).toBe(true);

    const chainedDef = definitionWith({ kind: 'chained', afterSubroutineId: 'other-sub' });
    expect(isReady(chainedDef, createInitialState(), emptyContext)).toBe(false);
    expect(
      isReady(chainedDef, createInitialState(), {
        ...emptyContext,
        firedSubroutineIdsThisTurn: new Set(['other-sub']),
      }),
    ).toBe(true);
  });
});

describe('occurrencesFromPeggingEvent', () => {
  it('produces one occurrence per non-zero breakdown category from a play event', () => {
    const event: PegPlayEvent = {
      type: 'play',
      player: 0,
      card: { rank: 5, suit: 0 },
      count: 15,
      score: 2,
      breakdown: { fifteen: 2, pair: 0, run: 0, thirtyOne: 0, total: 2 },
    };
    expect(occurrencesFromPeggingEvent(event)).toEqual([{ category: 'fifteen', player: 0, magnitude: 2 }]);
  });

  it('produces a go occurrence from a go-point event', () => {
    const event: PegGoPointEvent = { type: 'go-point', player: 1 };
    expect(occurrencesFromPeggingEvent(event)).toEqual([{ category: 'go', player: 1, magnitude: 1 }]);
  });

  it('produces nothing from a plain go (pass) event', () => {
    const event: PegGoEvent = { type: 'go', player: 0 };
    expect(occurrencesFromPeggingEvent(event)).toEqual([]);
  });
});

describe('occurrencesFromHandBreakdown', () => {
  it('produces one occurrence per non-zero scoring category', () => {
    const breakdown: HandScoreBreakdown = { fifteens: 4, pairs: 2, runs: 0, flush: 4, nobs: 1, total: 11 };
    const occurrences: ScoringOccurrence[] = occurrencesFromHandBreakdown(breakdown, 0);
    expect(occurrences).toEqual([
      { category: 'fifteen', player: 0, magnitude: 4 },
      { category: 'pair', player: 0, magnitude: 2 },
      { category: 'flush', player: 0, magnitude: 4 },
      { category: 'hisNobs', player: 0, magnitude: 1 },
    ]);
  });
});

describe('occurrenceFromHisHeels', () => {
  it('returns null when the starter is not a Jack', () => {
    expect(occurrenceFromHisHeels(0, 1)).toBeNull();
  });

  it('credits the dealer when the starter is a Jack', () => {
    expect(occurrenceFromHisHeels(2, 1)).toEqual({ category: 'hisHeels', player: 1, magnitude: 2 });
  });
});
