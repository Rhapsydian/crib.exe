import type { Card } from '../engine/cards';
import { DAILY_MODS, type DailyModId } from '../engine/daily';
import type { CombatBeat } from '../engine/combat';
import type { PlayerIndex } from '../engine/game';
import type { FireEvent, GaugeReading } from '../engine/resolve';
import { occurrencePoints, type ScoringOccurrence } from '../engine/triggers';
import { rankLabel } from './suits';
import { suitToken } from './RichText.svelte';
import { describeFire } from './describe';
import { BURNER_DEFINITIONS } from '../engine/burners';
import type { ModTrigger } from '../engine/resolve';
import { modName, triggerLabel } from './kit';

/**
 * One thing the screen animates, in fight order: a table beat (a hand
 * starting, the cut, a pegging event, points landing) or a fire. The
 * engine keeps the two in separate records (`timeline`, `log`); each
 * beat's `firesBefore` says where the fires go between them.
 *
 * A `clear` step is the UI's own: after a go point or a 31 the pile
 * resets, and the played cards sweep off (the user's ask) once that
 * play's scoring and any turns it bought are done, just before the next
 * table beat.
 */
export type Step = { type: 'beat'; beat: CombatBeat } | { type: 'fire'; fire: FireEvent } | { type: 'clear' };

export function mergeSteps(timeline: readonly CombatBeat[], log: readonly FireEvent[]): Step[] {
  const steps: Step[] = [];
  let fires = 0;
  let resetPending = false;
  for (const beat of timeline) {
    while (fires < beat.firesBefore) steps.push({ type: 'fire', fire: log[fires++] });
    // The reset play's own points stay on the full pile; anything else
    // (the next card, the show, a new hand) comes after the sweep.
    if (resetPending && !(beat.kind === 'points' && beat.phase === 'peg')) {
      steps.push({ type: 'clear' });
      resetPending = false;
    }
    steps.push({ type: 'beat', beat });
    if (beat.kind === 'peg' && (beat.event.type === 'go-point' || (beat.event.type === 'play' && beat.event.breakdown.thirtyOne > 0))) resetPending = true;
  }
  while (fires < log.length) steps.push({ type: 'fire', fire: log[fires++] });
  // A reset at the end of what has happened so far (the enemy took the
  // go, now it's your card): sweep now rather than when your card comes.
  // The engine paused right after it, so the next beat brings no fires
  // before it and the clear stays at this same index once it arrives.
  if (resetPending) steps.push({ type: 'clear' });
  return steps;
}

/** The meters a step leaves behind, if it records them. */
export function stepGauges(step: Step): [GaugeReading, GaugeReading] | null {
  if (step.type === 'clear') return null;
  if (step.type === 'fire') return step.fire.gauges;
  return step.beat.kind === 'points' || step.beat.kind === 'burner' ? step.beat.gauges : null;
}

/** Who a step belongs to, for pacing and colour. */
export function stepSide(step: Step): PlayerIndex | null {
  if (step.type === 'clear') return null;
  if (step.type === 'fire') return step.fire.side;
  const b = step.beat;
  if (b.kind === 'peg') return b.event.player;
  if (b.kind === 'points') return b.occurrence.player;
  if (b.kind === 'show') return b.player;
  if (b.kind === 'burner') return b.side;
  if (b.kind === 'mod') return b.side;
  if (b.kind === 'turn') return b.side;
  if (b.kind === 'strain') return 0;
  return null;
}

/** The Mods acting at a step: a Mod beat's own, or a fire's. */
export function stepMods(step: Step | null): ModTrigger[] {
  if (!step || step.type === 'clear') return [];
  if (step.type === 'fire') return step.fire.mods ?? [];
  return step.beat.kind === 'mod' ? [{ side: step.beat.side, mod: step.beat.mod }] : [];
}

/** The daily Mod acting at a step (session 72: its panel entry flashes). */
export function stepDaily(step: Step | null): string | null {
  return step?.type === 'beat' && step.beat.kind === 'daily' ? step.beat.id : null;
}

/** Milliseconds a step holds the screen at normal speed. Your own card is
 * quick (you just chose it); the enemy's gets time to be seen; points
 * give the callout time to read. */
export function stepDelay(step: Step): number {
  if (step.type === 'clear') return 450;
  if (step.type === 'fire') return step.fire.side === 0 ? 330 : 200;
  const b = step.beat;
  switch (b.kind) {
    case 'hand':
      return 1100;
    case 'cut':
      return 550;
    case 'peg':
      return b.event.type === 'play' ? (b.event.player === 0 ? 300 : 500) : 350;
    case 'points':
      return b.phase === 'show' ? 700 : 600;
    case 'show':
      return b.total === 0 ? 1000 : 750;
    case 'burner':
      return 800;
    case 'mod':
    case 'daily':
      return 550;
    case 'turn':
      return 500;
    case 'strain':
      return 900;
  }
}

