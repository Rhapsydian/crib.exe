import type { FireEvent, GaugeReading } from '../engine/resolve';
import { stepDelay, stepGauges, type Step } from './timeline';

/**
 * The step-through (playable-design P4, extended in checkpoint 3a). The
 * engine resolves everything between two player decisions at once; this
 * replays it a step at a time (timeline.ts's `Step`): a card goes onto
 * the pile, points land with a callout, a piece lights up as it fires,
 * and the gauges move to where each step left them. Each step stays up
 * for its own `stepDelay`, scaled by the speed setting. `skip()` jumps
 * to the end.
 *
 * The screen feeds it the fight's steps and live gauges at every engine
 * pause (`sync`); it plays whatever is new since the last one.
 */
export type Speed = 'slow' | 'normal' | 'fast';
export const SPEEDS: Speed[] = ['slow', 'normal', 'fast'];

const SPEED_SCALE: Record<Speed, number> = { slow: 1.8, normal: 1, fast: 0.4 };
const SPEED_KEY = 'cribexe.turnSpeed';
/** The pause before a batch's first step, at normal speed. */
export const LEAD_IN_MS = 120;

export class Replay {
  /** How many steps are on screen. */
  shown = $state(0);
  speed = $state<Speed>('normal');
  steps = $state.raw<readonly Step[]>([]);
  /** Where the batch being played began, and the gauges as they stood at
   * the pause before it. */
  batchStart = $state(0);
  before = $state.raw<[GaugeReading, GaugeReading] | null>(null);
  /** The last step's own beat, after it appears. */
  holding = $state(false);
  /** The live gauges as of the latest pause -- at a fight's end, its final
   * state, for the end-of-fight blink (session 63). */
  live = $state.raw<[GaugeReading, GaugeReading] | null>(null);

  /** True while steps are still being played. */
  playing = $derived(this.shown < this.steps.length || this.holding);
  /** The step on screen right now, while playing. */
  current = $derived(this.playing && this.shown > this.batchStart ? this.steps[this.shown - 1] : null);
  /** The piece firing right now, if the current step is a fire. */
  firing = $derived<FireEvent | null>(this.current?.type === 'fire' ? this.current.fire : null);
  /** The gauges to draw while playing: where the latest step that
   * records them left them, else the state at the previous pause; null
   * (draw the live state) once done. */
  gauges = $derived.by<[GaugeReading, GaugeReading] | null>(() => {
    if (!this.playing) return null;
    for (let i = this.shown - 1; i >= this.batchStart; i--) {
      const g = stepGauges(this.steps[i]);
      if (g) return g;
    }
    return this.before;
  });

  #previous: [GaugeReading, GaugeReading] | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #speedKey: string;

  /** `speedKey` / `defaultSpeed`: where the speed choice is remembered
   * and what it starts at -- Learn to play keeps its own, starting slow
   * (session 61), so a learner's choice never changes normal play's. */
  constructor(speedKey = SPEED_KEY, defaultSpeed: Speed = 'normal') {
    this.#speedKey = speedKey;
    this.speed = loadSpeed(speedKey, defaultSpeed);
  }

  /** A new engine pause: the fight's steps so far, and the live gauges. */
  sync(steps: readonly Step[], live: [GaugeReading, GaugeReading]): void {
    if (steps.length < this.shown) this.reset();
    if (steps.length > this.shown) {
      const midBatch = this.shown < this.steps.length;
      if (this.holding) {
        // The last step was holding the screen: the new ones follow it.
        this.#clear();
        this.holding = false;
      }
      // A pause that arrives mid-batch queues its steps after the unplayed
      // ones (session 72, the user's report: it used to jump to the old
      // batch's end, so the skipped steps landed in the log at once and
      // the gauges leapt forward).
      if (!midBatch) {
        this.batchStart = this.shown;
        this.before = this.#previous;
      }
    }
    this.steps = steps;
    this.#previous = live;
    this.live = live;
    this.#schedule();
  }

  skip(): void {
    this.#clear();
    this.shown = this.steps.length;
    this.holding = false;
  }

  cycleSpeed(): void {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    try {
      localStorage.setItem(this.#speedKey, this.speed);
    } catch {
      // Storage can be unavailable (private windows); the choice still
      // holds for this session.
    }
  }

  reset(): void {
    this.#clear();
    this.shown = 0;
    this.holding = false;
    this.batchStart = 0;
    this.steps = [];
    this.before = null;
    this.#previous = null;
    this.live = null;
  }

  #schedule(): void {
    if (this.#timer) return;
    const scale = SPEED_SCALE[this.speed];
    if (this.shown < this.steps.length) {
      const delay = this.shown === this.batchStart ? LEAD_IN_MS : stepDelay(this.steps[this.shown - 1]);
      this.#timer = setTimeout(() => {
        this.#timer = null;
        this.shown++;
        if (this.shown === this.steps.length) this.holding = true;
        this.#schedule();
      }, delay * scale);
    } else if (this.holding) {
      this.#timer = setTimeout(() => {
        this.#timer = null;
        this.holding = false;
      }, stepDelay(this.steps[this.shown - 1]) * scale);
    }
  }

  #clear(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }
}

/** The turn speed fights and Play Cribbage start at (go-live step 3: the
 * Settings screen sets the same value the in-game "»" button does). */
export function turnSpeed(): Speed {
  return loadSpeed(SPEED_KEY, 'normal');
}
export function setTurnSpeed(speed: Speed): void {
  try {
    localStorage.setItem(SPEED_KEY, speed);
  } catch {
    // Storage blocked: the choice lasts the session.
  }
}

function loadSpeed(key: string, fallback: Speed): Speed {
  try {
    const saved = localStorage.getItem(key);
    if (saved && (SPEEDS as string[]).includes(saved)) return saved as Speed;
  } catch {
    // See cycleSpeed.
  }
  return fallback;
}
