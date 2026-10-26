import { PROFILE_KEY, profile, type Profile } from './profile.svelte';
import { LESSONS_KEY, loadProgress } from './lessons';
import { SEEN_KEY } from './tips.svelte';
import { SAVE_KEYS } from './run-save';
import { CRIBBAGE_SAVE_KEY } from './live-cribbage.svelte';
import type { ProgressPayload } from './progress-code';

/**
 * A player's progress as a whole (go-live step 3, the user's decisions):
 * what's exported, what an import replaces, and what an erase clears. Not
 * preferences: turn speed and sound stay put.
 */
export const VISITED_KEY = 'cribexe.visited';

/** Every saved game: a progress import or erase clears them. */
const SAVES = [SAVE_KEYS.run, SAVE_KEYS.daily, CRIBBAGE_SAVE_KEY];

export function currentProgress(): ProgressPayload {
  return { profile: profile.data, lessons: [...loadProgress()] };
}

function remove(keys: string[]): void {
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage blocked: nothing was kept anyway.
    }
  }
}

/** Replace progress with a code's: the profile and lessons, and any saved
 * games (they were played under the progress being replaced). The caller
 * reloads, so every screen starts from it. */
export function importProgress(payload: { profile: Profile; lessons: string[] }): void {
  remove(SAVES);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(payload.profile));
  localStorage.setItem(LESSONS_KEY, JSON.stringify(payload.lessons));
}

/** A new player's start: the profile, every save, lesson progress, seen
 * tips and the first visit. The caller reloads. */
export function eraseProgress(): void {
  remove([PROFILE_KEY, ...SAVES, LESSONS_KEY, SEEN_KEY, VISITED_KEY]);
}
