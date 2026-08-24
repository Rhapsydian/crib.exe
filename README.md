# crib.exe

A browser-based, hacking-themed roguelite (Slay the Spire-style run
structure) where combat is resolved by playing real Cribbage.

**Status**: engine in progress, no UI yet. Phase 1 (a rules-correct,
headless 2-player Cribbage engine) and Phase 2 (the combat wrapper —
subroutine triggers/payloads, initiative gauges, Breach/Containment
resolution) are both implementation-complete and verified by an
automated test suite, `src/engine/`. Phase 2 is infrastructure-complete
but content-partial: only a small representative set of subroutines
exists for testing, not the real 18 starting-loadout subroutines from
`DESIGN.md`. See `DESIGN.md` for the full design and `BACKLOG.md` for
the phased implementation roadmap and next-session pointer.

Domain: `cribexe.com` (registered available, not yet purchased).

## Engine

- `npm test` — run the Vitest suite (101 tests as of Phase 2).
- `npm run check` — type-check (`svelte-check` + `tsc`).
- `npm run dev` — Vite dev server (currently just the default Svelte
  scaffold; no game UI is wired up yet).

Engine/UI separation is a standing project-wide principle (see
`DESIGN.md` Architecture): everything in `src/engine/` is plain
TypeScript, testable headlessly with zero Svelte/browser dependency.
