# crib.exe — Backlog

Phased roadmap. First pass, written at the end of session 1, updated end
of sessions 2-17 — expect this to be revised as design and implementation
proceed. See `DESIGN.md` for the settled design and its own Open
Questions section.

**Standing principle for every phase below (session 14, see `DESIGN.md`
Architecture)**: game logic stays fully separate from the UI and must be
simulable/testable headlessly — the UI is a thin interface onto the
engine, never a load-bearing piece of it. Phase 1's own "testable as a
standalone engine" note already implied this for itself; it's now a rule
for Phases 2-5 too, not just Phase 1.

## NEXT SESSION

**Phase 2 now has a real spec** (session 17, six checkpoints — see
below), same treatment session 15 gave Phase 1. Next up is actual
implementation, a `/dev-session`. Phase 0 is down to a single banked
idea (node-bypass ability, session 9), not blocking.

## Phase 0 — Remaining design passes

Each of `DESIGN.md`'s Open Questions is its own dedicated design/decision
session before the implementation phases below can be fully scoped:

- ~~The 4 subroutine archetypes~~ — done, session 2: Exploit, Malware,
  Encryption, Root.
- ~~Subroutine effect design space + enable-condition catalog~~ — done,
  session 3: 2 resources (Heat, Breach/Containment), full payload catalog
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
- ~~Exactly how a lost Breach/Containment duel translates into Heat gained~~
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
- ~~Class unlock order for the middle four~~ — done, session 13:
  Breacher → Blackhat → Warden → Saboteur → Operator → Ghost, a
  complexity ramp that also staggers when each archetype first appears
  (Root doesn't show up until Saboteur, the 4th class).
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

## Phase 1 — Core Cribbage engine ✅ complete (session 16)

Implemented in `src/engine/`: `rng.ts` (seeded PRNG), `cards.ts`/
`deck.ts` (generic card model, shuffle), `deal.ts` (deal, discard-to-
crib, cut, his heels), `pegging.ts` (the full play phase — 15s, pairs
through double-pairs-royal, runs incl. out-of-order, exact 31, go/last-
card), `scoring.ts` (hand + crib counting — fifteens, pairs, runs incl.
double/triple runs, flush with the hand-vs-crib distinction, his nobs),
`game.ts` (`playHands()` — the full deal→peg→count→alternate-dealer
loop). 49 tests passing, all 8 session-5 scoring categories + the
consecutive-go and exact-31-vs-go edge cases covered, verified via
`npm run check` (clean) throughout. Deliberately has no target-score/
winner concept — that's Breach/Containment's job (Phase 2+), not this
engine's.

**Rules scope (as originally spec'd)**: standard-rules, 2-player Cribbage, no game theming at
all — no Heat, Breach/Containment, subroutines, archetypes, classes, or map,
that's Phase 2+. Deal 6 cards each, discard 2 to the crib, cut the
starter (including **his heels** — dealer scores 2 if the starter is a
Jack; easy to miss since it's not spelled out here, but session 5's
occurrence-trigger catalog requires it), pegging phase with full scoring
(15s, pairs through pairs-royal/double-pairs-royal, runs, exact 31,
go/last-card), then count and score the non-dealer's hand, the dealer's
hand, and the crib (15s, pairs, runs, flush, **his nobs**), alternate
dealer, repeat. Cards represented generically — rank + one of 4 generic
suit slots, no suit-as-archetype theming yet.

**Project structure**: single Vite/Svelte app, engine as a plain-TS
`src/engine/` subdirectory — see `DESIGN.md` Architecture for why this
isn't a workspace/monorepo split the way glyphrogue is structured.

**Testing approach**: Vitest; a seedable/injectable RNG from the start,
since testing by script means wanting deterministic, repeatable games,
not true randomness; two scripted players that make *legal* moves
deterministically for testing purposes — they don't need to play *well*,
real strategic play is a Phase 2+ AI concern, not a Phase 1 rules-
correctness concern.

**Exit criteria**: a fully rules-correct 2-player Cribbage engine,
verified by automated tests covering all 8 scoring categories from
session 5 (Fifteen, Pair, Run, Flush, His Nobs, His Heels, Thirty-One,
Go) plus edge cases (consecutive "go"s, exact-31 vs. under-31 last-card
scoring), playable end-to-end via two legal-move scripted players with
zero UI involved.

## Phase 2 — Combat wrapper

**Scope (session 17)**: builds the *full* generic trigger/payload type
system matching `DESIGN.md`'s complete catalog — not the narrower
"cooldown + suit-tally to start" originally sketched in session 1, which
predates sessions 3-12's full design and would leave 15 of the 18 real
starting-loadout subroutines unusable. Infrastructure-complete,
content-partial: only a small representative set of payload effects gets
implemented for testing, not all 18 subroutines with tuned numbers —
that's a later content-focused pass. Out of scope: Heat (a consequence of
a resolved duel, not part of resolving one), map/run structure, loadout-
management UI, class selection, real AI strategy (enemy stays a
legal-not-good scripted player, same as Phase 1).

**Checkpoint A — Pegging event categorization** (a Phase 1 touch-up):
extend `pegging.ts`'s `PegPlayEvent` with a categorized breakdown
(`{ fifteen, pair, run, thirtyOne, total }`, mirroring `scoring.ts`'s
existing `HandScoreBreakdown` shape) instead of just a summed `score`.
Additive — `game.ts`'s `playHands()` behavior and existing tests must be
unaffected; verify with a regression run.

**Checkpoint B — Type system**: `Archetype` union (Exploit/Malware/
Encryption/Root) + a suit-to-archetype mapping; a `TriggerFamily`
discriminated union covering all 6 families (Accumulator; Occurrence
with Instant/Threshold/Scaling variations and the 8 session-5 categories;
Enemy-state; Self-state; Chained; Always) plus the orthogonal `Togglable`
flag; a `PayloadEffect` discriminated union covering the full payload
catalog per archetype (Exploit's 4 sub-types, Malware's 2, Encryption's
4, Root's 3); a `Tag` union (Trap/Backdoor/Firewall/Worm/Daemon); a
`SubroutineDefinition` type combining archetype + trigger + payload +
tags + name.

**Checkpoint C — Trigger evaluation + runtime state**: per-subroutine
runtime state (accumulated progress, banked occurrence count, ready
flag, toggled-on/off); a function updating that state from an incoming
categorized scoring event and reporting readiness. A small representative
set of test subroutines — one or two per trigger family, not all 18 —
enough to exercise the evaluation logic without needing final content.

**Checkpoint D — Initiative gauges + Breach/Containment**: a per-side gauge
that accumulates from that side's own scoring and resets + flags a turn
on crossing its threshold; the shared Breach/Containment push/pull meter,
detecting resolution at either extreme.

**Checkpoint E — Fire-on-turn resolution**: on a side's turn, iterate
their loadout top-to-bottom, fire every subroutine that's both ready and
not toggled off, resolve payloads against Breach/Containment or the opposing
side's state, respecting chaining between subroutines in sequence (one
buffing the next, or feeding a later one's condition).

**Checkpoint F — Combat orchestrator**: extract `game.ts`'s per-hand body
into a shared `playOneHand()` — Phase 1's `playHands()` must keep its
exact existing behavior and pass its existing tests unchanged, a real
regression risk worth being careful about. New `combat.ts`'s
`playCombat()` loops `playOneHand()`, feeding both sides' gauges and
subroutine state, firing subroutines on turns, continuing until
Breach/Containment resolves (not a fixed hand count); returns the winner and
a full event log.

**Exit criteria**: a working combat duel — two loadouts (using the small
representative subroutine set from Checkpoint C, not all 18) fight via
real Cribbage play, initiative gauges correctly gate turns, ready
subroutines fire in loadout order with correct chaining, Breach/Containment
correctly resolves the duel, all verified by automated tests, zero UI,
zero regression in Phase 1's existing test suite.

## Phase 3 — Network-map / run structure

Node-map rendering as an actual network diagram; layered breach structure
(perimeter/DMZ → internal LAN → secured subnet → core) within one
continuous map; per-layer gatekeeper/boss encounters. **Requirement from
session 9**: map generation must guarantee enough redundant routing per
layer that permanently losing one regular/elite fight can't easily
soft-lock a run (the "no route forward remains" loss condition needs to
stay a real-but-rare outcome, not a near-certainty). **Banked idea from
session 18**: traversal will allow backtracking, so it needs a pressure
valve — a minimum Heat gain per node hit, revisits included — or
routing around a Containment loss becomes a free undo (see DESIGN.md
Map & Run Structure).

## Phase 4 — Meta-progression

Classes, subroutine unlock pool, Ascension-style difficulty, in-run
passive item pool.

## Phase 5 — Content & polish

Additional subroutines/classes/enemy rosters/contract targets, balance
pass, suit/subroutine art.
