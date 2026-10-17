import { describe, it, expect } from 'vitest';
import type { Card } from './cards';
import { cardValue } from './cards';
import type { PlayerIndex } from './game';
import type { Alpha, Beta, SubroutineDefinition } from './subroutine-types';
import { playCombat, combatGenerator, escalationFloorFor, escalationShrinkPerHandFor, type CombatAnswer } from './combat';
import { CLASS_STARTING_LOADOUTS } from './subroutines';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from './encounters';
import { createRng } from './rng';
import { createDeck, shuffle } from './deck';
import { deal, discardToCrib, discardLowestTwo, cut, hisHeels, type DiscardStrategy } from './deal';
import { playPegging, playLowestLegal, type PlayStrategy } from './pegging';
import { countHandEvents, countCribEvents } from './scoring';
import { pegSkillStrategy, discardSkillStrategy } from './ai';

// Session 51: fixtures rebuilt for the alpha/beta model. Old-mechanic
// end-to-end tests (global-pulse DoT, scheduled sabotage, markSuit,
// Reactive, hand-lifecycle firesAt) retired with those mechanics; their
// replacements are immediate betas, suit-tally charges and next-hand
// Disrupt, below.

function piece(id: string, alpha: Alpha, beta?: Beta, extra: Partial<SubroutineDefinition> = {}): SubroutineDefinition {
  return { id, name: id, archetype: 'exploit', alpha, beta, ...extra };
}

const credit = (id: string, amount: number): SubroutineDefinition => piece(id, { verb: 'credit', amount });

