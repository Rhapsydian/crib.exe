# crib.exe — Backlog

What is still to do. Completed work lives in `docs/archive/roadmap-history.md`
and `docs/session-logs/`.

**Convention for this file** (session 48): it stays forward-looking.
When an item is finished, it moves to `docs/archive/roadmap-history.md` or is
summarised in a session log; it does not accumulate here. **Do not stack
session updates in this file**: "Current state" is rewritten each
session, and the open-items list is pruned, not appended to.

**Standing principle** (session 14, `DESIGN.md` → Architecture): game
logic stays fully separate from the UI and simulable headlessly; the UI
is a thin interface onto the engine.

---

## Current state (end of session 72)

The game is playable in the browser on desktop and phones
(<https://rhapsydian.github.io/crib.exe/>, branch `playable`): a full
four-layer run with six classes, a guided tutorial, first-time tips, plain
Cribbage with a coach and lessons, and saves. Milestone 5 (polish and
playtesting) is under way. 938 tests, `npm run check` clean.

**The content pass and its tuning pass are done, and live on `playable`**
(merged in session 70, a fast-forward; save version 2, so old saves don't
resume; patch notes in `docs/patch-notes/`): Burners and Events, Mods, subroutines, the enemy pool, then
Heat, Mod supply and class tuning (`docs/tuning-design.md`). Run victory
~26% (target 24-30%), classes 23.7-28.3%, Heat ending ~12% of runs, about
65-71% of each layer explorable, ~12 Mods by a winning run's end.
Session 70 added the playtest fixes, Proof of Concept and Lure Template,
and the review coach (a Cribbage rating per fight and run, and a drawer of
mistakes; `src/ui/skill-review.ts`).

**Meta-progression is built, on branch `meta-progression`** (session 71,
pushed, not merged into `playable`; save version 3;
`docs/meta-progression-design.md` MP1-MP17): Rep by depth, a class unlock
chain, the Message Board (11 upgrade tracks, the 52-subroutine library,
starting Burners), a play-without-upgrades toggle, and ten Security
Levels. Fresh victory unchanged (~25%); fully upgraded ~90%; Security
Levels 1 / 5 / 10 at ~84 / ~26 / ~2% fully upgraded.

**Daily Runs are built, on branch `daily-runs`** (session 72, pushed; from
`meta-progression`, so it merges after it; `docs/daily-runs-design.md`
DR1-DR10): the date's salted seed, a random class, a Directive dealt from
a 13-day deck plus two or three Glitches, Advisories or Bulletins (34
Mods); one scored attempt a day, practice after, an itemized score, a
share line, a streak and history; normal Rep for the scored attempt.
Each Mod alone within about ±15 points of victory (Expanded Memory, rare,
+22).

---

## Priorities (the user, session 63)

In this order:

1. **More content**, all of it: subroutines, Mods, Burners, Events, and
   enemies of all three tiers. Player side first, then enemies.
   **Burners and the first ten new Events are done** (session 64), **Mods
   and their six Events** (session 65), **subroutines** (session 66),
   **elites** (session 67), **gatekeepers and regulars** (session 68): the
   content pass is done, and its tuning pass (session 69). Next: Event
   mini-games, then meta-progression and Daily Runs. The user's notes:
   - **Burners:** the economy ones (Data, Shop discounts) are the only
     ones worth carrying; tune up the combat and map Burners.
   - **Events** can be a source of rare, high-value Burners.
   - **Curses / negative-effect Mods** were bundled with a future Events
     design session.
   - Enemy-only effects (Trace, Wipe, Strip) stay off the player pool; a
     player-side Suspend ("your bottom subroutine skips a turn") was
     floated in session 60.
2. **Meta-progression.** **Built in session 71** on branch
   `meta-progression` (Security Levels are its ascension). Next: the user
   plays it locally, then it merges into `playable`; patch notes for it.
3. **Daily Runs.** **Built in session 72** on branch `daily-runs` (Phase 1:
   no server). Next: the user plays meta-progression and Daily Runs
   locally, then both merge into `playable`, with patch notes. Deferred:
   a server leaderboard (unless the game gets popular, the user), and
   playing a chosen seed.

**Art:** the user is happy with the current look; no sprite pass. At
most, refine some of the map icons.

---

## Open items

- **Daily Runs follow-ups** (session 72): Short Count's "/21" and Early
  Cut's face-up starter haven't been seen on screen (covered by engine
  tests; they show only on days that roll them); Turncoat Crib's large
  run-level penalty was never fully explained (it's scrapped, but the
  note stands if a crib rule comes back); Memory Leak is the hardest day
  (−16 alone); Flawless Form needs a 90%+ Cribbage rating.
- **Meta-progression follow-ups** (session 71): profile export/import
  waits for a settings menu (an opaque code with a checksum, MP12); a mark
  for winning a Security Level without upgrades was floated (MP17); track
  names are placeholders to revisit (Low Profile, Exploit Research, Clean
  Exits, ...); Burner Rig and Safehouse Upgrades measure ~0 for the
  simulated player, which uses Burners and rests sparingly, so watch
  their value in playtesting; Security Level 5 sits at ~26% fully
  upgraded (target ~20%, left there).
- **!!! REMOVE BEFORE RELEASE: testing URL switches** (session 71, the
  user: not around forever). `?resetprofile` wipes the meta-progression
  profile; `?unlockall` opens every class and the library. Both live in
  `src/ui/testing-flags.ts`.

- **Review coach** (session 70): falloff 1.0 calibrated so the simulated
  player (0.85) reads Sharp (87); regular enemies' skill reads Learning,
  elites' Steady, the full-strength AI Expert (95). Watch in playtesting
  whether the bands feel fair; the run-end rating wasn't checked in the
  browser. Trace evasion hands aren't rated.
- **Stolen Coupon "didn't prompt"** (a playtest note, session 70): not
  reproduced (likely bought in the same Shop, or the Shop already
  visited); a Shop note now says when it's offered.

Balance and content:
- **Restore Point** (was Skeleton Key, session 68): a contraband second
  try at a lost gatekeeper; only ~1.7% of runs find one through the
  contraband Event grants. A dedicated Event to chase it is an option for
  the next Events batch.
- **Class spread widening** (session 66): Breacher 50.7%, Warden 47.7%,
  Operator 43.0% against Wraith 32.7% and Blackhat 33.0% (system strain
  and diluted Exploit/Overclock pools); for the win-rate pass.
- **System strain** (S12): its first step (~1.5 Heat at layer 1, doubling)
  is a dial for the Heat pass; the user is keeping an eye on it.
- **Heat** (session 69): allowances now grow by layer (56/63/72/80), about
  65-71% of each layer explorable, Heat ending ~12% of runs. Two dials if
  it comes up again: layer 1 to ~52, and flatter fight Heat at layers 3-4.
- **Classes** (session 69): 23.7-28.3%, Operator at the top edge (28.3%):
  Backdoor Maintenance at Suppress 1.25 would centre it if needed.
- **Heat rarely ends a simulated run** (1-3% heat-maxed or caught), so
  Ghost Credentials (-26 Heat a run) and Black Market Ties (+19) measure
  ~0 victory (session 65). Revisit both with Heat tuning.
- **Mirror Hand** (0.33 of the uncommon average) and **Persistent
  Payload** (a fixture floor) are unmeasured in builds that suit them; the
  six-commons duel fixture reads build-dependent Mods low.
- **Elites barely threaten a 6-subroutine loadout** (97.7% player wins at
  layer 2, session 64's Burner check) and regular/elite losses are rare
  (the user: rarely contained outside gatekeepers). Look at regular and
  elite difficulty in the enemy pass; **Skeleton Key**'s fate follows (a
  closed node only comes from such a loss).
- **Blackhat vs Firewall Prime: 36%** at layer 1 (its bursts hit No Way
  In's cap), against 59.7% overall for the class.
- **The Concierge vs Warden** (a tester's run, session 64): contained at
  78% Breach after being out-pegged 11-24 and out-cribbed 3-20. The
  Concierge (scale 1.42, Reception Protocol each hand) ends fights in about
  5 hands at ~10 Containment a turn: the worst case for a slow-ramping
  class. Warden beats it 77% (vs 100% against Firewall Prime). Consider a
  trim for onboarding (its scale, or Reception Protocol once per fight).
- **Win rates** (session 66, before the enemy and tuning passes): average 38.0% (Breacher 42.0% to
  Eidolon 34.0%, session 65); the reworked Burners added ~6 points, the
  Mods ~11 (most from the rule-benders raising the pool's uncommon and
  rare share at the same supply: the user's call is content first, then
  tune supply). The user (session
  64): testers new to Cribbage find it too hard, so higher is welcome;
  report shifts, don't chase the old 15-20% band. Warden gains from Burners
  as much as the rest once they're saved for elites and gatekeepers; it's
  strongest of all at layer 1 (89%) and falls off deeper.
- **Mods:** ~12 at the layer-4 gatekeeper (Shop 4.6, elites 4.1,
  gatekeepers 3.0) against the user's ~10 by a run's end. Trims left: Mod
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
  the piece choice rare-weighted, not a tier up as its comment says;
  Surge Protector is spent even when another effect already zeroed that
  Credit.
- **Watch in playtesting:** Threat Hunter is the loudest elite (by
  design); Rollback is a big once-a-fight swing; Resource Quota rewards
  ordering your weakest subroutine last, which the simulated player
  doesn't optimise.
- **Pricing tools:** kit power (roster-check) can't see effects aimed at
  the player's Hooks or Ward, or Mods like Resource Quota; enemies
  carrying those are priced by parity (`scripts/enemy-parity.ts`).

Not yet seen in the browser (tests cover the engine side):
- the trace evasion's escape result (SLIPPED THE TRACE);
- the elite choose-one screen in a real run;
- the Shop's Sell section, the Safehouse's "merge everything", rank marks
  and "+N banked";
- the leftover-pegging-card fix (made from the code; confirm in play);
- Skeleton Key's reopen, on a phone;
- the tutorial's "Burner fired" coach step in the seed-21 run.

UI and text:
- **Lesson texts** (`src/ui/lessons.ts`) still use double dashes.
- **Breached, then caught** at layer 4 shows "4/4 layers breached" under
  a losing title (the rules' count); revisit if testers find it odd.
- **The coach is a first model:** pegging plays are judged one reply
  deep, against random opponent cards; the crib table takes the other
  two crib cards as random.
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
- **CI:** the deploy workflow's actions target Node 20 (deprecated);
  bump `actions/checkout` and `actions/setup-node`.
- **Hosting:** a custom domain on the GitHub-hosted site, and itch.io.
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
- **A "support" subroutine category** (session 22): pieces whose job is
  to buff or enable other subroutines. Worth weighing in the content pass.
- **Enemy-piece acquisition** (session 28): the 20 enemy-only subroutines
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
| 4 — Meta-progression systems (classes, Mods, Merge, Burners) | ✅ complete (session 22); between-run progression still undesigned |
| 5 — Content, balance & polish | 🔄 archetype redesign and authored content done (sessions 51–56); playable in the browser (sessions 57–63, milestones 1–4); polish, the content pass and retuning under way |

Detail for every completed phase is in `docs/archive/roadmap-history.md`; the
playable-game milestones are in `docs/playable-design.md`.
