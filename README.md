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

**The engine and its content are complete and balanced, and the game is
playable in the browser** (`npm run dev`), on desktop and phones: a whole
roguelite run (class choice, the map, fights, rewards, Safehouses, Shops,
Events and Caches, with saves), and vanilla Cribbage at four difficulty
levels, with a coach and five Learn-to-play lessons. Polish and
playtesting are under way (session 60: text, class Mods, enemies).

**Play the demo:** <https://rhapsydian.github.io/crib.exe/> — the
`playable` branch, rebuilt on every push (`.github/workflows/deploy-demo.yml`).

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
skeleton is gone.

Session 56's **class balance pass** (`docs/balance-design.md`) put every
class at 13–19% full-run victory, inside the 10–20% target (was 11–31%).
It did so with a Credit premium on the noisy Exploit pieces, a lower
gatekeeper pass-rate curve, and small bridge trims.

Session 57 started **making the game playable** (`docs/playable-design.md`,
P1–P8). The engine now pauses at each player decision (generators) and
resolves combat live during pegging. On top of it, **one real fight is
playable**: pick a class and an enemy, then discard, peg, and watch every
card, score, turn, Mod and Burner play out step by step, with the show
counted hand by hand and a running session log. Phones get a compact
screen with side drawers; desktop gets side panels, keyboard controls and
hover tips.

Session 58 made **a whole run playable** (milestone 3). The run engine
pauses at every decision; a new map generator lays each layer out on a
hex backdrop (10/12/12/14 nodes, a dealt mix of node types, a remote
Cache); and every node has its screen -- rewards, a full bench, Burner
swaps, the Safehouse, a Shop you can buy freely from, Events, Caches, map
Burners -- with the loadout editable from the map and the run saved after
every choice. Along the way **Trace was removed**: fights post Heat
directly, the noisy Exploit pieces hand the enemy Containment instead,
and alarm enemies add Heat. Static Shield and Recon Ping were set aside,
and the gatekeepers were re-tuned twice.

Session 59 added **vanilla Cribbage** (milestone 4), so testers can learn
the card game the combat rests on: a main menu split into the roguelite
and Cribbage; plain Cribbage to 121 at four difficulty levels (tuned to an
even ladder); a **coach** that suggests discards and plays and reviews
yours (each pegging play judged by its points less the opponent's
expected reply; keeps shown as sure points plus the cut's average); a
real **crib table** for the AI and the coach (with a retune); and five
short **Learn to play** lessons whose answers come from the engine's own
scoring.

Session 60 started **polish**, with content: UI fixes (the log follows,
the loadout stands on the map's left on desktop, the map no longer
resizes); a **text audit** of every rules text (`docs/text-audit.md`:
"subroutine", what gets bigger, initiative spelled out, a glossary in the
detail panel); the six **class Mods redesigned** to trigger on a fifteen
or a pair, three each (`docs/class-mod-redesign.md`); and an **enemy
review** (`docs/enemy-review.md`): class Mods became the player's alone,
each elite got a rule-bending Mod, three enemy-only effects (Trace: Heat;
Wipe: your Hook counts; Strip: your Ward) and twelve enemy subroutines
built on them, and the roster grew to 27 -- new regulars for every
layer, two deep elites -- named as the network defending itself.

What exists, all headless and test-covered:

| area | state |
|---|---|
| Cribbage rules engine | complete, rules-correct, 2-player |
| Combat wrapper | complete — alpha/beta subroutines, seven verbs plus three enemy-only (Trace, Wipe, Strip), initiative, Breach/Containment |
| Run & map layer | complete — free-roam movement, per-layer Heat with posted fight prices, real duels at fight nodes |
| Meta-progression | complete — 6 classes, each with a class Mod on fifteens or pairs; acquisition, Merge, Shop |
| Content | **authored** — 36 player subroutines, 20 enemy-only; 27 enemies (13 regular, 6 elite and 8 gatekeepers, each with its own Mod); 37 Mods, 8 Burners, 8 Events (Static Shield and Recon Ping set aside) |
| Balance | **re-tuned in session 60** — every class 16–22% full-run victory; the gatekeeper curve on target |
| UI | **a whole run playable** (milestone 3) and **vanilla Cribbage with a coach and lessons** (milestone 4), both saved after every choice |
| Art | not started |

The playable-game plan's milestones: a pausable engine, one playable
fight and a playable run (all done), then polish and playtesting with a
style guide (in progress).

## Running it

```bash
npm install
npm test        # Vitest suite (754 tests)
npm run check   # svelte-check + tsc across src/, vite config, and scripts/
npm run dev     # Vite dev server: the main menu (the roguelite, Cribbage); #test is the single-fight harness
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
| `npx tsx scripts/roster-check.ts --tier=<t>` | Each authored enemy's kit power against its budget, by layer, plus its Heat per fight (alarms, Spotlight, Trace) |
| `npx tsx scripts/enemy-parity.ts --layer=<n> --tier=<t>` | An enemy's Containment fill against six 6-subroutine class loadouts, next to its tier's others -- prices what kit power can't see (Wipe, Strip, Resource Quota) |
| `npx tsx scripts/text-dump.ts` | Every player-facing rules text (subroutines, enemy subroutines, Mods, Burners) as Markdown, for a wording review |
| `npx tsx scripts/class-check.ts` | Each class's bridge passive priced against its +1.0 budget, in its starting loadout and a late kit, with retention |
| `npx tsx scripts/beta-frequency.ts` / `beta-validate.ts` | How often each beta source charges per turn; the beta-pricing formula checked against duels |
| `npx tsx scripts/feed-price.ts` | Prices a noisy piece's feed (Fuzzer, Jackpot) against its rarity band |
| `npx tsx scripts/run-outcomes.ts` | Full-run outcomes by class (victory, Heat endings, Quarantine) and where each run's Heat came from |
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
| `docs/balance-design.md` | The class balance pass (B1–B7): why the class gap was Heat rather than strength, the noise premium, the revised gatekeeper curve, the final per-class numbers |
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
