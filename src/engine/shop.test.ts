import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import type { RunPlayerState } from './run';
import {
  shopCostOf,
  shopOfferingsForClass,
  buyCheapestAffordable,
  rerollIfNothingAffordable,
  REROLL_COST,
  type ShopOffering,
} from './shop';
import { rarityOf } from './rewards';

function playerState(data: number): RunPlayerState {
  return {
    classId: 'breacher',
    installedLoadout: [],
    bench: [],
    data,
    material: {},
    rank: {},
    ownedModIds: [],
    grantedByMod: {},
    maxHeatBonus: 0,
    modRunState: {},
    carriedBurnerIds: [],
  };
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
  it('offers 3 commons, 1 uncommon, and one uncommon-or-rare wildcard -- 5 slots total, each costed', () => {
    const offerings = shopOfferingsForClass('breacher', createRng(1));
    expect(offerings).toHaveLength(5);
    const rarities = offerings.map((o) => rarityOf(o.piece.id));
    expect(rarities.filter((r) => r === 'common')).toHaveLength(3);
    const nonCommon = rarities.filter((r) => r !== 'common');
    expect(nonCommon).toHaveLength(2);
    expect(nonCommon).toContain('uncommon'); // the guaranteed uncommon slot
    for (const offering of offerings) expect(offering.cost).toBe(shopCostOf(offering.piece.id));
  });

  it('never offers the same piece twice in one slate', () => {
    for (let seed = 0; seed < 20; seed++) {
      const offerings = shopOfferingsForClass('breacher', createRng(seed));
      const ids = offerings.map((o) => o.piece.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('is deterministic for the same seed', () => {
    const a = shopOfferingsForClass('breacher', createRng(5)).map((o) => o.piece.id);
    const b = shopOfferingsForClass('breacher', createRng(5)).map((o) => o.piece.id);
    expect(a).toEqual(b);
  });

  it('gives the wildcard slot a real shot at rare across seeds (not always uncommon)', () => {
    const sawRare = Array.from({ length: 30 }, (_, seed) => shopOfferingsForClass('breacher', createRng(seed))).some((offerings) =>
      offerings.some((o) => rarityOf(o.piece.id) === 'rare'),
    );
    expect(sawRare).toBe(true);
  });

  it('re-rolls to a different slate when called again against a continuing rng', () => {
    const rng = createRng(1);
    const first = shopOfferingsForClass('breacher', rng).map((o) => o.piece.id);
    const second = shopOfferingsForClass('breacher', rng).map((o) => o.piece.id);
    expect(second).not.toEqual(first);
  });
});

describe('rerollIfNothingAffordable', () => {
  const offerings: ShopOffering[] = [{ piece: { id: 'a', name: 'a', archetype: 'exploit', trigger: { kind: 'always' }, payload: { kind: 'directBurst', amount: 1 }, tags: [] }, cost: 20 }];

  it('rerolls when nothing in the slate is affordable but the reroll itself is', () => {
    expect(rerollIfNothingAffordable(offerings, playerState(REROLL_COST))).toBe(true);
  });

  it('does not reroll when something is already affordable', () => {
    expect(rerollIfNothingAffordable(offerings, playerState(20))).toBe(false);
  });

  it('does not reroll when even the reroll itself is unaffordable', () => {
    expect(rerollIfNothingAffordable(offerings, playerState(REROLL_COST - 1))).toBe(false);
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
