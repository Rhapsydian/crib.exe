/**
 * Per-side initiative gauge and the shared Control/Breach meter
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

/** Control/Breach is a single shared scalar, not two HP pools. 100 is
 * fully resolved in the player's favor, 0 fully in the enemy's; it
 * starts contested at the center and resets each combat. */
export const CONTROL_BREACH_MIN = 0;
export const CONTROL_BREACH_MAX = 100;
export const CONTROL_BREACH_CENTER = 50;

export function createControlBreach(): number {
  return CONTROL_BREACH_CENTER;
}

export type ControlBreachResolution = 'player' | 'enemy' | null;

export interface ControlBreachPushResult {
  value: number;
  resolved: ControlBreachResolution;
}

/**
 * Pushes Control/Breach by `amount` (a non-negative magnitude) toward
 * the player's favor or the enemy's, clamping at the extremes and
 * reporting resolution the instant either extreme is reached.
 */
export function pushControlBreach(value: number, amount: number, towardPlayer: boolean): ControlBreachPushResult {
  const delta = towardPlayer ? amount : -amount;
  const clamped = Math.min(CONTROL_BREACH_MAX, Math.max(CONTROL_BREACH_MIN, value + delta));
  const resolved: ControlBreachResolution =
    clamped >= CONTROL_BREACH_MAX ? 'player' : clamped <= CONTROL_BREACH_MIN ? 'enemy' : null;
  return { value: clamped, resolved };
}
