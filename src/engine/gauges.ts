/**
 * Per-side initiative gauge and the shared Breach/Containment meter
 * (session 17 checkpoint D). Combat orchestration (when to actually fire
 * subroutines on a triggered turn) is Checkpoint E/F's job — this file
 * only tracks the two numbers and detects the crossing/resolution
 * moments.
 */

export interface InitiativeGauge {
  progress: number;
  threshold: number;
}

export function createInitiativeGauge(threshold: number): InitiativeGauge {
  return { progress: 0, threshold };
}

export interface InitiativeGaugeUpdate {
  gauge: InitiativeGauge;
  /** How many times the threshold was crossed by this one addition — 0
   * for no turn, 1 for a normal crossing, 2+ when a single big scoring
   * event (e.g. a large hand count) spans the threshold more than once. */
  turnsTriggered: number;
}

/**
 * Feeds a side's own scored points into its gauge. Overshoot past a
 * crossing carries into the next cycle rather than being discarded, and
 * a single addition large enough to cross the threshold more than once
 * reports multiple triggered turns — a hand-count that dumps 24 points
 * against a threshold of 12 is 2 full turns, not 1 turn plus 12 wasted
 * points.
 */
export function addPoints(gauge: InitiativeGauge, points: number): InitiativeGaugeUpdate {
  if (points <= 0) return { gauge, turnsTriggered: 0 };
  let progress = gauge.progress + points;
  let turnsTriggered = 0;
  while (progress >= gauge.threshold) {
    progress -= gauge.threshold;
    turnsTriggered += 1;
  }
  return { gauge: { ...gauge, progress }, turnsTriggered };
}

/** Breach/Containment is a single shared scalar, not two HP pools. 100
 * is fully Breach (the attacker's win — the vulnerability gets
 * exploited); 0 is fully Containment (the defender's win — the
 * vulnerability gets patched before it can be leveraged). Starts
 * contested at the center and resets each combat. */
export const BREACH_CONTAINMENT_MIN = 0;
export const BREACH_CONTAINMENT_MAX = 100;
export const BREACH_CONTAINMENT_CENTER = 50;

export function createBreachContainment(): number {
  return BREACH_CONTAINMENT_CENTER;
}

export type BreachContainmentResolution = 'player' | 'enemy' | null;

export interface BreachContainmentPushResult {
  value: number;
  resolved: BreachContainmentResolution;
}

/**
 * Pushes Breach/Containment by `amount` (a non-negative magnitude)
 * toward the player's favor (Breach) or the enemy's (Containment),
 * clamping at the extremes and reporting resolution the instant either
 * extreme is reached.
 */
export function pushBreachContainment(
  value: number,
  amount: number,
  towardPlayer: boolean,
): BreachContainmentPushResult {
  const delta = towardPlayer ? amount : -amount;
  const clamped = Math.min(BREACH_CONTAINMENT_MAX, Math.max(BREACH_CONTAINMENT_MIN, value + delta));
  const resolved: BreachContainmentResolution =
    clamped >= BREACH_CONTAINMENT_MAX ? 'player' : clamped <= BREACH_CONTAINMENT_MIN ? 'enemy' : null;
  return { value: clamped, resolved };
}
