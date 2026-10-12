// Session 51 port: fixtures rewritten to the alpha/beta subroutine model
// (subroutine-types.ts). Merge now upgrades the beta, so the trigger-easing,
// payload-scaling and decay tests are gone with the mechanics they covered;
// the session 48 Tempo invariant is re-asserted against the new rules, and
// enemy scaling (now scaledDefinition) is covered in subroutines.test.ts.
import { describe, it, expect } from 'vitest';
import { playRun, opportunisticTraversal, type RunPlayerState } from './run';
import { scaledDefinition, type Archetype, type Beta, type SubroutineDefinition } from './subroutine-types';
import {
  mergeSubroutine,
  preferMergeWhenAvailable,
  opportunisticSafehouseStrategy,
  pickMergeTarget,
  upgradedDefinition,
  MERGE_MAGNITUDE_BONUS,
  MERGE_TEMPO_BONUS,
  MERGE_RANK_CAP,
  synergyAwareMergeTarget,
} from './merge';
import { HEAT_HIGH_FRACTION, layerHeatAllowance } from './heat';

// Session 52: Heat is a per-layer allowance; a player state built outside a
// run plans against layer 1's (heat.ts's currentHeatCeiling).
const HEAT_MAX = layerHeatAllowance(0);

function playerState(overrides: Partial<RunPlayerState> = {}): RunPlayerState {
  return {
    classId: 'exploit-honeypot',
    installedLoadout: [],
    bench: [],
    data: 0,
    material: {},
    rank: {},
    ownedModIds: [],
    grantedByMod: {},
    maxHeatBonus: 0,
    modRunState: {},
    carriedBurnerIds: [],
    ...overrides,
  };
}

function piece(id: string, overrides: Partial<SubroutineDefinition> = {}): SubroutineDefinition {
  return {
    id,
    name: id,
    archetype: 'exploit',
    alpha: { verb: 'credit', amount: 2 },
    beta: { source: 'cards', category: 'fifteen', shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 } },
    ...overrides,
  };
}

/** A Disrupt beta -- the one effect with no amount, so Merge loosens its
 * shape instead. `shape` overrides the default stepped-at-2. */
function disruptBeta(shape: Partial<Beta> = {}): Beta {
  return { source: 'cards', category: 'pair', shape: 'stepped', at: 2, effect: { verb: 'disrupt', action: 'forceDiscard' }, ...shape } as Beta;
}

describe('upgradedDefinition -- Tempo amounts are fractions, not point counts (session 48)', () => {
  it('applies the fraction-denominated bonus to a Tempo beta, never the flat one', () => {
    // The flat bonus is a gauge-point count. Added to a Tempo fraction it
    // would mean "plus a whole extra turn" -- the exact runaway
    // pointsCooldown exists to contain.
    const haste = piece('haste', {
      beta: { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: { verb: 'tempo', target: 'own', mode: 'threshold', amount: 1 / 2 } },
    });
    expect(upgradedDefinition(haste).beta!.effect).toEqual({ verb: 'tempo', target: 'own', mode: 'threshold', amount: 1 / 2 + 1 / 8 });
    expect(MERGE_TEMPO_BONUS).toBeLessThan(MERGE_MAGNITUDE_BONUS);
  });

  it('applies the fraction-denominated bonus to a Tempo alpha on a beta-less piece', () => {
    const slow = piece('slow', { alpha: { verb: 'tempo', target: 'opponent', mode: 'gauge', amount: 1 / 8 }, beta: undefined });
    expect(upgradedDefinition(slow).alpha).toEqual({ verb: 'tempo', target: 'opponent', mode: 'gauge', amount: 1 / 8 + 1 / 8 });
  });

  it('still applies the flat bonus to a non-Tempo beta on a Tempo-alpha piece -- the split is per-effect, not per-piece', () => {
    // Turbo's shape: a Tempo alpha with a Credit beta. The beta is a real
    // point count and gets the flat bonus; the alpha is left alone.
    const turbo = piece('turbo', {
      archetype: 'overclock',
      alpha: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 1 / 8 },
      beta: { source: 'cards', category: 'suit', shape: 'immediate', at: 4, effect: { verb: 'credit', amount: 3 } },
    });
    const upgraded = upgradedDefinition(turbo);
    expect(upgraded.beta!.effect).toEqual({ verb: 'credit', amount: 4 }); // +1 (MERGE_MAGNITUDE_BONUS)
    expect(upgraded.alpha).toEqual(turbo.alpha);
  });

  it('leaves multiplicative scaling alone -- a multiplier is unit-agnostic', () => {
    const tempo = piece('t', { alpha: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 1 / 2 }, beta: undefined });
    expect(scaledDefinition(tempo, 2).alpha).toEqual({ verb: 'tempo', target: 'own', mode: 'gauge', amount: 1 });
  });
});