describe('playCombat', () => {
  it("resolves in the player's favor when only the player has a piece", () => {
    const result = playCombat([[credit('a', 20)], []], { seed: 1, gaugeThreshold: [5, 5] });
    expect(result.winner).toBe(0);
    expect(result.hands.length).toBeGreaterThan(0);
    expect(result.log.length).toBeGreaterThan(0);
    expect(result.log.every((e) => e.side === 0)).toBe(true);
  });

  it("resolves in the enemy's favor when only the enemy has a piece", () => {
    const result = playCombat([[], [credit('b', 20)]], { seed: 1, gaugeThreshold: [5, 5] });
    expect(result.winner).toBe(1);
    expect(result.log.every((e) => e.side === 1)).toBe(true);
  });

  it('is fully deterministic for the same seed', () => {
    const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = [[credit('a', 3)], [credit('b', 2)]];
    expect(playCombat(loadouts, { seed: 42, gaugeThreshold: [8, 8] })).toEqual(playCombat(loadouts, { seed: 42, gaugeThreshold: [8, 8] }));
  });

  it('plays different hands for a different seed', () => {
    const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = [[credit('a', 3)], [credit('b', 3)]];
    expect(playCombat(loadouts, { seed: 1, gaugeThreshold: [6, 6] }).hands).not.toEqual(playCombat(loadouts, { seed: 2, gaugeThreshold: [6, 6] }).hands);
  });

  it('resolves via the hard-resolution deadline rather than looping forever when neither side can act', () => {
    const result = playCombat([[], []], { seed: 1, gaugeThreshold: [5, 5] });
    expect(result.winner).toBe(1);
    expect(result.resolvedBy).toBe('attrition');
    expect(result.hands.length).toBe(20);
  });

  it("surfaces the player side's Trace from an effect's trace delta", () => {
    const loud = piece('loud', { verb: 'credit', amount: 20, trace: 4 });
    const result = playCombat([[loud], []], { seed: 1, gaugeThreshold: [5, 5] });
    expect(result.winner).toBe(0);
    expect(result.traceGenerated).toBeGreaterThan(0);
    expect(result.traceGenerated % 4).toBe(0);
  });

  it('starts the player at startingTrace (D1), and cover-your-tracks works against it', () => {
    expect(playCombat([[credit('a', 20)], []], { seed: 1, gaugeThreshold: [5, 5], startingTrace: 6 }).traceGenerated).toBe(6);
    const quiet = piece('quiet', { verb: 'credit', amount: 20, trace: -2 });
    expect(playCombat([[quiet], []], { seed: 1, gaugeThreshold: [5, 5], startingTrace: 6 }).traceGenerated).toBeLessThan(6);
  });

  it("reports each side's FINAL fill, clamped to 1 for the winner, never above the peak", () => {
    const result = playCombat([[credit('a', 20)], [credit('b', 1)]], { seed: 1, gaugeThreshold: [5, 5], winThreshold: [30, 30] });
    const loser = (1 - result.winner) as 0 | 1;
    expect(result.finalFillFraction[result.winner]).toBe(1);
    expect(result.finalFillFraction[loser]).toBeLessThan(1);
    expect(result.finalFillFraction[loser]).toBeLessThanOrEqual(result.peakFillFraction[loser]);
  });

  it('reports zero Trace when nothing makes noise', () => {
    expect(playCombat([[credit('a', 20)], []], { seed: 1, gaugeThreshold: [5, 5] }).traceGenerated).toBe(0);
  });

  it('every piece fires its alpha on every turn its side gets (D11) -- no trigger gates it', () => {
    // Two pieces whose betas can never apply still both fire every turn.
    const neverBeta: Beta = { source: 'cards', category: 'flush', minMagnitude: 999, shape: 'stepped', at: 1, effect: { verb: 'enhance', amount: 50 } };
    const result = playCombat([[piece('x', { verb: 'credit', amount: 1 }, neverBeta), piece('y', { verb: 'credit', amount: 1 }, neverBeta)], []], {
      seed: 4,
      gaugeThreshold: [6, 6],
      winThreshold: [30, 30],
    });
    const xFires = result.log.filter((e) => e.subroutineId === 'x').length;
    expect(xFires).toBeGreaterThan(0);
    expect(result.log.filter((e) => e.subroutineId === 'y').length).toBe(xFires);
    expect(result.log.every((e) => !e.elevated)).toBe(true);
  });

  it('an immediate beta fires mid-hand, outside the turn gate', () => {
    // The gauge threshold is unreachable, so side 0 never takes a turn --
    // any side-0 fire in the log can only be the immediate beta.
    const onFifteen = piece('on-fifteen', { verb: 'credit', amount: 1 }, {
      source: 'cards',
      category: 'fifteen',
      shape: 'immediate',
      at: 1,
      effect: { verb: 'credit', amount: 20 },
    });
    const result = playCombat([[onFifteen], []], { seed: 1, gaugeThreshold: [100_000, 100_000] });
    expect(result.winner).toBe(0);
    expect(result.log.length).toBeGreaterThan(0);
    expect(result.log.every((e) => e.side === 0 && e.immediate)).toBe(true);
  });

  it("a suit-tally beta charges from cards of its own archetype's suit played, not from scoring", () => {
    // Exploit's suit is suit 0. Turns are unreachable, so only the
    // immediate beta -- charged by real pegging plays -- can move the gauge.
    const suitWatcher = piece('suit-watcher', { verb: 'credit', amount: 1 }, {
      source: 'cards',
      category: 'suit',
      shape: 'immediate',
      at: 2,
      effect: { verb: 'credit', amount: 30 },
    });
    const result = playCombat([[suitWatcher], []], { seed: 1, gaugeThreshold: [100_000, 100_000] });
    expect(result.winner).toBe(0);
    expect(result.log.every((e) => e.side === 0 && e.subroutineId === 'suit-watcher')).toBe(true);
  });

  it('the hand flow produces HandResults identical to a direct game.ts replay for the same seed (session 24 regression check)', () => {
    const result = playCombat([[credit('winner', 1000)], []], { seed: 42, gaugeThreshold: [1, 1] });
    expect(result.hands.length).toBeGreaterThan(0);
    const rng = createRng(42);
    // Milestone 1 (P8): combat resolves live during pegging, so the fight
    // can end mid-hand. The last hand is then partial -- its pegging must
    // be an exact PREFIX of the full replay, and its show is never
    // counted. Every earlier hand matches the replay exactly.
    const last = result.hands[result.hands.length - 1];
    for (const hand of result.hands) {
      const shuffled = shuffle(createDeck(), rng);
      const { hands: dealtHands, stock } = deal(shuffled);
      const d0 = discardToCrib({ hand: dealtHands[0], isOwnCrib: hand.dealer === 0 }, discardLowestTwo);
      const d1 = discardToCrib({ hand: dealtHands[1], isOwnCrib: hand.dealer === 1 }, discardLowestTwo);
      const { starter } = cut(stock, rng);
      expect(starter).toEqual(hand.starter);
      expect(hisHeels(starter)).toBe(hand.hisHeelsPoints);
      const nonDealer = (1 - hand.dealer) as PlayerIndex;
      const kept: [Card[], Card[]] = [d0.keptHand, d1.keptHand];
      const { scores: peggingScores, events: peggingEvents } = playPegging(kept[0], kept[1], nonDealer, [playLowestLegal, playLowestLegal]);
      if (hand === last && hand.peggingEvents.length < peggingEvents.length) {
        expect(hand.peggingEvents).toEqual(peggingEvents.slice(0, hand.peggingEvents.length));
        expect(hand.nonDealerHandEvents).toEqual([]);
        continue;
      }
      expect(peggingScores).toEqual(hand.peggingScores);
      expect(peggingEvents).toEqual(hand.peggingEvents);
      expect(countHandEvents(kept[nonDealer], starter)).toEqual(hand.nonDealerHandEvents);
      expect(countHandEvents(kept[hand.dealer], starter)).toEqual(hand.dealerHandEvents);
      expect(countCribEvents([...d0.discarded, ...d1.discarded], starter)).toEqual(hand.cribEvents);
    }
  });

  it('own-gauge Tempo banks initiative overflow that releases as turns on the next scoring event', () => {
    // Haste of 3 whole turns per fire. After the first turn, the next
    // scoring event releases the banked turns at once, each firing burst.
    const haste = piece('haste', { verb: 'tempo', target: 'own', mode: 'gauge', amount: 3 }, undefined, { pointsCooldown: 1000 });
    const burst = credit('burst', 1);
    const result = playCombat([[haste, burst], []], { seed: 3, gaugeThreshold: [5, 5], winThreshold: [4, 4] });
    expect(result.winner).toBe(0);
    expect(result.log.filter((e) => e.subroutineId === 'burst').length).toBeGreaterThanOrEqual(3);
  });

  it('pegSkillStrategy plugs into real combat via per-side playStrategies', () => {
    const result = playCombat([[credit('a', 20)], [credit('b', 20)]], {
      seed: 13,
      gaugeThreshold: [5, 5],
      winThreshold: [30, 30],
      playStrategies: [pegSkillStrategy(1), pegSkillStrategy(0)],
    });
    expect([0, 1]).toContain(result.winner);
  });

  it('discardSkillStrategy plugs into real combat via per-side discardStrategies', () => {
    const result = playCombat([[credit('a', 20)], [credit('b', 20)]], {
      seed: 17,
      gaugeThreshold: [5, 5],
      winThreshold: [30, 30],
      discardStrategies: [discardSkillStrategy(1), discardSkillStrategy(0)],
    });
    expect([0, 1]).toContain(result.winner);
  });
});

