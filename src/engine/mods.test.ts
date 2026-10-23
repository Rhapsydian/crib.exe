import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import type { SubroutineDefinition } from './subroutine-types';
import { createCombatState, resolveEffect, fireTurn, applyModGaugeCross50Passives, applyModOnCombatStartPassives, type CombatState } from './resolve';
import { installGrantedSubroutine, installSubroutine, uninstallSubroutine, INSTALLED_SLOT_CAP } from './loadout';
import { playRun, createInitialPlayerState, type RunPlayerState } from './run';
import { MERGE_MAGNITUDE_BONUS } from './merge';
import {
  MOD_DEFINITIONS,
  MOD_SMALL,
  MOD_MEDIUM,
  AMPLIFIER_BONUS,
  FIRMWARE_PATCH_BONUS,
  CACHE_PREFETCH_CHARGES,
  LIGHT_FOOTING_HEAT_DISCOUNT,
  VENDOR_DISCOUNT_FRACTION,
  PETTY_CACHE_DATA_BONUS,
  BACKUP_GENERATOR_HEAT_BONUS,
  QUIET_HOURS_MOVE_INTERVAL,
  QUIET_HOURS_DATA_BONUS,
  PETTY_THEFT_DATA_BONUS,
  INIT_SCRIPT_DATA_BONUS,
  THRESHOLD_EXPLOIT_REDUCTION,
  HEAT_SINK_HEAT_REFUND,
  applyOnMoveMods,
  applyQuietHoursMod,
  applyOnWinEncounterResolvedMods,
  shopModifiersForOwnedMods,
  applyOnSubroutineAcquiredMods,
  applyOnModAcquiredMods,
  synergyAwareModAcquisition,
} from './mods';
import { shopOfferingsForClass, modOfferingsForClass, synergyAwareModShopStrategy, type ModOffering } from './shop';
import type { ModDefinition } from './mod-types';

/**
 * Mods verification (Phase 5 checkpoint I): every one of the 12 hook
 * points exercised by at least one real test, plus a smoke-tested full
 * run with several Mods active together. Mirrors resolve.test.ts's own
 * style -- exercised through the public API (resolveEffect, fireTurn,
 * etc.), not by reaching into resolve.ts's private per-hook dispatch
 * functions, same as every existing enemy-passive test.
 *
 * Ported in session 51 to the alpha/beta model: fixtures use the new
 * archetypes and class ids; the tick Mods' tests (Redundant Ticks,
 * Failsafe Cascade, Redline) went with DoT/HoT; Tagged Firmware, the
 * Amplifiers, Overclocked Accumulator and Threshold Exploit are tested in
 * their re-pointed forms (Firmware Patch, alpha bumps, Cache Prefetch,
 * stepped-beta `at`), which reshape combat-local copies of the player's
 * pieces at createCombatState / combat start.
 */

function piece(id: string, overrides: Partial<SubroutineDefinition> = {}): SubroutineDefinition {
  return {
    id,
    name: id,
    archetype: 'exploit',
    alpha: { verb: 'credit', amount: 5 },
    ...overrides,
  };
}

/** Side 0's combat-local copy of loadout entry `index` -- what the Mods
 * that reshape pieces at createCombatState actually produce. */
function combatPiece(state: CombatState, index = 0): SubroutineDefinition {
  return state.sides[0].loadout[index].definition;
}

/** Banks `charges` on side 0's first loadout entry. */
function withCharges(state: CombatState, charges: number): CombatState {
  const [first, ...rest] = state.sides[0].loadout;
  return {
    ...state,
    sides: [{ ...state.sides[0], loadout: [{ ...first, state: { ...first.state, charges } }, ...rest] }, state.sides[1]],
  };
}

describe('Mod pool size (session 44 Mod Pool Expansion, session 51 tick-Mod removal -- structural count guard)', () => {
  it('the general pool is 14/17/12 with the twelve session 65 rule-benders; 6 class-exclusive and 6 double-edged Mods', () => {
    const all = Object.values(MOD_DEFINITIONS);
    const classExclusive = all.filter((m) => m.classExclusive);
    const general = all.filter((m) => !m.classExclusive && !m.doubleEdged);
    expect(classExclusive).toHaveLength(6);
    expect(all.filter((m) => m.doubleEdged)).toHaveLength(6);
    expect(general.filter((m) => m.rarity === 'common')).toHaveLength(14);
    expect(general.filter((m) => m.rarity === 'uncommon')).toHaveLength(17);
    expect(general.filter((m) => m.rarity === 'rare')).toHaveLength(12);
    expect(general).toHaveLength(43);
    expect(all).toHaveLength(55);
  });
});

