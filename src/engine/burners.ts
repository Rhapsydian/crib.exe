import type { BurnerDefinition, BurnerId } from './burner-types';

/**
 * Burner content (Phase 5 checkpoint A): the 8 validated Burners from
 * session 37's content-validation table. Mirrors mods.ts's data half --
 * this file is the roster (id, name, rarity, contexts, effects); state
 * threading/acquisition logic lives in run.ts/shop.ts/combat.ts
 * (checkpoints B-F).
 *
 * All magnitudes are TBD/playtesting placeholders, same discipline as
 * every other numeric constant in this project. Combat-effect magnitudes
 * reuse subroutines.ts's own COMMON/UNCOMMON/RARE burst tiers (5/8/13)
 * directly, since combat-context Burners resolve like any other payload.
 */

export const BURNER_CAP = 3; // TBD/playtesting -- mirrors StS's own 2-3 potion slots (DESIGN.md)

/** Stolen Coupon's discount fraction. */
export const STOLEN_COUPON_DISCOUNT_FRACTION = 0.25;

export const BURNER_DEFINITIONS: Record<BurnerId, BurnerDefinition> = {
  // --- Combat (2) ---
  'flash-drive': {
    id: 'flash-drive',
    name: 'Flash Drive',
    rarity: 'common',
    contexts: ['combat'],
    combatEffect: { kind: 'directBurst', amount: 5 },
  },
  'emp-charge': {
    id: 'emp-charge',
    name: 'EMP Charge',
    rarity: 'uncommon',
    contexts: ['combat'],
    combatEffect: { kind: 'instantCounterPush', amount: 8 },
  },

  // --- Map (3) ---
  'recon-ping': {
    id: 'recon-ping',
    name: 'Recon Ping',
    rarity: 'common',
    contexts: ['map'],
    mapEffect: { kind: 'revealUpcoming' },
  },
  'ghost-protocol': {
    id: 'ghost-protocol',
    name: 'Ghost Protocol',
    rarity: 'uncommon',
    contexts: ['map'],
    mapEffect: { kind: 'freeMove' },
  },
  'skeleton-key': {
    id: 'skeleton-key',
    name: 'Skeleton Key',
    rarity: 'rare',
    contexts: ['map'],
    mapEffect: { kind: 'reopenClosedNode' },
  },

  // --- Shop (3) ---
  'stolen-coupon': {
    id: 'stolen-coupon',
    name: 'Stolen Coupon',
    rarity: 'common',
    contexts: ['shop'],
    shopEffect: { kind: 'discount', fraction: STOLEN_COUPON_DISCOUNT_FRACTION },
  },
  'loyalty-token': {
    id: 'loyalty-token',
    name: 'Loyalty Token',
    rarity: 'uncommon',
    contexts: ['shop'],
    shopEffect: { kind: 'freeReroll' },
  },
  'insider-tip': {
    id: 'insider-tip',
    name: 'Insider Tip',
    rarity: 'rare',
    contexts: ['shop'],
    shopEffect: { kind: 'rarityFloor', rarity: 'rare' },
  },
};

/** The general Burner pool -- archetype-agnostic by default (DESIGN.md:
 * "not tied to the 4 archetypes"), unlike Mods' targeted-archetype
 * exclusion. No class-scoping needed at all. */
export function generalBurnerPool(): BurnerDefinition[] {
  return Object.values(BURNER_DEFINITIONS);
}
