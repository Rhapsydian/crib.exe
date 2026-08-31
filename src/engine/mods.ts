import type { ModDefinition, ModId } from './mod-types';
import type { SubroutineDefinition } from './subroutine-types';
import type { ClassId, ClassDefinition } from './classes';
import { CLASS_DEFINITIONS } from './classes';
import type { Rarity } from './rewards';
import type { Rng } from './rng';
import type { RunPlayerState } from './run';
import { mergeSubroutine } from './merge';

/**
 * Mod content (Phase 5 checkpoints D/H): the 6 class-exclusive starting
 * passives (session 11, migrated onto Mod infrastructure) plus the 17
 * validated Mods from session 32's content-validation table. Mirrors
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

/** Overclocked Accumulator's threshold reduction -- a fraction, not a
 * flat amount, since it scales the trigger's own threshold. */
export const OVERCLOCKED_ACCUMULATOR_REDUCTION = 0.15;

/** Light Footing's flat per-move Heat discount. */
export const LIGHT_FOOTING_HEAT_DISCOUNT = 1;

/** Vendor Discount's flat percentage off every Shop price. */
export const VENDOR_DISCOUNT_FRACTION = 0.2;

/** Backup Generator's permanent max-Heat raise. */
export const BACKUP_GENERATOR_HEAT_BONUS = 20;

/** Petty Cache's flat Data bonus on any win. */
export const PETTY_CACHE_DATA_BONUS = 5;

/** Black Budget's chance (0-1) to upgrade an elite/gatekeeper subroutine
 * reward's rarity by one tier. */
export const BLACK_BUDGET_UPGRADE_CHANCE = 0.25;

/** Tagged Firmware's watched tag -- 'daemon' chosen since it's the most
 * broadly-represented tag across the pool (Accumulators, DoT/HoT,
 * Always-Cantrips per subroutines.ts's own header), giving the Mod a
 * reasonable chance to matter in most loadouts. TBD/playtesting which
 * tag is the final pick, same as every other numeric/parameter choice
 * here. */
export const TAGGED_FIRMWARE_TAG = 'daemon' as const;

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
export const THRESHOLD_EXPLOIT_REDUCTION = 0.15; // fraction off Occurrence-Threshold's bankTarget
export const HEAT_SINK_HEAT_REFUND = 10;

/** Boot Sector's granted reactive-subroutine content -- a common-rarity
 * sibling proving the reactive-subroutine bucket works below rare (session
 * 32 only ever exercised it at rare, via Rootkit Persistence). */
const BOOT_SECTOR_SUBROUTINE: SubroutineDefinition = {
  id: 'boot-sector',
  name: 'Boot Sector',
  archetype: 'neutral',
  trigger: { kind: 'always' },
  payload: { kind: 'directBurst', amount: MOD_SMALL },
  tags: ['daemon'],
};

/** Session Hijack Relay's granted reactive-subroutine content -- Root-
 * flavored, opportunistically reusing session 40's new `sessionHijack`
 * payload (a genuine two-sided gauge transfer) rather than inventing new
 * engine work, since the reactive-subroutine bucket just wraps a real
 * SubroutineDefinition wholesale. */
const SESSION_HIJACK_RELAY_SUBROUTINE: SubroutineDefinition = {
  id: 'session-hijack-relay',
  name: 'Session Hijack Relay',
  archetype: 'root',
  trigger: { kind: 'always' },
  payload: { kind: 'sessionHijack', amount: MOD_SMALL },
  tags: ['daemon'],
};

/** Backdoor Access's granted, always-slotted subroutine -- Auxiliary
 * Process's sibling (session 32/checkpoint F's grantedSubroutine
 * mechanism), Neutral-archetype for the same class-exclusion-dodge
 * reasoning, but Occurrence-triggered (Instant, Fifteen) rather than
 * Always -- gives the granted-subroutine mechanism a second trigger
 * family example. */
const BACKDOOR_ACCESS_SUBROUTINE: SubroutineDefinition = {
  id: 'backdoor-access',
  name: 'Backdoor Access',
  archetype: 'neutral',
  trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
  payload: { kind: 'directBurst', amount: MOD_SMALL },
  tags: ['daemon'],
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
  archetype: 'root',
  trigger: { kind: 'always' },
  payload: { kind: 'instantManipulation', target: 'enemyGauge', amount: MOD_SMALL },
  tags: ['daemon'],
};

/** Auxiliary Process's granted, always-slotted subroutine (session 32:
 * "a bespoke, neutral-archetype, Always-triggered subroutine... Neutral
 * rather than archetype-tied so it isn't subject to the class-exclusion
 * filter"). Inserted into installedLoadout by onModAcquired (checkpoint
 * E/F), cap-exempt and removal-locked via RunPlayerState.grantedByMod. */
const AUXILIARY_PROCESS_SUBROUTINE: SubroutineDefinition = {
  id: 'auxiliary-process',
  name: 'Auxiliary Process',
  archetype: 'neutral',
  trigger: { kind: 'always' },
  payload: { kind: 'directBurst', amount: MOD_SMALL },
  tags: ['daemon'],
};

