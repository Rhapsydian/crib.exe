import type { Card } from './cards';
import { cardsEqual, isJack } from './cards';
import type { Rng } from './rng';

export interface DealResult {
  hands: [Card[], Card[]];
  stock: Card[];
}

/** Deals 6 cards to each of 2 players from an already-shuffled deck. */
export function deal(shuffledDeck: Card[]): DealResult {
  const hands: [Card[], Card[]] = [shuffledDeck.slice(0, 6), shuffledDeck.slice(6, 12)];
  const stock = shuffledDeck.slice(12);
  return { hands, stock };
}

/**
 * Root mechanical redesign (session 24): context object rather than a
 * growing positional parameter list -- a new intel source becomes a
 * new optional field here, not a new positional param threaded through
 * every strategy signature and call site again. `isOwnCrib` is real
 * strategic information (whether this hand's crib is the discarder's
 * own or the opponent's) that was previously unavailable to any
 * strategy at all. `knownOpponentHand`, when set, is the opponent's
 * full dealt hand revealed by a deal-time recon payload (resolve.ts) --
 * absent whenever no such recon fired this hand.
 */
export interface DiscardContext {
  hand: Card[];
  isOwnCrib: boolean;
  knownOpponentHand?: Card[];
  /** Session 26: a dedicated AI-decision-noise Rng stream (see
   * rng.ts's deriveAiNoiseSeed), absent by default. Only a
   * skill-dial strategy that opts into mistake-injection reads this --
   * every other strategy (discardLowestTwo, discardHighestTwo, Root's
   * targeting) ignores it entirely, and a strategy that does use it
   * falls back to today's exact deterministic behavior whenever it's
   * absent, so plumbing it through is non-breaking by construction. */
  rng?: Rng;
}

export type DiscardStrategy = (ctx: DiscardContext) => [Card, Card];

/**
 * Legal-not-good: discards the two lowest-ranked cards. Good enough for
 * Phase 1 engine testing — real strategic discarding is a later concern.
 */
export const discardLowestTwo: DiscardStrategy = ({ hand }) => {
  const sorted = hand.slice().sort((a, b) => a.rank - b.rank);
  return [sorted[0], sorted[1]];
};

/** Discards the two highest-ranked cards -- deliberately the worst
 * legal-but-bad choice. Implements Root's forceDiscard Cribbage-layer
 * manipulation: a forced-bad-discard effect on the target, not a
 * literal "pick this exact card" mechanic (the specific-card version of
 * this manipulation is a separate payload -- see resolve.ts, session 24
 * checkpoint D -- built once recon can supply the opponent's hand to
 * target against). */
export const discardHighestTwo: DiscardStrategy = ({ hand }) => {
  const sorted = hand.slice().sort((a, b) => b.rank - a.rank);
  return [sorted[0], sorted[1]];
};

export interface DiscardResult {
  keptHand: Card[];
  discarded: [Card, Card];
}

export function discardToCrib(ctx: DiscardContext, strategy: DiscardStrategy): DiscardResult {
  const discarded = strategy(ctx);
  const discardedKeys = new Set(discarded.map((c) => `${c.rank}-${c.suit}`));
  const keptHand = ctx.hand.filter((c) => !discardedKeys.has(`${c.rank}-${c.suit}`));
  if (keptHand.length !== ctx.hand.length - 2) {
    throw new Error('discard strategy must return 2 cards actually present in the hand');
  }
  return { keptHand, discarded };
}

export interface CutResult {
  starter: Card;
  stock: Card[];
}

export type CutStrategy = (stock: Card[], rng: Rng) => CutResult;

/** Cuts the starter card from the remaining stock. */
export const cut: CutStrategy = (stock, rng) => {
  if (stock.length === 0) {
    throw new Error('cannot cut from an empty stock');
  }
  const index = rng.nextInt(stock.length);
  const starter = stock[index];
  const rest = stock.slice();
  rest.splice(index, 1);
  return { starter, stock: rest };
};

/** A cut biased toward (or away from) drawing a Jack -- implements
 * Root's skewCut Cribbage-layer manipulation. His Heels only ever
 * credits the dealer, so combat.ts resolves which direction actually
 * favors the caster before constructing this. Falls back to a uniform
 * cut over the whole stock if the requested bias can't be satisfied
 * (no Jack to bias toward, or the stock is nothing but Jacks to bias
 * away from -- vanishingly rare, handled for correctness). */
export function biasedCut(bias: 'towardJack' | 'awayFromJack'): CutStrategy {
  return (stock, rng) => {
    if (stock.length === 0) {
      throw new Error('cannot cut from an empty stock');
    }
    const jacks = stock.filter(isJack);
    const nonJacks = stock.filter((c) => !isJack(c));
    const pool = bias === 'towardJack' ? (jacks.length > 0 ? jacks : stock) : nonJacks.length > 0 ? nonJacks : stock;
    const starter = pool[rng.nextInt(pool.length)];
    const rest = stock.slice();
    rest.splice(
      rest.findIndex((c) => cardsEqual(c, starter)),
      1,
    );
    return { starter, stock: rest };
  };
}

/** "His heels" — the dealer scores 2 if the starter card is a Jack. */
export function hisHeels(starter: Card): number {
  return isJack(starter) ? 2 : 0;
}
