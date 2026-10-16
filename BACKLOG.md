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
2. **Layout mockups** (2–3 phone variants: tabs / drawers / compact), then
   **one playable fight**: tap-to-lift cards, turns stepped through piece
   by piece, tap anything to inspect it, a running log. Player-facing
   names "Process" (alpha) and "Hook" (beta).
3. **A playable run** (run loop converted, map and node screens, class
   choice, end screens).
4. **Polish and playtesting**, including a style / chrome guide.

Backlog from this plan: an optional tutorial run (a bespoke, single-layer
guided layout); drag and drop as an alternative card input; hosting.

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
