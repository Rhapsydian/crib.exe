import { describe, it, expect } from 'vitest';
import type { Alpha, Archetype, Beta, SubroutineDefinition } from './subroutine-types';
import type { ModId } from './mod-types';
import type { ClassId } from './classes';
import type { ScoringOccurrence } from './triggers';
import { BURNER_DEFINITIONS } from './burners';
import { applyCombatBurner, applyCutMods, applyHandEndMods, applyModOnCombatStartPassives, applyOccurrence, applyShowMods, armThirtyOne, createCombatState, fireTurn, type CombatState } from './resolve';
import { WARD_CONVERTER_SHARE, DEEP_CACHE_CAP_MULTIPLIER, LAST_WORD_INITIATIVE, LUCKY_CUT_CREDIT, NOBS_EXPLOIT_CREDIT, PERSISTENT_PAYLOAD_MULTIPLIER } from './mods';

// The twelve rule-benders (session 65, docs/mods-design.md M6).

const piece = (id: string, alpha: Alpha, beta?: Beta, archetype: Archetype = 'exploit'): SubroutineDefinition => ({ id, name: id, archetype, alpha, beta });
const credit = (id: string, amount: number, beta?: Beta) => piece(id, { verb: 'credit', amount }, beta);
const pairHook: Beta = { source: 'cards', category: 'pair', shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 } };

function fight(mods: ModId[], loadout: SubroutineDefinition[] = [credit('a', 1)], classId?: ClassId): CombatState {
  return createCombatState(loadout, [credit('enemy', 1)], [12, 12], classId, [100, 100], [], mods);
}
const progress = (s: CombatState) => s.sides[0].winGauge.progress;
const charges = (s: CombatState, i = 0) => s.sides[0].loadout[i].state.charges;
const occ = (category: ScoringOccurrence['category'], player: 0 | 1 = 0, magnitude = 2): ScoringOccurrence => ({ category, player, magnitude });

describe('rule-benders on scoring', () => {
  it('Nobs Exploit: each Jack in your hand or crib at the show Credits', () => {
    const cards = [{ rank: 11, suit: 0 }, { rank: 11, suit: 1 }, { rank: 5, suit: 2 }, { rank: 2, suit: 3 }] as const;
    expect(progress(applyShowMods(fight(['nobs-exploit']), 0, [...cards]))).toBe(2 * NOBS_EXPLOIT_CREDIT);
    expect(progress(applyShowMods(fight(['nobs-exploit']), 1, [...cards]))).toBe(0);
    expect(progress(applyShowMods(fight([]), 0, [...cards]))).toBe(0);
  });

  it('Run Splicer: a run also counts as two pairs for your Hooks', () => {
    const loadout = [credit('a', 1, pairHook)];
    expect(charges(applyOccurrence(fight(['run-splicer'], loadout), occ('run', 0, 3)))).toBe(2);
    expect(charges(applyOccurrence(fight([], loadout), occ('run', 0, 3)))).toBe(0);
  });

  it('Last Word: a go point and a 31 each add initiative', () => {
    expect(applyOccurrence(fight(['last-word']), occ('go', 0, 1)).sides[0].gauge.progress).toBeCloseTo(LAST_WORD_INITIATIVE);
    expect(applyOccurrence(fight(['last-word']), occ('thirtyOne')).sides[0].gauge.progress).toBeCloseTo(LAST_WORD_INITIATIVE);
    expect(applyOccurrence(fight(['last-word']), occ('go', 1, 1)).sides[0].gauge.progress).toBe(0);
  });

  it('Mirror Hand: each pair the enemy scores counts toward your pair Hooks', () => {
    let s = fight(['mirror-hand'], [credit('a', 1, pairHook)]);
    s = applyOccurrence(applyOccurrence(s, occ('pair', 1)), occ('pair', 1));
    expect(charges(s)).toBe(2);
    expect(charges(applyOccurrence(fight([], [credit('a', 1, pairHook)]), occ('pair', 1)))).toBe(0);
  });
});

describe('rule-benders on the cut and the hand', () => {
  it("Lucky Cut: a cut card of one of your class's suits Credits", () => {
    // Blackhat is Exploit (suit 0) and Overclock (suit 2).
    const s = fight(['lucky-cut'], undefined, 'exploit-overclock');
    expect(progress(applyCutMods(s, { rank: 5, suit: 2 }))).toBe(LUCKY_CUT_CREDIT);
    expect(progress(applyCutMods(s, { rank: 5, suit: 1 }))).toBe(0);
  });

  it('Ward Converter: Credit half of your remaining Ward at the end of a hand; the Ward stays', () => {
    const s = fight(['ward-converter']);
    const after = applyHandEndMods({ ...s, sides: [{ ...s.sides[0], wardShield: 6 }, s.sides[1]] });
    expect(progress(after)).toBeCloseTo(6 * WARD_CONVERTER_SHARE);
    expect(after.sides[0].wardShield).toBe(6);
  });
});

