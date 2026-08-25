import type { Card } from './cards';
import { cardValue, cardsEqual } from './cards';

/**
 * Root mechanical redesign (session 24): context object, same reasoning
 * as deal.ts's DiscardContext. `sequence` is the cards played since the
 * count was last reset (what scorePlay already builds internally, now
 * also handed to the strategy). `knownCrib`/`knownOpponentHand`, when
 * set, are revealed by crib-selection-time / play-phase-start recon
 * payloads (resolve.ts) -- absent whenever no such recon fired this
 * hand.
 */
export interface PlayContext {
  legalCards: Card[];
  count: number;
  sequence: Card[];
  knownCrib?: Card[];
  knownOpponentHand?: Card[];
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
 */
function scorePlay(sequence: SequenceCard[], count: number): PegScoreBreakdown {
  let fifteen = 0;
  let thirtyOne = 0;
  if (count === 15) fifteen += 2;
  if (count === 31) thirtyOne += 2;

  const ranks = sequence.map((s) => s.card.rank);
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
    for (let k = sequence.length; k >= 3; k--) {
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
 * Plays out the pegging phase for two already-discarded (4-card) hands.
 * `firstToAct` is a parameter rather than a hardcoded convention — the
 * caller (the real rule is "non-dealer plays first") decides.
 * `knownCrib`/`knownOpponentHand` (session 24) are static for the whole
 * phase once set (recon fires before pegging starts, not during it) --
 * passed through unchanged into every PlayContext built below.
 */
export function playPegging(
  hand0: Card[],
  hand1: Card[],
  firstToAct: PlayerIndex,
  chooseCard: PlayStrategy = playLowestLegal,
  knownCrib?: Card[],
  knownOpponentHand?: Card[],
): PeggingResult {
  const hands: [Card[], Card[]] = [hand0.slice(), hand1.slice()];
  let count = 0;
  let sequence: SequenceCard[] = [];
  let turn: PlayerIndex = firstToAct;
  let lastPlayerToAct: PlayerIndex | null = null;
  let passesInARow = 0;
  const events: PeggingEvent[] = [];
  const scores: [number, number] = [0, 0];

  while (hands[0].length > 0 || hands[1].length > 0) {
    const player = turn;
    const legal = hands[player].filter((c) => count + cardValue(c) <= 31);

    if (legal.length > 0) {
      const card = chooseCard({ legalCards: legal, count, sequence: sequence.map((s) => s.card), knownCrib, knownOpponentHand });
      hands[player] = hands[player].filter((c) => !cardsEqual(c, card));
      count += cardValue(card);
      sequence.push({ card, player });
      const breakdown = scorePlay(sequence, count);
      scores[player] += breakdown.total;
      events.push({ type: 'play', player, card, count, score: breakdown.total, breakdown });
      lastPlayerToAct = player;
      passesInARow = 0;

      if (count === 31) {
        count = 0;
        sequence = [];
        lastPlayerToAct = null; // already paid via the +2 above, no separate go point
      }
      turn = (1 - player) as PlayerIndex;
    } else {
      events.push({ type: 'go', player });
      passesInARow += 1;
      turn = (1 - player) as PlayerIndex;

      if (passesInARow === 2) {
        if (lastPlayerToAct !== null) {
          scores[lastPlayerToAct] += 1;
          events.push({ type: 'go-point', player: lastPlayerToAct });
        }
        count = 0;
        sequence = [];
        lastPlayerToAct = null;
        passesInARow = 0;
      }
    }
  }

  // Natural end of pegging: the very last card played also counts as
  // "last card" if nothing has resolved it yet (i.e. it wasn't a 31).
  if (lastPlayerToAct !== null) {
    scores[lastPlayerToAct] += 1;
    events.push({ type: 'go-point', player: lastPlayerToAct });
  }

  return { scores, events };
}
