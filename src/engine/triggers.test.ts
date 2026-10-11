import { describe, it, expect } from 'vitest';
import type { PegPlayEvent, PegGoEvent, PegGoPointEvent } from './pegging';
import type { HandScoreEvent } from './scoring';
import type { Alpha, Archetype, Beta, SubroutineDefinition } from './subroutine-types';
import {
  addCharges,
  betaCharges,
  betaScale,
  chargeFromAbsorbed,
  chargeFromOccurrence,
  chargeFromSuitPlayed,
  createInitialState,
  immediateBetaReady,
  occurrenceFromHisHeels,
  occurrencesFromHandEvents,
  occurrencesFromPeggingEvent,
  recordFire,
  spendCharges,
  suitPlayedFromPeggingEvent,
  withinFiringGates,
  type ScoringOccurrence,
  type TriggerContext,
} from './triggers';

// Session 51: rewritten for beta criteria. The occurrence-adapter tests
// are unchanged; the old readiness/trigger-family tests retired with the
// families.

const ALPHA: Alpha = { verb: 'credit', amount: 1 };

function withBeta(beta: Beta | undefined, extra: Partial<SubroutineDefinition> = {}, archetype: Archetype = 'exploit'): SubroutineDefinition {
  return { id: 'p', name: 'p', archetype, alpha: ALPHA, beta, ...extra };
}

const ENHANCE = { verb: 'enhance', amount: 1 } as const;

const context = (patch: Partial<TriggerContext> = {}): TriggerContext => ({
  isDealer: false,
  ownWard: 0,
  ownGaugeFraction: 0,
  opponentGaugeFraction: 0,
  firedThisTurn: [],
  neighbours: [],
  ...patch,
});

const occ = (category: ScoringOccurrence['category'], player: 0 | 1, magnitude = 2): ScoringOccurrence => ({ category, player, magnitude });

describe('chargeFromOccurrence -- cards', () => {
  const pairs = withBeta({ source: 'cards', category: 'pair', shape: 'graded', cap: 3, effect: ENHANCE });

  it('banks a charge for its own side scoring its category', () => {
    expect(chargeFromOccurrence(createInitialState(), pairs, occ('pair', 0), 0).charges).toBe(1);
  });

  it('ignores another category and, by default, the opponent scoring', () => {
    expect(chargeFromOccurrence(createInitialState(), pairs, occ('fifteen', 0), 0).charges).toBe(0);
    expect(chargeFromOccurrence(createInitialState(), pairs, occ('pair', 1), 0).charges).toBe(0);
  });

  it("watch: 'opponent' and 'either' read the other side's scoring (absorbing rareOccurrence)", () => {
    const theirs = withBeta({ source: 'cards', category: 'pair', watch: 'opponent', shape: 'graded', cap: 3, effect: ENHANCE });
    expect(chargeFromOccurrence(createInitialState(), theirs, occ('pair', 1), 0).charges).toBe(1);
    expect(chargeFromOccurrence(createInitialState(), theirs, occ('pair', 0), 0).charges).toBe(0);
    const either = withBeta({ source: 'cards', category: 'pair', watch: 'either', shape: 'graded', cap: 3, effect: ENHANCE });
    expect(chargeFromOccurrence(createInitialState(), either, occ('pair', 1), 0).charges).toBe(1);
  });

  it('minMagnitude makes "royal pair" real: a pair occurrence is 2/6/12 points', () => {
    const royal = withBeta({ source: 'cards', category: 'pair', minMagnitude: 6, shape: 'stepped', at: 1, effect: ENHANCE });
    expect(chargeFromOccurrence(createInitialState(), royal, occ('pair', 0, 2), 0).charges).toBe(0);
    expect(chargeFromOccurrence(createInitialState(), royal, occ('pair', 0, 6), 0).charges).toBe(1);
  });

  it('His Heels scores points but no beta can watch it', () => {
    // 'hisHeels' is not an OccurrenceCategory, so no cards beta can name it;
    // feeding one changes nothing.
    expect(chargeFromOccurrence(createInitialState(), pairs, occ('hisHeels', 0), 0)).toEqual(createInitialState());
  });
});

