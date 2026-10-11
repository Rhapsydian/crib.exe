import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import {
  rarityOf,
  rewardPoolForClass,
  offClassPoolForClass,
  drawRewardOptions,
  REWARD_OPTIONS_COUNT,
} from './rewards';
import { ALL_CLASS_IDS, CLASS_DEFINITIONS, type ClassId } from './classes';
import { ARCHETYPE_POOLS } from './subroutines';

// Rewritten in session 51 for the skeleton pool. The universal-Cantrip
// and Neutral-pool tests retired with those pools; off-class pieces now
// enter only through the combat-reward draw, down-weighted.

describe('rarityOf', () => {
  it('looks up a common, uncommon and rare pool piece by the array it lives in', () => {
    expect(rarityOf(ARCHETYPE_POOLS.exploit.commons[0].id)).toBe('common');
    expect(rarityOf(ARCHETYPE_POOLS.exploit.uncommons[0].id)).toBe('uncommon');
    expect(rarityOf(ARCHETYPE_POOLS.exploit.rares[0].id)).toBe('rare');
  });

  it('falls back to common for an unknown id', () => {
    expect(rarityOf('not-a-real-subroutine')).toBe('common');
  });
});

describe('rewardPoolForClass', () => {
  it("is on-class only: every piece belongs to one of the class's two archetypes", () => {
    for (const classId of ALL_CLASS_IDS) {
      const { archetypes } = CLASS_DEFINITIONS[classId];
      for (const piece of rewardPoolForClass(classId)) expect(archetypes, `${classId}: ${piece.id}`).toContain(piece.archetype);
    }
  });

  it("includes both of the class's archetype pools, every rarity, and its own starting loadout", () => {
    const pool = rewardPoolForClass('exploit-daemon').map((p) => p.id);
    for (const archetype of ['exploit', 'daemon'] as const) {
      const archetypePool = ARCHETYPE_POOLS[archetype];
      for (const piece of [...archetypePool.commons, ...archetypePool.uncommons, ...archetypePool.rares]) expect(pool).toContain(piece.id);
    }
    for (const piece of CLASS_DEFINITIONS['exploit-daemon'].startingLoadout) expect(pool).toContain(piece.id);
  });

  it('never lists the same id twice (skeleton starting loadouts are pool pieces)', () => {
    for (const classId of ALL_CLASS_IDS) {
      const ids = rewardPoolForClass(classId).map((p) => p.id);
      expect(new Set(ids).size, classId).toBe(ids.length);
    }
  });
});

describe('offClassPoolForClass', () => {
  it("is exactly the other two archetypes' pieces", () => {
    const { archetypes } = CLASS_DEFINITIONS['exploit-daemon'];
    const offClass = offClassPoolForClass('exploit-daemon');
    expect(offClass.length).toBeGreaterThan(0);
    for (const piece of offClass) expect(archetypes).not.toContain(piece.archetype);
    expect(new Set(offClass.map((p) => p.archetype))).toEqual(new Set(['overclock', 'honeypot']));
  });
});

describe('drawRewardOptions', () => {
  it('returns nothing for a lost fight', () => {
    expect(drawRewardOptions('exploit-daemon', 'none', createRng(1))).toEqual([]);
  });

  it('offers REWARD_OPTIONS_COUNT distinct pieces', () => {
    for (const classId of ALL_CLASS_IDS) {
      const options = drawRewardOptions(classId, 'standard', createRng(7));
      expect(options, classId).toHaveLength(REWARD_OPTIONS_COUNT);
      expect(new Set(options.map((p) => p.id)).size, classId).toBe(REWARD_OPTIONS_COUNT);
    }
  });

  it('mostly offers on-class pieces, but sometimes off-class ones (primarily, not exclusively)', () => {
    const classId: ClassId = 'exploit-daemon';
    const { archetypes } = CLASS_DEFINITIONS[classId];
    let onClass = 0;
    let offClass = 0;
    for (let seed = 0; seed < 400; seed++) {
      for (const piece of drawRewardOptions(classId, 'standard', createRng(seed))) {
        if ((archetypes as readonly string[]).includes(piece.archetype)) onClass++;
        else offClass++;
      }
    }
    expect(offClass).toBeGreaterThan(0);
    expect(onClass).toBeGreaterThan(offClass * 2);
  });
});
