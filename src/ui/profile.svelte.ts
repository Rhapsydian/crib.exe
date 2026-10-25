import type { ClassId } from '../engine/classes';
import { TUTORIAL_REP, type RepLine } from '../engine/meta';
import { RESET_PROFILE_FLAG } from './testing-flags';

/**
 * The meta-progression profile (session 71, docs/meta-progression-design.md
 * MP10): Rep and everything bought or unlocked with it, kept apart from
 * run saves. A save breaks whenever the game changes; the profile must
 * not, so it carries its own version and `migrate` brings an older one
 * forward instead of discarding it.
 *
 * Kept in this browser's localStorage, wrapped so blocked storage never
 * breaks play (progress then lasts the session).
 */
export interface Profile {
  version: number;
  /** Rep to spend. */
  rep: number;
  /** Every Rep ever earned. */
  repEarned: number;
  /** Finished runs, the tutorial included (the Message Board appears
   * after the first, MP16). */
  runsFinished: number;
  tutorialGranted: boolean;
  /** Unlocked classes (checkpoint 2). */
  classes: ClassId[];
  /** Upgrade levels by track (checkpoint 3). */
  upgrades: Record<string, number>;
  /** The last run awarded, so a run never pays twice. */
  lastRunId: string | null;
}

export const PROFILE_VERSION = 1;
const KEY = 'cribexe.profile';

export function freshProfile(): Profile {
  return { version: PROFILE_VERSION, rep: 0, repEarned: 0, runsFinished: 0, tutorialGranted: false, classes: ['exploit-overclock'], upgrades: {}, lastRunId: null };
}

/** An older profile brought up to this version, keeping what it has: each
 * future version adds a step here. Missing fields take fresh values. */
export function migrate(raw: Partial<Profile>): Profile {
  return { ...freshProfile(), ...raw, version: PROFILE_VERSION };
}

function load(): Profile {
  try {
    if (RESET_PROFILE_FLAG) localStorage.removeItem(KEY);
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw) as Partial<Profile>);
  } catch {
    // Unreadable or blocked: start fresh.
  }
  return freshProfile();
}

class ProfileStore {
  data = $state<Profile>(load());
  /** The latest run's award, itemized, for its end-of-run card (not
   * saved). */
  lastAward = $state.raw<{ runId: string; lines: RepLine[] } | null>(null);

  #save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage blocked or full: progress lasts the session.
    }
  }

  /** A finished run's Rep, once per run. */
  awardRun(runId: string, lines: readonly RepLine[]): void {
    if (this.data.lastRunId === runId) return;
    const total = lines.reduce((s, l) => s + l.rep, 0);
    this.lastAward = { runId, lines: [...lines] };
    this.data = { ...this.data, rep: this.data.rep + total, repEarned: this.data.repEarned + total, runsFinished: this.data.runsFinished + 1, lastRunId: runId };
    this.#save();
  }

  /** The tutorial's one-time grant (it still counts as a finished run). */
  finishTutorial(runId: string): void {
    if (this.data.lastRunId === runId) return;
    const grant = this.data.tutorialGranted ? 0 : TUTORIAL_REP;
    this.lastAward = { runId, lines: grant ? [{ label: 'Tutorial complete', rep: grant }] : [] };
    this.data = { ...this.data, rep: this.data.rep + grant, repEarned: this.data.repEarned + grant, runsFinished: this.data.runsFinished + 1, tutorialGranted: true, lastRunId: runId };
    this.#save();
  }
}

export const profile = new ProfileStore();
