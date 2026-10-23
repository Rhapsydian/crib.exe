import type { BurnerId } from '../engine/burner-types';
import { BURNER_DEFINITIONS } from '../engine/burners';
import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
import type { PlayerIndex } from '../engine/game';
import { GATEKEEPER_MODS } from '../engine/gatekeeper-mods';
import type { ModId } from '../engine/mod-types';
import {
  AMPLIFIER_BONUS,
  BACKUP_GENERATOR_HEAT_BONUS,
  BLACK_BUDGET_UPGRADE_CHANCE,
  CACHE_PREFETCH_CHARGES,
  FIRMWARE_PATCH_BONUS,
  HEAT_SINK_HEAT_REFUND,
  INIT_SCRIPT_DATA_BONUS,
  LIGHT_FOOTING_HEAT_DISCOUNT,
  MOD_DEFINITIONS,
  MOD_MEDIUM,
  MOD_SMALL,
  PETTY_CACHE_DATA_BONUS,
  PETTY_THEFT_DATA_BONUS,
  QUIET_HOURS_DATA_BONUS,
  QUIET_HOURS_MOVE_INTERVAL,
  THRESHOLD_EXPLOIT_REDUCTION,
  VENDOR_DISCOUNT_FRACTION,
} from '../engine/mods';
import type { SubroutineDefinition } from '../engine/subroutine-types';
import {
  BRIDGE_DAEMON_HONEYPOT_SUPPRESS,
  BRIDGE_DAEMON_HONEYPOT_WARD,
  BRIDGE_DAEMON_OVERCLOCK_COUNTS,
  BRIDGE_DAEMON_OVERCLOCK_GROWTH,
  BRIDGE_EXPLOIT_DAEMON_FIRST,
  BRIDGE_EXPLOIT_DAEMON_SUPPRESS,
  BRIDGE_EXPLOIT_HONEYPOT_WARD,
  BRIDGE_EXPLOIT_OVERCLOCK_HASTE,
  BRIDGE_OVERCLOCK_HONEYPOT_HASTE,
  BRIDGE_OVERCLOCK_HONEYPOT_PER_HAND,
  BRIDGE_OVERCLOCK_HONEYPOT_WARD,
  type CombatState,
  type ModRef,
  type ModTrigger,
} from '../engine/resolve';
import { describeEffect, describeHook, describeProcess, forEnemy } from './describe';

/**
 * Mods and Burners for the screen: what each side has, in words, and
 * which are acting right now. Mods are either kind (ModRef): a player or
 * class Mod, or a gatekeeper's. Display text only; the rules live in the
 * engine (resolve.ts).
 */
export interface KitItem {
  key: string;
  kind: 'mod' | 'burner';
  side: PlayerIndex;
  name: string;
  /** "Blackhat class Mod", "gatekeeper Mod", "Burner · common". */
  tag: string;
  text: string;
  /** A Burner already spent this fight. */
  spent?: boolean;
}

/** Initiative added to the owner's own gauge, in words ("add ⅙ of a
 * turn (2 initiative) to your initiative gauge"). */
const hasteText = (fraction: number) => describeEffect({ verb: 'tempo', target: 'own', mode: 'gauge', amount: fraction });
/** "half of one fire's growth". */
const growthShare = (share: number) => (share === 0.5 ? 'half of' : share === 0.25 ? 'a quarter of' : `${share}×`);

/** The class Mods' rules, in the player's voice; the enemy's is forEnemy's
 * (session 60's redesign: each triggers on a fifteen or a pair). */
const BRIDGE_TEXT: Record<ClassId, string> = {
  'exploit-overclock': `Each pair you score: ${hasteText(BRIDGE_EXPLOIT_OVERCLOCK_HASTE)}.`,
  'exploit-daemon': `Each fifteen you score: Suppress ${BRIDGE_EXPLOIT_DAEMON_SUPPRESS}. The first fifteen each hand Suppresses ${BRIDGE_EXPLOIT_DAEMON_FIRST} more.`,
  'daemon-overclock': `Each fifteen you score grows each of your Daemon subroutines by ${growthShare(BRIDGE_DAEMON_OVERCLOCK_GROWTH)} one fire's growth (still up to its cap). The first fifteen each hand also gives your Overclock subroutines' Hooks ${BRIDGE_DAEMON_OVERCLOCK_COUNTS === 1 ? 'one extra count' : `${BRIDGE_DAEMON_OVERCLOCK_COUNTS} extra counts`}.`,
  'exploit-honeypot': `Each pair you score: Ward ${BRIDGE_EXPLOIT_HONEYPOT_WARD}.`,
  'daemon-honeypot': `Each pair you score: Suppress ${BRIDGE_DAEMON_HONEYPOT_SUPPRESS} and Ward ${BRIDGE_DAEMON_HONEYPOT_WARD}.`,
  'overclock-honeypot': `${BRIDGE_OVERCLOCK_HONEYPOT_PER_HAND === 1 ? 'The first fifteen' : `The first ${BRIDGE_OVERCLOCK_HONEYPOT_PER_HAND} fifteens`} you score each hand you deal: Ward ${BRIDGE_OVERCLOCK_HONEYPOT_WARD}, and ${hasteText(BRIDGE_OVERCLOCK_HONEYPOT_HASTE)}.`,
};

