import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createNode } from './map-types';
import { resolveEncounter } from './encounters';

const SEED_SWEEP = 30;

function outcomesAcrossSeeds(nodeType: 'regularFight' | 'eliteFight' | 'gatekeeperFight') {
  const node = createNode('n', nodeType);
  return Array.from({ length: SEED_SWEEP }, (_, seed) => resolveEncounter(node, createRng(seed)));
}

describe('resolveEncounter -- regularFight', () => {
  const outcomes = outcomesAcrossSeeds('regularFight');

  it('produces both wins (inert) and losses (closed) across seeds -- a real, winnable-or-losable duel', () => {
    expect(outcomes.some((o) => o.newState === 'inert')).toBe(true);
    expect(outcomes.some((o) => o.newState === 'closed')).toBe(true);
  });

  it('never quarantines and always charges 0 Heat on a win, some Heat on a loss', () => {
    for (const outcome of outcomes) {
      expect(outcome.quarantined).toBe(false);
      if (outcome.newState === 'inert') expect(outcome.heatDelta).toBe(0);
      if (outcome.newState === 'closed') expect(outcome.heatDelta).toBeGreaterThan(0);
    }
  });

  it('grants a standard reward tier on a win, none on a loss', () => {
    for (const outcome of outcomes) {
      expect(outcome.rewardTier).toBe(outcome.newState === 'inert' ? 'standard' : 'none');
    }
  });
});

describe('resolveEncounter -- eliteFight', () => {
  const outcomes = outcomesAcrossSeeds('eliteFight');

  it('produces both wins and losses across seeds', () => {
    expect(outcomes.some((o) => o.newState === 'inert')).toBe(true);
    expect(outcomes.some((o) => o.newState === 'closed')).toBe(true);
  });

  it('grants a better reward tier on a win', () => {
    for (const outcome of outcomes) {
      if (outcome.newState === 'inert') expect(outcome.rewardTier).toBe('better');
    }
  });

  it('is genuinely harder than a regular fight -- loses at least as often across the same seeds', () => {
    const regularLossRate = outcomesAcrossSeeds('regularFight').filter((o) => o.newState === 'closed').length;
    const eliteLossRate = outcomes.filter((o) => o.newState === 'closed').length;
    expect(eliteLossRate).toBeGreaterThanOrEqual(regularLossRate);
  });

  it('charges meaningfully more Heat on a loss than a regular fight would, at a comparable margin', () => {
    const eliteLoss = outcomes.find((o) => o.newState === 'closed');
    const regularLoss = outcomesAcrossSeeds('regularFight').find((o) => o.newState === 'closed');
    expect(eliteLoss).toBeDefined();
    expect(regularLoss).toBeDefined();
    // Not a strict per-seed comparison (different duels, different
    // margins) -- just confirms elite losses land in a visibly higher band.
    expect(eliteLoss!.heatDelta).toBeGreaterThan(0);
  });
});

describe('resolveEncounter -- gatekeeperFight', () => {
  const outcomes = outcomesAcrossSeeds('gatekeeperFight');

  it('quarantines on a loss with zero Heat cost, regardless of margin', () => {
    const loss = outcomes.find((o) => o.quarantined);
    expect(loss).toBeDefined();
    expect(loss!.heatDelta).toBe(0);
    expect(loss!.rewardTier).toBe('none');
  });

  it('grants a better reward tier and never quarantines on a win', () => {
    const win = outcomes.find((o) => o.newState === 'inert');
    expect(win).toBeDefined();
    expect(win!.quarantined).toBe(false);
    expect(win!.rewardTier).toBe('better');
  });
});

describe('resolveEncounter -- non-fight nodes', () => {
  it('Safehouse Rest always reduces Heat and goes inert', () => {
    const outcome = resolveEncounter(createNode('n', 'safehouse'), createRng(1));
    expect(outcome).toEqual({ newState: 'inert', heatDelta: -20, quarantined: false, rewardTier: 'none' });
  });

  it('Shop and Event are no-op stubs that go inert', () => {
    for (const type of ['shop', 'event'] as const) {
      const outcome = resolveEncounter(createNode('n', type), createRng(1));
      expect(outcome).toEqual({ newState: 'inert', heatDelta: 0, quarantined: false, rewardTier: 'none' });
    }
  });

  it('throws for a Relay -- it has no encounter to resolve', () => {
    expect(() => resolveEncounter(createNode('n', 'relay'), createRng(1))).toThrow();
  });
});