describe('upgradedDefinition -- Disrupt betas loosen their shape (session 51)', () => {
  it("lowers a stepped beta's `at` by one", () => {
    const upgraded = upgradedDefinition(piece('d', { beta: disruptBeta({ shape: 'stepped', at: 3 } as Partial<Beta>) }));
    expect(upgraded.beta).toMatchObject({ shape: 'stepped', at: 2 });
  });

  it("raises a graded beta's cap by one", () => {
    const upgraded = upgradedDefinition(piece('d', { beta: disruptBeta({ shape: 'graded', cap: 3 } as Partial<Beta>) }));
    expect(upgraded.beta).toMatchObject({ shape: 'graded', cap: 4 });
  });

  it("lowers an immediate beta's `at` by one", () => {
    const upgraded = upgradedDefinition(piece('d', { beta: disruptBeta({ shape: 'immediate', at: 2 } as Partial<Beta>) }));
    expect(upgraded.beta).toMatchObject({ shape: 'immediate', at: 1 });
  });

  it('a stepped or immediate beta already at `at` 1 has nothing to loosen, so the rank goes to the alpha instead of being wasted', () => {
    // Session 51 review fix: loosenedShape used to build a new object even
    // at the floor, so upgradedDefinition thought it had loosened something
    // and the rank did nothing at all.
    for (const shape of [{ shape: 'stepped', at: 1 }, { shape: 'immediate', at: undefined }, { shape: 'immediate', at: 1 }]) {
      const original = piece('d', { beta: disruptBeta(shape as Partial<Beta>) });
      const upgraded = upgradedDefinition(original);
      expect(upgraded.beta, JSON.stringify(shape)).toBe(original.beta);
      expect(upgraded.alpha, JSON.stringify(shape)).toEqual({ verb: 'credit', amount: 3 }); // +1 (MERGE_MAGNITUDE_BONUS)
    }
  });

  it('an enhance beta on a Tempo alpha gets the fractional bonus, never a flat +1 (session 48)', () => {
    // An enhance adds to its alpha's amount, so on a Tempo alpha it is
    // denominated in turns: a flat +1 would be a whole extra turn.
    const original: SubroutineDefinition = {
      id: 'tempo-enhance',
      name: 'tempo-enhance',
      archetype: 'overclock',
      alpha: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 1 / 8 },
      beta: { source: 'cards', category: 'go', shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 / 8 } },
    };
    expect(upgradedDefinition(original).beta!.effect).toEqual({ verb: 'enhance', amount: 1 / 8 + MERGE_TEMPO_BONUS });
  });

  it('keeps the Disrupt effect and leaves the alpha alone when the shape loosens', () => {
    const original = piece('d', { beta: disruptBeta() });
    const upgraded = upgradedDefinition(original);
    expect(upgraded.beta!.effect).toEqual({ verb: 'disrupt', action: 'forceDiscard' });
    expect(upgraded.alpha).toEqual(original.alpha);
  });

  it('upgrades the alpha instead for a whileTrue Disrupt beta, which has no shape knob', () => {
    const original = piece('d', {
      beta: { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: { verb: 'disrupt', action: 'revealCrib' } },
    });
    const upgraded = upgradedDefinition(original);
    expect(upgraded.beta).toBe(original.beta);
    expect(upgraded.alpha).toEqual({ verb: 'credit', amount: 3 }); // +1 (MERGE_MAGNITUDE_BONUS)
  });

  it('is a true no-op for a piece with no magnitude anywhere (Disrupt alpha, no beta)', () => {
    const original = piece('d', { alpha: { verb: 'disrupt', action: 'revealHand' }, beta: undefined });
    expect(upgradedDefinition(original)).toEqual(original);
  });
});

