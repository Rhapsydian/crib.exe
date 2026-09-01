import { describe, it, expect } from 'vitest';
import type { Card } from './cards';
import { bestCardToForce } from './ai';
import { NEUTRAL_RARES, BREACHER_LOADOUT } from './subroutines';
import type { PayloadEffect, SubroutineDefinition, TriggerFamily } from './subroutine-types';
import {
  createCombatState,
  resolvePayload,
  fireReadySubroutines,
  fireHandLifecycleSubroutines,
  clearHandKnowledge,
  refreshTriggerReadiness,
  fireNewlyReadyReactiveSubroutines,
  tickCastersTurnPulse,
  tickGlobalPulse,
  resolvePendingSabotage,
  applyThrottled,
  tickDebuffDurations,
  consumePendingCribbageManipulation,
  applyFootholdBonus,
  adjustSideWinThreshold,
  fireRareOccurrenceSubroutines,
  fireHandOutcomeSubroutines,
} from './resolve';
import type { HandResult } from './game';

function definition(
  id: string,
  trigger: TriggerFamily,
  payload: PayloadEffect,
  overrides: Partial<
    Pick<SubroutineDefinition, 'archetype' | 'togglable' | 'reactive' | 'firesAt' | 'maxFiresPerCombat' | 'magnitudeDecayPerFire' | 'magnitudeFloor'>
  > = {},
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
    firesAt: overrides.firesAt,
    maxFiresPerCombat: overrides.maxFiresPerCombat,
    magnitudeDecayPerFire: overrides.magnitudeDecayPerFire,
    magnitudeFloor: overrides.magnitudeFloor,
  };
}

const alwaysBurst = (id: string, amount = 5) =>
  definition(id, { kind: 'always' }, { kind: 'directBurst', amount });

describe("resolvePayload — offense credits the caster's own gauge", () => {
  it("directBurst credits the caster's own winGauge (side 0 or side 1), never the opponent's", () => {
    const state = createCombatState([], [], [12, 12]);
    const forPlayer = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 0);
    expect(forPlayer.sides[0].winGauge.progress).toBe(10);
    expect(forPlayer.sides[1].winGauge.progress).toBe(0);

    const forEnemy = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1);
    expect(forEnemy.sides[1].winGauge.progress).toBe(10);
    expect(forEnemy.sides[0].winGauge.progress).toBe(0);
  });

  it("a shield on the target absorbs a directBurst up to its amount, denying the caster's gauge credit for that portion", () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'ward', amount: 6 }, 'encryption', state, 1); // side 1 builds a shield
    const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 0); // side 0 attacks
    expect(result.sides[1].wardShield).toBe(0); // fully consumed
    expect(result.sides[0].winGauge.progress).toBe(4); // 10 - 6 absorbed gets through
  });

  it('a shield larger than the incoming hit absorbs it all and denies all credit', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'ward', amount: 20 }, 'encryption', state, 1);
    const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 0);
    expect(result.sides[1].wardShield).toBe(10); // 20 - 10
    expect(result.sides[0].winGauge.progress).toBe(0);
  });

  it('piercing ignores an active shield entirely', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'ward', amount: 6 }, 'encryption', state, 1);
    const result = resolvePayload({ kind: 'piercing', amount: 10 }, 'exploit', state, 0);
    expect(result.sides[0].winGauge.progress).toBe(10); // full amount, unabsorbed
    expect(result.sides[1].wardShield).toBe(6); // untouched
  });

  it('chainFinisherScaling scales with how many subroutines already fired this turn', () => {
    const state = createCombatState([], [], [12, 12]);
    const payload: PayloadEffect = { kind: 'chainFinisherScaling', baseAmount: 2, perPriorFire: 3 };
    const first = resolvePayload(payload, 'exploit', state, 0, { priorFireCountThisTurn: 0 });
    expect(first.sides[0].winGauge.progress).toBe(2);
    const third = resolvePayload(payload, 'exploit', state, 0, { priorFireCountThisTurn: 2 });
    expect(third.sides[0].winGauge.progress).toBe(8);
  });

  it("riskRewardBurst credits the caster's own gauge, and the firing piece's traceCost is charged", () => {
    // Session 47: Trace cost moved off the payload onto the definition,
    // so it is charged centrally for ANY noisy piece rather than only
    // this payload kind. Passed here as the firingDefinition argument.
    const state = createCombatState([], [], [12, 12]);
    const noisy = traceCostingDefinition(3);
    const result = resolvePayload({ kind: 'riskRewardBurst', amount: 6 }, 'exploit', state, 0, undefined, noisy);
    expect(result.sides[0].winGauge.progress).toBe(6);
    expect(result.sides[0].trace).toBe(3);
  });

  it('charges traceCost for a non-Exploit payload too -- noise is a property of the piece', () => {
    const state = createCombatState([], [], [12, 12]);
    const loudWard = { ...traceCostingDefinition(2), archetype: 'encryption' as const };
    const result = resolvePayload({ kind: 'ward', amount: 4 }, 'encryption', state, 0, undefined, loudWard);
    expect(result.sides[0].trace).toBe(2);
  });

  it('charges nothing for a piece with no traceCost', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'riskRewardBurst', amount: 6 }, 'exploit', state, 0);
    expect(result.sides[0].trace).toBe(0);
  });

  it('chainFinisherScaling/riskRewardBurst are not shield-checked (matches pre-redesign scope -- only directBurst ever was)', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'ward', amount: 999 }, 'encryption', state, 1);
    const result = resolvePayload({ kind: 'riskRewardBurst', amount: 10 }, 'exploit', state, 0);
    expect(result.sides[0].winGauge.progress).toBe(10); // shield never checked
  });
});

/** A minimal firing definition carrying a Trace cost -- session 47 moved
 * Trace off the payload and onto the piece, so resolvePayload learns the
 * cost from its firingDefinition argument. */
function traceCostingDefinition(traceCost: number): SubroutineDefinition {
  return {
    id: 'noisy',
    name: 'Noisy',
    archetype: 'exploit',
    trigger: { kind: 'always' },
    payload: { kind: 'riskRewardBurst', amount: 1 },
    tags: [],
    traceCost,
  };
}

describe('traceReduction', () => {
  it("reduces the caster's own Heat, floored", () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'riskRewardBurst', amount: 1 }, 'exploit', state, 0, undefined, traceCostingDefinition(5));
    const result = resolvePayload({ kind: 'traceReduction', amount: 3, floor: 1 }, 'root', state, 0);
    expect(result.sides[0].trace).toBe(2);
  });

  it('never reduces Heat below the floor', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'riskRewardBurst', amount: 1 }, 'exploit', state, 0, undefined, traceCostingDefinition(2));
    const result = resolvePayload({ kind: 'traceReduction', amount: 10, floor: 1 }, 'root', state, 0);
    expect(result.sides[0].trace).toBe(1);
  });

  it('is halved by Corrupted like any other magnitude', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'riskRewardBurst', amount: 1 }, 'exploit', state, 0, undefined, traceCostingDefinition(10));
    state = resolvePayload({ kind: 'debuff', debuffId: 'corrupted', magnitude: 1, duration: 3 }, 'malware', state, 1); // applies to side 0
    const result = resolvePayload({ kind: 'traceReduction', amount: 4, floor: 0 }, 'root', state, 0);
    expect(result.sides[0].trace).toBe(8); // 10 - (4 * 0.5)
  });
});

describe('resolvePayload — status effects', () => {
  it('dot applies to the opposing side', () => {
    const state = createCombatState([], [], [12, 12]);
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
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload(
      { kind: 'debuff', debuffId: 'corrupted', magnitude: 1, duration: 2 },
      'malware',
      state,
      1,
    );
    expect(result.sides[0].debuffs).toEqual([{ debuffId: 'corrupted', magnitude: 1, remainingDuration: 2 }]);
  });

  it("cleanse removes a debuff from the caster's own side", () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'corrupted', magnitude: 1, duration: 2 }, 'malware', state, 1);
    expect(state.sides[0].debuffs).toHaveLength(1);
    const cleansed = resolvePayload({ kind: 'cleanse', debuffId: 'corrupted' }, 'encryption', state, 0);
    expect(cleansed.sides[0].debuffs).toEqual([]);
  });
});

describe('fireReadySubroutines', () => {
  it('fires a single ready subroutine and resets its state afterward', () => {
    const state = createCombatState([alwaysBurst('a', 5)], [], [12, 12]);
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events).toHaveLength(1);
    expect(events[0].subroutineId).toBe('a');
    expect(combatState.sides[0].winGauge.progress).toBe(5);
    expect(combatState.sides[0].loadout[0].state.ready).toBe(false);
  });

  it('does not fire a subroutine whose condition is not met', () => {
    const notReady = definition('a', { kind: 'occurrence', category: 'run', variation: 'instant' }, { kind: 'directBurst', amount: 5 });
    const state = createCombatState([notReady], [], [12, 12]);
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events).toHaveLength(0);
    expect(combatState.sides[0].winGauge.progress).toBe(0);
  });

  it('skips a ready subroutine that has been toggled off', () => {
    const state = createCombatState([alwaysBurst('a', 5)], [], [12, 12]);
    state.sides[0].loadout[0].state = { ...state.sides[0].loadout[0].state, toggledOn: false };
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events).toHaveLength(0);
    expect(combatState.sides[0].winGauge.progress).toBe(0);
  });

  it('a chained subroutine fed by an earlier fire becomes ready and fires in the same pass', () => {
    const first = alwaysBurst('a', 4);
    const second = definition('b', { kind: 'chained', afterSubroutineId: 'a' }, { kind: 'directBurst', amount: 7 });
    const state = createCombatState([first, second], [], [12, 12]);
    const { combatState, events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events.map((e) => e.subroutineId)).toEqual(['a', 'b']);
    expect(combatState.sides[0].winGauge.progress).toBe(11);
  });

  it('does not fire a chained subroutine that comes before the one it depends on', () => {
    const second = definition('b', { kind: 'chained', afterSubroutineId: 'a' }, { kind: 'directBurst', amount: 7 });
    const first = alwaysBurst('a', 4);
    // loadout order: b before a -- b's condition (a fired) can't be met
    // within this single top-to-bottom pass since a hasn't fired yet.
    const state = createCombatState([second, first], [], [12, 12]);
    const { events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events.map((e) => e.subroutineId)).toEqual(['a']);
  });

  it('skips a firesAt-tagged entry even when otherwise ready -- it only ever fires via fireHandLifecycleSubroutines', () => {
    const piece = definition('a', { kind: 'always' }, { kind: 'directBurst', amount: 5 }, { firesAt: 'onDealt' });
    const state = createCombatState([piece], [], [12, 12]);
    const { events } = fireReadySubroutines(state, 0, { isDealer: false });
    expect(events).toHaveLength(0);
  });
});

describe('fireHandLifecycleSubroutines', () => {
  it('fires a ready subroutine tagged for the matching moment', () => {
    const piece = definition('a', { kind: 'always' }, { kind: 'directBurst', amount: 5 }, { firesAt: 'onDealt' });
    const state = createCombatState([piece], [], [12, 12]);
    const { combatState, events } = fireHandLifecycleSubroutines(state, 0, 'onDealt', { isDealer: false });
    expect(events).toHaveLength(1);
    expect(events[0].subroutineId).toBe('a');
    expect(combatState.sides[0].winGauge.progress).toBe(5);
    expect(combatState.sides[0].loadout[0].state.ready).toBe(false);
  });

  it('does not fire a subroutine tagged for a different moment', () => {
    const piece = definition('a', { kind: 'always' }, { kind: 'directBurst', amount: 5 }, { firesAt: 'onCribSelected' });
    const state = createCombatState([piece], [], [12, 12]);
    const { combatState, events } = fireHandLifecycleSubroutines(state, 0, 'onDealt', { isDealer: false });
    expect(events).toHaveLength(0);
    expect(combatState.sides[0].winGauge.progress).toBe(0);
  });

  it('does not fire a firesAt subroutine whose trigger condition is not met', () => {
    const piece = definition(
      'a',
      { kind: 'occurrence', category: 'run', variation: 'instant' },
      { kind: 'directBurst', amount: 5 },
      { firesAt: 'onDealt' },
    );
    const state = createCombatState([piece], [], [12, 12]);
    const { events } = fireHandLifecycleSubroutines(state, 0, 'onDealt', { isDealer: false });
    expect(events).toHaveLength(0);
  });

  it('skips a firesAt subroutine that has been toggled off', () => {
    const piece = definition('a', { kind: 'always' }, { kind: 'directBurst', amount: 5 }, { firesAt: 'onDealt' });
    const state = createCombatState([piece], [], [12, 12]);
    state.sides[0].loadout[0].state = { ...state.sides[0].loadout[0].state, toggledOn: false };
    const { events } = fireHandLifecycleSubroutines(state, 0, 'onDealt', { isDealer: false });
    expect(events).toHaveLength(0);
  });

  it('threads revealedCards through to a revealOpponentHand payload, storing it as knownOpponentHand', () => {
    const piece = definition('a', { kind: 'always' }, { kind: 'revealOpponentHand' }, { firesAt: 'onDealt' });
    const state = createCombatState([piece], [], [12, 12]);
    const opponentHand: Card[] = [{ rank: 7, suit: 0 }, { rank: 9, suit: 1 }];
    const { combatState } = fireHandLifecycleSubroutines(state, 0, 'onDealt', { isDealer: false }, opponentHand);
    expect(combatState.sides[0].knownOpponentHand).toEqual(opponentHand);
  });
});

