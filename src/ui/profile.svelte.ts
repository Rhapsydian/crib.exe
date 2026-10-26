import type { Stars } from '../engine/skill';
import type { ClassId } from '../engine/classes';
import { CLASS_FALLBACK_REP, CLASS_ORDER, SECURITY_MAX, LIBRARY_PRICE, STARTING_BURNER_PRICE, STARTING_BURNERS, TUTORIAL_REP, libraryOffers, upgradeLevel, upgradePrice, type RepLine, type UpgradeId } from '../engine/meta';
import type { BurnerId } from '../engine/burner-types';
import { dailyDate, type ScoreLine } from '../engine/daily';
import { ALL_SUBROUTINES } from '../engine/subroutines';
import { RESET_PROFILE_FLAG, UNLOCK_ALL_FLAG } from './testing-flags';

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
  /** Subroutines unlocked in the library (MP8): a run can start with one
   * as a 4th starter. */
  library: string[];
  /** Common Burners unlocked to start a run with (MP9). */
  burners: BurnerId[];
  /** The Message Board's one-time introduction has been seen (MP16). */
  boardIntroduced: boolean;
  /** The class select's last starting picks, remembered. */
  starter: string | null;
  burner: BurnerId | null;
  /** Full runs won, at any Security Level. */
  victories: number;
  /** The highest Security Level open (MP13): 0 until every class is
   * unlocked and a run is won, then 1; winning at the highest open level
   * opens the next, up to 10. */
  securityOpen: number;
  /** Each class's highest Security Level won (MP15). */
  securityBest: Partial<Record<ClassId, number>>;
  /** The class select's last Security Level pick. */
  securityPick: number;
  /** The class select's last "without Message Board upgrades" choice. */
  plainPick: boolean;
  /** Daily Runs by date (session 72, DR1, DR9): the scored attempt's score
   * (`started` once it begins, so later runs are practice even if it's
   * abandoned) and the best practice score. */
  daily: Record<string, DailyRecord>;
}

export interface DailyRecord {
  started?: boolean;
  scored?: number;
  best?: number;
}

export const PROFILE_VERSION = 1;
const KEY = 'cribexe.profile';

