import type { RunPlayerState, RunResult } from './run';
import type { ClassId } from './classes';
import type { Archetype } from './subroutine-types';
import type { BurnerId } from './burner-types';
import { BREACH_THRESHOLD } from './encounters';

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
 * about 3-4 first-gatekeeper runs' Rep (first pass; set by pacing). */
export const CLASS_FALLBACK_REP = 75;

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
}

export interface RepLine {
  label: string;
  rep: number;
}

/** A finished run's Rep, itemized for the end-of-run card. Depth first:
 * each layer breached (caught at the end counts at CAUGHT_REP_SHARE),
 * then elites beaten, then a victory. Regular fights and Data earn none. */
export function repForRun(result: RunResult): { lines: RepLine[]; total: number } {
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
  return { lines, total: lines.reduce((s, l) => s + l.rep, 0) };
}