describe('chargeFromOccurrence -- progress and cooldown', () => {
  it("a points beta banks its own side's points, one charge per `per`, carrying the remainder", () => {
    const points = withBeta({ source: 'progress', metric: 'points', per: 5, shape: 'graded', cap: 9, effect: ENHANCE });
    let state = chargeFromOccurrence(createInitialState(), points, occ('fifteen', 0, 4), 0);
    expect(state).toMatchObject({ charges: 0, progressBank: 4 });
    state = chargeFromOccurrence(state, points, occ('run', 0, 7), 0);
    expect(state).toMatchObject({ charges: 2, progressBank: 1 });
    expect(chargeFromOccurrence(state, points, occ('run', 1, 7), 0)).toEqual(state);
  });

  it("ticks every piece's points cooldown down on its own side's scoring, whatever its beta", () => {
    const state = { ...createInitialState(), cooldownRemaining: 10 };
    expect(chargeFromOccurrence(state, withBeta(undefined), occ('pair', 0, 4), 0).cooldownRemaining).toBe(6);
    expect(chargeFromOccurrence(state, withBeta(undefined), occ('pair', 1, 4), 0).cooldownRemaining).toBe(10);
  });
});

describe('chargeFromSuitPlayed', () => {
  const suit = (archetype: Archetype) => withBeta({ source: 'cards', category: 'suit', shape: 'graded', cap: 5, effect: ENHANCE }, {}, archetype);

  it("charges only for cards of the piece's own archetype's suit (A1), played by its own side", () => {
    // Exploit is suit 0, Daemon suit 1.
    expect(chargeFromSuitPlayed(createInitialState(), suit('exploit'), { suit: 0, player: 0 }, 0).charges).toBe(1);
    expect(chargeFromSuitPlayed(createInitialState(), suit('exploit'), { suit: 1, player: 0 }, 0).charges).toBe(0);
    expect(chargeFromSuitPlayed(createInitialState(), suit('daemon'), { suit: 1, player: 0 }, 0).charges).toBe(1);
    expect(chargeFromSuitPlayed(createInitialState(), suit('exploit'), { suit: 0, player: 1 }, 0).charges).toBe(0);
  });
});

describe('chargeFromAbsorbed', () => {
  it('banks Ward absorbed into an absorbed-progress beta', () => {
    const absorbed = withBeta({ source: 'progress', metric: 'absorbed', per: 3, shape: 'stepped', at: 2, effect: ENHANCE });
    expect(chargeFromAbsorbed(createInitialState(), absorbed, 7)).toMatchObject({ charges: 2, progressBank: 1 });
    expect(chargeFromAbsorbed(createInitialState(), withBeta(undefined), 7)).toEqual(createInitialState());
  });
});

describe('addCharges', () => {
  it('adds to a banking beta, and is a no-op for a live (state/sequence) beta or no beta', () => {
    const banked = withBeta({ source: 'cards', category: 'go', shape: 'graded', cap: 3, effect: ENHANCE });
    const live = withBeta({ source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: ENHANCE });
    expect(addCharges(createInitialState(), banked, 2).charges).toBe(2);
    expect(addCharges(createInitialState(), live, 2).charges).toBe(0);
    expect(addCharges(createInitialState(), withBeta(undefined), 2).charges).toBe(0);
  });
});