/** A pile card, keyed by the step that played it (so new ones animate). */
export interface PileCard {
  card: Card;
  player: PlayerIndex;
  key: number;
}

/** The table as it stands after `upto` steps: the hand, its dealer and
 * starter, the pegging pile since the last reset, the count, and how
 * many cards each side still holds. */
export interface TableState {
  handIndex: number;
  dealer: PlayerIndex;
  starter?: Card;
  pile: PileCard[];
  /** The cards sweeping off, while the latest step is a `clear`. */
  leaving: PileCard[];
  /** The hand being counted at the show, once its show beat is up. */
  show?: ShowState;
  count: number;
  cardsLeft: [number, number];
}

export interface ShowState {
  owner: 'hand' | 'crib';
  player: PlayerIndex;
  cards: Card[];
  starter: Card;
  /** Points counted so far, and the full count. */
  scored: number;
  total: number;
  /** Each score so far, as announced: "fifteen 2", "pair 4". */
  announced: string[];
  /** The cards of the score on screen right now. */
  lit: Card[] | null;
}

export function tableAt(steps: readonly Step[], upto: number): TableState {
  const table: TableState = { handIndex: -1, dealer: 0, pile: [], leaving: [], count: 0, cardsLeft: [6, 6] };
  // Start from the latest hand beat at or before `upto`.
  let start = 0;
  for (let i = Math.min(upto, steps.length) - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.type === 'beat' && s.beat.kind === 'hand') {
      start = i;
      break;
    }
  }
  const end = Math.min(upto, steps.length);
  for (let i = start; i < end; i++) {
    const s = steps[i];
    if (s.type === 'clear') {
      table.leaving = i === end - 1 ? table.pile : [];
      table.pile = [];
      table.count = 0;
      continue;
    }
    if (s.type !== 'beat') continue;
    const b = s.beat;
    if (b.kind === 'hand') {
      table.show = undefined;
      table.handIndex = b.handIndex;
      table.dealer = b.dealer;
      table.cardsLeft = [6, 6];
    } else if (b.kind === 'cut') {
      table.starter = b.starter;
      table.cardsLeft = [4, 4];
    } else if (b.kind === 'show') {
      table.show = { owner: b.owner, player: b.player, cards: b.cards, starter: b.starter, scored: 0, total: b.total, announced: [], lit: null };
    } else if (b.kind === 'points' && b.phase === 'show' && table.show) {
      const scored = table.show.scored + occurrencePoints(b.occurrence);
      table.show = {
        ...table.show,
        scored,
        announced: [...table.show.announced, `${showWord(b.occurrence)} ${scored}`],
        lit: i === end - 1 ? (b.cards ?? null) : null,
      };
    } else if (b.kind === 'peg' && b.event.type === 'play') {
      const e = b.event;
      table.pile = [...table.pile, { card: e.card, player: e.player, key: i }];
      table.count = e.count;
      table.cardsLeft[e.player]--;
    }
  }
  return table;
}

/** A card in a log line: its rank, then its suit as a token that renders
 * as the suit icon and name (RichText; the user's ask). */
