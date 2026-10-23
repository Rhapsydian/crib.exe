import { describe, it, expect } from 'vitest';
import type { SubroutineDefinition } from './subroutine-types';
import type { ModId } from './mod-types';
import { createRng } from './rng';
import { applyModOnCombatStartPassives, createCombatState, creditWinGauge, fireTurn, type CombatState } from './resolve';
import { burnerOfferingsForClass } from './shop';
import {
  applyOnMoveMods,
  generalModPool,
  shopModifiersForOwnedMods,
  BLACK_MARKET_DISCOUNT,
  FIFTEEN_FOLD_RULE,
  GLASS_CANNON_CREDIT,
  GLASS_CANNON_ENEMY_START,
  MOD_DEFINITIONS,
  PAIR_FOLD_RULE,
} from './mods';

// The six double-edged Mods (session 65, docs/mods-design.md M2, M7, M9).

const credit = (id: string, amount: number): SubroutineDefinition => ({ id, name: id, archetype: 'exploit', alpha: { verb: 'credit', amount } });
const fight = (mods: ModId[]): CombatState => applyModOnCombatStartPassives(createCombatState([credit('a', 1)], [credit('enemy', 1)], [12, 12], undefined, [100, 100], [], mods));
const DOUBLE_EDGED: ModId[] = ['fifteen-fold', 'pair-fold', 'overclocked-kernel', 'ghost-credentials', 'black-market-ties', 'glass-cannon'];

describe('double-edged Mods', () => {
  it('are Event-only: never in the reward or Shop pool', () => {
    expect(DOUBLE_EDGED.every((id) => MOD_DEFINITIONS[id].doubleEdged)).toBe(true);
    expect(generalModPool().some((m) => m.doubleEdged)).toBe(false);
  });

  it('the Folds reprice the player’s fifteens and pairs', () => {
    expect(fight(['fifteen-fold']).sides[0].scoringRule).toEqual(FIFTEEN_FOLD_RULE);
    expect(fight(['pair-fold']).sides[0].scoringRule).toEqual(PAIR_FOLD_RULE);
    expect(fight([]).sides[0].scoringRule).toBeUndefined();
  });

  it('Overclocked Kernel: the first turn each fight fires the loadout twice', () => {
    const first = fireTurn(fight(['overclocked-kernel']), 0, { isDealer: false }).combatState;
    expect(first.sides[0].winGauge.progress).toBe(2);
    expect(fireTurn(first, 0, { isDealer: false }).combatState.sides[0].winGauge.progress).toBe(3);
  });

  it('Glass Cannon: each Credit is higher; the enemy starts with Containment', () => {
    const s = fight(['glass-cannon']);
    expect(s.sides[1].winGauge.progress).toBe(GLASS_CANNON_ENEMY_START);
    expect(creditWinGauge(s, 0, 1).sides[0].winGauge.progress).toBe(1 + GLASS_CANNON_CREDIT);
    expect(creditWinGauge(s, 1, 1).sides[1].winGauge.progress).toBe(GLASS_CANNON_ENEMY_START + 1);
  });

  it('Ghost Credentials: moving adds no Heat', () => {
    expect(applyOnMoveMods(['ghost-credentials'], 2)).toBe(0);
    expect(applyOnMoveMods([], 2)).toBe(2);
  });

  it('Black Market Ties: Shop prices lower, and a contraband Burner on the slate', () => {
    expect(shopModifiersForOwnedMods(['black-market-ties']).discountFraction).toBe(BLACK_MARKET_DISCOUNT);
    expect(shopModifiersForOwnedMods(['black-market-ties', 'vendor-discount']).discountFraction).toBe(BLACK_MARKET_DISCOUNT);
    const slate = burnerOfferingsForClass('exploit-overclock', createRng(1), 0, 0, 0, undefined, 1);
    expect(slate.filter((o) => o.burner.contraband)).toHaveLength(1);
    expect(burnerOfferingsForClass('exploit-overclock', createRng(1)).some((o) => o.burner.contraband)).toBe(false);
  });
});
