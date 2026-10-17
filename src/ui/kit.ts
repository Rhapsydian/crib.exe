import type { BurnerId } from '../engine/burner-types';
import { BURNER_DEFINITIONS } from '../engine/burners';
import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
import type { PlayerIndex } from '../engine/game';
import { GATEKEEPER_MODS } from '../engine/gatekeeper-mods';
import type { ModId } from '../engine/mod-types';
import { MOD_DEFINITIONS } from '../engine/mods';
import {
  BRIDGE_DAEMON_HONEYPOT_CAP,
  BRIDGE_DAEMON_OVERCLOCK_STEPS,
  BRIDGE_EXPLOIT_DAEMON_SUPPRESS,
  BRIDGE_EXPLOIT_HONEYPOT_WARD,
  BRIDGE_EXPLOIT_OVERCLOCK_EMPOWER,
  BRIDGE_OVERCLOCK_HONEYPOT_WARD,
  type CombatState,
  type ModRef,
  type ModTrigger,
} from '../engine/resolve';
import { describeEffect } from './describe';

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

/** The class bridge Mods' rules, in each owner's voice (the user's call:
 * written now for the six classes; the general Mods get theirs when they
 * start appearing as rewards in milestone 3). */
const BRIDGE_TEXT: Record<ClassId, { you: string; it: string }> = {
  'exploit-overclock': {
    you: `When one of your Exploit Hooks applies, the next piece that turn is Empowered +${BRIDGE_EXPLOIT_OVERCLOCK_EMPOWER}.`,
    it: `When one of its Exploit Hooks applies, its next piece that turn is Empowered +${BRIDGE_EXPLOIT_OVERCLOCK_EMPOWER}.`,
  },
  'exploit-daemon': {
    you: `Each fifteen you score also Suppresses them ${BRIDGE_EXPLOIT_DAEMON_SUPPRESS}.`,
    it: `Each fifteen it scores also Suppresses you ${BRIDGE_EXPLOIT_DAEMON_SUPPRESS}.`,
  },
  'daemon-overclock': {
    you: `When one of your Overclock Hooks applies, each of your Daemon pieces grows ${BRIDGE_DAEMON_OVERCLOCK_STEPS} step.`,
    it: `When one of its Overclock Hooks applies, each of its Daemon pieces grows ${BRIDGE_DAEMON_OVERCLOCK_STEPS} step.`,
  },
  'exploit-honeypot': {
    you: `Each pair you score banks ${BRIDGE_EXPLOIT_HONEYPOT_WARD} Ward.`,
    it: `Each pair it scores banks it ${BRIDGE_EXPLOIT_HONEYPOT_WARD} Ward.`,
  },
  'daemon-honeypot': {
    you: `Suppress you deal also banks that much Ward, up to ${BRIDGE_DAEMON_HONEYPOT_CAP} each turn.`,
    it: `Suppress it deals also banks it that much Ward, up to ${BRIDGE_DAEMON_HONEYPOT_CAP} each turn.`,
  },
  'overclock-honeypot': {
    you: `Each of your turns banks ${BRIDGE_OVERCLOCK_HONEYPOT_WARD} Ward.`,
    it: `Each of its turns banks it ${BRIDGE_OVERCLOCK_HONEYPOT_WARD} Ward.`,
  },
};

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
  if (mod.kind === 'gatekeeper') return { ...base, tag: 'gatekeeper Mod', text: GATEKEEPER_MODS[mod.id].text };
  const cls = bridgeClass(mod.id);
  if (cls) return { ...base, tag: `${CLASS_DEFINITIONS[cls].name} class Mod`, text: BRIDGE_TEXT[cls][side === 0 ? 'you' : 'it'] };
  return { ...base, tag: `${MOD_DEFINITIONS[mod.id].rarity} Mod`, text: 'Rules text to come (milestone 3).' };
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
      text: def.combatEffect ? `${describeEffect(def.combatEffect)}, once, before one of your turns.` : 'No effect in a fight.',
      spent: used !== -1,
    };
  });
}

/** "your Siphon", "their Null Session". */
export function triggerLabel(t: ModTrigger): string {
  return `${t.side === 0 ? 'your' : 'their'} ${modName(t.mod)}`;
}

/** A class's own bridge Mod, by name and rules (for class choice). */
export function classModFor(classId: ClassId): { name: string; text: string } {
  return { name: MOD_DEFINITIONS[`${BRIDGE_PREFIX}${classId}` as ModId].name, text: BRIDGE_TEXT[classId].you };
}