// ---------------------------------------------------------------------
// Disrupt -- armed on a turn, resolved during the NEXT hand (session 51).
// ---------------------------------------------------------------------

describe('Disrupt end to end', () => {
  // A slow credit keeps the fight going for several hands, so a Disrupt
  // armed on an early turn has a next hand to resolve in.
  const slow = (id: string) => credit(id, 2);
  const options = { gaugeThreshold: [4, 1000] as [number, number], winThreshold: [40, 40] as [number, number] };

  it("revealHand puts the opponent's real dealt hand into the discard strategy's context on a later hand", () => {
    const recon = piece('recon', { verb: 'disrupt', action: 'revealHand' });
    const seen: (Card[] | undefined)[][] = [];
    const spy = (side: 0 | 1): DiscardStrategy => (ctx) => {
      (seen[side] ??= []).push(ctx.knownOpponentHand);
      const sorted = ctx.hand.slice().sort((a, b) => a.rank - b.rank);
      return [sorted[0], sorted[1]];
    };
    const result = playCombat([[recon, slow('s')], []], { seed: 5, ...options, discardStrategies: [spy(0), spy(1)] });
    expect(result.hands.length).toBeGreaterThan(1);
    // Never on the first hand -- nothing has had a turn yet.
    expect(seen[0][0]).toBeUndefined();
    const revealed = seen[0].filter((hand) => hand !== undefined);
    expect(revealed.length).toBeGreaterThan(0);
    for (const hand of revealed) expect(hand).toHaveLength(6);
    // Side 1 has no recon, so never sees anything.
    expect(seen[1].every((hand) => hand === undefined)).toBe(true);
  });

  it("forceDiscard bypasses the target's own discard strategy on a later hand", () => {
    const manipulator = piece('manipulator', { verb: 'disrupt', action: 'forceDiscard' });
    const calls: [number, number] = [0, 0];
    const spy = (side: 0 | 1): DiscardStrategy => (ctx) => {
      calls[side]++;
      const sorted = ctx.hand.slice().sort((a, b) => a.rank - b.rank);
      return [sorted[0], sorted[1]];
    };
    const result = playCombat([[manipulator, slow('s')], []], { seed: 7, ...options, discardStrategies: [spy(0), spy(1)] });
    expect(result.hands.length).toBeGreaterThan(1);
    expect(calls[0]).toBe(result.hands.length);
    expect(calls[1]).toBeLessThan(result.hands.length);
  });

  it("revealCrib lets the caster choose its discards SEEING the opponent's two crib cards (session 52)", () => {
    const cribRecon = piece('crib-recon', { verb: 'disrupt', action: 'revealCrib' });
    const seen: [Array<number>, Array<number>] = [[], []];
    const spy = (side: 0 | 1): DiscardStrategy => (ctx) => {
      seen[side].push(ctx.knownCribCards?.length ?? 0);
      const sorted = ctx.hand.slice().sort((a, b) => a.rank - b.rank);
      return [sorted[0], sorted[1]];
    };
    const result = playCombat([[cribRecon, slow('s')], []], { seed: 3, ...options, discardStrategies: [spy(0), spy(1)] });
    expect(result.hands.length).toBeGreaterThan(1);
    // Never on the first hand (nothing has had a turn yet); on later hands
    // side 0 sees exactly the two cards side 1 already discarded.
    expect(seen[0][0]).toBe(0);
    expect(seen[0].some((n) => n === 2)).toBe(true);
    // The opponent never sees side 0's.
    expect(seen[1].every((n) => n === 0)).toBe(true);
  });

  it('revealCrib and revealHand reach the pegging strategy as knownCrib and the kept hand', () => {
    const cribRecon = piece('crib-recon', { verb: 'disrupt', action: 'revealCrib' });
    const handRecon = piece('hand-recon', { verb: 'disrupt', action: 'revealHand' });
    let sawKnownCrib = false;
    let keptHandSize: number | undefined;
    const spy: PlayStrategy = (ctx) => {
      if (ctx.knownCrib) sawKnownCrib = true;
      if (ctx.knownOpponentHand) keptHandSize = ctx.knownOpponentHand.length;
      return ctx.legalCards.slice().sort((a, b) => cardValue(a) - cardValue(b))[0];
    };
    const result = playCombat([[cribRecon, handRecon, slow('s')], []], { seed: 11, ...options, playStrategies: [spy, spy] });
    expect(result.hands.length).toBeGreaterThan(1);
    expect(sawKnownCrib).toBe(true);
    // At play, a revealed hand has narrowed to the opponent's kept four.
    expect(keptHandSize).toBe(4);
  });
});

