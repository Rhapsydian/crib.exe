# crib.exe go-live plan

Agreed with the user at the end of session 72 (2026-10-26). The game is
feature-complete for release; this is what stands between the playtest
build and a public release on cribexe.com and itch.io. Steps 3, 4 and 6
carry real design choices: run them as live decision sessions. The rest
is mostly building.

Out of scope for release (the user): Event mini-games; music (see Sound);
balance work (the session 64-66 balance notes were stale; today's
measurements are on target: ~25% victory for the simulated player, classes
within noise of each other).

## 1. Release cleanup (done, session 72)

Done: the switches, #test and the mockups are development-only (the user:
keep the test harnesses, never in the release build; `src/DevRoutes.svelte`
loads only in development); version 0.9.0 on the main menu; the CI actions
on their Node 24 majors; the stale balance notes pruned.

- Remove the testing switches `?unlockall` and `?resetprofile`
  (`src/ui/testing-flags.ts`) and the run-start "test a single fight
  instead" button.
- Show a version number (for bug reports; it also feeds About).
- Bump the deploy workflow's `actions/checkout` and `actions/setup-node`
  off Node 20.
- Prune the stale balance notes from `BACKLOG.md` (session 64-66 elite and
  class figures superseded by sessions 67-69 and 72).

## 2. Dropped-save notice (done, session 72)

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

## 3. Settings menu (done, session 72)

Built: `src/ui/Settings.svelte` (from the main menu's "⚙ settings"),
`progress-code.ts` (the code), `progress-store.ts` (what export, import and
erase touch). Import and erase reload the game. Sound joins in step 4.

Decided with the user (session 72):
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

## 4. Sound (done, session 72)

Built: eighteen synth sounds (`src/ui/sound.ts`), no files and no
third-party code; the user picked the card sounds from three variants each
(hand start, your card, their card, the cut, the table clearing). Fights
and Play Cribbage sound each replay step (`sound-steps.ts`); a run sounds
moves, Caches and rewards; the result stings and a Flawless chime. Volume
and mute in Settings (a preference). `#sounds` auditions them in
development.

Originally planned:

No music at launch (the user; a quiet ambient loop, off by default, can
come later if testers ask). Sound effects, with volume and mute in
settings. Sources, licenses checked per file when chosen:
- **Kenney.nl** (CC0): *Casino Audio* for cards (slides, shuffles, chips);
  *Interface Sounds* / *Digital Audio* for UI.
- **ZzFX / jsfxr**: synth effects generated in code, no files and nothing
  to credit; the hacking layer (Breach, alarms, turns, Heat).
- **Freesound.org** for anything specific (CC0 or CC-BY: credit needed).
- Recommended: Kenney cards + ZzFX synth. Decide which moments get a sound.

## 5. About and credits (done, session 72)

Built: `src/ui/About.svelte` from the main menu's About (beside Settings):
the version; "Made by Rhapsydian (Justin Stephens)" (the user's words); the
Claude Code note and the repository link; credits (Tabler Icons, Svelte:
both MIT, so the license text is shown); the Discord once there is a link
(`DISCORD` in About.svelte).


Version, credits (Tabler Icons' MIT notice for the map icons; any sound
credits from step 4), the user's name, and a feedback / bug link: the
Discord server (step 5a). The user: a note that the game was developed
with agentic development (Claude Code), and a link to the repository,
https://github.com/Rhapsydian/crib.exe. No sound credits are needed: every
sound is the game's own synth (the user passed on Kenney's recorded card
sounds; ZzFX was dropped for the browser's own audio engine).

## 5a. A Discord server (the user)

The user creates the server (Claude can't create accounts); the invite
link goes in About, on the itch.io page and in the patch notes.

## 5b. In-game patch notes (done, session 72)

Built: `src/ui/version-notes.ts` (each version's short notes; add an entry
at each release), the What's new card on the main menu (a new player skips
it; the version seen is a preference), and the Patch notes page in About.
The full write-ups moved to `public/patch-notes/`, so cribexe.com serves
them; a version's `full` links to its page.


The user chose the recommendation: a dismissable "What's new" card on the main menu the first
time a newer version is opened (the profile remembers the last version
seen; three to six short bullets; it shares a component with step 2's
dropped-save notice), and a "Patch notes" page from About listing every
version's short notes. Short notes live in a small file shipped in the
game (version, date, bullets), so they work offline and match the
build; the full write-ups (`PATCH_NOTES.md`, `public/patch-notes/`) stay
for itch.io devlogs and the web, and the card links to them.

## 6. Records and stats (decision session)

A page of the player's history. Candidates: runs and victories per class;
best Security Level per class; the Daily streak and best scores; a career
Cribbage rating; Flawless fights. Some of this is already in the profile.

## 7. Mobile

A web-app manifest and icons (add to home screen, full screen), and a pass
over the newer screens (the review drawer, the pick sheets, the Security
Level stepper) at phone width.

## 8. Release candidate

A full test run, a playtest build for testers, then a freeze: fixes only.

## 9. itch.io

The page text, screenshots and a gameplay GIF (captured from the browser
pane), the cover image, and the upload with butler (as Pixelyph does).
