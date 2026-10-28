/**
 * Testing-only URL switches (session 71, docs/design/meta-progression.md
 * MP5 and MP12), for development only (go-live step 1, the user: out of
 * the release build, kept for development). They read false in a release
 * build, where the build tool drops them. They exist so testing never
 * waits on progress:
 * - `?resetprofile` wipes the meta-progression profile (Rep, unlocks,
 *   upgrades) on load;
 * - `?unlockall` opens every class and the whole library (checkpoint 2).
 */
function flag(name: string): boolean {
  try {
    return new URLSearchParams(location.search).has(name);
  } catch {
    return false;
  }
}

export const RESET_PROFILE_FLAG = import.meta.env.DEV && flag('resetprofile');
export const UNLOCK_ALL_FLAG = import.meta.env.DEV && flag('unlockall');
