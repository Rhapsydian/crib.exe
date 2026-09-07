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

## Current state (end of session 49)

**Where the project is.** The engine is complete and content-real
through Phase 5's systems work. 800 tests, `npm run check` clean.
**There is still no UI.**

**What session 49 did.** Built the *synthetic gatekeeper*
(`RunOptions.gatekeeperOverrides`, `--syntheticGatekeepers` on
`sweep.ts` and `gatekeeper-check.ts`) and used it to take three
measurements. No content or constant was tuned — the picture below is
diagnosis, and acting on it is the next session's job.

**The one-sentence finding: the gatekeeper roster — not the classes, and
not the layer curve — is where the balance problem lives.**

---

## Balance — the active arc

### 1. `GAUGE_THRESHOLD` is roster-mediated — RESOLVED

Confirmed, and sharper than the hypothesis was. Sweeping 8/12/16 with the
threshold as the *only* variable, 300 seeds:

| class | 8 | 12 | 16 | slope | flat-roster slope |
|---|---|---|---|---|---|
| breacher | 12.7 | 6.0 | 5.0 | −7.7 | −2.0 |
| blackhat | 20.3 | 14.3 | 11.7 | −8.6 | 0.0 |
| saboteur | 26.7 | 25.0 | 19.7 | −7.0 | +5.0 |
| operator | 22.0 | 16.7 | 11.3 | −10.7 | −2.4 |
| warden | 10.3 | 6.0 | 4.7 | −5.6 | −1.7 |
| **ghost** | 21.3 | 39.3 | 46.7 | **+25.4** | +2.3 |
| spread | **16.4pp** | 33.3pp | **42.0pp** | | |

The archetype-preference effect is real, monotonic and large — Ghost
gains 25.4pp across the range — but it **vanishes against a flat roster**
(+2.3pp, not significant). So it is not an archetype dial in general; it
is an archetype × gatekeeper-matchup interaction. The mechanism is the
one session 48 spotted on the Quarantine Ward: raising the threshold
lengthens fights, and a denial/outlast kit converts long fights into wins
against *specific* gatekeepers.

Two consequences:

- **The threshold is a dispersion dial.** Spread runs 16.4 → 33.3 →
  42.0pp across 8/12/16. Session 48's 8 → 12 change cost ~17pp of
  dispersion by itself — knowingly bought, to give threshold-manipulation
  content room above the floor of 4, but now priced.
- **Fix the roster and the threshold becomes usable again.** Every
  flat-roster slope is ≤5pp. Sequencing: roster first, then this constant
  is available as a difficulty lever.

Session 48's own before/after table cannot be read as a threshold
experiment — its "before" column is the *pre-session-48 engine*, so it
confounds the threshold with four other checkpoint changes shipped
alongside it.

### 2. Dispersion is a roster problem, not a class problem — REFRAMED

Holding the roster at a fixed per-layer curve collapses class spread from
**33.3pp to 11.0pp** and puts five of six classes inside the 10–20% band:

| class | real roster | flat roster | delta |
|---|---|---|---|
| breacher | 6.0% | 15.7% | +9.7 |
| blackhat | 14.3% | 12.3% | −2.0 |
| saboteur | 25.0% | 23.3% | −1.7 |
| operator | 16.7% | 18.7% | +2.0 |
| warden | 6.0% | 12.3% | +6.3 |
| ghost | 39.3% | 16.0% | −23.3 |

Only three classes move significantly (Ghost ~7σ, Breacher ~3σ, Warden
~2σ); the other three do not move at all. **Roughly two thirds of what
has been read as class imbalance is gatekeeper matchup.**

The decomposition is clean, because the control was run too — a synthetic
set to today's *measured* rates keeps current difficulty and removes only
roster variance:

- real roster → measured-rate synthetic: 33.3 → 12.5pp (variance)
- measured-rate → designed monotonic: 12.5 → 11.0pp (curve shape)

Curve shape buys essentially nothing. **Variance** is what matters.

### 3. The layer curve — the spike is layer 3, not layer 2 — CORRECTED

Measured against a genuinely unfiltered cohort
(`--syntheticGatekeepers=1,1,1,1`; the plain numbers are
survivorship-conditioned, because losing a gatekeeper fight ends the run
and every deeper cohort is therefore pre-selected):

| layer | conditioned | unfiltered |
|---|---|---|
| 1 | 71.7% | 71.7% |
| 2 | 54.9% | 50.7% |
| 3 | 94.6% | **94.5%** |
| 4 | 66.9% | 55.0% |