describe('mergeSubroutine', () => {
  it('improves a magnitude-bearing beta in place on the bench', () => {
    const state = playerState({ bench: [piece('a')], material: { a: 1 } });
    const result = mergeSubroutine(state, 'a');
    expect(result.bench[0].beta!.effect).toEqual({ verb: 'enhance', amount: 2 }); // +1 (MERGE_MAGNITUDE_BONUS)
    expect(result.bench[0].alpha).toEqual({ verb: 'credit', amount: 2 }); // the alpha is the piece's identity -- untouched
    expect(result.material.a).toBe(0);
    expect(result.rank.a).toBe(1);
  });

  it('improves a magnitude-bearing beta in place when installed instead', () => {
    const state = playerState({ installedLoadout: [piece('a')], material: { a: 1 } });
    const result = mergeSubroutine(state, 'a');
    expect(result.installedLoadout[0].beta!.effect).toEqual({ verb: 'enhance', amount: 2 });
  });

  it("improves a beta-less Ward piece's shield amount via its alpha -- a real magnitude", () => {
    const ward = piece('w', { archetype: 'honeypot', alpha: { verb: 'ward', amount: 7 }, beta: undefined });
    const state = playerState({ bench: [ward], material: { w: 1 } });
    const result = mergeSubroutine(state, 'w');
    expect(result.bench[0].alpha).toEqual({ verb: 'ward', amount: 8 }); // +1 (MERGE_MAGNITUDE_BONUS)
  });

  it('falls back to the shape knob for a beta with no amount (Disrupt)', () => {
    const state = playerState({ bench: [piece('d', { beta: disruptBeta() })], material: { d: 1 } });
    const result = mergeSubroutine(state, 'd');
    expect(result.bench[0].beta!.effect).toEqual({ verb: 'disrupt', action: 'forceDiscard' }); // unchanged
    expect(result.bench[0].beta).toMatchObject({ shape: 'stepped', at: 1 }); // -1
  });

  it('is a no-op when no material is banked for the id', () => {
    const state = playerState({ bench: [piece('a')], material: {} });
    expect(mergeSubroutine(state, 'a')).toEqual(state);
  });

  it('is a no-op when the id is not owned at all', () => {
    const state = playerState({ material: { a: 1 } });
    expect(mergeSubroutine(state, 'a')).toEqual(state);
  });

  it('is a no-op once rank is at MERGE_RANK_CAP', () => {
    const state = playerState({ bench: [piece('a')], material: { a: 5 }, rank: { a: MERGE_RANK_CAP } });
    expect(mergeSubroutine(state, 'a')).toEqual(state);
  });

  it('can be applied repeatedly up to the rank cap, each spending 1 material', () => {
    let state = playerState({ bench: [piece('a')], material: { a: MERGE_RANK_CAP + 2 } });
    for (let i = 0; i < MERGE_RANK_CAP; i++) state = mergeSubroutine(state, 'a');
    expect(state.rank.a).toBe(MERGE_RANK_CAP);
    expect(state.material.a).toBe(2); // 2 banked merges left unspent, capped out
    const capped = mergeSubroutine(state, 'a');
    expect(capped).toEqual(state); // further merges are no-ops
  });
});

describe('preferMergeWhenAvailable', () => {
  it("chooses 'merge' when any material is banked", () => {
    expect(preferMergeWhenAvailable(playerState({ material: { a: 1 } }), 0)).toBe('merge');
  });

  it("chooses 'rest' when nothing is banked", () => {
    expect(preferMergeWhenAvailable(playerState({ material: {} }), 0)).toBe('rest');
    expect(preferMergeWhenAvailable(playerState({ material: { a: 0 } }), 0)).toBe('rest');
  });
});

