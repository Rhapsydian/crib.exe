import { describe, it, expect } from 'vitest';
import { addHeat, heatFromLoss, HEAT_MAX } from './heat';

describe('addHeat', () => {
  it('adds normally within range', () => {
    expect(addHeat(10, 5)).toEqual({ heat: 15, maxed: false });
  });

  it('clamps at HEAT_MAX and reports maxed', () => {
    expect(addHeat(HEAT_MAX - 1, 10)).toEqual({ heat: HEAT_MAX, maxed: true });
  });

  it('floors at 0 for a negative amount (e.g. Rest)', () => {
    expect(addHeat(3, -10)).toEqual({ heat: 0, maxed: false });
  });

  it('reports maxed exactly at the boundary, not just past it', () => {
    expect(addHeat(HEAT_MAX, 0).maxed).toBe(true);
    expect(addHeat(HEAT_MAX - 1, 0).maxed).toBe(false);
  });
});

describe('heatFromLoss', () => {
  // Breach/Containment redesign (session 22+): heatFromLoss now takes the
  // losing side's own peak win-gauge fill fraction (0-1) directly --
  // CombatResult.peakFillFraction[0] -- rather than a 0-100 shared-scalar
  // peak value measured against a center point.
  it('charges the full tier base when the player made no progress at all', () => {
    expect(heatFromLoss('regular', 0)).toBe(15);
    expect(heatFromLoss('elite', 0)).toBe(30);
  });

  it('charges noticeably less the closer the player got to their own win', () => {
    const dominated = heatFromLoss('regular', 0);
    const closeCall = heatFromLoss('regular', 0.9);
    expect(closeCall).toBeLessThan(dominated);
  });

  it('elite costs meaningfully more than regular at the same margin -- higher stakes for a harder, better-rewarded fight', () => {
    expect(heatFromLoss('elite', 0.3)).toBeGreaterThan(heatFromLoss('regular', 0.3));
  });

  it('clamps gracefully for out-of-domain fraction values', () => {
    expect(heatFromLoss('regular', -0.5)).toBe(15); // no negative margin
    expect(heatFromLoss('regular', 1.5)).toBe(0); // no heat left to charge past full progress
  });
});
