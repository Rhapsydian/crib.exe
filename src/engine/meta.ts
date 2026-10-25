import type { RunResult } from './run';
import type { ClassId } from './classes';

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

/** What a run starts with from the profile, pinned in its save so a
 * replay rebuilds the same run after later purchases (checkpoint 3 adds
 * the upgrades, starting picks and Security Level). */
export interface RunSetup {
  upgrades?: Record<string, number>;
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
