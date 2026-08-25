import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createNode } from './map-types';
import { resolveEncounter } from './encounters';
import type { RunPlayerState } from './run';
import type { SubroutineDefinition } from './subroutine-types';

/**
 * Breach/Containment is a sharp positive-feedback race (session 20's own
 * finding, confirmed again at Phase 4 checkpoint A): a near-symmetric
 * matchup can take anywhere from tens to tens of thousands of hands to
 * resolve, with no reliable "sometimes wins, sometimes loses, resolves
 * quickly" zone in between -- swept seeds against one borderline test
 * loadout turned out to be a flaky, slow way to exercise both outcomes.
 * Using two deliberately lopsided constructions instead -- a huge edge
 * resolves fast and decisively regardless of direction (see game.test.ts/
 * combat.test.ts's own similar patterns) -- tests resolveEncounter's own
 * wiring (Heat/reward-tier/quarantine mechanics) directly, without
 * needing seed-sweep luck to hit both outcomes.
 */
function playerWithBurst(amount: number): RunPlayerState {
  return {
    classId: 'breacher',
    installedLoadout: [
      {
        id: 'test-player-burst',
        name: 'test-player-burst',
        archetype: 'exploit',
        trigger: { kind: 'always' },
        payload: { kind: 'directBurst', amount },
        tags: [],
      } satisfies SubroutineDefinition,
    ],
  };
}

const OVERWHELMING_PLAYER = playerWithBurst(50);
const NEGLIGIBLE_PLAYER = playerWithBurst(0.1);
const SEEDS = [1, 2, 3];

function winOutcomes(nodeType: 'regularFight' | 'eliteFight' | 'gatekeeperFight') {
  const node = createNode('n', nodeType);
  return SEEDS.map((seed) => resolveEncounter(node, createRng(seed), OVERWHELMING_PLAYER));
}

function lossOutcomes(nodeType: 'regularFight' | 'eliteFight' | 'gatekeeperFight') {
  const node = createNode('n', nodeType);
  return SEEDS.map((seed) => resolveEncounter(node, createRng(seed), NEGLIGIBLE_PLAYER));
}

describe('resolveEncounter -- regularFight', () => {
  it('a win goes inert, never quarantines, costs 0 Heat, grants a standard reward', () => {
    for (const outcome of winOutcomes('regularFight')) {
      expect(outcome.newState).toBe('inert');
      expect(outcome.quarantined).toBe(false);
      expect(outcome.heatDelta).toBe(0);
      expect(outcome.rewardTier).toBe('standard');
    }
  });

  it('a loss closes the node, costs Heat, grants no reward', () => {
    for (const outcome of lossOutcomes('regularFight')) {
      expect(outcome.newState).toBe('closed');
      expect(outcome.quarantined).toBe(false);
      expect(outcome.heatDelta).toBeGreaterThan(0);
      expect(outcome.rewardTier).toBe('none');
    }
  });
});

describe('resolveEncounter -- eliteFight', () => {
  it('a win goes inert and grants a better reward', () => {
    for (const outcome of winOutcomes('eliteFight')) {
      expect(outcome.newState).toBe('inert');
      expect(outcome.rewardTier).toBe('better');
    }
  });

  it('a loss closes the node, costs Heat, grants no reward', () => {
    for (const outcome of lossOutcomes('eliteFight')) {
      expect(outcome.newState).toBe('closed');
      expect(outcome.heatDelta).toBeGreaterThan(0);
      expect(outcome.rewardTier).toBe('none');
    }
  });
});

describe('resolveEncounter -- gatekeeperFight', () => {
  it('quarantines on a loss with zero Heat cost, regardless of margin', () => {
    for (const outcome of lossOutcomes('gatekeeperFight')) {
      expect(outcome.quarantined).toBe(true);
      expect(outcome.heatDelta).toBe(0);
      expect(outcome.rewardTier).toBe('none');
    }
  });

  it('grants a better reward tier and never quarantines on a win', () => {
    for (const outcome of winOutcomes('gatekeeperFight')) {
      expect(outcome.newState).toBe('inert');
      expect(outcome.quarantined).toBe(false);
      expect(outcome.rewardTier).toBe('better');
    }
  });
});

describe('resolveEncounter -- non-fight nodes', () => {
  it('Safehouse Rest always reduces Heat and goes inert', () => {
    const outcome = resolveEncounter(createNode('n', 'safehouse'), createRng(1), OVERWHELMING_PLAYER);
    expect(outcome).toEqual({ newState: 'inert', heatDelta: -20, quarantined: false, rewardTier: 'none' });
  });

  it('Shop and Event are no-op stubs that go inert', () => {
    for (const type of ['shop', 'event'] as const) {
      const outcome = resolveEncounter(createNode('n', type), createRng(1), OVERWHELMING_PLAYER);
      expect(outcome).toEqual({ newState: 'inert', heatDelta: 0, quarantined: false, rewardTier: 'none' });
    }
  });

  it('throws for a Relay -- it has no encounter to resolve', () => {
    expect(() => resolveEncounter(createNode('n', 'relay'), createRng(1), OVERWHELMING_PLAYER)).toThrow();
  });
});
