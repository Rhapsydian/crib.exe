import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createNode } from './map-types';
import { resolveEncounter, alwaysFirstEventChoice, type EventChoiceStrategy } from './encounters';
import { createInitialPlayerState, playRun, type RunPlayerState } from './run';
import { EVENT_ROSTER } from './events';
import type { EventChoice } from './event-types';

/**
 * Events verification (Phase 5 checkpoint J): the roster's own content
 * shape is validated directly (probabilities, tier/effect/grant
 * coverage -- session 37's own validation-pass claims, now a durable
 * test rather than a throwaway check), every authored Event gets
 * resolved at least once through the real random-pick mechanism, every
 * risk tier and the bonus-fight path all hit, plus a smoke-tested full
 * run. Mirrors mods.test.ts's own style.
 */

function playerWith(overrides: Partial<RunPlayerState>): RunPlayerState {
  return { ...createInitialPlayerState('breacher'), ...overrides };
}

describe('EVENT_ROSTER content shape', () => {
  it('has exactly the 8 validated Events, each with 2-4 distinctly-ided choices', () => {
    expect(EVENT_ROSTER).toHaveLength(8);
    const seenIds = new Set<string>();
    for (const event of EVENT_ROSTER) {
      expect(seenIds.has(event.id)).toBe(false);
      seenIds.add(event.id);
      expect(event.choices.length).toBeGreaterThanOrEqual(2);
      expect(event.choices.length).toBeLessThanOrEqual(4);
    }
  });

  it("every choice's outcome probabilities sum to 1, and a transparent choice has exactly one outcome", () => {
    for (const event of EVENT_ROSTER) {
      for (const choice of event.choices) {
        const sum = choice.outcomes.reduce((s, o) => s + o.probability, 0);
        expect(sum).toBeCloseTo(1, 9);
        if (choice.riskTier === 'transparent') expect(choice.outcomes).toHaveLength(1);
      }
    }
  });

  it('covers all 3 risk tiers, every EventEffect kind, and both Grant<T> mechanisms across the roster', () => {
    const riskTiers = new Set<string>();
    const effectKinds = new Set<string>();
    let sawSpecificGrant = false;
    let sawRandomFromRarityGrant = false;

    for (const event of EVENT_ROSTER) {
      for (const choice of event.choices) {
        riskTiers.add(choice.riskTier);
        for (const outcome of choice.outcomes) {
          const e = outcome.effect;
          if (e.heatDelta !== undefined) effectKinds.add('heatDelta');
          if (e.dataDelta !== undefined) effectKinds.add('dataDelta');
          if (e.bonusFight !== undefined) effectKinds.add('bonusFight');
          for (const grant of [e.subroutineGrant, e.modGrant, e.burnerGrant]) {
            if (grant === undefined) continue;
            if ('specific' in grant) sawSpecificGrant = true;
            else sawRandomFromRarityGrant = true;
          }
          if (e.subroutineGrant) effectKinds.add('subroutineGrant');
          if (e.modGrant) effectKinds.add('modGrant');
          if (e.burnerGrant) effectKinds.add('burnerGrant');
        }
      }
    }

    expect(riskTiers).toEqual(new Set(['transparent', 'visibleOdds', 'gamble']));
    expect(effectKinds).toEqual(new Set(['heatDelta', 'dataDelta', 'subroutineGrant', 'modGrant', 'burnerGrant', 'bonusFight']));
    expect(sawSpecificGrant).toBe(true);
    expect(sawRandomFromRarityGrant).toBe(true);
  });
});

