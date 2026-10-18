import type { BurnerDefinition } from '../engine/burner-types';
import { rarityOf } from '../engine/rewards';
import type { RunPlayerState } from '../engine/run';
import type { SubroutineDefinition } from '../engine/subroutine-types';
import { describeEffect, describeHook, describeProcess } from './describe';

/**
 * Words for things you can acquire (milestone 3 checkpoint 3): a Burner's
 * rules wherever it is used, and what taking a piece would do to your
 * loadout.
 */

/** A Burner's rules, whichever context it belongs to. */
export function burnerText(def: BurnerDefinition): string {
  if (def.combatEffect) return `${describeEffect(def.combatEffect)}, once, before one of your turns in a fight.`;
  const map = def.mapEffect;
  if (map?.kind === 'freeMove') return 'Your next map move costs no Heat.';
  if (map?.kind === 'reopenClosedNode') return 'Reopens a closed node on the map.';
  if (map?.kind === 'revealUpcoming') return 'Reveals what the nodes ahead hold.';
  const shop = def.shopEffect;
  if (shop?.kind === 'discount') return `${Math.round(shop.fraction * 100)}% off one Shop purchase.`;
  if (shop?.kind === 'freeReroll') return 'One free Shop reroll.';
  if (shop?.kind === 'rarityFloor') return `The next Shop's pieces are all ${shop.rarity} or better.`;
  return 'No effect yet.';
}

/** Where a Burner is used, in a word. */
export function burnerWhere(def: BurnerDefinition): string {
  return def.contexts.join(' / ');
}

/** A piece's Process and Hook, as lines. */
export function pieceLines(piece: SubroutineDefinition): string[] {
  return [`Process: ${describeProcess(piece.alpha)}`, ...(piece.beta ? [`Hook: ${describeHook(piece.beta)}`] : [])];
}

/** What taking `piece` would do: Merge material for an owned piece, else
 * where it lands. */
export function acquireNote(piece: SubroutineDefinition, player: RunPlayerState, slotCap: number, benchCap: number): string {
  const owned = player.installedLoadout.some((p) => p.id === piece.id) || player.bench.some((p) => p.id === piece.id);
  if (owned) return 'You own this: it becomes Merge material, an upgrade at a Safehouse.';
  const capped = player.installedLoadout.filter((p) => !player.grantedByMod[p.id]).length;
  if (capped < slotCap) return 'Installs at the bottom of your loadout.';
  if (player.bench.length < benchCap) return 'Your loadout is full: it goes to the bench.';
  return 'Loadout and bench are full: you will choose a piece to drop.';
}

export { rarityOf };
