import { describe, it, expect } from 'vitest';
import {
  createInitiativeGauge,
  addPoints,
  createControlBreach,
  pushControlBreach,
  CONTROL_BREACH_MIN,
  CONTROL_BREACH_MAX,
  CONTROL_BREACH_CENTER,
} from './gauges';

describe('InitiativeGauge / addPoints', () => {
  it('accumulates points without triggering a turn while under threshold', () => {
    const gauge = createInitiativeGauge(10);
    const { gauge: updated, turnTriggered } = addPoints(gauge, 6);
    expect(turnTriggered).toBe(false);
    expect(updated.progress).toBe(6);
  });

  it('resets to 0 and triggers a turn the instant threshold is crossed', () => {
    const gauge = createInitiativeGauge(10);
    const { gauge: g1 } = addPoints(gauge, 6);
    const { gauge: g2, turnTriggered } = addPoints(g1, 6);
    expect(turnTriggered).toBe(true);
    expect(g2.progress).toBe(0);
  });

  it('triggers on an exact threshold hit, not just overshoot', () => {
    const gauge = createInitiativeGauge(10);
    const { turnTriggered } = addPoints(gauge, 10);
    expect(turnTriggered).toBe(true);
  });

  it('ignores non-positive point additions', () => {
    const gauge = createInitiativeGauge(10);
    const { gauge: updated, turnTriggered } = addPoints(gauge, 0);
    expect(turnTriggered).toBe(false);
    expect(updated).toEqual(gauge);
  });
});

describe('Control/Breach', () => {
  it('starts contested at the center', () => {
    expect(createControlBreach()).toBe(CONTROL_BREACH_CENTER);
  });

  it('pushes toward the player favor and reports no resolution mid-range', () => {
    const { value, resolved } = pushControlBreach(CONTROL_BREACH_CENTER, 10, true);
    expect(value).toBe(60);
    expect(resolved).toBeNull();
  });

  it('pushes toward the enemy favor', () => {
    const { value } = pushControlBreach(CONTROL_BREACH_CENTER, 10, false);
    expect(value).toBe(40);
  });

  it('clamps at the max and resolves in the player favor', () => {
    const { value, resolved } = pushControlBreach(90, 50, true);
    expect(value).toBe(CONTROL_BREACH_MAX);
    expect(resolved).toBe('player');
  });

  it('clamps at the min and resolves in the enemy favor', () => {
    const { value, resolved } = pushControlBreach(10, 50, false);
    expect(value).toBe(CONTROL_BREACH_MIN);
    expect(resolved).toBe('enemy');
  });

  it('resolves exactly at the extremes, not just past them', () => {
    expect(pushControlBreach(90, 10, true).resolved).toBe('player');
    expect(pushControlBreach(10, 10, false).resolved).toBe('enemy');
  });
});
