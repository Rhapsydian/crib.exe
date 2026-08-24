import type { MapNode, NodeState } from './map-types';
import type { Rng } from './rng';
import type { SubroutineDefinition } from './subroutine-types';
import { playCombat } from './combat';
import { heatFromLoss } from './heat';

/**
 * Node encounter resolution (session 19/20 checkpoint E): the first
 * point where Phase 3 calls Phase 2's real playCombat() rather than an
 * injected win/loss stub. Small representative loadouts, same
 * infrastructure-complete/content-partial scope Phase 2 itself shipped
 * with -- tuning real per-node difficulty, and a real reward system, are
 * later content passes (Phase 4's material/acquisition system doesn't
 * exist yet -- see rewardTier below).
 */

const REST_HEAT_REDUCTION = 20; // TBD/playtesting

// Small representative loadouts (same alwaysBurst-style pattern as
// combat.test.ts) -- symmetric for a regular fight, so the outcome
// genuinely rides on the Cribbage play; the elite enemy loadout is
// deliberately heavier, for a fight that's actually harder to win.
function burstSubroutine(id: string, amount: number): SubroutineDefinition {
  return {
    id,
    name: id,
    archetype: 'exploit',
    trigger: { kind: 'always' },
    payload: { kind: 'instantBurst', amount },
    tags: [],
  };
}

const PLAYER_LOADOUT: SubroutineDefinition[] = [burstSubroutine('player-burst', 5)];
const ENEMY_LOADOUT_REGULAR: SubroutineDefinition[] = [burstSubroutine('enemy-burst', 5)];
// Breach/Containment is a positive-feedback race between two symmetric
// "always" bursts -- even a small per-fire edge compounds hard over a
// match (empirically, +1 already crushes the player to a ~2% win rate).
// 5.3 lands the player around a ~23% win rate against ~60% for a
// regular fight: meaningfully harder, not a near-guaranteed loss for a
// fight also charging a higher Heat cost.
const ENEMY_LOADOUT_ELITE: SubroutineDefinition[] = [burstSubroutine('enemy-elite-burst', 5.3)];
const GAUGE_THRESHOLD = 5;

/**
 * What tier of reward a won fight would grant once Phase 4's
 * acquisition system exists -- structurally recorded now (same "stub,
 * wired in later" treatment as Safehouse's Merge option), not actually
 * granting anything yet. Mirrors DESIGN.md's own reward-scoping
 * language: a regular fight offers a standard choice, an elite or
 * gatekeeper fight offers a better one.
 */
export type RewardTier = 'none' | 'standard' | 'better';

export interface EncounterOutcome {
  newState: NodeState;
  heatDelta: number;
  quarantined: boolean;
  rewardTier: RewardTier;
}

type FightKind = 'regular' | 'elite' | 'gatekeeper';

function resolveFight(kind: FightKind, rng: Rng): EncounterOutcome {
  const enemyLoadout = kind === 'elite' ? ENEMY_LOADOUT_ELITE : ENEMY_LOADOUT_REGULAR;
  const seed = rng.nextInt(2 ** 31);
  const result = playCombat([PLAYER_LOADOUT, enemyLoadout], { seed, gaugeThreshold: GAUGE_THRESHOLD });

  if (result.winner === 0) {
    const rewardTier: RewardTier = kind === 'regular' ? 'standard' : 'better';
    return { newState: 'inert', heatDelta: 0, quarantined: false, rewardTier };
  }
  if (kind === 'gatekeeper') {
    // Quarantine ends the run outright -- no Heat cost, and the node's
    // state doesn't matter (there's no run left to route around it in).
    return { newState: 'unresolved', heatDelta: 0, quarantined: true, rewardTier: 'none' };
  }
  return {
    newState: 'closed',
    heatDelta: heatFromLoss(kind, result.peakBreachContainment),
    quarantined: false,
    rewardTier: 'none',
  };
}

export function resolveEncounter(node: MapNode, rng: Rng): EncounterOutcome {
  switch (node.type) {
    case 'regularFight':
      return resolveFight('regular', rng);
    case 'eliteFight':
      return resolveFight('elite', rng);
    case 'gatekeeperFight':
      return resolveFight('gatekeeper', rng);
    case 'safehouse':
      // Rest is real; Merge stays a stub -- structurally a node type, but
      // not a selectable action until Phase 4's material/acquisition
      // system exists.
      return { newState: 'inert', heatDelta: -REST_HEAT_REDUCTION, quarantined: false, rewardTier: 'none' };
    case 'shop':
    case 'event':
      return { newState: 'inert', heatDelta: 0, quarantined: false, rewardTier: 'none' };
    case 'relay':
      throw new Error('resolveEncounter should never be called on a Relay node -- it has no encounter');
  }
}
