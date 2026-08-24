import { describe, it, expect } from 'vitest';
import type { Card } from './cards';
import { cardsEqual } from './cards';
import { playPegging, type PlayStrategy, type PegPlayEvent } from './pegging';

/** Test-only helper: plays cards in a fixed, explicit overall order,
 * picking whichever queued card is currently legal. Gives full control
 * over exactly which play triggers which scoring category, instead of
 * fighting the "lowest legal value" default strategy's greediness. */
function scripted(order: Card[]): PlayStrategy {
  const remaining = order.slice();
  return (legal) => {
    const idx = remaining.findIndex((c) => legal.some((l) => cardsEqual(l, c)));
    const [card] = remaining.splice(idx, 1);
    return card;
  };
}

function plays(events: ReturnType<typeof playPegging>['events']): PegPlayEvent[] {
  return events.filter((e): e is PegPlayEvent => e.type === 'play');
}

describe('playPegging — 15', () => {
  it('scores 2 when a play brings the count to exactly 15', () => {
    const hand0: Card[] = [{ rank: 7, suit: 0 }];
    const hand1: Card[] = [{ rank: 8, suit: 0 }];
    const { events } = playPegging(hand0, hand1, 0, scripted([...hand0, ...hand1]));
    expect(plays(events)[1].score).toBe(2);
    expect(plays(events)[1].count).toBe(15);
    expect(plays(events)[1].breakdown).toEqual({ fifteen: 2, pair: 0, run: 0, thirtyOne: 0, total: 2 });
  });
});

describe('playPegging — pairs', () => {
  it('scores 2 for a pair', () => {
    const hand0: Card[] = [{ rank: 5, suit: 0 }, { rank: 9, suit: 0 }];
    const hand1: Card[] = [{ rank: 5, suit: 1 }, { rank: 3, suit: 0 }];
    const order = [hand0[0], hand1[0], hand0[1], hand1[1]];
    const { events } = playPegging(hand0, hand1, 0, scripted(order));
    expect(plays(events)[1].score).toBe(2);
    expect(plays(events)[1].breakdown).toEqual({ fifteen: 0, pair: 2, run: 0, thirtyOne: 0, total: 2 });
  });

  it('scores 6 for pairs royal (three of a kind)', () => {
    const hand0: Card[] = [{ rank: 5, suit: 0 }, { rank: 5, suit: 1 }];
    const hand1: Card[] = [{ rank: 5, suit: 2 }, { rank: 9, suit: 0 }];
    // 5 + 5 + 5 = 15, so this play scores 15 (2) *and* pairs royal (6) = 8.
    const order = [hand0[0], hand1[0], hand0[1], hand1[1]];
    const { events } = playPegging(hand0, hand1, 0, scripted(order));
    expect(plays(events)[2].score).toBe(8);
    expect(plays(events)[2].count).toBe(15);
    expect(plays(events)[2].breakdown).toEqual({ fifteen: 2, pair: 6, run: 0, thirtyOne: 0, total: 8 });
  });

  it('scores 12 for double pairs royal (four of a kind)', () => {
    const hand0: Card[] = [{ rank: 2, suit: 0 }, { rank: 2, suit: 1 }];
    const hand1: Card[] = [{ rank: 2, suit: 2 }, { rank: 2, suit: 3 }];
    const order = [hand0[0], hand1[0], hand0[1], hand1[1]];
    const { events } = playPegging(hand0, hand1, 0, scripted(order));
    expect(plays(events)[3].score).toBe(12);
    expect(plays(events)[3].breakdown).toEqual({ fifteen: 0, pair: 12, run: 0, thirtyOne: 0, total: 12 });
  });
});

describe('playPegging — runs', () => {
  it('scores a run of 3 even when played out of numeric order', () => {
    const hand0: Card[] = [{ rank: 5, suit: 0 }, { rank: 4, suit: 0 }];
    const hand1: Card[] = [{ rank: 3, suit: 0 }];
    const order = [hand0[0], hand1[0], hand0[1]]; // played as 5, 3, 4
    const { events } = playPegging(hand0, hand1, 0, scripted(order));
    expect(plays(events)[2].score).toBe(3);
    expect(plays(events)[2].breakdown).toEqual({ fifteen: 0, pair: 0, run: 3, thirtyOne: 0, total: 3 });
  });
});

describe('playPegging — exact 31', () => {
  it('scores 2 for hitting exactly 31, with no separate last-card point', () => {
    const hand0: Card[] = [{ rank: 10, suit: 0 }, { rank: 10, suit: 1 }];
    const hand1: Card[] = [{ rank: 9, suit: 0 }, { rank: 2, suit: 0 }];
    const order = [hand0[0], hand1[0], hand0[1], hand1[1]]; // 10, 9, 10, 2 = 31
    const { events } = playPegging(hand0, hand1, 0, scripted(order));
    const finalPlay = plays(events)[3];
    expect(finalPlay.count).toBe(31);
    expect(finalPlay.score).toBe(2);
    expect(finalPlay.breakdown).toEqual({ fifteen: 0, pair: 0, run: 0, thirtyOne: 2, total: 2 });
    expect(events.some((e) => e.type === 'go-point')).toBe(false);
  });
});

describe('playPegging — go / last card', () => {
  it('awards 1 point to the last player who played when both sides are stuck below 31', () => {
    const hand0: Card[] = [{ rank: 10, suit: 0 }, { rank: 10, suit: 1 }];
    const hand1: Card[] = [{ rank: 2, suit: 0 }, { rank: 10, suit: 2 }];
    // p0:10 (10), p1:2 (12), p0:10 (22) -> p1's remaining 10 is now illegal
    // (22+10=32>31): p1 goes, p0 (already empty) also goes -> go-point to
    // p0. Count resets; p1 plays its last 10 for free, then the natural
    // end-of-pegging last-card point goes to p1.
    const order = [hand0[0], hand1[0], hand0[1], hand1[1]];
    const { scores, events } = playPegging(hand0, hand1, 0, scripted(order));
    expect(events.filter((e) => e.type === 'go-point')).toHaveLength(2);
    expect(scores).toEqual([1, 1]);
  });

  it('never scores both the 31 bonus and a go/last-card point for the same play', () => {
    const hand0: Card[] = [{ rank: 10, suit: 0 }, { rank: 10, suit: 1 }];
    const hand1: Card[] = [{ rank: 9, suit: 0 }, { rank: 2, suit: 0 }];
    const order = [hand0[0], hand1[0], hand0[1], hand1[1]];
    const { events } = playPegging(hand0, hand1, 0, scripted(order));
    expect(events.some((e) => e.type === 'go-point')).toBe(false);
  });
});

describe('playPegging — general', () => {
  it('plays out every card from both hands', () => {
    const hand0: Card[] = [{ rank: 4, suit: 0 }, { rank: 6, suit: 0 }];
    const hand1: Card[] = [{ rank: 1, suit: 0 }, { rank: 2, suit: 0 }];
    const { events } = playPegging(hand0, hand1, 0);
    expect(plays(events)).toHaveLength(4);
  });
});
