import { describe, it, expect } from 'vitest';
import type { Card } from './cards';
import { unseenCards, handExpectedValue, cribExpectedValue, scoreDiscard, bestCardToForce } from './ai';

function card(rank: Card['rank'], suit: Card['suit'] = 0): Card {
  return { rank, suit };
}

describe('unseenCards', () => {
  it('returns all 52 minus the known cards, excluding exact rank+suit matches', () => {
    const known = [card(5, 0), card(5, 1)];
    const unseen = unseenCards(known);
    expect(unseen).toHaveLength(50);
    expect(unseen.some((c) => c.rank === 5 && c.suit === 0)).toBe(false);
    expect(unseen.some((c) => c.rank === 5 && c.suit === 1)).toBe(false);
    expect(unseen.some((c) => c.rank === 5 && c.suit === 2)).toBe(true);
  });
});

describe('handExpectedValue', () => {
  it('returns 0 for an empty unseen pool', () => {
    expect(handExpectedValue([card(5, 0), card(5, 1), card(5, 2), card(6, 0)], [])).toBe(0);
  });

  it('scores a hand with strong guaranteed combos higher than a weak scattered one', () => {
    const unseen = unseenCards([]);
    const strongHand = [card(5, 0), card(5, 1), card(5, 2), card(5, 3)]; // guaranteed pairs-royal
    const weakHand = [card(2, 0), card(4, 1), card(7, 2), card(9, 3)]; // no guaranteed combos
    expect(handExpectedValue(strongHand, unseen)).toBeGreaterThan(handExpectedValue(weakHand, unseen));
  });
});

describe('cribExpectedValue', () => {
  it('falls back to the partial proxy when the other crib cards are unknown', () => {
    const pairDiscard: [Card, Card] = [card(7, 0), card(7, 1)];
    const noCombo: [Card, Card] = [card(2, 0), card(9, 1)];
    expect(cribExpectedValue(pairDiscard, unseenCards(pairDiscard))).toBeGreaterThan(
      cribExpectedValue(noCombo, unseenCards(noCombo)),
    );
  });

  it('computes exact crib EV once the other two cards are known', () => {
    const discardPair: [Card, Card] = [card(5, 0), card(5, 1)];
    const otherPair: [Card, Card] = [card(5, 2), card(5, 3)];
    // A guaranteed pairs-royal-in-the-crib (12 pts) before the starter is
    // even drawn -- exact EV should reflect that real, known strength,
    // not the blind partial-proxy estimate for just the discarded half.
    const exact = cribExpectedValue(discardPair, unseenCards([...discardPair, ...otherPair]), otherPair);
    const blind = cribExpectedValue(discardPair, unseenCards(discardPair));
    expect(exact).toBeGreaterThan(blind);
  });
});

describe('scoreDiscard', () => {
  it('signs the crib factor by whose crib it is -- same discard pair, opposite crib ownership', () => {
    // A pair discarded into a hand with no other guaranteed combos --
    // the crib-EV factor should be the dominant, sign-flippable term.
    const fullHand = [card(7, 0), card(7, 1), card(2, 2), card(4, 3), card(9, 0), card(11, 1)];
    const discardPair: [Card, Card] = [card(7, 0), card(7, 1)];
    const ownCrib = scoreDiscard(fullHand, discardPair, true);
    const enemyCrib = scoreDiscard(fullHand, discardPair, false);
    expect(ownCrib).toBeGreaterThan(enemyCrib);
  });
});

describe('bestCardToForce', () => {
  it("forces away the card most valuable for the opponent to keep -- one half of their only pair", () => {
    const hand: Card[] = [card(7, 0), card(7, 1), card(2, 2), card(9, 3), card(12, 0), card(1, 1)];
    const [forced] = bestCardToForce(hand, true);
    expect(forced.rank).toBe(7);
  });

  it('is deterministic for the same hand', () => {
    const hand: Card[] = [card(7, 0), card(7, 1), card(2, 2), card(9, 3), card(12, 0), card(1, 1)];
    expect(bestCardToForce(hand, true)).toEqual(bestCardToForce(hand, true));
  });

  it('the forced card and its companion are both real, distinct cards from the hand', () => {
    const hand: Card[] = [card(3, 0), card(6, 1), card(9, 2), card(12, 3), card(1, 0), card(5, 1)];
    const [forced, companion] = bestCardToForce(hand, false);
    expect(hand.some((c) => c.rank === forced.rank && c.suit === forced.suit)).toBe(true);
    expect(hand.some((c) => c.rank === companion.rank && c.suit === companion.suit)).toBe(true);
    expect(forced).not.toEqual(companion);
  });
});
