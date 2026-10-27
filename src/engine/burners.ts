import type { BurnerDefinition, BurnerId } from './burner-types';
import type { SubroutineDefinition } from './subroutine-types';
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

/** How many Burners can be carried: BURNER_CAP plus the Burner slot
 * upgrades (session 71, MP7). */
export function burnerCapOf(playerState: { meta?: { burnerSlots: number } }): number {
  return BURNER_CAP + (playerState.meta?.burnerSlots ?? 0);
}

/** Stolen Coupon's discount fraction. */
export const STOLEN_COUPON_DISCOUNT_FRACTION = 0.25;

// Temporary subroutines (BE3): installed by their Burner for a few turns.
const BOOTSTRAP_LOADER: SubroutineDefinition = {
  id: 'burner-bootstrap-loader',
  name: 'Bootstrap Loader',
  archetype: 'overclock',
  alpha: { verb: 'empower', amount: 1, scope: 'rest' },
};
const LOGIC_BOMB: SubroutineDefinition = {
  id: 'burner-logic-bomb',
  name: 'Logic Bomb',
  archetype: 'exploit',
  alpha: { verb: 'credit', amount: 2 },
  beta: { source: 'sequence', reach: 'anyPrior', match: { any: true }, shape: 'graded', cap: 8, effect: { verb: 'credit', amount: 1 } },
};
const HONEYNET_SHIM: SubroutineDefinition = {
  id: 'burner-honeynet-shim',
  name: 'Honeynet Shim',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 2 },
};
const BOTNET: SubroutineDefinition = {
  id: 'burner-botnet',
  name: 'Botnet',
  archetype: 'exploit',
  alpha: { verb: 'credit', amount: 4 },
  beta: { source: 'cards', category: 'fifteen', shape: 'graded', cap: 1, effect: { verb: 'credit', amount: 4 } },
};
/** Every temporary subroutine a Burner can install (for the UI). */
export const BURNER_SUBROUTINES: readonly SubroutineDefinition[] = [BOOTSTRAP_LOADER, LOGIC_BOMB, HONEYNET_SHIM, BOTNET];

