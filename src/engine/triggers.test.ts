import { describe, it, expect } from 'vitest';
import type { PegPlayEvent, PegGoEvent, PegGoPointEvent } from './pegging';
import type { HandScoreEvent } from './scoring';
import type { PayloadEffect, SubroutineDefinition, TriggerFamily } from './subroutine-types';
import {
  createInitialState,
  resetAfterFire,
  updateSubroutineState,
  updateSuitTallyState,
  occurrencesFromPeggingEvent,
  occurrencesFromHandEvents,
  occurrenceFromHisHeels,
  suitPlayedFromPeggingEvent,
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

const dummyPayload: PayloadEffect = { kind: 'directBurst', amount: 5 };

function definitionWith(trigger: TriggerFamily): SubroutineDefinition {
  return { id: 'sub-1', name: 'Test Subroutine', archetype: 'exploit', trigger, payload: dummyPayload, tags: [] };
}

const emptyContext: TriggerContext = {
  self: { heat: 0, isDealer: false },
  enemy: { breachContainment: 50, gaugeFillFraction: 0, activeDebuffIds: [] },
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
  it('clears banked/accumulated progress and ready, leaves toggledOn and lastConditionTrue alone, and increments fireCount', () => {
    const fired = { accumulatedProgress: 7, bankedOccurrences: 2, ready: true, toggledOn: false, lastConditionTrue: true, fireCount: 2 };
    expect(resetAfterFire(fired)).toEqual({
      accumulatedProgress: 0,
      bankedOccurrences: 0,
      ready: false,
      toggledOn: false,
      lastConditionTrue: true,
      fireCount: 3,
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

  it('evaluateEnemyState checks Breach/Containment, gauge fill, and debuff presence', () => {
    const ctx: EnemyStateContext = { breachContainment: 30, gaugeFillFraction: 0.8, activeDebuffIds: ['slowed'] };
    expect(evaluateEnemyState({ kind: 'enemyState', condition: 'breachContainmentBelow', value: 50 }, ctx)).toBe(true);
    expect(evaluateEnemyState({ kind: 'enemyState', condition: 'breachContainmentAbove', value: 50 }, ctx)).toBe(false);
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

  it('reads banked state for selfState/enemyState too -- latched via refreshTriggerReadiness (resolve.ts), not live context here', () => {
    const selfDef = definitionWith({ kind: 'selfState', condition: 'isDealer' });
    const notReady = createInitialState();
    const latched = { ...notReady, ready: true };
    // Passing a context where the condition is true no longer matters --
    // isReady only reads the banked flag for this family now.
    expect(isReady(selfDef, notReady, { ...emptyContext, self: { heat: 0, isDealer: true } })).toBe(false);
    expect(isReady(selfDef, latched, emptyContext)).toBe(true);
  });

  it('evaluates always/chained live from context -- no banked state to latch for either', () => {
    const alwaysDef = definitionWith({ kind: 'always' });
    expect(isReady(alwaysDef, createInitialState(), emptyContext)).toBe(true);

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

describe('occurrencesFromHandEvents', () => {
  it('maps each discrete scoring event to its own occurrence, 1:1', () => {
    // Two distinct fifteens must stay 2 separate occurrences, not merge
    // into one lump -- this is the whole point of the events-based
    // adapter over a lumped-breakdown one.
    const events: HandScoreEvent[] = [
      { category: 'fifteen', points: 2 },
      { category: 'fifteen', points: 2 },
      { category: 'pair', points: 2 },
      { category: 'flush', points: 4 },
      { category: 'nobs', points: 1 },
    ];
    expect(occurrencesFromHandEvents(events, 0)).toEqual([
      { category: 'fifteen', player: 0, magnitude: 2 },
      { category: 'fifteen', player: 0, magnitude: 2 },
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

describe('suitPlayedFromPeggingEvent', () => {
  it('extracts suit and player from a play event, regardless of score', () => {
    const scoreless: PegPlayEvent = {
      type: 'play',
      player: 1,
      card: { rank: 9, suit: 2 },
      count: 20,
      score: 0,
      breakdown: { fifteen: 0, pair: 0, run: 0, thirtyOne: 0, total: 0 },
    };
    expect(suitPlayedFromPeggingEvent(scoreless)).toEqual({ suit: 2, player: 1 });
  });

  it('returns null for go and go-point events', () => {
    expect(suitPlayedFromPeggingEvent({ type: 'go', player: 0 })).toBeNull();
    expect(suitPlayedFromPeggingEvent({ type: 'go-point', player: 0 })).toBeNull();
  });
});

describe('updateSuitTallyState', () => {
  const def = definitionWith({ kind: 'accumulator', metric: 'suitTally', suit: 1, threshold: 3 });

  it('accumulates one per matching card played by the owning side', () => {
    let state = createInitialState();
    state = updateSuitTallyState(state, def, { suit: 1, player: 0 }, 0);
    expect(state.accumulatedProgress).toBe(1);
    expect(state.ready).toBe(false);
    state = updateSuitTallyState(state, def, { suit: 1, player: 0 }, 0);
    state = updateSuitTallyState(state, def, { suit: 1, player: 0 }, 0);
    expect(state.accumulatedProgress).toBe(3);
    expect(state.ready).toBe(true);
  });

  it('ignores a card of a different suit', () => {
    let state = createInitialState();
    state = updateSuitTallyState(state, def, { suit: 0, player: 0 }, 0);
    expect(state.accumulatedProgress).toBe(0);
  });

  it('ignores a play belonging to the other side', () => {
    let state = createInitialState();
    state = updateSuitTallyState(state, def, { suit: 1, player: 1 }, 0);
    expect(state.accumulatedProgress).toBe(0);
  });

  it('no-ops for a non-suitTally accumulator or any other trigger family', () => {
    const pointsDef = definitionWith({ kind: 'accumulator', metric: 'points', threshold: 3 });
    const alwaysDef = definitionWith({ kind: 'always' });
    let state = createInitialState();
    state = updateSuitTallyState(state, pointsDef, { suit: 1, player: 0 }, 0);
    state = updateSuitTallyState(state, alwaysDef, { suit: 1, player: 0 }, 0);
    expect(state.accumulatedProgress).toBe(0);
  });
});
