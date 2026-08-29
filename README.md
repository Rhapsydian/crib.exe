# crib.exe

A browser-based, hacking-themed roguelite (Slay the Spire-style run
structure) where combat is resolved by playing real Cribbage.

**Status**: engine in progress, no UI yet. Phases 1-4 (a rules-correct
headless 2-player Cribbage engine; the combat wrapper — subroutine
triggers/payloads, initiative gauges, Breach/Containment resolution; the
network-map/run-structure layer — free-roam movement, Heat, real duels
wired into fight nodes; and meta-progression — 6 classes, subroutine
acquisition, Merge/Shop) are implementation-complete, content-real (all 18
class starting loadouts + a real 32-enemy roster across 4 layers, every
tier now eligible from layer 1 onward), and verified by an automated test
suite, `src/engine/`. Phase 5 (content, balance, and polish) is in
progress — the Enemy Library and Neutral Archetype are built; **Mods**
(crib.exe's StS-relic equivalent) shipped: 23 real Mods (the 6 class
starting passives, migrated onto the same infrastructure, plus 17 new
ones), all 12 hook points wired into combat/loadout/acquisition/Shop; and
**Burners + Events** shipped: 8 single-use, player-activated Burners
(combat/map/shop contexts, including reopening a previously closed map
node) and 8 narrative Event vignettes (risk-tiered choices, optional
bonus fights), fully wired into combat, traversal, the Shop, and reward
acquisition. `DESIGN.md` now states an explicit design goal for how a run
should play: the ideal path is a middle ground between beelining a
layer's gatekeeper and fully exploring it while managing Heat, with
either extreme being a deliberate risk/reward tradeoff rather than
something to balance away (see Map & Run Structure) — a third scripted
traversal strategy, **`opportunisticTraversal`**, now actually embodies
that middle ground (fights first, then Heat/material/Data-driven pulls
toward Safehouse/Shop/Event, gated by a Heat safety reserve), alongside
the existing beeline/explore extremes. **The per-class balance pass
compared full-run outcomes against a real external target**: Slay the
Spire's own ascension-0 full-run win rate (9-15% for a new player) was
adopted as the benchmark. Getting there took several real engine
changes, not just number tweaks — a per-layer enemy magnitude scaler
(regular/elite via a shared formula, gatekeepers via an
individually-tunable stored value, fixing a genuine gap where layer 1
gatekeepers were measurably *harder* than layer 4's, backwards from the
intended ramp); `scripts/gatekeeper-check.ts`, a permanent diagnostic
that measures gatekeeper difficulty against a player's *real*
accumulated run state (not a bare starting kit); and four individual
class passive reworks (Warden's Feedback Loop redesigned as a
reciprocal HoT/DoT amplification rather than a flat bonus; Saboteur's
Sleeper Cell, Operator's Primed, and Ghost's Return to Sender/Idle
Process all retuned after isolating exactly which mechanic was carrying
each class). One real cross-class coupling was found and fixed along
the way: Operator's Primed passive and gatekeeper Zero-Sum's own
`primed-to-strike` had quietly shared the same tuning constants, split
into independent ones. **A later pass corrected the benchmark
methodology itself**: the player side of every full-run sweep had been
running on `playCombat`'s dumb floor baseline (no skill dial at all)
this whole time, while a separate gatekeeper diagnostic used a skilled
player — two different "players" being silently compared to the same
target. Player and enemy skill are now a permanent, structurally
decoupled pair (`run.ts`'s `playerSkill` option, opt-in, never
interlocked with the enemy's own per-fight `enemySkill()` scaling); the
diagnostic scripts default to a calibrated `playerSkill=0.85`, anchored
to the hardest real enemy's own skill ceiling (0.84) via a pure-Cribbage
skill-vs-skill calibration table (`scripts/cribbage-skill-matrix.ts`).
At that corrected baseline, full-run rates sit at 19-33% across the 6
classes — the 9-15% target band was calibrated against the old
floor-skill numbers and hasn't been re-derived for a real skilled
player yet, so it's not currently authoritative. Firewall Prime
(specifically vs. Warden) was redesigned ground-up and meaningfully
improved (0.0% → 11.8%) but isn't fully resolved; layer 3's own weaker
gatekeeper trio remains untouched. A full 32-enemy roster audit also
found 7 genuinely dead subroutine pieces (Heat-gated triggers — enemies
never accumulate Heat at all) across 9 enemies, fixed with a real
enemy-only subroutine catalog (`src/engine/enemy-subroutines.ts`); the
roster's remaining reliance on shared player-pool content for the other
~25 enemies is intentionally banked as a future initiative, not
addressed here. Basic Cribbage (standard race-to-121, no roguelite
layer) is now a real, tested, permanent alternate-game-mode engine
(`src/engine/basic-cribbage.ts`) rather than a throwaway diagnostic —
the entire per-class balance pass above still describes the roguelite
mode; Basic Cribbage is a separate, still-unbuilt-in-the-UI mode.
See `DESIGN.md` for the full design, `BACKLOG.md` for the phased
implementation roadmap and next-session pointer, and `session-logs/` for a
per-session record of decisions and results.

Domain: `cribexe.com` (registered available, not yet purchased).

## Engine

- `npm test` — run the Vitest suite (564 tests as of session 39).
- `npm run check` — type-check (`svelte-check` + `tsc`).
- `npm run sweep -- run|enemy ...` — balance/regression sweep harness (see
  `scripts/sweep.ts`); used throughout Phase 5 to tune with real numbers
  instead of guessing. `run` mode defaults to `--playerSkill=0.85`.
- `npx tsx scripts/gatekeeper-check.ts` — realistic gatekeeper-difficulty
  diagnostic: real accumulated player state from actual runs, fought
  against the real production skill-dial enemy AI, aggregated by
  gatekeeper and by layer. Note: this is an isolated re-fight (fresh
  seed, chosen skill), not a replay of what the real run's own
  resolution decided — see `scripts/layer-funnel.ts` below for that.
- `npx tsx scripts/layer-funnel.ts` — the real, same-run full-run
  layer-completion funnel (cumulative "made it through layer N"), read
  straight off `playRun()`'s own outcome, not a separate re-fight.
- `npx tsx scripts/cribbage-skill-matrix.ts` — pure-Cribbage skill-vs-
  skill win-rate calibration grid, entirely outside the roguelite layer;
  what a "player skill" default actually means in Cribbage terms.
- `npm run dev` — Vite dev server (currently just the default Svelte
  scaffold; no game UI is wired up yet).

Engine/UI separation is a standing project-wide principle (see
`DESIGN.md` Architecture): everything in `src/engine/` is plain
TypeScript, testable headlessly with zero Svelte/browser dependency.
