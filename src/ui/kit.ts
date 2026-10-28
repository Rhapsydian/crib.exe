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
  NOBS_EXPLOIT_CREDIT,
  RUN_SPLICER_PAIRS,
  DEEP_CACHE_START_CHARGES,
  LAST_WORD_INITIATIVE,
  LUCKY_CUT_CREDIT,
  WARD_CONVERTER_SHARE,
  HOT_STANDBY_SHARE,
  DEEP_CACHE_CAP_MULTIPLIER,
  ROOT_CAUSE_COUNTS,
  PERSISTENT_PAYLOAD_MULTIPLIER,
  FIFTEEN_FOLD_RULE,
  PAIR_FOLD_RULE,
  OVERCLOCKED_KERNEL_BAR,
  OVERCLOCKED_KERNEL_TURNS,
  GHOST_CREDENTIALS_FIGHT_HEAT,
  BLACK_MARKET_DISCOUNT,
  BLACK_MARKET_VISIT_HEAT,
  GLASS_CANNON_CREDIT,
  GLASS_CANNON_ENEMY_START,
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
  BRIDGE_OVERCLOCK_HONEYPOT_ABOVE,
  BRIDGE_II_WARDEN_WARD,
  BRIDGE_II_BLACKHAT_PAIRS,
  BRIDGE_II_EIDOLON_FIRES,
  BRIDGE_II_EIDOLON_CAP_FIRES,
  BRIDGE_II_BREACHER_SHARE,
  BRIDGE_II_WRAITH_INITIATIVE,
  BRIDGE_OVERCLOCK_HONEYPOT_CREDIT,
  BRIDGE_OVERCLOCK_HONEYPOT_WARD,
  type CombatState,
  type ModRef,
  type ModTrigger,
} from '../engine/resolve';
import { describeEffect, describeHook, hookLabel, describeProcess, forEnemy } from './describe';

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
  'overclock-honeypot': `Each fifteen you score: Ward ${BRIDGE_OVERCLOCK_HONEYPOT_WARD}. While your Ward is over ${BRIDGE_OVERCLOCK_HONEYPOT_ABOVE}, each fifteen also Credits ${BRIDGE_OVERCLOCK_HONEYPOT_CREDIT}.`,
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
  const hook = piece.beta ? ` ${hookLabel(piece)}: ${describeHook(piece)}.` : '';
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
  'firmware-patch': `Your Hooks do ${FIRMWARE_PATCH_BONUS} more: each Hook that Credits, Suppresses or Wards does ${FIRMWARE_PATCH_BONUS} more, and each Hook that makes its Process bigger makes it ${FIRMWARE_PATCH_BONUS} bigger still.`,
  'daemon-amplifier': amplifierText('daemon-amplifier'),
  'salvage-protocol': 'The next Daemon subroutine you gain after taking this Mod is Refactored once for free (one already at rank III is skipped).',
  'cache-prefetch': `Your Hooks that count events (scoring, points, fires) start each fight with ${CACHE_PREFETCH_CHARGES === 1 ? 'one extra count' : `${CACHE_PREFETCH_CHARGES} extra counts`} already banked.`,
  'bulk-buyer': 'The Shop offers 1 extra common subroutine and 1 extra common Mod.',
  'exploit-amplifier': amplifierText('exploit-amplifier'),
  'honeypot-amplifier': amplifierText('honeypot-amplifier'),
  'overclock-amplifier': amplifierText('overclock-amplifier'),
  'fast-learner': 'The next Overclock subroutine you gain after taking this Mod is Refactored once for free (one already at rank III is skipped).',
  'proof-of-concept': 'The next Exploit subroutine you gain after taking this Mod is Refactored once for free (one already at rank III is skipped).',
  'lure-template': 'The next Honeypot subroutine you gain after taking this Mod is Refactored once for free (one already at rank III is skipped).',
  'threshold-exploit': `Hooks that wait for several events ("once you've scored 3 pairs") need ${THRESHOLD_EXPLOIT_REDUCTION === 1 ? 'one' : THRESHOLD_EXPLOIT_REDUCTION} fewer (never fewer than 1).`,
  'scrap-merchant': 'The Shop offers 1 extra uncommon subroutine and 1 extra uncommon Mod.',

  // --- Rare ---
  'auxiliary-process': grantedText('auxiliary-process'),
  'rootkit-persistence': `${reactiveText('rootkit-persistence')}${onlyFor('rootkit-persistence')}`,
  'black-budget': `After an elite or gatekeeper win, ${pct(BLACK_BUDGET_UPGRADE_CHANCE)} chance your subroutine reward is redrawn with much better odds of rares.`,
  'heat-sink': `Winning an elite or gatekeeper fight sheds ${HEAT_SINK_HEAT_REFUND} Heat.`,
  'backdoor-access': grantedText('backdoor-access'),
  'session-hijack-relay': `${reactiveText('session-hijack-relay')}${onlyFor('session-hijack-relay')}`,

  // --- Rule-benders (session 65, docs/mods-design.md M6) ---
  'nobs-exploit': `Each Jack in your hand or crib at the show Credits ${NOBS_EXPLOIT_CREDIT}.`,
  'run-splicer': `Each run you score also counts as ${RUN_SPLICER_PAIRS === 2 ? 'two pairs' : `${RUN_SPLICER_PAIRS} pairs`}, for your Hooks and your class Mod.`,
  'last-word': `Each go point you score (the last card, or 31) gives you ${LAST_WORD_INITIATIVE} additional initiative.`,
  'lucky-cut': `When the cut card is one of your class's suits, Credit ${LUCKY_CUT_CREDIT}.`,
  'ward-converter': `At the end of each hand, Credit ${WARD_CONVERTER_SHARE === 1 ? 'your remaining Ward' : `${WARD_CONVERTER_SHARE === 0.5 ? 'half' : pct(WARD_CONVERTER_SHARE)} of your remaining Ward`}.${onlyFor('ward-converter')}`,
  'mirror-hand': 'Each pair the enemy scores also counts toward your pair Hooks.',
  'hot-standby': `After your loadout fires each turn, your benched subroutines fire their Processes too${HOT_STANDBY_SHARE === 1 ? '' : `, at ${HOT_STANDBY_SHARE === 0.5 ? 'half' : pct(HOT_STANDBY_SHARE)} strength`}. Their Hooks don't go off.`,
  'echo-chamber': 'At the end of each of your turns, your top subroutine fires again.',
  'thirty-one': 'Pegging to 31 gives you a turn at once, and your Hooks all go off on it.',
  'deep-cache': `Your Hooks bank counts up to ${DEEP_CACHE_CAP_MULTIPLIER === 2 ? 'twice' : `${DEEP_CACHE_CAP_MULTIPLIER} times`} their usual limit, and start each fight with ${DEEP_CACHE_START_CHARGES === 1 ? 'one count' : `${DEEP_CACHE_START_CHARGES} counts`} banked.`,
  'root-cause': `Each of your Hooks that goes off gives the subroutine below it ${ROOT_CAUSE_COUNTS === 1 ? '1 count' : `${ROOT_CAUSE_COUNTS} counts`} toward its own Hook.`,
  'persistent-payload': `Your Burners' timed effects (temporary subroutines, effects that last turns or hands) last ${PERSISTENT_PAYLOAD_MULTIPLIER === 2 ? 'twice' : `${PERSISTENT_PAYLOAD_MULTIPLIER} times`} as long.`,

  // --- Double-edged, Event-only (session 65, docs/mods-design.md M7, M9) ---
  'fifteen-fold': `Your fifteens are worth ${FIFTEEN_FOLD_RULE.fifteen} points instead of 2, but your pairs are worth only ${FIFTEEN_FOLD_RULE.pair}.`,
  'pair-fold': `Your pairs are worth ${PAIR_FOLD_RULE.pair} points instead of 2, but your fifteens are worth only ${PAIR_FOLD_RULE.fifteen}.`,
  'overclocked-kernel': `Your first ${OVERCLOCKED_KERNEL_TURNS === 2 ? 'two turns' : `${OVERCLOCKED_KERNEL_TURNS} turns`} each fight fire your loadout twice, but your initiative bar is ${OVERCLOCKED_KERNEL_BAR} longer.`,
  'ghost-credentials': `Moving on the map adds no Heat, but each fight adds ${pct(GHOST_CREDENTIALS_FIGHT_HEAT - 1)} more Heat.`,
  'black-market-ties': `Shop prices are ${pct(BLACK_MARKET_DISCOUNT)} lower and each Shop sells a contraband Burner, but each Shop visit adds ${BLACK_MARKET_VISIT_HEAT} Heat.`,
  'glass-cannon': `Each Credit you score is ${GLASS_CANNON_CREDIT} higher, but each enemy starts the fight with ${pct(GLASS_CANNON_ENEMY_START)} of its Containment filled.`,
};