describe('recon payloads (session 24 checkpoint C)', () => {
  const opponentHand: Card[] = [{ rank: 3, suit: 0 }, { rank: 8, suit: 2 }];
  const crib: Card[] = [{ rank: 5, suit: 1 }, { rank: 5, suit: 3 }, { rank: 10, suit: 0 }, { rank: 2, suit: 2 }];

  it('revealOpponentHand stores revealedCards as the caster\'s own knownOpponentHand', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'revealOpponentHand' }, 'root', state, 0, {
      priorFireCountThisTurn: 0,
      revealedCards: opponentHand,
    });
    expect(result.sides[0].knownOpponentHand).toEqual(opponentHand);
    expect(result.sides[1].knownOpponentHand).toBeUndefined();
  });

  it('revealOpponentKeptHand also stores into knownOpponentHand -- the later, smaller reveal supersedes the earlier one', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'revealOpponentHand' }, 'root', state, 0, {
      priorFireCountThisTurn: 0,
      revealedCards: [...opponentHand, { rank: 11, suit: 3 }],
    });
    const keptHand = opponentHand; // the 2 remaining after their discard
    state = resolvePayload({ kind: 'revealOpponentKeptHand' }, 'root', state, 0, {
      priorFireCountThisTurn: 0,
      revealedCards: keptHand,
    });
    expect(state.sides[0].knownOpponentHand).toEqual(keptHand);
  });

  it('revealCrib stores revealedCards as knownCrib', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'revealCrib' }, 'root', state, 1, {
      priorFireCountThisTurn: 0,
      revealedCards: crib,
    });
    expect(result.sides[1].knownCrib).toEqual(crib);
    expect(result.sides[0].knownCrib).toBeUndefined();
  });

  it('is a no-op when no revealedCards were supplied (defensive fallback)', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'revealOpponentHand' }, 'root', state, 0);
    expect(result.sides[0].knownOpponentHand).toBeUndefined();
  });
});

describe('clearHandKnowledge', () => {
  it('clears both sides\' knownOpponentHand/knownCrib', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'revealOpponentHand' }, 'root', state, 0, {
      priorFireCountThisTurn: 0,
      revealedCards: [{ rank: 4, suit: 0 }],
    });
    state = resolvePayload({ kind: 'revealCrib' }, 'root', state, 1, {
      priorFireCountThisTurn: 0,
      revealedCards: [{ rank: 6, suit: 1 }],
    });
    const cleared = clearHandKnowledge(state);
    expect(cleared.sides[0].knownOpponentHand).toBeUndefined();
    expect(cleared.sides[1].knownCrib).toBeUndefined();
  });

  it('also clears any forcedDiscardPair', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'forceDiscardCard' }, 'root', state, 0, {
      priorFireCountThisTurn: 0,
      revealedCards: [{ rank: 3, suit: 0 }, { rank: 3, suit: 1 }, { rank: 8, suit: 2 }, { rank: 9, suit: 3 }, { rank: 1, suit: 0 }, { rank: 12, suit: 1 }],
      targetIsOwnCrib: false,
    });
    expect(state.sides[1].forcedDiscardPair).toBeDefined(); // side 0 cast it, side 1 (the target) is manipulated
    expect(clearHandKnowledge(state).sides[1].forcedDiscardPair).toBeUndefined();
  });
});

describe('forceDiscardCard payload (session 24 checkpoint D)', () => {
  const targetHand: Card[] = [
    { rank: 7, suit: 0 },
    { rank: 7, suit: 1 },
    { rank: 2, suit: 2 },
    { rank: 9, suit: 3 },
    { rank: 12, suit: 0 },
    { rank: 1, suit: 1 },
  ];

  it('sets forcedDiscardPair on the target side (opponent of the caster), not the caster', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'forceDiscardCard' }, 'root', state, 0, {
      priorFireCountThisTurn: 0,
      revealedCards: targetHand,
      targetIsOwnCrib: true,
    });
    expect(result.sides[1].forcedDiscardPair).toBeDefined();
    expect(result.sides[0].forcedDiscardPair).toBeUndefined();
  });

  it('the forced pair matches ai.ts\'s bestCardToForce for the same hand', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'forceDiscardCard' }, 'root', state, 1, {
      priorFireCountThisTurn: 0,
      revealedCards: targetHand,
      targetIsOwnCrib: false,
    });
    expect(result.sides[0].forcedDiscardPair).toEqual(bestCardToForce(targetHand, false));
  });

  it('is a no-op when no revealedCards were supplied (defensive fallback)', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'forceDiscardCard' }, 'root', state, 0);
    expect(result.sides[1].forcedDiscardPair).toBeUndefined();
  });
});

describe('refreshTriggerReadiness', () => {
  const selfHeatAbove = definition('self', { kind: 'selfState', condition: 'traceAbove', value: 5 }, { kind: 'directBurst', amount: 1 });
  const enemyGaugeFillAbove = definition(
    'enemy',
    { kind: 'enemyState', condition: 'gaugeFillAbove', fraction: 0.5 },
    { kind: 'directBurst', amount: 1 },
  );
  const selfIsDealer = definition('dealer', { kind: 'selfState', condition: 'isDealer' }, { kind: 'directBurst', amount: 1 });

  it('latches ready the moment a selfState condition becomes true', () => {
    let state = createCombatState([selfHeatAbove], [], [12, 12]);
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(false);

    state = { ...state, sides: [{ ...state.sides[0], trace: 10 }, state.sides[1]] as typeof state.sides };
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(true);
  });

  it('stays latched even after the underlying condition reverts to false (the actual bug fix)', () => {
    let state = createCombatState([selfHeatAbove], [], [12, 12]);
    state = { ...state, sides: [{ ...state.sides[0], trace: 10 }, state.sides[1]] as typeof state.sides };
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(true);

    // Heat drops back below the threshold -- a live re-check would say
    // "not ready" again, but the latch must survive.
    state = { ...state, sides: [{ ...state.sides[0], trace: 0 }, state.sides[1]] as typeof state.sides };
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(true);
  });

  it("latches an enemyState condition against the *other* side's state", () => {
    let state = createCombatState([], [enemyGaugeFillAbove], [12, 12]);
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[1].loadout[0].state.ready).toBe(false);

    // Side 0's gauge (the enemy, from side 1's perspective) fills past 50%.
    const gauge = { ...state.sides[0].gauge, progress: 7 };
    state = { ...state, sides: [{ ...state.sides[0], gauge }, state.sides[1]] as typeof state.sides };
    state = refreshTriggerReadiness(state, 0);
    expect(state.sides[1].loadout[0].state.ready).toBe(true);
  });

  it('respects handDealer for isDealer/isNonDealer', () => {
    const notDealer = refreshTriggerReadiness(createCombatState([selfIsDealer], [], [12, 12]), 1);
    expect(notDealer.sides[0].loadout[0].state.ready).toBe(false);

    const isDealer = refreshTriggerReadiness(createCombatState([selfIsDealer], [], [12, 12]), 0);
    expect(isDealer.sides[0].loadout[0].state.ready).toBe(true);
  });

  it('does not touch accumulator/occurrence/chained/always subroutines', () => {
    const occurrenceDef = definition('occ', { kind: 'occurrence', category: 'go', variation: 'instant' }, { kind: 'directBurst', amount: 1 });
    const state = refreshTriggerReadiness(createCombatState([occurrenceDef, alwaysBurst('always')], [], [12, 12]), 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(false); // occurrence untouched, no matching occurrence fed in
    expect(state.sides[0].loadout[1].state.ready).toBe(false); // always is evaluated live at fire time, not latched here
  });

  describe('Reactive edge-triggering', () => {
    const reactiveHeatAbove = definition(
      'reactive-self',
      { kind: 'selfState', condition: 'traceAbove', value: 5 },
      { kind: 'directBurst', amount: 3 },
      { reactive: true },
    );

    function withHeat(state: ReturnType<typeof createCombatState>, side: 0 | 1, trace: number) {
      const sides = state.sides.slice() as typeof state.sides;
      sides[side] = { ...sides[side], trace };
      return { ...state, sides };
    }

    it('arms on the false-to-true transition and stays armed on repeated true checks (no accidental re-debounce)', () => {
      let state = createCombatState([reactiveHeatAbove], [], [12, 12]);
      state = withHeat(state, 0, 10); // condition true from the start
      state = refreshTriggerReadiness(state, 0);
      expect(state.sides[0].loadout[0].state.ready).toBe(true); // first observation is a rising edge from the initial false
    });

    it('does not re-arm on a second check while the condition stays continuously true', () => {
      let state = createCombatState([reactiveHeatAbove], [], [12, 12]);
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
      let state = createCombatState([reactiveHeatAbove], [], [12, 12]);
      state = withHeat(state, 0, 10);
      state = refreshTriggerReadiness(state, 0); // arms
      state = withHeat(state, 0, 0); // condition reverts to false
      state = refreshTriggerReadiness(state, 0);
      expect(state.sides[0].loadout[0].state.lastConditionTrue).toBe(false);

      state = withHeat(state, 0, 10); // true again -- a real rising edge this time
      state = refreshTriggerReadiness(state, 0);
      expect(state.sides[0].loadout[0].state.ready).toBe(true);
    });

    describe('maxFiresPerCombat (session 39)', () => {
      const cappedReactive = definition(
        'capped-reactive',
        { kind: 'selfState', condition: 'traceAbove', value: 5 },
        { kind: 'directBurst', amount: 3 },
        { reactive: true, maxFiresPerCombat: 2 },
      );

      /** Arms (if a rising edge is live), then fires it via the real
       * fireNewlyReadyReactiveSubroutines path -- same pattern the
       * existing edge-triggering tests above use, so fireCount actually
       * increments through the real mechanism, not a hand-set field. */
      function armAndFire(state: ReturnType<typeof createCombatState>) {
        const before = state;
        const after = refreshTriggerReadiness(state, 0);
        const { combatState } = fireNewlyReadyReactiveSubroutines(before, after);
        return combatState;
      }

      it('re-arms up to the cap, repeatedly cycling the condition false/true', () => {
        let state = createCombatState([cappedReactive], [], [12, 12]);
        state = withHeat(state, 0, 10);
        state = armAndFire(state); // fire 1
        expect(state.sides[0].loadout[0].state.fireCount).toBe(1);
        expect(state.sides[0].winGauge.progress).toBe(3);

        state = withHeat(state, 0, 0); // condition drops
        state = refreshTriggerReadiness(state, 0);
        state = withHeat(state, 0, 10); // rising edge again -- still under the cap (fireCount 1 < 2)
        state = armAndFire(state); // fire 2
        expect(state.sides[0].loadout[0].state.fireCount).toBe(2);
        expect(state.sides[0].winGauge.progress).toBe(6);
      });

      it('stops re-arming once fireCount reaches maxFiresPerCombat, even on a genuine rising edge', () => {
        let state = createCombatState([cappedReactive], [], [12, 12]);
        state = withHeat(state, 0, 10);
        state = armAndFire(state); // fire 1
        state = withHeat(state, 0, 0);
        state = refreshTriggerReadiness(state, 0);
        state = withHeat(state, 0, 10);
        state = armAndFire(state); // fire 2 -- now at the cap (2)
        expect(state.sides[0].loadout[0].state.fireCount).toBe(2);

        state = withHeat(state, 0, 0); // drop again
        state = refreshTriggerReadiness(state, 0);
        state = withHeat(state, 0, 10); // a real rising edge -- but the cap should block re-arming
        state = refreshTriggerReadiness(state, 0);
        expect(state.sides[0].loadout[0].state.ready).toBe(false);
        expect(state.sides[0].winGauge.progress).toBe(6); // unchanged from the 2 real fires above
      });

      it('an undefined maxFiresPerCombat (every existing subroutine) is never capped', () => {
        let state = createCombatState([reactiveHeatAbove], [], [12, 12]);
        for (let i = 0; i < 5; i++) {
          state = withHeat(state, 0, 10);
          state = armAndFire(state);
          state = withHeat(state, 0, 0);
          state = refreshTriggerReadiness(state, 0);
        }
        expect(state.sides[0].loadout[0].state.fireCount).toBe(5);
      });
    });

    describe('magnitudeDecayPerFire (session 39, Firewall Prime\'s Zero Trust redesign)', () => {
      const decayingReactive = definition(
        'decaying-reactive',
        { kind: 'selfState', condition: 'traceAbove', value: 5 },
        { kind: 'instantCounterPush', amount: 18 },
        { reactive: true, magnitudeDecayPerFire: 4, magnitudeFloor: 4 },
      );

      function armAndFireOn(state: ReturnType<typeof createCombatState>) {
        const before = state;
        const after = refreshTriggerReadiness(state, 0);
        return fireNewlyReadyReactiveSubroutines(before, after);
      }

      it('fires at full magnitude the first time (fireCount 0)', () => {
        let state = createCombatState([], [decayingReactive], [12, 12]);
        state = withHeat(state, 1, 10);
        const { combatState, events } = armAndFireOn(state);
        expect(events[0].payload).toEqual({ kind: 'instantCounterPush', amount: 18 });
        expect(combatState.sides[0].winGauge.progress).toBe(0); // reduceWinGauge floors at 0, side 0 had nothing banked
      });

      it('decays on each subsequent fire, floored, and the logged FireEvent reflects the decayed amount', () => {
        let state = createCombatState([], [decayingReactive], [12, 12]);
        // Give side 0 (the target of side 1's counter-push) enough banked
        // progress to observe each decayed reduction distinctly.
        state = resolvePayload({ kind: 'directBurst', amount: 100 }, 'exploit', state, 0);

        state = withHeat(state, 1, 10);
        let result = armAndFireOn(state);
        state = result.combatState;
        expect(result.events[0].payload).toEqual({ kind: 'instantCounterPush', amount: 18 }); // fire 1: 18 - 4*0
        expect(state.sides[0].winGauge.progress).toBe(82); // 100 - 18

        state = withHeat(state, 1, 0);
        state = refreshTriggerReadiness(state, 0);
        state = withHeat(state, 1, 10);
        result = armAndFireOn(state);
        state = result.combatState;
        expect(result.events[0].payload).toEqual({ kind: 'instantCounterPush', amount: 14 }); // fire 2: 18 - 4*1
        expect(state.sides[0].winGauge.progress).toBe(68); // 82 - 14

        state = withHeat(state, 1, 0);
        state = refreshTriggerReadiness(state, 0);
        state = withHeat(state, 1, 10);
        result = armAndFireOn(state);
        state = result.combatState;
        expect(result.events[0].payload).toEqual({ kind: 'instantCounterPush', amount: 10 }); // fire 3: 18 - 4*2
        expect(state.sides[0].winGauge.progress).toBe(58); // 68 - 10
      });

      it('never decays below magnitudeFloor no matter how many times it fires', () => {
        let state = createCombatState([], [decayingReactive], [12, 12]);
        state = resolvePayload({ kind: 'directBurst', amount: 1000 }, 'exploit', state, 0);

        for (let i = 0; i < 8; i++) {
          state = withHeat(state, 1, 10);
          const result = armAndFireOn(state);
          state = result.combatState;
          if (i >= 4) expect(result.events[0].payload).toEqual({ kind: 'instantCounterPush', amount: 4 }); // floored by fire 5 (18 - 4*4 = 2, clamped to floor 4)
          state = withHeat(state, 1, 0);
          state = refreshTriggerReadiness(state, 0);
        }
        expect(state.sides[1].loadout[0].state.fireCount).toBe(8);
      });
    });
  });
});