export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)} ${suitToken(card.suit)}`;
}

/** "fifteen for 2", "pair royal for 6", "his heels for 2". At the show
 * a run's points can cover several runs at once, so it isn't named by
 * length there. */
export function scoreLabel(o: ScoringOccurrence, phase: 'cut' | 'peg' | 'show' = 'peg'): string {
  const m = o.magnitude;
  switch (o.category) {
    case 'fifteen':
      return `fifteen for ${occurrencePoints(o)}`;
    case 'pair':
      return `${m >= 12 ? 'double pair royal' : m >= 6 ? 'pair royal' : 'pair'} for ${occurrencePoints(o)}`;
    case 'run':
      return phase === 'show' ? `${showRunName(m)} for ${occurrencePoints(o)}` : `run of ${m} for ${occurrencePoints(o)}`;
    case 'flush':
      return `flush for ${m}`;
    case 'hisNobs':
      return `his nobs for ${occurrencePoints(o)}`;
    case 'hisHeels':
      return `his heels for ${occurrencePoints(o)}`;
    case 'thirtyOne':
      return `${o.count ?? 31} for ${m}`;
    case 'go':
      return `go for ${m}`;
  }
}

/** How a score is announced at the show, before the running total:
 * "fifteen 2, fifteen 4, pair 6, run of three 9". */
function showWord(o: ScoringOccurrence): string {
  switch (o.category) {
    case 'fifteen':
      return 'fifteen';
    case 'pair':
      return o.magnitude >= 12 ? 'double pair royal' : o.magnitude >= 6 ? 'pair royal' : 'pair';
    case 'run':
      return showRunName(o.magnitude);
    case 'flush':
      return 'flush';
    case 'hisNobs':
      return 'nobs';
    default:
      return o.category;
  }
}

/** A show run named by its points: in five cards, 3-5 is a single run
 * of that length; more means duplicated ranks (6 a double run of 3, 8 a
 * double run of 4, 9 a triple run, 12 a double double run). */
function showRunName(points: number): string {
  if (points <= 5) return `run of ${points}`;
  return { 6: 'double run', 8: 'double run of 4', 9: 'triple run', 12: 'double double run' }[points] ?? 'runs';
}

/** "your hand", "their crib". */
export function showTitle(owner: 'hand' | 'crib', player: PlayerIndex): string {
  return `${player === 0 ? 'your' : 'their'} ${owner}`;
}

/** A Burner's name and what it does. */
export function burnerLabel(id: keyof typeof BURNER_DEFINITIONS): string {
  const def = BURNER_DEFINITIONS[id];
  return def.combat ? `${def.name}: ${def.text}` : def.name;
}

/** A beat's log line (fires are described by describeFire). */
export function describeBeat(beat: CombatBeat): string {
  const who = (p: PlayerIndex) => (p === 0 ? 'you' : 'they');
  switch (beat.kind) {
    case 'hand':
      return `// hand ${beat.handIndex + 1} · ${beat.dealer === 0 ? 'you deal' : 'they deal'}`;
    case 'cut':
      return `// cut: ${cardLabel(beat.starter)}`;
    case 'peg': {
      const e = beat.event;
      if (e.type === 'play') return `${who(e.player)} play ${cardLabel(e.card)} · count ${e.count}`;
      if (e.type === 'go') return `${who(e.player)} say go`;
      return `${who(e.player)} take the go`;
    }
    case 'points':
      return `${beat.phase === 'show' ? 'show: ' : ''}${scoreLabel(beat.occurrence, beat.phase)}`;
    case 'show':
      return `// show: ${showTitle(beat.owner, beat.player)} · ${beat.cards.map(cardLabel).join(', ')} + ${cardLabel(beat.starter)} · ${beat.total === 0 ? 'no score' : `${beat.total} points`}`;
    case 'burner':
      return `${beat.side === 0 ? 'you burn' : 'they burn'} ${burnerLabel(beat.burnerId)}`;
    case 'mod':
      return `◆ ${triggerLabel(beat)}`;
    case 'daily':
      return `◇ daily: ${DAILY_MODS[beat.id as DailyModId]?.name ?? beat.id}`;
    case 'turn':
      return `▶ ${beat.side === 0 ? 'your' : 'their'} turn`;
    case 'strain':
      return `⚠ System strain: +${fmtHeat(beat.heat)} Heat (${beat.turns} turns in a row)`;
  }
}

const fmtHeat = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Points one side scored over a fight, by where they came from -- the
 * points that filled its initiative gauge. Counted from the timeline's
 * scoring beats, so a hand cut short by the fight's end still counts. */
export interface PointsSummary {
  pegging: number;
  hands: number;
  crib: number;
  heels: number;
  total: number;
}

export function pointsSummary(timeline: readonly CombatBeat[]): [PointsSummary, PointsSummary] {
  const blank = (): PointsSummary => ({ pegging: 0, hands: 0, crib: 0, heels: 0, total: 0 });
  const sums: [PointsSummary, PointsSummary] = [blank(), blank()];
  let showing: 'hand' | 'crib' = 'hand';
  for (const b of timeline) {
    if (b.kind === 'show') showing = b.owner;
    if (b.kind !== 'points') continue;
    const s = sums[b.occurrence.player];
    const m = occurrencePoints(b.occurrence);
    if (b.phase === 'cut') s.heels += m;
    else if (b.phase === 'peg') s.pegging += m;
    else if (showing === 'crib') s.crib += m;
    else s.hands += m;
    s.total += m;
  }
  return sums;
}

/** A step as a log line: its text, whose it is (colour), and whether it
 * is a fire (fire lines open the piece's detail when tapped). */
export interface StepLine {
  text: string;
  side: PlayerIndex | null;
  fire: FireEvent | null;
  /** Scoring and table lines read quieter than fires; Mod lines stand
   * out in the Mod colour. */
  kind: 'fire' | 'points' | 'table' | 'mod';
}

export function stepLine(step: Step, names: ReadonlyMap<string, string>): StepLine | null {
  if (step.type === 'clear') return null;
  if (step.type === 'fire') {
    const f = step.fire;
    const mods = f.mods?.length ? ` · ◆ ${[...new Set(f.mods.map((m) => modName(m.mod)))].join(', ')}` : '';
    return { text: describeFire(f, names.get(f.subroutineId) ?? f.subroutineId) + mods, side: f.side, fire: f, kind: 'fire' };
  }
  const b = step.beat;
  // Section lines (a hand, the cut, a show) have no owner prefix.
  const side = b.kind === 'show' ? null : stepSide(step);
  return { text: describeBeat(b), side, fire: null, kind: b.kind === 'points' ? 'points' : b.kind === 'mod' ? 'mod' : 'table' };
}
