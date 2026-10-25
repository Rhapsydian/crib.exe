import type { FireEvent, LoadoutEntry } from '../engine/resolve';
import type { Thresholds } from './describe';
import type { FightSnapshot } from './snapshot';
import type { PegSpot } from './coach';

/** A piece the player tapped: which side, which slot. */
export interface Picked {
  side: 0 | 1;
  index: number;
}

/** Everything a layout needs from a paused fight, flattened. During the
 * discard the starter isn't cut yet, so it is undefined, and the whole
 * six-card hand is selectable. A Burner request (before one of your
 * turns) has no hand to show; the screen asks about the Burner instead. */
export function fightParts(snapshot: FightSnapshot) {
  const { request } = snapshot;
  const { view } = request;
  const discarding = request.kind === 'discard';
  const playing = request.kind === 'play';
  return {
    view,
    phase: request.kind,
    you: view.combatState.sides[0],
    them: view.combatState.sides[1],
    legal: discarding ? request.context.hand : playing ? request.context.legalCards : [],
    count: playing ? request.context.count : 0,
    sequence: playing ? request.context.sequence : [],
    hand: discarding ? request.context.hand : playing ? request.pegging.hand : [],
    opponentCardsLeft: discarding ? 6 : playing ? request.pegging.opponentCardsLeft : 0,
    // Early Cut (a daily Glitch) shows the starter during the discard.
    starter: discarding ? view.earlyStarter : view.hands[view.handIndex]?.starter,
    playerIsDealer: view.dealer === 0,
    /** The count's limit (Short Count's 21, a daily Glitch). */
    countLimit: view.countLimit ?? 31,
    burners: request.kind === 'burner' ? request.context.availableBurnerIds : [],
    enemyName: snapshot.enemy.name,
    className: snapshot.className,
  };
}

/** The picked subroutine, what it did last, and the live initiative
 * thresholds its text's turn fractions are worked out against (its side's
 * and the other's). */
export function pickedEntry(snapshot: FightSnapshot, picked: Picked | null): { entry: LoadoutEntry; lastFire?: FireEvent; thresholds: Thresholds } | null {
  if (!picked) return null;
  const { view } = snapshot.request;
  const entry = view.combatState.sides[picked.side].loadout[picked.index];
  if (!entry) return null;
  const lastFire = [...view.log].reverse().find((e) => e.side === picked.side && e.subroutineId === entry.definition.id);
  const sides = view.combatState.sides;
  const thresholds = { own: sides[picked.side].gauge.threshold, opponent: sides[picked.side === 0 ? 1 : 0].gauge.threshold };
  return { entry, lastFire, thresholds };
}

/** A log line's subroutine, as a Picked (the first slot with that id). */
export function pickFromLog(snapshot: FightSnapshot, side: 0 | 1, subroutineId: string): Picked | null {
  const index = snapshot.request.view.combatState.sides[side].loadout.findIndex((e) => e.definition.id === subroutineId);
  return index === -1 ? null : { side, index };
}

/** A fight's pegging request as the Cribbage coach reads it (coach.ts's
 * PegSpot; live-cribbage's pegSpot for a fight), or null off a play. */
export function fightPegSpot(snapshot: FightSnapshot): PegSpot | null {
  return combatPegSpot(snapshot.request);
}

/** The same, from the engine's request itself. */
export function combatPegSpot(request: FightSnapshot['request']): PegSpot | null {
  if (request.kind !== 'play') return null;
  const played = request.pegging.events.flatMap((e) => (e.type === 'play' ? [e.card] : []));
  // This hand's cut: the timeline's latest.
  const cut = request.view.timeline.findLast((b) => b.kind === 'cut');
  const starter = cut?.kind === 'cut' ? cut.starter : undefined;
  return {
    legal: request.context.legalCards,
    count: request.context.count,
    sequence: request.context.sequence,
    known: [...request.pegging.hand, ...played, ...(starter ? [starter] : [])],
    opponentCards: request.pegging.opponentCardsLeft,
    ...(request.context.limit ? { limit: request.context.limit } : {}),
  };
}
