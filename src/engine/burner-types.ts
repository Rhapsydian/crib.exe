import type { PayloadEffect } from './subroutine-types';
import type { Rarity } from './rewards';

/**
 * Burner type system (Phase 5 checkpoint A, session 36-37's design).
 * Single-use, player-activated-at-will items -- crib.exe's StS-Potion
 * equivalent. A capped inventory, no bench/installed split (DESIGN.md's
 * "Burners" section, "Inventory") -- unlike Mods (mod-types.ts), which
 * this file otherwise mirrors closely.
 *
 * One id per Burner -- the 8 validated Burners from session 37's
 * content-validation pass (BACKLOG.md's "Burners + Events
 * Implementation" write-up), authored for real in burners.ts.
 */
export type BurnerId =
  // Combat (2)
  | 'flash-drive'
  | 'emp-charge'
  // Map (3)
  | 'recon-ping'
  | 'ghost-protocol'
  | 'skeleton-key'
  // Shop (3)
  | 'stolen-coupon'
  | 'loyalty-token'
  | 'insider-tip';

/** A Burner can be usable in more than one context -- each context maps
 * to one optional effect field on BurnerDefinition below. */
export type BurnerContext = 'combat' | 'map' | 'shop';

/** Map-context effects (session 37): a free move (skips that move's flat
 * Heat cost), revealing upcoming node types, or reopening a previously
 * closed node (session 9's long-banked idea, finally resolved). */
export type MapBurnerEffect = { kind: 'freeMove' } | { kind: 'revealUpcoming' } | { kind: 'reopenClosedNode' };

/** Shop-context "coupon" effects (session 37): a fractional discount, a
 * free reroll, or a guaranteed rarity floor on the next purchase. */
export type ShopBurnerEffect =
  | { kind: 'discount'; fraction: number }
  | { kind: 'freeReroll' }
  | { kind: 'rarityFloor'; rarity: Rarity };

export interface BurnerDefinition {
  id: BurnerId;
  name: string;
  rarity: Rarity;
  contexts: BurnerContext[];
  /** Only present when contexts includes 'combat' -- reuses PayloadEffect
   * wholesale (session 37: confirmed against the actual engine, no new
   * payload kinds needed), resolved via resolve.ts's exported
   * resolvePayload so a Burner fire gets the same Primed/onFire passive
   * interactions as any other payload resolution. */
  combatEffect?: PayloadEffect;
  /** Only present when contexts includes 'map'. */
  mapEffect?: MapBurnerEffect;
  /** Only present when contexts includes 'shop'. */
  shopEffect?: ShopBurnerEffect;
}
