import type { PlayerIndex } from '../engine/game';
import type { BetaEffect, Effect, SubroutineDefinition, Verb } from '../engine/subroutine-types';
import { describeHook, fmt, forEnemy } from './describe';
import { modName } from './kit';
import { burnerLabel, stepDelay, type Step } from './timeline';

/**
 * The detailed turn display (session 82): a panel over the middle of the fight screen that lists the turn-taker's
 * subroutines top to bottom, lights each as it fires with what its
 * Process did, calls out a Hook going off (and why it did), and keeps a
 * running tally of the turn. Worked out from the replay's steps, so it
 * follows the replay exactly, a step at a time.
 *
 * A turn runs from its `turn` beat to its `turnEnd` (timeline.ts's
 * mergeSteps with `turnEnds`). Rows are the loadout; each of the side's
 * fires lands on the first row with its subroutine not yet fired (a
 * duplicate's second copy takes the second fire), and a fire with no row
 * left joins as an extra row. Instant Hooks going off inside the turn,
 * either side's, are notes, as are a Burner spent at its start, a Mod
 * acting outside a fire and system strain.
 */
export type RowState = 'pending' | 'firing' | 'fired' | 'skipped';

export interface TurnHook {
  /** What it did: "Suppress 1", or "Process boosted" for an enhance. */
  effect: string;
  /** Why it went off: the Hook's rule, in the side's voice. */
  why: string;
}

export interface TurnRow {
  name: string;
  state: RowState;
  /** What its Process did this turn, once fired. */
  process: string | null;
  /** The Empower its Process took ("+2 Empower"), or a "next" Empower it
   * spent without using ("Empower 2 unused", `wasted`). */
  empower: { text: string; wasted: boolean } | null;
  hook: TurnHook | null;
  /** Mods that acted during the fire. */
  mods: string[];
}

export interface TurnNote {
  text: string;
  tone: 'burner' | 'mod' | 'strain' | 'instant';
}

/** One number in the tally: "8 CREDIT", or "×2 TEMPO" for a counted verb. */
export interface TallyItem {
  verb: Verb;
  label: string;
  value: number;
  counted: boolean;
}

/** Where a burst of particles goes when a row fires (session 82's impact
 * pass): to a tally number, to the rows an Empower or Charge lands on, or
 * nowhere, fizzling on the row (a "next" Empower it couldn't use). */
export type BurstTarget = { kind: 'tally'; verb: Verb } | { kind: 'row'; index: number } | { kind: 'fizzle' };

export interface Burst {
  /** The row it leaves from. */
  from: number;
  to: BurstTarget;
  /** 'side' in the turn-taker's colour; 'hook' for a Hook's own effect. */
  tone: 'side' | 'hook';
  /** A row whose Hook fired: a bigger burst with Hook dots mixed in. */
  mixed: boolean;
}

export interface TurnPanelState {
  side: PlayerIndex;
  /** The turn beat's step index, and its turnEnd's once it is on screen. */
  start: number;
  endIndex: number | null;
  ended: boolean;
  rows: TurnRow[];
  notes: TurnNote[];
  /** What the turn did so far, by verb. */
  tally: TallyItem[];
  /** The bursts of the row firing on the last step shown (empty unless a
   * fire of this side is the last step), and that step's index, so the
   * screen plays each fire's bursts once. */
  bursts: Burst[];
  at: number;
}

const IN_TURN_BEATS = new Set(['burner', 'mod', 'strain']);

/** The turn on screen once `upto` steps are shown, or null when the replay
 * isn't inside a turn. `loadouts` are both sides' subroutines in order. */
