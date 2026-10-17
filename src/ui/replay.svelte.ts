import type { FireEvent, GaugeReading } from '../engine/resolve';

/**
 * The turn step-through (playable-design P4). The engine resolves a turn
 * at once; this replays the fires it recorded, one piece at a time: each
 * lights up, its log line appears, and the gauges move to where that fire
 * left them (`FireEvent.gauges`). Enemy fires step faster than yours.
 * `skip()` jumps to the end.
 *
 * The screen feeds it the fight's log and live gauges at every engine
 * pause (`sync`); it steps through whatever is new since the last one.
 */
export type Speed = 'slow' | 'normal' | 'fast';
export const SPEEDS: Speed[] = ['slow', 'normal', 'fast'];

/** Milliseconds per fire at normal speed. */
const STEP_MS = { player: 330, enemy: 200 };
const SPEED_SCALE: Record<Speed, number> = { slow: 1.8, normal: 1, fast: 0.4 };
const SPEED_KEY = 'cribexe.turnSpeed';

export class Replay {
  /** How many log entries are on screen. */
  shown = $state(0);
  speed = $state<Speed>(loadSpeed());
  log = $state.raw<readonly FireEvent[]>([]);
  /** Where the batch being stepped through began, and the gauges as they
   * stood at the pause before it. */
  batchStart = $state(0);
  before = $state.raw<[GaugeReading, GaugeReading] | null>(null);
  /** The beat the last fire stays lit for, after it appears. */
  holding = $state(false);

  /** True while fires are still being stepped through. */
  playing = $derived(this.shown < this.log.length || this.holding);
  /** The fire on screen right now, while stepping. */
  firing = $derived(this.playing && this.shown > this.batchStart ? this.log[this.shown - 1] : null);
  /** The gauges to draw: where the current fire left them; the state at
   * the previous pause before this batch's first fire; null (draw the
   * live state) once stepping is done. */
  gauges = $derived<[GaugeReading, GaugeReading] | null>(!this.playing ? null : this.firing ? this.firing.gauges : this.before);

  #previous: [GaugeReading, GaugeReading] | null = null;
  #timer: ReturnType<typeof setTimeout> | null = null;

  /** A new engine pause: the fight's log so far, and the live gauges. */
  sync(log: readonly FireEvent[], live: [GaugeReading, GaugeReading]): void {
    if (log.length < this.shown) this.reset();
    if (log.length > this.shown) {
      // A new batch: anything still stepping from the last one finishes.
      this.#clear();
      this.holding = false;
      this.shown = Math.max(this.shown, this.log.length);
      this.batchStart = this.shown;
      this.before = this.#previous;
    }
    this.log = log;
    this.#previous = live;
    this.#schedule();
  }

  skip(): void {
    this.#clear();
    this.shown = this.log.length;
    this.holding = false;
  }

  cycleSpeed(): void {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    try {
      localStorage.setItem(SPEED_KEY, this.speed);
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
    this.log = [];
    this.before = null;
    this.#previous = null;
  }

  #schedule(): void {
    if (this.#timer || this.shown >= this.log.length) return;
    const next = this.log[this.shown];
    const delay = STEP_MS[next.side === 0 ? 'player' : 'enemy'] * SPEED_SCALE[this.speed];
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.shown++;
      if (this.shown < this.log.length) return this.#schedule();
      // The last fire: hold it lit for one more beat.
      this.holding = true;
      this.#timer = setTimeout(() => {
        this.#timer = null;
        this.holding = false;
      }, delay);
    }, delay);
  }

  #clear(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }
}

function loadSpeed(): Speed {
  try {
    const saved = localStorage.getItem(SPEED_KEY);
    if (saved && (SPEEDS as string[]).includes(saved)) return saved as Speed;
  } catch {
    // See cycleSpeed.
  }
  return 'normal';
}
