import { describe, it, expect } from 'vitest';
import type { Card } from './cards';
import {
  unseenCards,
  handExpectedValue,
  cribExpectedValue,
  scoreDiscard,
  bestCardToForce,
  interpolatePegWeights,
  scorePegCandidate,
  pegSkillStrategy,
  interpolateDiscardWeights,
  predictBestDiscard,
  discardSkillStrategy,
} from './ai';

function allPairsOf(hand: Card[]): [Card, Card][] {
  const pairs: [Card, Card][] = [];
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      pairs.push([hand[i], hand[j]]);
    }
  }
  return pairs;
}

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

describe('interpolatePegWeights', () => {
  it('returns the novice vector at skill=0 and the expert vector at skill=1', () => {
    expect(interpolatePegWeights(0)).toEqual({ immediateScore: 1, defensiveRisk: 0, setupValue: 0 });
    expect(interpolatePegWeights(1)).toEqual({ immediateScore: 1, defensiveRisk: 1, setupValue: 0.5 });
  });

  it('clamps out-of-range skill to [0, 1]', () => {
    expect(interpolatePegWeights(-5)).toEqual(interpolatePegWeights(0));
    expect(interpolatePegWeights(5)).toEqual(interpolatePegWeights(1));
  });
});

describe('scorePegCandidate / pegSkillStrategy', () => {
  // A card that both scores immediately (completes a pair with the
  // sequence's last card) and leaves the count at a risky value (21 --
  // any of the four 10-value ranks lets the opponent hit 31 next), vs.
  // a card that scores nothing but leaves a safe count. Only these two
  // are legal, so setupValue is 0 for both -- isolates the immediate-
  // score-vs-risk tradeoff cleanly.
  const sequence: Card[] = [card(1, 0), card(10, 0)]; // count so far: 11
  const riskyPair = card(10, 1); // pairs the last-played 10; 11+10=21
  const safe = card(2, 2); // no pair, no run, no fifteen; 11+2=13

  it('at skill=0 (novice), picks the immediately-scoring but risky play', () => {
    const strategy = pegSkillStrategy(0);
    const chosen = strategy({ legalCards: [riskyPair, safe], count: 11, sequence });
    expect(chosen).toEqual(riskyPair);
  });

  it('at skill=1 (expert), picks the safe play over the risky score', () => {
    const strategy = pegSkillStrategy(1);
    const chosen = strategy({ legalCards: [riskyPair, safe], count: 11, sequence });
    expect(chosen).toEqual(safe);
  });

  it('scorePegCandidate: the risky pair scores higher than the safe card under novice weights', () => {
    const novice = interpolatePegWeights(0);
    const ctx = { legalCards: [riskyPair, safe], count: 11, sequence };
    expect(scorePegCandidate(riskyPair, ctx, novice)).toBeGreaterThan(scorePegCandidate(safe, ctx, novice));
  });

  it('scorePegCandidate: the safe card scores higher than the risky pair under expert weights', () => {
    const expert = interpolatePegWeights(1);
    const ctx = { legalCards: [riskyPair, safe], count: 11, sequence };
    expect(scorePegCandidate(safe, ctx, expert)).toBeGreaterThan(scorePegCandidate(riskyPair, ctx, expert));
  });

  it('setupValue rewards a candidate with an adjacent-rank companion among the other legal cards', () => {
    const weights = { immediateScore: 0, defensiveRisk: 0, setupValue: 1 };
    const withNeighbor = card(5, 0);
    const noNeighbor = card(9, 0);
    const ctx = { legalCards: [withNeighbor, card(6, 1), noNeighbor], count: 0, sequence: [] };
    expect(scorePegCandidate(withNeighbor, ctx, weights)).toBeGreaterThan(scorePegCandidate(noNeighbor, ctx, weights));
  });

  it('pegSkillStrategy always returns one of the actual legal cards', () => {
    const strategy = pegSkillStrategy(0.5);
    const legalCards = [card(3, 0), card(8, 1), card(11, 2)];
    const chosen = strategy({ legalCards, count: 4, sequence: [card(1, 0)] });
    expect(legalCards).toContainEqual(chosen);
  });
});