const MOD_TEXT_PENDING = 'Rules text to come (milestone 3).';

const BRIDGE_PREFIX = 'bridge-';
const bridgeClass = (id: ModId): ClassId | null => (id.startsWith(BRIDGE_PREFIX) ? (id.slice(BRIDGE_PREFIX.length) as ClassId) : null);

export function modKey(side: PlayerIndex, mod: ModRef): string {
  return `${side}:${mod.kind}:${mod.id}`;
}

/** A Mod's name; a class Mod `upgraded` to its II version says so. */
export function modName(mod: ModRef, upgraded = false): string {
  if (mod.kind === 'gatekeeper') return GATEKEEPER_MODS[mod.id].name;
  return `${MOD_DEFINITIONS[mod.id].name}${upgraded && bridgeClass(mod.id) ? ' II' : ''}`;
}

/** A Mod's tag where its kind sits: "Blackhat class Mod", "Double-edged
 * Mod" (session 65), or its rarity. */
export function modTag(id: ModId): string {
  const cls = bridgeClass(id);
  if (cls) return `${CLASS_DEFINITIONS[cls].name} class Mod`;
  return MOD_DEFINITIONS[id].doubleEdged ? 'Double-edged Mod' : `${MOD_DEFINITIONS[id].rarity} Mod`;
}

