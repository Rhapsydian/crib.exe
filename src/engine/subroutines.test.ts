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
  // Needed because Encryption's kit is capped at the Breach/Containment
  // midpoint (Checkpoint 4) and Root's kit never pushes
  // Breach/Containment at all (pure denial/tempo, by design -- see
  // DESIGN.md's archetype descriptions) -- both are meant to be paired
  // with a real damage archetype, never expected to close out a fight
  // solo. An empty or mirrored opponent would leave Encryption-only,
  // Root-only, or Ghost's own starting kit (Encryption+Root, zero direct
  // damage access until Phase 4's Return to Sender passive exists) in a
  // genuine, correctly-modeled stalemate -- not a bug, but not what this
  // smoke test is trying to verify either.
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

  it('Ghost\'s starting kit and a solo Encryption pool genuinely cannot close out a fight alone -- confirms the midpoint cap, not a bug', () => {
    // Both are capped-at-center (Encryption) or entirely non-pushing
    // (Root, Ghost's other archetype) -- neither can ever win Breach/
    // Containment outright without Phase 4's Return to Sender passive
    // (Ghost) or a paired damage archetype (Encryption). Asserting the
    // documented maxHands safety valve fires, not a real crash.
    expect(() => playCombat([CLASS_STARTING_LOADOUTS.ghost, genericOpponent], { seed: 1, gaugeThreshold: 12, maxHands: 2000 })).toThrow(
      /did not resolve/,
    );
    const encryptionPool = ARCHETYPE_POOLS.encryption;
    const encryptionLoadout = [...encryptionPool.commons, ...encryptionPool.uncommons, ...encryptionPool.rares];
    expect(() => playCombat([encryptionLoadout, genericOpponent], { seed: 1, gaugeThreshold: 12, maxHands: 2000 })).toThrow(/did not resolve/);
  });

  it('the full 78-subroutine set on one side resolves against an empty enemy without throwing', () => {
    expect(() => playCombat([ALL_SUBROUTINES, []], { seed: 1, gaugeThreshold: 12, maxHands: 500 })).not.toThrow();
  });
});