describe('interpolateDiscardWeights', () => {
  it('returns the novice vector at skill=0 and the expert vector (matching the old fixed CRIB_WEIGHT=1 behavior) at skill=1', () => {
    expect(interpolateDiscardWeights(0)).toEqual({ handValue: 1, cribValue: 0 });
    expect(interpolateDiscardWeights(1)).toEqual({ handValue: 1, cribValue: 1 });
  });

  it('clamps out-of-range skill to [0, 1]', () => {
    expect(interpolateDiscardWeights(-5)).toEqual(interpolateDiscardWeights(0));
    expect(interpolateDiscardWeights(5)).toEqual(interpolateDiscardWeights(1));
  });
});

describe('predictBestDiscard', () => {
  it("predicts keeping a guaranteed pair rather than discarding it -- doesn't recommend breaking obvious hand strength", () => {
    const hand: Card[] = [card(7, 0), card(7, 1), card(2, 2), card(9, 3), card(12, 0), card(1, 1)];
    const [a, b] = predictBestDiscard(hand, true);
    expect(a.rank).not.toBe(7);
    expect(b.rank).not.toBe(7);
  });

  it('is deterministic for the same hand', () => {
    const hand: Card[] = [card(4, 0), card(6, 1), card(9, 2), card(12, 3), card(1, 0), card(5, 1)];
    expect(predictBestDiscard(hand, false)).toEqual(predictBestDiscard(hand, false));
  });
});

describe('discardSkillStrategy', () => {
  const hand: Card[] = [card(5, 0), card(5, 1), card(2, 2), card(9, 3), card(12, 0), card(1, 1)];

  it('always picks the argmax-scoring pair under scoreDiscard for the matching skill/isOwnCrib', () => {
    for (const skill of [0, 0.5, 1]) {
      for (const isOwnCrib of [true, false]) {
        const weights = interpolateDiscardWeights(skill);
        const chosen = discardSkillStrategy(skill)({ hand, isOwnCrib });
        const chosenScore = scoreDiscard(hand, chosen, isOwnCrib, undefined, weights);
        for (const pair of allPairsOf(hand)) {
          expect(scoreDiscard(hand, pair, isOwnCrib, undefined, weights)).toBeLessThanOrEqual(chosenScore + 1e-9);
        }
      }
    }
  });

  it('at skill=0, isOwnCrib has no effect on the chosen pair (crib weight is 0)', () => {
    const ownCrib = discardSkillStrategy(0)({ hand, isOwnCrib: true });
    const enemyCrib = discardSkillStrategy(0)({ hand, isOwnCrib: false });
    expect(ownCrib).toEqual(enemyCrib);
  });

  it("uses a real prediction of the opponent's discard (not the blind proxy) when knownOpponentHand is present", () => {
    const opponentHand: Card[] = [card(6, 0), card(6, 1), card(3, 2), card(10, 3), card(8, 0), card(4, 1)];
    const chosen = discardSkillStrategy(1)({ hand, isOwnCrib: true, knownOpponentHand: opponentHand });
    const predicted = predictBestDiscard(opponentHand, false); // it's OUR crib (isOwnCrib: true), so it's not theirs
    const expertWeights = interpolateDiscardWeights(1);
    const chosenScoreWithKnownCrib = scoreDiscard(hand, chosen, true, predicted, expertWeights);
    // If knownOpponentHand were being ignored (still using the blind
    // proxy), the strategy's own choice wouldn't necessarily be optimal
    // once scored against the *real* predicted crib -- this would catch
    // that regression.
    for (const pair of allPairsOf(hand)) {
      expect(scoreDiscard(hand, pair, true, predicted, expertWeights)).toBeLessThanOrEqual(chosenScoreWithKnownCrib + 1e-9);
    }
  });

  it('returns a pair of real, distinct cards from the hand', () => {
    const [a, b] = discardSkillStrategy(0.5)({ hand, isOwnCrib: true });
    expect(hand.some((c) => c.rank === a.rank && c.suit === a.suit)).toBe(true);
    expect(hand.some((c) => c.rank === b.rank && c.suit === b.suit)).toBe(true);
    expect(a).not.toEqual(b);
  });
});
