# crib.exe — Backlog

What is still to do. Completed work lives in `docs/roadmap-history.md`
and `docs/session-logs/`.

**Convention for this file** (session 48): it stays forward-looking.
When an item is finished, it moves to `docs/roadmap-history.md` or is
summarised in a session log; it does not accumulate here. **Do not stack
session updates in this file**: "Current state" is rewritten each
session, and the open-items list is pruned, not appended to.

**Standing principle** (session 14, `DESIGN.md` → Architecture): game
logic stays fully separate from the UI and simulable headlessly; the UI
is a thin interface onto the engine.

---

## Current state (end of session 63)

The game is playable in the browser on desktop and phones
(<https://rhapsydian.github.io/crib.exe/>, branch `playable`): a full
four-layer run with six classes, a guided tutorial, first-time tips, plain
Cribbage with a coach and lessons, and saves. Milestones 1-4 of
`docs/playable-design.md` are done; milestone 5 (polish and playtesting)
is under way. 805 tests, `npm run check` clean.

Content: 36 player subroutines (20 enemy-only besides), 27 enemies (13
regular, 6 elite, 8 gatekeepers) plus the tutorial's Firewall Beta, 37
Mods, 9 Burners, 8 Events. Balance: 16.0-23.3% victory by class, average
19.8% against the user's 15-20% band (~16% aim).

---

## Priorities (the user, session 63)

In this order:

1. **More content**, all of it: subroutines, Mods, Burners, Events, and
   enemies of all three tiers. Player side first, then enemies, then
   retune toward ~16% (see Open items). The user's notes for it:
   - **Burners:** the economy ones (Data, Shop discounts) are the only
     ones worth carrying; tune up the combat and map Burners.
   - **Events** can be a source of rare, high-value Burners.
   - **Curses / negative-effect Mods** were bundled with a future Events
     design session.
   - Enemy-only effects (Trace, Wipe, Strip) stay off the player pool; a
     player-side Suspend ("your bottom subroutine skips a turn") was
     floated in session 60.
2. **Meta-progression.** Undesigned: plan it in a `/decision-session`.
   `DESIGN.md` requires it to credit how deep a run got, including
   *breached, then caught*, below a full continue. Related, also
   undesigned: **ascension-style difficulty**, and the session-56
   observation that **player power plateaus after layer 2** once the six
   slots fill (slot unlocks, stronger Merge, rares).
3. **Daily Runs** (the user, session 62). The date is hashed into a
   seed: everyone gets the same run that day, with a randomly chosen
   class and one or more **daily-only Mods** that bend the rules in
   unusual ways (e.g. something happens whenever a card of a given rank or
   suit is played). Stretch goal: players upload a successful run's log
   (the save's replay of answers) to a **daily leaderboard** that verifies
   it by replaying it server-side. Notes: the demo is static GitHub Pages,
   so a leaderboard needs a backend; saves break across game updates, so
   a daily run's log must pin the game version. A way to **play a chosen
   seed** (the end screen now shows it) is a natural first step.

**Art:** the user is happy with the current look; no sprite pass. At
most, refine some of the map icons.

---

## Open items

Balance and content:
- **Win rates** sit above the aim (avg 19.8%; Blackhat 23.3%, Eidolon
  22.7%); retune after the content pass. Trace evasions add ~0.8 points
  (3.9% of runs reach one, 37% escape).
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

Detail for every completed phase is in `docs/roadmap-history.md`; the
playable-game milestones are in `docs/playable-design.md`.
