# crib.exe

A browser-based, hacking-themed roguelite (Slay the Spire-style run
structure) where combat is resolved by playing real Cribbage.

**Status**: engine in progress, no UI yet. Phase 1 (a rules-correct,
headless 2-player Cribbage engine), Phase 2 (the combat wrapper —
subroutine triggers/payloads, initiative gauges, Breach/Containment
resolution), and Phase 3 (the network-map/run-structure layer — free-roam
movement, Heat, real duels wired into fight nodes) are all
implementation-complete and verified by an automated test suite,
`src/engine/`. Phases 2 and 3 are infrastructure-complete but
content-partial: only a small representative set of subroutines exists
(not the real 18 starting-loadout subroutines from `DESIGN.md`), and
Phase 3's Merge/Shop/Event nodes are structural stubs pending Phase 4's
acquisition system. See `DESIGN.md` for the full design and `BACKLOG.md`
for the phased implementation roadmap and next-session pointer.

Domain: `cribexe.com` (registered available, not yet purchased).

## Engine

- `npm test` — run the Vitest suite (154 tests as of Phase 3).
- `npm run check` — type-check (`svelte-check` + `tsc`).
- `npm run dev` — Vite dev server (currently just the default Svelte
  scaffold; no game UI is wired up yet).

Engine/UI separation is a standing project-wide principle (see
`DESIGN.md` Architecture): everything in `src/engine/` is plain
TypeScript, testable headlessly with zero Svelte/browser dependency.
