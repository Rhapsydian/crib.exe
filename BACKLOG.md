# crib.exe — Backlog

Phased roadmap. First pass, written at the end of session 1 — expect this
to be revised as design and implementation proceed. See `DESIGN.md` for
the settled design and its own Open Questions section.

## NEXT SESSION

Phase 0, first item: pick which remaining design gap to tackle next
(subroutine archetypes/classes, subroutine effect catalog, suit theming,
subroutine acquisition flow, or the mid-combat-reorder call) — own
`/decision-session` per item, same live-one-at-a-time discipline as
session 1 (see `.claude/dev-session.md`).

## Phase 0 — Remaining design passes

Each of `DESIGN.md`'s Open Questions is its own dedicated design/decision
session before the implementation phases below can be fully scoped:

- Subroutine acquisition flow during a run (rewards/shop/both) and
  loadout size/slot limit.
- The 4 subroutine archetypes and class specialization (2 of 4 each) +
  starting loadouts.
- Subroutine effect design space (damage/buff/debuff) and the fuller
  enable-condition catalog.
- Suit re-theming (names/icons).
- Mid-combat vs. between-fights loadout reordering — final call.

## Phase 1 — Core Cribbage engine

Standard-rules Cribbage, no game theming yet: deal/discard-to-crib/cut/
peg (15s, pairs, runs, 31, go)/score hand/score crib/alternate dealer.
Should be testable as a standalone engine (e.g. two scripted players)
before any combat-specific wrapping.

## Phase 2 — Combat wrapper

Dual initiative gauges (player/enemy) fed by Phase 1's scoring events;
subroutine enable-condition tracking (cooldown + suit-tally types to
start) and the fire-on-turn resolution (top-to-bottom through the
loadout, chaining effects).

## Phase 3 — Network-map / run structure

Node-map rendering as an actual network diagram; layered breach structure
(perimeter/DMZ → internal LAN → secured subnet → core) within one
continuous map; per-layer gatekeeper/boss encounters.

## Phase 4 — Meta-progression

Classes, subroutine unlock pool, Ascension-style difficulty, in-run
passive item pool.

## Phase 5 — Content & polish

Additional subroutines/classes/enemy rosters/contract targets, balance
pass, suit/subroutine art.
