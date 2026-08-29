import { createRng, deriveAiNoiseSeed } from './rng';
import { playOneHand, type HandResult, type PlayerIndex } from './game';
import { discardLowestTwo } from './deal';
import { playLowestLegal } from './pegging';
import { discardSkillStrategy, pegSkillStrategy } from './ai';

/**
 * Basic Cribbage: the planned alternate game mode (session 39, see
 * BACKLOG.md's "NEXT SESSION" section and this project's memory) --
 * standard race-to-121, no Breach/Containment, no subroutines/gauges/
 * Heat at all. Lives as its own file, a peer of combat.ts, both built on
 * game.ts's shared primitives (playOneHand) -- game.ts stays the pure
 * primitive layer with no target-score concept of its own, exactly as
 * combat.ts already keeps the roguelite mode out of that file.
 *
 * playerSkill and enemySkill are always independent (session 39's "never
 * interlocked" rule, first built for run.ts's own playerSkill option):
 * each is a separate optional 0-1 dial, defaulting to playCombat's own
 * baseline (discardLowestTwo/playLowestLegal, no skill dial) when
 * omitted. Neither side's value ever derives from or influences the
 * other's -- there is deliberately no shared/coupled skill concept here,
 * unlike the roguelite's own enemySkill(tier, layerIndex, fightNumber)
 * formula, which doesn't apply to a bare game with no tier/layer context.
 */

const WIN_SCORE = 121; // traditional Cribbage race-to-121
const SKUNK_THRESHOLD = 91; // loser under this: a skunk (double game value, traditional rule)
const DOUBLE_SKUNK_THRESHOLD = 61; // loser under this: a double skunk (triple game value)
const MAX_HANDS = 60; // generous ceiling -- real race-to-121 games resolve in well under this

export interface BasicCribbageOptions {
  seed: number;
  /** Side 0's skill dial (0-1). Undefined keeps side 0 at the baseline
   * discardLowestTwo/playLowestLegal strategy -- no skill dial at all. */
  playerSkill?: number;
  /** Side 1's skill dial (0-1), completely independent of playerSkill --
   * see this file's own doc comment on the "never interlocked" rule. */
  enemySkill?: number;
  startingDealer?: PlayerIndex;
}

export interface BasicCribbageResult {
  winner: PlayerIndex;
  hands: HandResult[];
  finalScores: [number, number];
  /** Loser finished under SKUNK_THRESHOLD (91) -- traditional Cribbage
   * scoring-significance flag, not a different win condition. */
  skunk: boolean;
  /** Loser finished under DOUBLE_SKUNK_THRESHOLD (61). Implies skunk
   * too (61 < 91), so both are true together on a double skunk. */
  doubleSkunk: boolean;
}

/**
 * Plays one real game of Basic Cribbage: real race to 121, alternating
 * dealer, stopping the instant either side crosses the line. Rare
 * same-hand double-crossing (both sides cross 121 within one hand's
 * combined pegging/hand/crib scoring) is resolved by higher score wins
 * -- a documented simplification, not a traditional-rules edge case this
 * function tries to fully replicate (real cribbage counts non-dealer's
 * hand before dealer's, ending the game the instant either crosses; this
 * engine resolves a whole hand's scoring atomically).
 */
export function playBasicCribbageGame(options: BasicCribbageOptions): BasicCribbageResult {
  const { seed, playerSkill, enemySkill, startingDealer = 0 } = options;

  const rng = createRng(seed);
  const aiRng = createRng(deriveAiNoiseSeed(seed));
  const discardStrategies: [ReturnType<typeof discardSkillStrategy>, ReturnType<typeof discardSkillStrategy>] = [
    playerSkill === undefined ? discardLowestTwo : discardSkillStrategy(playerSkill),
    enemySkill === undefined ? discardLowestTwo : discardSkillStrategy(enemySkill),
  ];
  const playStrategies: [ReturnType<typeof pegSkillStrategy>, ReturnType<typeof pegSkillStrategy>] = [
    playerSkill === undefined ? playLowestLegal : pegSkillStrategy(playerSkill),
    enemySkill === undefined ? playLowestLegal : pegSkillStrategy(enemySkill),
  ];

  let dealer: PlayerIndex = startingDealer;
  let scores: [number, number] = [0, 0];
  const hands: HandResult[] = [];

  for (let i = 0; i < MAX_HANDS; i++) {
    const hand = playOneHand(dealer, scores, rng, undefined, undefined, undefined, undefined, aiRng, discardStrategies, playStrategies);
    hands.push(hand);
    scores = hand.scoresAfter;
    if (scores[0] >= WIN_SCORE || scores[1] >= WIN_SCORE) break;
    dealer = (1 - dealer) as PlayerIndex;
  }

  const winner: PlayerIndex = scores[0] >= scores[1] ? 0 : 1;
  const loserScore = scores[1 - winner];
  return {
    winner,
    hands,
    finalScores: scores,
    skunk: loserScore < SKUNK_THRESHOLD,
    doubleSkunk: loserScore < DOUBLE_SKUNK_THRESHOLD,
  };
}
