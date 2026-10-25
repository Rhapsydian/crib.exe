import type { Card } from './cards';
import { cardValue, cardsEqual } from './cards';
import type { Rng } from './rng';

/**
 * Root mechanical redesign (session 24): context object, same reasoning
 * as deal.ts's DiscardContext. `sequence` is the cards played since the
 * count was last reset (what scorePlay already builds internally, now
 * also handed to the strategy). `knownCrib`/`knownOpponentHand`, when
 * set, are revealed by crib-selection-time / play-phase-start recon
 * payloads (resolve.ts) -- absent whenever no such recon fired this
 * hand.
 */
/** The pegging count's limit in plain Cribbage. */
export const COUNT_LIMIT = 31;

export interface PlayContext {
  legalCards: Card[];
  count: number;
  sequence: Card[];
  /** The count's limit when it isn't 31 (Short Count, session 72). */
  limit?: number;
  knownCrib?: Card[];
  knownOpponentHand?: Card[];
  /** Session 26: same AI-decision-noise Rng stream as DiscardContext.rng
   * (deal.ts) -- see its doc comment for the full reasoning. */
  rng?: Rng;
}

export type PlayStrategy = (ctx: PlayContext) => Card;

/** Legal-not-good: always plays the lowest-value legal card. */
export const playLowestLegal: PlayStrategy = ({ legalCards }) =>
  legalCards.slice().sort((a, b) => cardValue(a) - cardValue(b))[0];

export type PlayerIndex = 0 | 1;

export interface PegScoreBreakdown {
  fifteen: number;
  pair: number;
  run: number;
  thirtyOne: number;
  total: number;
}

export interface PegPlayEvent {
  type: 'play';
  player: PlayerIndex;
  card: Card;
  count: number;
  /** Points scored by this specific play (15/pair/run/31, additive). Equal to breakdown.total. */
  score: number;
  breakdown: PegScoreBreakdown;
}

export interface PegGoEvent {
  type: 'go';
  player: PlayerIndex;
}

export interface PegGoPointEvent {
  type: 'go-point';
  player: PlayerIndex;
}

export type PeggingEvent = PegPlayEvent | PegGoEvent | PegGoPointEvent;

export interface PeggingResult {
  scores: [number, number];
  events: PeggingEvent[];
}

interface SequenceCard {
  card: Card;
  player: PlayerIndex;
}

/**
 * Scores a single play against the current running sequence (cards played
 * since the count was last reset) and count. 15/31/pair/run are all
 * independent and additive — e.g. a play can score 15 and complete a run
 * in the same play. Pair and run are mutually exclusive by construction:
 * a pair requires the last 2 ranks to match, which always breaks the
 * distinct-rank requirement any run window ending at the same card would
 * need.
 *
 * Exported as `scoreCardPlay` (session 24 tunable-skill AI checkpoint B)
 * for `ai.ts`'s pegging heuristic to reuse directly rather than
 * reimplementing the same scoring rules a second time — takes the plain
 * `Card[]` shape `PlayContext.sequence` already carries (who played each
 * card was never actually used below).
 */
export function scoreCardPlay(cardsSinceReset: Card[], count: number, limit = COUNT_LIMIT): PegScoreBreakdown {
  let fifteen = 0;
  let thirtyOne = 0;
  if (count === 15) fifteen += 2;
  // The count's limit is 31, or Short Count's 21 (a daily Glitch, session
  // 72: "21 is the 31"); hitting it exactly scores 2 either way.
  if (count === limit) thirtyOne += 2;

  const ranks = cardsSinceReset.map((c) => c.rank);
  const lastRank = ranks[ranks.length - 1];
  let pairRun = 1;
  for (let i = ranks.length - 2; i >= 0 && ranks[i] === lastRank; i--) {
    pairRun++;
  }
  let pair = 0;
  if (pairRun === 2) pair += 2;
  else if (pairRun === 3) pair += 6;
  else if (pairRun >= 4) pair += 12;

  let run = 0;
  if (pairRun < 2) {
    for (let k = cardsSinceReset.length; k >= 3; k--) {
      const window = ranks.slice(ranks.length - k);
      const uniq = new Set(window);
      if (uniq.size === k) {
        const min = Math.min(...window);
        const max = Math.max(...window);
        if (max - min === k - 1) {
          run += k;
          break;
        }
      }
    }
  }

  return { fifteen, pair, run, thirtyOne, total: fifteen + pair + run + thirtyOne };
}

/**
 * Step-by-step pegging (milestone 1, `docs/playable-design.md` P1/P8):
 * the same rules as playPegging, split at the one point a player decides
 * something -- which card to play -- so a caller can pause there (for a
 * human, or to resolve combat live after each play). playPegging below is
 * built on these and behaves exactly as before.
 *
 * The state is mutated in place for speed (pegging runs millions of times
 * in a balance sweep); treat it as owned by one caller.
 */
export interface PeggingState {
  hands: [Card[], Card[]];
  count: number;
  sequence: SequenceCard[];
  turn: PlayerIndex;
  lastPlayerToAct: PlayerIndex | null;
  passesInARow: number;
  scores: [number, number];
  events: PeggingEvent[];
  done: boolean;
  /** The count's limit (31; Short Count's 21). */
  limit: number;
}

