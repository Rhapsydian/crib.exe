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

function combinationsFifteens(fiveCards: Card[]): number {
  const n = fiveCards.length;
  let combos = 0;
  for (let mask = 1; mask < 1 << n; mask++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sum += cardValue(fiveCards[i]);
    }
    if (sum === 15) combos++;
  }
  return combos * 2;
}

function rankCounts(cards: Card[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const c of cards) {
    counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  }
  return counts;
}

/** Every pair of same-rank cards scores 2, regardless of position — unlike
 * pegging's "consecutive plays only" rule. n cards of a rank = 2*C(n,2). */
function pairsScore(fiveCards: Card[]): number {
  let score = 0;
  for (const n of rankCounts(fiveCards).values()) {
    if (n >= 2) score += n * (n - 1);
  }
  return score;
}

/**
 * Longest run (length >= 3) among the *distinct* ranks present, multiplied
 * by the product of each rank's duplicate count — this is what naturally
 * produces "double run"/"triple run" scoring without special-casing it.
 */
function runsScore(fiveCards: Card[]): number {
  const counts = rankCounts(fiveCards);
  const distinctRanks = Array.from(counts.keys()).sort((a, b) => a - b);
  let score = 0;
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
      score += runLength * product;
    }
    i = j + 1;
  }
  return score;
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

function buildBreakdown(fourCards: Card[], starter: Card, flush: number): HandScoreBreakdown {
  if (fourCards.length !== 4) {
    throw new Error('countHand/countCrib expect exactly 4 cards plus the starter');
  }
  const five = [...fourCards, starter];
  const fifteens = combinationsFifteens(five);
  const pairs = pairsScore(five);
  const runs = runsScore(five);
  const nobs = nobsScore(fourCards, starter);
  return {
    fifteens,
    pairs,
    runs,
    flush,
    nobs,
    total: fifteens + pairs + runs + flush + nobs,
  };
}

export function countHand(hand: Card[], starter: Card): HandScoreBreakdown {
  return buildBreakdown(hand, starter, handFlush(hand, starter));
}

export function countCrib(crib: Card[], starter: Card): HandScoreBreakdown {
  return buildBreakdown(crib, starter, cribFlush(crib, starter));
}
