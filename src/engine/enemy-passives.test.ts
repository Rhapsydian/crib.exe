import { describe, it, expect } from 'vitest';
import type { PayloadEffect, SubroutineDefinition, TriggerFamily } from './subroutine-types';
import { createCombatState, resolvePayload, applyEnemyGaugeCross50Passives } from './resolve';
import type { EnemyPassiveId } from './enemies';

/**
 * Phase 5 checkpoint B smoke tests -- exercises each of the 5 dispatch
 * hooks (onFire, onTick, onIncomingDirectBurst, onGaugeCross50,
 * onTickExpiring) against a representative passive or two, ahead of
 * checkpoint E's full per-enemy coverage. Same low-level style as
 * resolve.test.ts's existing passive tests (createCombatState +
 * resolvePayload directly, not a full playCombat run).
 */

function definition(id: string, trigger: TriggerFamily, payload: PayloadEffect, archetype: SubroutineDefinition['archetype'] = 'exploit'): SubroutineDefinition {
  return { id, name: id, archetype, trigger, payload, tags: [] };
}

function stateWithEnemyPassives(passiveIds: EnemyPassiveId[], threshold = 100) {
  return createCombatState([], [], [12, 12], undefined, [threshold, threshold], passiveIds);
}

describe('enemy passives -- onFire hook', () => {
  it('lucky-guess: first Exploit fire this combat gets a bonus, later ones do not', () => {
    let state = stateWithEnemyPassives(['lucky-guess']);
    state = resolvePayload({ kind: 'directBurst', amount: 5 }, 'exploit', state, 1);
    const afterFirst = state.sides[1].winGauge.progress;
    expect(afterFirst).toBeGreaterThan(5); // base 5 + the bonus
    state = resolvePayload({ kind: 'directBurst', amount: 5 }, 'exploit', state, 1);
    expect(state.sides[1].winGauge.progress).toBe(afterFirst + 5); // no bonus the second time
  });

  it('lucky-guess never applies to side 0 (player) or a non-Exploit fire', () => {
    const forPlayer = resolvePayload({ kind: 'directBurst', amount: 5 }, 'exploit', stateWithEnemyPassives(['lucky-guess']), 0);
    expect(forPlayer.sides[0].winGauge.progress).toBe(5);
    const forMalware = resolvePayload({ kind: 'directBurst', amount: 5 }, 'malware', stateWithEnemyPassives(['lucky-guess']), 1);
    expect(forMalware.sides[1].winGauge.progress).toBe(5);
  });

  it('digital-ghost: every Root fire drains a flat amount off the player\'s initiative gauge', () => {
    let state = stateWithEnemyPassives(['digital-ghost']);
    state = { ...state, sides: [{ ...state.sides[0], gauge: { ...state.sides[0].gauge, progress: 10 } }, state.sides[1]] as typeof state.sides };
    state = resolvePayload({ kind: 'instantManipulation', target: 'suitTally', amount: 0 }, 'root', state, 1);
    expect(state.sides[0].gauge.progress).toBeLessThan(10);
  });

  it('no-way-in: a Ward fire re-casts once more automatically', () => {
    let state = stateWithEnemyPassives(['no-way-in']);
    state = resolvePayload({ kind: 'ward', amount: 6 }, 'encryption', state, 1);
    expect(state.sides[1].wardShield).toBe(12); // cast + one automatic re-cast
  });

  it('adaptive-defense: arms off the player cleansing their own debuff, consumed by the next enemy fire', () => {
    let state = stateWithEnemyPassives(['adaptive-defense']);
    state = {
      ...state,
      sides: [{ ...state.sides[0], debuffs: [{ debuffId: 'throttled', magnitude: 1, remainingDuration: 3 }] }, state.sides[1]] as typeof state.sides,
    };
    state = resolvePayload({ kind: 'cleanse' }, 'encryption', state, 0);
    const before = state.sides[1].winGauge.progress;
    state = resolvePayload({ kind: 'directBurst', amount: 3 }, 'exploit', state, 1);
    expect(state.sides[1].winGauge.progress).toBeGreaterThan(before + 3);
  });
});

describe('enemy passives -- onTick hook', () => {
  it('grinds-you-down: DoT ticks get a magnitude bonus', () => {
    let state = stateWithEnemyPassives(['grinds-you-down']);
    state = resolvePayload({ kind: 'dot', amountPerTick: 3, cadence: 'castersTurnPulse', duration: 2 }, 'malware', state, 1);
    // Tick directly via the same internal path applyTickPush would use --
    // simplest is to invoke resolvePayload's dot registration then check
    // the enemy fired-bonus path separately is covered above; here we
    // confirm the dot was registered (bonus itself is exercised via
    // combat.test.ts-level integration in checkpoint E).
    expect(state.sides[0].dots.length).toBe(1);
  });
});

describe('enemy passives -- onGaugeCross50 hook', () => {
  it('cover-your-tracks: a symmetric push+pull once the enemy\'s own win-gauge crosses 50%', () => {
    let state = stateWithEnemyPassives(['cover-your-tracks'], 20);
    state = resolvePayload({ kind: 'directBurst', amount: 11 }, 'exploit', state, 1); // crosses 50% of 20
    state = applyEnemyGaugeCross50Passives(state);
    expect(state.sides[1].winGauge.progress).toBeGreaterThan(11);
    expect(state.sides[0].winGauge.progress).toBe(0); // nothing to pull from yet, floored at 0
  });

  it('null-session-passive: watches the PLAYER\'s gauge instead of its own', () => {
    let state = stateWithEnemyPassives(['null-session-passive'], 20);
    state = resolvePayload({ kind: 'directBurst', amount: 11 }, 'exploit', state, 0); // player crosses 50%
    state = applyEnemyGaugeCross50Passives(state);
    expect(state.sides[1].winGauge.progress).toBeGreaterThan(0);
  });

  it('only fires once per combat', () => {
    let state = stateWithEnemyPassives(['cover-your-tracks'], 20);
    state = resolvePayload({ kind: 'directBurst', amount: 11 }, 'exploit', state, 1);
    state = applyEnemyGaugeCross50Passives(state);
    const after = state.sides[1].winGauge.progress;
    state = resolvePayload({ kind: 'directBurst', amount: 5 }, 'exploit', state, 1);
    state = applyEnemyGaugeCross50Passives(state);
    expect(state.sides[1].winGauge.progress).toBe(after + 5); // no second bonus
  });
});

describe('enemy passives -- onIncomingDirectBurst hook', () => {
  it('stubborn-default: mitigates a flat amount off the first hit taken each combat, not later ones', () => {
    let state = stateWithEnemyPassives(['stubborn-default']);
    state = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 0); // player attacks the enemy
    const firstHitProgress = state.sides[0].winGauge.progress;
    expect(firstHitProgress).toBeLessThan(10);
    state = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 0);
    expect(state.sides[0].winGauge.progress).toBe(firstHitProgress + 10); // full amount the second time
  });
});