export const BURNER_DEFINITIONS: Record<BurnerId, BurnerDefinition> = {
  // --- Combat: lumps (BE1), about a fifth of a fight ---
  'flash-drive': {
    id: 'flash-drive',
    name: 'Flash Drive',
    rarity: 'common',
    contexts: ['combat'],
    text: 'Next turn: Credit 10.',
    combat: { timing: 'nextTurn', effect: { kind: 'effect', effect: { verb: 'credit', amount: 10 } } },
  },
  'emp-charge': {
    id: 'emp-charge',
    name: 'EMP Charge',
    rarity: 'uncommon',
    contexts: ['combat'],
    text: 'Next turn: Suppress 12.',
    combat: { timing: 'nextTurn', effect: { kind: 'effect', effect: { verb: 'suppress', amount: 12 } } },
  },
  'patch-tuesday': {
    id: 'patch-tuesday',
    name: 'Patch Tuesday',
    rarity: 'common',
    contexts: ['combat'],
    text: 'Next turn: Ward 8.',
    combat: { timing: 'nextTurn', effect: { kind: 'effect', effect: { verb: 'ward', amount: 8 } } },
  },

  // --- Combat: rule-benders ---
  'packet-storm': {
    id: 'packet-storm',
    name: 'Packet Storm',
    rarity: 'common',
    contexts: ['combat'],
    text: 'Now: each fifteen you score this hand also Credits 3.',
    combat: { timing: 'now', effect: { kind: 'handBonus', category: 'fifteen', effect: { verb: 'credit', amount: 3 } } },
  },
  'noise-floor': {
    id: 'noise-floor',
    name: 'Noise Floor',
    rarity: 'uncommon',
    contexts: ['combat'],
    text: 'Now: each pair you score this hand and the next also Suppresses 6.',
    combat: { timing: 'now', effect: { kind: 'handBonus', category: 'pair', effect: { verb: 'suppress', amount: 6 }, hands: 2 } },
  },
  'overclock-script': {
    id: 'overclock-script',
    name: 'Overclock Script',
    rarity: 'uncommon',
    contexts: ['combat'],
    text: 'Next turn and the one after: your loadout fires twice.',
    combat: { timing: 'nextTurn', effect: { kind: 'fireTwice', turns: 2 } },
  },
  'zero-day': {
    id: 'zero-day',
    name: 'Zero-Day',
    rarity: 'rare',
    contexts: ['combat'],
    text: 'Now: for the next 4 hands, every Hook in your loadout goes off, and applies twice.',
    combat: { timing: 'now', effect: { kind: 'hooksTwice', hands: 4 } },
  },

  // --- Combat: temporary subroutines (BE3) ---
  'bootstrap-loader': {
    id: 'bootstrap-loader',
    name: 'Bootstrap Loader',
    rarity: 'uncommon',
    contexts: ['combat'],
    text: 'Next turn: installs Bootstrap Loader at the top of your loadout for 3 turns. Process: Empower the rest of your loadout 1.',
    combat: { timing: 'nextTurn', effect: { kind: 'tempSubroutine', subroutine: BOOTSTRAP_LOADER, position: 'top', fires: 3 } },
  },
  'logic-bomb': {
    id: 'logic-bomb',
    name: 'Logic Bomb',
    rarity: 'uncommon',
    contexts: ['combat'],
    text: 'Next turn: installs Logic Bomb at the bottom of your loadout for 3 turns. Process: Credit 2. Hook: Credit 1 per subroutine that fired its Hook this turn.',
    combat: { timing: 'nextTurn', effect: { kind: 'tempSubroutine', subroutine: LOGIC_BOMB, position: 'bottom', fires: 3 } },
  },
  'honeynet-shim': {
    id: 'honeynet-shim',
    name: 'Honeynet Shim',
    rarity: 'common',
    contexts: ['combat'],
    text: 'Next turn: installs Honeynet Shim at the bottom of your loadout for 3 turns. Process: Ward 2.',
    combat: { timing: 'nextTurn', effect: { kind: 'tempSubroutine', subroutine: HONEYNET_SHIM, position: 'bottom', fires: 3 } },
  },

  // --- Map: Heat tools (BE4) ---
  'ghost-protocol': {
    id: 'ghost-protocol',
    name: 'Ghost Protocol',
    rarity: 'uncommon',
    contexts: ['map'],
    text: 'Your next 6 moves cost no Heat.',
    mapEffect: { kind: 'freeMoves', count: 6 },
  },
  // Reworked and renamed (session 68, docs/enemies-design.md E18): was
  // Skeleton Key, a map Burner reopening a closed node, too rarely needed
  // once no-route endings fell to ~2% of runs. Now contraband, used by
  // itself when it saves you.
  'restore-point': {
    id: 'restore-point',
    name: 'Restore Point',
    rarity: 'rare',
    contraband: true,
    passive: true,
    contexts: [],
    text: "If you lose a gatekeeper fight, you aren't quarantined: the fight starts over, once. Used up when it saves you.",
  },
  'log-wiper': {
    id: 'log-wiper',
    name: 'Log Wiper',
    rarity: 'common',
    contexts: ['map'],
    text: 'Now: lower your Heat by 10.',
    mapEffect: { kind: 'lowerHeat', amount: 10 },
  },
  'proxy-chain': {
    id: 'proxy-chain',
    name: 'Proxy Chain',
    rarity: 'uncommon',
    contexts: ['map'],
    text: "The next 3 fights' Heat is halved, win or lose.",
    mapEffect: { kind: 'nextFightHeat', multiplier: 0.5, fights: 3 },
  },
  'spoofed-credentials': {
    id: 'spoofed-credentials',
    name: 'Spoofed Credentials',
    rarity: 'rare',
    contexts: ['map'],
    text: 'The next gatekeeper has no Heat toll.',
    mapEffect: { kind: 'nextGatekeeperToll', multiplier: 0 },
  },
  tunnel: {
    id: 'tunnel',
    name: 'Tunnel',
    rarity: 'uncommon',
    contexts: ['map'],
    text: 'The next Shop or Quiet Host you move onto, you pass through without visiting it. It stays for later.',
    mapEffect: { kind: 'tunnel' },
  },

  // --- Shop ---
  'stolen-coupon': {
    id: 'stolen-coupon',
    name: 'Stolen Coupon',
    rarity: 'common',
    contexts: ['shop'],
    text: "25% off everything in one Shop visit (doesn't stack with Vendor Discount).",
    shopEffect: { kind: 'discount', fraction: STOLEN_COUPON_DISCOUNT_FRACTION },
  },
  'loyalty-token': {
    id: 'loyalty-token',
    name: 'Loyalty Token',
    rarity: 'uncommon',
    contexts: ['shop'],
    text: "One Shop visit's rerolls are free.",
    shopEffect: { kind: 'freeReroll' },
  },
  'insider-tip': {
    id: 'insider-tip',
    name: 'Insider Tip',
    rarity: 'rare',
    contexts: ['shop'],
    text: "In one Shop visit, each slate's wildcard offering is rare.",
    shopEffect: { kind: 'rarityFloor', rarity: 'rare' },
  },

  // --- Sell-only (session 61; the user's playtest idea) ---
  // An offline crypto wallet, liberated: no use, but it sells for a lot at
  // the next Shop. Never in a Shop's own slate (buy-and-resell).
  'cold-wallet': {
    id: 'cold-wallet',
    name: 'Cold Wallet',
    rarity: 'uncommon',
    contexts: [],
    text: 'No use of its own: it sells for 30 Data at a Shop.',
    sellValue: 30,
  },

  // --- Contraband: offered only by Events (BE5) ---
  'denial-of-service': {
    id: 'denial-of-service',
    name: 'Denial of Service',
    rarity: 'rare',
    contexts: ['combat'],
    contraband: true,
    text: "Now: the enemy's next 2 turns are skipped.",
    combat: { timing: 'now', effect: { kind: 'skipEnemyTurn', turns: 2 } },
  },
  botnet: {
    id: 'botnet',
    name: 'Botnet',
    rarity: 'rare',
    contexts: ['combat'],
    contraband: true,
    text: 'Next turn: installs Botnet at the bottom of your loadout for 6 turns. Process: Credit 4. Hook (fifteens): Credit 4 more.',
    combat: { timing: 'nextTurn', effect: { kind: 'tempSubroutine', subroutine: BOTNET, position: 'bottom', fires: 6 } },
  },
  'golden-ticket': {
    id: 'golden-ticket',
    name: 'Golden Ticket',
    rarity: 'rare',
    contexts: ['map'],
    contraband: true,
    text: 'Now: your Heat drops to 0, and the next gatekeeper has no Heat toll.',
    mapEffect: { kind: 'nextGatekeeperToll', multiplier: 0, clearHeat: true },
  },
  'kill-switch': {
    id: 'kill-switch',
    name: 'Kill Switch',
    rarity: 'rare',
    contexts: ['combat'],
    contraband: true,
    text: "Now: the enemy's Containment drops to 0.",
    combat: { timing: 'now', effect: { kind: 'drainEnemy', fraction: 1 } },
  },
};

/** Burners set aside: defined, but never offered. Empty since session 64
 * (Recon Ping was retired outright: no fog of war to reveal). */
export const BURNERS_SET_ASIDE: ReadonlySet<BurnerId> = new Set<BurnerId>();

/** The general Burner pool -- archetype-agnostic by default (DESIGN.md:
 * "not tied to the 4 archetypes"), unlike Mods' targeted-archetype
 * exclusion. No class-scoping needed at all. Excludes BURNERS_SET_ASIDE
 * and contraband (Event-only, BE5). */
export function generalBurnerPool(): BurnerDefinition[] {
  return Object.values(BURNER_DEFINITIONS).filter((burner) => !BURNERS_SET_ASIDE.has(burner.id) && !burner.contraband);
}

/** A Burner with no use but its sale price (Cold Wallet): no context to
 * activate it in, and not one that works by itself. */
export function isSellOnly(burner: BurnerDefinition): boolean {
  return burner.contexts.length === 0 && !burner.passive;
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
 * every fight tier, on a chance by tier since session 63 (encounters.ts's
 * BURNER_FIGHT_CHANCE: regular 20%, elite 50%; a gatekeeper always).
 * Never empties out
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
