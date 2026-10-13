# Recalibration (step 2) — working decision record

Step 2 of the archetype redesign (`docs/archetype-redesign.md` A10):
price an alpha and a beta so step 3 can author real content. Continues
the pillar-suite work of `docs/run-economy-design.md` (D8–D14), whose
calibration checkpoints 3–6 were planned before the redesign. Started
session 52 (`/decision-session`, 2026-10-12).

## Decisions

### R1 — Prices are Credit-equivalents, measured in mirror duels ✅

The session-50 harness measures test enemies against **real accumulated
player state**. Under A11 that state is built from the untuned skeleton,
so prices measured against it would be prices against arbitrary numbers
— and step 3 then replaces the content they were measured against.
Circular.

Instead: one reference piece, **"Credit X per turn"**, is the currency.
Duels are mirror matches at equal Cribbage skill; Credit X vs Credit X
is 50% by symmetry, which is the anchor. A verb's price is the Credit
amount the other side needs to bring the duel back to 50% — its worth in
Credit-per-turn. Not circular, gives step 3 authoring rules directly
("a common is worth about Credit 2 per turn"), and is cheap and
low-variance (piece vs piece, no run simulation, an exact anchor).

Given up: absolute difficulty ("the layer-3 gatekeeper should be won 66%
of the time"). That needs real accumulated player state, so the
per-layer tables move to **after step 3** authors content.

Caveat to measure, not assume: prices may shift with Cribbage skill,
since turn rate depends on scoring. Measure at 0.85, spot-check another.

### R2 — One method for every verb: host plus difference ✅

Both sides get the same host, one **Credit B per turn** piece (a 50/50
mirror). One side adds the verb under test; the other adds plain
**Credit Δ**, varied until the duel is back at 50%. **Δ is the verb's
price.** Credit itself is the instrument check: adding Credit c must
price at Δ ≈ c.

Every verb gets a price in the same units, including the four that
can't win alone — the host does the winning (Ward absorbs the opponent's
host credit, Empower boosts its own host, Disrupt and Tempo change how
often the opponent's host fires, Suppress pushes back what the
opponent's host fills). Replaces session 50's two families with two
metrics (D14).

Measured at several host sizes (B = 1, 2, 4): a verb whose price moves
with B is situational, and by how much is what step 3 needs to know.

**Charge gets no test piece**: it only feeds betas, so its price is
charges supplied × what a charge is worth — a by-product of R3.

### R3 — Betas are priced by formula, validated by direct measurement ✅

A beta's worth = (what it does when it applies, priced by R2) × (how
often it applies, set by its source and shape).

1. **Frequency table, measured once** at skill 0.85: per-turn charge
   rates for each Cribbage category and the suit tally, points banked
   per turn, how often each state condition holds, the absorb rate.
   Extends `occurrence-frequency.ts`.
2. **Pricing formula**: beta price ≈ expected scale per turn (graded:
   min(charges, cap); stepped: chance of reaching `at`; whileTrue:
   fraction of turns true) × R2 price of the beta's effect.
3. **Validation**: a sample of real configurations — every shape, a
   common and a rare source — priced directly with R2's method (full
   piece vs its alpha alone). Agreement makes the formula the authoring
   rule; disagreement earns that shape a measured correction factor.
4. **Charge** = charges supplied per turn × measured worth of one charge
   to a graded beta.

Rejected: measuring every configuration directly — the space is too
large, and step 3 needs a rule an author can apply to a new piece, not a
table of pieces already measured.

### R4 — Burstiness is answered inside R3 ✅

Session 50's pending check (does a cooldown that fires evenly price the
same as card occurrences that arrive in clusters?) is exactly the gap
between R3's formula and its direct measurement for card-sourced betas.
No separate checkpoint. Immediate betas are the other place the formula
is expected to miss, since their value depends on timing.

In passing: the Credit modifiers (piercing, conversion `from: 'ward' |
'opponent'`) are priced with R2's method like any verb — piercing against
a Ward-carrying opponent, conversions as written. The user's
conversion-bypasses-Ward watch item is checked here.

