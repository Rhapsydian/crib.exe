import type { Effect, SubroutineDefinition } from './subroutine-types';
import type { Rarity } from './rewards';

/**
 * Burner type system (Phase 5 checkpoint A, session 36-37's design).
 * Single-use, player-activated-at-will items -- crib.exe's StS-Potion
 * equivalent. A capped inventory, no bench/installed split (DESIGN.md's
 * "Burners" section, "Inventory") -- unlike Mods (mod-types.ts), which
 * this file otherwise mirrors closely.
 *
 * One id per Burner, authored in burners.ts. Session 64 reworked the pool
 * (docs/burners-events-design.md BE1-BE7): lumps, rule-benders,
 * temporary subroutines, Heat tools on the map, and Event-only contraband.
 */
export type BurnerId =
  // Combat: lumps (session 64, BE1)
  | 'flash-drive'
  | 'emp-charge'
  | 'patch-tuesday'
  // Combat: rule-benders
  | 'packet-storm'
  | 'noise-floor'
  | 'overclock-script'
  | 'zero-day'
  // Combat: temporary subroutines (BE3)
  | 'bootstrap-loader'
  | 'logic-bomb'
  | 'honeynet-shim'
  // Map: Heat tools (BE4)
  | 'ghost-protocol'
  | 'restore-point'
  | 'log-wiper'
  | 'proxy-chain'
  | 'spoofed-credentials'
  | 'tunnel'
  // Shop
  | 'stolen-coupon'
  | 'loyalty-token'
  | 'insider-tip'
  // Sell-only (session 61): no use; worth Data at a Shop
  | 'cold-wallet'
  // Contraband: offered only by Events (BE5)
  | 'denial-of-service'
  | 'botnet'
  | 'golden-ticket'
  | 'kill-switch';

/** A Burner can be usable in more than one context -- each context maps
 * to one optional effect field on BurnerDefinition below. */
export type BurnerContext = 'combat' | 'map' | 'shop';

/** When an armed combat Burner acts (session 64, BE2): "Now" as soon as
 * it is committed -- with your next decision in the fight, a discard or a
 * card -- or "Next turn", at the start of your next turn. */
export type BurnerTiming = 'now' | 'nextTurn';

/** What a combat Burner does (BE1, BE3). */
export type CombatBurnerEffect =
  /** A lump: one verb effect, resolved like any subroutine's. */
  | { kind: 'effect'; effect: Effect }
  /** For the rest of this hand, each of your fifteens / pairs also does
   * `effect`. */
  | { kind: 'handBonus'; category: 'fifteen' | 'pair'; effect: Effect; hands?: number }
  /** For your next `turns` turns, your loadout fires twice. */
  | { kind: 'fireTwice'; turns: number }
  /** For `hands` hands (this one included), every Hook in your loadout
   * goes off and applies twice. */
  | { kind: 'hooksTwice'; hands: number }
  /** The enemy's next `turns` turns are skipped. */
  | { kind: 'skipEnemyTurn'; turns: number }
  /** The enemy's Containment drops by this fraction of its progress. */
  | { kind: 'drainEnemy'; fraction: number }
  /** A temporary subroutine at the top or bottom of your loadout, firing
   * `fires` turns (an extra slot; one at a time; gone by the fight's end). */
  | { kind: 'tempSubroutine'; subroutine: SubroutineDefinition; position: 'top' | 'bottom'; fires: number };

/** Map-context effects (BE4): free moves, Heat now, the next fight's
 * Heat, the next gatekeeper's Heat toll, a pass-through, a reopened node. */
export type MapBurnerEffect =
  | { kind: 'freeMoves'; count: number }
  | { kind: 'lowerHeat'; amount: number }
  | { kind: 'nextFightHeat'; multiplier: number; fights: number }
  /** `clearHeat`: your Heat also drops to 0, now (Golden Ticket). */
  | { kind: 'nextGatekeeperToll'; multiplier: number; clearHeat?: boolean }
  | { kind: 'tunnel' }
  | { kind: 'reopenClosedNode' };

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
  /** The player-facing text, authored (session 64; the user's wording). */
  text: string;
  /** Only present when contexts includes 'combat'. */
  combat?: { timing: BurnerTiming; effect: CombatBurnerEffect };
  /** Only present when contexts includes 'map'. */
  mapEffect?: MapBurnerEffect;
  /** Only present when contexts includes 'shop'. */
  shopEffect?: ShopBurnerEffect;
  /** What it sells for at a Shop, when not the usual half its buying
   * price -- Cold Wallet's whole point (session 61). */
  sellValue?: number;
  /** Offered only by Events, never in Shops or fight rewards (BE5). */
  contraband?: boolean;
  /** Works by itself, never activated (session 68: Restore Point); kept, not
   * sold as a no-use Burner. */
  passive?: true;
}