/** Every Mod that can appear as a reward, in the Shop or from an Event
 * (everything but the six class bridges). */
export type GeneralModId = Exclude<ModId, `bridge-${string}`>;

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`;
const cap = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** The subroutine a reactive Mod fires each turn, or a granted Mod installs. */
const reactivePiece = (id: ModId): SubroutineDefinition => MOD_DEFINITIONS[id].reactiveSubroutine as SubroutineDefinition;
const grantedPiece = (id: ModId): SubroutineDefinition => MOD_DEFINITIONS[id].grantedSubroutine as SubroutineDefinition;

/** "Each of your turns, an extra Overclock subroutine fires after your loadout: Credit 1." */
const reactiveText = (id: ModId) => {
  const piece = reactivePiece(id);
  return `Each of your turns, an extra ${cap(piece.archetype)} subroutine fires after your loadout: ${describeProcess(piece.alpha)}.`;
};

/** "Adds the Daemon subroutine Auxiliary Process to your loadout. Process: ...". */
const grantedText = (id: ModId) => {
  const piece = grantedPiece(id);
  const hook = piece.beta ? ` Hook: ${describeHook(piece)}.` : '';
  return `Adds the ${cap(piece.archetype)} subroutine ${piece.name} to your loadout. Process: ${describeProcess(piece.alpha)}.${hook} It doesn't count toward your loadout limit and can't be removed.`;
};

/** An archetype-exclusive Mod's offer rule, in words. */
const onlyFor = (id: ModId) => ` Only offered to classes with ${cap(MOD_DEFINITIONS[id].archetype ?? '')} subroutines.`;

const amplifierText = (id: ModId) =>
  `Your ${cap(MOD_DEFINITIONS[id].archetype ?? '')} subroutines' Processes Credit, Suppress or Ward ${AMPLIFIER_BONUS} more (whichever they do).${onlyFor(id)}`;

/** The general Mods' rules, in the player's voice (milestone 3). Display
 * only: the rules live in resolve.ts (fight hooks) and mods.ts (run
 * hooks). */
export const MOD_TEXT: Record<GeneralModId, string> = {
  // --- Common ---
  'static-shield': `Each time the opponent Credits (not steals or Ward-spending), it's ${MOD_SMALL} less, before your Ward absorbs it.`,
  'light-footing': `Each move on the map costs ${LIGHT_FOOTING_HEAT_DISCOUNT} less Heat.`,
  'warm-boot': `Start each fight with ${MOD_SMALL} Ward.`,
  'vendor-discount': `Everything in the Shop costs ${pct(VENDOR_DISCOUNT_FRACTION)} less. Doesn't stack with a Burner discount; the bigger one applies.`,
  'early-momentum': `The first time your Breach reaches half each fight, Credit ${MOD_SMALL}.`,
  'backup-generator': `Your Heat limit is ${BACKUP_GENERATOR_HEAT_BONUS} higher on every layer.`,
  'petty-cache': `Every fight you win pays ${PETTY_CACHE_DATA_BONUS} extra Data.`,
  'cold-boot': `Start each fight with ${MOD_SMALL} Credit.`,
  'quiet-hours': `Every ${QUIET_HOURS_MOVE_INTERVAL}rd move on the map gives you ${QUIET_HOURS_DATA_BONUS} Data.`,
  'surge-protector': `The first time the opponent Credits each fight (not steals or Ward-spending), it's ${MOD_MEDIUM} less, before your Ward absorbs it.`,
  'first-contact': `The first time their Containment reaches half each fight, Suppress ${MOD_SMALL}.`,
  'petty-theft': `Every regular fight you win pays ${PETTY_THEFT_DATA_BONUS} extra Data.`,
  'boot-sector': reactiveText('boot-sector'),
  'init-script': `The next Mod you gain also gives you ${INIT_SCRIPT_DATA_BONUS} Data.`,

  // --- Uncommon ---
  'firmware-patch': `Your Hooks do ${FIRMWARE_PATCH_BONUS} more whenever they Credit, Suppress or Ward — or make a Process that does bigger.`,
  'daemon-amplifier': amplifierText('daemon-amplifier'),
  'salvage-protocol': 'The first Daemon subroutine you gain this run is Merged once for free.',
  'cache-prefetch': `Your Hooks that count events (scoring, points, fires) start each fight with ${CACHE_PREFETCH_CHARGES === 1 ? 'one extra count' : `${CACHE_PREFETCH_CHARGES} extra counts`} already banked.`,
  'bulk-buyer': 'The Shop offers 1 extra common subroutine and 1 extra common Mod.',
  'exploit-amplifier': amplifierText('exploit-amplifier'),
  'honeypot-amplifier': amplifierText('honeypot-amplifier'),
  'overclock-amplifier': amplifierText('overclock-amplifier'),
  'fast-learner': 'The first Overclock subroutine you gain this run is Merged once for free.',
  'threshold-exploit': `Hooks that wait for several events ("once you've scored 3 pairs") need ${THRESHOLD_EXPLOIT_REDUCTION === 1 ? 'one' : THRESHOLD_EXPLOIT_REDUCTION} fewer (never fewer than 1).`,
  'scrap-merchant': 'The Shop offers 1 extra uncommon subroutine and 1 extra uncommon Mod.',

  // --- Rare ---
  'auxiliary-process': grantedText('auxiliary-process'),
  'rootkit-persistence': `${reactiveText('rootkit-persistence')}${onlyFor('rootkit-persistence')}`,
  'black-budget': `After an elite or gatekeeper win, ${pct(BLACK_BUDGET_UPGRADE_CHANCE)} chance your subroutine reward is redrawn with much better odds of rares.`,
  'heat-sink': `Winning an elite or gatekeeper fight sheds ${HEAT_SINK_HEAT_REFUND} Heat.`,
  'backdoor-access': grantedText('backdoor-access'),
  'session-hijack-relay': `${reactiveText('session-hijack-relay')}${onlyFor('session-hijack-relay')}`,
};

