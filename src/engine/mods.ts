import type { ModDefinition, ModId } from './mod-types';
import type { SubroutineDefinition } from './subroutine-types';
import type { ClassId, ClassDefinition } from './classes';
import { CLASS_DEFINITIONS } from './classes';
import type { Rarity } from './rewards';
import type { Rng } from './rng';
import type { RunPlayerState } from './run';
import { mergeSubroutine } from './merge';
import { archetypeLadderPosition, rarityLadderPosition } from './loadout';

/**
 * Mod content (Phase 5 checkpoints D/H, session 44 expansion, session 51
 * re-points): the 6 class-exclusive bridge passives (step 3's bespoke
 * bridges -- rules in resolve.ts's applyBridgeOn* hooks) plus
 * the general pool. Session 51 re-keyed the archetype Mods to the new
 * archetypes, re-pointed Tagged Firmware / Overclocked Accumulator /
 * Threshold Exploit off tags and trigger-easing, and took the three tick
 * Mods (Redundant Ticks, Failsafe Cascade, Redline) out of the pool
 * until the content step decides their fate. Mirrors
 * enemies.ts's own split -- this file is the data (id, name, rarity,
 * archetype-exclusion, reactiveSubroutine content); the actual hook
 * *logic* for 'hook'-kind entries is hand-written in resolve.ts
 * (combat-scoped hooks) or this file's own run-level dispatch functions
 * below (run-scoped hooks), the same "light registry, not a declarative
 * DSL" split the enemy-passive registry already established.
 *
 * All magnitudes are TBD/playtesting placeholders, same discipline as
 * every other numeric constant in this project (see subroutines.ts's
 * COMMON/UNCOMMON/RARE tiers, resolve.ts's EP_SMALL/MEDIUM/LARGE) --
 * scaled the same relative way (common < uncommon < rare).
 */

export const MOD_SMALL = 2;
export const MOD_MEDIUM = 4;
export const MOD_LARGE = 7;

/** How much an archetype Amplifier adds to that archetype's alphas, and
 * Firmware Patch to an applied beta's effect -- gauge points, so never
 * applied to Tempo (session 48). Was a flat credit per fire, which under
 * D11's every-piece-every-turn firing would have been a per-turn credit
 * per piece; a magnitude bump keeps it proportional. TBD/playtesting. */
export const AMPLIFIER_BONUS = 1;
export const FIRMWARE_PATCH_BONUS = 1;

/** Light Footing's flat per-move Heat discount. */
export const LIGHT_FOOTING_HEAT_DISCOUNT = 1;

/** Vendor Discount's flat percentage off every Shop price. */
export const VENDOR_DISCOUNT_FRACTION = 0.2;

/** Backup Generator's permanent max-Heat raise. */
// Session 52: added to EVERY layer's allowance now (heat.ts), which is
// ~30-40 rather than the old run-long 100 -- 20 would be +50%.
export const BACKUP_GENERATOR_HEAT_BONUS = 8;

/** Petty Cache's flat Data bonus on any win. */
export const PETTY_CACHE_DATA_BONUS = 5;

/** Black Budget's chance (0-1) to upgrade an elite/gatekeeper subroutine
 * reward's rarity by one tier. */
export const BLACK_BUDGET_UPGRADE_CHANCE = 0.25;


// ---------------------------------------------------------------------
// Mod Pool Expansion (session 44) -- 17 new pieces, doubling every
// rarity tier (7/6/4 -> 14/12/8). Magnitudes all TBD/playtesting, same
// discipline as the original 17. Constants kept independent per-Mod even
// where a value happens to match an existing one (e.g. Threshold
// Exploit's reduction vs. Overclocked Accumulator's) -- this project's
// own decoupling precedent (sessions 39/43), since two Mods tuned
// independently shouldn't accidentally share a knob.
// ---------------------------------------------------------------------

