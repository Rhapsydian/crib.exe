/**
 * Sound (go-live step 4; the user's choices are in docs/go-live-plan.md).
 * About eighteen short effects for moments that mean something. The cards
 * are recorded key presses (the user's pick: unicaegames' "Keyboard
 * soundpack 1", CC0), so playing a card is a keystroke; the rest are synth,
 * made here with the browser's own audio engine (oscillators, envelopes,
 * pitch slides, noise; no third-party code). No music.
 *
 * Nothing plays until the player's first tap (browsers require it), while
 * muted, or while a replay is being skipped. The same sound can't stack
 * within a few milliseconds, so fast replays don't turn into noise. Volume
 * and mute are preferences: an erase of progress keeps them.
 */

/** A synth sound: a waveform's pitch sliding from `from` to `to` Hz over
 * `ms`, shaped by a quick attack and a decay; optional noise. */
export interface Synth {
  wave: OscillatorType | 'noise';
  from: number;
  to?: number;
  ms: number;
  /** 0-1, before the master volume. */
  gain: number;
  attack?: number;
  /** A second note after `ms` (an arpeggio), same shape. */
  then?: Synth;
}

/** A recorded sound: one of `files` picked at random each time, its pitch
 * `rate` and loudness nudged by up to `jitter`, so no two are alike. Sounds
 * sharing a `group` never play the same file twice in a row. */
export interface Sample {
  files: string[];
  gain: number;
  rate?: number;
  jitter?: number;
  group?: string;
  /** Now and then a second, different file follows quickly, a little
   * quieter (the user: a quick double tap, as in real typing). */
  double?: { chance: number; gapMs: [number, number]; gain: number };
}

/** One of `files` at random, never `last` (when there's another). */
export function pickFile(files: readonly string[], last: string | undefined, random = Math.random): string {
  const choices = files.length > 1 ? files.filter((f) => f !== last) : files;
  return choices[Math.floor(random() * choices.length)];
}

/** About one card in eight is a double tap: a second, different key
 * 160-200 ms later (the user: two distinct keystrokes), a touch quieter. */
const CARD_DOUBLE = { chance: 1 / 8, gapMs: [160, 200] as [number, number], gain: 0.8 };

/** The keys a card plays: one, or now and then two different ones (a
 * double tap), never starting on `last`. */
export function pickKeys(files: readonly string[], last: string | undefined, double: Sample['double'], random = Math.random): string[] {
  const first = pickFile(files, last, random);
  return double && files.length > 1 && random() < double.chance ? [first, pickFile(files, first, random)] : [first];
}

/** The card sounds' key presses (the user's pick: the pack's first ten). */
export const KEY_FILES = Array.from({ length: 10 }, (_, i) => `sounds/keys/keypress-${String(i + 1).padStart(3, '0')}.wav`);

export type SoundId =
  | 'handStart' | 'cardYou' | 'cardThem' | 'cardLift' | 'cardDrop' | 'cribSend' | 'cut' | 'clear'
  | 'peg' | 'show'
  | 'turnYou' | 'turnThem' | 'fire' | 'mod' | 'alarm' | 'breached' | 'contained'
  | 'move' | 'cache' | 'reward' | 'rollTick' | 'rollGood' | 'rollBad' | 'flawless';

