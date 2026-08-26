import { describe, it, expect } from 'vitest';
import {
  ALL_SUBROUTINES,
  ALL_STARTING_LOADOUT_SUBROUTINES,
  ALL_POOL_SUBROUTINES,
  ARCHETYPE_POOLS,
  CLASS_STARTING_LOADOUTS,
} from './subroutines';
import { createCombatState, resolvePayload } from './resolve';
import { playCombat } from './combat';
import type { SubroutineDefinition } from './subroutine-types';

describe('subroutine content — Root mechanical redesign (session 24 checkpoint F)', () => {
  it('real content exercises every new Root payload kind, not just engine capability', () => {
    const kinds = new Set(ALL_SUBROUTINES.map((s) => s.payload.kind));
    expect(kinds.has('revealOpponentHand')).toBe(true);
    expect(kinds.has('revealCrib')).toBe(true);
    expect(kinds.has('revealOpponentKeptHand')).toBe(true);
    expect(kinds.has('forceDiscardCard')).toBe(true);
  });

  it('real content exercises both haste targets (ownGauge/ownGaugeThreshold)', () => {
    const targets = ALL_SUBROUTINES.filter((s) => s.payload.kind === 'instantManipulation').map((s) =>
      s.payload.kind === 'instantManipulation' ? s.payload.target : null,
    );
    expect(targets).toContain('ownGauge');
    expect(targets).toContain('ownGaugeThreshold');
  });

  it('every firesAt-tagged subroutine uses one of the three real hand-lifecycle moments and is never also reactive', () => {
    for (const sub of ALL_SUBROUTINES) {
      if (!sub.firesAt) continue;
      expect(['onDealt', 'onCribSelected', 'onPlayPhaseStart']).toContain(sub.firesAt);
      expect(sub.reactive).toBeFalsy();
    }
  });
});

