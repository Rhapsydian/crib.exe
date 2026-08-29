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
the existing beeline/explore extremes. **The per-class balance pass is
now complete against a real external target**: Slay the Spire's own
ascension-0 full-run win rate (9-15% for a new player) was adopted as
the benchmark, and all 6 classes now land inside that band (11.0-14.3%)
via `scripts/sweep.ts`'s full-run sweep. Getting there took several real
engine changes, not just number tweaks — a per-layer enemy magnitude
scaler (regular/elite via a shared formula, gatekeepers via an
individually-tunable stored value, fixing a genuine gap where layer 1
gatekeepers were measurably *harder* than layer 4's, backwards from the
intended ramp); a new permanent diagnostic, `scripts/gatekeeper-check.ts`,
that measures gatekeeper difficulty against a player's *real* accumulated
run state (not a bare starting kit) fought with the real production
skill-dial AI; and four individual class passive reworks (Warden's
Feedback Loop redesigned as a reciprocal HoT/DoT amplification rather
than a flat bonus, after the flat version turned out to conceptually
overlap with Ghost's own Return to Sender; Saboteur's Sleeper Cell,
Operator's Primed, and Ghost's Return to Sender/Idle Process all retuned
after isolating exactly which mechanic was carrying each class). One
real cross-class coupling was found and fixed along the way: Operator's
Primed passive and gatekeeper Zero-Sum's own `primed-to-strike` had
quietly shared the same tuning constants, so retuning Operator was
incidentally retuning Zero-Sum's difficulty for every other class too —
split into independent constants. Firewall Prime (specifically vs.
Warden, still near-unwinnable) and layer 3's own weaker gatekeeper trio
remain known, deliberately unaddressed outliers for a future pass.
See `DESIGN.md` for the full design, `BACKLOG.md` for the phased
implementation roadmap and next-session pointer, and `session-logs/` for a
per-session record of decisions and results.

Domain: `cribexe.com` (registered available, not yet purchased).

## Engine

- `npm test` — run the Vitest suite (542 tests as of session 39).
- `npm run check` — type-check (`svelte-check` + `tsc`).
- `npm run sweep -- run|enemy ...` — balance/regression sweep harness (see
  `scripts/sweep.ts`); used throughout Phase 5 to tune with real numbers
  instead of guessing.
- `npx tsx scripts/gatekeeper-check.ts` — realistic gatekeeper-difficulty
  diagnostic: real accumulated player state from actual runs, fought
  against the real production skill-dial enemy AI, aggregated by
  gatekeeper and by layer.
- `npm run dev` — Vite dev server (currently just the default Svelte
  scaffold; no game UI is wired up yet).

Engine/UI separation is a standing project-wide principle (see
`DESIGN.md` Architecture): everything in `src/engine/` is plain
TypeScript, testable headlessly with zero Svelte/browser dependency.