describe('escalation', () => {
  it('resolves as an attrition loss for a side too weak to close it out in time', () => {
    const result = playCombat([[credit('a', 0.01)], []], { seed: 1, gaugeThreshold: [3, 3], winThreshold: [15, 15] });
    expect(result.winner).toBe(1);
    expect(result.resolvedBy).toBe('attrition');
    expect(result.hands.length).toBe(20);
  });

  describe('per-side derivation (session 48)', () => {
    it('reproduces the old flat constants exactly at the historical shared base of 50', () => {
      expect(escalationFloorFor(50)).toBe(10);
      expect(escalationShrinkPerHandFor(50)).toBe(4);
    });

    it('lands any starting bar on its own floor in exactly the same number of hands', () => {
      for (const base of [30, 40, 50, 65, 100]) {
        expect(base - escalationShrinkPerHandFor(base) * 10).toBeCloseTo(escalationFloorFor(base), 5);
      }
    });

    it('gives two sides on different bars the same escalation timeline, not the same rate', () => {
      expect(escalationShrinkPerHandFor(40)).toBeLessThan(escalationShrinkPerHandFor(65));
      expect(escalationFloorFor(40)).toBeLessThan(escalationFloorFor(65));
    });

    it('floors at 1 so a tiny starting bar can never produce a zero or negative threshold', () => {
      expect(escalationFloorFor(1)).toBe(1);
      expect(escalationShrinkPerHandFor(1)).toBeGreaterThanOrEqual(1);
    });
  });
});

