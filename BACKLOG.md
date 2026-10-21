# crib.exe — Backlog

What is still to do. Completed work lives in `docs/roadmap-history.md`
(the full prior contents of this file, moved verbatim in session 48) and
in `docs/session-logs/`.

> **Looking for something that used to be here?** Session 48 moved every
> completed phase, checkpoint write-up and stacked session update to
> `docs/roadmap-history.md`, byte-for-byte. Older references elsewhere
> in the repo — particularly in `DESIGN.md` — that point at "BACKLOG.md's
> Phase N" or a named completed section mean that file. The obvious ones
> were repointed; the rest are noted under Deferred audits below.

**Standing principle for every item below** (session 14, see `DESIGN.md`
Architecture): game logic stays fully separate from the UI and must be
simulable/testable headlessly — the UI is a thin interface onto the
engine, never a load-bearing piece of it.

**Convention for this file** (session 48): it stays forward-looking.
When an item is finished, it moves to `docs/roadmap-history.md` or is
summarised in a session log — it does not accumulate here. In
particular, **do not stack session updates in this file**; the
"Current state" section below is rewritten each session, not prepended
to. Ignoring that is what took this file to 4,396 lines.

---

## Current state (end of session 52)

**Where the project is.** Step 1 of the archetype redesign (the engine
refactor, session 51) is done; **step 2, recalibration, is three
checkpoints in** (session 52, `docs/recalibration-design.md`, R1–R8).
Heat is now a per-layer budget with posted fight prices and a new run
ending, *breached, then caught*; and every verb has a price in
Credit-per-turn from seat-swapped mirror duels. Content is still the
untuned skeleton. 646 tests, `npm run check` clean, on the
`archetype-redesign` branch. **There is still no UI.**

**Next:** step 2's checkpoint 4, the beta frequency table. See the arc
immediately below.

---

## Archetype & subroutine redesign — the active arc (session 51)

Decided in session 51 (`docs/archetype-redesign.md`, A1–A12; settled
design in `DESIGN.md` → Archetypes & Subroutines). Replaces the
roadmap's old next phase ("full class audit") and the old balance arc
(gatekeeper roster pass, class audit — archived in
`docs/roadmap-history.md`): the roster and the classes are both rebuilt
rather than tuned. Work happens on the `archetype-redesign` branch.

1. **Engine refactor** ✅ (checkpoints 1–5, session 51) — `DESIGN.md`
   restructure; alpha/beta types and skeleton content; combat resolution;
   Mods / Merge / Burners / bridge passives; diagnostics ported. Build
   green: `npm run check` clean, 615 tests. Every implementation call is
   logged in `docs/archetype-redesign.md`.
2. **Recalibrate** ✅ (sessions 52–53) — decided as R1–R8; the rules
   step 3 authors against are in `DESIGN.md` → Pricing, the full record in
   `docs/recalibration-design.md`, raw output in `docs/calibration/`.
   Checkpoints: per-layer Heat economy; pricing instrument; verb prices;
   beta frequency table; beta pricing formula (validated, Charge priced);
   Trace price, Event Heat anchored to the loss price, Exploit noise
   check; skill retention (6b, with the Overclock A/Bs and the new
   `handPointsAtLeast` source); write-up, pillar suite retired.

   Watch items carried into step 3:
   - **Exploit Heat** at 3–5× the other classes' Heat-ending rate (user's
     target) — today carried by one skeleton piece.
   - **Skill retention** runs lowest in late-run builds and Overclock
     (late 0.55); floor 0.5. Check late loadouts, not just starting ones.
   - **Honeypot conversions**: credit taken from the opponent is the
     strongest verb per point (~1.85×); conversion bypassing Ward is the
     user's flagged watch item.
   - `handPointsAtLeast` frequency rows need generating into
     `beta-frequency-data.ts` before the formula can price it.
   - Skeleton regular/elite fights remain near-free; win-rate targets and
     fight length (the game-wide skill dial) come after step 3.
