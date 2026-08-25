import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { rarityOf, rewardPoolForClass, drawRewardOptions, REWARD_OPTIONS_COUNT } from './rewards';

describe('rarityOf', () => {
  it('looks up a known common/uncommon/rare pool piece correctly', () => {
    expect(rarityOf('fuzzer')).toBe('common'); // Exploit common
    expect(rarityOf('zero-day-chain')).toBe('uncommon'); // Exploit uncommon
    expect(rarityOf('supply-chain-compromise')).toBe('rare'); // Exploit rare
  });

  it('falls back to common for a class starting-loadout piece (no authored rarity)', () => {
    expect(rarityOf('buffer-overflow')).toBe('common');
  });

  it('falls back to common for a totally unknown id', () => {
    expect(rarityOf('not-a-real-subroutine')).toBe('common');
  });
});

describe('rewardPoolForClass', () => {
  it("includes the class's own starting-loadout pieces", () => {
    const pool = rewardPoolForClass('breacher').map((p) => p.id);
    expect(pool).toEqual(expect.arrayContaining(['buffer-overflow', 'session-lock', 'steady-hand']));
  });

  it("includes both of the class's own archetype pools (Exploit + Encryption for Breacher)", () => {
    const pool = rewardPoolForClass('breacher').map((p) => p.id);
    expect(pool).toContain('fuzzer'); // Exploit common
    expect(pool).toContain('supply-chain-compromise'); // Exploit rare
    expect(pool).toContain('checksum'); // Encryption common
    expect(pool).toContain('zero-trust'); // Encryption rare
  });

  it("includes the universal Cantrips from the class's OTHER two archetypes", () => {
    const pool = rewardPoolForClass('breacher').map((p) => p.id);
    expect(pool).toContain('adware'); // Malware Cantrip
    expect(pool).toContain('idle-scan'); // Root Cantrip
  });

  it('does not include non-Cantrip pieces from off-archetype pools', () => {
    const pool = rewardPoolForClass('breacher').map((p) => p.id);
    expect(pool).not.toContain('ransomware'); // Malware, not a Cantrip
    expect(pool).not.toContain('port-forward'); // Root, not a Cantrip
  });

  it("does not include another class's own starting-loadout pieces", () => {
    const pool = rewardPoolForClass('breacher').map((p) => p.id);
    expect(pool).not.toContain('payload-drop'); // Blackhat's own
  });

  it('has no duplicate ids', () => {
    const pool = rewardPoolForClass('warden').map((p) => p.id);
    expect(new Set(pool).size).toBe(pool.length);
  });
});

describe('drawRewardOptions', () => {
  it("returns nothing for a 'none' tier", () => {
    expect(drawRewardOptions('breacher', 'none', createRng(1))).toEqual([]);
  });

  it('returns REWARD_OPTIONS_COUNT distinct pieces, all drawn from the class pool', () => {
    const options = drawRewardOptions('breacher', 'standard', createRng(1));
    expect(options).toHaveLength(REWARD_OPTIONS_COUNT);
    expect(new Set(options.map((o) => o.id)).size).toBe(REWARD_OPTIONS_COUNT);
    const poolIds = new Set(rewardPoolForClass('breacher').map((p) => p.id));
    for (const option of options) expect(poolIds.has(option.id)).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const a = drawRewardOptions('operator', 'better', createRng(7)).map((o) => o.id);
    const b = drawRewardOptions('operator', 'better', createRng(7)).map((o) => o.id);
    expect(a).toEqual(b);
  });

  it('a better-tier draw surfaces rares more often than a standard-tier draw', () => {
    // A well-behaved weighted RNG draw, not Breach/Containment's chaotic
    // positive feedback (see encounters.test.ts's own note on why THAT
    // needed deterministic constructions instead) -- a large sample
    // across many seeds converges reliably here, no flakiness risk.
    const SAMPLE_SEEDS = 300;
    const countRares = (tier: 'standard' | 'better') => {
      let rares = 0;
      for (let seed = 0; seed < SAMPLE_SEEDS; seed++) {
        const options = drawRewardOptions('warden', tier, createRng(seed));
        rares += options.filter((o) => rarityOf(o.id) === 'rare').length;
      }
      return rares;
    };
    expect(countRares('better')).toBeGreaterThan(countRares('standard'));
  });
});
