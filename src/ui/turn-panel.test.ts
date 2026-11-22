import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CombatBeat } from '../engine/combat';
import type { FireEvent, GaugeReading } from '../engine/resolve';
import type { Effect, SubroutineDefinition } from '../engine/subroutine-types';
import { ALL_SUBROUTINES } from '../engine/subroutines';
import { LEAD_IN_MS, Replay } from './replay.svelte';
import { mergeSteps, stepDelay, TURN_END_MS, type Step } from './timeline';
import { shortEffect, turnPanel } from './turn-panel';

// The detailed turn display (session 82): turnEnd steps, the panel model,
// and the replay's jump for the panel's tap.

const reading = (): GaugeReading => ({ win: 0, winThreshold: 50, initiative: 0, initiativeThreshold: 12, ward: 0, heat: 0 });
const gauges = (): [GaugeReading, GaugeReading] => [reading(), reading()];
const credit = (amount: number): Effect => ({ verb: 'credit', amount });
const fireEvent = (side: 0 | 1, id: string, extra: Partial<FireEvent> = {}): FireEvent => ({
  subroutineId: id,
  side,
  alpha: credit(1),
  elevated: false,
  charges: 0,
  immediate: false,
  gauges: gauges(),
  ...extra,
});
const turn = (side: 0 | 1, firesBefore: number): CombatBeat => ({ kind: 'turn', side, firesBefore });
const hand = (firesBefore: number): CombatBeat => ({ kind: 'hand', handIndex: 1, dealer: 0, firesBefore });
const def = (id: string, name = id): SubroutineDefinition => ({ id, name }) as SubroutineDefinition;
const kinds = (steps: Step[]) => steps.map((s) => (s.type === 'beat' ? s.beat.kind : s.type));
/** A player turn: Alpha Credits 3, Beta Wards 2, then a new hand. */
const steps = mergeSteps([turn(0, 0), hand(2)], [fireEvent(0, 'a', { alpha: credit(3) }), fireEvent(0, 'b', { alpha: { verb: 'ward', amount: 2 } })], { turnEnds: true });

describe('mergeSteps with turnEnds', () => {
  it('closes a turn after its last fire, before the beat that ends it', () => {
    const log = [fireEvent(0, 'a'), fireEvent(0, 'b')];
    const timeline = [turn(0, 0), hand(2)];
    expect(kinds(mergeSteps(timeline, log, { turnEnds: true }))).toEqual(['turn', 'fire', 'fire', 'turnEnd', 'hand']);
    // Off by default: the quiet display's steps are unchanged.
    expect(kinds(mergeSteps(timeline, log))).toEqual(['turn', 'fire', 'fire', 'hand']);
  });

  it('keeps a Burner, a Mod and strain inside the turn; a second turn closes the first', () => {
    const timeline: CombatBeat[] = [
      turn(0, 0),
      { kind: 'burner', side: 0, burnerId: 'flash-drive' as never, gauges: gauges(), firesBefore: 0 },
      { kind: 'strain', heat: 1.5, turns: 4, firesBefore: 1 },
      turn(1, 1),
      hand(2),
    ];
    const log = [fireEvent(0, 'a'), fireEvent(1, 'x')];
    expect(kinds(mergeSteps(timeline, log, { turnEnds: true }))).toEqual(['turn', 'burner', 'fire', 'strain', 'turnEnd', 'turn', 'fire', 'turnEnd', 'hand']);
  });

  it('closes a turn at the end of the steps once it has fired, and keeps the index when the next beat comes', () => {
    const log = [fireEvent(0, 'a')];
    const before = mergeSteps([turn(0, 0)], log, { turnEnds: true });
    expect(kinds(before)).toEqual(['turn', 'fire', 'turnEnd']);
    const after = mergeSteps([turn(0, 0), hand(1)], log, { turnEnds: true });
    expect(kinds(after).slice(0, before.length)).toEqual(kinds(before));
  });

  it('leaves a turn open while it waits at the Burner offer, before any fire', () => {
    expect(kinds(mergeSteps([turn(0, 0)], [], { turnEnds: true }))).toEqual(['turn']);
  });
});

