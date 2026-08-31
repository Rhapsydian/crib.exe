import type { SubroutineDefinition, SuitedArchetype } from './subroutine-types';
import type { Rarity } from './rewards';

/**
 * Mod type system (Phase 5 checkpoint A, session 30-33's design).
 * Permanent, always-on effects the player accumulates over a run --
 * crib.exe's StS-relic equivalent. No loadout slot, no install/bench
 * split, no ordering, no cap (DESIGN.md's Mods section, "Ownership").
 *
 * One id per Mod -- the 6 class-exclusive starting passives (session 11,
 * migrated onto this infrastructure by checkpoint D), the 17 validated
 * Mods (session 32's content-validation table, authored for real by
 * checkpoint H), and 17 more from the Mod Pool Expansion (session 44),
 * doubling the general pool to 34.
 */
export type ModId =
  // Class-exclusive starting passives (checkpoint D)
  | 'foothold'
  | 'zero-day'
  | 'sleeper-cell'
  | 'primed'
  | 'feedback-loop'
  | 'return-to-sender'
  // Common (7)
  | 'static-shield'
  | 'light-footing'
  | 'warm-boot'
  | 'vendor-discount'
  | 'early-momentum'
  | 'backup-generator'
  | 'petty-cache'
  // Uncommon (6)
  | 'tagged-firmware'
  | 'malware-amplifier'
  | 'redundant-ticks'
  | 'salvage-protocol'
  | 'overclocked-accumulator'
  | 'bulk-buyer'
  // Rare (4)
  | 'auxiliary-process'
  | 'rootkit-persistence'
  | 'failsafe-cascade'
  | 'black-budget'
  // Common (Mod Pool Expansion, session 44, +7)
  | 'cold-boot'
  | 'quiet-hours'
  | 'surge-protector'
  | 'first-contact'
  | 'petty-theft'
  | 'boot-sector'
  | 'init-script'
  // Uncommon (Mod Pool Expansion, session 44, +6)
  | 'exploit-amplifier'
  | 'encryption-amplifier'
  | 'root-amplifier'
  | 'fast-learner'
  | 'threshold-exploit'
  | 'scrap-merchant'
  // Rare (Mod Pool Expansion, session 44, +4)
  | 'redline'
  | 'heat-sink'
  | 'backdoor-access'
  | 'session-hijack-relay';

/**
 * Two engine mechanisms, split by effect shape (session 30) -- not a
 * third bespoke system:
 * - 'reactiveSubroutine': authors as a real SubroutineDefinition, fired
 *   outside the loadout entirely (no slot, no order), always evaluated
 *   alongside installedLoadout (checkpoint B).
 * - 'hook': extends the light passive registry (resolve.ts's
 *   hasEnemyPassive-style dispatch) to a player-side ownedModIds list,
 *   with hook logic hand-written in resolve.ts (combat-scoped) or the
 *   run-level dispatch (checkpoint E) -- same "dispatch mechanism, not a
 *   declarative DSL" philosophy the enemy-passive registry already uses.
 */
export type ModEffectKind = 'reactiveSubroutine' | 'hook';

export interface ModDefinition {
  id: ModId;
  name: string;
  rarity: Rarity;
  effectKind: ModEffectKind;
  /** Only present for effectKind 'reactiveSubroutine' -- the real
   * SubroutineDefinition this Mod fires outside the loadout entirely, no
   * slot/order (e.g. Rootkit Persistence). */
  reactiveSubroutine?: SubroutineDefinition;
  /** Only present for an effectKind 'hook' Mod that uses the
   * onModAcquired granted-subroutine mechanism (session 31): a real
   * SubroutineDefinition inserted into installedLoadout at acquisition
   * time, cap-exempt and removal-locked via RunPlayerState.grantedByMod
   * (e.g. Auxiliary Process). Distinct from reactiveSubroutine -- this
   * one genuinely lives inside loadout ordering/chaining, that one never
   * does. */
  grantedSubroutine?: SubroutineDefinition;
  /** A Mod tied heavily to one specific archetype (including an
   * archetype-flavored reactiveSubroutine Mod) is excluded from a
   * class's reward/Shop pool when that archetype isn't one of the
   * class's own 2 specializations (session 30's "targeted archetype
   * exclusion" -- the same "don't ship a structurally dead piece"
   * concern the Neutral Archetype addressed). Absent for the general,
   * archetype-agnostic majority of the pool. */
  archetype?: SuitedArchetype;
  /** True for the 6 class-exclusive starting passives (checkpoint D) --
   * granted automatically at run start by class selection, never
   * appearing in the general reward/Shop pool (session 30). */
  classExclusive?: boolean;
}
