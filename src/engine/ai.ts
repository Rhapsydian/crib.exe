import type { Card } from './cards';
import { cardValue, cardsEqual } from './cards';
import { createDeck } from './deck';
import { countHand, countCrib } from './scoring';
import { scoreCardPlay, type PlayContext, type PlayStrategy } from './pegging';
import type { DiscardStrategy } from './deal';

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

/**
 * Relative weight of hand-value vs. crib-value in scoreDiscard below --
 * TBD/playtesting, same placeholder convention as everywhere else.
 * `DISCARD_EXPERT_WEIGHTS` matches this module's original fixed
 * `CRIB_WEIGHT = 1` behavior exactly, preserved as scoreDiscard's
 * default so Root's checkpoint-D targeting (which always wants the
 * fully-informed evaluation, not a skill-diluted one) is unaffected by
 * checkpoint C's skill dial below.
 */
export interface DiscardWeights {
  handValue: number;
  cribValue: number;
}

// Session 26: handValue used to be fixed at 1 for both ends -- the
// skill dial only ever interpolated cribValue, meaning "novice" was
// still a near-perfect hand-value optimizer with zero crib-awareness,
// not a genuinely weak player. The race-to-121 cross-matrix (BACKLOG.md)
// showed this produced almost no separation between skill 0 and skill
// 1 (49.8%, a coin flip) despite skill 0 crushing the old dumb
// baseline ~95% of the time -- the dominant term was never actually
// diluted. Lowering it here is the cheap half of that fix (the other
// half is real mistake-injection via ctx.rng, see PEG_MAX_TEMPERATURE/
// DISCARD_MAX_TEMPERATURE below). TBD/playtesting, retuned in the
// checkpoint E recalibration sweep.
const DISCARD_NOVICE_WEIGHTS: DiscardWeights = { handValue: 0.4, cribValue: 0 };
const DISCARD_EXPERT_WEIGHTS: DiscardWeights = { handValue: 1, cribValue: 1 };

/** Skill as a single continuous 0-1 knob (decision 2), same shape as
 * interpolatePegWeights. */
export function interpolateDiscardWeights(skill: number): DiscardWeights {
  const t = Math.max(0, Math.min(1, skill));
  return {
    handValue: lerp(DISCARD_NOVICE_WEIGHTS.handValue, DISCARD_EXPERT_WEIGHTS.handValue, t),
    cribValue: lerp(DISCARD_NOVICE_WEIGHTS.cribValue, DISCARD_EXPERT_WEIGHTS.cribValue, t),
  };
}

/**
 * Combines hand-EV and signed crib-EV into one weighted score for a
 * candidate discard pair from `fullHand` -- positive crib weight when
 * it's the caster's own crib, negative when it's the opponent's
 * (decision 3a: helping your own crib is positive value, feeding the
 * opponent's is negative). This is the one function both the discard
 * AI below and Root's adversarial targeting (checkpoint D, scoring the
 * *opponent's* hand) call into. `weights` defaults to the fully-
 * informed expert vector, matching every existing call site's behavior
 * (bestCardToForce never passes it explicitly).
 */
export function scoreDiscard(
  fullHand: Card[],
  discardPair: [Card, Card],
  isOwnCrib: boolean,
  knownOtherCribCards?: [Card, Card],
  weights: DiscardWeights = DISCARD_EXPERT_WEIGHTS,
): number {
  const keptHand = fullHand.filter((card) => !discardPair.some((discarded) => cardsEqual(discarded, card)));
  const unseen = unseenCards(fullHand);
  const handEV = handExpectedValue(keptHand, unseen);
  const cribEV = cribExpectedValue(discardPair, unseen, knownOtherCribCards);
  return weights.handValue * handEV + (isOwnCrib ? weights.cribValue : -weights.cribValue) * cribEV;
}

/**
 * Root's "force a specific card" manipulation (checkpoint D): an
 * adversarial minimax-lite over the opponent's own dealt hand. For each
 * candidate forced card, assumes the opponent still picks their own
 * best available companion discard (maximizing their scoreDiscard);
 * picks whichever forced card minimizes that best-achievable outcome --
 * the card whose loss hurts them most even under their own optimal
 * counter-play, not just their single highest-value card in isolation.
 * `isOwnCrib` is from the *target's* own perspective (whether this
 * hand's crib is theirs), since scoreDiscard needs it signed correctly
 * for the side actually being evaluated.
 */
export function bestCardToForce(hand: Card[], isOwnCrib: boolean): [Card, Card] {
  let bestForced = hand[0];
  let bestCompanion = hand[1];
  let bestOfTheirBestScore = Infinity;

  for (const forced of hand) {
    const rest = hand.filter((c) => !cardsEqual(c, forced));
    let theirBestScore = -Infinity;
    let theirBestCompanion = rest[0];
    for (const companion of rest) {
      const score = scoreDiscard(hand, [forced, companion], isOwnCrib);
      if (score > theirBestScore) {
        theirBestScore = score;
        theirBestCompanion = companion;
      }
    }
    if (theirBestScore < bestOfTheirBestScore) {
      bestOfTheirBestScore = theirBestScore;
      bestForced = forced;
      bestCompanion = theirBestCompanion;
    }
  }

  return [bestForced, bestCompanion];
}

function allDiscardPairs(hand: Card[]): [Card, Card][] {
  const pairs: [Card, Card][] = [];
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      pairs.push([hand[i], hand[j]]);
    }
  }
  return pairs;
}

