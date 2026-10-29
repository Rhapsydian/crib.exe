# Run economy redesign — working design record

> **Status: historical** (corrected in session 63). Session 50's design. Its per-layer Heat economy and per-turn model were built in sessions 51-53 (see `DESIGN.md`); the rest was superseded by the archetype redesign. The original status line read: "designed, not implemented ... no content or constant has changed."

This record exists so
a long design conversation is not held only in scrollback. When a piece
ships, its settled form moves to `DESIGN.md` and this file loses that
section.

## What prompted it

Session 50 measured Heat by source for the first time
(`scripts/heat-sources.ts`) and fight difficulty against real accumulated
state (`scripts/enemy-check.ts`). Three findings drive everything below:

1. **Winning a fight is free.** Heat only accrues on a loss, on moves,
   and from Trace. There is no HP analogue, so ~30 of a run's ~34 fights
   cost nothing. Heat cannot price combat risk when combat has no price.
2. **Regular and elite fights are not fights.** 99.5% and 98.0% win
   rates, with the enemy reaching a mean of **0.101 / 0.146** of its own
   Containment gauge before dying. Flat across all four layers. Only 4 of
   26 enemy/tier combinations are competitive; 11 sit at exactly 100.0%.
3. **The Heat economy has no headroom.** Players arrive at layer-3/4
   gatekeepers at a mean of 56.6/59.6 Heat with a p90 of 94/90 against a
   cap of 100. A post-fight Trace charge of only 10 would have been fatal
   to 14.6%/12.1% of gatekeeper fights *the player won*.

