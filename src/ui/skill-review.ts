import type { Card } from '../engine/cards';
import type { CombatAnswer, CombatRequest } from '../engine/combat';
import { discardLoss, discardReview, pegLoss, pegReview, type PegSpot } from './coach';
import { combatPegSpot } from './fight';
import { FLAWLESS_RATING } from '../engine/daily';

/**
 * The review coach (session 70, the user's playtest idea): a Cribbage
 * rating for each fight and the run, and the fight's costliest mistakes.
 *
 * Every discard and pegging play the player answers is kept as it was
 * asked; the rating is worked out only when it's shown. Each choice is
 * judged against the AI at full strength (the coach: one AI, session
 * 72): a discard by the expected points of the keep and crib against
 * its best, a play by its points less the opponent's expected reply.
 *
 * The rating (session 72, the user: the old curve was arcane and read
 * low) is plain arithmetic: 100 less 10 for every point given up per
 * hand. "You gave up 2.0 points a hand: 80." A run's pools every fight's
 * choices and hands.
 */
export type SkillDecision =
  | { kind: 'discard'; handIndex: number; hand: Card[]; thrown: [Card, Card]; ownCrib: boolean; starter?: Card }
  | {
      kind: 'play';
      handIndex: number;
      spot: PegSpot;
      played: Card;
      /** The table as the drawer shows it: the player's cards (legal or
       * not) and the cut. */
      hand: Card[];
      starter?: Card;
    };

/** The player's answer to a fight request, as a decision to rate; null
 * for anything else (a Burner, a short hand a Mod pulled a card from). */
export function decisionFor(request: CombatRequest, answer: CombatAnswer): SkillDecision | null {
  const handIndex = request.view.handIndex;
  if (request.kind === 'discard' && Array.isArray(answer) && request.context.hand.length === 6) {
    return { kind: 'discard', handIndex, hand: request.context.hand, thrown: answer as [Card, Card], ownCrib: request.context.isOwnCrib, ...(request.context.starter ? { starter: request.context.starter } : {}) };
  }
  if (request.kind === 'play' && answer && !Array.isArray(answer) && typeof answer === 'object') {
    const spot = combatPegSpot(request);
    const cut = request.view.timeline.findLast((b) => b.kind === 'cut');
    if (spot) return { kind: 'play', handIndex, spot, played: answer as Card, hand: request.pegging.hand, starter: cut?.kind === 'cut' ? cut.starter : undefined };
  }
  return null;
}

/** Rating points lost for each point given up per hand. Measured
 * (session 72, 25 fights a skill, the unified AI): skill 0.25 gives up
 * 4.1 a hand and rates 59 (Learning), 0.5 70 (Steady), 0.65 80 (Sharp),
 * the simulated player (0.85) 94 (Expert), full strength 0 and 100. */
export const RATING_PER_POINT = 10;
/** A mistake worth showing gave up at least a whole point (the user,
 * session 72). */
const MISTAKE_MIN = 1;
const MISTAKES_SHOWN = 3;

/** The ladder (the user's, session 70), lowest first: the rating it
 * starts at. */
export const SKILL_LABELS: readonly { min: number; label: string }[] = [
  { min: 0, label: 'Learning' },
  { min: 60, label: 'Steady' },
  { min: 75, label: 'Sharp' },
  { min: 88, label: 'Expert' },
  // Also Flawless Form's bar (engine/daily.ts), one number.
  { min: FLAWLESS_RATING, label: 'Flawless' },
];
export const skillLabel = (rating: number) => SKILL_LABELS.findLast((l) => rating >= l.min)!.label;

export interface SkillMistake {
  kind: 'discard' | 'play';
  /** 1-based, as the player counts hands. */
  hand: number;
  /** Points given up. */
  lost: number;
  text: string;
  /** The choice itself, for the drawer to lay out the cards. */
  decision: SkillDecision;
}

export interface SkillRating {
  /** 0-100, whole: 100 - RATING_PER_POINT x lostPerHand. */
  rating: number;
  label: string;
  /** Choices counted. */
  decisions: number;
  /** Hands played, and the points given up per hand. */
  hands: number;
  lostPerHand: number;
  /** The costliest, most first. */
  mistakes: SkillMistake[];
}

/** The rating over `decisions` (a fight's, or a whole run's); null with
 * nothing to rate. Mistakes are named only when asked (they cost the
 * most to write). */
export function rateSkill(decisions: readonly SkillDecision[], withMistakes = true): SkillRating | null {
  let total = 0;
  let counted = 0;
  // Hands: a new one starts when the hand number changes or a discard
  // follows a play (a run's next fight starts again at hand 1).
  let hands = 0;
  let previous: SkillDecision | null = null;
  const costly: { d: SkillDecision; lost: number }[] = [];
  for (const d of decisions) {
    if (!previous || d.handIndex !== previous.handIndex || (d.kind === 'discard' && previous.kind === 'play')) hands++;
    previous = d;
    const lost = d.kind === 'discard' ? discardLoss(d.hand, d.thrown, d.ownCrib, d.starter) : pegLoss(d.spot, d.played);
    if (lost === null) continue;
    total += lost;
    counted++;
    if (lost >= MISTAKE_MIN) costly.push({ d, lost });
  }
  if (!counted) return null;
  const lostPerHand = total / hands;
  const rating = Math.max(0, Math.min(100, Math.round(100 - RATING_PER_POINT * lostPerHand)));
  // The costliest, with one slot kept for the worst pegging play if there
  // is one (the user, session 70): discards usually cost more, and the
  // drawer should teach both halves.
  costly.sort((a, b) => b.lost - a.lost);
  const shown = costly.slice(0, MISTAKES_SHOWN);
  const worstPlay = costly.find((c) => c.d.kind === 'play');
  if (worstPlay && !shown.includes(worstPlay) && shown.length === MISTAKES_SHOWN) shown[MISTAKES_SHOWN - 1] = worstPlay;
  const mistakes = withMistakes
    ? shown
        .map(({ d, lost }) => ({
          kind: d.kind,
          hand: d.handIndex + 1,
          decision: d,
          lost,
          text: d.kind === 'discard' ? discardReview(d.hand, d.thrown, d.ownCrib, d.starter).text : pegReview(d.spot, d.played).text,
        }))
    : [];
  return { rating, label: skillLabel(rating), decisions: counted, hands, lostPerHand, mistakes };
}
