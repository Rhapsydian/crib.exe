# Calibration output

Raw output from the larger measurement passes, kept so the numbers in the
design records can be checked. Each `.txt` file opens with `#` lines
naming the pass, the script and the sample size; the three `.jsonl` files
are the machine-readable data behind the `.txt` file listed beside them.
The scripts are described in [`../tools.md`](../tools.md).

**Read these as history.** Each file is the state at the time it was
measured, and the game has changed since: "final" means final for that
pass. Two scripts named here no longer exist: `trace-price.ts` (it priced Trace,
which was removed in session 58; full-run outcomes moved to
`run-outcomes.ts`) and the skeleton content the early passes ran against.

The names follow the pass they belong to: `step2-` and `step3-` are the
archetype redesign's recalibration and authoring steps (sessions 52-55),
`balance-` the class balance pass (session 56), `m3-` and `m4-` the
playable milestones (session 58), and `s60-` session 60.

## Recalibration: pricing (step 2, sessions 52-53)

Record: [`docs/archive/recalibration-design.md`](../archive/recalibration-design.md).

| File | Script | What it measured |
|---|---|---|
| `step2-cp3-verb-prices.txt` | `price-check.ts` | Each verb's price in Credit per turn |
| `step2-cp4-beta-frequency.txt` (+ `step2-cp4-freq-plain.jsonl`, `step2-cp4-freq-ward.jsonl`) | `beta-frequency.ts` | How often each Hook source charges per turn, without and with Ward |
| `step2-cp5-beta-validation.txt` (+ `step2-cp5-beta-validation.jsonl`) | `beta-validate.ts` | The Hook pricing formula against direct duels |
| `step2-cp6-trace-price.txt` | `trace-price.ts` (retired) | What one Trace cost in full runs |
| `step2-cp6b-skill-retention.txt` | `skill-check.ts` | Skill retention in isolated mirrors |
| `step2-cp6b-overclock-ab.txt` | `overclock-ab.ts` | Authoring rules for Overclock's retention, A/B |
| `step2-cp6b-big-hand.txt` | `overclock-ab.ts` | Variant D: big-hand Hooks |

## Authoring (step 3, sessions 54-55)

Record: [`docs/archive/authoring-design.md`](../archive/authoring-design.md).

| File | Script | What it measured |
|---|---|---|
| `step3-cp1-exploit.txt` … `step3-cp4-honeypot.txt` | `archetype-check.ts` | Every subroutine of one archetype priced against its rarity band |
| `step3-classes-bridges.txt` | `class-check.ts` | Each class Mod priced against its budget |
| `step3-starting-loadouts.txt` | `class-check.ts` | Class Mods in the authored starting loadouts |
| `step3-wired-run-level.txt` | `trace-price.ts` (retired) | Full runs with the authored pool, before authored enemies |
| `step3-player-power.txt` | `player-power.ts` | The player's power by layer: the basis of enemy budgets |
| `step3-regulars.txt`, `step3-elites.txt` | `roster-check.ts` | Enemies' kit power against their budgets |
| `step3-gatekeepers-stage1.txt` | `roster-check.ts` | Gatekeepers' kit power |
| `step3-gatekeepers-stage2.txt` | `gatekeeper-check.ts` | Gatekeeper pass rates against real accumulated states |
| `step3-final-run-level.txt` | `trace-price.ts` (retired) | Full runs with everything authored |

## The class balance pass (session 56)

Record: [`docs/archive/balance-design.md`](../archive/balance-design.md).

| File | Script | What it measured |
|---|---|---|
| `balance-gatekeepers-b4.txt` | `gatekeeper-check.ts` | Gatekeepers re-tuned to a lowered curve (B4) |
| `balance-b5-state.txt` | `trace-price.ts` (retired), `skill-check.ts` | The state after B5: the noise premium for Fuzzer and Jackpot |
| `balance-fuzzer-trim.txt` | `trace-price.ts` (retired), `skill-check.ts` | After the Fuzzer trim |
| `balance-final.txt` | `gatekeeper-check.ts` | Gatekeepers half a step lower (B7) |

## Making it playable (sessions 57-60)

Record: [`docs/archive/playable-design.md`](../archive/playable-design.md).

| File | Script | What it measured |
|---|---|---|
| `live-resolution-recheck.txt` | `gatekeeper-check.ts`, `trace-price.ts` (retired) | Balance re-checked once fights resolved live (P8) |
| `m3-two-lever.txt` | `trace-price.ts` (retired), `gatekeeper-check.ts` | The new maps' Heat allowances and gatekeeper scales |
| `m3-trace-removal.txt` | `run-outcomes.ts`, `feed-price.ts`, `roster-check.ts`, `gatekeeper-check.ts` | Runs, feed prices and enemies after Trace was removed |
| `m3-static-shield-retune.txt` | `gatekeeper-check.ts`, `run-outcomes.ts` | Gatekeepers re-tuned after Static Shield was set aside |
| `m4-cribbage-difficulty.txt` | `cribbage-difficulty.ts` | Plain Cribbage's difficulty levels |
| `m4-crib-table-retune.txt` | `cribbage-difficulty.ts`, `gatekeeper-check.ts`, `run-outcomes.ts` | A retune after the AI's exact crib table |
| `s60-class-mod-retune.txt` | `gatekeeper-check.ts`, `run-outcomes.ts` | The class Mod redesign and a gatekeeper retune |

Later passes (sessions 61-73) recorded their numbers directly in their
design records ([`docs/design/`](../design/)) and session logs rather than
as files here.
