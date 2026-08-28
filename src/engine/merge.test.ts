import { describe, it, expect } from 'vitest';
import type { RunPlayerState } from './run';
import type { SubroutineDefinition } from './subroutine-types';
import {
  easeTriggerCondition,
  mergeSubroutine,
  preferMergeWhenAvailable,
  opportunisticSafehouseStrategy,
  pickMergeTarget,
  scaledPayloadMagnitude,
  MERGE_RANK_CAP,
} from './merge';
import { HEAT_HIGH_FRACTION, HEAT_MAX } from './heat';

function playerState(overrides: Partial<RunPlayerState> = {}): RunPlayerState {
  return {
    classId: 'breacher',
    installedLoadout: [],
    bench: [],
    data: 0,
    material: {},
    rank: {},
    ownedModIds: [],
    grantedByMod: {},
    maxHeatBonus: 0,
    modRunState: {},
    carriedBurnerIds: [],
    ...overrides,
  };
}

describe('easeTriggerCondition', () => {
  it('reduces Accumulator threshold, floored at 1', () => {
    expect(easeTriggerCondition({ kind: 'accumulator', metric: 'points', threshold: 3 }, 5)).toEqual({
      kind: 'accumulator',
      metric: 'points',
      threshold: 1,
    });
  });

  it('reduces Occurrence: threshold bankTarget', () => {
    expect(easeTriggerCondition({ kind: 'occurrence', category: 'pair', variation: 'threshold', bankTarget: 5 }, 2)).toEqual({
      kind: 'occurrence',
      category: 'pair',
      variation: 'threshold',
      bankTarget: 3,
    });
  });

  it('leaves Occurrence: scaling untouched -- no firing-ease knob (already unconditional)', () => {
    const trigger = { kind: 'occurrence' as const, category: 'flush' as const, variation: 'scaling' as const, cap: 4 };
    expect(easeTriggerCondition(trigger, 2)).toBe(trigger); // same reference -- true no-op
  });

  it('lowers a Self-state heatAbove value, floored at 0', () => {
    expect(easeTriggerCondition({ kind: 'selfState', condition: 'heatAbove', value: 1 }, 5)).toEqual({
      kind: 'selfState',
      condition: 'heatAbove',
      value: 0,
    });
  });

  it('raises a Self-state heatBelow value', () => {
    expect(easeTriggerCondition({ kind: 'selfState', condition: 'heatBelow', value: 10 }, 2)).toEqual({
      kind: 'selfState',
      condition: 'heatBelow',
      value: 12,
    });
  });

  it('leaves Always/Chained/isDealer untouched', () => {
    expect(easeTriggerCondition({ kind: 'always' }, 2)).toEqual({ kind: 'always' });
    expect(easeTriggerCondition({ kind: 'chained', afterSubroutineId: 'x' }, 2)).toEqual({ kind: 'chained', afterSubroutineId: 'x' });
    expect(easeTriggerCondition({ kind: 'selfState', condition: 'isDealer' }, 2)).toEqual({ kind: 'selfState', condition: 'isDealer' });
  });
});

function piece(id: string, overrides: Partial<SubroutineDefinition> = {}): SubroutineDefinition {
  return {
    id,
    name: id,
    archetype: 'exploit',
    trigger: { kind: 'always' },
    payload: { kind: 'directBurst', amount: 5 },
    tags: [],
    ...overrides,
  };
}

describe('scaledPayloadMagnitude (session 39, enemies.ts\'s per-layer difficulty scaler)', () => {
  it('scales a magnitude-bearing payload proportionally, not by a flat amount', () => {
    expect(scaledPayloadMagnitude({ kind: 'directBurst', amount: 10 }, 1.5)).toEqual({ kind: 'directBurst', amount: 15 });
  });

  it('returns null for a magnitude-less payload -- same "null means no knob" contract as improvedPayloadMagnitude', () => {
    expect(scaledPayloadMagnitude({ kind: 'cleanse' }, 1.5)).toBeNull();
  });

  it('scales every magnitude field shape (baseAmount, amountPerTick, magnitude), not just amount', () => {
    expect(scaledPayloadMagnitude({ kind: 'chainFinisherScaling', baseAmount: 4, perPriorFire: 1 }, 2)).toEqual({
      kind: 'chainFinisherScaling',
      baseAmount: 8,
      perPriorFire: 1,
    });
    expect(scaledPayloadMagnitude({ kind: 'dot', amountPerTick: 2, cadence: 'globalPulse', duration: 3 }, 2)).toEqual({
      kind: 'dot',
      amountPerTick: 4,
      cadence: 'globalPulse',
      duration: 3,
    });
    expect(scaledPayloadMagnitude({ kind: 'debuff', debuffId: 'throttled', magnitude: 3, duration: 2 }, 2)).toEqual({
      kind: 'debuff',
      debuffId: 'throttled',
      magnitude: 6,
      duration: 2,
    });
  });
});