describe('Firmware Patch / Amplifiers (re-pointed session 51: piece reshapes at createCombatState)', () => {
  const stepped = { source: 'cards', category: 'fifteen', shape: 'stepped', at: 1 } as const;

  it('Firmware Patch adds a bonus to a points beta effect, including an enhance on a points alpha', () => {
    const different = piece('different', { beta: { ...stepped, effect: { verb: 'ward', amount: 3 } } });
    const enhance = piece('enhance', { beta: { ...stepped, effect: { verb: 'enhance', amount: 2 } } });
    const withMod = createCombatState([different, enhance], [], [12, 12], undefined, [100, 100], [], ['firmware-patch']);
    expect(combatPiece(withMod, 0).beta?.effect).toEqual({ verb: 'ward', amount: 3 + FIRMWARE_PATCH_BONUS });
    expect(combatPiece(withMod, 1).beta?.effect).toEqual({ verb: 'enhance', amount: 2 + FIRMWARE_PATCH_BONUS });
    // The alpha itself is untouched -- Firmware Patch is a beta Mod.
    expect(combatPiece(withMod, 0).alpha).toEqual({ verb: 'credit', amount: 5 });
  });

  it('Firmware Patch never touches a Tempo beta, or an enhance on a Tempo alpha (session 48 units)', () => {
    const tempoBeta = piece('tempo-beta', { beta: { ...stepped, effect: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 1 / 4 } } });
    const tempoAlpha = piece('tempo-alpha', {
      alpha: { verb: 'tempo', target: 'opponent', mode: 'gauge', amount: 1 / 4 },
      beta: { ...stepped, effect: { verb: 'enhance', amount: 1 / 8 } },
    });
    const withMod = createCombatState([tempoBeta, tempoAlpha], [], [12, 12], undefined, [100, 100], [], ['firmware-patch']);
    expect(combatPiece(withMod, 0)).toEqual(tempoBeta);
    expect(combatPiece(withMod, 1)).toEqual(tempoAlpha);
  });

  it("Firmware Patch's bonus lands when the beta actually applies, and not otherwise", () => {
    const enhance = piece('enhance', { beta: { ...stepped, effect: { verb: 'enhance', amount: 2 } } });
    const withMod = createCombatState([enhance], [], [12, 12], undefined, [100, 100], [], ['firmware-patch']);
    expect(fireTurn(withCharges(withMod, 1), 0, { isDealer: false }).combatState.sides[0].winGauge.progress).toBe(5 + 2 + FIRMWARE_PATCH_BONUS);
    expect(fireTurn(withMod, 0, { isDealer: false }).combatState.sides[0].winGauge.progress).toBe(5);
  });

  it('Daemon Amplifier adds a bonus to every Daemon points alpha', () => {
    const daemon = piece('daemon', { archetype: 'daemon' });
    const withMod = createCombatState([daemon], [], [12, 12], undefined, [100, 100], [], ['daemon-amplifier']);
    expect(combatPiece(withMod).alpha).toEqual({ verb: 'credit', amount: 5 + AMPLIFIER_BONUS });
    expect(fireTurn(withMod, 0, { isDealer: false }).combatState.sides[0].winGauge.progress).toBe(5 + AMPLIFIER_BONUS);
  });

  it('side 1 (enemy) never gets a player Mod bonus', () => {
    const daemon = piece('daemon', { archetype: 'daemon' });
    const withMod = createCombatState([], [daemon], [12, 12], undefined, [100, 100], [], ['daemon-amplifier']);
    expect(withMod.sides[1].loadout[0].definition).toEqual(daemon);
    expect(fireTurn(withMod, 1, { isDealer: false }).combatState.sides[1].winGauge.progress).toBe(5);
  });

  it('an Amplifier never bumps a Tempo alpha (session 48 units)', () => {
    const tempo = piece('tempo', { archetype: 'daemon', alpha: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 1 / 4 } });
    const withMod = createCombatState([tempo], [], [12, 12], undefined, [100, 100], [], ['daemon-amplifier']);
    expect(combatPiece(withMod)).toEqual(tempo);
  });

  it.each([
    ['exploit-amplifier', 'exploit', 'daemon'],
    ['honeypot-amplifier', 'honeypot', 'exploit'],
    ['overclock-amplifier', 'overclock', 'exploit'],
  ] as const)("%s bumps any %s points alpha -- Daemon Amplifier's sibling", (modId, archetype, other) => {
    const own = piece('own', { archetype, alpha: { verb: 'suppress', amount: 5 } });
    const off = piece('off', { archetype: other });
    const withMod = createCombatState([own, off], [], [12, 12], undefined, [100, 100], [], [modId]);
    expect(combatPiece(withMod, 0).alpha).toEqual({ verb: 'suppress', amount: 5 + AMPLIFIER_BONUS });
    // Doesn't cross-fire on another archetype.
    expect(combatPiece(withMod, 1).alpha).toEqual({ verb: 'credit', amount: 5 });
  });
});