describe('fireNewlyReadyReactiveSubroutines', () => {
  it('fires a subroutine whose readiness just flipped true and is reactive', () => {
    const def = definition('r', { kind: 'always' }, { kind: 'directBurst', amount: 4 }, { reactive: true });
    const before = createCombatState([def], [], [12, 12]);
    const after = { ...before, sides: [{ ...before.sides[0], loadout: [{ ...before.sides[0].loadout[0], state: { ...before.sides[0].loadout[0].state, ready: true } }] }, before.sides[1]] as typeof before.sides };

    const { combatState, events } = fireNewlyReadyReactiveSubroutines(before, after);
    expect(events).toHaveLength(1);
    expect(events[0].subroutineId).toBe('r');
    expect(combatState.sides[0].winGauge.progress).toBe(4);
    expect(combatState.sides[0].loadout[0].state.ready).toBe(false); // fired and reset
  });

  it('does not fire a subroutine that was already ready before (only newly-ready transitions count)', () => {
    const def = definition('r', { kind: 'always' }, { kind: 'directBurst', amount: 4 }, { reactive: true });
    const withReady = (s: ReturnType<typeof createCombatState>) => ({
      ...s,
      sides: [{ ...s.sides[0], loadout: [{ ...s.sides[0].loadout[0], state: { ...s.sides[0].loadout[0].state, ready: true } }] }, s.sides[1]] as typeof s.sides,
    });
    const before = withReady(createCombatState([def], [], [12, 12]));
    const after = withReady(createCombatState([def], [], [12, 12]));

    const { events } = fireNewlyReadyReactiveSubroutines(before, after);
    expect(events).toHaveLength(0);
  });

  it('does not fire a newly-ready subroutine that is not reactive', () => {
    const def = definition('r', { kind: 'always' }, { kind: 'directBurst', amount: 4 });
    const before = createCombatState([def], [], [12, 12]);
    const after = { ...before, sides: [{ ...before.sides[0], loadout: [{ ...before.sides[0].loadout[0], state: { ...before.sides[0].loadout[0].state, ready: true } }] }, before.sides[1]] as typeof before.sides };

    const { events } = fireNewlyReadyReactiveSubroutines(before, after);
    expect(events).toHaveLength(0);
  });
});

describe("instantCounterPush -- reduces the opponent's gauge directly", () => {
  it("reduces the target's own winGauge progress, leaving the caster's own untouched", () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'directBurst', amount: 30 }, 'exploit', state, 1); // enemy banks some progress
    const result = resolvePayload({ kind: 'instantCounterPush', amount: 12 }, 'encryption', state, 0);
    expect(result.sides[1].winGauge.progress).toBe(18); // 30 - 12
    expect(result.sides[0].winGauge.progress).toBe(0);
  });

  it('floors at 0 rather than going negative -- no more midpoint cap, just a floor', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'directBurst', amount: 5 }, 'exploit', state, 1);
    const result = resolvePayload({ kind: 'instantCounterPush', amount: 999 }, 'encryption', state, 0);
    expect(result.sides[1].winGauge.progress).toBe(0);
  });

  it("is not blocked by the target's own wardShield -- Ward only intercepts gauge-seeking offense, not mitigation", () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'directBurst', amount: 30 }, 'exploit', state, 1);
    state = resolvePayload({ kind: 'ward', amount: 999 }, 'encryption', state, 1); // enemy shields up
    const result = resolvePayload({ kind: 'instantCounterPush', amount: 12 }, 'encryption', state, 0);
    expect(result.sides[1].winGauge.progress).toBe(18); // shield didn't matter
    expect(result.sides[1].wardShield).toBe(999); // untouched
  });

  it("reduces side 0's gauge when cast by side 1", () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'directBurst', amount: 30 }, 'exploit', state, 0);
    const result = resolvePayload({ kind: 'instantCounterPush', amount: 12 }, 'encryption', state, 1);
    expect(result.sides[0].winGauge.progress).toBe(18);
  });
});

describe('tickCastersTurnPulse', () => {
  it("ticks a DoT (stored on the target) when its caster gets a turn, not the target -- credits the caster's own gauge", () => {
    const state = createCombatState([], [], [12, 12]);
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 2 },
      'malware',
      state,
      0, // side 0 casts a DoT onto side 1
    );

    // Side 1 getting a turn should NOT tick side 0's DoT.
    const notCastersTurn = tickCastersTurnPulse(withDot, 1);
    expect(notCastersTurn.sides[0].winGauge.progress).toBe(0);
    expect(notCastersTurn.sides[1].dots).toHaveLength(1);

    // Side 0 (the caster) getting a turn ticks it -- credits side 0's own gauge.
    const castersTurn = tickCastersTurnPulse(withDot, 0);
    expect(castersTurn.sides[0].winGauge.progress).toBe(5);
    expect(castersTurn.sides[1].dots).toEqual([expect.objectContaining({ remainingDuration: 1 })]);
  });

  it('removes the tick once its duration is exhausted', () => {
    const state = createCombatState([], [], [12, 12]);
    let withDot = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 2 }, 'malware', state, 0);
    withDot = tickCastersTurnPulse(withDot, 0);
    withDot = tickCastersTurnPulse(withDot, 0);
    expect(withDot.sides[0].winGauge.progress).toBe(10);
    expect(withDot.sides[1].dots).toEqual([]);
  });

  it("a caster's-turn-pulse HoT tick reduces the opponent's gauge, uncapped -- no more midpoint cap", () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'directBurst', amount: 50 }, 'exploit', state, 1); // enemy banks 50
    const withHot = resolvePayload({ kind: 'hot', amountPerTick: 999, cadence: 'castersTurnPulse', duration: 1 }, 'encryption', state, 0);
    const result = tickCastersTurnPulse(withHot, 0);
    expect(result.sides[1].winGauge.progress).toBe(0); // floored at 0
    expect(result.sides[0].winGauge.progress).toBe(0); // HoT alone doesn't credit the caster's own gauge
  });

  it('does not tick a globalPulse tick', () => {
    const state = createCombatState([], [], [12, 12]);
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 2, pointsPerTick: 10 },
      'malware',
      state,
      0,
    );
    const result = tickCastersTurnPulse(withDot, 0);
    expect(result.sides[0].winGauge.progress).toBe(0);
    expect(result.sides[1].dots).toHaveLength(1);
  });
});

describe('tickGlobalPulse', () => {
  it('ticks once combined points cross pointsPerTick', () => {
    const state = createCombatState([], [], [12, 12]);
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 3, pointsPerTick: 10 },
      'malware',
      state,
      0,
    );
    const under = tickGlobalPulse(withDot, 6);
    expect(under.sides[0].winGauge.progress).toBe(0); // 6 < 10, no tick yet
    const over = tickGlobalPulse(under, 5); // 6 + 5 = 11, crosses 10
    expect(over.sides[0].winGauge.progress).toBe(5);
    expect(over.sides[1].dots).toEqual([expect.objectContaining({ remainingDuration: 2, accumulatedPoints: 1 })]);
  });

  it('fires multiple times from a single large occurrence, carrying overshoot', () => {
    const state = createCombatState([], [], [12, 12]);
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 5, pointsPerTick: 10 },
      'malware',
      state,
      0,
    );
    const result = tickGlobalPulse(withDot, 25); // 2 full crossings, 5 left over
    expect(result.sides[0].winGauge.progress).toBe(10);
    expect(result.sides[1].dots).toEqual([expect.objectContaining({ remainingDuration: 3, accumulatedPoints: 5 })]);
  });

  it('is combined across both sides -- points scored by either side count', () => {
    const state = createCombatState([], [], [12, 12]);
    // Side 1 casts the dot (onto side 0), but side 0's own scoring should still feed it.
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 1, pointsPerTick: 10 },
      'malware',
      state,
      1,
    );
    const result = tickGlobalPulse(withDot, 10);
    expect(result.sides[1].winGauge.progress).toBe(5); // side 1 is the caster
    expect(result.sides[0].winGauge.progress).toBe(0);
  });

  it('ignores a castersTurnPulse tick and one with no pointsPerTick', () => {
    const state = createCombatState([], [], [12, 12]);
    let withDots = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 1 }, 'malware', state, 0);
    withDots = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 1 }, 'malware', withDots, 0); // no pointsPerTick
    const result = tickGlobalPulse(withDots, 100);
    expect(result.sides[0].winGauge.progress).toBe(0);
    expect(result.sides[1].dots).toHaveLength(2);
  });

  it('removes the tick once duration is exhausted mid-batch', () => {
    const state = createCombatState([], [], [12, 12]);
    const withDot = resolvePayload(
      { kind: 'dot', amountPerTick: 5, cadence: 'globalPulse', duration: 2, pointsPerTick: 10 },
      'malware',
      state,
      0,
    );
    const result = tickGlobalPulse(withDot, 35); // would cross 3 times, but only 2 duration
    expect(result.sides[0].winGauge.progress).toBe(10);
    expect(result.sides[1].dots).toEqual([]);
  });
});