// ---------------------------------------------------------------------
// Loop detector (session 47) -- see combat.ts's MAX_CONSECUTIVE_TURNS.
// ---------------------------------------------------------------------

describe('systemic turn-loop detection', () => {
  // Session 47's shape: a piece that Hastes its own initiative gauge by
  // more than a whole turn, with NO points cooldown. Each fire buys more
  // than a turn, which fires it again. Content guards forbid this
  // (subroutines.test.ts); the detector exists for when one slips through.
  const runaway = piece('runaway-haste', { verb: 'tempo', target: 'own', mode: 'gauge', amount: 1.5 });

  it('throws loudly on a self-feeding turn engine', () => {
    expect(() => playCombat([[runaway], [runaway]], { seed: 1, gaugeThreshold: [8, 8], winThreshold: [50, 50] })).toThrow(/systemic turn loop/);
  });

  it('names the side, hand, seed and loadout so the case can be reproduced', () => {
    try {
      playCombat([[runaway], [runaway]], { seed: 1, gaugeThreshold: [8, 8], winThreshold: [50, 50] });
      throw new Error('expected the loop detector to fire');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('seed=1');
      expect(message).toContain('runaway-haste');
      expect(message).toMatch(/hand=\d+/);
      expect(message).toMatch(/gauge=[\d.]+\/\d+/);
    }
  });

  it('does not fire on ordinary play', () => {
    expect(() =>
      playCombat([CLASS_STARTING_LOADOUTS['exploit-overclock'], CLASS_STARTING_LOADOUTS['daemon-honeypot']], {
        seed: 3,
        gaugeThreshold: [8, 8],
        winThreshold: [50, 50],
      }),
    ).not.toThrow();
  });
});

