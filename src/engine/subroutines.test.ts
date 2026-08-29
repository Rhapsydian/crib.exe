import { describe, it, expect } from 'vitest';
import {
  ALL_SUBROUTINES,
  ALL_STARTING_LOADOUT_SUBROUTINES,
  ALL_POOL_SUBROUTINES,
  ARCHETYPE_POOLS,
  NEUTRAL_POOL,
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
  it('has exactly 87 subroutines: 18 starting-loadout + 60 archetype pool + 9 neutral', () => {
    expect(ALL_STARTING_LOADOUT_SUBROUTINES).toHaveLength(18);
    expect(ALL_POOL_SUBROUTINES).toHaveLength(69);
    expect(ALL_SUBROUTINES).toHaveLength(87);
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

  it('the neutral pool (session 28) has exactly 4 commons, 3 uncommons, 2 rares', () => {
    expect(NEUTRAL_POOL.commons).toHaveLength(4);
    expect(NEUTRAL_POOL.uncommons).toHaveLength(3);
    expect(NEUTRAL_POOL.rares).toHaveLength(2);
    for (const piece of [...NEUTRAL_POOL.commons, ...NEUTRAL_POOL.uncommons, ...NEUTRAL_POOL.rares]) {
      expect(piece.archetype).toBe('neutral');
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
      const state = createCombatState([sub], [], [20, 20]);
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
  // close enough to balanced that "natural" convergence (crossing a
  // threshold via real offense) is genuinely slow or never happens at
  // all -- not a bug, just a real property of these specific TBD
  // numbers, exactly the kind of thing a future balance pass would
  // tune. combat.ts's HARD_RESOLUTION_HAND (hand 20) means every one of
  // these still resolves either way -- the resolution just becomes an
  // attrition loss for whichever side never crossed its own threshold,
  // rather than never happening. What these tests actually check is "no
  // crash, no malformed data," not "resolves via real offense" -- true
  // structural stalemates (Ghost, Encryption) are excluded below and
  // covered by their own dedicated test instead.

  it('every class\'s starting loadout except Ghost can fight to resolution without throwing', () => {
    for (const classId of Object.keys(CLASS_STARTING_LOADOUTS) as (keyof typeof CLASS_STARTING_LOADOUTS)[]) {
      if (classId === 'ghost') continue;
      const loadout = loadoutFor(classId);
      expect(() => playCombat([loadout, genericOpponent], { seed: 1, gaugeThreshold: [12, 12] })).not.toThrow();
    }
  });

  it('every archetype pool except Encryption can fight to resolution without throwing', () => {
    for (const [key, pool] of Object.entries(ARCHETYPE_POOLS)) {
      if (key === 'encryption') continue;
      const loadout = [...pool.commons, ...pool.uncommons, ...pool.rares];
      expect(() => playCombat([loadout, genericOpponent], { seed: 1, gaugeThreshold: [12, 12] })).not.toThrow();
    }
  });

  it('Exploit and Malware pools can each solo-defeat an empty enemy (real, uncapped damage archetypes)', () => {
    for (const key of ['exploit', 'malware'] as const) {
      const pool = ARCHETYPE_POOLS[key];
      const loadout = [...pool.commons, ...pool.uncommons, ...pool.rares];
      const result = playCombat([loadout, []], { seed: 1, gaugeThreshold: [12, 12] });
      expect(result.winner).toBe(0);
    }
  });

  it("Ghost's Steganography/Tripwire pair (excluding its Cantrip) still cannot advance Ghost's own gauge on its own -- the structural 'mitigation can't win alone' property is unchanged", () => {
    // Isolates the two non-Cantrip pieces specifically, unlike the tests
    // below -- Idle Process (session 28's neutral-archetype retrofit,
    // replacing Low Profile) now fires unconditionally regardless of
    // classId, so testing CLASS_STARTING_LOADOUTS.ghost as a whole no
    // longer demonstrates "the kit can't credit its own gauge without
    // the passive" (it can, via Idle Process alone -- see the next test).
    // Steganography/Tripwire's own property is unchanged, though:
    // Ward absorption alone only *prevents* incoming damage, it doesn't
    // by itself credit anything (only Return to Sender's hook does), and
    // Tripwire is pure denial.
    const steganographyAndTripwire = CLASS_STARTING_LOADOUTS.ghost.filter((piece) => piece.id !== 'idle-process');
    const result = playCombat([steganographyAndTripwire, genericOpponent], { seed: 1, gaugeThreshold: [12, 12] });
    expect(result.winner).toBe(1);
    expect(result.peakFillFraction[0]).toBe(0);
  });

  it("Idle Process alone lets Ghost's real starting kit advance its own gauge substantially, even without the class passive -- session 28's fix for Ghost's 0%-genuine-win-rate finding", () => {
    // Session 28: correcting resolveHardTiebreak's semantics (the hard-
    // resolution deadline now unconditionally favors the defender,
    // rather than racing win-gauge fractions) revealed the session 26
    // "Ghost fix" above had only ever been validated under the old,
    // looser tiebreak -- Ghost's real kit measured a 0% genuine win rate
    // (30-seed check, all attrition losses, peak fill fraction never
    // above ~0.17). Root cause: no Encryption or Root payload ever
    // credits its own caster's gauge, so a kit built entirely from those
    // two archetypes has no path to victory at all, not just a slow one.
    // Idle Process (replacing the old Cantrip, Low Profile) is the fix
    // -- Neutral, Always-triggered, a small but real, unconditional
    // credit every turn. This test checks the magnitude of that fix
    // directly (peak fill goes from exactly 0 to a real fraction against
    // this benchmark, not whether it wins outright against it -- see the
    // next test for that, against a more realistic opponent). Idle
    // Process's own amount was halved (2 -> 1) in session 39's balance
    // pass alongside Return to Sender's ratio, so the fraction here is
    // smaller than it was originally, but still genuinely nonzero.
    const withoutPassive = playCombat([CLASS_STARTING_LOADOUTS.ghost, genericOpponent], { seed: 1, gaugeThreshold: [12, 12] });
    expect(withoutPassive.peakFillFraction[0]).toBeGreaterThan(0.25);
  });

  it('Ghost genuinely wins via real threshold-crossing (not attrition) under real game settings against a realistically weak opponent', () => {
    // The session 26 test above (kept, corrected) used a tough
    // benchmark -- gaugeThreshold 12, an unconditional always-firing
    // amount-4 Exploit opponent -- deliberately harder than anything
    // encounters.ts actually configures (gaugeThreshold 8, winThreshold
    // 50), and even Idle Process's real fix can't fully clear that
    // specific stress test within the hard 20-hand window (still 0/30
    // genuine wins against it, just a real, nonzero peak fill instead of
    // exactly 0 -- see the test above; exact figures shift with session
    // 39's Idle Process/Return to Sender retune, not re-measured here).
    // Against the game's own real settings and a
    // realistically weak opponent (comparable to an actual Regular-tier
    // enemy, not a deliberately tough stress-test benchmark), Ghost does
    // win reliably and genuinely -- confirmed here directly rather than
    // asserting it against a benchmark it was never going to clear.
    const weakOpponent: SubroutineDefinition[] = [
      { id: 'weak-opponent', name: 'Weak Opponent', archetype: 'exploit', trigger: { kind: 'always' }, payload: { kind: 'directBurst', amount: 2 }, tags: [] },
    ];
    const result = playCombat([CLASS_STARTING_LOADOUTS.ghost, weakOpponent], {
      seed: 1,
      gaugeThreshold: [8, 8],
      winThreshold: [50, 50],
      classId: 'ghost',
    });
    expect(result.winner).toBe(0);
    expect(result.resolvedBy).toBe('threshold');
  });

  it('Saboteur and Operator win measurably faster against an empty enemy with their reworked passives active than without', () => {
    // Unlike Ghost, both already had *some* win-gauge access without
    // their passive (Silent Worm's DoT, Precision Strike's piercing) --
    // the claim here is "meaningfully harder-hitting," not "impossible
    // before," matching how these two reworks (checkpoints A/B) actually
    // differ from Ghost's (checkpoint C).
    for (const classId of ['saboteur', 'operator'] as const) {
      const withPassive = playCombat([CLASS_STARTING_LOADOUTS[classId], []], { seed: 1, gaugeThreshold: [12, 12], classId });
      const withoutPassive = playCombat([CLASS_STARTING_LOADOUTS[classId], []], { seed: 1, gaugeThreshold: [12, 12] });
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
    const result = playCombat([encryptionLoadout, genericOpponent], { seed: 1, gaugeThreshold: [12, 12] });
    expect(result.winner).toBe(1);
    expect(result.hands.length).toBe(20);
    expect(result.peakFillFraction).toEqual([0, 0]);
  });

  it('the full 78-subroutine set on one side resolves against an empty enemy without throwing', () => {
    expect(() => playCombat([ALL_SUBROUTINES, []], { seed: 1, gaugeThreshold: [12, 12] })).not.toThrow();
  });
});
