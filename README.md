# crib.exe

A browser-based, hacking-themed roguelite with a Slay the Spire-style run
structure, where combat is resolved by playing real Cribbage.

You play a run through a four-layer network, fighting named enemies at
map nodes. Each fight is a genuine game of Cribbage — but the points you
score also fill an **initiative gauge**, and every time yours crosses its
threshold you take a turn, firing every **subroutine** in your loadout
whose trigger condition is currently met. Those subroutines push your
**Breach** gauge toward the win, or suppress the enemy's **Containment**
gauge to deny theirs. Play the cards well and you act more often; build
the loadout well and each action does more.

## Status

**The engine is complete and content-real. There is no UI yet** —
`npm run dev` currently serves the default Svelte scaffold.

What exists, all headless and test-covered:

| area | state |
|---|---|
| Cribbage rules engine | complete, rules-correct, 2-player |
| Combat wrapper | complete — triggers, payloads, initiative, Breach/Containment |
| Run & map layer | complete — free-roam movement, Heat, real duels at fight nodes |
| Meta-progression | complete — 6 classes, acquisition, Merge, Shop |
| Content | 159 subroutines (139 player-facing, 20 enemy-only), 32 enemies, 40 Mods, 8 Burners, 8 Events |
| Balance | **in progress** — see `BACKLOG.md` |
| UI, art | not started |

Balance is the active work and is not settled. Full-run win rates
currently range from 6.7% to 42.0% across the six classes against a
10–20% target band, and the per-layer difficulty curve is non-monotonic.
`BACKLOG.md` has the current numbers and what is being done about them.

## Running it

```bash
npm install
npm test        # Vitest suite (791 tests)
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
npm run sweep -- enemy --enemy=ghost-in-the-machine --vs=blackhat
```

A direct `playCombat` between one named enemy and one class's starting
kit, reporting threshold vs. attrition wins on each side.

| script | what it answers |
|---|---|
| `npx tsx scripts/layer-funnel.ts` | Where runs actually die — cumulative "made it through layer N", read off real full runs |
| `npx tsx scripts/gatekeeper-check.ts` | How hard each gatekeeper is against *realistic accumulated* player state, not a bare starting kit |
| `npx tsx scripts/occurrence-frequency.ts` | Real Cribbage occurrence frequency and score distributions, outside the roguelite layer — calibrates content thresholds against actual play |
| `npx tsx scripts/cribbage-skill-matrix.ts` | What a given "player skill" value actually means, as a skill-vs-skill win-rate grid |

Two conventions worth knowing before reading any number these produce.
Player skill and enemy skill are **structurally decoupled** — the
diagnostics default to `playerSkill=0.85`, anchored to the hardest real
enemy's own skill ceiling (0.84) so a mirror match against it is roughly
fair. And balance metrics are **full-run-derived by default**; anything
measured from an isolated re-fight instead says so explicitly, because
the two genuinely disagree.

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
| `BACKLOG.md` | What is still to do, and the current balance picture |
| `docs/roadmap-history.md` | Completed roadmap work and the per-checkpoint record of how it was built |
| `docs/session-logs/` | Per-session record of decisions and results |

Sessions 22–28 have no individual log; that stretch is covered by the
combined `docs/session-logs/00-prior-sessions-1-28.md`.

---

Domain: `cribexe.com` (registered available, not yet purchased).
