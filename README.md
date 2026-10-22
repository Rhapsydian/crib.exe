# crib.exe

crib.exe is a browser-based, hacking-themed roguelite where every fight is a game of Cribbage. You play a hacker breaking through a network four layers deep. Each layer is a branching map of fights, elites, Shops, Safehouses, Caches and Events, guarded by a gatekeeper, and every move adds Heat: max it out and you're traced. In combat, the points you score in Cribbage (pegging, hands and crib) fill your initiative, and each time it fills you take a turn. Your loadout of subroutines then fires top to bottom. Each subroutine runs its Process, a steady effect such as Credit to build your Breach toward a win, Suppress to slow the enemy, or Ward to shield you. Its Hook adds a stronger bonus when a condition is met, like scoring fifteens, pairs or runs. The enemy's own subroutines build Containment against you. Between fights you shape a build from new subroutines, permanent Mods and one-use Burners, and at Safehouses you either rest to lower Heat or merge spare copies to rank subroutines up. There are six classes, each with its own Mod, and you win by breaching all four layers.

Four archetypes, each bound to one of the four suits: **Exploit** (spike /
control), **Daemon** (ramp / healing), **Overclock** (tempo /
empowerment) and **Honeypot** (conversion / defense).

## Status

**The engine and its content are complete and balanced, and the game is
playable in the browser** (`npm run dev`), on desktop and phones: a whole
roguelite run (class choice, the map, fights, rewards, Safehouses, Shops,
Events and Caches, with saves), and vanilla Cribbage at four difficulty
levels, with a coach and five Learn-to-play lessons. New players get a
guided tutorial run and first-time tips. Polish and playtesting are under
way; next is more content, then meta-progression and Daily Runs
(`BACKLOG.md` → Priorities).

**Play the demo:** <https://rhapsydian.github.io/crib.exe/> — the
`playable` branch, rebuilt on every push (`.github/workflows/deploy-demo.yml`).

How it got here, in arcs (each session's detail is in `docs/session-logs/`;
README's old session-by-session narrative is archived in
`docs/roadmap-history.md`):

- **Sessions 1–50:** the Cribbage engine, the combat wrapper, the map
  and run, classes / Mods / Merge / Burners, and a long run of balance
  work (`docs/roadmap-history.md`).
- **Sessions 51–56:** the archetypes and subroutine model redesigned
  from scratch (`docs/archetype-redesign.md`), recalibrated
  (`docs/recalibration-design.md`), all content authored
  (`docs/authoring-design.md`) and class-balanced
  (`docs/balance-design.md`).
- **Sessions 57–59:** made playable (`docs/playable-design.md`): a
  pausable engine, one fight, a whole run, then plain Cribbage with a
  coach and lessons.
- **Sessions 60–63:** polish and playtesting: a text audit, the class
  Mods and enemy roster reworked, selling and Merge-everything, the
  economy, a guided tutorial and tips, Heat shown up front, and the trace
  evasion (`docs/tutorial-design.md`, `docs/trace-evasion-design.md`).

What exists, all headless and test-covered:

| area | state |
|---|---|
| Cribbage rules engine | complete, rules-correct, 2-player |
| Combat wrapper | complete — subroutines with a Process and a Hook (alpha / beta in code), seven verbs plus three enemy-only (Trace, Wipe, Strip), initiative, Breach/Containment |
| Run & map layer | complete — free-roam movement, per-layer Heat with posted fight prices, real duels at fight nodes |
| Run progression | complete — 6 classes, each with a class Mod on fifteens or pairs; acquisition, Merge (everything at once, at a Safehouse), a Shop that buys and sells, Burners, the trace evasion |
| Meta-progression (between runs) | **undesigned** — a priority after the content pass |
| Content | **authored** — 36 player subroutines, 20 enemy-only; 27 enemies (13 regular, 6 elite and 8 gatekeepers, each with its own Mod) plus the tutorial's Firewall Beta; 37 Mods, 9 Burners (Cold Wallet sell-only), 8 Events (Static Shield and Recon Ping set aside). The next priority is more of all of it |
| Balance | 15–20% target by class, ~16% aim; now 16.0–23.3%, average 19.8% (session 63, after the Burner cut and the trace evasion); retune after the content pass |
| UI | a whole run and plain Cribbage with a coach and lessons, on desktop and phones, saved after every choice; a guided tutorial, first-time tips, the Heat bar |
| Art | the current terminal look is the intended style; no sprite pass planned (at most, refined map icons) |