describe('mergeSubroutine', () => {
  it('improves a magnitude-bearing payload in place on the bench', () => {
    const state = playerState({ bench: [piece('a')], material: { a: 1 } });
    const result = mergeSubroutine(state, 'a');
    expect(result.bench[0].payload).toEqual({ kind: 'directBurst', amount: 8 }); // +3 (MERGE_MAGNITUDE_BONUS)
    expect(result.material.a).toBe(0);
    expect(result.rank.a).toBe(1);
  });

  it('improves a magnitude-bearing payload in place when installed instead', () => {
    const state = playerState({ installedLoadout: [piece('a')], material: { a: 1 } });
    const result = mergeSubroutine(state, 'a');
    expect(result.installedLoadout[0].payload).toEqual({ kind: 'directBurst', amount: 8 });
  });

  it("improves Ward's shield amount directly -- it's a real magnitude now (Breach/Containment redesign)", () => {
    const ward = piece('w', { payload: { kind: 'ward', amount: 7 } });
    const state = playerState({ bench: [ward], material: { w: 1 } });
    const result = mergeSubroutine(state, 'w');
    expect(result.bench[0].payload).toEqual({ kind: 'ward', amount: 10 }); // +3 (MERGE_MAGNITUDE_BONUS)
  });

  it('falls back to the trigger knob for a non-magnitude payload (Cleanse)', () => {
    const cleanse = piece('c', { payload: { kind: 'cleanse' }, trigger: { kind: 'accumulator', metric: 'points', threshold: 6 } });
    const state = playerState({ bench: [cleanse], material: { c: 1 } });
    const result = mergeSubroutine(state, 'c');
    expect(result.bench[0].payload).toEqual({ kind: 'cleanse' }); // unchanged
    expect(result.bench[0].trigger).toEqual({ kind: 'accumulator', metric: 'points', threshold: 4 }); // -2
  });

  it("raises Occurrence: scaling's cap for a non-magnitude payload with no other knob", () => {
    const cleanse = piece('c', {
      payload: { kind: 'cleanse' },
      trigger: { kind: 'occurrence', category: 'flush', variation: 'scaling', cap: 4 },
    });
    const state = playerState({ bench: [cleanse], material: { c: 1 } });
    const result = mergeSubroutine(state, 'c');
    expect(result.bench[0].trigger).toEqual({ kind: 'occurrence', category: 'flush', variation: 'scaling', cap: 6 }); // +2
  });

  it('is a no-op when no material is banked for the id', () => {
    const state = playerState({ bench: [piece('a')], material: {} });
    expect(mergeSubroutine(state, 'a')).toEqual(state);
  });

  it('is a no-op when the id is not owned at all', () => {
    const state = playerState({ material: { a: 1 } });
    expect(mergeSubroutine(state, 'a')).toEqual(state);
  });

  it('is a no-op once rank is at MERGE_RANK_CAP', () => {
    const state = playerState({ bench: [piece('a')], material: { a: 5 }, rank: { a: MERGE_RANK_CAP } });
    expect(mergeSubroutine(state, 'a')).toEqual(state);
  });

  it('can be applied repeatedly up to the rank cap, each spending 1 material', () => {
    let state = playerState({ bench: [piece('a')], material: { a: MERGE_RANK_CAP + 2 } });
    for (let i = 0; i < MERGE_RANK_CAP; i++) state = mergeSubroutine(state, 'a');
    expect(state.rank.a).toBe(MERGE_RANK_CAP);
    expect(state.material.a).toBe(2); // 2 banked merges left unspent, capped out
    const capped = mergeSubroutine(state, 'a');
    expect(capped).toEqual(state); // further merges are no-ops
  });
});

describe('preferMergeWhenAvailable', () => {
  it("chooses 'merge' when any material is banked", () => {
    expect(preferMergeWhenAvailable(playerState({ material: { a: 1 } }), 0)).toBe('merge');
  });

  it("chooses 'rest' when nothing is banked", () => {
    expect(preferMergeWhenAvailable(playerState({ material: {} }), 0)).toBe('rest');
    expect(preferMergeWhenAvailable(playerState({ material: { a: 0 } }), 0)).toBe('rest');
  });
});

describe('opportunisticSafehouseStrategy', () => {
  const heatHigh = Math.ceil(HEAT_HIGH_FRACTION * HEAT_MAX);
  const heatLow = 0;

  it("chooses 'rest' when Heat is high, even with material banked -- Heat wins the tie", () => {
    expect(opportunisticSafehouseStrategy(playerState({ material: { a: 1 } }), heatHigh)).toBe('rest');
  });

  it("chooses 'merge' when material is banked and Heat is not high", () => {
    expect(opportunisticSafehouseStrategy(playerState({ material: { a: 1 } }), heatLow)).toBe('merge');
  });

  it("chooses 'rest' when Heat is high and nothing is banked", () => {
    expect(opportunisticSafehouseStrategy(playerState({ material: {} }), heatHigh)).toBe('rest');
  });

  it("chooses 'rest' when Heat is not high and nothing is banked", () => {
    expect(opportunisticSafehouseStrategy(playerState({ material: {} }), heatLow)).toBe('rest');
  });

  it('respects a raised max Heat (maxHeatBonus) when judging whether Heat counts as high', () => {
    // heatHigh is exactly the threshold for the unraised cap -- with the
    // cap raised, that same absolute Heat value is no longer "high"
    // relative to the new max, so material should win instead.
    expect(opportunisticSafehouseStrategy(playerState({ material: { a: 1 }, maxHeatBonus: 100 }), heatHigh)).toBe('merge');
  });
});

describe('pickMergeTarget', () => {
  it('picks the id with the most banked material', () => {
    expect(pickMergeTarget(playerState({ material: { a: 1, b: 3, c: 2 } }))).toBe('b');
  });

  it('returns null when nothing is banked', () => {
    expect(pickMergeTarget(playerState({ material: {} }))).toBeNull();
    expect(pickMergeTarget(playerState({ material: { a: 0 } }))).toBeNull();
  });
});