/** What the player to act must decide: they hold at least one legal card. */
export interface PeggingDecision {
  player: PlayerIndex;
  legalCards: Card[];
  count: number;
  sequence: Card[];
  limit: number;
}

export function startPegging(hand0: Card[], hand1: Card[], firstToAct: PlayerIndex, limit = COUNT_LIMIT): PeggingState {
  return {
    limit,
    hands: [hand0.slice(), hand1.slice()],
    count: 0,
    sequence: [],
    turn: firstToAct,
    lastPlayerToAct: null,
    passesInARow: 0,
    scores: [0, 0],
    events: [],
    done: false,
  };
}

/** Plays out every forced step (a player with no legal card says "go";
 * the go point; the end of pegging) until someone must choose a card, or
 * pegging is over. Returns the events those steps produced, and the
 * decision now due (null when pegging is done). */
export function advancePegging(state: PeggingState): { events: PeggingEvent[]; decision: PeggingDecision | null } {
  const events: PeggingEvent[] = [];
  const push = (e: PeggingEvent) => {
    events.push(e);
    state.events.push(e);
  };
  while (!state.done) {
    if (state.hands[0].length === 0 && state.hands[1].length === 0) {
      // Natural end of pegging: the very last card played also counts as
      // "last card" if nothing has resolved it yet (i.e. it wasn't a 31).
      if (state.lastPlayerToAct !== null) {
        state.scores[state.lastPlayerToAct] += 1;
        push({ type: 'go-point', player: state.lastPlayerToAct });
      }
      state.done = true;
      break;
    }
    const player = state.turn;
    const legal = state.hands[player].filter((c) => state.count + cardValue(c) <= state.limit);
    if (legal.length > 0) {
      return { events, decision: { player, legalCards: legal, count: state.count, sequence: state.sequence.map((s) => s.card), limit: state.limit } };
    }
    push({ type: 'go', player });
    state.passesInARow += 1;
    state.turn = (1 - player) as PlayerIndex;
    if (state.passesInARow === 2) {
      if (state.lastPlayerToAct !== null) {
        state.scores[state.lastPlayerToAct] += 1;
        push({ type: 'go-point', player: state.lastPlayerToAct });
      }
      state.count = 0;
      state.sequence = [];
      state.lastPlayerToAct = null;
      state.passesInARow = 0;
    }
  }
  return { events, decision: null };
}

/** Plays `card` for the player whose decision is due (advancePegging's).
 * Returns the play event, with what it scored. */
export function playPeggingCard(state: PeggingState, card: Card): PegPlayEvent {
  const player = state.turn;
  state.hands[player] = state.hands[player].filter((c) => !cardsEqual(c, card));
  state.count += cardValue(card);
  state.sequence.push({ card, player });
  const breakdown = scoreCardPlay(state.sequence.map((s) => s.card), state.count, state.limit);
  state.scores[player] += breakdown.total;
  const event: PegPlayEvent = { type: 'play', player, card, count: state.count, score: breakdown.total, breakdown };
  state.events.push(event);
  state.lastPlayerToAct = player;
  state.passesInARow = 0;
  if (state.count === state.limit) {
    state.count = 0;
    state.sequence = [];
    state.lastPlayerToAct = null; // already paid via the +2 above, no separate go point
  }
  state.turn = (1 - player) as PlayerIndex;
  return event;
}

/**
 * Plays out the pegging phase for two already-discarded (4-card) hands.
 * `firstToAct` is a parameter rather than a hardcoded convention — the
 * caller (the real rule is "non-dealer plays first") decides.
 * `chooseCard` is per-side (session 24 tunable-skill AI checkpoint A) --
 * each side's own strategy is called only when it's that side's turn to
 * play, receiving that side's own `knownCrib`/`knownOpponentHand` (also
 * per-side now, since recon is per-side too) rather than one shared pair
 * for both. Both default to `[playLowestLegal, playLowestLegal]`.
 * `knownCrib`/`knownOpponentHand` are static for the whole phase once
 * set (recon fires before pegging starts, not during it).
 */
export function playPegging(
  hand0: Card[],
  hand1: Card[],
  firstToAct: PlayerIndex,
  chooseCard: [PlayStrategy, PlayStrategy] = [playLowestLegal, playLowestLegal],
  knownCrib?: [Card[] | undefined, Card[] | undefined],
  knownOpponentHand?: [Card[] | undefined, Card[] | undefined],
  /** Session 26: the caller's dedicated AI-decision-noise stream (see
   * rng.ts's deriveAiNoiseSeed), shared by both sides -- only one side
   * acts per turn, so consuming it in strict turn order stays fully
   * deterministic without needing a separate stream per side. */
  aiRng?: Rng,
): PeggingResult {
  const state = startPegging(hand0, hand1, firstToAct);
  for (let step = advancePegging(state); step.decision; step = advancePegging(state)) {
    const { player, legalCards, count, sequence } = step.decision;
    const card = chooseCard[player]({
      legalCards,
      count,
      sequence,
      knownCrib: knownCrib?.[player],
      knownOpponentHand: knownOpponentHand?.[player],
      rng: aiRng,
    });
    playPeggingCard(state, card);
  }
  return { scores: state.scores, events: state.events };
}