describe('scheduledSabotage / resolvePendingSabotage', () => {
  it('registers a pending entry instead of resolving immediately', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload(
      { kind: 'scheduledSabotage', resolvesAt: 'nextDeal', effect: { kind: 'directBurst', amount: 15 } },
      'root',
      state,
      0,
    );
    expect(result.sides[0].winGauge.progress).toBe(0); // not yet applied
    expect(result.pendingSabotage).toEqual([
      { casterSide: 0, archetype: 'root', effect: { kind: 'directBurst', amount: 15 } },
    ]);
  });

  it('resolves and clears a pending effect', () => {
    const state = createCombatState([], [], [12, 12]);
    const scheduled = resolvePayload(
      { kind: 'scheduledSabotage', resolvesAt: 'nextDeal', effect: { kind: 'directBurst', amount: 15 } },
      'root',
      state,
      0,
    );
    const result = resolvePendingSabotage(scheduled);
    expect(result.sides[0].winGauge.progress).toBe(15);
    expect(result.pendingSabotage).toEqual([]);
  });

  it('is a no-op on an empty list', () => {
    const state = createCombatState([], [], [12, 12]);
    expect(resolvePendingSabotage(state)).toEqual(state);
  });

  it('resolves multiple pending effects from both casters', () => {
    let state = createCombatState([], [], [12, 12]);
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
    expect(result.sides[0].winGauge.progress).toBe(10);
    expect(result.sides[1].winGauge.progress).toBe(4);
  });

  it('a wrapped scheduledSabotage re-schedules for a future deal instead of resolving now', () => {
    const state = createCombatState([], [], [12, 12]);
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
    expect(afterFirstDeal.sides[0].winGauge.progress).toBe(0); // still not applied
    expect(afterFirstDeal.pendingSabotage).toHaveLength(1); // rescheduled for the deal after

    const afterSecondDeal = resolvePendingSabotage(afterFirstDeal);
    expect(afterSecondDeal.sides[0].winGauge.progress).toBe(15);
    expect(afterSecondDeal.pendingSabotage).toEqual([]);
  });
});

describe('applyThrottled', () => {
  it('leaves points unchanged when the side has no active Throttled debuff', () => {
    const state = createCombatState([], [], [12, 12]);
    expect(applyThrottled(state, 0, 12)).toBe(12);
  });

  it('dents points by the flat reduction, floored, never exceeding the original', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'throttled', magnitude: 1, duration: 3 }, 'malware', state, 1); // applies to side 0
    expect(applyThrottled(state, 0, 12)).toBe(8); // 12 - 4 (THROTTLED_REDUCTION)
    expect(applyThrottled(state, 0, 2)).toBe(1); // 2 - 4 would be -2, floored at 1
    expect(applyThrottled(state, 0, 0.5)).toBe(0.5); // already below the floor -- untouched, never inflated
  });

  it('does not affect the other side', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'throttled', magnitude: 1, duration: 3 }, 'malware', state, 1); // applies to side 0
    expect(applyThrottled(state, 1, 12)).toBe(12);
  });
});

describe("Corrupted -- reduces the debuffed side's own payload magnitude", () => {
  it('halves a directBurst from a corrupted caster', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'corrupted', magnitude: 1, duration: 3 }, 'malware', state, 1); // applies to side 0
    const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 0);
    expect(result.sides[0].winGauge.progress).toBe(5);
  });

  it("does not reduce a firing piece's Trace cost, only its magnitude", () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'corrupted', magnitude: 1, duration: 3 }, 'malware', state, 1);
    const result = resolvePayload({ kind: 'riskRewardBurst', amount: 10 }, 'exploit', state, 0, undefined, traceCostingDefinition(6));
    expect(result.sides[0].winGauge.progress).toBe(5);
    expect(result.sides[0].trace).toBe(6); // unreduced
  });

  it('halves a dot tick from a corrupted caster, re-checked at tick time', () => {
    let state = createCombatState([], [], [12, 12]);
    const withDot = resolvePayload({ kind: 'dot', amountPerTick: 10, cadence: 'castersTurnPulse', duration: 1 }, 'malware', state, 0);
    const corrupted = resolvePayload({ kind: 'debuff', debuffId: 'corrupted', magnitude: 1, duration: 3 }, 'malware', withDot, 1); // applies to side 0, the dot's caster
    const result = tickCastersTurnPulse(corrupted, 0);
    expect(result.sides[0].winGauge.progress).toBe(5);
  });

  it('is not applied to ward, cleanse, or debuff-application', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'corrupted', magnitude: 1, duration: 3 }, 'malware', state, 1); // applies to side 0
    const withWard = resolvePayload({ kind: 'ward', amount: 6 }, 'encryption', state, 0);
    expect(withWard.sides[0].wardShield).toBe(6); // unaffected by corruption
  });
});

describe("Choked -- temporary gauge-threshold bump", () => {
  it("raises the target's gauge threshold immediately on application", () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'debuff', debuffId: 'choked', magnitude: 5, duration: 2 }, 'malware', state, 0);
    expect(result.sides[1].gauge.threshold).toBe(17);
  });

  it('does not touch the threshold for a non-choked debuff', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'debuff', debuffId: 'throttled', magnitude: 5, duration: 2 }, 'malware', state, 0);
    expect(result.sides[1].gauge.threshold).toBe(12);
  });

  it('reverts the bump when the debuff expires naturally (tickDebuffDurations)', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'choked', magnitude: 5, duration: 2 }, 'malware', state, 0);
    expect(state.sides[1].gauge.threshold).toBe(17);

    state = tickDebuffDurations(state); // duration 2 -> 1, still active
    expect(state.sides[1].gauge.threshold).toBe(17);
    expect(state.sides[1].debuffs).toHaveLength(1);

    state = tickDebuffDurations(state); // duration 1 -> 0, expires and reverts
    expect(state.sides[1].gauge.threshold).toBe(12);
    expect(state.sides[1].debuffs).toEqual([]);
  });

  it('reverts the bump when cleansed early, before natural expiry', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'choked', magnitude: 5, duration: 10 }, 'malware', state, 0);
    expect(state.sides[1].gauge.threshold).toBe(17);

    const cleansed = resolvePayload({ kind: 'cleanse', debuffId: 'choked' }, 'encryption', state, 1);
    expect(cleansed.sides[1].gauge.threshold).toBe(12);
    expect(cleansed.sides[1].debuffs).toEqual([]);
  });

  it('cleansing a non-choked debuff does not touch the threshold', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'corrupted', magnitude: 5, duration: 10 }, 'malware', state, 0);
    const cleansed = resolvePayload({ kind: 'cleanse', debuffId: 'corrupted' }, 'encryption', state, 1);
    expect(cleansed.sides[1].gauge.threshold).toBe(12);
  });

  it("floors the reversal at MIN_INITIATIVE_THRESHOLD (natural expiry) -- the session 28 real-hang regression: Haste lowering the same threshold in between must not let Choked's revert push it to 0 or below", () => {
    let state = createCombatState([], [], [4, 4]);
    // Choked raises 4 -> 9.
    state = resolvePayload({ kind: 'debuff', debuffId: 'choked', magnitude: 5, duration: 2 }, 'malware', state, 0);
    expect(state.sides[1].gauge.threshold).toBe(9);
    // Haste (ownGaugeThreshold) then lowers side 1's own threshold by 8,
    // floored at 1 -- exactly the real Ghost in the Machine/Blackhat
    // sequence (Botnet's Choked, then DNS Poisoning's Haste).
    state = resolvePayload({ kind: 'instantManipulation', target: 'ownGaugeThreshold', amount: 8 }, 'root', state, 1);
    expect(state.sides[1].gauge.threshold).toBe(1);
    // Choked's own naive reversal (threshold - 5) would land on -4
    // without the floor -- and a threshold at or below 0 hangs
    // gauges.ts's addPoints forever the next time any points are scored.
    state = tickDebuffDurations(state);
    state = tickDebuffDurations(state); // duration 2 -> 1 -> 0, expires
    expect(state.sides[1].gauge.threshold).toBe(1);
    expect(state.sides[1].gauge.threshold).toBeGreaterThan(0);
  });

  it('floors the reversal at MIN_INITIATIVE_THRESHOLD (early cleanse) -- same regression, the cleanse path', () => {
    let state = createCombatState([], [], [4, 4]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'choked', magnitude: 5, duration: 10 }, 'malware', state, 0);
    state = resolvePayload({ kind: 'instantManipulation', target: 'ownGaugeThreshold', amount: 8 }, 'root', state, 1);
    expect(state.sides[1].gauge.threshold).toBe(1);
    const cleansed = resolvePayload({ kind: 'cleanse', debuffId: 'choked' }, 'encryption', state, 1);
    expect(cleansed.sides[1].gauge.threshold).toBe(1);
    expect(cleansed.sides[1].gauge.threshold).toBeGreaterThan(0);
  });
});

describe('instantManipulation -- enemyGaugeThreshold target', () => {
  it("permanently raises the target's gauge threshold, no duration/expiry", () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload(
      { kind: 'instantManipulation', target: 'enemyGaugeThreshold', amount: 8 },
      'root',
      state,
      0,
    );
    expect(result.sides[1].gauge.threshold).toBe(20);
    expect(result.sides[1].debuffs).toEqual([]); // not a debuff -- nothing to expire or cleanse
  });

  it('is reduced by Corrupted like any other instantManipulation amount', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'corrupted', magnitude: 1, duration: 3 }, 'malware', state, 1); // applies to side 0
    const result = resolvePayload({ kind: 'instantManipulation', target: 'enemyGaugeThreshold', amount: 8 }, 'root', state, 0);
    expect(result.sides[1].gauge.threshold).toBe(16); // 12 + 4 (halved)
  });
});

describe('instantManipulation -- ownGauge/ownGaugeThreshold targets (haste, session 24)', () => {
  it("ownGauge adds directly to the caster's own gauge progress, never the target's", () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'instantManipulation', target: 'ownGauge', amount: 5 }, 'root', state, 0);
    expect(result.sides[0].gauge.progress).toBe(5);
    expect(result.sides[1].gauge.progress).toBe(0);
  });

  it("ownGauge can push progress past threshold without clamping -- the overflow is left for the next natural addPoints to carry", () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'instantManipulation', target: 'ownGauge', amount: 20 }, 'root', state, 0);
    expect(result.sides[0].gauge.progress).toBe(20); // uncapped, not wrapped/floored here
  });

  it("ownGaugeThreshold permanently lowers the caster's own gauge threshold", () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'instantManipulation', target: 'ownGaugeThreshold', amount: 5 }, 'root', state, 0);
    expect(result.sides[0].gauge.threshold).toBe(7);
    expect(result.sides[1].gauge.threshold).toBe(12); // untouched
  });

  it('ownGaugeThreshold is floored so it can never reach 0 or below', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'instantManipulation', target: 'ownGaugeThreshold', amount: 500 }, 'root', state, 0);
    expect(result.sides[0].gauge.threshold).toBeGreaterThan(0);
  });

  it('both haste targets are reduced by Corrupted like any other instantManipulation amount', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'corrupted', magnitude: 1, duration: 3 }, 'malware', state, 1); // applies to side 0
    const result = resolvePayload({ kind: 'instantManipulation', target: 'ownGauge', amount: 8 }, 'root', state, 0);
    expect(result.sides[0].gauge.progress).toBe(4); // 8 halved
  });
});

describe('tickDebuffDurations', () => {
  it('decrements remainingDuration and removes expired debuffs', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'debuff', debuffId: 'corrupted', magnitude: 1, duration: 2 }, 'malware', state, 0);
    state = tickDebuffDurations(state);
    expect(state.sides[1].debuffs).toEqual([{ debuffId: 'corrupted', magnitude: 1, remainingDuration: 1 }]);
    state = tickDebuffDurations(state);
    expect(state.sides[1].debuffs).toEqual([]);
  });

  it('is a no-op with no active debuffs', () => {
    const state = createCombatState([], [], [12, 12]);
    expect(tickDebuffDurations(state)).toEqual(state);
  });
});

describe('instantManipulation -- suitTally target', () => {
  it("boosts every suitTally Accumulator on the caster's own side, regardless of watched suit", () => {
    const watchesSpades = definition('a', { kind: 'accumulator', metric: 'suitTally', suit: 0, threshold: 5 }, { kind: 'directBurst', amount: 1 });
    const watchesHearts = definition('b', { kind: 'accumulator', metric: 'suitTally', suit: 1, threshold: 5 }, { kind: 'directBurst', amount: 1 });
    const state = createCombatState([watchesSpades, watchesHearts], [], [12, 12]);
    const result = resolvePayload({ kind: 'instantManipulation', target: 'suitTally', amount: 3 }, 'root', state, 0);
    expect(result.sides[0].loadout[0].state.accumulatedProgress).toBe(3);
    expect(result.sides[0].loadout[1].state.accumulatedProgress).toBe(3);
  });

  it('does not touch a non-suitTally accumulator or the enemy side', () => {
    const points = definition('a', { kind: 'accumulator', metric: 'points', threshold: 5 }, { kind: 'directBurst', amount: 1 });
    const enemyWatcher = definition('b', { kind: 'accumulator', metric: 'suitTally', suit: 0, threshold: 5 }, { kind: 'directBurst', amount: 1 });
    const state = createCombatState([points], [enemyWatcher], [12, 12]);
    const result = resolvePayload({ kind: 'instantManipulation', target: 'suitTally', amount: 3 }, 'root', state, 0);
    expect(result.sides[0].loadout[0].state.accumulatedProgress).toBe(0);
    expect(result.sides[1].loadout[0].state.accumulatedProgress).toBe(0);
  });

  it('marks the subroutine ready once the boost crosses the threshold', () => {
    const watcher = definition('a', { kind: 'accumulator', metric: 'suitTally', suit: 0, threshold: 3 }, { kind: 'directBurst', amount: 1 });
    const state = createCombatState([watcher], [], [12, 12]);
    const result = resolvePayload({ kind: 'instantManipulation', target: 'suitTally', amount: 3 }, 'root', state, 0);
    expect(result.sides[0].loadout[0].state.ready).toBe(true);
  });
});