export function freshProfile(): Profile {
  return { version: PROFILE_VERSION, rep: 0, repEarned: 0, runsFinished: 0, tutorialGranted: false, classes: ['exploit-overclock'], upgrades: {}, lastRunId: null, library: [], burners: [], boardIntroduced: false, starter: null, burner: null, victories: 0, securityOpen: 0, securityBest: {}, securityPick: 0, plainPick: false, daily: {} };
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
  lastAward = $state.raw<{ runId: string; lines: RepLine[]; unlocked?: ClassId; securityOpened?: number } | null>(null);

  /** The highest Security Level open (`?unlockall`: all ten). */
  get securityOpen(): number {
    return UNLOCK_ALL_FLAG ? SECURITY_MAX : this.data.securityOpen;
  }

  /** Whether a class can be played (`?unlockall` opens them all). */
  hasClass(id: ClassId): boolean {
    return UNLOCK_ALL_FLAG || this.data.classes.includes(id);
  }

  /** The first locked class in the chain: the only one the fallback
   * sells (MP6). */
  get nextLocked(): ClassId | null {
    return CLASS_ORDER.find((id) => !this.hasClass(id)) ?? null;
  }

  /** The fallback: buy the next locked class for CLASS_FALLBACK_REP. */
  buyClass(id: ClassId): boolean {
    if (id !== this.nextLocked || this.data.rep < CLASS_FALLBACK_REP) return false;
    const classes = [...this.data.classes, id];
    // Buying the last class can complete Security Levels' unlock (MP13).
    const securityOpen = !this.data.securityOpen && this.data.victories > 0 && CLASS_ORDER.every((c) => classes.includes(c)) ? 1 : this.data.securityOpen;
    this.data = { ...this.data, rep: this.data.rep - CLASS_FALLBACK_REP, classes, securityOpen };
    this.#save();
    return true;
  }

  #save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Storage blocked or full: progress lasts the session.
    }
  }

  #spend(price: number, change: Partial<Profile>): boolean {
    if (this.data.rep < price) return false;
    this.data = { ...this.data, ...change, rep: this.data.rep - price };
    this.#save();
    return true;
  }

  /** An upgrade's next level (MP7; no refunds, MP12). */
  buyUpgrade(id: UpgradeId): boolean {
    const level = upgradeLevel(this.data.upgrades, id);
    const price = upgradePrice(id, level);
    return price !== null && this.#spend(price, { upgrades: { ...this.data.upgrades, [id]: level + 1 } });
  }

  /** Library subroutines that can start a run (`?unlockall`: all). */
  get library(): string[] {
    return UNLOCK_ALL_FLAG ? ALL_SUBROUTINES.map((p) => p.id) : this.data.library;
  }

  /** A library subroutine, only while it's on offer (MP8's order). */
  buyLibrary(id: string): boolean {
    const offer = libraryOffers(this.data.library).find((o) => o.piece.id === id);
    return !!offer && this.#spend(LIBRARY_PRICE[offer.rarity], { library: [...this.data.library, id] });
  }

  /** Starting Burners unlocked (`?unlockall`: all). */
  get burners(): BurnerId[] {
    return UNLOCK_ALL_FLAG ? [...STARTING_BURNERS] : this.data.burners;
  }

  buyBurner(id: BurnerId): boolean {
    if (!STARTING_BURNERS.includes(id) || this.data.burners.includes(id)) return false;
    return this.#spend(STARTING_BURNER_PRICE, { burners: [...this.data.burners, id] });
  }

  /** The Message Board's introduction, seen. */
  introduceBoard(): void {
    this.data = { ...this.data, boardIntroduced: true };
    this.#save();
  }

  /** The class select's starting picks, remembered for next time. */
  rememberPicks(starter: string | null, burner: BurnerId | null, securityPick = this.data.securityPick, plainPick = this.data.plainPick): void {
    this.data = { ...this.data, starter, burner, securityPick, plainPick };
    this.#save();
  }

  /** A finished run's Rep, once per run, and the class its milestone
   * unlocks (MP2), if any and not already open. */
  awardRun(runId: string, lines: readonly RepLine[], unlock: ClassId | null = null, run?: { classId: ClassId; securityLevel: number; won: boolean }): void {
    if (this.data.lastRunId === runId) return;
    const total = lines.reduce((s, l) => s + l.rep, 0);
    const unlocked = unlock && !this.data.classes.includes(unlock) ? unlock : undefined;
    const classes = unlocked ? [...this.data.classes, unlocked] : this.data.classes;
    // Security Levels (MP13, MP15): open once every class is unlocked and
    // a run is won; a win at the highest open level opens the next.
    let { victories, securityOpen, securityBest } = this.data;
    if (run?.won) {
      victories++;
      if (run.securityLevel > (securityBest[run.classId] ?? -1)) securityBest = { ...securityBest, [run.classId]: run.securityLevel };
      if (run.securityLevel >= 1 && run.securityLevel === securityOpen) securityOpen = Math.min(SECURITY_MAX, securityOpen + 1);
    }
    if (!securityOpen && victories > 0 && CLASS_ORDER.every((id) => classes.includes(id))) securityOpen = 1;
    const securityOpened = securityOpen > this.data.securityOpen ? securityOpen : undefined;
    this.lastAward = { runId, lines: [...lines], unlocked, securityOpened };
    this.data = { ...this.data, rep: this.data.rep + total, repEarned: this.data.repEarned + total, runsFinished: this.data.runsFinished + 1, lastRunId: runId, classes, victories, securityOpen, securityBest };
    this.#save();
  }

  /** The latest daily's score, itemized, for its end card (not saved). */
  lastDaily = $state.raw<{ runId: string; date: string; practice: boolean; lines: ScoreLine[]; total: number; stars: Stars | null } | null>(null);

  /** A daily's attempt begins: the first one of a date is the scored
   * attempt; it returns whether this one is practice. */
  startDaily(date: string): boolean {
    const record = this.data.daily[date] ?? {};
    if (record.started) return true;
    this.data = { ...this.data, daily: { ...this.data.daily, [date]: { ...record, started: true } } };
    this.#save();
    return false;
  }

  /** A daily run's end (DR1, DR6): the scored attempt's score and Rep (no
   * class unlocks or Security Levels: those belong to normal runs); a
   * practice run's best, and no Rep. */
  finishDaily(runId: string, date: string, practice: boolean, scoreLines: ScoreLine[], stars: Stars | null, lines: readonly RepLine[]): void {
    if (this.data.lastRunId === runId) return;
    const score = scoreLines.reduce((s, l) => s + l.points, 0);
    this.lastDaily = { runId, date, practice, lines: scoreLines, total: score, stars };
    const record = this.data.daily[date] ?? {};
    const next: DailyRecord = practice ? { ...record, best: Math.max(record.best ?? 0, score) } : { ...record, started: true, scored: score };
    const total = practice ? 0 : lines.reduce((s, l) => s + l.rep, 0);
    this.lastAward = { runId, lines: practice ? [] : [...lines] };
    this.data = { ...this.data, daily: { ...this.data.daily, [date]: next }, rep: this.data.rep + total, repEarned: this.data.repEarned + total, runsFinished: this.data.runsFinished + 1, lastRunId: runId };
    this.#save();
  }

  /** Consecutive days with a scored attempt, ending today (or yesterday,
   * if today's isn't played yet). */
  dailyStreak(today: string): number {
    const day = (d: string, back: number) => {
      const [y, m, dd] = d.split('-').map(Number);
      return dailyDate(new Date(y, m - 1, dd - back));
    };
    let back = this.data.daily[today]?.scored !== undefined ? 0 : 1;
    let n = 0;
    while (this.data.daily[day(today, back)]?.scored !== undefined) n++, back++;
    return n;
  }

  /** The last `n` days, today first: each date and its record. */
  dailyHistory(today: string, n = 14): { date: string; record: DailyRecord | undefined }[] {
    const [y, m, d] = today.split('-').map(Number);
    return Array.from({ length: n }, (_, i) => {
      const date = dailyDate(new Date(y, m - 1, d - i));
      return { date, record: this.data.daily[date] };
    });
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
