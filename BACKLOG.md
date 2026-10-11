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

## Current state (end of session 51)

**Where the project is.** Session 51 redesigned the archetypes and the
subroutine model from scratch (`docs/archetype-redesign.md`, A1–A12) and
finished **step 1, the engine refactor**, on the `archetype-redesign`
branch (not pushed). The engine runs the alpha/beta model end to end;
content is a deliberately untuned skeleton. 615 tests, `npm run check`
clean. **There is still no UI.**

**What changed underneath the balance work.** The balance arc below
measured the old 159-piece pool and 32-enemy roster, both now deleted.
Its numbers describe content that no longer exists; its lessons
(gatekeeper matchup dominates class spread; trigger frequency, not
payload magnitude, makes a fight hard) carry forward.

**Session 50** (never closed out, no log) produced the run-economy
decisions D1–D7 (per-layer Heat — decided, not built), the diagnostic
pillar suite, and the per-turn model D11–D15 that session 51 built on.
Its record is `docs/run-economy-design.md`.

**Next:** step 2, recalibration — and it opens with design questions,
not code. See the arc immediately below.

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
2. **Recalibrate** — the pillar suite currently carries three verb
   pillars (Credit, Suppress, Tempo); Ward, Empower, Disrupt and Charge
   pillars need a design first (they can't win alone, D14). Then
   run-economy checkpoints 3–6 to price an alpha and a beta. Known going
   in: skeleton regular/elite fights are near-free (100% player wins in
   `enemy-check.ts`), and two watch items sit on Honeypot (A2's, and
   conversion credits bypassing Ward).
3. **Author** — archetype subroutines → classes (names, bridge
   passives, unlock order) → enemy roster.

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
- **Resumable orchestration for human-vs-AI play** (session 24) — an
  architecture question, not an AI one. Every `DiscardStrategy`/
  `PlayStrategy` call is synchronous today, so there is no way to
  represent "pause and wait for a human's click." `playPegging`'s loop
  and `combat.ts`'s hand-lifecycle sequence would need to become
  externally pausable. Distinct from the skill-dial work, whose scoring
  logic stays equally useful either way.

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