describe('betaCharges', () => {
  it('reads banked charges for cards/progress', () => {
    const banked = withBeta({ source: 'cards', category: 'go', shape: 'graded', cap: 3, effect: ENHANCE });
    expect(betaCharges(banked, { ...createInitialState(), charges: 2 }, context())).toBe(2);
  });

  it('is 1 while a state condition holds, 0 otherwise (D15)', () => {
    const dealer = withBeta({ source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: ENHANCE });
    expect(betaCharges(dealer, createInitialState(), context({ isDealer: true }))).toBe(1);
    expect(betaCharges(dealer, createInitialState(), context({ isDealer: false }))).toBe(0);
    const ward = withBeta({ source: 'state', condition: { kind: 'wardAbove', amount: 5 }, shape: 'whileTrue', effect: ENHANCE });
    expect(betaCharges(ward, createInitialState(), context({ ownWard: 6 }))).toBe(1);
    const behind = withBeta({ source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'whileTrue', effect: ENHANCE });
    expect(betaCharges(behind, createInitialState(), context({ opponentGaugeFraction: 0.6 }))).toBe(1);
  });

  it('sequence adjacent is positional and either-side (A12): it counts matching neighbours, not what fired', () => {
    const adjacent = withBeta({ source: 'sequence', reach: 'adjacent', match: { archetype: 'daemon' }, shape: 'graded', cap: 2, effect: ENHANCE });
    const daemon = withBeta(undefined, { id: 'd' }, 'daemon');
    const exploit = withBeta(undefined, { id: 'e' }, 'exploit');
    expect(betaCharges(adjacent, createInitialState(), context({ neighbours: [daemon] }))).toBe(1);
    expect(betaCharges(adjacent, createInitialState(), context({ neighbours: [daemon, daemon] }))).toBe(2);
    expect(betaCharges(adjacent, createInitialState(), context({ neighbours: [exploit] }))).toBe(0);
    // A matching piece that FIRED this turn but isn't a neighbour doesn't count.
    expect(betaCharges(adjacent, createInitialState(), context({ neighbours: [exploit], firedThisTurn: [{ definition: daemon, elevated: true }] }))).toBe(0);
  });

  it('sequence anyPrior counts matching pieces that fired ELEVATED (graded = the old chain-finisher)', () => {
    const anyPrior = withBeta({ source: 'sequence', reach: 'anyPrior', match: { verb: 'credit' }, shape: 'graded', cap: 5, effect: ENHANCE });
    const a = withBeta(undefined, { id: 'a' });
    const fired = [
      { definition: a, elevated: true },
      { definition: a, elevated: false },
      { definition: a, elevated: true },
    ];
    expect(betaCharges(anyPrior, createInitialState(), context({ firedThisTurn: fired }))).toBe(2);
  });
});

describe('betaScale', () => {
  const base = { source: 'cards', category: 'go', effect: ENHANCE } as const;

  it('graded scales by charges up to the cap, and does not apply at 0', () => {
    const graded: Beta = { ...base, shape: 'graded', cap: 3 };
    expect([0, 1, 3, 7].map((c) => betaScale(graded, c))).toEqual([0, 1, 3, 3]);
  });

  it('stepped is all-or-nothing at `at` charges', () => {
    const stepped: Beta = { ...base, shape: 'stepped', at: 3 };
    expect([2, 3, 9].map((c) => betaScale(stepped, c))).toEqual([0, 1, 1]);
  });

  it('whileTrue applies at 1 or more', () => {
    expect(betaScale({ source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: ENHANCE }, 1)).toBe(1);
  });

  it('immediate never applies on the turn -- it fires on its own', () => {
    expect(betaScale({ ...base, shape: 'immediate', at: 1 }, 5)).toBe(0);
  });
});

describe('immediateBetaReady', () => {
  it('cards/progress: ready once `at` charges have banked (default 1)', () => {
    const atTwo = withBeta({ source: 'cards', category: 'go', shape: 'immediate', at: 2, effect: ENHANCE });
    expect(immediateBetaReady(atTwo, { ...createInitialState(), charges: 1 }, context())).toBe(false);
    expect(immediateBetaReady(atTwo, { ...createInitialState(), charges: 2 }, context())).toBe(true);
    const atDefault = withBeta({ source: 'cards', category: 'go', shape: 'immediate', effect: ENHANCE });
    expect(immediateBetaReady(atDefault, { ...createInitialState(), charges: 1 }, context())).toBe(true);
  });

  it('state: fires on the false -> true edge only, not while it stays true', () => {
    const dealer = withBeta({ source: 'state', condition: { kind: 'dealer' }, shape: 'immediate', effect: ENHANCE });
    expect(immediateBetaReady(dealer, createInitialState(), context({ isDealer: true }))).toBe(true);
    expect(immediateBetaReady(dealer, { ...createInitialState(), lastConditionTrue: true }, context({ isDealer: true }))).toBe(false);
  });

  it('is never true for a non-immediate beta', () => {
    const graded = withBeta({ source: 'cards', category: 'go', shape: 'graded', cap: 3, effect: ENHANCE });
    expect(immediateBetaReady(graded, { ...createInitialState(), charges: 5 }, context())).toBe(false);
  });
});

describe('spendCharges', () => {
  it('clears banked charges but keeps the progress remainder', () => {
    expect(spendCharges({ ...createInitialState(), charges: 3, progressBank: 2 })).toMatchObject({ charges: 0, progressBank: 2 });
  });
});

