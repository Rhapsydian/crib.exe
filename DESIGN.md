# crib.exe — Design

A browser-based, hacking-themed roguelite in the Slay the Spire mold —
node-map run structure, permadeath, meta-progression between runs — where
combat is resolved by playing real Cribbage instead of the usual
attack/skill/power card battles.

Status: mid-implementation (Phases 1-2 complete, Phase 3 scoped). This
doc is the source of truth for design decisions, settled across sessions
1-15 (`/decision-session`, 2026-08-23), with Map & Run Structure revised
in session 19 (`/decision-session`, 2026-08-24) to scope Phase 3. See
`BACKLOG.md` for the implementation roadmap and `docs/session-logs/` for
the session-by-session history.

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
  on a lost duel** = a base amount set by encounter tier (regular/elite/
  gatekeeper), adjusted by margin of loss — how close the player's own
  gauge got to reaching its own win before the match ended, not literal
  overshoot (a gauge stops mattering the instant either side reaches its
  own threshold, so there's nothing past it to measure). A fight where
  the player's own gauge reached 80% of its threshold before losing costs
  noticeably less Heat than one where it barely moved. Exact numbers
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
  raised by subroutines that make noise (Exploit's risk/reward bursts
  most steeply — that tradeoff is the archetype's identity), lowered by
  subroutines that cover your tracks, and **converts to Heat when the
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
  Exploit/Malware effects credit the caster's *own* gauge, never the
  opponent's; Encryption's mitigation instead reduces the *opponent's*
  gauge directly (an active counter-suppression, not a StS-style
  absorbing block stat, and not a push on a shared value either) — which
  also makes "mitigation can't win alone" a free structural property,
  since only a side's own offense can ever advance its own gauge. Both
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
Each subroutine has its own independent enable-condition (see Subroutine
Trigger Catalog) that accumulates across the whole match, separate from
the initiative gauge. When a side's turn happens (initiative threshold
crossed), *every* subroutine on that side whose condition is currently
met fires — not just one — and its payload (see Subroutine Payload
Catalog) resolves against Breach/Containment or against the opposing
side's state.

Loadout order matters: when multiple subroutines fire on the same turn,
they resolve top-to-bottom like a script. Subroutines can chain — one can
buff the next subroutine after it in the sequence, or contribute progress
toward a later subroutine's own enable condition. Order is adjustable
between fights (not mid-combat). **Resolved**: full loadout reordering is
between-fights only; the mid-combat lever is instead toggling individual
subroutines on/off (see Togglable, in the Trigger Catalog) — one tool per
context, deliberately not both mid-combat.

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
`BACKLOG.md`) found both pure extremes are worse than this framing
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
approach rather than a hand-proved topology guarantee (see `BACKLOG.md`
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

Broad strokes, not yet detailed:

- New subroutines unlock into the available pool over time.
- Multiple playable classes, each specializing in 2 of the 4 subroutine
  archetypes below — see Classes, below, for identities. Starting
  loadouts (the specific subroutines each class begins with) aren't
  designed yet — that needs concrete named subroutines to exist first,
  which the payload/trigger catalogs alone don't provide (see Open
  Questions).
- Ascension-style unlockable harder difficulties.
- An expanding pool of in-run passive items (StS-relic equivalent),
  called **Mods** — findable during runs, hooking into subroutine tags
  (see Subroutine Tags, below), specific archetypes, specific trigger
  mechanisms, or acting as extra reactive subroutines of their own. Full
  design in the new "Mods" subsection, below.
- A capped inventory of single-use, player-activated items, called
  **Burners** — usable in combat (a single-fire payload effect), on the
  map (a free move, a reveal, reopening a closed node), or in the Shop
  (a discount/reroll/rarity-floor coupon). Full design in the new
  "Burners" subsection, below.
- The installed-loadout slot cap itself (see Subroutine Acquisition,
  below) can grow via a persistent, cross-run unlock, the same as
  everything else on this list.

**Scope note (session 21, updated sessions 30 and 36)**: of this list,
Classes and Subroutine Acquisition were designed enough to build first
(see `BACKLOG.md` Phase 4). Mods' *shape* is now designed too (session
30, see "Mods" below), and Burners' shape is designed as of this session
(session 36, see "Burners" below) — both systems' hook-point/payload
catalogs and actual content libraries remain future work, the same
"infrastructure before content" split Phase 2 used for subroutines
themselves. Ascension-style difficulty remains genuinely undesigned and
still needs its own future `/decision-session`; all three are tracked
under Phase 5 alongside other undesigned content.

### Subroutine acquisition

How subroutines are actually acquired and managed during a run:

**Channels**: combat rewards (a choice offered after winning a fight,
StS-style) and a shop (spend **Data** — the run's currency, stolen data
sold on a black market — on a specific pick rather than a random offer).
Events are a probable third channel but aren't designed at all yet, so
not detailed here. Reward quality scales with encounter difficulty: a
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
specialized archetypes (see Meta-Progression above), plus a smaller pool
of universal subroutines — the natural home for Chained and Always/
Cantrip subroutines, since those trigger families were already
established (session 4) as universal rather than archetype-exclusive.

**Loadout structure**: a slot cap on the *installed* loadout (what's
actually active and evaluated each fight) separate from a broader
*owned* collection (a bench) the player curates from between fights —
acquiring more than you can slot is never wasted, it's optionality for
matching a build to the next fight. Subroutines are always-evaluated, not
drawn like a StS hand, so an uncapped installed loadout would risk
late-run bloat/unreadability — a cap is necessary, not just a numbers
question. The exact slot number is left to playtesting; 6 (echoing
Cribbage's dealt hand) is a floated thematic possibility, not a
commitment.

**Duplicate subroutines**: acquiring a subroutine you already own doesn't
auto-merge and doesn't just stack as a second slot-hungry independent
copy (which would be a strictly worse reward than a new subroutine, given
the loadout is capped). Instead it becomes held **material** sitting on
the bench, unusable on its own until spent at a **Merge** map node (see
Map & Run Structure) to upgrade the base copy. Merging improves
magnitude/efficiency only — bigger payload, lower trigger threshold, a
higher Scaling bank cap — never payload sub-type or trigger family, since
those are a subroutine's core identity and shouldn't change via a
duplicate. Likely capped at some max rank; exact number TBD, same
treatment as the loadout slot count.

### Subroutine archetypes

Four archetypes, one-word named, each tied 1:1 to one of the re-themed
suits (suit identity and archetype identity are picked together — see
Theming):

- **Exploit** — burst offense. Direct, hard-hitting subroutines
  (buffer-overflow/zero-day flavored).
- **Malware** — damage-over-time/attrition. Corrupting effects that
  persist and keep dealing damage across future turns (worm/ransomware/
  logic-bomb flavored).
- **Encryption** — defense/mitigation. Damage reduction, countering
  enemy subroutines, hardening your own session.
- **Root** — systems-control utility/tempo. Deliberately broader than
  recon/information-gathering, though recon is now a real, working part
  of it (session 24 redesign — see Subroutine payload catalog):
  manipulates the Cribbage layer itself (forcing a discard — bluntly or,
  now, surgically against one specific card — revealing the opponent's
  hand or the crib, skewing the cut, marking suits) *and* combat-meta
  state (the player's *or* enemy's initiative gauge/threshold — slow
  denies the enemy's, haste speeds up the caster's own — or other
  enable-condition counters) — "root access" to any piece of the
  system.

### Classes

Each class specializes in 2 of the 4 archetypes — its reward pool draws
*primarily* from those two (see Subroutine Acquisition), not
*exclusively*, so a class with no direct-damage archetype still has
occasional access to one via the off-class/universal pool. All 6
possible pairings are designed thematically now; not all need to ship as
day-one classes — some can sequence in later as meta-progression unlocks
(the same way StS added Watcher post-launch). Starting loadouts are
below.

| Class | Archetypes | Identity | Starting Passive |
|---|---|---|---|
| **Breacher** | Exploit + Encryption | Hit hard, then hold the position you just took. The starting/default class — balanced, good onboarding. | **Foothold** — the first time your own gauge reaches 50% of its threshold each fight, a one-time symmetric bonus: a small push added to your own gauge *and* a matching amount taken off the enemy's. |
| **Blackhat** | Exploit + Malware | Pure offense, reckless, naturally Heat-hungry (Exploit's risk/reward payload leans right into this). | **Zero Day** — the first Heat-costing Exploit subroutine each combat costs no Heat. |
| **Saboteur** | Malware + Root | Insidious — corrupts from within while manipulating the system around it. | **Sleeper Cell** (reworked session 25) — every Malware DoT tick or debuff you apply credits your own gauge directly *and* advances a Root subroutine's progress. Persistent, not one-shot. |
| **Operator** | Exploit + Root | Setup-and-strike: Root primes the field, Exploit cashes in. | **Primed** (reworked session 25) — every time a Root subroutine fires, your next Exploit fire both comes sooner (trigger eased) *and* hits harder (magnitude boosted). Persistent, not one-shot. |
| **Warden** | Malware + Encryption | Patient and grindy — wins by outlasting rather than outpacing. | **Feedback Loop** — Encryption HoT effects also apply a small Malware DoT tick to the enemy. |
| **Ghost** | Encryption + Root | Pure control, no primary damage access — wins by locking the opponent down and opportunistically finishing with off-class picks. The last class unlocked; the most challenging to play. | **Return to Sender** (reworked session 25) — whenever you absorb a hit with Ward, land an instant counter-push, or land a HoT tick, a portion of the amount carries through into your own gauge too. Reachable from Ghost's own starting kit now (Null Session's counter-push), not just an acquired Ward piece. |

**Unlock order**: Breacher → Blackhat → Warden → Saboteur → Operator →
Ghost. A complexity ramp that also staggers when each archetype first
appears. Blackhat (Exploit+Malware) is the simplest of the middle four —
pure aggression, nothing indirect or delayed — and introduces Malware
right after Breacher's Exploit+Encryption. Warden (Malware+Encryption)
reuses two already-known archetypes, asking only for more patience, not
new mechanics. Saboteur (Malware+Root) is where Root first appears — the
most abstract archetype (delayed/scheduled effects, reading enemy state,
indirect manipulation) — paired with the already-familiar Malware rather
than two new things at once. Operator (Exploit+Root) is the most
demanding of the four: Root's indirect tools plus precise sequencing to
actually pay off (chain-finisher scaling, Priority Override). Putting
both Root classes immediately before Ghost means a player has two full
classes of Root practice before meeting Ghost — the hardest class, with
zero direct-damage archetype — rather than meeting Root and Ghost's
difficulty at the same time.

All 6 are innate for the whole run once that class is picked, not
something found mid-run — the same role StS's class-starting relics
(Burning Blood, Ring of the Snake, etc.) play. **Session 30 makes this
literal rather than analogical**: these 6 become class-exclusive Mods,
granted at run start and never appearing in the general pool — see
Meta-Progression's new "Mods" subsection, below (migrating the existing
hand-coded functions onto that infrastructure is future implementation
work, not done this session). Most now do real,
repeated work over a fight rather than a single mild nudge: Feedback
Loop always has; Sleeper Cell, Primed, and Return to Sender were
reworked (session 25) into the same shape after balance sweeps proved
their original one-shot, gauge-inert versions produced zero marginal
win-rate value for the three Root-paired classes — Root's own archetype
identity (denial/tempo/manipulation) never touches the win gauge
directly, so a passive that only sped up an already-inert effect could
never translate into an actual win. Foothold remains a single
confirmation bonus, and Zero Day stays pure Heat economy, not
gauge-related at all — those two didn't have the same structural gap to
close. **Ghost's is still the deepest of the three** — rather than
granting off-class access to Exploit/Malware, "Return to Sender" makes
Ghost's own toolkit (pure defense) double as offense, directly
answering the damage-access gap noted when Ghost was introduced above
(defending so precisely that the attacker's own aggression backfires on
them), complementary to the off-class reward-pool access Ghost already
has.

