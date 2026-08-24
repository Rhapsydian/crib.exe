import { describe, it, expect } from 'vitest';
import type { SubroutineDefinition } from './subroutine-types';
import { playCombat } from './combat';

function alwaysBurst(id: string, amount: number): SubroutineDefinition {
  return {
    id,
    name: id,
    archetype: 'exploit',
    trigger: { kind: 'always' },
    payload: { kind: 'instantBurst', amount },
    tags: [],
  };
}

describe('playCombat', () => {
  it('resolves in the player\'s favor when only the player has a firing subroutine', () => {
    const result = playCombat([[alwaysBurst('a', 20)], []], { seed: 1, gaugeThreshold: 5 });
    expect(result.winner).toBe(0);
    expect(result.hands.length).toBeGreaterThan(0);
    expect(result.log.length).toBeGreaterThan(0);
    expect(result.log.every((e) => e.side === 0)).toBe(true);
  });

  it('resolves in the enemy\'s favor when only the enemy has a firing subroutine', () => {
    const result = playCombat([[], [alwaysBurst('b', 20)]], { seed: 1, gaugeThreshold: 5 });
    expect(result.winner).toBe(1);
    expect(result.log.every((e) => e.side === 1)).toBe(true);
  });

  it('is fully deterministic for the same seed', () => {
    const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = [
      [alwaysBurst('a', 3)],
      [alwaysBurst('b', 2)],
    ];
    const a = playCombat(loadouts, { seed: 42, gaugeThreshold: 8 });
    const b = playCombat(loadouts, { seed: 42, gaugeThreshold: 8 });
    expect(a).toEqual(b);
  });

  it('a symmetric duel between two firing loadouts resolves without throwing', () => {
    const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = [
      [alwaysBurst('a', 3)],
      [alwaysBurst('b', 3)],
    ];
    const result = playCombat(loadouts, { seed: 7, gaugeThreshold: 6 });
    expect([0, 1]).toContain(result.winner);
  });

  it('plays different hands for a different seed', () => {
    const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = [
      [alwaysBurst('a', 3)],
      [alwaysBurst('b', 3)],
    ];
    const a = playCombat(loadouts, { seed: 1, gaugeThreshold: 6 });
    const b = playCombat(loadouts, { seed: 2, gaugeThreshold: 6 });
    expect(a.hands).not.toEqual(b.hands);
  });

  it('throws rather than looping forever when neither side can ever get a turn', () => {
    expect(() => playCombat([[], []], { seed: 1, gaugeThreshold: 5, maxHands: 3 })).toThrow();
  });
});
