# crib.exe

A browser-based, hacking-themed roguelite with a Slay the Spire-style run
structure, where combat is resolved by playing real Cribbage.

You play a run through a four-layer network, fighting named enemies at
map nodes. Each fight is a genuine game of Cribbage — but the points you
score also fill an **initiative gauge**, and every time yours crosses its
threshold you take a turn: every **subroutine** in your loadout fires its
**alpha** effect, top to bottom, and each one whose criteria are met also
applies its **beta** — a bigger hit, an extra effect, or (for some) a
fire the instant its criteria land, outside the turn. Subroutines push
your **Breach** gauge toward the win, push the enemy's **Containment**
gauge back, shield, speed up your turns, or manipulate the cards. Play
the cards well and you act more often; build and order the loadout well
and each action does more.

Four archetypes, each bound to one of the four suits: **Exploit** (spike /
control), **Daemon** (ramp / healing), **Overclock** (tempo /
empowerment) and **Honeypot** (conversion / defense).

## Status

**The engine is complete; the content is a placeholder skeleton. There is
no UI yet** — `npm run dev` currently serves the default Svelte scaffold.

Session 51 redesigned the archetypes and the subroutine model from
scratch (`DESIGN.md` → Archetypes & Subroutines; the decision trail is
`docs/archetype-redesign.md`). The engine runs the new model end to end,
but the old 159-piece pool and 32-enemy roster were deleted, not
migrated: a deliberately untuned **skeleton** pool and roster stand in
until calibration says what an alpha and a beta are worth.

Session 52 started step 2, recalibration (`docs/recalibration-design.md`,
R1–R8): Heat is now a **per-layer budget** that resets at each gatekeeper,
with posted fight prices and a new run ending, *breached, then caught*;
and every verb now has a **price in Credit-equivalents**, measured by
mirror duels.

Session 53 finished step 2: betas, Charge and Trace are priced, Event
Heat scales with the posted fight prices, and a **skill-retention check**
guards that Cribbage skill keeps deciding fights. The rules step 3
authors against are in `DESIGN.md` → Pricing.

Session 54 started step 3, authoring (`docs/authoring-design.md`): the
**36-piece subroutine pool** is authored and priced, and the six classes
are named (Blackhat, Operator, Eidolon, Breacher, Warden, Wraith), with
bespoke bridge passives and commons-only starting loadouts. Real runs
now draw from the authored pool.

Session 55 finished step 3 with the **authored enemy roster**: 18 enemies,
including eight gatekeepers with bespoke Mods, tuned to the per-layer
pass-rate curve. Every piece of content in a run is now authored; the
skeleton is gone. Next is a class balance pass.

What exists, all headless and test-covered:

| area | state |
|---|---|
| Cribbage rules engine | complete, rules-correct, 2-player |
| Combat wrapper | complete — alpha/beta subroutines, seven verbs, initiative, Breach/Containment |
| Run & map layer | complete — free-roam movement, per-layer Heat with posted fight prices, real duels at fight nodes |
| Meta-progression | complete — 6 classes (placeholder names and bridge passives), acquisition, Merge, Shop |
| Content | **skeleton** — 16 subroutines, 10 enemies; 37 Mods, 8 Burners, 8 Events carried over |
| Balance | **recalibration in progress** — verbs priced; betas next (see `BACKLOG.md`) |
| UI, art | not started |

The roadmap is now the redesign's three steps: engine refactor (done),
recalibrate (in progress), then author real content. The balance numbers from sessions 39–50 measured content that no
longer exists; their *lessons* (gatekeeper matchup dominating class
spread, trigger frequency over payload magnitude) carry forward in
`DESIGN.md` and `docs/run-economy-design.md`.

## Running it

```bash
npm install
npm test        # Vitest suite (646 tests)
npm run check   # svelte-check + tsc across src/, vite config, and scripts/
npm run dev     # Vite dev server (scaffold only — no game UI yet)
```

## Balance and diagnostic tools

Balance in this project is measured, not guessed at. These scripts are
the measurement instrument, and they are covered by `npm run check`
(`tsconfig.scripts.json`) precisely because a silently broken one has
corrupted a balance pass before.

```bash
npm run sweep -- run --seeds=150 --acquisition=synergy --traversal=opportunistic
```

Full-run outcome distribution per class. `--traversal` picks the scripted
movement profile (`beeline` / `explore` / `opportunistic`);
`--acquisition` picks the decision-making profile (`floor` is a
deliberately legal-but-not-good baseline, `synergy` is the real
heuristic layer). The two are independent dials so a before/after can
isolate which half moved a number. `--out` writes one JSONL line per
run, including that run's final loadout, so "how many winning runs
included X" is a query rather than a bespoke script.

```bash
npm run sweep -- enemy --enemy=skeleton-gate-4 --vs=exploit-daemon
```

A direct `playCombat` between one named enemy and one class's starting
kit, reporting threshold vs. attrition wins on each side.

