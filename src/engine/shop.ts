import type { SubroutineDefinition } from './subroutine-types';
import type { RunPlayerState } from './run';
import type { ClassId } from './classes';
import { rarityOf, rewardPoolForClass, type Rarity } from './rewards';

/**
 * Shop wiring (Phase 4 checkpoint F): spends Data on a specific pick,
 * not a random offer -- the same reward-pool scoping Checkpoint C's
 * combat rewards use (rewards.ts's rewardPoolForClass), but every piece
 * offered at once rather than a rarity-weighted N-of-pool draw. Any
 * rarity is purchasable; the session's resolved open question gates
 * access by a steeply-scaling Data cost per tier instead of an
 * availability restriction, keeping the Shop mechanically simple and
 * turning rarity into an economic choice rather than walled-off
 * content.
 */

// Steeply scaling, not linear -- TBD/playtesting, same placeholder
// treatment as every other numeric constant in this project.
const SHOP_COST_BY_RARITY: Record<Rarity, number> = {
  common: 20,
  uncommon: 60,
  rare: 150,
};

export function shopCostOf(id: string): number {
  return SHOP_COST_BY_RARITY[rarityOf(id)];
}

export interface ShopOffering {
  piece: SubroutineDefinition;
  cost: number;
}

/** The Shop's full offering for a class -- every piece in its reward
 * pool, each tagged with its Data cost. */
export function shopOfferingsForClass(classId: ClassId): ShopOffering[] {
  return rewardPoolForClass(classId).map((piece) => ({ piece, cost: shopCostOf(piece.id) }));
}

/** Decides which (if any) Shop offering a script buys. Returns null to
 * decline (or when nothing is affordable). Mirrors AcquisitionStrategy/
 * SafehouseStrategy's own "legal-not-good scripted decision" pattern. */
export type ShopStrategy = (offerings: ShopOffering[], playerState: RunPlayerState) => ShopOffering | null;

/** Legal-not-good default: buys whichever affordable offering costs the
 * least, or declines if nothing is affordable. Ties broken by pool
 * order -- no rarity/synergy judgment. */
export const buyCheapestAffordable: ShopStrategy = (offerings, playerState) => {
  const affordable = offerings.filter((offering) => offering.cost <= playerState.data);
  if (affordable.length === 0) return null;
  return affordable.reduce((cheapest, offering) => (offering.cost < cheapest.cost ? offering : cheapest));
};
