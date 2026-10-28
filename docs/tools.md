# Balance and diagnostic tools

Balance in crib.exe is measured, not guessed at. The engine runs headless
(`DESIGN.md` → Architecture), so a simulated player can play thousands of
fights or whole runs in minutes, and every balance change in the project
was checked this way before and after. These scripts are the measuring
instruments. `npm run check` type-checks them (`tsconfig.scripts.json`)
because a silently broken one once corrupted a balance pass.

Every script has a header comment saying what it measures, which design
record it served, and how to run it. Raw output from the larger passes is
kept in [`calibration/`](calibration/README.md).

## The sweep harness

```bash
npm run sweep -- run --seeds=150 --acquisition=synergy --traversal=opportunistic
```

Full-run outcomes per class. `--traversal` picks the movement profile
(`beeline` / `explore` / `opportunistic`); `--acquisition` picks the
decision-making profile (`floor` is a deliberately legal-but-not-good
baseline, `synergy` the real heuristics). The two are independent dials,
so a before/after can isolate which half moved a number. `--out` writes
one JSONL line per run, including its final loadout, so "how many winning
runs included X" is a query rather than a new script.

```bash
npm run sweep -- enemy --enemy=firewall-prime --vs=exploit-daemon
```

One named enemy against one class's starting kit.

## Scripts

Run any of them with `npx tsx scripts/<name>.ts`; flags are in each
header.

**Runs and the map**

| Script | What it answers |
|---|---|
| `run-outcomes.ts` | Full-run outcomes by class (victory, Heat endings, Quarantine) and where each run's Heat came from |
| `run-endings.ts` | How runs end: victory, a lost gatekeeper, no route, Heat; lost fights a run |
| `layer-funnel.ts` | Where runs die: cumulative "made it through layer N" |
| `layer-explore.ts` | Per layer: share of nodes visited, fights, peak Heat against the allowance |
| `heat-sources.ts` | Where a run's Heat comes from |
| `mod-supply.ts` | Mods by a run's end (all runs, winning runs), by source |
| `merge-frequency.ts` | How far the simulated player Refactors: subroutines by rank at a run's end |
| `evasion-check.ts` | Trace evasion escape odds by head start and skill, and the head starts real runs produce |
| `noroute-tail.ts` | A debugging aid: the last moves of runs that end with no route left |

**Fights and enemies**

| Script | What it answers |
|---|---|
| `enemy-rates.ts` | Player win rate and hands a fight by tier and layer (and by enemy), from full runs |
| `fight-calibrate.ts` | Captures the player at every fight of a tier in full runs and replays those fights under trial settings |
| `gatekeeper-check.ts` | Each gatekeeper against realistic accumulated player state, not a bare starting kit |
| `enemy-check.ts` | Per-enemy difficulty against accumulated state |
| `build-check.ts` | A real build, by layer, against that layer's gatekeepers |
| `player-power.ts` | The player's priced power at each layer of real runs: the basis of the enemy budgets |
| `roster-check.ts` | Each enemy's kit power against its budget by layer, plus its Heat a fight |
| `enemy-parity.ts` | An enemy's Containment fill against six class loadouts, for effects kit power can't see |

**Pricing content**

| Script | What it answers |
|---|---|
| `price-check.ts` | What one verb is worth in Credit per turn: seat-swapped mirror duels (`src/engine/pricing.ts`) |
| `beta-frequency.ts` | How often each Hook source charges per turn |
| `beta-validate.ts` | The Hook pricing formula checked against duels |
| `feed-price.ts` | A noisy subroutine's feed priced against its rarity band |
| `archetype-check.ts` | One archetype's checks: every subroutine against its rarity band, the credit rule, skill retention |
| `archetype-list.ts` | Every subroutine of one archetype with its rarity and card text |
| `subroutine-check.ts` | Each subroutine in real loadouts against a placeholder, as a multiple of its rarity's average |
| `mod-check.ts` | Each Mod with and without it: against elites, in full runs, or each class with its upgrade |
| `burner-check.ts` | Each Burner with and without it: Containment prevented, or Heat saved in full runs |
| `class-check.ts` | Each class Mod priced against its budget, in its starting loadout and a late kit |
| `overclock-ab.ts` | An A/B of authoring rules for Overclock's skill retention (a pricing-era experiment) |
| `skill-check.ts` | Skill retention: whether Cribbage skill still decides fights with loadouts installed |

**Cribbage and the AI**

| Script | What it answers |
|---|---|
| `occurrence-frequency.ts` | How often real Cribbage scores each category, outside the roguelite layer |
| `cribbage-skill-matrix.ts` | What a "player skill" value means, as a skill-against-skill win-rate grid |
| `cribbage-difficulty.ts` | Plain Cribbage's difficulty levels against reference players and each other |
| `crib-table.ts` | **A generator:** writes `src/engine/crib-table.ts`, the average crib each two-card throw makes |

**Meta-progression, Daily Runs and the tutorial**

| Script | What it answers |
|---|---|
| `meta-pacing.ts` | What upgrades do to runs, and how fast Rep buys them over simulated careers |
| `daily-check.ts` | How big each part of the daily score runs, and what each daily Mod does |
| `tutorial-seed.ts` | The tutorial's seed: its first hand winnable at every skill |
| `tutorial-gatekeeper.ts` | The tutorial gatekeeper's pass rate |

**Infrastructure**

| Script | What it is |
|---|---|
| `sweep.ts` | The sweep harness above (`npm run sweep`) |
| `synthetic-gatekeepers.ts` | Shared parsing for the `--syntheticGatekeepers` flag (below) |
| `text-dump.ts` | Every player-facing rules text as Markdown, for a wording review |
| `engine-bench.ts` | Simulation speed in fights a second: run before and after any engine change |

## Holding the gatekeepers still

`sweep.ts` and `gatekeeper-check.ts` take `--syntheticGatekeepers=<4
slots>`, one per layer, which replaces a layer's gatekeeper fight with a
weighted coin, or pins which gatekeeper is drawn.

```bash
npm run sweep -- run --seeds=300 --syntheticGatekeepers=1,1,1,1
npm run sweep -- run --seeds=300 --syntheticGatekeepers=0.78,0.72,0.66,0.60
npx tsx scripts/gatekeeper-check.ts --syntheticGatekeepers=1,pin:<gatekeeper-id>,1,1
```

A lost gatekeeper fight ends the run, so every layer's population is
strictly "whoever beat the previous layer": any per-layer or per-class
number is otherwise measured on a cohort pre-selected by the very trait
being measured. `1,1,1,1` removes that filter; a fixed curve holds the
roster still while something else is read; `pin:` measures one
gatekeeper against a controlled background.

## Four conventions to know before reading any number

1. **Player skill and enemy skill are separate dials.** The diagnostics
   default to `playerSkill=0.85`, near the strongest enemy's own skill,
   so a mirror match against it is roughly fair.
2. **Balance numbers come from full runs by default.** Anything measured
   from an isolated re-fight says so, because the two genuinely disagree.
3. **Anything measured with `--syntheticGatekeepers` is not a plain
   full-run number** and says so: those scripts print a provenance line.
4. **Aggregating classes over shared seeds does not multiply the
   sample.** The map is generated before any class-dependent divergence,
   so at a given seed all six classes get the same layout and gatekeeper.
   A six-class aggregate has about 3.5× the variance of an independent
   sample of the same size (a real standard error about 1.9× the naive
   one). Per-class numbers are unaffected; prefer them.