describe('mitigationBanked accumulator (session 28, Circuit Breaker)', () => {
  it('ward/instantCounterPush/hot each credit the caster\'s own mitigationBanked accumulator by their amount', () => {
    const watcher = definition('breaker', { kind: 'accumulator', metric: 'mitigationBanked', threshold: 100 }, { kind: 'directBurst', amount: 1 });
    const afterWard = resolvePayload({ kind: 'ward', amount: 5 }, 'neutral', createCombatState([watcher], [], [12, 12]), 0);
    expect(afterWard.sides[0].loadout[0].state.accumulatedProgress).toBe(5);

    const afterCounterPush = resolvePayload({ kind: 'instantCounterPush', amount: 5 }, 'neutral', createCombatState([watcher], [], [12, 12]), 0);
    expect(afterCounterPush.sides[0].loadout[0].state.accumulatedProgress).toBe(5);

    // hot banks its full potential (amountPerTick * duration) at cast time.
    const afterHot = resolvePayload({ kind: 'hot', amountPerTick: 3, cadence: 'castersTurnPulse', duration: 4 }, 'neutral', createCombatState([watcher], [], [12, 12]), 0);
    expect(afterHot.sides[0].loadout[0].state.accumulatedProgress).toBe(12);
  });

  it('wardCounter/drainingHot (session 40 continued) credit mitigationBanked exactly like their plain ward/hot counterparts; wardBash does not', () => {
    const watcher = definition('breaker', { kind: 'accumulator', metric: 'mitigationBanked', threshold: 100 }, { kind: 'directBurst', amount: 1 });
    const afterWardCounter = resolvePayload({ kind: 'wardCounter', amount: 5, ratio: 0.2 }, 'encryption', createCombatState([watcher], [], [12, 12]), 0);
    expect(afterWardCounter.sides[0].loadout[0].state.accumulatedProgress).toBe(5);

    const afterDrainingHot = resolvePayload(
      { kind: 'drainingHot', amountPerTick: 3, cadence: 'castersTurnPulse', duration: 4, ratio: 0.2 },
      'encryption',
      createCombatState([watcher], [], [12, 12]),
      0,
    );
    expect(afterDrainingHot.sides[0].loadout[0].state.accumulatedProgress).toBe(12); // amountPerTick * duration, same as plain hot

    // wardBash spends existing shield rather than generating new mitigation.
    let state = resolvePayload({ kind: 'ward', amount: 20 }, 'encryption', createCombatState([watcher], [], [12, 12]), 0);
    expect(state.sides[0].loadout[0].state.accumulatedProgress).toBe(20); // the plain ward cast above banked its own 20
    state = resolvePayload({ kind: 'wardBash', fraction: 0.5 }, 'encryption', state, 0);
    expect(state.sides[0].loadout[0].state.accumulatedProgress).toBe(20); // unchanged by the bash itself
  });

  it('does not credit the opponent\'s mitigationBanked accumulator, and ignores non-mitigation payloads', () => {
    const watcher = definition('breaker', { kind: 'accumulator', metric: 'mitigationBanked', threshold: 100 }, { kind: 'directBurst', amount: 1 });
    const state = createCombatState([], [watcher], [12, 12]);
    const afterWard = resolvePayload({ kind: 'ward', amount: 5 }, 'neutral', state, 0);
    expect(afterWard.sides[1].loadout[0].state.accumulatedProgress).toBe(0);

    const afterBurst = resolvePayload({ kind: 'directBurst', amount: 5 }, 'exploit', createCombatState([watcher], [], [12, 12]), 0);
    expect(afterBurst.sides[0].loadout[0].state.accumulatedProgress).toBe(0);
  });

  it('marks Circuit Breaker ready and fires it once enough mitigation is banked', () => {
    const circuitBreaker = NEUTRAL_RARES.find((s) => s.id === 'circuit-breaker')!;
    let state = createCombatState([circuitBreaker], [], [12, 12]);
    state = resolvePayload({ kind: 'ward', amount: 6 }, 'encryption', state, 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(false);
    state = resolvePayload({ kind: 'instantCounterPush', amount: 6 }, 'encryption', state, 0);
    expect(state.sides[0].loadout[0].state.ready).toBe(true);
  });

  it("fires Breacher's Lock Fatigue (session 29) once Session Lock's own suppression casts bank enough mitigation", () => {
    const sessionLock = BREACHER_LOADOUT.find((s) => s.id === 'session-lock')!;
    const lockFatigue = BREACHER_LOADOUT.find((s) => s.id === 'lock-fatigue')!;
    let state = createCombatState([sessionLock, lockFatigue], [], [12, 12]);
    // 2 Session Lock casts (amount 7 each = 14) aren't enough on their own
    // (threshold 20, balance pass session 38 follow-up -- was 28).
    for (let i = 0; i < 2; i++) state = resolvePayload(sessionLock.payload, sessionLock.archetype, state, 0);
    expect(state.sides[0].loadout[1].state.ready).toBe(false);
    // A 3rd cast crosses the threshold and fires a real, opponent-independent credit.
    state = resolvePayload(sessionLock.payload, sessionLock.archetype, state, 0);
    expect(state.sides[0].loadout[1].state.ready).toBe(true);
  });
});

describe('cribbageLayerManipulation / consumePendingCribbageManipulation', () => {
  it('registers a pending entry instead of resolving immediately', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'cribbageLayerManipulation', action: 'forceDiscard' }, 'root', state, 0);
    expect(result.pendingCribbageManipulation).toEqual([{ casterSide: 0, action: 'forceDiscard', suit: undefined }]);
  });

  it("forceDiscard resolves to forcing the *target*, not the caster", () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'cribbageLayerManipulation', action: 'forceDiscard' }, 'root', state, 0);
    const { forHand } = consumePendingCribbageManipulation(state, 0);
    expect(forHand.forcedDiscardSide).toBe(1);
  });

  it('skewCut biases toward a Jack when the caster is dealing, away otherwise', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'cribbageLayerManipulation', action: 'skewCut' }, 'root', state, 0);
    expect(consumePendingCribbageManipulation(state, 0).forHand.cutBias).toBe('towardJack');
    expect(consumePendingCribbageManipulation(state, 1).forHand.cutBias).toBe('awayFromJack');
  });

  it('markSuit applies its tally credit immediately and clears the pending list', () => {
    const watcher = definition('a', { kind: 'accumulator', metric: 'suitTally', suit: 2, threshold: 1 }, { kind: 'directBurst', amount: 1 });
    let state = createCombatState([watcher], [], [12, 12]);
    state = resolvePayload({ kind: 'cribbageLayerManipulation', action: 'markSuit', suit: 2 }, 'root', state, 0);
    expect(state.pendingCribbageManipulation).toHaveLength(1);

    const { combatState: result, forHand } = consumePendingCribbageManipulation(state, 0);
    expect(result.sides[0].loadout[0].state.ready).toBe(true);
    expect(result.pendingCribbageManipulation).toEqual([]);
    expect(forHand.forcedDiscardSide).toBeUndefined();
    expect(forHand.cutBias).toBeUndefined();
  });

  it('peekCrib is consumed with no effect on state or forHand', () => {
    let state = createCombatState([], [], [12, 12]);
    state = resolvePayload({ kind: 'cribbageLayerManipulation', action: 'peekCrib' }, 'root', state, 0);
    const { combatState: result, forHand } = consumePendingCribbageManipulation(state, 0);
    expect(result.pendingCribbageManipulation).toEqual([]);
    expect(forHand).toEqual({});
  });

  it('is a no-op with nothing pending', () => {
    const state = createCombatState([], [], [12, 12]);
    const { combatState: result, forHand } = consumePendingCribbageManipulation(state, 0);
    expect(result).toEqual(state);
    expect(forHand).toEqual({});
  });
});

