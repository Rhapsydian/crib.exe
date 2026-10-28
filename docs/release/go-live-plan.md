# crib.exe go-live plan

Agreed with the designer at the end of session 72 (2026-10-26). The game is
feature-complete for release; this is what stands between the playtest
build and a public release on cribexe.com and itch.io. Steps 3, 4 and 6
carry real design choices: run them as live decision sessions. The rest
is mostly building.

Out of scope for release (the designer): Event mini-games; music (see Sound);
balance work (the session 64-66 balance notes were stale; today's
measurements are on target: ~25% victory for the simulated player, classes
within noise of each other).

## 1. Release cleanup (done)

Done: the switches, #test and the mockups are development-only (the designer:
keep the test harnesses, never in the release build; [`src/DevRoutes.svelte`](../../src/DevRoutes.svelte)
loads only in development); version 0.9.0 on the main menu; the CI actions
on their Node 24 majors; the stale balance notes pruned.

- Remove the testing switches `?unlockall` and `?resetprofile`
  ([`src/ui/testing-flags.ts`](../../src/ui/testing-flags.ts)) and the run-start "test a single fight
  instead" button.
- Show a version number (for bug reports; it also feeds About).
- Bump the deploy workflow's `actions/checkout` and `actions/setup-node`
  off Node 20.
- Prune the stale balance notes from [`BACKLOG.md`](../../BACKLOG.md) (session 64-66 elite and
  class figures superseded by sessions 67-69 and 72).

## 2. Dropped-save notice (done)

Done: every save slot is checked at startup by resuming it off screen; one
that won't load (an old version, unreadable, or a replay that fails) is
cleared, and its screen shows a dismissable card (NoticeCard, shared with
step 5b): Start a Run, the Daily screen, the main menu (Play Cribbage). A
dropped Daily that was the day's scored attempt is released to play again.
Tips no longer fire while a save replays.

