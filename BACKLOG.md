# crib.exe — Backlog

What is still to do. Completed work lives in [`docs/archive/roadmap-history.md`](docs/archive/roadmap-history.md)
and [`docs/session-logs/`](docs/session-logs).

**Convention for this file** (session 48): it stays forward-looking.
When an item is finished, it moves to [`docs/archive/roadmap-history.md`](docs/archive/roadmap-history.md) or is
summarised in a session log; it does not accumulate here. **Do not stack
session updates in this file**: "Current state" is rewritten each
session, and the open-items list is pruned, not appended to.

**Standing principle** (session 14, [`DESIGN.md`](DESIGN.md) → Architecture): game
logic stays fully separate from the UI and simulable headlessly; the UI
is a thin interface onto the engine.

---

## Current state (end of session 75)

**Release candidate v0.9.1 is out for testing** on
<https://cribexe.com> (branch `playable`) and on itch.io, public as "In
development" (<https://rhapsydian.itch.io/cribexe>, devlog posted). 1.0
is held for more testing (the designer). Changes since v0.9.1 wait in
[`PATCH_NOTES.md`](PATCH_NOTES.md) (Unreleased). 987 tests, `npm run check` clean.
Session 75 put the loadout against the reward and Shop screens' edge,
made Init Script pay 10 Data on every Mod, and saw the first Reddit
posts (Sharing Saturday #647, r/playmygame; the next r/playmygame post
on or after 2026-11-30;
[session log](docs/session-logs/session-75-2026-10-31.md)).

The game is feature-complete: a four-layer run with six classes, a
guided tutorial and first-time tips, plain Cribbage with a coach and
lessons, a review coach that rates Cribbage play ([`src/ui/skill-review.ts`](src/ui/skill-review.ts)),
progression between runs (Rep, a class unlock chain, the Message Board's
upgrade tracks and library, ten Security Levels;
[`docs/design/meta-progression.md`](docs/design/meta-progression.md)), and Daily Runs
([`docs/design/daily-runs.md`](docs/design/daily-runs.md)). Balance for the simulated player (skill
0.85): run victory ~26% (target 24-30%), classes 23.7-28.3%, Heat ending
~12% of runs, about 65-71% of each layer explorable, ~12 Mods by a
winning run's end; fully upgraded ~90%; Security Levels 1 / 5 / 10 at
~84 / ~26 / ~2% fully upgraded.

---

## Priorities: go-live (the designer, end of session 72)

**The game is feature-complete; next is release.** The plan, in order, is
[`docs/release/go-live-plan.md`](docs/release/go-live-plan.md):

1. Release cleanup (done: testing switches, the test-fight button, a version
   number, CI actions off Node 20, stale balance notes pruned).
2. A dropped-save notice (done): saves an update broke are cleared at
   startup, with a card on their screen (no save-model change).
3. A settings menu (done): sound, turn speed, show tips again, progress
   export/import (a copy-and-paste code) and erase; coach defaults cut.
4. Sound effects (done): the cards are recorded keystrokes (the first ten
   of unicaegames' CC0 keyboard pack, random, never the same twice in a
   row); everything else is the game's own synth; volume and mute in
   Settings; no music at launch.