export const MOD_DEFINITIONS: Record<ModId, ModDefinition> = {
  // --- Class-exclusive starting passives (checkpoint D) ---
  foothold: { id: 'foothold', name: 'Foothold', rarity: 'common', effectKind: 'hook', classExclusive: true },
  'zero-day': { id: 'zero-day', name: 'Zero Day', rarity: 'common', effectKind: 'hook', classExclusive: true },
  'sleeper-cell': { id: 'sleeper-cell', name: 'Sleeper Cell', rarity: 'common', effectKind: 'hook', classExclusive: true },
  primed: { id: 'primed', name: 'Primed', rarity: 'common', effectKind: 'hook', classExclusive: true },
  'feedback-loop': { id: 'feedback-loop', name: 'Feedback Loop', rarity: 'common', effectKind: 'hook', classExclusive: true },
  'return-to-sender': { id: 'return-to-sender', name: 'Return to Sender', rarity: 'common', effectKind: 'hook', classExclusive: true },

  // --- Common (7) ---
  'static-shield': { id: 'static-shield', name: 'Static Shield', rarity: 'common', effectKind: 'hook' },
  'light-footing': { id: 'light-footing', name: 'Light Footing', rarity: 'common', effectKind: 'hook' },
  'warm-boot': { id: 'warm-boot', name: 'Warm Boot', rarity: 'common', effectKind: 'hook' },
  'vendor-discount': { id: 'vendor-discount', name: 'Vendor Discount', rarity: 'common', effectKind: 'hook' },
  'early-momentum': { id: 'early-momentum', name: 'Early Momentum', rarity: 'common', effectKind: 'hook' },
  'backup-generator': { id: 'backup-generator', name: 'Backup Generator', rarity: 'common', effectKind: 'hook' },
  'petty-cache': { id: 'petty-cache', name: 'Petty Cache', rarity: 'common', effectKind: 'hook' },

  // --- Uncommon (6) ---
  'tagged-firmware': { id: 'tagged-firmware', name: 'Tagged Firmware', rarity: 'uncommon', effectKind: 'hook' },
  'malware-amplifier': { id: 'malware-amplifier', name: 'Malware Amplifier', rarity: 'uncommon', effectKind: 'hook', archetype: 'malware' },
  'redundant-ticks': { id: 'redundant-ticks', name: 'Redundant Ticks', rarity: 'uncommon', effectKind: 'hook' },
  'salvage-protocol': { id: 'salvage-protocol', name: 'Salvage Protocol', rarity: 'uncommon', effectKind: 'hook' },
  'overclocked-accumulator': { id: 'overclocked-accumulator', name: 'Overclocked Accumulator', rarity: 'uncommon', effectKind: 'hook' },
  'bulk-buyer': { id: 'bulk-buyer', name: 'Bulk Buyer', rarity: 'uncommon', effectKind: 'hook' },

  // --- Rare (4) ---
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
    archetype: 'root',
    reactiveSubroutine: ROOTKIT_PERSISTENCE_SUBROUTINE,
  },
  'failsafe-cascade': { id: 'failsafe-cascade', name: 'Failsafe Cascade', rarity: 'rare', effectKind: 'hook' },
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
  'encryption-amplifier': { id: 'encryption-amplifier', name: 'Encryption Amplifier', rarity: 'uncommon', effectKind: 'hook', archetype: 'encryption' },
  'root-amplifier': { id: 'root-amplifier', name: 'Root Amplifier', rarity: 'uncommon', effectKind: 'hook', archetype: 'root' },
  'fast-learner': { id: 'fast-learner', name: 'Fast Learner', rarity: 'uncommon', effectKind: 'hook' },
  'threshold-exploit': { id: 'threshold-exploit', name: 'Threshold Exploit', rarity: 'uncommon', effectKind: 'hook' },
  'scrap-merchant': { id: 'scrap-merchant', name: 'Scrap Merchant', rarity: 'uncommon', effectKind: 'hook' },

  // --- Mod Pool Expansion (session 44): Rare (+4) ---
  redline: { id: 'redline', name: 'Redline', rarity: 'rare', effectKind: 'hook' },
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
    archetype: 'root',
    reactiveSubroutine: SESSION_HIJACK_RELAY_SUBROUTINE,
  },
};

/** The general Mod pool -- every Mod except the 6 class-exclusive
 * starting passives, which never appear in the reward/Shop pool (session
 * 30). Checkpoint G's reward/Shop draw filters this further by rarity
 * and the archetype-exclusion rule. */
export function generalModPool(): ModDefinition[] {
  return Object.values(MOD_DEFINITIONS).filter((mod) => !mod.classExclusive);
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
  state = applyFirstArchetypeUpgradeMod(state, acquired, 'salvage-protocol', 'malware');
  // Fast Learner (session 44): Salvage Protocol's sibling, extending the
  // same "first archetype-X subroutine acquired is upgraded once" pattern
  // to a second archetype -- the same per-archetype scaling the Amplifier
  // family already uses (Malware Amplifier -> Exploit/Encryption/Root
  // Amplifier).
  state = applyFirstArchetypeUpgradeMod(state, acquired, 'fast-learner', 'root');
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
