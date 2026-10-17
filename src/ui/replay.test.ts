import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CombatBeat } from '../engine/combat';
import type { Card } from '../engine/cards';
import type { FireEvent, GaugeReading } from '../engine/resolve';
import { LEAD_IN_MS, Replay } from './replay.svelte';
import { mergeSteps, tableAt, type Step } from './timeline';

const reading = (win: number): GaugeReading => ({ win, winThreshold: 50, initiative: 0, initiativeThreshold: 12, ward: 0, trace: 0 });
const pair = (a: number, b: number): [GaugeReading, GaugeReading] => [reading(a), reading(b)];
const fireEvent = (side: 0 | 1, id: string, a: number, b: number): FireEvent => ({
  subroutineId: id,
  side,
  alpha: { verb: 'credit', amount: 1 } as FireEvent['alpha'],
  elevated: false,
  charges: 0,
  immediate: false,
  gauges: pair(a, b),
});
const fire = (side: 0 | 1, id: string, a: number, b: number): Step => ({ type: 'fire', fire: fireEvent(side, id, a, b) });
const card = (rank: number, suit: Card['suit'] = 0): Card => ({ rank, suit }) as Card;
const play = (player: 0 | 1, c: Card, count: number, firesBefore = 0): CombatBeat => ({
  kind: 'peg',
  event: { type: 'play', player, card: c, count, score: 0, breakdown: { fifteen: 0, pair: 0, run: 0, thirtyOne: 0, total: 0 } },
  firesBefore,
});
const firedId = (s: Step | null) => (s?.type === 'fire' ? s.fire.subroutineId : null);

describe('Replay (step-through)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays a new batch a step at a time; each step holds its own beat', () => {
    const replay = new Replay();
    replay.sync([], pair(0, 0));
    expect(replay.playing).toBe(false);

    replay.sync([fire(0, 'a', 1, 0), fire(0, 'b', 3, 0)], pair(3, 0));
    // Before the first step: the gauges as they stood at the last pause.
    expect(replay.playing).toBe(true);
    expect(replay.current).toBeNull();
    expect(replay.gauges).toEqual(pair(0, 0));

    vi.advanceTimersByTime(LEAD_IN_MS);
    expect(firedId(replay.current)).toBe('a');
    expect(replay.firing?.subroutineId).toBe('a');
    expect(replay.gauges).toEqual(pair(1, 0));

    vi.advanceTimersByTime(330);
    expect(firedId(replay.current)).toBe('b');
    vi.advanceTimersByTime(329);
    expect(replay.playing).toBe(true);
    vi.advanceTimersByTime(1);
    expect(replay.playing).toBe(false);
    expect(replay.gauges).toBeNull();
  });

  it('enemy fires hold a shorter beat than yours', () => {
    const replay = new Replay();
    replay.sync([], pair(0, 0));
    replay.sync([fire(1, 'x', 0, 2), fire(1, 'y', 0, 4)], pair(0, 4));
    vi.advanceTimersByTime(LEAD_IN_MS + 200);
    expect(firedId(replay.current)).toBe('y');
  });

  it('skip jumps to the end', () => {
    const replay = new Replay();
    replay.sync([], pair(0, 0));
    replay.sync([fire(0, 'a', 1, 0), fire(0, 'b', 2, 0)], pair(2, 0));
    replay.skip();
    expect(replay.playing).toBe(false);
    expect(replay.shown).toBe(2);
  });

  it('a new pause finishes the old batch and starts the new one', () => {
    const replay = new Replay();
    replay.sync([], pair(0, 0));
    const first = [fire(0, 'a', 1, 0), fire(0, 'b', 2, 0)];
    replay.sync(first, pair(2, 0));
    vi.advanceTimersByTime(LEAD_IN_MS);
    replay.sync([...first, fire(1, 'x', 2, 1)], pair(2, 1));
    expect(replay.shown).toBe(2);
    expect(replay.gauges).toEqual(pair(2, 0));
    vi.advanceTimersByTime(LEAD_IN_MS);
    expect(firedId(replay.current)).toBe('x');
  });

  it('a shorter history (a new fight) starts over', () => {
    const replay = new Replay();
    replay.sync([fire(0, 'a', 1, 0)], pair(1, 0));
    replay.skip();
    replay.sync([], pair(0, 0));
    expect(replay.shown).toBe(0);
    expect(replay.playing).toBe(false);
  });
});

