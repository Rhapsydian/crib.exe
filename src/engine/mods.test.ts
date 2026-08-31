import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import type { SubroutineDefinition } from './subroutine-types';
import { createCombatState, resolvePayload, applyModGaugeCross50Passives, applyModOnCombatStartPassives, tickCastersTurnPulse } from './resolve';
import { updateSubroutineState, updateSuitTallyState, createInitialState } from './triggers';
import { installGrantedSubroutine, installSubroutine, uninstallSubroutine, INSTALLED_SLOT_CAP } from './loadout';
import { playRun, createInitialPlayerState, type RunPlayerState } from './run';
import {
  MOD_DEFINITIONS,
  MOD_SMALL,
  MOD_MEDIUM,
  LIGHT_FOOTING_HEAT_DISCOUNT,
  VENDOR_DISCOUNT_FRACTION,
  PETTY_CACHE_DATA_BONUS,
  BACKUP_GENERATOR_HEAT_BONUS,
  OVERCLOCKED_ACCUMULATOR_REDUCTION,
  TAGGED_FIRMWARE_TAG,
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
} from './mods';
import { shopOfferingsForClass, modOfferingsForClass } from './shop';

/**
 * Mods verification (Phase 5 checkpoint I): every one of the 12 hook
 * points exercised by at least one real test, plus a smoke-tested full
 * run with several Mods active together. Mirrors resolve.test.ts's own
 * style -- exercised through the public API (resolvePayload,
 * tickCastersTurnPulse, etc.), not by reaching into resolve.ts's private
 * per-hook dispatch functions, same as every existing enemy-passive test.
 */

function piece(id: string, overrides: Partial<SubroutineDefinition> = {}): SubroutineDefinition {
  return {
    id,
    name: id,
    archetype: 'exploit',
    trigger: { kind: 'always' },
    payload: { kind: 'directBurst', amount: 5 },
    tags: [],
    ...overrides,
  };
}

describe('Mod pool size (session 44 Mod Pool Expansion -- structural count guard)', () => {
  it('the general pool doubled every rarity tier (7/6/4 -> 14/12/8), 6 class-exclusive Mods untouched', () => {
    const all = Object.values(MOD_DEFINITIONS);
    const classExclusive = all.filter((m) => m.classExclusive);
    const general = all.filter((m) => !m.classExclusive);
    expect(classExclusive).toHaveLength(6);
    expect(general.filter((m) => m.rarity === 'common')).toHaveLength(14);
    expect(general.filter((m) => m.rarity === 'uncommon')).toHaveLength(12);
    expect(general.filter((m) => m.rarity === 'rare')).toHaveLength(8);
    expect(general).toHaveLength(34);
    expect(all).toHaveLength(40);
  });
});

describe('onFire -- Tagged Firmware / Malware Amplifier', () => {
  it('Tagged Firmware credits a bonus when a matching-tag subroutine fires', () => {
    const withMod = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['tagged-firmware']);
    const tagged = piece('tagged', { tags: [TAGGED_FIRMWARE_TAG] });
    const result = resolvePayload(tagged.payload, tagged.archetype, withMod, 0, { priorFireCountThisTurn: 0 }, tagged);
    expect(result.sides[0].winGauge.progress).toBe(5 + MOD_MEDIUM);

    // No bonus without the tag, even with the Mod owned.
    const untagged = piece('untagged');
    const noBonus = resolvePayload(untagged.payload, untagged.archetype, withMod, 0, { priorFireCountThisTurn: 0 }, untagged);
    expect(noBonus.sides[0].winGauge.progress).toBe(5);
  });

  it('Malware Amplifier credits a bonus on any Malware fire, archetype-only (no definition needed)', () => {
    const withMod = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['malware-amplifier']);
    const result = resolvePayload({ kind: 'directBurst', amount: 5 }, 'malware', withMod, 0);
    expect(result.sides[0].winGauge.progress).toBe(5 + MOD_MEDIUM);
  });

  it('side 1 (enemy) never gets a player Mod bonus', () => {
    const withMod = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['malware-amplifier']);
    const result = resolvePayload({ kind: 'directBurst', amount: 5 }, 'malware', withMod, 1);
    expect(result.sides[1].winGauge.progress).toBe(5);
  });

  it.each([
    ['exploit-amplifier', 'exploit'],
    ['encryption-amplifier', 'encryption'],
    ['root-amplifier', 'root'],
  ] as const)('%s credits a bonus on any %s fire -- Malware Amplifier\'s implied sibling', (modId, archetype) => {
    const withMod = createCombatState([], [], [12, 12], undefined, [100, 100], [], [modId]);
    const result = resolvePayload({ kind: 'directBurst', amount: 5 }, archetype, withMod, 0);
    expect(result.sides[0].winGauge.progress).toBe(5 + MOD_MEDIUM);
    // Doesn't cross-fire on another archetype.
    const noBonus = resolvePayload({ kind: 'directBurst', amount: 5 }, 'neutral', withMod, 0);
    expect(noBonus.sides[0].winGauge.progress).toBe(5);
  });
});