/** Every sound, by moment. */
export const SOUNDS: Record<SoundId, Synth | Sample> = {
  // Cards (the user's picks from three variants each). A hand starts (the
  // cards appear at once, so not a deal): two soft rising tones.
  handStart: { wave: 'sine', from: 440, to: 440, ms: 70, gain: 0.14, then: { wave: 'sine', from: 660, to: 660, ms: 110, gain: 0.12 } },
  // A card is a keystroke (the user's pick): one of ten recorded keys at
  // random, never the same twice in a row, slightly varied; theirs a little
  // lower, so the ear knows whose it was.
  cardYou: { files: KEY_FILES, gain: 0.8, rate: 1, jitter: 0.04, group: 'cards', double: CARD_DOUBLE },
  cardThem: { files: KEY_FILES, gain: 0.75, rate: 0.86, jitter: 0.04, group: 'cards', double: CARD_DOUBLE },
  // Handling your cards is typing too (the user's ask): lifting one a
  // light key, dropping it back a touch lower, and sending two to the crib
  // always a double tap, one key per card.
  cardLift: { files: KEY_FILES, gain: 0.55, rate: 1.05, jitter: 0.04, group: 'cards' },
  cardDrop: { files: KEY_FILES, gain: 0.5, rate: 0.93, jitter: 0.04, group: 'cards' },
  cribSend: { files: KEY_FILES, gain: 0.8, rate: 1, jitter: 0.04, group: 'cards', double: { ...CARD_DOUBLE, chance: 1 } },
  // The cut: two quick notes, low then high.
  cut: { wave: 'triangle', from: 600, to: 600, ms: 40, gain: 0.14, then: { wave: 'triangle', from: 1200, to: 1200, ms: 70, gain: 0.12 } },
  // The table clears (31, or a go): a soft hiss.
  clear: { wave: 'noise', from: 0, ms: 120, gain: 0.04 },
  // Cribbage scoring.
  peg: { wave: 'triangle', from: 660, to: 990, ms: 70, gain: 0.25 },
  show: { wave: 'triangle', from: 520, to: 780, ms: 60, gain: 0.2 },
  // A fight.
  turnYou: { wave: 'square', from: 330, to: 660, ms: 90, gain: 0.12 },
  turnThem: { wave: 'square', from: 520, to: 260, ms: 90, gain: 0.12 },
  fire: { wave: 'sine', from: 1200, to: 900, ms: 30, gain: 0.08 },
  mod: { wave: 'sine', from: 1400, to: 2100, ms: 60, gain: 0.12, then: { wave: 'sine', from: 2100, to: 2800, ms: 60, gain: 0.1 } },
  alarm: { wave: 'sawtooth', from: 880, to: 700, ms: 120, gain: 0.1, then: { wave: 'sawtooth', from: 880, to: 700, ms: 120, gain: 0.1 } },
  breached: { wave: 'square', from: 392, to: 392, ms: 90, gain: 0.12, then: { wave: 'square', from: 523, to: 523, ms: 90, gain: 0.12, then: { wave: 'square', from: 784, to: 784, ms: 220, gain: 0.12 } } },
  contained: { wave: 'sawtooth', from: 330, to: 110, ms: 450, gain: 0.12 },
  // A run.
  move: { wave: 'sine', from: 500, to: 700, ms: 50, gain: 0.12 },
  cache: { wave: 'triangle', from: 440, to: 880, ms: 120, gain: 0.2, then: { wave: 'triangle', from: 880, to: 1320, ms: 160, gain: 0.18 } },
  reward: { wave: 'triangle', from: 600, to: 900, ms: 80, gain: 0.2 },
  // An Event's roll (v0.9.0): a tick as the marker crosses into another
  // segment, then a rising or falling settle for a good or bad result.
  rollTick: { wave: 'square', from: 1800, to: 1500, ms: 18, gain: 0.06 },
  rollGood: { wave: 'triangle', from: 523, to: 523, ms: 90, gain: 0.18, then: { wave: 'triangle', from: 784, to: 784, ms: 200, gain: 0.16 } },
  rollBad: { wave: 'triangle', from: 392, to: 392, ms: 90, gain: 0.18, then: { wave: 'triangle', from: 262, to: 247, ms: 260, gain: 0.16 } },
  // The rating.
  flawless: { wave: 'sine', from: 1046, to: 1046, ms: 120, gain: 0.18, then: { wave: 'sine', from: 1318, to: 1318, ms: 120, gain: 0.16, then: { wave: 'sine', from: 1568, to: 1568, ms: 260, gain: 0.15 } } },
};

const PREF_KEY = 'cribexe.sound';
interface SoundPrefs {
  volume: number;
  muted: boolean;
}
function loadPrefs(): SoundPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY) ?? 'null') as Partial<SoundPrefs> | null;
    return { volume: typeof raw?.volume === 'number' ? Math.min(1, Math.max(0, raw.volume)) : 0.7, muted: raw?.muted === true };
  } catch {
    return { volume: 0.7, muted: false };
  }
}

const STACK_MS = 40;