describe('handPointsAtLeast end to end (checkpoint 6b)', () => {
  it('fires an immediate beta once per hand that clears the threshold, and resets each deal', () => {
    const piece: SubroutineDefinition = {
      id: 'big-hand', name: 'big-hand', archetype: 'overclock',
      alpha: { verb: 'credit', amount: 0 },
      beta: { source: 'state', condition: { kind: 'handPointsAtLeast', amount: 8 }, shape: 'immediate', effect: { verb: 'credit', amount: 1 } },
    };
    const result = playCombat([[piece], [piece]], { seed: 7, gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD], winThreshold: [BREACH_THRESHOLD, BREACH_THRESHOLD] });
    const fires = result.log.filter((e) => e.side === 0 && e.immediate && e.subroutineId === 'big-hand').length;
    // At most one edge per hand; a real fight clears 8 points in some hands.
    expect(fires).toBeGreaterThan(0);
    expect(fires).toBeLessThanOrEqual(result.hands.length);
  });
});

describe('combatGenerator (milestone 1, P1/P8)', () => {
  const kits: [SubroutineDefinition[], SubroutineDefinition[]] = [CLASS_STARTING_LOADOUTS['exploit-overclock'], CLASS_STARTING_LOADOUTS['daemon-honeypot']];
  const options = {
    seed: 11,
    gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD] as [number, number],
    winThreshold: [BREACH_THRESHOLD, BREACH_THRESHOLD] as [number, number],
    discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.85)] as [DiscardStrategy, DiscardStrategy],
    playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.85)] as [PlayStrategy, PlayStrategy],
  };

  it('driven by hand, it reaches exactly the result playCombat does', () => {
    const fight = combatGenerator(kits, options);
    let step = fight.next();
    const kinds = new Set<string>();
    const sides = new Set<number>();
    while (!step.done) {
      const r = step.value;
      kinds.add(r.kind);
      sides.add(r.side);
      const answer: CombatAnswer = r.kind === 'discard' ? options.discardStrategies[r.side](r.context) : r.kind === 'play' ? options.playStrategies[r.side](r.context) : null;
      step = fight.next(answer);
    }
    expect(step.value).toEqual(playCombat(kits, options));
    expect(kinds).toEqual(new Set(['discard', 'play']));
    expect(sides).toEqual(new Set([0, 1]));
  });

  it('resolves combat live (P8): a turn fires between two pegging decisions of the same hand', () => {
    const fight = combatGenerator(kits, options);
    let step = fight.next();
    let previousPlay: { hand: number; log: number } | null = null;
    let turnBetweenPlays = false;
    while (!step.done) {
      const r = step.value;
      if (r.kind === 'play') {
        const now = { hand: r.view.handIndex, log: r.view.log.length };
        if (previousPlay && previousPlay.hand === now.hand && now.log > previousPlay.log) turnBetweenPlays = true;
        previousPlay = now;
      }
      const answer: CombatAnswer = r.kind === 'discard' ? options.discardStrategies[r.side](r.context) : r.kind === 'play' ? options.playStrategies[r.side](r.context) : null;
      step = fight.next(answer);
    }
    expect(turnBetweenPlays).toBe(true);
  });

  it('every request carries a view of the fight as it stands', () => {
    const first = combatGenerator(kits, options).next();
    expect(first.done).toBe(false);
    if (!first.done) {
      expect(first.value.kind).toBe('discard');
      expect(first.value.view.handIndex).toBe(0);
      expect(first.value.view.combatState.sides[0].loadout.length).toBeGreaterThan(0);
    }
  });
});