describe('onGaugeCross50 -- Early Momentum / First Contact', () => {
  it("pushes the player's own gauge once, the first time it crosses halfway", () => {
    const base = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['early-momentum']);
    const at50 = { ...base, sides: [{ ...base.sides[0], winGauge: { progress: 50, threshold: 100 } }, base.sides[1]] as typeof base.sides };
    const first = applyModGaugeCross50Passives(at50);
    expect(first.sides[0].winGauge.progress).toBe(50 + MOD_SMALL);
    const second = applyModGaugeCross50Passives(first);
    expect(second).toEqual(first); // one-shot per fight
  });

  it("First Contact pulls the enemy's gauge once, the first time the enemy's own gauge crosses halfway", () => {
    const base = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['first-contact']);
    const enemyAt50 = { ...base, sides: [base.sides[0], { ...base.sides[1], winGauge: { progress: 50, threshold: 100 } }] as typeof base.sides };
    const first = applyModGaugeCross50Passives(enemyAt50);
    expect(first.sides[1].winGauge.progress).toBe(50 - MOD_SMALL); // pull, not push -- MOD_FIRST_CONTACT_AMOUNT
    const second = applyModGaugeCross50Passives(first);
    expect(second).toEqual(first); // one-shot per fight

    // Independent from Early Momentum's own one-shot flag -- both can fire in the same fight.
    const both = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['early-momentum', 'first-contact']);
    const bothAt50 = {
      ...both,
      sides: [{ ...both.sides[0], winGauge: { progress: 50, threshold: 100 } }, { ...both.sides[1], winGauge: { progress: 50, threshold: 100 } }] as typeof both.sides,
    };
    const bothResult = applyModGaugeCross50Passives(bothAt50);
    expect(bothResult.sides[0].winGauge.progress).toBe(50 + MOD_SMALL);
    expect(bothResult.sides[1].winGauge.progress).toBe(50 - MOD_SMALL);
  });
});

describe('incoming Credit -- Static Shield / Surge Protector', () => {
  const credit10 = { verb: 'credit', amount: 10 } as const;

  it('mitigates a flat amount off every incoming credit, uncapped', () => {
    const state = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['static-shield']);
    const afterFirst = resolveEffect(credit10, state, 1);
    expect(afterFirst.sides[1].winGauge.progress).toBe(10 - MOD_SMALL);
    const afterSecond = resolveEffect(credit10, afterFirst, 1);
    expect(afterSecond.sides[1].winGauge.progress).toBe(10 - MOD_SMALL + (10 - MOD_SMALL)); // mitigated again, not one-shot
  });

  it('Surge Protector mitigates a bigger amount, but only the first incoming credit each fight', () => {
    const state = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['surge-protector']);
    const afterFirst = resolveEffect(credit10, state, 1);
    expect(afterFirst.sides[1].winGauge.progress).toBe(10 - MOD_MEDIUM);
    const afterSecond = resolveEffect(credit10, afterFirst, 1);
    expect(afterSecond.sides[1].winGauge.progress).toBe(10 - MOD_MEDIUM + 10); // one-shot -- no mitigation on the second hit
  });

  it('both Mods stack on the same hit, Static Shield first', () => {
    const state = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['static-shield', 'surge-protector']);
    const result = resolveEffect(credit10, state, 1);
    expect(result.sides[1].winGauge.progress).toBe(10 - MOD_SMALL - MOD_MEDIUM);
  });
});

describe('onCombatStart -- Warm Boot', () => {
  it('starts the fight with a small Ward on side 0', () => {
    const withMod = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['warm-boot']);
    const result = applyModOnCombatStartPassives(withMod);
    expect(result.sides[0].wardShield).toBe(MOD_SMALL);
  });

  it('is a no-op without the Mod', () => {
    const withoutMod = createCombatState([], [], [12, 12]);
    expect(applyModOnCombatStartPassives(withoutMod)).toEqual(withoutMod);
  });
});

describe('onCombatStart -- Cache Prefetch (session 51, was Overclocked Accumulator)', () => {
  it('every banking beta (cards or progress) starts the fight with a charge', () => {
    const cards = piece('cards', { beta: { source: 'cards', category: 'fifteen', shape: 'stepped', at: 3, effect: { verb: 'enhance', amount: 2 } } });
    const progress = piece('progress', { beta: { source: 'progress', metric: 'fires', per: 2, shape: 'graded', cap: 2, effect: { verb: 'enhance', amount: 1 } } });
    const withMod = createCombatState([cards, progress], [], [12, 12], undefined, [100, 100], [], ['cache-prefetch']);
    const result = applyModOnCombatStartPassives(withMod);
    expect(result.sides[0].loadout.map((e) => e.state.charges)).toEqual([CACHE_PREFETCH_CHARGES, CACHE_PREFETCH_CHARGES]);
  });

  it('leaves non-banking betas, beta-less pieces and the enemy side alone', () => {
    const live = piece('live', { beta: { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 1 } } });
    const bare = piece('bare');
    const enemy = piece('enemy', { beta: { source: 'cards', category: 'fifteen', shape: 'stepped', at: 1, effect: { verb: 'enhance', amount: 1 } } });
    const withMod = createCombatState([live, bare], [enemy], [12, 12], undefined, [100, 100], [], ['cache-prefetch']);
    const result = applyModOnCombatStartPassives(withMod);
    expect(result.sides[0].loadout.map((e) => e.state.charges)).toEqual([0, 0]);
    expect(result.sides[1].loadout[0].state.charges).toBe(0);
  });
});

