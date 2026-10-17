import type { FireEvent, LoadoutEntry } from '../engine/resolve';
import type { FightSnapshot } from './snapshot';

/** A piece the player tapped: which side, which slot. */
export interface Picked {
  side: 0 | 1;
  index: number;
}

/** Everything a layout needs from a paused fight, flattened. During the
 * discard the starter isn't cut yet, so it is undefined, and the whole
 * six-card hand is selectable. */
export function fightParts(snapshot: FightSnapshot) {
  const { request } = snapshot;
  const { view } = request;
  const discarding = request.kind === 'discard';
  return {
    view,
    phase: request.kind,
    you: view.combatState.sides[0],
    them: view.combatState.sides[1],
    legal: discarding ? request.context.hand : request.context.legalCards,
    count: discarding ? 0 : request.context.count,
    sequence: discarding ? [] : request.context.sequence,
    hand: discarding ? request.context.hand : request.pegging.hand,
    opponentCardsLeft: discarding ? 6 : request.pegging.opponentCardsLeft,
    starter: discarding ? undefined : view.hands[view.handIndex]?.starter,
    playerIsDealer: view.dealer === 0,
    enemyName: snapshot.enemy.name,
    className: snapshot.className,
  };
}

export function pickedEntry(snapshot: FightSnapshot, picked: Picked | null): { entry: LoadoutEntry; lastFire?: FireEvent } | null {
  if (!picked) return null;
  const { view } = snapshot.request;
  const entry = view.combatState.sides[picked.side].loadout[picked.index];
  if (!entry) return null;
  const lastFire = [...view.log].reverse().find((e) => e.side === picked.side && e.subroutineId === entry.definition.id);
  return { entry, lastFire };
}

/** A log line's piece, as a Picked (the first slot with that id). */
export function pickFromLog(snapshot: FightSnapshot, side: 0 | 1, subroutineId: string): Picked | null {
  const index = snapshot.request.view.combatState.sides[side].loadout.findIndex((e) => e.definition.id === subroutineId);
  return index === -1 ? null : { side, index };
}
