import { describe, it, expect } from 'vitest';
import { createInitiativeGauge, addPoints, createDuelGauge, addDuelProgress, reduceDuelProgress } from './gauges';

describe('InitiativeGauge / addPoints', () => {
  it('accumulates points without triggering a turn while under threshold', () => {
    const gauge = createInitiativeGauge(10);
    const { gauge: updated, turnsTriggered } = addPoints(gauge, 6);
    expect(turnsTriggered).toBe(0);
    expect(updated.progress).toBe(6);
  });

  it('triggers a turn and carries the overshoot forward, rather than discarding it', () => {
    const gauge = createInitiativeGauge(12);
    const { gauge: g1 } = addPoints(gauge, 10);
    const { gauge: g2, turnsTriggered } = addPoints(g1, 8); // 10 + 8 = 18
    expect(turnsTriggered).toBe(1);
    expect(g2.progress).toBe(6); // 18 - 12, not reset to 0
  });

  it('triggers on an exact threshold hit, not just overshoot', () => {
    const gauge = createInitiativeGauge(10);
    const { turnsTriggered } = addPoints(gauge, 10);
    expect(turnsTriggered).toBe(1);
  });

  it('triggers multiple turns when one addition spans the threshold more than once', () => {
    const gauge = createInitiativeGauge(12);
    const { gauge: g1 } = addPoints(gauge, 10);
    const { gauge: g2, turnsTriggered } = addPoints(g1, 14); // 10 + 14 = 24 = 2x12 exactly
    expect(turnsTriggered).toBe(2);
    expect(g2.progress).toBe(0);
  });

  it('ignores non-positive point additions', () => {
    const gauge = createInitiativeGauge(10);
    const { gauge: updated, turnsTriggered } = addPoints(gauge, 0);
    expect(turnsTriggered).toBe(0);
    expect(updated).toEqual(gauge);
  });
});

describe('DuelGauge / addDuelProgress', () => {
  it('starts at zero progress', () => {
    expect(createDuelGauge(20)).toEqual({ progress: 0, threshold: 20 });
  });

  it('credits progress and reports not yet resolved while under threshold', () => {
    const gauge = createDuelGauge(20);
    const { gauge: updated, resolved } = addDuelProgress(gauge, 12);
    expect(updated.progress).toBe(12);
    expect(resolved).toBe(false);
  });

  it('resolves exactly on hitting the threshold, not just past it', () => {
    const gauge = createDuelGauge(20);
    const { resolved } = addDuelProgress(gauge, 20);
    expect(resolved).toBe(true);
  });

  it('resolves on overshoot past the threshold, and does not clamp progress', () => {
    const gauge = createDuelGauge(20);
    const { gauge: updated, resolved } = addDuelProgress(gauge, 35);
    expect(updated.progress).toBe(35); // not clamped -- resolved is what matters
    expect(resolved).toBe(true);
  });

  it('ignores non-positive additions but still reports current resolution state', () => {
    const gauge = createDuelGauge(20);
    const { gauge: updated, resolved } = addDuelProgress(gauge, 0);
    expect(updated).toEqual(gauge);
    expect(resolved).toBe(false);

    const alreadyThere = { progress: 20, threshold: 20 };
    expect(addDuelProgress(alreadyThere, -5)).toEqual({ gauge: alreadyThere, resolved: true });
  });
});

describe('reduceDuelProgress', () => {
  it('subtracts progress', () => {
    const gauge = { progress: 15, threshold: 20 };
    expect(reduceDuelProgress(gauge, 5)).toEqual({ progress: 10, threshold: 20 });
  });

  it('floors at 0 rather than going negative', () => {
    const gauge = { progress: 5, threshold: 20 };
    expect(reduceDuelProgress(gauge, 50)).toEqual({ progress: 0, threshold: 20 });
  });

  it('ignores non-positive amounts', () => {
    const gauge = { progress: 15, threshold: 20 };
    expect(reduceDuelProgress(gauge, 0)).toEqual(gauge);
  });
});