| script | what it answers |
|---|---|
| `npx tsx scripts/layer-funnel.ts` | Where runs actually die — cumulative "made it through layer N", read off real full runs |
| `npx tsx scripts/gatekeeper-check.ts` | How hard each gatekeeper is against *realistic accumulated* player state, not a bare starting kit |
| `npx tsx scripts/occurrence-frequency.ts` | Real Cribbage occurrence frequency and score distributions, outside the roguelite layer — calibrates content thresholds against actual play |
| `npx tsx scripts/cribbage-skill-matrix.ts` | What a given "player skill" value actually means, as a skill-vs-skill win-rate grid |
| `npx tsx scripts/price-check.ts` | What one verb is worth, in Credit per turn: seat-swapped mirror duels, host-plus-difference (`src/engine/pricing.ts`). Raw results in `docs/calibration/` |
| `npx tsx scripts/archetype-check.ts --archetype=<a>` | One authored archetype's checks: every piece's price against its rarity band (in position where it matters), the credit rule, skill retention, noise |
| `npx tsx scripts/player-power.ts` | The player's priced power (kit power) at each layer of real runs — the basis of the enemy budgets |
| `npx tsx scripts/roster-check.ts --tier=<t>` | Each authored enemy's kit power against its budget, by layer, plus a tracer's extra Trace per fight |
| `npx tsx scripts/class-check.ts` | Each class's bridge passive priced against its +1.0 budget, in its starting loadout and a late kit, with retention |
| `npx tsx scripts/beta-frequency.ts` / `beta-validate.ts` | How often each beta source charges per turn; the beta-pricing formula checked against duels |
| `npx tsx scripts/trace-price.ts` | What extra Trace per fight costs a run, and how much of each class's Trace is its own noise |
| `npx tsx scripts/skill-check.ts` | Skill retention: whether Cribbage skill still decides fights with loadouts installed (floor 0.5, DESIGN.md Pricing) |
| `npx tsx scripts/enemy-check.ts` / `heat-sources.ts` | Per-enemy difficulty against accumulated state; where run Heat comes from |

### Holding the gatekeepers still

`sweep.ts` and `gatekeeper-check.ts` take
`--syntheticGatekeepers=<4 slots>`, one per layer, which replaces a
layer's gatekeeper *fight* with a weighted coin — or pins which member of
the stable is drawn.

```bash
npm run sweep -- run --seeds=300 --syntheticGatekeepers=1,1,1,1
npm run sweep -- run --seeds=300 --syntheticGatekeepers=0.78,0.72,0.66,0.60
npx tsx scripts/gatekeeper-check.ts --syntheticGatekeepers=1,pin:<gatekeeper-id>,1,1
```

It exists because a lost gatekeeper fight ends the run outright, so every
layer's population is *strictly* "whoever beat the previous layer" — any
per-layer or per-class number is otherwise measured on a cohort
pre-selected by the very trait being measured. `1,1,1,1` removes that
filter; a fixed curve holds the roster still while something else is
read; `pin:` measures one gatekeeper against a controlled background
(meaningless on the skeleton roster, which has one gatekeeper per layer).

### Four conventions worth knowing before reading any number

1. **Player skill and enemy skill are structurally decoupled** — the
   diagnostics default to `playerSkill=0.85`, anchored to the hardest
   real enemy's own skill ceiling (0.84) so a mirror match against it is
   roughly fair.
2. **Balance metrics are full-run-derived by default**; anything measured
   from an isolated re-fight says so explicitly, because the two
   genuinely disagree.
3. **Anything measured with `--syntheticGatekeepers` is not a plain
   full-run metric** and must say so. Those scripts print a provenance
   line on every run that uses it.
4. **Aggregating classes over shared seeds does not multiply the
   sample.** `createRng(seed)` generates the map before any
   class-dependent divergence, so at a given seed all six classes get the
   same layout and the same gatekeeper — measured session 49, all six
   drew the same layer-1 gatekeeper in 400/400 seeds. A six-class
   aggregate has **~3.5× the variance** of an independent sample of the
   same size, so its real standard error is roughly **1.9× the naive
   `sqrt(p(1-p)/n)`**. Per-class numbers are unaffected; prefer them.

## Architecture

Engine and UI stay fully separate, and this is a standing project-wide
rule rather than a preference (see `DESIGN.md`, Architecture). Everything
in `src/engine/` is plain TypeScript with zero Svelte or browser
dependency, and must remain simulable and testable headlessly. The UI,
when it exists, will be a thin interface onto the engine and never a
load-bearing piece of it.

That constraint is why the balance tooling above can exist at all.

## Where things are documented

| file | holds |
|---|---|
| `DESIGN.md` | The settled design — mechanics, archetypes, classes, enemies, resources, and the reasoning behind them |
| `docs/archetype-redesign.md` | Session 51's decision trail for the archetype and subroutine redesign (A1–A12, plus every implementation call) |
| `docs/run-economy-design.md` | Session 50's decisions: the per-layer Heat economy (built session 52), the pillar suite, and the per-turn model (D11–D15) |
| `docs/recalibration-design.md` | Step 2's decision trail (R1–R8) and its checkpoint findings: the Heat build, the pricing instrument, verb and beta prices, Trace, skill retention |
| `docs/authoring-design.md` | Step 3's decision trail (S1–S11, C1–C6) and each authoring checkpoint's results: the four archetypes, the bridges, the starting loadouts, the wired-in run results |
| `docs/design-history.md` | `DESIGN.md` sections superseded by session 51, archived verbatim |
| `BACKLOG.md` | What is still to do, and the current balance picture |
| `docs/roadmap-history.md` | Completed roadmap work and the per-checkpoint record of how it was built |
| `docs/session-logs/` | Per-session record of decisions and results |

Sessions 22–28 have no individual log; that stretch is covered by the
combined `docs/session-logs/00-prior-sessions-1-28.md`. Session 50 has
none either — it was never closed out; its record is
`docs/run-economy-design.md` and its commits.

---

Domain: `cribexe.com` (registered available, not yet purchased).
