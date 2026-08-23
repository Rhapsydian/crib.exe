# crib.exe — Design

A browser-based, hacking-themed roguelite in the Slay the Spire mold —
node-map run structure, permadeath, meta-progression between runs — where
combat is resolved by playing real Cribbage instead of the usual
attack/skill/power card battles.

Status: pre-implementation. This doc is the source of truth for design
decisions, settled across sessions 1-6 (`/decision-session`, 2026-08-23).
See `BACKLOG.md` for the implementation roadmap and `docs/session-logs/`
for the session-by-session history.

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
  explaining the "too much heat" idiom the name leans on. Exactly how a
  lost Control/Breach duel (below) translates into Heat gained is still
  open — see Open Questions.
- **Control/Breach** — an in-combat-only shared push/pull meter, a single
  bar rather than two separate HP pools, that resolves the outcome of one
  Cribbage duel. Exploit/Malware effects push it toward the opponent's
  losing end; Encryption effects push it back toward center/your favor
  (mitigation is an active counter-push, not a StS-style absorbing block
  stat). Resets each combat.

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
Catalog) resolves against Control/Breach or against the opposing side's
state.

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

## Meta-Progression

Broad strokes, not yet detailed:

- New subroutines unlock into the available pool over time.
- Multiple playable classes, each specializing in 2 of the 4 subroutine
  archetypes below, each with its own distinct starting loadout. Which
  pairings become classes, and what their starting loadouts look like,
  isn't designed yet — the payload/trigger catalogs below are the
  prerequisite groundwork for that (see Open Questions).
- Ascension-style unlockable harder difficulties.
- An expanding pool of in-run passive items (StS-relic equivalent)
  findable during runs. **Banked idea**: subroutine tags (e.g. Hack,
  Firewall, Trap), orthogonal to archetype, that passives could hook into
  to enhance tagged subroutines — noted but not designed yet, see
  `BACKLOG.md` Phase 0.

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

### Subroutine payload catalog

What a subroutine actually does when it fires. Each archetype has
multiple sub-types rather than one move apiece:

- **Exploit** (4): baseline **instant burst** (push Control/Breach toward
  the enemy's losing end); **piercing burst** (ignores Encryption's ward/
  counter-push entirely — true damage, unaffected by mitigation; Exploit's
  counter to defense-heavy builds); **chain-finisher scaling** (burst
  scales with how many other subroutines already fired earlier in the
  same turn — a direct payoff for loadout sequencing, not a generic
  "execute" mechanic); **risk/reward burst** (bigger push, but using the
  subroutine costs the player Heat directly — a second Heat-accumulation
  path alongside losing duels).
- **Malware** (2): **DoT** (gradual Control/Breach push toward the
  enemy's losing end over time — see tick cadence below) and **debuffs**
  (status effects that weaken the target's own functionality going
  forward, e.g. reduced subroutine effectiveness or slowed gauge fill —
  a status-effect stack applied *to a side*, distinct from Root's direct
  rewrites of values/flow).
- **Encryption** (4): **instant counter-push** (Control/Breach back
  toward center/your favor); **ward** (reactive negation — blocks a
  specific incoming effect the moment it would fire); **HoT** (gradual
  Control/Breach push-back over time, mechanically symmetric to
  Malware's DoT, same tick-cadence framework); **cleanse** (removes an
  existing debuff afflicting you).
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
  their Control/Breach position, their initiative gauge fill %, or
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

## Tech Stack

Svelte + Vite, rendering everything (cards, loadout, the network map) as
SVG/DOM — no canvas game engine (Phaser/PixiJS). This is a UI/turn-driven
game, not real-time action, so an engine would be overhead without
payoff. Svelte was chosen for toolchain/pattern familiarity from
glyphrogue/glyphkeep — not for any code reuse; glyphrogue's engine itself
is built for ASCII dungeon-crawling and doesn't fit this genre.

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

Deferred to future design/decision sessions, not resolved yet:

- Exactly how a lost Control/Breach duel translates into Heat gained
  (fixed amount? scaled to margin of loss? per-encounter modifiers?) —
  raised and deliberately banked in session 3, to keep that session on
  track.
- How new subroutines are acquired during a run (combat rewards? a shop?
  both, StS-style?), and whether there's a loadout size/slot limit.
- How each class's 2-archetype specialization and starting loadout works
  (the payload/trigger catalogs now exist as groundwork — see
  Meta-Progression).
