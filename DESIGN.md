# crib.exe — Design

A browser-based, hacking-themed roguelite in the Slay the Spire mold —
node-map run structure, permadeath, meta-progression between runs — where
combat is resolved by playing real Cribbage instead of the usual
attack/skill/power card battles.

Status: pre-implementation. This doc is the source of truth for design
decisions, settled in session 1 (`/decision-session`, 2026-08-23). See
`BACKLOG.md` for the implementation roadmap and `docs/session-logs/` for
the session-by-session history.

## Concept

You play a hacker taking on "contracts" — each run targets one network,
breached layer by layer, with combat encounters against the network's
defenses (and eventually a rival hacker/AI) resolved as head-to-head
Cribbage matches. Deckbuilding isn't about which card to play on your
turn — it's about which automatic subroutines you've installed, in what
order, and how well you can actually play Cribbage to trigger them.

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
Each subroutine has its own independent enable-condition that
accumulates across the whole match, separate from the initiative gauge —
e.g. "fires every N points scored" (a cooldown) or "fires after scoring
with a given suit X times" (a tally). When a side's turn happens
(initiative threshold crossed), *every* subroutine on that side whose
condition is currently met fires — not just one.

Loadout order matters: when multiple subroutines fire on the same turn,
they resolve top-to-bottom like a script. Subroutines can chain — one can
buff the next subroutine after it in the sequence, or contribute progress
toward a later subroutine's own enable condition. Order is adjustable as
a run progresses. **Open question**: whether reordering is ever available
mid-combat (added tactical friction) or strictly between fights — left
deliberately open, see Open Questions below.

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
- Multiple playable classes, each specializing in 2 of 4 subroutine
  archetypes, each with its own distinct starting loadout. (The 4
  archetypes themselves aren't designed yet.)
- Ascension-style unlockable harder difficulties.
- An expanding pool of in-run passive items (StS-relic equivalent)
  findable during runs.

## Tech Stack

Svelte + Vite, rendering everything (cards, loadout, the network map) as
SVG/DOM — no canvas game engine (Phaser/PixiJS). This is a UI/turn-driven
game, not real-time action, so an engine would be overhead without
payoff. Svelte was chosen for toolchain/pattern familiarity from
glyphrogue/glyphkeep — not for any code reuse; glyphrogue's engine itself
is built for ASCII dungeon-crawling and doesn't fit this genre.

## Theming

Card suits will be re-themed to match the hacking setting — still 4
suits mechanically (Cribbage's flush/suit-tally rules need exactly 4),
just reflavored names/icons rather than classic hearts/clubs/diamonds/
spades. Not yet named. This connects to the "score with a suit X times"
subroutine enable-condition, so suit identity may end up tied to
subroutine archetype identity too.

## Name

**crib.exe** (stylized) — domain `cribexe.com`, confirmed available.

## Open Questions

Deferred to future design/decision sessions, not resolved yet:

- Whether loadout reordering is ever available mid-combat, or only
  between fights (deliberately left open — see Combat System above).
- How new subroutines are acquired during a run (combat rewards? a shop?
  both, StS-style?), and whether there's a loadout size/slot limit.
- The 4 subroutine archetypes, and how each class's 2-archetype
  specialization and starting loadout works.
- What subroutine effects actually do (the damage/buff/debuff design
  space), and the fuller catalog of enable-condition types beyond the
  two named so far (point-count cooldown, suit-count tally).
- Concrete suit re-theming (names/icons for the 4 suits).