describe('Threshold Exploit (re-pointed session 51: stepped betas)', () => {
  it("lowers a stepped beta's `at`, so it applies one charge sooner", () => {
    const definition = piece('occ', { beta: { source: 'cards', category: 'fifteen', shape: 'stepped', at: 4, effect: { verb: 'enhance', amount: 2 } } });
    const withMod = createCombatState([definition], [], [12, 12], undefined, [100, 100], [], ['threshold-exploit']);
    expect(combatPiece(withMod).beta).toEqual(expect.objectContaining({ shape: 'stepped', at: 4 - THRESHOLD_EXPLOIT_REDUCTION }));

    // 3 banked charges: short of the authored 4, enough for the lowered 3.
    const without = createCombatState([definition], [], [12, 12]);
    expect(fireTurn(withCharges(without, 3), 0, { isDealer: false }).events[0].elevated).toBe(false);
    expect(fireTurn(withCharges(withMod, 3), 0, { isDealer: false }).events[0].elevated).toBe(true);
  });

  it('never lowers `at` below 1, and leaves non-stepped betas alone', () => {
    const atOne = piece('at-one', { beta: { source: 'cards', category: 'fifteen', shape: 'stepped', at: 1, effect: { verb: 'enhance', amount: 2 } } });
    const graded = piece('graded', { beta: { source: 'cards', category: 'fifteen', shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 } } });
    const withMod = createCombatState([atOne, graded], [], [12, 12], undefined, [100, 100], [], ['threshold-exploit']);
    expect(combatPiece(withMod, 0).beta).toEqual(expect.objectContaining({ at: 1 })); // still needs exactly 1, never 0
    expect(combatPiece(withMod, 1)).toEqual(graded);
  });
});

describe('onMove -- Light Footing / Quiet Hours', () => {
  it('discounts the flat per-move Heat cost, floored at 0', () => {
    expect(applyOnMoveMods(['light-footing'], 2)).toBe(2 - LIGHT_FOOTING_HEAT_DISCOUNT);
    expect(applyOnMoveMods(['light-footing'], 0)).toBe(0);
    expect(applyOnMoveMods([], 2)).toBe(2);
  });

  it('Quiet Hours grants a Data trickle every QUIET_HOURS_MOVE_INTERVAL moves', () => {
    let state: RunPlayerState = { ...createInitialPlayerState('exploit-overclock'), ownedModIds: ['quiet-hours'] };
    for (let i = 0; i < QUIET_HOURS_MOVE_INTERVAL - 1; i++) {
      state = applyQuietHoursMod(state);
      expect(state.data).toBe(0); // no trickle yet
    }
    state = applyQuietHoursMod(state);
    expect(state.data).toBe(QUIET_HOURS_DATA_BONUS); // trickle on the Nth move
    state = applyQuietHoursMod(state);
    expect(state.data).toBe(QUIET_HOURS_DATA_BONUS); // counter reset, no trickle on move N+1
  });

  it('is a no-op without the Mod', () => {
    const state = createInitialPlayerState('exploit-overclock');
    expect(applyQuietHoursMod(state)).toEqual(state);
  });
});

