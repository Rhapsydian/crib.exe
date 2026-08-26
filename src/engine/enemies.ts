import type { Archetype, SubroutineDefinition } from './subroutine-types';
import { ALL_POOL_SUBROUTINES } from './subroutines';

/**
 * Enemy type system (Phase 5 checkpoint A, session 27's `/decision-session`
 * design). Enemies are a real, named roster with identity -- structurally
 * close to player classes (classes.ts's ClassDefinition) rather than
 * procedural generation. See DESIGN.md's "Enemy Design"/"The Roster"
 * sections for the full design writeup and BACKLOG.md's Phase 5 spec for
 * the checkpoint breakdown this file implements.
 */

export type EnemyTier = 'regular' | 'elite' | 'gatekeeper';

/** One id per named enemy in the roster (checkpoint D fills in the real
 * EnemyDefinition data). Deliberately allowed to collide with a
 * subroutine id in subroutines.ts (e.g. 'script-kiddie', 'total-compromise')
 * when an enemy is named after its own signature piece -- different
 * keyspaces (ENEMY_DEFINITIONS vs ALL_POOL_SUBROUTINES), never looked up
 * interchangeably. */
export type EnemyId =
  // Regular (12)
  | 'script-kiddie'
  | 'fuzzer-bot'
  | 'botnet-node'
  | 'keylogger-process'
  | 'legacy-firewall'
  | 'access-gate'
  | 'drive-by-kit'
  | 'rogue-endpoint'
  | 'patch-runner'
  | 'perimeter-sentry'
  | 'quarantine-daemon'
  | 'hardened-workstation'
  // Elite (8)
  | 'zero-day-broker'
  | 'ransomware-deployment'
  | 'zero-trust-node'
  | 'compromised-ad-server'
  | 'hardened-perimeter'
  | 'blackout-cell'
  | 'backchannel-handler'
  | 'compromised-dependency'
  // Gatekeeper, layer 1 (3)
  | 'the-concierge'
  | 'firewall-prime'
  | 'ghost-process'
  // Gatekeeper, layer 2 (3)
  | 'incident-response'
  | 'the-quarantine-ward'
  | 'zero-sum'
  // Gatekeeper, layer 3 (3)
  | 'total-compromise'
  | 'adaptive-threat'
  | 'silent-corruption'
  // Gatekeeper, layer 4 (3)
  | 'null-session'
  | 'kernel-panic'
  | 'ghost-in-the-machine';

/** One id per named enemy passive (checkpoint B implements the actual
 * hook logic each of these drives; checkpoint D wires them onto
 * EnemyDefinition.passiveIds). 34 total across the 32 enemies (Blackout
 * Cell and Backchannel Handler each carry 2). */
export type EnemyPassiveId =
  // Regular
  | 'lucky-guess'
  | 'trial-and-error'
  | 'still-spreading'
  | 'long-runtime'
  | 'stubborn-default'
  | 'locked-down'
  | 'smash-and-grab'
  | 'opportunist'
  | 'cover-your-tracks'
  | 'hold-the-line'
  | 'steady-state'
  | 'grinds-you-down'
  // Elite
  | 'fresh-exploit'
  | 'escalating-demand'
  | 'no-exceptions'
  | 'infection-vector'
  | 'foothold-reinforced'
  | 'attrition'
  | 'held-together'
  | 'dead-drop-protocol'
  | 'off-the-grid'
  | 'sleeper-network'
  // Gatekeeper
  | 'reception-protocol'
  | 'no-way-in'
  | 'digital-ghost'
  | 'highest-bidder'
  | 'total-quarantine'
  | 'primed-to-strike'
  | 'cascading-failure'
  | 'adaptive-defense'
  | 'total-corruption'
  | 'null-session-passive'
  | 'redundant-kernel'
  | 'total-access';

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  tier: EnemyTier;
  /** Not locked to a fixed pair like ClassDefinition's [Archetype,
   * Archetype] -- session 27's decision: 2-archetype pairing is the
   * default but not a hard lock, single-archetype and bespoke 3+
   * archetype gatekeepers are both fine. */
  archetypes: Archetype[];
  /** The layer (1-4) this identity starts appearing at -- it stays in
   * its tier's pool at every layer afterward, not just this one. */
  minLayer: number;
  loadout: SubroutineDefinition[];
  /** 0-2 entries -- most enemies carry exactly one, a few Elites carry
   * two (session 27's "1-2 real passives" for that tier). */
  passiveIds: EnemyPassiveId[];
}

const SUBROUTINE_BY_ID: ReadonlyMap<string, SubroutineDefinition> = new Map(
  ALL_POOL_SUBROUTINES.map((subroutine) => [subroutine.id, subroutine]),
);

/** Looks up a real subroutine from the shared pool catalog by id --
 * throws immediately on a typo/missing id rather than silently shipping
 * a gap in an enemy's kit. Enemies draw straight from this catalog
 * (DESIGN.md: "subroutines can be drawn straight from the player's own
 * catalog... or be fully bespoke to one enemy") -- the session 27 roster
 * draft used only pool pieces, no bespoke subroutine content, so this is
 * the only lookup path checkpoint D needs. */
export function pool(id: string): SubroutineDefinition {
  const found = SUBROUTINE_BY_ID.get(id);
  if (!found) throw new Error(`enemies.ts: no pool subroutine with id "${id}"`);
  return found;
}
