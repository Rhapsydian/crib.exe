import type { Archetype, SubroutineDefinition } from './subroutine-types';
import { EXPLOIT_POOL } from './content/exploit';
import { DAEMON_POOL } from './content/daemon';
import { OVERCLOCK_POOL } from './content/overclock';
import { HONEYPOT_POOL } from './content/honeypot';
import { AUTHORED_STARTING_LOADOUTS } from './content/starting-loadouts';

/**
 * The player's subroutine pool (step 3, `docs/authoring-design.md`): the
 * 36 authored pieces, 9 per archetype (4 common, 3 uncommon, 2 rare;
 * S5), priced against DESIGN.md -> Pricing. Definitions live in
 * content/<archetype>.ts. Replaced the session-51 skeleton pool, retired
 * with the skeleton enemy roster once the authored roster was wired in.
 *
 * Rarity is encoded structurally -- by which array a piece lives in --
 * rather than as a SubroutineDefinition field (rewards.ts derives its
 * lookup from these arrays).
 */

export interface ArchetypePool {
  commons: SubroutineDefinition[];
  uncommons: SubroutineDefinition[];
  rares: SubroutineDefinition[];
}

export const ARCHETYPE_POOLS: Record<Archetype, ArchetypePool> = {
  exploit: EXPLOIT_POOL,
  daemon: DAEMON_POOL,
  overclock: OVERCLOCK_POOL,
  honeypot: HONEYPOT_POOL,
};

export const ALL_POOL_SUBROUTINES: SubroutineDefinition[] = Object.values(ARCHETYPE_POOLS).flatMap((pool) => [
  ...pool.commons,
  ...pool.uncommons,
  ...pool.rares,
]);

/** The classes' starting loadouts: commons only, in loadout order (C3;
 * content/starting-loadouts.ts). Pool pieces, so drawing one again later
 * becomes Merge material rather than a dead offer. */
export const CLASS_STARTING_LOADOUTS = AUTHORED_STARTING_LOADOUTS;

export const ALL_SUBROUTINES: SubroutineDefinition[] = ALL_POOL_SUBROUTINES;
