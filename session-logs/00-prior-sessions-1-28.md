# Sessions 1–28 — retrospective

This project's `session-logs/` convention started at session 29
(2026-08-27). Sessions 1–28 predate it, so there's no per-session log for
them — but `BACKLOG.md` has recorded a detailed, dated-by-session-number
narrative throughout (design decisions, implementation checkpoints, and
every balance sweep's actual numbers) since session 1. This document
condenses that existing record into one continuous history, purely as a
backfill so the new convention has a starting point — it doesn't invent
anything not already in `BACKLOG.md`/`DESIGN.md`/git history, and no
calendar dates are given for sessions 1–28 because none were ever
recorded (only relative session numbers). For full detail on any item
below, `BACKLOG.md` is still the source of truth — search it by session
number.

## Phase 0 — Design (sessions 1–13)

`BACKLOG.md` itself was "written at the end of session 1." From session 2
onward, each of `DESIGN.md`'s Open Questions got its own dedicated
design pass, in order: the 4 subroutine archetypes — Exploit, Malware,
Encryption, Root (session 2); the full effect/trigger catalog — 2
resources (Heat, Breach/Containment), 6 trigger families (session 3);
mid-combat vs. between-fights loadout reordering, settled as
between-fights-only with mid-combat toggling (session 3); archetype-to-
trigger-family affinities (session 4); the 8 concrete occurrence-trigger
categories with 3 firing variations each (session 5); suit re-theming —
suits named after archetypes with icon/color pairings (session 6);
subroutine acquisition flow — combat rewards + shop ("Data") + events
(session 7); class specialization — the 6 classes (Breacher, Blackhat,
Saboteur, Operator, Warden, Ghost) and their archetype pairings (session
8); how a lost Breach/Containment duel translates into Heat, plus
gatekeeper/boss losses ending a run outright via Quarantine (session 9);
the 5 subroutine tags — Trap, Backdoor, Firewall, Worm, Daemon (session
10); each class's mild starting passive (session 11); each class's full
starting loadout — the first 18 named subroutines, revised mid-session
from 4-per-loadout down to 3 after user pushback that it left too few
open slots (session 12); and the middle-four class unlock order (session
13).

## Phase 1 — Core Cribbage engine (complete, session 16)

A fully rules-correct, headless 2-player Cribbage engine in
`src/engine/`: deal/discard/cut/pegging/scoring/alternating-dealer game
loop, a seeded RNG, and two legal-move scripted players for deterministic
testing. 49 tests passing, all 8 scoring categories plus edge cases
(consecutive "go," exact-31 vs. under-31) covered. Deliberately no
target-score/winner concept — that's Breach/Containment's job.

## Phase 2 — Combat wrapper (infrastructure complete, content-partial, session 18)

Scoped session 17, built across 6 checkpoints: pegging event
categorization, the full generic trigger/payload type system, trigger
evaluation + runtime state, initiative gauges + Breach/Containment, fire-
on-turn resolution, and a `combat.ts` orchestrator. 101 tests passing.
Deliberately used only a small representative subroutine set, not the
real 18 — wiring the real starting loadouts was left as later content
work (later folded into Phase 4). Renamed Control/Breach to
**Breach/Containment** and introduced **Quarantine** for gatekeeper/boss
losses.

## Phase 3 — Network-map / run structure (complete, session 20)

Scoped session 19: free-roam intra-layer movement, one-way between
layers (a deliberate FTL-flavored deviation from Slay the Spire). Built
across 6 checkpoints (session 20): graph data model, a resilience-
verified layer generator, Heat (duel-loss + per-move cost), traversal,
node encounter resolution (Safehouse's Rest real; Merge/Shop/Event
stubs), and a run orchestrator. 154 tests passing. Mid-session the user
restored a 3rd fight tier, **eliteFight**, that session 19's node list
had dropped. A 500-seed sweep under default settings found only 3.8%
victory — expected, since the player's loadout was still static with no
acquisition system yet.

## Phase 4 — Meta-progression: classes + acquisition (complete, session 22)

Scoped session 21. Authored all 18 real starting-loadout subroutines as
data, wired the 6 bespoke starting passives, added Data rewards + a
subroutine-choice reward, bench/installed loadout management, Merge
(duplicate acquisitions → material), and real Shop wiring. A control
sweep proved acquisition alone wasn't why a 500-seed sweep suddenly
showed 100% victory (up from 3.8%) — the real cause was checkpoint A's
enemy-magnitude retune, done to make the test suite resolve in reasonable
time, not a real balance pass. This mismatch became the seed for the
Breach/Containment redesign below.

## The Breach/Containment redesign (session 22, continued)

Replaced the single shared zero-sum Breach/Containment scalar with two
independent per-side gauges, each filled only by its own offense, plus
escalation (shrinking win-gauge thresholds after 100 hands). Collapsed
the full suite's runtime from several minutes to under a second. A
retuned enemy-magnitude sweep against Breacher's kit found a wide,
smoothly monotonic competitive zone (100%→0% across amount 6–13),
landing on regular=9/elite=10/gatekeeper=11 for a genuinely competitive
28.2% victory rate (61.4% quarantined, 10.4% no-route) — a sharp contrast
to the old model's narrow, chaotic band.

## Session 23 — all-6-class sweep: the archetype-pairing split

Re-ran the same sweep per class against the checkpoint-E enemy tuning
(only ever calibrated against Breacher). Found a stark, structural split:
Warden (88.4%), Blackhat (51.2%), and Breacher (28.2%) — each pairing two
gauge-touching archetypes — cleared at least one layer routinely, while
Saboteur (1.0%), Operator (0.0%), and Ghost (0.0%) — each pairing a
single offense archetype with Root, which never touches either gauge by
design — were barely functional. Flagged as needing per-class tuning,
not a seed artifact.

## Session 24 — Root's mechanical redesign + tunable-skill AI

Before assuming Root needed a magnitude buff, discovered a deeper
problem: **Root's payloads had zero decision-making surface at all**
(every target/action fixed at authoring time), and `peekCrib` was a
genuinely broken no-op. Redesigned Root in 8 checkpoints: a shared
weighted-scoring `ai.ts` module; `combat.ts` decomposed into real
per-hand lifecycle steps with a new `firesAt` hook; three recon payloads;
a real adversarial `forceDiscardCard`; haste (completing the slow/haste
pair); and 6 pool pieces retrofitted onto the new mechanics. Then built a
real tunable-skill Cribbage AI (pegging + discard, skill-interpolated
weights) and re-swept: even "novice" AI crushed the old dumb baseline
(Warden 88.4%→46.4%, Breacher 28.2%→0.2%), while Saboteur/Operator/Ghost
sat at exactly 0.0% at *every* tested skill level on *either* side —
confirming Root's weakness was structural, not a fairness artifact.

## Session 25 — Root-class passive rework

Found two of the three Root-paired passives (Sleeper Cell, Return to
Sender) had trigger conditions unreachable from their own class's actual
starting kit. Reworked all three (Sleeper Cell, Primed, Return to Sender)
to be persistent, reachable from turn one, and to credit the win gauge
with real force. Re-swept: Saboteur 0.0%→~30%/~74–78% (baseline/expert
player), Ghost 0.0%→~28–33%/~55–61%, Operator 0.0%→~4.7%/~25–27% (the
smallest gain, flagged for a closer look).

## Session 26 — AI range expansion + Ghost redesign

A race-to-121 cross-matrix (Cribbage alone, no combat layer) found skill
0 vs. skill 1 was a 49.8% coin flip — the AI's *dominant* scoring term
(exact hand-EV/immediate-score) ran at full strength even at skill 0,
so the skill dial only ever adjusted secondary refinements. Fixed via
Boltzmann/softmax mistake-injection sampling, interpolated by
temperature: skill 1 vs. skill 0 became 98.6% (real, wide separation). A
follow-up 4×4 class-balance sweep against the expanded dial showed real
skill sensitivity everywhere except Ghost, whose core mechanism only arms
once the *enemy's* gauge is already high — a trigger gated on enemy
behavior, not player skill. User's call: keep Return to Sender as-is,
redesign Ghost's starting kit instead (Steganography, Tripwire replacing
Null Session/Kill Switch) — win rate roughly tripled (16–28%→41–58%).

