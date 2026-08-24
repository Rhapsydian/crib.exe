# crib.exe — Backlog

Phased roadmap. First pass, written at the end of session 1, updated end
of sessions 2-12 — expect this to be revised as design and implementation
proceed. See `DESIGN.md` for the settled design and its own Open
Questions section.

## NEXT SESSION

Phase 0, next item: pick which remaining design gap to tackle next
(class unlock order for the middle four, or the banked node-bypass idea)
— own `/decision-session` per item, same live-one-at-a-time discipline as
sessions 1-12 (see `.claude/dev-session.md`). Phase 0 is nearly clear —
worth considering whether to start scoping Phase 1 (core Cribbage engine)
soon instead.

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
- ~~Exactly how a lost Control/Breach duel translates into Heat gained~~
  — done, session 9: base Heat cost by encounter tier, adjusted by
  margin of loss; gatekeeper/boss losses (any layer) bypass Heat and end
  the run outright instead, since a gatekeeper is the sole passage
  forward anyway. Regular/elite losses permanently close that node,
  giving a second, distinct run-ending condition (no route forward
  remains) alongside Heat-maxing and gatekeeper/boss death.
- ~~Subroutine acquisition flow + loadout size/slot limit~~ — done,
  session 7: combat rewards + shop (currency "Data") + events (probable,
  undesigned); reward pool scoped to class archetypes + universal
  subroutines; capped installed loadout + owned bench, exact number
  TBD; slot cap growable via meta-progression.
- ~~Class specialization (which pairings become classes + identities)~~
  — done, session 8: 6 classes designed (Breacher, Blackhat, Saboteur,
  Operator, Warden, Ghost), Breacher starting/Ghost last in unlock order.
  Starting loadouts remain a separate, still-open item below.
- ~~Each class's starting loadout~~ — done, session 12: the first 18
  concrete named subroutines in the game (3 per class — 1 per specialized
  archetype + 1 thematic Cantrip). Structure revised mid-session from an
  original 4-per-loadout (2 per archetype) draft after user pushback
  that it left too few open slots; two onboarding/balance fixes applied
  (Session Lock's trigger changed off a buildup-requiring one since
  Breacher is the intro class; Low Profile given a Heat floor so a Ghost
  player can't grind Heat pressure away entirely).
- Class unlock order for the middle four (Blackhat, Saboteur, Operator,
  Warden) — not specified.
- ~~Each class's mild starting passive~~ — done, session 11: Foothold
  (Breacher), Zero Day (Blackhat), Sleeper Cell (Saboteur), Primed
  (Operator), Feedback Loop (Warden), Return to Sender (Ghost — the one
  doing real structural work, fixing the damage-access gap rather than
  just adding flavor).
- ~~Suit re-theming and suit-archetype pairing~~ — done, session 6:
  suits named identically to archetypes (Exploit/Malware/Encryption/
  Root), each with an icon (Bug/Skull/Padlock/Crown) and color (Red/
  toxic Green/Blue/Gold). Crown and Exploit's exact hue both flagged as
  open to later refinement, not blocking.
- ~~Subroutine tags~~ — done, session 10: 5 starting tags (Trap,
  Backdoor, Firewall, Worm, Daemon), classified by effect mechanism/
  timing rather than flavor, orthogonal to archetype and independent of
  class specialization, multi-tag-per-subroutine allowed, extensible
  set. Specific passive designs that hook into tags still not written.
- **Banked idea, not yet designed**: a future ability/class passive that
  lets the player bypass a closed/lost node, turning a normally-permanent
  failure into a recoverable one for specific builds. Noted session 9,
  explicitly "idea space to explore."

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
continuous map; per-layer gatekeeper/boss encounters. **Requirement from
session 9**: map generation must guarantee enough redundant routing per
layer that permanently losing one regular/elite fight can't easily
soft-lock a run (the "no route forward remains" loss condition needs to
stay a real-but-rare outcome, not a near-certainty).

## Phase 4 — Meta-progression

Classes, subroutine unlock pool, Ascension-style difficulty, in-run
passive item pool.

## Phase 5 — Content & polish

Additional subroutines/classes/enemy rosters/contract targets, balance
pass, suit/subroutine art.
