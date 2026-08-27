import type { SubroutineDefinition } from './subroutine-types';
import type { RunPlayerState } from './run';
import type { ClassId } from './classes';
import type { Rng } from './rng';
import { rarityOf, rewardPoolForClass, type Rarity } from './rewards';
import type { ModDefinition, ModId } from './mod-types';
import { modPoolForClass } from './mods';

/**
 * Shop wiring (Phase 4 checkpoint F): spends Data on a specific pick,
 * not a random N-of-pool combat-reward-style draw -- the player sees
 * (and picks from) a fixed slate up front, same reward-pool scoping as
 * Checkpoint C's combat rewards (rewards.ts's rewardPoolForClass). Any
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

/** `discountFraction` (Vendor Discount, Mods checkpoint E/H) knocks a
 * flat percentage off the base price, rounded to the nearest whole Data. */
export function shopCostOf(id: string, discountFraction = 0): number {
  return Math.round(SHOP_COST_BY_RARITY[rarityOf(id)] * (1 - discountFraction));
}

export interface ShopOffering {
  piece: SubroutineDefinition;
  cost: number;
}

const SHOP_COMMON_SLOTS = 3;

function poolByRarity(classId: ClassId): Record<Rarity, SubroutineDefinition[]> {
  const pool = rewardPoolForClass(classId);
  return {
    common: pool.filter((piece) => rarityOf(piece.id) === 'common'),
    uncommon: pool.filter((piece) => rarityOf(piece.id) === 'uncommon'),
    rare: pool.filter((piece) => rarityOf(piece.id) === 'rare'),
  };
}

/** Uniform sampling without replacement -- unlike rewards.ts's combat-
 * reward draw, the Shop's slate isn't rarity-weighted (each slot here
 * already pins its own rarity), just a random pick within that tier. */
function sampleDistinct<T>(items: T[], count: number, rng: Rng): T[] {
  const pool = items.slice();
  const picked: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = rng.nextInt(pool.length);
    picked.push(pool[index]);
    pool.splice(index, 1);
  }
  return picked;
}

/** The Shop's slate for one visit: 3 commons (+ `extraCommons`, Bulk
 * Buyer, Mods checkpoint E/H), 1 uncommon, and one more slot that's a
 * coin flip between another uncommon or a rare -- a fixed-size random
 * subset of the class's reward pool, not the whole thing (that would
 * make Data a non-choice once a player could afford everything).
 * Re-rolled fresh from `rng` each visit. `discountFraction` (Vendor
 * Discount) is applied per-offering via shopCostOf. */
export function shopOfferingsForClass(classId: ClassId, rng: Rng, extraCommons = 0, discountFraction = 0): ShopOffering[] {
  const byRarity = poolByRarity(classId);
  const commons = sampleDistinct(byRarity.common, SHOP_COMMON_SLOTS + extraCommons, rng);
  const uncommon = sampleDistinct(byRarity.uncommon, 1, rng);

  const wildcardTier: Rarity = rng.next() < 0.5 ? 'uncommon' : 'rare';
  const wildcardPool =
    wildcardTier === 'uncommon' ? byRarity.uncommon.filter((piece) => !uncommon.some((picked) => picked.id === piece.id)) : byRarity.rare;
  const wildcard = sampleDistinct(wildcardPool, 1, rng);

  return [...commons, ...uncommon, ...wildcard].map((piece) => ({ piece, cost: shopCostOf(piece.id, discountFraction) }));
}

// ---------------------------------------------------------------------
// Mods' own independent Shop slate (Phase 5 Mods checkpoint G, session
// 30: "two independent slates in one Shop visit... both spending from
// the same Data pool"). Same shape as the subroutine slate above (3
// commons/1 uncommon/1 wildcard), its own separate reroll.
// ---------------------------------------------------------------------

// TBD/playtesting, same relative scaling as SHOP_COST_BY_RARITY.
const MOD_SHOP_COST_BY_RARITY: Record<Rarity, number> = {
  common: 25,
  uncommon: 70,
  rare: 175,
};

