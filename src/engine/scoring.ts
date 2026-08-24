import type { Card } from './cards';
import { cardValue, isJack } from './cards';

export interface HandScoreBreakdown {
  fifteens: number;
  pairs: number;
  runs: number;
  flush: number;
  nobs: number;
  total: number;
}

/**
 * One discrete scoring instance from the show/count phase — e.g. one
 * specific 15-combination, or one same-rank pair-group (a pair royal is
 * still a *single* event with points: 6, a magnitude variant of "pair",
 * not 3 separate pair events; but two separate pairs of different ranks
 * in the same hand genuinely are 2 events). Mirrors pegging's existing
 * per-play discreteness, in the order a human would announce them at the
 * table (fifteens, then pairs, then runs, then flush, then nobs) — this
 * is what lets Phase 2 feed hand-count scoring into initiative gauges
 * and Occurrence triggers event-by-event instead of as one lump.
 */
export interface HandScoreEvent {
  category: 'fifteen' | 'pair' | 'run' | 'flush' | 'nobs';
  points: number;
}

function fifteenEvents(fiveCards: Card[]): HandScoreEvent[] {
  const events: HandScoreEvent[] = [];
  const n = fiveCards.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sum += cardValue(fiveCards[i]);
    }
    if (sum === 15) events.push({ category: 'fifteen', points: 2 });
  }
  return events;
}

function rankCounts(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const c of cards) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  }
  return counts;
}

/** One event per distinct rank that has 2+ cards — n cards of a rank is
 * a single event worth n*(n-1) (2/6/12 for pair/royal/double-royal), but
 * two different ranks each with their own pair produce two events. */
function pairEvents(fiveCards: Card[]): HandScoreEvent[] {
  const events: HandScoreEvent[] = [];
  for (const n of rankCounts(fiveCards).values()) {
    if (n >= 2) events.push({ category: 'pair', points: n * (n - 1) });
  }
  return events;
}

/**
 * One event per contiguous run of distinct ranks (length >= 3), points
 * equal to run length times the product of each rank's duplicate count
 * — what naturally produces "double run"/"triple run" scoring. A 5-card
 * hand can't structurally contain two separate non-overlapping runs of
 * 3+, but the loop doesn't assume that.
 */
function runEvents(fiveCards: Card[]): HandScoreEvent[] {
  const counts = rankCounts(fiveCards);
  const distinctRanks = Array.from(counts.keys()).sort((a, b) => a - b);
  const events: HandScoreEvent[] = [];
  let i = 0;
  while (i < distinctRanks.length) {
    let j = i;
    while (j + 1 < distinctRanks.length && distinctRanks[j + 1] === distinctRanks[j] + 1) {
      j++;
    }
    const runLength = j - i + 1;
    if (runLength >= 3) {
      let product = 1;
      for (let k = i; k <= j; k++) {
        product *= counts.get(distinctRanks[k])!;
      }
      events.push({ category: 'run', points: runLength * product });
    }
    i = j + 1;
  }
  return events;
}

function nobsScore(fourCards: Card[], starter: Card): number {
  return fourCards.some((c) => isJack(c) && c.suit === starter.suit) ? 1 : 0;
}

/** Hand flush: the 4 hand cards alone must all match (4 pts); if the
 * starter also matches, that's 5. A hand that doesn't flush on its own 4
 * cards never flushes, even if the starter happens to match some of them. */
function handFlush(fourCards: Card[], starter: Card): number {
  if (fourCards.length === 0) return 0;
  const suit = fourCards[0].suit;
  if (!fourCards.every((c) => c.suit === suit)) return 0;
  return starter.suit === suit ? 5 : 4;
}

/** Crib flush is stricter: all 5 cards (4 crib + starter) must match, or
 * it's 0 — a crib can't score a 4-flush the way a hand can. */
function cribFlush(fourCards: Card[], starter: Card): number {
  if (fourCards.length === 0) return 0;
  const suit = fourCards[0].suit;
  return [...fourCards, starter].every((c) => c.suit === suit) ? 5 : 0;
}

function buildEvents(fourCards: Card[], starter: Card, flush: number): HandScoreEvent[] {
  if (fourCards.length !== 4) {
    throw new Error('countHand/countCrib expect exactly 4 cards plus the starter');
  }
  const five = [...fourCards, starter];
  const events: HandScoreEvent[] = [
    ...fifteenEvents(five),
    ...pairEvents(five),
    ...runEvents(five),
  ];
  if (flush > 0) events.push({ category: 'flush', points: flush });
  if (nobsScore(fourCards, starter) > 0) events.push({ category: 'nobs', points: 1 });
  return events;
}

const BREAKDOWN_FIELD: Record<HandScoreEvent['category'], keyof Omit<HandScoreBreakdown, 'total'>> = {
  fifteen: 'fifteens',
  pair: 'pairs',
  run: 'runs',
  flush: 'flush',
  nobs: 'nobs',
};

function breakdownFromEvents(events: HandScoreEvent[]): HandScoreBreakdown {
  const breakdown: HandScoreBreakdown = { fifteens: 0, pairs: 0, runs: 0, flush: 0, nobs: 0, total: 0 };
  for (const event of events) {
    breakdown[BREAKDOWN_FIELD[event.category]] += event.points;
    breakdown.total += event.points;
  }
  return breakdown;
}

export function countHand(hand: Card[], starter: Card): HandScoreBreakdown {
  return breakdownFromEvents(buildEvents(hand, starter, handFlush(hand, starter)));
}

export function countCrib(crib: Card[], starter: Card): HandScoreBreakdown {
  return breakdownFromEvents(buildEvents(crib, starter, cribFlush(crib, starter)));
}

/** Same underlying computation as countHand, exposed as the discrete
 * event list Phase 2's trigger/gauge system consumes. */
export function countHandEvents(hand: Card[], starter: Card): HandScoreEvent[] {
  return buildEvents(hand, starter, handFlush(hand, starter));
}

export function countCribEvents(crib: Card[], starter: Card): HandScoreEvent[] {
  return buildEvents(crib, starter, cribFlush(crib, starter));
}
