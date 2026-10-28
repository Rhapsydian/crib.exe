import type { PlayerIndex } from './game';
import type { EnemyDefinition } from './enemies';
import { ask, type RunRequest } from './run-requests';
import { discardSkillStrategy, pegSkillStrategy } from './ai';
import { discardLowestTwo } from './deal';
import { playLowestLegal } from './pegging';
import { cribbageGame, playCribbageGame, type CribbageAnswer, type CribbageBeat, type CribbageRequest } from './basic-cribbage';

/**
 * Trace evasion (session 63, docs/design/trace-evasion.md TE1-TE8): when
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

/**
 * The evasion inside a run (TE4-TE7): announced, played -- the
 * gatekeeper's decisions answered here at its own Cribbage skill, yours
 * surfacing as 'evasion' requests whose fallback plays at `playerSkill`
 * (the same baseline a fight's falls back to without one) -- and its
 * result announced. `layerIndex` is 0-based.
 */
export function* traceEvasion(
  enemy: EnemyDefinition,
  layerIndex: number,
  enemyFill: number,
  seed: number,
  enemySkill: number,
  playerSkill?: number,
): Generator<RunRequest, EvasionResult, unknown> {
  const headStart = evasionHeadStart(enemyFill);
  yield* ask({ kind: 'evasionStart', enemy, layer: layerIndex + 1, enemyFill, headStart, fallback: () => null });
  const theirDiscard = discardSkillStrategy(enemySkill);
  const theirPlay = pegSkillStrategy(enemySkill);
  const yourDiscard = playerSkill === undefined ? discardLowestTwo : discardSkillStrategy(playerSkill);
  const yourPlay = playerSkill === undefined ? playLowestLegal : pegSkillStrategy(playerSkill);
  const game = evasionGame(seed, headStart);
  let step = game.next();
  while (!step.done) {
    const r = step.value;
    const auto = (): CribbageAnswer =>
      r.kind === 'discard' ? (r.side === 0 ? yourDiscard : theirDiscard)(r.context) : (r.side === 0 ? yourPlay : theirPlay)(r.context);
    const answer = r.side === 0 ? yield* ask({ kind: 'evasion', request: r, fallback: auto }) : auto();
    step = game.next(answer);
  }
  const result = step.value;
  yield* ask({ kind: 'evasionEnd', enemy, layer: layerIndex + 1, result, fallback: () => null });
  return result;
}
