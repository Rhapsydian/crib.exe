import type { Card } from '../engine/cards';
import type { CombatAnswer, CombatRequest } from '../engine/combat';
import { discardLoss, pegLoss, type PegSpot } from './coach';
import { combatPegSpot } from './fight';
import { starLabel, starsFor, type Stars } from '../engine/skill';

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
 * low; then stars, not a synthetic percentage) is the points given up per
 * hand, as 1 to 5 stars (engine/skill.ts). "You gave up 0.9 points a hand:
 * ★★★★☆ Expert." A run's pools every fight's choices and hands.
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

/** The costliest choices shown, whatever they cost (the user, session 72:
 * no floor, and no slot kept for pegging). */
const MISTAKES_SHOWN = 3;


export interface SkillMistake {
  kind: 'discard' | 'play';
  /** 1-based, as the player counts hands. */
  hand: number;
  /** Points given up. */
  lost: number;
  /** The choice itself, for the drawer to lay out beside the coach's. */
  decision: SkillDecision;
}

export interface SkillRating {
  /** 1-5 (engine/skill.ts), from lostPerHand. */
  stars: Stars;
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
 * nothing to rate. Mistakes are listed only when asked. */
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
    if (lost > 0) costly.push({ d, lost });
  }
  if (!counted) return null;
  const lostPerHand = total / hands;
  const stars = starsFor(lostPerHand);
  // The three costliest, most first.
  costly.sort((a, b) => b.lost - a.lost);
  const mistakes = withMistakes ? costly.slice(0, MISTAKES_SHOWN).map(({ d, lost }) => ({ kind: d.kind, hand: d.handIndex + 1, decision: d, lost })) : [];
  return { stars, label: starLabel(stars), decisions: counted, hands, lostPerHand, mistakes };
}