### R5 — The run economy (D1–D7) is built in step 2; Trace is priced against a layer's Heat allowance ✅

Trace is a run cost, not a combat cost, so mirror duels can't price it.
Its price depends on the Heat model it converts into, and session 50's
per-layer model (D1–D7) is decided but unbuilt — authoring Exploit's
"bigger but louder" pieces against the old run-long budget would re-price
them the moment D1–D7 lands. The run economy doesn't need real content
(Heat comes from moves, losses and Trace), so it is built and checked on
the skeleton. Trace's price is expressed as **a fraction of one layer's
Heat allowance**; step 3 trades it against Credit by judgment, not a
shared-currency formula. Brings D1–D7's recalibration list into step 2
(HEAT_MAX, move cost, rest, loss charges, Event Heat values) and session
50's Blackhat check, now owed to Exploit, which inherits the noise.

### R6 — Fight Trace = posted baseline + performance term ✅

Reconciles the user's session-51 idea with session 50's D1/D2.

**Trace on a win = baseline(tier × layer) + k × (enemy's final
Containment %).**

- The **baseline** keeps D1/D2's job: a posted price, knowable before
  committing, and a floor so even a stomp costs something (the user's
  original motivation — easy fights shouldn't be free).
- The **performance term** is the user's idea: a near-run win is noisier
  than a clean one, and the player watches that cost build on the
  enemy's gauge — a reason to win decisively.
- It reads the **final** Containment, which is on screen when the fight
  ends — not the hidden peak that sank the margin-of-loss scaler.
- **Wins only**; losses are R7.
- The baseline/k split is a run-economy tuning number.

### R7 — A loss costs m × the node's worst-case win, replacing the flat charges ✅

The user's call: a loss must cost more than 100% of what a win risks.
Made structural: **loss Heat = m × (baseline + k)**, m > 1 (start ~1.5),
replacing the flat 15 / 30 regular / elite charges.

- The ladder — clean win < scrappy win < loss — holds at every tier and
  layer by construction; two independently tuned numbers could drift
  out of order.
- It scales with tier × layer, so losing deep costs more than losing
  early and D5's tightening allowance stays meaningful for losses.
- Every node's risk becomes a posted triple, all knowable before
  committing (D2's rule): ~baseline on a clean win, up to baseline + k
  on a scrappy one, m × that on a loss. A UI can print it on the node.
- One ratio replaces two constants that were on D1–D7's recalibration
  list anyway.

Unchanged: Trace from the player's own noisy effects still accrues on
top during a lost fight; gatekeeper/boss losses still bypass Heat and
end the run (Quarantine).

### R8 — The gatekeeper toll is a gamble, charged after the fight; new ending "breached, then caught" ✅

The user's framing, adopted over my first recommendation (a small fixed
reserve, no performance term — which created arithmetic, not a choice).

- **Toll = small posted floor + full performance term (R6), charged
  AFTER the gatekeeper fight.** Reverses D4's "charge and check first":
  the performance term needs the fight's result.
- **The layer becomes a bet.** Exploring more costs Heat but buys power;
  more power means a cleaner gatekeeper fight, a lower final Containment
  %, and a smaller toll. Pushing hard buys the strength that makes the
  final toll cheaper — the FTL tension the map wants.
- **Legible, not hidden**: the gatekeeper's Containment gauge is on
  screen the whole fight, so the player watches their toll climb.
  (Correcting my own earlier claim that a performance term here would be
  "hidden until after".)
- **New run ending, added now: "breached, then caught"** — the gatekeeper
  is beaten but the toll pushes Heat over the layer's allowance. Distinct
  from Quarantine (gatekeeper lost) and from being caught mid-layer.
  Recorded as a breach.
- **Loss unchanged**: Quarantine, no Heat.

**Banked for meta-progression** (undesigned; no save/profile layer yet):
credit gatekeeper breaches even in a run that ends on them. The user's
frame — a hacker earns rep for how deep into a network they got, even
without reaching the goal — suggests **reputation by depth breached** as
a natural meta currency. Balance guard to carry into that design: a
breach-then-caught must reward meaningfully less than breaching and
continuing, or "always overextend on the last layer" becomes dominant.

## Checkpoint 1 — run economy built (implementation calls, flag to revisit)

All numbers are first-pass placeholders in `heat.ts`, sized against the
old run-long budget's proportions:

- **Allowances** 40 / 36 / 32 / 28 by layer (was one run-long 100).
  Backup Generator now adds 8 to *every* layer (was +20 to the run cap).
- **Fight Trace baseline** regular 3, elite 6, gatekeeper 2 (R8's
  floor), × (1 + 0.2 per layer past the first). **Performance weight k**
  regular 3, elite 6, gatekeeper 10, same layer scaling — so a scraped
  regular win costs about double a clean one, and the gatekeeper's price
  sits in its performance term. **Loss multiplier m = 1.5.** Rest 12
  (was 20 of 100). Move cost unchanged at 2.
- **The baseline is initialised into the fight's own Trace** (D1), so the
  player's cover-your-tracks effects work against it. On a loss, only the
  player's own noise *above* the baseline is added to R7's charge, since
  the loss charge already prices the baseline in.
- **D7's guaranteed Safehouse re-types the last filler node** rather than
  drawing again — no randomness consumed, every layer's topology
  unchanged; skipped when a caller weights Safehouses out.
- **The scripted route-planner now budgets posted prices**: a detour
  costs its moves plus the target fight's posted worst-case win, and the
  reserve holds the gatekeeper's worst-case toll. Without this, the first
  sweep collapsed victory to 0–20% with "breached, then caught" ending a
  third to a half of runs — the planner was walking into every gatekeeper
  with no reserve for a toll it didn't know existed. This planner is the
  *safe* end of R8's gamble; a bolder one would reserve less.
- **A synthetic gatekeeper** (diagnostic) pays the posted floor plus its
  sampled noise, and no performance term (a synthetic win reports the
  enemy's final fill as 0).

**First readings** (100 seeds/class, synergy + opportunistic, skill 0.85,
skeleton content — not balance measurements): victory 18–69% by class
(was 42–82%), heatMaxed 5–8%, breachedThenCaught 2–20%, quarantined
20–72% (up: a careful player explores less and meets gatekeepers weaker).
Fight Trace is now ~60% of all Heat, up from ~25% — session 50's wanted
"inflow shift": the budget is about which fights to take, not walking.

## Checkpoint 2 — the pricing instrument (findings that revise R2)

Built as `src/engine/pricing.ts` (unit-tested) plus
`scripts/price-check.ts` (the CLI).

- **Seat swapping is mandatory, not a refinement.** `playCombat` is not
  seat-symmetric (the defender wins at the hand-20 deadline; side 0 deals
  first). Measured in a pure mirror at skill 0.85: **side 0 wins 65.5%**.
  Every seed is played with both loadouts in both seats; identical
  loadouts then score *exactly* 0.5.
- **R2's planned instrument check was a tautology.** "Credit c prices at
  ~c" with c on the price grid compares identical loadouts at Δ = c,
  which tie by construction. Credit is linear by construction, so no
  Credit-only check can test measurement *validity*. Replaced by:
  a **wiring check** (identical loadouts tie exactly), a **resolution
  check** (c deliberately *off* the grid, 0.75× and 1.25× the host), and —
  moved to checkpoint 3 — a **validity check**: price two different verbs
  separately and together; if prices mean anything they should roughly
  add.
- **Prices are a staircase.** A pure-Credit race is decided by how many
  turns each side needs to reach its threshold, `ceil(50 / credit per
  turn)` (before escalation). When both need the same number, the fight
  plays out exactly like a mirror — exactly 0.5, every seed. So the win
  rate against Δ has flat steps at exactly 0.5, and any Δ inside one is
  equally correct. The solver reports the **midpoint of the step**, and
  the interval is widened to the **grid bracket** (last grid Δ above 0.5,
  first below), because inside a step the outcome is deterministic and a
  binomial SE is overconfident.
- **Consequence for step 3**: content prices finer than one turn-to-win
  step don't change outcomes. Around a host of Credit 2 a step is ~0.25
  Credit wide, wider at larger totals. Authoring should think in
  turns-to-win, not decimals.
- **Cost**: ~17 ms per fight at skill 0.85 (the Cribbage AI dominates),
  so prices use a fixed Δ grid on shared seeds, not bisection — about a
  minute per price at 200 seeds.
- **Two-pass pricing** (coarse grid finds the bracket, a fine grid inside
  it pins the price), because the coarse grid alone left intervals as wide
  as its spacing.
- **Resolution check results** (skill 0.85, 200 seeds × 2 seats, refined):
  off-grid Credit 0.75 → 0.75 [0.70, 0.80] and 1.25 → 1.20 [1.10, 1.30]
  at host 1; 1.5 → 1.56 [1.40, 1.81] and 2.5 → 2.30 [2.00, 2.60] at host
  2; 3 → 2.60 [2.00, 3.20] and 5 → 5.00 [4.00, 6.00] at host 4. All pass.
  At host 4 the curve is *exactly* 50% from Δ 4.4 to 5.6: one turn-to-win
  step ~1.2 Credit wide, which no number of seeds narrows — a property of
  the game, not the instrument. **Precise prices come from small hosts
  (1–2);** the host-4 runs show how coarse the game itself is at higher
  totals.
- **The skill spot-check (R1's caveat) moves to checkpoint 3.** Credit
  against Credit is skill-symmetric by construction, so it can't show a
  skill effect; verbs that depend on scoring (Tempo, Disrupt) can.

## Checkpoint 3 — verb prices

Raw output: `docs/calibration/step2-cp3-verb-prices.txt`. Skill 0.85,
200 seeds × 2 seats per point, two-pass refined, hosts Credit 1 / 2 / 4.
Six batches: (A) Suppress 2, Ward 2, Suppress+Ward; (B) Empower 2,
Credit-from-opponent 2; (C) self-haste ¼ turn with and without its
15-point cooldown, Slow ¼ turn; (D) the three Disrupts; (E) with a Ward-2
piece on both hosts: Piercing 2, Credit-from-Ward 2, Credit 2 control;
(F) skill 0.5 at host 2: Slow, forced discard, Suppress. Harness changes:
`placement: 'before'` (Empower boosts only pieces below it) and
multi-piece additions with Credit-0 padding.

### Prices, in Credit per turn

| addition | host 1 | host 2 | host 4 | reading |
|---|---|---|---|---|
| Suppress 2 | 1.90 | 1.91 | 1.80 | ≈ 0.95 per point |
| Ward 2 | 1.93 | 1.94 | 1.84 | ≈ 0.95 per point, while the opponent has credit to absorb |
| **Suppress 2 + Ward 2** | **3.82** | **3.85** | **3.62** | **sum of parts: 3.83 / 3.85 / 3.64 — prices add** |
| Empower 2 (one piece below) | 2.09 | 2.01 | 1.90 | ≈ 1 per point *per boosted piece* |
| Credit 2 from opponent | 3.73 | 3.76 | 3.51 | ≈ 1.85 per point — Credit + Suppress in one |
| Haste ¼ turn | 0.36 | 0.74 | 1.30 | ≈ ⅓ × own per-turn output |
| Haste ¼ turn + 15-pt cooldown | 0.19 | 0.36 | 0.50 | about half the bare verb |
| Slow ¼ turn | 0.28 | 0.60 | 1.03 | ≈ 0.27 × opponent per-turn output |
| Disrupt: reveal hand | 0.09 | 0.19 | 0.16 | small |
| Disrupt: force discard | 0.29 | 0.63 | 1.04 | ≈ 0.27 × opponent per-turn output |
| Disrupt: reveal crib (as first built) | 0.00 | 0.00 | 0.00 | dead — see below |
| **Disrupt: reveal crib (intended timing)** | **0.10** | **0.18** | **0.14** | **≈ reveal hand** |
| *with Ward 2 on both hosts:* | | | | |
| Credit 2 (control) | 2.02 | 2.08 | 2.13 | the instrument reads true with Wards in play |
| Piercing Credit 2 | 2.95 | 2.21 | 2.13 | Credit + the Ward it bypasses; matters when Ward is large relative to the hits |
| Credit 2 from own Ward | 1.12 | 0.29 | 0.18 | only worth the Ward that would otherwise be wasted |

### What the prices say

- **The validity check passes.** Suppress and Ward priced together come
  out at the sum of their separate prices, within 0.02, at all three
  hosts. Prices from this instrument are additive, which is what makes a
  per-verb rule usable for authoring.
- **The points verbs sit near 1:1 with Credit** — Suppress and Ward at
  ~0.95 per point (defense and offense are nearly interchangeable in a
  symmetric race), Empower at ~1 per point per boosted piece.
- **Tempo and Disrupt scale with the loadout they act on.** Haste a turn
  per fire is worth about a/(1−a) × the caster's own per-turn output (the
  ⅓ at a = ¼ is exactly that: the haste piece also fires on the turns it
  buys); Slow and forced discards are worth ~0.27 × the opponent's. So
  they're cheap in a thin early kit and strong in a full one —
  situational by nature, which step 3 must price against expected
  loadout size, not a flat number.
- **The 15-point cooldown halves self-haste.** Real content carries it,
  so content should be priced on the `-cd` row.
- **Conversion is two very different things** (the user's Honeypot watch
  items):
  - **Credit from the opponent is the strongest verb per point** (~1.85×
    Credit), and it already bypasses Ward. If anything is overpowered,
    it's this.
  - **Credit from your own Ward is worth only the Ward that would be
    wasted.** Spending Ward 1:1 gives up Ward's defensive value, so
    against an opponent who hits hard enough to use the Ward, converting
    it gains almost nothing. Honeypot's conversion
    only pays when its Ward outruns what the opponent can throw at it.
- **Skill spot-check (host 2, skill 0.5 vs 0.85):** Suppress 1.88 vs 1.91
  and Slow 0.55 vs 0.60 barely move; **forced discard halves (0.33 vs
  0.63)**. A worse player wastes less of a hand you've already spoiled,
  so Disrupt's worth depends on the opponent's skill.
- **Reveal Crib was dead as built, and is now fixed to its intent.**
  As first measured its Δ = 0 point was *exactly* 50% at every host —
  no outcome changed on any seed. It revealed the crib after both sides
  had discarded, for pegging, and nothing in `ai.ts` read it (the
  session-40 bug class). **The user's intent was different**: the crib
  is worth knowing *while choosing your own discards*, when seeing the
  two cards the opponent has put in lets you build your own crib or
  starve theirs. Rebuilt that way: the opponent discards first, and the
  revealing side's discard decision receives the two actual cards
  (`DiscardContext.knownCribCards` — what a UI shows a human player at
  discard time, too). The discard AI already scored the crib exactly
  when its other half was known; it now uses the known cards ahead of
  any prediction. Re-priced: **0.10 / 0.18 / 0.14**, on a par with
  Reveal Hand.

## Checkpoint 4 — beta frequency table

Raw output: `docs/calibration/step2-cp4-beta-frequency.txt`.
`scripts/beta-frequency.ts`, 400 seeds × 2 seats per configuration,
Credit-host mirror at skill 0.85 unless noted. Charges per turn of the
beta's owner, measured with **probe pieces** (Credit-0 alpha, inert
uncapped beta) that report their raw charge count on every turn via a
new `FireEvent.charges` field and change nothing about the fight.
Ward-dependent probes (`absorbed`, `wardAbove`) are read from a run where
the probe side carries Ward 2; everything else from a run without it,
because a Ward 2 against a Credit-2 host absorbs the opponent completely
and makes every opponent-gauge probe meaningless.

### Per turn of the owner (host Credit 2, skill 0.85)

| source | mean | P(≥1) | P(≥2) | P(≥3) | P(≥4) |
|---|---|---|---|---|---|
| fifteen | 2.45 | 0.91 | 0.76 | 0.49 | 0.23 |
| pair | 1.24 | 0.80 | 0.34 | 0.09 | 0.01 |
| go | 0.84 | 0.64 | 0.19 | 0.02 | 0.00 |
| suit tally (own suit) | 0.92 | 0.57 | 0.25 | 0.07 | 0.03 |
| run | 0.60 | 0.52 | 0.08 | 0.01 | 0.00 |
| run ≥ 4 | 0.30 | 0.28 | 0.01 | | |
| thirty-one | 0.16 | 0.15 | 0.01 | | |
| pair royal (≥ 6) | 0.11 | 0.11 | 0.00 | | |
| his nobs | 0.10 | 0.10 | 0.00 | | |
| flush | 0.06 | 0.06 | 0.00 | | |
| fifteen, *opponent's* | 2.39 | 0.62 | 0.51 | 0.41 | 0.32 |
| pair, *opponent's* | 1.23 | 0.62 | 0.36 | 0.17 | 0.06 |
| points (own) | 12.07 | | | | |
| Ward absorbed (Ward 2 vs Credit-2 host) | 1.64 | 0.58 | 0.58 | 0.22 | 0.22 |

| condition | fraction of turns true |
|---|---|
| dealer | 0.62 |
| non-dealer | 0.38 |
| own gauge > ½ | 0.26 (host 4: 0.45) |
| own gauge < ¼ | 0.40 (host 4: 0.27) |
| opponent gauge > ½ | 0.24 (host 4: 0.40) |
| opponent gauge < ¼ | 0.44 (host 4: 0.32) |
| Ward above 2 / 4 / 8 (Ward 2 piece) | 0.64 / 0.30 / 0.04 |

### What the table says

- **Card rates per turn are a property of Cribbage, not of the loadout.**
  A turn is bought by ~12 of your own points, so the cards scored in
  between are roughly fixed: host 2 and host 4 give identical card rows,
  and skill 0.5 moves them only slightly (fifteens 2.57 vs 2.45) —
  though at skill 0.5 a side gets fewer turns per hand (0.88 vs 1.06).
  So a card beta's per-turn charge rate is stable enough to price as a
  constant. That is the good news for R3's formula.
- **State conditions are situational, as expected.** Gauge-fraction
  conditions move a lot with fight shape (own gauge > ½: 26% of turns at
  host 2, 45% at host 4), so they need pricing against expected fight
  length, like Tempo and Disrupt.
- **Turns cluster on dealer hands: 62% dealer, 38% non-dealer.** The
  crib's extra points buy the dealer more turns. A "dealer" beta applies
  far more often than "non-dealer", which an author would naively price
  as equal.
- **The opponent's scoring arrives in bigger lumps between your turns**
  (opponent fifteens: P(≥4) 0.32 vs 0.23 for your own), since the
  opponent can take several turns' worth of scoring between two of
  yours. Graded betas watching the opponent should take lower caps or be
  priced on their lumpier distribution.
- **The rare categories are rare per turn:** flush 0.06, nobs 0.10,
  pair royal 0.11, thirty-one 0.16 — once every 6–18 turns. Under D11
  they no longer gate firing, so this is a price input, not a dead-piece
  risk.
- **The comparison with session 50's per-hand occurrence rates is not
  like for like** (different measurement and skill levels), so it isn't
  used as a cross-check.

## Checkpoint 5 — beta pricing

Built `src/engine/beta-pricing.ts` — R3's formula, and step 3's
authoring tool: **piece price = alpha price + expected beta scale per
turn × the value of one application**, in Credit per turn. Expected
scale comes from checkpoint 4's distributions (generated into
`beta-frequency-data.ts`): exact closed forms for graded-on-cards
(Σ P(N ≥ k)) and immediate (mean / at), a deterministic simulation for
the shapes that carry charges across turns (stepped, progress-banked
graded). It **returns null** for what the measurements can't support —
unmeasured sources, sequence betas, immediate state betas, and effects
whose worth depends on the loadout (Tempo, Disrupt, Empower, credit spent
from your own Ward).

