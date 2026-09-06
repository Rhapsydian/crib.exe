# Run economy redesign — working design record

**Status: designed, not implemented.** Session 50. Nothing in this
document has been built; no content or constant has changed. It exists so
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

In a 4.1-hand fight a flush trigger fires **0.15 times** — about once
every seven fights — against ~18 times per fight for a fifteen. A **~120x
gap**. A flush-triggered enemy piece is effectively a blank slot.

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

**Design consequence, not yet decided:** the layer ramp should probably
run on trigger *reliability* rather than payload size — deeper enemies
built from higher-frequency triggers — since that is the axis that
demonstrably moves outcomes.

**Open:** whether rare-occurrence triggers are equally dead on *player*
pieces. The player drafts and can build toward a flush, and plays at 0.85
(0.126/hand), so it is a weaker version of the same problem — but it has
not been measured.

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
- **Blackhat gets its Trace forgiven three times.** 59.7 Trace/run and a
  29.3% `heatMaxed` rate is the class's identity; a reset may defuse it
  into ordinariness. Measure before committing.
- **Rest near a layer's end becomes dead value.** Mild feel-bad, but also
  a real use-it-or-lose-it decision.
- **`heat.ts`'s own doc becomes wrong.** It describes Heat as "a
  persistent, run-spanning, *rising* danger meter — accumulates toward
  getting caught rather than draining like an HP bar." That is exactly
  what this stops being. Rewrite deliberately.

## Still open

- **Gatekeeper toll size.** Proposed principle, not yet accepted:
  *optional content carries the steepest prices; mandatory content
  carries a floor* — so the gatekeeper toll sits below what tier × layer
  would extrapolate to, precisely because it cannot be declined.
- **Fight difficulty.** Trace makes fights attritional but not
  *losable*. 99.5%/98.0% win rates are untouched by everything above, and
  the user has said they want real difficulty. Two measurements say
  magnitude is not the lever; elite Blackout Cell (76.3% win, enemy peak
  0.452) proves the engine can produce a real fight, so the answer is
  probably kit shape — not yet investigated.
- **Regular vs elite targets.** No intended win rates chosen.
- **Safehouse guarantee**, given 20–38% of layers have none, and a posted
  cost you cannot always pay down is arguably worse than an unposted one.
- **Safehouse rename.** Network maps do not have safe houses. Candidates:
  Cold Storage, Sandbox, Air-Gapped Host.