describe('opportunisticSafehouseStrategy', () => {
  const heatHigh = Math.ceil(HEAT_HIGH_FRACTION * HEAT_MAX);
  const heatLow = 0;

  it("chooses 'rest' when Heat is high, even with material banked -- Heat wins the tie", () => {
    expect(opportunisticSafehouseStrategy(playerState({ material: { a: 1 } }), heatHigh)).toBe('rest');
  });

  it("chooses 'merge' when material is banked and Heat is not high", () => {
    expect(opportunisticSafehouseStrategy(playerState({ material: { a: 1 } }), heatLow)).toBe('merge');
  });

  it("chooses 'rest' when Heat is high and nothing is banked", () => {
    expect(opportunisticSafehouseStrategy(playerState({ material: {} }), heatHigh)).toBe('rest');
  });

  it("chooses 'rest' when Heat is not high and nothing is banked", () => {
    expect(opportunisticSafehouseStrategy(playerState({ material: {} }), heatLow)).toBe('rest');
  });

  it('respects a raised max Heat (maxHeatBonus) when judging whether Heat counts as high', () => {
    // heatHigh is exactly the threshold for the unraised cap -- with the
    // cap raised, that same absolute Heat value is no longer "high"
    // relative to the new max, so material should win instead.
    expect(opportunisticSafehouseStrategy(playerState({ material: { a: 1 }, maxHeatBonus: 100 }), heatHigh)).toBe('merge');
  });
});