describe('EventChoiceStrategy', () => {
  it('alwaysFirstEventChoice (the default) always takes choices[0]', () => {
    for (const event of EVENT_ROSTER) {
      expect(alwaysFirstEventChoice(event, playerWith({}))).toBe(event.choices[0]);
    }
  });

  it('resolveEncounter defaults to alwaysFirstEventChoice when no strategy is supplied', () => {
    // Same seed, explicit alwaysFirstEventChoice vs. the implicit default
    // -- must resolve identically.
    const explicit = resolveEncounter(
      createNode('n', 'event'),
      createRng(1),
      playerWith({}),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      0,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      alwaysFirstEventChoice,
    );
    const implicit = resolveEncounter(createNode('n', 'event'), createRng(1), playerWith({}));
    expect(implicit).toEqual(explicit);
  });

  it('all 8 authored Events actually get resolved via the real random-pick mechanism, swept across seeds', () => {
    const seenEventIds = new Set<string>();
    const recordingStrategy: EventChoiceStrategy = (event) => {
      seenEventIds.add(event.id);
      return event.choices[0];
    };
    for (let seed = 1; seed <= 60; seed++) {
      resolveEncounter(
        createNode('n', 'event'),
        createRng(seed),
        playerWith({}),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        recordingStrategy,
      );
    }
    expect(seenEventIds.size).toBe(EVENT_ROSTER.length);
  });
});

describe('Choice resolution -- every risk tier and the bonus-fight path', () => {
  const overwhelming = [
    { id: 'overwhelm', name: 'Overwhelm', archetype: 'exploit' as const, trigger: { kind: 'always' as const }, payload: { kind: 'directBurst' as const, amount: 30 }, tags: [] },
  ];

  function forceChoice(choice: EventChoice): EventChoiceStrategy {
    return () => choice;
  }

  it('resolves a transparent choice deterministically (single outcome, no rng consumed for the roll)', () => {
    const transparentChoice = EVENT_ROSTER.flatMap((e) => e.choices).find((c) => c.riskTier === 'transparent')!;
    const outcomeA = resolveEncounter(
      createNode('n', 'event'),
      createRng(1),
      playerWith({}),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      0,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      forceChoice(transparentChoice),
    );
    const outcomeB = resolveEncounter(
      createNode('n', 'event'),
      createRng(99),
      playerWith({}),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      0,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      forceChoice(transparentChoice),
    );
    // Different seeds, same transparent choice -- must resolve to the
    // exact same effect (the roll's rng draw doesn't matter at
    // probability 1), confirming transparent really means deterministic.
    expect(outcomeA.heatDelta).toBe(outcomeB.heatDelta);
    expect(outcomeA.dataAwarded).toBe(outcomeB.dataAwarded);
  });

  it('resolves a visibleOdds choice with real variance across seeds', () => {
    const visibleOddsChoice = EVENT_ROSTER.flatMap((e) => e.choices).find((c) => c.riskTier === 'visibleOdds')!;
    const shapes = new Set(
      Array.from({ length: 20 }, (_, i) => {
        const o = resolveEncounter(
          createNode('n', 'event'),
          createRng(i + 1),
          playerWith({}),
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          1,
          0,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          forceChoice(visibleOddsChoice),
        );
        return JSON.stringify({ heatDelta: o.heatDelta, dataAwarded: o.dataAwarded, eventGrant: o.eventGrant });
      }),
    );
    expect(shapes.size).toBeGreaterThan(1);
  });

  it('resolves a gamble choice, including real grant resolution when it lands', () => {
    const gambleChoiceWithGrant = EVENT_ROSTER.flatMap((e) => e.choices).find(
      (c) => c.riskTier === 'gamble' && c.outcomes.some((o) => o.effect.subroutineGrant || o.effect.modGrant || o.effect.burnerGrant),
    )!;
    let sawAnyGrant = false;
    for (let seed = 1; seed <= 30; seed++) {
      const outcome = resolveEncounter(
        createNode('n', 'event'),
        createRng(seed),
        playerWith({}),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        forceChoice(gambleChoiceWithGrant),
      );
      if (outcome.eventGrant?.subroutine || outcome.eventGrant?.mod || outcome.eventGrant?.burner) sawAnyGrant = true;
    }
    expect(sawAnyGrant).toBe(true);
  });

  it('a gamble bonusFight choice resolves a real fight, folding win rewards into the same EncounterOutcome', () => {
    const bonusFightChoice = EVENT_ROSTER.flatMap((e) => e.choices).find((c) => c.outcomes.some((o) => o.effect.bonusFight))!;
    let sawWinReward = false;
    let sawLossHeat = false;
    for (let seed = 1; seed <= 30; seed++) {
      const outcome = resolveEncounter(
        createNode('n', 'event'),
        createRng(seed),
        playerWith({ installedLoadout: overwhelming }),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        forceChoice(bonusFightChoice),
      );
      if (outcome.rewardOptions.length > 0 || outcome.burnerRewardOptions.length > 0) sawWinReward = true;
    }
    for (let seed = 1; seed <= 10; seed++) {
      const outcome = resolveEncounter(
        createNode('n', 'event'),
        createRng(seed),
        playerWith({ installedLoadout: [] }),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        0,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        forceChoice(bonusFightChoice),
      );
      if (outcome.heatDelta > 0) sawLossHeat = true;
    }
    expect(sawWinReward).toBe(true);
    expect(sawLossHeat).toBe(true);
    // The Event node itself always stays inert regardless of the bonus
    // fight's result (DESIGN.md: same stub-node treatment as every
    // other Event).
    const anyOutcome = resolveEncounter(
      createNode('n', 'event'),
      createRng(1),
      playerWith({ installedLoadout: [] }),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      0,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      forceChoice(bonusFightChoice),
    );
    expect(anyOutcome.newState).toBe('inert');
    expect(anyOutcome.quarantined).toBe(false);
  });
});