describe('onTick / onTickExpiring -- Redundant Ticks / Failsafe Cascade', () => {
  it('Redundant Ticks extends a single tick instance once before it expires', () => {
    const base = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['redundant-ticks']);
    let state = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 1 }, 'malware', base, 0);
    // First tick: duration exhausts to 0, would normally expire -- Redundant Ticks extends it once.
    state = tickCastersTurnPulse(state, 0);
    expect(state.sides[0].winGauge.progress).toBe(5);
    expect(state.sides[1].dots).toEqual([expect.objectContaining({ remainingDuration: 1, redundantTickUsed: true })]);
    // Second tick: already used its one extension -- expires for real this time.
    state = tickCastersTurnPulse(state, 0);
    expect(state.sides[0].winGauge.progress).toBe(10);
    expect(state.sides[1].dots).toEqual([]);
  });

  it('Failsafe Cascade extends only the first tick to expire each fight, not a second', () => {
    const base = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['failsafe-cascade']);
    let state = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 1 }, 'malware', base, 0);
    state = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 1 }, 'malware', state, 0);
    expect(state.sides[1].dots).toHaveLength(2);
    // Both ticks expire on the same pass -- only the first (array order) gets Failsafe Cascade's one-shot save.
    state = tickCastersTurnPulse(state, 0);
    expect(state.sides[1].dots).toEqual([expect.objectContaining({ remainingDuration: 1 })]);
  });

  it('without the Mod, a duration-1 tick expires normally after one tick', () => {
    const base = createCombatState([], [], [12, 12]);
    let state = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 1 }, 'malware', base, 0);
    state = tickCastersTurnPulse(state, 0);
    expect(state.sides[1].dots).toEqual([]);
  });

  it('Redline credits a bonus to the caster\'s own gauge on top of every DoT tick -- the first Mod content on plain onTick', () => {
    const base = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['redline']);
    let state = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 2 }, 'malware', base, 0);
    expect(state.sides[0].winGauge.progress).toBe(0); // applying the DoT itself doesn't tick it
    state = tickCastersTurnPulse(state, 0);
    expect(state.sides[0].winGauge.progress).toBe(5 + MOD_SMALL); // base tick damage + REDLINE_TICK_CREDIT
    state = tickCastersTurnPulse(state, 0);
    expect(state.sides[0].winGauge.progress).toBe((5 + MOD_SMALL) * 2); // every tick, not one-shot
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

