/**
 * Per-side initiative gauge (session 17 checkpoint D) and per-side duel
 * gauge (Breach/Containment redesign, session 22+). Combat orchestration
 * (when to actually fire subroutines on a triggered turn) is Checkpoint
 * E/F's job — this file only tracks the numbers and detects
 * resolution moments.
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

/**
 * Breach/Containment redesign (session 22+): each side races toward its
 * own win independently, instead of both pushing one shared 0-100
 * scalar. Side 0's duel gauge is "Breach progress" (the attacker's
 * win — the vulnerability gets exploited); side 1's is "Containment
 * progress" (the defender's win — the vulnerability gets patched
 * before it can be leveraged) — same flavor poles as before, just no
 * longer two ends of one shared axis. Only a side's own offense adds to
 * *its own* gauge; nothing subtracts from it either (that's what
 * distinguishes this from a shared tug-of-war) — Encryption's
 * mitigation works by reducing the *opponent's* gauge instead (see
 * resolve.ts), which is also what makes "mitigation can't win alone" a
 * free structural property now rather than something needing an
 * artificial cap.
 */
export interface DuelGauge {
  progress: number;
  threshold: number;
}

export function createDuelGauge(threshold: number): DuelGauge {
  return { progress: 0, threshold };
}

export interface DuelProgressUpdate {
  gauge: DuelGauge;
  /** True the instant progress reaches (or already was at) threshold —
   * a side's win. */
  resolved: boolean;
}

/** Credits a side's own gauge with `amount` progress toward its own
 * win. Progress is intentionally allowed to sit above threshold rather
 * than being clamped — `resolved` is what combat.ts actually checks,
 * not the raw progress value. */
export function addDuelProgress(gauge: DuelGauge, amount: number): DuelProgressUpdate {
  if (amount <= 0) return { gauge, resolved: gauge.progress >= gauge.threshold };
  const progress = gauge.progress + amount;
  return { gauge: { ...gauge, progress }, resolved: progress >= gauge.threshold };
}

/** Reduces a side's own gauge by `amount` — Encryption's mitigation
 * tools (HoT, instantCounterPush) call this against the *opponent's*
 * gauge, never their own. Floored at 0; never itself resolves a win
 * (only addDuelProgress does), and never needs an upper cap the way
 * the old shared scalar's midpoint did. */
export function reduceDuelProgress(gauge: DuelGauge, amount: number): DuelGauge {
  if (amount <= 0) return gauge;
  const progress = Math.max(0, gauge.progress - amount);
  return { ...gauge, progress };
}