describe('Events smoke test -- a full run resolving Events with real choices', () => {
  it('resolves headlessly with a non-default EventChoiceStrategy active', () => {
    // Prefers a gamble choice when one exists, else the first choice --
    // exercises grant/bonus-fight resolution for real if the run
    // actually visits an Event node.
    const preferGamble: EventChoiceStrategy = (event) => event.choices.find((c) => c.riskTier === 'gamble') ?? event.choices[0];
    const result = playRun({
      seed: 13,
      classId: 'breacher',
      layerNodeCounts: [6, 6, 6, 6],
      eventChoiceStrategy: preferGamble,
    });
    expect(['heatMaxed', 'quarantined', 'noRouteRemains', 'victory']).toContain(result.outcome);
    // Every 'event' encounter in the log resolved to a well-formed
    // outcome -- inert, non-quarantining, with an eventGrant object
    // present (even if empty).
    const eventEncounters = result.log.filter((e) => e.type === 'encounter' && e.nodeType === 'event');
    for (const e of eventEncounters) {
      if (e.type !== 'encounter') continue;
      expect(e.outcome.newState).toBe('inert');
      expect(e.outcome.quarantined).toBe(false);
      expect(e.outcome.eventGrant).toBeDefined();
    }
  });

  it('resolves headlessly with Burners carried/used and Events resolved together in the same run (checkpoint J, full spec closer)', () => {
    const preferGamble: EventChoiceStrategy = (event) => event.choices.find((c) => c.riskTier === 'gamble') ?? event.choices[0];
    const result = playRun({
      seed: 21,
      classId: 'breacher',
      layerNodeCounts: [8, 8, 8, 8],
      eventChoiceStrategy: preferGamble,
      carriedBurnerIdsOverride: ['flash-drive', 'ghost-protocol', 'stolen-coupon'],
      burnerActivationStrategies: [(ctx) => ctx.availableBurnerIds[0] ?? null, () => null],
      mapBurnerStrategy: (ctx) => (ctx.availableBurnerIds.length > 0 ? { burnerId: ctx.availableBurnerIds[0], targetNodeId: ctx.closedNodeIds[0] } : null),
      shopBurnerStrategy: (available) => available[0] ?? null,
    });
    expect(['heatMaxed', 'quarantined', 'noRouteRemains', 'victory']).toContain(result.outcome);

    const eventEncounters = result.log.filter((e) => e.type === 'encounter' && e.nodeType === 'event');
    for (const e of eventEncounters) {
      if (e.type !== 'encounter') continue;
      expect(e.outcome.newState).toBe('inert');
    }
    // At least one Burner activation happened somewhere -- combat fire,
    // map activation, or shop coupon spend.
    const combatActivations = result.log.filter((e) => e.type === 'encounter' && e.outcome.burnersUsedThisCombat.length > 0);
    const mapActivations = result.log.filter((e) => e.type === 'mapBurnerActivated');
    const shopActivations = result.log.filter((e) => e.type === 'encounter' && e.outcome.shopBurnerUsed !== null);
    expect(combatActivations.length + mapActivations.length + shopActivations.length).toBeGreaterThan(0);
  });
});