Validated by `scripts/beta-validate.ts` against direct mirror-duel prices
(host Credit 2, skill 0.85, 200 seeds × 2 seats). Raw output:
`docs/calibration/step2-cp5-beta-validation.txt`.

| sample (alpha Credit 1 unless noted) | formula | measured | gap |
|---|---|---|---|
| graded fifteen, cap 3, +1 | 3.16 | 2.99 | −0.18 |
| graded opponent's fifteen, cap 3, +1 | 2.54 | 2.56 | +0.02 |
| graded suit tally, cap 3, +1 | 1.89 | 1.87 | −0.02 |
| graded flush, cap 1, +3 (rare) | 1.17 | 1.24 | +0.07 |
| graded pair royal, cap 1, +3 (rare) | 1.33 | 1.41 | +0.08 |
| graded go, cap 2, steal 1 | 2.52 | 2.51 | −0.01 |
| graded flush, cap 3, +1 (the Charge receiver) | 1.06 | 1.11 | +0.05 |
| stepped pair at 2, +2 | 2.01 | 2.12 | +0.11 |
| stepped run at 1, Suppress 2 | 1.98 | 1.98 | 0.00 |
| stepped points/10 at 3, Suppress 2 | 1.72 | 1.80 | +0.08 |
| whileTrue dealer, +2 | 2.24 | 2.17 | −0.07 |
| whileTrue non-dealer, +2 | 1.76 | 1.86 | +0.09 |
| Ward 2 + absorbed/2 graded cap 3, Credit 1 | 2.76 | 2.77 | +0.01 |
| immediate pair at 2, Credit 3 | 2.86 | 2.92 | +0.06 |
| **immediate run at 1, +1 (extra fire)** | **2.21** | **2.51** | **+0.30** |
| **whileTrue opponent gauge > ½, Suppress 2** | **1.46** | **1.92** | **+0.46** |
| **Ward 2 + whileTrue Ward > 4, +2** | **2.53** | **1.93** | **−0.60** |
| charger (Charge 1 → next) + receiver | — | 2.12 | Charge ≈ 1.01 |