5. About and credits (done):
   version, Tabler Icons' MIT notice,
   a feedback link (the Discord), and a note that the game
   was developed with agentic development (Claude Code), linking the
   repository (https://github.com/Rhapsydian/crib.exe).
   5a. A Discord server (done): https://discord.gg/HxCry3uRpa, on the
   About page; it goes on itch.io too.
   5b. In-game patch notes (done): a "What's new" card after an update,
   and a Patch notes page; short notes in [`src/ui/version-notes.ts`](src/ui/version-notes.ts).
6. A records and stats page (done): runs, by class, fights, the career
   Cribbage rating, Play Cribbage, Daily Runs.
7. Mobile (done): the game's icon, a web-app manifest, a phone-width
   pass.
8. A release candidate (under way): full test done; v0.9.0 then v0.9.1 out
   to testers; fixes only from here. **Next:** testers' reports, then 1.0
   when they go quiet (the designer decides): a 1.0.0 bump, notes from
   [`PATCH_NOTES.md`](PATCH_NOTES.md) (Unreleased), and the "At 1.0" checklist in [`docs/itch/page.md`](docs/itch/page.md).
9. itch.io (done for the release candidate): page, screenshots, GIF, cover,
   butler upload, public "In development", devlog. Reddit posts are
   drafted ([`docs/itch/reddit.md`](docs/itch/reddit.md)); the designer posts them
   (r/roguelikedev's Sharing Saturday and r/playmygame posted in session 75).

Out of scope for release: **Event mini-games** (the designer: none), music,
and balance work. The earlier priorities (session 63: the content pass,
meta-progression, Daily Runs) are all done.

**Art:** the designer is happy with the current look; no sprite pass. At
most, refine some of the map icons.

---

## Open items

- **Daily Runs follow-ups** (session 72): Short Count's "/21" and Early
  Cut's face-up starter haven't been seen on screen (covered by engine
  tests; they show only on days that roll them); Turncoat Crib's large
  run-level penalty was never fully explained (it's scrapped, but the
  note stands if a crib rule comes back); Memory Leak is the hardest day
  (−16 alone); Flawless Form needs a Flawless (5-star) Cribbage rating
  (session 72; it was 90%+ before the rating changed). The Cribbage line
  pays 100 / 200 / 350 / 500 / 700 by stars.
- **Meta-progression follow-ups** (session 71): a mark
  for winning a Security Level without upgrades was floated (MP17); track
  names are placeholders to revisit (Low Profile, Exploit Research, Clean
  Exits, ...); Burner Rig and Safehouse Upgrades measure ~0 for the
  simulated player, which uses Burners and rests sparingly, so watch
  their value in playtesting; Security Level 5 sits at ~26% fully
  upgraded (target ~20%, left there).
- **Testing URL switches** (session 71): `?resetprofile` wipes the
  profile; `?unlockall` opens every class and the library
  ([`src/ui/testing-flags.ts`](src/ui/testing-flags.ts)). Development only since go-live step 1: the
  release build drops them, with the #test harness and the mockups
  ([`src/DevRoutes.svelte`](src/DevRoutes.svelte), loaded only in development).
- **A Flawless fight's -1 Heat** adds ~3 points of victory for the
  simulated player.
- **Review coach** (sessions 70, 72): the rating is points given up per
  hand against the AI at full strength, as stars (engine/skill.ts:
  Flawless 0.4 or less, Expert 1.2, Sharp 2.5, Steady 4.0). Measured: skill
  0.25 gives up ~4.1 a hand (Learning/Steady edge), 0.5 ~3.0, 0.65 ~2.0,
  the simulated player ~0.6 (Expert), full strength 0. A Flawless fight
  avoids 1 Heat (victory ~25% -> ~28% for the simulated player). The
  costliest list leaves out choices within the coach's match tolerance
  (coach.ts DISCARD_MATCH / PLAY_MATCH). Watch whether the bands feel
  fair; the run-end rating wasn't checked in the browser. Trace evasion
  hands aren't rated. Learn to play lessons still use the old prose
  review (offered, not done).
- **Stolen Coupon "didn't prompt"** (a playtest note, session 70): not
  reproduced (likely bought in the same Shop, or the Shop already
  visited); a Shop note now says when it's offered.

Balance and content:
- **Restore Point** (was Skeleton Key, session 68): a contraband second
  try at a lost gatekeeper; only ~1.7% of runs find one through the
  contraband Event grants. A dedicated Event to chase it is an option for
  the next Events batch.
- **System strain** (S12): its first step (~1.5 Heat at layer 1, doubling)
  is a dial for the Heat pass; the designer is keeping an eye on it.
- **Heat** (session 69): allowances now grow by layer (56/63/72/80), about
  65-71% of each layer explorable, Heat ending ~12% of runs. Two dials if
  it comes up again: layer 1 to ~52, and flatter fight Heat at layers 3-4.
- **Classes** (session 69): 23.7-28.3%, Operator at the top edge (28.3%):
  Backdoor Maintenance at Suppress 1.25 would centre it if needed.
- **Mirror Hand** (0.33 of the uncommon average) and **Persistent
  Payload** (a fixture floor) are unmeasured in builds that suit them; the
  six-commons duel fixture reads build-dependent Mods low.
- **Blackhat vs Firewall Prime: 36%** at layer 1 (its bursts hit No Way
  In's cap), against 59.7% overall for the class.
- **The Concierge vs Warden** (a tester's run, session 64): contained at
  78% Breach after being out-pegged 11-24 and out-cribbed 3-20. The
  Concierge (scale 1.42, Reception Protocol each hand) ends fights in about
  5 hands at ~10 Containment a turn: the worst case for a slow-ramping
  class. Warden beats it 77% (vs 100% against Firewall Prime). Consider a
  trim for onboarding (its scale, or Reception Protocol once per fight).
- **Mods:** ~12 at the layer-4 gatekeeper (Shop 4.6, elites 4.1,
  gatekeepers 3.0) against the designer's ~10 by a run's end. Trims left: Mod
  rewards from gatekeepers, Event Mods.
- **Data left over:** the simulated player reaches layer 4 with ~90-140
  Data unspent; the Shop runs out of wanted things first.
- **Zero-Sum** has a strength cliff between scale 1.49 and 1.53 (its
  "Credit past 4 a turn" rule); its 1.49 was set between measurements.
- **Selling isn't fully modelled:** the simulated player sells only what
  it can't use (session 62); more Data from selling isn't otherwise in
  the numbers.
- **Set aside, to revisit:** Static Shield (overtuned) and Recon Ping
  (returns if the map gets fog of war).
- **Mod findings** from writing their rules text: Black Budget redraws
  the subroutine choice rare-weighted, not a tier up as its comment says;
  Surge Protector is spent even when another effect already zeroed that
  Credit.
- **Watch in playtesting:** Threat Hunter is the loudest elite (by
  design); Rollback is a big once-a-fight swing; Resource Quota rewards
  ordering your weakest subroutine last, which the simulated player
  doesn't optimise.
- **Pricing tools:** kit power (roster-check) can't see effects aimed at
  the player's Hooks or Ward, or Mods like Resource Quota; enemies
  carrying those are priced by parity ([`scripts/enemy-parity.ts`](scripts/enemy-parity.ts)).

Not yet seen in the browser (tests cover the engine side):
- the trace evasion's escape result (SLIPPED THE TRACE);
- the elite choose-one screen in a real run;
- the Shop's Sell section, the Safehouse's "merge everything", rank marks
  and "+N banked";
- the leftover-pegging-card fix (made from the code; confirm in play);
- the tutorial's "Burner fired" coach step in the seed-21 run.

UI and text:
- **Breached, then caught** at layer 4 shows "4/4 layers breached" under
  a losing title (the rules' count); revisit if testers find it odd.
- **One AI** (session 72, the designer's rule): the coach and every opponent
  share one judgement ([`src/engine/ai.ts`](src/engine/ai.ts)); never add a second. It is still
  a first model: pegging plays are judged one reply deep, against random
  opponent cards; the crib table takes the other two crib cards as random.
  Unified enemies peg better against real players (the simulated player
  improved alongside them, so victory held at ~25%); the designer judged the
  enemy strength fine without measuring it.
- **Difficulty levels:** Easy (0.6) may still be hard for a true beginner;
  moving it is one number.
- **Pegboard:** the strip and street-board mockups remain at #pegboard if
  the bars ever feel too plain.
- **A style / chrome guide** (milestone 5): deferred in session 60 as
  mostly codifying the existing look.

Platform:
- **Saves don't survive a game update** that changes rules or content
  (they are a replay of answers); a snapshot save would, at the cost of
  making the run engine resumable from state.
- **Drag and drop** as an alternative card input.

Code and tools:
- **The simulated player holds Tunnel** (it wants every Shop and
  Safehouse on its route), so Tunnel's value isn't in the numbers.
- **burner-check.ts's Heat-saved figures** include Burners picked up during
  the run (a rough ranking only), and its Containment measure tops out near
  2x Flash Drive (contraband sits there).
- **Dead exports:** `adjustSideWinThreshold` (`resolve.ts`, no callers)
  and several `loadout.ts` / `mods.ts` / `shop.ts` helpers; separating
  dead code from legitimate API is judgment work.
- The legacy `EnemyPassiveId` slot in playCombat's positional signature
  is always empty; remove it with that parameter.
- `layer-funnel.ts` doesn't take `--syntheticGatekeepers`; `sweep.ts` and
  `gatekeeper-check.ts` do.
- Aggregating classes over shared seeds doesn't multiply the sample (the
  map is built before any class divergence); prefer per-class numbers.
- Sessions 22-28 have no individual logs (only the combined
  `00-prior-sessions-1-28.md`).

---

## Banked ideas (not scheduled)

- **Self-counting and muggins** for plain Cribbage: a long-term maybe.
- **Higher tiers of Root's `forceDiscardCard`** (session 24): force both
  discarded cards rather than one. Content, not a new engine capability.
- **A "support" subroutine category** (session 22): subroutines whose job is
  to buff or enable other subroutines. Worth weighing in the content pass.
- **Enemy-subroutine acquisition** (session 28): the enemy-only subroutines
  are unreachable by design; whether some should reach rewards or the
  Shop was never revisited.
- **Rename the `Go` occurrence category to `Last-Card`** (session 22):
  cosmetic.

---

## Roadmap status

| phase | status |
|---|---|
| 0 — Design passes | ✅ complete (sessions 2–13, 27, 36) |
| 1 — Core Cribbage engine | ✅ complete (session 16) |
| 2 — Combat wrapper | ✅ complete (session 18) |
| 3 — Network map / run structure | ✅ complete (session 20) |
| 4 — Meta-progression systems (classes, Mods, Merge, Burners) | ✅ complete (session 22); between-run progression built (session 71) |
| 5 — Content, balance & polish | ✅ archetype redesign and authored content (sessions 51–56); playable in the browser (sessions 57–63); content and tuning passes (64–70); Daily Runs (72) |
| 6 — Release | 🔄 release candidate public (session 73); 1.0 after testing |

Detail for every completed phase is in [`docs/archive/roadmap-history.md`](docs/archive/roadmap-history.md); the
playable-game milestones are in [`docs/archive/playable-design.md`](docs/archive/playable-design.md).
