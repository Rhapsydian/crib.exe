/**
 * The game's short patch notes, in the game (go-live step 5b, the user's
 * choice): a "What's new" card on the main menu the first time a newer
 * version is opened, and every version's notes on the Patch notes page
 * (About). Newest first. Each version's notes are a few plain bullets; its
 * `full` write-up, if any, is published with the site at
 * public/patch-notes/ (cribexe.com/patch-notes/...).
 *
 * At a release: bump package.json's version, add its entry here.
 */
export interface VersionNotes {
  version: string;
  date: string;
  notes: string[];
  /** The full write-up's file in public/patch-notes/. */
  full?: string;
}

export const VERSION_NOTES: readonly VersionNotes[] = [
  {
    version: '0.9.0',
    date: '2026-10-26',
    notes: [
      'Sound effects, with volume and mute in the new Settings.',
      'Settings: turn speed, and your progress as a code to export, import, or erase.',
      'If an update breaks a saved game, it is cleared and you are told (a Daily Run gets its scored attempt back).',
      'An About page with credits, and these patch notes.',
      'A crib.exe Discord for bug reports, ideas, and Daily scores: the link is on the main menu and the About page.',
      'Version numbers, starting here.',
    ],
    full: 'v0.9.0.html',
  },
];

const SEEN_KEY = 'cribexe.seenVersion';

function compare(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

function seen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

/** Marks the current version seen: the What's new card won't show again
 * until the next. A preference, not progress: erasing progress keeps it. */
export function markVersionSeen(version: string): void {
  try {
    localStorage.setItem(SEEN_KEY, version);
  } catch {
    // Storage blocked: the card may show again next time.
  }
}

/** What's new for this player: the notes of every version newer than the
 * one they last saw, newest first. A new player (`firstVisit`) has nothing
 * to catch up on, and is marked as having seen this version. */
export function whatsNew(version: string, firstVisit: boolean): VersionNotes[] {
  if (firstVisit) {
    markVersionSeen(version);
    return [];
  }
  const last = seen();
  return VERSION_NOTES.filter((v) => compare(v.version, version) <= 0 && (last === null || compare(v.version, last) > 0));
}
