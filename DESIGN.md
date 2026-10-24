# crib.exe — Design

A browser-based, hacking-themed roguelite in the Slay the Spire mold —
node-map run structure, permadeath, meta-progression between runs — where
combat is resolved by playing real Cribbage instead of the usual
attack/skill/power card battles.

Status: playable in the browser. A full four-layer run, six classes, a
tutorial (`docs/tutorial-design.md`), first-time tips, plain Cribbage
with a coach and lessons, and saves are built (`docs/playable-design.md`
milestones 1–4); milestone 5, polish, is under way. Meta-progression
*between* runs is not designed yet.

This doc is the settled design as it stands now, with the reasoning
behind it. Superseded models, session-by-session backstory and old
catalogs are archived verbatim in `docs/archive/design-history.md`;
decision records live in `docs/archive/` (`archetype-redesign.md`,
`recalibration-design.md`, `authoring-design.md`, `balance-design.md`
and others) and `docs/` (`playable-design.md`, `trace-evasion-design.md`,
`tutorial-design.md`). See `BACKLOG.md` for open work and
`docs/session-logs/` for the session history.

## Concept

You play a hacker taking on "contracts" — each run targets one network,
breached layer by layer, with combat encounters against the network's
defenses (and eventually a rival hacker/AI) resolved as head-to-head
Cribbage matches. Deckbuilding isn't about which card to play on your
turn — it's about which automatic subroutines you've installed, in what
order, and how well you can actually play Cribbage to trigger them.

## Resources

Two deliberately separate resources, not one shared health stat, plus a
currency.

### Heat

**Heat** is the player's risk of getting caught: a *rising* danger meter,
not a depleting health bar, and player-only (enemies don't persist across
fights). It is what gives the run its StS-HP-equivalent friction — rest
vs. push forward, risk vs. reward on the map. It is a **per-layer
budget** (`heat.ts`; the decisions are run-economy D1–D7 and
recalibration R5–R8, `docs/archive/recalibration-design.md`):

- each layer has its own **allowance**, growing with depth so each layer
  leaves about the same room to explore (`LAYER_HEAT_ALLOWANCE`, 56 / 63 /
  72 / 80, plus Backup Generator's bonus; session 69,
  `docs/tuning-design.md` T2: shrinking ones left layer 1 slack and layer 4
  a straight route); **reaching it ends the run** (caught);
- **every move costs Heat** (`HEAT_PER_MOVE`), in any direction, onto any
  node, resolved or not — see Map & Run Structure;
- every fight's Heat is a **posted baseline** (tier × layer, knowable
  before committing) plus a **performance term** read off the enemy's
  *final* Containment fill on a win — a scrappy win is louder than a
  clean one, and the player watches that cost build on the enemy's gauge;
- a **loss** of a regular or elite fight costs the baseline plus a fixed
  multiple (`LOSS_MULTIPLIER`, 1.5×) of the full performance term, and
  closes the node; so clean win < scrappy win < loss holds everywhere and
  every node's risk is a posted triple. A **gatekeeper loss** is not a
  Heat cost at all: it is **Quarantine**, and the run ends;
- **alarm** enemies add Heat directly while they fight (`heatPressure`,
  the Spotlight Mod, and the enemy-only Trace effect);
- an **Event's Heat** is a multiple of the layer's elite-loss charge
  (`eventHeat`), so Events scale with depth like every posted price;
- every layer has at least one Safehouse, where Rest lowers Heat;
- clearing a gatekeeper **resets Heat to 0** — after the gatekeeper's
  toll, charged *after* that fight, has been survived (R8), or a **trace
  evasion** won if it wasn't (see Map & Run Structure → How a run ends).

Every Heat price is stated to the player before they commit. That
transparency is the resource's rule: Heat is the one thing the player is
meant to reason about, not gamble with. (Session 50 removed a
margin-of-loss adjustment for breaking it.) Numbers are first-pass
placeholders.

**Trace** was once a player-side, in-fight Heat accumulator; session 58
removed it (its cost landed as run-end Heat deaths, far from the choice
that caused it). A noisy piece now pays in **feed** instead, progress
handed to the opponent's gauge inside the fight. "Trace" survives only as
an enemy-only effect that gives you Heat. The original model is archived.

### Breach/Containment

An in-combat-only pair of independent per-side gauges. Each side races
toward its own win, filled only by that side's own offense. **Breach** is
the attacker's own gauge — reaching it means the vulnerability gets
successfully exploited and the node falls. **Containment** is the
defender's own gauge — reaching it means the target's security closes
around the exploit before it can be leveraged, and that specific route
into the node stops being viable (a closed node to route around on a
regular/elite loss, or full **Quarantine** — the player's presence
purged from the whole network — on a gatekeeper loss).