export const QUIET_HOURS_MOVE_INTERVAL = 3;
export const QUIET_HOURS_DATA_BONUS = 2;
export const PETTY_THEFT_DATA_BONUS = 3;
export const INIT_SCRIPT_DATA_BONUS = 5;
/** Threshold Exploit (re-pointed session 51): stepped betas need this
 * many fewer charges, never below 1. */
export const THRESHOLD_EXPLOIT_REDUCTION = 1;
/** Cache Prefetch (session 51, was Overclocked Accumulator): every banking
 * beta starts each fight with this many charges. */
export const CACHE_PREFETCH_CHARGES = 1;
export const HEAT_SINK_HEAT_REFUND = 10;

/** Boot Sector's granted reactive-subroutine content -- a common-rarity
 * sibling proving the reactive-subroutine bucket works below rare (session
 * 32 only ever exercised it at rare, via Rootkit Persistence). */
const BOOT_SECTOR_SUBROUTINE: SubroutineDefinition = {
  id: 'boot-sector',
  name: 'Boot Sector',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: MOD_SMALL / 2 },
};

/** Session Hijack Relay's granted reactive-subroutine content -- Root-
 * flavored, opportunistically reusing session 40's new `sessionHijack`
 * payload (a genuine two-sided gauge transfer) rather than inventing new
 * engine work, since the reactive-subroutine bucket just wraps a real
 * SubroutineDefinition wholesale. */
const SESSION_HIJACK_RELAY_SUBROUTINE: SubroutineDefinition = {
  id: 'session-hijack-relay',
  name: 'Session Hijack Relay',
  archetype: 'honeypot',
  alpha: { verb: 'credit', amount: MOD_SMALL / 2, from: 'opponent' },
};

/** Backdoor Access's granted, always-slotted subroutine -- Auxiliary
 * Process's sibling (session 32/checkpoint F's grantedSubroutine
 * mechanism), with a fifteen-graded beta where Auxiliary Process ramps.
 * Exploit since session 51 (Neutral is gone). The class-exclusion filter
 * keys on the *Mod's* archetype, which stays unset, so every class can
 * still be offered it. */
const BACKDOOR_ACCESS_SUBROUTINE: SubroutineDefinition = {
  id: 'backdoor-access',
  name: 'Backdoor Access',
  archetype: 'exploit',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'fifteen', shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 } },
};

/** Rootkit Persistence's granted reactive-subroutine content (session
 * 32: "a real SubroutineDefinition, fires outside the loadout... Root-
 * flavored, Always-triggered, small manipulation effect every turn").
 * Deliberately allowed to share its id with the owning Mod -- different
 * keyspaces (ModId vs subroutine id), same precedent enemies.ts's own
 * header documents for enemy ids colliding with subroutine ids. */
const ROOTKIT_PERSISTENCE_SUBROUTINE: SubroutineDefinition = {
  id: 'rootkit-persistence',
  name: 'Rootkit Persistence',
  archetype: 'exploit',
  // A quarter of the opponent's turn, drained every player turn -- Tempo
  // amounts are fractions of a turn (session 48), the same effect this
  // Mod has always had.
  alpha: { verb: 'tempo', target: 'opponent', mode: 'gauge', amount: 1 / 4 },
};

/** Auxiliary Process's granted, always-slotted subroutine (session 32).
 * Daemon since session 51 (Neutral is gone); the Mod itself carries no
 * archetype, so the class-exclusion filter still lets every class see
 * it. Inserted into installedLoadout by onModAcquired (checkpoint E/F),
 * cap-exempt and removal-locked via RunPlayerState.grantedByMod. */
const AUXILIARY_PROCESS_SUBROUTINE: SubroutineDefinition = {
  id: 'auxiliary-process',
  name: 'Auxiliary Process',
  archetype: 'daemon',
  alpha: { verb: 'credit', amount: 1, growth: 0.5, growthCap: 2 },
};

