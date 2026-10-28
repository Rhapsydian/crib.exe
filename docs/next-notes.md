# Next patch notes: changes since v0.9.1

Live on cribexe.com and itch.io, but not yet in a version's notes (the
user's call: save them for the next notes). Fold these into the next
PATCH_NOTES.md and What's new card (src/ui/version-notes.ts), then clear
this file.

## Balance

- **Charge doesn't feed Instant Hooks.** A subroutine that gives other
  Hooks an extra count (Branch Predictor, Load Balancer, Zero-Day Chain)
  now skips Instant Hooks. With Elevated Session it could chain into a
  dozen turns in a row (a playtest report). Their text says "(not
  Instant Hooks)".
- **Branch Predictor reworked.** Process: Credit 1. Hook: if you've
  scored a pair since it last fired, also give every other subroutine's
  Hook one extra count (not Instant Hooks). It used to give every Hook a
  count every turn.

## Text

- **Instant Hooks say so up front:** "Hook · Instant: every time…"
  everywhere a subroutine is described.

## Fixes

- The trace evasion scoreboard is centred: you, the hand, them, and the
  gap below.
- Tutorial: the Burner tip gives Flash Drive's real Credit (10), and the
  Quiet Host tip says "spare Port Scan copies".
- The main menu's tagline ends with a period.
- About shows the build next to the version, for bug reports.
