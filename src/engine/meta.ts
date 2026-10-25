import type { RunPlayerState, RunResult } from './run';
import type { ClassId } from './classes';
import type { Archetype } from './subroutine-types';
import type { BurnerId } from './burner-types';
import { BREACH_THRESHOLD } from './encounters';
import { ARCHETYPE_POOLS } from './subroutines';
import { BURNER_DEFINITIONS } from './burners';
import type { SubroutineDefinition } from './subroutine-types';
import type { Rarity } from './rewards';

/**
 * Meta-progression (session 71, docs/meta-progression-design.md): what
 * carries between runs. This module is the pure part -- what a finished
 * run earns -- so tests and scripts can use it; the profile that stores
 * it lives in the UI (src/ui/profile.svelte.ts).
 */

/** Rep for each layer breached and continued, by layer (MP3; first pass,
 * set by pacing, MP11). */
export const LAYER_REP = [10, 15, 20, 25] as const;
/** Breached, then caught (R8): the layer's Rep at this share, below a
 * full continue. */
export const CAUGHT_REP_SHARE = 0.75;
export const ELITE_REP = 2;
export const VICTORY_REP = 20;
/** The tutorial's one-time grant: about one small upgrade. */
export const TUTORIAL_REP = 20;

/** The class unlock chain (MP4): Blackhat, the tutorial's class, first;
 * about one new idea per class; the fiddliest last. */
export const CLASS_ORDER: readonly ClassId[] = ['exploit-overclock', 'exploit-honeypot', 'exploit-daemon', 'daemon-honeypot', 'daemon-overclock', 'overclock-honeypot'];
/** The steep fallback (MP6): the next locked class, bought outright, for
 * about 3-4 early runs' Rep (checkpoint 5: early runs earn ~45). */
export const CLASS_FALLBACK_REP = 150;

/** The class a milestone with `classId` opens: the next in the chain. */
export function nextClass(classId: ClassId): ClassId | null {
  return CLASS_ORDER[CLASS_ORDER.indexOf(classId) + 1] ?? null;
}

/** Whether a run beat layer 1's gatekeeper (MP2's milestone; a Restore
 * Point retry that wins counts). */
export function firstGatekeeperBeaten(result: RunResult): boolean {
  return result.log.some((e) => e.type === 'encounter' && e.layerIndex === 0 && e.nodeType === 'gatekeeperFight' && e.outcome.newState === 'inert');
}

/** The upgrade tracks (MP7): levels and the step each level adds. Prices
 * come with pacing (checkpoint 5). */
export type UpgradeId =
  | 'containment'
  | 'breach'
  | 'fightHeat'
  | 'restHeat'
  | 'shopPrice'
  | 'power-exploit'
  | 'power-daemon'
  | 'power-overclock'
  | 'power-honeypot'
  | 'burnerSlots'
  | 'subroutineSlot';

export const UPGRADE_TRACKS: Record<UpgradeId, { levels: number; step: number }> = {
  /** Enemy Containment bigger, +3% a level. */
  containment: { levels: 5, step: 0.03 },
  /** The player's Breach smaller, 3% a level. */
  breach: { levels: 5, step: 0.03 },
  /** Fight Heat, 4% less a level (the user's addition). */
  fightHeat: { levels: 5, step: 0.04 },
  /** Safehouse rest sheds 3 more Heat a level. */
  restHeat: { levels: 4, step: 3 },
  /** Shop prices 4% lower a level, multiplying other discounts. */
  shopPrice: { levels: 5, step: 0.04 },
  /** An archetype's Process 4% stronger a level (the user's addition). */
  'power-exploit': { levels: 5, step: 0.04 },
  'power-daemon': { levels: 5, step: 0.04 },
  'power-overclock': { levels: 5, step: 0.04 },
  'power-honeypot': { levels: 5, step: 0.04 },
  /** One more Burner carried a level. */
  burnerSlots: { levels: 2, step: 1 },
  /** One more installed subroutine. */
  subroutineSlot: { levels: 1, step: 1 },
};

/** The upgrades' effects inside a run, beyond the two gauges (which use
 * RunPlayerState's own threshold sockets). */
