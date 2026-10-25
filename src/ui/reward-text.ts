import type { BurnerDefinition } from '../engine/burner-types';
import { rarityOf } from '../engine/rewards';
import type { RunPlayerState } from '../engine/run';
import type { SubroutineDefinition } from '../engine/subroutine-types';
import { describeHook, describeProcess } from './describe';
import { rankMark } from './visit-text';
import { MERGE_RANK_CAP } from '../engine/merge';

/**
 * Words for things you can acquire (milestone 3 checkpoint 3): a Burner's
 * rules wherever it is used, and what taking a piece would do to your
 * loadout.
 */


/** A Burner's rules, whichever context it belongs to: its authored text
 * (session 64). */
export function burnerText(def: BurnerDefinition): string {
  return def.text;
}

/** Where a Burner is used, in a word. */
export function burnerWhere(def: BurnerDefinition): string {
  return def.contexts.length ? def.contexts.join(' / ') : def.passive ? 'gatekeeper' : 'sell';
}

/** A subroutine's Process and Hook, as lines. */
export function pieceLines(piece: SubroutineDefinition): string[] {
  return [`Process: ${describeProcess(piece.alpha)}`, ...(piece.beta ? [`Hook: ${describeHook(piece)}`] : [])];
}

/** What taking `piece` would do: Merge material for an owned piece, else
 * where it lands. */
export function acquireNote(piece: SubroutineDefinition, player: RunPlayerState, slotCap: number, benchCap: number): string {
  // Owned (the user's ask, session 72): where it is, its rank, and the
  // copies already banked, so a pick says what it adds to.
  const installed = player.installedLoadout.some((p) => p.id === piece.id);
  const benched = player.bench.some((p) => p.id === piece.id);
  if (installed || benched) {
    const rank = player.rank[piece.id] ?? 0;
    const banked = player.material[piece.id] ?? 0;
    const state = [installed ? 'in your loadout' : 'on your bench', rank ? `rank ${rankMark(rank)}` : 'not yet Merged', `${banked} cop${banked === 1 ? 'y' : 'ies'} banked`].join(', ');
    return rank >= MERGE_RANK_CAP
      ? `You own this (${state}). It's already rank III, so this copy banks and can be sold at a Shop.`
      : `You own this (${state}). This copy banks for a Merge at a Safehouse.`;
  }
  const capped = player.installedLoadout.filter((p) => !player.grantedByMod[p.id]).length;
  if (capped < slotCap) return 'Installs at the bottom of your loadout.';
  if (player.bench.length < benchCap) return 'Your loadout is full: it goes to the bench.';
  return 'Loadout and bench are full: you will choose a subroutine to drop.';
}

export { rarityOf };
