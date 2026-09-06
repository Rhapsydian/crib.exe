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

## Current state (end of session 48)

**Where the project is.** The engine is complete and content-real
through Phase 5's systems work: Cribbage rules, the combat wrapper, the
run/map layer, meta-progression, the 32-enemy roster, 138 player-facing
subroutines, 40 Mods, 8 Burners, 8 Events. 791 tests, `npm run check`
clean. **There is still no UI** — `npm run dev` serves the default
Svelte scaffold.

**What session 48 changed.** Turn economy was re-derived from real
measurement. `GAUGE_THRESHOLD` went 8 → 12 (~1.6 turns per side per hand
→ ~1.12); every quantity that manipulates an initiative gauge became a
*fraction* of a turn or of a threshold rather than a point count;
`WIN_THRESHOLD` split into `BREACH_THRESHOLD` and
`CONTAINMENT_THRESHOLD`; escalation's shrink and floor now derive per
side; gatekeepers gained a `gaugeThresholdScaler` tempo dial;
meta-progression gained sockets on `RunPlayerState`. A separate
instrument audit closed a type-check gap over `scripts/`.

**The single most important number.** Post-change full-run rates, 150
seeds, `--acquisition=synergy --traversal=opportunistic`, skill 0.85:

| class | before | after |
|---|---|---|
| Ghost | 32.7 | **42.0** |
| Saboteur | 30.0 | 23.3 |
| Operator | 23.3 | 18.0 |
| Blackhat | 21.3 | 14.7 |
| Breacher | 15.3 | 7.3 |
| Warden | 10.7 | 6.7 |

**Next session is the balance pass**, and it should start from the first
item below rather than from per-class tuning.

---

## Balance — the active arc

### 1. Is `GAUGE_THRESHOLD` an archetype-preference dial?

The nerf landed on five classes and **inverted on Ghost**. The tempo
content is ratio-neutral by construction (`tripwire` went 8→13 and now
goes 12→20; `ghost-protocol` 8→16 and now 12→24 — the same multiples),
so the pieces do not explain it.

Working hypothesis: raising the threshold reduces *total actions for
both sides*, and a denial/outlast kit benefits from a world with fewer
actions in it while an offensive kit is the one paying for them. Ghost
is the denial class. If that holds, this constant can never be a neutral
difficulty dial — it will always move Ghost opposite to everyone else,
and the rebalance must not lean on it.

**Test it directly before tuning anything else.** Ghost was above
baseline under both traversals (42.0 opportunistic, 38.0 beeline), so
this is not a traversal artefact.

### 2. Dispersion is the real problem, and it got worse

Spread went from 22pp (10.7–32.7) to 35.3pp (6.7–42.0). Against the
10–20% target band: two classes in it, one just above, two below, and
Ghost at more than double the top. Closing the spread matters more than
moving the mean.

### 3. The difficulty curve is non-monotonic

`gatekeeper-check.ts`, realistic accumulated power, all classes:

| layer | pass rate |
|---|---|
| 1 | 71.7% |
| 2 | **55.1%** |
| 3 | 94.6% |
| 4 | 67.3% |

Layer 2 is the hardest layer in the game and layer 3 the easiest, by
27pp. The funnel agrees — the collapse is L1→L2 for every class
(Breacher 70.0% → 21.3%, Warden 65.3% → 18.7%). **Probably fix this
before per-class tuning**: no amount of class balancing rescues a curve
that peaks at layer 2.

### 4. Fight-length dispersion (deferred from session 48)

Fights run 2.7–16.7 hands against `combat.ts`'s own claimed 10–25, which
makes every bank/accumulator-shaped trigger silently conditional on
which enemy was drawn. The 8 → 12 change narrowed it only to ~5×; short
fights lengthened ~25% while long ones stayed pinned by
`HARD_RESOLUTION_HAND`. Content-shaped (burst kits vs. grind kits), so
it needs its own session.

### 5. The full class audit

Still the roadmap's stated next phase, and now genuinely unblocked (the
session 47 eviction bug that was suppressing three classes is fixed).
Five of six classes touch Encryption or Root, the two archetypes whose
native win conditions were only added in session 40.

---

## Turn-economy follow-ups (session 48)

- **`dns-poisoning` may be too strong — flagged by the user.** It is now
  an instant, permanent, *repeatable* halving of the caster's own
  initiative threshold on a `reactive` trigger. Two fires take a
  12-threshold side to 6 and then to the floor of 4: a 3× tempo swing
  off one UNCOMMON piece, uncapped and non-expiring. Re-denomination made
  it legible, not smaller. Options, in increasing order of identity
  change: lower the fraction to 1/4 (grades 12 → 9 → 6 → 4);
  `maxFiresPerCombat` (the engine gap that left this unenforced was
  fixed in session 43, so a cap would now hold); or make it duration-
  bounded, the move session 43 already made on Orphaned Thread for this
  exact runaway shape.
- **Null Session's authored Containment of 65 may need raising.**
  Escalation now derives per side, so its bar falls to its own floor of
  13 by the deadline instead of stopping at 25 — stronger in long
  fights, partially undoing the nerf the 65 was authored for. Measured:
  vs Warden it runs a mean 12.8 hands with 90% of fights passing
  `ESCALATION_START_HAND`; vs Saboteur only 5% do, so it is inert there.
- **The tempo dial is weaker than the backlog assumed.** Measured across
  three gatekeepers, `gaugeThresholdScaler` only moves output for an
  enemy whose firing is genuinely turn-bound, and enemy kits largely are
  not. It will not fix **the Quarantine Ward**, whose `total-quarantine`
  nudge rides DoT/HoT ticks with two redundant feeds and so scales with
  fight *length*. That remains a content problem: closing one feed
  (Contagion Protocol) left Cryo Lock's 5-duration HoT supplying the
  other.

---

## Known content gaps

- **Blackhat's Trace lockout** — 8 Trace generators reachable, 0
  reducers.
- **Saboteur's Time Bomb** — an accumulator trigger would restore the
  pair the kit intended; re-pointing the pump was the smaller fix taken
  in session 47.
- **Warden's Feedback Loop may be too strong** (banked session 25, never
  implemented): either gate it to the caster's own dealer hands, or
  replace the flat per-tick credit with reciprocal HoT/DoT magnitude
  amplification, which would need its own sweep since it is a real
  power-level change rather than a re-flavouring.
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
- **`DESIGN.md` restructure.** 2,308 lines, same accretion pattern this
  file had, though less severe. It also carries ~13 remaining references
  to `BACKLOG.md` sections that moved to `docs/roadmap-history.md` in
  session 48 — the unambiguous ones (named completed sections) were
  repointed, but generic "see `BACKLOG.md` Phase N" references were left
  alone because some of those phases still have live forward items here
  and some do not. Resolving them one by one belongs with the restructure.
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
| 5 — Content, balance & polish | 🔄 systems complete; **balance ongoing**, no UI, no art |

Detail for every completed phase, and the full per-checkpoint record of
Phase 5's systems work, is in `docs/roadmap-history.md`.
