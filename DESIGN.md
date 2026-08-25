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
  free-roam movement model.
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
but never free. **Crossing a layer's gatekeeper is one-way** — the
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
(spend Data — see Subroutine Acquisition); an **Event** node (undesigned
content, third acquisition channel). A node becomes **inert** after its
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
- An expanding pool of in-run passive items (StS-relic equivalent)
  findable during runs — including passives that hook into subroutine
  tags (see Subroutine Tags, below).
- The installed-loadout slot cap itself (see Subroutine Acquisition,
  below) can grow via a persistent, cross-run unlock, the same as
  everything else on this list.

**Scope note (session 21)**: of this list, only Classes and Subroutine
Acquisition are designed enough to build — see `BACKLOG.md` Phase 4.
Ascension-style difficulty and the expanding in-run passive-item pool are
still genuinely undesigned ("broad strokes" above is the whole design so
far) and need their own future `/decision-session` before either is
implementation-ready; they're deferred to Phase 5 alongside other
undesigned content.

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
  recon/information-gathering: manipulates the Cribbage layer itself
  (forcing an opponent's discard, peeking the crib, skewing the cut,
  marking suits) *and* combat-meta state (the player's or enemy's
  initiative gauge/threshold, or other enable-condition counters) —
  "root access" to any piece of the system.

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
| **Saboteur** | Malware + Root | Insidious — corrupts from within while manipulating the system around it. | **Sleeper Cell** — the first Malware debuff applied each combat also advances one Root subroutine's condition. |
| **Operator** | Exploit + Root | Setup-and-strike: Root primes the field, Exploit cashes in. | **Primed** — the first time a Root subroutine fires each combat, reduce the next Exploit subroutine's trigger threshold. |
| **Warden** | Malware + Encryption | Patient and grindy — wins by outlasting rather than outpacing. | **Feedback Loop** — Encryption HoT effects also apply a small Malware DoT tick to the enemy. |
| **Ghost** | Encryption + Root | Pure control, no primary damage access — wins by locking the opponent down and opportunistically finishing with off-class picks. The last class unlocked; the most challenging to play. | **Return to Sender** — whenever your Ward shield actually absorbs an incoming hit, a portion of what it absorbed carries through into your own gauge too. |

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
(Burning Blood, Ring of the Snake, etc.) play. Five of the six are mild
tempo/consistency nudges reinforcing a class's identity; **Ghost's is
doing real structural work, not just flavor** — rather than granting
off-class access to Exploit/Malware, "Return to Sender" makes Ghost's own
toolkit (pure defense) double as offense, directly answering the
damage-access gap noted when Ghost was introduced above (defending so
precisely that the attacker's own aggression backfires on them),
complementary to the off-class reward-pool access Ghost already has.

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
- *Steady Hand* (Cantrip) — Always; small guaranteed Breach/Containment push
  in your favor every turn. Tag: Daemon.

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
- **Encryption** (4): **instant counter-push** (directly reduces the
  *opponent's* gauge — a genuine suppression tool, not a push toward any
  shared value); **ward** (an accumulating shield on the caster's own
  side — absorbs the opponent's future non-Piercing offense, denying the
  gauge credit it would otherwise earn them, until the shield depletes;
  Piercing bypasses it entirely, the one counter-play against a
  ward-heavy build); **HoT** (gradual reduction of the *opponent's*
  gauge over time, mechanically symmetric to Malware's DoT's tick-
  cadence framework, just aimed at suppression instead of credit);
  **cleanse** (removes an existing debuff afflicting you).
- **Root** (3): **instant manipulation** (directly alter a gauge/
  threshold, a suit tally, or another subroutine's enable-condition
  progress); **Cribbage-layer manipulation** (force a discard, peek the
  crib, skew the cut, mark a suit); **scheduled sabotage** (fires now,
  but its effect doesn't resolve until a specific *future* Cribbage-flow
  checkpoint — e.g. "at the next deal, force the opponent to send a
  specific card to the crib" — rather than resolving immediately).

**DoT/HoT tick cadence** is a per-subroutine property, not a universal
rule — different Malware/Encryption subroutines can use different
cadences. Two flavors so far: **global pulse** (ticks every X combined
points scored by *either* side, applies instantly the moment the
threshold crosses, independent of whose turn it is — exempt from the
normal "fires on your turn" rule) and **caster's-turn pulse** (ticks only
when the caster who applied it gets a turn, gated like any normal
subroutine firing).

### Subroutine trigger catalog

What causes a subroutine to become enabled. Six trigger families, plus
one orthogonal property. Four of the families are each one archetype's
primary identity; the other two are universal, cross-cutting tools any
archetype's subroutines can use — the same role Togglable already plays:

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
  archetype's subroutines can chain into each other.
- **Always triggers** (universal) — no real condition, fires every turn
  that side gets. Informally called **"Cantrip"** subroutines — meant to
  be low-power, not heavy hitters: guarantees something always happens
  each turn even if nothing else is ready (chip damage, feeding another
  subroutine's accumulator, minor healing/warding). Any archetype can
  have a cheap Cantrip-tier version.
- **Togglable** (orthogonal to all 6 families above) — some subroutines
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

Five starting tags (extensible later, not a fixed exhaustive taxonomy —
grows the same way the subroutine pool itself grows over time):

- **Trap** — delayed/scheduled: fires now, resolves later (Root's
  scheduled sabotage; Threshold/Scaling Occurrence subroutines that
  spring after banking).
- **Backdoor** — bypasses normal rules or counters (Exploit's piercing
  burst; anything that ignores mitigation outright).
- **Firewall** — reactive/defensive, responds to being attacked
  (Encryption's ward; Enemy-state-triggered defensive effects).
- **Worm** — chains or propagates (Chained-trigger subroutines; effects
  that feed or buff other subroutines in the sequence).
- **Daemon** — persistent/background/ongoing (Accumulator-triggered,
  DoT/HoT, Always/Cantrip subroutines) — the literal computing term for a
  background process, a precise fit for the setting.

A subroutine can carry **multiple tags** when it genuinely fits more than
one (e.g. a Root scheduled-sabotage effect that also chains into another
subroutine could be both Trap and Worm) — more synergy space for cheap
complexity cost, since a tag is just a label, not a resource.

**How passives use tags**: an in-run passive item (see Meta-Progression)
can reference a tag to enhance every subroutine the player has carrying
it, regardless of archetype — e.g. "your Trap-tagged subroutines do X."
Specific passive designs aren't written yet; this section defines the
hook they'd use.

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

None currently blocking — this section is clear as of session 13. One
banked idea remains (a future ability to bypass a closed/lost map node,
session 9), tracked in `BACKLOG.md` Phase 0 rather than here since it was
never a required design gap, just a noted idea for later.