describe('combat timeline (milestone 2 checkpoints 3a/3b)', () => {
  const options = {
    seed: 11,
    gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD] as [number, number],
    winThreshold: [400, 400] as [number, number],
    discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.85)] as [DiscardStrategy, DiscardStrategy],
    playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.85)] as [PlayStrategy, PlayStrategy],
  };

  it('lays out each show (non-dealer, dealer, crib) and its scores add up to the total, with their cards', () => {
    const result = playCombat([CLASS_STARTING_LOADOUTS['exploit-overclock'], CLASS_STARTING_LOADOUTS['daemon-honeypot']], options);
    const firstHand = result.timeline.slice(0, result.timeline.findIndex((b, i) => i > 0 && b.kind === 'hand'));
    const shows = firstHand.filter((b) => b.kind === 'show');
    expect(shows.map((b) => (b.kind === 'show' ? b.owner : ''))).toEqual(['hand', 'hand', 'crib']);
    const dealer = result.hands[0].dealer;
    expect(shows.map((b) => (b.kind === 'show' ? b.player : -1))).toEqual([1 - dealer, dealer, dealer]);
    for (const show of shows) {
      if (show.kind !== 'show') continue;
      const start = firstHand.indexOf(show);
      const next = firstHand.findIndex((b, i) => i > start && b.kind === 'show');
      const points = firstHand.slice(start + 1, next === -1 ? undefined : next).filter((b) => b.kind === 'points');
      expect(points.reduce((sum, b) => sum + (b.kind === 'points' ? b.occurrence.magnitude : 0), 0)).toBe(show.total);
      for (const b of points) if (b.kind === 'points') expect(b.cards?.length).toBeGreaterThan(0);
    }
  });

  it('records a Burner spent before a turn', () => {
    const result = playCombat([CLASS_STARTING_LOADOUTS['exploit-overclock'], CLASS_STARTING_LOADOUTS['daemon-honeypot']], {
      ...options,
      carriedBurnerIds: ['flash-drive'],
      burnerActivationStrategies: [(ctx) => ctx.availableBurnerIds[0] ?? null, () => null],
    });
    const burns = result.timeline.filter((b) => b.kind === 'burner');
    expect(burns).toHaveLength(1);
    expect(burns[0]).toMatchObject({ kind: 'burner', side: 0, burnerId: 'flash-drive' });
  });
});

describe('Mod triggers (milestone 2, the trigger flash)', () => {
  it('records a turn-start bridge as a Mod beat and a gatekeeper Mod on the fire it cut', () => {
    const result = playCombat([CLASS_STARTING_LOADOUTS['overclock-honeypot'], CLASS_STARTING_LOADOUTS['overclock-honeypot']], {
      seed: 3,
      gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
      winThreshold: [400, 400],
      classId: 'overclock-honeypot',
      gatekeeperMods: [[], ['null-session']],
      discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.85)],
      playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.85)],
    });
    const siphons = result.timeline.filter((b) => b.kind === 'mod' && b.side === 0 && b.mod.id === 'bridge-overclock-honeypot');
    expect(siphons.length).toBeGreaterThan(0);
    const cut = result.log.filter((f) => f.side === 0 && f.mods?.some((m) => m.side === 1 && m.mod.id === 'null-session'));
    expect(cut.length).toBeGreaterThan(0);
    // Every Siphon beat comes right before one of the player's turns.
    for (const b of siphons) expect(result.log[b.firesBefore]?.side).toBe(0);
  });
});

describe('turn beats (the turn toast)', () => {
  it("mark each turn's start, just ahead of that side's own turn fires", () => {
    const result = playCombat([CLASS_STARTING_LOADOUTS['exploit-overclock'], CLASS_STARTING_LOADOUTS['daemon-honeypot']], {
      seed: 8,
      gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
      winThreshold: [400, 400],
      discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.85)],
      playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.85)],
    });
    const turns = result.timeline.filter((b) => b.kind === 'turn');
    expect(turns.filter((b) => b.kind === 'turn' && b.side === 0).length).toBeGreaterThan(3);
    expect(turns.filter((b) => b.kind === 'turn' && b.side === 1).length).toBeGreaterThan(3);
    for (const b of turns) {
      if (b.kind !== 'turn') continue;
      const firstTurnFire = result.log.slice(b.firesBefore).find((f) => !f.immediate);
      if (firstTurnFire) expect(firstTurnFire.side).toBe(b.side);
    }
  });
});
