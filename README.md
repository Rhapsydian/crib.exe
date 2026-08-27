# crib.exe

A browser-based, hacking-themed roguelite (Slay the Spire-style run
structure) where combat is resolved by playing real Cribbage.

**Status**: engine in progress, no UI yet. Phases 1-4 (a rules-correct
headless 2-player Cribbage engine; the combat wrapper — subroutine
triggers/payloads, initiative gauges, Breach/Containment resolution; the
network-map/run-structure layer — free-roam movement, Heat, real duels
wired into fight nodes; and meta-progression — 6 classes, subroutine
acquisition, Merge/Shop) are implementation-complete, content-real (all 18
class starting loadouts + a real 32-enemy roster across 4 layers), and
verified by an automated test suite, `src/engine/`. Phase 5 (content,
balance, and polish) is in progress — the Enemy Library and Neutral
Archetype are built, and a real per-class balance/tuning pass is ongoing.
See `DESIGN.md` for the full design, `BACKLOG.md` for the phased
implementation roadmap and next-session pointer, and `session-logs/` for a
per-session record of decisions and results.

Domain: `cribexe.com` (registered available, not yet purchased).

## Engine

- `npm test` — run the Vitest suite (460 tests as of session 29).
- `npm run check` — type-check (`svelte-check` + `tsc`).
- `npm run sweep -- run|enemy ...` — balance/regression sweep harness (see
  `scripts/sweep.ts`); used throughout Phase 5 to tune with real numbers
  instead of guessing.
- `npm run dev` — Vite dev server (currently just the default Svelte
  scaffold; no game UI is wired up yet).

Engine/UI separation is a standing project-wide principle (see
`DESIGN.md` Architecture): everything in `src/engine/` is plain
TypeScript, testable headlessly with zero Svelte/browser dependency.
