import type { PlayerIndex } from '../engine/game';
import type { BetaEffect, Effect, SubroutineDefinition, Verb } from '../engine/subroutine-types';
import { BURNER_DEFINITIONS } from '../engine/burners';
import { describeHook, fmt, forEnemy } from './describe';
import { modName } from './kit';
import type { Step } from './timeline';

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
  hook: TurnHook | null;
  /** Mods that acted during the fire. */
  mods: string[];
}

export interface TurnNote {
  text: string;
  tone: 'burner' | 'mod' | 'strain' | 'instant';
}

export interface TurnPanelState {
  side: PlayerIndex;
  /** The turn beat's step index, and its turnEnd's once it is on screen. */
  start: number;
  endIndex: number | null;
  ended: boolean;
  rows: TurnRow[];
  notes: TurnNote[];
  /** What the turn did so far, by verb ("Credit 7", "Ward 2"). */
  tally: string[];
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
  const rows: TurnRow[] = defs.map((d) => ({ name: d.name, state: 'pending', process: null, hook: null, mods: [] }));
  const rowDefs: SubroutineDefinition[] = [...defs];
  const notes: TurnNote[] = [];
  const sums = new Map<Verb, number>();
  const ended = steps[last].type === 'turnEnd';

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
        rows.push({ name: def?.name ?? fire.subroutineId, state: 'pending', process: null, hook: null, mods: [] });
        rowDefs.push(def ?? ({ id: fire.subroutineId } as SubroutineDefinition));
        r = rows.length - 1;
      }
      const def = rowDefs[r];
      rows[r] = {
        name: rows[r].name,
        state: i === last ? 'firing' : 'fired',
        process: voice(shortEffect(fire.alpha)),
        hook: fire.beta || fire.elevated ? { effect: fire.beta ? voice(shortEffect(fire.beta)) : 'Process boosted', why: def.beta ? voice(describeHook(def)) : '' } : null,
        mods: [...new Set((fire.mods ?? []).map((m) => modName(m.mod, bridgeUpgraded?.[m.side])))],
      };
      add(sums, fire.alpha);
      if (fire.beta) add(sums, fire.beta);
    } else if (s.type === 'beat') {
      const b = s.beat;
      if (b.kind === 'burner') notes.push({ text: `Burner: ${BURNER_DEFINITIONS[b.burnerId].name}`, tone: 'burner' });
      else if (b.kind === 'mod') notes.push({ text: `${b.side === 0 ? 'Your' : 'Their'} Mod: ${modName(b.mod, bridgeUpgraded?.[b.side])}`, tone: 'mod' });
      else if (b.kind === 'strain') notes.push({ text: `System strain: +${fmt(b.heat)} Heat (${b.turns} turns in a row)`, tone: 'strain' });
    }
  }
  if (ended) for (const row of rows) if (row.state === 'pending') row.state = 'skipped';
  return { side, start, endIndex: ended ? last : null, ended, rows, notes, tally: tallyLines(sums) };
}

/** The tally's order: the shared verbs, then the enemy-only ones. */
const TALLY_ORDER: Verb[] = ['credit', 'ward', 'suppress', 'empower', 'tempo', 'disrupt', 'charge', 'trace', 'wipe', 'strip', 'suspend'];
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
  if (effect.verb === 'enhance') return;
  const n = COUNTED.has(effect.verb) || !('amount' in effect) ? 1 : effect.amount;
  sums.set(effect.verb, (sums.get(effect.verb) ?? 0) + n);
}

function tallyLines(sums: Map<Verb, number>): string[] {
  return TALLY_ORDER.filter((v) => sums.has(v)).map((v) => {
    const n = sums.get(v)!;
    return COUNTED.has(v) ? `${VERB_NAME[v]} ×${n}` : `${VERB_NAME[v]} ${fmt(n)}`;
  });
}

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
      return `Empower ${fmt(e.amount)} (${e.scope === 'next' ? 'the next one' : 'every one below'})`;
    case 'tempo':
      return e.target === 'own' ? 'Tempo: your turns come sooner' : 'Tempo: their turns come later';
    case 'disrupt':
      return { revealHand: 'Disrupt: reveal their hand', revealCrib: 'Disrupt: reveal their crib cards', forceDiscard: 'Disrupt: force a card into the crib' }[e.action];
    case 'charge':
      return `Charge ${fmt(e.amount)} (${e.target === 'self' ? 'its own Hook' : e.target === 'next' ? 'the next Hook' : 'every other Hook'})`;
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