describe('starting passives (Phase 4 checkpoint B, retranslated for the Breach/Containment redesign)', () => {
  describe('Foothold (Breacher)', () => {
    it("adds a symmetric bonus the first time the player's own gauge reaches 50% of its threshold", () => {
      const before = createCombatState([], [], [12, 12], 'breacher', [100, 100]);
      const state = {
        ...before,
        sides: [
          { ...before.sides[0], winGauge: { progress: 50, threshold: 100 } },
          { ...before.sides[1], winGauge: { progress: 30, threshold: 100 } }, // enemy has some banked progress to reduce
        ] as typeof before.sides,
      };
      const result = applyFootholdBonus(state);
      expect(result.sides[0].winGauge.progress).toBe(60); // +10 (10% of threshold)
      expect(result.sides[1].winGauge.progress).toBe(20); // enemy's gauge reduced by the same amount
      expect(result.passiveTriggered).toBe(true);
    });

    it('does not trigger before reaching 50%', () => {
      const before = createCombatState([], [], [12, 12], 'breacher', [100, 100]);
      const state = { ...before, sides: [{ ...before.sides[0], winGauge: { progress: 49, threshold: 100 } }, before.sides[1]] as typeof before.sides };
      const result = applyFootholdBonus(state);
      expect(result.sides[0].winGauge.progress).toBe(49);
      expect(result.passiveTriggered).toBe(false);
    });

    it('does not re-trigger once already consumed', () => {
      const before = createCombatState([], [], [12, 12], 'breacher', [100, 100]);
      const at50 = { ...before, sides: [{ ...before.sides[0], winGauge: { progress: 50, threshold: 100 } }, before.sides[1]] as typeof before.sides };
      const first = applyFootholdBonus(at50);
      const second = applyFootholdBonus(first);
      expect(second).toEqual(first); // no further change
    });

    it('does not trigger for a class other than breacher', () => {
      const before = createCombatState([], [], [12, 12], 'blackhat', [100, 100]);
      const state = { ...before, sides: [{ ...before.sides[0], winGauge: { progress: 50, threshold: 100 } }, before.sides[1]] as typeof before.sides };
      expect(applyFootholdBonus(state)).toEqual(state);
    });
  });

  describe('Zero Day (Blackhat)', () => {
    it('waives Heat cost for the first Heat-costing Exploit fire', () => {
      const state = createCombatState([], [], [12, 12], 'blackhat');
      const result = resolvePayload({ kind: 'riskRewardBurst', amount: 5 }, 'exploit', state, 0, undefined, traceCostingDefinition(4));
      expect(result.sides[0].trace).toBe(0);
      expect(result.passiveTriggered).toBe(true);
    });

    it('costs Heat normally on the second Heat-costing Exploit fire', () => {
      let state = createCombatState([], [], [12, 12], 'blackhat');
      state = resolvePayload({ kind: 'riskRewardBurst', amount: 5 }, 'exploit', state, 0, undefined, traceCostingDefinition(4));
      state = resolvePayload({ kind: 'riskRewardBurst', amount: 5 }, 'exploit', state, 0, undefined, traceCostingDefinition(4));
      expect(state.sides[0].trace).toBe(4);
    });

    it('does not consume the passive on a zero-cost fire', () => {
      const state = createCombatState([], [], [12, 12], 'blackhat');
      const result = resolvePayload({ kind: 'riskRewardBurst', amount: 5 }, 'exploit', state, 0);
      expect(result.passiveTriggered).toBe(false);
    });

    it('does not apply for a different class', () => {
      const state = createCombatState([], [], [12, 12], 'breacher');
      const result = resolvePayload({ kind: 'riskRewardBurst', amount: 5 }, 'exploit', state, 0, undefined, traceCostingDefinition(4));
      expect(result.sides[0].trace).toBe(4);
    });
  });

  describe('Sleeper Cell (Saboteur, reworked session 25)', () => {
    const rootPiece = () =>
      definition('root-piece', { kind: 'always' }, { kind: 'instantManipulation', target: 'enemyGauge', amount: 1 }, { archetype: 'root' });

    it('advances the first Root subroutine and credits win gauge when a Malware debuff is applied -- persistent, not gated by passiveTriggered', () => {
      const state = createCombatState([rootPiece()], [], [12, 12], 'saboteur');
      const result = resolvePayload({ kind: 'debuff', debuffId: 'throttled', magnitude: 2, duration: 2 }, 'malware', state, 0);
      expect(result.sides[0].loadout[0].state.accumulatedProgress).toBe(3);
      expect(result.sides[0].winGauge.progress).toBe(2); // SLEEPER_CELL_CREDIT_AMOUNT (4 -> 2, session 39 balance fix)
      expect(result.passiveTriggered).toBe(false); // no longer one-shot
    });

    it('fires again on a second qualifying debuff -- persistence, the actual fix for the old one-shot gate', () => {
      let state = createCombatState([rootPiece()], [], [12, 12], 'saboteur');
      state = resolvePayload({ kind: 'debuff', debuffId: 'throttled', magnitude: 2, duration: 2 }, 'malware', state, 0);
      state = resolvePayload({ kind: 'debuff', debuffId: 'throttled', magnitude: 2, duration: 2 }, 'malware', state, 0);
      expect(state.sides[0].loadout[0].state.accumulatedProgress).toBe(6);
      expect(state.sides[0].winGauge.progress).toBe(4); // 2 x SLEEPER_CELL_CREDIT_AMOUNT (2)
    });

    it("fires from the caster's own Malware DoT tick -- the reachability fix (Silent Worm is a DoT, not a debuff, so this is what makes Sleeper Cell reachable turn one)", () => {
      const dotPiece = definition(
        'dot-piece',
        { kind: 'always' },
        { kind: 'dot', amountPerTick: 3, cadence: 'castersTurnPulse', duration: 5 },
        { archetype: 'malware' },
      );
      let state = createCombatState([dotPiece, rootPiece()], [], [12, 12], 'saboteur');
      state = resolvePayload(dotPiece.payload, 'malware', state, 0);
      const result = tickCastersTurnPulse(state, 0);
      expect(result.sides[0].winGauge.progress).toBe(5); // 3 (the DoT itself) + 2 (Sleeper Cell credit)
      expect(result.sides[0].loadout[1].state.accumulatedProgress).toBe(3); // the Root piece, index 1
    });

    it('does not fire from a HoT tick (Encryption, not Malware)', () => {
      const hotPiece = definition(
        'hot-piece',
        { kind: 'always' },
        { kind: 'hot', amountPerTick: 3, cadence: 'castersTurnPulse', duration: 5 },
        { archetype: 'encryption' },
      );
      let state = createCombatState([hotPiece], [rootPiece()], [12, 12], 'saboteur');
      state = resolvePayload(hotPiece.payload, 'encryption', state, 0);
      const result = tickCastersTurnPulse(state, 0);
      expect(result.sides[0].winGauge.progress).toBe(0); // HoT itself only reduces the opponent, credits nothing to the caster
    });

    it('does not trigger for a debuff cast by a non-Malware subroutine', () => {
      const state = createCombatState([rootPiece()], [], [12, 12], 'saboteur');
      const result = resolvePayload({ kind: 'debuff', debuffId: 'throttled', magnitude: 2, duration: 2 }, 'root', state, 0);
      expect(result.sides[0].loadout[0].state.accumulatedProgress).toBe(0);
      expect(result.sides[0].winGauge.progress).toBe(0);
    });

    it("does not trigger for the enemy's own debuff", () => {
      const state = createCombatState([], [rootPiece()], [12, 12], 'saboteur');
      const result = resolvePayload({ kind: 'debuff', debuffId: 'throttled', magnitude: 2, duration: 2 }, 'malware', state, 1);
      expect(result.sides[1].loadout[0].state.accumulatedProgress).toBe(0);
      expect(result.sides[1].winGauge.progress).toBe(0);
    });

    it('does not apply for a different class', () => {
      const state = createCombatState([rootPiece()], [], [12, 12], 'breacher');
      const result = resolvePayload({ kind: 'debuff', debuffId: 'throttled', magnitude: 2, duration: 2 }, 'malware', state, 0);
      expect(result.sides[0].loadout[0].state.accumulatedProgress).toBe(0);
      expect(result.sides[0].winGauge.progress).toBe(0);
    });
  });

  describe('Primed (Operator, reworked session 25)', () => {
    it("eases an Accumulator-triggered Exploit subroutine's threshold and boosts its payload magnitude every time a Root subroutine fires -- no longer one-shot", () => {
      const exploitPiece = definition(
        'exploit-piece',
        { kind: 'accumulator', metric: 'points', threshold: 10 },
        { kind: 'directBurst', amount: 5 },
        { archetype: 'exploit' },
      );
      const state = createCombatState([exploitPiece], [], [12, 12], 'operator');
      const result = resolvePayload({ kind: 'instantManipulation', target: 'enemyGauge', amount: 1 }, 'root', state, 0);
      expect(result.sides[0].loadout[0].definition.trigger).toEqual({ kind: 'accumulator', metric: 'points', threshold: 8 });
      expect(result.sides[0].loadout[0].definition.payload).toEqual({ kind: 'directBurst', amount: 6.5 }); // + PRIMED_MAGNITUDE_BONUS (3 -> 1.5, session 39)
      expect(result.passiveTriggered).toBe(false); // no longer one-shot
    });

    it('fires again on a second Root subroutine -- persistence, stacking further ease and magnitude', () => {
      const exploitPiece = definition(
        'exploit-piece',
        { kind: 'accumulator', metric: 'points', threshold: 10 },
        { kind: 'directBurst', amount: 5 },
        { archetype: 'exploit' },
      );
      let state = createCombatState([exploitPiece], [], [12, 12], 'operator');
      state = resolvePayload({ kind: 'instantManipulation', target: 'enemyGauge', amount: 1 }, 'root', state, 0);
      state = resolvePayload({ kind: 'instantManipulation', target: 'enemyGauge', amount: 1 }, 'root', state, 0);
      expect(state.sides[0].loadout[0].definition.trigger).toEqual({ kind: 'accumulator', metric: 'points', threshold: 6 });
      expect(state.sides[0].loadout[0].definition.payload).toEqual({ kind: 'directBurst', amount: 8 }); // 2 x PRIMED_MAGNITUDE_BONUS (1.5)
    });

    it('reduces bankTarget for an Occurrence: threshold Exploit subroutine', () => {
      const exploitPiece = definition(
        'exploit-piece',
        { kind: 'occurrence', category: 'pair', variation: 'threshold', bankTarget: 5 },
        { kind: 'directBurst', amount: 5 },
        { archetype: 'exploit' },
      );
      const state = createCombatState([exploitPiece], [], [12, 12], 'operator');
      const result = resolvePayload({ kind: 'instantManipulation', target: 'enemyGauge', amount: 1 }, 'root', state, 0);
      expect(result.sides[0].loadout[0].definition.trigger).toEqual({
        kind: 'occurrence',
        category: 'pair',
        variation: 'threshold',
        bankTarget: 3,
      });
    });

    it('does not touch cap for an Occurrence: scaling Exploit subroutine -- it already fires unconditionally, nothing to ease -- but still boosts magnitude', () => {
      const exploitPiece = definition(
        'exploit-piece',
        { kind: 'occurrence', category: 'flush', variation: 'scaling', cap: 4 },
        { kind: 'directBurst', amount: 5 },
        { archetype: 'exploit' },
      );
      const state = createCombatState([exploitPiece], [], [12, 12], 'operator');
      const result = resolvePayload({ kind: 'instantManipulation', target: 'enemyGauge', amount: 1 }, 'root', state, 0);
      expect(result.sides[0].loadout[0].definition.trigger).toEqual({ kind: 'occurrence', category: 'flush', variation: 'scaling', cap: 4 });
      expect(result.sides[0].loadout[0].definition.payload).toEqual({ kind: 'directBurst', amount: 6.5 }); // + PRIMED_MAGNITUDE_BONUS (1.5)
    });

    it('eases a Self-state traceAbove Exploit subroutine (lowers the bar)', () => {
      const exploitPiece = definition(
        'exploit-piece',
        { kind: 'selfState', condition: 'traceAbove', value: 10 },
        { kind: 'directBurst', amount: 5 },
        { archetype: 'exploit' },
      );
      const state = createCombatState([exploitPiece], [], [12, 12], 'operator');
      const result = resolvePayload({ kind: 'instantManipulation', target: 'enemyGauge', amount: 1 }, 'root', state, 0);
      expect(result.sides[0].loadout[0].definition.trigger).toEqual({ kind: 'selfState', condition: 'traceAbove', value: 8 });
    });

    it('eases a Self-state traceBelow Exploit subroutine (raises the bar)', () => {
      const exploitPiece = definition(
        'exploit-piece',
        { kind: 'selfState', condition: 'traceBelow', value: 10 },
        { kind: 'directBurst', amount: 5 },
        { archetype: 'exploit' },
      );
      const state = createCombatState([exploitPiece], [], [12, 12], 'operator');
      const result = resolvePayload({ kind: 'instantManipulation', target: 'enemyGauge', amount: 1 }, 'root', state, 0);
      expect(result.sides[0].loadout[0].definition.trigger).toEqual({ kind: 'selfState', condition: 'traceBelow', value: 12 });
    });

    it('still boosts payload magnitude even when the trigger has no reducible knob', () => {
      const exploitPiece = definition('exploit-piece', { kind: 'always' }, { kind: 'directBurst', amount: 5 }, { archetype: 'exploit' });
      const state = createCombatState([exploitPiece], [], [12, 12], 'operator');
      const result = resolvePayload({ kind: 'instantManipulation', target: 'enemyGauge', amount: 1 }, 'root', state, 0);
      expect(result.sides[0].loadout[0].definition.trigger).toEqual({ kind: 'always' });
      expect(result.sides[0].loadout[0].definition.payload).toEqual({ kind: 'directBurst', amount: 6.5 }); // + PRIMED_MAGNITUDE_BONUS (1.5)
    });

    it('leaves the payload untouched when it has no magnitude field to boost (trigger-ease still applies)', () => {
      const exploitPiece = definition(
        'exploit-piece',
        { kind: 'accumulator', metric: 'points', threshold: 10 },
        { kind: 'cleanse' },
        { archetype: 'exploit' },
      );
      const state = createCombatState([exploitPiece], [], [12, 12], 'operator');
      const result = resolvePayload({ kind: 'instantManipulation', target: 'enemyGauge', amount: 1 }, 'root', state, 0);
      expect(result.sides[0].loadout[0].definition.payload).toEqual({ kind: 'cleanse' });
      expect(result.sides[0].loadout[0].definition.trigger).toEqual({ kind: 'accumulator', metric: 'points', threshold: 8 });
    });

    it('does not trigger for a non-Root archetype fire', () => {
      const exploitPiece = definition(
        'exploit-piece',
        { kind: 'accumulator', metric: 'points', threshold: 10 },
        { kind: 'directBurst', amount: 5 },
        { archetype: 'exploit' },
      );
      const state = createCombatState([exploitPiece], [], [12, 12], 'operator');
      const result = resolvePayload({ kind: 'directBurst', amount: 3 }, 'exploit', state, 0);
      expect(result.sides[0].loadout[0].definition.trigger).toEqual({ kind: 'accumulator', metric: 'points', threshold: 10 });
      expect(result.sides[0].loadout[0].definition.payload).toEqual({ kind: 'directBurst', amount: 5 });
    });
  });

  describe('Feedback Loop (Warden, redesigned session 39 -- reciprocal HoT/DoT amplification, a flat per-tick step)', () => {
    const hotPiece = definition(
      'hot-piece',
      { kind: 'always' },
      { kind: 'hot', amountPerTick: 3, cadence: 'castersTurnPulse', duration: 5 },
      { archetype: 'encryption' },
    );
    const dotPiece = definition(
      'dot-piece',
      { kind: 'always' },
      { kind: 'dot', amountPerTick: 4, cadence: 'castersTurnPulse', duration: 5 },
      { archetype: 'malware' },
    );

    it("a lone HoT tick reduces the opponent's gauge as normal, but credits nothing to the caster on its own -- it only queues a bonus for the caster's next DoT tick", () => {
      let state = createCombatState([], [], [12, 12], 'warden');
      state = resolvePayload({ kind: 'directBurst', amount: 50 }, 'exploit', state, 1); // enemy banks 50
      state = resolvePayload(hotPiece.payload, 'encryption', state, 0);
      const result = tickCastersTurnPulse(state, 0);
      expect(result.sides[1].winGauge.progress).toBe(47); // 50 - 3 (HoT), unaffected by the redesign
      expect(result.sides[0].winGauge.progress).toBe(0); // no self-credit -- nothing has consumed the queued bonus yet
    });

    it('a lone DoT tick credits its own base amount only -- no bonus queued yet either direction', () => {
      let state = createCombatState([], [], [12, 12], 'warden');
      state = resolvePayload(dotPiece.payload, 'malware', state, 0);
      const result = tickCastersTurnPulse(state, 0);
      expect(result.sides[0].winGauge.progress).toBe(4); // just the DoT's own amountPerTick
    });

    it("within one tick pass, DoT fires before HoT (processTickList's own dots-before-hots order) -- so the DoT ticks unboosted first, then queues a flat bonus that immediately boosts that same pass's HoT tick", () => {
      let state = createCombatState([], [], [12, 12], 'warden');
      state = resolvePayload({ kind: 'directBurst', amount: 50 }, 'exploit', state, 1); // enemy banks 50
      state = resolvePayload(hotPiece.payload, 'encryption', state, 0);
      state = resolvePayload(dotPiece.payload, 'malware', state, 0);
      state = tickCastersTurnPulse(state, 0);
      expect(state.sides[0].winGauge.progress).toBe(4); // just the DoT's own base amount -- nothing was queued yet when it fired
      // 50 - 3.15: HoT's base 3, boosted by the flat FEEDBACK_LOOP_AMPLIFICATION_AMOUNT
      // (0.15) the DoT just queued -- toBeCloseTo, not toBe, since 0.15 isn't exactly
      // representable in floating point.
      expect(state.sides[1].winGauge.progress).toBeCloseTo(46.85, 10);
    });

    it('a second pass then shows the DoT tick benefiting from the bonus the first pass\'s HoT tick queued -- the reciprocal loop actually compounding, not just a one-time interaction', () => {
      let state = createCombatState([], [], [12, 12], 'warden');
      state = resolvePayload({ kind: 'directBurst', amount: 50 }, 'exploit', state, 1);
      state = resolvePayload(hotPiece.payload, 'encryption', state, 0);
      state = resolvePayload(dotPiece.payload, 'malware', state, 0);
      state = tickCastersTurnPulse(state, 0); // pass 1: DoT +4 (unboosted), HoT denies 3.15 (3 base + 0.15 flat queued), queues 0.15 flat for the next DoT
      state = tickCastersTurnPulse(state, 0); // pass 2: DoT +4.15 (4 base + 0.15 queued)
      expect(state.sides[0].winGauge.progress).toBeCloseTo(8.15, 10); // 4 (pass 1) + 4.15 (pass 2)
    });

    it('does not apply for a class other than Warden', () => {
      let state = createCombatState([], [], [12, 12]); // no classId
      state = resolvePayload(hotPiece.payload, 'encryption', state, 0);
      state = resolvePayload(dotPiece.payload, 'malware', state, 0);
      state = tickCastersTurnPulse(state, 0);
      state = tickCastersTurnPulse(state, 0);
      expect(state.sides[0].winGauge.progress).toBe(8); // 2 DoT ticks at their own base amount, never boosted
    });
  });

  describe('Return to Sender (Ghost, reworked session 25)', () => {
    it("credits Ghost's own gauge proportionally whenever the shield absorbs a hit", () => {
      let state = createCombatState([], [], [12, 12], 'ghost');
      state = resolvePayload({ kind: 'ward', amount: 20 }, 'encryption', state, 0); // Ghost shields up
      const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1); // enemy attacks, fully absorbed
      expect(result.sides[0].wardShield).toBe(10); // 20 - 10 absorbed
      expect(result.sides[1].winGauge.progress).toBe(0); // attacker denied credit
      expect(result.sides[0].winGauge.progress).toBe(2.5); // 10 absorbed * 0.25 ratio (0.5 -> 0.25, session 39)
    });

    it('credits proportionally to partial absorption too, not just a full break', () => {
      let state = createCombatState([], [], [12, 12], 'ghost');
      state = resolvePayload({ kind: 'ward', amount: 6 }, 'encryption', state, 0);
      const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1); // shield only partially covers it
      expect(result.sides[0].wardShield).toBe(0); // fully consumed
      expect(result.sides[1].winGauge.progress).toBe(4); // 10 - 6 got through
      expect(result.sides[0].winGauge.progress).toBe(1.5); // 6 absorbed * 0.25
    });

    it('does not credit for a class other than Ghost', () => {
      let state = createCombatState([], [], [12, 12]);
      state = resolvePayload({ kind: 'ward', amount: 20 }, 'encryption', state, 0);
      const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1);
      expect(result.sides[0].winGauge.progress).toBe(0); // no bonus
    });

    it("does not credit when Ghost's shield doesn't own the absorption (enemy's own shield absorbing Ghost's hit)", () => {
      let state = createCombatState([], [], [12, 12], 'ghost');
      state = resolvePayload({ kind: 'ward', amount: 20 }, 'encryption', state, 1); // enemy shields, not Ghost
      const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 0); // Ghost attacks into it
      expect(result.sides[0].winGauge.progress).toBe(0); // Ghost's own hit got absorbed, no credit for Ghost
    });

    it("credits Ghost's own gauge from instantCounterPush alone, with zero Ward activity -- the reachability fix (Null Session, Ghost's actual starting piece, is instantCounterPush, not Ward)", () => {
      const state = createCombatState([], [], [12, 12], 'ghost');
      const result = resolvePayload({ kind: 'instantCounterPush', amount: 10 }, 'encryption', state, 0);
      expect(result.sides[1].winGauge.progress).toBe(0); // enemy's gauge reduced
      expect(result.sides[0].wardShield).toBe(0); // confirms no Ward involvement at all
      expect(result.sides[0].winGauge.progress).toBe(2.5); // 10 * 0.25 ratio, credited to Ghost (0.5 -> 0.25, session 39)
    });

    it('does not credit instantCounterPush for a class other than Ghost', () => {
      const state = createCombatState([], [], [12, 12]);
      const result = resolvePayload({ kind: 'instantCounterPush', amount: 10 }, 'encryption', state, 0);
      expect(result.sides[0].winGauge.progress).toBe(0);
    });

    it("credits Ghost's own gauge from a HoT tick -- Ghost's own kit has no HoT piece today, but this is what makes one pay off once acquired", () => {
      const hotPiece = definition(
        'hot-piece',
        { kind: 'always' },
        { kind: 'hot', amountPerTick: 4, cadence: 'castersTurnPulse', duration: 5 },
        { archetype: 'encryption' },
      );
      let state = createCombatState([hotPiece], [], [12, 12], 'ghost');
      state = resolvePayload(hotPiece.payload, 'encryption', state, 0);
      const result = tickCastersTurnPulse(state, 0);
      expect(result.sides[1].winGauge.progress).toBe(0); // enemy's gauge reduced by the HoT
      expect(result.sides[0].winGauge.progress).toBe(1); // 4 * 0.25 ratio (0.5 -> 0.25, session 39)
    });

    it('does not credit a DoT tick (Malware, not the HoT this hook targets)', () => {
      const dotPiece = definition(
        'dot-piece',
        { kind: 'always' },
        { kind: 'dot', amountPerTick: 4, cadence: 'castersTurnPulse', duration: 5 },
        { archetype: 'malware' },
      );
      let state = createCombatState([dotPiece], [], [12, 12], 'ghost');
      state = resolvePayload(dotPiece.payload, 'malware', state, 0);
      const result = tickCastersTurnPulse(state, 0);
      expect(result.sides[0].winGauge.progress).toBe(4); // just the DoT itself, no extra Return to Sender credit
    });
  });
});