export const MOD_DEFINITIONS: Record<ModId, ModDefinition> = {
  // --- Class-exclusive bridge passives (step 3, C1/C4; rules in resolve.ts's applyBridgeOn*) ---
  'bridge-exploit-overclock': { id: 'bridge-exploit-overclock', name: 'Lateral Movement', rarity: 'common', effectKind: 'hook', classExclusive: true },
  'bridge-exploit-daemon': { id: 'bridge-exploit-daemon', name: 'Backdoor Maintenance', rarity: 'common', effectKind: 'hook', classExclusive: true },
  'bridge-daemon-overclock': { id: 'bridge-daemon-overclock', name: 'Invocation', rarity: 'common', effectKind: 'hook', classExclusive: true },
  'bridge-exploit-honeypot': { id: 'bridge-exploit-honeypot', name: 'Foothold', rarity: 'common', effectKind: 'hook', classExclusive: true },
  'bridge-daemon-honeypot': { id: 'bridge-daemon-honeypot', name: 'Hardened Perimeter', rarity: 'common', effectKind: 'hook', classExclusive: true },
  'bridge-overclock-honeypot': { id: 'bridge-overclock-honeypot', name: 'Phase Shift', rarity: 'common', effectKind: 'hook', classExclusive: true },

  // --- Common ---
  'static-shield': { id: 'static-shield', name: 'Static Shield', rarity: 'common', effectKind: 'hook' },
  'light-footing': { id: 'light-footing', name: 'Light Footing', rarity: 'common', effectKind: 'hook' },
  'warm-boot': { id: 'warm-boot', name: 'Warm Boot', rarity: 'common', effectKind: 'hook' },
  'vendor-discount': { id: 'vendor-discount', name: 'Vendor Discount', rarity: 'common', effectKind: 'hook' },
  'early-momentum': { id: 'early-momentum', name: 'Early Momentum', rarity: 'common', effectKind: 'hook' },
  'backup-generator': { id: 'backup-generator', name: 'Backup Generator', rarity: 'common', effectKind: 'hook' },
  'petty-cache': { id: 'petty-cache', name: 'Petty Cache', rarity: 'common', effectKind: 'hook' },

  // --- Uncommon ---
  // Session 51 re-points: Tagged Firmware -> Firmware Patch (tags are
  // gone; it boosts betas instead), Malware Amplifier -> Daemon Amplifier,
  // Overclocked Accumulator -> Cache Prefetch ("fire sooner" no longer
  // exists, and the old name now reads as an Overclock piece). Redundant
  // Ticks is out of the pool: DoT/HoT are gone, so it had nothing to do.
  'firmware-patch': { id: 'firmware-patch', name: 'Firmware Patch', rarity: 'uncommon', effectKind: 'hook' },
  'daemon-amplifier': { id: 'daemon-amplifier', name: 'Daemon Amplifier', rarity: 'uncommon', effectKind: 'hook', archetype: 'daemon' },
  // Gated on the archetype it upgrades (session 58, the user's call): a
  // class with no Daemon pieces would be offered a dead pick.
  'salvage-protocol': { id: 'salvage-protocol', name: 'Salvage Protocol', rarity: 'uncommon', effectKind: 'hook', archetype: 'daemon' },
  'cache-prefetch': { id: 'cache-prefetch', name: 'Cache Prefetch', rarity: 'uncommon', effectKind: 'hook' },
  'bulk-buyer': { id: 'bulk-buyer', name: 'Bulk Buyer', rarity: 'uncommon', effectKind: 'hook' },

  // --- Rare ---
  'auxiliary-process': {
    id: 'auxiliary-process',
    name: 'Auxiliary Process',
    rarity: 'rare',
    effectKind: 'hook',
    grantedSubroutine: AUXILIARY_PROCESS_SUBROUTINE,
  },
  'rootkit-persistence': {
    id: 'rootkit-persistence',
    name: 'Rootkit Persistence',
    rarity: 'rare',
    effectKind: 'reactiveSubroutine',
    archetype: 'exploit',
    reactiveSubroutine: ROOTKIT_PERSISTENCE_SUBROUTINE,
  },
  'black-budget': { id: 'black-budget', name: 'Black Budget', rarity: 'rare', effectKind: 'hook' },

  // --- Mod Pool Expansion (session 44): Common (+7) ---
  'cold-boot': { id: 'cold-boot', name: 'Cold Boot', rarity: 'common', effectKind: 'hook' },
  'quiet-hours': { id: 'quiet-hours', name: 'Quiet Hours', rarity: 'common', effectKind: 'hook' },
  'surge-protector': { id: 'surge-protector', name: 'Surge Protector', rarity: 'common', effectKind: 'hook' },
  'first-contact': { id: 'first-contact', name: 'First Contact', rarity: 'common', effectKind: 'hook' },
  'petty-theft': { id: 'petty-theft', name: 'Petty Theft', rarity: 'common', effectKind: 'hook' },
  'boot-sector': {
    id: 'boot-sector',
    name: 'Boot Sector',
    rarity: 'common',
    effectKind: 'reactiveSubroutine',
    reactiveSubroutine: BOOT_SECTOR_SUBROUTINE,
  },
  'init-script': { id: 'init-script', name: 'Init Script', rarity: 'common', effectKind: 'hook' },

  // --- Mod Pool Expansion (session 44): Uncommon (+6) ---
  'exploit-amplifier': { id: 'exploit-amplifier', name: 'Exploit Amplifier', rarity: 'uncommon', effectKind: 'hook', archetype: 'exploit' },
  'honeypot-amplifier': { id: 'honeypot-amplifier', name: 'Honeypot Amplifier', rarity: 'uncommon', effectKind: 'hook', archetype: 'honeypot' },
  'overclock-amplifier': { id: 'overclock-amplifier', name: 'Overclock Amplifier', rarity: 'uncommon', effectKind: 'hook', archetype: 'overclock' },
  // Gated like Salvage Protocol, on Overclock.
  'fast-learner': { id: 'fast-learner', name: 'Fast Learner', rarity: 'uncommon', effectKind: 'hook', archetype: 'overclock' },
  'threshold-exploit': { id: 'threshold-exploit', name: 'Threshold Exploit', rarity: 'uncommon', effectKind: 'hook' },
  'scrap-merchant': { id: 'scrap-merchant', name: 'Scrap Merchant', rarity: 'uncommon', effectKind: 'hook' },

  // --- Mod Pool Expansion (session 44): Rare ---
  // Redline (credit per DoT tick) and, above, Failsafe Cascade (refresh an
  // expiring DoT/HoT) are out of the pool since session 51 -- no ticks
  // remain for them to act on. Re-point or retire in the content step.
  'heat-sink': { id: 'heat-sink', name: 'Heat Sink', rarity: 'rare', effectKind: 'hook' },
  'backdoor-access': {
    id: 'backdoor-access',
    name: 'Backdoor Access',
    rarity: 'rare',
    effectKind: 'hook',
    grantedSubroutine: BACKDOOR_ACCESS_SUBROUTINE,
  },
  'session-hijack-relay': {
    id: 'session-hijack-relay',
    name: 'Session Hijack Relay',
    rarity: 'rare',
    effectKind: 'reactiveSubroutine',
    archetype: 'honeypot',
    reactiveSubroutine: SESSION_HIJACK_RELAY_SUBROUTINE,
  },
};

