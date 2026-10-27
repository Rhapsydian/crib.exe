import { describe, expect, it } from 'vitest';
import { gambleWidths, rollMs, rollPath, rollPosition, rollTarget, segmentAt } from './roll';
import { outcomeTone } from './visit-text';

// v0.9.1: an Event roll's animation.
describe('the Event roll', () => {
  it('settles inside the segment that was rolled', () => {
    const widths = [0.6, 0.25, 0.15];
    for (const landed of [0, 1, 2])
      for (const at of [0, 0.5, 1]) {
        const target = rollTarget(widths, landed, at);
        expect(segmentAt(widths, target)).toBe(landed);
        const path = rollPath(target);
        expect(rollPosition(path, rollMs(path))).toBe(target);
        expect(rollPosition(path, rollMs(path) + 500)).toBe(target);
      }
  });

  it('sweeps from the left edge, back and forth across the target, in about 2 seconds', () => {
    const path = rollPath(0.5);
    expect(rollPosition(path, 0)).toBe(0);
    const [a, b] = path.stops;
    expect(a).toBeGreaterThan(0.5);
    expect(b).toBeLessThan(0.5);
    expect(rollMs(path)).toBeGreaterThan(1800);
    expect(rollMs(path)).toBeLessThan(2600);
    expect(rollMs(rollPath(0.5, 0.5))).toBeCloseTo(rollMs(path) / 2, 6);
  });

  it("gives a gamble's segments shifting shares that always fill the bar", () => {
    const wobble = [{ hz: 0.7, phase: 0 }, { hz: 1.1, phase: 2 }, { hz: 0.9, phase: 4 }];
    const early = gambleWidths(wobble, 100);
    const later = gambleWidths(wobble, 900);
    for (const w of [early, later]) {
      expect(w.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 9);
      expect(Math.min(...w)).toBeGreaterThan(0);
    }
    expect(later).not.toEqual(early);
  });

  it('reads an outcome as good, bad or mixed', () => {
    expect(outcomeTone({ dataDelta: 40 })).toBe('good');
    expect(outcomeTone({ heatLosses: -1 })).toBe('good');
    expect(outcomeTone({ heatLosses: 1 })).toBe('bad');
    expect(outcomeTone({})).toBe('bad');
    expect(outcomeTone({ dataDelta: 40, heatLosses: 1 })).toBe('mixed');
    expect(outcomeTone({ bonusFight: { tier: 'elite' } })).toBe('bad');
  });
});