The Credit verb fills the caster's *own* gauge, never the opponent's;
Suppress instead reduces the *opponent's* gauge directly, and Ward
absorbs the opponent's incoming progress before it lands — which makes
"mitigation can't win alone" a free structural property, since only a
side's own offense can ever advance its own gauge. (That property is also
why every archetype must carry a credit path — see the credit rule under
Archetypes & Subroutines.) Independent gauges replaced an early shared
push/pull meter, whose zero-sum scale produced runaway convergence.

Both gauges reset each combat. **Escalation**: once a match runs long
enough (from hand 10), both sides' thresholds shrink each subsequent
hand (floored, never to zero), and hand 20 is a hard resolution, so a
slow fight still resolves in bounded time.

### Data

**Data** is the run's currency (stolen data sold on a black market):
awarded on every combat win, scaled by encounter tier, independent of the
reward choice, and spent at Shops (`data.ts`).

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
subroutine on that side fires its **Process**, and each whose Hook
criteria are met also fires its **Hook** (see Archetypes & Subroutines).
Effects resolve against Breach/Containment, the initiative gauges, other
subroutines, or the Cribbage layer.

Loadout order matters: subroutines resolve top-to-bottom like a script,
and Sequence Hooks reward specific arrangements (adjacent and any-prior
chains). Order is adjustable between fights only — there is no
mid-combat lever. The one thing the player activates by hand mid-fight is
a combat Burner, on their own turn.

## Archetypes & Subroutines

Glossary: a subroutine's two effects are its **Process** and its **Hook**
in the game; `alpha` and `beta` in code and in the decision records.

The model was rebuilt from scratch in session 51 (decisions A1–A12,
`docs/archive/archetype-redesign.md`), on session 50's per-turn model
(`docs/archive/run-economy-design.md` D11–D15). Two lessons drove it:
archetypes defined by role and flavour first had ended up with no way to
win (patched more than once), and triggers that gated whether a piece
acted at all let rarity silently decide *existence*. The old model is
archived.

The content is authored: **36 player subroutines**, 9 per archetype
(`src/engine/content/`), plus 20 enemy-only pieces
(`content/enemy-subroutines.ts`).

### Anatomy of a subroutine: alpha and beta

Every subroutine has two effects:

- **Process** (alpha) — fires on every turn activation the owning side
  gets. A Process is one verb (below) at a magnitude, with an optional
  **growth** (+x each time it fires). A Process may act on neither gauge
  — "add charges to a Hook" is a legitimate Process (the **Charge**
  verb).
