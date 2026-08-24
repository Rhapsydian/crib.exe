import { describe, it, expect } from 'vitest';
import {
  createInitiativeGauge,
  addPoints,
  createBreachContainment,
  pushBreachContainment,
  BREACH_CONTAINMENT_MIN,
  BREACH_CONTAINMENT_MAX,
  BREACH_CONTAINMENT_CENTER,
} from './gauges';

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

describe('Breach/Containment', () => {
  it('starts contested at the center', () => {
    expect(createBreachContainment()).toBe(BREACH_CONTAINMENT_CENTER);
  });

  it('pushes toward the player favor and reports no resolution mid-range', () => {
    const { value, resolved } = pushBreachContainment(BREACH_CONTAINMENT_CENTER, 10, true);
    expect(value).toBe(60);
    expect(resolved).toBeNull();
  });

  it('pushes toward the enemy favor', () => {
    const { value } = pushBreachContainment(BREACH_CONTAINMENT_CENTER, 10, false);
    expect(value).toBe(40);
  });

  it('clamps at the max and resolves in the player favor', () => {
    const { value, resolved } = pushBreachContainment(90, 50, true);
    expect(value).toBe(BREACH_CONTAINMENT_MAX);
    expect(resolved).toBe('player');
  });

  it('clamps at the min and resolves in the enemy favor', () => {
    const { value, resolved } = pushBreachContainment(10, 50, false);
    expect(value).toBe(BREACH_CONTAINMENT_MIN);
    expect(resolved).toBe('enemy');
  });

  it('resolves exactly at the extremes, not just past them', () => {
    expect(pushBreachContainment(90, 10, true).resolved).toBe('player');
    expect(pushBreachContainment(10, 10, false).resolved).toBe('enemy');
  });
});