## Session 27 — Enemy Library design

A `/decision-session` replacing the flat single-`directBurst`-per-tier
enemy dummy with a real, authored roster structurally close to player
classes. Checkpoints A–C (type system, passive registry, selection +
skill-dial wiring) and checkpoint D (drafting the full 32-enemy roster —
12 Regular, 8 Elite, 12 Gatekeeper across 4 layers, in `DESIGN.md`'s new
"Enemy Design" section) were implemented/designed this session.

## Session 28 — Neutral Archetype, checkpoint E, and the first real roster sweep

Mid-implementation of checkpoint E, revised the hard-resolution tiebreak
(`resolveHardTiebreak`) to unconditionally favor the defender, which
surfaced a much bigger finding: **only Exploit's direct-damage payloads
and Malware's DoT can ever credit a side's own win-gauge** — a kit built
entirely from Encryption/Root (true for Ghost and 9 of the 32 roster
enemies) literally cannot win outright. Resolved by designing a genuine
5th **Neutral Archetype** (9 pieces, suit-independent, capped by the
mitigation-to-credit **Circuit Breaker**), retrofitting all 9
credit-incapable enemies, and fixing a real infinite-loop hang
(`Choked`'s threshold reversal had no floor) found by the sweep itself. A
reusable sweep harness (`scripts/sweep.ts`, `npm run sweep`) was built
mid-session once the hang made buffered scratch-sweeps look actively
dangerous. The resulting real balance sweep (200 seeds/class): ~28.7%
average victory across classes, with **Breacher a sharp outlier at
10.0%** — the finding session 29 (this project's first logged session)
picked up directly.

---

*Session 29 onward has its own dated log entries in this directory.*