export function turnPanel(
  steps: readonly Step[],
  upto: number,
  loadouts: readonly [readonly SubroutineDefinition[], readonly SubroutineDefinition[]],
  bridgeUpgraded?: readonly [boolean, boolean],
): TurnPanelState | null {
  const last = Math.min(upto, steps.length) - 1;
  if (last < 0) return null;
  let start = -1;
  for (let i = last; i >= 0; i--) {
    const s = steps[i];
    if (s.type === 'beat' && s.beat.kind === 'turn') {
      start = i;
      break;
    }
    const inTurn = s.type === 'fire' || (s.type === 'turnEnd' && i === last) || (s.type === 'beat' && IN_TURN_BEATS.has(s.beat.kind));
    if (!inTurn) return null;
  }
  if (start < 0) return null;
  const turnBeat = steps[start];
  if (turnBeat.type !== 'beat' || turnBeat.beat.kind !== 'turn') return null;
  const side = turnBeat.beat.side;
  const voice = (text: string) => (side === 1 ? forEnemy(text) : text);
  const defs = loadouts[side];
  const rows: TurnRow[] = defs.map((d) => ({ name: d.name, state: 'pending', process: null, empower: null, hook: null, mods: [] }));
  const rowDefs: SubroutineDefinition[] = [...defs];
  const notes: TurnNote[] = [];
  const sums = new Map<Verb, number>();
  const ended = steps[last].type === 'turnEnd';
  let bursts: Burst[] = [];

  for (let i = start + 1; i <= last; i++) {
    const s = steps[i];
    if (s.type === 'fire') {
      const fire = s.fire;
      if (fire.side !== side || fire.immediate) {
        const name = loadouts[fire.side].find((d) => d.id === fire.subroutineId)?.name ?? fire.subroutineId;
        // An enhance Instant Hook has no effect of its own: it fires the
        // Process again, boosted.
        const what = shortEffect(fire.beta ?? fire.alpha);
        const line = `Instant Hook · ${name}: ${what}`;
        notes.push({ text: fire.side === 1 ? forEnemy(line) : line, tone: 'instant' });
        continue;
      }
      let r = rowDefs.findIndex((d, j) => d.id === fire.subroutineId && rows[j].state === 'pending');
      if (r < 0) {
        const def = loadouts[side].find((d) => d.id === fire.subroutineId);
        rows.push({ name: def?.name ?? fire.subroutineId, state: 'pending', process: null, empower: null, hook: null, mods: [] });
        rowDefs.push(def ?? ({ id: fire.subroutineId } as SubroutineDefinition));
        r = rows.length - 1;
      }
      const def = rowDefs[r];
      rows[r] = {
        name: rows[r].name,
        state: i === last ? 'firing' : 'fired',
        process: voice(shortEffect(fire.alpha)),
        empower: fire.empowered
          ? { text: `+${fmt(fire.empowered)} Empower`, wasted: false }
          : fire.empowerWasted
            ? { text: `Empower ${fmt(fire.empowerWasted)} unused`, wasted: true }
            : null,
        hook: fire.beta || fire.elevated ? { effect: fire.beta ? voice(shortEffect(fire.beta)) : 'Process boosted', why: def.beta ? voice(describeHook(def)) : '' } : null,
        mods: [...new Set((fire.mods ?? []).map((m) => modName(m.mod, bridgeUpgraded?.[m.side])))],
      };
      add(sums, fire.alpha);
      if (fire.beta) add(sums, fire.beta);
      if (i === last) bursts = burstsFor(fire, r, rowDefs);
    } else if (s.type === 'beat') {
      const b = s.beat;
      // A Burner isn't a fire, so it isn't in the tally: its line says what it does.
      if (b.kind === 'burner') notes.push({ text: `Burner · ${burnerLabel(b.burnerId)}`, tone: 'burner' });
      else if (b.kind === 'mod') notes.push({ text: `${b.side === 0 ? 'Your' : 'Their'} Mod: ${modName(b.mod, bridgeUpgraded?.[b.side])}`, tone: 'mod' });
      else if (b.kind === 'strain') notes.push({ text: `System strain: +${fmt(b.heat)} Heat (${b.turns} turns in a row)`, tone: 'strain' });
    }
  }
  if (ended) for (const row of rows) if (row.state === 'pending') row.state = 'skipped';
  return { side, start, endIndex: ended ? last : null, ended, rows, notes, tally: tallyItems(sums), bursts, at: last };
}

type Fire = Extract<Step, { type: 'fire' }>['fire'];

/** A fire's bursts from row `r`: its Process to its tally number (mixed
 * when its Hook boosted it), an Empower or Charge to the rows it lands on,
 * a wasted Empower fizzling, and a Hook's own effect to its number. */
function burstsFor(fire: Fire, r: number, rowDefs: readonly SubroutineDefinition[]): Burst[] {
  // A Hook that boosts its Process fires elevated with no effect of its own.
  const mixed = fire.elevated && !fire.beta;
  const out: Burst[] = [];
  const toRows = (indexes: number[]) => indexes.forEach((index) => out.push({ from: r, to: { kind: 'row', index }, tone: 'side', mixed }));
  const below = rowDefs.map((_, j) => j).filter((j) => j > r);
  const alpha = fire.alpha;
  if (fire.empowerWasted) out.push({ from: r, to: { kind: 'fizzle' }, tone: 'side', mixed: false });
  if (alpha.verb === 'empower') toRows(alpha.scope === 'next' ? below.slice(0, 1) : below);
  else if (alpha.verb === 'charge') {
    const hooked = (j: number) => !!rowDefs[j].beta && rowDefs[j].beta!.shape !== 'immediate';
    // As the engine (resolve.ts): `next` is the very next piece, and only
    // a piece with a turn Hook (not an Instant one) takes a Charge.
    if (alpha.target === 'next') toRows(below.slice(0, 1).filter(hooked));
    else if (alpha.target === 'all') toRows(rowDefs.map((_, j) => j).filter((j) => j !== r && hooked(j)));
  } else if (TALLY_ORDER.includes(alpha.verb)) out.push({ from: r, to: { kind: 'tally', verb: alpha.verb }, tone: 'side', mixed });
  const beta = fire.beta;
  if (beta && TALLY_ORDER.includes(beta.verb)) out.push({ from: r, to: { kind: 'tally', verb: beta.verb }, tone: 'hook', mixed: false });
  return out;
}

