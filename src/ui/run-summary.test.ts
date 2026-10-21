import { describe, it, expect } from 'vitest';
import { playRun, opportunisticTraversal } from '../engine/run';
import { SYNERGY_AWARE_PROFILE } from '../engine/profiles';
import { summarizeRun } from './run-summary';

// Session 63: the end-of-run screen's story of the run.
describe('the run summary', () => {
  const runs = [1, 2, 3, 4, 5, 6].map((seed) => playRun({ ...SYNERGY_AWARE_PROFILE, seed, traversalStrategy: opportunisticTraversal, playerSkill: 0.85 }));

  it('has one row per layer reached, every breached layer naming its gatekeeper', () => {
    for (const result of runs) {
      const { layers } = summarizeRun(result);
      expect(layers.map((l) => l.layer)).toEqual(layers.map((_, i) => i + 1));
      expect(layers.filter((l) => l.ending === 'breached' && l.gatekeeper).length).toBeGreaterThanOrEqual(result.layersCompleted - (result.outcome === 'breachedThenCaught' ? 1 : 0));
      for (const l of layers) expect(l.stops.every((s) => s.type !== 'relay')).toBe(true);
    }
  }, 120_000);

  it('names what ended the run, and where', () => {
    for (const result of runs) {
      const { headline, layers } = summarizeRun(result);
      const last = layers.at(-1)!;
      if (result.outcome === 'victory') expect(headline).toMatch(/all four layers/);
      if (result.outcome === 'quarantined') expect(headline).toBe(`${last.gatekeeper} purged you at layer ${last.layer}.`);
      if (result.outcome === 'heatMaxed') expect(headline).toMatch(new RegExp(`layer ${last.layer}`));
      if (result.outcome !== 'victory') expect(last.ending).not.toBe('breached');
    }
  }, 120_000);
});
