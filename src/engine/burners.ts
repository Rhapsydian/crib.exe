import type { BurnerDefinition, BurnerId } from './burner-types';
import type { Rarity } from './rewards';
import type { Rng } from './rng';
import type { RunPlayerState } from './run';
import { rarityLadderPosition } from './loadout';

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

/** Shop-context Burner activation's effect on this visit's slate
 * generation/reroll cost (checkpoint E) -- mirrors mods.ts's
 * shopModifiersForOwnedMods, but for a single one-shot activated Burner
 * rather than a standing owned-Mod check. `discountFraction` doesn't
 * stack with Vendor Discount (encounters.ts's shop case takes the
 * larger of the two, not a compounded multiply) -- a coupon and a
 * standing discount are both "the best price available," not additive
 * savings. `freeReroll` zeroes REROLL_COST for both independent slates'
 * reroll decisions this visit (simplest legible reading of "a free
 * reroll" for a placeholder/TBD economy -- see DESIGN.md's Burners
 * section). */
export function shopModifiersForActivatedBurner(activated: BurnerDefinition | undefined): {
  discountFraction: number;
  freeReroll: boolean;
  rarityFloor?: Rarity;
} {
  if (!activated?.shopEffect) return { discountFraction: 0, freeReroll: false };
  const effect = activated.shopEffect;
  if (effect.kind === 'discount') return { discountFraction: effect.fraction, freeReroll: false };
  if (effect.kind === 'freeReroll') return { discountFraction: 0, freeReroll: true };
  return { discountFraction: 0, freeReroll: false, rarityFloor: effect.rarity };
}

// ---------------------------------------------------------------------
// Combat-reward acquisition (Phase 5 Burners checkpoint F) -- mirrors
// mods.ts's own ModAcquisitionStrategy/drawModRewardOptions pair, but
// simpler: no class scoping (archetype-agnostic pool) and no owned-
// exclusion (duplicates are legal, checkpoint B), so neither needs a
// classId/ownedBurnerIds parameter the way the Mod version does.
// ---------------------------------------------------------------------

/** Decides which (if any) of an offered Burner reward's options a script
 * acquires -- mirrors loadout.ts's AcquisitionStrategy/mods.ts's
 * ModAcquisitionStrategy for the third, independent reward channel. */
export type BurnerAcquisitionStrategy = (options: BurnerDefinition[], playerState: RunPlayerState) => BurnerDefinition | null;

/** Always takes the first offered option -- legal-not-good, same
 * treatment as alwaysAcquireFirst/alwaysAcquireFirstMod. */
export const alwaysAcquireFirstBurner: BurnerAcquisitionStrategy = (options) => options[0] ?? null;

// TBD/playtesting, same discipline as rewards.ts's RARITY_WEIGHTS_BY_TIER/
// mods.ts's MOD_REWARD_WEIGHTS.
const BURNER_REWARD_WEIGHTS: Record<Rarity, number> = { common: 60, uncommon: 30, rare: 10 };
// A smaller choice than the 3-option subroutine reward, same reasoning
// as MOD_REWARD_OPTIONS_COUNT -- additive on top of it, not competing.
export const BURNER_REWARD_OPTIONS_COUNT = 2; // TBD/playtesting

function weightedSampleBurnersWithoutReplacement(items: { burner: BurnerDefinition; weight: number }[], count: number, rng: Rng): BurnerDefinition[] {
  const pool = items.filter((entry) => entry.weight > 0);
  const picked: BurnerDefinition[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng.next() * totalWeight;
    let index = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight;
      if (roll <= 0) {
        index = j;
        break;
      }
    }
    picked.push(pool[index].burner);
    pool.splice(index, 1);
  }
  return picked;
}

/** Draws a won fight's additive Burner-choice reward -- unlike Mods'
 * drawModRewardOptions (elite/gatekeeper only), Burners are offered on
 * **every** fight tier including regular (DESIGN.md's Burners section:
 * regular fights currently grant only a thin subroutine choice, and a
 * lower-commitment single-use item suits that well). Never empties out
 * the way a class-scoped Mod pool eventually can -- no ownership
 * exclusion, so this always has something to offer. */
export function drawBurnerRewardOptions(rng: Rng): BurnerDefinition[] {
  const pool = generalBurnerPool();
  const weighted = pool.map((burner) => ({ burner, weight: BURNER_REWARD_WEIGHTS[burner.rarity] }));
  return weightedSampleBurnersWithoutReplacement(weighted, BURNER_REWARD_OPTIONS_COUNT, rng);
}

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint D) -- the
// Burner half of the acquisition ladder, paired with shop.ts's
// synergyAwareBurnerShopStrategy. A single rung: BurnerDefinition has no
// archetype field at all (Burners are archetype-agnostic by design,
// DESIGN.md) and a one-shot consumable never sits in the loadout, so
// neither the credit-gap nor the archetype rung has anything to read.
// Rarity alone is what's left, which makes this less a "ladder" than the
// honest floor of one -- kept in the same shape as the other two so the
// synergy profile wires up uniformly.
//
// Note this ranks by rarity, NOT by which context a Burner serves
// (combat/map/shop). Whether a script should prefer, say, a map Burner
// while a gatekeeper is unreachable is a real question, but it depends
// on run state a reward-time acquisition strategy doesn't see, and
// session 45 explicitly deferred hoarding/reservation logic pending
// sweep evidence it would matter.
// ---------------------------------------------------------------------

/** Picks the rarest offered Burner, or null when there's nothing to
 * pick from. Ties fall to the earliest option, matching
 * alwaysAcquireFirstBurner's own bias. */
export function bestBurnerByLadder(options: BurnerDefinition[]): BurnerDefinition | null {
  if (options.length === 0) return null;
  return options.reduce((best, option) =>
    rarityLadderPosition(option.rarity) < rarityLadderPosition(best.rarity) ? option : best,
  );
}

/** Opt-in only -- alwaysAcquireFirstBurner stays playRun's default for
 * every existing caller and test. */
export const synergyAwareBurnerAcquisition: BurnerAcquisitionStrategy = (options) => bestBurnerByLadder(options);