describe('subroutine content — structural integrity', () => {
  it('has exactly 78 subroutines: 18 starting-loadout + 60 pool', () => {
    expect(ALL_STARTING_LOADOUT_SUBROUTINES).toHaveLength(18);
    expect(ALL_POOL_SUBROUTINES).toHaveLength(60);
    expect(ALL_SUBROUTINES).toHaveLength(78);
  });

  it('every class starting loadout has exactly 3 pieces', () => {
    for (const loadout of Object.values(CLASS_STARTING_LOADOUTS)) {
      expect(loadout).toHaveLength(3);
    }
  });

  it('every archetype pool has exactly 7 commons, 5 uncommons, 3 rares', () => {
    for (const pool of Object.values(ARCHETYPE_POOLS)) {
      expect(pool.commons).toHaveLength(7);
      expect(pool.uncommons).toHaveLength(5);
      expect(pool.rares).toHaveLength(3);
    }
  });

  it('every id is globally unique', () => {
    const ids = ALL_SUBROUTINES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every id is non-empty kebab-case, matching its own name loosely', () => {
    for (const sub of ALL_SUBROUTINES) {
      expect(sub.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('every Chained trigger references a real subroutine id', () => {
    const ids = new Set(ALL_SUBROUTINES.map((s) => s.id));
    for (const sub of ALL_SUBROUTINES) {
      if (sub.trigger.kind === 'chained') {
        expect(ids.has(sub.trigger.afterSubroutineId)).toBe(true);
      }
    }
  });

  it('every subroutineProgress instantManipulation references a real subroutine id', () => {
    const ids = new Set(ALL_SUBROUTINES.map((s) => s.id));
    for (const sub of ALL_SUBROUTINES) {
      if (sub.payload.kind === 'instantManipulation' && sub.payload.target === 'subroutineProgress') {
        expect(sub.payload.targetSubroutineId).toBeDefined();
        expect(ids.has(sub.payload.targetSubroutineId as string)).toBe(true);
      }
    }
  });

  it('every suitTally accumulator trigger has a suit in range 0-3', () => {
    for (const sub of ALL_SUBROUTINES) {
      if (sub.trigger.kind === 'accumulator' && sub.trigger.metric === 'suitTally') {
        expect(sub.trigger.suit).toBeGreaterThanOrEqual(0);
        expect(sub.trigger.suit).toBeLessThanOrEqual(3);
      }
    }
  });

  it('every markSuit cribbageLayerManipulation payload specifies a suit', () => {
    for (const sub of ALL_SUBROUTINES) {
      if (sub.payload.kind === 'cribbageLayerManipulation' && sub.payload.action === 'markSuit') {
        expect(sub.payload.suit).toBeDefined();
      }
    }
  });

  it('every occurrence Threshold/Scaling trigger carries the required extra field', () => {
    for (const sub of ALL_SUBROUTINES) {
      if (sub.trigger.kind === 'occurrence') {
        if (sub.trigger.variation === 'threshold') expect(sub.trigger.bankTarget).toBeGreaterThan(0);
        if (sub.trigger.variation === 'scaling') expect(sub.trigger.cap).toBeGreaterThan(0);
      }
    }
  });
});

describe('subroutine content — every payload resolves without throwing', () => {
  it('resolvePayload succeeds for every subroutine, cast from either side', () => {
    for (const sub of ALL_SUBROUTINES) {
      const state = createCombatState([sub], [], 20);
      expect(() => resolvePayload(sub.payload, sub.archetype, state, 0)).not.toThrow();
      expect(() => resolvePayload(sub.payload, sub.archetype, state, 1)).not.toThrow();
    }
  });
});

describe('subroutine content — real combat smoke tests', () => {
  function loadoutFor(id: keyof typeof CLASS_STARTING_LOADOUTS): SubroutineDefinition[] {
    return CLASS_STARTING_LOADOUTS[id];
  }

  // A modest, always-firing opponent -- not empty and not a mirror.
  // Needed because Encryption's kit only ever reduces the *opponent's*
  // gauge (session 22+ redesign) and Root's kit never touches either
  // gauge at all (pure denial/tempo, by design -- see DESIGN.md's
  // archetype descriptions) -- both are meant to be paired with a real
  // damage archetype, never expected to advance their own gauge solo.
  // An empty or mirrored opponent would leave Encryption-only,
  // Root-only, or Ghost's own starting kit (Encryption+Root, zero direct
  // damage access until Phase 4's Return to Sender passive exists) with
  // nothing to actually verify -- see the dedicated test below instead,
  // which checks the real invariant (their own gauge never advances)
  // directly rather than via a timeout.
  const genericOpponent: SubroutineDefinition[] = [
    { id: 'test-opponent', name: 'Test Opponent', archetype: 'exploit', trigger: { kind: 'always' }, payload: { kind: 'directBurst', amount: 4 }, tags: [] },
  ];

  // These placeholder magnitudes happen to put a couple of matchups
  // close enough to balanced that convergence is genuinely slow (e.g.
  // Breacher vs. genericOpponent takes ~3000 hands, not a bug -- just a
  // real property of these specific TBD numbers, exactly the kind of
  // thing a future balance pass would tune). A generous maxHands
  // accommodates that without weakening what this test actually checks
  // (no crash, no malformed data), while still catching a true
  // structural stalemate (Ghost, Encryption -- excluded below, covered
  // by their own dedicated test instead).
  const GENEROUS_MAX_HANDS = 20_000;

  it('every class\'s starting loadout except Ghost can fight to resolution without throwing', () => {
    for (const classId of Object.keys(CLASS_STARTING_LOADOUTS) as (keyof typeof CLASS_STARTING_LOADOUTS)[]) {
      if (classId === 'ghost') continue;
      const loadout = loadoutFor(classId);
      expect(() => playCombat([loadout, genericOpponent], { seed: 1, gaugeThreshold: 12, maxHands: GENEROUS_MAX_HANDS })).not.toThrow();
    }
  });

  it('every archetype pool except Encryption can fight to resolution without throwing', () => {
    for (const [key, pool] of Object.entries(ARCHETYPE_POOLS)) {
      if (key === 'encryption') continue;
      const loadout = [...pool.commons, ...pool.uncommons, ...pool.rares];
      expect(() => playCombat([loadout, genericOpponent], { seed: 1, gaugeThreshold: 12, maxHands: GENEROUS_MAX_HANDS })).not.toThrow();
    }
  });

  it('Exploit and Malware pools can each solo-defeat an empty enemy (real, uncapped damage archetypes)', () => {
    for (const key of ['exploit', 'malware'] as const) {
      const pool = ARCHETYPE_POOLS[key];
      const loadout = [...pool.commons, ...pool.uncommons, ...pool.rares];
      const result = playCombat([loadout, []], { seed: 1, gaugeThreshold: 12, maxHands: 500 });
      expect(result.winner).toBe(0);
    }
  });

  it("Ghost's bare starting kit, without its class passive, genuinely cannot advance its own gauge -- confirms the redesign's structural 'mitigation can't win alone' property, not a bug", () => {
    // Encryption+Root, zero direct damage access -- deliberately omits
    // classId here to isolate the kit's own three pieces from Return to
    // Sender (see the dedicated test right below for the passive's real,
    // reworked effect). Under the pre-redesign shared scalar this meant
    // the match hung forever (asserted via a maxHands timeout); under the
    // two-gauge model escalation (checkpoint B) still resolves the match
    // once the opponent's own shrinking threshold becomes reachable
    // (Ghost's 3 starting pieces cast no Ward at all, so the opponent's
    // hits go through freely), so a timeout is no longer the right signal
    // here -- the real invariant is that Ghost's own gauge progress never
    // advances at all without the passive, checked directly.
    const result = playCombat([CLASS_STARTING_LOADOUTS.ghost, genericOpponent], { seed: 1, gaugeThreshold: 12, maxHands: GENEROUS_MAX_HANDS });
    expect(result.winner).toBe(1); // Ghost never wins
    expect(result.peakFillFraction[0]).toBe(0); // Ghost's own gauge never moves
  });

  it("Ghost's real starting kit, with the reworked Return to Sender active, still can't touch its own gauge within the new hard-resolution window -- a real, structural consequence of the hard deadline, not a regression in the passive itself", () => {
    // Session 25's original claim here was "wins outright" (189 hands,
    // pre-hard-resolution) -- Null Session's instantCounterPush gave
    // Ghost a real, previously-impossible way to credit its own gauge.
    // That mechanism is still real; it just can't be demonstrated
    // inside a 20-hand cap in *this specific* matchup. Null Session's
    // trigger (`enemyState: breachContainmentAbove, value: high` --
    // subroutines.ts) is a late-game "counter-punch as they're about to
    // win" design: it only arms once the *enemy's own* fill percentage
    // is already high. Against genericOpponent's slow, flat
    // accumulation (amount 4/turn, no escalation-driven acceleration of
    // its own), the enemy's fill percentage never gets there within 20
    // hands -- confirmed empirically across 100 sampled seeds, none of
    // which showed Ghost's fill fraction rising above 0 even with the
    // passive active. So both with and without the passive, Ghost's own
    // gauge stays at exactly 0 here, and the hard-resolution tiebreak's
    // defender-wins-ties rule decides it in the enemy's favor either
    // way -- same mechanism, same outcome, as the bare-kit test above.
    //
    // Real, worth flagging for the next tuning pass: a starting passive
    // whose only reachable trigger is inherently late-firing doesn't
    // get a fair chance to prove itself under a hard 20-hand deadline.
    // Either Return to Sender needs an earlier-arming hook, or Ghost's
    // matchups need to reach meaningful enemy fill percentage faster,
    // for this class to actually benefit from its own rework in
    // practice now that "sudden death by hand 20" is a hard rule, not
    // just a soft aspiration.
    const withPassive = playCombat([CLASS_STARTING_LOADOUTS.ghost, genericOpponent], {
      seed: 1,
      gaugeThreshold: 12,
      maxHands: GENEROUS_MAX_HANDS,
      classId: 'ghost',
    });
    expect(withPassive.winner).toBe(1);
    expect(withPassive.peakFillFraction[0]).toBe(0);
  });

  it('Saboteur and Operator win measurably faster against an empty enemy with their reworked passives active than without', () => {
    // Unlike Ghost, both already had *some* win-gauge access without
    // their passive (Silent Worm's DoT, Precision Strike's piercing) --
    // the claim here is "meaningfully harder-hitting," not "impossible
    // before," matching how these two reworks (checkpoints A/B) actually
    // differ from Ghost's (checkpoint C).
    for (const classId of ['saboteur', 'operator'] as const) {
      const withPassive = playCombat([CLASS_STARTING_LOADOUTS[classId], []], { seed: 1, gaugeThreshold: 12, maxHands: GENEROUS_MAX_HANDS, classId });
      const withoutPassive = playCombat([CLASS_STARTING_LOADOUTS[classId], []], { seed: 1, gaugeThreshold: 12, maxHands: GENEROUS_MAX_HANDS });
      expect(withPassive.winner).toBe(0);
      expect(withoutPassive.winner).toBe(0);
      expect(withPassive.hands.length).toBeLessThan(withoutPassive.hands.length);
    }
  });

  it('a solo Encryption pool genuinely deadlocks against a weak opponent -- the hard-resolution tiebreak (session 26) now resolves it in the defender\'s favor rather than letting it run forever', () => {
    // Unlike Ghost's minimal kit, the FULL Encryption pool includes 4
    // dedicated Ward-casters (Sandboxing, Access Control, Honeypot, Air
    // Gap) -- stacked together they build an ever-growing shield that
    // outpaces this weak opponent's single small burst indefinitely, so
    // the opponent's hits never land either. Both sides' progress stays
    // at exactly 0 forever, and escalation (checkpoint B) only shrinks
    // *thresholds* -- it can't force either gauge upward, so it can't
    // rescue a genuine zero-progress deadlock on its own.
    //
    // This used to throw ("did not resolve") after running out
    // GENEROUS_MAX_HANDS -- flagged at the time as a real gap the plan
    // anticipated. Session 26's hard resolution deadline closes it: at
    // the end of hand 20, both sides are still tied at exactly 0
    // progress, so the tiebreak's defender-wins-ties rule ("if you
    // can't breach in time, you're getting contained") decides it --
    // exactly the scenario that rule exists for. A 15-piece pool thrown
    // at one weak opponent is also a more extreme matchup than real
    // installed loadouts (capped at 6 -- checkpoint D) ever produce, so
    // this specific case is more test-construction artifact than a
    // realistic in-game risk.
    const encryptionPool = ARCHETYPE_POOLS.encryption;
    const encryptionLoadout = [...encryptionPool.commons, ...encryptionPool.uncommons, ...encryptionPool.rares];
    const result = playCombat([encryptionLoadout, genericOpponent], { seed: 1, gaugeThreshold: 12, maxHands: GENEROUS_MAX_HANDS });
    expect(result.winner).toBe(1);
    expect(result.hands.length).toBe(20);
    expect(result.peakFillFraction).toEqual([0, 0]);
  });

  it('the full 78-subroutine set on one side resolves against an empty enemy without throwing', () => {
    expect(() => playCombat([ALL_SUBROUTINES, []], { seed: 1, gaugeThreshold: 12, maxHands: 500 })).not.toThrow();
  });
});
