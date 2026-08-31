# crib.exe

A browser-based, hacking-themed roguelite (Slay the Spire-style run
structure) where combat is resolved by playing real Cribbage.

**Status**: engine in progress, no UI yet. Phases 1-4 (a rules-correct
headless 2-player Cribbage engine; the combat wrapper — subroutine
triggers/payloads, initiative gauges, Breach/Containment resolution; the
network-map/run-structure layer — free-roam movement, Heat, real duels
wired into fight nodes; and meta-progression — 6 classes, subroutine
acquisition, Merge/Shop) are implementation-complete, content-real (all 18
class starting loadouts + a real 32-enemy roster across 4 layers, every
tier now eligible from layer 1 onward), and verified by an automated test
suite, `src/engine/`. Phase 5 (content, balance, and polish) is in
progress — the Enemy Library and Neutral Archetype are built; **Mods**
(crib.exe's StS-relic equivalent) shipped: 23 real Mods (the 6 class
starting passives, migrated onto the same infrastructure, plus 17 new
ones), all 12 hook points wired into combat/loadout/acquisition/Shop; and
**Burners + Events** shipped: 8 single-use, player-activated Burners
(combat/map/shop contexts, including reopening a previously closed map
node) and 8 narrative Event vignettes (risk-tiered choices, optional
bonus fights), fully wired into combat, traversal, the Shop, and reward
acquisition. `DESIGN.md` now states an explicit design goal for how a run
should play: the ideal path is a middle ground between beelining a
layer's gatekeeper and fully exploring it while managing Heat, with
either extreme being a deliberate risk/reward tradeoff rather than
something to balance away (see Map & Run Structure) — a third scripted
traversal strategy, **`opportunisticTraversal`**, now actually embodies
that middle ground (fights first, then Heat/material/Data-driven pulls
toward Safehouse/Shop/Event, gated by a Heat safety reserve), alongside
the existing beeline/explore extremes. **The per-class balance pass
compared full-run outcomes against a real external target**: Slay the
Spire's own ascension-0 full-run win rate (9-15% for a new player) was
adopted as the benchmark. Getting there took several real engine
changes, not just number tweaks — a per-layer enemy magnitude scaler
(regular/elite via a shared formula, gatekeepers via an
individually-tunable stored value, fixing a genuine gap where layer 1
gatekeepers were measurably *harder* than layer 4's, backwards from the
intended ramp); `scripts/gatekeeper-check.ts`, a permanent diagnostic
that measures gatekeeper difficulty against a player's *real*
accumulated run state (not a bare starting kit); and four individual
class passive reworks (Warden's Feedback Loop redesigned as a
reciprocal HoT/DoT amplification rather than a flat bonus; Saboteur's
Sleeper Cell, Operator's Primed, and Ghost's Return to Sender/Idle
Process all retuned after isolating exactly which mechanic was carrying
each class). One real cross-class coupling was found and fixed along
the way: Operator's Primed passive and gatekeeper Zero-Sum's own
`primed-to-strike` had quietly shared the same tuning constants, split
into independent ones. **A later pass corrected the benchmark
methodology itself**: the player side of every full-run sweep had been
running on `playCombat`'s dumb floor baseline (no skill dial at all)
this whole time, while a separate gatekeeper diagnostic used a skilled
player — two different "players" being silently compared to the same
target. Player and enemy skill are now a permanent, structurally
decoupled pair (`run.ts`'s `playerSkill` option, opt-in, never
interlocked with the enemy's own per-fight `enemySkill()` scaling); the
diagnostic scripts default to a calibrated `playerSkill=0.85`, anchored
to the hardest real enemy's own skill ceiling (0.84) via a pure-Cribbage
skill-vs-skill calibration table (`scripts/cribbage-skill-matrix.ts`).
At that corrected baseline, full-run rates sit at 19-33% across the 6
classes — the 9-15% target band was calibrated against the old
floor-skill numbers and hasn't been re-derived for a real skilled
player yet, so it's not currently authoritative. Firewall Prime
(specifically vs. Warden) was redesigned ground-up and meaningfully
improved (0.0% → 11.8%) but isn't fully resolved. **A follow-up
gatekeeper-ablation audit** (`docs/session-39-gatekeeper-balance-audit.md`
— ablating each of the 12 gatekeepers one at a time via `run.ts`'s new
`excludedGatekeeperIds` and comparing the real full-run funnel, not each
gatekeeper's own isolated win rate) overturned the "layer 3's trio is
weak" assumption above: layer 3 is actually the *best-balanced* layer in
the roster (2.33-point spread). Layer 4 has the real, previously
unflagged imbalance instead (10.83-point spread — Null Session too hard,
Kernel Panic the single largest ablation effect measured in either
direction), and Firewall Prime is confirmed to remain an outlier even
after its own redesign. No tuning from these findings has been applied
yet. A full 32-enemy roster audit also
found 7 genuinely dead subroutine pieces (Heat-gated triggers — enemies
never accumulate Heat at all) across 9 enemies, fixed with a real
enemy-only subroutine catalog (`src/engine/enemy-subroutines.ts`); the
roster's remaining reliance on shared player-pool content for the other
~25 enemies is intentionally banked as a future initiative, not
addressed here. Basic Cribbage (standard race-to-121, no roguelite
layer) is now a real, tested, permanent alternate-game-mode engine
(`src/engine/basic-cribbage.ts`) rather than a throwaway diagnostic —
the entire per-class balance pass above still describes the roguelite
mode; Basic Cribbage is a separate, still-unbuilt-in-the-UI mode.

**Independent per-side gauge/win thresholds** shipped next (both a side's
initiative-gauge cadence and win-gauge target are now genuinely
independent per side, not one shared scalar), used immediately to fix two
of the layer-4 audit findings above: Null Session's own passive was
punishing whoever crossed 50% first regardless of real threat (raised its
own `winThreshold`), and Kernel Panic turned out to be structurally dead
content — real fights against it average 2.33 hands, far too short for
its RARE-tier accumulator triggers to ever bank up, fixed with three
bespoke enemy-only replacement pieces using faster trigger shapes instead
(same payload flavor). A separately confirmed engine bug,
`gaugeFillAbove` (an `enemyState` condition reading the cyclical
turn-cadence gauge instead of real win-progress), turned out to be
propping up Incident Response's own difficulty and, more surprisingly,
layer 3's Adaptive Threat too — migrated to the condition that actually
reads win-progress.

**A full Archetype Win-Condition Audit followed** — stepping back from
gatekeeper-by-gatekeeper tuning to ask whether every archetype has both a
real win condition (for a player) and a real containment identity (for
an enemy holding out to the hand-20 hard tiebreak). Confirmed directly
from the payload dispatch code: Encryption and Root had zero payload
kinds able to credit the caster's own gauge at all. A separate,
much larger empirical finding: across 3,151 real gatekeeper fights (all
12 gatekeepers, realistic acquired power), only 2 ever resolved via the
hand-20 attrition backstop — the "hold out to the deadline" containment
identity is close to decorative for nearly every archetype pairing, not
just the two that structurally couldn't reach it. Fixed with six new
native mechanisms — Encryption's `wardCounter`/`drainingHot`/`wardBash`
(generalizing Ghost's own Return to Sender passive into real archetype
content) and Root's `sessionHijack` payload plus two new Root-only
trigger families, `rareOccurrence` (reacts to either side's rare
Cribbage plays, e.g. a pair royal) and `handOutcome` (reacts to a
resolved hand's own crib/hand/pegging total, e.g. "the enemy's crib
scores above average") — both bypassing the normal turn-gated firing
pipeline entirely, evaluated directly against real game events. A real
pegging-AI gap was found and fixed along the way too: Root's own
Directory Traversal piece had populated the opponent's known hand since
session 24, but the pegging AI never actually read it.

**A 12-piece content-validation sample** (2 per new mechanism, split
across Encryption/Root) followed, grounded by a new permanent diagnostic,
`scripts/occurrence-frequency.ts` — real raw-Cribbage occurrence
frequency and score-distribution stats (skill=0.85, no roguelite layer
at all), used to set real rarity thresholds (pair-royal-or-better is a
genuine 8.8% of pair occurrences) instead of guessing. The sample
produced a real, positive confirmation: a solo Encryption-pool loadout,
which could previously only ever win by outlasting an opponent to the
hard-resolution deadline, now genuinely crosses its own win-gauge
threshold in real combat. This is shape/validation only — no full
content pass yet; the user's own stated roadmap is a full audit-and-
roughly-double pass across the player pool, then the enemy pool, Mods,
classes (particularly the five of six that touch Encryption or Root),
and the gatekeeper roster, each its own session, finishing with a heavy
ablation-driven balance pass to pick the best-fitting subset of an
intentionally over-generated gatekeeper pool.

**The Player Pool Expansion is now complete** (scoped session 41,
implemented session 42) — the first phase of the user's own multi-session
audit-and-roughly-double program above. The player-facing subroutine pool
grew 81 → 138 pieces (all subroutines 99 → 156): Exploit and Malware +15
each, Encryption/Root/Neutral +9 each, all four real archetypes converging
on ~30 pieces apiece. A real structural bug was fixed along the way —
`ChainedTrigger` (session 41's own audit found it) widened from a single
specific-subroutine-id reference to a 3-way match (id/archetype/tag), since
id-based chaining left pool content permanently dead for any class that
didn't happen to own that exact starting piece; all 7 pre-existing chains
converted. A 6th tag (`direct`) was added and every previously-untagged
piece retagged, now an enforced invariant. No magnitude/balance tuning was
done — that's the explicit next phase, once the roster's other pools (enemy,
Mods, classes, gatekeepers) get the same audit-and-expand treatment.

See `DESIGN.md` for the full design, `BACKLOG.md` for the phased
implementation roadmap and next-session pointer, and `session-logs/` for a
per-session record of decisions and results.

Domain: `cribexe.com` (registered available, not yet purchased).

## Engine

- `npm test` — run the Vitest suite (617 tests as of session 42).
- `npm run check` — type-check (`svelte-check` + `tsc`).
- `npm run sweep -- run|enemy ...` — balance/regression sweep harness (see
  `scripts/sweep.ts`); used throughout Phase 5 to tune with real numbers
  instead of guessing. `run` mode defaults to `--playerSkill=0.85`.
- `npx tsx scripts/gatekeeper-check.ts` — realistic gatekeeper-difficulty
  diagnostic: real accumulated player state from actual runs, fought
  against the real production skill-dial enemy AI, aggregated by
  gatekeeper and by layer. Note: this is an isolated re-fight (fresh
  seed, chosen skill), not a replay of what the real run's own
  resolution decided — see `scripts/layer-funnel.ts` below for that.
- `npx tsx scripts/layer-funnel.ts` — the real, same-run full-run
  layer-completion funnel (cumulative "made it through layer N"), read
  straight off `playRun()`'s own outcome, not a separate re-fight.
- `npx tsx scripts/cribbage-skill-matrix.ts` — pure-Cribbage skill-vs-
  skill win-rate calibration grid, entirely outside the roguelite layer;
  what a "player skill" default actually means in Cribbage terms.
- `npx tsx scripts/occurrence-frequency.ts` — real raw-Cribbage
  occurrence frequency (by category and magnitude) and hand/crib/pegging
  score distributions, also outside the roguelite layer; calibrates
  content thresholds (rareOccurrence's minMagnitude, handOutcome's value)
  against actual play instead of guessing.
- `npm run dev` — Vite dev server (currently just the default Svelte
  scaffold; no game UI is wired up yet).

Engine/UI separation is a standing project-wide principle (see
`DESIGN.md` Architecture): everything in `src/engine/` is plain
TypeScript, testable headlessly with zero Svelte/browser dependency.