/** Mods set aside: still defined and still working if owned, but never
 * offered (rewards, Shops, Events). Static Shield (session 58, the
 * user's call): -2 from every plain Credit the opponent gains cancels
 * most of an enemy's plain Credit at today's piece sizes. */
export const MODS_SET_ASIDE: ReadonlySet<ModId> = new Set<ModId>(['static-shield']);

/** The general Mod pool -- every Mod except the 6 class-exclusive
 * starting passives, which never appear in the reward/Shop pool (session
 * 30), and those set aside (MODS_SET_ASIDE). Checkpoint G's reward/Shop
 * draw filters this further by rarity and the archetype-exclusion rule. */
export function generalModPool(): ModDefinition[] {
  return Object.values(MOD_DEFINITIONS).filter((mod) => !mod.classExclusive && !MODS_SET_ASIDE.has(mod.id));
}

/** The real SubroutineDefinitions owned reactive-subroutine Mods
 * contribute -- fired outside the loadout entirely (no slot, no order),
 * always evaluated alongside installedLoadout (checkpoint B). Injected
 * directly into side 0's combat loadout at createCombatState time
 * (resolve.ts), so fireReadySubroutines/fireNewlyReadyReactiveSubroutines/
 * fireHandLifecycleSubroutines need zero changes to also fire these --
 * they're just ordinary loadout entries as far as those functions know. */