class SoundEngine {
  #prefs = loadPrefs();
  #ctx: AudioContext | null = null;
  #master: GainNode | null = null;
  #last = new Map<SoundId, number>();
  #buffers = new Map<string, Promise<AudioBuffer | null>>();
  /** The file each group played last (Sample.group). */
  #lastFile = new Map<string, string>();
  /** Off while a replay is skipped or a save is checked. */
  quiet = false;

  get volume(): number {
    return this.#prefs.volume;
  }
  get muted(): boolean {
    return this.#prefs.muted;
  }
  setVolume(volume: number): void {
    this.#prefs = { ...this.#prefs, volume: Math.min(1, Math.max(0, volume)) };
    this.#apply();
  }
  setMuted(muted: boolean): void {
    this.#prefs = { ...this.#prefs, muted };
    this.#apply();
  }
  #apply(): void {
    if (this.#master) this.#master.gain.value = this.#prefs.muted ? 0 : this.#prefs.volume;
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(this.#prefs));
    } catch {
      // Storage blocked: the choice lasts the session.
    }
  }

  /** The audio context, made on the first play after a tap. */
  #context(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!this.#ctx) {
      this.#ctx = new AudioContext();
      this.#master = this.#ctx.createGain();
      this.#master.gain.value = this.#prefs.muted ? 0 : this.#prefs.volume;
      this.#master.connect(this.#ctx.destination);
    }
    if (this.#ctx.state === 'suspended') void this.#ctx.resume();
    return this.#ctx;
  }

  play(id: SoundId, opts: { force?: boolean } = {}): void {
    if (!opts.force && (this.quiet || this.#prefs.muted || this.#prefs.volume === 0)) return;
    const now = performance.now();
    if (now - (this.#last.get(id) ?? -Infinity) < STACK_MS) return;
    this.#last.set(id, now);
    const s = SOUNDS[id];
    if ('files' in s) this.playSample(s);
    else this.playSynth(s);
  }

  /** A recorded sound as given (the audition page's keys). */
  playSample(s: Sample): void {
    const ctx = this.#context();
    if (!ctx || !this.#master) return;
    const urls = pickKeys(s.files, s.group ? this.#lastFile.get(s.group) : undefined, s.double);
    if (s.group) this.#lastFile.set(s.group, urls[urls.length - 1]);
    const j = s.jitter ?? 0;
    const r = () => 1 + (Math.random() * 2 - 1) * j;
    const second = s.double ? (s.double.gapMs[0] + Math.random() * (s.double.gapMs[1] - s.double.gapMs[0])) / 1000 : 0;
    urls.forEach((url, i) => {
      void this.#buffer(ctx, url).then((buffer) => {
        if (!buffer || !this.#master) return;
        const src = ctx.createBufferSource();
        const g = ctx.createGain();
        g.gain.value = s.gain * r() * (i ? (s.double?.gain ?? 1) : 1);
        src.buffer = buffer;
        src.playbackRate.value = (s.rate ?? 1) * r();
        src.connect(g).connect(this.#master);
        src.start(i ? ctx.currentTime + second : 0);
      });
    });
  }

  #buffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    let b = this.#buffers.get(url);
    if (!b) {
      b = fetch(url)
        .then((res) => res.arrayBuffer())
        .then((a) => ctx.decodeAudioData(a))
        .catch(() => null);
      this.#buffers.set(url, b);
    }
    return b;
  }

  /** A synth sound as given (the audition page's variants). */
  playSynth(s: Synth): void {
    const ctx = this.#context();
    if (ctx && this.#master) this.#synth(ctx, s, ctx.currentTime);
  }

  #synth(ctx: AudioContext, s: Synth, at: number): void {
    if (!this.#master) return;
    const dur = s.ms / 1000;
    const g = ctx.createGain();
    const attack = s.attack ?? 0.005;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(s.gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    g.connect(this.#master);
    if (s.wave === 'noise') {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(g);
      src.start(at);
    } else {
      const osc = ctx.createOscillator();
      osc.type = s.wave;
      osc.frequency.setValueAtTime(s.from, at);
      if (s.to !== undefined && s.to !== s.from) osc.frequency.exponentialRampToValueAtTime(s.to, at + dur);
      osc.connect(g);
      osc.start(at);
      osc.stop(at + dur + 0.02);
    }
    if (s.then) this.#synth(ctx, s.then, at + dur);
  }
}

export const sound = new SoundEngine();
