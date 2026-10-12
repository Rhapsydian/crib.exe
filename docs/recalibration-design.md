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

## Open

None blocking step 2. Left for tuning or later: D7's Safehouse count and
placement, the Safehouse rename (Cold Storage / Sandbox / Air-Gapped
Host), regular/elite win-rate targets (after step 3, per R1).
