import { SAVE_KEYS, clearSave, loadSave, type SaveSlot } from './run-save';
import { LiveRun } from './live-run.svelte';
import { CRIBBAGE_SAVE_KEY, LiveCribbage, clearCribbageSave, loadCribbageSave } from './live-cribbage.svelte';

/**
 * Saves an update left behind (go-live step 2). A run or a Cribbage game is
 * saved as a replay of the player's answers, so a rules or content update
 * can leave one that no longer replays, or whose version is out of date.
 * At startup each slot that holds anything is resumed once, off screen; one
 * that won't is cleared and reported, so its screen can say so instead of
 * offering a resume that fails (or, for an old version, silently vanishing).
 */
export interface DroppedSaves {
  run: boolean;
  /** A Daily Run's save; `date` and `scored` say whether it was a scored
   * attempt, which the profile then releases (App). */
  daily: { date: string; scored: boolean } | null;
  cribbage: boolean;
}

const KEYS: Record<SaveSlot | 'cribbage', string> = { ...SAVE_KEYS, cribbage: CRIBBAGE_SAVE_KEY };

/** What a slot holds: parsed, `{}` if it holds something unreadable, null
 * if nothing (or storage is blocked). */
function raw(key: string): unknown {
  let text: string | null;
  try {
    text = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/** Whether a run slot's save can't continue: there is one, and it won't
 * load or replay. Clears it if so. */
function runDropped(slot: SaveSlot): boolean {
  if (raw(KEYS[slot]) === null) return false;
  const save = loadSave(slot);
  if (save && LiveRun.resume(save)) return false;
  clearSave(slot);
  return true;
}

export function checkSaves(): DroppedSaves {
  const dailyRaw = raw(KEYS.daily) as { setup?: { daily?: { date?: string; practice?: boolean } } } | null;
  const daily = runDropped('daily') ? { date: dailyRaw?.setup?.daily?.date ?? '', scored: !dailyRaw?.setup?.daily?.practice } : null;
  let cribbage = false;
  if (raw(KEYS.cribbage) !== null) {
    const save = loadCribbageSave();
    if (!(save && LiveCribbage.resume(save))) {
      clearCribbageSave();
      cribbage = true;
    }
  }
  return { run: runDropped('run'), daily, cribbage };
}
