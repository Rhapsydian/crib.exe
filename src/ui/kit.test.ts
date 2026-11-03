import { describe, expect, it } from 'vitest';
import { createCombatState } from '../engine/resolve';
import { CLASS_DEFINITIONS } from '../engine/classes';
import { burnersOf, modsOf } from './kit';

describe('kit (Mods and Burners on screen)', () => {
  it('lists the player class Mod and the enemy bridge and gatekeeper Mods, in each voice', () => {
    const loadout = CLASS_DEFINITIONS['overclock-honeypot'].startingLoadout;
    const state = createCombatState(loadout, loadout, [12, 12], 'overclock-honeypot', [50, 50], [], [], [], 'exploit-daemon', [[], ['null-session']]);
    const yours = modsOf(state, 0);
    expect(yours.map((m) => m.name)).toEqual(['Phase Shift']);
    expect(yours[0].tag).toBe('Wraith class Mod');
    expect(yours[0].text).toMatch(/^Each fifteen you score: Ward/);
    const theirs = modsOf(state, 1);
    expect(theirs.map((m) => m.name)).toEqual(['Backdoor Maintenance', 'Null Session']);
    expect(theirs[0].text).toBe('Each fifteen it scores: Suppress 1.5. The first fifteen each hand Suppresses 1 more.');
  });

  it('marks spent Burners one for one', () => {
    const items = burnersOf(['flash-drive', 'flash-drive', 'emp-charge'], ['flash-drive']);
    expect(items.map((b) => b.spent)).toEqual([true, false, false]);
    expect(items[2].text).toBe('Next turn: Suppress 12.');
  });

  it('lists the Burners a fight cannot use after the rest, marked with where they are used (session 78)', () => {
    const items = burnersOf(['flash-drive'], [], ['golden-ticket', 'cold-wallet']);
    expect(items.map((b) => b.name)).toEqual(['Flash Drive', 'Golden Ticket', 'Cold Wallet']);
    expect(items.map((b) => b.elsewhere)).toEqual([undefined, 'use on the map', 'sell at a Shop']);
    expect(items[1].text).toBe('Now: your Heat drops to 0, and the next gatekeeper has no Heat toll.');
  });
});