const MOD_TEXT_PENDING = 'Rules text to come (milestone 3).';

const BRIDGE_PREFIX = 'bridge-';
const bridgeClass = (id: ModId): ClassId | null => (id.startsWith(BRIDGE_PREFIX) ? (id.slice(BRIDGE_PREFIX.length) as ClassId) : null);

export function modKey(side: PlayerIndex, mod: ModRef): string {
  return `${side}:${mod.kind}:${mod.id}`;
}

export function modName(mod: ModRef): string {
  return mod.kind === 'gatekeeper' ? GATEKEEPER_MODS[mod.id].name : MOD_DEFINITIONS[mod.id].name;
}

function modItem(side: PlayerIndex, mod: ModRef): KitItem {
  const base = { key: modKey(side, mod), kind: 'mod' as const, side, name: modName(mod) };
  if (mod.kind === 'gatekeeper') return { ...base, tag: `${GATEKEEPER_MODS[mod.id].tier} Mod`, text: GATEKEEPER_MODS[mod.id].text };
  const cls = bridgeClass(mod.id);
  if (cls) return { ...base, tag: `${CLASS_DEFINITIONS[cls].name} class Mod`, text: side === 0 ? BRIDGE_TEXT[cls] : forEnemy(BRIDGE_TEXT[cls]) };
  return { ...base, tag: `${MOD_DEFINITIONS[mod.id].rarity} Mod`, text: modText(mod.id) };
}

/** Any player Mod's rules in the player's voice: a class bridge's or a
 * general Mod's (reward and Shop screens). */
export function modText(id: ModId): string {
  const cls = bridgeClass(id);
  if (cls) return BRIDGE_TEXT[cls];
  return MOD_TEXT[id as GeneralModId] ?? MOD_TEXT_PENDING;
}

/** Every Mod `side` has this fight. */
export function modsOf(combatState: CombatState, side: PlayerIndex): KitItem[] {
  const refs: ModRef[] = [];
  const add = (r: ModRef) => {
    if (!refs.some((x) => x.kind === r.kind && x.id === r.id)) refs.push(r);
  };
  if (side === 0) for (const id of combatState.ownedModIds) add({ kind: 'mod', id });
  const bridge = combatState.bridges[side];
  if (bridge) add({ kind: 'mod', id: `${BRIDGE_PREFIX}${bridge}` as ModId });
  for (const id of combatState.sideMods[side]) add({ kind: 'gatekeeper', id });
  return refs.map((r) => modItem(side, r));
}

/** The player's Burners, each marked spent once used. */
export function burnersOf(carried: readonly BurnerId[], spentSoFar: readonly BurnerId[]): KitItem[] {
  const spent = [...spentSoFar];
  return carried.map((id, i) => {
    const def = BURNER_DEFINITIONS[id];
    const used = spent.indexOf(id);
    if (used !== -1) spent.splice(used, 1);
    return {
      key: `burner:${i}`,
      kind: 'burner',
      side: 0,
      name: def.name,
      tag: `Burner · ${def.rarity}`,
      text: def.combat ? def.text : 'No effect in a fight.',
      spent: used !== -1,
    };
  });
}

/** "your Phase Shift", "their Null Session". */
export function triggerLabel(t: ModTrigger): string {
  return `${t.side === 0 ? 'your' : 'their'} ${modName(t.mod)}`;
}

/** A class's own bridge Mod, by name and rules (for class choice). */
export function classModFor(classId: ClassId): { name: string; text: string } {
  return { name: MOD_DEFINITIONS[`${BRIDGE_PREFIX}${classId}` as ModId].name, text: BRIDGE_TEXT[classId] };
}
