import { describe, it, expect } from 'vitest';
import { expectedScale, frequencyKey, piecePrice, POINT_PRICE } from './beta-pricing';
import { BETA_FREQUENCY } from './beta-frequency-data';
import type { Beta, SubroutineDefinition } from './subroutine-types';

// R3's formula (step 2, checkpoint 5). These pin the formula's own logic
// against the measured table; checkpoint 5's validation pins it against
// real mirror-duel prices.

const ENHANCE = { verb: 'enhance', amount: 1 } as const;

/** P(N >= k) straight from the measured table. */
function atLeast(key: string, k: number): number {
  const d = BETA_FREQUENCY[key];
  const total = Object.values(d).reduce((a, b) => a + b, 0);
  return Object.entries(d).reduce((sum, [n, c]) => (Number(n) >= k ? sum + c : sum), 0) / total;
}

function mean(key: string): number {
  const d = BETA_FREQUENCY[key];
  const total = Object.values(d).reduce((a, b) => a + b, 0);
  return Object.entries(d).reduce((sum, [n, c]) => sum + Number(n) * c, 0) / total;
}

describe('expectedScale', () => {
  it('graded = E[min(N, cap)] = sum of P(N >= k) for k up to the cap', () => {
    const beta: Beta = { source: 'cards', category: 'fifteen', shape: 'graded', cap: 3, effect: ENHANCE };
    const exact = atLeast('cards:fifteen', 1) + atLeast('cards:fifteen', 2) + atLeast('cards:fifteen', 3);
    expect(expectedScale(beta)!).toBeCloseTo(exact, 2);
  });

  it('stepped at 1 applies on every turn that banked anything', () => {
    const beta: Beta = { source: 'cards', category: 'pair', shape: 'stepped', at: 1, effect: ENHANCE };
    expect(expectedScale(beta)!).toBeCloseTo(atLeast('cards:pair', 1), 2);
  });

  it('stepped at k carries charges across turns, so it applies more often than P(N >= k)', () => {
    const beta: Beta = { source: 'cards', category: 'pair', shape: 'stepped', at: 3, effect: ENHANCE };
    expect(expectedScale(beta)!).toBeGreaterThan(atLeast('cards:pair', 3));
  });

  it('immediate fires every `at` charges: mean / at', () => {
    const beta: Beta = { source: 'cards', category: 'pair', shape: 'immediate', at: 2, effect: ENHANCE };
    expect(expectedScale(beta)!).toBeCloseTo(mean('cards:pair') / 2, 1);
  });

  it('progress banks raw units toward a charge every `per`', () => {
    // ~12 points per turn, one charge per 10, graded cap 9: about 1.2.
    const beta: Beta = { source: 'progress', metric: 'points', per: 10, shape: 'graded', cap: 9, effect: ENHANCE };
    expect(expectedScale(beta)!).toBeCloseTo(mean('progress:points') / 10, 1);
  });

  it('whileTrue state = the fraction of turns the condition held', () => {
    const beta: Beta = { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: ENHANCE };
    expect(expectedScale(beta)!).toBeCloseTo(atLeast('state:dealer', 1), 5);
  });

  it('returns null for what the table cannot support', () => {
    expect(expectedScale({ source: 'cards', category: 'pair', minMagnitude: 12, shape: 'graded', cap: 2, effect: ENHANCE })).toBeNull();
    expect(expectedScale({ source: 'state', condition: { kind: 'ownGaugeAbove', fraction: 0.7 }, shape: 'whileTrue', effect: ENHANCE })).toBeNull();
    expect(expectedScale({ source: 'state', condition: { kind: 'dealer' }, shape: 'immediate', effect: ENHANCE })).toBeNull();
    expect(expectedScale({ source: 'sequence', reach: 'adjacent', match: { archetype: 'daemon' }, shape: 'whileTrue', effect: ENHANCE })).toBeNull();
  });

  it('is deterministic', () => {
    const beta: Beta = { source: 'cards', category: 'run', shape: 'stepped', at: 2, effect: ENHANCE };
    expect(expectedScale(beta)).toBe(expectedScale(beta));
  });
});

describe('frequencyKey', () => {
  it('maps watch, minMagnitude and suit onto the measured rows', () => {
    expect(frequencyKey({ source: 'cards', category: 'pair', watch: 'opponent', shape: 'graded', cap: 2, effect: ENHANCE })).toBe('cards:pair (opponent)');
    expect(frequencyKey({ source: 'cards', category: 'pair', minMagnitude: 6, shape: 'graded', cap: 2, effect: ENHANCE })).toBe('cards:pair>=6 (royal)');
    expect(frequencyKey({ source: 'cards', category: 'suit', shape: 'graded', cap: 2, effect: ENHANCE })).toBe('cards:suit (own)');
  });
});

describe('piecePrice', () => {
  const piece = (alpha: SubroutineDefinition['alpha'], beta?: Beta): SubroutineDefinition => ({ id: 'p', name: 'p', archetype: 'exploit', alpha, beta });

  it('prices a beta-less piece at its alpha', () => {
    expect(piecePrice(piece({ verb: 'credit', amount: 2 })).total).toBe(2);
    expect(piecePrice(piece({ verb: 'suppress', amount: 2 })).total).toBeCloseTo(2 * POINT_PRICE.suppress);
  });

  it('adds the beta: expected scale x the value of one application', () => {
    const p = piecePrice(piece({ verb: 'credit', amount: 1 }, { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 2 } }));
    expect(p.beta!).toBeCloseTo(atLeast('state:dealer', 1) * 2, 5);
    expect(p.total!).toBeCloseTo(1 + p.beta!, 5);
  });

  it('prices an immediate enhance as an extra fire of the whole alpha', () => {
    const p = piecePrice(piece({ verb: 'credit', amount: 2 }, { source: 'cards', category: 'pair', shape: 'immediate', at: 2, effect: { verb: 'enhance', amount: 1 } }));
    expect(p.beta!).toBeCloseTo((mean('cards:pair') / 2) * 3, 1);
  });

  it('refuses to price what depends on context', () => {
    expect(piecePrice(piece({ verb: 'tempo', target: 'own', mode: 'gauge', amount: 0.25 })).total).toBeNull();
    expect(piecePrice(piece({ verb: 'credit', amount: 1 }, { source: 'cards', category: 'pair', shape: 'graded', cap: 2, effect: { verb: 'credit', amount: 2, from: 'ward' } })).total).toBeNull();
  });
});