export interface ModOffering {
  mod: ModDefinition;
  cost: number;
}

export function modShopCostOf(rarity: Rarity, discountFraction = 0): number {
  return Math.round(MOD_SHOP_COST_BY_RARITY[rarity] * (1 - discountFraction));
}

function modPoolByRarity(classId: ClassId, ownedModIds: ModId[]): Record<Rarity, ModDefinition[]> {
  const pool = modPoolForClass(classId, ownedModIds);
  return {
    common: pool.filter((mod) => mod.rarity === 'common'),
    uncommon: pool.filter((mod) => mod.rarity === 'uncommon'),
    rare: pool.filter((mod) => mod.rarity === 'rare'),
  };
}

export function modOfferingsForClass(classId: ClassId, ownedModIds: ModId[], rng: Rng, extraCommons = 0, discountFraction = 0): ModOffering[] {
  const byRarity = modPoolByRarity(classId, ownedModIds);
  const commons = sampleDistinct(byRarity.common, SHOP_COMMON_SLOTS + extraCommons, rng);
  const uncommon = sampleDistinct(byRarity.uncommon, 1, rng);

  const wildcardTier: Rarity = rng.next() < 0.5 ? 'uncommon' : 'rare';
  const wildcardPool =
    wildcardTier === 'uncommon' ? byRarity.uncommon.filter((mod) => !uncommon.some((picked) => picked.id === mod.id)) : byRarity.rare;
  const wildcard = sampleDistinct(wildcardPool, 1, rng);

  return [...commons, ...uncommon, ...wildcard].map((mod) => ({ mod, cost: modShopCostOf(mod.rarity, discountFraction) }));
}

/** Decides which (if any) Mod offering a script buys -- mirrors
 * ShopStrategy for the parallel Mod slate. */
export type ModShopStrategy = (offerings: ModOffering[], playerState: RunPlayerState) => ModOffering | null;

/** Legal-not-good default, same shape as buyCheapestAffordable. */
export const buyCheapestAffordableMod: ModShopStrategy = (offerings, playerState) => {
  const affordable = offerings.filter((offering) => offering.cost <= playerState.data);
  if (affordable.length === 0) return null;
  return affordable.reduce((cheapest, offering) => (offering.cost < cheapest.cost ? offering : cheapest));
};

/** Decides whether to spend REROLL_COST to reroll the Mod slate once --
 * mirrors ShopRerollStrategy, its own independent reroll (session 30:
 * "not one combined slate/reroll... different gambles over different
 * pools"). */
export type ModShopRerollStrategy = (offerings: ModOffering[], playerState: RunPlayerState) => boolean;

export const rerollModIfNothingAffordable: ModShopRerollStrategy = (offerings, playerState) => {
  const canAffordReroll = playerState.data >= REROLL_COST;
  const canAffordSomething = offerings.some((offering) => offering.cost <= playerState.data);
  return canAffordReroll && !canAffordSomething;
};

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

// Marginal -- well under even a common's cost (20), so it's a cheap
// hedge against a bad roll, not a real purchase in its own right.
// TBD/playtesting.
export const REROLL_COST = 10;

/** Decides whether to spend REROLL_COST to reroll the current slate
 * once before buying -- resolveEncounter enforces the "once" itself (it
 * only ever asks this against the first slate, never the rerolled
 * one), so this only has to answer yes/no for a single offered slate. */
export type ShopRerollStrategy = (offerings: ShopOffering[], playerState: RunPlayerState) => boolean;

/** Legal-not-good default: reroll only when the current slate has
 * nothing affordable at all and the reroll itself is affordable --
 * a hedge against a wasted visit, not a search for a better deal. */
export const rerollIfNothingAffordable: ShopRerollStrategy = (offerings, playerState) => {
  const canAffordReroll = playerState.data >= REROLL_COST;
  const canAffordSomething = offerings.some((offering) => offering.cost <= playerState.data);
  return canAffordReroll && !canAffordSomething;
};
