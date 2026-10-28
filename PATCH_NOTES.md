# crib.exe patch notes

The changes not yet in a release, then the latest release's notes. Every
release's notes are in `public/patch-notes/` (on the web at
<https://cribexe.com/patch-notes/v0.9.1.html> and earlier), and the game
shows them under **Patch notes**.

## Unreleased (since v0.9.1)

Live on cribexe.com and itch.io, waiting for the next version's notes.
At the next release, these move into that version's notes and its What's
new card (`src/ui/version-notes.ts`), and this section empties.

### Balance

- **Charge doesn't feed Instant Hooks.** A subroutine that gives other
  Hooks an extra count (Branch Predictor, Load Balancer, Zero-Day Chain)
  now skips Instant Hooks. With Elevated Session it could chain into a
  dozen turns in a row (a playtest report). Their text says "(not
  Instant Hooks)".
- **Branch Predictor reworked.** Process: Credit 1. Hook: if you've
  scored a pair since it last fired, also give every other subroutine's
  Hook one extra count (not Instant Hooks). It used to give every Hook a
  count every turn.

### Text

- **Instant Hooks say so up front:** "Hook · Instant: every time…"
  everywhere a subroutine is described.

### Fixes

- The trace evasion scoreboard is centred: you, the hand, them, and the
  gap below.
- Tutorial: the Burner tip gives Flash Drive's real Credit (10), and the
  Quiet Host tip says "spare Port Scan copies".
- The main menu's tagline ends with a period.
- About shows the build next to the version, for bug reports.

---

## v0.9.1, release candidate 2

**Play it at [cribexe.com](https://cribexe.com).** Join the [crib.exe Discord](https://discord.gg/HxCry3uRpa).

Thanks for the reports on the release candidate. This update answers
several of them, and adds two things testers asked for. What's new since
v0.9.0 ([the previous notes](public/patch-notes/v0.9.0.html)):

> **Not seeing these changes?** An installed app can keep running the old
> version. Close it fully (swipe it out of your recent apps) and open it
> again. About now shows the build next to the version: tell us which
> one when you report a bug.

### Highlights

- **Your loadout, while you choose.** See your subroutines, bench, Mods
  and Burners on the reward and Shop screens.
- **Event rolls play out.** A choice with odds rolls on screen before
  you see what came of it.
- **Fairer Cribbage ratings.** Two fixes to how the stars are counted.

### Your loadout on the reward and Shop screens

- On a phone, tap **◀ loadout** at the top of a reward screen, the Shop,
  or the Shop's Burner choice. On a wider screen it stands open on the
  left, as on the map.
- Tap a subroutine to read it. You can still only rearrange your loadout
  on the map.
- In the Shop it shows what you'll leave with: anything you buy is
  added, anything you sell is gone.

### Event rolls

- Pick a **risky** choice and a bar shows its odds, one segment per
  outcome, green for good and red for bad. A marker sweeps back and
  forth, ticking as it goes, and settles on what you rolled.
- A **gamble** keeps its secret: its segments say "?" and keep shifting
  size, and the one you land on fills the whole bar.
- Tap the bar to skip. The fast turn speed rolls twice as quickly.

### Cribbage ratings

- **Close enough is the coach's own choice.** A discard or play the
  coach calls its own (within a few tenths of a point of its pick) no
  longer counts against you. A fight with no mistakes listed now rates
  0.0 points given up a hand.
- **The stars match the number you see.** A rating is judged on the
  one-decimal figure the review shows, so "0.4 a hand" is always
  Flawless.
- Ratings you've already earned don't change.

### Daily Runs

- **Burn Rate:** selling a Cold Wallet now counts as using a Burner.
  Selling it is its only use.

### Sound

- Lifting a card and putting it back now click like keys, and sending
  two cards to the crib is a quick double tap.

### Fixes

- On phones, the score popup on the table no longer hides behind the
  7th and 8th cards.
- The main menu's bottom buttons wrap two and two on narrow screens,
  never three and one.
- What's new now says the Discord link is on the main menu as well as
  About.