The playable-game plan (`docs/playable-design.md`): milestones 1–4 (a
pausable engine, one playable fight, a playable run, plain Cribbage) are
done; milestone 5, polish and playtesting, is under way.

## Running it

```bash
npm install
npm test        # Vitest suite (805 tests)
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
npm run sweep -- enemy --enemy=firewall-prime --vs=exploit-daemon
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
| `npx tsx scripts/build-check.ts` | A real build (by layer) against that layer's gatekeepers |
| `npx tsx scripts/engine-bench.ts` | Simulation speed (fights per second): run before and after any engine change |
| `npx tsx scripts/evasion-check.ts` | Trace evasion escape odds by head start and skill, and the head starts real runs produce |
| `npx tsx scripts/tutorial-seed.ts` / `tutorial-gatekeeper.ts` | The tutorial's seed (its first hand, winnable at every skill) and its gatekeeper's pass rate |

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
read; `pin:` measures one gatekeeper against a controlled background.

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
dependency, and must remain simulable and testable headlessly. The UI
(`src/ui/`, Svelte 5) is a thin interface onto the engine and never a
load-bearing piece of it: the engine pauses at each player decision
(generators), and a simulated player answers the same requests.

That constraint is why the balance tooling above can exist at all.

## Where things are documented

Current:

| file | holds |
|---|---|
| `BACKLOG.md` | What is still to do: the current state, the priorities, open items |
| `DESIGN.md` | The settled design: mechanics, archetypes, classes, enemies, resources, and the reasoning behind them |
| `docs/playable-design.md` | The plan for making the game playable (milestones 1–4 done, 5 under way) |
| `docs/tutorial-design.md` | The guided tutorial run and first-time tips (session 63) |
| `docs/trace-evasion-design.md` | The trace evasion: rules TE1–TE8, measurements, screens (session 63) |
| `docs/session-logs/` | Per-session record of decisions and results |
| `docs/calibration/` | Raw measurement output cited by the design records and the code |

Historical decision records (each marked with its status; the settled
results are in `DESIGN.md`):

| file | holds |
|---|---|
| `docs/run-economy-design.md` | Session 50: the per-layer Heat economy and per-turn model (D1–D15) |
| `docs/archetype-redesign.md` | Session 51: the archetype and subroutine redesign (A1–A12) |
| `docs/recalibration-design.md` | Sessions 52–53: pricing (R1–R8), verb and Hook prices, skill retention |
| `docs/authoring-design.md` | Sessions 54–55: authoring the pool, classes and roster (S1–S11, C1–C6, E1–E7) |
| `docs/balance-design.md` | Session 56: the class balance pass (B1–B7) |
| `docs/class-mod-redesign.md`, `docs/enemy-review.md`, `docs/text-audit.md` | Session 60: class Mods, the enemy roster, the rules-text wording rules |
| `docs/session-39-gatekeeper-balance-audit.md` | Session 39: an audit of a roster since rebuilt |
| `docs/design-history.md` | `DESIGN.md` sections superseded in session 51, verbatim |
| `docs/roadmap-history.md` | Completed roadmap work, and sections moved out of `BACKLOG.md` and `README.md` |

Sessions 22–28 have no individual log; that stretch is covered by the
combined `docs/session-logs/00-prior-sessions-1-28.md`. Session 50 has
none either — it was never closed out; its record is
`docs/run-economy-design.md` and its commits.

---

Domain: `cribexe.com` (registered available, not yet purchased).