describe('turnPanel', () => {
  const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = [[def('a', 'Alpha'), def('b', 'Beta'), def('c', 'Gamma')], [def('x', 'Ex')]];

  it('is null outside a turn', () => {
    expect(turnPanel(steps, 0, loadouts)).toBeNull();
    expect(turnPanel(steps, steps.length, loadouts)).toBeNull();
  });

  it('lights each subroutine as it fires, and tallies the turn', () => {
    const p = turnPanel(steps, 2, loadouts)!;
    expect(p.side).toBe(0);
    expect(p.rows.map((r) => r.state)).toEqual(['firing', 'pending', 'pending']);
    expect(p.rows[0].process).toBe('Credit 3');
    expect(p.tally).toEqual(['Credit 3']);
    const q = turnPanel(steps, 3, loadouts)!;
    expect(q.rows.map((r) => r.state)).toEqual(['fired', 'firing', 'pending']);
    expect(q.tally).toEqual(['Credit 3', 'Ward 2']);
  });

  it('ends on the totals: a subroutine that never fired was skipped', () => {
    const p = turnPanel(steps, 4, loadouts)!;
    expect(p.ended).toBe(true);
    expect(p.endIndex).toBe(3);
    expect(p.rows.map((r) => r.state)).toEqual(['fired', 'fired', 'skipped']);
  });

  it('opens on the turn beat with every row pending (the Burner offer)', () => {
    const p = turnPanel(steps, 1, loadouts)!;
    expect(p.rows.every((r) => r.state === 'pending')).toBe(true);
    expect(p.tally).toEqual([]);
  });

  it('calls out a Hook with its effect and its rule, in the enemy voice for an enemy', () => {
    const piece = ALL_SUBROUTINES.find((d) => d.beta && d.beta.shape !== 'immediate' && d.beta.effect.verb === 'suppress')!;
    const hooked = mergeSteps([turn(1, 0)], [fireEvent(1, piece.id, { elevated: true, beta: { verb: 'suppress', amount: 1 } })], { turnEnds: true });
    const p = turnPanel(hooked, 2, [[], [piece]])!;
    expect(p.side).toBe(1);
    expect(p.rows[0].hook?.effect).toBe('Suppress 1');
    expect(p.rows[0].hook?.why.length).toBeGreaterThan(0);
    expect(p.tally).toEqual(['Credit 1', 'Suppress 1']);
  });

  it('shows Empower where it lands, flags a wasted one, and leaves Empower and Charge out of the tally', () => {
    const log = [
      fireEvent(0, 'a', { alpha: { verb: 'empower', amount: 2, scope: 'next' } }),
      fireEvent(0, 'b', { alpha: credit(3), empowered: 2 }),
      fireEvent(0, 'c', { alpha: { verb: 'charge', amount: 1, target: 'next' }, empowerWasted: 1 }),
    ];
    const s = mergeSteps([turn(0, 0), hand(3)], log, { turnEnds: true });
    const p = turnPanel(s, 4, loadouts)!;
    expect(p.rows.map((r) => r.process)).toEqual(['Empower 2 → next', 'Credit 3', 'Charge 1 → the next Hook']);
    expect(p.rows.map((r) => r.empower)).toEqual([null, { text: '+2 Empower', wasted: false }, { text: 'Empower 1 unused', wasted: true }]);
    expect(p.tally).toEqual(['Credit 3']);
  });

  it('gives a duplicate its own row per fire, and lists Instant Hooks and strain as notes', () => {
    const log = [fireEvent(0, 'a'), fireEvent(1, 'x', { immediate: true, beta: credit(2) }), fireEvent(0, 'a')];
    const timeline: CombatBeat[] = [turn(0, 0), { kind: 'strain', heat: 1.5, turns: 4, firesBefore: 3 }, hand(3)];
    const s = mergeSteps(timeline, log, { turnEnds: true });
    const p = turnPanel(s, 6, [[def('a', 'Alpha'), def('a', 'Alpha')], loadouts[1]])!;
    expect(p.rows.map((r) => r.state)).toEqual(['fired', 'fired']);
    expect(p.notes.map((n) => n.tone)).toEqual(['instant', 'strain']);
    expect(p.notes[0].text).toBe('Instant Hook · Ex: Credit 2');
    expect(p.notes[1].text).toBe('System strain: +1.5 Heat (4 turns in a row)');
  });
});

describe('shortEffect', () => {
  it('says what an effect did in a few words', () => {
    expect(shortEffect({ verb: 'empower', amount: 1, scope: 'rest' })).toBe('Empower 1 → all below');
    expect(shortEffect({ verb: 'charge', amount: 1, target: 'all' })).toBe('Charge 1 → every other Hook');
    expect(shortEffect({ verb: 'credit', amount: 2, feed: 1 })).toBe('Credit 2 (+1 to their Containment)');
    expect(shortEffect({ verb: 'enhance', amount: 1 })).toBe('Process boosted');
  });
});

describe('Replay in the detailed display', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds fires twice as long, and a turnEnd for its totals', () => {
    const fireStep: Step = { type: 'fire', fire: fireEvent(0, 'a') };
    expect(stepDelay(fireStep, true)).toBe(2 * stepDelay(fireStep));
    expect(stepDelay({ type: 'turnEnd' })).toBe(TURN_END_MS);
  });

  it('jumps to a turn\'s totals, then lets them go', () => {
    const replay = new Replay(undefined, 'slow', true);
    expect(replay.detailed).toBe(true);
    replay.sync(steps, gauges());
    vi.advanceTimersByTime(LEAD_IN_MS);
    expect(replay.shown).toBe(1);
    // The tap: to the turnEnd (index 3), so 4 steps are on screen.
    replay.jumpTo(4);
    expect(replay.shown).toBe(4);
    expect(replay.current?.type).toBe('turnEnd');
    // It holds the totals for their own beat, then plays on.
    vi.advanceTimersByTime(TURN_END_MS - 1);
    expect(replay.shown).toBe(4);
    vi.advanceTimersByTime(1);
    expect(replay.shown).toBe(5);
  });

  it('a second tap at the very end closes the panel at once', () => {
    const replay = new Replay(undefined, 'slow', true);
    const ending = steps.slice(0, 4);
    replay.sync(ending, gauges());
    replay.jumpTo(4);
    expect(replay.holding).toBe(true);
    replay.jumpTo(5);
    expect(replay.holding).toBe(false);
    expect(replay.playing).toBe(false);
  });

  it('never goes back', () => {
    const replay = new Replay(undefined, 'slow', true);
    replay.sync(steps, gauges());
    replay.jumpTo(3);
    replay.jumpTo(1);
    expect(replay.shown).toBe(3);
  });
});
