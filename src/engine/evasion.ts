import type { PlayerIndex } from './game';
import { cribbageGame, playCribbageGame, type CribbageAnswer, type CribbageBeat, type CribbageRequest } from './basic-cribbage';

/**
 * Trace evasion (session 63, docs/trace-evasion-design.md TE1-TE8): when
 * you beat a gatekeeper but its Heat toll maxes your Heat, a short game
 * of plain Cribbage decides whether you slip away. The gatekeeper starts
 * ahead by a point per 10% of the Containment it had (TE1); three hands,
 * you dealing the 1st and 3rd (TE2); you escape only by finishing
 * strictly ahead (TE3). Side 0 is you, side 1 the gatekeeper.
 */
export const EVASION_HANDS = 3;

/** TE1: the gatekeeper's head start from its Containment fill (0-1) when
 * you beat it -- a point per 10%, rounded down, so 0-9 (you won, so it
 * never reached 100%). */
export function evasionHeadStart(enemyFill: number): number {
  return Math.min(9, Math.floor(Math.max(0, enemyFill) * 10 + 1e-9));
}

export interface EvasionResult {
  escaped: boolean;
  headStart: number;
  finalScores: [number, number];
  timeline: CribbageBeat[];
}

/** The evasion, paused at every decision (both sides' -- a driver
 * answers the gatekeeper's by its skill, as fights do). */
export function* evasionGame(seed: number, headStart: number): Generator<CribbageRequest, EvasionResult, CribbageAnswer> {
  const result = yield* cribbageGame({
    seed,
    // TE2: you deal first, so the 1st and 3rd hands' cribs are yours.
    startingDealer: 0 as PlayerIndex,
    handLimit: EVASION_HANDS,
    startingScores: [0, headStart],
    // TE3: a tie goes to the network.
    tieWinner: 1,
  });
  return { escaped: result.winner === 0, headStart, finalScores: result.finalScores, timeline: result.timeline };
}

/** A whole evasion answered by the AI at these skills (yours, its). */
export function playEvasion(seed: number, headStart: number, skills: [number, number]): EvasionResult {
  const result = playCribbageGame({ seed, startingDealer: 0, handLimit: EVASION_HANDS, startingScores: [0, headStart], tieWinner: 1, skills });
  return { escaped: result.winner === 0, headStart, finalScores: result.finalScores, timeline: result.timeline };
}