export interface MetaBonuses {
  /** Multiplies a fight's Heat when it adds Heat. */
  fightHeat: number;
  /** Extra Heat a Safehouse rest sheds. */
  restHeat: number;
  /** Multiplies Shop prices (after other discounts). */
  shopPrice: number;
  /** Multiplies each archetype's Process. */
  process: Record<Archetype, number>;
  burnerSlots: number;
  subroutineSlots: number;
}

export const NO_META_BONUSES: MetaBonuses = { fightHeat: 1, restHeat: 0, shopPrice: 1, process: { exploit: 1, daemon: 1, overclock: 1, honeypot: 1 }, burnerSlots: 0, subroutineSlots: 0 };

/** Each track's level, clamped to its range. */
export function upgradeLevel(upgrades: Readonly<Record<string, number>> | undefined, id: UpgradeId): number {
  return Math.max(0, Math.min(UPGRADE_TRACKS[id].levels, Math.floor(upgrades?.[id] ?? 0)));
}

/** A fresh run's player state with the profile's upgrades applied: the
 * two gauges through their sockets, the rest as MetaBonuses. */
export function applyUpgrades(state: RunPlayerState, upgrades: Readonly<Record<string, number>> | undefined): RunPlayerState {
  const at = (id: UpgradeId) => upgradeLevel(upgrades, id) * UPGRADE_TRACKS[id].step;
  if (!Object.keys(UPGRADE_TRACKS).some((id) => upgradeLevel(upgrades, id as UpgradeId) > 0)) return state;
  const power = (a: Archetype) => 1 + at(`power-${a}` as UpgradeId);
  return {
    ...state,
    breachThreshold: at('breach') ? Math.round(BREACH_THRESHOLD * (1 - at('breach'))) : state.breachThreshold,
    containmentThresholdScaler: at('containment') ? 1 + at('containment') : state.containmentThresholdScaler,
    meta: {
      fightHeat: 1 - at('fightHeat'),
      restHeat: at('restHeat'),
      shopPrice: 1 - at('shopPrice'),
      process: { exploit: power('exploit'), daemon: power('daemon'), overclock: power('overclock'), honeypot: power('honeypot') },
      burnerSlots: at('burnerSlots'),
      subroutineSlots: at('subroutineSlot'),
    },
  };
}

/** What a run starts with from the profile, pinned in its save so a
 * replay rebuilds the same run after later purchases: the upgrades, a
 * 4th starting subroutine (MP8) and a starting Burner (MP9). Security
 * Level joins in checkpoint 6. */
export interface RunSetup {
  upgrades?: Record<string, number>;
  starter?: string;
  burner?: BurnerId;
  /** Security Level 0-10 (MP13; "ascension" in code). */
  securityLevel?: number;
  /** Played without the Message Board (the user, session 71): no upgrades
   * and no starting picks, recorded so the run says so. */
  plain?: boolean;
  /** A Daily Run (session 72): its date, from which daily.ts rebuilds
   * the day's class, Mods and seed. */
  daily?: { date: string; practice?: boolean; mods?: { id: string }[] };
}

/** Security Levels (MP13-MP14): players see "Security Level 7", badged
 * "SEC 7". */
export const SECURITY_MAX = 10;
/** Rep per level (MP13): +15%, 2.5x at 10. */
export const SECURITY_REP_STEP = 0.15;
/** Every level: enemies this much stronger, and Heat gained this much
 * more (MP14; set by checkpoint 6's tuning). */
export const SECURITY_STRENGTH_STEP = 0.03;
export const SECURITY_HEAT_STEP = 0.04;

