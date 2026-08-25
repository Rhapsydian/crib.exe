import type { Card } from './cards';
import { cardValue, cardsEqual } from './cards';
import { createDeck } from './deck';
import { countHand, countCrib } from './scoring';

/**
 * Shared weighted-scoring heuristic module (Root mechanical redesign,
 * session 24 checkpoint A). Exposes the raw scoring primitives used
 * both by discard decision-making and by Root's manipulation payloads
 * (checkpoint D) evaluating the *opponent's* hand adversarially --
 * same math, just pointed at either side. No skill-dial here (that's a
 * separate follow-on session) -- this is the underlying evaluation
 * function both that AI and Root's targeting logic build on.
 */

/** Every card not already accounted for by `knownCards` -- the pool a
 * starter (or the crib's other half) could still be drawn from. */
export function unseenCards(knownCards: Card[]): Card[] {
  return createDeck().filter((card) => !knownCards.some((known) => cardsEqual(known, card)));
}

/** Exact expected hand value for a candidate kept hand, averaged over
 * every currently-unseen starter -- cheap and exhaustive (at most 46
 * evaluations), no sampling needed. */
export function handExpectedValue(keptHand: Card[], unseen: Card[]): number {
  if (unseen.length === 0) return 0;
  const total = unseen.reduce((sum, starter) => sum + countHand(keptHand, starter).total, 0);
  return total / unseen.length;
}

/**
 * Expected crib value contributed by a candidate 2-card discard pair.
 * When the other 2 crib cards are already known (recon fired --
 * checkpoint C), scores the real 4-card crib exactly. Otherwise the
 * other half is genuinely unknown at decision time, so this falls back
 * to a deliberately simple proxy over just the known pair (guaranteed
 * pair, guaranteed fifteen, presence of a 5 -- classically strong crib
 * cards) -- TBD/playtesting weights, same placeholder convention as
 * every other numeric constant in this project.
 */
export function cribExpectedValue(discardPair: [Card, Card], unseen: Card[], knownOtherCribCards?: [Card, Card]): number {
  if (knownOtherCribCards) {
    const crib = [...discardPair, ...knownOtherCribCards];
    if (unseen.length === 0) return 0;
    const total = unseen.reduce((sum, starter) => sum + countCrib(crib, starter).total, 0);
    return total / unseen.length;
  }
  return partialCribValue(discardPair);
}

function partialCribValue(pair: [Card, Card]): number {
  let value = 0;
  if (pair[0].rank === pair[1].rank) value += 2;
  const sum = cardValue(pair[0]) + cardValue(pair[1]);
  if (sum === 15) value += 2;
  if (cardValue(pair[0]) === 5 || cardValue(pair[1]) === 5) value += 1;
  return value;
}

/** The crib-value factor's weight relative to hand value -- TBD/
 * playtesting, same placeholder convention as everywhere else. */
const CRIB_WEIGHT = 1;

/**
 * Combines hand-EV and signed crib-EV into one weighted score for a
 * candidate discard pair from `fullHand` -- positive crib weight when
 * it's the caster's own crib, negative when it's the opponent's
 * (decision 3a: helping your own crib is positive value, feeding the
 * opponent's is negative). This is the one function both a discard
 * decision and Root's adversarial targeting (checkpoint D, scoring the
 * *opponent's* hand) call into.
 */
export function scoreDiscard(
  fullHand: Card[],
  discardPair: [Card, Card],
  isOwnCrib: boolean,
  knownOtherCribCards?: [Card, Card],
): number {
  const keptHand = fullHand.filter((card) => !discardPair.some((discarded) => cardsEqual(discarded, card)));
  const unseen = unseenCards(fullHand);
  const handEV = handExpectedValue(keptHand, unseen);
  const cribEV = cribExpectedValue(discardPair, unseen, knownOtherCribCards);
  return handEV + (isOwnCrib ? CRIB_WEIGHT : -CRIB_WEIGHT) * cribEV;
}