A run is saved as a replay of the player's answers, so a rules or content
update can break one in progress (profiles are versioned and survive). The
user: no change to the save model. When a saved run can't load, the Start
a Run screen shows a dismissable card ("Your saved run was from an earlier
version and has been cleared"), and the save is removed. This replaces the
current inline "couldn't be loaded" line. Same for a saved Daily Run and a
saved Play Cribbage game.

## 3. Settings menu (done)

Built: [`src/ui/Settings.svelte`](../../src/ui/Settings.svelte) (from the main menu's "⚙ settings"),
`progress-code.ts` (the code), `progress-store.ts` (what export, import and
erase touch). Import and erase reload the game. Sound joins in step 4.

Decided with the designer (session 72):
- **Contents:** Sound (volume, mute; filled in by step 4), Gameplay (turn
  speed, the same value as the in-game "»" button; Learn to play keeps its
  own), Tips (show tips again, moved from the main menu), Progress (export,
  import, erase). The coach defaults are cut: the coach is chosen per mode
  already. Settings opens from the main menu.
- **Erase all progress:** the profile, every save, lesson progress, seen
  tips and the first-visit flag; preferences (turn speed, sound) are kept.
  A confirmation offers export first; then the game opens as a new player's.
- **Export / import:** a copy-and-paste code (`CRIBEXE1-`, compressed, with
  a checksum) carrying the profile and lesson progress, not saves or
  preferences. Import checks it, previews what it holds, and asks before
  replacing; older codes migrate forward. A file download/upload can come
  later if players ask.

Originally listed:

A settings screen from the main menu:
- default replay speed;
- the Cribbage coach and suggestions defaults;
- sound volume and mute (wired up in step 4);
- reset progress, behind a confirmation (replaces `?resetprofile`);
- profile export/import (MP12: an opaque code with a checksum), so
  progress can move between devices or survive cleared browser data.

## 4. Sound (done)

Built: eighteen synth sounds ([`src/ui/sound.ts`](../../src/ui/sound.ts)), no files and no
third-party code; the designer picked the card sounds from three variants each
(hand start, your card, their card, the cut, the table clearing). Fights
and Play Cribbage sound each replay step (`sound-steps.ts`); a run sounds
moves, Caches and rewards; the result stings and a Flawless chime. Volume
and mute in Settings (a preference). `#sounds` auditions them in
development.

Originally planned:

No music at launch (the designer; a quiet ambient loop, off by default, can
come later if testers ask). Sound effects, with volume and mute in
settings. Sources, licenses checked per file when chosen:
- **Kenney.nl** (CC0): *Casino Audio* for cards (slides, shuffles, chips);
  *Interface Sounds* / *Digital Audio* for UI.
- **ZzFX / jsfxr**: synth effects generated in code, no files and nothing
  to credit; the hacking layer (Breach, alarms, turns, Heat).
- **Freesound.org** for anything specific (CC0 or CC-BY: credit needed).
- Recommended: Kenney cards + ZzFX synth. Decide which moments get a sound.

## 5. About and credits (done)

Built: [`src/ui/About.svelte`](../../src/ui/About.svelte) from the main menu's About (beside Settings):
the version; "Made by Rhapsydian (Justin Stephens)" (the designer's words); the
Claude Code note and the repository link; credits (Tabler Icons, Svelte:
both MIT, so the license text is shown); the Discord once there is a link
(`DISCORD` in About.svelte).


Version, credits (Tabler Icons' MIT notice for the map icons; any sound
credits from step 4), the designer's name, and a feedback / bug link: the
Discord server (step 5a). The designer: a note that the game was developed
with agentic development (Claude Code), and a link to the repository,
https://github.com/Rhapsydian/crib.exe. Sound credits: the card sounds are
recorded key presses from unicaegames' "Keyboard soundpack 1" (CC0,
credited as a courtesy); every other sound is the game's own synth (the
user passed on Kenney's card sounds; ZzFX was dropped for the browser's
own audio engine).

## 5a. A Discord server (done)

The designer built it, walked through live: channels (#announcements and
#rules read-only; #general, #daily-runs text; #bug-reports and #feedback
forums with tags and post guidelines), Community on, AutoMod against spam
and mention spam, a pinned rules post. The never-expiring invite,
https://discord.gg/HxCry3uRpa, is on the About page and in the 0.9.0 notes;
it goes on the itch.io page too.


The designer creates the server (Claude can't create accounts); the invite
link goes in About, on the itch.io page and in the patch notes.

## 5b. In-game patch notes (done)

Built: [`src/ui/version-notes.ts`](../../src/ui/version-notes.ts) (each version's short notes; add an entry
at each release), the What's new card on the main menu (a new player skips
it; the version seen is a preference), and the Patch notes page in About.
The full write-ups moved to [`public/patch-notes/`](../../public/patch-notes), so cribexe.com serves
them; a version's `full` links to its page.


The designer chose the recommendation: a dismissable "What's new" card on the main menu the first
time a newer version is opened (the profile remembers the last version
seen; three to six short bullets; it shares a component with step 2's
dropped-save notice), and a "Patch notes" page from About listing every
version's short notes. Short notes live in a small file shipped in the
game (version, date, bullets), so they work offline and match the
build; the full write-ups ([`PATCH_NOTES.md`](../../PATCH_NOTES.md), [`public/patch-notes/`](../../public/patch-notes)) stay
for itch.io devlogs and the web, and the card links to them.

## 6. Records and stats (done)

Built (the designer's set): [`src/ui/Records.svelte`](../../src/ui/Records.svelte) from the main menu's
Records (beside Settings and About): runs, by class, fights, the career
Cribbage rating and Play Cribbage, Daily Runs. The profile's `stats`
(`records.ts`) count from v0.9.0, filled as a run, Daily or game ends;
older counters (runs finished, victories, Security Levels, the Daily
history) predate it.


A page of the player's history. Candidates: runs and victories per class;
best Security Level per class; the Daily streak and best scores; a career
Cribbage rating; Flawless fights. Some of this is already in the profile.

## 7. Mobile (done)

Done: the game's own icon (the designer's pick, a card with the terminal
prompt; [`public/icon.svg`](../../public/icon.svg), PNGs at 192 / 512 / maskable 512 / Apple 180,
rendered with headless Edge), replacing Vite's template logo; a web-app
manifest (standalone, the game's colours) and the tags for installing to a
home screen; a phone-width pass (375 and 320) over the main menu, Settings,
Records, About, Start a Run and the pick sheet: no overflow, the menu's
button row wraps on the narrowest phones.


A web-app manifest and icons (add to home screen, full screen), and a pass
over the newer screens (the review drawer, the pick sheets, the Security
Level stepper) at phone width.

## 8. Release candidate (under way)

A full test run, a playtest build for testers, then a freeze: fixes only.

Done: the smoke tests (the live site, the Tutorial, a desktop fight);
v0.9.0 then v0.9.1 (release candidate 2) out to testers, with notes and
Discord posts. Testers' reports since: fixes and balance only, live
without a version bump and held in [`PATCH_NOTES.md`](../../PATCH_NOTES.md) (Unreleased). **1.0 when the
reports go quiet** (the designer: more testing first): bump to 1.0.0, notes
from [`PATCH_NOTES.md`](../../PATCH_NOTES.md) (Unreleased), then the "At 1.0" checklist in
[`docs/itch/page.md`](../itch/page.md).

## 9. itch.io (done for the release candidate)

The page text, screenshots and a gameplay GIF (captured from the browser
pane), the cover image, and the upload with butler (as Pixelyph does).

Done: <https://rhapsydian.itch.io/cribexe>, public as "In development",
free with donations; everything for the page in [`docs/itch/`](../itch) (settings
and description in `page.md`, a paste page `description.html`, the
screenshots, `gameplay.gif`, `cover.png`, the devlog `devlog-rc.*`).
Builds go up with `butler push dist rhapsydian/cribexe:html5`. At 1.0:
the checklist in `page.md`.
