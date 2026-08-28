import { describe, it, expect } from 'vitest';
import type { RunPlayerState } from './run';
import type { SubroutineDefinition } from './subroutine-types';
import { easeTriggerCondition, mergeSubroutine, preferMergeWhenAvailable, pickMergeTarget, MERGE_RANK_CAP } from './merge';

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
    expect(preferMergeWhenAvailable(playerState({ material: { a: 1 } }))).toBe('merge');
  });

  it("chooses 'rest' when nothing is banked", () => {
    expect(preferMergeWhenAvailable(playerState({ material: {} }))).toBe('rest');
    expect(preferMergeWhenAvailable(playerState({ material: { a: 0 } }))).toBe('rest');
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
