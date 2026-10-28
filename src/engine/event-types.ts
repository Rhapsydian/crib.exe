import type { SubroutineDefinition } from './subroutine-types';
import type { ModDefinition } from './mod-types';
import type { BurnerDefinition } from './burner-types';
import type { Rarity } from './rewards';

/**
 * Event type system (Phase 5 checkpoint G, session 36-37's design). A
 * narrative vignette with 2-4 choices, resolved instantly -- no
 * Cribbage played (DESIGN.md's "Events" section). The last undesigned
 * Phase 3 stub node type, banked since session 3/7.
 */

/** A `transparent` choice states its exact cost/reward up front (one
 * outcome at probability 1); `visibleOdds` shows a probabilistic
 * outcome with the odds/range stated; `gamble` is genuinely unstated --
 * the engine resolves all three identically (a weighted roll against
 * `rng`), they differ only in what the UI tells the player beforehand.
 * Risk tier gates reward ceiling (DESIGN.md): only gamble-tier choices
 * can grant the pool's most powerful outcomes. */
export type EventRiskTier = 'transparent' | 'visibleOdds' | 'gamble';

/** A reward grant that either names a specific piece outright, or draws
 * randomly from the general pool filtered by rarity at resolution time
 * (checkpoint H) -- the fix session 37's content-validation pass
 * surfaced: a reward can't hardcode a specific piece id as the pool
 * grows, so grants need to support both. */
export type Grant<T> = { specific: T } | { randomFromRarity: Rarity };

/** Reuses existing resources/mechanisms wholesale (DESIGN.md's Events
 * "Effect pool") -- no new resource type. Every field is optional so a
 * genuine no-op outcome (`{}`) is representable without a sentinel. */
export interface EventEffect {
  /** Heat, in multiples of this layer's elite-loss charge (step 2,
   * checkpoint 6) -- resolved by heat.ts's `eventHeat`, so an Event keeps
   * its weight against the posted fight prices on every layer. Negative
   * cools. */
  heatLosses?: number;
  dataDelta?: number;
  subroutineGrant?: Grant<SubroutineDefinition>;
  modGrant?: Grant<ModDefinition>;
  /** A Burner: a named one, one of a rarity from the general pool, or a
   * random contraband one (session 64, BE5: offered only by Events). */
  burnerGrant?: Grant<BurnerDefinition> | { contraband: true };
  /** A classic gamble-tier beat: triggers a real fight for a bigger
   * payout (checkpoint I resolves it via resolveFight's own machinery). */
  bonusFight?: { tier: 'regular' | 'elite' };
  /** Upgrades the class Mod to its "II" version (session 65,
   * docs/design/mods.md M10-M11). */
  classModUpgrade?: true;
}

/** What an Event outcome actually granted, once rolled. */
export interface EventGrant {
  subroutine?: SubroutineDefinition;
  mod?: ModDefinition;
  burner?: BurnerDefinition;
  /** The class Mod was upgraded (session 65). */
  classModUpgrade?: true;
}

/** One roll-weighted branch of a choice's resolution. A `transparent`
 * choice has exactly one outcome at probability 1; `visibleOdds`/
 * `gamble` choices can have 2+ outcomes whose probabilities sum to 1. */
export interface WeightedOutcome {
  probability: number;
  effect: EventEffect;
  /** What happened, in a line of story (session 64, BE10). */
  text?: string;
}

export interface EventChoice {
  id: string;
  label: string;
  riskTier: EventRiskTier;
  /** Data you must have to take it (session 64): a choice that pays in
   * Data isn't available when you can't pay. */
  requiresData?: number;
  outcomes: WeightedOutcome[];
}

export interface EventDefinition {
  id: string;
  name: string;
  /** The scene that sets up the choice (session 64, BE10: never a bare
   * choice). */
  text: string;
  /** The first layer it can appear on (session 64): deeper Events carry
   * bigger stakes. Default 1. */
  minLayer?: number;
  choices: EventChoice[];
}