Supporting: moves are **57–77%** of Heat inflow for five of six classes
(Blackhat is 61% Trace, which is intended class identity). Safehouses are
0.15 filler weight and **not guaranteed** — 25.8/20.6/20.1/**38.0%** of
layers generate with none, worst at layer 4 where Heat is highest.

## Decisions

### D1 — A won fight costs Trace ✅

Combat encounters **initialise** `CombatSideState.trace` to a baseline
rather than adding it at the end. Initialising means `traceReduction`
payloads have a job in every fight instead of only in Trace-heavy builds,
so a whole payload type stops being situational.

Thematic frame (user): hitting a node always makes some noise. Structural
frame: crib.exe's map is FTL-inspired, and Heat is the fuel analogue —
a node's Trace is its posted price, and the run becomes a routing problem
under a Heat budget.

**Open:** Trace-triggered content needs a migration plan. Initialising
above zero ripples into `traceAbove` self-state conditions and Blackhat's
Trace-triggered pieces, and it sharpens Blackhat's known "8 generators
reachable, 0 reducers" gap from latent to real.

### D2 — Baseline Trace scales by tier × layer, not fight length ✅

Elite meaningfully above regular. Keyed to what is **knowable before
committing to the node**, per `DESIGN.md`'s rule that Heat's design
"depends on the player being able to do real risk math" — the same
principle that removed the margin-of-loss scaler earlier this session.

Fight length was rejected on evidence, not taste: fights get *shorter*
with depth (7.1 → 3.3 hands regular, 6.5 → 2.9 elite), so a
length-scaled cost would make layer 4 systematically cheaper than layer
1. It would also tax slow kits arbitrarily — Legacy Firewall runs
7.9–10.1 hands while being among the *safest* enemies in the game
(enemy peak fill 0.073–0.094).

### D3 — Non-fight nodes carry no extra Heat ✅

Movement already covers "being here makes noise." Shops and Safehouses
resolve quietly. Events may manipulate Trace as part of their own
resolution — that is event design, not a node tax.

### D4 — Heat fully resets on clearing a gatekeeper ✅

> **Amended by R8 (session 52, `docs/archive/recalibration-design.md`):** the
> gatekeeper's toll is charged *after* the fight, not first, so its
> performance term can read the result; beating the gatekeeper but being
> caught by its toll is a new run ending, "breached, then caught".
> Built in session 52.

The gatekeeper's Trace is charged and checked **first**; survive it and
Heat resets to zero for the next layer. Heat becomes a per-layer budget
rather than a run-long accumulator.

Note this is an invention, not a borrowing: Slay the Spire does *not*
reset HP between acts.

Why it wins:

- **It is a difficulty-ramp lever that works.** Two independent
  measurements now show `magnitudeScaler` does not produce a ramp
  (session 49's gatekeeper stables; session 50's flat
  99.4/99.5/99.6/99.4 regular win rate across layers). A per-layer Heat
  allowance ramps reliably.
- **The gatekeeper toll becomes a reserve calculation** — "can I afford
  one more fight before the reset?" — instead of a trap that kills 12–15%
  of *won* deep-layer fights.
- **It kills the doom spiral**, where a reckless layer 1 quietly costs
  the run at layer 4 with no feedback in between.
- **It sharpens spending.** Leftover Heat at a layer's end is wasted, so
  "how much can I squeeze in before I leave" becomes a crisp per-layer
  optimisation rather than a diffuse long-run drag.

### D5 — The per-layer allowance tightens with depth ✅

The ramp knob D4 unlocks. Numbers TBD.

### D6 — Ascension reduces the reset ✅ (banked)

Higher ascension tiers reset less Heat between layers, bleeding it
forward and forcing cross-layer planning back in. This is where the
partial-reset idea belongs — base difficulty stays fully legible, and
the compromise becomes a difficulty dial instead of a base rule. First
concrete modifier for the otherwise-undesigned Ascension system.

### D7 — A Safehouse is guaranteed on every layer ✅

`safehouse` is currently 0.15 filler weight, so **25.8 / 20.6 / 20.1 /
38.0%** of layers generate with none — worst at layer 4, where Heat is
highest. Once Heat is a tight per-layer budget, "pay it down before the
gatekeeper" becomes load-bearing, and a posted cost you cannot always pay
down is worse than an unposted one. Guarantee at least one; count and
placement TBD.

### D8 — Difficulty comes from trigger FREQUENCY, not payload magnitude ✅

The answer to "what makes a fight hard". Measured, and it overturned two
prior hypotheses of mine along the way.

Cribbage occurrence rates at the skill levels enemies actually play at:

| skill | fifteen | pair | run | **flush** |
|---|---|---|---|---|
| 0.15 (regular) | 4.313 | 2.160 | 0.893 | **0.036** |
| 0.5 (elite) | 4.613 | 2.319 | 1.081 | **0.053** |

**Corrected below — the first version of this section overstated the
gap.** Non-reactive pieces wait for the owning side's next turn
(`resolve.ts`, "the normal turn-gate"); only `reactive` ones bypass it.
So an occurrence sets *readiness*, and the turn gate caps actual fires at
the enemy's own turn rate (~1.03/hand at `GAUGE_THRESHOLD` 12):

| category | occurrences/hand | **effective fires/hand** |
|---|---|---|
| fifteen | 4.313 | ~1.03 |
| pair | 2.160 | ~1.03 |
| go | 1.795 | ~1.03 |
| run | 0.893 | ~0.89 |
| thirtyOne | 0.358 | 0.358 |
| hisNobs | 0.222 | 0.222 |
| flush | 0.036 | **0.036** |

The real gap is **~28x**, not 120x, and the turn gate flattens the top
four categories to roughly the same rate. So the pricing problem is
narrower and sharper than first stated: fifteen / pair / go / run are
already near-equivalent in practice, and it is specifically the four
*rare* categories (thirtyOne, hisNobs, hisHeels, flush) that are
underpriced. A flush-triggered piece still fires about once every seven
fights against roughly four times per fight for a fifteen.

The association holds across the roster: the 8 enemies carrying an
`occ:flush` trigger average **0.071** enemy peak fill and *every one*
sits below 0.15, while the 12 without average **0.169**. All five most
dangerous enemies carry none. Patch Runner is the pure case — half of its
two-piece kit is a flush trigger, and it measures 0.004 peak with a p90
of exactly 0.000.

**This is also why `magnitudeScaler` is inert**, in both places it has
now been measured (session 49's gatekeepers, session 50's regular/elite
layer ramp): it scales the payload of pieces that never fire, and scaling
zero gives zero.

Two hypotheses this replaced, both wrong and both worth remembering:

- *"Enemies are harmless because their kits are gated on Cribbage
  occurrences they cannot hit."* Refuted: r = 0.109 between card-gated
  fraction and peak fill, and fully card-gated kits scored **higher**
  (0.169) than ungated ones (0.073). Zero-Day Broker is 3/3 card-gated
  and second most dangerous. The variable is not *whether* a trigger is
  card-gated but *how often that specific occurrence happens*.
- *"Blackout Cell works because it is an attrition kit."* It has the
  shortest fights of any dangerous enemy (3.3 hands).

**Superseded.** An earlier draft of this section proposed running the
layer ramp on trigger *reliability* rather than payload size. The user
pushed back: magnitude was always supposed to be priced against trigger
frequency, so a reliability ramp routes around a pricing bug instead of
repairing it. Confirmed in the content — `cache-hit` (flush) and
`checksum-match` (fifteen) both carry `COMMON.burst: 5` at ~28x
different fire rates, magnitude is keyed to card *rarity* (drop rate),
and no such principle appears in `DESIGN.md`. Session 40's
`occurrence-frequency.ts` calibration did happen, but it tuned trigger
*thresholds*, not payload magnitudes. See D9/D10 for what replaced
this.

**Open:** whether rare-occurrence triggers are equally dead on *player*
pieces. The player drafts and can build toward a flush, and plays at 0.85
(0.126/hand), so it is a weaker version of the same problem — but it has
not been measured.

### D9 — Pillar trigger is `always` + `pointsCooldown`, not an occurrence ✅

The frequency dial for the calibration suite. Rejected alternative:
holding an `occurrence: fifteen, instant` trigger constant across
pillars.

Why the cooldown wins:

- **Continuous instead of eight scattered points.** Occurrence categories
  give fixed x-values (0.036 … 4.313, most of them flattened by the turn
  gate anyway). A cooldown sweeps smoothly.
- **Low variance.** Fire timing stops being entangled with card luck, so
  a clean response curve needs far fewer seeds.
- **Same underlying dependency.** `pointsCooldown` "ticks only on the
  owning side's own scoring" (`subroutine-types.ts`), which is what an
  occurrence trigger depends on too — so the mapping between them is
  natural rather than forced.

Fire rate ≈ `min(turnRate, ownPoints / N)`. Enemies score ~11–12
points/hand, so the sweep needs roughly **N = 8 → 320**, logarithmically
spaced:

| N | fires/hand | equivalent to |
|---|---|---|
| ~11 | ~1.0 (turn-limited) | fifteen / pair / go |
| ~30 | 0.37 | thirtyOne |
| ~50 | 0.22 | hisNobs |
| ~300 | 0.036 | flush |

**Caveat to validate, not assume:** a cooldown fires *evenly*;
occurrences fire in *clusters*. Same mean rate, different variance — and
in a threshold race, burstiness can spike a gauge over the line in a way
even damage cannot. Validation is cheap and is a checkpoint below.

### D10 — Build the diagnostic pillar suite before reworking enemies ✅

User's call, and it inverts the order the project has used so far:
production enemies were authored before any instrument existed to say
what a given win condition is worth. The existing roster is expected to
be **reworked** on top of the calibrated pillars, so it is deliberately
*not* being audited or tuned first.

Same move as the synthetic gatekeeper: make the thing you want to
understand a controlled variable. Seven pillars, each one enemy with
exactly one piece and no passive:

| pillar | payload | scalar | win condition |
|---|---|---|---|
| Burst | `directBurst` | `amount` | credit on trigger |
| DoT-Turn | `dot` / `castersTurnPulse` | `amountPerTick` | credit per own turn |
| DoT-Points | `dot` / `globalPulse` | `amountPerTick` | credit per combined points |
| Suppress | `instantCounterPush` | `amount` | push the player's Breach back |
| Stall | `ward` | `amount` | absorb, win at `HARD_RESOLUTION_HAND` |
| Tempo | `instantManipulation` | fraction | slow the player's initiative |
| Throttle | `debuff: throttled` | `magnitude` | dent the player's scoring as it credits |

They live in a separate `DIAGNOSTIC_ENEMIES` export, **not** in
`ENEMY_ROSTER`, unreachable in real play and opt-in — same standing as
the synthetic gatekeeper. Mixing calibration fixtures into a roster
that is about to be reworked invites exactly the contamination that hit
this session's own tier labelling.

**Flagged in advance:** `DoT-Points` ticks on points scored by *either*
side, so the player scoring well accelerates the enemy's clock. That is
the Quarantine Ward pathology in pure form, and the suite should catch
that class of design structurally rather than after four content
patches.

**Compositionality is an assumption, not a property.** Two pillars
calibrated to 70% each will not compose to a known number — Blackout
Cell's two passives and the Quarantine Ward's redundant tick feeds are
both cases where the interaction *is* the enemy. The table gives an
expected baseline; the interesting production enemies are the ones that
deviate from it.

### D11 — Every subroutine has a per-turn effect; triggers ELEVATE ✅

**The largest design decision in the project's history, taken knowingly.**
Every subroutine gains a baseline per-turn effect. Triggers stop gating
whether a piece acts and instead add effects and/or increase magnitude.
Cantrips already work this way and become the template rather than a
special case (`rewards.ts`: 4 pool-level Always-triggered Cantrips, one
per archetype; 10 `always` pieces pool-wide).

Rarity therefore gates **amplitude, never existence**. That is what fixes
the pricing bug at the root instead of patching it per piece: a
flush-triggered piece is no longer dead 96% of the time, it does its base
job and spikes on a flush.

The user accepted up front that almost all content is scrapped by this.

**It supersedes D8's proposed fix and the Scaling variation alike.**
DESIGN.md:688 already specifies Scaling as "occurrences bank up to a
per-subroutine cap, and payload magnitude scales with how many were
actually banked when it fires" — but Scaling still gates *firing* on the
occurrence, so a rare-trigger piece stays mostly dead. D11 decouples the
two axes: the turn clock decides **whether**, the trigger decides **how
much**.

#### Consequences that change the rebuild's shape

1. **Output roughly doubles-to-triples unless floors are small.** Today
   only *ready* pieces fire on a turn; under D11 all 6 installed pieces
   fire every turn. Anchor: fights currently reach a 50 threshold in ~4.5
   turns, i.e. ~11 progress per turn across the whole loadout — so the
   per-piece per-turn floor lands near **1.5–2**, against a current
   `COMMON.burst` of 5. Floors are roughly a third of today's common
   burst, with elevation supplying the variance.
2. **"Easier to trigger" evaporates as an upgrade axis.** Merge's
   `easeTriggerCondition`, Operator's Primed passive,
   `occurrenceBankTargetReduction`, `THRESHOLD_EXPLOIT_REDUCTION` are all
   "make this fire sooner" — meaningless when everything fires. They need
   re-pointing to elevation knobs (lower elevation threshold, higher
   cap, bigger rider). This touches Merge, Mods and a class passive, not
   just the subroutine pool.
3. **Trigger families change job, and not all map cleanly.**
   `accumulator` and `occurrence` become charge counters naturally.
   `selfState: isDealer` is boolean — it becomes a conditional bonus, not
   a charge. `reactive`, `chained`, `firesAt` and `handOutcome` currently
   describe *when* a piece fires outside the turn gate; under D11 they
   have to mean "an extra fire" or "a bonus rider," which is a real
   semantic decision per family.
4. **Cooldowns get much stronger.** `pointsCooldown` and
   `maxFiresPerCombat` now suppress a *guaranteed* floor rather than
   gating an occasional fire, so their power level changes without any
   number changing.

#### What is and is not scrapped

Scrapped or re-authored: the 159-piece subroutine pool, and the 32 enemy
kits built from it. Mostly survives: Events, Burners, and the Mods that
do not touch trigger-easing. Untouched: the Cribbage engine, map/run
layer, Heat/Trace economy (D1–D7 above stand independently).

#### This promotes the pillar suite from diagnostic to foundation

With the pool scrapped there is no content to calibrate *against*, and
the pillars stop being a measuring instrument and become the **authoring
template**: every production subroutine is a pillar floor plus an
elevation rider. The checkpoint plan below gains weight rather than
losing it, and the "hold the trigger constant, sweep magnitude ×
frequency" design (D9) is exactly the two-component shape D11 asks
content to be written in.

### D12 — Trigger family semantics under D11 ✅

All eight families collapse into three modulator roles: **charge** (bank
something, spend it as magnitude on the next per-turn fire),
**condition** (while true, the fire is elevated), and **extra fire** (an
additional fire outside the turn gate).

| family | role | notes |
|---|---|---|
| `always` | none — pure floor | The cantrip. Becomes the pricing baseline for everything else. |
| `occurrence` | charge | Its three variations dissolve (below) |
| `accumulator` | charge | Same, counting raw progress; `threshold` becomes the stepped point |
| `rareOccurrence` | charge, stepped | `minMagnitude` and `watchSide` both survive — watching the *enemy's* scoring stays a distinct signal |
| `selfState` | condition | `isDealer`/`isNonDealer` gives a half-your-turns rhythm; `traceAbove`/`Below` are build-state conditions |
| `enemyState` | condition | "elevated as the fight goes badly/well" — meaning unchanged |
| `handOutcome` | extra fire | A per-*hand* rhythm rather than per-turn; texture worth keeping |
| `chained` | condition, redefined | See below — the only family that breaks |

**Occurrence's variations dissolve.** `instant`/`threshold`/`scaling`
were three answers to "when does it fire", a question D11 deletes. Their
design intents survive as two elevation shapes: **graded** (magnitude
+= per-charge x charges; `cap` survives from `scaling`) and **stepped**
(at >=N charges add a distinct effect; `bankTarget` survives from
`threshold`). Scaling finally does what DESIGN.md:688 always said.

**A rider is one bundle, not several.** A single rider may raise
magnitude *and* add a mechanic (e.g. also apply a DoT). So a piece is
**floor + one rider**, even when the rider does two things. This keeps
pricing tractable: one floor and one rider are each independently
measurable, where an arbitrary stack of riders would not be.

**`chained` is redefined onto elevation, not firing.** Under D11
everything fires every turn, so `afterSubroutineId`/`afterArchetype`/
`afterTag` all become trivially true and the family would collapse into
`always`. Instead it becomes a rider condition on *elevation plus
ordering* — e.g. "Chain-Exploit: this rider applies if an Exploit
subroutine executed **elevated** earlier in this turn." That restores
selectivity, keeps the family's real job (loadout synergy), and preserves
loadout **ordering** as a live decision, since `fireReadySubroutines`
sequences by loadout position.

**`reactive` becomes a second payload.** A reactive piece carries a base
per-turn payload *and* a reactive payload that fires when its reaction
condition is met. Clean to price separately, and it replaces the old
meaning ("bypasses the turn gate"), which is no longer distinguishing.

**Naming: ELEVATED.** ✅ A subroutine banks **charges** and fires
**elevated**. Two words for two things — the resource and the state.
`Overclock` was proposed and rejected: its collisions (a pool subroutine,
the Overclocked Accumulator Mod) both sit in the scrap/rework set, but
the *metaphor* is wrong — overclocking means running **faster**, and D11
fixes the rate at one fire per turn while varying **power**. It would
name the one axis the redesign removes.

### D13 — Loadout ordering stays, and chains come in two strengths ✅

Ordering survives D11 as a real decision. Two chain shapes, forming a
power ladder rather than duplicating each other:

- **Adjacent** — the rider applies if the *immediately prior* subroutine
  in loadout order was of a given id/archetype/tag. Hard to satisfy,
  sensitive to exact arrangement, so it carries the **larger** rider.
- **Any-prior** — the rider applies if a matching subroutine executed
  **elevated** earlier in this turn. Satisfied by having one anywhere
  above, so a **smaller** rider.

Both reuse machinery that already exists: `satisfiesChain`
(`loadout.ts`) already implements the three id/archetype/tag match modes,
and `ReorderStrategy` (`run.ts`, called between fights) already models
loadout order as a mutable player decision, consistent with DESIGN.md's
"mid-combat's only lever is Togglable" rule.

Two consequences worth pricing in:

- **This makes `INSTALLED_SLOT_CAP` (6) a genuine puzzle space.** Six
  ordered slots with adjacency chains produces real combinatorial build
  decisions without adding a system.
- **It creates a hard UI requirement, not polish.** Adjacency chains are
  only fair if the player can arrange the loadout; there is no UI yet,
  and drag-to-reorder moves from "nice to have" to load-bearing. Log it
  as a UI dependency now rather than discovering it later.
- **The bench gains a real job.** An earlier draft of this said
  acquisition would start breaking chains. It does not: `install`
  appends at the *end* of the loadout (`loadout.ts`), so a new piece
  never inserts mid-chain, and the bench means the player is never forced
  to install at all. What actually changes is that install-vs-bench
  becomes an active roster decision rather than overflow handling.
- **A real `ReorderStrategy` becomes necessary for simulation.** The
  default is `keepAcquisitionOrder`, documented as "exactly what every
  run has done until now" — so **no simulated run has ever reordered a
  loadout**. Adjacency chains would be invisible to every existing
  diagnostic until a strategy that actually arranges the loadout exists.
  This is a prerequisite for measuring any chain content, not a polish
  item.

### D14 — Corrections from building the suite (checkpoint 1-2) ✅

Four things the build found that the design did not anticipate. All are
corrections to D10's pillar set or to how it must be measured.

1. **The pillars are two families with different success metrics.**
   *Credit* pillars (Burst, DoT-Turn, DoT-Points) advance the enemy's own
   Containment gauge. *Denial* pillars never touch it — they suppress the
   player and win at `HARD_RESOLUTION_HAND`, so their enemy peak fill is
   0 at every scalar. A one-metric harness would print a table of zeros
   for four of seven pillars that looked like data.

2. **`ward` is not a win condition, so "Stall" was not a pillar.** Ward
   absorbs incoming offense against the warded side, but the player wins
   by filling their **own** Breach gauge, which an enemy shield never
   touches. Measured flat at ~99% player win across the entire scalar
   range. Replaced by **Drain** — a `hot` payload, which reduces the
   *opponent's* gauge over ticks and is the sustained counterpart to
   `instantCounterPush`'s one-shot. Ward is mitigation; a pillar has to be
   a win condition.

3. **Peak fill is the wrong metric for denial.** It is a high-water mark,
   so a gauge pushed back *after* peaking still reads high — and since
   the player wins nearly always, it is pinned above 1.0 regardless of
   the knob. Fight **length** and attrition share are what respond.

4. **Credit pillars saturate.** Once the scalar reaches the 50-point
   Containment threshold, one fire wins outright and the result is
   decided by who takes the first turn — the win rate flattens near 50%
   and wobbles with noise. Measured: 100 / 96.8 / 60.3 / 46.0 / 58.7 /
   49.2 across scalars 10-400. The harness now flags saturation so a
   sweep cannot read that plateau as a response.

**The big open question this raises for checkpoint 3-4.** Denial pillars
are close to inert against an accumulated loadout: at scalar **250**,
Drain never wins at all and Suppress reaches 2.5% attrition wins. Fight
length does respond (4.2 → 5.5 hands), so they are not broken — but
denial only wins if it out-paces player generation *continuously*, and
the turn gate caps a pillar at ~1 fire per turn while six player pieces
fire every turn. That asymmetry, not magnitude, looks like the binding
constraint. It needs its own measurement before any denial content is
priced, and it may be the strongest argument yet for D11: under a
per-turn model the six-to-one action asymmetry is exactly what changes.

### D15 — A condition is a charge of 1 (D11-C) ✅

The open question was whether a condition rider should be a flat bonus
while true or a multiplier on charges. It answers itself from the
one-rider model: a piece has exactly **one** trigger, so a
`selfState`/`enemyState` piece has no charge counter to multiply — a
multiplier would be multiplying zero.

So a condition contributes **1 charge while true, 0 while false**, which
makes `perCharge` the flat bonus-while-true and `cap: 1` fall out
naturally. One field shape (`elevation: { perCharge, cap }`) serves both
families, and `chargesFor` is the single place either is computed.

Evaluated live against a `TriggerContext` rather than read off
`state.ready`: `ready` is latched by `refreshTriggerReadiness` and
cleared by `resetAfterFire`, so it can be stale within a turn — and after
D11-A nothing else consults it. Without a context the condition families
return 0, since a caller that cannot evaluate the condition must not get
to guess.

`always` and `chained` remain genuinely signal-less — a floor-only
cantrip and a sequencing reference.

---

## Implementation plan — diagnostic pillar suite

Checkpointed, pausing after each. Nothing here touches production content
or constants; the existing roster is left alone by design (D10).

### Checkpoint 1 — `DIAGNOSTIC_ENEMIES` and its plumbing

- New module exporting the seven pillars, each parameterised by
  `(scalar, pointsCooldown)` via a factory rather than authored
  statically — the suite's whole job is to be swept.
- Every pillar shares the same trigger (`always` + `pointsCooldown`) and
  carries no passive, so a sweep moves exactly one variable.
- Reachable only by explicit opt-in; a test asserts no diagnostic id is
  selectable through `eligibleEnemies` / `pickRegularOrEliteEnemy` /
  `assignGatekeeperEnemy`.
- Tests: each pillar fires at the expected rate for a given cooldown;
  each credits the gauge it claims to; none is reachable in real play.

### Checkpoint 2 — the sweep harness (`scripts/pillar-check.ts`)

- Two-axis sweep, magnitude × cooldown, logarithmic on cooldown
  (N ≈ 8 → 320).
- Measured against **real accumulated player state per layer**, captured
  the way `gatekeeper-check.ts` does it — not a bare starting kit, which
  is the lesson that script already learned.
- Reports win rate, enemy peak fill and hands, since win rate alone
  cannot distinguish "hard fight" from "not a fight" (session 50).
- States its provenance in output, per README's conventions: these are
  isolated re-fights against a diagnostic fixture, not full-run metrics.

### Checkpoint 3 — burstiness validation (D9's caveat)

Build one pillar both ways at matched mean fire rate — `thirtyOne,
instant` versus cooldown ≈ 30 — and compare. Agreement validates the
cooldown→occurrence mapping the whole calibration rests on. Divergence
means burstiness is a real second variable, which is worth knowing on its
own. **This gates checkpoint 4**: if the mapping does not hold, the
frequency axis needs rethinking before any table is trusted.

### Checkpoint 4 — run the calibration

Produce the two tables: magnitude → win rate per layer, and fire rate →
win rate. Invert to get the exchange rate between them — the content rule
that turns out never to have been written, and which prices the **player**
pool as much as the enemy one.

### Checkpoint 5 — skill sensitivity

Sweep player skill as a third axis and report, per pillar, whether win
rate moves with it. A pillar that is flat across skill is a design that
cannot be played around, only built around. This is the structural test
for the Quarantine Ward pathology.

### Checkpoint 6 — write-up

Settled results move to `DESIGN.md` as the magnitude × trigger-frequency
pricing rule; `BACKLOG.md` gets the roster rework that follows from it;
session log; and this document loses the sections that shipped.

## Consequences to work through

- **Total pressure loosens ~4× unless the cap drops.** Four budgets
  instead of one. `HEAT_MAX` likely wants ~40–60, per layer, tightening
  with depth.
- **Recalibration list:** `HEAT_MAX` (100), `HEAT_PER_MOVE` (2),
  `REST_HEAT_REDUCTION` (20), the flat loss charges (regular 15 /
  elite 30, set earlier this session), and eight Events carrying ±8–28
  `heatDelta` — all calibrated against a run-long budget that will no
  longer exist.
- **Inflow shift still wanted.** Even with resets, if moves stay 57–77%
  of Heat the layer budget is still mostly a movement allowance. Baseline
  fight Trace is what makes it a budget about decisions.
- **Blackhat's high Heat is intended and must survive the rebalance
  (user, explicit).** "Blackhat having to be careful with its heat is
  part of the class identity, so it's expected to be higher." So its 59.7
  Trace/run and 29.3% `heatMaxed` are a design target, not a defect to
  fix — but D4's reset forgives that Trace three times per run and may
  defuse the identity into ordinariness. Measure Blackhat specifically
  before committing to the reset numbers; it is the class most changed by
  D4.
- **Rest near a layer's end becomes dead value.** Mild feel-bad, but also
  a real use-it-or-lose-it decision.
- **`heat.ts`'s own doc becomes wrong.** It describes Heat as "a
  persistent, run-spanning, *rising* danger meter — accumulates toward
  getting caught rather than draining like an HP bar." That is exactly
  what this stops being. Rewrite deliberately.

## Still open

- **Trigger-easing upgrades need re-pointing.** D11's consequence 2, and
  the last unresolved piece of it: Merge's `easeTriggerCondition`,
  Operator's Primed passive, `OVERCLOCKED_ACCUMULATOR_REDUCTION` and
  `THRESHOLD_EXPLOIT_REDUCTION` all mean "fire sooner", which no longer
  exists. "Merge adds a rider" is the obvious replacement. **Deliberately
  deferred until after pillar calibration** — a rider cannot be priced as
  an upgrade until checkpoint 4 says what a rider is worth.
- **Gatekeeper toll size.** Proposed principle, not yet accepted:
  *optional content carries the steepest prices; mandatory content
  carries a floor* — so the gatekeeper toll sits below what tier x layer
  would extrapolate to, precisely because it cannot be declined.
- **Regular vs elite win-rate targets.** None chosen. Now downstream of
  the pillar calibration rather than a standalone question: the pillars
  say what a given floor+rider is worth, and the targets say how much to
  buy.
- **Safehouse rename.** Network maps do not have safe houses. Candidates:
  Cold Storage, Sandbox, Air-Gapped Host.
- **Trace-triggered content migration** (from D1). Initialising `trace`
  above zero ripples into `traceAbove`/`traceBelow` conditions. Largely
  absorbed by D11, since the whole pool is being re-authored, but the
  Mods and Burners that read Trace are not.

## Resolved since first draft

- ~~Fight difficulty / "what makes a fight hard".~~ Answered by D8
  (trigger frequency, not magnitude) and superseded by D11, which removes
  the premise by making every subroutine fire every turn.
- ~~Safehouse guarantee.~~ Decided as D7.
- ~~Whether rare-occurrence triggers are equally dead on player pieces.~~
  Moot under D11: no trigger gates firing any more, for either side.