/** How long a burst flies: most of the time a fire holds on screen at
 * this speed (so it lands before the next row lights), at most 0.4 s. */
export function flightMs(side: PlayerIndex, speedScale: number): number {
  const hold = stepDelay({ type: 'fire', fire: { side } as Fire }, true) * speedScale;
  return Math.round(Math.max(120, Math.min(400, hold * 0.8)));
}

/** The tally's order: the shared verbs, then the enemy-only ones. Empower
 * and Charge aren't in it (the user's call, session 82): they act on
 * other subroutines, so they show where they land, on the rows. */
const TALLY_ORDER: Verb[] = ['credit', 'ward', 'suppress', 'tempo', 'disrupt', 'trace', 'wipe', 'strip', 'suspend'];
/** Verbs counted as times used rather than summed amounts. */
const COUNTED: ReadonlySet<Verb> = new Set(['tempo', 'disrupt']);
const VERB_NAME: Record<Verb, string> = {
  credit: 'Credit',
  suppress: 'Suppress',
  ward: 'Ward',
  empower: 'Empower',
  tempo: 'Tempo',
  disrupt: 'Disrupt',
  charge: 'Charge',
  trace: 'Trace',
  wipe: 'Wipe',
  strip: 'Strip',
  suspend: 'Suspend',
};

function add(sums: Map<Verb, number>, effect: BetaEffect): void {
  if (effect.verb === 'enhance' || !TALLY_ORDER.includes(effect.verb)) return;
  const n = COUNTED.has(effect.verb) || !('amount' in effect) ? 1 : effect.amount;
  sums.set(effect.verb, (sums.get(effect.verb) ?? 0) + n);
}

function tallyItems(sums: Map<Verb, number>): TallyItem[] {
  return TALLY_ORDER.filter((v) => sums.has(v)).map((v) => ({ verb: v, label: VERB_NAME[v], value: sums.get(v)!, counted: COUNTED.has(v) }));
}

/** A tally number as text: "8", "2.5", or "×2" for a counted verb. */
export const tallyText = (item: Pick<TallyItem, 'value' | 'counted'>) => (item.counted ? `×${item.value}` : fmt(item.value));

/** One effect, short enough for a panel row, in the player's voice
 * (forEnemy re-voices it): "Credit 3", "Ward 2", "Charge 1 (next Hook)". */
export function shortEffect(effect: BetaEffect): string {
  if (effect.verb === 'enhance') return 'Process boosted';
  const e = effect as Effect;
  const feed = e.feed ? ` (+${fmt(e.feed)} to their Containment)` : '';
  return body(e) + feed;
}

function body(e: Effect): string {
  switch (e.verb) {
    case 'credit':
      if (e.from === 'opponent') return `Credit ${fmt(e.amount)}, taken from their Containment`;
      if (e.from === 'ward') return `Credit ${fmt(e.amount)} from your Ward`;
      return `Credit ${fmt(e.amount)}${e.piercing ? ', ignoring Ward' : ''}`;
    case 'suppress':
      return `Suppress ${fmt(e.amount)}`;
    case 'ward':
      return `Ward ${fmt(e.amount)}`;
    case 'empower':
      return `Empower ${fmt(e.amount)} → ${e.scope === 'next' ? 'next' : 'all below'}`;
    case 'tempo':
      return e.target === 'own' ? 'Tempo: your turns come sooner' : 'Tempo: their turns come later';
    case 'disrupt':
      return { revealHand: 'Disrupt: reveal their hand', revealCrib: 'Disrupt: reveal their crib cards', forceDiscard: 'Disrupt: force a card into the crib' }[e.action];
    case 'charge':
      return `Charge ${fmt(e.amount)} → ${e.target === 'self' ? 'its own Hook' : e.target === 'next' ? 'the next Hook' : 'every other Hook'}`;
    case 'trace':
      return `Trace: they gain ${fmt(e.amount)} Heat`;
    case 'wipe':
      return `Wipe: their Hooks lose ${e.amount === 1 ? '1 count' : `${fmt(e.amount)} counts`}`;
    case 'strip':
      return `Strip: they lose ${fmt(e.amount)} Ward`;
    case 'suspend':
      return `Suspend: their bottom subroutine skips ${e.amount === 1 ? 'a turn' : `${fmt(e.amount)} turns`}`;
  }
}