/** The single best-scoring discard pair from `hand` by the caster's own
 * (fully-informed) scoreDiscard -- used to predict what a rational
 * opponent would likely discard, given their revealed hand (checkpoint
 * C), so the crib-EV estimate for the caster's *own* discard can use a
 * real prediction instead of the blind partial proxy. Not adversarial
 * like bestCardToForce -- this assumes the opponent plays well *for
 * themselves*, not that they're trying to hurt anyone. */
export function predictBestDiscard(hand: Card[], isOwnCrib: boolean): [Card, Card] {
  let best: [Card, Card] = [hand[0], hand[1]];
  let bestScore = -Infinity;
  for (const pair of allDiscardPairs(hand)) {
    const score = scoreDiscard(hand, pair, isOwnCrib);
    if (score > bestScore) {
      bestScore = score;
      best = pair;
    }
  }
  return best;
}

/**
 * Tunable-skill discard AI (checkpoint C). Enumerates all 15 candidate
 * discard pairs and picks the highest-scoring one under the skill-
 * interpolated weights. When the opponent's hand is known
 * (`knownOpponentHand`, checkpoint C's recon), predicts their likely
 * discard via predictBestDiscard and feeds it into scoreDiscard as the
 * crib's known other half -- turning the crib-EV term from an estimate
 * into a real prediction, gated naturally by the skill dial itself
 * (at skill=0, cribValue weight is 0, so even a perfect prediction
 * contributes nothing -- no separate gating needed).
 */
export function discardSkillStrategy(skill: number): DiscardStrategy {
  const weights = interpolateDiscardWeights(skill);
  return (ctx) => {
    const predictedOpponentDiscard = ctx.knownOpponentHand
      ? predictBestDiscard(ctx.knownOpponentHand, !ctx.isOwnCrib)
      : undefined;
    const candidates = allDiscardPairs(ctx.hand);
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const pair of candidates) {
      const score = scoreDiscard(ctx.hand, pair, ctx.isOwnCrib, predictedOpponentDiscard, weights);
      if (score > bestScore) {
        bestScore = score;
        best = pair;
      }
    }
    return best;
  };
}

/**
 * Tunable-skill pegging AI (checkpoint B). Three factors per candidate
 * legal card, kept small per decision 2: immediate score (reuses
 * pegging.ts's own scoring rules via scoreCardPlay); defensive risk (a
 * flat penalty for leaving the running count at 5 or 21 -- the
 * classic Cribbage risk, since the four 10-value ranks make either
 * count exploitable regardless of what the opponent actually holds);
 * setup value (a small bonus for candidates that keep same-rank/
 * adjacent-rank potential alive among the caster's *other* currently-
 * legal cards). All weights TBD/playtesting, same placeholder
 * convention as everywhere else in this project.
 */
export interface PegWeights {
  immediateScore: number;
  defensiveRisk: number;
  setupValue: number;
}

// Session 26: immediateScore used to be fixed at 1 for both ends, same
// gap and same fix as DISCARD_NOVICE_WEIGHTS.handValue above -- see
// that constant's comment for the full reasoning (race-to-121
// cross-matrix finding). TBD/playtesting, retuned in the checkpoint E
// recalibration sweep.
const PEG_NOVICE_WEIGHTS: PegWeights = { immediateScore: 0.4, defensiveRisk: 0, setupValue: 0 };
const PEG_EXPERT_WEIGHTS: PegWeights = { immediateScore: 1, defensiveRisk: 1, setupValue: 0.5 };

const RISKY_COUNTS = new Set([5, 21]);
const DEFENSIVE_RISK_PENALTY = 3; // TBD/playtesting

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Skill as a single continuous 0-1 knob (decision 2): linearly
 * interpolates between the novice and expert weight vectors above,
 * clamped to [0, 1]. */
export function interpolatePegWeights(skill: number): PegWeights {
  const t = Math.max(0, Math.min(1, skill));
  return {
    immediateScore: lerp(PEG_NOVICE_WEIGHTS.immediateScore, PEG_EXPERT_WEIGHTS.immediateScore, t),
    defensiveRisk: lerp(PEG_NOVICE_WEIGHTS.defensiveRisk, PEG_EXPERT_WEIGHTS.defensiveRisk, t),
    setupValue: lerp(PEG_NOVICE_WEIGHTS.setupValue, PEG_EXPERT_WEIGHTS.setupValue, t),
  };
}

/** Weighted score for playing `card` from `ctx` -- exported so both the
 * factory below and tests can evaluate a single candidate directly. */
export function scorePegCandidate(card: Card, ctx: Pick<PlayContext, 'legalCards' | 'count' | 'sequence'>, weights: PegWeights): number {
  const newCount = ctx.count + cardValue(card);
  const immediateScore = scoreCardPlay([...ctx.sequence, card], newCount).total;
  const defensiveRisk = RISKY_COUNTS.has(newCount) ? DEFENSIVE_RISK_PENALTY : 0;
  const setupValue = ctx.legalCards.filter((c) => !cardsEqual(c, card) && Math.abs(c.rank - card.rank) <= 1).length;
  return weights.immediateScore * immediateScore - weights.defensiveRisk * defensiveRisk + weights.setupValue * setupValue;
}

/** Factory: builds a PlayStrategy that picks the highest-scoring legal
 * card at the given skill level (0-1), enumerating every legal
 * candidate each turn. */
export function pegSkillStrategy(skill: number): PlayStrategy {
  const weights = interpolatePegWeights(skill);
  return (ctx) => {
    let best = ctx.legalCards[0];
    let bestScore = -Infinity;
    for (const card of ctx.legalCards) {
      const score = scorePegCandidate(card, ctx, weights);
      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    }
    return best;
  };
}
