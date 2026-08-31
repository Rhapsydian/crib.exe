import type { SubroutineDefinition } from './subroutine-types';
import type { RunPlayerState } from './run';
import type { ClassId } from './classes';
import type { Rng } from './rng';
import { rarityOf, rewardPoolForClass, type Rarity } from './rewards';
import type { ModDefinition, ModId } from './mod-types';
import { bestModByLadder, modPoolForClass } from './mods';
import type { BurnerDefinition, BurnerId } from './burner-types';
import { bestBurnerByLadder, generalBurnerPool } from './burners';
import { bestByLadder } from './loadout';

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

// Data thresholds used by run.ts's opportunisticTraversal to decide
// whether a Shop detour is worth pulling toward (high) or counts as one
// of the three "nothing worth detouring for" conditions behind an Event
// pull (low) -- TBD/playtesting. High sits comfortably above a common
// piece's own cost; low sits below REROLL_COST, i.e. can't do much of
// anything at the Shop yet.
export const DATA_HIGH_THRESHOLD = 30;
export const DATA_LOW_THRESHOLD = 8;

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
 * Buyer, Mods checkpoint E/H), 1 uncommon (+ `extraUncommons`, Scrap
 * Merchant, session 44), and one more slot that's a coin flip between
 * another uncommon or a rare -- a fixed-size random subset of the
 * class's reward pool, not the whole thing (that would make Data a
 * non-choice once a player could afford everything). Re-rolled fresh
 * from `rng` each visit. `discountFraction` (Vendor Discount) is applied
 * per-offering via shopCostOf. */
