import type { Card } from '../engine/cards';
import type { CombatAnswer, CombatRequest } from '../engine/combat';
import { discardLoss, discardReview, pegLoss, pegReview, type PegSpot } from './coach';
import { combatPegSpot } from './fight';

/**
 * The review coach (session 70, the user's playtest idea): a Cribbage
 * rating for each fight and the run, and the fight's costliest mistakes.
 *
 * Every discard and pegging play the player answers is kept as it was
 * asked; the rating is worked out only when it's shown. Each choice is
 * judged as the coach judges it (coach.ts): a discard by the expected
 * points of the keep and crib against the coach's best, a play by its
 * points less the opponent's expected reply. A choice's score falls off
 * with the points it gave up; the rating is their average, a discard
 * counting double (more rides on it). Choices that didn't matter (one
 * card to play, every card alike) aren't counted.
 */
export type SkillDecision =
  | { kind: 'discard'; handIndex: number; hand: Card[]; thrown: [Card, Card]; ownCrib: boolean }
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
    return { kind: 'discard', handIndex, hand: request.context.hand, thrown: answer as [Card, Card], ownCrib: request.context.isOwnCrib };
  }
  if (request.kind === 'play' && answer && !Array.isArray(answer) && typeof answer === 'object') {
    const spot = combatPegSpot(request);
    const cut = request.view.timeline.findLast((b) => b.kind === 'cut');
    if (spot) return { kind: 'play', handIndex, spot, played: answer as Card, hand: request.pegging.hand, starter: cut?.kind === 'cut' ? cut.starter : undefined };
  }
  return null;
}

/** Points given up at which a choice scores about 37% (1/e). Set by
 * measuring the AI at known skills (session 70, 25 fights each): skill
 * 0.15-0.35 reads 50-52 (Learning), 0.6-0.7 reads 67-73 (Steady), the
 * simulated player (0.85) 87 (Sharp), the AI at full strength 95
 * (Expert; Flawless beats it). */
export const SKILL_FALLOFF = 1.0;
const DISCARD_WEIGHT = 2;
/** A mistake worth showing gave up at least this many points. */
const MISTAKE_MIN = 0.5;
const MISTAKES_SHOWN = 3;

/** The ladder (the user's, session 70), lowest first: the rating it
 * starts at. */
export const SKILL_LABELS: readonly { min: number; label: string }[] = [
  { min: 0, label: 'Learning' },
  { min: 60, label: 'Steady' },
  { min: 75, label: 'Sharp' },
  { min: 88, label: 'Expert' },
  { min: 96, label: 'Flawless' },
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
  /** 0-100, whole. */
  rating: number;
  label: string;
  /** Choices counted. */
  decisions: number;
  /** The costliest, most first. */
  mistakes: SkillMistake[];
}

/** The rating over `decisions` (a fight's, or a whole run's); null with
 * nothing to rate. Mistakes are named only when asked (they cost the
 * most to write). */
export function rateSkill(decisions: readonly SkillDecision[], withMistakes = true): SkillRating | null {
  let sum = 0;
  let weight = 0;
  let counted = 0;
  const costly: { d: SkillDecision; lost: number }[] = [];
  for (const d of decisions) {
    const lost = d.kind === 'discard' ? discardLoss(d.hand, d.thrown, d.ownCrib) : pegLoss(d.spot, d.played);
    if (lost === null) continue;
    const w = d.kind === 'discard' ? DISCARD_WEIGHT : 1;
    sum += w * Math.exp(-lost / SKILL_FALLOFF);
    weight += w;
    counted++;
    if (lost >= MISTAKE_MIN) costly.push({ d, lost });
  }
  if (!weight) return null;
  const rating = Math.round((100 * sum) / weight);
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
          text: d.kind === 'discard' ? discardReview(d.hand, d.thrown, d.ownCrib).text : pegReview(d.spot, d.played).text,
        }))
    : [];
  return { rating, label: skillLabel(rating), decisions: counted, mistakes };
}
