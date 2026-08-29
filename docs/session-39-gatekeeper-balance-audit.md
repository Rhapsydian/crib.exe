# Gatekeeper balance audit — skill-level sensitivity and per-gatekeeper ablation

Session 39. Two empirical questions, both answered with the same
methodology: real `playRun()`s (`opportunisticTraversal`, default
acquisition/Shop/Merge strategies), read through `scripts/layer-funnel.ts`
(cumulative "made it through layer N," not an isolated re-fight — see that
script's own doc comment for why the distinction matters). 300 seeds per
class per configuration, same seed range (0-299) reused across every
configuration — a paired design, not independent samples: for any seed
where an ablated gatekeeper was never going to be drawn anyway, that
seed's outcome is identical in both the baseline and the ablated run, so
a genuine effect isn't diluted by irrelevant seed-to-seed noise the way an
independently-reseeded comparison would be.

Both questions were run at what this session established as the
calibrated player-skill default: `playerSkill=0.85`, anchored to the
hardest real enemy's own skill ceiling (`enemySkill()` tops out at 0.84
for a layer-4 gatekeeper) — see `scripts/cribbage-skill-matrix.ts` and
this session's own log for how that number was derived.

**Sample size note**: 300 seeds/config (half this project's usual 600) to
keep total runtime tractable across 15 configurations. At the win rates
observed here (roughly 15-40%), the naive standard error is ~2.5
percentage points; the paired design tightens that further for anything
not touching the ablated gatekeeper's own layer. Treat deltas under ~3pp
as noise-adjacent, not as confirmed effects.

## Table 1 — full-run funnel at three player-skill levels

Cumulative "made it through layer N," `victory` = cleared layer 4 = a
full-run win. No gatekeeper ablation in this table.

### Layer 1

| class | 0.5 | 0.85 | 1.0 |
|---|---|---|---|
| breacher | 70.7% | 76.0% | 78.3% |
| blackhat | 74.3% | 79.7% | 83.7% |
| saboteur | 61.0% | 70.7% | 69.0% |
| operator | 70.0% | 83.3% | 78.7% |
| warden | 58.3% | 65.3% | 61.7% |
| ghost | 54.3% | 63.3% | 66.0% |

### Layer 2

| class | 0.5 | 0.85 | 1.0 |
|---|---|---|---|
| breacher | 39.7% | 51.7% | 59.3% |
| blackhat | 48.3% | 60.7% | 62.3% |
| saboteur | 44.3% | 56.3% | 55.3% |
| operator | 36.3% | 55.7% | 54.7% |
| warden | 40.0% | 52.7% | 49.7% |
| ghost | 31.7% | 44.7% | 45.3% |

### Layer 3

| class | 0.5 | 0.85 | 1.0 |
|---|---|---|---|
| breacher | 24.7% | 39.3% | 43.7% |
| blackhat | 30.0% | 41.0% | 44.7% |
| saboteur | 34.7% | 49.0% | 49.3% |
| operator | 21.0% | 37.3% | 37.3% |
| warden | 28.3% | 46.3% | 42.7% |
| ghost | 20.3% | 31.3% | 34.3% |

### Layer 4 (victory)

| class | 0.5 | 0.85 | 1.0 |
|---|---|---|---|
| breacher | 14.7% | 25.7% | 29.7% |
| blackhat | 14.7% | 22.7% | 21.0% |
| saboteur | 20.3% | 29.3% | 29.3% |
| operator | 10.3% | 21.0% | 20.7% |
| warden | 15.3% | 29.7% | 26.0% |
| ghost | 13.7% | 26.3% | 27.0% |

## Table 2 — gatekeeper ablation (skill=0.85), full-run victory rate delta from baseline

Baseline (no ablation, skill=0.85) victory rate per class:
breacher 25.7%, blackhat 22.7%, saboteur 29.3%, operator 21.0%, warden
29.7%, ghost 26.3% (avg **25.78%**).

Each row removes exactly one gatekeeper from selection at every layer
(that layer draws from its remaining 2). A positive delta means the
ablated gatekeeper was *harder* than its layer-mates (removing it made
things easier); negative means it was *easier* (removing it left only
harder options).

| gatekeeper | layer | breacher | blackhat | saboteur | operator | warden | ghost | **avg delta** |
|---|---|---|---|---|---|---|---|---|
| **firewall-prime** | 1 | +2.3 | +3.3 | +6.4 | -0.7 | +8.6 | +11.4 | **+5.22** |
| **null-session** | 4 | +2.6 | +5.3 | +11.0 | +1.0 | +9.3 | +2.0 | **+5.20** |
| **incident-response** | 2 | +3.0 | +1.6 | +4.7 | +6.0 | +2.6 | +6.7 | **+4.10** |
| adaptive-threat | 3 | +0.6 | +1.3 | +1.0 | +2.0 | 0.0 | +3.4 | +1.38 |
| total-compromise | 3 | +0.3 | -0.4 | -0.3 | -0.3 | 0.0 | -2.0 | -0.45 |
| ghost-in-the-machine | 4 | -1.0 | -1.0 | -2.3 | +4.3 | -2.4 | -0.6 | -0.50 |
| silent-corruption | 3 | +0.3 | +1.0 | -1.0 | -1.3 | -0.4 | -4.3 | -0.95 |
| zero-sum | 2 | -2.0 | -0.7 | -2.3 | -3.0 | -2.4 | -4.0 | **-2.40** |
| the-concierge | 1 | -1.4 | -2.0 | -3.6 | -0.7 | -3.7 | -2.6 | **-2.33** |
| the-quarantine-ward | 2 | -4.7 | -0.4 | -2.6 | -4.0 | -2.7 | -4.0 | **-3.07** |
| ghost-process | 1 | -2.4 | -3.4 | -1.6 | +0.7 | -7.0 | -8.6 | **-3.71** |
| kernel-panic | 4 | -4.4 | -4.7 | -9.3 | -5.7 | -7.7 | -2.0 | **-5.63** |

## Insights

1. **The skill dial's effect on real run outcomes flattens sharply above
   0.85, confirming the pure-Cribbage calibration finding independently.**
   0.5→0.85 is a large, universal jump at every layer for every class.
   0.85→1.0 is flat-to-negative for half the roster (blackhat, operator,
   warden all *drop* slightly at victory rate, likely noise at this
   sample size, but certainly not a further gain) and only modestly
   positive for the other half. This is the same shape
   `cribbage-skill-matrix.ts`'s calibration grid already showed in pure
   Cribbage terms (0.90 vs. 1.00 nearly a coin flip) — two independent
   measurements, one at the card-game level and one at the full-run
   level, agreeing that 0.85 captures nearly all of the real
   skill-to-outcome curve. Reinforces 0.85 as a well-chosen default
   rather than an arbitrary one.

2. **Layer 3's gatekeeper trio is the *best-balanced* layer in the
   roster — directly contradicting this project's own standing
   assumption.** Session 39 Part 3's deferred list (and this session's
   own README, until this pass) carried "layer 3's own weaker gatekeeper
   trio" as a known, unaddressed issue. The ablation data says otherwise:
   Total Compromise (-0.45), Adaptive Threat (+1.39), and Silent
   Corruption (-0.95) have by far the tightest spread of any layer (2.33
   points, min to max), all within noise-adjacent range of zero. That
   assumption should be retired, not carried forward into a future
   session's task list.