- **Hook** (beta) — fires when its criteria are met. It takes one of three
  relationships to the Process:
  - **Enhance** — the Process fires stronger ("elevated", D13's term).
  - **Different effect** — a separate effect bundled onto the turn's
    fire.
  - **Immediate** — fires the moment its criteria are met, outside the
    turn gate entirely.

A Hook is **one bundle** (D12): it may raise magnitude *and* add a
mechanic, but a piece never stacks several Hooks. One Process and one
Hook are each independently measurable, which is what keeps pricing
tractable.

Rarity gates **amplitude, never existence** (D11). A common and a rare
both act every turn; the rare's Process and Hook are bigger or its Hook
richer.

### Verbs (what an effect does)

Seven verbs, shared by every archetype (A4, A5). Archetype identity lives
in which verbs a piece uses and in its Hook, not in archetype-exclusive
effect kinds.

| Verb | Does | Primary user |
|---|---|---|
| **Credit** | fills the caster's own win gauge | every archetype — the offense |
| **Suppress** | pushes the opponent's gauge back | Healing (Daemon) |
| **Ward** | absorbs the opponent's incoming progress until depleted | Defense (Honeypot) |
| **Empower** | boosts other subroutines' output, for the turn it fires in | Empowerment (Overclock) |
| **Tempo** | speeds the caster's initiative or slows the opponent's | Tempo (Overclock), Control (Exploit) |
| **Disrupt** | acts on the Cribbage layer: recon, forced discard | Control (Exploit) |
| **Charge** | adds charges to this piece's or another piece's Hook | anyone; feeds Hooks |

Three more effects are **enemy-only**: **Trace** (gives you Heat),
**Wipe** (your Hooks lose banked counts) and **Strip** (you lose Ward).

Lasting effects are durations on Tempo or Suppress, not a separate kind.
Variants of Credit — ignore Ward, scale off earlier fires this turn,
bigger but feeds the opponent — are Hook modifiers on Credit. Converting
banked Ward into Credit, or taking from the opponent's gauge, are
Honeypot Hooks. There are no damage- or heal-over-time effects: a
Process already fires every turn.

### Beta criteria: source × shape

A Hook's criteria are a **source** (what it watches) combined with a
**shape** (how it responds), chosen independently (A5).

| Source | Examples | Archetype affinity |
|---|---|---|
| **Cards** | a scoring category (fifteen, pair, run, flush, nobs, thirty-one, go); the archetype's own suit tally. Optional: whose scoring to watch, minimum magnitude | Exploit |
| **Progress** | own points scored, this piece's fire count, defense absorbed | Daemon, Honeypot |
| **State** | dealer / non-dealer, own Ward size, either side's gauge level, points scored this hand (`handPointsAtLeast`) | Honeypot, Overclock |
| **Sequence** | what fired before this piece in the loadout (below) | Overclock |

| Shape | Behaviour |
|---|---|
| **Graded** | magnitude grows per banked charge, up to a cap |
| **Stepped** | a distinct effect once N charges have banked |
| **While-true** | active while a condition holds — a condition is a charge of 1 (D15) |
| **Immediate** | fires the moment the criteria are met, outside the turn |

Charges (counts, on screen) reset when spent. His Heels is not a source
(one occurrence per game, dealer only, outside either player's control).

### Loadout order and chains

Order is a real decision (D13). Pieces fire top to bottom each turn, and
**Sequence** Hooks come in two strengths:

- **Adjacent** — the slot directly above *or* below holds a matching
  piece (by id, archetype or verb). Positional, either side, and fixed by
  the arrangement — known before the turn starts, regardless of what
  fires (A12). A graded adjacent Hook counts both neighbours, rewarding
  being flanked. Hard to satisfy, so the larger Hook.
- **Any-prior** — a matching piece fired *elevated* earlier this turn.
  Firing order, not position. Easier, so the smaller Hook.

The two strengths differ in kind, not just size: adjacent is a placement
puzzle the UI shows directly; any-prior is turn dynamics.

Six ordered slots with adjacency chains is the build puzzle. The UI
supports drag-to-reorder, and the simulated player reorders with a real
`ReorderStrategy` (`synergyAwareReorder`).

### The four archetypes

Built mechanics-first (A2): four ways to win, four kinds of utility, one
each, then named (A7). Each is bound 1:1 to a suit (A1) — see Theming.

| Archetype | Offensive theme | Utility | Signature Hook | Typical Hook source |
|---|---|---|---|---|
| **Exploit** | **Spike** — big Hook moments on Cribbage scoring | **Control** — the Cribbage layer and the opponent's tempo | Enhance (graded) | Cards |
| **Daemon** | **Ramp** — Process growth; stronger the longer the fight runs | **Healing** — push the opponent's gauge back | Different effect (stepped) | Progress |
| **Overclock** | **Tempo** — win by taking more turns | **Empowerment** — buff other subroutines | Immediate | State, Sequence |
| **Honeypot** | **Conversion** — turn banked defense and the opponent's progress into own progress | **Defense** — stop the opponent's gain before it lands | Different effect | State, Progress |

Each pairing is chosen so the utility serves the offense: Exploit steers
the cards toward its spike; Daemon survives long enough to scale;
Overclock's extra turns multiply its empowered fires; Honeypot's banked
defense *is* its fuel.

Signature shapes are **affinity, not exclusivity** (A3).

**The credit rule (A3), archetype-level.** Not every subroutine has to
credit the win gauge, but every archetype must have a reliable way to
win on its own. Checkable form: a kit drawn only from one archetype's
commons, and every class's starting loadout, must contain a real credit
path. Enemies follow the same rule: every enemy carries at least one way
to credit its own gauge (`enemies.test.ts` guards it).

**Watch item: Honeypot.** Conversion/Defense is accepted as the
higher-skill-floor archetype, and the one most at risk of defense that
never converts. Pricing rule 3d is the guard.

### Classes

Six classes, one per archetype pair (A8; named and authored in step 3,
`docs/archive/authoring-design.md` C1–C4; `classes.ts`). Each carries a
**class Mod** (code: bridge) granted at run start, never offered in the
general pool, that makes one of its archetypes feed the other. Since
session 60 every class Mod triggers on the owner's own **fifteens or
pairs**, three each: the owner's scoring is the channel Cribbage skill
reaches a fight through. Pairs come about half as often, so a pair Mod
pays about twice as much.

| Class | Pair (id) | Class Mod | Triggers on |
|---|---|---|---|
| **Blackhat** | Exploit + Overclock (`exploit-overclock`) | Lateral Movement — haste | pairs |
| **Operator** | Exploit + Daemon (`exploit-daemon`) | Backdoor Maintenance — Suppress | fifteens |
| **Eidolon** | Daemon + Overclock (`daemon-overclock`) | Invocation — Daemon growth, Overclock Hook counts | fifteens |
| **Breacher** | Exploit + Honeypot (`exploit-honeypot`) | Foothold — bank Ward | pairs |
| **Warden** | Daemon + Honeypot (`daemon-honeypot`) | Hardened Perimeter — Suppress and bank Ward | pairs |
| **Wraith** | Overclock + Honeypot (`overclock-honeypot`) | Phase Shift — Ward and haste, on hands you deal | fifteens |

Exact amounts live in `resolve.ts` (`BRIDGE_*`). All six are selectable
from the start; unlock order waits on meta-progression. Cutting to fewer
classes was considered and rejected: most measured class spread turned
out to be gatekeeper matchup, not the classes (see Enemy Design).

Each class specializes in its 2 archetypes for acquisition (see
Subroutine acquisition): rewards draw primarily from them, with
occasional off-class pieces from the other two.

### Starting loadouts

Three **commons** in loadout order (A9; `content/starting-loadouts.ts`):
an **offense** piece with a credit path (the credit rule holds from turn
one), a **utility** piece from the other archetype, and a piece that
shows off the class Mod. That leaves 3 of 6 slots for acquisition.
Exploit classes start with the noisy Fuzzer; Honeypot classes carry
plain-Credit partner pieces (rule 3d), since conversion pays off only
after defense is banked.

### Pricing (step 2, sessions 52–53)

Every piece is priced in **Credit per turn**, the currency (R1). The
full record, with every measurement behind these rules, is
`docs/archive/recalibration-design.md`; raw output is in `docs/calibration/`.
The instruments are:

- `src/engine/pricing.ts` with `scripts/price-check.ts`: seat-swapped
  mirror duels, a host plus the piece being priced against a host plus
  Credit Δ, solving for the Δ that ties.
- `src/engine/beta-pricing.ts`: the formula.
- `scripts/beta-validate.ts`: checks the formula against duels.
- `scripts/feed-price.ts`: prices a noisy piece's feed against its band.
- `scripts/skill-check.ts`: skill retention.

**Authoring rules:**

1. **Verb prices** at a Credit-2 host, per point of the effect's amount:
   - **Flat across hosts:** Credit 1; Suppress ~0.96; Ward ~0.97;
     credit taken from the opponent ~1.85 (the strongest verb per
     point); Empower ~1 per point per boosted piece.
   - **Scaling with what they act on:** Haste ¼ turn ≈ ⅓ × own output,
     halved by the points cooldown; Slow and forced discard ≈ 0.27 ×
     the opponent's output; credit spent from your own Ward is worth only
     the Ward that would otherwise go unused. Price these in context.
   - **Disrupt:** reveal-hand and reveal-crib are cheap (~0.1–0.2).
     Forced discard halves against a weaker opponent.
   - **Prices add:** two effects on one piece cost the sum of their parts.
2. **Piece price = Process + expected Hook uses per turn × one use**
   (`piecePrice`). It holds within ~3% for card, progress and
   dealer/non-dealer sources. It returns null rather than guess for
   sequence Hooks, immediate state Hooks, and context-priced verbs.
   **Price these by duel instead:**
   - Hooks on gauge or Ward conditions (the condition is correlated with
     the effect's worth);
   - immediate extra-fire Hooks (they carry a timing premium, ~+25% on
     the Hook).
3. **Charge:** one charge a turn into a Hook still below its cap is worth
   one extra use of that Hook (~1 Credit for a +1 enhance).
   **A Charge partner needs cap to spare when the charge arrives**
   (step 3, checkpoint 1). A charge into a Hook that is already full is
   wasted.
3b. **Growth is priced in a mid-length fight** (step 3, S9). A piece
   whose Process grows is priced against a Credit-4 host (~8 hands) rather
   than the standard Credit-2 host (~10), with its host-2 and host-8
   (~5 hands) prices reported as its range. Ramp is meant to be strongest
   in long fights.
3c. **Price positional pieces in position** (step 3, checkpoint 3).
   Empower and sequence pieces are priced where they're designed to sit
   (`priceAddition`'s numeric placement), with a neutral spacer between
   them and any other adjacency piece, so the price measures this piece
   and not the bonus its presence gives a neighbour. Flat haste is worth
   little; tempo pieces work better as large, occasional hastes.
3d. **Conversion must scale with your own turns** (step 3, S11). Ward
   absorbed is powered by the opponent's attacks, so conversion fuelled
   by it inverts skill at volume. A Honeypot kit whose offense was mostly
   that kind of conversion measured retention as low as −1.0. Main
   conversion spends your own banked Ward; absorbed-fuelled conversion
   stays small (cap 1–2); and Honeypot pieces carry some plain Credit.
   Honeypot classes also carry their partner's credit piece.
3e. **A noisy piece earns a Credit premium above its rarity band, paid
   for by its feed** (session 56, B5; the user's principle). Fuzzer and
   Jackpot carry +1 Credit a turn (Process 1 → 2); their feed is sized so
   the piece, premium and feed together, prices back at its band
   (`scripts/feed-price.ts`). Feed resolves inside the fight, so the duel
   prices it — no run-level measurement needed.
4. *(Retired with Trace in session 58; archived.)*
5. **Skill retention ≥ 0.5.** Cribbage skill must keep deciding fights.
   - **The measure:** a loadout mirror's skill edge (the better player's
     win rate − 0.5) over plain Cribbage's, at the same skills.
     `skill-retention.test.ts` guards the starting loadouts;
     `scripts/skill-check.ts` measures any loadout, **late-run builds
     included**, where retention runs lowest.
   - **What sets it:** skill reaches a fight as turn count (points fill
     the initiative gauge). Per-turn scoring is skill-flat, so which
     source triggers a bonus doesn't change retention. What does is
     **fight length and burst**: big flat output and lumpy payoffs drown
     the turn-count edge.
   - **Reading a low result:** "this build ends fights too fast or too
     swingily". Fix output and burst, not triggers.

Enemies are priced with the same instrument, because the enemy and
player pools share one currency.

## Map & Run Structure

The node-map is meant to actually read as a network diagram — nodes are
machines/systems, edges are the network links you route through — not an
abstract StS-style icon path with theme applied only via names/art.

One run = one target network (a "contract"), breached in four successive
layers: perimeter/DMZ → internal LAN → secured subnet → core. Each layer
plays the role of an StS "act", with a gatekeeper before the next layer
opens; escalating difficulty reads as escalating security. Different runs
can be reskinned as different named contract targets, a natural hook for
meta-progression.

**One layer at a time.** The map shows only the current layer
(`docs/playable-design.md` M1–M9; `map-gen.ts`). Layers are **10 / 12 /
12 / 14** nodes, laid out as a scattered network on a hex backdrop (no
two nodes on neighbouring hexes), linked only to near neighbours with no
crossings, the gatekeeper 3–6 moves from the entry and never behind
anything. Node types are **dealt** per layer from a set mix under
placement rules: no elite next to the entry, a Safehouse within two moves
of the gatekeeper, no matching specials adjacent, no dead-end relays.

**Movement is free-roam within a layer, one-way between layers** —
explicitly FTL-flavored. Within a layer the player can traverse any
connected edge, in any direction, any number of times, including back
into resolved territory. **Every move costs a flat amount of Heat**,
regardless of direction or destination, so gathering more before pushing
on is always available but never free. Crossing a gatekeeper is one-way:
the previous layer becomes unreachable.

This tension is a deliberate design goal: the intended path threads a
middle ground between beelining for each gatekeeper and fully exploring
every node, managing Heat along the way. Exploring means facing the
gatekeeper with more power but less Heat headroom; beelining banks Heat
at the cost of a thinner kit. Measured sweeps found both pure extremes
worse than the middle.

**Node types:**

- **Regular fight** and **elite fight** — see Enemy Design and Rewards.
- **Gatekeeper** — the layer's one exit, its identity fixed when the
  layer is generated.
- **Safehouse** — one either/or choice, StS-campfire-style: **Rest**
  (lower Heat) or **Merge** (spend banked copies to rank pieces up; a
  git/version-control pun). The Rest-vs-Merge trade-off is the point.
- **Shop** — spend Data (see Subroutine acquisition).
- **Event** — a narrative vignette with choices (see Events).
- **Cache** — sometimes hangs as a remote dead end holding a free reward;
  its price is the Heat of the detour.
- **Relay** — pure topology, no encounter, always passable; "just moving"
  as a zero-risk-but-not-zero-cost choice.

A node becomes **inert** after its first resolved encounter, whatever its
type. That is what preserves the Rest-vs-Merge trade-off on a map that
allows backtracking: the node is spent, not unreachable. Inert nodes stay
passable.

**Losing a fight has a spatial consequence.** Losing a regular or elite
fight means the duel resolved to Containment: that route into the node is
gone. The player is ejected and the node is **closed** for the rest of
the run — genuinely **impassable terrain**, not merely reward-free (or
the player could always loop back through it). Map generation keeps the
gatekeeper reachable as nodes close, checked by generate-then-verify. A
Skeleton Key Burner can reopen a closed node, which returns it to
unresolved (it must be won again): recoverable, not automatic.

**Losing a gatekeeper fight, in any layer, ends the run** — **Quarantine**,
the player's whole presence purged from the network. A gatekeeper is the
sole passage forward, so treating its loss as instant permadeath is just
being direct about a run that is already lost.

### How a run ends

Five outcomes (`run.ts` `RunOutcome`):

1. **Victory** — the layer 4 gatekeeper is beaten.
2. **Heat maxed** (`heatMaxed`) — reaching a layer's allowance; the slow,
   cumulative-pressure failure.
3. **Quarantined** — a gatekeeper fight lost, any layer.
4. **No route remains** (`noRouteRemains`) — closures leave no path
   forward; a soft lock distinct from both of the above.
5. **Breached, then caught** (`breachedThenCaught`) — the gatekeeper is
   beaten but its toll (charged after the fight) maxes Heat, and the
   **trace evasion** that follows is lost (`docs/trace-evasion-design.md`,
   `evasion.ts`). The evasion is three hands of plain Cribbage against
   the gatekeeper, which starts a point ahead per 10% of its final
   Containment; you deal the 1st and 3rd hands; finish strictly ahead to
   escape (ties go to the network). Escaping resets Heat and the run goes
   on, or is won on layer 4. A loss still counts the layer as breached:
   meta-progression is meant to credit it ("rep for how deep you got"),
   below a full continue (R8).

## Meta-Progression

**In-run progression is built**: subroutine acquisition and Merge, Mods,
Burners, Events, Shops and Caches (below). **Progression between runs is
not designed yet**, and is a priority. What it is expected to cover:

- New subroutines unlocking into the available pool over time.
- Class unlock order (all six are selectable today).
- The installed-loadout slot cap growing via a persistent unlock.
- New contract types.
- Ascension-style unlockable harder difficulties. Undesigned; its first
  concrete modifier is banked as run-economy D6 (higher ascension resets
  less Heat between layers).
- Crediting **breached, then caught** below a full continue (R8).

Daily Runs are a banked idea (`BACKLOG.md`).

### Subroutine acquisition

**Channels**: combat rewards (a choice after a win), Caches, Shops, and
Events.

**Rewards** (`encounters.ts`, `rewards.ts`):

- **Regular win**: a choice of 3 subroutines, Data, and a 20% chance of a
  Burner choice.
- **Elite win**: **one** choice between uncommon-or-better subroutines
  and Mods, more Data, and a 50% chance of a Burner choice.
- **Gatekeeper win**: a subroutine choice, a Mod choice, and always a
  Burner choice. The last layer's gatekeeper ends the run, so it offers
  none.
- **Cache**: an uncommon-or-rare subroutine choice, a Data and Burner
  bundle, or rarely a Mod; always a Burner.

**Reward pool scoping**: a class draws primarily from its 2 specialized
archetypes, with occasional off-class picks from the other two
(`OFF_CLASS_WEIGHT`).

**Loadout structure**: a slot cap on the *installed* loadout (what's
actually active each fight) separate from a **bench** the player curates
from between fights. Subroutines are always evaluated, not drawn, so an
uncapped loadout would bloat; the cap is 6 (`INSTALLED_SLOT_CAP`,
echoing Cribbage's dealt hand), and six ordered slots is the build puzzle
itself. The bench holds 3 (`BENCH_CAP`).

**Duplicate subroutines**: a copy of a piece you already own does not
take a slot; it becomes a **banked copy**, spent at a Safehouse's
**Merge** to rank the piece up. Merge spends every banked copy at once,
up to `MERGE_RANK_CAP` (3). A rank strengthens the piece's Hook, never
its Process's verb or its Hook's source, since those are its identity
(`merge.ts`).

**Shops** (`shop.ts`) carry three independent slates spending one Data
pool: subroutines (any rarity, priced steeply by rarity), a 3-item Mod
slate, and Burners (always at least one), each separately rerollable.
Shops also **buy** benched subroutines, banked copies and Burners, at
half their buying price by rarity plus a premium per Merge rank.

### Mods

crib.exe's answer to StS relics: permanent, always-on effects
(`mods.ts`, `mod-types.ts`). 37 exist: 6 class Mods and 31 general
(common, uncommon, rare). Static Shield is set aside (defined but never
offered).

**Ownership**: uncapped, no install/bench split, no ordering. Every owned
Mod is simply always active; there is no "which Mods are on" tension to
protect, so a Mod's cost lives entirely in acquiring it. A Mod can be
owned only once; an owned Mod drops out of the pool.

**Two engine mechanisms, split by effect shape:**

- **Hook Mods** fire at named hook points in combat (on a fire, at fight
  start, on incoming progress) or the run (on a move, on an encounter
  resolved, on a Shop slate, on acquiring a piece or a Mod), each folding
  a value through and returning it. They cover archetype amplifiers,
  Hook boosts, Heat and Data economy, and Shop discounts.
- **Subroutine Mods** carry a real subroutine: either a *reactive* one
  that fires outside the loadout (Rootkit Persistence, Boot Sector,
  Session Hijack Relay), or a *granted* one inserted into the loadout,
  cap-exempt and locked against removal (Auxiliary Process, Backdoor
  Access).

**Pool scoping**: universal by default. A Mod that leans on one archetype
is excluded for classes without it, so no class is offered a dead pick.

**Class Mods** are described under Classes. **Enemy Mods**
(`gatekeeper-mods.ts`, a light registry: each hook site looks a Mod up by
id) are a separate set that bend rules: each
gatekeeper carries one bespoke Mod, each elite a smaller one, and
regulars carry none. No enemy carries a class Mod.

### Burners

crib.exe's answer to StS Potions: single-use, **player-activated** items
(`burners.ts`), the one thing the otherwise automatic (subroutines) or
passive (Mods) systems lack. Named for a burner phone: used once and
discarded to avoid being traced.

**Three contexts, one pool**: each Burner is tagged with where it can be
used.

- **Combat** — a single verb effect, on the player's own turn (Flash
  Drive, EMP Charge).
- **Map** — a reveal, a free move, or reopening a closed node (Recon
  Ping, Ghost Protocol, Skeleton Key).
- **Shop** — a coupon: a discount, a free reroll, or a rarity floor
  (Stolen Coupon, Loyalty Token, Insider Tip).

Cold Wallet is sell-only. 9 Burners in all.

**Inventory**: a hard cap (`BURNER_CAP`, 3), no bench or
owned-but-not-carried state — a real "which am I carrying" choice.
A Burner found at the cap can be swapped in.

**Pool scoping and acquisition**: archetype-agnostic by default; offered
after fights (by tier, see Rewards), always in Caches and Shops, and
through Events. Session 63 thinned the fight rate because players
collected far more than they used.

### Events

A narrative vignette with 2–4 choices, resolved instantly with no
Cribbage played (`events.ts`, `event-types.ts`). 8 exist.

**Risk model**: each *choice* carries a tier: **transparent** (exact
cost and reward stated), **visibleOdds** (odds and range shown) or
**gamble** (outcome unstated). One Event can mix tiers across its
options. Gamble is the one deliberate, contained exception to the
design's full-transparency rule, confined to Events and never touching
combat's or Heat's own legibility.

**Risk tier gates reward ceiling**: only gamble-tier choices can reach
the pool's most powerful outcomes (a rare grant, a large Data windfall,
reopening a closed node).

**Effect pool**: reuses existing resources and mechanisms wholesale —
Heat (a multiple of the layer's elite-loss charge), Data, a subroutine,
Mod or Burner grant (named or drawn by rarity), or a bonus fight. No new
resource.

**Node state**: inert after one resolved encounter, same as every other
stub node type, whatever a bonus fight's result. No entry tax beyond the
move.

### Gameplay Simulation Heuristics

The engine runs headless runs for balance (`scripts/sweep.ts`,
`scripts/layer-funnel.ts`). The simulated player is a named profile
(`src/engine/profiles.ts`) bundling "synergy-aware" strategies for every
decision a run asks: acquisition by a lexicographic priority ladder
(credit gap, then archetype match, then rarity) rather than tuned
weights, swap-out when the loadout is full, reordering for chains, Merge
targets, Shop buys and rerolls, Event choices capped by risk tier and a
Heat safety margin, and Burner activation per effect kind. Traversal and
Safehouse choice are a separate, combinable profile
(`opportunisticTraversal`). Every engine default stays a deliberately
"legal-not-good" fallback. The session 45 design is archived.

### Balance target

**15–20% victory per class**, aiming at about 16% (the average stood at
19.8% at session 62, `BACKLOG.md`), adopted from Slay the Spire's
ascension-0 rate. The gatekeeper pass-rate curve is **73.5 / 67 / 61 /
55%** by layer, monotonically harder. Skill retention stays ≥ 0.5
(Pricing rule 5).

## Enemy Design

**Tone: every enemy is the target network's own defenses**, even the
offense-flavoured kits (its security team or automated countermeasures
hacking back), never a separate criminal group. External-actor flavour
for a specific contract remains future idea space.

Enemies are a real roster with identity, structurally close to player
classes: each is authored data, an archetype set (a pair by default, one
or three when the identity calls for it), a loadout of real subroutines,
and for elites and gatekeepers a Mod. They use the same four archetypes,
seven verbs and source × shape criteria as the player, plus the
enemy-only Trace, Wipe and Strip, and can carry noisy pieces (their feed
hands you Breach). Decisions E1–E7 are in `docs/archive/authoring-design.md`.

**Authoring investment scales down by tier**, deliberately: regular and
elite fights recur many times across a run; gatekeepers are the
memorable set pieces.

- **Regular**: 2–3 pieces, built from the player's own pool or a few
  enemy-only ones, no Mod. Eligible from a minimum layer onward.
- **Elite**: 3 pieces and a smaller rule-bending Mod; meant to be a
  genuine challenge. Eligible from a minimum layer onward.
- **Gatekeeper**: fully bespoke, two per layer, each with at least one
  bespoke, thematic piece and one bespoke Mod, and meant to be very
  challenging for the layer it's presented at.

Regular and elite magnitude follows the player's measured power by layer
(`ENEMY_LAYER_SCALER`; whole-count effects such as Charge round). Honeypot
enemies start at layer 2. The three alarm "tracers" (Tripwire, Intrusion
Alarm, Total Compromise) add Heat directly instead of mainly trying to
contain you.

**Selection** differs by tier. **Gatekeepers are fixed when the layer is
generated**, one of that layer's two, stable for the run. **Regulars and elites are drawn at encounter time** from the
eligible pool, since re-rolled variety across a run is desirable.

**Opening fights**: the first 1-3 combats of the run, full stop
(`OPENER_FIGHT_WINDOW`, 3) — a run-order counter, not a layer- or
node-position rule, since layer 1 is free-roam. They face a layer-1
regular whatever the node's tier, at the skill floor, so new players get
an easy on-ramp wherever they go first. Gatekeepers are never affected.

**Skill dial** (`enemySkill`): tier is the primary axis, layer is a
secondary modifier. Regular 0.15, elite 0.5, gatekeeper 0.75, each
climbing a small step per layer; opening fights pin it to 0.

**The lesson that sets roster tuning: within-layer gatekeeper spread is
the bigger lever.** Session 49 found that which gatekeeper you drew
mattered more than which layer you were on (up to 57 points apart in one
layer, against 44 across the whole curve), and that roughly two thirds of
apparent class imbalance was gatekeeper matchup. Payload magnitude is not
what makes a fight hard. Each layer's two gatekeepers are tuned to its
pass-rate target, close to each other.

### The Roster

27 enemies (`src/engine/content/enemies.ts`), by tier and the first layer
each appears at, plus a tutorial-only gatekeeper.

| Layer | Regular | Elite (Mod) | Gatekeeper (Mod) |
|---|---|---|---|
| 1 | Pentest Script, Quarantine Daemon, Relay Node, Patch Runner, Session Monitor | Threat Intel Feed (Reverse Engineering), Incident Response (Rollback) | The Concierge (Reception Protocol), Firewall Prime (No Way In) |
| 2 | Legacy Firewall, Tripwire, Wireless IDS, Log Shipper | Blackout Cell (Power Siphon), Intrusion Alarm (Escalation) | Quarantine Ward (Containment), Zero-Sum (Zero-Sum) |
| 3 | Honeyfarm, EDR Sensor | Threat Hunter (Evidence Chain) | Adaptive Threat (Adaptation), Total Compromise (Spotlight) |
| 4 | Integrity Monitor, Firewall Cluster | Hypervisor (Resource Quota) | Null Session (Null Session), Root Authority (Root Access) |

13 regulars, 6 elites, 8 gatekeepers. **Firewall Beta**
(`TUTORIAL_GATEKEEPER`, `enemies.ts`) is Firewall Prime at reduced
strength carrying Rate Limit, used only by the tutorial.

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
controlled players), with zero dependency on the UI layer. The UI is
purely a thin interface onto the engine: it renders engine state and
translates player input into engine calls, and never contains logic the
engine doesn't already enforce itself.

Why: it makes the whole game testable by script rather than only by
clicking through a browser — the only practical way to test something
with this much randomness and this many interacting systems; the enemy
AI needs it regardless; and it makes AI-vs-AI simulation for balance a
free by-product.

**Structure**: a single Vite app. The engine is plain TypeScript in
`src/engine/` (content in `src/engine/content/`), tested in plain Node
with no browser context; the UI is Svelte 5 in `src/ui/`. One standalone
game with no downstream consumer needs no workspace split: the folder
convention plus browser-free engine tests enforce the separation.

**The engine pauses at every decision.** A run, a fight, an evasion and a
plain Cribbage game are generators that yield a request at each decision (a discard,
a pegging play, a reward pick, a move) and resume with the answer
(`run-requests.ts`). Every request carries a fallback, so the same code
runs headless (the AI or a scripted strategy answers) or in the browser
(the player answers). A save is the seed plus the list of answers,
replayed.

**Tunable-skill Cribbage AI** (`ai.ts`): `discardSkillStrategy(skill)`
and `pegSkillStrategy(skill)` are weighted evaluation functions (hand EV,
crib EV, immediate pegging score, defensive risk, setup value) blended by
one 0–1 skill knob between fixed novice and expert weights, rather than
random mistakes, so a skill level reads as a coherent personality. It
plays every enemy, the coach and the simulated player.

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
the session 13 table is archived in `docs/archive/design-history.md`):

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

See `BACKLOG.md` for the working list.

- **Meta-progression between runs** — undesigned, and a priority: unlocks,
  class unlock order, slot-cap growth, and crediting "breached, then
  caught" below a full continue (R8).
- **Ascension-style difficulty** — undesigned; D6 (less Heat reset
  between layers) is its first banked modifier.
- **Daily Runs** — a banked idea.
- **The player-side content pass** — growing and retuning the player
  pool, and bringing the average win rate from 19.8% toward ~16%.
- **Tuning numbers** — Heat allowances, fight baselines, the performance
  weight, the loss multiplier and economy prices are first-pass
  placeholders (`heat.ts`, `shop.ts`, `encounters.ts`).