/** A player Mod as the kit and the map show it: name, tag and rules,
 * with the class Mod's II upgrade when it has one (session 65). */
export function playerModView(id: ModId, classModUpgraded = false): { name: string; tag: string; text: string } {
  const cls = bridgeClass(id);
  const { name, text } = cls ? classModFor(cls, classModUpgraded) : { name: MOD_DEFINITIONS[id].name, text: modText(id) };
  return { name, tag: modTag(id), text };
}

function modItem(side: PlayerIndex, mod: ModRef, upgraded = false): KitItem {
  const base = { key: modKey(side, mod), kind: 'mod' as const, side, name: modName(mod, upgraded) };
  if (mod.kind === 'gatekeeper') return { ...base, tag: `${GATEKEEPER_MODS[mod.id].tier} Mod`, text: GATEKEEPER_MODS[mod.id].text };
  const view = playerModView(mod.id, upgraded);
  return { ...base, tag: view.tag, text: side === 0 || !bridgeClass(mod.id) ? view.text : forEnemy(view.text) };
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
  return refs.map((r) => modItem(side, r, combatState.bridgeUpgraded?.[side] ?? false));
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
      tag: `Burner · ${def.contraband ? 'contraband' : def.rarity}`,
      text: def.combat || def.passive ? def.text : 'No effect in a fight.',
      spent: used !== -1,
    };
  });
}

/** "your Phase Shift", "their Null Session". */
export function triggerLabel(t: ModTrigger): string {
  return `${t.side === 0 ? 'your' : 'their'} ${modName(t.mod)}`;
}

/** A class's own bridge Mod, by name and rules (for class choice). */
export function classModFor(classId: ClassId, upgraded = false): { name: string; text: string } {
  const name = MOD_DEFINITIONS[`${BRIDGE_PREFIX}${classId}` as ModId].name;
  return upgraded ? { name: `${name} II`, text: `${BRIDGE_TEXT[classId]} ${BRIDGE_II_TEXT[classId]}` } : { name, text: BRIDGE_TEXT[classId] };
}

/** The "II" upgrades' added clauses (session 65, docs/mods-design.md M10),
 * after the class Mod's own text. */
export const BRIDGE_II_TEXT: Record<ClassId, string> = {
  'exploit-overclock': `Your ${BRIDGE_II_BLACKHAT_PAIRS === 2 ? 'second' : `${BRIDGE_II_BLACKHAT_PAIRS}th`} pair each hand gives you a turn at once (a pair royal counts as three pairs).`,
  'exploit-daemon': 'Your go points (the last card, or 31) count as fifteens for this Mod.',
  'daemon-overclock': `Your Daemon subroutines start each fight with ${Number(BRIDGE_II_EIDOLON_FIRES) === 1 ? "one fire's" : `${BRIDGE_II_EIDOLON_FIRES} fires'`} growth already in them, and can grow ${BRIDGE_II_EIDOLON_CAP_FIRES} fires further than usual.`,
  'exploit-honeypot': `When your Ward blocks an enemy hit, Credit ${BRIDGE_II_BREACHER_SHARE === 1 / 3 ? 'a third' : pct(BRIDGE_II_BREACHER_SHARE)} of what it blocked.`,
  'daemon-honeypot': `Each pair the enemy scores also gives you Ward ${BRIDGE_II_WARDEN_WARD}.`,
  'overclock-honeypot': `When your Ward fully blocks an enemy hit, add ${BRIDGE_II_WRAITH_INITIATIVE} initiative.`,
};