3. **Author** — decided live as S1–S11 and C1–C6 (session 54,
   `docs/authoring-design.md`).
   1. ✅ archetype subroutines: 36 pieces, 9 per archetype
      (`src/engine/content/`), each priced into its rarity band and
      checked by `scripts/archetype-check.ts`;
   2. ✅ classes: Blackhat, Operator, Eidolon, Breacher, Warden, Wraith,
      with bespoke bridge passives (~+1.0 Credit/turn,
      `scripts/class-check.ts`), commons-only starting loadouts and an
      unlock order; the authored pool is wired into acquisition;
   3. ✅ enemy roster (session 55, E1–E7): 18 enemies, with bridges and
      eight bespoke gatekeeper Mods (`gatekeeper-mods.ts`). Regulars and
      elites are priced to a power budget from the player's measured
      power; gatekeepers are tuned to the 78/72/66/60 pass-rate curve,
      within 2.3 points. The skeleton is retired.

   **Step 3 is complete.**
4. ✅ **Class balance pass** (session 56, `docs/balance-design.md`
   B1–B7). Every class is at 13.3–18.7% victory (was 11–31%). Exploit
   Heat endings are 20–26% (a 4.4× ratio). Done with a noise premium on
   Fuzzer and Jackpot (+1 Credit), Fuzzer's Trace at +¾, and the
   gatekeeper curve lowered to 70.5 / 64.5 / 58.5 / 52.5, plus small
   Eidolon and Wraith bridge trims.

   Watch items carried forward:
   - **Operator's skill gap +8.7** (aim +10), within the run-level
     estimate's noise: recheck with more runs.
   - **Blackhat's late retention 0.56**, the closest to the 0.5 floor.
   - **Bridges and tracers are weak balance levers** (session 56).
   - **Player power plateaus after layer 2**, once the 6 slots fill: a
     progression question (slot unlocks, stronger Merge, rares).
   - The legacy `EnemyPassiveId` slot in playCombat's positional
     signature is always empty; remove it with that parameter.
   - A gatekeeper met inside the opening window (first 3 fights) plays at
     skill 0: `enemySkill`'s opener pin applies to every tier.
   - **Late Overclock fights are short** (~3 hands), and retention
     tracks fight length.
   - Four Honeypot pieces sit just outside their bands (Honeytoken,
     Sinkhole, Deep Packet Inspection, Zero Trust alone).
   - Win-rate tuning (the 10–20% target) waits for the authored roster:
     quarantine is 47–78% of endings against skeleton gatekeepers.

Resolved by the refactor rather than repaired in place: the dead debuff
`magnitude` and the dead Occurrence `scaling` (both mechanics are gone;
their write-ups are archived in `docs/roadmap-history.md`).

---

## Instrument notes (session 49)

- **Aggregating classes over shared seeds does not multiply the sample.**
  `createRng(seed)` builds the map before any class-dependent divergence,
  so at one seed all six classes get the same layout and the same
  gatekeeper (measured: 400/400 seeds). A six-class aggregate carries
  ~3.5x the variance of an independent sample, so its true SE is ~1.9x
  the naive `sqrt(p(1-p)/n)`. Per-class numbers are unaffected - prefer
  them. Now recorded in `README.md`'s conventions.
- **`encounters.ts:358` credits the Heat refund to "Failover"**, but the
  code checks the `heat-sink` Mod. Stale comment, one-line fix.
- **`layer-funnel.ts` does not take `--syntheticGatekeepers`** yet;
  `sweep.ts` and `gatekeeper-check.ts` do.
- **`profiles.test.ts`'s loadout-preservation guard** ran 60 full runs
  against vitest's 5s default and failed whenever the machine was loaded.
  Given an explicit 30s budget in session 49; the assertion is unchanged.

## Known content gaps

- **Curses / negative-effect Mods** — punted four times, now explicitly
  bundled with a future Events design session rather than left drifting.
- **Ascension-style difficulty** — deferred from Phase 4, still
  genuinely undesigned. Needs its own `/decision-session` before it is
  implementation-ready.

---

## Deferred audits (scoped session 48)