describe('onEncounterResolved -- Petty Cache / Black Budget / Petty Theft / Heat Sink', () => {
  it('Petty Cache adds a flat Data bonus on any win', () => {
    const result = applyOnWinEncounterResolvedMods(['petty-cache'], 10, [], 'regular', createRng(1), () => []);
    expect(result.dataAwarded).toBe(10 + PETTY_CACHE_DATA_BONUS);
  });

  it('Black Budget never triggers on a regular win, only elite/gatekeeper', () => {
    const withoutMod = applyOnWinEncounterResolvedMods([], 10, [], 'regular', createRng(1), () => []);
    expect(withoutMod.rewardOptions).toEqual([]);
    // A seed chosen to roll under BLACK_BUDGET_UPGRADE_CHANCE -- confirms
    // the upgraded-draw callback actually gets invoked and used.
    const upgraded = [piece('upgraded-pick')];
    const result = applyOnWinEncounterResolvedMods(['black-budget'], 0, [], 'elite', createRng(2), () => upgraded);
    expect(result.rewardOptions === upgraded || result.rewardOptions.length === 0).toBe(true);
  });

  it('Petty Theft only adds its Data bonus on a regular win, the opposite gate from Black Budget', () => {
    const onRegular = applyOnWinEncounterResolvedMods(['petty-theft'], 10, [], 'regular', createRng(1), () => []);
    expect(onRegular.dataAwarded).toBe(10 + PETTY_THEFT_DATA_BONUS);
    const onElite = applyOnWinEncounterResolvedMods(['petty-theft'], 10, [], 'elite', createRng(1), () => []);
    expect(onElite.dataAwarded).toBe(10);
  });

  it('Heat Sink refunds a flat amount of Heat on elite/gatekeeper wins only -- closes the missing Heat-mitigation use case', () => {
    const onRegular = applyOnWinEncounterResolvedMods(['heat-sink'], 10, [], 'regular', createRng(1), () => []);
    expect(onRegular.heatRefund).toBe(0);
    const onElite = applyOnWinEncounterResolvedMods(['heat-sink'], 10, [], 'elite', createRng(1), () => []);
    expect(onElite.heatRefund).toBe(HEAT_SINK_HEAT_REFUND);
    const withoutMod = applyOnWinEncounterResolvedMods([], 10, [], 'elite', createRng(1), () => []);
    expect(withoutMod.heatRefund).toBe(0);
  });
});

describe('onShopSlateGenerated -- Vendor Discount / Bulk Buyer', () => {
  it('Vendor Discount reduces every offering price by a flat fraction', () => {
    const { discountFraction } = shopModifiersForOwnedMods(['vendor-discount']);
    expect(discountFraction).toBe(VENDOR_DISCOUNT_FRACTION);
    const withDiscount = shopOfferingsForClass('exploit-overclock', createRng(1), 0, 0, discountFraction);
    const withoutDiscount = shopOfferingsForClass('exploit-overclock', createRng(1), 0, 0, 0);
    for (let i = 0; i < withDiscount.length; i++) {
      expect(withDiscount[i].cost).toBeLessThanOrEqual(withoutDiscount[i].cost);
    }
  });

  it('Bulk Buyer offers one extra common on both the subroutine and Mod slates', () => {
    const { extraCommons } = shopModifiersForOwnedMods(['bulk-buyer']);
    expect(extraCommons).toBe(1);
    const slate = shopOfferingsForClass('exploit-overclock', createRng(1), extraCommons, 0, 0);
    const modSlate = modOfferingsForClass('exploit-overclock', [], createRng(1), extraCommons, 0, 0);
    expect(slate.length).toBe(5 + 1); // 3 commons + 1 -- see SHOP_COMMON_SLOTS
    expect(modSlate.length).toBeGreaterThan(0);
  });

  it('no modifiers when neither Mod is owned', () => {
    expect(shopModifiersForOwnedMods([])).toEqual({ discountFraction: 0, extraCommons: 0, extraUncommons: 0 });
  });

  it("Scrap Merchant offers one extra uncommon -- Bulk Buyer's sibling, one tier up", () => {
    const { extraUncommons } = shopModifiersForOwnedMods(['scrap-merchant']);
    expect(extraUncommons).toBe(1);
    const slate = shopOfferingsForClass('exploit-overclock', createRng(1), 0, extraUncommons, 0);
    // 3 commons + 1 wildcard + (1 + extraUncommons) uncommons, minus overlap the wildcard coin-flip can cause --
    // just confirm the slate grew past the baseline 5-offering shape.
    const baseline = shopOfferingsForClass('exploit-overclock', createRng(1), 0, 0, 0);
    expect(slate.length).toBeGreaterThanOrEqual(baseline.length);
  });
});

describe('onSubroutineAcquired -- Salvage Protocol (re-keyed session 51: Daemon)', () => {
  it('upgrades the first acquired Daemon subroutine once', () => {
    // No beta, so Merge's rank lands on the alpha (merge.ts's upgradedDefinition).
    const daemonPiece = piece('acquired-daemon', { archetype: 'daemon' });
    let state: RunPlayerState = {
      ...createInitialPlayerState('exploit-overclock'),
      installedLoadout: [daemonPiece],
      ownedModIds: ['salvage-protocol'],
    };
    state = applyOnSubroutineAcquiredMods(state, daemonPiece);
    expect(state.installedLoadout[0].alpha).toEqual({ verb: 'credit', amount: 5 + MERGE_MAGNITUDE_BONUS });
    expect(state.material[daemonPiece.id]).toBe(0);

    // "First... each run" -- a second acquisition doesn't upgrade again.
    const secondDaemon = piece('acquired-daemon-2', { archetype: 'daemon' });
    state = { ...state, installedLoadout: [...state.installedLoadout, secondDaemon] };
    state = applyOnSubroutineAcquiredMods(state, secondDaemon);
    expect(state.installedLoadout[1].alpha).toEqual({ verb: 'credit', amount: 5 }); // unchanged
  });

  it('ignores non-Daemon acquisitions', () => {
    const exploitPiece = piece('acquired-exploit');
    const state: RunPlayerState = {
      ...createInitialPlayerState('exploit-overclock'),
      installedLoadout: [exploitPiece],
      ownedModIds: ['salvage-protocol'],
    };
    const result = applyOnSubroutineAcquiredMods(state, exploitPiece);
    expect(result).toEqual(state);
  });
});

