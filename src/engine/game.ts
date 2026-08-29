import type { Card } from './cards';
import { createDeck, shuffle } from './deck';
import { createRng, deriveAiNoiseSeed, type Rng } from './rng';
import { deal, discardToCrib, discardLowestTwo, discardHighestTwo, cut, hisHeels, type DiscardStrategy, type CutStrategy } from './deal';
import { playPegging, playLowestLegal, type PlayStrategy, type PeggingEvent } from './pegging';
import { countHandEvents, countCribEvents, type HandScoreEvent } from './scoring';

export type PlayerIndex = 0 | 1;

export interface HandResult {
  dealer: PlayerIndex;
  starter: Card;
  hisHeelsPoints: number;
  peggingScores: [number, number];
  nonDealerHandScore: number;
  dealerHandScore: number;
  cribScore: number;
  /** Cumulative scores after this hand fully resolves. */
  scoresAfter: [number, number];
  /** Raw, ordered scoring events underlying the summed fields above —
   * additive (Phase 2 prep, session 17 checkpoint F): combat.ts feeds
   * these into initiative gauges and Occurrence triggers one at a time,
   * the same discrete/sequential treatment pegging already had and
   * hand-counting gained in the checkpoint C/D revision. */
  peggingEvents: PeggingEvent[];
  nonDealerHandEvents: HandScoreEvent[];
  dealerHandEvents: HandScoreEvent[];
  cribEvents: HandScoreEvent[];
}

export interface GameOptions {
  seed: number;
  discardStrategy?: DiscardStrategy;
  playStrategy?: PlayStrategy;
  /** Per-side override for discardStrategy/playStrategy above (session
   * 39) -- mirrors combat.ts's CombatOptions tuple shape, for a bare
   * (no roguelite mechanics) two-different-skill-levels cribbage match.
   * Undefined keeps both sides on the single discardStrategy/playStrategy
   * above, exactly as before this pair of fields existed. */
  discardStrategies?: [DiscardStrategy, DiscardStrategy];
  playStrategies?: [PlayStrategy, PlayStrategy];
  startingDealer?: PlayerIndex;
}

export interface GameResult {
  hands: HandResult[];
  finalScores: [number, number];
}

/**
 * Plays out one hand: deal, discard-to-crib, cut (incl. his heels),
 * pegging, then counting non-dealer hand / dealer hand / crib. Takes the
 * cumulative scores going in and returns scoresAfter reflecting this
 * hand's points added on top — callers (playHands below, combat.ts's
 * playCombat) drive dealer alternation and cumulative-score threading
 * themselves.
 *
 * `cutStrategy` and `forcedDiscardSide` are injection points for Root's
 * Cribbage-layer manipulation (skewCut / forceDiscard, resolved a hand
 * ahead by combat.ts via resolve.ts's consumePendingCribbageManipulation)
 * — both default to normal, unmanipulated play.
 */
