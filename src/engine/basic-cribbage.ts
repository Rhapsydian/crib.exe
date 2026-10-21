import type { Card } from './cards';
import { createDeck, shuffle } from './deck';
import { createRng, deriveAiNoiseSeed } from './rng';
import { playOneHand, type HandResult, type PlayerIndex } from './game';
import { cut, deal, discardLowestTwo, discardToCrib, hisHeels, type DiscardContext, type DiscardStrategy } from './deal';
import { advancePegging, playLowestLegal, playPeggingCard, startPegging, type PeggingEvent, type PlayContext, type PlayStrategy } from './pegging';
import { countCribEvents, countHandEvents, type ShowScoreEvent } from './scoring';
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

export const WIN_SCORE = 121; // traditional Cribbage race-to-121
export const SKUNK_THRESHOLD = 91; // loser under this: a skunk (double game value, traditional rule)
export const DOUBLE_SKUNK_THRESHOLD = 61; // loser under this: a double skunk (triple game value)
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

// ---------------------------------------------------------------------
// The playable game (milestone 4, `docs/playable-design.md` V1-V6)
// ---------------------------------------------------------------------
//
// playBasicCribbageGame above scores each hand atomically, a documented
// simplification; it stays as it is, since skill-retention.ts and the
// cribbage-skill-matrix / occurrence-frequency diagnostics measure with
// it. The game a person plays is cribbageGame below: paused at every
// decision the way combat is (a generator yielding each discard and each
// pegging card, for BOTH sides -- a UI answers the AI side itself), and
// exact about the rules that decide close games:
// - the game ends the instant a player reaches 121, checked after His
//   Heels, after every pegging event, and after each show item;
// - the show counts non-dealer's hand, then dealer's hand, then the crib,
//   so the non-dealer can count out first.
// playCribbageGame is its simulation driver.

/** The four difficulty levels (V2): the opponent's Cribbage skill (ai.ts's
 * 0-1 dial). Tuned with scripts/cribbage-difficulty.ts (session 58, 1000
 * games a pairing) so the steps are even: a competent player (0.85) beats
 * them 94 / 75 / 58 / 43% of the time, and each level beats the one below
 * 66-76%. The dial is steep low down -- 0.4 played much like 0.3 -- hence
 * Easy at 0.6. The coach is a separate, per-game toggle (V3). */
