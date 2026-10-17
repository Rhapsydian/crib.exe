import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FireEvent, GaugeReading } from '../engine/resolve';
import { Replay } from './replay.svelte';

const reading = (win: number): GaugeReading => ({ win, winThreshold: 50, initiative: 0, initiativeThreshold: 12, ward: 0, trace: 0 });
const pair = (a: number, b: number): [GaugeReading, GaugeReading] => [reading(a), reading(b)];
const fire = (side: 0 | 1, id: string, a: number, b: number): FireEvent => ({
  subroutineId: id,
  side,
  alpha: { verb: 'credit', amount: 1 } as FireEvent['alpha'],
  elevated: false,
  charges: 0,
  immediate: false,
  gauges: pair(a, b),
});

describe('Replay (turn step-through)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('steps through a new batch one fire at a time, then holds the last', () => {
    const replay = new Replay();
    replay.sync([], pair(0, 0));
    expect(replay.playing).toBe(false);

    const log = [fire(0, 'a', 1, 0), fire(0, 'b', 3, 0)];
    replay.sync(log, pair(3, 0));
    // Before the first fire: the gauges as they stood at the last pause.
    expect(replay.playing).toBe(true);
    expect(replay.firing).toBeNull();
    expect(replay.gauges).toEqual(pair(0, 0));

    vi.advanceTimersByTime(330);
    expect(replay.firing?.subroutineId).toBe('a');
    expect(replay.gauges).toEqual(pair(1, 0));

    vi.advanceTimersByTime(330);
    expect(replay.firing?.subroutineId).toBe('b');
    expect(replay.playing).toBe(true);

    vi.advanceTimersByTime(330);
    expect(replay.playing).toBe(false);
    expect(replay.gauges).toBeNull();
  });

  it('enemy fires step faster than the player’s', () => {
    const replay = new Replay();
    replay.sync([], pair(0, 0));
    replay.sync([fire(1, 'x', 0, 2), fire(1, 'y', 0, 4)], pair(0, 4));
    vi.advanceTimersByTime(200);
    expect(replay.firing?.subroutineId).toBe('x');
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
    vi.advanceTimersByTime(330);
    replay.sync([...first, fire(1, 'x', 2, 1)], pair(2, 1));
    expect(replay.shown).toBe(2);
    expect(replay.gauges).toEqual(pair(2, 0));
    vi.advanceTimersByTime(200);
    expect(replay.firing?.subroutineId).toBe('x');
  });

  it('a shorter log (a new fight) starts over', () => {
    const replay = new Replay();
    replay.sync([fire(0, 'a', 1, 0)], pair(1, 0));
    replay.skip();
    replay.sync([], pair(0, 0));
    expect(replay.shown).toBe(0);
    expect(replay.playing).toBe(false);
  });
});
