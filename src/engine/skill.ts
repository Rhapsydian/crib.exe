/**
 * The Cribbage rating in stars (session 72, the user: no synthetic
 * percentage). A rating is the points given up per hand against the AI at
 * full strength (the coach), and each star has a ceiling on it. The
 * review coach (ui/skill-review.ts), the Daily Run score (daily.ts) and
 * the Flawless Heat waiver all read these, so the levels live here once.
 */
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

/** The stars for `lostPerHand` points given up per hand. */
export function starsFor(lostPerHand: number): Stars {
  return SKILL_STARS.find((s) => lostPerHand <= s.maxLostPerHand + 1e-9)!.stars;
}

export const starLabel = (stars: Stars): string => SKILL_STARS.find((s) => s.stars === stars)!.label;

/** "★★★★☆". */
export const starText = (stars: Stars): string => '★'.repeat(stars) + '☆'.repeat(5 - stars);

/** The next star up and the most it allows per hand; null at Flawless. */
export function nextStar(stars: Stars): { label: string; maxLostPerHand: number } | null {
  const next = SKILL_STARS.find((s) => s.stars === stars + 1);
  return next ? { label: next.label, maxLostPerHand: next.maxLostPerHand } : null;
}
