import type { RunResult } from '../engine/run';
import type { ClassId } from '../engine/classes';
import { rateSkill, type SkillDecision } from './skill-review';
import type { DailyRecord } from './profile.svelte';

/**
 * Records (go-live step 6, the user's set): what a finished run, Daily or
 * Play Cribbage game adds to the player's history. Kept in the profile's
 * `stats` (so it exports, imports and erases with the rest), counted from
 * v0.9.0 on; the profile's older counters (runs finished, victories, Rep
 * earned, best Security Levels, the Daily history) predate it.
 */
export interface ClassStats {
  runs: number;
  wins: number;
  /** Most layers breached in one run. */
  deepest: number;
}

export interface Stats {
  /** Normal runs by class. */
  byClass: Partial<Record<ClassId, ClassStats>>;
  /** Most layers breached in any run, a Daily's included. */
  deepest: number;
  fights: number;
  elites: number;
  gatekeepers: number;
  /** Fights rated Flawless. */
  flawless: number;
  /** Every rated hand: points given up and hands, for the career rating. */
  skill: { lost: number; hands: number };
  /** Play Cribbage games, by difficulty. */
  cribbage: Record<string, { played: number; won: number }>;
}

export const freshStats = (): Stats => ({ byClass: {}, deepest: 0, fights: 0, elites: 0, gatekeepers: 0, flawless: 0, skill: { lost: 0, hands: 0 }, cribbage: {} });

/** What a finished run adds. */
export interface RunTally {
  classId: ClassId;
  daily: boolean;
  won: boolean;
  layers: number;
  fights: number;
  elites: number;
  gatekeepers: number;
  flawless: number;
  lost: number;
  hands: number;
}

/** Points given up and hands, from a run's or game's rated choices. */
export function skillTotals(decisions: readonly SkillDecision[]): { lost: number; hands: number } {
  const r = rateSkill(decisions, false);
  return r ? { lost: r.lostPerHand * r.hands, hands: r.hands } : { lost: 0, hands: 0 };
}

export function runTally(result: RunResult, classId: ClassId, daily: boolean, decisions: readonly SkillDecision[]): RunTally {
  let fights = 0;
  let elites = 0;
  let gatekeepers = 0;
  let flawless = 0;
  for (const e of result.log) {
    if (e.type !== 'encounter' || !e.outcome.fight) continue;
    if (e.outcome.fight.flawlessWaived !== undefined) flawless++;
    if (e.outcome.newState !== 'inert') continue;
    fights++;
    if (e.outcome.fight.tier === 'elite') elites++;
    if (e.outcome.fight.tier === 'gatekeeper') gatekeepers++;
  }
  return { classId, daily, won: result.outcome === 'victory', layers: result.layersCompleted, fights, elites, gatekeepers, flawless, ...skillTotals(decisions) };
}

export function addRun(s: Stats, t: RunTally): Stats {
  const c = s.byClass[t.classId] ?? { runs: 0, wins: 0, deepest: 0 };
  return {
    ...s,
    byClass: t.daily ? s.byClass : { ...s.byClass, [t.classId]: { runs: c.runs + 1, wins: c.wins + (t.won ? 1 : 0), deepest: Math.max(c.deepest, t.layers) } },
    deepest: Math.max(s.deepest, t.layers),
    fights: s.fights + t.fights,
    elites: s.elites + t.elites,
    gatekeepers: s.gatekeepers + t.gatekeepers,
    flawless: s.flawless + t.flawless,
    skill: { lost: s.skill.lost + t.lost, hands: s.skill.hands + t.hands },
  };
}

export function addCribbage(s: Stats, difficulty: string, won: boolean, skill: { lost: number; hands: number }): Stats {
  const d = s.cribbage[difficulty] ?? { played: 0, won: 0 };
  return { ...s, cribbage: { ...s.cribbage, [difficulty]: { played: d.played + 1, won: d.won + (won ? 1 : 0) } }, skill: { lost: s.skill.lost + skill.lost, hands: s.skill.hands + skill.hands } };
}

/** The Daily history in numbers: days with a scored attempt, the longest
 * run of consecutive ones, and the best score with its date. */
export function dailyRecords(daily: Record<string, DailyRecord>): { played: number; bestStreak: number; best: { score: number; date: string } | null } {
  const days = Object.keys(daily).filter((d) => daily[d].scored !== undefined).sort();
  let bestStreak = 0;
  let streak = 0;
  let prev: number | null = null;
  let best: { score: number; date: string } | null = null;
  for (const d of days) {
    const t = Date.parse(`${d}T12:00:00Z`);
    streak = prev !== null && Math.round((t - prev) / 86_400_000) === 1 ? streak + 1 : 1;
    bestStreak = Math.max(bestStreak, streak);
    prev = t;
    const score = daily[d].scored!;
    if (!best || score > best.score) best = { score, date: d };
  }
  return { played: days.length, bestStreak, best };
}
