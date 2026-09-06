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
  // Session 50 removed the margin-of-loss scaler: the charge is now flat
  // per tier, so entering a fight is a legible risk/reward decision
  // rather than one whose cost depends on a peak gauge fill the player
  // never sees.
  it('charges a flat tier base, regardless of how the fight went', () => {
    expect(heatFromLoss('regular')).toBe(15);
    expect(heatFromLoss('elite')).toBe(30);
  });

  it('costs much more for an elite -- higher stakes for a harder, better-rewarded fight', () => {
    expect(heatFromLoss('elite')).toBeGreaterThan(heatFromLoss('regular'));
  });

  it('is a meaningful fraction of the Heat budget, so a loss is a real setback', () => {
    // A regular loss should cost real progress toward HEAT_MAX, not a
    // rounding error -- the near-miss scaler used to discount this to
    // near zero on a close loss.
    expect(heatFromLoss('regular') / HEAT_MAX).toBeGreaterThan(0.1);
    expect(heatFromLoss('elite') / HEAT_MAX).toBeGreaterThan(0.25);
  });
});
