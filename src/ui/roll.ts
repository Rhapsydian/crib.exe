/**
 * An Event roll's animation (v0.9.0, the user's design): a bar split into
 * one segment per outcome, and a marker that sweeps back and forth, each
 * pass shorter and slower, before settling inside the segment that was
 * rolled. The roll itself is the engine's, already made; this only plays
 * it out. Pure, so the path can be tested; RollBar.svelte draws it.
 *
 * A risky choice's segments are its true odds. A gamble's are equal shares
 * that keep growing and shrinking (its odds are unknown), frozen wherever
 * they stand when the marker settles.
 */

/** Each leg of the sweep, ms, before the turn speed: about 2 seconds. */
export const ROLL_LEGS_MS = [300, 300, 320, 360, 420, 500];
/** How far past the target each turn reaches, a fraction of the bar. */
const ROLL_REACH = [1, 0.7, 0.45, 0.25, 0.1];

/** A gamble's segment widths at `ms` into the roll: equal shares, each
 * swelling and shrinking at its own pace (`wobble`: per segment, a
 * speed and a phase, from Math.random() once per roll). Sums to 1. */
export function gambleWidths(wobble: readonly { hz: number; phase: number }[], ms: number): number[] {
  const raw = wobble.map((w) => 1 + 0.55 * Math.sin((ms / 1000) * w.hz * 2 * Math.PI + w.phase));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => r / sum);
}

/** The segment under `pos` (0-1), given the widths. */
export function segmentAt(widths: readonly number[], pos: number): number {
  let edge = 0;
  for (let i = 0; i < widths.length; i++) {
    edge += widths[i];
    if (pos < edge) return i;
  }
  return widths.length - 1;
}

/** Where the marker settles: inside the landed segment, away from its
 * edges (`at`, 0-1, picks where in its middle half). */
export function rollTarget(widths: readonly number[], landed: number, at: number): number {
  const start = widths.slice(0, landed).reduce((a, b) => a + b, 0);
  return start + widths[landed] * (0.25 + 0.5 * at);
}

/** The sweep: each leg's end, ms and the stops, from the left edge to past
 * the target and back, closing in, ending on it. */
export function rollPath(target: number, scale = 1): { stops: number[]; legsMs: number[] } {
  const clamp = (x: number) => Math.min(0.99, Math.max(0.01, x));
  const stops = [...ROLL_REACH.map((r, i) => clamp(target + (i % 2 === 0 ? r : -r))), target];
  return { stops, legsMs: ROLL_LEGS_MS.map((ms) => ms * scale) };
}

/** The marker's place `ms` into the sweep; past the end, the target. */
export function rollPosition(path: { stops: number[]; legsMs: number[] }, ms: number): number {
  let from = 0;
  for (let i = 0; i < path.stops.length; i++) {
    const leg = path.legsMs[i];
    if (ms < leg) {
      const t = ms / leg;
      const eased = 0.5 - 0.5 * Math.cos(Math.PI * t);
      return from + (path.stops[i] - from) * eased;
    }
    ms -= leg;
    from = path.stops[i];
  }
  return path.stops[path.stops.length - 1];
}

/** The sweep's length, ms. */
export const rollMs = (path: { legsMs: number[] }): number => path.legsMs.reduce((a, b) => a + b, 0);
