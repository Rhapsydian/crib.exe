/**
 * The Cribbage rating in stars (session 72, the user: no synthetic
 * percentage). A rating is the points given up per hand against the AI at
 * full strength (the coach), and each star has a ceiling on it. The
 * review coach (ui/skill-review.ts), the Daily Run score (daily.ts) and
 * the Flawless Heat waiver all read these, so the levels live here once.
 */
import type { Card } from './cards';
import { judgePegs, predictBestDiscard, scoreDiscard, type PegTable } from './ai';
import { cardsEqual } from './cards';

export type Stars = 1 | 2 | 3 | 4 | 5;

/** Best first: the most points given up per hand that still earns the
 * stars. The edges are where the old 0-100 labels sat (96 / 88 / 75 / 60). */
export const SKILL_STARS: readonly { stars: Stars; label: string; maxLostPerHand: number }[] = [
  { stars: 5, label: 'Flawless', maxLostPerHand: 0.4 },
  { stars: 4, label: 'Expert', maxLostPerHand: 1.2 },
  { stars: 3, label: 'Sharp', maxLostPerHand: 2.5 },
  { stars: 2, label: 'Steady', maxLostPerHand: 4.0 },
  { stars: 1, label: 'Learning', maxLostPerHand: Infinity },
];

/** The stars for `lostPerHand` points given up per hand, rated on the
 * figure the player is shown: rounded to one decimal, as the review and
 * Records print it (the user's call, after a tester's 0.425 read "0.4"
 * beside "Flawless is 0.4 or less" yet earned 4 stars). */
export function starsFor(lostPerHand: number): Stars {
  const shown = Number(lostPerHand.toFixed(1));
  return SKILL_STARS.find((s) => shown <= s.maxLostPerHand + 1e-9)!.stars;
}

export const starLabel = (stars: Stars): string => SKILL_STARS.find((s) => s.stars === stars)!.label;

/** "★★★★☆". */
export const starText = (stars: Stars): string => '★'.repeat(stars) + '☆'.repeat(5 - stars);

/** The next star up and the most it allows per hand; null at Flawless. */
export function nextStar(stars: Stars): { label: string; maxLostPerHand: number } | null {
  const next = SKILL_STARS.find((s) => s.stars === stars + 1);
  return next ? { label: next.label, maxLostPerHand: next.maxLostPerHand } : null;
}

/** What a discard gave up: the AI's best keep less yours, in expected
 * points over every cut and the crib. (The review coach's yardstick,
 * session 70; here since session 72 so a fight can rate itself.) */
export function discardLoss(hand: Card[], thrown: [Card, Card], ownCrib: boolean, starter?: Card): number {
  const best = predictBestDiscard(hand, ownCrib, starter);
  return Math.max(0, scoreDiscard(hand, best, ownCrib, undefined, undefined, starter) - scoreDiscard(hand, thrown, ownCrib, undefined, undefined, starter));
}

/** What a pegging play gave up: the best play's net less yours (points
 * now, less the opponent's expected reply). Null when the choice didn't
 * matter: one card to play, or every card as good as another. */
export function pegLoss(table: PegTable, played: Card): number | null {
  const { judged, best } = judgePegs(table);
  const nets = judged.map((j) => j.net);
  if (Math.max(...nets) - Math.min(...nets) <= 0.05) return null;
  const net = (c: Card) => nets[table.legal.findIndex((l) => cardsEqual(l, c))];
  return Math.max(0, net(best) - net(played));
}

/** A fight's choices, tallied as they're made (combat.ts): the points
 * given up, the hands with a choice in them, and the choices that counted. */
export interface SkillTally {
  lost: number;
  hands: number;
  counted: number;
}

/** A tally's stars; null with nothing that counted. */
export function tallyStars(tally: SkillTally): Stars | null {
  return tally.counted ? starsFor(tally.lost / tally.hands) : null;
}