export function playOneHand(
  dealer: PlayerIndex,
  priorScores: [number, number],
  rng: Rng,
  discardStrategy: DiscardStrategy = discardLowestTwo,
  playStrategy: PlayStrategy = playLowestLegal,
  cutStrategy: CutStrategy = cut,
  forcedDiscardSide?: PlayerIndex,
  /** Session 26: the caller's dedicated AI-decision-noise stream (see
   * rng.ts's deriveAiNoiseSeed) -- separate from `rng` above, which
   * drives shuffles/cuts. */
  aiRng?: Rng,
  /** Per-side override for discardStrategy/playStrategy above (session
   * 39) -- undefined keeps that side on the shared discardStrategy/
   * playStrategy parameter, exactly as before this pair of params
   * existed. Same append-at-the-end treatment as every other checkpoint
   * addition in this file. */
  discardStrategies?: [DiscardStrategy, DiscardStrategy],
  playStrategies?: [PlayStrategy, PlayStrategy],
): HandResult {
  const nonDealer: PlayerIndex = (1 - dealer) as PlayerIndex;
  const scores: [number, number] = [...priorScores];

  const shuffled = shuffle(createDeck(), rng);
  const { hands: dealtHands, stock } = deal(shuffled);

  const discard0 = discardStrategies ? discardStrategies[0] : discardStrategy;
  const discard1 = discardStrategies ? discardStrategies[1] : discardStrategy;
  const d0 = discardToCrib({ hand: dealtHands[0], isOwnCrib: dealer === 0, rng: aiRng }, forcedDiscardSide === 0 ? discardHighestTwo : discard0);
  const d1 = discardToCrib({ hand: dealtHands[1], isOwnCrib: dealer === 1, rng: aiRng }, forcedDiscardSide === 1 ? discardHighestTwo : discard1);
  const crib = [...d0.discarded, ...d1.discarded];

  const { starter } = cutStrategy(stock, rng);
  const heelsPoints = hisHeels(starter);
  scores[dealer] += heelsPoints;

  const kept: [Card[], Card[]] = [d0.keptHand, d1.keptHand];
  const { scores: peggingScores, events: peggingEvents } = playPegging(kept[0], kept[1], nonDealer, playStrategies ?? [playStrategy, playStrategy], undefined, undefined, aiRng);
  scores[0] += peggingScores[0];
  scores[1] += peggingScores[1];

  const nonDealerHandEvents = countHandEvents(kept[nonDealer], starter);
  const nonDealerHandScore = nonDealerHandEvents.reduce((sum, e) => sum + e.points, 0);
  scores[nonDealer] += nonDealerHandScore;

  const dealerHandEvents = countHandEvents(kept[dealer], starter);
  const dealerHandScore = dealerHandEvents.reduce((sum, e) => sum + e.points, 0);
  scores[dealer] += dealerHandScore;

  const cribEvents = countCribEvents(crib, starter);
  const cribScore = cribEvents.reduce((sum, e) => sum + e.points, 0);
  scores[dealer] += cribScore;

  return {
    dealer,
    starter,
    hisHeelsPoints: heelsPoints,
    peggingScores,
    nonDealerHandScore,
    dealerHandScore,
    cribScore,
    scoresAfter: scores,
    peggingEvents,
    nonDealerHandEvents,
    dealerHandEvents,
    cribEvents,
  };
}

/**
 * Plays out `handCount` full hands, alternating dealer each time.
 * Deliberately has no target-score/winner concept — this file stays the
 * pure primitive layer (deal/discard/cut/peg/count), with no game-mode
 * concept baked in, mirroring how combat.ts (Breach/Containment) lives
 * as its own separate file built on these primitives rather than inside
 * this one. Basic Cribbage (standard race-to-121, no roguelite layer at
 * all) is a planned alternate game mode (session 39, stated explicitly
 * at least twice -- see BACKLOG.md's "NEXT SESSION" section and this
 * project's memory) with the same shape: a real win-loop belongs in its
 * own peer file (basic-cribbage.ts) built on playOneHand below, not
 * inline in a scratch script and not merged into this one.
 */
export function playHands(handCount: number, options: GameOptions): GameResult {
  const {
    seed,
    discardStrategy = discardLowestTwo,
    playStrategy = playLowestLegal,
    discardStrategies,
    playStrategies,
    startingDealer = 0,
  } = options;

  const rng = createRng(seed);
  const aiRng = createRng(deriveAiNoiseSeed(seed));
  let dealer: PlayerIndex = startingDealer;
  let scores: [number, number] = [0, 0];
  const hands: HandResult[] = [];

  for (let i = 0; i < handCount; i++) {
    const hand = playOneHand(dealer, scores, rng, discardStrategy, playStrategy, cut, undefined, aiRng, discardStrategies, playStrategies);
    hands.push(hand);
    scores = hand.scoresAfter;
    dealer = (1 - dealer) as PlayerIndex;
  }

  return { hands, finalScores: scores };
}
