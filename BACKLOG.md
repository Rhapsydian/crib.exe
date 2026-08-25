# crib.exe — Backlog

Phased roadmap. First pass, written at the end of session 1, updated end
of sessions 2-18 — expect this to be revised as design and implementation
proceed. See `DESIGN.md` for the settled design and its own Open
Questions section.

**Standing principle for every phase below (session 14, see `DESIGN.md`
Architecture)**: game logic stays fully separate from the UI and must be
simulable/testable headlessly — the UI is a thin interface onto the
engine, never a load-bearing piece of it. Phase 1's own "testable as a
standalone engine" note already implied this for itself; it's now a rule
for Phases 2-5 too, not just Phase 1.

## NEXT SESSION

**Phase 4 is now complete** (session 22, all 6 checkpoints — see below).
All 78 subroutines are real data, all 6 classes are selectable with real
starting kits/passives, and the full acquisition loop (combat rewards,
bench/install, Merge, Shop) resolves for real. The balance sweep is also
now done (session 22, see Phase 5 below): 500/500 victories under
default settings, and a control sweep proved this isn't acquisition —
it's checkpoint A's enemy-magnitude retune (done for test-suite speed,
not real balance) leaving even a static starting kit unbeatable. Next
session should start real enemy tuning (own numbers, not "resolves in
the test suite's time budget") plus a per-layer difficulty ramp — see
Phase 5's fuller writeup for what a re-sweep after any retune needs to
watch for. Phase 0 is down to a single
banked idea (node-bypass ability, session 9), not blocking.

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

## Phase 2 — Combat wrapper ✅ infrastructure complete, content-partial (session 18)

Implemented across `src/engine/`: `pegging.ts` (Checkpoint A's
categorized breakdown), `subroutine-types.ts` (Checkpoint B's full type
system), `triggers.ts` (Checkpoint C's evaluation + runtime state, plus
a mid-session revision reworking `scoring.ts` to expose discrete
`countHandEvents`/`countCribEvents` instead of lumped totals),
`gauges.ts` (Checkpoint D's initiative gauges + Breach/Containment, with
the same revision adding overflow carry-over and multi-turn crossings),
`resolve.ts` (Checkpoint E's payload dispatch + fire-on-turn
resolution), and `combat.ts` (Checkpoint F's orchestrator, plus
`game.ts`'s `playOneHand()` extraction). 101 tests passing (from 49),
`npm run check` clean throughout. A full duel between two loadouts
resolves via real Cribbage play with zero UI — every item in this
section's exit criteria met, using the small representative subroutine
set per the "infrastructure-complete, content-partial" scope below;
wiring the real 18 starting-loadout subroutines is a later content pass.
Also renamed Control/Breach to **Breach/Containment** throughout (see
`DESIGN.md` Resources) and introduced **Quarantine** for gatekeeper/boss
losses specifically.

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

## Phase 3 — Network-map / run structure ✅ complete (session 20)

Scoped session 19 (`/decision-session`, same engineering-scoping category
as sessions 15 and 17). A headless, real-scale (4-layer), free-roam
network-map/run-structure engine in `src/engine/`, wiring Phase 2's real
`playCombat()` into fight nodes and implementing Heat for the first time.
Out of scope: SVG/DOM rendering (a future UI phase — `DESIGN.md`'s "reads
as an actual network diagram" goal is honored there, not here); Merge/
Shop/Event's real payloads (need Phase 4's material/acquisition/Data
systems — stub node types only); exclusive-branch junctions and other
map-variety ideas (Phase 5); real AI (still Phase 2's legal-not-good
scripted opponent).

**Free-roam intra-layer movement, one-way between layers** (session 19,
a deliberate further deviation from StS, FTL-flavored — see `DESIGN.md`
Map & Run Structure): within a layer, the player has a position on a
persistent node graph and can traverse any connected edge, any direction,
any number of times, at a flat Heat cost per move. Crossing a layer's
gatekeeper is one-way — the previous layer's graph becomes unreachable.
This subsumes what were three separate open items as of session 18: it's
what the banked backtracking-pressure-valve idea actually was; it
reframes session 9's redundancy requirement from branching-tree
redundancy into graph-resilience (the generator must keep the gatekeeper
reachable from the player's position as nodes close); and there's no
separate "backtracking" mechanic to design, since movement is just
movement. Exclusive-branch junction nodes remain deferred to Phase 5,
now reframed as a future edge-removal event rather than a node property,
and no longer load-bearing for the soft-lock problem.

- **Checkpoint A — Graph data model & node types**: node type union
  (RegularFight, GatekeeperFight, Safehouse, Shop, Event, Relay), node
  state (unresolved / inert / closed — Relay has no state, always
  passable), edge list, per-layer graph shape, a cursor/position type
  (naming TBD).
- **Checkpoint B — Layer generation**: a generator parameterized for the
  real 4 layers (perimeter/DMZ, internal LAN, secured subnet, core) and a
  node count per layer (exact numbers TBD/playtesting), producing a
  connected graph with a designated entry and gatekeeper exit, verified
  via a generate-then-check-resilience approach (gatekeeper stays
  reachable from any position after node closures up to a documented
  threshold; regenerate/patch on failure, adding Relay nodes as cheap
  extra connectivity rather than inflating encounter density) rather than
  a hand-proved topology guarantee.
- **Checkpoint C — Heat resource**: accumulation from two sources —
  duel-loss margin (session 9's existing formula) and flat per-move cost
  (session 19, new) — plus a max threshold triggering the Heat
  run-ending condition.
- **Checkpoint D — Traversal/movement**: legal moves = edges from the
  current position to any still-connected (non-closed) node, any
  direction, repeatable; applies Heat cost per move; marks nodes
  inert/closed on resolution; detects a gatekeeper crossing and locks the
  previous layer's graph (one-way).
- **Checkpoint E — Node encounter resolution**: fight nodes call Phase
  2's `playCombat()` (small representative subroutine set, not the real
  18) and translate the outcome — win → inert; loss on a regular/elite
  node → closed (impassable); loss on a gatekeeper → Quarantine, immediate
  run end. Safehouse resolves Rest (real Heat reduction) or Merge (stub,
  structurally offered but never selectable yet); Shop and Event resolve
  as inert no-ops (stubs). Relay needs no resolution logic at all — it's
  never anything but passable.
- **Checkpoint F — Run orchestrator**: ties all 4 generated layers
  together (generate → free-roam explore/fight → beat gatekeeper →
  advance), detects and independently tests all three run-ending
  conditions (Heat max; Quarantine; gatekeeper unreachable/no route
  remains), full event log, playable end-to-end by script via a
  legal-not-good scripted traversal decision function, mirroring Phase
  1/2's scripted-player pattern.

**Exit criteria**: a full 4-layer run resolves headlessly by script — the
generator's resilience guarantee holds, the cursor moves freely within a
layer at a flat Heat cost per move, fight nodes resolve via real Phase 2
duels, Safehouse's Rest is real while Merge/Shop/Event are inert stubs,
closed nodes are genuinely impassable, gatekeeper crossings lock the prior
layer, and all three run-ending conditions are independently reachable
and covered by tests; zero UI; zero regression in Phase 1/2's existing
test suites.

**Implemented session 20** (`/dev-session`, all 6 checkpoints, 154 tests
passing from 143). Mid-implementation, the user restored a 3rd fight
tier — **eliteFight** — that session 19's node-type list had dropped
despite `DESIGN.md`'s Heat formula always assuming one: tougher enemy
loadout (empirically tuned to ~23% player win rate vs. ~60% for a
regular fight, since Breach/Containment turned out to be a sharp
positive-feedback race where even a small per-fire edge compounds hard),
a higher Heat-on-loss base, and a `rewardTier` stub (`standard`/
`better`/`none`) marking wins as reward-eligible for Phase 4. A 25-seed
sweep with an aggressive "fight everything" strategy found `noRouteRemains`
dominates (96%) rather than `heatMaxed` — a real, intended consequence of
the resilience guarantee only promising safety against *one* closed node,
not several at once, not a bug. A separate 500-seed sweep under default
settings found only a 3.8% victory rate; see Phase 5 below for why that's
expected (a static, un-upgradeable test loadout), not a Phase 3 defect.

## Phase 4 — Meta-progression (classes + acquisition) ✅ complete (session 22)

Scoped session 21 (`/decision-session`, same engineering-scoping category
as sessions 15/17/19). Of the four things the original one-line sketch
bundled (classes, subroutine unlock pool, Ascension difficulty, in-run
passive items), only **Classes** (sessions 8/11/12/13) and **Subroutine
Acquisition** (session 7) are actually designed — Ascension and the
expanding passive-item pool are still "broad strokes only" in
`DESIGN.md` and need their own future `/decision-session` before they're
buildable; both move to Phase 5 alongside other undesigned content, same
treatment Phase 5 already gives additional subroutines/classes/rosters.

Also finally gives Phase 3's stubbed **Merge** and **Shop** nodes real
behavior — they were left inert specifically because this phase's
systems didn't exist yet.

**Two real gaps this session closed** (neither had ever been designed,
not just left as implementation detail):
- **Data's source** (`DESIGN.md` Subroutine Acquisition): awarded on
  every combat win, scaled by encounter tier via Phase 3's `rewardTier`
  stub — same tier-scaling shape as Heat's existing loss formula,
  independent of the subroutine-reward choice.
- **No cross-run persistence** (`DESIGN.md` Architecture): nothing
  through Phase 4 remembers state between separate `playRun()` calls.
  Classes' designed unlock order (session 13) is recorded as intended
  future gating, not enforced — all 6 classes ship immediately
  selectable as a run-setup parameter. A save/profile layer is distinct,
  unscoped infrastructure, not this phase's job.

**Reward-pool content**: reuses the real 18 starting-loadout subroutines
from session 12 as-is (each archetype already has 3 distinct named
subroutines across sibling classes, e.g. Breacher's pool can offer
Blackhat's *Payload Drop* and Operator's *Precision Strike*, both
Exploit) plus the 6 universal Cantrips — no new subroutine content this
phase. A class's own already-owned pieces stay in its reward pool too
(drawing one becomes Merge material, not a wasted offer — see
Checkpoint E). A genuinely larger, purpose-authored subroutine pool is
Phase 5 content work, not required to exercise this phase's machinery.

**Starting passives**: the 6 (Foothold, Zero Day, Sleeper Cell, Primed,
Feedback Loop, Return to Sender) are heterogeneous one-off effects, not
instances of a shared pattern the way subroutine triggers/payloads are —
hand-coded as discrete hooks into combat resolution, not a generic
passive framework. Building generic passive-hook infrastructure now,
before Phase 5's actual passive-item pool exists or is even designed,
would be speculative — revisit genericizing if/when that pool is
designed.

- **Checkpoint A — Class type system & content**: `ClassId` union (6),
  `ClassDefinition` (archetype pair, identity text, starting-passive id,
  starting loadout), plus authoring all 18 real `SubroutineDefinition`s
  from session 12 as actual data (currently only prose in `DESIGN.md` and
  a small representative test set from Phase 2) — replaces/supplements
  that representative set. `playRun()`/run-setup takes a `ClassId`
  parameter; all 6 selectable with no unlock gating (per the persistence
  note above).
- **Checkpoint B — Starting passives**: the 6 bespoke hooks wired into
  combat resolution at whichever point each needs (gauge-cross for
  Foothold, Heat-cost waiver for Zero Day, debuff-application for Sleeper
  Cell, Root-fire for Primed, HoT-tick for Feedback Loop, counter-push for
  Return to Sender), each active only for its own class.
- **Checkpoint C — Data & combat rewards**: Data awarded per win, tiered
  via `rewardTier` (session 21 decision above); a subroutine-choice reward
  (pick 1 of N — exact N TBD/playtesting, same treatment as other numeric
  TBDs) drawn from the reward-pool scoping already in `DESIGN.md`
  (primarily the class's 2 archetypes + universal, weighting exact TBD).
- **Checkpoint D — Bench & installed loadout**: per-player `bench`
  (owned, uninstalled) vs. `installed` (active, evaluated each fight,
  capped) collections; between-fights install/uninstall/reorder (session
  3 — mid-combat stays Togglable-only, unchanged); slot cap as a
  run-setup parameter, exact number TBD/playtesting (6 floated as flavor
  only, per session 7).
- **Checkpoint E — Duplicate material & Merge**: acquiring an
  already-owned subroutine becomes bench material instead of a second
  installed-ineligible copy; Merge node (Phase 3 stub) becomes real —
  spends material to improve magnitude/efficiency only (bigger payload,
  lower threshold, higher Scaling cap), never payload sub-type or trigger
  family; rank-capped, exact cap TBD.
- **Checkpoint F — Shop wiring**: Shop node (Phase 3 stub) becomes real —
  spend Data on a specific pick from a randomized slate (3 commons, 1
  uncommon, 1 uncommon-or-rare wildcard) drawn from the same reward-pool
  scoping as Checkpoint C, not the whole pool at once (revised after the
  checkpoint landed -- offering everything up front made Data a
  non-choice once a player could afford anything). One reroll per visit
  for a marginal Data cost (REROLL_COST), for a shot at a better slate.

**Exit criteria**: a full 4-layer run resolves headlessly by script with
any of the 6 classes selected — starting loadout and starting passive
both functioning from turn one; combat wins grant tiered Data plus a
subroutine reward choice; bench/installed loadout management works
between fights; duplicate acquisitions become Merge material; Merge and
Shop nodes resolve for real, no longer inert stubs; all covered by
automated tests; zero UI; zero regression in Phase 1-3's existing test
suites. Once this lands, re-run session 20's `playRun()` outcome-
distribution sweep (see Phase 5 below) as the first real balance
check — a static loadout no longer applies once acquisition exists.

## Phase 5 — Content & polish

Additional subroutines/classes/enemy rosters/contract targets, balance
pass, suit/subroutine art. Also now owns two systems deferred from Phase
4 for being undesigned, not just unbuilt — **Ascension-style difficulty**
and the **expanding in-run passive-item pool** — each needs its own
`/decision-session` design pass before it's implementation-ready.

**Balance-pass context from Phase 3's own sweep (session 20)**: a
500-seed sweep of `playRun()` under default settings (`beelineToGatekeeper`,
no exploring or resting) found only a 3.8% victory rate — 63.6%
quarantined, 32.6% no route remains, averaging 0.75/4 layers cleared.
Not a Phase 3 defect: Phase 3's player loadout is a small, static
representative set that never improves across a run (no acquisition
system exists yet), so surviving reduces to four independent, un-upgraded
coin-flips against each layer's gatekeeper — exactly the compounding
attrition you'd expect with zero character growth in between. It does
mean a real balance pass can't happen until Phase 4's acquisition system
(combat rewards, Merge, Shop) exists and the player's loadout can
actually grow run-over-run. Re-run the same measurement (`playRun()`'s
outcome distribution across many seeds) once Phase 4 lands, as a
concrete, repeatable check rather than tuning purely by feel — a
static-loadout sweep like this one won't reflect real play.

**Open finding from Phase 4 checkpoint A — Breach/Containment can
stalemate indefinitely, not just in tests**: wiring in a real class kit
confirmed session 20's sharp-positive-feedback finding cuts both ways —
a defense-heavy kit (Breacher's capped Session Lock/Steady Hand pair)
against a mild enemy doesn't just converge slowly, it can fail to
resolve at all within tens of thousands of hands, regardless of the
player's own offensive magnitude. This is a real engine gap, not only a
test-construction inconvenience (which was worked around separately —
see encounters.test.ts/run.test.ts). Candidate fix, suggested during
checkpoint A: an escalation effect that kicks in after some number of
turns/hands (a tiebreak push, a shrinking cap, rising stakes — exact
mechanism TBD) to guarantee a match resolves in bounded time. Needs its
own design pass — it changes actual combat feel, not just tuning
numbers — so it's a Phase 5 balance-pass item, not something to bolt on
mid-Phase-4.

**Phase 4 balance sweep (session 22)** — re-running session 20's
measurement now that acquisition is real: 500 seeds, default settings
(Breacher, `beelineToGatekeeper`), **100% victory** (was 3.8%), 4.00/4
layers cleared every time, averaging ~172 final Data and ~7.7 pieces
owned by run's end.

The obvious read — "acquisition fixed it" — is wrong. A control sweep
with `acquisitionStrategy: () => null` (declines every reward, so the
loadout never grows past the starting 3 pieces, matching session 20's
own static-loadout conditions exactly) *also* scored 100%/500, 4.00/4
layers. Acquisition isn't the driver here at all — something already
made a bare starting kit unbeatable, independent of growth.

The real cause: checkpoint A's enemy-magnitude retune. Session 20's
3.8% baseline used the pre-Phase-4 enemy tuning (regular=5, elite=5.3,
gatekeeper reusing regular); checkpoint A lowered this to 2.5/2.55/2.8
specifically because that old tuning left a *real* class kit on a
near-guaranteed loss against Breach/Containment's sharp positive-
feedback dynamics (see that checkpoint's own commit message). That
retune fixed winnability but was never a real balance pass — it was
done to get the test suite itself resolving in reasonable time, and
BACKLOG.md flagged exactly this at checkpoint A: "making Regular
genuinely competitive, not just winnable, is Phase 5's job." This
sweep is the first measurement confirming how far off that landed —
not close to competitive, essentially free.

Two real, separable problems for Phase 5, not one: (1) enemy magnitudes
need genuine per-fight tuning distinct from "resolves in the test
suite's time budget," almost certainly needing to be substantially
higher than the current 2.5/2.55/2.8 given a bare starting kit already
clears them 100% of the time; (2) there's still no per-layer difficulty
ramp at all (`ENEMY_LOADOUT_GATEKEEPER` is one flat constant regardless
of layer), so even after (1), a run that lets the loadout grow across 4
layers needs the back half to actually ask more of the player than the
front half. Re-sweep after any retuning attempt, same as this one —
the chaotic convergence-time behavior already on record here means
tuning by feel alone won't reliably land in a genuinely competitive
zone. Only Breacher was swept (the default class); the other 5,
especially Ghost ("the most challenging to play," per DESIGN.md), are
still unmeasured and may tell a different story.
