# crib.exe — Design

A browser-based, hacking-themed roguelite in the Slay the Spire mold —
node-map run structure, permadeath, meta-progression between runs — where
combat is resolved by playing real Cribbage instead of the usual
attack/skill/power card battles.

Status: the engine is complete through Phase 5's systems, with no UI
yet. Session 51 redesigned the archetypes and the subroutine model from
scratch (see Archetypes & Subroutines); that redesign is decided but not
yet implemented. This doc is the source of truth for settled design.
Working decision records live in `docs/` (`archetype-redesign.md`,
`run-economy-design.md`); sections superseded by session 51 are archived
verbatim in `docs/design-history.md`. See `BACKLOG.md` for open work and
`docs/session-logs/` for the session-by-session history.

## Concept

You play a hacker taking on "contracts" — each run targets one network,
breached layer by layer, with combat encounters against the network's
defenses (and eventually a rival hacker/AI) resolved as head-to-head
Cribbage matches. Deckbuilding isn't about which card to play on your
turn — it's about which automatic subroutines you've installed, in what
order, and how well you can actually play Cribbage to trigger them.

## Resources

Two deliberately separate resources, not one shared health stat:

- **Heat** — a persistent, run-spanning resource belonging only to the
  player (enemies don't persist across fights, so this is player-only by
  nature). It's a *rising* danger meter, not a depleting health bar: Heat
  accumulates toward a max (getting caught/burned) rather than draining
  from full to zero. This is what gives the run its StS-HP-equivalent
  branch-selection friction — rest vs. push forward, risk vs. reward map
  choices. Needs a player-facing note somewhere in the eventual UI/copy
  explaining the "too much heat" idiom the name leans on. **Heat gained
  on a lost duel** = a flat amount set by encounter tier — a regular loss
  costs a chunk, an elite loss much more, so choosing to take a fight is
  a legible risk/reward decision priced by what the fight is worth.
  Session 50 removed the margin-of-loss adjustment this used to carry
  (Heat scaled by how close the player's own gauge got to winning). It
  read well on paper and worked against the resource's own transparency
  rule below: peak gauge fill is not surfaced to the player, so two
  apparently identical defeats charged different Heat for reasons they
  could not see or plan around. It also discounted the two loss kinds
  unequally by accident — attrition losses carry high player gauge fill
  by construction, so they were discounted hardest. Exact numbers
  TBD/playtesting, same treatment as other unresolved tuning values. See
  Map & Run Structure for what a lost duel means structurally, including
  why gatekeeper/boss losses bypass Heat entirely and end the run
  outright. **A second, independent accumulation source (session 19)**:
  every map-node move costs a flat amount of Heat (also TBD/playtesting),
  regardless of direction or destination — see Map & Run Structure's
  free-roam movement model. **A third source (session 47)**: Trace
  carried out of a fight, below.
- **Trace** (session 47) — in-fight noise, and the *only* Heat-adjacent
  quantity that exists inside combat. It starts at 0 every fight, is
  raised by subroutines that make noise (a Credit beta that hits harder
  but costs Trace is the main source — see Archetypes & Subroutines),
  lowered by subroutines that cover your tracks, and **converts to Heat when the
  fight ends**. So Trace is not a second resource competing with Heat;
  it is the fight's pending contribution to it, and reducing Trace
  before the fight ends genuinely denies the run that Heat.

  Trace exists as a named concept because the engine already had this
  accumulator and called it `heat`, which caused real bugs: the
  `heatAbove`/`heatBelow` triggers read it while their names, thresholds
  and content all implied run Heat, leaving `heatBelow` true at the start
  of essentially every fight and `heatAbove` near-dead (session 46
  diagnosis).

  **Why triggers read Trace and not run Heat.** Run Heat cannot change
  during a fight — nothing inside combat touches it — so a run-Heat
  condition would be a constant for a fight's whole duration, which is
  exactly the "always fires or never fires" degeneracy the split is meant
  to remove. Trace moves mid-fight, so a threshold on it is a real,
  evolving state: `traceBelow` reads as *"while I'm still quiet"* and
  `traceAbove` as *"once I've made noise"*. A piece that both reads and
  writes Trace self-limits — it fires until it makes itself too loud —
  which is a player-visible, thematically legible limiter that also
  interacts with Trace reduction, unlike a hard per-combat fire cap.
  Adapting a loadout to the *run's* Heat level remains a real design
  space, but it belongs to between-fights loadout choices rather than
  per-turn triggers.

  **Trace is player-only**, like Heat itself (session 43: "risk has no
  enemy-side analog at all"). Enemies never accumulate it.
- **Breach/Containment** — an in-combat-only pair of independent
  per-side gauges (session 22+ redesign — originally a single shared
  push/pull meter, revisited once that design proved to be the root
  cause of sharp, chaotic convergence behavior: a shared zero-sum scale
  means any push toward one side's win is mechanically erosion of the
  other's remaining margin, producing runaway acceleration once either
  side pulls ahead, and made a defense-heavy kit against a mild enemy
  capable of genuinely never resolving). Each side races toward its own
  win, filled only by that side's own offense. **Breach** is the
  attacker's own gauge — reaching it means the vulnerability gets
  successfully exploited and the node falls. **Containment** is the
  defender's own gauge — reaching it means the target's security closes
  around the exploit before it can be leveraged, and that specific route
  into the node stops being viable (see Map & Run Structure for what
  this means concretely — a closed node to route around on a
  regular/elite loss, or full **Quarantine** — the player's presence
  purged from the whole network — on a gatekeeper/boss loss).
  The Credit verb fills the caster's *own* gauge, never the
  opponent's; Suppress instead reduces the *opponent's* gauge directly
  (an active counter-suppression, not a push on a shared value), and
  Ward absorbs the opponent's incoming progress before it lands — which
  makes "mitigation can't win alone" a free structural property, since
  only a side's own offense can ever advance its own gauge. (That
  property is also why every archetype must carry a credit path — see
  the credit rule under Archetypes & Subroutines.) Both
  gauges reset each combat. **Escalation**: once a match runs long
  enough, both sides' own thresholds gradually shrink each subsequent
  hand (floored, never to zero), guaranteeing a slow-moving fight still
  resolves in bounded time rather than dragging on indefinitely.

## Combat System

Combat is a real, standard 2-player game of Cribbage played against the
enemy (AI-controlled), on a single shared board — not two players
scoring independently in parallel. This preserves actual Cribbage skill
(denying your opponent points, forcing a bad "go") and reads as a genuine
duel rather than a race against a meter.

**Flow**: deal 6 cards each → each player discards 2 to the crib → cut
the starter card → play the pegging phase (lay cards alternately, score
15s/pairs/runs/31/go as normal) → count and score the non-dealer's hand,
then the dealer's hand, then the crib (dealer's) → dealer alternates →
repeat. A real 52-card deck is played by standard rules — this is
distinct from the player's subroutine loadout described below.

**Action economy**: each side (player, enemy) has its own initiative
gauge, filled only by points that side scores (pegging, hand, crib —
standard per-player attribution). When a side's gauge crosses its
threshold, that side's gauge resets to 0 and that side gets a turn.

**Turn resolution — subroutines**: a player's "deck" is a persistent,
ordered loadout of subroutines (not a hand of cards you draw/discard/
play manually — deliberately not StS's cycling-hand model, to avoid
stacking a second randomness layer on top of Cribbage's own card luck).
When a side's turn happens (initiative threshold crossed), *every*
subroutine on that side fires its **alpha**, and each whose criteria are
met also fires its **beta** (session 50's D11, redesigned in session 51
— see Archetypes & Subroutines). Effects resolve against
Breach/Containment, the initiative gauges, other subroutines, or the
Cribbage layer.

Loadout order matters: subroutines resolve top-to-bottom like a script,
and Sequence betas reward specific arrangements (adjacent and any-prior
chains). Order is adjustable between fights only — there is no
mid-combat lever. (Session 51 removed Togglable, the old mid-combat
on/off switch; it needed a pausable engine that does not exist, and its
one real use was switching off a Heat-costing piece.)

## Archetypes & Subroutines (session 51 redesign)

Redesigned from scratch in session 51 (`/decision-session`, full record
with reasoning in `docs/archetype-redesign.md`, decisions A1–A11),
building on session 50's per-turn model (`docs/run-economy-design.md`
D11–D15). Everything this replaces — the Exploit/Malware/Encryption/Root
archetypes, the 22-kind payload catalog, the 8-family trigger catalog,
tags, the Neutral archetype, the old classes and loadouts — is archived
verbatim in `docs/design-history.md`.

**Status: designed, not implemented.** The engine still runs the old
model. Implementation order (A10): engine refactor → recalibrate the
pillar suite against the new verbs → author content. Every magnitude is
unpriced until the pillar calibration says what an alpha and a beta are
each worth.

### Why it was redesigned

Two structural lessons, each paid for more than once:

- **Archetypes were defined by role and flavour first, mechanics second.**
  That is how Encryption and Root ended up with no way to credit their
  own gauge (Ghost's 0% in session 28, the session 40 audit), patched
  with a Neutral archetype, three Encryption offense payloads, Session
  Hijack and two Root-only trigger families.
- **Triggers gated whether a piece acted at all**, so rarity silently
  decided *existence*: a flush-triggered piece was dead ~96% of the time
  (session 50, D8). D11 made every subroutine act every turn, with
  triggers modulating power instead; this redesign is the content model
  built on that.

### Anatomy of a subroutine: alpha and beta

Every subroutine has two effects:

- **Alpha** — fires on every turn activation the owning side gets. An
  alpha is one verb (below) at a magnitude, with an optional **growth**
  (+x each time it fires). An alpha may act on neither gauge — "add
  charges to a beta" is a legitimate alpha (the **Charge** verb).
- **Beta** — fires when its criteria are met. It takes one of three
  relationships to the alpha:
  - **Enhance** — the alpha fires stronger ("elevated", D13's term).
  - **Different effect** — a separate effect bundled onto the turn's
    fire.
  - **Immediate** — fires the moment its criteria are met, outside the
    turn gate entirely.

A beta is **one bundle** (D12): it may raise magnitude *and* add a
mechanic, but a piece never stacks several betas. One alpha and one beta
are each independently measurable, which is what keeps pricing
tractable.

Rarity gates **amplitude, never existence** (D11). A common and a rare
both act every turn; the rare's alpha and beta are bigger or its beta
richer.

### Verbs (what an effect does)

Seven verbs, shared by every archetype (A4, A5). Archetype identity lives
in which verbs a piece uses and in its beta, not in archetype-exclusive
effect kinds.

| Verb | Does | Primary user |
|---|---|---|
| **Credit** | fills the caster's own win gauge | every archetype — the offense |
| **Suppress** | pushes the opponent's gauge back | Healing (Daemon) |
| **Ward** | absorbs the opponent's incoming progress until depleted | Defense (Honeypot) |
| **Empower** | boosts other subroutines' output | Empowerment (Overclock) |
| **Tempo** | speeds the caster's initiative or slows the opponent's | Tempo (Overclock), Control (Exploit) |
| **Disrupt** | acts on the Cribbage layer: recon, forced discard | Control (Exploit) |
| **Charge** | adds charges to this piece's or another piece's beta | anyone; feeds betas |

Lasting effects (what the old catalog called debuffs) are durations on
Tempo or Suppress, not a separate kind. Variants of Credit that used to
be their own payload kinds — ignore Ward (old *piercing*), scale off
earlier fires this turn (old *chain-finisher*), bigger but costs Trace
(old *risk/reward*) — are beta modifiers on Credit. Converting banked
Ward into Credit, or taking from the opponent's gauge, are Honeypot
betas.

Removed with no replacement: DoT, HoT and draining-HoT (an alpha already
fires every turn, and the global-pulse cadence — ticking on points
scored by *either* side — was the Quarantine Ward pathology); scheduled
sabotage and hand-lifecycle recon timing (Disrupt may reintroduce them as
betas if Control needs them).

### Beta criteria: source × shape

A beta's criteria are a **source** (what it watches) combined with a
**shape** (how it responds), chosen independently (A5).

| Source | Examples | Archetype affinity |
|---|---|---|
| **Cards** | a scoring category (fifteen, pair, run, flush, nobs, thirty-one, go); the archetype's own suit tally. Optional: whose scoring to watch, minimum magnitude | Exploit |
| **Progress** | own points scored, this piece's fire count, defense absorbed | Daemon, Honeypot |
| **State** | dealer / non-dealer, own Ward size, either side's gauge level | Honeypot, Overclock |
| **Sequence** | what fired before this piece in the loadout (below) | Overclock |

| Shape | Behaviour |
|---|---|
| **Graded** | magnitude grows per banked charge, up to a cap |
| **Stepped** | a distinct effect once N charges have banked |
| **While-true** | active while a condition holds — a condition is a charge of 1 (D15) |
| **Immediate** | fires the moment the criteria are met, outside the turn |

Charges reset when spent, like every fire-then-wait rule before it.
Cut from the old catalog: hand-outcome triggers, His Heels as a trigger
(one occurrence per game, dealer only, outside either player's control),
Trace-threshold conditions (Trace survives as a beta *cost*, not a
criterion), and Togglable.

### Loadout order and chains

Order is a real decision (D13). Pieces fire top to bottom each turn, and
**Sequence** betas come in two strengths:

- **Adjacent** — the immediately prior piece matches an id, archetype,
  verb, source or shape. Hard to satisfy, so the larger beta.
- **Any-prior** — a matching piece fired *elevated* earlier this turn.
  Easier, so the smaller beta.

Six ordered slots with adjacency chains is the build puzzle. Two
consequences carried from D13: drag-to-reorder is a hard UI requirement,
and simulation needs a real `ReorderStrategy` before any chain content
can be measured.

### The four archetypes

Built mechanics-first (A2): four ways to win, four kinds of utility, one
each, then named (A7). Each is still bound 1:1 to a suit (A1) — see
Theming.

| Archetype | Offensive theme | Utility | Signature beta | Typical beta source |
|---|---|---|---|---|
| **Exploit** | **Spike** — big beta moments on Cribbage scoring | **Control** — the Cribbage layer and the opponent's tempo | Enhance (graded) | Cards |
| **Daemon** | **Ramp** — alpha growth; stronger the longer the fight runs | **Healing** — push the opponent's gauge back | Different effect (stepped) | Progress |
| **Overclock** | **Tempo** — win by taking more turns | **Empowerment** — buff other subroutines | Immediate | State, Sequence |
| **Honeypot** | **Conversion** — turn banked defense and the opponent's progress into own progress | **Defense** — stop the opponent's gain before it lands | Different effect | State, Progress |

Each pairing is chosen so the utility serves the offense: Exploit steers
the cards toward its spike; Daemon survives long enough to scale;
Overclock's extra turns multiply its empowered fires; Honeypot's banked
defense *is* its fuel.

Signature shapes are **affinity, not exclusivity** (A3) — the same rule
the old trigger catalog's "primary family" followed.

**The credit rule (A3), archetype-level.** Not every subroutine has to
credit the win gauge, but every archetype must have a reliable way to
win on its own. Checkable form: a kit drawn only from one archetype's
commons, and every class's starting loadout, must contain a real credit
path. This is the rule whose absence produced Ghost's 0%.

**Watch item: Honeypot.** Conversion/Defense is accepted as the
higher-skill-floor archetype, but it is the one most at risk of the old
Encryption failure — defense that never converts. Check it explicitly
when its pieces are authored and when the pillars price them.

### Classes

Six classes, one per archetype pair (A8). Each class passive is a
**bridge** that makes one of its archetypes feed the other — "your A
betas add a charge to your B pieces", or "your A alphas are stronger
while a B beta is active". Passives remain class-exclusive Mods granted
at run start (see Mods).

| Pair | Character |
|---|---|
| Exploit + Overclock | fast spikes; simplest to read — the likely starter |
| Exploit + Daemon | burst early, scale late |
| Daemon + Overclock | accelerated ramp |
| Exploit + Honeypot | hit, then hold |
| Daemon + Honeypot | the patient outlast class |
| Overclock + Honeypot | fast conversion; highest skill floor |

Cutting to fewer classes was considered and rejected: session 49 placed
roughly two thirds of measured class spread in the gatekeeper roster,
not the classes. **Class names, passives and unlock order are not
designed yet** — they wait for real subroutines. Provisional unlock
direction: Exploit + Overclock first, Honeypot pairs late.

Each class specializes in its 2 archetypes for acquisition (see
Subroutine acquisition): rewards draw primarily from them, with
occasional off-class pieces from the other two.

### Starting loadouts

Three pieces (A9): an **offense** piece with a credit path (the credit
rule holds from turn one), a **utility** piece from the other archetype,
and a **bridge** piece that shows off the class passive. That leaves 3
of 6 slots for acquisition, which matters more now that slot order is
the build puzzle. Which archetype supplies offense and which utility is
decided per class when content is authored; for Honeypot pairs, offense
likely comes from the partner archetype, since conversion pays off only
after defense is banked. The old Cantrip slot is retired — under D11
every piece acts every turn.

### Pricing

Not yet known — the open half of this design. The diagnostic pillar
suite (`src/engine/diagnostic-enemies.ts`, `scripts/pillar-check.ts`;
`docs/run-economy-design.md` D9–D14) is re-aligned one pillar per verb
and swept magnitude × frequency to produce the exchange rate between
effect size and fire rate. That rate prices the player pool and the
enemy pool alike, and every production subroutine is authored as a
priced alpha plus a priced beta.

Until then, a **skeleton pool** stands in (A11): one plain piece per
archetype per verb it uses, roughly level numbers, enough to keep
acquisition, Shop, Merge and full simulated runs working. A matching
skeleton enemy roster keeps regular, elite and gatekeeper fights in
runs.

## Map & Run Structure

The node-map is meant to actually read as a network diagram — nodes are
machines/systems, edges are the network links you route through — not an
abstract StS-style icon path with theme applied only via names/art.

One run = one target network (a "contract"), breached in successive
nested layers: perimeter/DMZ → internal LAN → secured subnet → core.
Each layer plays the role of an StS "act" (a gatekeeper/boss system
before the next layer opens; escalating difficulty reads as escalating
security) but all layers render as one continuous, growing diagram
rather than resetting to a new map. Different runs are reskinned as
different named contract targets (a company, an agency, a rival hacker),
which also gives meta-progression a natural "new contract types" hook.

**Movement is free-roam within a layer, one-way between layers** (session
19) — a deliberate further deviation from StS, explicitly FTL-flavored:
within a layer, the player has a position on a persistent node graph and
can traverse any connected edge, in any direction, any number of times,
including back into already-resolved territory. There's no separate
"backtracking" mechanic — movement is just movement. **Every edge
traversal costs a flat amount of Heat** (exact number TBD/playtesting,
same treatment as other unresolved tuning values), regardless of
direction or whether the destination is already resolved — this is what
gives exploring a layer for value (fights, Rest, Shop, Event) its own
FTL-style tension: gathering more before pushing on is always available,
but never free.

This tension is a deliberate design goal, not just flavor text: the
intended ideal path threads a middle ground between beelining straight
for each layer's gatekeeper and fully exploring every node before
moving on. Leaning into either extreme is a real risk/reward tradeoff,
not a mistake to design away. Exploring more of a layer means facing
each gatekeeper with more accumulated power (Data spent, subroutines/
Mods acquired) — but spends more Heat getting there, raising the chance
of maxing out before ever reaching the fight. Beelining past a layer's
regular/elite fights conserves that Heat, banking it as headroom to
explore more freely in a later layer instead — at the cost of facing
that layer's gatekeeper with a thinner kit. Session 35's sweep (see
`docs/roadmap-history.md`) found both pure extremes are worse than this framing
implies neither should be — full beeline concentrates risk into
gatekeeper losses, full explore just trades that for Heat-exhaustion and
no-route losses instead.

**Crossing a layer's gatekeeper is one-way** — the
previous layer's graph becomes unreachable once the next one opens,
mirroring FTL's own one-way-between/free-roam-within sector structure and
keeping the run's state bounded across the 4 layers rather than growing
into one unbounded graph.

**Node types**: **regular fights** and **gatekeeper/boss fights**; a
**Safehouse** node (working name, not final) combining Rest (reduce Heat)
and **Merge** (see Subroutine Acquisition, under Meta-Progression — a
deliberate git/version-control pun that fits the coding/hacking setting
precisely; spends held duplicate subroutine material to upgrade a base
copy) into a single either/or choice, StS-campfire-style; a **Shop** node
(spend Data — see Subroutine Acquisition); an **Event** node (a
narrative vignette with 2-4 choices, each ranging from fully transparent
to a genuine gamble — see Meta-Progression's new "Events" subsection for
the full design). A node becomes **inert** after its
first resolved encounter, regardless of type — this is what preserves
Safehouse's rest-vs-merge trade-off even though the map allows
backtracking: the tension comes from the node being spent, not from being
unable to physically return to it. Finally, a **Relay** node: pure
graph-topology filler with no encounter at all, always passable, existing
only to let map generation add connectivity/redundancy without inflating
fight/reward density, and to give the flat per-move Heat cost a pure
form — "just moving" as a real, zero-risk-but-not-zero-cost choice
distinct from moving into an encounter.

**Losing a fight has a spatial consequence, not just a resource cost.**
Losing a regular or elite fight means the duel resolved to Containment
(see Resources): the vulnerability the player was exploiting gets
patched before they can leverage it, so that specific route into the
node is gone. This ejects the player from that node and permanently
**closes** it for the rest of the run — a closed node is genuinely
**impassable terrain**, not merely reward-free (closure has to be
permanent and block movement, or the player could always eventually loop
back through it, which would make the loss condition below never
actually trigger) — they have to route around it to keep progressing
(see Resources for the Heat cost this also incurs). This is distinct
from a node going **inert**, which happens to every node type on a
successful/resolved encounter (a won fight, or a Safehouse/Shop/Event
after its one action) — inert nodes stay fully passable forever after, at
the same flat per-move Heat cost as any other edge (see Movement, above).
**Losing a gatekeeper/boss fight, in any layer, ends the run
outright** — call this **Quarantine** rather than mere Containment: it
isn't one patched vulnerability to route around, it's the player's
entire presence purged from the target network. A gatekeeper is by
definition the *sole* passage forward, so there's nothing left on the
other side of it to reach anyway — no Heat cost, straight to game over.
This applies to every layer's gatekeeper, not only the deepest/final
one, for two compounding reasons: it deliberately raises the stakes, and
losing one is already an unavoidable dead end — treating it as instant
permadeath is just being direct about an outcome that would otherwise
degenerate into the same result anyway, rather than making the player
limp through an already-lost run.

This gives the run **three distinct ways to end**: (1) Heat maxes out
(getting caught/burned) — the slow, cumulative-pressure failure; (2)
Quarantine on a gatekeeper/boss loss, any layer — instant, since a
gatekeeper is the only passage forward at that point; (3) no route to
further progress remains — accumulated permanent node closures from
regular/elite Containment losses leave no path deeper, a soft-lock
distinct from both of the above.

**Resolved (session 19)**: with free-roam movement (see above), outcome
(3) is no longer a branching-tree redundancy question ("does every node
have ≥2 forward children") but a **graph-resilience** one — map
generation must keep the layer's gatekeeper reachable from the player's
current position as nodes close, verified by a generate-then-check
approach rather than a hand-proved topology guarantee (see `docs/roadmap-history.md`
Phase 3, Checkpoint B). This also folds in what was previously a separate
banked idea about a backtracking "pressure valve": since every move
(forward, sideways, or back into already-resolved territory) costs a
flat amount of Heat regardless of direction, routing around a closed
node is never a free undo — the cost comes from the move economy itself,
not a special-cased valve.

**Banked idea, not designed yet**: a future ability or class passive
could allow bypassing a closed/lost node, turning what's normally a
permanent failure into a recoverable one for specific builds — "idea
space to explore," not a commitment.

**Banked idea, deferred to Phase 5**: some nodes could be genuinely
exclusive-branching — offering egress on only *x* of *y* available paths,
so choosing one permanently locks out the others. Adds map variety/
friction that isn't purely win/loss-driven. Under free-roam movement
(session 19) this is best framed as a future **edge-removal event**
layered onto the graph, not a node property — and it's no longer
load-bearing for the soft-lock problem the way it was originally flagged,
since session 19's connectivity guarantee already handles that on its
own. Still needs its own budgeting against that same guarantee if it
ships later, so generation doesn't end up stacking two independent
closure sources into an unintended soft-lock.

## Meta-Progression

- New subroutines unlock into the available pool over time.
- Six playable classes, each specializing in 2 of the 4 archetypes — see
  Archetypes & Subroutines → Classes and Starting loadouts.
- Ascension-style unlockable harder difficulties.
- An expanding pool of in-run passive items (StS-relic equivalent),
  called **Mods** — findable during runs, hooking into a subroutine's
  archetype, verb, beta source or beta shape (session 51 replaced tags
  with these), or acting as extra reactive subroutines of their own.
  Full design in the "Mods" subsection, below.
- A capped inventory of single-use, player-activated items, called
  **Burners** — usable in combat (a single-fire payload effect), on the
  map (a free move, a reveal, reopening a closed node), or in the Shop
  (a discount/reroll/rarity-floor coupon). Full design in the new
  "Burners" subsection, below.
- The installed-loadout slot cap itself (see Subroutine Acquisition,
  below) can grow via a persistent, cross-run unlock, the same as
  everything else on this list.

**Scope note**: classes, subroutine acquisition, Mods, Burners and
Events are all designed and implemented (Phases 4–5; detail in
`docs/roadmap-history.md`). Ascension-style difficulty remains genuinely
undesigned and needs its own `/decision-session`; its first concrete
modifier is banked as run-economy D6 (higher ascension resets less Heat
between layers). Cross-run unlocks wait on a save/profile layer (see
Architecture).

### Subroutine acquisition

How subroutines are actually acquired and managed during a run:

**Channels**: combat rewards (a choice offered after winning a fight,
StS-style) and a shop (spend **Data** — the run's currency, stolen data
sold on a black market — on a specific pick rather than a random offer).
Events are a third channel (see Events, below). Reward quality scales with encounter difficulty: a
regular fight offers a standard choice, an elite/gatekeeper fight offers
a better one (more options, better odds, or guaranteed rarity — exact
tuning TBD).

**Earning Data** (session 21): awarded automatically on every combat win,
scaled by encounter tier — reuses Phase 3's `rewardTier` stub
(`none`/`standard`/`better`) rather than introducing a second difficulty
axis, the same tier-scaling shape Heat's loss formula already uses.
Independent of the subroutine-reward choice, not a trade-off against it —
a win grants both.

**Reward pool scoping**: draws primarily from the player's class's 2
specialized archetypes, with occasional off-class picks from the other
two. (The universal/Neutral pool that used to sit alongside these was
removed in session 51 — the archetype-level credit rule removes the gap
it existed to patch.)

**Loadout structure**: a slot cap on the *installed* loadout (what's
actually active and evaluated each fight) separate from a broader
*owned* collection (a bench) the player curates from between fights —
acquiring more than you can slot is never wasted, it's optionality for
matching a build to the next fight. Subroutines are always-evaluated, not
drawn like a StS hand, so an uncapped installed loadout would risk
late-run bloat/unreadability — a cap is necessary, not just a numbers
question. The cap is 6 (`INSTALLED_SLOT_CAP`, echoing Cribbage's dealt
hand); under session 51's adjacency chains, six ordered slots is the
build puzzle itself.

**Duplicate subroutines**: acquiring a subroutine you already own doesn't
auto-merge and doesn't just stack as a second slot-hungry independent
copy (which would be a strictly worse reward than a new subroutine, given
the loadout is capped). Instead it becomes held **material** sitting on
the bench, unusable on its own until spent at a **Merge** map node (see
Map & Run Structure) to upgrade the base copy. Merging upgrades the
**beta** (session 51) — a bigger beta, a lower stepped threshold, a
higher graded cap — and never the alpha's verb or the beta's source,
since those are a subroutine's core identity. (The old upgrade axis,
"easier to trigger", no longer exists once every piece fires every
turn.) How much an upgrade is worth waits on pillar pricing. Likely capped at some max rank; exact number TBD, same
treatment as the loadout slot count.

### Mods (session 30, `/decision-session`)

crib.exe's answer to StS relics: permanent, always-on effects the player
accumulates over a run, structurally distinct from subroutines (no
loadout slot, no install/bench split, no ordering, no cap — see
Ownership below). Named **Mods**, fitting the hacking/hardware setting
directly. This session settled the system's *shape* only — the
hook-point catalog, concrete named content, and exact numbers are
explicitly future work (see `docs/roadmap-history.md` Phase 5), the same
"infrastructure before content" split Phase 2 used for subroutines
themselves.

**Two engine mechanisms, split by effect shape, not a third bespoke
system**:

- A Mod that behaves like an extra reactive subroutine (fires on a
  specific trigger, resolves a payload) authors as a real
  `SubroutineDefinition`, reusing the full trigger/payload catalog
  wholesale — fired outside the loadout entirely (no slot, no order),
  always evaluated alongside it. Zero new engine machinery for this
  category.
- Everything else — tag/archetype-affinity boosts, stat/resource/economy
  modifiers (Data, Heat), run-meta hooks (map/node interactions) —
  extends the existing enemy-passive **light registry** (`resolve.ts`,
  session 27) to a player-side owned-Mod-id list, the same
  `{id, hookPoint, fn}` shape and generic `passiveState` scratch
  bookkeeping already proven out for the 32-enemy roster, plus whatever
  new hook points these need (onDataGain, onHeatChange, onNodeResolve,
  etc. — not enumerated yet, a future session's job).

Chosen over inventing a unified generic effect language, for the same
reason session 21 (class passives) and session 27 (the enemy registry)
both rejected premature genericization: two purpose-fit mechanisms
already exist and cleanly cover every effect shape raised this session.

**Class starting passives migrate onto this infrastructure.** The 6
existing hand-coded starting passives (Foothold, Zero Day, Sleeper Cell,
Primed, Feedback Loop, Return to Sender — session 11, reworked session
25) become **class-exclusive Mods**: granted automatically at run start
by class selection, never appearing in the general reward/Shop pool —
mirrors StS's own character-locked starting relics (Burning Blood, Ring
of the Snake) using the exact same relic system as a restricted
acquisition path, not a separate mechanism. (Migrated in Phase 5. Under
session 51 these six are replaced by the new classes' bridge passives —
see Archetypes & Subroutines → Classes — which use the same path.)

**Uniqueness**: a Mod can only be owned once — acquiring a duplicate
isn't possible; an already-owned Mod simply drops out of the reward/Shop
pool for the rest of the run. Mirrors StS relic uniqueness directly.
This means Mods need no Merge-style duplicate-material system at all — a
real scope reduction versus subroutines.

**Ownership: uncapped, no install/bench split, no ordering.** Unlike the
subroutine loadout (capped specifically because always-evaluated content
risks late-run bloat/unreadability, session 7), every owned Mod is
simply always active. The subroutine cap's reasoning doesn't transfer:
that cap protects a real *ordering/slot-scarcity* decision (which pieces
are installed, in what sequence), and Mods have neither — there's no
"which of my Mods are active" tension to protect. Late-run bloat here is
a UI/presentation question (a scrollable/paginated Mods panel, same as
StS's own relic bar), not an engine-level constraint. The opportunity
cost for a Mod lives entirely in its acquisition (below), not in an
equip limit.

**Acquisition**: additive alongside the existing subroutine-choice
reward, not competing for the same slot — winning an **elite or
gatekeeper** fight grants a Mod choice *in addition to* the normal
subroutine reward (regular fights grant subroutines only, unchanged).
Mirrors StS's own elite-guarantees-a-relic-plus-the-normal-card-reward
shape. This makes reward *shape itself* a difficulty/tier signal:
regular = 1 reward type, elite/gatekeeper = 2, Shop = both purchasable,
Event = a probable third channel once Event nodes are designed (a
pre-existing banked item, `docs/roadmap-history.md` Phase 0/3, now also gating this
acquisition channel specifically for Mods).

**Shop**: two independent slates in one Shop visit — the existing
subroutine slate (session 22's 3-common/1-uncommon/1-wildcard shape,
unchanged) plus a new, separately-generated and separately-rerollable
Mod slate, both spending from the same Data pool. Deliberately not one
combined slate/reroll: a subroutine-slate reroll and a Mod-slate reroll
are different gambles over different pools, and forcing one reroll
button to cover both would make rerolling always a compromise between
two things the player might not both want to reroll.

**Pool scoping: universal by default, with a targeted archetype
exclusion.** Most Mods (tag-based, stat/resource, run-meta,
archetype-agnostic reactive-subroutine Mods) are available to every
class equally — unlike subroutine rewards (which draw *primarily* from a
class's 2 specialized archetypes), the general Mod pool has no class
affinity at all by default, matching StS's own non-character-restricted
relic pool. The one exception: a Mod that leans heavily on one specific
archetype (including an archetype-flavored `SubroutineDefinition`-shaped
Mod) is excluded from a class's reward *and* Shop pool when that
archetype isn't one of that class's 2 specializations — otherwise a
class could be guaranteed a Mod it can never meaningfully fire, the same
"don't ship a structurally dead piece" concern that drove the since-removed
Neutral Archetype (session 28, `docs/design-history.md`). Implemented as the same static
`ClassDefinition.archetypes` check subroutine reward-pool scoping
already uses, just inverted into an exclusion rather than a "primarily
draws from" weighting — no new state-inspection machinery needed. (A
class's own occasional off-class subroutine pickup, per session 7, could
in principle make an excluded Mod useful anyway — accepted as a rare
missed-synergy edge case, since guaranteeing no dead rewards matters
more than catching every possible synergy.)

**Rarity**: common/uncommon/rare, mirroring the subroutine pool's own
shape (session 22) — commons simple, rares more power/build-defining.
Exact distribution, Shop pricing, and elite/gatekeeper reward rarity
floors are all TBD/playtesting placeholders, same discipline as every
other numeric constant in this project.

**Explicitly out of scope this session** (the "library," not the
"shape"): the actual hook-point catalog for registry-shaped Mods (the
equivalent of sessions 3-5's trigger/payload catalog work for
subroutines) — needs its own dedicated session; concrete named Mod
content; curses/negative-effect Mods (not raised this session, undecided
either way); Event nodes' own design (pre-existing banked item).

### Mods — Hook-Point Catalog (session 31, `/decision-session`)

Direct follow-up to session 30, designing the hook-point catalog it
explicitly deferred — the Mods equivalent of sessions 3-5's trigger/
payload catalog work for subroutines. Explored the actual pipeline
(`resolve.ts`'s existing 5 enemy-passive hooks; `run.ts`/`encounters.ts`/
`shop.ts`'s plain orchestration code, with no hook mechanism at all)
before proposing anything, which surfaced that most of the run-level
surface already flows through two existing, already-rich structs
(`EncounterOutcome`, `RunEvent`) rather than needing new state threaded
through the engine from scratch.

**11 hook points total, all chainable/mutation-capable** — each fires
with a context value and returns a (possibly modified) version of it,
the identical fold/thread pattern the existing enemy-passive dispatch
already uses (`applyEnemyOnFirePassives(combatState, ...) -> combatState`,
chained through several passives in sequence). This one shape covers
both purely-reactive Mods (which return the input unchanged after their
own side effect, same as most existing enemy passives) and reward/cost-
altering Mods (which actually mutate the value before returning it) —
no separate read-only-vs-mutating hook shape needed.

**Combat-scoped** (the 5 existing enemy-passive hooks, extended to
dispatch off a new player-side `ownedModIds` list alongside the existing
`enemyPassiveIds`, plus 1 new):

- **`onFire`** — a subroutine fires. **Widened this session**:
  previously passed only `archetype`; now passes the full firing
  `SubroutineDefinition` (id + tags + archetype). A real fix, not just
  an addition — archetype alone can't support a tag-affinity Mod ("your
  Trap-tagged subroutines hit harder"), one of the two hook categories
  named as core to Mods back in session 30.
- **`onTick`/`onTickExpiring`** — a DoT/HoT ticks or expires. *(Session
  51 removes DoT/HoT, so these two hooks have nothing to fire on; see
  Mods — content for the affected Mods.)*
- **`onGaugeCross50`** — a side's gauge crosses halfway to its
  threshold.
- **`onIncomingDirectBurst`** — incoming direct damage, before it
  applies.
- **`onCombatStart`** *(new)* — fires once per fight, before the first
  hand, against live `CombatState`. Enemies never needed this (no setup
  step, just a fixed loadout); a Mod like "start every fight with a
  small Ward" does.

**Run-scoped** (4 new — nothing analogous existed before this session):

- **`onMove`** — a map traversal, before its flat Heat cost
  (`traversal.ts`/`heat.ts`) is applied.
- **`onEncounterResolved`** — a node resolution, carrying the full
  `EncounterOutcome` (`heatDelta`, `quarantined`, `rewardTier`,
  `dataAwarded`, `rewardOptions`, `mergeTargetId`, `shopPurchase`,
  `rerollCost`). Covers Heat mitigation, bonus Data, *and*
  reward-altering Mods (upgrading rarity, adding options) in one hook —
  reward computation already happens independent of combat-internal
  state (quality keys off encounter tier, not fight performance), so
  there was never a need for a separate combat-scoped end-hook.
- **`onShopSlateGenerated`** — a Shop visit's slate is built
  (`shop.ts`'s `shopOfferingsForClass`), before the player/strategy
  chooses — the hook a Shop-discount Mod needs, since prices are already
  fixed by the time `EncounterOutcome.shopPurchase` exists.
- **`onSubroutineAcquired`** — fires after a subroutine choice is
  actually finalized (`run.ts`'s `playRun()`, post-`acquireSubroutine`),
  against `RunPlayerState`. Deliberately distinct from
  `onEncounterResolved`, which only ever sees the *offered*
  `rewardOptions`, not which one got picked — the real choice happens
  later, back in `playRun`, via `AcquisitionStrategy`. Motivating
  example: "when you acquire a Malware subroutine, upgrade it once,"
  reusing `merge.ts`'s existing rank-upgrade mechanism against the
  newly-acquired piece rather than inventing a new upgrade path.
- **`onModAcquired`** — fires once, when a Mod itself enters
  `ownedModIds`, against `RunPlayerState`. Distinct from every other
  hook here: those all fire on a *recurring* event and check an owned-id
  list forever after; this one is for a Mod whose effect is a **one-time
  structural mutation at acquisition time** rather than a standing
  reactive check — closer to how the class starting loadout gets set up
  today (`createInitialPlayerState` directly populates
  `installedLoadout`, no hook involved) than to anything else in this
  catalog.

  **Motivating case, raised mid-session**: a Mod that grants an
  always-slotted subroutine — installed permanently, reorderable by the
  player like any other loadout piece (participates in the same
  top-to-bottom firing/chaining), but **exempt from the installed-slot
  cap and locked against removal**. This doesn't fit either of session
  30's two engine buckets: it's not evaluated "outside the loadout" like
  a reactive-subroutine Mod, since it genuinely needs to live inside
  `installedLoadout`'s ordering. Resolved as two small additions rather
  than a third engine mechanism: `onModAcquired` inserts the granted
  `SubroutineDefinition` into `installedLoadout`, tagged with a new
  per-entry marker (`grantedByModId?: string`, `loadout.ts`) that
  `INSTALLED_SLOT_CAP` counting excludes and the uninstall action
  rejects — the normal reorder action and normal fire-on-turn/chaining
  logic need zero changes, since the entry is a completely ordinary
  loadout member in every other respect. "Possibly upgrade it" falls out
  for free this way too: it's a real owned subroutine, so the existing
  Merge/rank mechanism (`merge.ts`) already applies with no new code.

**Deliberately a starting catalog, not a closed one** — explicitly
agreed to extend it later if a specific Mod's design demands a hook
point that doesn't map onto one of these 10, rather than trying to
anticipate every future need now.

**Still open, unchanged from session 30**: concrete named Mod content;
curses/negative-effect Mods; Event nodes' own design; exact numbers.
What *is* now unblocked: a future engineering-scoping session (mirroring
sessions 15/17/19/21) can turn this catalog plus session 30's shape into
real implementation checkpoints, since both halves of "what a Mod needs
to plug into" now exist on paper.

### Mods — content (sessions 32 and 44; under rework)

40 Mods exist in code (`mods.ts`): 34 general — 14 common / 12 uncommon /
8 rare — plus 6 class-exclusive starting passives. Every hook point and
both engine buckets have at least two real examples. The two content
passes that produced them (session 32's 17-Mod validation sample and
session 44's doubling) are archived in `docs/design-history.md`.

**Under the session 51 redesign** (`docs/archetype-redesign.md`), most
Mods survive unchanged — the economy, map, Shop, reward and Heat Mods do
not touch subroutine shape. Three groups are reworked in the content
step:

- **Archetype Amplifiers** (Exploit/Malware/Encryption/Root) — re-keyed
  to the four new archetypes.
- **Trigger-easing Mods** (Overclocked Accumulator, Threshold Exploit) —
  "fire sooner" no longer exists; re-pointed to beta knobs (lower step,
  higher cap, bigger beta). The same applies to the `onTriggerEvaluate`
  hook, which now adjusts beta criteria rather than readiness.
- **Tag-keyed Mods** (Tagged Firmware) — tags are removed; Mods hook
  archetype, verb, source and shape instead.
- **Tick Mods** (Redundant Ticks, Failsafe Cascade, Redline) — DoT/HoT
  are removed, so `onTick`/`onTickExpiring` have no events. Either
  re-point these to alpha fires or lasting Tempo/Suppress durations, or
  retire the two hooks with them — decided in the content step.

The 6 class-exclusive passives are replaced by the six new classes'
bridge passives.

### Burners (session 36, `/decision-session`)

crib.exe's answer to StS Potions: single-use, **player-activated-at-will**
items — the one thing missing from the existing systems, which are
otherwise either fully automatic (subroutines fire on trigger) or fully
passive (Mods, always on). A Burner is manually triggered by the player
at a moment of their own choosing, then gone. Directly answers a question
the user raised going into this session — whether one-off consumables
even belong in this design at all, given they're not a straight StS-
Potion port — resolved yes, but reframed around that specific gap rather
than copied wholesale.

**Naming**: **Burner**, a real hacking/security-culture term — a burner
phone: cheap, disposable, used once and discarded specifically to avoid
being traced. A precise fit for "single-use, spent forever on use," and
preferred over "Exploit" (collides with the Exploit archetype's own
name) or a generic "Script"/"One-Shot."

**Activation timing: only on the player's own turn**, the same moment
subroutines resolve — not usable at an arbitrary point mid-hand. A true
"anytime, even mid-pegging" panic-button version was considered and
rejected for this session: it would need the engine's turn/hand-
resolution loop to become pausable/resumable at arbitrary points, which
doesn't exist today — the exact same gap already banked since session 24
for real human-vs-AI play (every `DiscardStrategy`/`PlayStrategy` call is
synchronous and expects an answer immediately). Own-turn-only reuses the
existing turn-resolution hook almost as-is and still delivers real
agency (choosing whether/which Burner to use that turn) without that
scope increase. Worth revisiting if/when the resumable-engine work
happens anyway.

**Three usable contexts, one unified item pool — not three separate
item types.** A single owned-item pool, where each Burner definition is
tagged with which context(s) it's usable in, the same way a subroutine
carries a trigger family:

- **Combat** — resolves like a single-fire subroutine payload (a direct
  burst, a Heat siphon, a guaranteed cut/discard swing), usable on the
  player's own turn.
- **Map** — an instant effect at the map level: a free move (no Heat
  cost), revealing upcoming node types, or **reopening a previously
  closed node**.
- **Shop** — a "coupon" effect: a discount, a free reroll, or a
  guaranteed rarity floor on the next purchase.

The map-context "reopen a closed node" effect directly resolves the
banked idea from session 9 ("a future ability/class passive that lets
the player bypass a closed/lost node") — as a found/purchased item
rather than a passive ability. See `docs/roadmap-history.md` Phase 0 for the closed-
out banked item.

**Inventory: capped, no bench/installed split.** A hard slot limit,
mirroring StS's own 2-3 potion slots and the subroutine loadout's own
slot-scarcity tension (session 7) — a real "which am I carrying" choice.
This differs from Mods' fully uncapped ownership (session 30), which is
justified specifically by Mods having no ordering/slot-scarcity tension
to protect at all; Burners do have that tension, closer to subroutines'
own reasoning. Unlike subroutines, though, there's no separate owned-
bench vs. carried-loadout split: a Burner is picked up and immediately
usable, closer to a StS potion (hard cap, no "owned but not carried"
state) than to always-evaluated background tech worth banking as Merge
material. Exact slot count is TBD/playtesting, same discipline as every
other numeric constant in this project.

**Acquisition**: combat rewards from **all** fight tiers, not elite-only
like Mods — regular fights currently grant only a subroutine choice, and
a lower-commitment single-use item suits that thinner reward well. Plus
a dedicated Shop slate (Data-spent, alongside the existing subroutine and
Mod slates). Plus Events (see "Events," below) as the flavor-heavy
primary source, matching StS's own event-reward pattern.

**Pool scoping & rarity**: archetype-agnostic by default, like Mods —
not tied to the 4 archetypes, since a one-shot utility item doesn't need
the "don't hand a class a structurally dead reward" guard archetype-
locked content does. Common/uncommon/rare, matching subroutines' and
Mods' existing tiering convention. Since Events' gamble-tier choices can
grant Burners (see below), the pool's most powerful entries are a
natural fit for that tier specifically.

**Explicitly out of scope this session** (shape, not library, same split
every other content system in this project has gone through): concrete
named Burner content; the exact payload catalog for combat-context
Burners (likely reuses the existing subroutine payload catalog wholesale
rather than inventing a new one, but not confirmed this session); exact
numbers (slot cap, rarity distribution, Shop pricing).

**Session 37 (`/decision-session`, engineering scoping)**: confirmed the
combat-payload-catalog-reuse question above by exploring the actual
engine — combat-context Burners do reuse `PayloadEffect` wholesale, no
new payload kinds needed. (Under session 51 that means combat Burners
are single verb effects — a one-shot Credit, Suppress, Tempo, etc.) Authored and validated an 8-Burner content
sample against the type system (2 combat, 3 map, 3 shop — one per new
effect kind, confirming both `MapBurnerEffect` and `ShopBurnerEffect`
need no changes). Full implementation-facing checkpoint spec (including
the type system's exact shape) in `docs/roadmap-history.md`'s new "Burners + Events
Implementation" write-up under Phase 5.

### Events (session 36, `/decision-session`)

Designs the node type flagged as "undesigned content, third acquisition
channel" since session 7 — the last remaining stub node type from Phase
3. Merge and Shop were both given real design and implementation in
Phase 4; Event never was.

**Paradigm**: a narrative vignette with 2-4 choices, resolved instantly
— no Cribbage played, StS's own event-node shape. Considered and
rejected: a mini Cribbage-mechanical challenge, resolved via some
lightweight non-full-combat card interaction, which would have reinforced
the game's "everything resolves via real Cribbage" identity more
directly, but is a genuinely new resolution mechanism, not just content
— real engine work with no existing precedent to build on. Also rejected:
a pure reward-reveal with no real choice, since it doesn't clearly earn
being a distinct node type from Relay.

**Risk model: a deliberate mix, not one global rule.** Each individual
*choice* (not each Event) carries a `riskTier`: **transparent** (exact
cost/reward stated up front), **visibleOdds** (a probabilistic outcome,
odds and range both shown — e.g. "70% chance: +15 Data. 30% chance: +20
Heat"), or **gamble** (genuinely unstated/uncertain outcome). A single
Event can mix tiers across its own options — the safe choice, the
calculated bet, and the wild gamble as three options on one vignette.

The house-style default elsewhere in this design is full transparency —
Heat costs, gauge thresholds, and accumulator bank counts are all stated
numbers; nothing else in the design hides information from the player.
`transparent` and `visibleOdds` both preserve that: Heat's entire design
(the free-roam movement model's flat per-move cost, the flat per-tier
loss charge) depends on the player being able to do real risk math,
which a
fully hidden outcome would undermine specifically for the one resource
whose whole point is being reasoned about, not gambled with.
`gamble`-tier choices are the one deliberate, contained exception —
confined to Events specifically, never touching combat/Heat's own core
legibility, in service of the classic "the wording sounded fine and it
wasn't" beat the genre leans on.

**Risk tier gates reward ceiling**: transparent choices offer modest,
safe value; visibleOdds choices offer moderate value with real variance;
gamble-tier choices are the only place the pool's most powerful outcomes
(a guaranteed rare Mod/Burner, a large Data windfall, reopening a closed
node) can appear at all — mirrors how rarity already gates power in the
subroutine/Mod pools, just applied to risk instead of acquisition cost.

**Effect pool**: reuses existing resources and mechanisms wholesale —
Heat delta, Data delta, a subroutine/Mod/Burner grant, or (a classic
gamble-tier beat) triggering a bonus fight for a bigger payout. No new
resource type needed.

**Node-state behavior**: inert after one resolved encounter, same as
every other stub node type since session 19 (Safehouse, Shop). No entry
tax beyond the existing flat per-move Heat cost to reach it — the node
itself doesn't add a second toll.

**Explicitly out of scope this session** (shape, not library): concrete
named Events; exact odds/numbers; whether Events are reskinned per
contract target (a real future idea, given runs are already reskinned as
different named companies/agencies); the class-specific-Event-grants-an-
upgraded-starting-Mod idea banked at session 34's follow-up, which
depended on Events existing at all. That prerequisite is now satisfied,
but the idea still needs a second one — a genuine Mod-upgrade mechanism,
since Mods have no Merge-style rank path today — before it's buildable.

**Session 37 (`/decision-session`, engineering scoping)**: authored and
validated an 8-Event content sample against the proposed `EventEffect`
shape, spanning all 3 risk tiers and every effect kind — surfaced one
real gap (a reward grant can't hardcode a specific piece id as the pool
grows, so grants need to support either a named piece or a random draw
filtered by rarity) and closed it in the type design directly. Also
resolved the exact node-state mechanics for a Burner's "reopen a closed
node" effect: it returns the node to `unresolved` (must be won again),
not straight to `inert` (no automatic free pass) — matches the
"recoverable, not automatic" framing this idea was banked under at
session 9, and keeps a single-use item's power level in line with the
rest of the pool. Full implementation-facing checkpoint spec in
`docs/roadmap-history.md`'s new "Burners + Events Implementation" write-up under
Phase 5.

### Gameplay Simulation Heuristics (session 45, `/decision-session`)

> **Session 51 note.** The heuristics below are written against the old
> subroutine model. Their structure (a priority ladder, per-effect-kind
> Burner dispatch, a fixed reorder rule) carries over; their inputs
> re-point in the refactor: "credit-capable payload" becomes "has a
> Credit alpha or beta", and the chain-based reorder rule becomes the
> `ReorderStrategy` that D13's adjacency chains require. Neutral-pool
> and tag references no longer apply.

Every script-driven run (`playRun()`, `scripts/sweep.ts`, `scripts/
layer-funnel.ts`) has always resolved acquisition/Shop/Event/Burner
decisions via deliberately "legal-not-good" defaults —
`alwaysAcquireFirst`, `buyCheapestAffordable`, `alwaysFirstEventChoice`,
and Burners going entirely unused (every activation point defaults to a
`never*` no-op). This was flagged as a real gap back at session 34's
Mods-sweep follow-up ("Not yet done: a synergy-aware acquisition/Shop
strategy") and never picked up. It resurfaced this session while
grounding the then-open "full class audit" (the roadmap at the time) in
fresh sweep data — a floor-heuristic sweep can't tell a real structural
class problem from an artifact of the AI never using half its own
toolkit. Session 45 designs (not implements) a full "smart" heuristic
layer across every decision point a scripted run makes.

**No engine gap drives this** — every existing `*Strategy` type already
receives the full `RunPlayerState` (classId, installedLoadout, bench,
ownedModIds, material, carriedBurnerIds), so this is new strategy
*content*, exactly the same shape as session 39's `opportunisticTraversal`/
`opportunisticSafehouseStrategy` pair, not a type-system change.

**Ladder, not weights.** The first real design fork: a numeric weighted
score (archetype match worth N points, rarity worth M, etc.) needs a real
calibration target to set N/M against, the way `ai.ts`'s skill dial
calibrates against exact Cribbage EV (`cribbage-skill-matrix.ts`) — there
is no equivalent ground truth for "is a rare off-archetype piece better
than a common on-archetype one." Chose a **lexicographic priority ladder**
instead — an explicit ordered tie-break, not a tuned score — matching how
`opportunisticTraversal` itself already resolves its own priority (fights,
then Heat/material, then Data, then Event) without any numeric weights.
Nothing here needs "tuning" in the calibration sense; correctness is
checked with hand-built unit-test scenarios, and a before/after sweep
validates that it actually helps, rather than searching for better
numbers.

**The ladder is genuinely different depth per item type**, since the
underlying types aren't uniform:
- **Subroutine** (reward + Shop): `archetype: Archetype` field, rarity is
  a separate `rarityOf(id)` lookup (`rewards.ts`), and the existing
  `CREDIT_CAPABLE_PAYLOAD_KINDS` classification (checks `payload.kind`,
  today a private const duplicated inside `enemies.test.ts`) makes
  credit-gap detection cheap. Full 3-step ladder: **(1) prefer an option
  that fills a credit-gap** — the class's own installed loadout has no
  credit-capable piece in the archetype the option belongs to — **(2)
  prefer on-archetype over universal/neutral over off-archetype**, **(3)
  break ties by rarity**.
- **Mod** (reward + Shop): `rarity` is a direct field; `archetype` is
  *optional* (many Mods are archetype-agnostic by design). No existing
  classification for "does this Mod credit the gauge" — building one
  means auditing every Mod's hook body, a real side-project on its own
  scale. 2-step ladder: **archetype match → rarity**. Credit-gap
  classification for Mods explicitly deferred, not built this session.
- **Burner** (reward + Shop): `rarity` only — no archetype field exists
  on `BurnerDefinition` at all, and Burners are one-shot consumables, not
  permanent gauge-touching pieces, so credit-gap doesn't apply either.
  1-step ladder: **rarity only**.

**Event choice gets its own heuristic, not the item ladder.** Event
choices are risk-tiered narrative options (`transparent`/`visibleOdds`/
`gamble`), not items with archetype/rarity — credit-gap and archetype
match don't mean anything here. Designed as a **configurable factory
function**, `synergyAwareEventChoice(config): EventChoiceStrategy`,
mirroring `ai.ts`'s `discardSkillStrategy(skill): DiscardStrategy`
factory pattern (the established way this codebase makes a strategy
configurable — `opportunisticTraversal`, by contrast, is a hardcoded
constant with no dial). Config is **explicit named parameters, not a
continuous dial** — `{ maxRiskTier: 'transparent' | 'visibleOdds' |
'gamble', gambleSafetyMargin: number }` — for the same reason the ladder
beat numeric weights: a continuous risk-tolerance scalar has no
calibration target either. `maxRiskTier` caps what a profile will ever
pick; `gambleSafetyMargin` reuses the Heat/material safety-reserve
framing `opportunisticSafehouseStrategy` already established, so both
heuristics share one notion of "safe enough to take a risk" instead of
inventing a second one.

**Burner activation was a total blank** — not just legal-not-good, but
entirely unused: `neverActivateMapBurner`, `neverActivateShopBurner`, and
combat falling through to `playCombat`'s own `[neverActivateBurner,
neverActivateBurner]` are the *only* strategies that exist anywhere in
production code. With only 8 Burners total across 3 contexts, a single
generic "worth activating" scorer doesn't fit — designed as **per-effect-
kind dispatch** instead, each with its own small condition, reusing
existing primitives rather than inventing new ones:
- `reopenClosedNode` (Skeleton Key): gate on session 20's
  `gatekeeperReachable()` — reopen only when actually needed to keep the
  gatekeeper reachable, not just whenever carried.
- `freeMove` (Ghost Protocol): unconditional whenever a move would
  otherwise cost Heat — close to strictly beneficial, no real judgment
  call.
- `revealUpcoming` (Recon Ping): unconditional, immediate — purely
  informational for a scripted player, nothing downstream changes from
  knowing it, so there's nothing to gate on.
- Shop coupons (`discount`/`freeReroll`/`rarityFloor`): folded into the
  Shop strategy's own decision — spent when doing so changes the
  purchase outcome, not a separate standalone check.
- Combat (`flash-drive`/`emp-charge`): **unconditional on first own-turn
  opportunity each fight** — considered reserving them for harder
  (elite/gatekeeper) fights instead, but hoarding logic is a genuinely
  separate, second-order heuristic on top of activation itself; shipping
  the simple version and revisiting only if sweep data shows hoarding
  would matter. User's own framing: "any use is better than no use."

**Merge-target selection reuses the ladder rather than inventing a
second scoring shape.** `pickMergeTarget()` (`merge.ts`) today picks
whichever owned duplicate has the most banked material — no synergy
awareness at all. Extends to use the same credit-gap → archetype ladder
as the primary sort, with banked-material count demoted to the tie-break.

**Loadout reorder and swap-out are the two genuinely new mechanisms** —
no strategy type or decision-maker exists for either today.
`reorderInstalled()` (`loadout.ts`) is a real engine primitive whose own
doc comment stresses firing order is "a real lever, not cosmetic" (it
drives chain-finisher-scaling payoffs and Primed/Sleeper Cell's "first X
fires" targeting), but **no script has ever called it** — not even a
legal-not-good default. A fully general reorder optimizer (searching
permutations against simulated outcomes) was considered and rejected as
its own research project; instead, a **fixed rule reusing the existing
`ChainedTrigger` classification** (`{kind:'chained', afterSubroutineId |
afterArchetype | afterTag}`, session 42's redesign): for any installed
piece whose trigger is `{afterSubroutineId: X}`, place X (if installed)
before it, since same-turn firing resolves top-to-bottom and the
prerequisite should credit the same turn, not the next one; place any
`chainFinisherScaling`-payload piece last, since it counts pieces that
already fired earlier that same turn. `afterArchetype`/`afterTag`
variants match a category, not a specific installed piece, so they don't
participate in this ordering rule. Everything else keeps acquisition
order.

Separately, **`acquireSubroutine()` (`loadout.ts`) has no swap-out path
at all** — once `installedLoadout` is at the slot cap, a newly-owned
piece just sits on the bench forever; only Merge (upgrading a piece
already installed) can improve the active kit after that point. New
behavior, used only by the smart-acquisition profile (not a change to
`acquireSubroutine`'s own existing legal-not-good behavior, which every
current test/caller depends on): when the loadout is full, compare the
new candidate against the ladder-ranking of everything currently
installed, and swap in the new piece if it outranks the worst-ranked
installed piece.

**Explicitly not done this session**: no code, no new files — shape and
design only, same discipline as every prior scoping session. Full
implementation-facing checkpoint spec (real function/file names, cited
against the current codebase) is in `docs/roadmap-history.md`'s new "Gameplay
Simulation Heuristics — Implementation" write-up under Phase 5, for a
future `/dev-session`.

## Enemy Design

**Session 27** replaced the placeholder enemy model with a real design,
closing the two banked items from session 26 (`docs/roadmap-history.md`) (enemy loadout
variation, and the fight-kind-vs-layer skill-scaling question). Through
Phase 4, every fight drew from exactly one flat, always-firing
`directBurst` subroutine per tier (`ENEMY_LOADOUT_REGULAR`/`_ELITE`/
`_GATEKEEPER`, `encounters.ts`), differentiated only by magnitude — every
balance number tuned against that shape (the Root passive rework,
escalation timing, the hard resolution deadline) has so far only ever
been validated against it, never against real variety.

**Enemies are a real roster with identity, structurally close to player
classes** rather than tuned procedural generation — reusing the existing
archetype-pairing intuition (see Meta-Progression's Classes) rather than
inventing a parallel design language. Each named enemy is real authored
data: an archetype set, a loadout of real subroutines, and (for
elite/gatekeeper) a bespoke passive.

**Authoring investment scales down by tier**, deliberately — regular and
elite fights recur many times across a run and don't each need bespoke
design; gatekeepers are the memorable set pieces and get the deepest
investment:

- **Regular**: 1-3 subroutines, a simple bespoke passive. A handful of
  named identities, each tagged with which layer(s)/difficulty band it's
  eligible for, rather than a fully separate roster authored per layer.
- **Elite**: minimum 3 solid subroutines, 1-2 real passives — meant to
  present a genuine challenge. A moderate bespoke pool (not per-layer
  separated), each identity tagged with its eligible layer(s) the same
  way regular identities are, so deeper layers draw from a
  harder-skewing subset without needing 4x the authoring.
- **Gatekeeper**: fully bespoke, one stable of **2-4 designed opponents
  per layer**, each "truly designed" and meant to be very challenging for
  the layer it's presented at. This is the tier that earns full
  per-layer separation — there's exactly one gatekeeper node per layer,
  so a dedicated stable per layer is natural, not overbuilt.

**Per-layer difficulty target (session 49).** "Very challenging for the
layer it's presented at" was, until now, the only statement of intent —
there was no number for the roster to be tuned toward, and so no way for
a gatekeeper to be measurably wrong. The target is a **monotonically
harder** per-layer pass rate:

| layer | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| target pass rate | 0.78 | 0.72 | 0.66 | 0.60 |

Calibrated, not picked: the compound (0.222) times the measured
non-gatekeeper survival factor puts the mean full-run win rate at 16.4%,
inside the 10–20% band adopted from Slay the Spire's ascension-0 rate.
Verified by holding the roster at exactly this curve with
`--syntheticGatekeepers` (README) and sweeping all six classes.

**What the roster actually does today**, measured against an *unfiltered*
cohort at every layer (`gatekeeper-check.ts --syntheticGatekeepers=1,1,1,1`,
300 seeds — the plain numbers are survivorship-conditioned, since losing
a gatekeeper fight ends the run and every deeper layer's cohort is
therefore pre-selected):

| layer | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| actual | 71.7% | 50.7% | **94.5%** | 55.0% |

Two problems, and neither is the one previously assumed:

- **Layer 3 is a free layer.** Its whole stable passes at 87.5–98.9%
  (Total Compromise / Adaptive Threat / Silent Corruption) despite
  carrying the *highest* `magnitudeScaler` in the game (1.6, against
  layer 2's 1.3–1.45). Payload magnitude is therefore demonstrably not
  what makes a gatekeeper hard — which is worth knowing, because the
  session 39 scaler is the lever the roster has been tuned with.
- **Which gatekeeper you draw matters more than which layer you're on.**
  Within-layer spread reaches 57pp at layer 1 (Firewall Prime 40.8% vs
  The Concierge 98.0%) and 45pp at layer 2 (Quarantine Ward 30.6% vs
  Zero-Sum 76.1%), against 44pp across the entire layer curve. Holding
  the roster still collapses class win-rate spread from 33.3pp to 11.0pp
  and puts five of six classes inside the target band — so roughly
  two thirds of what has been read as *class* imbalance is gatekeeper
  matchup.

The per-layer curve above is still the target. But closing the
*within-layer* spread is the larger lever, and the two should not be
confused again.

**Every gatekeeper needs at least one bespoke, highly thematic piece**
(session 43) — not elite or regular, which stay deliberately pure
magnitude-scaled "stronger commons" (the tier-authoring split above), a
distinction that holds structurally: gatekeepers are a fixed, single
per-layer assignment (`eligibleEnemies`'s exact-match rule), while
regular/elite are a floor an identity can recur across several layers
from (`magnitudeScalerFor` computes their difficulty live for exactly
this reason — a stored bespoke value wouldn't make sense for something
that shows up at more than one layer). A one-off, heavily authored piece
fits a single-appearance boss; it fights against a recurring one. As of
session 43 all 12 gatekeepers satisfy this (`enemy-subroutines.ts`, 9
gatekeeper-specific pieces added that session, joining 3 that already had
one as a side effect of earlier dead-content fixes).

**Every enemy needs at least one payload that credits its own win-gauge,
unless it's explicitly designed to win by stalling to the hand-20
attrition resolution instead** (the user's own amendment to the rule
above, session 43) — codified as `enemies.test.ts`'s own standing
regression guard (originally a session-28 one-off fix for 9 enemies that
shipped with none; now a documented design rule with a real, if currently
unused, exemption path for a future intentional stall-design identity).

**Opening punching bags**: the first **1-3 combats of the run**, full
stop — a run-order counter, not a layer-position or node-position rule.
Layer 1 is free-roam internally (see Map & Run Structure), so "the first
node encountered" isn't well-defined by position; counting resolved
fights instead sidesteps that cleanly and guarantees new players get an
easy on-ramp regardless of which node they happen to visit first. These
opening fights override the normal tier/layer selection — forced to the
easiest available regular identity and the skill floor — while it's
active.

**Archetype composition**: 2-archetype pairing (mirroring classes) is the
*default*, not a hard lock — a single-archetype enemy is fine, and a
bespoke gatekeeper (or an occasional heavily-thematic elite) can draw on
more archetypes than that when the identity calls for it. Subroutines can
be drawn straight from the player's own catalog (`subroutines.ts`) or be
fully bespoke to one enemy, especially for a heavily thematic identity.
Since session 51, enemies use the same four archetypes, seven verbs and
source × shape criteria as the player; Trace-cost modifiers stay
player-only, because Trace is. (The old rule that Root was rare on
regular enemies retired with Root; whether any new archetype should be
held back from early fights is a roster-authoring question.)

**Selection**: differs by tier, matching where repetition vs. uniqueness
matters. **Gatekeepers are fixed at map-generation time** — each layer
has exactly one gatekeeper node, so its specific identity (drawn from
that layer's stable) is assigned once when the graph is generated, stable
for the run, and could later be telegraphed to the player before the
fight happens. **Regular and elite are chosen randomly at encounter
time** from the eligible tier+layer pool — many nodes share these tiers,
there's no natural single assignment point, and re-rolled variety across
a run is desirable rather than something to pin down.

**Skill-dial axis (resolves the session 26 banked question)**: **tier is
the primary axis, layer is a secondary modifier** — not layer-primary as
originally leaned toward. Loadout complexity already carries most of the
"harder enemy" signal across tiers (1-3 pieces vs. 3+ with real passives
vs. fully bespoke), so `pegSkillStrategy`/`discardSkillStrategy` (session
24) scale primarily by tier — roughly regular 0.1-0.2, elite 0.4-0.6,
gatekeeper 0.7+ — climbing modestly within each tier from layer 1 to
layer 4 (deeper is sharper, but tier stays the dominant, legible signal).
The opening punching-bag fights pin skill at the floor regardless of this
formula, same as their loadout override.

**Passives need a light registry, not pure hand-coding.** The 6 player
class passives (session 11) are each a bespoke function gated by
`combatState.classId`, hand-coded directly into `resolve.ts`'s hook
sites — a deliberate choice at the time (session 21: "6 is too few to
justify generic infrastructure"). Enemies blow past that: even the low
end of this roster (a handful of regular passives, a handful of elite,
2-4 gatekeepers × up to 4 layers) is a dozen-plus passives as concrete
near-term work, not a hypothetical future pool. A **light registry** —
each hook site does a generic lookup by passive id instead of a growing
per-class `if` chain — removes that friction and, more importantly,
unblocks enemies from carrying a passive at all (`combat.ts`'s
`CombatOptions` currently documents that "enemy loadouts remain plain
data with no passive of their own"). This is a dispatch mechanism, not a
declarative passive-authoring DSL — each passive's actual logic is still
hand-written, the same way the existing 6 are (which vary enough
internally — one-shot vs. persistent, gated vs. not — that forcing them
into one generic shape isn't warranted yet). The existing 6 class
passives are not required to migrate onto the registry as part of this
work; they can stay on their current path.

### The Roster

The session 27 roster — 32 named enemies (12 regular, 8 elite, 12
gatekeepers), grown by session 43's enemy-only pieces — is archived in
`docs/design-history.md`. Its kits are built from the old subroutine
pool and are **deleted, not migrated**, in the session 51 refactor; a
skeleton roster built from skeleton pieces stands in until the roster is
re-authored against the pillar calibration (run-economy D10).

What carries forward from it:

- **Tone: every enemy is the target network's own defenses**, even the
  offense-flavoured kits (its security team or automated countermeasures
  hacking back), never a separate criminal group. External-actor flavour
  for a specific contract remains future idea space.
- **The measured lessons** in Enemy Design above — within-layer
  gatekeeper spread is the larger lever than the layer curve; payload
  magnitude is not what makes a fight hard.
- **The tier-authoring split and selection rules** above apply to the
  rebuilt roster unchanged.

## Tech Stack

Svelte + Vite, rendering everything (cards, loadout, the network map) as
SVG/DOM — no canvas game engine (Phaser/PixiJS). This is a UI/turn-driven
game, not real-time action, so an engine would be overhead without
payoff. Svelte was chosen for toolchain/pattern familiarity from
glyphrogue/glyphkeep — not for any code reuse; glyphrogue's engine itself
is built for ASCII dungeon-crawling and doesn't fit this genre.

## Architecture

**Engine/UI separation is a standing project-wide principle, not scoped
to any one system.** Game data and logic must be completely separate
from presentation. The entire game — Cribbage/combat, map navigation and
run progression, subroutine/loadout management, meta-progression — should
be simulable end-to-end headlessly (scripts, automated tests, AI-
controlled players), with zero dependency on the UI layer. The Svelte UI
is purely a thin interface onto the engine: it renders engine state and
translates player input into engine calls, and never contains logic the
engine doesn't already enforce itself.

Why: it makes the whole game testable by script rather than only by
clicking through a browser, which is both far faster iteration and the
only practical way to test something with this much randomness and this
many interacting systems; it's exactly what the enemy AI needs regardless
(Combat System already specifies an AI-controlled opponent, which has to
run against the engine with no UI in the loop); and it keeps the door
open for things like AI-vs-AI simulation for balance testing later,
without that needing to be designed for specially. This generalizes what
Phase 1 already implied on its own (`docs/roadmap-history.md`: "should be testable as
a standalone engine... before any combat-specific wrapping") into a rule
for every phase, not just the first one.

**Tunable-skill Cribbage AI (session 24)**: that door opened for real.
`src/engine/ai.ts` provides real discard/pegging decision-making, not
just the legal-not-good scripted defaults Phase 1 shipped with --
`discardSkillStrategy(skill)` and `pegSkillStrategy(skill)`, each a
weighted evaluation function (exact hand-EV, crib-EV, immediate pegging
score, defensive risk, setup value) blended by a single continuous 0-1
skill knob interpolating between fixed "novice" and "expert" weight
vectors, rather than randomly-injected mistakes -- chosen because this
AI is meant to eventually be the opponent real players face, and a
weighted personality reads as a coherent, legible skill level in a way
random noise doesn't. `CombatOptions`/`RunOptions` accept these
per-side (`discardStrategies`/`playStrategies`, each `[side0, side1]`)
rather than one shared strategy for both, so a run can pit any
combination of skill levels (or a human, once the engine's orchestration
supports pausing for one -- an open architecture question, see
`BACKLOG.md`) against any other. Not yet wired into real encounters as
shipped enemy behavior -- picking a skill level per enemy tier is
content-tuning work, not an engine question, and is still open.

**Project structure (session 15)**: a single Vite/Svelte app, with the
engine living as a plain-TypeScript `src/engine/` subdirectory rather
than a separate npm-workspace package. This is deliberately *not*
glyphrogue's `packages/core`/`packages/editor` monorepo split — that
structure earns its overhead because glyphrogue is a general-purpose
engine published for multiple downstream consumers (`create-glyphrogue-
game`, glyphkeep as a real external game). crib.exe is one standalone
game with no downstream consumer, so a folder convention plus the fact
that engine tests run in plain Node with zero browser context is enough
to actually enforce the engine/UI separation above, without the extra
tooling a workspace split would add for no real payoff here.

**No cross-run persistence yet (session 21)**: everything through Phase 4
is a single self-contained, seeded `playRun()` call — there's no save/
profile layer remembering state between separate runs. This matters
because Meta-Progression's designed class **unlock order** (session 13)
and its general "persists across runs" unlocks (slot cap growth,
subroutine pool growth) all assume one exists. Phase 4 deliberately
doesn't build it: all 6 classes ship immediately selectable as a run-setup
parameter, with unlock order recorded as intended future gating, not
enforced. A save/profile system is a distinct, not-yet-scoped piece of
infrastructure, orthogonal to combat/run mechanics — same treatment as
stubbing a system this project isn't ready to build yet (Phase 3's Merge/
Shop nodes, Phase 2's representative subroutine set).

## Theming

Card suits are re-themed to match the hacking setting — still 4 suits
mechanically (Cribbage's flush/suit-tally rules need exactly 4), just
reflavored rather than classic hearts/clubs/diamonds/spades. Each suit is
named **identically** to the subroutine archetype it powers, rather than
given its own separate vocabulary — no translation step between "score
with a suit" and "power an archetype": scoring Daemon cards *is*
charging your Daemon subroutines. The suits *are* the archetypes, so the
remaining design work is each suit's visual identity, the same
relationship a real suit symbol (♠) has to its name (Spade).

Session 51 redesigned the archetypes and therefore the suits (A1, A7;
the session 13 table is archived in `docs/design-history.md`):

| Suit / Archetype | Icon | Color |
|---|---|---|
| **Exploit** | Bug — the literal "software bug" a vulnerability targets | Magenta-red |
| **Daemon** | Gear / cog — a background process quietly turning | Green |
| **Overclock** | Lightning bolt — pushed past rated speed | Electric cyan |
| **Honeypot** | Honey jar — the trap that turns an attacker's own moves against them | Amber / gold |

All four icons are simple, bold, mutually distinct silhouettes suitable
for small-scale card reproduction, mirroring ♠♥♦♣'s own design
constraints. Color is a reinforcing cue, not the primary differentiator —
icon shape is what distinguishes suits. Exploit's shift from pure red
toward magenta (flagged in session 13) also keeps it clear of Daemon's
green for red-green colorblind players. Colors were chosen in passing in
session 51 and are easy to revisit.

## Name

**crib.exe** (stylized) — domain `cribexe.com`, confirmed available.

## Open Questions

- **Pricing.** What an alpha and a beta are each worth, per verb — the
  pillar calibration (Archetypes & Subroutines → Pricing).
- **Class names, bridge passives and unlock order** — wait for real
  subroutines.
- **Honeypot watch item** — confirm it converts, at authoring and at
  calibration.
- **Baseline Trace from every fight, scaled by the enemy's Containment %
  at fight end** (user, session 51; noted, not discussed). Easy fights
  were effectively Heat-free, which is what Trace was introduced to fix.
  Must reconcile with run-economy D1/D2 and with the transparency reason
  session 50 removed the margin-of-loss Heat scaler.
- **The run-economy redesign** (`docs/run-economy-design.md` D1–D7, per-
  layer Heat reset) is decided but not implemented or folded in here;
  the Resources section above still describes the pre-session-50 Heat
  model.