- **Broad code-quality and consistency pass.** Session 48 did the narrow
  instrument audit only. A dead-export inventory was taken but
  deliberately not culled — separating genuinely dead exports from
  legitimate API and type surface is judgment work. Known candidates
  include `adjustSideWinThreshold` (an exported win-threshold primitive
  with zero callers, built in session 40 for a Mod that was never
  written) and several `loadout.ts`/`mods.ts`/`shop.ts` helpers.
- ~~`DESIGN.md` restructure~~ — done in session 51 (2,360 → ~1,490
  lines; superseded sections archived in `docs/design-history.md`; the
  stale `BACKLOG.md` references repointed).
- **README.** Reviewed in session 48; see that session's log.
- **Sessions 22–28 have no individual logs.** The directories themselves
  were consolidated into `docs/session-logs/` in session 48, but that
  stretch is still covered only by the combined
  `00-prior-sessions-1-28.md`, which also overlaps the individual logs
  for 1–21. Low priority — reconstructing them after the fact is
  probably not worth it — but worth knowing before trusting a gap in the
  numbering.

---

## Banked design ideas (not scheduled)

- **Daily Runs** (the user, session 62). The date is hashed into a seed:
  everyone gets the same run that day, with a randomly chosen class and
  one or more **daily-only Mods** that bend the rules in unusual ways
  (e.g. something happens whenever a card of a given rank or suit is
  played). Stretch goal: players upload a successful run's log (the same
  replay-of-answers the save system stores) to a **daily leaderboard**,
  which verifies it by replaying it. Notes: the replay is deterministic
  from seed + answers, so verification is re-running it server-side;
  saves currently break across game updates, so a daily run would need
  the game version pinned in the log (a run verifies against the build
  it was played on).
- **Higher tiers of Root's `forceDiscardCard`** (session 24) — force the
  selection of *both* discarded cards rather than one, leaving the
  target's best companion intact. Content authoring, not a new engine
  capability: `ai.ts`'s `bestCardToForce` already generalises.
- **A "support" subroutine category** (banked session 22, recovered from
  project memory in session 48 — it had never been written down in the
  repo). Identified as a real gap while authoring the original 78 pieces:
  the pool has nothing whose *job* is to buff or enable other
  subroutines rather than act directly. The `Worm` tag describes chaining
  and Mods have archetype Amplifiers, but a dedicated category was never
  designed. Worth revisiting now the pool is 139 pieces.
- **Enemy-piece acquisition** (banked session 28, same recovery). The 20
  `ENEMY_ONLY_SUBROUTINES` are unreachable by the player by design.
  Whether that should stay true — reward-pool or Shop access to some of
  them — was explicitly banked and never revisited. Note session 46
  found the Neutral pool had been *accidentally* unreachable for 18
  sessions, so "unreachable by design" is worth re-confirming rather
  than assuming.
- **Rename the `Go` occurrence category to `Last-Card`** (banked session
  22) — cosmetic, never actioned. Currently only referenced in
  `docs/roadmap-history.md` and a pegging test.
- **Resumable orchestration for human-vs-AI play** (session 24) —
  **decided in session 57 (P1, `docs/playable-design.md`): the engine's
  loops become generators**, with a simulation driver and a UI driver.
  It is milestone 1 of making the game playable.

---

## Making the game playable (session 57, `docs/playable-design.md`)

Planned as P1–P7. Desktop and mobile from the start (portrait-first on
phones); local browser for testing; eventually a custom domain on the
GitHub-hosted site and itch.io.

1. ✅ **Pausable engine** (session 57): `combatGenerator` yields decision
   requests with a view of the fight; combat resolves live during
   pegging (P8); balance unchanged; simulation speed held.
2. ✅ **Layout mockups** (2–3 phone variants: tabs / drawers / compact), then
   **one playable fight** (session 57): tap-to-lift cards, turns stepped through piece
   by piece, tap anything to inspect it, a running log. Player-facing
   names "Process" (alpha) and "Hook" (beta). *In progress:* layout
   chosen (compact on phones, drawers on desktop); checkpoint 1 (a real
   fight you can play, test-harness setup) and checkpoint 2 (turns
   stepped through piece by piece) and 3a (pegging animated: card plays,
   score callouts, table lines in the log) and 3b (the show panel, hand
   banners, the Burner prompt) done; Mods and Burners on screen with a
   trigger flash; checkpoint 4 (desktop keys, hover tips, a phone pass
   in the preview) done, pending the user's own phone playthrough.