export const DIFFICULTIES = {
  learn: { name: 'Learn to play', skill: 0.3, coach: true },
  easy: { name: 'Easy', skill: 0.6, coach: false },
  normal: { name: 'Normal', skill: 0.75, coach: false },
  hard: { name: 'Hard', skill: 1, coach: false },
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;

/** The game as it stands at a request: what a UI draws while a player
 * decides. */
export interface CribbageView {
  scores: [number, number];
  dealer: PlayerIndex;
  handIndex: number;
  /** The cut card, once cut (null during the discard). */
  starter: Card | null;
  /** Everything so far, for a UI to animate (the game's own record; read,
   * don't keep -- copy it). */
  timeline: readonly CribbageBeat[];
}

export type CribbageRequest =
  | { kind: 'discard'; side: PlayerIndex; context: DiscardContext; view: CribbageView }
  | { kind: 'play'; side: PlayerIndex; context: PlayContext; view: CribbageView; pegging: { hand: Card[]; opponentCardsLeft: number; events: readonly PeggingEvent[] } };

export type CribbageAnswer = [Card, Card] | Card;

/** Everything that happens at the table, in order, for a UI to animate.
 * Each beat carries the scores after it. */
export type CribbageBeat =
  | { kind: 'hand'; handIndex: number; dealer: PlayerIndex; scores: [number, number] }
  | { kind: 'cut'; starter: Card; dealer: PlayerIndex; heels: number; scores: [number, number] }
  | { kind: 'peg'; event: PeggingEvent; scores: [number, number] }
  | { kind: 'show'; owner: 'hand' | 'crib'; player: PlayerIndex; cards: Card[]; starter: Card; events: ShowScoreEvent[]; total: number; scores: [number, number] };

export type Skunk = 'none' | 'skunk' | 'double';

export interface CribbageGameResult {
  winner: PlayerIndex;
  finalScores: [number, number];
  /** Hands dealt (the last may have ended mid-way). */
  hands: number;
  skunk: Skunk;
  timeline: CribbageBeat[];
}

export interface CribbageGameOptions {
  seed: number;
  /** Who deals first. Defaults to a cut of the deck (the seed decides). */
  startingDealer?: PlayerIndex;
  target?: number;
  /** Stop after this many hands, the higher score winning (session 63:
   * trace evasion). Unset, the game runs to `target` as usual. */
  handLimit?: number;
  /** The scores the game starts from (a head start); default [0, 0]. */
  startingScores?: [number, number];
  /** Who wins a tie at the hand limit; default side 1. */
  tieWinner?: PlayerIndex;
}

export function skunkOf(loserScore: number): Skunk {
  return loserScore < DOUBLE_SKUNK_THRESHOLD ? 'double' : loserScore < SKUNK_THRESHOLD ? 'skunk' : 'none';
}

/** One game of Cribbage to `target`, paused at every decision. */
export function* cribbageGame(options: CribbageGameOptions): Generator<CribbageRequest, CribbageGameResult, CribbageAnswer> {
  const { seed, target = WIN_SCORE } = options;
  const rng = createRng(seed);
  // The AI's decision noise has its own stream (rng.ts's deriveAiNoiseSeed),
  // so how often an AI "rolls dice" never moves the deals.
  const aiRng = createRng(deriveAiNoiseSeed(seed));
  let dealer: PlayerIndex = options.startingDealer ?? (rng.nextInt(2) as PlayerIndex);
  const scores: [number, number] = options.startingScores ? [options.startingScores[0], options.startingScores[1]] : [0, 0];
  const timeline: CribbageBeat[] = [];
  const snap = (): [number, number] => [scores[0], scores[1]];

  const finish = (winner: PlayerIndex, hands: number): CribbageGameResult => ({
    winner,
    finalScores: snap(),
    hands,
    skunk: skunkOf(scores[(1 - winner) as PlayerIndex]),
    timeline,
  });
  /** Adds points; the scorer wins the moment they reach the target. */
  const award = (player: PlayerIndex, points: number): boolean => {
    scores[player] = Math.min(target, scores[player] + points);
    return scores[player] >= target;
  };

  for (let handIndex = 0; ; handIndex++) {
    const nonDealer = (1 - dealer) as PlayerIndex;
    const view = (starter: Card | null): CribbageView => ({ scores: snap(), dealer, handIndex, starter, timeline });
    timeline.push({ kind: 'hand', handIndex, dealer, scores: snap() });

    const { hands: dealt, stock } = deal(shuffle(createDeck(), rng));
    const discards = [] as ReturnType<typeof discardToCrib>[];
    for (const side of [0, 1] as PlayerIndex[]) {
      const context: DiscardContext = { hand: dealt[side], isOwnCrib: dealer === side, rng: aiRng };
      const chosen = (yield { kind: 'discard', side, context, view: view(null) }) as [Card, Card];
      const strategy: DiscardStrategy = () => chosen;
      discards[side] = discardToCrib(context, strategy);
    }
    const kept: [Card[], Card[]] = [discards[0].keptHand, discards[1].keptHand];
    const crib = [...discards[0].discarded, ...discards[1].discarded];

    const { starter } = cut(stock, rng);
    const heels = hisHeels(starter);
    const heelsWins = heels > 0 && award(dealer, heels);
    timeline.push({ kind: 'cut', starter, dealer, heels, scores: snap() });
    if (heelsWins) return finish(dealer, handIndex + 1);

    // Pegging: non-dealer leads.
    const pegging = startPegging(kept[0], kept[1], nonDealer);
    const scoreEvent = (event: PeggingEvent): boolean => {
      const points = event.type === 'play' ? event.score : event.type === 'go-point' ? 1 : 0;
      const won = points > 0 && award(event.player, points);
      timeline.push({ kind: 'peg', event, scores: snap() });
      return won;
    };
    for (;;) {
      const advanced = advancePegging(pegging);
      for (const event of advanced.events) if (scoreEvent(event)) return finish(event.player, handIndex + 1);
      if (!advanced.decision) break;
      const { player, legalCards, count, sequence } = advanced.decision;
      const card = (yield {
        kind: 'play',
        side: player,
        context: { legalCards, count, sequence, rng: aiRng },
        view: view(starter),
        pegging: { hand: pegging.hands[player].slice(), opponentCardsLeft: pegging.hands[(1 - player) as PlayerIndex].length, events: pegging.events },
      }) as Card;
      const played = playPeggingCard(pegging, card);
      if (scoreEvent(played)) return finish(player, handIndex + 1);
    }

    // The show, in order: non-dealer's hand, dealer's hand, the crib.
    const show: [owner: 'hand' | 'crib', player: PlayerIndex, cards: Card[], events: ShowScoreEvent[]][] = [
      ['hand', nonDealer, kept[nonDealer], countHandEvents(kept[nonDealer], starter)],
      ['hand', dealer, kept[dealer], countHandEvents(kept[dealer], starter)],
      ['crib', dealer, crib, countCribEvents(crib, starter)],
    ];
    for (const [owner, player, cards, events] of show) {
      const total = events.reduce((sum, e) => sum + e.points, 0);
      const won = total > 0 && award(player, total);
      timeline.push({ kind: 'show', owner, player, cards, starter, events, total, scores: snap() });
      if (won) return finish(player, handIndex + 1);
    }

    if (options.handLimit !== undefined && handIndex + 1 >= options.handLimit) {
      const winner: PlayerIndex = scores[0] > scores[1] ? 0 : scores[1] > scores[0] ? 1 : (options.tieWinner ?? 1);
      return finish(winner, handIndex + 1);
    }
    dealer = nonDealer;
  }
}

export interface PlayCribbageOptions extends CribbageGameOptions {
  discardStrategies?: [DiscardStrategy, DiscardStrategy];
  playStrategies?: [PlayStrategy, PlayStrategy];
  /** Shorthand for both sides' strategies at these skills (ai.ts's dial). */
  skills?: [number, number];
}

/** A whole game answered by strategies (the simulation driver). */
export function playCribbageGame(options: PlayCribbageOptions): CribbageGameResult {
  const skills = options.skills ?? [1, 1];
  const discard = options.discardStrategies ?? [discardSkillStrategy(skills[0]), discardSkillStrategy(skills[1])];
  const play = options.playStrategies ?? [pegSkillStrategy(skills[0]), pegSkillStrategy(skills[1])];
  const game = cribbageGame(options);
  let step = game.next();
  while (!step.done) {
    const r = step.value;
    step = game.next(r.kind === 'discard' ? discard[r.side](r.context) : play[r.side](r.context));
  }
  return step.value;
}
