# crib.exe — Backlog

Phased roadmap. First pass, written at the end of session 1, updated end
of sessions 2-5 — expect this to be revised as design and implementation
proceed. See `DESIGN.md` for the settled design and its own Open
Questions section.

## NEXT SESSION

Phase 0, next item: pick which remaining design gap to tackle next
(suit theming + suit-archetype pairing, subroutine acquisition flow,
class specialization/starting loadouts, the banked Heat-from-lost-duel
question, or the banked subroutine-tags idea) — own `/decision-session`
per item, same live-one-at-a-time discipline as sessions 1-5 (see
`.claude/dev-session.md`). Class specialization likely still wants
concrete example subroutines built out first, even with the catalogs
done, since starting loadouts need real subroutines to choose from.

## Phase 0 — Remaining design passes

Each of `DESIGN.md`'s Open Questions is its own dedicated design/decision
session before the implementation phases below can be fully scoped:

- ~~The 4 subroutine archetypes~~ — done, session 2: Exploit, Malware,
  Encryption, Root.
- ~~Subroutine effect design space + enable-condition catalog~~ — done,
  session 3: 2 resources (Heat, Control/Breach), full payload catalog
  per archetype, 6 trigger families + Togglable.
- ~~Mid-combat vs. between-fights loadout reordering~~ — done, session 3:
  reordering is between-fights only, toggling subroutines on/off is the
  mid-combat lever.
- ~~Archetype-to-trigger-family affinity mapping~~ — done, session 4:
  Exploit↔Occurrence, Malware↔Accumulators, Encryption↔Self-state,
  Root↔Enemy-state; Chained and Always/Cantrip are universal, not
  archetype-exclusive.
- ~~Full concrete list of specific occurrence triggers~~ — done, session
  5: 8 categories (Fifteen, Pair, Run, Flush, His Nobs, His Heels,
  Thirty-One, Go), each with 3 firing variations (Instant/Threshold/
  Scaling).
- Exactly how a lost Control/Breach duel translates into Heat gained —
  raised and deliberately banked in session 3.
- Subroutine acquisition flow during a run (rewards/shop/both) and
  loadout size/slot limit.
- Class specialization (2 of 4 archetypes each) + starting loadouts —
  likely wants concrete example subroutines built out first.
- Suit re-theming (names/icons) and which suit maps to which archetype.
- **Banked idea, not yet designed**: subroutine tags (e.g. Hack,
  Firewall, Trap) as a classification orthogonal to archetype, that
  in-run passive items can hook into to enhance tagged subroutines
  (e.g. "your Trap-tagged subroutines do X"). Noted session 3, deferred.

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
