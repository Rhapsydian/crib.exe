import { describe, expect, it } from 'vitest';
import { acquireNote } from './reward-text';
import { createInitialPlayerState } from '../engine/run';
import { ALL_SUBROUTINES } from '../engine/subroutines';

// Session 72 (the user's ask): an owned subroutine's note says where it is,
// its rank and its banked copies.
describe('acquireNote', () => {
  const player = createInitialPlayerState('exploit-overclock');
  const own = player.installedLoadout[0];

  it('names an owned one: loadout or bench, rank, copies banked', () => {
    expect(acquireNote(own, player, 6, 3)).toBe('You own this (in your loadout, not yet Merged, 0 copies banked). This copy banks for a Merge at a Quiet Host.');
    const benched = { ...player, installedLoadout: player.installedLoadout.slice(1), bench: [own], rank: { [own.id]: 2 }, material: { [own.id]: 1 } };
    expect(acquireNote(own, benched, 6, 3)).toBe('You own this (on your bench, rank II, 1 copy banked). This copy banks for a Merge at a Quiet Host.');
    const capped = { ...player, rank: { [own.id]: 3 }, material: { [own.id]: 2 } };
    expect(acquireNote(own, capped, 6, 3)).toContain("already rank III, so this copy banks and can be sold");
  });

  it('a new one still says where it goes', () => {
    const fresh = ALL_SUBROUTINES.find((p) => !player.installedLoadout.some((o) => o.id === p.id))!;
    expect(acquireNote(fresh, player, 6, 3)).toBe('Installs at the bottom of your loadout.');
  });
});