describe('adjustSideWinThreshold (session 40 dynamic-hook primitive)', () => {
  it("shrinks only the targeted side's own winGauge threshold", () => {
    const state = createCombatState([], [], [12, 12], undefined, [50, 50]);
    const result = adjustSideWinThreshold(state, 0, 15, 10);
    expect(result.sides[0].winGauge.threshold).toBe(35);
    expect(result.sides[1].winGauge.threshold).toBe(50); // untouched
  });

  it('never touches progress, only threshold', () => {
    let state = createCombatState([], [], [12, 12], undefined, [50, 50]);
    state = resolvePayload({ kind: 'directBurst', amount: 20 }, 'exploit', state, 0);
    const result = adjustSideWinThreshold(state, 0, 15, 10);
    expect(result.sides[0].winGauge.progress).toBe(20); // unchanged
    expect(result.sides[0].winGauge.threshold).toBe(35);
  });

  it('floors at minThreshold, same as gauges.ts shrinkDuelThreshold', () => {
    const state = createCombatState([], [], [12, 12], undefined, [50, 50]);
    const result = adjustSideWinThreshold(state, 1, 1000, 10);
    expect(result.sides[1].winGauge.threshold).toBe(10);
    expect(result.sides[0].winGauge.threshold).toBe(50); // untouched
  });

  it('is a no-op for a non-positive amount', () => {
    const state = createCombatState([], [], [12, 12], undefined, [50, 50]);
    expect(adjustSideWinThreshold(state, 0, 0, 10)).toBe(state);
    expect(adjustSideWinThreshold(state, 0, -5, 10)).toBe(state);
  });
});

describe('Encryption offense (session 40 continued) -- wardCounter/drainingHot/wardBash', () => {
  describe('wardCounter', () => {
    it('adds to wardShield exactly like plain ward', () => {
      const state = resolvePayload({ kind: 'wardCounter', amount: 6, ratio: 0.2 }, 'encryption', createCombatState([], [], [12, 12]), 0);
      expect(state.sides[0].wardShield).toBe(6);
    });

    it('arms a credit on the next absorb, for any side (no class/Mod gating, unlike Return to Sender)', () => {
      let state = resolvePayload({ kind: 'wardCounter', amount: 20, ratio: 0.2 }, 'encryption', createCombatState([], [], [12, 12]), 0);
      const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1); // enemy attacks, fully absorbed
      expect(result.sides[0].wardShield).toBe(10); // 20 - 10 absorbed
      expect(result.sides[0].winGauge.progress).toBe(2); // 10 absorbed * 0.2 ratio
    });

    it('keeps crediting on later absorbs too -- not one-shot', () => {
      let state = resolvePayload({ kind: 'wardCounter', amount: 20, ratio: 0.5 }, 'encryption', createCombatState([], [], [12, 12]), 0);
      state = resolvePayload({ kind: 'directBurst', amount: 4 }, 'exploit', state, 1);
      state = resolvePayload({ kind: 'directBurst', amount: 4 }, 'exploit', state, 1);
      expect(state.sides[0].winGauge.progress).toBe(4); // (4 + 4) absorbed * 0.5
    });

    it("a later wardCounter's ratio overwrites the armed value, not additive", () => {
      let state = resolvePayload({ kind: 'wardCounter', amount: 10, ratio: 0.5 }, 'encryption', createCombatState([], [], [12, 12]), 0);
      state = resolvePayload({ kind: 'wardCounter', amount: 10, ratio: 0.1 }, 'encryption', state, 0);
      const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1);
      expect(result.sides[0].winGauge.progress).toBe(1); // 10 absorbed * 0.1 (the latest ratio), not 0.5
    });

    it('does not credit the side whose ward did not absorb anything', () => {
      let state = resolvePayload({ kind: 'wardCounter', amount: 20, ratio: 0.5 }, 'encryption', createCombatState([], [], [12, 12]), 1); // enemy arms its own counter
      const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 0); // side 0 attacks into it
      expect(result.sides[0].winGauge.progress).toBe(0); // side 0's hit got absorbed by side 1's ward, not side 0's own
      expect(result.sides[1].winGauge.progress).toBe(5); // 10 absorbed * 0.5, credited to side 1 (the shield owner)
    });

  });

  describe('drainingHot', () => {
    it('reduces the opponent and credits the caster on the same tick', () => {
      let state = resolvePayload({ kind: 'drainingHot', amountPerTick: 8, cadence: 'castersTurnPulse', duration: 3, ratio: 0.25 }, 'encryption', createCombatState([], [], [12, 12]), 0);
      state = resolvePayload({ kind: 'directBurst', amount: 20 }, 'exploit', state, 1); // enemy banks progress to reduce
      state = tickCastersTurnPulse(state, 0);
      expect(state.sides[1].winGauge.progress).toBe(12); // 20 - 8 reduced
      expect(state.sides[0].winGauge.progress).toBe(2); // 8 * 0.25 ratio credited to the caster
    });

    it('keeps crediting every tick, not just the first', () => {
      let state = resolvePayload({ kind: 'drainingHot', amountPerTick: 4, cadence: 'castersTurnPulse', duration: 3, ratio: 0.5 }, 'encryption', createCombatState([], [], [12, 12]), 0);
      state = tickCastersTurnPulse(state, 0);
      state = tickCastersTurnPulse(state, 0);
      expect(state.sides[0].winGauge.progress).toBe(4); // 2 ticks * (4 * 0.5)
    });

    it('a plain hot (no ratio) never credits the caster', () => {
      let state = resolvePayload({ kind: 'hot', amountPerTick: 8, cadence: 'castersTurnPulse', duration: 3 }, 'encryption', createCombatState([], [], [12, 12]), 0);
      state = tickCastersTurnPulse(state, 0);
      expect(state.sides[0].winGauge.progress).toBe(0);
    });
  });

  describe('wardBash', () => {
    it('spends the given fraction of current wardShield and credits the caster 1:1', () => {
      let state = resolvePayload({ kind: 'ward', amount: 20 }, 'encryption', createCombatState([], [], [12, 12]), 0);
      const result = resolvePayload({ kind: 'wardBash', fraction: 0.4 }, 'encryption', state, 0);
      expect(result.sides[0].wardShield).toBe(12); // 20 - (20 * 0.4)
      expect(result.sides[0].winGauge.progress).toBe(8); // 20 * 0.4
    });

    it('a fraction of 1.0 consumes the entire shield -- the "large percentage" cost falls out naturally', () => {
      let state = resolvePayload({ kind: 'ward', amount: 15 }, 'encryption', createCombatState([], [], [12, 12]), 0);
      const result = resolvePayload({ kind: 'wardBash', fraction: 1.0 }, 'encryption', state, 0);
      expect(result.sides[0].wardShield).toBe(0);
      expect(result.sides[0].winGauge.progress).toBe(15);
    });

    it('is a harmless no-op against an empty shield', () => {
      const state = createCombatState([], [], [12, 12]);
      const result = resolvePayload({ kind: 'wardBash', fraction: 0.5 }, 'encryption', state, 0);
      expect(result.sides[0].wardShield).toBe(0);
      expect(result.sides[0].winGauge.progress).toBe(0);
    });
  });
});