### What the validation says

- **The formula holds wherever an effect is worth the same every time
  it applies** — card sources (own and opponent's), progress banks,
  dealer/non-dealer, steal. Across those 14 samples the mean gap is
  **0.06 Credit (~3%)**, and several "misses" are inside one
  turn-to-win step (checkpoint 2). Opponent-watching lumpiness, flagged
  in checkpoint 4, turned out not to matter.
- **It fails when the condition is correlated with the effect's worth.**
  Suppress while the opponent is ahead is worth nearly as much as
  unconditional Suppress (1.92 vs 1.91 for Suppress 2 alone): pushing
  back a leader is what Suppress is for, so concentrating it there loses
  almost nothing. More Ward while Ward is already high is worth ~0: it
  stacks on Ward that would go unused anyway. **Authoring rule: betas on
  gauge or Ward conditions are priced by direct duel, not the formula.**
- **Immediate "extra fire" betas carry a timing premium** (+0.30, about
  +25% on the beta): credit landing mid-hand reaches the threshold
  sooner. An immediate beta with a different effect showed only +2%, so
  this is one data point, not yet a correction factor — **flagged for
  step 3 to price immediate-enhance pieces directly** until more samples
  exist.
- **Charge is priced: one charge per turn ≈ 1.01 Credit** (2.12 with the
  charger, 1.11 without), matching the prediction — a charge is worth one
  extra application of whatever beta it feeds, while that beta is below
  its cap.
- **Burstiness (R4) is answered**: card occurrences arrive in clusters,
  but the formula's distributions already capture that per turn, and the
  card-sourced samples hold. The misses come from correlation and
  timing, not clustering.

## Open

None blocking step 2. Left for tuning or later: D7's Safehouse count and
placement, the Safehouse rename (Cold Storage / Sandbox / Air-Gapped
Host), regular/elite win-rate targets (after step 3, per R1).
