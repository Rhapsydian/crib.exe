import { describe, expect, it } from 'vitest';
import { securityEffects } from './security-text';

// Session 72: a Security Level's effects as a list, from the engine's rules.
describe('securityEffects', () => {
  it('lists nothing at level 0, and the scaling and the new rule at level 1', () => {
    expect(securityEffects(0)).toEqual([]);
    expect(securityEffects(1)).toEqual([
      { text: '+15% Rep', isNew: false },
      { text: 'Enemies 3% stronger', isNew: false },
      { text: '4% more Heat', isNew: false },
      { text: 'Elites take a second Mod', isNew: true },
    ]);
  });

  it('marks what a level adds or changes, and keeps the rest', () => {
    const seven = securityEffects(7);
    expect(seven.filter((e) => e.isNew).map((e) => e.text)).toEqual(['Layer 3 and 4 gatekeepers take a second Mod', 'Shop prices +30%']);
    expect(seven.map((e) => e.text)).toContain('Rewards offer 2 choices, not 3');
    expect(securityEffects(10).filter((e) => e.isNew).map((e) => e.text)).toEqual(['Elites take a third Mod', 'The final gatekeeper takes three Mods']);
  });
});