export function reactiveModSubroutines(ownedModIds: ModId[]): SubroutineDefinition[] {
  return ownedModIds
    .map((id) => MOD_DEFINITIONS[id])
    .filter((mod): mod is ModDefinition => mod !== undefined && mod.reactiveSubroutine !== undefined)
    .map((mod) => mod.reactiveSubroutine as SubroutineDefinition);
}

// ---------------------------------------------------------------------
// Reward/Shop pool scoping (Phase 5 Mods checkpoint G) -- session 30's
// "universal by default, with a targeted archetype exclusion": a Mod
// naming a specific archetype is only offered to a class whose own 2
// specializations include it, the same inclusion direction
// rewards.ts's rewardPoolForClass already uses for its own archetype
// pools (not an inversion -- most Mods have no archetype at all and are
// always allowed).
// ---------------------------------------------------------------------

function isModAllowedForClass(mod: ModDefinition, classDef: ClassDefinition): boolean {
  return mod.archetype === undefined || classDef.archetypes.includes(mod.archetype);
}

/** A class's full Mod pool: every non-class-exclusive Mod the class is
 * allowed to see, minus whatever it already owns (uniqueness, session
 * 30 -- an already-owned Mod simply drops out of the pool). */
export function modPoolForClass(classId: ClassId, ownedModIds: ModId[]): ModDefinition[] {
  const classDef = CLASS_DEFINITIONS[classId];
  return generalModPool().filter((mod) => isModAllowedForClass(mod, classDef) && !ownedModIds.includes(mod.id));
}

// TBD/playtesting, same discipline as rewards.ts's own RARITY_WEIGHTS_BY_TIER.
const MOD_REWARD_WEIGHTS: Record<Rarity, number> = { common: 60, uncommon: 30, rare: 10 };
export const MOD_REWARD_OPTIONS_COUNT = 2; // TBD/playtesting -- a smaller choice than the 3-option subroutine reward, since a Mod reward is additive on top of it

function weightedSampleModsWithoutReplacement(items: { mod: ModDefinition; weight: number }[], count: number, rng: Rng): ModDefinition[] {
  const pool = items.filter((entry) => entry.weight > 0);
  const picked: ModDefinition[] = [];
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
    picked.push(pool[index].mod);
    pool.splice(index, 1);
  }
  return picked;
}

/** Decides which (if any) of an offered Mod reward's options a script
 * acquires -- mirrors loadout.ts's AcquisitionStrategy for the parallel
 * Mod-choice reward (session 30: additive, not competing with the
 * subroutine reward). */
export type ModAcquisitionStrategy = (options: ModDefinition[], playerState: RunPlayerState) => ModDefinition | null;

/** Always takes the first offered option -- legal-not-good, same
 * treatment as loadout.ts's alwaysAcquireFirst. */
export const alwaysAcquireFirstMod: ModAcquisitionStrategy = (options) => options[0] ?? null;