3. **Layer 4 has the widest internal spread of any layer (10.83
   points) — a real, previously-unflagged imbalance.** Null Session
   (+5.20) is a genuine hard outlier, on the same order as Firewall
   Prime; Kernel Panic (-5.63) is the single largest ablation effect in
   either direction, roughly twice the magnitude of any other "too easy"
   finding. Ghost in the Machine sits near-neutral (-0.50). This layer,
   not layer 3, is where the roster's real internal imbalance lives.

4. **Firewall Prime is still a confirmed outlier even after this
   session's ground-up redesign (Zero Trust decay + Redundant Backup
   retune).** +5.22 average delta, the second-largest in the roster,
   with Warden (+8.6) and Ghost (+11.4) hit hardest specifically — both
   classes already known from this session's earlier work to struggle
   against it. The redesign moved Warden's isolated win rate from 0.0%
   to 11.8% (a real, large improvement) but did not bring Firewall Prime
   down to parity with its own layer-mates (The Concierge -2.33,
   Ghost Process -3.71). Layer 1 is not "fixed," it's improved.

5. **Layer 1's other surprise: Ghost Process is the layer's easy
   outlier, not a neutral third option.** -3.71 average delta, driven
   almost entirely by warden (-7.0) and ghost (-8.6) — both classes find
   it dramatically easier than The Concierge or Firewall Prime. Combined
   with Firewall Prime's own +5.22, layer 1 has the second-widest spread
   in the roster (8.93 points) despite only one of its three gatekeepers
   having had any balance attention this session.

6. **Layer 2 shows the same hard/easy split pattern as layer 1 and
   layer 4**: Incident Response (+4.10) is a real hard outlier — notably,
   *harder* on average than Firewall Prime's own layer-mates, though not
   as extreme as Firewall Prime itself — while The Quarantine Ward
   (-3.06) and Zero-Sum (-2.40) sit on the easy side together. No single
   gatekeeper in layer 2 is close to neutral.

7. **Net picture**: 3 of the roster's 12 gatekeepers (Firewall Prime,
   Null Session, Incident Response) are confirmed hard outliers; 3
   (Kernel Panic, Ghost Process, The Quarantine Ward) are confirmed easy
   outliers; layer 3's trio plus Zero-Sum, The Concierge, and Ghost in
   the Machine cluster much closer to neutral. This is a materially
   different picture from "one gatekeeper (Firewall Prime) and one weak
   layer (3) need work" — it's closer to "two gatekeepers per extreme,
   spread across layers 1/2/4, and layer 3 is fine as-is."

## Suggested next steps (not yet actioned)

- Retune layer 4's spread first — it's the widest and Kernel Panic's
  -5.63 is the single largest effect measured. Null Session needs
  softening, Kernel Panic needs strengthening, or both.
- Layer 2's Incident Response vs. Quarantine Ward/Zero-Sum gap is the
  next-clearest target.
- Layer 1: Ghost Process could stand to be strengthened rather than (or
  in addition to) further softening Firewall Prime, to close the gap
  from the easy side too.
- Leave layer 3 alone — retire the "weak trio" assumption from
  BACKLOG.md/README.md the next time either gets a pass.
- None of this has been implemented; this document is the findings pass
  only, per the user's explicit request to see the data and a synthesis
  before any tuning decisions.