Layers 2 and 4 are comparably hard. **Layer 3 is a 44pp spike of
easiness**, and its *entire* stable is broken — Total Compromise 87.5%,
Adaptive Threat 98.0%, Silent Corruption 98.9% — despite carrying the
highest `magnitudeScaler` in the game (1.6, vs layer 2's 1.3–1.45).
**Payload magnitude is therefore not what makes a gatekeeper hard**,
which invalidates the session 39 scaler as the roster's tuning lever.

Worth keeping: survivorship bias only shows up where outcomes are
*sensitive* to cohort strength. Layer 3 barely moved when de-confounded,
because a 94.5% fight is insensitive to who fights it; layer 4 moved
11.9pp. The layers most in need of de-confounding are the ones that
already look fine.

### 4. The gatekeeper roster — NOW THE LEAD ITEM

Unfiltered win rate per gatekeeper, 300 seeds:

| layer | | | |
|---|---|---|---|
| 1 | firewall-prime **40.8** | ghost-process 72.2 | the-concierge **98.0** |
| 2 | quarantine-ward **30.6** | incident-response 42.2 | zero-sum 76.1 |
| 3 | total-compromise 87.5 | adaptive-threat **98.0** | silent-corruption **98.9** |
| 4 | null-session 43.6 | kernel-panic 55.3 | ghost-in-the-machine 67.6 |

**Within-layer spread exceeds between-layer spread** — 57pp at layer 1,
45pp at layer 2, against 44pp across the whole curve. Which gatekeeper
you draw matters more than which layer you are on. Three of twelve (The
Concierge, Adaptive Threat, Silent Corruption) are not fights at all.

The tool exists: `--syntheticGatekeepers=1,pin:<id>,1,1` measures one
gatekeeper's marginal cost against a controlled background. The roadmap
schedules the ablation-driven roster pass *last*, behind the class audit;
session 49 deliberately held that sequencing (decision D1) rather than
re-ordering on its own findings. **That call is worth revisiting with the
numbers above in hand.**

### 5. Per-layer difficulty target (new — now in `DESIGN.md`)

`p = 0.78 / 0.72 / 0.66 / 0.60`, monotonically harder, calibrated so the
mean full-run rate is 16.4%, inside the 10–20% band. The project had no
numeric per-layer target before this.

### 6. Fight-length dispersion (still deferred from session 48)

Fights run 2.7–16.7 hands against `combat.ts`'s claimed 10–25.
Content-shaped; needs its own session.

### 7. The full class audit

Still the roadmap's stated next phase. But see item 2 — against a
controlled roster the classes are already nearly in band, so this should
be read as "confirm and polish", not "close a 33pp gap".

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

## Dead knob: debuff `magnitude` on two of three kinds (session 50)

`DebuffPayload.magnitude` is authored on every debuff piece in the pool
and is read for **only one** of the three debuff kinds.

- **`throttled`** — `applyThrottled` (`resolve.ts`) checks the debuff's
  *presence* with `.some()` and then applies module constants
  `THROTTLED_REDUCTION` (4) and `THROTTLED_FLOOR` (1). Magnitude never
  read. **5 pieces** author one.
- **`corrupted`** — same shape: presence check, then a flat
  `CORRUPTED_MULTIPLIER` (0.5). Magnitude never read. **7 pieces**.
- **`choked`** — reads its magnitude properly, as a fraction of a
  starting threshold (session 48's `CHOKE_MAG`). **3 pieces**. Working.

So 12 of 15 debuff pieces carry a magnitude number that does nothing, and
two authored at different magnitudes are identical in play. Found by the
diagnostic pillar suite: the Throttle pillar produced byte-identical
player outcomes at scalar 1 and scalar 14, which is exactly the class of
silent flat-line a calibration fixture exists to expose.

Not fixed. The Throttle pillar sweeps **duration** instead, which is
read, and the exception is asserted in `diagnostic-enemies.test.ts` so it
cannot be quietly "tidied" back to magnitude. Whether to wire magnitude
up or delete the field is a content-rebuild decision (D11), not a repair
to make against a pool that is being re-authored.

## Dead mechanism: Occurrence `scaling` (session 50)

`DESIGN.md:688` specifies the Scaling occurrence variation as
"occurrences bank up to a per-subroutine cap, and payload magnitude
scales with how many were actually banked when it fires." **The scaling
half was never built.** `bankedOccurrences` is written in `triggers.ts`
and read nowhere else in the engine, so `variation: 'scaling'` is
behaviourally identical to `'instant'` — both set `ready: true` on each
occurrence.

Consequences today:

- Three pool pieces use it and silently behave as plain instant triggers
  (`go`/`RARE.cap`, `flush`/`UNCOMMON.cap`, `hisNobs`/3).
- `merge.ts`'s `increasedScalingCap` — documented as "a genuine power
  improvement" — raises a cap that has no effect. Merge is upgrading a
  dead knob.
- It bites hardest exactly where the trigger-pricing problem already
  does: the flush piece using Scaling was meant to compensate for
  rarity by scaling up, which is the compensation that turns out never
  to have existed.

Same class as session 39's dead pieces and session 46's unreachable
Neutral pool: designed, documented, half-wired, silently inert.

**Do not fix in place.** Session 50's D11
(`docs/run-economy-design.md`) supersedes Scaling entirely — triggers
become empowerment rather than gates, so the three pieces are
re-authoring targets in the rebuild rather than repair targets. Logged
here because the defect is real and independent of that direction, and
because `increasedScalingCap` is live misinformation in the meantime.

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