describe('pickMergeTarget', () => {
  it('picks the id with the most banked material', () => {
    expect(pickMergeTarget(playerState({ material: { a: 1, b: 3, c: 2 } }))).toBe('b');
  });

  it('returns null when nothing is banked', () => {
    expect(pickMergeTarget(playerState({ material: {} }))).toBeNull();
    expect(pickMergeTarget(playerState({ material: { a: 0 } }))).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint E) -- the
// synergy-aware Merge target.
// ---------------------------------------------------------------------

function mergePiece(id: string, archetype: Archetype, alpha: SubroutineDefinition['alpha'], beta?: Beta): SubroutineDefinition {
  return { id, name: id, archetype, alpha, beta };
}

const CREDIT = { verb: 'credit', amount: 3 } as const;
const DEFENSIVE = { verb: 'ward', amount: 3 } as const;

describe('synergyAwareMergeTarget', () => {
  it('prefers an installed piece over a benched one with more banked material', () => {
    // Rung 1, and the case a literal reuse of the acquisition ladder
    // would have gotten backwards -- merging a benched piece upgrades
    // something that never fires.
    const state = playerState({
      installedLoadout: [mergePiece('installed', 'exploit', CREDIT)],
      bench: [mergePiece('benched', 'exploit', CREDIT)],
      material: { installed: 1, benched: 5 },
    });
    expect(pickMergeTarget(state)).toBe('benched'); // the old criterion
    expect(synergyAwareMergeTarget(state)).toBe('installed');
  });

  it('prefers a credit-capable installed piece over a defensive-only one', () => {
    const state = playerState({
      installedLoadout: [mergePiece('ward', 'honeypot', DEFENSIVE), mergePiece('hit', 'exploit', CREDIT)],
      material: { ward: 3, hit: 1 },
    });
    expect(pickMergeTarget(state)).toBe('ward');
    expect(synergyAwareMergeTarget(state)).toBe('hit');
  });

  it('counts a credit path through the beta (hasCreditPath), not just a Credit alpha', () => {
    // Tarpit's shape: a Ward alpha whose beta converts banked Ward into
    // credit. It can push toward a win, so it outranks a pure Ward.
    const converter: Beta = {
      source: 'state',
      condition: { kind: 'wardAbove', amount: 6 },
      shape: 'whileTrue',
      effect: { verb: 'credit', amount: 3, from: 'ward' },
    };
    const state = playerState({
      installedLoadout: [mergePiece('ward', 'honeypot', DEFENSIVE), mergePiece('tarpit', 'honeypot', DEFENSIVE, converter)],
      material: { ward: 3, tarpit: 1 },
    });
    expect(pickMergeTarget(state)).toBe('ward');
    expect(synergyAwareMergeTarget(state)).toBe('tarpit');
  });

  it('prefers on-archetype when installed and credit-capability tie', () => {
    // exploit-honeypot, so 'daemon' is off-archetype.
    const state = playerState({
      installedLoadout: [mergePiece('off', 'daemon', CREDIT), mergePiece('on', 'exploit', CREDIT)],
      material: { off: 2, on: 1 },
    });
    expect(synergyAwareMergeTarget(state)).toBe('on');
  });

  it('falls back to banked material count as the tie-break', () => {
    const state = playerState({
      installedLoadout: [mergePiece('a', 'exploit', CREDIT), mergePiece('b', 'exploit', CREDIT)],
      material: { a: 1, b: 4 },
    });
    expect(synergyAwareMergeTarget(state)).toBe('b');
  });

  it('skips a rank-capped id the default would waste the visit on', () => {
    // mergeSubroutine refuses a rank-capped id outright, so
    // pickMergeTarget's answer here resolves to a no-op Safehouse visit
    // -- no Merge and no Rest. Declining lets it fall back to Rest.
    const state = playerState({
      installedLoadout: [mergePiece('capped', 'exploit', CREDIT)],
      material: { capped: 5 },
      rank: { capped: MERGE_RANK_CAP },
    });
    expect(pickMergeTarget(state)).toBe('capped');
    expect(mergeSubroutine(state, 'capped')).toEqual(state); // the wasted visit
    expect(synergyAwareMergeTarget(state)).toBeNull();
  });

  it('still picks a mergeable id when another owned id is rank-capped', () => {
    const state = playerState({
      installedLoadout: [mergePiece('capped', 'exploit', CREDIT), mergePiece('open', 'exploit', CREDIT)],
      material: { capped: 9, open: 1 },
      rank: { capped: MERGE_RANK_CAP },
    });
    expect(synergyAwareMergeTarget(state)).toBe('open');
  });

  it('returns null when nothing is banked', () => {
    expect(synergyAwareMergeTarget(playerState())).toBeNull();
  });

  it('ignores banked material for an id that is no longer owned', () => {
    const state = playerState({ material: { ghost: 3 } });
    expect(synergyAwareMergeTarget(state)).toBeNull();
  });
});

describe('mergeTargetStrategy wiring (checkpoint E)', () => {
  it('playRun routes the Safehouse Merge choice through the option', () => {
    // The threading this checkpoint added: resolveEncounter hardcoded
    // pickMergeTarget before now, so a custom strategy had no way in.
    // Asserting it is actually consulted, not merely accepted.
    // opportunisticTraversal actually pulls toward Safehouses, and an
    // always-Merge SafehouseStrategy guarantees the target choice is
    // reached -- preferMergeWhenAvailable returns 'rest' with nothing
    // banked, which short-circuits the call entirely.
    // Scans seeds rather than pinning one: whether a given run reaches a
    // Safehouse at all depends on map generation, and content changes move
    // which seeds do. The assertion is that playRun consults the strategy
    // when a Merge is chosen, not that seed N happens to route past one.
    const seen: RunPlayerState[] = [];
    const spy = (playerState: RunPlayerState): string | null => {
      seen.push(playerState);
      return pickMergeTarget(playerState);
    };
    for (let seed = 0; seed < 40 && seen.length === 0; seed++) {
      playRun({
        seed,
        classId: 'exploit-overclock',
        traversalStrategy: opportunisticTraversal,
        safehouseStrategy: () => 'merge',
        mergeTargetStrategy: spy,
      });
    }
    expect(seen.length).toBeGreaterThan(0);
  });

  it('defaults to pickMergeTarget when the option is omitted', () => {
    // Same seed, no strategy passed -- unchanged behavior for every
    // existing caller is the whole point of the append-at-the-end
    // default.
    const withDefault = playRun({ seed: 7, classId: 'exploit-overclock', safehouseStrategy: preferMergeWhenAvailable });
    const withExplicit = playRun({
      seed: 7,
      classId: 'exploit-overclock',
      safehouseStrategy: preferMergeWhenAvailable,
      mergeTargetStrategy: pickMergeTarget,
    });
    expect(withDefault.outcome).toBe(withExplicit.outcome);
    expect(withDefault.layersCompleted).toBe(withExplicit.layersCompleted);
  });
});
