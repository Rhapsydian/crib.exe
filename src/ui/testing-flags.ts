/**
 * !!! REMOVE BEFORE RELEASE !!!
 *
 * Testing-only URL switches (session 71, docs/meta-progression-design.md
 * MP5 and MP12). The user wants these gone before release; BACKLOG
 * carries the same warning. They exist so playtesting never waits on
 * progress:
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

export const RESET_PROFILE_FLAG = flag('resetprofile');
export const UNLOCK_ALL_FLAG = flag('unlockall');