/** Draws an elite/gatekeeper win's additive Mod-choice reward (session
 * 30: "in addition to the normal subroutine reward" -- regular fights
 * never call this). Empty once the class's whole allowed pool is
 * already owned. */
export function drawModRewardOptions(classId: ClassId, ownedModIds: ModId[], rng: Rng): ModDefinition[] {
  const pool = modPoolForClass(classId, ownedModIds);
  const weighted = pool.map((mod) => ({ mod, weight: MOD_REWARD_WEIGHTS[mod.rarity] }));
  return weightedSampleModsWithoutReplacement(weighted, MOD_REWARD_OPTIONS_COUNT, rng);
}

// ---------------------------------------------------------------------
// Run-level hook dispatch (Phase 5 Mods checkpoint E) -- hand-written
// functions checking ownedModIds membership, same "light registry, not
// a declarative DSL" split the enemy-passive registry established.
// Combat-scoped hooks (onFire/onTick/onTickExpiring/onGaugeCross50/
// onIncomingDirectBurst/onCombatStart/onTriggerEvaluate) stay in
// resolve.ts/triggers.ts instead (session 33's file-split call).
// ---------------------------------------------------------------------

/** Light Footing's onMove hook -- called from run.ts's playRun loop
 * between traversal.ts's move() and heat.ts's addHeat(), floored at 0
 * (a move can never refund Heat, only discount it). */
export function applyOnMoveMods(ownedModIds: ModId[], heatCost: number): number {
  if (!ownedModIds.includes('light-footing')) return heatCost;
  return Math.max(0, heatCost - LIGHT_FOOTING_HEAT_DISCOUNT);
}

/** Quiet Hours's onMove hook (session 44) -- separate from
 * applyOnMoveMods above since it needs playerState (a running move
 * counter, Data to credit) rather than just transforming the flat Heat
 * cost. Counter lives in modRunState, same per-run scratch convention
 * Salvage Protocol/Fast Learner/Init Script all use. */
export function applyQuietHoursMod(playerState: RunPlayerState): RunPlayerState {
  if (!playerState.ownedModIds.includes('quiet-hours')) return playerState;
  const moves = (playerState.modRunState['quiet-hours:moves'] ?? 0) + 1;
  if (moves < QUIET_HOURS_MOVE_INTERVAL) {
    return { ...playerState, modRunState: { ...playerState.modRunState, 'quiet-hours:moves': moves } };
  }
  return {
    ...playerState,
    data: playerState.data + QUIET_HOURS_DATA_BONUS,
    modRunState: { ...playerState.modRunState, 'quiet-hours:moves': 0 },
  };
}

/** Petty Cache/Black Budget's onEncounterResolved hook -- called from
 * encounters.ts's resolveFight right before returning a win outcome
 * (session 31: reward computation is already independent of combat-
 * internal state, so this is the one hook point that covers Heat
 * mitigation, bonus Data, and reward-altering Mods together). `rng` is
 * the same stream resolveFight already draws the base rewardOptions
 * from -- Black Budget's re-draw (drawUpgradedRewardOptions) reuses it
 * rather than needing a second seed. */
export function applyOnWinEncounterResolvedMods(
  ownedModIds: ModId[],
  dataAwarded: number,
  rewardOptions: SubroutineDefinition[],
  kind: 'regular' | 'elite' | 'gatekeeper',
  rng: Rng,
  drawUpgraded: (rng: Rng) => SubroutineDefinition[],
): { dataAwarded: number; rewardOptions: SubroutineDefinition[]; heatRefund: number } {
  let data = dataAwarded;
  let options = rewardOptions;
  let heatRefund = 0;
  if (ownedModIds.includes('petty-cache')) data += PETTY_CACHE_DATA_BONUS;
  if (kind === 'regular' && ownedModIds.includes('petty-theft')) data += PETTY_THEFT_DATA_BONUS;
  if (kind !== 'regular' && ownedModIds.includes('black-budget') && rng.next() < BLACK_BUDGET_UPGRADE_CHANCE) {
    options = drawUpgraded(rng);
  }
  // Heat Sink (session 44): the first of the 17-piece expansion to
  // exercise onEncounterResolved's third named use case (session 31:
  // "Heat mitigation, bonus Data, and reward-altering") -- Petty
  // Cache/Petty Theft cover Data, Black Budget covers reward-altering,
  // nothing covered Heat until now.
  if (kind !== 'regular' && ownedModIds.includes('heat-sink')) heatRefund = HEAT_SINK_HEAT_REFUND;
  return { dataAwarded: data, rewardOptions: options, heatRefund };
}

