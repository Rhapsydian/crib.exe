import { describe, it, expect } from 'vitest';
import { dataForTier } from './data';

describe('dataForTier', () => {
  it("awards 0 for a 'none' tier (a loss)", () => {
    expect(dataForTier('none')).toBe(0);
  });

  it('awards a positive amount for standard and better tiers, better strictly more', () => {
    const standard = dataForTier('standard');
    const better = dataForTier('better');
    expect(standard).toBeGreaterThan(0);
    expect(better).toBeGreaterThan(standard);
  });
});
