import type { Card } from '../engine/cards';
import type { CombatBeat } from '../engine/combat';
import type { PlayerIndex } from '../engine/game';
import type { FireEvent, GaugeReading } from '../engine/resolve';
import type { ScoringOccurrence } from '../engine/triggers';
import { rankLabel, suitInfo } from './suits';
import { describeFire } from './describe';

/**
 * One thing the screen animates, in fight order: a table beat (a hand
 * starting, the cut, a pegging event, points landing) or a fire. The
 * engine keeps the two in separate records (`timeline`, `log`); each
 * beat's `firesBefore` says where the fires go between them.
 */
export type Step = { type: 'beat'; beat: CombatBeat } | { type: 'fire'; fire: FireEvent };

export function mergeSteps(timeline: readonly CombatBeat[], log: readonly FireEvent[]): Step[] {
  const steps: Step[] = [];
  let fires = 0;
  for (const beat of timeline) {
    while (fires < beat.firesBefore) steps.push({ type: 'fire', fire: log[fires++] });
    steps.push({ type: 'beat', beat });
  }
  while (fires < log.length) steps.push({ type: 'fire', fire: log[fires++] });
  return steps;
}

/** The meters a step leaves behind, if it records them. */
export function stepGauges(step: Step): [GaugeReading, GaugeReading] | null {
  if (step.type === 'fire') return step.fire.gauges;
  return step.beat.kind === 'points' ? step.beat.gauges : null;
}

/** Who a step belongs to, for pacing and colour. */
export function stepSide(step: Step): PlayerIndex | null {
  if (step.type === 'fire') return step.fire.side;
  const b = step.beat;
  if (b.kind === 'peg') return b.event.player;
  if (b.kind === 'points') return b.occurrence.player;
  return null;
}

/** Milliseconds a step holds the screen at normal speed. Your own card is
 * quick (you just chose it); the enemy's gets time to be seen; points
 * give the callout time to read. */
export function stepDelay(step: Step): number {
  if (step.type === 'fire') return step.fire.side === 0 ? 330 : 200;
  const b = step.beat;
  switch (b.kind) {
    case 'hand':
      return 700;
    case 'cut':
      return 550;
    case 'peg':
      return b.event.type === 'play' ? (b.event.player === 0 ? 300 : 500) : 350;
    case 'points':
      return 600;
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
  count: number;
  cardsLeft: [number, number];
}

export function tableAt(steps: readonly Step[], upto: number): TableState {
  const table: TableState = { handIndex: -1, dealer: 0, pile: [], count: 0, cardsLeft: [6, 6] };
  // Start from the latest hand beat at or before `upto`.
  let start = 0;
  for (let i = Math.min(upto, steps.length) - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.type === 'beat' && s.beat.kind === 'hand') {
      start = i;
      break;
    }
  }
  // After 31 or the go point the pile stays up until the next card.
  let resetPending = false;
  for (let i = start; i < Math.min(upto, steps.length); i++) {
    const s = steps[i];
    if (s.type !== 'beat') continue;
    const b = s.beat;
    if (b.kind === 'hand') {
      table.handIndex = b.handIndex;
      table.dealer = b.dealer;
      table.cardsLeft = [6, 6];
    } else if (b.kind === 'cut') {
      table.starter = b.starter;
      table.cardsLeft = [4, 4];
    } else if (b.kind === 'peg') {
      const e = b.event;
      if (e.type === 'play') {
        if (resetPending) {
          table.pile = [];
          resetPending = false;
        }
        table.pile = [...table.pile, { card: e.card, player: e.player, key: i }];
        table.count = e.count;
        table.cardsLeft[e.player]--;
        if (e.count === 31) resetPending = true;
      } else if (e.type === 'go-point') {
        resetPending = true;
      }
    }
  }
  return table;
}

export function cardLabel(card: Card): string {
  return `${rankLabel(card.rank)} ${suitInfo(card.suit).name}`;
}

/** "fifteen for 2", "pair royal for 6", "his heels for 2". At the show
 * a run's points can cover several runs at once, so it isn't named by
 * length there. */
export function scoreLabel(o: ScoringOccurrence, phase: 'cut' | 'peg' | 'show' = 'peg'): string {
  const m = o.magnitude;
  switch (o.category) {
    case 'fifteen':
      return `fifteen for ${m}`;
    case 'pair':
      return `${m >= 12 ? 'double pair royal' : m >= 6 ? 'pair royal' : 'pair'} for ${m}`;
    case 'run':
      return phase === 'show' ? `runs for ${m}` : `run of ${m} for ${m}`;
    case 'flush':
      return `flush for ${m}`;
    case 'hisNobs':
      return `his nobs for ${m}`;
    case 'hisHeels':
      return `his heels for ${m}`;
    case 'thirtyOne':
      return `31 for ${m}`;
    case 'go':
      return `go for ${m}`;
  }
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
  }
}

/** A step as a log line: its text, whose it is (colour), and whether it
 * is a fire (fire lines open the piece's detail when tapped). */
export interface StepLine {
  text: string;
  side: PlayerIndex | null;
  fire: FireEvent | null;
  /** Scoring and table lines read quieter than fires. */
  kind: 'fire' | 'points' | 'table';
}

export function stepLine(step: Step, names: ReadonlyMap<string, string>): StepLine {
  if (step.type === 'fire') {
    const f = step.fire;
    return { text: describeFire(f, names.get(f.subroutineId) ?? f.subroutineId), side: f.side, fire: f, kind: 'fire' };
  }
  const b = step.beat;
  return { text: describeBeat(b), side: stepSide(step), fire: null, kind: b.kind === 'points' ? 'points' : 'table' };
}