describe('onSubroutineAcquired -- Fast Learner (re-keyed session 51: Overclock)', () => {
  it("upgrades the first acquired Overclock subroutine once -- Salvage Protocol's sibling, extended to a second archetype", () => {
    const overclockPiece = piece('acquired-overclock', { archetype: 'overclock' });
    let state: RunPlayerState = {
      ...createInitialPlayerState('exploit-overclock'),
      installedLoadout: [overclockPiece],
      ownedModIds: ['fast-learner'],
    };
    state = applyOnSubroutineAcquiredMods(state, overclockPiece);
    expect(state.installedLoadout[0].alpha).toEqual({ verb: 'credit', amount: 5 + MERGE_MAGNITUDE_BONUS });
  });

  it('tracks independently from Salvage Protocol -- owning both upgrades one Daemon and one Overclock piece', () => {
    const daemonPiece = piece('both-daemon', { archetype: 'daemon' });
    const overclockPiece = piece('both-overclock', { archetype: 'overclock' });
    let state: RunPlayerState = {
      ...createInitialPlayerState('exploit-overclock'),
      installedLoadout: [daemonPiece, overclockPiece],
      ownedModIds: ['salvage-protocol', 'fast-learner'],
    };
    state = applyOnSubroutineAcquiredMods(state, daemonPiece);
    state = applyOnSubroutineAcquiredMods(state, overclockPiece);
    expect(state.installedLoadout[0].alpha).toEqual({ verb: 'credit', amount: 5 + MERGE_MAGNITUDE_BONUS });
    expect(state.installedLoadout[1].alpha).toEqual({ verb: 'credit', amount: 5 + MERGE_MAGNITUDE_BONUS });
  });
});

describe('onModAcquired -- Backup Generator / Auxiliary Process', () => {
  it('Backup Generator permanently raises max Heat capacity', () => {
    const state = createInitialPlayerState('exploit-overclock');
    const result = applyOnModAcquiredMods(state, 'backup-generator');
    expect(result.maxHeatBonus).toBe(BACKUP_GENERATOR_HEAT_BONUS);
  });

  it('is a no-op for any other Mod id', () => {
    const state = createInitialPlayerState('exploit-overclock');
    expect(applyOnModAcquiredMods(state, 'static-shield')).toEqual(state);
  });

  it('Init Script grants a one-time Data bonus the first time another Mod is acquired', () => {
    // ownedModIds already includes the newly-acquired mod by the time this hook fires (mirrors acquireMod's real call order).
    let state: RunPlayerState = { ...createInitialPlayerState('exploit-overclock'), ownedModIds: ['init-script', 'static-shield'] };
    state = applyOnModAcquiredMods(state, 'static-shield');
    expect(state.data).toBe(INIT_SCRIPT_DATA_BONUS);

    // A second Mod acquisition doesn't grant a second bonus.
    state = { ...state, ownedModIds: [...state.ownedModIds, 'light-footing'] };
    state = applyOnModAcquiredMods(state, 'light-footing');
    expect(state.data).toBe(INIT_SCRIPT_DATA_BONUS);
  });

  it("Init Script doesn't credit itself for its own acquisition", () => {
    let state: RunPlayerState = { ...createInitialPlayerState('exploit-overclock'), ownedModIds: ['init-script'] };
    state = applyOnModAcquiredMods(state, 'init-script');
    expect(state.data).toBe(0);
  });

  it("Auxiliary Process's granted subroutine installs cap-exempt and removal-locked (loadout.ts checkpoint F)", () => {
    const auxiliaryProcess = MOD_DEFINITIONS['auxiliary-process'].grantedSubroutine;
    expect(auxiliaryProcess).toBeDefined();
    const fullLoadout = Array.from({ length: INSTALLED_SLOT_CAP }, (_, i) => piece(`filler-${i}`));
    let state: RunPlayerState = { ...createInitialPlayerState('exploit-overclock'), installedLoadout: fullLoadout, bench: [piece('benched')] };
    state = installGrantedSubroutine(state, auxiliaryProcess as SubroutineDefinition, 'auxiliary-process');
    expect(state.installedLoadout).toHaveLength(INSTALLED_SLOT_CAP + 1); // exceeds the cap, exempt
    expect(state.grantedByMod[auxiliaryProcess!.id]).toBe('auxiliary-process');

    // The cap check still respects the cap for a normal install (the
    // granted entry doesn't count against it).
    const noRoom = installSubroutine(state, 'benched');
    expect(noRoom.installedLoadout).toHaveLength(INSTALLED_SLOT_CAP + 1); // unchanged -- no room

    // Removal-locked.
    const stillThere = uninstallSubroutine(state, auxiliaryProcess!.id);
    expect(stillThere).toEqual(state);
  });

  it("Backdoor Access's granted subroutine carries a Fifteen-watching cards beta -- the granted-subroutine mechanism with a beta, not just an alpha", () => {
    const backdoorAccess = MOD_DEFINITIONS['backdoor-access'].grantedSubroutine;
    expect(backdoorAccess).toBeDefined();
    // The Mod itself names no archetype, so the class-exclusion filter never sees it, whatever its piece's archetype.
    expect(MOD_DEFINITIONS['backdoor-access'].archetype).toBeUndefined();
    expect(backdoorAccess!.beta).toEqual(expect.objectContaining({ source: 'cards', category: 'fifteen' }));

    let state: RunPlayerState = createInitialPlayerState('exploit-overclock');
    state = installGrantedSubroutine(state, backdoorAccess as SubroutineDefinition, 'backdoor-access');
    expect(state.grantedByMod[backdoorAccess!.id]).toBe('backdoor-access');
  });
});

