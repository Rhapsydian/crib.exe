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
  turnTriggered: boolean;
}

/**
 * Feeds a side's own scored points into its gauge. Crossing the
 * threshold resets progress to 0 and flags a turn for that side — no
 * carry-over of overshoot, matching DESIGN.md's plain reset-on-cross
 * wording.
 */
export function addPoints(gauge: InitiativeGauge, points: number): InitiativeGaugeUpdate {
  if (points <= 0) return { gauge, turnTriggered: false };
  const progress = gauge.progress + points;
  if (progress >= gauge.threshold) {
    return { gauge: { ...gauge, progress: 0 }, turnTriggered: true };
  }
  return { gauge: { ...gauge, progress }, turnTriggered: false };
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