3. ✅ **A playable run** (session 58, five checkpoints): the run as a
   pausable engine, a new map generator (scatter on a hex backdrop,
   10/12/12/14 nodes, a dealt type mix, a remote Cache), the bench capped
   at 3, class choice / map / fights / end screens, rewards and loadout
   management, Safehouse / Shop (bought freely) / Event / Cache screens,
   map Burners, save and resume, a 320px phone pass. Trace removed along
   the way (fights post Heat; Fuzzer and Jackpot feed the enemy's gauge;
   alarms add Heat). Detail: `docs/playable-design.md` → Milestone 3.
4. ✅ **Vanilla Cribbage, with a learn-to-play mode** (session 59, five
   checkpoints; decisions V1-V7 in `docs/playable-design.md` → Milestone 4):
   the game engine to 121, pegboard mockups (minimal bars chosen), the
   menu / game / end / saves, the coach, five lessons. Planned as: (the user, session 58;
   next, before polish -- testers who know the card game the combat is
   built on are easier to bring on board). Plain 2-player Cribbage to 121
   at several difficulties, plus a "Learn to play" difficulty that guides
   a new player through the game. This is the "basic Cribbage" mode the
   user asked for in sessions 26 and 39: code that plays a standalone game
   (`game.ts`'s hands, any race-to-121 loop) is permanent engine code,
   never scratch. Builds on: `game.ts` (per-side strategies), the AI's
   0-1 skill dial (difficulties), its discard scoring and hand breakdowns
   (a coach's explanations), and the fight screen's hand / table / show
   components. Needs: a pausable race-to-121 game loop in `game.ts` (today
   it only lives inside `scripts/cribbage-skill-matrix.ts`), a pegboard, a
   menu entry, an end screen. **Plan it in a decision session** first;
   open questions: scripted lessons vs a coach riding along in real games
   (or lessons, then coached games); how many difficulties and their
   names; whether the hardest makes you count your own hand (muggins);
   where it sits in the menu.
5. 🔄 **Polish and playtesting**, including a style / chrome guide. Session
   60 chose content polish before the style guide (the user: the guide
   would mostly codify the existing look): UI fixes, a text audit
   (`docs/text-audit.md`), the class Mod redesign
   (`docs/class-mod-redesign.md`), and the enemy review and content pass
   (`docs/enemy-review.md`). **Next: the player-side content pass** --
   subroutines, Mods, Burners (the user: the pool is shallow on both
   sides; enemies went first).

Backlog from this plan: an optional tutorial run (a bespoke, single-layer
guided layout); drag and drop as an alternative card input; hosting.
~~Watch (session 57): the Burner prompt may get naggy~~ -- replaced in
session 61 by a toggle under your gauges (one armed at a time, used at
the start of your next turn). Rules text for the general Mods: done
(session 58).

~~**The economy (session 61's measurement)**~~ -- done in session 62
(see the session log): the simulated player shops like a person; a 3-item
Mod slate at double prices; rerolls 25; elites offer a subroutine OR a
Mod; ~25% less Data; the gatekeeper curve eased to 73.5/67/61/55 for the
user's new 15-20% target; class Mods for Breacher, Eidolon, Operator.
Mods at the layer-4 gatekeeper ~12 (target ~10 by run's end).

~~**Loadout swap (UX)**~~ -- done in session 62: on a full side,
"install"/"to bench" become "swap in"/"swap to bench" and ask which
subroutine on the other side to exchange (dashed targets, cancel).

Open from session 62:
- **Mods:** ~12 at the layer-4 gatekeeper (Shop 4.6, elites 4.1,
  gatekeepers 3.0); the user's target is ~10 by the end of a run. Watch
  in playtesting; trims left: Mod rewards from gatekeepers, Event Mods.
- **Data still left over:** the simulated player reaches layer 4 with
  ~90-140 Data unspent -- the Shop runs out of wanted things before the
  player runs out of Data.
- **Eidolon (20.7%) and Breacher (14.7%)** sit at the band's edges --
  within noise; watch.
- **Zero-Sum's strength cliff** (1.49-1.53) persists.
- **Not seen in the browser:** the elite choose-one screen in a real run
  (the screen itself was checked mounted with a real reward).

Open from session 61:
- **Not yet seen in the browser:** the Shop's Sell section, the
  Safehouse's "merge everything", rank marks and "+N banked" (they only
  appear once a run has banked copies) -- tests cover the engine side;
  check them in the next playtest.
- **The leftover pegging card** fix was made from the code (the bug
  wasn't reproduced on demand) -- confirm in playtesting.
- **Zero-Sum** has a strength cliff between scale 1.50 and 1.53 (its
  "Credit past 4 a turn" rule); left at 1.50.
- **Selling isn't in the simulation:** the simulated player never sells,
  so more Data from selling isn't in the balance numbers.
- **Saves:** Shop and Safehouse answers changed shape (sell actions;
  Merge spends everything), so runs saved before session 61 may not
  resume cleanly (the known saves-vs-updates issue).

Open from session 60:
- **Player-side content pass** (above): new subroutines, Mods, Burners.
  Enemy-only effects (Trace, Wipe, Strip) stay off the player pool; a
  player-side Suspend ("your bottom subroutine skips a turn") was floated
  as a possible future effect.
- **Watch in playtesting:** Threat Hunter is the loudest elite (about
  twice Intrusion Alarm's Heat a fight, by design); Rollback is a big
  once-a-fight swing; Resource Quota rewards ordering your weakest
  subroutine last, which the simulated player doesn't optimise.
- **Pricing tools:** kit power (roster-check) can't see effects aimed at
  the player's Hooks or Ward, or Mods like Resource Quota; enemies
  carrying those are priced by parity (`scripts/enemy-parity.ts`).
- **Zero-Sum's gatekeeper scale** (1.49) was set between two
  measurements, not re-measured.

Open from session 59:
- **The coach is a first model:** pegging plays are judged one reply
  deep, against random opponent cards; the crib table takes the other
  two crib cards as random. Both could be refined (real discard
  tendencies; deeper pegging look-ahead).
- **Difficulty levels are AI stand-ins:** Easy (0.6) may still be hard
  for a true beginner -- watch it in playtesting; moving it is one
  number.
- **Self-counting and muggins:** a long-term maybe (the user may never
  add it).
- **Pegboard:** the strip and street-board mockups remain at #pegboard if
  bars ever feel too plain.

Open from session 58:
- **Set aside, to revisit:** Static Shield (overtuned: -2 from every plain
  Credit the opponent gains) and Recon Ping (returns if the map gets fog
  of war).
- ~~**Class spread 16–26%**~~ -- resolved in session 60: 16–22% after
  the class Mod redesign and the new elites.
- **Mod findings** from writing their rules text: Black Budget redraws
  the piece choice rare-weighted, not a tier up as its comment says;
  Surge Protector is spent even when another effect already zeroed that
  Credit.
- **Saves don't survive a game update** that changes rules or content
  (a replay of answers); a snapshot save would, at the cost of making the
  run engine resumable from state.
- **Skeleton Key's reopen** is checked by tests only; play it on a phone.
- **CI:** the deploy workflow's actions target Node 20 (deprecated;
  GitHub forces Node 24) -- bump `actions/checkout` and `actions/setup-node`.

---

## Roadmap status

| phase | status |
|---|---|
| 0 — Design passes | ✅ complete (sessions 2–13, 27, 36) |
| 1 — Core Cribbage engine | ✅ complete (session 16) |
| 2 — Combat wrapper | ✅ complete (session 18) |
| 3 — Network map / run structure | ✅ complete (session 20) |
| 4 — Meta-progression | ✅ complete (session 22) |
| 5 — Content, balance & polish | 🔄 systems complete; **archetype redesign in progress** (session 51), no UI, no art |

Detail for every completed phase, and the full per-checkpoint record of
Phase 5's systems work, is in `docs/roadmap-history.md`.