/** What a Security Level changes in a run (MP14's ladder, cumulative). */
export interface SecurityRules {
  level: number;
  /** Multiplies enemy subroutines. */
  enemyStrength: number;
  /** Multiplies all Heat gained. */
  heatGain: number;
  /** The share of Heat kept when a layer's gatekeeper is beaten (D6; 0
   * resets fully). */
  heatCarry: number;
  /** Multiplies Shop prices. */
  shopPrice: number;
  /** Added to enemy Cribbage skill (capped at 1). */
  skillOffset: number;
  /** Subroutine and Mod choices a reward offers. */
  rewardChoices: number;
  /** Multiplies the Heat allowance. */
  allowance: number;
  /** Multiplies a Safehouse rest's Heat. */
  rest: number;
  /** Multiply enemy Containment and the player's Breach (the gauge
   * offsets at 2, 5, 8). */
  containment: number;
  breach: number;
  /** Extra Mods by tier: a gatekeeper's from layer 3 (`gatekeeper`), the
   * final (layer 4) gatekeeper's on top. */
  extraMods: { regular: number; elite: number; gatekeeper: number; finalGatekeeper: number };
}

export function securityRules(levelIn: number): SecurityRules {
  const level = Math.max(0, Math.min(SECURITY_MAX, Math.floor(levelIn)));
  const at = (n: number) => level >= n;
  const offsets = [2, 5, 8].filter(at).length;
  return {
    level,
    enemyStrength: 1 + SECURITY_STRENGTH_STEP * level,
    heatGain: 1 + SECURITY_HEAT_STEP * level,
    heatCarry: at(5) ? 0.25 : at(2) ? 0.1 : 0,
    shopPrice: at(7) ? 1.3 : at(3) ? 1.15 : 1,
    skillOffset: at(4) ? 0.1 : 0,
    rewardChoices: at(5) ? 2 : 3,
    allowance: at(6) ? 0.9 : 1,
    rest: at(9) ? 0.85 : 1,
    containment: 1 - 0.05 * offsets,
    breach: 1 + 0.05 * offsets,
    extraMods: { regular: at(8) ? 1 : 0, elite: at(10) ? 2 : at(1) ? 1 : 0, gatekeeper: at(7) ? 1 : 0, finalGatekeeper: at(10) ? 1 : 0 },
  };
}

/** A run's player state under its Security Level: the gauge offsets
 * through the threshold sockets (on top of any upgrades), the rest kept
 * for the run and encounters to read. */
export function applySecurity(state: RunPlayerState, levelIn: number | undefined): RunPlayerState {
  const rules = securityRules(levelIn ?? 0);
  if (!rules.level) return state;
  return {
    ...state,
    security: rules,
    breachThreshold: Math.round((state.breachThreshold ?? BREACH_THRESHOLD) * rules.breach),
    containmentThresholdScaler: (state.containmentThresholdScaler ?? 1) * rules.containment,
  };
}

export interface RepLine {
  label: string;
  rep: number;
}

/** A finished run's Rep, itemized for the end-of-run card. Depth first:
 * each layer breached (caught at the end counts at CAUGHT_REP_SHARE),
 * then elites beaten, then a victory. Regular fights and Data earn none. */
export function repForRun(result: RunResult, securityLevel = 0): { lines: RepLine[]; total: number } {
  const lines: RepLine[] = [];
  const cleared = result.log.filter((e) => e.type === 'layerCleared').map((e) => (e.type === 'layerCleared' ? e.layerIndex : 0));
  cleared.forEach((layerIndex, i) => {
    const caught = result.outcome === 'breachedThenCaught' && i === cleared.length - 1;
    const base = LAYER_REP[Math.min(layerIndex, LAYER_REP.length - 1)];
    lines.push({ label: `Layer ${layerIndex + 1} breached${caught ? ', then caught' : ''}`, rep: caught ? Math.round(base * CAUGHT_REP_SHARE) : base });
  });
  const elites = result.log.filter((e) => e.type === 'encounter' && e.nodeType === 'eliteFight' && e.outcome.newState === 'inert').length;
  if (elites) lines.push({ label: `${elites} elite${elites === 1 ? '' : 's'} beaten`, rep: elites * ELITE_REP });
  if (result.outcome === 'victory') lines.push({ label: 'Victory', rep: VICTORY_REP });
  // Security Level's bonus (MP13): +15% a level on everything above.
  const level = securityRules(securityLevel).level;
  const base = lines.reduce((s, l) => s + l.rep, 0);
  if (level && base) lines.push({ label: `Security Level ${level} ×${(1 + SECURITY_REP_STEP * level).toFixed(2)}`, rep: Math.round(base * SECURITY_REP_STEP * level) });
  return { lines, total: lines.reduce((s, l) => s + l.rep, 0) };
}

