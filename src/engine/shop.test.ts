import { describe, it, expect } from 'vitest';
import type { RunPlayerState } from './run';
import { shopCostOf, shopOfferingsForClass, buyCheapestAffordable, type ShopOffering } from './shop';
import { rarityOf, rewardPoolForClass } from './rewards';

function playerState(data: number): RunPlayerState {
  return { classId: 'breacher', installedLoadout: [], bench: [], data, material: {}, rank: {} };
}

describe('shopCostOf', () => {
  it('scales steeply by rarity tier', () => {
    const common = shopCostOf('fuzzer'); // Exploit common
    const uncommon = shopCostOf('zero-day-chain'); // Exploit uncommon
    const rare = shopCostOf('supply-chain-compromise'); // Exploit rare
    expect(common).toBeGreaterThan(0);
    expect(uncommon).toBeGreaterThan(common);
    expect(rare).toBeGreaterThan(uncommon);
    // "Steeply," not linear -- the uncommon->rare jump should be at
    // least as large as the common->uncommon jump.
    expect(rare - uncommon).toBeGreaterThanOrEqual(uncommon - common);
  });

  it('falls back to common cost for a class starting-loadout piece', () => {
    expect(shopCostOf('buffer-overflow')).toBe(shopCostOf('fuzzer'));
  });
});

describe('shopOfferingsForClass', () => {
  it("offers every piece in the class's reward pool, each with a cost", () => {
    const offerings = shopOfferingsForClass('breacher');
    const pool = rewardPoolForClass('breacher');
    expect(offerings).toHaveLength(pool.length);
    for (const offering of offerings) {
      expect(offering.cost).toBe(shopCostOf(offering.piece.id));
    }
  });

  it('includes at least one of each rarity for a class with a full archetype pool', () => {
    const offerings = shopOfferingsForClass('breacher');
    const rarities = new Set(offerings.map((o) => rarityOf(o.piece.id)));
    expect(rarities).toEqual(new Set(['common', 'uncommon', 'rare']));
  });
});

describe('buyCheapestAffordable', () => {
  const offerings: ShopOffering[] = [
    { piece: { id: 'expensive', name: 'expensive', archetype: 'exploit', trigger: { kind: 'always' }, payload: { kind: 'directBurst', amount: 1 }, tags: [] }, cost: 100 },
    { piece: { id: 'cheap', name: 'cheap', archetype: 'exploit', trigger: { kind: 'always' }, payload: { kind: 'directBurst', amount: 1 }, tags: [] }, cost: 20 },
    { piece: { id: 'mid', name: 'mid', archetype: 'exploit', trigger: { kind: 'always' }, payload: { kind: 'directBurst', amount: 1 }, tags: [] }, cost: 50 },
  ];

  it('buys the cheapest affordable offering regardless of pool order', () => {
    const picked = buyCheapestAffordable(offerings, playerState(1000));
    expect(picked?.piece.id).toBe('cheap');
  });

  it('only considers what is actually affordable, not the globally cheapest', () => {
    const withoutCheap = offerings.filter((o) => o.piece.id !== 'cheap');
    const picked = buyCheapestAffordable(withoutCheap, playerState(60));
    expect(picked?.piece.id).toBe('mid'); // expensive (100) isn't affordable
  });

  it('declines when nothing is affordable', () => {
    expect(buyCheapestAffordable(offerings, playerState(10))).toBeNull();
  });

  it('declines on an empty offering list', () => {
    expect(buyCheapestAffordable([], playerState(1000))).toBeNull();
  });
});