### Starting Loadouts

Each class begins a run with 3 subroutines — 1 from each of its 2
specialized archetypes, plus 1 thematic **Cantrip** (Always-triggered,
see Subroutine Trigger Catalog) — not 2 per archetype as originally
drafted. A denser starting kit was tried first and rejected: with a
~6-slot installed-loadout cap (see Subroutine Acquisition), 4 starting
pieces would leave only 2-3 open slots, meaning near-immediate forced
swap-outs and little room for early-run acquisition to actually matter.
3 per loadout leaves more breathing room. All 6 Cantrips below are
tagged **Daemon**, consistent with session 10's own definition of the tag
("Accumulator-triggered, DoT/HoT, Always/Cantrip subroutines") rather
than reaching for tags arbitrarily.

**Breacher** (Exploit + Encryption):
- *Buffer Overflow* — Exploit, instant burst, Occurrence: Run.
- *Session Lock* — Encryption, instant counter-push, Self-state: dealer
  this hand.
- *Lock Fatigue* (Cantrip, session 29 replacement for Steady Hand) —
  Encryption, instant burst, Accumulator: mitigation banked (~4 Session
  Lock casts). Session Lock's own suppression casts feed it; once enough
  mitigation has been banked it converts into a real credit toward your
  own gauge — fixes a real structural gap where Breacher's suppression
  pair never advanced its own win condition, letting a patient/defensive
  enemy simply out-stall the hand-20 hard tiebreak (which always favors
  the defender). Tag: Daemon.

**Blackhat** (Exploit + Malware):
- *Payload Drop* — Exploit, risk/reward burst (costs Heat), Occurrence:
  Fifteen. Ties directly to the "Zero Day" passive.
