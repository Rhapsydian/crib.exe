import type { Card } from '../engine/cards';
import type { ClassId } from '../engine/classes';
import type { CombatRequest } from '../engine/combat';
import type { RunSetup } from '../engine/meta';

/**
 * Saving a run (milestone 3 checkpoint 5). A run is a deterministic
 * function of its class, its seed and the player's answers, so a save is
 * just those: resuming replays the answers into a fresh run and lands
 * exactly where the player left off, mid-fight included.
 *
 * Answers are stored by id (a reward's piece id, an Event choice's id, a
 * card's rank and suit) and mapped back onto the live request when
 * replayed, so nothing holds an engine object. If a stored answer no
 * longer fits its request -- the game changed under the save -- the
 * replay stops and the save is reported as unreadable.
 *
 * Kept in this browser's localStorage, wrapped so a blocked or full
 * storage never breaks play (the run just isn't saved).
 */
// 2 (session 65): the content pass (Burners, Events, Mods) changes what a
// replay draws, so a run saved before it no longer replays.
// 3 (session 71): a run's id and its meta-progression setup, pinned so a
// replay rebuilds the same run after later purchases.
export const SAVE_VERSION = 3;
/** Save slots (session 72): a normal run and a Daily Run each keep their
 * own, so starting one never wipes the other. */
export type SaveSlot = 'run' | 'daily';
export const SAVE_KEYS: Record<SaveSlot, string> = { run: 'cribexe.run', daily: 'cribexe.daily' };
const KEYS = SAVE_KEYS;

/** One answer: the pause it answered, and the answer in plain data. */
export interface SavedAnswer {
  k: string;
  a: unknown;
}

export interface RunSave {
  version: number;
  classId: ClassId;
  seed: number;
  /** The guided first run (session 63). */
  tutorial?: boolean;
  /** Session 71: which run this is (Rep is awarded once per id), and what
   * it started with from the profile. */
  id: string;
  setup: RunSetup;
  answers: SavedAnswer[];
  /** For the resume button: class name, layer, when. */
  summary: { className: string; layer: number; savedAt: number };
}

export function loadSave(slot: SaveSlot = 'run'): RunSave | null {
  try {
    const raw = localStorage.getItem(KEYS[slot]);
    if (!raw) return null;
    const save = JSON.parse(raw) as RunSave;
    return save && save.version === SAVE_VERSION && Array.isArray(save.answers) ? save : null;
  } catch {
    return null;
  }
}

export function writeSave(save: RunSave, slot: SaveSlot = 'run'): void {
  try {
    localStorage.setItem(KEYS[slot], JSON.stringify(save));
  } catch {
    // Storage blocked or full: play on unsaved.
  }
}

export function clearSave(slot: SaveSlot = 'run'): void {
  try {
    localStorage.removeItem(KEYS[slot]);
  } catch {
    // Nothing to clear.
  }
}

const plainCard = (c: Card) => ({ rank: c.rank, suit: c.suit });
const sameCard = (a: Card, b: { rank: unknown; suit: unknown }) => a.rank === b.rank && a.suit === b.suit;

/** A combat answer in plain data. */
export function encodeCombat(request: CombatRequest, answer: unknown): SavedAnswer {
  if (request.kind === 'discard') return { k: 'discard', a: (answer as Card[]).map(plainCard) };
  if (request.kind === 'play') return { k: 'play', a: answer ? plainCard(answer as Card) : null };
  return { k: 'burner', a: answer ?? null };
}

/** A stored combat answer mapped back onto the live request's own cards;
 * undefined if it no longer fits. */
export function decodeCombat(request: CombatRequest, saved: SavedAnswer): unknown {
  if (saved.k !== request.kind) return undefined;
  if (request.kind === 'discard') {
    const picks = saved.a as { rank: unknown; suit: unknown }[];
    const cards = picks.map((p) => request.context.hand.find((c) => sameCard(c, p)));
    return cards.every(Boolean) ? cards : undefined;
  }
  if (request.kind === 'play') {
    if (saved.a === null) return null;
    return request.context.legalCards.find((c) => sameCard(c, saved.a as { rank: unknown; suit: unknown })) ?? undefined;
  }
  return saved.a;
}
