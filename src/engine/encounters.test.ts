import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createNode } from './map-types';
import { resolveEncounter } from './encounters';
import type { RunPlayerState } from './run';
import type { SubroutineDefinition } from './subroutine-types';
import { BREACHER_LOADOUT } from './subroutines';

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
 *
 * The win side uses Breacher's *real* starting kit with only Buffer
 * Overflow's magnitude scaled up -- Session Lock and Steady Hand stay
 * at their real, unscaled values, so this still exercises real trigger
 * timing (Occurrence: Run, Self-state: isDealer) and the real capped
 * instantCounterPush/midpoint-cap mechanic, not just a synthetic
 * single-piece stand-in. Confirmed empirically (debug sweep) to still
 * resolve in single-digit hands at this magnitude.
 *
 * The loss side can't use the same trick: with Session Lock/Steady
 * Hand's real defensive pieces left in, the fight doesn't resolve at
 * all within 20,000 hands regardless of how small Buffer Overflow's own
 * burst is -- the capped counter-push pair alone is enough to stalemate
 * indefinitely against the current (placeholder) enemy tuning. Forcing
 * a fast loss would require either stripping the defensive pieces (no
 * longer "real Breacher shape") or an enemy stronger than any fight
 * tier currently uses -- both are tuning questions for Phase 5, not
 * something to bake into this test. Falls back to a synthetic
 * single-piece negligible dummy instead.
 */
function overwhelmingBreacherLoadout(burstAmount: number): SubroutineDefinition[] {
  return BREACHER_LOADOUT.map((piece) =>
    piece.id === 'buffer-overflow' ? { ...piece, payload: { ...piece.payload, amount: burstAmount } } : piece,
  );
}

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

const OVERWHELMING_PLAYER: RunPlayerState = { classId: 'breacher', installedLoadout: overwhelmingBreacherLoadout(30) };
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