- *Logic Bomb* — Malware, DoT (caster's-turn pulse), Accumulator:
  point-cooldown. Tag: Daemon.
- *Static Noise* (Cantrip) — Always; small guaranteed burst that also
  generates a tiny amount of Heat each time. Tag: Daemon.

**Saboteur** (Malware + Root):
- *Silent Worm* — Malware, DoT (global pulse), Accumulator: point-
  cooldown; also feeds a Root subroutine's condition each tick — embodies
  "corrupt and manipulate" in one piece. Tag: Worm.
- *Time Bomb* — Root, scheduled sabotage (resolves at next deal),
  Enemy-state: enemy Breach/Containment position. Tag: Trap.
- *Background Process* (Cantrip) — Always; no direct effect, quietly
  advances progress on another subroutine's condition each turn. Tag:
  Daemon.

**Operator** (Exploit + Root):
- *Precision Strike* — Exploit, piercing burst, Occurrence: Pair. Tag:
  Backdoor.
- *Priority Override* — Root, instant manipulation, advances another
  subroutine's condition, Enemy-state — the mechanical echo of the
  "Primed" passive.
- *Ping Sweep* (Cantrip) — Always; small guaranteed nudge to the enemy's
  gauge or a reveal, every turn. Tag: Daemon.

**Warden** (Malware + Encryption):
- *Memory Leak* — Malware, DoT (global pulse), Accumulator:
  point-cooldown. Tag: Daemon.
- *Redundant Systems* — Encryption, HoT (caster's-turn pulse),
  Self-state: Breach/Containment in enemy's favor. Tag: Daemon.
- *Routine Maintenance* (Cantrip) — Always; small guaranteed self-heal/
  ward tick every turn. Tag: Daemon.

**Ghost** (Encryption + Root):
- *Null Session* — Encryption, instant counter-push, Self-state:
  Breach/Containment in enemy's favor — directly interacts with "Return to
  Sender."
- *Kill Switch* — Root, scheduled sabotage (resolves at next deal),
  Enemy-state: enemy Breach/Containment position. Tag: Trap.
- *Low Profile* (Cantrip) — Always; small guaranteed Heat reduction
  every turn, **with a floor** — cannot reduce Heat below some threshold
  (exact value TBD/playtesting). Reinforces the stay-hidden identity and
  gives Ghost a second structural tool alongside its passive (one fixes
  damage-access, one manages Heat).

**Three design notes worth keeping visible, not just the results:**

- *Session Lock*'s trigger was originally "Heat above threshold," changed
  to "dealer this hand" — a Self-state trigger that requires buildup is a
  real problem specifically on the *introductory* class, where it would
  leave one of only 3 starting pieces dead until Heat accumulated. Bad
  onboarding. "Dealer this hand" is live from turn one.
- *Redundant Systems* has the same buildup-delay shape Session Lock had,
  but it was kept as-is — being behind and grinding back is Warden's
  actual theme, and Warden isn't the class new players see first.
- *Low Profile*'s Heat reduction needed a floor: unbounded, Ghost's own
  identity (long, patient, grindy fights = many turns = many guaranteed
  fires) means a Ghost player could eventually neutralize Heat pressure
  entirely just by grinding — undermining the resource specifically for
  the class most likely to rely on long fights. A floor keeps baseline
  risk present no matter how long a fight runs.

### Subroutine payload catalog

What a subroutine actually does when it fires. Each archetype has
multiple sub-types rather than one move apiece:

- **Exploit** (4): baseline **instant burst** (credits the *caster's own*
  gauge — never the opponent's, see Breach/Containment above); **piercing
  burst** (ignores Encryption's ward entirely — true damage, unaffected
  by mitigation; Exploit's counter to defense-heavy builds); **chain-
  finisher scaling** (burst scales with how many other subroutines
  already fired earlier in the same turn — a direct payoff for loadout
  sequencing, not a generic "execute" mechanic); **risk/reward burst**
  (bigger credit, but using the subroutine costs the player Heat directly
  — a second Heat-accumulation path alongside losing duels).
- **Malware** (2): **DoT** (gradual credit to the *caster's own* gauge
  over time — see tick cadence below) and **debuffs** (status effects
  that weaken the target's own functionality going forward, e.g. reduced
  subroutine effectiveness or slowed gauge fill — a status-effect stack
  applied *to a side*, distinct from Root's direct rewrites of
  values/flow).
- **Encryption** (7, +3 session 40 continued — see the new "Archetype
  Win-Condition Audit" section below): **instant counter-push** (directly
  reduces the *opponent's* gauge — a genuine suppression tool, not a push
  toward any shared value); **ward** (an accumulating shield on the
  caster's own side — absorbs the opponent's future non-Piercing offense,
  denying the gauge credit it would otherwise earn them, until the shield
  depletes; Piercing bypasses it entirely, the one counter-play against a
  ward-heavy build); **HoT** (gradual reduction of the *opponent's*
  gauge over time, mechanically symmetric to Malware's DoT's tick-
  cadence framework, just aimed at suppression instead of credit);
  **cleanse** (removes an existing debuff afflicting you); **ward
  counter** (adds to the shield exactly like plain Ward, but arms an
  ongoing effect for the rest of the fight: every future absorb on that
  side, from *any* Ward source, also credits a portion to the caster's
  own gauge — generalizes Ghost's Return to Sender passive, session 25,
  into real archetype-native content instead of one class's exclusive
  Mod); **draining HoT** (identical shape to plain HoT, but each tick
  also credits a portion to the caster on top of the usual opponent
  suppression — both effects fire every tick, not a split of one pool);
  **ward bash** (spends a fraction of the caster's *current* Ward shield
  for an equal-sized instant credit; a high fraction, naturally, spends
  nearly the whole shield — deliberately no separate "consume everything"
  flag, the cost falls out of the same field a lower fraction uses).
- **Root** (6, session 24 redesign, +1 session 40 continued — see
  below): **instant manipulation** (directly alter a gauge/threshold, a
  suit tally, or another subroutine's enable-condition progress — slow,
  denying/delaying the *opponent's* initiative gauge, or haste,
  accelerating the *caster's own*, both live here as the same payload
  pointed at either side); **Cribbage-layer manipulation** (a blunt
  whole-pair forced discard, skew the cut, mark a suit — peekCrib itself
  is a permanent documented no-op, see below); **scheduled sabotage**
  (fires now, but its effect doesn't resolve until a specific *future*
  Cribbage-flow checkpoint, e.g. skewing next hand's cut); **recon**
  (reveals real, otherwise-hidden data — the opponent's dealt hand, the
  crib's contents, or their kept hand — that the caster's *own* future
  discard/pegging decisions can use); **surgical manipulation** (forces
  one specific card out of the opponent's hand, chosen adversarially
  against their own best interest, rather than dictating their whole
  discard pair); **session hijack** (steals progress directly out of the
  *opponent's* own gauge and credits it to the caster's, capped at
  whatever the opponent actually had banked — the one payload kind in the
  whole catalog that's a genuine two-sided transfer rather than a
  relabeled burst, and Root's first native win-condition path).

  **Hand-lifecycle firing (session 24)**: recon and surgical manipulation
  don't wait for a turn or defer to the next hand — they fire at one of
  three real Cribbage moments *within the current hand*: right after
  it's dealt, right after crib cards are selected, or right as the play
  phase begins. This is what makes recon actually work: a subroutine
  that revealed the crib only once it was already fully scored (the old
  peekCrib, and Cribbage-layer manipulation's forceDiscard/skewCut/
  markSuit generally) is too late to matter for anything; firing within
  the same hand, before the moment it describes has passed, is what
  gives revealed information somewhere real to go.

**DoT/HoT tick cadence** is a per-subroutine property, not a universal
rule — different Malware/Encryption subroutines can use different
cadences. Two flavors so far: **global pulse** (ticks every X combined
points scored by *either* side, applies instantly the moment the
threshold crosses, independent of whose turn it is — exempt from the
normal "fires on your turn" rule) and **caster's-turn pulse** (ticks only
when the caster who applied it gets a turn, gated like any normal
subroutine firing).

### Subroutine trigger catalog

What causes a subroutine to become enabled. Eight trigger families (six
original + two Root-native additions, session 40 continued), plus one
orthogonal property. Four of the six original families are each one
archetype's primary identity; two (Chained, Always) are universal,
cross-cutting tools any archetype's subroutines can use. The two newest
(Rare-occurrence, Hand-outcome) are deliberately *not* universal the same
way — both are Root-only in practice, giving Root three of the eight
families total (Enemy-state plus these two), reflecting that it needed
real new tooling to get a native win condition at all — see the new
"Archetype Win-Condition Audit" section below for why.

- **Accumulators** — count something over time, fire at a threshold.
  Point-count cooldown, suit-count tally; extensible to e.g. rank-count.
  **Malware's primary family** — corruption incubating/spreading on a
  steady, guaranteed schedule fits the attrition fantasy precisely.
- **Occurrence triggers** — fire on a specific *kind* of scoring event,
  not accumulated points. Ties subroutine identity most directly to real
  Cribbage skill — a "run-hunter" or "flush-focused" subroutine becomes a
  real build. **Exploit's primary family** — a specific great play is the
  "vulnerability found," opportunistic and spiky, matching burst identity
  directly. Scoped to the caster's own scoring events (an "enemy scores
  X" trigger belongs to Enemy-state instead, not here). 8 concrete
  categories, covering every scoring-event kind Cribbage's own rules
  define, each unified across the play/pegging phase and the show/count
  phase rather than split into separate play-vs-show trigger types
  (simpler base; phase-specific variants are a possible future
  refinement, not needed now):
  1. **Fifteen** — cards summing to 15 (play or count).
  2. **Pair** — covers pair, pair royal (3-of-a-kind), and double pair
     royal (4-of-a-kind) as magnitude variants of the same kind.
  3. **Run** — covers run, double run, triple run, and quadruple run as
     magnitude variants.
  4. **Flush** — 4-in-hand or 5-with-starter, same suit.
  5. **His Nobs** — holding the Jack matching the starter's suit.
  6. **His Heels** — the starter card itself is a Jack (dealer-only,
     scores at the cut, before play begins — rare, dealer-favoring).
  7. **Thirty-One** — hitting the pegging count exactly.
  8. **Go** — playing the last card when the count isn't 31 (mutually
     exclusive with Thirty-One).

  Each of the 8 categories above can use one of **3 firing variations**:
  **Instant** (the default — fires immediately on every single instance,
  independently, no banking); **Threshold** (occurrences bank silently;
  the subroutine isn't ready until N have happened, then fires with its
  normal/flat payload — same shape as an Accumulator, but counting
  discrete occurrences of a specific kind rather than raw points); or
  **Scaling** (occurrences bank up to a per-subroutine cap, and payload
  magnitude scales with how many were actually banked when it fires —
  e.g. 3 pairs banked before firing hits harder than 1; the swingy,
  variance-rewarding option). All three reset the banked count after
  firing, same as every subroutine's normal "fire, then reset and wait
  again" rule.
- **Enemy-state triggers** — fire based on the opponent's condition:
  their Breach/Containment position, their initiative gauge fill %, or
  whether they currently have one of your Malware debuffs active
  (cross-archetype combo potential). **Root's primary family** — Root's
  payloads are already enemy-directed (their gauge, tallies,
  subroutines), so it makes sense for its triggers to watch the enemy
  too.
- **Self-state triggers** — fire based on your own condition: Heat
  above/below a threshold, or dealer vs. non-dealer this hand (uses real
  Cribbage's own dealer asymmetry as a hook). **Encryption's primary
  family** — defense reacting to your own peril, an introspective/
  protective trigger for a protective archetype.
- **Chained triggers** (universal) — a subroutine's firing can feed a
  later one's enable condition. Not tied to one archetype; any
  archetype's subroutines can chain into each other. **Redesigned session
  41**: matches by *archetype* or *tag* of whatever fired earlier this
  turn, never a specific subroutine id, for any pool content — acquisition
  (shop slate, combat rewards) never guarantees a player draws both halves
  of a specific pair in the same run, so a pool piece keyed to one exact
  id can go permanently or run-to-run dead (the exact bug found in Drive-
  By Exploit, Chain Infection, and 5 other existing pieces this session —
  see BACKLOG.md's session 41 write-up for the full list and conversions).
  Id-based chaining is kept as a type option, reserved for contexts that
  *do* guarantee co-presence — a class's own fixed starting loadout, or a
  future mechanism (e.g. an Event) that grants a matched pair at once —
  but no pool content uses it.
- **Always triggers** (universal) — no real condition, fires every turn
  that side gets. Informally called **"Cantrip"** subroutines — meant to
  be low-power, not heavy hitters: guarantees something always happens
  each turn even if nothing else is ready (chip damage, feeding another
  subroutine's accumulator, minor healing/warding). Any archetype can
  have a cheap Cantrip-tier version.
- **Rare-occurrence triggers** (Root-native, session 40 continued) —
  watch a specific Occurrence category at or above a magnitude floor,
  from *either* side, not just the caster's own — the one deliberate
  break from Occurrence's own self-scoping rule above. Fires the instant
  a qualifying occurrence happens, bypassing the normal ready-flag/
  turn-gate pipeline entirely (no `reactive` flag needed — this family
  doesn't use that machinery at all, it's evaluated directly inside
  combat's own per-occurrence loop). "Royal pair" (magnitude ≥ 6) is
  genuinely rare, not just a flavorful name — a Pair occurrence's
  magnitude is real points (n×(n−1)), not a count-of-a-kind: already
  2/6/12 for pair/pair-royal/double-pair-royal, so the floor does real
  work.
- **Hand-outcome triggers** ("Crib Trap," Root-native, session 40
  continued) — watch one phase's own aggregate total for a just-resolved
  hand (crib, either side's kept hand, or pegging score), read directly
  off that hand's already-computed totals rather than approximated from
  individual occurrences. Same turn-independent, bypass-the-pipeline
  firing as Rare-occurrence above, checked once per hand right after it
  resolves. A crib-phase watcher only ever fires on a hand where the
  watched side is actually that hand's dealer — the crib belongs to the
  dealer, not an error when it isn't applicable that hand.
- **Togglable** (orthogonal to all 8 families above) — some subroutines
  carry a manual on/off switch, independent of their base trigger type;
  off means it never fires regardless of whether its condition is met.
  This is the confirmed **mid-combat** lever (a between-fights-only
  toggle would be redundant with just removing the subroutine from the
  loadout) — e.g. shutting off a Heat-costing Exploit subroutine when
  already running hot, without touching loadout order/composition.

This is a primary-affinity mapping, not an exclusivity rule — nothing
forbids, say, an Exploit subroutine from using an Accumulator trigger if
a specific design calls for it; it's just not that archetype's typical
identity.

### Subroutine tags

A second classification axis, orthogonal to archetype and independent of
class specialization — where archetype splits subroutines by combat
*role* (offense/attrition/defense/utility), tags split them by effect
*mechanism/timing*, cutting across all four archetypes. This is what
makes tags useful to passives in a way a looser flavor label wouldn't be:
a passive that says "your Trap-tagged subroutines are stronger" pulls
together subroutines from completely different archetypes into one
build-around theme, giving the game a second, independent deckbuilding
axis alongside class choice.

Six tags (extensible later, not a fixed exhaustive taxonomy — grows the
same way the subroutine pool itself grows over time; **Direct** added
session 41, see below):

- **Trap** — delayed/scheduled: fires now, resolves later (Root's
  scheduled sabotage; Threshold/Scaling Occurrence subroutines that
  spring after banking; Hand-outcome-triggered subroutines, since they
  watch a whole hand's aggregate rather than firing on the spot).
- **Piercing** — bypasses normal rules or counters (Exploit's piercing
  burst; anything that ignores mitigation outright; also Rare-occurrence-
  triggered subroutines, since that family bypasses the normal ready-
  gate/turn-flow pipeline the same structural way — a session 39 naming
  note: this tag is called `piercing` in code, not `backdoor` as an
  earlier draft of this section said; corrected here rather than
  reconciled toward the stale doc name, since renaming the live `Tag`
  type has a real migration cost the doc string doesn't).
- **Firewall** — reactive/defensive, responds to being attacked
  (Encryption's ward/ward-family payloads and cleanse; Enemy-state-
  triggered defensive effects).
- **Worm** — chains or propagates (Chained-trigger subroutines; effects
  that feed or buff other subroutines in the sequence).
- **Daemon** — persistent/background/ongoing (Accumulator- or Always-
  triggered subroutines; DoT/HoT/draining-HoT payloads) — the literal
  computing term for a background process, a precise fit for the setting.
- **Direct** (session 41) — immediate, single-shot, no delay and no
  persistence: a plain burst/manipulation/counter-push/one-shot debuff
  fired on a simple trigger, with none of the other five tags' mechanism
  in play. Added specifically to close a real coverage gap found during
  the session 41 audit — over a third of the pool (38 of 99 pieces at the
  time) carried no tag at all, and nearly all of them were exactly this
  shape: a plain immediate effect that didn't fit Trap/Piercing/Firewall/
  Worm/Daemon without stretching what those already mean. Completes a
  clean timing axis the other tags already implied: Trap fires later,
  Daemon fires repeatedly, Direct fires once, now.

**Tagging convention (session 41)**: a subroutine's tag(s) come from its
trigger shape and/or its payload shape independently, and can stack when
both genuinely apply (e.g. an accumulator-triggered Ward subroutine is
both Daemon and Firewall) — trigger shape: `accumulator`/`always` →
Daemon; Threshold/Scaling Occurrence or `handOutcome` → Trap;
`rareOccurrence` → Piercing; payload shape: `piercing`/`wardBash` →
Piercing; `ward`/`wardCounter`/`cleanse` → Firewall; `dot`/`hot`/
`drainingHot` → Daemon; `chained` → Worm. Neither applies → Direct. The
goal, per the user's own framing: most if not all subroutines should
carry at least one tag, so passive items (which hook into tags, not
individual subroutine ids — the whole reason this axis exists) have real
surface to build against.

A subroutine can carry **multiple tags** when it genuinely fits more than
one (e.g. a Root scheduled-sabotage effect that also chains into another
subroutine could be both Trap and Worm) — more synergy space for cheap
complexity cost, since a tag is just a label, not a resource.

**How passives use tags**: an in-run passive item (see Meta-Progression)
can reference a tag to enhance every subroutine the player has carrying
it, regardless of archetype — e.g. "your Trap-tagged subroutines do X."
Specific passive designs aren't written yet; this section defines the
hook they'd use.

### Neutral Archetype (session 28, `/decision-session`)

Triggered by a concrete finding during Phase 5 checkpoint E: correcting
`resolveHardTiebreak`'s semantics (the hard-resolution deadline now
unconditionally favors the defender, rather than whichever side's
win-gauge fraction happened to be thinner — "if you can't breach in
time, you're contained," applied literally instead of as a fraction
race) revealed that Ghost's real starting kit had a **0% genuine win
rate** across 30 seeds against a plain opponent — 0 threshold wins, all
attrition losses, peak fill fraction never exceeding ~0.17. The
session 26 "Ghost fix" had only ever been validated under the old,
looser tiebreak. Root cause: **only two payload families ever credit a
side's own win-gauge at all** — Exploit's direct-damage kinds
(`directBurst`/`piercing`/`chainFinisherScaling`/`riskRewardBurst`) and
Malware's `dot` tick. Every Encryption payload (`ward`,
`instantCounterPush`, `hot`) and every Root payload (`instantManipulation`,
`cribbageLayerManipulation`, `scheduledSabotage`, recon) only ever
reduces the opponent's gauge, denies tempo, or manipulates state —
never credits the caster's own. Any kit built entirely from Encryption
and/or Root, with no Malware DoT and no Exploit piece, is
**mathematically incapable of ever winning outright** — not slowly via
attrition, but literally zero path to it. This affects both player
kits (Ghost) and 9 of the 32 enemies (see Enemy Design's Roster).

**Resolved as a genuine 5th `Archetype` value, `'neutral'`** — not one
of the 4 existing archetypes reused for flavor. A neutral piece
naturally fails every existing archetype-specific passive check
(Primed's `=== 'root'`, Sleeper Cell's `=== 'malware'`, etc.) without
needing new exclusion logic, and it can't have suit affinity anyway
(Cribbage has exactly 4 real suits — a 5th archetype was never going to
map onto a 5th one). Matches the StS-Colorless framing this was pitched
against: Colorless cards aren't a 4th color in costume, they're their
own bucket. `ARCHETYPE_POOLS`, suit theming, and every
`ClassDefinition`/`EnemyDefinition.archetypes` pairing simply never
need a `'neutral'` case — no class or enemy "specializes" in it, it's a
shared toolbox everyone can draw from equally (session 7's originally-
mentioned-but-never-built "universal pool" concept, now actually real).

**Mechanism**: neutral pieces are built exclusively from trigger
families that don't pin the piece to one specific suit — the actual line
is suit-tally accumulation, whose trigger requires a fixed `suit:` index
(0-3) chosen at authoring time, tying that piece to one archetype's own
suit whether or not the caster's kit has any affinity for it. Every
occurrence category, Flush and His Nobs included, is fine: scoring "a
flush" or "his nobs" fires on any suit, referencing no specific suit
index at all, same as fifteen/pair/run/thirty-one/go/his heels scoring
off rank or count. So the neutral catalog draws freely from all 8
occurrence categories, not 6. Chained triggers are deliberately avoided for
neutral content specifically (a chain needs a *specific* prerequisite
subroutine id present in the same kit, which a piece meant to drop into
*any* kit can't assume).

**Scope, deliberately small**: 9 pieces total (4 common / 3 uncommon /
2 rare) — reusing the existing rarity-tier shape rather than inventing
a new one, but far smaller than each real archetype's 7/5/3, since this
exists to patch a structural gap, not become a 5th full content
pillar:

| Rarity | Name | Trigger | Payload |
|---|---|---|---|
| Common | Idle Process | Always | Small directBurst |
| Common | Elevated Session | Self-state: isDealer | Small directBurst |
| Common | Checksum Match | Occurrence: fifteen, instant | Small directBurst |
| Common | Steady Drip | Accumulator: points, threshold | Small directBurst |
| Uncommon | Chain Reaction | Occurrence: run, instant | chainFinisherScaling (archetype-agnostic version of Exploit's Zero-Day Chain — scales off *any* subroutine firing earlier the same turn) |
| Uncommon | Overclock | Self-state: heatAbove | Moderate directBurst |
| Uncommon | Uptime | Occurrence: thirty-one, threshold | Moderate directBurst |
| Rare | **Circuit Breaker** | New: accumulator on banked mitigation (see below) | Large directBurst |
| Rare | Watchdog Timer | Occurrence: go, scaling, generous cap | directBurst, real punch at max stacks |

**Circuit Breaker is the capstone idea**, not just a bigger burst: it
converts the caster's own *already-cast* mitigation (Ward/
instantCounterPush/HoT amounts generated this match) into a real credit
— a genuine "shield bash." This is the one piece that needs a real new
engine primitive, not just data: a new accumulator metric tracking
total banked mitigation, fed from wherever those three payload kinds
resolve. Every other piece in this set is pure data over existing
trigger/payload machinery. The point of Circuit Breaker specifically:
Encryption/Root's actual identity *is* denial — this lets that identity
become a legitimate path to victory instead of asking those archetypes
to borrow Exploit's identity just to have any offense at all.

**Session 41 grew this pool +9** (8 common / 6 uncommon / 4 rare total,
part of the wider Player Pool Expansion below), including Cache Hit
(Flush) and Load Balancer (His Nobs) — both fine under the mechanism
above, no specific suit referenced. One judgment call worth recording:
Mirror Server (`chained: afterTag daemon`) is the first
Neutral piece to use a Chained trigger, previously avoided here entirely
because id-based chaining needs a *specific* prerequisite no universal
piece can assume is present. Session 41's own `afterTag`/`afterArchetype`
match modes (Player Pool Expansion, Chained-triggers) don't have that
problem — they fire off *any* matching piece, not a guaranteed id — so
the original objection doesn't apply to them.

**Retrofit, this session**: Ghost's Cantrip (Low Profile) is replaced
by Idle Process — Cantrips were already established (session 4) as
universal/cross-cutting rather than archetype-exclusive, so a neutral
Cantrip barely bends existing design language. The 9 struggling
enemies (Enemy Design's Roster) get their own neutral-piece swaps in
Phase 5 checkpoint E's own remaining work, not here.

**Explicitly banked, not resolved this session**: how neutral pieces
are actually *acquired* (reward-pool weighting, Shop availability,
whether they're truly equal-weight for every class or something else)
— flagged by the user as a real follow-up topic, deliberately deferred
rather than decided in passing.

**Resolved session 40 continued** (`/decision-session`, full writeup in
the new "Archetype Win-Condition Audit" section immediately below): the
banked idea just above — Circuit Breaker's mechanic reincarnated as
native Encryption content — shipped as **Ward Counter**, one of three new
Encryption offense payloads. Root, which had the identical structural gap
Encryption did, got its own native fix too (Session Hijack plus two new
Root-only trigger families) rather than continuing to lean on the Neutral
Archetype as its only patch.

### Archetype Win-Condition Audit (session 40 continued, `/decision-session`)

Triggered by stepping back from a gatekeeper-by-gatekeeper balance chase
to ask a bigger question directly: does every archetype actually have
both a real win condition (for a player using it) and a real containment
identity (for an enemy using it, holding out to the hand-20 hard
tiebreak)? Confirmed directly from `resolve.ts`'s payload dispatch, not
assumed from this doc's own prose — **Encryption and Root had zero
payload kinds that credit the caster's own gauge**, before this session.
Every Encryption payload only denied the opponent or managed the
caster's own defense; every Root payload only manipulated tempo,
thresholds, or the Cribbage layer itself. "Mitigation can't win alone"
(Resources, above) was a deliberate, stated structural property — but
"Encryption/Root can never win via threshold *at all*, only via
attrition" turned out to be a separate, unintended gap the design never
actually closed. The Neutral Archetype (above) already patched this once,
by lending Exploit-shaped offense to every class equally — a real fix at
the time, but a patch borrowing from a 5th archetype, not something
either archetype's own catalog could do.

**A second, related finding, empirical rather than structural**: real
fire-frequency instrumentation against several gatekeepers (the
session-40 gatekeeper balance pass, `BACKLOG.md`) found that the hand-20
attrition/hard-tiebreak backstop is barely reached in practice at all.
Across 3,151 real fights spanning all 12 gatekeepers (300 seeds/class,
realistic acquired power, skill=0.85), only two gatekeepers ever resolved
via attrition — **Firewall Prime** (pure Encryption, 17.1%) and **Null
Session** (Root+Encryption, 3.6%). Every other gatekeeper, all 10 of the
remaining archetype pairings including `the-quarantine-ward`
(Malware+Encryption, a name that literally invokes "contain until hand
20"), showed a flat **0.0% attrition rate** across thousands of fights.
Firewall Prime's own number makes the mechanism visible precisely because
it's the one gatekeeper for which attrition was, before this session, its
*only* structurally possible path to a win at all (pure Encryption, no
other archetype, no Neutral pieces) — every other pairing has *some*
credit-capable content in its kit and simply wins via threshold well
before hand 20 in practice, real fights resolving in 2-5 hands rather
than the 10-25 escalation's own timeline assumes. The implication is
broader than just Encryption/Root: the "hold out to hand 20" containment
identity is close to decorative for nearly every archetype pairing right
now, not a gap unique to the two that structurally couldn't reach it at
all. Not acted on this session — flagged here since it bears directly on
how any future gatekeeper balance pass, or a future escalation-timeline
retune, should be read.

**The fix, shipped this session** (session log in `BACKLOG.md`'s top
"NEXT SESSION" section, same "shape now, content later" split every other
system in this project has used): three new Encryption payload kinds and
three new Root
mechanisms, detailed in the Payload/Trigger catalog sections above --
**Ward Counter**, **Draining HoT**, **Ward Bash** (Encryption), and
**Session Hijack**, **Rare-occurrence triggers**, **Hand-outcome
triggers** (Root). Two design principles held across all six, resolved
live rather than assumed:

- **Reuse a proven mechanism before inventing a new one.** Ward
  Counter/Draining HoT are a direct generalization of Ghost's own Return
  to Sender passive (session 25, `RETURN_TO_SENDER_RATIO`) — already
  tuned across two real balance passes — promoted from one class's
  exclusive Mod into real archetype-native content any Encryption
  subroutine can use. Session Hijack composes for free from two
  already-existing primitives (`reduceWinGauge` + `creditWinGauge`).
- **Root getting bespoke *trigger* effects reads more on-theme for the
  archetype than bespoke *payloads*** (the user's own framing, adopted
  directly) — Root's whole identity is "root access to any piece of the
  system," which fits "I watch for a specific real event and react to
  it" better than "I hit you." Session Hijack is the one exception (a
  genuine two-sided transfer, not a relabeled burst, chosen specifically
  because extending `instantManipulation` with an `ownWinGauge` target
  was rejected as mechanically indistinguishable from Exploit's own
  `directBurst`); Rare-occurrence and Hand-outcome are trigger-only,
  pairing with existing credit payloads rather than needing new ones.

**Also fixed along the way, both real engine bugs surfaced while doing
this audit, not part of the archetype work itself**: `gaugeFillAbove`
(an `enemyState` condition) read the cyclical InitiativeGauge instead of
real win-progress, confirmed via instrumentation to fire ~1.5 times in a
2.5-hand fight for pieces authored as a rare late-game punish (Honeypot,
Vulnerability Scan) — migrated both to `breachContainmentAbove`, which
reads the real thing. Separately, the pegging-phase skill AI never
actually read `knownOpponentHand` despite Root's own Directory Traversal
piece populating it end-to-end since session 24 — the reveal fired, the
data was there, and the AI never looked at it; fixed to resolve a real
defensive threat from the known hand instead of a blanket count-based
guess.

**Explicitly not done this session**: no real subroutine has been
authored using any of the six new mechanisms yet — this is shape only,
same discipline as Mods/Burners/Events before their own content passes.
The broader attrition finding above (escalation's own timeline vs. how
fast real fights actually resolve) is flagged, not investigated further.

### Player Pool Expansion (scoped session 41, implemented session 42) ✅ complete

The first phase of the user's own multi-session program (audit and
roughly double the player-facing subroutine pool, then the enemy pool,
then Mods, then a full class audit, then the gatekeeper roster, finishing
with a heavy ablation-driven balance pass — see `BACKLOG.md`'s top "NEXT
SESSION" section for the complete roadmap). Session 41 scoped and
planned only; session 42 implemented all 8 checkpoints (A-H) — see
`BACKLOG.md`'s "Player Pool Expansion — Implementation" section for the
full 57-piece content plan and its execution notes. Pool 81 -> 138, all
subroutines 99 -> 156, magnitude tuning deliberately left to a later
balance-pass session.

**Target sizes — parity, not independent doubling**: all four real
archetypes converge on the same new size (~30 each: 14 commons/10
uncommons/6 rares), rather than each doubling from wherever it happened
to sit after session 40's audit already grew Encryption/Root
asymmetrically. Exploit and Malware (untouched since session 22, still
15 each) get the larger addition (+15 each); Encryption and Root
(already at 21 each after session 40's six new mechanisms) only need +9
each. Neutral, an intentionally small universal fallback pool rather than
one of the four specializations, also roughly doubles (9 → 18) at the
user's own direction, not left flat.

**Design principle confirmed live**: fill real, empirically-identified
coverage gaps using *existing* payload/trigger/tag primitives before
inventing new ones for Exploit/Malware (whose payload catalogs, at 4 and
2 kinds respectively, are much thinner than Encryption's 7 or Root's 6) —
matches the project's standing "reuse before inventing" principle from
the win-condition audit itself. Overlap in individual trigger or payload
usage across pieces is explicitly fine; a subroutine only needs a
*unique combination* of trigger and payload to earn its slot, not a
wholly unused axis. Real audit finding driving most of the new content:
**His Nobs and His Heels were used by zero subroutines** across the
entire 90-piece pool that existed before this session, despite being 2
of the 8 documented Occurrence categories.

**His Heels needs a real constraint, not just "use it now and then"**:
real frequency data (`scripts/occurrence-frequency.ts`, 300 games) puts
it at 0.076/hand — the rarest occurrence category in the game, roughly on
par with the pair-royal-or-better/8+-point-run "rare tail" session 40
already calibrated rare-tier Root content against — and, unlike every
other Occurrence category, it's **entirely outside either player's
control** (the cut card, no discard/pegging decision touches it),
breaking the design reason the whole Occurrence family exists ("ties
subroutine identity most directly to real Cribbage skill"). A Threshold-
or Scaling-variation His Heels piece would be functional dead content —
expected occurrences per side in a real ~2-5 hand fight is roughly 0.2.
**Rule going forward**: His Heels content is Instant-variation only,
rare-tier only, and sparing (one piece per pass, not spread across
rarities) — a rare, uncontrollable, big-if-it-happens swing, not
something to build reliable strategy around.

**Chained trigger, redesigned** (see the Trigger catalog's own Chained
entry, above, for the full mechanism) — the user's own catch, prompted by
finding that 3 existing pool pieces (Drive-By Exploit, Chain Infection, a
Root uncommon) were permanently dead for 5 of 6 classes, chained off a
class-exclusive starting-loadout id no other class could ever acquire.
The fix generalizes further than just those 3: **any** id-based chain in
pool content carries real run-to-run dead-content risk, since nothing in
the acquisition system guarantees a player draws both halves of a
specific pair in one run — so all 7 existing chains (including the 4
that were pool-to-pool and technically "safe" today) convert to
archetype/tag matching during authoring, not just the 3 broken ones.

**Tags — a 6th tag, Direct, added** (see the Subroutine tags section,
above, for the full definition and the applied tagging convention) — the
user's own goal: most if not all subroutines should carry at least one
tag, since passives hook into tags rather than individual ids. Audit
found 38 of 99 existing pieces (38%) untagged; applying the new rule
resolves all 38, plus corrects several under-tagged pieces in this
session's own 57-piece draft, without leaving any genuinely ambiguous
cases.

**Starting-loadout quality pass**: all 18 class-starting pieces reviewed
for the same structural issues found in the pool — none found. Both
existing same-loadout self-references (Background Process→Time Bomb for
Saboteur, Priority Override→Precision Strike for Operator) are the safe
case (both pieces guaranteed present in the same fixed kit), unlike the 3
broken pool chains above. 5 of 18 carried no tag — folded into the tag
retrofit above rather than handled separately. A real numeric balance
pass on Saboteur/Operator/Warden's starting kits (unlike Breacher/
Blackhat/Ghost, never individually audited) is explicitly out of scope
here — that's the "full class audit" the user already sequenced as its
own later phase in the roadmap.

**Explicitly not done this session**: no `subroutines.ts` data written,
no `ChainedTrigger`/`Tag` type changes made in code — this is shape and
content-plan only, same discipline as every prior scoping session. A
future `/dev-session` authors the real 57 pieces, converts the 7 existing
chains, retrofits tags across the pool, and updates the structural-count
tests, per `BACKLOG.md`'s checkpoint spec.

### Enemy Pool Expansion (session 43, `/decision-session`, designed and implemented same-session) ✅ complete

Phase 2 of the user's own multi-session roadmap. Explored the actual
engine first (`enemies.ts`, `enemy-subroutines.ts`, `subroutine-types.ts`)
rather than proposing content cold, confirming what's structurally
unavailable to enemies: anything Heat-gated (enemies never accumulate
Heat) and `gaugeFillAbove` (reads the cyclical InitiativeGauge, not real
win-progress — already known from the player-pool audit, session 40).
Scope confirmed live: grow `enemy-subroutines.ts` itself (the bespoke
enemy-only catalog, 8 pieces at the time, every one born as a one-off
dead-content patch) into real intentional content, reserved strictly for
mechanics no player-facing piece could use (option (a) of two considered
— the alternative, enemy-exclusive *flavor* content with nothing
structurally enemy-specific about it, was rejected as re-opening the
player-pool-size scope just closed out last session).

Two new standing design rules confirmed live and recorded above (Enemy
Design's tier-authoring section): every **gatekeeper** needs at least one
bespoke, highly thematic piece (not elite/regular, which stay pure
magnitude-scaled by deliberate design); every **enemy** needs a
credit-capable payload unless explicitly designed to stall to the hand-20
resolution (the user's own amendment to the pre-existing session-28 rule).
Checking real coverage found only 3 of 12 gatekeepers already had a
bespoke piece (each a side effect of an earlier dead-content fix) — the
other 9 got one this session (Quarantine Ward and Zero-Sum got two each,
since both were found to share Kernel Panic's exact pre-fix suitTally/
occurrence-threshold dead-trigger problem, confirmed directly against
`subroutines.ts` before designing a fix, not assumed). 11 new pieces
total in `enemy-subroutines.ts`; Epidemic/Cold Storage (Quarantine Ward)
and Total Pwnage/Dead Drop (Zero-Sum) replaced outright rather than
supplemented.

**A real, multi-round balance regression found and fixed via direct
measurement, not guessed at**: the first version of three new pieces
broke a real full-run integration test (`run.test.ts`, a 50-seed sweep
that must find at least one victory) down to 0/50. Root causes, each
confirmed with `scripts/sweep.ts`'s `enemy` mode before and after fixing:

- **Orphaned Thread (Ghost Process)** originally raised the *enemy's own
  target's* `InitiativeGauge` threshold permanently and uncapped
  (`instantManipulation`/`enemyGaugeThreshold`) — that gauge's real
  default is only 8 (`encounters.ts`'s `GAUGE_THRESHOLD`), not the
  50-point win gauge Tripwire/Ghost Protocol's own precedent amounts might
  suggest at a glance, and `maxFiresPerCombat` turned out to be
  unenforced for this trigger kind entirely (a real, separate engine gap
  — see below). A first retune (lower amount, add the cap) still only
  scored 9/100 in isolation; redesigned onto a capped, temporary
  `throttled` debuff instead of a permanent structural change — safer
  against the same runaway-over-a-long-fight shape.
- **Escalation Path (Incident Response)** was designed on a false premise
  — Highest Bidder's passive ("chain-finisher pieces get a bonus per
  Exploit fired") was assumed dead, but Incident Response's existing kit
  already has two real `chainFinisherScaling` pieces. A third, chained
  directly off any Exploit fire, would have compounded a live mechanic,
  not fixed a gap. Redesigned onto a plain, non-escalating burst.
  (Separately, isolating this piece surfaced a genuine *pre-existing*
  finding, out of this session's scope to fix: Incident Response's
  baseline win rate, with none of this session's content at all, is only
  6/100 — a real outlier the roadmap's later "full class audit"/"heavy
  final analysis pass" phases should pick up.)
- **Contagion Protocol/Cryo Lock (Quarantine Ward)** unblocked the ward's
  own pre-existing Total Quarantine passive ("every tick nudges its own
  gauge forward") for the first time ever — it had never fired in
  practice while Epidemic/Cold Storage were dead. `globalPulse` cadence
  (ticks off combined points from both sides, independent of whose turn
  it is) decoupled the nudge from real turn economy, amplifying it far
  past what the passive was ever tested against. Switched to
  `castersTurnPulse` (ties the nudge back to the Ward's own actual turn
  frequency) and gave Cryo Lock a real, attainable (not suitTally-dead)
  gating condition instead of also being unconditional from turn 1.

**A real engine gap fixed along the way**: `maxFiresPerCombat`
(`SubroutineDefinition`) was only ever enforced on the reactive
selfState/enemyState path and the rareOccurrence/handOutcome paths — its
own doc comment flagged this as known but undone. Extended `triggers.ts`'s
`isReady` (the one real choke point every normal firing path already
funnels through) to check it universally, closing the gap for every
trigger kind rather than adding another bespoke check.

**Verification**: 617/617 tests passing (from 617, net-zero since this
session added both new content and the invariant-doc pass — no structural
count changed), `npm run check` clean. `run.test.ts`'s full-run sweep
passes again. A fresh 6-class real-condition smoke sweep (40 seeds each,
`opportunistic` traversal) showed no hangs/crashes and a plausible spread
(7.5%-32.5%, consistent with prior sessions' known per-class ordering —
Breacher/Blackhat weakest, Ghost strongest under this traversal). The
isolated bare-starting-kit `sweepEnemy` check (no layer-magnitude scaling
applied) still reads 0/100 against Quarantine Ward specifically — flagged
as a likely mismatched signal for a Layer-2 gatekeeper tested at Layer-1
power with no scaling, not re-chased further once the real, representative
full-run test passed; worth real magnitude-scaled verification in a
future balance-focused session rather than assumed fixed.

### Mods (session 30, `/decision-session`)

crib.exe's answer to StS relics: permanent, always-on effects the player
accumulates over a run, structurally distinct from subroutines (no
loadout slot, no install/bench split, no ordering, no cap — see
Ownership below). Named **Mods**, fitting the hacking/hardware setting
directly. This session settled the system's *shape* only — the
hook-point catalog, concrete named content, and exact numbers are
explicitly future work (see `BACKLOG.md` Phase 5), the same
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
acquisition path, not a separate mechanism. See Classes, above, for the
updated note; migrating the 6 existing hand-coded functions onto the new
mechanism is future implementation work, not done this session.

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
pre-existing banked item, `BACKLOG.md` Phase 0/3, now also gating this
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
"don't ship a structurally dead piece" concern that drove the Neutral
Archetype (session 28, above). Implemented as the same static
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
- **`onTick`/`onTickExpiring`** — a DoT/HoT ticks or expires.
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

### Mods — Content Validation Pass (session 32, `/decision-session`)

Before scoping implementation, the user asked to build out enough real
Mod content first to confirm sessions 30-31's shape/catalog doesn't have
gaps — directly motivated by this project's own history: session 17's
original Phase 2 scope was written before session 12's concrete
subroutine content existed, and turned out to leave most of the real
catalog unusable, forcing a rescope. Deliberately small and
deliberate rather than launch-sized: **17 Mods**, scoped specifically to
touch every one of the (then-11) hook points and both engine buckets at
least once, not to be a complete pool — the same relationship session
12's 18 starting subroutines had to session 22's later 60-piece
expansion.

**A real gap, found by design rather than by accident**: drafting a
trigger-mechanism-affinity Mod ("your Accumulator-triggered subroutines
need 15% less banked progress to fire") — one of the three hook
categories named as core to Mods all the way back at session 30's
opening ("tags, ... specific archetypes, specific trigger mechanism")
— exposed that nothing in the session-31 catalog could support it.
`onFire` only runs *after* a trigger is already satisfied; nothing
touches the readiness check itself. **Added a 12th hook,
`onTriggerEvaluate`** — chainable, fires during `triggers.ts`'s
per-subroutine readiness check, letting a Mod adjust the effective
threshold/progress requirement before readiness is decided. Same shape
as every other hook, just earlier in the pipeline than `onFire`.

**One non-gap, confirmed rather than assumed**: a "permanently raise
your max Heat capacity" style effect looked like it might need a new
`onRunStart` hook, but doesn't — `onModAcquired` already covers it,
since a class-exclusive Mod granted at run start and a found Mod picked
up mid-run both route through the exact same acquisition moment, just
at different times.

**The 17-Mod draft**, by rarity — exact magnitudes are all TBD/
playtesting, same discipline as every other numeric constant in this
project:

| Rarity | Name | Hook / mechanism | Effect |
|---|---|---|---|
| Common | Static Shield | `onIncomingDirectBurst` | Flat mitigation off every incoming direct burst |
| Common | Light Footing | `onMove` | -1 flat Heat cost per move |
| Common | Warm Boot | `onCombatStart` | Start every fight with a small Ward |
| Common | Vendor Discount | `onShopSlateGenerated` | Shop prices reduced by a flat % |
| Common | Early Momentum | `onGaugeCross50` | Small one-time push the first time your own gauge crosses halfway, each fight |
| Common | Backup Generator | `onModAcquired` | Permanently raise max Heat capacity (the `onRunStart`-vs-`onModAcquired` test case above) |
| Common | Petty Cache | `onEncounterResolved` | Small flat Data bonus on any win |
| Uncommon | Tagged Firmware | `onFire` (tag) | Moderate magnitude bonus for subroutines carrying a specific Tag — exercises the session-31 `onFire` signature widening directly |
| Uncommon | Malware Amplifier | `onFire` (archetype) | Moderate magnitude bonus for Malware subroutines. Archetype-heavy, subject to session 30's pool-scoping exclusion; implies 3 siblings (one per other archetype) as a content-scaling pattern, not drafted individually here |
| Uncommon | Redundant Ticks | `onTick`/`onTickExpiring` | Your DoT/HoT ticks get one free extra tick before expiring |
| Uncommon | Salvage Protocol | `onSubroutineAcquired` | The first Malware subroutine you acquire each run is immediately upgraded once — the exact motivating example from session 31 |
| Uncommon | Overclocked Accumulator | `onTriggerEvaluate` | Your Accumulator-triggered subroutines need 15% less banked progress to fire — exercises the new 12th hook directly |
| Uncommon | Bulk Buyer | `onShopSlateGenerated` | Shop always offers one extra common option |
| Rare | Auxiliary Process (working name) | `onModAcquired`, granted-subroutine mechanism | Grants a bespoke, **neutral**-archetype, Always-triggered subroutine — always-slotted, cap-exempt, locked against removal. Neutral rather than archetype-tied so it isn't subject to the class-exclusion filter, same reasoning the Neutral Archetype itself used |
| Rare | Rootkit Persistence (working name) | Reactive-subroutine bucket (not a hook at all) | A real `SubroutineDefinition`, fires outside the loadout (no slot). Root-flavored, Always-triggered, small manipulation effect every turn — confirms the *other* session-30 engine bucket still holds up under a real example |
| Rare | Failsafe Cascade | `onTickExpiring` | The first time any of your DoTs/HoTs would expire each fight, it refreshes once for free instead |
| Rare | Black Budget | `onEncounterResolved` | Elite/gatekeeper wins have a chance to upgrade the subroutine reward's rarity by one tier |

Coverage check: all 12 hook points and both engine buckets are exercised
by at least one entry above. Confirmed as a good starting spread.

**Still open, genuinely unchanged**: this is a validation sample, not
the launch pool — no attempt was made to reach final content volume,
author the 3 archetype-sibling Amplifiers, fully spec the two rares'
granted/bundled `SubroutineDefinition`s, or design curses/Event-node
content. What *is* now true for the first time: the shape (session 30),
the hook catalog (sessions 31-32), and a real cross-section of content
all exist and agree with each other — the strongest signal yet that a
future engineering-scoping session could turn this into real
implementation checkpoints without the session-17-style rescope risk.

### Mod Pool Expansion (session 44, `/decision-session`, designed and implemented same-session) ✅ complete

Phase 3 of the user's own multi-session roadmap (player pool ✅ sessions
41-42 → enemy pool ✅ session 43 → **Mods** → full class audit →
gatekeeper roster → heavy final ablation pass). Scope resolved live:
design this session, decide on implementation timing separately once the
content plan exists — deliberately not assumed either way going in,
unlike session 43's same-session treatment of the smaller enemy pass.

**A real migration inconsistency found and fixed along the way, unrelated
to new content**: `createCombatState` (`resolve.ts`) folds each class's
starting-passive Mod into `ownedModIds` specifically so `hasMod` dispatch
works for all 6 class-exclusive Mods (session 30's stated migration).
Four of the six (Sleeper Cell, Zero Day, Feedback Loop, Return to Sender)
actually use `hasMod`. **Foothold and Primed never were migrated** —
`applyFootholdBonus`/`applyPrimedPassive` still gated on
`combatState.classId !== 'breacher'/'operator'` directly, the pre-Mod-
system session-11/25 check. Behaviorally inert today (class↔Mod
ownership is 1:1 by construction, so both checks agree in every real game
state) but real inconsistency — fixed by swapping both to `hasMod`, zero
behavior change, 617/617 tests still pass, confirmed rather than assumed
safe (every test exercising these two goes through `createCombatState`,
which already performs the fold).

**Two real coverage gaps found by re-reading the hook dispatch code, not
assumed from prior docs**: plain `onTick` (distinct from
`onTickExpiring`) has zero Mod content — `resolve.ts`'s own
`applyModOnTickPassives` comment admits it's "wired in now regardless so
the hook point genuinely exists for future content," and nothing ever
used it. Separately, session 31 named three intended uses for
`onEncounterResolved` (Heat mitigation, bonus Data, reward-altering) but
the session-32 draft only ever shipped the latter two (Petty Cache,
Black Budget) — Heat mitigation was never actually exercised.

**Curses/negative-effect Mods — punted a fourth time, but for a real
reason this time** rather than left drifting: bundled with whatever
future session finally designs Event nodes, since an event-choice reward
is the most natural acquisition channel for a deliberately-bad option
(mirrors StS's own Necronomicon/Cursed Key/Sozu, each arriving through a
specific channel, never the general relic pool) — mixing an undecided
acquisition mechanism into a volume-expansion pass would repeat the
session-17 "shape before content" ordering mistake. Relatedly, Events
still don't grant Mods at all despite session 30 naming that as "a
probable third channel" — confirmed still true by checking
`events.ts`/`event-types.ts` directly — parked as its own future item
rather than folded in here, for the same reason: this phase audits
existing Mod *content*, not Events integration.

**Target: double each rarity tier** (7→14 commons, 6→12 uncommons,
4→8 rares — 17 new pieces exactly matching the existing 17, 23→40 general
+ class-exclusive total). Composition principles, in order of priority:
close the two real gaps above; author the 3 archetype-sibling Amplifiers
the session-32 table explicitly flagged as implied-but-undrafted
(Exploit/Encryption/Root, alongside the existing Malware one); give every
other single-instance hook a second example, each with a genuinely
different shape rather than a reskin (e.g. First Contact pulls the
*enemy's* gauge on `onGaugeCross50` where Early Momentum pushes the
player's own); extend the "first archetype-X subroutine acquired is
upgraded" pattern Salvage Protocol established, Amplifier-sibling style,
to a second archetype (Fast Learner, Root). One rare opportunistically
reuses session 40's new **Session Hijack** payload (Session Hijack Relay,
reactive-subroutine bucket) — not sought out as a target, since Mods are
"universal by default" and an archetype-specific payload narrows a Mod's
own audience the same way Malware Amplifier already does, but a natural
fit once the reactive-subroutine bucket (which just wraps a real
`SubroutineDefinition` wholesale) made it a zero-new-engine-work option.

| Rarity | Name (working) | Hook / mechanism | Effect |
|---|---|---|---|
| Common | Cold Boot | `onCombatStart` | Start every fight with a small direct burst on the enemy — offense twin to Warm Boot's Ward |
| Common | Quiet Hours | `onMove` | Small Data trickle every few moves — economy-flavored vs. Light Footing's Heat-flavored |
| Common | Surge Protector | `onIncomingDirectBurst` | Bigger mitigation than Static Shield's, but only the first incoming direct burst each fight (redesigned during implementation — see below) — conditional vs. unconditional |
| Common | First Contact | `onGaugeCross50` | First time the enemy's own gauge crosses halfway, small pull on their progress — defensive pull vs. Early Momentum's offensive push |
| Common | Petty Theft | `onEncounterResolved` | Small flat Data bonus, regular fights only — fills the gap between Petty Cache (any win) and Black Budget (elite/gatekeeper only) |
| Common | Boot Sector | reactive-subroutine bucket | Tiny direct-burst reactive subroutine, Always-triggered — proves the bucket works at common rarity, not just Rootkit Persistence's rare tier |
| Common | Init Script | `onModAcquired` | First Mod acquired beyond the class-exclusive one grants a one-time Data bonus — one-time reward vs. Backup Generator's permanent stat raise |
| Uncommon | Exploit Amplifier | `onFire` (archetype) | Malware Amplifier's effect, Exploit-flavored |
| Uncommon | Encryption Amplifier | `onFire` (archetype) | Same, Encryption-flavored |
| Uncommon | Root Amplifier | `onFire` (archetype) | Same, Root-flavored |
| Uncommon | Fast Learner | `onSubroutineAcquired` | First Root subroutine acquired each run is upgraded once — Salvage Protocol's sibling |
| Uncommon | Threshold Exploit | `onTriggerEvaluate` | Occurrence-Threshold/Scaling subroutines need 1 fewer banked occurrence to fire — Exploit's primary trigger family vs. Overclocked Accumulator's Malware-primary one |
| Uncommon | Scrap Merchant | `onShopSlateGenerated` | Shop always offers one extra uncommon option — Bulk Buyer's sibling, adds tier granularity |
| Rare | Redline | `onTick` | Every DoT tick you apply also credits a small amount directly to your own gauge — closes the zero-content gap |
| Rare | Heat Sink | `onEncounterResolved` | Elite/gatekeeper wins refund a flat amount of Heat — closes the missing "Heat mitigation" use case |
| Rare | Backdoor Access | `onModAcquired`, granted-subroutine | Neutral-archetype, Occurrence-triggered granted subroutine (always-slotted, cap-exempt) — Auxiliary Process's sibling with a different trigger family (was Always-only) |
| Rare | Session Hijack Relay | reactive-subroutine bucket | Root-flavored, uses session 40's Session Hijack payload (two-sided gauge transfer), small/Always-triggered |

All magnitudes TBD/playtesting placeholders, same discipline as every
other numeric constant in this project. Every one of the 12 hook points
and both engine buckets now has ≥2 real examples for the first time.

**Implemented same session, the user's own call once the design draft
landed** (mirroring session 43's enemy-pool treatment, not session
41/42's split): all 17 pieces authored in `mods.ts`/`mod-types.ts`,
every combat-scoped hook wired in `resolve.ts`, run-scoped hooks in
`mods.ts`/`run.ts`/`encounters.ts`, `triggers.ts`'s `updateSubroutineState`
extended for Threshold Exploit's own reduction (a flat fraction off
Occurrence-Threshold's integer `bankTarget`, not a reuse of Accumulator's
multiply-a-raw-magnitude shape — the two families needed genuinely
different math), and `shop.ts`'s three offering functions gained a
parallel `extraUncommons` parameter alongside the existing `extraCommons`
for Scrap Merchant.

**One real design correction made during implementation, not assumed
safe from the draft alone**: Surge Protector's draft called for
conditioning its bigger mitigation on the player's own Heat sitting
below half of max — but `CombatState` has no Heat field at all (Heat is
a between-fights resource tracked in `RunPlayerState`, never threaded
into combat), so a Heat-conditional check would have meant a real
architecture change just for one Mod. Redesigned to a per-fight one-shot
instead (first incoming direct burst each fight, not every one) —
conditional on timing rather than a resource, staying inside existing
`passiveStat`/`setPassiveStat` machinery with zero new engine surface,
while still landing a genuinely different shape from Static Shield's
unconditional-every-hit style.

**Verification**: 638/638 tests passing (21 new, including a structural
pool-size guard confirming 14/12/8 by rarity, 34 general + 6
class-exclusive = 40 total), `npm run check` clean, a fresh 6-class
smoke sweep (40 seeds each, `opportunistic` traversal) ran clean with a
7.5%-25% spread consistent with this project's known per-class ordering.

**Explicitly not done**: no curses, no Events-Mod integration — both
parked per the live decisions above.

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
rather than a passive ability. See `BACKLOG.md` Phase 0 for the closed-
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
new payload kinds needed. Authored and validated an 8-Burner content
sample against the type system (2 combat, 3 map, 3 shop — one per new
effect kind, confirming both `MapBurnerEffect` and `ShopBurnerEffect`
need no changes). Full implementation-facing checkpoint spec (including
the type system's exact shape) in `BACKLOG.md`'s new "Burners + Events
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
(the free-roam movement model's flat per-move cost, the margin-of-loss
formula) depends on the player being able to do real risk math, which a
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
`BACKLOG.md`'s new "Burners + Events Implementation" write-up under
Phase 5.

### Gameplay Simulation Heuristics (session 45, `/decision-session`)

Every script-driven run (`playRun()`, `scripts/sweep.ts`, `scripts/
layer-funnel.ts`) has always resolved acquisition/Shop/Event/Burner
decisions via deliberately "legal-not-good" defaults —
`alwaysAcquireFirst`, `buyCheapestAffordable`, `alwaysFirstEventChoice`,
and Burners going entirely unused (every activation point defaults to a
`never*` no-op). This was flagged as a real gap back at session 34's
Mods-sweep follow-up ("Not yet done: a synergy-aware acquisition/Shop
strategy") and never picked up. It resurfaced this session while
grounding the still-open "full class audit" (`BACKLOG.md`'s roadmap) in
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
against the current codebase) is in `BACKLOG.md`'s new "Gameplay
Simulation Heuristics — Implementation" write-up under Phase 5, for a
future `/dev-session`.

## Enemy Design

**Session 27** replaced the placeholder enemy model with a real design,
closing the two banked `BACKLOG.md` items from session 26 (enemy loadout
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
**Root is deliberately rare on regular enemies, more common on
elite/gatekeeper** — it's the most abstract archetype (manipulation,
denial, the Cribbage layer itself), and reads better as "you're facing
something sophisticated" than as an early punching-bag's toolkit.
Whatever Root content enemies get needs real passive support behind it,
the same lesson session 25's player-side Root rework already
demonstrated — a bare Root payload kit under-delivers without it.

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

### The Roster (session 27, continued)

32 named enemies, drafted live and checked for two real issues along the
way: several pool uncommons/rares use a `chained` trigger keyed to a
*specific* subroutine id, and three of those prerequisites
(`precision-strike`, `priority-override`, `silent-worm`) are Operator/
Saboteur-exclusive starting pieces, not generic pool subroutines — an
enemy kit including the chained piece without its named prerequisite
would ship a dead subroutine that can never fire. Every kit below either
avoids those four chains or pairs a chained piece with a pool-only
prerequisite it's legal to include (`fork-bomb`→`ransomware-cascade`,
`patch`→`full-rollback`, `cron-job`→`full-system-compromise`). Also
caught: `zero-knowledge-exploit` requires the player to already carry the
Corrupted debuff, so it only appears paired with a Corrupted-applier in
the same kit (or not at all). Second issue, tonal: an early Exploit/
Malware-heavy naming pass drifted toward "external criminal
organization" flavor (Cartel/Ring/Cell/Auction), which implies a rival
faction the fiction doesn't support — **every enemy in this game is the
target network's own defenses**, even the offense-flavored kits (read as
that network's security team or automated countermeasures hacking back),
not a separate group. Renamed on catch: Zero Day Auction → Incident
Response, Ransomware Cartel → Ransomware Deployment, Malvertising Ring →
Compromised Ad Server, Supply Chain Cell → Compromised Dependency.
Network-specific external-actor flavor (e.g. a contract that's literally
breaching a criminal organization) is real future idea space, explicitly
not designed here.

**Regular** (12 — commons only, no Root, 2 per archetype
singleton/pairing per the earlier "2-3 of each" instruction, layer
eligibility is a `minLayer` a name stays in the pool from):

| Name | Archetype(s) | Layers | Subroutines | Passive |
|---|---|---|---|---|
| Script Kiddie | Exploit | 1+ | `script-kiddie`, `port-scan` | *Lucky Guess* — first Exploit fire each combat gets a small flat bonus |
| Fuzzer Bot | Exploit | 2+ | `fuzzer`, `race-condition` | *Trial and Error* — each repeat fire this combat gets a small stacking bonus (capped) |
| Botnet Node | Malware | 1+ | `botnet`, `adware` | *Still Spreading* — its DoT ticks once extra before expiring |
| Keylogger Process | Malware | 2+ | `keylogger`, `corrupted-cache` | *Long Runtime* — its first DoT this combat starts with one tick already banked |
| Legacy Firewall | Encryption | 1+ | `basic-auth`, `checksum` | *Stubborn Default* — mitigates a small flat amount off the first hit it takes each combat |
| Access Gate | Encryption | 2+ | `two-factor`, `sandboxing` | *Locked Down* — its Ward/mitigation absorbs a slightly higher flat amount |
| Drive-By Kit | Exploit + Malware | 1+ | `off-by-one`, `ransomware` | *Smash and Grab* — its first Exploit fire each combat also ticks its own Malware DoT once immediately |
| Rogue Endpoint | Exploit + Malware | 2+ | `credential-stuffing`, `trojan`, `race-condition` | *Opportunist* — its next fire after the enemy's gauge crosses 50% gets a small bonus |
| Patch Runner | Exploit + Encryption | 1+ | `port-scan`, `patch` | *Cover Your Tracks* — a small symmetric push+pull the first time its own gauge crosses 50% of threshold |
| Perimeter Sentry | Exploit + Encryption | 2+ | `privilege-escalation`, `access-control` | *Hold the Line* — after the shared meter crosses a threshold in its favor, its next fire gets a small bonus |
| Quarantine Daemon | Malware + Encryption | 1+ | `patch-notes`, `adware` | *Steady State* — small flat bonus to its own HoT tick magnitude |
| Hardened Workstation | Malware + Encryption | 3+ | `sandboxing`, `two-factor`, `slowloris` | *Grinds You Down* — HoT and DoT ticks both get a small flat bonus (Warden-echo) |

**Elite** (8 — 3+ subroutines each, mostly uncommons, 1-2 real
passives; 6 non-Root groups + 2 Root-flavored, deliberately holding
Root+Exploit and Root+Encryption back for Gatekeeper):

| Name | Archetype(s) | Layers | Subroutines | Passive(s) |
|---|---|---|---|---|
| Zero-Day Broker | Exploit | 1+ | `zero-day-chain`, `buffer-overrun`, `payload-multiplier` | *Fresh Exploit* — first fire each combat gets a real bonus |
| Ransomware Deployment | Malware | 1+ | `fork-bomb`, `polymorphic-worm`, `spyware` (worm's Corrupted arms spyware) | *Escalating Demand* — DoT magnitude grows a little each tick, capped |
| Zero Trust Node | Encryption | 1+ | `rate-limiting`, `honeypot`, `redundant-backup` | *No Exceptions* — Ward refreshes once per combat instead of one-shot |
| Compromised Ad Server | Exploit + Malware | 2+ | `watering-hole`, `polymorphic-worm`, `off-by-one` | *Infection Vector* — each Exploit fire also progresses its Malware DoT |
| Hardened Perimeter | Exploit + Encryption | 2+ | `watering-hole`, `air-gap`, `privilege-escalation` | *Foothold, Reinforced* — push+pull at 50% gauge, plus a small denial on the player's next fire |
| Blackout Cell | Malware + Encryption | 3+ | `persistent-threat`, `redundant-backup`, `slowloris` | *Attrition* — HoT/DoT tick bonus; *Held Together* — first cleanse against it each combat fails |
| Backchannel Handler | Root | 3+ | `backchannel`, `dns-poisoning`, `dead-drop` | *Dead Drop Protocol* — each Root fire also drains a little of the player's gauge; *Off the Grid* — small self-mitigation each turn |
| Compromised Dependency | Root + Malware | 3+ | `supply-route`, `polymorphic-worm`, `fork-bomb` | *Sleeper Network* — its Root fire also boosts its Malware DoT |

**Gatekeeper** (12 — 2-4 per layer, fully bespoke, 4-ish subroutines
leaning on rares, deliberately chaining pool-legal combos. Root+Encryption
(the Ghost-echo) is deliberately held back until Layer 4 to land as the
run's real final-boss pairing, matching Ghost's own "hardest class"
status):

**Layer 1 — perimeter/DMZ:**

| Name | Archetype(s) | Subroutines | Passive |
|---|---|---|---|
| The Concierge | Exploit + Encryption | `total-pwnage` (rare), `patch`→`full-rollback` (chain), `privilege-escalation` | *Reception Protocol* — a strong push+pull the first time the shared meter tips its way; auto-cleanses itself once per combat |
| Firewall Prime | Encryption | `zero-trust` (rare — punishes overextension), `air-gap`, `redundant-backup` | *No Way In* — boosted Ward amount, refreshes twice per combat |
| Ghost Process | Root | `cron-job`→`full-system-compromise` (chain), `dns-poisoning` | *Digital Ghost* — every Root fire drains a flat amount off the player's gauge |

**Layer 2 — internal LAN:**

| Name | Archetype(s) | Subroutines | Passive |
|---|---|---|---|
| Incident Response | Exploit | `supply-chain-compromise` (rare, togglable), `vulnerability-scan` (rare, reactive), `zero-day-chain` | *Highest Bidder* — chain-finisher pieces get a bonus per Exploit subroutine already fired this combat |
| The Quarantine Ward | Malware + Encryption | `epidemic` (rare, suit-tally, togglable), `cold-storage` (rare, suit-tally), `slowloris` | *Total Quarantine* — every tick, DoT or HoT, nudges its own gauge forward |
| Zero-Sum | Root + Exploit | `supply-route`, `dead-drop`, `total-pwnage` (rare) | *Primed to Strike* — each Root fire lowers the cost/threshold of its own next Exploit fire this combat |

**Layer 3 — secured subnet:**

| Name | Archetype(s) | Subroutines | Passive |
|---|---|---|---|
| Total Compromise | Malware | `fork-bomb`→`ransomware-cascade` (chain), `total-compromise` (rare, reactive) | *Cascading Failure* — once its DoTs have ticked 3 times combined this combat, all gain a permanent tick-magnitude boost |
| Adaptive Threat | Exploit + Malware | `vulnerability-scan` (rare, reactive), `polymorphic-worm`, `spyware` | *Adaptive Defense* — every player cleanse against it buffs its next fire (any archetype) |
| Silent Corruption | Root + Malware | `rootkit-deployment` (rare, suit-tally), `epidemic` (rare, suit-tally), `supply-route` | *Total Corruption* — both rares' suit-accumulation progresses 50% faster; either refires once automatically the first time it would expire |

**Layer 4 — core:**

| Name | Archetype(s) | Subroutines | Passive |
|---|---|---|---|
| Null Session | Root + Encryption | `cron-job`→`full-system-compromise` (chain), `zero-trust` (rare), `air-gap` | *Null Session* — the first time the **player's own** gauge crosses 50% of threshold, absorbs a flat amount into its own gauge progress (mirror-punish of Ghost's Return to Sender) |
| Kernel Panic | Exploit + Malware + Encryption | `total-pwnage` (rare), `epidemic` (rare, suit-tally), `cold-storage` (rare, different suit) | *Redundant Kernel* — the first time a ticking effect on it would be cleansed/expire this combat, it gets one free re-arm instead |
| Ghost in the Machine | Root | `dns-poisoning`, `dead-drop`, `backchannel` | *Total Access* — every Root fire drains more off the player's gauge than any other enemy; its next fire immediately after is guaranteed free, once per combat (Zero Day's one-shot-gate shape, mirrored) |

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
Phase 1 already implied on its own (`BACKLOG.md`: "should be testable as
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
with a suit" and "power an archetype": scoring 3 Malware cards *is*
charging your Malware subroutines. This also resolves the suit-archetype
pairing question definitionally — the suits *are* the archetypes — so
the remaining design work was just each suit's visual identity, same
relationship a real suit symbol (♠) has to its name (Spade):

| Suit / Archetype | Icon | Color |
|---|---|---|
| **Exploit** | Bug — the literal "software bug" a vulnerability targets | Red (offense/danger/alert) |
| **Malware** | Skull — the universal malware/virus icon | Toxic/acid Green (poison/corruption, deliberately sickly rather than "Matrix green") |
| **Encryption** | Padlock — the canonical encryption/security symbol (same as HTTPS trust indicators) | Blue (security/trust) |
| **Root** | Crown — root access as supreme/superuser authority, not a terminal-prompt glyph (overused hacking-media iconography); also breaks the "danger/security" pattern the other three share, fitting since Root is an access concept, not a threat concept | Gold (authority/elite access) |

All four icons are simple, bold, mutually distinct silhouettes suitable
for small-scale card reproduction, mirroring ♠♥♦♣'s own visual design
constraints. Color is a reinforcing cue, not the primary differentiator —
icon shape is what actually distinguishes suits, which is why Exploit's
red sitting near Malware's green isn't treated as a blocker (a real
concern for red-green colorblind players if color were the only cue, but
icon shape isn't affected by colorblindness).

**Flagged for later refinement, not blocking**: Root's Crown icon was
noted as the weakest of the 4 and may get revisited; Exploit's color
could shift from red closer to pink/purple (which would also sidestep
the red/green proximity above, though that's not why it was raised).

## Name

**crib.exe** (stylized) — domain `cribexe.com`, confirmed available.

## Open Questions

None currently blocking — this section is clear as of session 13. The
one previously-banked idea (a future ability to bypass a closed/lost map
node, session 9) is now resolved — see the new "Burners" subsection
under Meta-Progression, whose map-context effects include reopening a
closed node.
