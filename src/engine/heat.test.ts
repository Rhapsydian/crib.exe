import { describe, it, expect } from 'vitest';
import {
  addHeat,
  currentHeatCeiling,
  fightBaselineHeat,
  fightPerformanceHeat,
  fightPerformanceWeight,
  heatFromLoss,
  eventHeat,
  layerHeatAllowance,
  postedFightRisk,
  LAYER_HEAT_ALLOWANCE,
  LOSS_MULTIPLIER,
} from './heat';

// Session 52: rewritten for the per-layer Heat economy (run-economy D1-D7,
// recalibration R5-R8). Numbers are placeholders; these tests pin the
// SHAPE the decisions require, not the values.

describe('addHeat', () => {
  it('adds normally within range', () => {
    expect(addHeat(10, 5, 40)).toEqual({ heat: 15, maxed: false });
  });

  it('clamps at the allowance and reports maxed', () => {
    expect(addHeat(39, 10, 40)).toEqual({ heat: 40, maxed: true });
  });

  it('floors at 0 for a negative amount (e.g. Rest)', () => {
    expect(addHeat(3, -10, 40)).toEqual({ heat: 0, maxed: false });
  });

  it('reports maxed exactly at the boundary, not just past it', () => {
    expect(addHeat(40, 0, 40).maxed).toBe(true);
    expect(addHeat(39, 0, 40).maxed).toBe(false);
  });
});

describe('layer allowances (D4, D5)', () => {
  it('tighten with depth', () => {
    for (let i = 1; i < LAYER_HEAT_ALLOWANCE.length; i++) expect(LAYER_HEAT_ALLOWANCE[i]).toBeLessThan(LAYER_HEAT_ALLOWANCE[i - 1]);
  });

  it('add the Backup Generator bonus to every layer, and reuse the last entry past the table', () => {
    expect(layerHeatAllowance(0, 8)).toBe(LAYER_HEAT_ALLOWANCE[0] + 8);
    expect(layerHeatAllowance(99)).toBe(LAYER_HEAT_ALLOWANCE[LAYER_HEAT_ALLOWANCE.length - 1]);
  });

  it("currentHeatCeiling reads the run's live allowance, falling back to layer 1's", () => {
    expect(currentHeatCeiling({ heatAllowance: 23, maxHeatBonus: 0 })).toBe(23);
    expect(currentHeatCeiling({ maxHeatBonus: 4 })).toBe(LAYER_HEAT_ALLOWANCE[0] + 4);
  });
});

describe('fight Trace (D1, D2, R6)', () => {
  it('posts a baseline for every tier, elite above regular, growing with layer', () => {
    for (const tier of ['regular', 'elite', 'gatekeeper'] as const) expect(fightBaselineHeat(tier, 0)).toBeGreaterThan(0);
    expect(fightBaselineHeat('elite', 0)).toBeGreaterThan(fightBaselineHeat('regular', 0));
    expect(fightBaselineHeat('regular', 3)).toBeGreaterThan(fightBaselineHeat('regular', 0));
  });

  it("adds a performance term in proportion to the enemy's FINAL fill, clamped to 0-1", () => {
    const k = fightPerformanceWeight('regular', 0);
    expect(fightPerformanceHeat('regular', 0, 0)).toBe(0);
    expect(fightPerformanceHeat('regular', 0, 0.5)).toBeCloseTo(k / 2);
    expect(fightPerformanceHeat('regular', 0, 1.7)).toBeCloseTo(k);
  });

  it("puts the gatekeeper's price in the performance term, not the posted floor (R8)", () => {
    expect(fightPerformanceWeight('gatekeeper', 0)).toBeGreaterThan(fightBaselineHeat('gatekeeper', 0));
    expect(fightBaselineHeat('gatekeeper', 0)).toBeLessThan(fightBaselineHeat('regular', 0));
  });
});

describe('heatFromLoss (R7)', () => {
  it('is the baseline plus LOSS_MULTIPLIER x the performance weight, with the multiplier above 1', () => {
    expect(LOSS_MULTIPLIER).toBeGreaterThan(1);
    for (const tier of ['regular', 'elite'] as const) {
      for (let layer = 0; layer < 4; layer++) {
        expect(heatFromLoss(tier, layer)).toBeCloseTo(fightBaselineHeat(tier, layer) + LOSS_MULTIPLIER * fightPerformanceWeight(tier, layer));
      }
    }
  });

  it('keeps the ladder in order at every tier and layer: clean win < worst win < loss', () => {
    for (const tier of ['regular', 'elite'] as const) {
      for (let layer = 0; layer < 4; layer++) {
        const risk = postedFightRisk(tier, layer);
        expect(risk.cleanWin).toBeLessThan(risk.worstWin);
        expect(risk.worstWin).toBeLessThan(risk.loss!);
      }
    }
  });

  it('costs more deeper, and more for an elite', () => {
    expect(heatFromLoss('regular', 3)).toBeGreaterThan(heatFromLoss('regular', 0));
    expect(heatFromLoss('elite', 0)).toBeGreaterThan(heatFromLoss('regular', 0));
  });

  it("has no posted loss for a gatekeeper, whose loss is Quarantine", () => {
    expect(postedFightRisk('gatekeeper', 0).loss).toBeUndefined();
  });
});

describe('eventHeat (step 2, checkpoint 6)', () => {
  it("is a multiple of the layer's elite-loss charge, so it scales with depth", () => {
    for (const layer of [0, 1, 2, 3]) expect(eventHeat(0.5, layer)).toBeCloseTo(0.5 * heatFromLoss('elite', layer));
    expect(eventHeat(1, 3)).toBeGreaterThan(eventHeat(1, 0));
    expect(eventHeat(-0.27, 0)).toBeLessThan(0);
  });
});