describe('timeline steps', () => {
  it('places each fire between the beats by firesBefore', () => {
    const log = [fireEvent(0, 'a', 1, 0), fireEvent(1, 'b', 1, 1)];
    const timeline: CombatBeat[] = [{ kind: 'hand', handIndex: 0, dealer: 0, firesBefore: 0 }, play(1, card(5), 5, 0), play(0, card(10), 15, 1)];
    const steps = mergeSteps(timeline, log);
    expect(steps.map((s) => (s.type === 'fire' ? s.fire.subroutineId : s.type === 'beat' ? s.beat.kind : 'clear'))).toEqual(['hand', 'peg', 'a', 'peg', 'b']);
  });

  it('rebuilds the table, and sweeps the pile after a go point', () => {
    const goPoints = (player: 0 | 1, firesBefore = 0): CombatBeat => ({
      kind: 'points',
      phase: 'peg',
      occurrence: { category: 'go', player, magnitude: 1 },
      gauges: pair(0, 0),
      firesBefore,
    });
    const timeline: CombatBeat[] = [
      { kind: 'hand', handIndex: 2, dealer: 1, firesBefore: 0 },
      { kind: 'cut', starter: card(11), dealer: 1, firesBefore: 0 },
      play(0, card(10), 10),
      play(1, card(10), 20),
      play(0, card(9), 29),
      { kind: 'peg', event: { type: 'go-point', player: 0 }, firesBefore: 0 },
      goPoints(0),
      play(1, card(4), 4, 1),
    ];
    // One fire (bought by the go point) lands before the sweep.
    const steps = mergeSteps(timeline, [fireEvent(0, 'a', 1, 0)]);
    const kinds = steps.map((s) => (s.type === 'beat' ? s.beat.kind : s.type));
    expect(kinds).toEqual(['hand', 'cut', 'peg', 'peg', 'peg', 'peg', 'points', 'fire', 'clear', 'peg']);

    const mid = tableAt(steps, 8);
    expect(mid.handIndex).toBe(2);
    expect(mid.dealer).toBe(1);
    expect(mid.starter?.rank).toBe(11);
    expect(mid.pile.map((p) => p.card.rank)).toEqual([10, 10, 9]);
    expect(mid.count).toBe(29);
    expect(mid.cardsLeft).toEqual([2, 3]);

    const sweeping = tableAt(steps, 9);
    expect(sweeping.pile).toEqual([]);
    expect(sweeping.leaving.map((p) => p.card.rank)).toEqual([10, 10, 9]);
    expect(sweeping.count).toBe(0);

    const after = tableAt(steps, 10);
    expect(after.leaving).toEqual([]);
    expect(after.pile.map((p) => p.card.rank)).toEqual([4]);
    expect(after.count).toBe(4);
  });

  it('a 31 sweeps too, after its points', () => {
    const timeline: CombatBeat[] = [
      { kind: 'hand', handIndex: 0, dealer: 0, firesBefore: 0 },
      play(1, card(10), 31),
      { kind: 'points', phase: 'peg', occurrence: { category: 'thirtyOne', player: 1, magnitude: 2 }, gauges: pair(0, 0), firesBefore: 0 },
      play(0, card(5), 5),
    ];
    const kinds = mergeSteps(timeline, []).map((s) => (s.type === 'beat' ? s.beat.kind : s.type));
    expect(kinds).toEqual(['hand', 'peg', 'points', 'clear', 'peg']);
  });
});