/** The upgrade tracks as the Message Board shows them (MP16): a name, what
 * a level does, and each level's price in Rep (checkpoint 5's pacing, the
 * user's option A: the four strongest tracks climb steeply, so victory
 * nears ~50% by run 20 and an upgrades-first player maxes out ~run
 * 50-60). */
export const UPGRADE_VIEW: Record<UpgradeId, { name: string; effect: (level: number) => string; prices: readonly number[] }> = {
  containment: { name: 'Low Profile', effect: (l) => `Enemy Containment +${l * 3}%`, prices: [25, 50, 90, 150, 240] },
  breach: { name: 'Exploit Research', effect: (l) => `Your Breach −${l * 3}%`, prices: [25, 50, 90, 150, 240] },
  fightHeat: { name: 'Clean Exits', effect: (l) => `Fight Heat −${l * 4}%`, prices: [25, 50, 90, 150, 240] },
  restHeat: { name: 'Safehouse Upgrades', effect: (l) => `Rest sheds ${l * 3} more Heat`, prices: [12, 18, 26, 36] },
  shopPrice: { name: 'Trade Contacts', effect: (l) => `Shop prices −${l * 4}%`, prices: [12, 18, 26, 36, 48] },
  'power-exploit': { name: 'Exploit Tuning', effect: (l) => `Exploit Processes +${l * 4}%`, prices: [15, 22, 30, 42, 54] },
  'power-daemon': { name: 'Daemon Tuning', effect: (l) => `Daemon Processes +${l * 4}%`, prices: [15, 22, 30, 42, 54] },
  'power-overclock': { name: 'Overclock Tuning', effect: (l) => `Overclock Processes +${l * 4}%`, prices: [15, 22, 30, 42, 54] },
  'power-honeypot': { name: 'Honeypot Tuning', effect: (l) => `Honeypot Processes +${l * 4}%`, prices: [15, 22, 30, 42, 54] },
  burnerSlots: { name: 'Burner Rig', effect: (l) => `Carry ${3 + l} Burners`, prices: [75, 120] },
  subroutineSlot: { name: 'Expanded Memory', effect: (l) => `Install ${6 + l} subroutines`, prices: [800] },
};

/** The next level's price, or null when the track is bought out. */
export function upgradePrice(id: UpgradeId, level: number): number | null {
  return UPGRADE_VIEW[id].prices[level] ?? null;
}

/** The library's prices by rarity (MP8: rares very high; checkpoint 5's
 * pacing: commons ~20 runs, uncommons ~50, all ~100). */
export const LIBRARY_PRICE: Record<Rarity, number> = { common: 25, uncommon: 90, rare: 320 };

/** What the library offers now (MP8): one subroutine per archetype, the
 * next locked in its pool's order; every common in every archetype
 * before any uncommon is shown, every uncommon before the rares. */
export function libraryOffers(unlocked: readonly string[]): { piece: SubroutineDefinition; rarity: Rarity; price: number }[] {
  const owned = new Set(unlocked);
  for (const rarity of ['common', 'uncommon', 'rare'] as const) {
    const key = rarity === 'common' ? 'commons' : rarity === 'uncommon' ? 'uncommons' : 'rares';
    const offers = Object.values(ARCHETYPE_POOLS).flatMap((pool) => {
      const next = pool[key].find((p) => !owned.has(p.id));
      return next ? [{ piece: next, rarity, price: LIBRARY_PRICE[rarity] }] : [];
    });
    if (offers.length) return offers;
  }
  return [];
}

/** The common Burners a run can start with once unlocked (MP9). */
export const STARTING_BURNERS: readonly BurnerId[] = (Object.keys(BURNER_DEFINITIONS) as BurnerId[]).filter((id) => {
  const b = BURNER_DEFINITIONS[id];
  return b.rarity === 'common' && b.contexts.length > 0 && !b.contraband;
});
export const STARTING_BURNER_PRICE = 25;