export function shopOfferingsForClass(
  classId: ClassId,
  rng: Rng,
  extraCommons = 0,
  extraUncommons = 0,
  discountFraction = 0,
  rarityFloor?: Rarity,
): ShopOffering[] {
  const byRarity = poolByRarity(classId);
  const commons = sampleDistinct(byRarity.common, SHOP_COMMON_SLOTS + extraCommons, rng);
  const uncommon = sampleDistinct(byRarity.uncommon, 1 + extraUncommons, rng);

  // Insider Tip (Burners checkpoint E): a 'rare' floor forces the
  // wildcard slot to be rare outright instead of the normal 50/50 coin
  // flip. A 'common'/'uncommon' floor needs no special case -- the
  // wildcard slot already guarantees uncommon-or-better every visit.
  const wildcardTier: Rarity = rarityFloor === 'rare' ? 'rare' : rng.next() < 0.5 ? 'uncommon' : 'rare';
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

export function modOfferingsForClass(
  classId: ClassId,
  ownedModIds: ModId[],
  rng: Rng,
  extraCommons = 0,
  extraUncommons = 0,
  discountFraction = 0,
  rarityFloor?: Rarity,
): ModOffering[] {
  const byRarity = modPoolByRarity(classId, ownedModIds);
  const commons = sampleDistinct(byRarity.common, SHOP_COMMON_SLOTS + extraCommons, rng);
  const uncommon = sampleDistinct(byRarity.uncommon, 1 + extraUncommons, rng);

  // See shopOfferingsForClass's own comment -- same Insider Tip treatment.
  const wildcardTier: Rarity = rarityFloor === 'rare' ? 'rare' : rng.next() < 0.5 ? 'uncommon' : 'rare';
  const wildcardPool =
    wildcardTier === 'uncommon' ? byRarity.uncommon.filter((mod) => !uncommon.some((picked) => picked.id === mod.id)) : byRarity.rare;
  const wildcard = sampleDistinct(wildcardPool, 1, rng);

  return [...commons, ...uncommon, ...wildcard].map((mod) => ({ mod, cost: modShopCostOf(mod.rarity, discountFraction) }));
}

// ---------------------------------------------------------------------
// Burners' own third independent Shop slate (Phase 5 Burners checkpoint
// F) -- same shape again (3 commons/1 uncommon/1 wildcard, own separate
// reroll), but the underlying pool is generalBurnerPool() directly, not
// a per-class filter -- Burners are archetype-agnostic (DESIGN.md) and
// duplicates are legal (checkpoint B), so there's no classId-scoping or
// owned-exclusion step the way modPoolForClass needs. classId is still
// accepted (unused) purely for call-site symmetry with
// shopOfferingsForClass/modOfferingsForClass.
// ---------------------------------------------------------------------

// TBD/playtesting, same relative scaling as SHOP_COST_BY_RARITY/
// MOD_SHOP_COST_BY_RARITY -- pitched a little below Mods' since a Burner
// is spent once, not a standing effect.
const BURNER_SHOP_COST_BY_RARITY: Record<Rarity, number> = {
  common: 15,
  uncommon: 45,
  rare: 120,
};

export interface BurnerOffering {
  burner: BurnerDefinition;
  cost: number;
}

export function burnerShopCostOf(rarity: Rarity, discountFraction = 0): number {
  return Math.round(BURNER_SHOP_COST_BY_RARITY[rarity] * (1 - discountFraction));
}

function burnerPoolByRarity(): Record<Rarity, BurnerDefinition[]> {
  const pool = generalBurnerPool();
  return {
    common: pool.filter((burner) => burner.rarity === 'common'),
    uncommon: pool.filter((burner) => burner.rarity === 'uncommon'),
    rare: pool.filter((burner) => burner.rarity === 'rare'),
  };
}

export function burnerOfferingsForClass(
  classId: ClassId,
  rng: Rng,
  extraCommons = 0,
  extraUncommons = 0,
  discountFraction = 0,
  rarityFloor?: Rarity,
): BurnerOffering[] {
  // classId is unused -- see this section's header comment.
  const byRarity = burnerPoolByRarity();
  const commons = sampleDistinct(byRarity.common, SHOP_COMMON_SLOTS + extraCommons, rng);
  const uncommon = sampleDistinct(byRarity.uncommon, 1 + extraUncommons, rng);

  // See shopOfferingsForClass's own comment -- same Insider Tip treatment.
  const wildcardTier: Rarity = rarityFloor === 'rare' ? 'rare' : rng.next() < 0.5 ? 'uncommon' : 'rare';
  const wildcardPool =
    wildcardTier === 'uncommon' ? byRarity.uncommon.filter((burner) => !uncommon.some((picked) => picked.id === burner.id)) : byRarity.rare;
  const wildcard = sampleDistinct(wildcardPool, 1, rng);

  return [...commons, ...uncommon, ...wildcard].map((burner) => ({ burner, cost: burnerShopCostOf(burner.rarity, discountFraction) }));
}

/** Decides which (if any) Burner offering a script buys -- mirrors
 * ModShopStrategy for the third independent slate. Distinct from
 * checkpoint E's ShopBurnerStrategy above (spending an already-carried
 * coupon) -- this is buying a *new* Burner. */
export type BurnerShopStrategy = (offerings: BurnerOffering[], playerState: RunPlayerState) => BurnerOffering | null;

/** Legal-not-good default, same shape as buyCheapestAffordable/
 * buyCheapestAffordableMod. */
export const buyCheapestAffordableBurner: BurnerShopStrategy = (offerings, playerState) => {
  const affordable = offerings.filter((offering) => offering.cost <= playerState.data);
  if (affordable.length === 0) return null;
  return affordable.reduce((cheapest, offering) => (offering.cost < cheapest.cost ? offering : cheapest));
};

/** Decides whether to spend Data to reroll the Burner slate once --
 * mirrors ModShopRerollStrategy, its own independent reroll. */
export type BurnerShopRerollStrategy = (offerings: BurnerOffering[], playerState: RunPlayerState) => boolean;

export const rerollBurnerIfNothingAffordable: BurnerShopRerollStrategy = (offerings, playerState) => {
  const canAffordReroll = playerState.data >= REROLL_COST;
  const canAffordSomething = offerings.some((offering) => offering.cost <= playerState.data);
  return canAffordReroll && !canAffordSomething;
};

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

// ---------------------------------------------------------------------
// Shop-context Burner activation (Phase 5 Burners checkpoint E) --
// distinct from checkpoint F's BurnerShopStrategy/BurnerShopRerollStrategy
// below (deciding what to BUY from the Burner slate itself): this is
// deciding whether to SPEND an already-carried "coupon" Burner
// (discount/freeReroll/rarityFloor) on this visit. Decided before either
// slate is generated (encounters.ts's shop case, mirrors Vendor
// Discount/Bulk Buyer's own onShopSlateGenerated hook timing), so there
// are no offerings yet to react to -- just which Burner (if any) to burn
// this visit.
// ---------------------------------------------------------------------

export type ShopBurnerStrategy = (availableBurnerIds: BurnerId[], playerState: RunPlayerState) => BurnerId | null;

/** Default until a script actually wants to spend a shop Burner. */
export const neverActivateShopBurner: ShopBurnerStrategy = () => null;

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46) -- the Shop halves of the
// three acquisition ladders. Each mirrors its reward-side counterpart
// exactly, with one extra step in front: the existing affordability
// filter runs *before* the ladder, not instead of it, so a script never
// "prefers" something it can't buy and never falls back to declining
// while something affordable is still on the slate. Opt-in only; the
// buyCheapestAffordable* defaults stay in place for every existing
// caller and test.
// ---------------------------------------------------------------------