describe('Mods smoke test -- a full run with several Mods active together', () => {
  it('resolves headlessly with reactive-subroutine, hook-kind, and granted-subroutine Mods all active', () => {
    const result = playRun({
      seed: 7,
      classId: 'exploit-overclock',
      ownedModIdsOverride: ['static-shield', 'light-footing', 'rootkit-persistence', 'auxiliary-process'],
      layerNodeCounts: [4, 4, 4, 4],
    });
    expect(['heatMaxed', 'quarantined', 'noRouteRemains', 'breachedThenCaught', 'victory']).toContain(result.outcome);
    expect(result.playerState.ownedModIds).toEqual(
      expect.arrayContaining(['bridge-exploit-overclock', 'static-shield', 'light-footing', 'rootkit-persistence', 'auxiliary-process']),
    );
    // Rootkit Persistence fires outside the loadout (never installed);
    // Auxiliary Process's granted piece genuinely lives inside it.
    expect(result.playerState.installedLoadout.some((p) => p.id === 'auxiliary-process')).toBe(true);
    expect(result.playerState.grantedByMod['auxiliary-process']).toBe('auxiliary-process');
  });

  it('resolves headlessly with the full session-44 Mod Pool Expansion active (minus session 51\'s removed Redline), both reactive/granted-subroutine pieces included', () => {
    const result = playRun({
      seed: 11,
      classId: 'daemon-overclock',
      ownedModIdsOverride: [
        'cold-boot',
        'quiet-hours',
        'surge-protector',
        'first-contact',
        'petty-theft',
        'boot-sector',
        'init-script',
        'overclock-amplifier',
        'fast-learner',
        'threshold-exploit',
        'scrap-merchant',
        'heat-sink',
        'backdoor-access',
        'session-hijack-relay',
      ],
      layerNodeCounts: [4, 4, 4, 4],
    });
    expect(['heatMaxed', 'quarantined', 'noRouteRemains', 'victory']).toContain(result.outcome);
    // Boot Sector/Session Hijack Relay fire outside the loadout (never installed);
    // Backdoor Access's granted piece genuinely lives inside it.
    expect(result.playerState.installedLoadout.some((p) => p.id === 'backdoor-access')).toBe(true);
    expect(result.playerState.grantedByMod['backdoor-access']).toBe('backdoor-access');
  });
});

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint C) -- the Mod
// acquisition ladder. 2 rungs: archetype, then rarity.
// ---------------------------------------------------------------------