/** Vendor Discount/Bulk Buyer's onShopSlateGenerated hook -- called from
 * encounters.ts's shop case before either slate is generated, feeding
 * shop.ts's shopOfferingsForClass/modOfferingsForClass their
 * discount/extra-slot parameters. */
export function shopModifiersForOwnedMods(ownedModIds: ModId[]): { discountFraction: number; extraCommons: number; extraUncommons: number } {
  return {
    discountFraction: ownedModIds.includes('vendor-discount') ? VENDOR_DISCOUNT_FRACTION : 0,
    extraCommons: ownedModIds.includes('bulk-buyer') ? 1 : 0,
    // Scrap Merchant (session 44): Bulk Buyer's sibling, one tier up --
    // gives the onShopSlateGenerated hook tier granularity it didn't have
    // before (only a common-slot lever existed).
    extraUncommons: ownedModIds.includes('scrap-merchant') ? 1 : 0,
  };
}

/** Salvage Protocol's onSubroutineAcquired hook -- called from run.ts's
 * playRun right after acquireSubroutine finalizes a subroutine choice
 * (reward or Shop purchase alike). "First... each run" tracked via
 * modRunState, mirroring resolve.ts's per-combat passiveState scratch
 * bookkeeping convention. Reuses merge.ts's real, tested upgrade path by
 * synthetically banking 1 material for the freshly-acquired piece's own
 * id then immediately spending it -- mergeSubroutine finds the piece
 * (acquireSubroutine already placed it in installedLoadout or bench) and
 * consumes the material back to 0, same as a real duplicate-triggered
 * Merge would. */
export function applyOnSubroutineAcquiredMods(playerState: RunPlayerState, acquired: SubroutineDefinition): RunPlayerState {
  let state = playerState;
  // Session 51: Salvage Protocol was Malware, Fast Learner Root; re-keyed
  // to Daemon and Overclock.
  state = applyFirstArchetypeUpgradeMod(state, acquired, 'salvage-protocol', 'daemon');
  state = applyFirstArchetypeUpgradeMod(state, acquired, 'fast-learner', 'overclock');
  return state;
}

/** Shared shape behind Salvage Protocol/Fast Learner -- the first
 * subroutine of `archetype` acquired each run is immediately upgraded
 * once, gated by owning `modId`. Reuses merge.ts's real, tested upgrade
 * path the same way the original Salvage Protocol did (synthetically
 * banking 1 material for the freshly-acquired piece then immediately
 * spending it). */
function applyFirstArchetypeUpgradeMod(
  playerState: RunPlayerState,
  acquired: SubroutineDefinition,
  modId: ModId,
  archetype: SubroutineDefinition['archetype'],
): RunPlayerState {
  if (!playerState.ownedModIds.includes(modId)) return playerState;
  if (acquired.archetype !== archetype) return playerState;
  if ((playerState.modRunState[`${modId}:used`] ?? 0) > 0) return playerState;
  const withMaterial = { ...playerState, material: { ...playerState.material, [acquired.id]: (playerState.material[acquired.id] ?? 0) + 1 } };
  const merged = mergeSubroutine(withMaterial, acquired.id);
  return { ...merged, modRunState: { ...merged.modRunState, [`${modId}:used`]: 1 } };
}