describe('firing gates and recordFire', () => {
  it('maxFiresPerCombat and an outstanding points cooldown each block a fire', () => {
    expect(withinFiringGates(withBeta(undefined, { maxFiresPerCombat: 2 }), { ...createInitialState(), fireCount: 2 })).toBe(false);
    expect(withinFiringGates(withBeta(undefined), { ...createInitialState(), cooldownRemaining: 1 })).toBe(false);
    expect(withinFiringGates(withBeta(undefined), createInitialState())).toBe(true);
  });

  it('counts the fire and arms the points cooldown', () => {
    expect(recordFire(createInitialState(), withBeta(undefined, { pointsCooldown: 12 }))).toMatchObject({ fireCount: 1, cooldownRemaining: 12 });
  });

  it('accrues alpha growth up to its cap (Ramp)', () => {
    const ramp: SubroutineDefinition = { id: 'r', name: 'r', archetype: 'daemon', alpha: { verb: 'credit', amount: 1, growth: 2, growthCap: 5 } };
    let state = createInitialState();
    for (let i = 0; i < 4; i++) state = recordFire(state, ramp);
    expect(state.growthTotal).toBe(5);
  });

  it("banks a charge toward a fires-progress beta -- Ramp's own clock", () => {
    const clock = withBeta({ source: 'progress', metric: 'fires', per: 2, shape: 'stepped', at: 1, effect: ENHANCE });
    expect(recordFire(recordFire(createInitialState(), clock), clock).charges).toBe(1);
  });
});

// ---------------------------------------------------------------------
// Occurrence adapters -- unchanged from before session 51.
// ---------------------------------------------------------------------

describe('occurrencesFromPeggingEvent', () => {
  it('produces one occurrence per non-zero breakdown category from a play event', () => {
    const event: PegPlayEvent = {
      type: 'play',
      player: 0,
      card: { rank: 5, suit: 0 },
      count: 15,
      score: 2,
      breakdown: { fifteen: 2, pair: 0, run: 0, thirtyOne: 0, total: 2 },
    };
    expect(occurrencesFromPeggingEvent(event)).toEqual([{ category: 'fifteen', player: 0, magnitude: 2 }]);
  });

  it('produces a go occurrence from a go-point event', () => {
    const event: PegGoPointEvent = { type: 'go-point', player: 1 };
    expect(occurrencesFromPeggingEvent(event)).toEqual([{ category: 'go', player: 1, magnitude: 1 }]);
  });

  it('produces nothing from a plain go (pass) event', () => {
    const event: PegGoEvent = { type: 'go', player: 0 };
    expect(occurrencesFromPeggingEvent(event)).toEqual([]);
  });
});

describe('occurrencesFromHandEvents', () => {
  it('maps each discrete scoring event to its own occurrence, 1:1', () => {
    const events: HandScoreEvent[] = [
      { category: 'fifteen', points: 2 },
      { category: 'fifteen', points: 2 },
      { category: 'pair', points: 2 },
      { category: 'flush', points: 4 },
      { category: 'nobs', points: 1 },
    ];
    expect(occurrencesFromHandEvents(events, 0)).toEqual([
      { category: 'fifteen', player: 0, magnitude: 2 },
      { category: 'fifteen', player: 0, magnitude: 2 },
      { category: 'pair', player: 0, magnitude: 2 },
      { category: 'flush', player: 0, magnitude: 4 },
      { category: 'hisNobs', player: 0, magnitude: 1 },
    ]);
  });
});

describe('occurrenceFromHisHeels', () => {
  it('returns null when the starter is not a Jack', () => {
    expect(occurrenceFromHisHeels(0, 1)).toBeNull();
  });

  it('credits the dealer when the starter is a Jack', () => {
    expect(occurrenceFromHisHeels(2, 1)).toEqual({ category: 'hisHeels', player: 1, magnitude: 2 });
  });
});

describe('suitPlayedFromPeggingEvent', () => {
  it('extracts suit and player from a play event, regardless of score', () => {
    const scoreless: PegPlayEvent = {
      type: 'play',
      player: 1,
      card: { rank: 9, suit: 2 },
      count: 20,
      score: 0,
      breakdown: { fifteen: 0, pair: 0, run: 0, thirtyOne: 0, total: 0 },
    };
    expect(suitPlayedFromPeggingEvent(scoreless)).toEqual({ suit: 2, player: 1 });
  });

  it('returns null for go and go-point events', () => {
    expect(suitPlayedFromPeggingEvent({ type: 'go', player: 0 })).toBeNull();
    expect(suitPlayedFromPeggingEvent({ type: 'go-point', player: 0 })).toBeNull();
  });
});