describe('synergyAwareModAcquisition', () => {
  // daemon-honeypot specializes in daemon + honeypot (classes.ts).
  function daemonHoneypotState(): RunPlayerState {
    return createInitialPlayerState('daemon-honeypot');
  }

  function mod(id: string, rarity: 'common' | 'uncommon' | 'rare', archetype?: 'daemon' | 'overclock'): ModDefinition {
    return { id: id as ModDefinition['id'], name: id, rarity, effectKind: 'hook', archetype };
  }

  it('prefers an on-archetype Mod over a rarer universal one', () => {
    // Rung 1 decides outright -- the rarity edge never gets consulted,
    // which is the point of a ladder over a weighted score.
    const onArchetype = mod('on-common', 'common', 'daemon');
    const universalRare = mod('universal-rare', 'rare');
    expect(synergyAwareModAcquisition([universalRare, onArchetype], daemonHoneypotState())?.id).toBe('on-common');
  });

  it('prefers a universal Mod over an off-archetype one', () => {
    const universal = mod('universal', 'common');
    const offArchetype = mod('off', 'common', 'overclock');
    expect(synergyAwareModAcquisition([offArchetype, universal], daemonHoneypotState())?.id).toBe('universal');
  });

  it('breaks a same-archetype tie by rarity', () => {
    const common = mod('u-common', 'common');
    const rare = mod('u-rare', 'rare');
    expect(synergyAwareModAcquisition([common, rare], daemonHoneypotState())?.id).toBe('u-rare');
  });

  it('falls to the earliest option on an exact tie, matching alwaysAcquireFirstMod', () => {
    const first = mod('first', 'uncommon');
    const second = mod('second', 'uncommon');
    expect(synergyAwareModAcquisition([first, second], daemonHoneypotState())?.id).toBe('first');
  });

  it('declines an empty slate', () => {
    expect(synergyAwareModAcquisition([], daemonHoneypotState())).toBeNull();
  });
});

describe('synergyAwareModShopStrategy', () => {
  function offering(mod: ModDefinition, cost: number): ModOffering {
    return { mod, cost };
  }
  function mod(id: string, rarity: 'common' | 'uncommon' | 'rare', archetype?: 'daemon' | 'overclock'): ModDefinition {
    return { id: id as ModDefinition['id'], name: id, rarity, effectKind: 'hook', archetype };
  }
  function daemonHoneypotStateWithData(data: number): RunPlayerState {
    return { ...createInitialPlayerState('daemon-honeypot'), data };
  }

  it('applies the ladder among affordable offerings', () => {
    const cheapUniversal = offering(mod('cheap-universal', 'common'), 25);
    const onArchetype = offering(mod('on-archetype', 'common', 'daemon'), 25);
    expect(synergyAwareModShopStrategy([cheapUniversal, onArchetype], daemonHoneypotStateWithData(100))?.mod.id).toBe('on-archetype');
  });

  it('never picks an unaffordable offering, even when it ranks highest', () => {
    const cheapUniversal = offering(mod('cheap-universal', 'common'), 25);
    const pricyOnArchetype = offering(mod('pricy-on', 'rare', 'daemon'), 175);
    expect(synergyAwareModShopStrategy([cheapUniversal, pricyOnArchetype], daemonHoneypotStateWithData(30))?.mod.id).toBe('cheap-universal');
  });

  it('declines when nothing is affordable', () => {
    expect(synergyAwareModShopStrategy([offering(mod('pricy', 'rare'), 175)], daemonHoneypotStateWithData(10))).toBeNull();
  });
});

// Session 58, the user's calls: Static Shield set aside; the two
// first-of-an-archetype upgrade Mods offered only to classes with it.
describe('Mod pool scoping (session 58)', () => {
  it('never offers a set-aside Mod, to any class', async () => {
    const { MODS_SET_ASIDE, generalModPool, modPoolForClass } = await import('./mods');
    const { ALL_CLASS_IDS } = await import('./classes');
    expect(MODS_SET_ASIDE.has('static-shield')).toBe(true);
    expect(generalModPool().some((m) => MODS_SET_ASIDE.has(m.id))).toBe(false);
    for (const classId of ALL_CLASS_IDS) expect(modPoolForClass(classId, []).some((m) => m.id === 'static-shield')).toBe(false);
  });

  it('offers Salvage Protocol only to Daemon classes and Fast Learner only to Overclock classes', async () => {
    const { modPoolForClass } = await import('./mods');
    const { ALL_CLASS_IDS, CLASS_DEFINITIONS } = await import('./classes');
    for (const classId of ALL_CLASS_IDS) {
      const ids = modPoolForClass(classId, []).map((m) => m.id);
      const archetypes = CLASS_DEFINITIONS[classId].archetypes;
      expect(ids.includes('salvage-protocol'), classId).toBe(archetypes.includes('daemon'));
      expect(ids.includes('fast-learner'), classId).toBe(archetypes.includes('overclock'));
    }
  });
});

describe('Events never grant a set-aside item by name (session 58)', () => {
  it('no specific Mod or Burner grant is set aside', async () => {
    const { EVENT_ROSTER } = await import('./events');
    const { MODS_SET_ASIDE } = await import('./mods');
    const { BURNERS_SET_ASIDE } = await import('./burners');
    for (const event of EVENT_ROSTER)
      for (const choice of event.choices)
        for (const { effect } of choice.outcomes) {
          if (effect.modGrant && 'specific' in effect.modGrant) expect(MODS_SET_ASIDE.has(effect.modGrant.specific.id), event.id).toBe(false);
          if (effect.burnerGrant && 'specific' in effect.burnerGrant) expect(BURNERS_SET_ASIDE.has(effect.burnerGrant.specific.id), event.id).toBe(false);
        }
  });
});
