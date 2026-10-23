import type { BurnerDefinition } from '../engine/burner-types';
import { rarityOf } from '../engine/rewards';
import type { RunPlayerState } from '../engine/run';
import type { SubroutineDefinition } from '../engine/subroutine-types';
import { describeHook, describeProcess } from './describe';

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
  return def.contexts.length ? def.contexts.join(' / ') : 'sell';
}

/** A subroutine's Process and Hook, as lines. */
export function pieceLines(piece: SubroutineDefinition): string[] {
  return [`Process: ${describeProcess(piece.alpha)}`, ...(piece.beta ? [`Hook: ${describeHook(piece)}`] : [])];
}

/** What taking `piece` would do: Merge material for an owned piece, else
 * where it lands. */
export function acquireNote(piece: SubroutineDefinition, player: RunPlayerState, slotCap: number, benchCap: number): string {
  const owned = player.installedLoadout.some((p) => p.id === piece.id) || player.bench.some((p) => p.id === piece.id);
  if (owned) return 'You own this: it becomes Merge material, an upgrade at a Safehouse.';
  const capped = player.installedLoadout.filter((p) => !player.grantedByMod[p.id]).length;
  if (capped < slotCap) return 'Installs at the bottom of your loadout.';
  if (player.bench.length < benchCap) return 'Your loadout is full: it goes to the bench.';
  return 'Loadout and bench are full: you will choose a subroutine to drop.';
}

export { rarityOf };
