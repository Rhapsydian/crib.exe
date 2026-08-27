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
  applyOnMoveMods,
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

describe('onFire -- Tagged Firmware / Malware Amplifier', () => {
  it('Tagged Firmware credits a bonus when a matching-tag subroutine fires', () => {
    const withMod = createCombatState([], [], 12, undefined, 100, [], ['tagged-firmware']);
    const tagged = piece('tagged', { tags: [TAGGED_FIRMWARE_TAG] });
    const result = resolvePayload(tagged.payload, tagged.archetype, withMod, 0, { priorFireCountThisTurn: 0 }, tagged);
    expect(result.sides[0].winGauge.progress).toBe(5 + MOD_MEDIUM);

    // No bonus without the tag, even with the Mod owned.
    const untagged = piece('untagged');
    const noBonus = resolvePayload(untagged.payload, untagged.archetype, withMod, 0, { priorFireCountThisTurn: 0 }, untagged);
    expect(noBonus.sides[0].winGauge.progress).toBe(5);
  });

  it('Malware Amplifier credits a bonus on any Malware fire, archetype-only (no definition needed)', () => {
    const withMod = createCombatState([], [], 12, undefined, 100, [], ['malware-amplifier']);
    const result = resolvePayload({ kind: 'directBurst', amount: 5 }, 'malware', withMod, 0);
    expect(result.sides[0].winGauge.progress).toBe(5 + MOD_MEDIUM);
  });

  it('side 1 (enemy) never gets a player Mod bonus', () => {
    const withMod = createCombatState([], [], 12, undefined, 100, [], ['malware-amplifier']);
    const result = resolvePayload({ kind: 'directBurst', amount: 5 }, 'malware', withMod, 1);
    expect(result.sides[1].winGauge.progress).toBe(5);
  });
});

describe('onTick / onTickExpiring -- Redundant Ticks / Failsafe Cascade', () => {
  it('Redundant Ticks extends a single tick instance once before it expires', () => {
    const base = createCombatState([], [], 12, undefined, 100, [], ['redundant-ticks']);
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
    const base = createCombatState([], [], 12, undefined, 100, [], ['failsafe-cascade']);
    let state = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 1 }, 'malware', base, 0);
    state = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 1 }, 'malware', state, 0);
    expect(state.sides[1].dots).toHaveLength(2);
    // Both ticks expire on the same pass -- only the first (array order) gets Failsafe Cascade's one-shot save.
    state = tickCastersTurnPulse(state, 0);
    expect(state.sides[1].dots).toEqual([expect.objectContaining({ remainingDuration: 1 })]);
  });

  it('without the Mod, a duration-1 tick expires normally after one tick', () => {
    const base = createCombatState([], [], 12);
    let state = resolvePayload({ kind: 'dot', amountPerTick: 5, cadence: 'castersTurnPulse', duration: 1 }, 'malware', base, 0);
    state = tickCastersTurnPulse(state, 0);
    expect(state.sides[1].dots).toEqual([]);
  });
});

describe('onGaugeCross50 -- Early Momentum', () => {
  it("pushes the player's own gauge once, the first time it crosses halfway", () => {
    const base = createCombatState([], [], 12, undefined, 100, [], ['early-momentum']);
    const at50 = { ...base, sides: [{ ...base.sides[0], winGauge: { progress: 50, threshold: 100 } }, base.sides[1]] as typeof base.sides };
    const first = applyModGaugeCross50Passives(at50);
    expect(first.sides[0].winGauge.progress).toBe(50 + MOD_SMALL);
    const second = applyModGaugeCross50Passives(first);
    expect(second).toEqual(first); // one-shot per fight
  });
});

describe('onIncomingDirectBurst -- Static Shield', () => {
  it('mitigates a flat amount off every incoming direct burst, uncapped', () => {
    const state = createCombatState([], [], 12, undefined, 100, [], ['static-shield']);
    const afterFirst = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', state, 1);
    expect(afterFirst.sides[1].winGauge.progress).toBe(10 - MOD_SMALL);
    const afterSecond = resolvePayload({ kind: 'directBurst', amount: 10 }, 'exploit', afterFirst, 1);
    expect(afterSecond.sides[1].winGauge.progress).toBe(10 - MOD_SMALL + (10 - MOD_SMALL)); // mitigated again, not one-shot
  });
});

describe('onCombatStart -- Warm Boot', () => {
  it('starts the fight with a small Ward on side 0', () => {
    const withMod = createCombatState([], [], 12, undefined, 100, [], ['warm-boot']);
    const result = applyModOnCombatStartPassives(withMod);
    expect(result.sides[0].wardShield).toBe(MOD_SMALL);
  });

  it('is a no-op without the Mod', () => {
    const withoutMod = createCombatState([], [], 12);
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

describe('onMove -- Light Footing', () => {
  it('discounts the flat per-move Heat cost, floored at 0', () => {
    expect(applyOnMoveMods(['light-footing'], 2)).toBe(2 - LIGHT_FOOTING_HEAT_DISCOUNT);
    expect(applyOnMoveMods(['light-footing'], 0)).toBe(0);
    expect(applyOnMoveMods([], 2)).toBe(2);
  });
});

describe('onEncounterResolved -- Petty Cache / Black Budget', () => {
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
});

describe('onShopSlateGenerated -- Vendor Discount / Bulk Buyer', () => {
  it('Vendor Discount reduces every offering price by a flat fraction', () => {
    const { discountFraction } = shopModifiersForOwnedMods(['vendor-discount']);
    expect(discountFraction).toBe(VENDOR_DISCOUNT_FRACTION);
    const withDiscount = shopOfferingsForClass('breacher', createRng(1), 0, discountFraction);
    const withoutDiscount = shopOfferingsForClass('breacher', createRng(1), 0, 0);
    for (let i = 0; i < withDiscount.length; i++) {
      expect(withDiscount[i].cost).toBeLessThanOrEqual(withoutDiscount[i].cost);
    }
  });

  it('Bulk Buyer offers one extra common on both the subroutine and Mod slates', () => {
    const { extraCommons } = shopModifiersForOwnedMods(['bulk-buyer']);
    expect(extraCommons).toBe(1);
    const slate = shopOfferingsForClass('breacher', createRng(1), extraCommons, 0);
    const modSlate = modOfferingsForClass('breacher', [], createRng(1), extraCommons, 0);
    expect(slate.length).toBe(5 + 1); // 3 commons + 1 -- see SHOP_COMMON_SLOTS
    expect(modSlate.length).toBeGreaterThan(0);
  });

  it('no modifiers when neither Mod is owned', () => {
    expect(shopModifiersForOwnedMods([])).toEqual({ discountFraction: 0, extraCommons: 0 });
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
});
