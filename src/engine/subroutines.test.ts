import { describe, it, expect } from 'vitest';
import { ALL_POOL_SUBROUTINES, ARCHETYPE_POOLS, CLASS_STARTING_LOADOUTS } from './subroutines';
import { ALL_CLASS_IDS, CLASS_DEFINITIONS } from './classes';
import {
  ARCHETYPES,
  ARCHETYPE_SUITS,
  SUIT_ARCHETYPES,
  effectAmount,
  hasCreditPath,
  isValidBeta,
  scaledDefinition,
  type SubroutineDefinition,
} from './subroutine-types';

// Session 51: the old 157-piece content guards (pool sizes per archetype,
// tags, chained/progress-pump references, per-class smoke fights) retired
// with the content they guarded. What replaces them are the STRUCTURAL
// rules of the alpha/beta model -- written to keep holding once step 3
// authors real content in place of the skeleton pool. Real-combat smoke
// tests return with checkpoint 3, when the resolver speaks the new model.

const allPieces: SubroutineDefinition[] = ALL_POOL_SUBROUTINES;

describe('archetypes and suits (A1)', () => {
  it('binds the four suits 1:1 to the four archetypes, both directions agreeing', () => {
    expect(new Set(Object.values(SUIT_ARCHETYPES))).toEqual(new Set(ARCHETYPES));
    for (const archetype of ARCHETYPES) expect(SUIT_ARCHETYPES[ARCHETYPE_SUITS[archetype]]).toBe(archetype);
  });
});

describe('skeleton pool -- structure', () => {
  it('every archetype has a pool with all three rarities populated', () => {
    for (const archetype of ARCHETYPES) {
      const pool = ARCHETYPE_POOLS[archetype];
      expect(pool.commons.length, archetype).toBeGreaterThan(0);
      expect(pool.uncommons.length, archetype).toBeGreaterThan(0);
      expect(pool.rares.length, archetype).toBeGreaterThan(0);
    }
  });

  it('every piece in an archetype pool belongs to that archetype', () => {
    for (const archetype of ARCHETYPES) {
      const pool = ARCHETYPE_POOLS[archetype];
      for (const piece of [...pool.commons, ...pool.uncommons, ...pool.rares]) expect(piece.archetype, piece.id).toBe(archetype);
    }
  });

  it('every id is globally unique and kebab-case', () => {
    const ids = allPieces.map((piece) => piece.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('alpha/beta model rules', () => {
  it("every beta pairs its source with a shape that source supports (VALID_SHAPES)", () => {
    for (const piece of allPieces) if (piece.beta) expect(isValidBeta(piece.beta), piece.id).toBe(true);
  });

  it('no effect carries a zero or negative magnitude', () => {
    for (const piece of allPieces) {
      for (const effect of [piece.alpha, piece.beta?.effect]) {
        if (!effect) continue;
        const amount = effectAmount(effect);
        if (amount !== undefined) expect(amount, piece.id).toBeGreaterThan(0);
      }
    }
  });

  it('every Tempo amount is a fraction of a turn or threshold, never a point count (session 48 invariant)', () => {
    for (const piece of allPieces) {
      for (const effect of [piece.alpha, piece.beta?.effect]) {
        if (effect?.verb === 'tempo') expect(effect.amount, piece.id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('a Tempo duration only ever appears on threshold mode', () => {
    for (const piece of allPieces) {
      for (const effect of [piece.alpha, piece.beta?.effect]) {
        if (effect?.verb === 'tempo' && effect.duration !== undefined) expect(effect.mode, piece.id).toBe('threshold');
      }
    }
  });

  it('alpha growth always comes with a growth cap, so a long fight cannot run it away', () => {
    for (const piece of allPieces) if (piece.alpha.growth !== undefined) expect(piece.alpha.growthCap, piece.id).toBeDefined();
  });

  it('a self-Haste alpha always carries a points cooldown (session 47: tempo can pay for its own next turn)', () => {
    for (const piece of allPieces) {
      const { alpha } = piece;
      if (alpha.verb === 'tempo' && alpha.target === 'own') expect(piece.pointsCooldown, piece.id).toBeGreaterThan(0);
    }
  });
});

describe("A3's credit rule -- every archetype has its own way to win", () => {
  it("every archetype's commons alone contain a credit path", () => {
    for (const archetype of ARCHETYPES) {
      expect(ARCHETYPE_POOLS[archetype].commons.some(hasCreditPath), archetype).toBe(true);
    }
  });

  it("every class's starting loadout has a credit path", () => {
    for (const classId of ALL_CLASS_IDS) {
      expect(CLASS_DEFINITIONS[classId].startingLoadout.some(hasCreditPath), classId).toBe(true);
    }
  });
});

describe('classes and starting loadouts (A8, A9)', () => {
  it('there is exactly one class per pair of archetypes', () => {
    const pairs = ALL_CLASS_IDS.map((id) => [...CLASS_DEFINITIONS[id].archetypes].sort().join('+'));
    expect(new Set(pairs).size).toBe(6);
  });

  it('every starting loadout has exactly 3 pieces, drawn only from the class\'s own two archetypes, covering both', () => {
    for (const classId of ALL_CLASS_IDS) {
      const { archetypes, startingLoadout } = CLASS_DEFINITIONS[classId];
      expect(startingLoadout, classId).toHaveLength(3);
      for (const piece of startingLoadout) expect(archetypes, `${classId}: ${piece.id}`).toContain(piece.archetype);
      for (const archetype of archetypes) expect(startingLoadout.some((piece) => piece.archetype === archetype), `${classId}: ${archetype}`).toBe(true);
    }
  });

  it('CLASS_STARTING_LOADOUTS and CLASS_DEFINITIONS name the same classes', () => {
    expect(new Set(Object.keys(CLASS_STARTING_LOADOUTS))).toEqual(new Set(ALL_CLASS_IDS));
  });
});

describe('scaledDefinition', () => {
  const probe = ARCHETYPE_POOLS.exploit.commons[0];
  const cron = ARCHETYPE_POOLS.daemon.commons[0];

  it('scales the alpha and the beta effect', () => {
    const scaled = scaledDefinition(probe, 2);
    expect(effectAmount(scaled.alpha)).toBe(2 * effectAmount(probe.alpha)!);
    expect(effectAmount(scaled.beta!.effect)).toBe(2 * effectAmount(probe.beta!.effect)!);
  });

  it('scales growth and its cap', () => {
    const scaled = scaledDefinition(cron, 2);
    expect(scaled.alpha.growth).toBe(2 * cron.alpha.growth!);
    expect(scaled.alpha.growthCap).toBe(2 * cron.alpha.growthCap!);
  });

  it('never mutates the source piece', () => {
    const before = JSON.stringify(cron);
    scaledDefinition(cron, 3);
    expect(JSON.stringify(cron)).toBe(before);
  });

  it('returns the piece itself at a multiplier of 1', () => {
    expect(scaledDefinition(probe, 1)).toBe(probe);
  });
});