describe('Root offense (session 40 continued) -- sessionHijack', () => {
  it("transfers a flat amount from the opponent's win-gauge to the caster's own", () => {
    let state = resolvePayload({ kind: 'directBurst', amount: 30 }, 'exploit', createCombatState([], [], [12, 12]), 1); // enemy banks 30
    const result = resolvePayload({ kind: 'sessionHijack', amount: 10 }, 'root', state, 0);
    expect(result.sides[1].winGauge.progress).toBe(20); // 30 - 10
    expect(result.sides[0].winGauge.progress).toBe(10); // the caster gains exactly what was taken
  });

  it("caps the credit at what the opponent actually had -- can't steal more than what's there", () => {
    let state = resolvePayload({ kind: 'directBurst', amount: 4 }, 'exploit', createCombatState([], [], [12, 12]), 1); // enemy banks only 4
    const result = resolvePayload({ kind: 'sessionHijack', amount: 10 }, 'root', state, 0);
    expect(result.sides[1].winGauge.progress).toBe(0); // floored, same as reduceWinGauge alone
    expect(result.sides[0].winGauge.progress).toBe(4); // capped at what was actually there, not the full requested 10
  });

  it('against an empty opponent gauge, is a harmless no-op -- not a disguised free burst', () => {
    const state = createCombatState([], [], [12, 12]);
    const result = resolvePayload({ kind: 'sessionHijack', amount: 10 }, 'root', state, 0);
    expect(result.sides[1].winGauge.progress).toBe(0);
    expect(result.sides[0].winGauge.progress).toBe(0);
  });

  it('does not feed mitigationBanked -- offense, not defensive effort', () => {
    const watcher = definition('breaker', { kind: 'accumulator', metric: 'mitigationBanked', threshold: 100 }, { kind: 'directBurst', amount: 1 });
    let state = resolvePayload({ kind: 'directBurst', amount: 30 }, 'exploit', createCombatState([watcher], [], [12, 12]), 1);
    state = resolvePayload({ kind: 'sessionHijack', amount: 10 }, 'root', state, 0);
    expect(state.sides[0].loadout[0].state.accumulatedProgress).toBe(0);
  });
});

describe('Root offense (session 40 continued) -- rareOccurrence trigger', () => {
  it("fires on a matching category at/above minMagnitude, watchSide 'own'", () => {
    const watcher = definition('watcher', { kind: 'rareOccurrence', category: 'pair', minMagnitude: 6, watchSide: 'own' }, { kind: 'sessionHijack', amount: 5 }, { archetype: 'root' });
    let state = resolvePayload({ kind: 'directBurst', amount: 20 }, 'exploit', createCombatState([watcher], [], [12, 12]), 1); // enemy banks progress to steal
    const result = fireRareOccurrenceSubroutines(state, 0, { category: 'pair', player: 0, magnitude: 6 }); // pair royal, cast by side 0
    expect(result.events).toHaveLength(1);
    expect(result.combatState.sides[0].winGauge.progress).toBe(5);
  });

  it('does not fire below minMagnitude -- a bare pair does not count as "royal"', () => {
    const watcher = definition('watcher', { kind: 'rareOccurrence', category: 'pair', minMagnitude: 6, watchSide: 'own' }, { kind: 'sessionHijack', amount: 5 }, { archetype: 'root' });
    const state = createCombatState([watcher], [], [12, 12]);
    const result = fireRareOccurrenceSubroutines(state, 0, { category: 'pair', player: 0, magnitude: 2 }); // bare pair
    expect(result.events).toHaveLength(0);
  });

  it('does not fire for a non-matching category', () => {
    const watcher = definition('watcher', { kind: 'rareOccurrence', category: 'pair', minMagnitude: 6, watchSide: 'own' }, { kind: 'sessionHijack', amount: 5 }, { archetype: 'root' });
    const state = createCombatState([watcher], [], [12, 12]);
    const result = fireRareOccurrenceSubroutines(state, 0, { category: 'run', player: 0, magnitude: 4 });
    expect(result.events).toHaveLength(0);
  });

  it("watchSide 'own' ignores the opponent's own occurrence", () => {
    const watcher = definition('watcher', { kind: 'rareOccurrence', category: 'pair', minMagnitude: 6, watchSide: 'own' }, { kind: 'sessionHijack', amount: 5 }, { archetype: 'root' });
    const state = createCombatState([watcher], [], [12, 12]);
    const result = fireRareOccurrenceSubroutines(state, 0, { category: 'pair', player: 1, magnitude: 6 }); // the enemy's own pair royal
    expect(result.events).toHaveLength(0);
  });

  it("watchSide 'enemy' fires only for the opponent's occurrence, not the caster's own", () => {
    const watcher = definition('watcher', { kind: 'rareOccurrence', category: 'pair', minMagnitude: 6, watchSide: 'enemy' }, { kind: 'directBurst', amount: 5 }, { archetype: 'root' });
    const state = createCombatState([watcher], [], [12, 12]);
    const ownOccurrence = fireRareOccurrenceSubroutines(state, 0, { category: 'pair', player: 0, magnitude: 6 });
    expect(ownOccurrence.events).toHaveLength(0);
    const enemyOccurrence = fireRareOccurrenceSubroutines(state, 0, { category: 'pair', player: 1, magnitude: 6 });
    expect(enemyOccurrence.events).toHaveLength(1);
  });

  it("watchSide 'either' fires regardless of which side scored it", () => {
    const watcher = definition('watcher', { kind: 'rareOccurrence', category: 'pair', minMagnitude: 6, watchSide: 'either' }, { kind: 'directBurst', amount: 5 }, { archetype: 'root' });
    const state = createCombatState([watcher], [], [12, 12]);
    expect(fireRareOccurrenceSubroutines(state, 0, { category: 'pair', player: 0, magnitude: 6 }).events).toHaveLength(1);
    expect(fireRareOccurrenceSubroutines(state, 0, { category: 'pair', player: 1, magnitude: 6 }).events).toHaveLength(1);
  });

  it('respects maxFiresPerCombat', () => {
    const watcher = definition(
      'watcher',
      { kind: 'rareOccurrence', category: 'pair', minMagnitude: 6, watchSide: 'either' },
      { kind: 'directBurst', amount: 5 },
      { archetype: 'root', maxFiresPerCombat: 1 },
    );
    let state = createCombatState([watcher], [], [12, 12]);
    const first = fireRareOccurrenceSubroutines(state, 0, { category: 'pair', player: 0, magnitude: 6 });
    expect(first.events).toHaveLength(1);
    const second = fireRareOccurrenceSubroutines(first.combatState, 0, { category: 'pair', player: 0, magnitude: 6 });
    expect(second.events).toHaveLength(0);
  });

  it('never becomes ready via the normal turn-gated pipeline -- isReady/refreshTriggerReadiness never latch it', () => {
    const watcher = definition('watcher', { kind: 'rareOccurrence', category: 'pair', minMagnitude: 6, watchSide: 'either' }, { kind: 'directBurst', amount: 5 }, { archetype: 'root' });
    let state = createCombatState([watcher], [], [12, 12]);
    state = refreshTriggerReadiness(state, 0);
    const fired = fireReadySubroutines(state, 0, { isDealer: true });
    expect(fired.events).toHaveLength(0); // never fires via the normal path, regardless of readiness refresh
  });
});

function testHand(overrides: Partial<HandResult> = {}): HandResult {
  return {
    dealer: 0,
    starter: { rank: 1, suit: 0 },
    hisHeelsPoints: 0,
    peggingScores: [0, 0],
    nonDealerHandScore: 0,
    dealerHandScore: 0,
    cribScore: 0,
    scoresAfter: [0, 0],
    peggingEvents: [],
    nonDealerHandEvents: [],
    dealerHandEvents: [],
    cribEvents: [],
    ...overrides,
  };
}

describe('Root offense (session 40 continued) -- handOutcome trigger ("Crib Trap")', () => {
  it('the motivating example: gains progress when the enemy scores a crib hand greater than 4', () => {
    const trap = definition('trap', { kind: 'handOutcome', phase: 'crib', side: 'enemy', comparison: 'above', value: 4 }, { kind: 'directBurst', amount: 7 }, { archetype: 'root' });
    const state = createCombatState([trap], [], [12, 12]);
    const enemyDealtBigCrib = testHand({ dealer: 1, cribScore: 5 }); // side 1 (the enemy) is dealer, crib > 4
    const result = fireHandOutcomeSubroutines(state, 0, enemyDealtBigCrib);
    expect(result.events).toHaveLength(1);
    expect(result.combatState.sides[0].winGauge.progress).toBe(7);
  });

  it('does not fire when the caster is dealer -- the crib belongs to the dealer, not "the enemy"', () => {
    const trap = definition('trap', { kind: 'handOutcome', phase: 'crib', side: 'enemy', comparison: 'above', value: 4 }, { kind: 'directBurst', amount: 7 }, { archetype: 'root' });
    const state = createCombatState([trap], [], [12, 12]);
    const casterDealtBigCrib = testHand({ dealer: 0, cribScore: 10 }); // side 0 (the caster) is dealer this hand
    const result = fireHandOutcomeSubroutines(state, 0, casterDealtBigCrib);
    expect(result.events).toHaveLength(0);
  });

  it('does not fire when the value does not clear the threshold', () => {
    const trap = definition('trap', { kind: 'handOutcome', phase: 'crib', side: 'enemy', comparison: 'above', value: 4 }, { kind: 'directBurst', amount: 7 }, { archetype: 'root' });
    const state = createCombatState([trap], [], [12, 12]);
    const smallCrib = testHand({ dealer: 1, cribScore: 4 }); // exactly 4, not above
    const result = fireHandOutcomeSubroutines(state, 0, smallCrib);
    expect(result.events).toHaveLength(0);
  });

  it("phase 'hand' resolves to the resolved side's own kept-hand score, dealer or not", () => {
    const trap = definition('trap', { kind: 'handOutcome', phase: 'hand', side: 'own', comparison: 'above', value: 8 }, { kind: 'directBurst', amount: 3 }, { archetype: 'root' });
    const state = createCombatState([trap], [], [12, 12]);
    const asNonDealer = testHand({ dealer: 1, nonDealerHandScore: 10, dealerHandScore: 0 }); // caster (side 0) is non-dealer
    expect(fireHandOutcomeSubroutines(state, 0, asNonDealer).events).toHaveLength(1);
    const asDealer = testHand({ dealer: 0, dealerHandScore: 10, nonDealerHandScore: 0 }); // caster (side 0) is dealer
    expect(fireHandOutcomeSubroutines(state, 0, asDealer).events).toHaveLength(1);
  });

  it("phase 'pegging' reads peggingScores directly", () => {
    const trap = definition('trap', { kind: 'handOutcome', phase: 'pegging', side: 'own', comparison: 'above', value: 5 }, { kind: 'directBurst', amount: 3 }, { archetype: 'root' });
    const state = createCombatState([trap], [], [12, 12]);
    const result = fireHandOutcomeSubroutines(state, 0, testHand({ peggingScores: [6, 0] }));
    expect(result.events).toHaveLength(1);
  });

  it("comparison 'below' fires under the threshold, not over", () => {
    const trap = definition('trap', { kind: 'handOutcome', phase: 'crib', side: 'own', comparison: 'below', value: 2 }, { kind: 'directBurst', amount: 3 }, { archetype: 'root' });
    const state = createCombatState([trap], [], [12, 12]);
    expect(fireHandOutcomeSubroutines(state, 0, testHand({ dealer: 0, cribScore: 1 })).events).toHaveLength(1);
    expect(fireHandOutcomeSubroutines(state, 0, testHand({ dealer: 0, cribScore: 3 })).events).toHaveLength(0);
  });

  it('respects maxFiresPerCombat', () => {
    const trap = definition(
      'trap',
      { kind: 'handOutcome', phase: 'crib', side: 'enemy', comparison: 'above', value: 4 },
      { kind: 'directBurst', amount: 3 },
      { archetype: 'root', maxFiresPerCombat: 1 },
    );
    let state = createCombatState([trap], [], [12, 12]);
    const hand = testHand({ dealer: 1, cribScore: 6 });
    const first = fireHandOutcomeSubroutines(state, 0, hand);
    expect(first.events).toHaveLength(1);
    const second = fireHandOutcomeSubroutines(first.combatState, 0, hand);
    expect(second.events).toHaveLength(0);
  });

  it('never becomes ready via the normal turn-gated pipeline', () => {
    const trap = definition('trap', { kind: 'handOutcome', phase: 'crib', side: 'enemy', comparison: 'above', value: 4 }, { kind: 'directBurst', amount: 3 }, { archetype: 'root' });
    let state = createCombatState([trap], [], [12, 12]);
    state = refreshTriggerReadiness(state, 0);
    const fired = fireReadySubroutines(state, 0, { isDealer: true });
    expect(fired.events).toHaveLength(0);
  });
});