describe('rule-benders on the loadout', () => {
  it('Hot Standby: benched Processes fire after the loadout', () => {
    const s = { ...fight(['hot-standby']), standby: [credit('benched', 4)] };
    expect(progress(fireTurn(s, 0, { isDealer: false }).combatState)).toBe(1 + 4);
    expect(progress(fireTurn({ ...fight([]), standby: [credit('benched', 4)] }, 0, { isDealer: false }).combatState)).toBe(1);
  });

  it('Echo Chamber: the top subroutine fires again at the end of the turn', () => {
    const loadout = [credit('top', 2), credit('next', 1)];
    expect(progress(fireTurn(fight(['echo-chamber'], loadout), 0, { isDealer: false }).combatState)).toBe(2 + 1 + 2);
  });

  it('Deep Cache: a counting Hook banks up to twice its limit, and starts each fight with a count', () => {
    const s = applyModOnCombatStartPassives(fight(['deep-cache'], [credit('a', 1, pairHook)]));
    const beta = s.sides[0].loadout[0].definition.beta;
    expect(beta?.shape === 'graded' && beta.cap).toBe(3 * DEEP_CACHE_CAP_MULTIPLIER);
    expect(charges(s)).toBe(1);
  });

  it('Thirty-One: on the turn it gives, every Hook goes off', () => {
    const loadout = [credit('a', 1, pairHook)];
    // A Hook with no counts doesn't go off on an ordinary turn...
    expect(progress(fireTurn(fight(['thirty-one'], loadout), 0, { isDealer: false }).combatState)).toBe(1);
    // ...but does on the turn Thirty-One gives, and only that one.
    const armed = fireTurn(armThirtyOne(fight(['thirty-one'], loadout)), 0, { isDealer: false }).combatState;
    expect(progress(armed)).toBe(2);
    expect(progress(fireTurn(armed, 0, { isDealer: false }).combatState)).toBe(3);
  });

  it('Root Cause: a Hook going off gives the subroutine below it a count', () => {
    const loadout = [credit('top', 1, pairHook), credit('below', 1, pairHook)];
    const charged = applyOccurrence(fight(['root-cause'], loadout), occ('pair'));
    // Both Hooks banked the pair; the top one goes off and passes a count down.
    const after = fireTurn(charged, 0, { isDealer: false }).combatState;
    expect(charges(after, 0)).toBe(0);
    expect(charges(after, 1)).toBe(0); // the second went off too, spending both
    const lone = applyOccurrence(fight(['root-cause'], [credit('top', 1, pairHook), credit('below', 1)]), occ('pair'));
    expect(fireTurn(lone, 0, { isDealer: false }).combatState.sides[0].loadout[1].state.charges).toBe(0); // no Hook below: nothing banks
    const waiting = applyOccurrence(fight(['root-cause'], [credit('top', 1, pairHook), credit('below', 1, { source: 'cards', category: 'fifteen', shape: 'stepped', at: 2, effect: { verb: 'enhance', amount: 1 } })]), occ('pair'));
    expect(charges(fireTurn(waiting, 0, { isDealer: false }).combatState, 1)).toBe(1);
  });

  it("Persistent Payload: a Burner's timed effects last twice as long", () => {
    const zeroDay = BURNER_DEFINITIONS['zero-day'].combat!.effect;
    const hands = (mods: ModId[]) => applyCombatBurner(fight(mods), 0, 'zero-day', zeroDay).sides[0].passiveState['burner:hooksTwice'];
    expect(hands(['persistent-payload'])).toBe(2 * hands([]));
  });

  it("Persistent Payload: a Burner's temporary subroutine lasts twice as long", () => {
    const effect = BURNER_DEFINITIONS['bootstrap-loader'].combat!.effect;
    const temp = (mods: ModId[]) => applyCombatBurner(fight(mods), 0, 'bootstrap-loader', effect).sides[0].loadout.find((e) => e.temp)?.temp?.firesLeft;
    expect(temp(['persistent-payload'])).toBe(3 * PERSISTENT_PAYLOAD_MULTIPLIER);
    expect(temp([])).toBe(3);
  });
});