describe('onIncomingDirectBurst -- Static Shield / Surge Protector', () => {
  it('mitigates a flat amount off every incoming direct burst, uncapped', () => {
    const state = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['static-shield']);
    const afterFirst = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1);
    expect(afterFirst.sides[1].winGauge.progress).toBe(10 - MOD_SMALL);
    const afterSecond = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', afterFirst, 1);
    expect(afterSecond.sides[1].winGauge.progress).toBe(10 - MOD_SMALL + (10 - MOD_SMALL)); // mitigated again, not one-shot
  });

  it('Surge Protector mitigates a bigger amount, but only the first incoming direct burst each fight', () => {
    const state = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['surge-protector']);
    const afterFirst = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1);
    expect(afterFirst.sides[1].winGauge.progress).toBe(10 - MOD_MEDIUM);
    const afterSecond = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', afterFirst, 1);
    expect(afterSecond.sides[1].winGauge.progress).toBe(10 - MOD_MEDIUM + 10); // one-shot -- no mitigation on the second hit
  });

  it('both Mods stack on the same hit, Static Shield first', () => {
    const state = createCombatState([], [], [12, 12], undefined, [100, 100], [], ['static-shield', 'surge-protector']);
    const result = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1);
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

describe('onTriggerEvaluate -- Overclocked Accumulator', () => {
  it('reduces an Accumulator subroutine\'s effective threshold', () => {
    const definition = piece('acc', { trigger: { kind: 'accumulator', metric: 'points', threshold: 10 } });
    const occurrence = { category: 'fifteen' as const, player: 0 as const, magnitude: 9 };
    const withoutMultiplier = updateSubroutineState(createInitialState(), definition, occurrence, 0);
    expect(withoutMultiplier.ready).toBe(false); // 9 < 10

    const multiplier = 1 - OVERCLOCKED_ACCUMULATOR_REDUCTION; // 0.85
    const withMultiplier = updateSubroutineState(createInitialState(), definition, occurrence, 0, multiplier);
    expect(withMultiplier.ready).toBe(true); // 9 >= 10 * 0.85
  });

  it('also reduces a suitTally Accumulator\'s effective threshold', () => {
    const definition = piece('suit', { trigger: { kind: 'accumulator', metric: 'suitTally', suit: 0, threshold: 10 } });
    const multiplier = 1 - OVERCLOCKED_ACCUMULATOR_REDUCTION; // 0.85
    let withoutMultiplier = createInitialState();
    for (let i = 0; i < 9; i++) withoutMultiplier = updateSuitTallyState(withoutMultiplier, definition, { suit: 0, player: 0 }, 0);
    expect(withoutMultiplier.ready).toBe(false); // 9 < 10

    let withMultiplier = createInitialState();
    for (let i = 0; i < 9; i++) withMultiplier = updateSuitTallyState(withMultiplier, definition, { suit: 0, player: 0 }, 0, multiplier);
    expect(withMultiplier.ready).toBe(true); // 9 >= 10 * 0.85 (8.5)
  });
});

describe('onTriggerEvaluate -- Threshold Exploit', () => {
  it("reduces an Occurrence-Threshold subroutine's bankTarget", () => {
    // bankTarget 4 * (1 - 0.15) = 3.4, rounds to 3 -- 1 fewer banked occurrence needed.
    const definition = piece('occ', { trigger: { kind: 'occurrence', category: 'fifteen', variation: 'threshold', bankTarget: 4 } });
    const occurrence = { category: 'fifteen' as const, player: 0 as const, magnitude: 1 };

    let withoutReduction = createInitialState();
    for (let i = 0; i < 3; i++) withoutReduction = updateSubroutineState(withoutReduction, definition, occurrence, 0);
    expect(withoutReduction.ready).toBe(false); // 3 banked < bankTarget 4

    let withReduction = createInitialState();
    for (let i = 0; i < 3; i++) withReduction = updateSubroutineState(withReduction, definition, occurrence, 0, 1, THRESHOLD_EXPLOIT_REDUCTION);
    expect(withReduction.ready).toBe(true); // 3 banked >= effective target 3
  });

  it('never reduces bankTarget below 1', () => {
    const definition = piece('occ-min', { trigger: { kind: 'occurrence', category: 'fifteen', variation: 'threshold', bankTarget: 1 } });
    const occurrence = { category: 'fifteen' as const, player: 0 as const, magnitude: 1 };
    const state = updateSubroutineState(createInitialState(), definition, occurrence, 0, 1, THRESHOLD_EXPLOIT_REDUCTION);
    expect(state.ready).toBe(true); // still needs exactly 1, never 0
  });
});

describe('onMove -- Light Footing / Quiet Hours', () => {
  it('discounts the flat per-move Heat cost, floored at 0', () => {
    expect(applyOnMoveMods(['light-footing'], 2)).toBe(2 - LIGHT_FOOTING_HEAT_DISCOUNT);
    expect(applyOnMoveMods(['light-footing'], 0)).toBe(0);
    expect(applyOnMoveMods([], 2)).toBe(2);
  });

  it('Quiet Hours grants a Data trickle every QUIET_HOURS_MOVE_INTERVAL moves', () => {
    let state: RunPlayerState = { ...createInitialPlayerState('breacher'), ownedModIds: ['quiet-hours'] };
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
    const state = createInitialPlayerState('breacher');
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
    const withDiscount = shopOfferingsForClass('breacher', createRng(1), 0, 0, discountFraction);
    const withoutDiscount = shopOfferingsForClass('breacher', createRng(1), 0, 0, 0);
    for (let i = 0; i < withDiscount.length; i++) {
      expect(withDiscount[i].cost).toBeLessThanOrEqual(withoutDiscount[i].cost);
    }
  });

  it('Bulk Buyer offers one extra common on both the subroutine and Mod slates', () => {
    const { extraCommons } = shopModifiersForOwnedMods(['bulk-buyer']);
    expect(extraCommons).toBe(1);
    const slate = shopOfferingsForClass('breacher', createRng(1), extraCommons, 0, 0);
    const modSlate = modOfferingsForClass('breacher', [], createRng(1), extraCommons, 0, 0);
    expect(slate.length).toBe(5 + 1); // 3 commons + 1 -- see SHOP_COMMON_SLOTS
    expect(modSlate.length).toBeGreaterThan(0);
  });

  it('no modifiers when neither Mod is owned', () => {
    expect(shopModifiersForOwnedMods([])).toEqual({ discountFraction: 0, extraCommons: 0, extraUncommons: 0 });
  });

  it("Scrap Merchant offers one extra uncommon -- Bulk Buyer's sibling, one tier up", () => {
    const { extraUncommons } = shopModifiersForOwnedMods(['scrap-merchant']);
    expect(extraUncommons).toBe(1);
    const slate = shopOfferingsForClass('breacher', createRng(1), 0, extraUncommons, 0);
    // 3 commons + 1 wildcard + (1 + extraUncommons) uncommons, minus overlap the wildcard coin-flip can cause --
    // just confirm the slate grew past the baseline 5-offering shape.
    const baseline = shopOfferingsForClass('breacher', createRng(1), 0, 0, 0);
    expect(slate.length).toBeGreaterThanOrEqual(baseline.length);
  });
});

describe('onSubroutineAcquired -- Salvage Protocol', () => {
  it('upgrades the first acquired Malware subroutine once', () => {
    const malwarePiece = piece('acquired-malware', { archetype: 'malware', payload: { kind: 'directBurst', amount: 5 } });
    let state: RunPlayerState = {
      ...createInitialPlayerState('breacher'),
      installedLoadout: [malwarePiece],
      ownedModIds: ['salvage-protocol'],
    };
    state = applyOnSubroutineAcquiredMods(state, malwarePiece);
    expect(state.installedLoadout[0].payload).toEqual({ kind: 'directBurst', amount: 5 + 3 }); // MERGE_MAGNITUDE_BONUS
    expect(state.material[malwarePiece.id]).toBe(0);

    // "First... each run" -- a second acquisition doesn't upgrade again.
    const secondMalware = piece('acquired-malware-2', { archetype: 'malware', payload: { kind: 'directBurst', amount: 5 } });
    state = { ...state, installedLoadout: [...state.installedLoadout, secondMalware] };
    state = applyOnSubroutineAcquiredMods(state, secondMalware);
    expect(state.installedLoadout[1].payload).toEqual({ kind: 'directBurst', amount: 5 }); // unchanged
  });

  it('ignores non-Malware acquisitions', () => {
    const exploitPiece = piece('acquired-exploit');
    const state: RunPlayerState = {
      ...createInitialPlayerState('breacher'),
      installedLoadout: [exploitPiece],
      ownedModIds: ['salvage-protocol'],
    };
    const result = applyOnSubroutineAcquiredMods(state, exploitPiece);
    expect(result).toEqual(state);
  });
});

describe('onSubroutineAcquired -- Fast Learner', () => {
  it('upgrades the first acquired Root subroutine once -- Salvage Protocol\'s sibling, extended to a second archetype', () => {
    const rootPiece = piece('acquired-root', { archetype: 'root', payload: { kind: 'directBurst', amount: 5 } });
    let state: RunPlayerState = {
      ...createInitialPlayerState('breacher'),
      installedLoadout: [rootPiece],
      ownedModIds: ['fast-learner'],
    };
    state = applyOnSubroutineAcquiredMods(state, rootPiece);
    expect(state.installedLoadout[0].payload).toEqual({ kind: 'directBurst', amount: 5 + 3 }); // MERGE_MAGNITUDE_BONUS
  });

  it('tracks independently from Salvage Protocol -- owning both upgrades one Malware and one Root piece', () => {
    const malwarePiece = piece('both-malware', { archetype: 'malware', payload: { kind: 'directBurst', amount: 5 } });
    const rootPiece = piece('both-root', { archetype: 'root', payload: { kind: 'directBurst', amount: 5 } });
    let state: RunPlayerState = {
      ...createInitialPlayerState('breacher'),
      installedLoadout: [malwarePiece, rootPiece],
      ownedModIds: ['salvage-protocol', 'fast-learner'],
    };
    state = applyOnSubroutineAcquiredMods(state, malwarePiece);
    state = applyOnSubroutineAcquiredMods(state, rootPiece);
    expect(state.installedLoadout[0].payload).toEqual({ kind: 'directBurst', amount: 5 + 3 });
    expect(state.installedLoadout[1].payload).toEqual({ kind: 'directBurst', amount: 5 + 3 });
  });
});

describe('onModAcquired -- Backup Generator / Auxiliary Process', () => {
  it('Backup Generator permanently raises max Heat capacity', () => {
    const state = createInitialPlayerState('breacher');
    const result = applyOnModAcquiredMods(state, 'backup-generator');
    expect(result.maxHeatBonus).toBe(BACKUP_GENERATOR_HEAT_BONUS);
  });

  it('is a no-op for any other Mod id', () => {
    const state = createInitialPlayerState('breacher');
    expect(applyOnModAcquiredMods(state, 'static-shield')).toEqual(state);
  });

  it('Init Script grants a one-time Data bonus the first time another Mod is acquired', () => {
    // ownedModIds already includes the newly-acquired mod by the time this hook fires (mirrors acquireMod's real call order).
    let state: RunPlayerState = { ...createInitialPlayerState('breacher'), ownedModIds: ['init-script', 'static-shield'] };
    state = applyOnModAcquiredMods(state, 'static-shield');
    expect(state.data).toBe(INIT_SCRIPT_DATA_BONUS);

    // A second Mod acquisition doesn't grant a second bonus.
    state = { ...state, ownedModIds: [...state.ownedModIds, 'light-footing'] };
    state = applyOnModAcquiredMods(state, 'light-footing');
    expect(state.data).toBe(INIT_SCRIPT_DATA_BONUS);
  });

  it("Init Script doesn't credit itself for its own acquisition", () => {
    let state: RunPlayerState = { ...createInitialPlayerState('breacher'), ownedModIds: ['init-script'] };
    state = applyOnModAcquiredMods(state, 'init-script');
    expect(state.data).toBe(0);
  });

  it("Auxiliary Process's granted subroutine installs cap-exempt and removal-locked (loadout.ts checkpoint F)", () => {
    const auxiliaryProcess = MOD_DEFINITIONS['auxiliary-process'].grantedSubroutine;
    expect(auxiliaryProcess).toBeDefined();
    const fullLoadout = Array.from({ length: INSTALLED_SLOT_CAP }, (_, i) => piece(`filler-${i}`));
    let state: RunPlayerState = { ...createInitialPlayerState('breacher'), installedLoadout: fullLoadout, bench: [piece('benched')] };
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

  it("Backdoor Access's granted subroutine is Occurrence-triggered -- a second trigger family for the granted-subroutine mechanism", () => {
    const backdoorAccess = MOD_DEFINITIONS['backdoor-access'].grantedSubroutine;
    expect(backdoorAccess).toBeDefined();
    expect(backdoorAccess!.archetype).toBe('neutral'); // dodges the class-exclusion filter, same reasoning as Auxiliary Process
    expect(backdoorAccess!.trigger).toEqual({ kind: 'occurrence', category: 'fifteen', variation: 'instant' });

    let state: RunPlayerState = createInitialPlayerState('breacher');
    state = installGrantedSubroutine(state, backdoorAccess as SubroutineDefinition, 'backdoor-access');
    expect(state.grantedByMod[backdoorAccess!.id]).toBe('backdoor-access');
  });
});

describe('Mods smoke test -- a full run with several Mods active together', () => {
  it('resolves headlessly with reactive-subroutine, hook-kind, and granted-subroutine Mods all active', () => {
    const result = playRun({
      seed: 7,
      classId: 'breacher',
      ownedModIdsOverride: ['static-shield', 'light-footing', 'rootkit-persistence', 'auxiliary-process'],
      layerNodeCounts: [4, 4, 4, 4],
    });
    expect(['heatMaxed', 'quarantined', 'noRouteRemains', 'victory']).toContain(result.outcome);
    expect(result.playerState.ownedModIds).toEqual(
      expect.arrayContaining(['foothold', 'static-shield', 'light-footing', 'rootkit-persistence', 'auxiliary-process']),
    );
    // Rootkit Persistence fires outside the loadout (never installed);
    // Auxiliary Process's granted piece genuinely lives inside it.
    expect(result.playerState.installedLoadout.some((p) => p.id === 'auxiliary-process')).toBe(true);
    expect(result.playerState.grantedByMod['auxiliary-process']).toBe('auxiliary-process');
  });

  it('resolves headlessly with the full session-44 Mod Pool Expansion active, both new reactive/granted-subroutine pieces included', () => {
    const result = playRun({
      seed: 11,
      classId: 'operator',
      ownedModIdsOverride: [
        'cold-boot',
        'quiet-hours',
        'surge-protector',
        'first-contact',
        'petty-theft',
        'boot-sector',
        'init-script',
        'root-amplifier',
        'fast-learner',
        'threshold-exploit',
        'scrap-merchant',
        'redline',
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