/** Checkpoint B's Shop half, paired with loadout.ts's
 * synergyAwareAcquisition -- same 3-rung ladder (credit-gap -> archetype
 * -> rarity), applied to whatever this visit's slate can actually
 * afford. Note the ladder's rarity rung and the Shop's own price scaling
 * pull the same direction here (rarer costs more), so on a tight budget
 * this naturally lands on the best affordable piece rather than the
 * cheapest one. */
export const synergyAwareShopStrategy: ShopStrategy = (offerings, playerState) => {
  const affordable = offerings.filter((offering) => offering.cost <= playerState.data);
  if (affordable.length === 0) return null;
  const best = bestByLadder(
    affordable.map((offering) => offering.piece),
    playerState,
  );
  return affordable.find((offering) => offering.piece.id === best?.id) ?? null;
};

/** Checkpoint C's Shop half, paired with mods.ts's
 * synergyAwareModAcquisition -- 2 rungs (archetype -> rarity), applied
 * to whatever this visit's Mod slate can afford. */
export const synergyAwareModShopStrategy: ModShopStrategy = (offerings, playerState) => {
  const affordable = offerings.filter((offering) => offering.cost <= playerState.data);
  if (affordable.length === 0) return null;
  const best = bestModByLadder(
    affordable.map((offering) => offering.mod),
    playerState,
  );
  return affordable.find((offering) => offering.mod.id === best?.id) ?? null;
};

/** Checkpoint D's Shop half, paired with burners.ts's
 * synergyAwareBurnerAcquisition -- rarity only, applied to whatever this
 * visit's Burner slate can afford. Since the Burner slate's own prices
 * scale with rarity, this reliably spends up to the budget rather than
 * hoarding Data, which is the intended contrast with
 * buyCheapestAffordableBurner. */
export const synergyAwareBurnerShopStrategy: BurnerShopStrategy = (offerings, playerState) => {
  const affordable = offerings.filter((offering) => offering.cost <= playerState.data);
  if (affordable.length === 0) return null;
  const best = bestBurnerByLadder(affordable.map((offering) => offering.burner));
  return affordable.find((offering) => offering.burner.id === best?.id) ?? null;
};

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint H) -- spending
// a carried "coupon" Burner on a Shop visit, the third and last context
// Burners were never used in.
//
// Session 45's design said to spend one "when doing so changes that
// visit's purchase outcome." That can't be read literally at this call
// site: resolveEncounter asks this *before* either slate is generated
// (mirroring Vendor Discount's own onShopSlateGenerated timing), so
// there are no offerings to compare against -- only how much Data is in
// hand. The thresholds below are the honest approximation of that
// intent, and are TBD/playtesting like every other numeric constant
// here.
//
// Priority runs from largest to smallest effect on what this visit can
// actually buy.
// ---------------------------------------------------------------------

/** Spends a carried coupon Burner when this visit's Data makes it pay:
 *
 * - **Insider Tip** (forces the wildcard slot to rare) only once a rare
 *   is genuinely affordable -- forcing a rare you can't buy converts the
 *   slate's most flexible slot into a guaranteed dead one, strictly
 *   worse than not spending it.
 * - **Stolen Coupon** (25% off everything) once anything at all is
 *   affordable, since a discount only pays on a visit that buys.
 * - **Loyalty Token** (free reroll) when the reroll itself is otherwise
 *   unaffordable -- exactly when a bad slate would otherwise be stuck.
 *
 * Nothing is spent on a visit too poor to buy anything, where all three
 * would be pure waste. */
export const synergyAwareShopBurnerStrategy: ShopBurnerStrategy = (availableBurnerIds, playerState) => {
  const carries = (id: BurnerId): boolean => availableBurnerIds.includes(id);
  const data = playerState.data;

  if (carries('insider-tip') && data >= SHOP_COST_BY_RARITY.rare) return 'insider-tip';
  if (carries('stolen-coupon') && data >= SHOP_COST_BY_RARITY.common) return 'stolen-coupon';
  if (carries('loyalty-token') && data >= SHOP_COST_BY_RARITY.common && data < REROLL_COST + SHOP_COST_BY_RARITY.common) {
    return 'loyalty-token';
  }
  return null;
};