/** Backup Generator's onModAcquired hook -- called from run.ts's playRun
 * wherever a Mod reward/Shop pick is finalized. Auxiliary Process's
 * granted-subroutine insertion (checkpoint F) is loadout.ts's own job
 * (installGrantedSubroutine), called separately from the same call
 * site -- this function only covers the non-loadout side effect. */
export function applyOnModAcquiredMods(playerState: RunPlayerState, acquiredModId: ModId): RunPlayerState {
  let state = playerState;
  if (acquiredModId === 'backup-generator') {
    state = { ...state, maxHeatBonus: state.maxHeatBonus + BACKUP_GENERATOR_HEAT_BONUS };
  }
  // Init Script (session 44): a second onModAcquired example with a
  // one-time-reward shape (vs. Backup Generator's permanent stat raise).
  // "The first Mod acquired beyond the class-exclusive one" -- guarded by
  // acquiredModId !== 'init-script' itself so owning Init Script and
  // then acquiring it a second time is structurally impossible anyway
  // (uniqueness, session 30), but kept explicit for clarity.
  if (
    state.ownedModIds.includes('init-script') &&
    acquiredModId !== 'init-script' &&
    (state.modRunState['init-script:used'] ?? 0) === 0
  ) {
    state = { ...state, data: state.data + INIT_SCRIPT_DATA_BONUS, modRunState: { ...state.modRunState, 'init-script:used': 1 } };
  }
  return state;
}

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint C) -- the Mod
// half of the acquisition ladder, paired with shop.ts's
// synergyAwareModShopStrategy. Deliberately 2 rungs, not the
// subroutine ladder's 3: there is no credit-capable classification for
// Mods at all, and building one would mean auditing every Mod's hook
// body against what it does to a win gauge -- a real side-project,
// explicitly deferred by session 45's design pass rather than
// half-guessed here.
//
// Worth knowing when reading a sweep: the archetype rung separates the
// 2-4 targeted Mods in a class's pool from the 28 archetype-agnostic
// ones, but never actually sees an off-archetype Mod -- modPoolForClass
// already excludes those outright (session 30's "targeted archetype
// exclusion"). The off-archetype position is kept anyway, since the
// ladder shouldn't silently depend on a pool-construction detail that
// lives in another function.
// ---------------------------------------------------------------------

/** One Mod's position on the 2-rung ladder -- same lower-is-better
 * convention as loadout.ts's LadderRank. */
export interface ModLadderRank {
  archetype: 0 | 1 | 2;
  rarity: 0 | 1 | 2;
}

/** `archetype` is optional on ModDefinition -- absent means the Mod
 * isn't tied to any one archetype, which archetypeLadderPosition maps
 * onto the middle rung. */
export function modLadderRank(mod: ModDefinition, playerState: RunPlayerState): ModLadderRank {
  return {
    archetype: archetypeLadderPosition(mod.archetype, playerState.classId),
    rarity: rarityLadderPosition(mod.rarity),
  };
}

export function compareModLadderRanks(a: ModLadderRank, b: ModLadderRank): number {
  return a.archetype - b.archetype || a.rarity - b.rarity;
}

/** Picks the best Mod by the ladder, or null when there's nothing to
 * pick from. Ties fall to the earliest option, matching
 * alwaysAcquireFirstMod's own bias. */
export function bestModByLadder(options: ModDefinition[], playerState: RunPlayerState): ModDefinition | null {
  if (options.length === 0) return null;
  return options.reduce((best, option) =>
    compareModLadderRanks(modLadderRank(option, playerState), modLadderRank(best, playerState)) < 0 ? option : best,
  );
}

/** Opt-in only -- alwaysAcquireFirstMod stays playRun's default for
 * every existing caller and test. */
export const synergyAwareModAcquisition: ModAcquisitionStrategy = (options, playerState) => bestModByLadder(options, playerState);
