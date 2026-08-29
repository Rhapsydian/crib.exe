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

**Session 40 update**: independent per-side gauge/win thresholds have now
landed (session 40, `/decision-session` then same-day `/dev-session` --
see the "Independent Per-Side Gauge/Win Thresholds -- Implementation" ✅
complete spec in Phase 5) -- the user's own explicit sequencing call, so
the balance-pass candidates directly below are now ready to act on with
both `magnitudeScaler` (session 39) and a per-gatekeeper threshold
override available as independent levers, rather than just the one.
Nothing about the audit's findings themselves changed, only what tools
are available to address them.

**Real balance candidates from session 39's gatekeeper-ablation audit**
(`docs/session-39-gatekeeper-balance-audit.md`), un-prioritized, no
tuning applied yet -- ask rather than assume, same as every prior fork
in this project:
- **Layer 4 has the roster's widest difficulty spread** (10.83 points):
  Null Session too hard (+5.20 avg delta from baseline), Kernel Panic
  too easy (-5.63, the single largest ablation effect measured in
  either direction).
- **Layer 2**: Incident Response too hard (+4.10), The Quarantine
  Ward/Zero-Sum both comparatively easy (-3.07/-2.40).
- **Layer 1**: Firewall Prime remains a confirmed outlier even after its
  own ground-up redesign this session (+5.22); Ghost Process is the
  layer's easy outlier (-3.71), not a neutral third option.
- **Retire the "layer 3's trio is weak" assumption** (below, and in
  README's own now-corrected status paragraph) -- the audit found it's
  actually the best-balanced layer in the roster (2.33-point spread).
  Don't carry it forward into a future task list.

**Standing rule (session 39): basic-Cribbage engine code is never
scratch.** "Basic Cribbage" (standard race-to-121, no Breach/
Containment, no subroutines/gauges/Heat) is a planned **alternate game
mode**, not just an AI-calibration diagnostic -- the user has now asked
for this to be retained twice (session 26's original race-to-121
cross-matrix, explicitly labeled "a scratch driver" below and deleted
per this project's own scratch-script convention; and again in session
39 after discovering it was gone). Any driver/loop that plays real,
standalone Cribbage to a target score (`game.ts`'s `playOneHand`/
`playHands`, a race-to-121 win-loop, per-side-skill plumbing for a bare
game) is permanent, committed engine code from now on, even when the
immediate reason for writing it is a one-off check. **Done as of session
39**: `game.ts`'s `playOneHand`/`playHands` gained per-side discard/play
strategy support, and `src/engine/basic-cribbage.ts` now provides a real
`playBasicCribbageGame` (race-to-121, independent playerSkill/enemySkill,
skunk/double-skunk detection) as committed, tested engine code -- not
just a diagnostic script.

**Banked (session 39): enemy roster is 100% shared-pool content, never
followed through on its own design intent.** A full 32-enemy audit
(session 39) found 7 dead-trigger instances across 9 enemies, all
because every enemy draws its entire loadout from the same catalog
players use (`enemies.ts`'s `pool()`) -- `enemies.ts`'s own doc comment
cites DESIGN.md allowing enemy content to be "fully bespoke to one
enemy," but the session-27 roster draft used only pool pieces, for
every one of the 32 enemies, and nothing since has revisited that.
Session 39 fixed the 7 broken slots with real bespoke content
(`src/engine/enemy-subroutines.ts`, a genuinely enemy-only catalog --
see that file's own doc comment) but deliberately did NOT touch the
other ~25 enemies' still-pool-drawn kits, per explicit user direction
("Option 1 for now, backlog option 2"). The broader initiative -- giving
some or all of the rest of the roster real bespoke, theme-appropriate
content instead of reused player pieces -- is open for a future session,
scoped as its own thing rather than folded into a dead-code fix.

**Related, unconfirmed finding surfaced while building the above**:
`gaugeFillAbove` (an existing `enemyState` trigger condition, used by
the already-shipped Honeypot and Vulnerability Scan pool pieces) reads
`gauges.ts`'s `InitiativeGauge` -- the turn-cadence meter, which is
designed to cycle/reset on every crossing -- not real win-progress.
Empirically, a piece using it fired 15-26 times in an 18-20-hand match
during session 39's own testing, once every turn or two, which reads
more like an `always`-ish trigger than the "meaningful late-game
reactive punish" the two existing pieces both appear to be designed as.
Not touched or fixed this session (out of scope, and neither piece is
dead -- both fire, just perhaps far more often than intended) -- worth a
real look at what Honeypot/Vulnerability Scan actually do in practice
before assuming they're balanced as shipped.

**Session 30 (`/decision-session`) paused the balance-pass track to
design the *shape* of Mods** (StS-relic equivalent, see `DESIGN.md`'s
new "Mods" subsection under Meta-Progression) — the long-deferred item
from session 21's Phase 4 scope split. Shape only: engine mechanism
split, class-passive migration, uniqueness, uncapped ownership,
acquisition/Shop wiring, pool scoping. **Session 31 followed immediately
with the hook-point catalog** (see `DESIGN.md`'s new "Mods — Hook-Point
Catalog" subsection) — 11 chainable hook points across combat and run
scope, both structs (`EncounterOutcome`, `RunEvent`) reused rather than
inventing new state. **Session 32 then built a 17-Mod validation sample**
against that catalog (see `DESIGN.md`'s new "Mods — Content Validation
Pass" subsection), at the user's request, specifically to catch gaps
before implementation gets scoped — found one real gap (a 12th hook,
`onTriggerEvaluate`, for trigger-mechanism-affinity Mods) and confirmed
one near-miss wasn't actually a gap (`onModAcquired` already covers
run-start-style effects). **Session 33 closed out the design arc with a
real 9-checkpoint implementation spec** (see this Phase's own "Mods
Implementation" write-up, below) — all 17 Mods to be authored as real
data in this pass (not a representative subset), and the 6 existing
class starting passives migrate onto the new infrastructure in this same
pass too, at the user's explicit request. **Next up**: an actual
`/dev-session` implementing all 9 checkpoints — the first time this
whole design arc (sessions 30-33) turns into real code. The per-class
magnitude/balance pass below remains the eventual next major milestone
after Mods ships — not abandoned, just sequenced behind it at the user's
request.

**Session 34 (`/dev-session`) implemented all 9 of session 33's Mods
checkpoints (A-I) in one pass**, closing out the sessions 30-33 design
arc as real, working code -- `mod-types.ts` (new) and `mods.ts` (new)
hold the type system and all 23 `ModDefinition`s (the 6 migrated class
passives + all 17 validated Mods, none held back), `resolve.ts`/
`triggers.ts` carry the combat-scoped hook dispatch, `run.ts`/`shop.ts`/
`encounters.ts`/`loadout.ts` carry the run-level hooks and granted-
subroutine mechanism. All 12 hook points (7 combat-scoped, 5 run-scoped)
are wired and exercised, not just cataloged. One real implementation
finding, discovered once inside the actual dispatch code rather than
at the scoping stage: checkpoint D's plan called for literally *folding*
the 6 class passives into the shared per-hook dispatcher functions
alongside the enemy-passive registry, but several of them (Zero Day's
mid-payload Heat waiver; Return to Sender's three distinct trigger
points) don't fit that post-fire fold shape without changing their own
behavior -- migrated their *gating* (from a `classId` string check to an
`ownedModIds` membership check, via a new `hasMod` helper) while leaving
each one's own call site where it already was, rather than forcing a
relocation. Zero-regression safety for that migration came from a single
design choice: `resolve.ts`'s `createCombatState` auto-derives the
current class's own exclusive Mod into `ownedModIds` whenever `classId`
is set, so every pre-existing test/call site that only ever passed
`classId` (the whole suite, before this session) keeps getting that
class's passive with no other change needed. 484 tests passing (from
460, 24 new in `mods.test.ts`), `npm run check` clean throughout, 4
commits. **Same-day follow-up**: ran that sweep (200 seeds/class, see
this Phase's own write-up below) -- average victory rate 32.75%, up from
session 28's pre-Mods 28.7%, same relative class ordering. **Next
session, user's direct ask**: dig into why losses are overwhelmingly
`quarantined` (49-79.5% every class) while `heatMaxed`/`noRoute` stay
near zero -- a real hypothesis is already banked (below, this Phase)
pointing at `beelineToGatekeeper` itself concentrating all risk into
gatekeeper fights, but it's unconfirmed; worth checking against a
different traversal strategy before assuming. Exact Mod magnitudes
remain TBD/playtesting placeholders, same discipline as every other
numeric constant in this project.

**Session 35 checked the beelineToGatekeeper hypothesis above** by
sweeping `exploreThenGatekeeper` (`run.ts`, existed since session 19 but
had never been swept -- `scripts/sweep.ts` had no CLI way to select a
non-default traversal strategy until this session added `--traversal=
beeline|explore`). Same 200-seed/class methodology as the session-34
follow-up. First run under `explore` crashed immediately
(`pickRegularOrEliteEnemy: no eligible elite enemy for layer 1`): every
one of the Enemy Design section's 8 authored Elite identities had
`minLayer` 2 or 3, none for layer 1, so `map-gen.ts` rolling an
`eliteFight` node there (its type weights are flat across all 4 layers)
produced an unresolvable node -- `beelineToGatekeeper` essentially never
visits enough off-path nodes to hit one, which is why this shipped
unnoticed through 34 sessions of sweeps. The user's call once this
surfaced: layer 1 *should* have real Elites, not zero, so the actual fix
went the opposite direction from the first patch attempted mid-session --
`enemies.ts`'s 3 single-archetype Elites (Zero-Day Broker, Ransomware
Deployment, Zero Trust Node) widened from `minLayer: 2` to `minLayer: 1`
(the tier's simplest identities, mirroring Regular's own layer-1/layer-2
split by archetype simplicity; the 2-archetype and Root Elites stay put,
preserving the tier's harder-skewing-by-layer progression), and `DESIGN.md`'s
Elite table updated to match. Real layer-specific Elite content is
banked for a future authoring pass rather than done here. 484/484 tests
still pass throughout.

This surfaced a design question worth stating explicitly rather than
leaving implicit, resolved live (`/decision-session`, per this project's
`.claude/dev-session.md` override) and now written into `DESIGN.md`'s
Map & Run Structure section: **the intended ideal path is a middle
ground between beelining and fully exploring a layer, managing Heat
along the way** -- leaning into either extreme is a deliberate
risk/reward tradeoff the design wants, not a problem to eliminate.
Exploring buys more accumulated power before a gatekeeper fight at the
cost of the Heat spent getting there; beelining conserves that Heat as
headroom to explore more freely in a later layer, at the cost of a
thinner kit at that layer's own gatekeeper. This session's sweep is the
first real data point against that framing.

The comparison (`beeline` vs. `explore`, both 200 seeds/class, with the
layer-1 Elites now in place):

| class     | victory (beeline→explore) | quarantined (beeline→explore) | heatMaxed (beeline→explore) | noRoute (beeline→explore) | avgLayers (beeline→explore) |
|-----------|---------------------------|-------------------------------|------------------------------|-----------------------------|------------------------------|
| breacher  | 18.0%→14.0%               | 78.0%→45.0%                   | 0%→0%                        | 4.0%→41.0%                  | 0.93→1.00                    |
| blackhat  | 34.0%→3.5%                | 62.0%→29.0%                   | 4.0%→64.5%                   | 0%→3.0%                     | 1.78→0.81                    |
| saboteur  | 35.5%→46.5%               | 64.0%→49.0%                   | 0%→0%                        | 0.5%→4.5%                   | 1.96→2.28                    |
| operator  | 47.5%→39.5%               | 49.0%→46.5%                   | 0%→0.5%                      | 3.5%→13.5%                  | 2.25→2.09                    |
| warden    | 41.0%→42.5%               | 57.5%→47.0%                   | 0%→0%                        | 1.5%→10.5%                  | 2.12→2.17                    |
| ghost     | 20.5%→36.5%               | 79.5%→54.5%                   | 0%→1.0%                      | 0%→8.0%                     | 1.58→1.98                    |
| **avg**   | **32.75%→30.42%**         |                                |                               |                              |                              |

**Hypothesis partially confirmed, but the naive read ("explore is just
better") is still wrong even with real layer-1 Elites in play.**
Quarantine's *share* of runs drops for every single class under
`explore` (as predicted -- fewer runs die specifically at a gatekeeper
fight), but overall victory rate doesn't rise to match; it's roughly
flat-to-down (32.75%→30.42% averaged), because the quarantine share
isn't converting into extra wins, it's converting into two other failure
modes that `beelineToGatekeeper` structurally avoids: `noRouteRemains`
(breacher 4.0%→41.0%, operator 3.5%→13.5%, warden 1.5%→10.5%) and, most
sharply, `heatMaxed` for Blackhat specifically (4.0%→64.5%, victory
collapsing 34.0%→3.5%). Both trace to the same mechanical source:
`exploreThenGatekeeper` pays `HEAT_PER_MOVE` for every extra move to
every extra node, and fights more regular/elite nodes whose losses close
them permanently -- this is the same dynamic session 20 already found
and named (Phase 3's "25-seed sweep with an aggressive 'fight
everything' strategy found `noRouteRemains` dominates (96%) ... a real,
intended consequence of the resilience guarantee only promising safety
against *one* closed node at a time, not several"). Saboteur and Ghost
are the two classes where exploring is unambiguously better (46.5%/36.5%
vs. 35.5%/20.5%) -- both are Root-paired classes whose kit leans on
recon/manipulation that has more surface to work with when more fights
happen, consistent with Root's own known structural profile (session
24/25 writeups, above). This is exactly the "leaning into either extreme
is a real risk/reward tradeoff" framing just written into `DESIGN.md` --
neither pure strategy is simply better, each has a real, class-dependent
cost.

**Open question for a future session, not resolved here**: this sweep
can't distinguish "reaching a gatekeeper fight with a stronger kit makes
it more winnable" from "fewer runs simply survive long enough to reach a
gatekeeper fight at all, so the ones that do were already the
easier/luckier seeds" -- both are consistent with quarantine's dropping
share. A traversal strategy in between the two extremes (e.g. explore
only within some Heat budget, or only fight nodes without visiting
shop/event/safehouse for their own sake) would separate these, and would
also be the natural "actually play the middle ground" script this
session's new design goal implies -- neither the pure-beeline nor
pure-explore scripted strategy really embodies it. Not built this
session -- the two existing strategies were enough to answer the
specific "is beeline the whole story" question asked. Not fixed or tuned
here either: Blackhat's Heat-fragility under any exploration-heavy
strategy is itself a real finding worth its own look before touching
`HEAT_PER_MOVE` or Blackhat's kit.

**Next session**: the per-class magnitude/balance pass (standing next
milestone since session 29) is still the eventual target, but two things
from this session should inform it rather than be skipped past --
Blackhat's Heat-exhaustion fragility under any exploration-heavy play,
and the still-open "does more power or fewer survivors explain
quarantine's drop" question above. A "middle ground" scripted traversal
strategy (per this session's new design goal) would be a cheap, useful
diagnostic to build before or alongside that pass.

**Session 36** (2026-08-28, `/decision-session`) designed both items the
user flagged as necessary before the balance pass: a new consumable-item
system (**Burners**) and the long-undesigned **Event** node. Full
writeups in `DESIGN.md`'s new "Burners"/"Events" subsections under
Meta-Progression; implementation-facing summaries in Phase 5, below.
Resolved live, one decision at a time: Burners' niche (manual, on-demand
activation — the one gap left by subroutines' automatic-trigger economy
and Mods' passive economy), naming (**Burners**, a real hacking-culture
term for a disposable, use-once, discard-to-avoid-tracing item),
activation timing (own-turn only, not anytime-mid-hand -- the anytime
version needs the same resumable-engine plumbing already banked since
session 24 for human-vs-AI play), a three-context unified system
(combat/map/shop, one owned-item pool), inventory shape (capped, no
bench split), and acquisition (all fight tiers + Shop + Events). Then
Events' paradigm (narrative vignette + choices, not a new Cribbage-
resolution mechanism), risk model (a per-choice `transparent`/
`visibleOdds`/`gamble` tier, risk gating reward ceiling -- a deliberate,
contained exception to this project's otherwise fully-transparent house
style), effect pool (reuses existing resources/grants, no new type), and
node-state behavior (inert-after-one, matching Safehouse/Shop). Also
resolves the session-9 banked node-bypass idea, as a map-context Burner
effect rather than a passive ability. Docs-only session, no code -- same
"shape now, content/implementation later" split Mods went through across
sessions 30-33. **Next session**: either the per-class magnitude/balance
pass (still the standing milestone, per session 35's own pointer above)
or an engineering-scoping session turning this session's shape into real
implementation checkpoints (mirroring sessions 15/17/19/21/27/33) -- ask
rather than assume, same as every prior "what's next" fork in this
project.

**Session 37** (2026-08-28, `/decision-session`, engineering scoping)
took the second option: turned session 36's Burners/Events shape into a
full checkpointed implementation spec (full writeup in Phase 5's new
"Burners + Events Implementation" section, below), directly continuing
session 33's own precedent for Mods (shape -> hook catalog -> content
validation -> implementation spec). Explored the actual engine before
proposing checkpoints, resolved two live decisions (reopening a closed
node returns it to `unresolved`, not straight to `inert`; validate a
small content sample for both systems before locking the spec, not
after), authored and validated 8 concrete Events and 8 concrete Burners
against the type system (the Event sample surfaced a real gap -- reward
grants need to support a random-by-rarity draw, not just a hardcoded
piece id -- closed in the type design; the Burner sample found no gap,
confirming the shape). Docs-only, no code. **Next session**: an actual
`/dev-session` implementing checkpoints A-J, or the per-class
magnitude/balance pass (still the other standing candidate) -- ask
rather than assume.

**Session 38** (2026-08-28, `/dev-session`) implemented all 9 of session
37's Burners + Events checkpoints (A-J) in one continuous pass, then
used a same-session balance sweep to find and fix the two largest
outlier classes -- full detail in Phase 5's "Burners + Events
Implementation" write-up (checkpoint status) and this session's own
`session-logs/session-38-2026-08-28.md` entry; summarized here at the
level a future session needs to pick the thread back up.

Checkpoints A-F (Burners) and G-J (Events + verification) shipped
essentially as scoped, paced one checkpoint at a time at the user's
request (verify, report, wait for go-ahead each time) rather than all
at once the way session 34's Mods pass was. `burner-types.ts`/
`burners.ts` and `event-types.ts`/`events.ts` (all new) hold the type
systems and the 8+8 validated content pieces from session 37; combat/
map/shop-context activation, the third independent Burner Shop slate,
Event choice resolution (a real random-pick mechanism, not a persisted
map-gen assignment), and bonus-fight resolution (folds straight into
the same `EncounterOutcome` a normal fight would produce, so run.ts's
existing reward-handling picked it up for free) all landed in
`combat.ts`/`run.ts`/`shop.ts`/`encounters.ts`. `burners.test.ts`/
`events.test.ts` (new, checkpoint J) cover every strategy type, all 8
Burners across their real contexts (including `reopenNode` against a
hand-built graph, mirroring `gatekeeperReachable`'s own Phase 3
precedent), all 8 Events, and combined smoke tests.

Verification writing surfaced two real gaps from earlier checkpoints in
the same pass, both fixed immediately rather than deferred: `run.ts`
never threaded `eventChoiceStrategy` into `RunOptions` at all
(checkpoint H's own miss, caught while verifying checkpoint I's
bonus-fight path end-to-end); and `resolveFight` never actually passed
`burnerActivationStrategies` to `playCombat`, meaning combat-context
Burner activation (checkpoint C's whole mechanism) was unreachable from
a real `playRun` fight. Checkpoint J's own testing then found a third,
more structural gap: the `noRouteRemains` reachability check ran
*before* the map-Burner-activation step each loop iteration, so
Skeleton Key's reopen effect -- its entire reason to exist -- could
never fire in its own primary use case, since the run already ended the
instant a closing node cut off the last route. Reordered the check to
run after activation; verified with a real before/after (the same
scenario ends in `noRouteRemains` without the Burner, and reopening it
genuinely changes the outcome when carried).

**Balance sweep, same session**: a fresh 6-class/200-seed/both-
traversal sweep (the first with real Event/Burner content live, not
directly comparable to sessions 34/35's pre-Burners/Events baselines)
surfaced two sharp outliers, each dug into and fixed with empirically-
tested candidates rather than tuned by feel:

- **Blackhat's explore-mode Heat fragility** (2.0% win rate, 65.5%
  heat-outs) traced to its own starting kit, not movement Heat -- two of
  its three pieces cost Heat to fire, one of them (Static Noise) on
  every single turn via an Always/Cantrip trigger, so the cost
  multiplies directly with fight length/count. An isolated single-fight
  test made it unambiguous: Blackhat generates 14.06 Heat from its own
  kit alone against a weak enemy; Warden/Operator generate 0.00 (neither
  has any Heat-costing payload). Fixed: Static Noise's `heatCost` 1→0
  (a guaranteed-every-turn Cantrip shouldn't also be a guaranteed Heat
  tax) plus Payload Drop 4→3. Result: explore 2.0%→20.0%, beeline
  untouched (32.5%→33.0%), heat-outs 65.5%→34.5% -- deliberately not
  full parity with beeline, preserving the real gap between Blackhat's
  two playstyles rather than erasing it (a candidate that zeroed both
  costs reached 32.5% explore, which would have).
- **Breacher's gatekeeper-tier fragility** (12.0% overall, worst of all
  6 classes) turned out not to be the stalemate/hard-tiebreak problem
  session 28/29 diagnosed and partially fixed -- Breacher wins ~90%+
  against 5/6 regular-tier enemies, and its gatekeeper losses are almost
  entirely real `resolvedBy: 'threshold'` losses, not attrition
  stalemates. A matched control sweep (same gatekeepers, Operator/Warden
  starting kits) found Firewall Prime plays the *exact same strategy*
  Breacher's kit does -- deny, bank mitigation via the
  `mitigationBanked` accumulator, convert to a burst -- just far more
  efficiently (threshold 10 vs Breacher's 28, payload 16 vs 5, 2
  mitigation-banking sources vs 1); Warden, the only other
  Encryption-paired class, loses to it exactly as badly (0%) while
  Encryption-less Operator doesn't, confirming a mirror-match power gap
  rather than an archetype counter. Ghost Process and Incident Response
  are different mechanisms entirely (Root gauge-denial with a
  self-accelerating Haste snowball; simply closing fights out in ~3.6
  hands before Breacher's slow accumulator gets going). Tested 5
  candidates against both the 4 hardest matchups and 3 easy controls
  before picking one: Buffer Overflow's trigger (`occurrence: run` →
  `occurrence: fifteen` -- a bigger identity change than a magnitude
  tweak, but by far the single highest-leverage fix) plus Lock Fatigue's
  threshold 28→20/amount 5→7. Result: beeline 12.0%→24.0%, explore
  12.0%→26.5%, no overshoot (easy matchups held at 100% throughout).
  Firewall Prime and Incident Response remain genuinely hard even after
  this (0%/3% in isolated combat) -- deliberately left alone, since
  both are broadly hard for other classes too (Operator 58%/10%, Warden
  0%/40%), not a Breacher-specific gap still open.

515/515 tests passing throughout (from 484), `npm run check` clean. 15
commits this session (12 implementation checkpoints/fixes + 2 balance
fixes + this close-out), none pushed yet -- ask before assuming, same
as every prior session.

**Session 39** (2026-08-28, same day, `/decision-session` then
implemented same-session) closed the middle-ground traversal-strategy
gap banked since session 35. Resolved live: the user corrected my first
fights-only draft -- Shop/Event/Safehouse detours are real, if less
direct, power gains too, not visits "for their own sake" -- landing on
fights always first, Heat-high or material-high both pulling toward
Safehouse, Data-high pulling toward Shop, and Event only pulling when
Heat/material/Data are *all* low (a low-resource fallback gamble). Heat
wins the Rest-vs-Merge tie at a Safehouse when both its own trigger and
material's fire at once (the user's call -- Heat is the run-ending
resource). Given the small scope (one traversal strategy, one safehouse
strategy, a signature widen, CLI wiring), the user asked to implement
in the same sitting rather than stop at a written spec.

Shipped `opportunisticTraversal` (`run.ts`) + `opportunisticSafehouseStrategy`
(`merge.ts`), every detour gated by a Heat safety-reserve check so
exploring can never strand the run short of the gatekeeper.
`TraversalStrategy`/`SafehouseStrategy` widened additively (existing
strategies unaffected); wired into `scripts/sweep.ts` as
`--traversal=opportunistic`, auto-paired with the new safehouse strategy
as one coherent player profile. 528/528 tests passing (from 515), `npm
run check` clean.

**Comparison sweep** (200 seeds/class, all 3 strategies):

| class | beeline | explore | opportunistic |
|---|---|---|---|
| breacher | 24.0% | 26.5% | 26.0% |
| blackhat | 33.0% | 20.0% | **26.5%** |
| saboteur | 33.0% | 51.5% | 50.5% |
| operator | 40.5% | 43.0% | 42.5% |
| warden | 33.5% | 50.5% | 43.0% |
| ghost | 21.0% | 39.5% | 36.0% |
| avg | 30.8% | 38.5% | 37.4% |

Blackhat is the clean validation case: opportunistic's Heat-safety-
reserve protects it from explore's known Heat fragility (26.5% vs.
explore's 20.0%, heat-maxed roughly halved). Elsewhere it tracks close
to explore, ahead of beeline.

**Two findings from digging into the sweep, both banked for the actual
balance pass rather than acted on now**:

1. **The noRoute anomaly, explained, not a bug**: opportunistic showed a
   *higher* `noRouteRemains` rate than explore for breacher/operator/
   ghost despite being more Heat-conservative. Instrumented on 300
   shared seeds: opportunistic engages *more* distinct fight nodes per
   run than explore (e.g. breacher 9.05 vs 7.58) while using *fewer*
   total moves (19.07 vs 23.33), because explore burns moves visiting
   every Safehouse/Shop/Event node indiscriminately (zero closure risk
   but wasted budget) and isn't actually nearest-first in its node
   selection (node-array order, a pre-existing session-19
   simplification), while opportunistic always takes the true shortest
   path. Every sampled noRoute-ending run closed exactly 1 fight node
   (matches session 20's "resilience guarantee only promises safety
   against one closure" finding) -- so more distinct fights engaged is
   more independent rolls against that single-point-of-failure risk. Net
   victory *counts* stay essentially level (82 vs 82 breacher, 129 vs
   123 operator, 113 vs 114 ghost) -- the extra engagement converts into
   a mix of extra wins and extra noRoute losses, an honest reflection of
   `DESIGN.md`'s own "either extreme is a real tradeoff" framing, not a
   defect.
2. **Does `HEAT_PER_MOVE` need bumping? Checked, not acted on.** For 5 of
   6 classes movement Heat is already the dominant Heat source, but runs
   still end (quarantine/noRoute) at only 32-42% of `HEAT_MAX` on
   average, `heatMaxed` at 0/300 -- real headroom, not currently the
   bottleneck. **Blackhat is the exception and the reason not to bump it
   casually**: 72.7/100 average final Heat, 26% heat-maxed rate *at the
   current value*, from its own kit's Heat taxes (session 38's fix)
   compounding with movement -- a global bump would land hardest on the
   class least able to absorb it. User's call: leave `HEAT_PER_MOVE` as
   2 for now, test a candidate value against the full roster
   (Blackhat-aware) during the actual balance pass instead of picking a
   number by feel.

1 implementation commit this session so far.

**Session 39 continued same-day**: the balance pass the section above
pointed at actually started -- and turned into a bigger arc than
per-class numbers. Matchup-swept Saboteur/Operator/Warden/Ghost against
all 12 gatekeepers on bare starting kits, found Null Session was a sharp
bimodal outlier (Operator 96% vs. 0-8% for 5 other classes, not a
"broadly hard" gatekeeper like Firewall Prime/Incident Response). Traced
it via ablation to Zero Trust's `instantCounterPush` amount alone
(`CAPPED.rare`=18, a single reactive proc wiping 36% of the win
threshold) -- a bespoke, Null-Session-only tempered fix (amount ->
`UNCOMMON.burst`=11) was built and tested, but **not shipped**.

Why: asked how the matchup tests were actually run, and the honest
answer -- bare starting kits, both sides on `playCombat`'s dumb baseline
AI, not the real skill-dial AI real fights use -- led to a real
methodology fix instead. Built `run.ts`'s `onBeforeGatekeeperFight` hook
(captures a player's *real* accumulated state the instant a real
`playRun()` reaches a gatekeeper) and `scripts/gatekeeper-check.ts` (new,
permanent -- re-fights each captured real state against the real
production skill-dial enemy AI, aggregating win rate; deliberately
doesn't try to average a loadout across seeds, since acquired content
can't be meaningfully blended). The realistic re-sweep reversed the Null
Session finding almost entirely (93.5%/93.5%/64-71%/100%/65-69%/82-87%)
-- the original 0% wall was mostly a worst-case-floor artifact. The Zero
Trust fix stays shelved. Firewall Prime (especially Warden, 4.5-5.7%)
is now the real remaining single-gatekeeper outlier, not yet worked.

That same tool's by-layer aggregation then surfaced a real, structural
engine gap: nothing scaled enemy magnitude by layer at all (only a
small skill-dial step did) -- layer 1 was measurably the *hardest* tier
across every class, backwards from `DESIGN.md`'s stated intent. Built and
shipped a real per-layer magnitude scaler: regular/elite scale live via
one shared formula (`enemyMagnitudeScaler`), gatekeepers get an explicit,
individually-tunable stored `magnitudeScaler` field (per the user's own
design call -- gatekeepers never repeat across layers, so a per-identity
knob makes more sense than a formula). Empirically tuned, not guessed:
0.15/layer narrowed the layer-1-vs-4 gap but didn't close it; 0.3/layer
brought layer 4 to parity with layer 1. Layer 3 remains a real, separate
outlier (already the easiest layer pre-scaling) -- likely a content
issue (its own weak gatekeeper trio), not a magnitude one, flagged for a
future pass. Confirmed wanted but explicitly deferred: independent
per-side initiative/win-gauge thresholds -- real plumbing work
(`CombatOptions`/`createCombatState` currently share one threshold both
sides), scoped as its own future pass.

Also removed `maxHands`/`FIGHT_MAX_HANDS` outright at the user's request
-- vestigial since session 27's `HARD_RESOLUTION_HAND` made it
unreachable for any real fight, previously left in place rather than
deleted.

540/540 tests passing (from 528), `npm run check` clean throughout. 6
commits this half (`5b4d29d` maxHands removal, `b967e2e` the hook,
`0819790`/`5cb3079` gatekeeper-check.ts, `46eeba8` the magnitude scaler,
`7e5f23a` the 0.3 retune), all pushed to `origin/master` at the user's
explicit request -- tip is now `7e5f23a`. Session log:
`session-logs/session-39-2026-08-28.md`.

**Session 39 continued a third time, same day**: the per-class balance
pass actually happened, against a real external target the user set
directly -- Slay the Spire's own ascension-0 full-run win rate (9-15%
for a new player). Measured against it (a fresh `scripts/sweep.ts`
full-run sweep, post-magnitude-scaler): the average was already down to
~21% from the scaler alone, but Saboteur/Operator/Warden/Ghost still sat
20-29%, well above the band (Breacher 11.7%/Blackhat 13.3% were already
inside it). Went class by class, same isolate-then-fix discipline as
every prior balance fix, each confirmed against a real full-run sweep
before locking in:

- **Warden** (26.3% -> 13.7%): Feedback Loop, already flagged as a
  suspect since session 25, gave every Encryption HoT tick a flat +2
  win-gauge bonus unconditionally. A flat-magnitude fix alone would have
  worked numerically, but investigation found it made Feedback Loop a
  narrower, weaker echo of Ghost's own Return to Sender (which already
  hooks HoT ticks, proportionally, plus two other trigger paths) --
  redesigned instead as reciprocal HoT/DoT amplification (every HoT tick
  queues a bonus for the caster's next DoT tick and vice versa, tracked
  via two scratch keys in `CombatSideState.passiveState`). First
  attempt scaled the bonus proportionally to the triggering tick's own
  size (matching Return to Sender's own ratio) -- compounded
  multiplicatively across a match and made Warden *stronger* than before
  any fix; rebuilt as a flat per-tick step instead (linear growth),
  tuned to 0.15.
- **Saboteur** (24.3% -> 12.0%): Sleeper Cell credited a flat +4 on top
  of every Malware DoT tick's own natural credit -- Silent Worm's DoT is
  Saboteur's *only* credit-capable payload at all, so this one passive
  was carrying most of the class. Straightforward retune, 4 -> 2 (no
  identity-overlap concern the way Warden's had).
- **Operator** (20.7% -> 11.0%): Primed permanently boosts Precision
  Strike's own magnitude every time either Root piece fires (Ping Sweep
  is guaranteed every turn), compounding continuously across a whole
  match, not per-tick -- structurally different from the first two.
  Zeroing it collapsed Operator entirely (0.7% win rate, avgLayers 0.10,
  81% noRoute), confirming it was carrying regular-fight performance
  too, not just gatekeepers -- needed a much smaller relative cut (3 ->
  1.5) than Warden's or Saboteur's.
- **Ghost** (28.7% -> 13.7%): needed two levers together, neither alone
  reached the band. Idle Process (session 28's fix for Ghost's original
  0%-genuine-win-rate finding) is Ghost's only *guaranteed* credit
  source -- zeroing it alone collapsed Ghost entirely (0.0%, avgLayers
  0.01, 99% noRoute). Return to Sender's own ratio, tested alone even at
  0, only reached 17.0% -- still above target. Halved both together
  (Idle Process 2 -> 1, Return to Sender ratio 0.5 -> 0.25) -> 13.7%.

**A real cross-class coupling was found and fixed while re-verifying
with a fresh full sweep afterward**: Warden's own number had shifted
(41/300 -> 43/300) purely from the Operator commit landing, despite that
diff touching nothing Warden-related. Traced to `applyPrimedForSide1`
(Zero-Sum's own enemy passive, `primed-to-strike`) reusing Operator's
exact `PRIMED_THRESHOLD_REDUCTION`/`PRIMED_MAGNITUDE_BONUS` constants
unconditionally -- retuning Operator's own passive had incidentally
retuned Zero-Sum's difficulty for every other class fighting it too.
Split into independent `ZERO_SUM_PRIMED_*` constants (seeded at the
original values, a pure decoupling not a balance change) at the user's
own suggestion, once asked whether the two should share tuning at all.

542/542 tests passing throughout (from 528 before this arc began), `npm
run check` clean. 6 commits this half (`3a4556f` Warden, `115bd0b`
Saboteur, `6e3652b` Operator, `2e1cfa4` Ghost, `42f985e` the Zero-Sum
decoupling -- plus this doc pass), all pushed to `origin/master` --
tip is now `42f985e` before this close-out.

**Final result**: all 6 classes' full-run victory rate inside StS's
ascension-0 9-15% band -- breacher 11.7%, blackhat 13.3%, saboteur
12.0%, operator 11.0%, warden 13.7%, ghost 13.7%.

**Next session**: real candidates, un-prioritized -- Firewall Prime
(especially vs. Warden, still near-unwinnable even with realistic
acquired power), layer 3's own weaker gatekeeper trio (Total
Compromise/Adaptive Threat/Silent Corruption, likely a content issue not
a magnitude one), the independent-per-side-gauge-thresholds architecture
work (confirmed wanted, not yet scoped), or Burner/Event content
authoring beyond the 8+8 validated samples -- ask rather than assume,
same as every prior fork in this project.

*(Historical snapshot -- session 39's later gatekeeper-ablation audit,
see "NEXT SESSION" at the top of this file, found the "layer 3 weak
trio" guess above was wrong: layer 3 is the best-balanced layer in the
roster. Firewall Prime got a real redesign pass and improved but is
still a confirmed outlier. Leaving this paragraph as-is for the
historical record of what was believed at the time.)*

**Session 40** (2026-08-29, `/decision-session`, engineering scoping)
took the independent-per-side-gauge-thresholds architecture item off
session 39's own "next session" list (above) -- the user's explicit
choice, ahead of the gatekeeper balance pass the audit above is waiting
on, reasoning that per-side thresholds are themselves a balancing lever
and worth having available before that pass locks in specific numbers.
Explored the actual engine before proposing checkpoints (`gauges.ts`,
`resolve.ts`, `combat.ts`, `encounters.ts`, `enemies.ts`,
`scripts/gatekeeper-check.ts`) rather than assuming the shape. Two live
decisions resolved:

1. **Scope for this session: plumbing only, zero balance change** --
   independent per-side storage for both `gaugeThreshold` and
   `winThreshold`, plus an optional per-gatekeeper override field for
   each (mirroring session 39's own `magnitudeScaler` precedent exactly),
   every override left unset so behavior is unchanged until the
   follow-up balance pass deliberately sets one. The user's own framing
   ("before trying to balance gatekeepers") put the actual tuning pass
   after this, not inside it -- same "shape before content" split this
   project already used for Mods (30-33) and Burners/Events (36-38).
2. **"Expand the content design space" means a real runtime hook this
   session too, not just a static per-enemy field** -- the user asked
   for both explicitly. Resolved to reuse the existing `onCombatStart`
   Mod hook (session 31, already real -- Warm Boot uses it today) rather
   than invent a new hook point: it fires once per fight, right after
   `createCombatState`, before escalation ever touches a threshold, so a
   threshold-adjusting Mod effect composes cleanly with escalation's own
   shrink with no ordering questions to resolve. No real Mod is
   authored this session -- the hook is proven with a mechanism-level
   test, not shipped content, mirroring how session 31 proved its own
   hook catalog before session 32 validated real content against it.

A third, smaller call made in passing rather than asked live (confident
there was one clearly-right answer given the two decisions above):
regular/elite enemies stay on the flat global constants for both
thresholds, no per-layer scaling formula the way `magnitudeScaler` gives
them one -- whether deeper layers should also demand more win-gauge
progress is a real, separate balance question, out of scope for a
session whose whole point is zero measured behavior change. Only
gatekeepers get the optional override, for the same reason
`magnitudeScaler` is gatekeeper-only: they never repeat across layers, so
a stored per-identity value is meaningful in a way it wouldn't be for an
enemy that can appear at several different layers.

Full checkpointed implementation spec (checkpoints A-F) in Phase 5's new
"Independent Per-Side Gauge/Win Thresholds -- Implementation" section,
below.

**Same day, `/dev-session`**: all 6 checkpoints implemented and verified
immediately after scoping, at the user's own request (no gap between
`/decision-session` and `/dev-session` this time -- see the Phase 5
section's own ✅ complete note for the full verification detail: 572/572
tests, clean `npm run check`, byte-identical 50-seed regression sweep).

**Same day, continued -- the gatekeeper balance pass itself started**,
layer 4 first per the audit's own suggested order (widest spread, single
largest effect). Diagnosed before touching any numbers, same discipline
as every prior fix in this project:

- **Kernel Panic (the layer's easy outlier, -5.63)**: realistic-state
  diagnostic (`gatekeeper-check.ts`, 200 seeds/class) confirmed it at a
  flat **100.0% player win rate across all 6 classes** (65/65) --
  essentially harmless. Tested both new levers against it directly
  (`winThreshold` 50->30, then also `gaugeThreshold` 8->4 on top) --
  **neither moved the number at all, still 100.0% across the board**.
  Conclusion: the problem isn't distance-to-win or turn cadence, it's
  that its two credit-capable pieces (Total Pwnage, Epidemic) essentially
  never generate real progress in a realistic fight length -- both use
  RARE-tier accumulator/occurrence triggers (`RARE.bankTarget`/
  `RARE.threshold`) that apparently rarely bank up before the fight
  resolves. **Reverted both test overrides, left unset** -- fixing this
  for real needs either a shared RARE-tier constant change (would affect
  other content project-wide, not just Kernel Panic) or bespoke content
  (this project's own "enemy roster is 100% shared-pool content" banked
  item, above), not a threshold override. Flagged for a future,
  differently-scoped session.
- **Null Session (the layer's hard outlier, +5.20)**: same diagnostic
  showed brutal, wildly class-dependent results -- Operator 100.0% (9/9)
  while Saboteur sat at 20.0% (3/15) and Warden at 22.2% (2/9). Traced to
  `null-session-passive` (`resolve.ts`): a flat, unconditional +7 credit
  toward Null Session's *own* gauge the instant the player's own gauge
  crosses 50% of its threshold -- a "punish the leader" mechanic with no
  real counterplay, on top of a working Circuit Breaker win path via
  Zero Trust's counter-push banking. **Fix**: `winThreshold: 65` (up from
  the flat 50), tested against 65 and 80 -- 65 already captured nearly
  all the available gain (Saboteur 20.0%->26.7%, Warden 22.2%->44.4%,
  Blackhat 50.0%->57.1%, Operator unaffected at 100.0%); 80 was
  virtually identical to 65 (Saboteur/Warden/Blackhat all unchanged,
  only Breacher moved one seed's worth), a real plateau -- the remaining
  gap for Saboteur/Warden most likely traces to Zero Trust's own
  *reactive* `instantCounterPush` (fires whenever the player's gauge gets
  high, not gated by turn cadence) causing repeated attrition losses
  rather than Null Session ever reaching its own threshold, which
  `winThreshold` alone can't fix -- flagged as a real follow-up rather
  than chased further this checkpoint. Locked in at 65 (the smaller,
  equally-effective value). Full-run regression (300-seed `beeline`
  sweep, before/after, all 6 classes): small, uniformly positive
  movement (+0.3 to +1.6pp per class, e.g. Warden 18.0%->18.3%, Breacher
  25.7%->27.3%) -- bounded and sane, exactly what changing one of three
  layer-4 gatekeepers should do to a full-run number.

**Real methodological finding, surfaced while trying to check this
against the "StS 9-15% band" target from session 39's own close-out**:
that band is now **stale and not directly comparable** to a plain
`scripts/sweep.ts run` call. It was calibrated against `sweep.ts`'s
*old* default (`playCombat`'s dumb floor baseline for the player) --
commit `e3b3727`, later the same session, changed that default to
`playerSkill=0.85` (matching `gatekeeper-check.ts`'s own convention,
motivated by the pure-Cribbage skill calibration work), so an unflagged
`sweep.ts run` today measures a materially easier scenario (smart player)
than the one the 9-15% band was set against -- not a regression, a
retroactive change in what the same command measures. Confirmed by
running the pre-Null-Session-change codebase (`git stash`) at
`--seeds=300`: 25.7-30.0% across classes, matching the *ablation audit's*
own Table 1 baseline (~25.78% avg) almost exactly, not the close-out's
~12.23% avg. **Not resolved here** -- whether to recalibrate a new target
band under the current player-skill-aware default, or drop the
fixed-band framing in favor of paired before/after comparisons (what
this checkpoint used instead), is its own open question, flagged for the
user rather than assumed.

573/573 tests passing (from 572, one test rewritten -- session 40's own
"every gatekeeper leaves both overrides unset" regression guard correctly
started failing the instant Null Session got a real value, split into a
Null-Session-specific assertion plus an "every other gatekeeper still
unset" guard for the rest of the pass), `npm run check` clean.

**Next**: layer 2 (Incident Response too hard vs. Quarantine Ward/
Zero-Sum too easy) is next per the audit's own order, or Kernel Panic's
harder, differently-scoped fix, or the stale-band question above -- ask
rather than assume, same as every prior fork in this project.

**Phase 4 is complete** (session 22, all 6 checkpoints), and the
Breach/Containment combat model has since been redesigned (session 22+,
see Phase 5 below) — a single shared zero-sum scalar replaced with two
independent per-side gauges, plus escalation (shrinking win-gauge
thresholds after 100 hands) and a real empirical enemy-magnitude retune
against the new model. Result: the test suite runs in under a second
(was several minutes), and the balance sweep now shows a genuinely
competitive 28.2% victory rate for Breacher (was 100%, and before that
3.8% under the pre-Phase-4 baseline). A follow-up all-6-class sweep
(session 23, see Phase 5 below) found that competitiveness is nowhere
near even across classes: Warden 88.4% down to Operator/Ghost 0.0%,
splitting cleanly along "two gauge-touching archetypes" vs. "one
offense archetype + Root" starting kits.

**Session 24 investigated the Root half of that gap directly** (see
Phase 5 below for the full writeup): Root's payloads turned out to have
zero decision-making surface at all (every target/action was fixed at
authoring time), and `peekCrib` was a genuinely broken no-op independent
of any AI. Root got a real mechanical redesign -- recon (reveals real
data at the right Cribbage lifecycle moment), surgical manipulation
(adversarially forces a specific card), and haste (completing the
slow/haste pair) -- built on a new `firesAt` hand-lifecycle firing
mechanism and a shared `ai.ts` weighted-scoring module. This closes the
mechanical gap, but **does not yet show up in any balance sweep**: the
baseline scripted strategies don't consume any of the new context
fields recon populates, so Root's actual value is still unmeasured.
**Session 24 also finished the skill-dial AI and re-swept** (see Phase 5
below for the full writeup) -- and the result reframes the whole
balance picture, not just Root's. Even the AI's weakest ("novice")
setting collapses win rates that looked healthy under the old dumb
baseline: Warden 88.4%→46.4%, Breacher 28.2%→0.2%, Blackhat 51.2%→8.4%.
Going from novice to expert barely moves those numbers further --
almost all the damage comes from the enemy simply playing *competent*
Cribbage at all (exact hand-value/immediate-score optimization),
independent of the secondary crib-awareness/defensive/setup
refinements. Saboteur/Operator/Ghost sit at exactly 0.0% at every enemy
skill level tested (0, 0.5, 1.0) with the player still on the old dumb
baseline -- and a same-day follow-up giving the *player* side expert
play too confirms it conclusively: Warden/Blackhat/Breacher recover
substantially (Warden back to ~85%), but Operator/Ghost stay at exactly
0.0% and Saboteur barely clears 0% regardless of which side is smart.
Root's weakness is a real, structural class-kit gap (Root never touches
the win gauge), not an artifact of a fair fight against a strawman on
either side.

**Session 25 closed the Root-class half of that gap** (see Phase 5
below for the full writeup): Sleeper Cell, Primed, and Return to
Sender were reworked -- two of the three (Sleeper Cell, Return to
Sender) had trigger conditions unreachable from their own class's
starting kit, and none of the three touched the win gauge with real,
repeated force. Re-swept with the tunable-skill AI immediately after:
Saboteur went from a hard 0.0% to ~30% (baseline player) / ~74-78%
(expert player); Ghost went from 0.0% to ~28-33% / ~55-61%; Operator
moved off zero but only to ~4.7% / ~25-27%, the smallest gain of the
three and worth a closer look. Warden/Blackhat/Breacher are unchanged,
as expected. A new, real side finding: with a genuinely competent Ghost
now contesting instead of never progressing at all, a small fraction of
fights (4-6%) take long enough to exceed the fixed 5000-hand cap --
never happened before, since one-sided attrition always resolved fast.

**The actionable takeaway for next session**: every enemy-magnitude
number tuned so far (checkpoint E of the Breach/Containment redesign,
session 22+) was calibrated against a Cribbage-incompetent opponent --
Cribbage-play quality turns out to matter as much as or more than
loadout magnitude. A real balance/tuning pass now needs to pick a
target enemy skill level *and* retune magnitudes together, not
magnitude alone -- picking that skill level per enemy tier was always
flagged as a separate follow-up decision (decision 3, session 24), and
this sweep is the data that decision needs. Operator's still-weak
number after its own rework suggests it may need more than the current
TBD/playtesting placeholder magnitude. The per-layer difficulty ramp
(still one flat enemy tier regardless of layer), the new occasional-
non-resolution finding above, the zero-progress-deadlock/sudden-death
question, and the human-vs-AI architecture question (banked, Phase 0)
all remain open too.

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
- ~~Banked idea: bypass a closed/lost node~~ — done, session 36: resolved
  as a map-context Burner effect (reopening a closed node) rather than a
  passive/ability — see `DESIGN.md`'s new "Burners" subsection under
  Meta-Progression.
- **Banked idea, not yet designed**: higher tiers of Root's
  `forceDiscardCard` manipulation (session 24, Root mechanical redesign
  checkpoint D -- see `ai.ts`'s `bestCardToForce`) could force the
  selection of *both* discarded cards, not just one with the target's
  own best companion left intact -- a stronger, rarer version of the
  same mechanic. Noted session 24, content-authoring work for a later
  pass, not a new engine capability (the underlying adversarial scoring
  already generalizes to picking a full pair).
- **Banked architecture question, not yet designed**: real human-vs-AI
  play needs the engine's orchestration itself to become resumable at
  each individual decision point, not just a smarter decision-maker.
  Every `DiscardStrategy`/`PlayStrategy` call today (`deal.ts`/
  `pegging.ts`) is synchronous -- `playPegging`/`discardToCrib` call it
  inline and expect a card back immediately, which works for AI-vs-AI
  but has no way to represent "pause and wait for a human's click."
  Session 24's per-side strategy threading (tunable-skill AI checkpoint
  A) doesn't touch this -- both sides still have to answer instantly,
  they just no longer have to be the *same* function. Solving it for
  real means the loop currently inside `playPegging`, and `combat.ts`'s
  hand-lifecycle sequence, need to become externally pausable/resumable
  wherever a human is involved, not just `ai.ts`'s scoring getting
  smarter -- a distinct UI/engine-boundary redesign, not an extension of
  the current skill-dial work (whose scoring logic stays equally useful
  either way, since it doesn't care who calls it or when). Raised
  session 24 while mid-scoping the skill-dial AI's real-player use case.
- **Banked for a balancing pass, not yet implemented**: Feedback Loop
  (Warden) may be too strong -- two ideas raised session 25 while
  reworking the three Root-paired classes' passives, neither
  implemented:
  - Gate it to only trigger while the caster is this hand's dealer.
  - A different mechanism entirely, raised after noticing the reworked
    Return to Sender (session 25) now also hooks HoT ticks, overlapping
    conceptually with Feedback Loop: instead of HoT ticks directly
    crediting a flat bonus to Warden's own gauge, make HoT and
    Malware's DoT reciprocally amplify each other's *magnitude* --
    every HoT tick increases the magnitude of the caster's next DoT
    tick, and every DoT tick increases the magnitude of the caster's
    next HoT tick. Self-reinforcing, but requires actually sustaining
    both archetypes' ticking to keep the loop going, rather than a flat
    per-tick bonus regardless of anything else -- likely a genuine
    power-level difference, not just a re-flavoring, so it'd need its
    own empirical sweep check, same as the Root-class rework got.
- **Resolved session 27** (`/decision-session`, full writeup in
  `DESIGN.md`'s new "Enemy Design" section): both banked items above --
  enemy loadout variation and the fight-kind-vs-layer skill-scaling
  question -- are now a real spec. See Phase 5's "Enemy Library" spec
  below for the checkpointed implementation plan.

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
and the **expanding in-run passive-item pool**, now named **Mods**. Mods'
*shape* is designed as of session 30 (see `DESIGN.md`'s new "Mods"
subsection) — its hook-point catalog and content library are still
future work, see the session 30 write-up near the end of this section.
Ascension remains genuinely undesigned and still needs its own
`/decision-session` before it's implementation-ready.

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

---

**Superseded by the Breach/Containment redesign (session 22+).** Both
open findings above (the escalation-effect suggestion, and "enemy
magnitudes need real tuning distinct from the test suite's time
budget") led to a structural redesign rather than incremental tuning:
Breach/Containment moved from one shared, zero-sum scalar to two
independent per-side gauges (each side races toward its own win, filled
only by its own offense) — see the engine's own `gauges.ts`/`resolve.ts`
headers for the full mechanical shape. This is what the sharp
positive-feedback chaos and stalemate risk actually traced back to, not
just untuned numbers.

**Checkpoint A/B result**: the full 351-test suite now runs in under a
second (previously several minutes, dominated by `run.test.ts`'s real-
class-kit integration tests). An empirical enemy-magnitude sweep against
Breacher's real starting kit (checkpoint E) found a wide, *smoothly
monotonic* competitive zone — win rate falls from 100% to 0% gradually
across amount 6-13 — a sharp contrast to the old model's narrow, chaotic
band. Escalation (shrinking win-gauge thresholds after 100 hands) is
built and did its job in testing, but also surfaced a real remaining
gap: a defense-heavy loadout (many stacked Ward shields) can still
produce a genuine *zero-progress* deadlock that pure threshold-shrinking
can't rescue (confirmed via the full Encryption archetype pool vs. a
weak opponent in `subroutines.test.ts`) — the plan's own anticipated
"if shrinking thresholds alone isn't enough, add sudden-death"
contingency is a live possibility, though not urgent yet (that specific
case is a more extreme matchup — 15 pieces vs. one weak opponent — than
any real installed loadout, capped at 6, would produce).

**Checkpoint E balance sweep**: re-ran the same `playRun()` 500-seed
measurement with the retuned magnitudes (regular=9/elite=10/
gatekeeper=11 directBurst, winThreshold=50) — **28.2% victory**, 61.4%
quarantined, 10.4% no route remains, averaging 1.33/4 layers cleared.
Genuinely competitive: real risk at every stage, real chance of full
victory, nothing like the prior 100% or the original 3.8%. Sweep runtime
also worth noting on its own: 623ms for 500 seeds, versus tens of
minutes under the old model.

**What's still open, unchanged by this redesign**: no per-layer
difficulty ramp exists yet (`ENEMY_LOADOUT_GATEKEEPER` is one flat
constant regardless of which of the 4 layers you're on) — worth
revisiting now that a single-layer baseline is actually competitive,
since a real ramp would need each successive layer to ask more than a
flat 76%/38%/20% split provides. Only Breacher was swept; the other 5
classes, especially Ghost, remain unmeasured.

**All-6-class balance sweep (session 23)** — same `playRun()`
methodology (500 seeds, `beelineToGatekeeper`, default settings), one
sweep per class against the checkpoint-E enemy tuning (which was only
ever calibrated against Breacher's kit):

| class     | victory | quarantined | noRouteRemains | heatMaxed | avg layers |
|-----------|---------|-------------|-----------------|-----------|------------|
| warden    | 88.4%   | 10.4%       | 1.2%            | 0.0%      | 3.66       |
| blackhat  | 51.2%   | 37.6%       | 7.4%            | 3.8%      | 2.55       |
| breacher  | 28.2%   | 61.4%       | 10.4%           | 0.0%      | 1.33       |
| saboteur  | 1.0%    | 69.0%       | 30.0%           | 0.0%      | 0.09       |
| operator  | 0.0%    | 67.8%       | 32.2%           | 0.0%      | 0.00       |
| ghost     | 0.0%    | 67.8%       | 32.2%           | 0.0%      | 0.00       |

A much bigger spread than expected — not just "Ghost is hardest" (the
one outcome DESIGN.md actually predicted), but a near-total split: the
three classes pairing *two* gauge-crediting/suppressing archetypes
together (Warden = malware+encryption, further reinforced by Feedback
Loop's own passive; Blackhat = exploit+malware, two direct-offense
archetypes stacked; Breacher = exploit+encryption, offense +
suppression) all clear at least one layer routinely, while the three
pairing a single offense archetype with Root (which by design never
touches either gauge — pure denial/tempo) are barely functional at
all: Operator (exploit+root) and Ghost (encryption+root, the known
zero-direct-damage case) never won a single run in 500 seeds and
average essentially zero layers cleared, and Saboteur (malware+root)
is only marginally better. This reads as a real, class-structural
finding, not a seed artifact or noise — likely because the checkpoint-E
enemy retune (regular=9/elite=10/gatekeeper=11) was swept and tuned
against Breacher specifically, and a lone offense archetype's 3-piece
starting kit isn't enough magnitude against those numbers on its own,
with Root's pieces contributing nothing toward closing out the gauge
race. Root's own value proposition (denial/tempo/enemy-directed
effects) may be real in a longer run with a grown loadout, just not
from a bare 3-piece starting kit against a fixed enemy tier — worth
distinguishing "Root needs its own magnitude tuning" from "Root-paired
classes need a different early-game answer" before touching numbers.
Not fixed here — this is the measurement Phase 5 asked for, landing
before any of Phase 5's tuning work rather than during it, so the tuning
pass has real per-class numbers instead of Breacher's alone to work
from.

---

**Root mechanical redesign (session 24).** Before concluding Root
itself needs a magnitude buff for the session 23 finding above, the user
asked whether a tunable-skill Cribbage AI (originally scoped as its own
`/decision-session`) should come first, since every fight so far --
including every sweep in this file -- is played against a fixed,
unskilled scripted opponent. That AI-scoping session surfaced a deeper
problem before it got very far: **Root's payloads have zero decision-
making surface at all** -- every target/action is fixed at authoring
time (`subroutines.ts`), so a "skilled" vs. "unskilled" caster produces
identical Root outcomes today. No AI-skill work could make Root's value
measurable without Root first having real choices to make. Separately,
`peekCrib` turned out to be a genuinely broken no-op independent of any
AI: it resolves via the same "queued this hand, applied next hand"
pathway as `forceDiscard`/`skewCut`, but by the time it applies, the
only crib that exists (the previous hand's) has already been fully
scored -- there was never any information left to reveal.

The session pivoted into redesigning Root directly, in 8 checkpoints
(commits `54ef978` through `2c3babf`, plan tracked live via
`/decision-session`):

- **A** -- `src/engine/ai.ts`, a shared weighted-scoring heuristic
  module: exact hand-EV over all unseen starters, plus a crib-EV factor
  (exact once the crib's other half is known, else a simple proxy)
  signed by whose crib it is. Built to be reused both by a future
  discard AI and by Root's own adversarial targeting below -- same
  math, pointed at either side.
- **B** -- the big regression-risk checkpoint: `combat.ts` stopped
  calling `game.ts`'s `playOneHand` as one opaque step and now
  orchestrates `deal`/`discardToCrib`/`cut`/`playPegging`/
  `countHandEvents`/`countCribEvents` directly, opening three real
  firing gaps within a hand (post-deal, post-crib-selection, post-cut)
  where a new orthogonal `SubroutineDefinition.firesAt` field lets a
  subroutine fire outside the normal turn-gate, at one of three real
  Cribbage lifecycle moments. `DiscardStrategy`/`PlayStrategy` moved
  from positional params to context objects
  (`DiscardContext`/`PlayContext`) so new intel sources become new
  optional fields, not more positional params. Verified via a dedicated
  byte-for-byte replay test proving the decomposition changed nothing
  when no `firesAt` content exists (which was true until checkpoint F).
- **C** -- three recon payloads (`revealOpponentHand`,
  `revealCrib`, `revealOpponentKeptHand`), one per lifecycle moment,
  each revealing genuinely different intel (the earlier/bigger the
  moment, the more is visible) into the caster's own future
  discard/pegging context.
- **D** -- `forceDiscardCard`, a surgical manipulation payload. Its
  targeting (`ai.ts`'s `bestCardToForce`) is a real adversarial
  minimax-lite: for each candidate forced card, assumes the opponent
  picks their own best companion discard, then picks whichever forced
  card minimizes that best-achievable outcome -- the card whose loss
  hurts them most even under their own optimal counter-play, not just
  their single highest-value card in isolation. Needs no recon
  prerequisite: payload resolution is engine code with full state
  access already, unlike a strategy function.
- **E** -- haste (`instantManipulation` targets `ownGauge`/
  `ownGaugeThreshold`), completing the slow/haste pair the existing
  `enemyGauge`/`enemyGaugeThreshold` targets only half-covered.
- **F** -- retrofitted 6 existing Root pool pieces onto the new
  mechanics (Idle Scan/Directory Traversal/Backchannel to recon,
  Packet Sniffer/DNS Poisoning to haste, Zero-Knowledge Exploit to
  `forceDiscardCard`), each keeping its original trigger as the
  `firesAt` readiness gate. Full System Compromise deliberately kept
  the old blunt `forceDiscard` -- its chained-after-cron-job trigger
  doesn't work as a `firesAt` gate (hand-lifecycle moments aren't
  "anyone's turn," so within-turn chaining doesn't apply there), and
  the blunt/surgical split is real content variety, not redundancy.
  Starting loadouts (the 18 class-specific pieces) were deliberately
  left untouched -- lower risk, and the pool was enough to prove the
  mechanics work with real content.
- **G/H** -- closed the last verification gap (recon reaching real
  `PlayContext` for all three moments, not just deal-time) and this
  writeup.

**What this does and doesn't prove.** Every new mechanic is
correctness-verified at the unit and end-to-end level (388 tests, up
from 351 at session 23's start) -- recon payloads correctly populate
context fields at the right hook, `bestCardToForce` correctly
identifies and forces the opponent's most valuable card, haste
correctly banks and releases initiative-gauge overflow. What it
deliberately does **not** do is show up in a balance sweep: the
baseline scripted strategies (`discardLowestTwo`/`playLowestLegal`)
don't read any of the new context fields at all, so Root's real value
is still unmeasured by every sweep in this file, including session 23's
above. That measurement needs the discard/pegging skill-dial AI
(paused mid-scoping when this gap surfaced) to actually exist first --
it reuses `ai.ts` directly rather than building its own scoring, so
this session's work is a direct prerequisite, not a detour. A banked
content idea surfaced mid-session: higher tiers of `forceDiscardCard`
could force the selection of both discarded cards, not just one with
the opponent's best companion left intact -- noted in Phase 0's
banked-idea list, not built.

---

**Tunable-skill AI + enemy-skill balance sweep (session 24,
continued).** Resumed right after the Root redesign above, since a real
chunk of the original plan (the `ai.ts` scoring primitives, the
`DiscardContext`/`PlayContext` shape) had already landed as a side
effect. Five more checkpoints (commits `1455338` through the sweep
writeup below):

- **A** -- `CombatOptions`/`RunOptions` gained `discardStrategies`/
  `playStrategies` as `[X, X]` tuples instead of one shared value,
  threaded from `combat.ts` through `run.ts` and `encounters.ts` (test-
  only escape hatch, same treatment as `installedLoadoutOverride`) down
  to `pegging.ts`'s `playPegging`, which now dispatches to
  `playStrategies[currentPlayer]` with that side's own recon context
  instead of always side 0's.
- **B** -- a real pegging AI: `ai.ts` gained immediate-score (reusing
  `pegging.ts`'s scoring rules, exported as `scoreCardPlay`), defensive-
  risk (a flat penalty for leaving the count at 5 or 21), and setup-
  value factors, skill-interpolated between novice/expert weight
  vectors. `pegSkillStrategy(skill)`.
- **C** -- a real discard AI: `scoreDiscard`'s fixed crib weight became
  a skill-interpolated pair (defaulting to the old fixed behavior, so
  Root's `bestCardToForce` is unaffected). When the opponent's hand is
  known (recon), a new `predictBestDiscard` predicts their likely
  discard and feeds it into the crib-EV calculation as a real
  prediction instead of the blind proxy -- naturally gated by the skill
  dial itself (crib weight is 0 at skill=0, so even a perfect
  prediction contributes nothing). `discardSkillStrategy(skill)`.
- **D** -- the sweep this was all built for.

**Sweep results** -- same `playRun()` methodology as every prior sweep
(500 seeds, `beelineToGatekeeper`, default settings), player side held
at the existing baseline (`discardLowestTwo`/`playLowestLegal`), enemy
side swept across 3 skill levels:

| class     | skill 0 | skill 0.5 | skill 1 | (session 23, skill n/a) |
|-----------|---------|-----------|---------|--------------------------|
| warden    | 46.4%   | 41.8%     | 44.0%   | 88.4%                    |
| blackhat  | 8.4%    | 5.4%      | 6.0%    | 51.2%                    |
| breacher  | 0.2%    | 0.8%      | 0.2%    | 28.2%                    |
| saboteur  | 0.0%    | 0.0%      | 0.0%    | 1.0%                     |
| operator  | 0.0%    | 0.0%      | 0.0%    | 0.0%                     |
| ghost     | 0.0%    | 0.0%      | 0.0%    | 0.0%                     |

Two findings, and the first was genuinely unexpected:

**1. "Novice" is much stronger than intended, and skill barely matters
on top of it.** The novice weight vector (hand-value/immediate-score
only, no crib-awareness/defense/setup) was meant to represent weak
play. Instead, because it still computes *exact* hand-EV and *exact*
immediate pegging scores over every candidate, it already crushes the
old baseline (`discardLowestTwo` sorts by rank; `playLowestLegal` sorts
by value -- neither optimizes for points at all). Going from novice to
expert then barely moves the numbers further (Warden: 46.4%→41.8%→
44.0%; Breacher: 0.2%→0.8%→0.2%, noise-level). The real cliff is
"optimizes for points at all" vs. "doesn't" -- the secondary
refinements this session added (crib-awareness, defensive risk, setup
value) matter far less than getting baseline competence right. Not
fixed here (decision 3 explicitly deferred picking real skill values to
a later tuning pass) -- flagged because it means the novice/expert
*weight values themselves*, not just which skill level ships, are a
real open tuning question, and a true "plays randomly badly" floor
would need a different mechanism entirely (mistake-injection or a
literal `discardLowestTwo`-style tier) if a softer difficulty floor
turns out to be wanted.

**2. Root-paired classes' weakness is confirmed structural, not a
measurement artifact.** Saboteur/Operator/Ghost sit at exactly 0.0%
victory at *every* tested skill level, novice through expert. This is
the direct answer to the question that started this whole investigation
(is Root's value being measured fairly): yes, now that it can be
measured at all (the mechanical redesign) and against a real range of
opponent competence (this sweep) -- and the answer is these three
classes' problem isn't about the opponent, it's that a single offense
archetype's 3-piece starting kit paired with Root (which never touches
the win gauge) doesn't have enough magnitude to close out a race against
*any* competent opponent. That's real information for the eventual
per-class tuning pass: more Root magnitude/mechanical reach, not
"wait for a weaker enemy," is what these classes need.

**What this means for enemy tuning going forward**: every magnitude
number tuned so far (checkpoint E of the Breach/Containment redesign)
was calibrated against Cribbage-incompetent play. This sweep shows
Cribbage-play quality moves the needle as much as or more than loadout
magnitude does -- Warden alone survives competent play reasonably
intact; everyone else collapses. A real balance pass needs to pick a
target enemy skill level and retune magnitudes *together* against it,
not magnitude alone against the old dumb baseline. Deliberately not
done here (decision 3) -- this sweep is the data that decision needs,
not the decision itself.

**Follow-up: does player skill also matter, not just enemy skill?**
The sweep above held the *player* side at the old dumb baseline the
whole time -- a natural follow-up question is whether Saboteur/
Operator/Ghost's 0.0% is itself an artifact of *that*, not of Root.
Re-ran the same grid with the player also at expert (skill=1):

| class     | enemy 0 | enemy 0.5 | enemy 1 |
|-----------|---------|-----------|---------|
| warden    | 85.6%   | 84.4%     | 85.6%   |
| blackhat  | 39.8%   | 36.8%     | 34.2%   |
| breacher  | 19.2%   | 17.2%     | 16.6%   |
| saboteur  | 0.4%    | 0.2%      | 0.4%    |
| operator  | 0.0%    | 0.0%      | 0.0%    |
| ghost     | 0.0%    | 0.0%      | 0.0%    |

A competent player dramatically rescues the gauge-touching classes --
Warden climbs back to nearly its original 88.4% (session 23) baseline,
Blackhat and Breacher recover substantially from checkpoint E's
near-zero numbers. Operator and Ghost stay at **exactly 0.0%** no
matter which side is smart; Saboteur barely clears 0% (0.2-0.4%). This
closes the question conclusively: it was never an opponent-difficulty
artifact *or* a player-skill artifact -- better play on either side
can't manufacture wins these classes' kits don't have the raw magnitude
to reach. Better card selection improves the odds of a good board
state; it doesn't create more magnitude, and magnitude (or some other
mechanical reach for Root, e.g. genuinely stronger recon/manipulation
content) is what these three classes are actually missing.

---

**Root-class starting passives rework + re-sweep (session 25).** Direct
follow-up to the conclusion above: the user likes Root's design as-is
and wanted the fix to land at the starting-passive layer specifically --
rework Saboteur/Operator/Ghost's passives to hit harder than the other
three classes' and to better enable each class's build theme, resolved
live via `/decision-session` (commits `3f2c078` through the docs
commit closing this session).

**A reachability finding surfaced before any magnitude work started**:
checking each Root-paired passive's trigger against its own class's
actual 3-piece starting kit found two of the three were structurally
unreachable, not just weak. Sleeper Cell needed "first Malware
*debuff*," but Saboteur's only starting Malware piece (Silent Worm) is
a DoT, not a debuff. Return to Sender needed a Ward shield to absorb
something, but none of Ghost's 3 starting pieces (Null Session, Kill
Switch, Low Profile) ever casts Ward -- completely inert until a Ward
piece was acquired mid-run, the most severe gap of the three. Only
Primed (Operator) was actually reachable turn one already (Ping Sweep
is `always`-triggered Root).

**The rework, one checkpoint per class** (all persistent now, none
one-shot):
- **Sleeper Cell** (Saboteur): broadened to fire from either a Malware
  debuff *or* a Malware DoT tick (fixes the reachability gap), and now
  credits win gauge directly alongside the existing Root-progress-
  advance effect.
- **Primed** (Operator): every Root fire now boosts the caster's next
  Exploit fire's *magnitude* (via `merge.ts`'s `improvedPayloadMagnitude`,
  exported and reused rather than reimplemented) in addition to the
  existing trigger-ease -- "Root primes the field" now means the strike
  lands bigger, not just sooner.
- **Return to Sender** (Ghost): kept the Ward-absorb hook, added two
  more reachable ones sharing the same ratio -- `instantCounterPush`
  (reachable turn one via Null Session) and HoT ticks (Ghost has none
  today, but HoT is Encryption -- Ghost's own archetype -- so it pays
  off once one is acquired).

Validated against each class's real starting kit (not synthetic test
fixtures): Ghost's kit, with the reworked passive active, now wins
outright in the *exact same scenario* an existing test had already
proven was structurally impossible before (own gauge stuck at exactly
0, forever) -- the cleanest before/after contrast of the three, since
Ghost had zero win-gauge access at all without it. Saboteur/Operator
already had some access (Silent Worm's DoT, Precision Strike's
piercing) and win measurably faster with their passives active, rather
than going from impossible to possible.

**Re-swept immediately after** with the tunable-skill AI from session
24 (same methodology, `playRun()`, `beelineToGatekeeper`; reduced to
150 seeds from 500 after a naive first attempt at 500 exhausted the
Node heap -- non-resolving seeds each retain a full 5000-hand array
until GC, and enough of them back-to-back added up):

| class | session 24 (enemy 0/.5/1, player baseline) | session 25 post-rework | session 24 (player expert, enemy 0/.5/1) | session 25 post-rework |
|---|---|---|---|---|
| warden | 46.4/41.8/44.0% | 47.3/44.7/48.0% (unchanged) | 85.6/84.4/85.6% | 83.3/80.0/83.3% (unchanged) |
| blackhat | 8.4/5.4/6.0% | 10.7/6.0/6.0% (unchanged) | 39.8/36.8/34.2% | 38.0/36.7/36.0% (unchanged) |
| breacher | 0.2/0.8/0.2% | 0.7/0.7/0.0% (unchanged) | 19.2/17.2/16.6% | 19.3/19.3/17.3% (unchanged) |
| **saboteur** | **0.0/0.0/0.0%** | **30.7/29.3/30.0%** | **0.4/0.2/0.4%** | **78.0/73.3/74.0%** |
| **operator** | **0.0/0.0/0.0%** | **4.7/4.7/4.7%** | **0.0/0.0/0.0%** | **27.3/24.7/24.7%** |
| **ghost** | **0.0/0.0/0.0%** | **31.3/28.0/32.7%** | **0.0/0.0/0.0%** | **54.7/57.3/60.7%** |

Saboteur and Ghost went from a hard, unconditional 0% to genuinely
competitive -- Saboteur with a skilled player is now among the
strongest classes in the roster, on par with Warden/Blackhat. Ghost
lands solidly mid-pack. **Operator moved off zero but by far the
smallest margin of the three** (4.7% baseline, ~25-27% with a skilled
player, still clearly the weakest class) -- worth a closer look before
assuming its rework is proportionate to the other two; the magnitude
bonus on a single Exploit piece's *next* fire may just need to be
bigger, or Operator may need a second look at its build theme
("setup-and-strike") entirely.

**A new, real side finding, not a bug**: in the player-expert grid,
Ghost now shows a small `didNotResolve` rate (4-6%) that didn't exist
in session 24's sweeps. This is the flip side of Ghost finally being
able to contest -- some fraction of fights are now genuinely close,
slow-converging races instead of one-sided attrition where the outcome
was never in doubt, and occasionally exceed the fixed 5000-hand cap
(`FIGHT_MAX_HANDS`, `encounters.ts`). Worth revisiting alongside
Operator's still-weak number in the next tuning pass -- either the cap
needs to grow now that fights can be genuinely close, or this is exactly
the kind of case the deferred sudden-death fallback (Breach/Containment
redesign, session 22+) was meant for.

Not a magnitude/balance pass -- every new constant introduced this
session (`SLEEPER_CELL_CREDIT_AMOUNT`, `PRIMED_MAGNITUDE_BONUS`, and
the existing `RETURN_TO_SENDER_RATIO` reused for two new triggers) is a
TBD/playtesting placeholder, same discipline as every other numeric
constant in this project. This sweep is the empirical grounding the
next tuning pass needs, not the tuning pass itself.

---

**Race-to-121 AI-skill cross-matrix (session 26): confirms and
quantifies session 24's "novice is much stronger than intended" finding
directly, with the combat/win-gauge layer removed entirely.** Session
24's original sweep held enemy skill fixed while sweeping 0/0.5/1 and
found the numbers barely moved (Warden 46.4%->41.8%->44.0%, etc.),
flagging that the *weight values themselves*, not just which skill
level ships, were an open question -- but that measurement still ran
through the whole win-gauge/escalation apparatus, leaving room to
wonder whether some of the flatness was a combat-layer artifact rather
than a real property of the AI itself. This session isolated the
question: a scratch driver (`game.ts`'s primitives -- `deal`,
`discardToCrib`, `cut`, `playPegging` -- plus `triggers.ts`'s
`occurrenceFromHisHeels`/`occurrencesFromPeggingEvent`/
`occurrencesFromHandEvents` for real mid-hand stop-the-instant-someone-
hits-121 semantics, since neither `game.ts`'s `playHands` nor
`combat.ts` had ever built a real race-to-121 driver before) played
every pairing of {the old `discardLowestTwo`/`playLowestLegal`
baseline, skill 0, skill 0.5, skill 1} against every other, 500 seeds
each, straight Cribbage with no Breach/Containment involved at all:

| (row = side 0) | baseline | skill 0 | skill 0.5 | skill 1 |
|---|---|---|---|---|
| baseline | 57.6% | 6.0% | 4.8% | 4.8% |
| skill 0 | 97.8% | 55.6% | 48.8% | 49.8% |
| skill 0.5 | 98.4% | 59.6% | 54.4% | 54.8% |
| skill 1 | 98.4% | 60.0% | 53.6% | 53.4% |

The diagonal (identical strategy vs. itself) sits at a plausible
53-58% for side 0, who deals the first hand -- consistent with
Cribbage's small, well-known first-dealer edge, confirming the driver
itself is sound (an earlier, buggy version that summed a whole hand
before checking for 121, instead of stopping the instant a score is
reached mid-hand as real rules require, produced an implausible 66/34
split here and was caught and fixed before trusting any of this).

Two findings, and the second is the sharper, cleaner version of session
24's own: **(1)** any point on the skill dial beats the old baseline
94-95% of the time -- a real, enormous effect, confirming "optimizes
for points at all" is genuinely powerful. **(2)** skill 0 vs. skill 1
is 49.8% -- a coin flip -- and every cell in the skill-vs-skill 3x3
block sits in the same 48-60% noise band as the identical-strategy
diagonal. Novice and expert are not meaningfully different opponents in
real head-to-head play once you're past the baseline cliff. This is
because of *how* the dial works, not a tuning-value accident: looking
at `ai.ts`'s weight vectors directly, `DISCARD_NOVICE_WEIGHTS.handValue`
and `DISCARD_EXPERT_WEIGHTS.handValue` are both 1 (never interpolated),
and likewise `PEG_NOVICE_WEIGHTS.immediateScore` /
`PEG_EXPERT_WEIGHTS.immediateScore` are both 1 -- the skill dial only
ever interpolates the *secondary* refinement terms (crib-awareness,
defensive risk, setup value). The *dominant* term -- exact hand-EV over
every unseen starter, exact immediate pegging score -- runs at full,
uncompromised strength at every skill level, including 0. That's
exactly why "novice" already crushes the baseline (it's still a
near-perfect card-value optimizer) and why novice-to-expert barely
separates (the only thing skill ever touches is a small bonus layered
on top of an already-optimal pick).

**Recommendation for real range**: don't keep tuning the secondary
weights harder -- that band is provably narrow regardless of their
exact values, since the primary term dominates the ranking at every
skill level. Two changes, complementary rather than either-or:

1. **Interpolate the primary weight too** (`handValue`/
   `immediateScore` down from 1 at skill 0, not fixed at 1 for both
   ends) -- cheap, surgical, no architecture change, and would
   immediately open some real separation. On its own this likely just
   reproduces something closer to the existing dumb baseline at
   skill=0, which may or may not be the intent.
2. **Real mistake-injection**, the mechanism this project's own
   session-24 write-up already anticipated needing ("a true 'plays
   randomly badly' floor would need a different mechanism entirely").
   Concretely: instead of always picking the argmax candidate, sample
   from a softmax/Boltzmann distribution over candidate scores with a
   temperature that's high (near-random pick among all legal
   candidates/discard pairs) at skill 0 and near-zero (today's
   deterministic argmax) at skill 1. This is the standard way game AI
   research handles a skill dial (weakening the *decision procedure*,
   not just which factors it considers) and would produce a smooth,
   wide curve instead of the current narrow band. The real cost: today
   `DiscardStrategy`/`PlayStrategy` are pure functions with no RNG
   access (`deal.ts`/`pegging.ts`), so this needs a seeded RNG threaded
   into both signatures -- a real, moderate change, not a weight tweak,
   and the same underlying gap the banked "human-vs-AI resumability"
   architecture note (Phase 0) already flagged about these strategies'
   synchronous, context-only shape.

Not implemented -- this sweep is the empirical case for *why* the next
AI-tuning pass needs to change the mechanism, not just the numbers,
same "grounding, not the tuning pass itself" discipline as every other
sweep this project has run.

---

**AI skill-dial range expansion, implemented (session 26 continued).**
Both recommendations above, built per a live-scoped plan (5 checkpoints,
commits `68415dd` through the sweep re-run below).

- **A** -- interpolated the primary weight term too
  (`DISCARD_NOVICE_WEIGHTS.handValue`/`PEG_NOVICE_WEIGHTS.immediateScore`,
  both 1->0.4). Verified via the race-to-121 harness to be a pure
  no-op *on its own*: argmax is provably invariant to uniform positive
  rescaling of a single nonzero term, and novice's other weights are
  still 0, so this constant change can't move anything until it has a
  temperature to interact with. Not wasted -- kept for checkpoint C/D
  to build on (`P(i) ~ exp(score_i / T)` is *not* scale-invariant, so
  a smaller primary weight flattens the resulting distribution, acting
  like a larger effective temperature).
- **B** -- RNG-threading plumbing, `rng.ts`'s new `deriveAiNoiseSeed`
  gives AI-decision noise its own stream, fully decorrelated from the
  one driving shuffles/cuts (sharing one stream would mean any future
  change to how often the AI "rolls dice" shifts every subsequent
  deal/starter draw, breaking fixed-seed test assertions elsewhere).
  `DiscardContext`/`PlayContext` gained an optional `rng?: Rng` field,
  matching their own established "new intel source, new optional
  field" extension pattern rather than a new factory parameter --
  keeps every pre-session-26 caller (including tests that build bare
  context objects with no `rng` field) byte-identical by construction.
  Verified: full suite passes unchanged.
- **C/D** -- real mistake-injection via `softmaxPick` (`ai.ts`):
  Boltzmann sampling over candidate scores at a skill-interpolated
  temperature (`PEG_MAX_TEMPERATURE=3`, `DISCARD_MAX_TEMPERATURE=4`,
  separate constants -- pegging-candidate and discard hand-EV scores
  are on different numeric scales), degenerating to exact argmax at
  temperature 0 (skill 1, or whenever `ctx.rng` is absent). Verified:
  with a seeded `ctx.rng`, skill 0 picks a demonstrably non-optimal
  candidate at least sometimes across 200 draws; skill 1 stays
  deterministic regardless of whether `ctx.rng` is supplied.
- **E** -- re-ran the exact race-to-121 cross-matrix from the finding
  above, now with the driver actually threading an `aiRng` through
  (the harness itself needed updating -- without a real `ctx.rng`
  supplied, the new mechanism never activates and everything looks
  unchanged, which is worth remembering for any future measurement
  that reuses `discardSkillStrategy`/`pegSkillStrategy`):

| (row = side 0) | baseline | skill 0 | skill 0.5 | skill 1 |
|---|---|---|---|---|
| baseline | 57.6% | 57.8% | 32.0% | 4.8% |
| skill 0 | 53.0% | 58.8% | 28.6% | 3.6% |
| skill 0.5 | 79.8% | 83.0% | 57.0% | 14.0% |
| skill 1 | 98.4% | 98.6% | 92.2% | 53.4% |

Skill 1 vs. skill 0 is now 98.6% (was a 49.8% coin flip). Skill 1 vs.
skill 0.5 is 92.2%. The diagonal (identical strategy vs. itself) stays
tightly clustered at 53-59% across every level -- the same first-dealer
edge regardless of skill, confirming the temperature schedule doesn't
introduce a self-play bias. Real, wide, monotonic separation now
exists across the whole dial, which is what this whole investigation
was for.

**A real, worth-flagging side effect, not yet resolved**: skill 0
collapsed to roughly baseline-level performance (53-58% against the
old dumb baseline, down from crushing it ~95% of the time before). At
full temperature (`skill=0` -> `temperature=MAX`), skill 0 is now
close to genuinely random play among legal candidates, not "weak but
trying" -- which is exactly the "true 'plays randomly badly' floor"
the original banked idea called for, but it's a large, visible shift
in what "novice" represents in-game. `PEG_MAX_TEMPERATURE`/
`DISCARD_MAX_TEMPERATURE` are both TBD/playtesting placeholders picked
without calibrating specifically for this -- if a gentler novice floor
(still weak, not pure noise) turns out to be the actual design intent,
lowering these two constants is the lever, same discipline as every
other numeric placeholder in this project.

Not done here, explicitly out of scope for this plan: the real
combat-sweep grids (`playRun`, player/enemy skill x class) haven't
been re-run against this new mechanism yet -- offered, not yet
requested. The actual "play standard Cribbage to 121" game mode the
user wants eventually also isn't built here -- this work was
deliberately designed (per-context `rng?` field, not a
`combat.ts`-only hack) so `game.ts` already benefits from the same
plumbing when that mode gets built.

---

**Real class-balance sweep against the expanded skill dial (session
26, continued).** The race-to-121 harness proved the dial has real
range in the abstract; this sweep checks what that actually does to
the 6 classes via `playRun`, same methodology as every prior sweep.
Four benchmark skill levels chosen from the 0.1-step race-to-121 curve
rather than reusing the old {baseline, 0, 0.5, 1} points: 0.0 (now a
genuine near-random floor), 0.3 (past the flattest part of the curve),
0.6 (the steepest, most information-dense part of the whole dial), 0.9
(effectively the ceiling -- 0.9 vs. 1.0 is nearly flat everywhere in
the race-to-121 data, so 1.0 itself wasn't worth a separate cell).
Full 4x4 (player x enemy) x 6 classes, 500 seeds/cell:

| player 0.0 | enemy 0.0 | enemy 0.3 | enemy 0.6 | enemy 0.9 |
|---|---|---|---|---|
| warden | 85.8% | 81.0% | 63.4% | 41.6% |
| blackhat | 49.0% | 41.0% | 22.4% | 6.6% |
| breacher | 18.4% | 12.4% | 5.4% | 0.0% |
| saboteur | 76.0% | 68.8% | 51.0% | 30.6% |
| operator | 22.0% | 15.2% | 5.2% | 1.0% |
| ghost | 16.0% | 19.2% | 11.6% | 8.6% |

| player 0.3 | enemy 0.0 | enemy 0.3 | enemy 0.6 | enemy 0.9 |
|---|---|---|---|---|
| warden | 90.0% | 86.4% | 70.2% | 48.4% |
| blackhat | 53.0% | 45.0% | 27.4% | 10.6% |
| breacher | 27.6% | 22.4% | 9.0% | 1.4% |
| saboteur | 79.8% | 75.6% | 59.0% | 38.0% |
| operator | 30.0% | 19.2% | 9.0% | 2.0% |
| ghost | 19.0% | 18.2% | 15.8% (dnr=1) | 10.0% |

| player 0.6 | enemy 0.0 | enemy 0.3 | enemy 0.6 | enemy 0.9 |
|---|---|---|---|---|
| warden | 95.8% | 91.6% | 84.6% | 67.0% |
| blackhat | 66.6% | 62.0% | 46.8% | 22.2% |
| breacher | 50.4% | 41.0% | 19.8% | 5.0% |
| saboteur | 90.8% | 86.0% | 74.8% | 51.6% |
| operator | 49.2% | 39.6% | 22.0% | 7.4% |
| ghost | 20.8% | 23.2% | 19.4% | 17.6% (dnr=1) |

| player 0.9 | enemy 0.0 | enemy 0.3 | enemy 0.6 | enemy 0.9 |
|---|---|---|---|---|
| warden | 98.2% | 98.0% | 93.8% | 87.2% |
| blackhat | 77.8% | 72.4% | 61.4% | 37.6% |
| breacher | 78.6% | 70.0% | 44.8% | 16.6% |
| saboteur | 97.0% | 95.8% | 88.0% | 74.4% |
| operator | 76.0% | 66.0% | 46.0% | 24.2% |
| ghost | 19.2% | 21.4% | 24.8% (dnr=1) | 27.6% (dnr=1) |

**Real skill sensitivity finally shows up at the class level, and it's
large.** Every earlier sweep this session (session 24's original grid
through session 26's pre-expansion 3x3) found player/enemy skill barely
moved any class more than a few points -- that was a real limitation
of the old narrow dial, not a property of the classes. With genuine
range: Breacher swings 0.0%->78.6% (player 0.0/enemy 0.9 -> player
0.9/enemy 0.0), Operator 1.0%->76.0%, Warden 41.6%->98.2%. Skill now
matters as much as, or more than, raw loadout magnitude for most of
the roster.

**Ghost is the one clear exception, and it's a real, structural
finding, not noise.** Its win rate barely moves at all as player skill
climbs -- 16.0% -> 19.0% -> 20.8% -> 19.2% against a weak enemy across
player 0.0/0.3/0.6/0.9. This lines up exactly with the checkpoint-D
test investigation earlier this session: Ghost's core mechanism
(Return to Sender's `instantCounterPush`, via Null Session) only arms
once the *enemy's own* gauge is already high (`enemyState:
breachContainmentAbove, value: high` -- subroutines.ts) -- a trigger
gated on enemy behavior, not on how well the player plays their own
cards. Sharper discarding/pegging doesn't make that condition arrive
any sooner. Worth flagging clearly for the next Ghost-specific tuning
pass: unlike every other class here, Ghost's win rate is bottlenecked
by something skill improvement structurally can't fix -- either the
trigger needs an earlier-arming path, or Ghost's build theme needs a
mechanism that actually rewards player skill the way the other five
classes' now demonstrably do.

Small residual `dnr` counts (1/500) reappeared for Ghost at a few of
the tougher cells -- same flavor as the earlier hard-resolution
writeup's finding, not yet investigated further.

---

**Ghost starting-kit redesign (session 26, continued) -- direct
follow-up to the skill-blindness finding above.** User's call, live:
keep Return to Sender (the passive) exactly as it is -- redesign
Ghost's 3 starting skills instead, so the kit gives the passive real,
player-driven triggers to work with. Both `enemyState`-gated pieces
replaced in `GHOST_LOADOUT` (`subroutines.ts`): Steganography (was
Null Session) triggers off the caster's own accumulated points and
casts Ward, reaching Return to Sender's absorb hook for the first time
from the starting kit itself; Tripwire (was Kill Switch) keeps the
same denial payload and tag, re-triggered off an instant pair instead
of enemy gauge state. Low Profile unchanged. Verified: seed 1 (the
checkpoint-D test's scenario) now wins outright within the hard
20-hand window; a 10-seed sample shows 9/10 wins with the passive
active, versus 0/100 for the old kit under the identical matchup.

Re-swept Ghost's row of the 4x4 grid against the redesigned kit (500
seeds/cell):

| player skill | enemy 0.0 | enemy 0.3 | enemy 0.6 | enemy 0.9 |
|---|---|---|---|---|
| 0.0 | 57.4% | 55.8% | 49.0% | 41.2% (dnr=1) |
| 0.3 | 58.0% | 56.4% | 49.4% | 46.4% |
| 0.6 | 57.0% | 55.4% | 53.2% | 49.6% |
| 0.9 | 49.0% | 52.4% | 51.8% | 50.0% |

Win rate roughly tripled overall (16-28% -> 41-58%) -- Ghost is now
comparable to Warden/Saboteur territory instead of the weakest class
in the roster. **Note for the eventual full per-class magnitude/
balance analysis pass (Phase 5's own still-open item -- every prior
sweep this project has run, session 20 through this one, has been
building toward exactly that, one measurement at a time, per the
"tuning pass needs real per-class numbers... to work from" refrain
running through this whole section):** the skill-sensitivity picture
here is mixed, not uniformly fixed. Against a tough enemy (right
column) player skill matters clearly (41.2%->50.0%) -- the redesign
worked as intended there. Against a weak enemy (left column) it's flat
to slightly *negative* with player skill (57.4%->58.0%->57.0%->49.0%),
likely a saturation effect (Ghost already wins often enough there that
remaining losses are probably more about draw variance than anything
skill can fix) rather than a real regression. This redesign was
explicitly scoped as a trigger-mechanism fix, not a magnitude pass --
Steganography's Ward amount and Tripwire's threshold were both carried
over unchanged from the pieces they replaced. When the eventual
per-class pass gets to Ghost specifically, this saturation pattern (and
whether the carried-over magnitudes are now too generous given how much
more often the new triggers arm compared to the old enemyState-gated
ones) is the concrete thing to check first.

---

**Enemy Library (session 27, `/decision-session`) -- checkpointed
implementation spec.** Replaces the flat single-`directBurst`-per-tier
enemy model with a real, authored roster, structurally close to player
classes. Full design reasoning lives in `DESIGN.md`'s new "Enemy Design"
section; this is the build breakdown for a future `/dev-session`.

- **Checkpoint A -- Enemy type system & fight counter.** A new
  `enemies.ts`: `EnemyId`, `EnemyTier` (`'regular' | 'elite' |
  'gatekeeper'`), `EnemyDefinition` (id, name, tier, `archetypes:
  Archetype[]` -- length 1+, not locked to exactly 2, layer-eligibility
  tag(s), `loadout: SubroutineDefinition[]`, optional `passiveId`),
  mirroring `classes.ts`'s `ClassDefinition` shape. Also: a run-order
  fight counter (threaded through `resolveFight`/`playRun`, not
  node/layer position) so the first 1-3 combats of a run can be
  overridden to the easiest regular identity and skill floor regardless
  of which node the player visits first.
- **Checkpoint B -- Passive registry.** A light `{id, hookPoint, fn}`
  lookup replacing the pattern of each `resolve.ts` hook site checking
  `combatState.classId` directly -- generic enough for either side to
  carry a passive. Extend `CombatState`/`CombatOptions` so the enemy
  side can carry a `passiveId` (`combat.ts`'s "enemy loadouts remain
  plain data with no passive of their own" note goes away). The
  existing 6 class passives are not required to migrate onto the
  registry in this checkpoint -- they can stay on their current
  hand-coded path; only new enemy passives need to go through it.
- **Checkpoint C -- Selection & skill-dial wiring.** Gatekeeper identity
  assigned once per layer at `map-gen.ts` time, from that layer's
  stable (2-4 members) -- stable for the run. Regular/elite identity
  resolved randomly at `resolveFight` time from the eligible tier+layer
  pool. Skill-dial formula (tier-primary base, layer-secondary
  modifier -- see `DESIGN.md` for the rough bands) computed at
  `resolveFight` time and passed through as `discardStrategies`/
  `playStrategies`, same plumbing session 24 already built.
- **Checkpoint D -- Roster authoring.** ✅ **Designed (session 27)** --
  the full 32-enemy roster (12 Regular, 8 Elite, 12 Gatekeeper across 4
  layers) is drafted and written up in `DESIGN.md`'s new "The Roster"
  subsection, including exact subroutine ids per enemy and every bespoke
  passive concept. What's left for this checkpoint is pure implementation
  -- authoring it as real `EnemyDefinition` data in `enemies.ts` and
  wiring the bespoke passives through Checkpoint B's registry, not
  further design work. Two real technical traps were caught and worked
  around during design (see `DESIGN.md`): the `chained`-trigger
  prerequisite issue (some pool uncommons/rares are dead without a
  specific, sometimes class-exclusive, prerequisite also present) and an
  early tonal drift toward "external criminal org" naming that got
  corrected back to "target network's own defenses" (4 renames applied).
- **Checkpoint E -- Verification & rebalance.** Every existing balance
  number in this project (Root passive rework, escalation timing, the
  hard resolution deadline, every skill-dial sweep) was only ever
  validated against the old flat single-burst dummy. Re-run the
  `playRun()`/`resolveFight` sweep methodology (same shape as every
  prior sweep in this section) against the real roster once it exists --
  expect real retuning, not just a confirmation pass, since this is
  genuinely new content the engine has never been exercised against.

Exit criteria: all 6 checkpoints implemented and tested; a fresh
`playRun()` sweep exists against the real roster (numbers, not vibes,
matching this project's own stated discipline); `DESIGN.md`'s Enemy
Design section and this spec agree with what actually shipped.

---

**Checkpoint E revision + Neutral Archetype (session 28,
`/decision-session` mid-implementation).** While implementing
checkpoint E, revised `resolveHardTiebreak` (`combat.ts`) per the
user's own reframing: the hard-resolution deadline (hand 20) now
unconditionally favors the defender rather than racing win-gauge
fractions -- reaching that function at all already means the attacker
failed to breach in time, so that's containment, full stop, not "closer
wins." `CombatResult` gained `resolvedBy: 'threshold' | 'attrition'` so
a sweep can tell real breaches apart from successful stalls. This
surfaced a much bigger finding than the 2 tests it broke: **Ghost's
real starting kit has a 0% genuine win rate** (30-seed check, 0
threshold wins, all attrition losses, peak fill fraction never above
~0.17) -- the session 26 "Ghost fix" was only ever validated under the
old, looser tiebreak. Root cause, and the reason this became its own
decision session rather than a quick patch: **only Exploit's
direct-damage payloads and Malware's DoT ever credit a side's own
win-gauge at all** -- every Encryption and Root payload only reduces
the opponent or manipulates state. A kit built entirely from
Encryption/Root, with no Malware DoT or Exploit piece, cannot win
outright, period -- true for Ghost and for **9 of the 32 roster
enemies** (Legacy Firewall, Access Gate, Hardened Workstation, Zero
Trust Node, Backchannel Handler, Firewall Prime, Ghost Process, Null
Session, Ghost in the Machine).

Resolved by designing a **Neutral Archetype** -- full writeup in
`DESIGN.md`'s new "Neutral Archetype" subsection (under
Meta-Progression). Summary: a genuine 5th `Archetype` value (not one of
the 4 reused for flavor -- naturally exempt from every archetype-gated
passive check, and correctly has no suit affiliation, since Cribbage
only has 4 real suits). Built entirely from trigger families that don't
depend on suit (Always/Cantrip, Self-state, every occurrence category
except the two that are inherently suit-based -- Flush, His Nobs), so
these pieces can drop into *any* kit, including a pure-Encryption/Root
one, without borrowing another archetype's identity. A small, 9-piece
catalog (4 common/3 uncommon/2 rare, far smaller than each real
archetype's 7/5/3 on purpose) -- see `DESIGN.md` for the full table.
The rare **Circuit Breaker** is the capstone: converts the caster's own
banked mitigation (Ward/instantCounterPush/HoT amounts already cast
this match) into a real credit, a genuine "shield bash" -- Encryption/
Root's actual identity (denial) becomes a legitimate win path instead
of needing borrowed offense. This is the one piece needing a real new
engine primitive (an accumulator metric tracking banked mitigation,
fed from wherever Ward/instantCounterPush/hot resolve); the other 8 are
pure data over existing trigger/payload machinery.

**Retrofit scope, decided live**: Ghost's Cantrip (Low Profile) is
replaced by the neutral Idle Process *in this same pass* -- the kit
that surfaced the problem gets the fix immediately, not deferred. The
9 struggling enemies get their own neutral-piece swaps as part of
finishing checkpoint E below, not in this design pass. Two things
explicitly banked, not resolved here: **acquisition** (how neutral
pieces actually enter reward pools/Shop -- flagged by the user as its
own future topic) and a **future subroutine-library expansion idea**:
Circuit Breaker's mitigation-conversion mechanic could eventually be
reincarnated as a *native Encryption* piece (a firewall that
counter-attacks after absorbing enough is standard security framing,
not a borrowed one) -- worth revisiting once Phase 5's long-standing
per-class magnitude/balance pass reaches Encryption specifically.

**Checkpoint E remaining work, updated**: implement the neutral
archetype (type system + accumulator primitive + the 9 pieces +
Ghost's retrofit), fix the 2 tests `resolveHardTiebreak`'s revision
broke (both were asserting the old fraction-race behavior), swap a
neutral piece into each of the 9 structurally-can't-win enemies, *then*
run the real `playRun()`/`resolveFight` balance sweep this checkpoint
was always going to need -- now against a roster where every enemy has
at least one genuine path to victory, which the original sweep plan
didn't know it needed to guarantee.

---

**Checkpoint E completion: enemy retrofits, a real engine hang found
and fixed, a reusable sweep harness, and the actual balance sweep
(session 28, continued).**

**Retrofits**: all 9 credit-incapable enemies (Legacy Firewall, Access
Gate, Hardened Workstation, Zero Trust Node, Backchannel Handler,
Firewall Prime, Ghost Process, Null Session, Ghost in the Machine)
gained a neutral-archetype piece, either added or swapped for
dead-weight content. `enemies.test.ts` (14 tests) directly asserts
every one of the 32 enemies now has at least one payload kind capable
of crediting its own win-gauge -- the concrete regression guard.

**A real infinite-loop hang, found by the sweep itself, not
hypothetically**: Blackhat (real grown loadout, including Botnet) vs.
Ghost in the Machine (carries DNS Poisoning) hung forever on a specific
seed -- traced (with temporary diagnostic logging, since real wall-
clock time had passed hours by the time it was caught) to Choked's
gauge-threshold reversal (`tickDebuffDurations`' natural-expiry path
and `resolvePayload`'s early-cleanse path) having no floor, unlike
Haste's own reduction. Botnet's Choked raised Ghost in the Machine's
initiative threshold, DNS Poisoning's Haste then floor-reduced the same
threshold, and Choked's later reversal ignored that floor entirely,
landing exactly on 0 -- which hangs `gauges.ts`'s `addPoints` forever
(a 0 decrement never lets `progress` fall below `threshold` again).
Fixed by flooring both reversal paths at the same constant Haste uses
(renamed `MIN_INITIATIVE_THRESHOLD`, no longer Haste-specific), plus
hardening `addPoints` itself defensively -- this class of bug shouldn't
depend on every future caller maintaining the invariant by hand. 4 new
regression tests reproduce the exact interaction.

**A reusable sweep harness**: `scripts/sweep.ts` (`npm run sweep`),
requested mid-session once the hang made clear that scratch-script
sweeps buffering all output until the end are actively dangerous (a
hang loses every prior result and gives no clue which unit stuck).
Prints one line per unit of work as it completes, optionally appending
to a `--out` file. Two modes: `run` (playRun outcome distribution per
class) and `enemy` (direct playCombat between one named enemy and one
class's real starting kit, threshold-vs-attrition breakdown -- the
shape used for the 9 retrofit verifications, now reusable instead of
one-off).

**The real balance sweep** (200 seeds/class, `npm run sweep run
--seeds=200`, default settings/`beelineToGatekeeper`, real skill-dial
enemy AI):

| class | victory | heatMaxed | quarantined | noRoute | avg layers |
|---|---|---|---|---|---|
| breacher | 10.0% | 0 | 156 | 24 | 0.83 |
| blackhat | 28.5% | 15 | 127 | 1 | 1.66 |
| saboteur | 33.5% | 0 | 132 | 1 | 1.89 |
| operator | 41.5% | 0 | 108 | 9 | 2.10 |
| warden | 35.5% | 0 | 127 | 2 | 2.00 |
| ghost | 23.0% | 0 | 154 | 0 | 1.60 |

Average ~28.7% across classes -- a real, played-out "hard but
winnable" roguelike rate, not broken wholesale. Quarantine dominates
every class's losses (matching the corrected attrition rule's real
effect), not Heat or no-route. **Breacher is the sharp outlier**,
sitting at under a third of the next-worst class's rate despite being
the designed onboarding/balanced starter. Traced with
`npm run sweep enemy`: Legacy Firewall (Regular, pure mitigation +
one neutral piece) beats Breacher's real starting kit 18/20 times,
**entirely via attrition** (0 genuine threshold wins) -- but the same
enemy loses 30/30 to Operator. Not a roster-wide problem: Breacher's
own kit (Foothold's "hit hard, then hold the position," leaning on its
own Session Lock/Steady Hand mitigation) is specifically prone to
genuine stalemates against another patient/defensive kit, and every
stalemate now resolves in the *defender's* favor (this session's own
`resolveHardTiebreak` correction) -- a structural mismatch between
Breacher's build identity and the corrected tiebreak rule, not a
one-off tuning number.

**Not fixed here, deliberately** -- this is a finding for the real
per-class magnitude/balance pass (Phase 5's own long-standing open
item, referenced by nearly every sweep in this section), not something
to hand-tune reactively off one data point. Concrete candidates for
that future pass, recorded here rather than acted on: give Breacher's
kit (or its Foothold passive) a real answer to a patient opponent, not
just raw damage; or accept the mismatch as intentional difficulty
texture (a "must play sharp against defensive kits" class) and instead
tune the Regular tier's Encryption-heavy stalling power down slightly.
Re-run `npm run sweep` once any of that lands -- numbers, not vibes,
matching this project's own stated discipline throughout this section.

**Phase 5 checkpoint E is now complete**: all 6 checkpoints (A-F, this
session's revisions folded in) implemented and tested, 459 tests
passing, a fresh roster-wide sweep exists with real findings recorded
above. `DESIGN.md`'s Enemy Design/Neutral Archetype sections and this
spec agree with what actually shipped.

---

**Breacher stalemate fix: Lock Fatigue, and a bigger gap it surfaced
(session 29).** Direct follow-up to the checkpoint-E finding above
("Breacher's own kit... is specifically prone to genuine stalemates
against another patient/defensive kit"). Chosen fix, over the
alternative of nerfing Legacy Firewall/Regular-tier Encryption
suppression (much wider blast radius across every class's matchups):
give Breacher's own kit a real way to convert prolonged suppression
into an eventual win-gauge credit, reusing the exact mechanism the
Neutral Archetype's Circuit Breaker already proved out (checkpoint
E/session 28) rather than inventing a new one.

**The change**: Steady Hand (Breacher's flavor Cantrip, an
`always`-triggered flat 3-point suppression tick -- the weakest identity
tie of the 3 starting pieces) replaced with **Lock Fatigue**
(`subroutines.ts`, `BREACHER_LOADOUT`) -- an `accumulator` trigger
watching `mitigationBanked` (already fed automatically by Session Lock's
own suppression casts), firing a real `directBurst` once enough
mitigation has been banked. "Holding the position" now eventually forces
an opening instead of only ever denying one. Pure content, no new engine
primitives -- same `mitigationBanked`/`creditMitigationBanked` machinery
Circuit Breaker already exercises.

**A real tuning miss caught by the sweep itself**: the first pass
(threshold 14 ~= 2 Session Lock casts, `CAPPED.uncommon` = 11 burst)
overshot badly -- Legacy Firewall vs. Breacher went from the diagnosing
2/20 (10%, all-attrition) to **198/200 (99%)**, trivializing the exact
matchup this was meant to merely fix, not dominate. Retuned to threshold
28 (~4 casts) / `COMMON.burst` (5): **114/200 (57%)**, still zero
genuine enemy threshold wins either way -- a real, non-trivializing
improvement. Same "numbers, not vibes" discipline as every other sweep
in this section: the first constant choice was wrong, and the sweep
caught it immediately rather than after the fact.

**The full-run sweep barely moved, and that's the real finding**: despite
fixing the diagnosing 1-on-1 matchup cleanly, Breacher's `playRun`
victory rate only went from 10.0% to **12.0%** (200 seeds) -- Legacy
Firewall was never the dominant source of Breacher's weakness across a
real run. Checking three other pure-Encryption enemies not covered by
the original diagnosis (200 seeds each, direct `playCombat`):

| enemy | tier | Breacher wins | how |
|---|---|---|---|
| Access Gate | regular (layer 2+) | 0/200 | mostly genuine threshold losses (107/200) |
| Zero Trust Node | elite | 0/200 | all attrition |
| Firewall Prime | gatekeeper | 1/200 | almost all genuine threshold losses |

Breacher isn't just prone to *stalling* against patient kits (the
mechanism Lock Fatigue fixes) -- it's broadly outgunned by the entire
pure-Encryption enemy family, including matchups the enemy wins outright
on offense (Access Gate, Firewall Prime), which a stall-conversion piece
structurally can't touch. That's a magnitude problem, not a stalemate
problem -- Session Lock/Buffer Overflow/Lock Fatigue's raw numbers may
simply be too low relative to what pure-Encryption enemies bring at
every tier, independent of the hand-20-timeout mechanism this session
addressed.

**Decided live, not acted on this session**: Lock Fatigue stays as
tuned (a real, verified fix for the diagnosed stalemate mechanism, not
reverted despite the full-run number barely moving) rather than chasing
the broader gap reactively off three data points. **Banked for the real
per-class magnitude/balance pass** (Phase 5's own long-standing item,
now with three more concrete data points to work from): Breacher's raw
offensive/mitigation magnitudes likely need a real increase against
pure-Encryption opposition specifically, not just a stall-closer --
Access Gate and Firewall Prime's *genuine* threshold wins over Breacher
are the sharper, more urgent half of this finding than the stalemate
cases were. 460 tests passing (up from 459 -- one new integration test
covering Lock Fatigue's accumulator firing).

---

**Mods -- design shape settled (session 30, `/decision-session`).**
Full reasoning in `DESIGN.md`'s new "Mods" subsection under
Meta-Progression; this is the implementation-facing summary. At the
user's request, this paused the per-class magnitude/balance pass above
to design crib.exe's StS-relic equivalent before that pass, on the
theory that Mods will materially change what "balanced" even means once
they exist. Docs-only session, no code -- same category as sessions 15/
17/19/21's engineering-scoping sessions, but for design shape rather than
implementation checkpoints, since nothing about Mods was designed at all
before this (session 21 explicitly punted it).

Resolved live, one decision at a time:

- **Two engine mechanisms, not a third generic one**: trigger/payload-
  shaped Mods reuse `SubroutineDefinition` wholesale (fired outside the
  loadout, no slot/order); everything else (tag/archetype affinity,
  stat/resource/economy modifiers, run-meta hooks) extends the existing
  enemy-passive light registry (`resolve.ts`, session 27) to a
  player-side owned-Mod-id list, with new hook points added as needed.
- **The 6 class starting passives migrate onto this infrastructure** as
  class-exclusive Mods (granted at run start, never in the general
  pool) -- making `DESIGN.md`'s existing "same role as StS's class-
  starting relics" comparison literal. Migration itself is unbuilt.
- **Uniqueness**: no duplicates possible; an owned Mod drops out of
  future reward/Shop pools. No Merge interaction needed.
- **Ownership: uncapped**, no bench/installed split, no ordering -- the
  subroutine loadout cap's "always-evaluated risks bloat" reasoning
  (session 7) doesn't transfer, since Mods have no ordering/slot-
  scarcity tension to protect in the first place. Opportunity cost lives
  in acquisition, not an equip limit.
- **Acquisition: additive**, not competing with the subroutine reward --
  elite/gatekeeper wins grant a Mod choice *in addition to* the normal
  subroutine reward (regular fights stay subroutine-only). Event nodes
  are a probable third channel once designed (pre-existing banked item).
- **Shop**: two independent slates (existing subroutine slate unchanged,
  plus a new Mod slate), separately rerollable, one shared Data pool.
- **Pool scoping: universal by default**, except a Mod leaning heavily
  on one archetype is excluded from a class's reward/Shop pool when that
  archetype isn't one of the class's 2 specializations -- reuses the
  existing `ClassDefinition.archetypes` check subroutine rewards already
  do, inverted into an exclusion. Prevents guaranteeing a class a
  structurally dead reward, the same concern behind the Neutral
  Archetype (session 28).
- **Rarity**: common/uncommon/rare, mirroring subroutines -- commons
  simple, rares more build-defining. All exact numbers (distribution,
  Shop pricing, elite/gatekeeper rarity floors) TBD/playtesting.

**Deliberately not touched this session** (shape, not library): the
hook-point catalog for registry-shaped Mods -- the direct equivalent of
sessions 3-5's trigger/payload catalog work for subroutines, and the
next real design session this system needs; concrete named Mod content;
curses/negative-effect Mods (not raised, undecided); Event nodes' own
design (pre-existing banked item, now also gating Mods' third
acquisition channel). Only once the hook-point catalog exists can a
future engineering-scoping session (mirroring sessions 15/17/19/21) turn
this shape into real implementation checkpoints.

---

**Mods -- hook-point catalog (session 31, `/decision-session`).** Direct
follow-up, same sitting as session 30. Full reasoning in `DESIGN.md`'s
new "Mods -- Hook-Point Catalog" subsection; this is the implementation-
facing summary. Explored the actual code first (`resolve.ts`'s 5
existing enemy-passive hooks; the total absence of any hook mechanism in
`run.ts`/`encounters.ts`/`shop.ts`) before proposing anything, which
surfaced that `EncounterOutcome` and `RunEvent` are already rich enough
structs that most run-level Mods need no new state threaded through the
engine, only a dispatch point.

Resolved live, one decision at a time:

- **Coarse hooks with rich context, not fine-grained ones per concern**
  -- a Mod reads whichever field it cares about off a shared struct
  (`EncounterOutcome`, etc.), the same "dispatch mechanism, not a
  declarative DSL" philosophy session 27 already established for the
  enemy registry.
- **All 10 hook points are chainable/mutation-capable**, not read-only
  -- the same fold/thread pattern the enemy-passive dispatch already
  uses. This one shape covers both purely-reactive Mods and
  reward/cost-altering ones without needing two different hook shapes;
  surfaced when the user asked about reward-altering Mods and the
  answer turned out to be "fix how `onEncounterResolved` was framed,"
  not "add a new hook."
- **No dedicated combat-end hook** -- `onEncounterResolved` (run-scoped)
  already covers "how did the fight go," since reward computation
  doesn't depend on combat-internal state anyway (quality keys off
  encounter tier, not performance).
- **`onSubroutineAcquired` included**, deliberately distinct from
  `onEncounterResolved` -- the latter only ever sees the *offered*
  `rewardOptions`, since the real pick happens later in `playRun()` via
  `AcquisitionStrategy`. Justified by a concrete example the user gave:
  "when you acquire a Malware subroutine, upgrade it once" (reusing
  `merge.ts`'s existing rank mechanism against the new piece).
- **`onFire`'s signature widened** from `archetype`-only to the full
  firing `SubroutineDefinition` (id + tags + archetype) -- a real fix,
  caught while checking the catalog against tag-affinity Mods (one of
  the two hook categories named as core to Mods, session 30): archetype
  alone can't support "your Trap-tagged subroutines hit harder."
- **`onShopSlateGenerated` added** for Shop-discount Mods -- prices are
  fixed by `shop.ts` before `EncounterOutcome.shopPurchase` exists, so a
  price-altering Mod needs to act earlier in the pipeline than the
  post-purchase hook can reach.
- **`onModAcquired` added**, raised mid-session by a concrete Mod idea:
  grant an always-slotted subroutine -- installed permanently,
  reorderable like any other piece, but exempt from the slot cap and
  locked against removal. Doesn't fit either of session 30's two engine
  buckets (it must live *inside* `installedLoadout`'s ordering, not
  outside it like a reactive-subroutine Mod). Resolved as a one-time
  structural-mutation hook (fires once at Mod acquisition, against
  `RunPlayerState`) plus a new per-entry loadout marker
  (`grantedByModId?: string`) that `INSTALLED_SLOT_CAP` counting and the
  uninstall action both special-case -- reorder and fire-on-turn/
  chaining logic need zero changes. Upgrading the granted piece falls
  out for free via the existing Merge/rank mechanism, no new code.

**Final catalog (11)**: combat-scoped `onFire` (widened),
`onTick`/`onTickExpiring`, `onGaugeCross50`, `onIncomingDirectBurst` (all
4 extended from enemy-only to dual-sided), plus new `onCombatStart`;
run-scoped `onMove`, `onEncounterResolved`, `onShopSlateGenerated`,
`onSubroutineAcquired`, `onModAcquired` (all 5 new -- nothing analogous
existed before this session). Explicitly a starting catalog, not closed
-- more hook points get added later if specific content demands them.

**Still open, unchanged from session 30**: concrete named Mod content,
curses/negative-effect Mods, Event nodes' own design, exact numbers.
**Now unblocked**: a future engineering-scoping session (mirroring
sessions 15/17/19/21) can turn session 30's shape plus this catalog into
real implementation checkpoints -- both halves of "what a Mod needs to
plug into" exist on paper for the first time.

---

**Mods -- content validation pass (session 32, `/decision-session`).**
Direct follow-up, same sitting as sessions 30-31. Full reasoning in
`DESIGN.md`'s new "Mods -- Content Validation Pass" subsection; this is
the implementation-facing summary. The user's own idea: before scoping
implementation, build out enough real Mod content to confirm the
shape/catalog doesn't have gaps -- explicitly motivated by session 17's
own history (that Phase 2 scope was written before session 12's real
subroutine content existed, and had to be rescoped once it turned out
most of the real catalog didn't fit). Deliberately small: 17 Mods, aimed
at touching every hook point and both engine buckets at least once, not
at reaching launch-sized content volume.

**A real gap, found by design**: drafting a trigger-mechanism-affinity
Mod ("your Accumulator-triggered subroutines need less banked progress
to fire") -- one of the three hook categories named as core to Mods
since session 30's opening round -- exposed that nothing in the
11-hook catalog could support it; `onFire` only runs after a trigger is
already satisfied. **Added a 12th hook, `onTriggerEvaluate`**, chainable,
firing during `triggers.ts`'s per-subroutine readiness check.

**A near-miss, confirmed not to be a gap**: "permanently raise max Heat
capacity" looked like it might need a new `onRunStart` hook, but
`onModAcquired` already covers it -- a class-exclusive Mod granted at
run start and a found Mod picked up mid-run route through the same
acquisition moment regardless of timing.

**The 17-Mod draft** (full table in `DESIGN.md`): 7 commons (single-hook,
mild), 6 uncommons (tag/archetype-affinity, `onSubroutineAcquired`,
`onTriggerEvaluate`, Shop/tick effects), 4 rares (a granted-subroutine
Mod via `onModAcquired`, a genuine reactive-subroutine Mod from the
*other* engine bucket, a tick-refresh effect, and a reward-rarity-upgrade
effect). All 12 hooks and both engine buckets exercised by at least one
entry -- confirmed by the user as a good starting spread.

**Still open, genuinely unchanged**: this is a validation sample, not
the launch pool -- no attempt to reach final content volume, author the
3 archetype-sibling Amplifier Mods implied by Malware Amplifier, fully
spec the two rares' actual `SubroutineDefinition` content, or design
curses/Event-node content. **Now true for the first time**: shape
(session 30), hook catalog (sessions 31-32), and a validated content
cross-section all exist and agree with each other -- the strongest
signal yet that a future engineering-scoping session can build real
implementation checkpoints without a session-17-style rescope risk.

---

**Mods Implementation (session 33, `/decision-session`) -- checkpointed
implementation spec, ✅ all 9 checkpoints implemented session 34.**
Engineering-scoping session, same category as
sessions 15/17/19/21/27, turning sessions 30-32's design (shape, hook
catalog, validated 17-Mod content) into real implementation checkpoints
for a future `/dev-session`. The biggest single scope since the Enemy
Library (session 27) -- arguably bigger, since it touches loadout,
acquisition, Shop, and combat resolution all at once.

Explored the actual codebase before proposing checkpoints, surfacing two
calls made and stated rather than forced into questions, since precedent
already pointed one way:

- **File split**: `resolve.ts` is already 1595 lines (roughly doubled by
  the enemy-passive registry alone); Mods roughly double the hook
  surface again. Combat-scoped hook dispatch stays in `resolve.ts` (same
  tight `CombatState` coupling the enemy passives already need), but the
  type system (`mod-types.ts`, mirroring `subroutine-types.ts`) and
  run-level hook dispatch plus concrete Mod data (`mods.ts`, mirroring
  `subroutines.ts`) get new files.
- **Granted-subroutine tracking**: no new field on `SubroutineDefinition`
  -- `RunPlayerState` already tracks per-instance ownership state
  separately from static subroutine data, keyed by id (`material`/`rank`,
  both from Merge). A new `grantedByMod: Record<string, string>`
  (subroutine id -> granting Mod id) follows that exact shape;
  `loadout.ts`'s cap check and uninstall guard just consult it.

Two real forks, resolved live:

- **Content-authoring scope**: author all 17 validated Mods as real data
  in this pass, not a Phase-2-style representative subset. Unlike Phase
  2 (where the *full* subroutine catalog had no concrete content yet at
  all), all 17 Mods are already fully designed -- no reason to hold any
  back, and doing so tests the implementation against the exact
  cross-section that already validated the hook catalog.
- **Class-passive migration timing**: fold the 6 existing class starting
  passives' migration onto the new infrastructure into this same phase
  (as its own checkpoint), rather than deferring the way session 27
  deferred it for the enemy registry. The user's call -- "it's work that
  needs to be done, no sense in holding off" -- overriding the initial
  recommendation to defer given real regression risk on well-tested,
  balance-sensitive code (Ghost's rework, Lock Fatigue, etc.); mitigated
  by keeping it as an isolated, separately-verified checkpoint rather
  than folding it into the same checkpoint as brand-new infrastructure.

**9 checkpoints, all ✅ implemented session 34** (real implementation
notes/deviations from the plan below each):

- **A -- Mod type system** (`mod-types.ts`): `ModId`, rarity (reuse
  existing common/uncommon/rare), an effect-kind union
  (`reactiveSubroutine` | `hook`), `ModDefinition`, typed signatures for
  all 12 hooks. **Shipped without the typed-per-hook-signature catalog**
  -- `EnemyPassiveId`'s own precedent (a plain string union, dispatch
  logic hand-written per id, no cataloged function-signature registry)
  is the actual codebase idiom for this "light registry, not a
  declarative DSL" pattern, so `mod-types.ts` matches it instead.
- **B -- State threading**: `RunPlayerState` gains `ownedModIds: ModId[]`/
  `grantedByMod: Record<string, string>` (plus `maxHeatBonus`/
  `modRunState`, needed once E/H's real content -- Backup Generator,
  Salvage Protocol -- got implemented); `CombatOptions`/`CombatState`
  gain `ownedModIds` (mirroring `enemyPassiveIds`); reactive-subroutine
  Mods are spliced directly into side 0's combat loadout at
  `createCombatState` time, so `fireReadySubroutines`/
  `fireNewlyReadyReactiveSubroutines`/`fireHandLifecycleSubroutines`
  needed zero changes to also fire them.
- **C -- Combat-scoped hook dispatch** (`resolve.ts`, `triggers.ts`):
  widened `onFire`'s signature (an optional `firingDefinition` param,
  threaded from the 3 real fire call sites that have one on hand),
  added `onCombatStart`/`onTriggerEvaluate`. **"Dual-sided dispatch"
  shipped as sibling functions** (`applyModOnFirePassives` alongside
  `applyEnemyOnFirePassives`, etc.), not interleaved into the existing
  34-passive enemy fold -- both fire from the same call site either way,
  but this kept that well-tested fold completely untouched. `onTriggerEvaluate`
  plugs into `triggers.ts`'s Accumulator threshold comparisons (a new
  `thresholdMultiplier` param on `updateSubroutineState`/
  `updateSuitTallyState`/`updateMitigationBankedState`), not `isReady`
  itself, since `isReady` only reads an already-latched boolean.
- **D -- Migrate the 6 class starting passives.** **Real deviation from
  plan**: the plan called for literally folding all 6 into the shared
  dispatcher functions; several (Zero Day's mid-payload Heat waiver,
  Return to Sender's three distinct trigger points) don't fit that
  post-fire fold shape without changing their own behavior. Shipped as
  gating-only migration instead -- each `classId === 'x'` check became an
  `ownedModIds` membership check (`hasMod`), call sites unchanged.
  Zero-regression safety came from `createCombatState` auto-deriving the
  current class's own exclusive Mod into `ownedModIds` whenever `classId`
  is set, so every pre-existing call site that only ever passed `classId`
  keeps working with no other change. Verified: zero regression across
  the full suite.
- **E -- Run-level hook dispatch**: `onMove` (`run.ts`'s `playRun` loop,
  between `move()` and `addHeat()`), `onEncounterResolved`/
  `onShopSlateGenerated` (`encounters.ts`), `onSubroutineAcquired`/
  `onModAcquired` (`run.ts`). Mostly hand-written dispatch functions in
  `mods.ts` (mirroring `enemies.ts`'s data/`resolve.ts`'s logic split),
  not `traversal.ts`/`heat.ts` directly -- `heat.ts`'s `addHeat` gained
  an overridable `max` param instead (Backup Generator's own need).
- **F -- Granted-subroutine mechanism** (`loadout.ts`): `grantedByMod`-
  aware cap check/uninstall guard, plus a new `installGrantedSubroutine`
  helper (Auxiliary Process's own insertion path). `reorderInstalled`
  needed no change, as planned.
- **G -- Acquisition/reward/Shop wiring**: additive Mod-choice reward on
  elite/gatekeeper wins, Shop's second independent Mod slate (own
  reroll). **Correction from the plan's own stated direction**: the
  archetype-exclusion filter is the *same* inclusion direction
  `rewardPoolForClass` already uses for its own archetype pools (a Mod
  naming an archetype is only offered to a class whose own 2
  specializations include it), not an inversion of it -- the plan's "invert
  `!ownArchetypes.has(...)`" phrasing was a misreading of `DESIGN.md`'s
  actual session-30 text, caught and fixed during implementation.
  `EncounterOutcome` also gained `modRewardOptions`/`modShopPurchase`/
  `modRerollCost`, mirroring the existing subroutine-reward fields --
  a real shape gap the plan itself flagged as likely needed.
- **H -- Author all 17 validated Mods as real data** (`mods.ts`).
  Authored alongside B/C/E's plumbing rather than as a separate later
  pass, since every Mod's real effect needed its hook to exist first --
  by the time C finished, all 17 already had working implementations,
  not just data shells.
- **I -- Verification** (`mods.test.ts`, new): every one of the 12 hooks
  exercised by a real test, zero regression (484/484, from 460), a
  smoke-tested full `playRun()` with reactive-subroutine, hook-kind, and
  granted-subroutine Mods all active together (a new `ownedModIdsOverride`
  test-only escape hatch on `RunOptions`, mirroring
  `installedLoadoutOverride`'s own precedent).

**Exit criteria, all met**: all 9 checkpoints implemented and tested; the
6 class passives migrated with zero regression; all 17 Mods exist as
real, functioning data with working hook effects, not placeholders. A
fresh `playRun()` sweep with Mods active is now possible for the first
time -- not run this session (per the plan, that's the eventual balance
pass's job, still sequenced after this) but genuinely unblocked.

**First real Mods-active balance sweep (session 34, same-day follow-up)**
-- `npm run sweep -- run --seeds=200`, all 6 classes, same legal-not-good
default strategies every prior sweep in this project has used
(`alwaysAcquireFirst`/`alwaysAcquireFirstMod`, `beelineToGatekeeper`),
Mods now genuinely reachable via both the additive elite/gatekeeper
reward and the Shop's second slate for the first time:

| class     | victory | heatMaxed | quarantined | noRoute | avg layers |
|-----------|---------|-----------|-------------|---------|------------|
| breacher  | 18.0%   | 0.0%      | 78.0%       | 4.0%    | 0.93       |
| blackhat  | 34.0%   | 4.0%      | 62.0%       | 0.0%    | 1.78       |
| saboteur  | 35.5%   | 0.0%      | 64.0%       | 0.5%    | 1.96       |
| operator  | 47.5%   | 0.0%      | 49.0%       | 3.5%    | 2.25       |
| warden    | 41.0%   | 0.0%      | 57.5%       | 1.5%    | 2.12       |
| ghost     | 20.5%   | 0.0%      | 79.5%       | 0.0%    | 1.58       |

Average victory rate **32.75%**, up from session 28's pre-Mods baseline
(~28.7%: breacher 10.0%, blackhat 28.5%, saboteur 33.5%, operator 41.5%,
warden 35.5%, ghost 23.0%). Two real findings, not just "it went up":

1. **Every class improved except Ghost**, which is flat within noise
   (23.0%→20.5%). Reads as structural, not seed luck: Ghost's kit never
   credits its own win-gauge directly (its whole identity, per
   `DESIGN.md`), so the Mods that reward *firing* something (Tagged
   Firmware's tag bonus, Malware Amplifier's archetype bonus) have
   nothing to attach to on a Ghost loadout the way they do on an
   offense-heavy class. Worth checking directly in a future session
   rather than assuming -- a Ghost-specific breakdown of which Mods it
   actually drew/used across these 200 seeds would confirm or rule this
   out.
2. **The relative class ordering is completely unchanged** from session
   28: breacher and ghost remain the two weakest, operator remains
   strongest, same rank order top to bottom. Mods gave a fairly uniform
   uplift rather than reshuffling the balance picture -- useful to know
   before the eventual per-class magnitude pass, since it means Mods
   alone won't fix Breacher/Ghost's relative standing, only raise every
   class's floor by roughly the same amount.

**Flagged for next session, user's direct ask -- re-highlighting the
table itself, since this is the thing to actually dig into**:

| class     | victory | heatMaxed | quarantined | noRoute | avg layers |
|-----------|---------|-----------|-------------|---------|------------|
| breacher  | 18.0%   | 0.0%      | 78.0%       | 4.0%    | 0.93       |
| blackhat  | 34.0%   | 4.0%      | 62.0%       | 0.0%    | 1.78       |
| saboteur  | 35.5%   | 0.0%      | 64.0%       | 0.5%    | 1.96       |
| operator  | 47.5%   | 0.0%      | 49.0%       | 3.5%    | 2.25       |
| warden    | 41.0%   | 0.0%      | 57.5%       | 1.5%    | 2.12       |
| ghost     | 20.5%   | 0.0%      | 79.5%       | 0.0%    | 1.58       |

Losses are overwhelmingly `quarantined` (49-79.5% of all runs, every
class) -- `heatMaxed` is almost always exactly 0.0% (blackhat's 4.0% is
the only nonzero cell in the whole column) and `noRoute` stays in the
low single digits or 0.0%. Not investigated yet, but a real hypothesis
worth checking first, rooted in the sweep's own traversal strategy: this
is a `beelineToGatekeeper` sweep, which minimizes both Heat exposure
(shortest path = fewest moves, fewest optional regular/elite fights to
lose Heat-costing fights against) and node-closure risk (session 20's
own finding: `noRouteRemains` dominates specifically under
*aggressive, everything-visiting* strategies, the opposite extreme from
beelining) -- but every layer still forces exactly one gatekeeper fight,
and a gatekeeper loss bypasses Heat entirely and ends the run outright
(`DESIGN.md` Resources: "a gatekeeper is the sole passage forward,"
session 9). So beelining may be concentrating essentially all of a run's
real risk into gatekeeper fights specifically, with regular/elite losses
along the way rarely accumulating enough Heat to matter before a
gatekeeper fight decides it outright. Worth checking directly against a
different traversal strategy (`exploreThenGatekeeper` already exists,
`run.ts`) to see whether the same quarantine-dominance holds, or whether
it's a `beelineToGatekeeper`-specific artifact of this particular sweep
methodology rather than a real characteristic of the game.

**Not yet done**: a synergy-aware acquisition/Shop strategy (this sweep's
`alwaysAcquireFirst`/`alwaysAcquireFirstMod` never weighs rarity or
class fit); a breakdown of *which* Mods actually got drawn/used per
class/seed (would directly test finding 1 above); the per-class
magnitude/balance pass itself, which this sweep is scoping data for, not
performing.

**Banked for the next Mod-content pass, user's direct call on finding 1
above**: Root-themed Mods specifically should add real gauge-related
power (win-gauge credit or enemy-gauge suppression), not just
denial/manipulation/tempo effects -- otherwise every future Root-flavored
Mod repeats exactly the gap finding 1 just found in the current 17 (none
of them are Root-flavored at all; Rootkit Persistence is Root but its
`instantManipulation`/`enemyGauge` payload only suppresses the *enemy's*
gauge, never credits the caster's own). This is the same lesson the
session 24-25 Root mechanical redesign already had to learn for
subroutines themselves (Root's payloads needed real gauge-touching teeth,
not just recon/manipulation, before Saboteur/Operator/Ghost's win rates
moved off the floor) -- applies identically to Mods now that the pool is
expanding past the 17-item validation sample.

**Also banked, same conversation**: Encryption-themed Mods specifically
should lean into more shield-bash-style mechanics -- converting a side's
own already-cast mitigation (Ward/instantCounterPush/HoT) into a real,
uncapped credit, the same pattern Circuit Breaker (session 28's Neutral
Archetype rare, see `DESIGN.md`'s Neutral Archetype section) already
established via the `mitigationBanked` Accumulator metric
(`triggers.ts`'s `updateMitigationBankedState`, fed from `resolve.ts`'s
`creditMitigationBanked`). Encryption's payloads are deliberately capped
at the Breach/Containment midpoint by design (`DESIGN.md`: "can only
stabilize, never win alone," Ghost's Return to Sender being the one
bypass) -- shield-bash is the established, already-proven way an
Encryption-flavored piece gets a real closer without breaking that
constraint, so future Encryption Mods should reuse it rather than
inventing new pure-defense-only content that runs into the same
never-closes-alone wall Legacy Firewall/Zero Trust Node/Firewall Prime
all hit before their own session-28 neutral-piece retrofits.

**Also banked, same conversation**: class-specific random Events that
offer an *upgraded* version of that class's own starting Mod (Foothold,
Zero Day, Sleeper Cell, Primed, Feedback Loop, Return to Sender -- the 6
migrated onto Mod infrastructure this session, `mods.ts`). Two real
prerequisites this depends on, both already banked separately and still
undesigned: **Event nodes' own design** (banked since session 3,
`DESIGN.md`/`BACKLOG.md` Phase 0/3, still just a stub `inert` no-op in
`encounters.ts`) and a genuinely **new Mod-upgrade mechanism** -- Mods
have no Merge-style rank/magnitude-upgrade path at all today (session
30's deliberate scope reduction: "uncapped ownership... no Merge-style
duplicate-material system," since a Mod can only ever be owned once).
An "upgraded starting Mod" would need either a second, stronger
`ModDefinition` per class-exclusive Mod that a class-specific Event can
grant as a *replacement* (swapping the id in `ownedModIds`, closer to
how `onModAcquired`'s granted-subroutine mechanism already replaces/
inserts), or a new per-Mod magnitude-scaling concept Mods don't have at
all yet. Not designed here -- flagged as real scoping work for whenever
Event nodes themselves finally get designed, not a small follow-on to
either the Root or Encryption notes above.

---

**Burners -- design shape settled (session 36, `/decision-session`).**
Full reasoning in `DESIGN.md`'s new "Burners" subsection under
Meta-Progression; this is the implementation-facing summary. Directly
answers the user's own "are consumables even the right fit" question,
raised going into this session -- resolved yes, deliberately reframed
away from a direct StS-Potion port.

Resolved live, one decision at a time:

- **Niche**: manual, player-activated-at-will items -- the one gap left
  by subroutines (automatic/trigger-gated) and Mods (passive/permanent).
  Named **Burners**, after the real disposable-phone term.
- **Activation timing: own-turn only**, not anytime-mid-hand -- the
  anytime version needs the engine's turn/hand-resolution loop to become
  pausable/resumable, the same gap already banked since session 24 for
  human-vs-AI play. Deliberately deferred rather than half-built now.
- **Three usable contexts, one unified item pool**: combat (single-fire
  subroutine-payload-shaped effect), map (free move / reveal / reopen a
  closed node -- resolves the session-9 banked node-bypass idea), Shop
  (discount/reroll/rarity-floor coupon). Each Burner definition tags
  which context(s) it's usable in, the same way a subroutine carries a
  trigger family -- not three separate item systems.
- **Inventory: capped, no bench/installed split** -- mirrors StS's 2-3
  potion slots and the subroutine loadout's own slot-scarcity tension,
  unlike Mods' uncapped ownership (justified specifically by having no
  such tension). No bench split either, since a Burner is picked up and
  immediately usable, unlike subroutines' bank-as-Merge-material bench.
- **Acquisition**: combat rewards from all fight tiers (regular
  included, unlike Mods' elite-only) + a Shop slate (third, alongside
  subroutine/Mod slates) + Events (below) as the flavor-heavy primary
  source.
- **Pool scoping & rarity**: archetype-agnostic by default (like Mods);
  common/uncommon/rare, matching existing tiering.

**Deliberately not touched this session** (shape, not library): concrete
named Burner content; the exact combat-context payload catalog (likely
reuses the subroutine payload catalog wholesale, not confirmed); exact
numbers (slot cap, rarity distribution, pricing).

---

**Events -- design shape settled (session 36, `/decision-session`).**
Full reasoning in `DESIGN.md`'s new "Events" subsection under
Meta-Progression; this is the implementation-facing summary. Closes the
last undesigned Phase 3 stub node type -- Merge and Shop both got real
design/implementation in Phase 4; Event never did, banked since
session 3/7.

Resolved live, one decision at a time:

- **Paradigm**: narrative vignette + 2-4 choices, resolved instantly, no
  Cribbage played. Considered and rejected: a mini Cribbage-mechanical
  challenge (reinforces the "everything resolves via real Cribbage"
  identity more directly, but is genuinely new engine work, not
  content); a pure reward-reveal with no real choice (doesn't clearly
  earn being distinct from Relay).
- **Risk model: a deliberate per-choice mix**, not a global rule -- each
  choice carries a `riskTier`: `transparent` (exact numbers stated),
  `visibleOdds` (probabilistic, odds/range shown), or `gamble`
  (genuinely uncertain). A single Event can mix tiers across its own
  options. `gamble` is a deliberate, *contained* exception to this
  project's otherwise fully-transparent house style (Heat costs, gauge
  thresholds, bank counts are all stated elsewhere) -- confined to
  Events specifically so Heat's own legibility (the free-roam
  movement/per-move-cost model depends on real risk math) stays intact
  everywhere else.
- **Risk tier gates reward ceiling**: transparent = modest/safe,
  visibleOdds = moderate/variance, gamble = the only tier where the
  pool's most powerful outcomes (rare Mod/Burner, big Data, reopening a
  closed node) can appear -- mirrors rarity gating power elsewhere,
  applied to risk instead of acquisition cost.
- **Effect pool**: reuses existing resources/mechanisms wholesale (Heat
  delta, Data delta, subroutine/Mod/Burner grant, a bonus fight) -- no
  new resource type.
- **Node-state behavior**: inert after one resolution, same as
  Safehouse/Shop since session 19; no entry tax beyond the existing flat
  per-move Heat cost.

**Deliberately not touched this session** (shape, not library): concrete
named Events; exact odds/numbers; per-contract Event reskinning; the
class-specific-Event-grants-upgraded-Mod idea banked at session 34
(Events existing is now satisfied, but it still needs a second
prerequisite -- a Mod-upgrade mechanism, since Mods have no Merge-style
rank path).

**Both now unblocked**: a future engineering-scoping session (mirroring
sessions 15/17/19/21/27/33) can turn Burners' and Events' shape into
real implementation checkpoints. Concrete content-authoring (named
Burners, named Events) is a separate future pass either way, same
"shape -> content -> implementation" split every other content system in
this project has followed.

---

**Burners + Events Implementation ✅ complete (session 37 scoped,
session 38 implemented and verified)** -- checkpointed implementation
spec, same category as sessions 15/17/19/21/27/33, directly continuing
session 33's own precedent for Mods (shape -> hook catalog -> content
validation -> implementation spec). All checkpoints A-J below shipped
in session 38 (`/dev-session`) -- see this file's own top "NEXT SESSION"
section and `session-logs/session-38-2026-08-28.md` for the full
implementation writeup, including two real gaps checkpoint J's own
verification found and fixed (`eventChoiceStrategy`/
`burnerActivationStrategies` never threaded through `RunOptions`, and
the `noRouteRemains` check running before Skeleton Key ever got a
chance to reopen a node). Spec below is kept as-authored (session 37)
for the historical checkpoint-by-checkpoint reference.

Explored the actual engine (`resolve.ts`, `triggers.ts`, `combat.ts`,
`subroutine-types.ts`, `mod-types.ts`/`mods.ts`, `gauges.ts`, `run.ts`,
`encounters.ts`, `shop.ts`, `loadout.ts`, `merge.ts`, `heat.ts`,
`map-types.ts`/`map-gen.ts`, `traversal.ts`, `ai.ts`) before proposing
anything. Key findings:

- **No existing precedent for a mid-combat, player-chosen "activate
  now" decision.** Every current strategy is either a per-hand AI call
  (`DiscardStrategy`/`PlayStrategy`/`CutStrategy`) or a run-level "pick
  1 of N offered" choice (`AcquisitionStrategy`/`ShopStrategy`/etc.).
  Burners need a genuinely new strategy shape -- but it fits the
  existing convention cleanly: every strategy today is its own
  separate, loosely-typed optional field on `CombatOptions`/
  `RunOptions` (confirmed: no unified `strategies: {...}` wrapper
  exists anywhere), so a new field is idiomatic, not a departure.
- **Combat-context Burner effects reuse `PayloadEffect` directly** via
  `resolvePayloadCore` (`resolve.ts`) -- confirms what session 36's
  `DESIGN.md` write-up flagged as "not confirmed." No new payload kinds
  needed for combat.
- **"Reopen a closed node" is a real engine gap, not just content.**
  `NodeState` (`map-types.ts`) only ever transitions `unresolved ->
  inert` or `unresolved -> closed` today -- no reverse transition
  exists anywhere. **Resolved live**: reopening sends the node back to
  `unresolved` (must be won again), not straight to `inert` (no free
  pass) -- matches the session-9 "recoverable, not automatic" framing.
- **No capped-unordered inventory exists anywhere** -- subroutines'
  bench is uncapped, Mods' `ownedModIds` is uncapped. Burners' carried
  set is new state on `RunPlayerState`, not a variation of something
  reusable.
- **Content-validation pass, done this session for both systems**
  (mirroring Mods' session 32): 8 concrete Events (spanning all 3 risk
  tiers) and 8 concrete Burners (spanning both new effect unions) were
  drafted and checked against the proposed type shapes. The Event
  sample surfaced a real gap -- a reward grant can't hardcode a
  specific piece id as the pool grows, so grants need to support either
  a named piece or a random draw filtered by rarity (built into
  checkpoint G below). The Burner sample found no gap -- confirms
  checkpoint A's shape rather than just filling it out, mirroring how
  session 32 also confirmed a near-miss (`onRunStart`) wasn't actually
  needed.

**The 8 validated Events** (full table in `DESIGN.md`'s "Events"
subsection is the design-level summary; this is the content itself):
Dead Man's Switch (all 3 risk tiers on one vignette -- Defuse/
Repurpose/Detonate), Abandoned Session (pure-transparent), Vendor
Backdoor (transparent no-op / visibleOdds), The Whistleblower
(transparent no-op / gamble), Salvage Run (transparent no-op / gamble
-> bonus fight), Compromised Coworker (transparent / visibleOdds),
Encrypted Cache (transparent no-op / gamble), Rival Hacker's Dead Drop
(all 3 tiers, 3 choices). Coverage: all 3 risk tiers, every effect kind
(Heat delta, Data delta, subroutine/Mod/Burner grant, bonus fight), both
random-draw and specific grants.

**The 8 validated Burners**: Flash Drive (Common, combat, `directBurst`
-- confirms Exploit-catalog reuse), EMP Charge (Uncommon, combat,
`instantCounterPush` -- confirms Encryption-catalog reuse too), Recon
Ping (Common, map, `revealUpcoming`), Ghost Protocol (Uncommon, map,
`freeMove`), Skeleton Key (Rare, map, `reopenClosedNode` -- the
session-9 payoff), Stolen Coupon (Common, shop, `discount`), Loyalty
Token (Uncommon, shop, `freeReroll`), Insider Tip (Rare, shop,
`rarityFloor`). Coverage: both new effect-kind unions exercised by all 3
of their own kinds each, plus 2 archetypes' worth of reused
`PayloadEffect` kinds.

**Burners -- checkpoints A-F:**

- **A -- Type system** (`burner-types.ts`, new, mirrors
  `mod-types.ts`): `BurnerId`; rarity (reuse common/uncommon/rare);
  `BurnerContext = 'combat' | 'map' | 'shop'` (a Burner can carry more
  than one); `BurnerDefinition { id, name, rarity, contexts:
  BurnerContext[], combatEffect?: PayloadEffect, mapEffect?:
  MapBurnerEffect, shopEffect?: ShopBurnerEffect }`. Two new small
  effect-kind unions: `MapBurnerEffect = { kind: 'freeMove' } | { kind:
  'revealUpcoming' } | { kind: 'reopenClosedNode' }`; `ShopBurnerEffect
  = { kind: 'discount'; fraction: number } | { kind: 'freeReroll' } |
  { kind: 'rarityFloor'; rarity: Rarity }`. Validated against the
  8-Burner sample above -- confirmed, no changes needed.
  `burners.ts` (new, mirrors `mods.ts`'s data half) holds the 8
  validated `BurnerDefinition`s as real data.
- **B -- State threading**: `RunPlayerState` gains `carriedBurnerIds:
  BurnerId[]` + `BURNER_CAP` (TBD/playtesting, same discipline as
  `INSTALLED_SLOT_CAP`). New `acquireBurner(playerState, burner):
  boolean` (`burners.ts`, mirrors `acquireMod`'s shape but cap-
  enforced, no bench/material fallback -- declines if full, no swap
  mechanism this pass). `CombatOptions`/`CombatState` gain
  `carriedBurnerIds: BurnerId[]` (a snapshot at combat start, filtered
  to `contexts.includes('combat')`) and combat-local
  `burnersUsedThisCombat: BurnerId[]`, surfaced on `CombatResult` so
  `run.ts` can remove used Burners from `RunPlayerState.
  carriedBurnerIds` once the fight resolves -- mirrors how Heat/other
  side-effects already surface via `CombatResult` rather than mutating
  `RunPlayerState` mid-combat.
- **C -- Combat-context activation**: new `BurnerActivationStrategy =
  (ctx: BurnerActivationContext) => BurnerId | null`, matching every
  other Strategy type's shape. `CombatOptions` gains
  `burnerActivationStrategies?: [BurnerActivationStrategy,
  BurnerActivationStrategy]` (side 1/enemy always `() => null` --
  player-only economy, like Heat). Called once per own-turn in
  `combat.ts`'s `step()`, **before** that turn's automatic
  `fireReadySubroutines` call (stated, not asked -- an "opening move"
  framing). Effect application calls `resolvePayloadCore` directly
  against the chosen Burner's `combatEffect` -- no new payload-dispatch
  code needed.
- **D -- Map-context activation + the reopen-closed-node capability**:
  `map-types.ts` gains the new `closed -> unresolved` transition (the
  real engine gap found in exploration). New `MapBurnerStrategy`
  (mirrors `TraversalStrategy`'s shape), called once per traversal
  decision in `run.ts`'s loop, before the existing `traversalStrategy`
  call. `freeMove` skips the flat `HEAT_PER_MOVE` charge for that move;
  `reopenClosedNode` needs a target node id -- the strategy context
  needs the current graph's closed-node list to choose from.
- **E -- Shop-context activation**: new `ShopBurnerStrategy` (mirrors
  `ShopStrategy`/`ModShopStrategy`'s shape), called in `encounters.ts`'s
  `shop` case before slate generation. `discount`/`rarityFloor` extend
  the existing `shopModifiersForOwnedMods`-style computation (`mods.ts`)
  with a parallel Burner-sourced modifier; `freeReroll` sets that
  visit's reroll cost to 0 for one reroll.
- **F -- Acquisition wiring**: extend `resolveFight`'s reward-drawing
  logic (`encounters.ts`) to also draw `burnerRewardOptions` for **all**
  fight tiers, regular included (unlike Mods' elite-only). New
  `BurnerAcquisitionStrategy` (mirrors `AcquisitionStrategy`/
  `ModAcquisitionStrategy`) in `RunOptions`, respects the checkpoint-B
  cap. Plus a third independent Shop slate mirroring the subroutine/Mod
  slate pattern in `shop.ts` exactly: `burnerOfferingsForClass`,
  `BurnerOffering`, `BurnerShopStrategy`/`BurnerShopRerollStrategy`,
  reusing the existing `REROLL_COST`. `EncounterOutcome` gains
  `burnerRewardOptions: BurnerDefinition[]`, `burnerShopPurchase`,
  `burnerRerollCost` -- mirroring the existing subroutine/Mod fields.

**Events -- checkpoints G-I:**

- **G -- Type system, incorporating the validation-pass fix**
  (`event-types.ts`, new): `EventDefinition { id, name, choices:
  EventChoice[] }`; `EventChoice { id, label, riskTier: 'transparent' |
  'visibleOdds' | 'gamble', outcomes: WeightedOutcome[] }` (a
  `transparent` choice is one outcome at probability 1;
  `visibleOdds`/`gamble` differ only in whether the UI states the
  odds -- the engine treats both identically, resolving by weighted
  roll against `rng`). `WeightedOutcome { probability: number; effect:
  EventEffect }`. `EventEffect = { heatDelta?: number; dataDelta?:
  number; subroutineGrant?: Grant<SubroutineDefinition>; modGrant?:
  Grant<ModDefinition>; burnerGrant?: Grant<BurnerDefinition>;
  bonusFight?: { tier: 'regular' | 'elite' } }` where **`Grant<T> = {
  specific: T } | { randomFromRarity: Rarity }`** -- the validation-pass
  fix, resolved against the existing archetype/class-scoped pool logic
  at resolution time, not authoring time. `events.ts` (new, mirrors
  `enemies.ts`'s roster-of-data pattern) holds the 8 validated
  `EventDefinition`s as real data.
- **H -- Choice resolution**: replaces `encounters.ts`'s current
  one-liner `case 'event':` stub (today: always-inert, all-zero
  outcome, no strategy, no rng use) with real resolution. New
  `EventChoiceStrategy = (event: EventDefinition, playerState:
  RunPlayerState) => EventChoice` (mirrors the Shop/Acquisition
  strategy shape) picks a choice; its `outcomes` are rolled against
  `rng` (already threaded into `resolveEncounter`'s signature -- no new
  plumbing needed); the result is translated into the existing
  `EncounterOutcome` fields (`heatDelta`, `dataAwarded`, `newState:
  'inert'` always) plus one new field, `eventGrant?: { subroutine?:
  SubroutineDefinition; mod?: ModDefinition; burner?: BurnerDefinition
  }` -- deliberately distinct from checkpoint F's `*RewardOptions`
  fields, since an Event grant is a direct single item, not an offered
  N-of-M pick.
- **I -- Bonus-fight resolution**: a `gamble`-tier `bonusFight` effect
  needs to resolve a real fight from inside the `event` branch. Reuse
  `resolveFight`'s existing machinery rather than duplicating it --
  likely needs `resolveFight` extracted into a small internally-
  callable helper independent of the `node.type` switch, since today
  it's only ever invoked from the `regularFight`/`eliteFight`/
  `gatekeeperFight` branches. Same `discardStrategies`/`playStrategies`
  params `resolveEncounter` already threads through get reused. The
  bonus fight's own outcome folds directly into the same
  `EncounterOutcome` being built for the Event node -- no new nested
  `CombatResult` field, matching session 31's "reuse the struct, don't
  add a hook" reasoning. Bonus-fight reward magnitude is
  TBD/playtesting.

**File organization** (stated, not asked -- precedent already points
one way): `burner-types.ts` + `burners.ts` (new pair, mirrors
`mod-types.ts`/`mods.ts` exactly); `event-types.ts` + `events.ts` (new
pair, but `events.ts` is a roster-of-data file like `enemies.ts`, not a
dispatch file -- Event *resolution* logic lives directly in
`encounters.ts`'s extended `event` case, since there's no registry/
hook-fan-out shape here the way Mods needed one). Combat-context Burner
activation lives in `combat.ts` (a per-turn strategy call, not a
passive-hook dispatch), but effect application calls into `resolve.ts`'s
existing `resolvePayloadCore`. Map-context logic lives in
`traversal.ts`/`map-types.ts`. Shop-context logic extends `shop.ts`
directly.

- **J -- Verification**: new `burners.test.ts`/`events.test.ts`
  (mirrors `mods.test.ts`'s approach): every new strategy type
  exercised at least once, all 8 authored Burners fired/activated at
  least once across their contexts (including the reopen-closed-node
  transition covered directly -- a hand-built graph with a closed node,
  same style `gatekeeperReachable()` got its own direct unit test in
  Phase 3), all 8 authored Events resolved at least once each
  (transparent/visibleOdds/gamble paths and the bonus-fight path all
  hit), zero regression across the full existing suite. A smoke-tested
  full `playRun()` with Burners carried/used and Events resolved across
  a full run, mirroring `mods.test.ts`'s own full-run smoke test.

**Not done this session (session 37 -- superseded, see the ✅ complete
note above)**: no code -- this is a scoping session, same as sessions
15/17/19/21/27/33; a future `/dev-session` implements these checkpoints.
No further content authoring beyond the 8+8 validated samples above.
Exact numbers (`BURNER_CAP`, bonus-fight reward magnitude, discount/
reroll/rarity-floor values) all TBD/playtesting -- **still true after
session 38**: implementation shipped the 8+8 validated samples exactly
as authored, no new content, and none of these placeholder numbers were
touched (the balance-pass fixes session 38 also made were to existing
Blackhat/Breacher subroutine magnitudes, unrelated to Burners/Events).

**Independent Per-Side Gauge/Win Thresholds -- Implementation ✅ complete
(session 40, `/decision-session` scoped and `/dev-session` implemented,
same day)** -- checkpointed implementation spec, same category as
sessions 15/17/19/21/27/33/37, taken ahead of the gatekeeper balance pass
at the user's own explicit request (see this file's top "NEXT SESSION"
section and the "Session 40" log entry, above, for the two decisions
resolved live and the reasoning behind them). All checkpoints A-F below
shipped same-day: 572/572 tests passing (from 564, 8 new -- 4 covering
`gaugeThresholdFor`/`winThresholdFor` in `enemies.test.ts`, 4 covering
`adjustSideWinThreshold` in `resolve.test.ts`), `npm run check` clean.
Checkpoint F's own regression sweep (50 seeds, `opportunistic`
traversal, every class) came back byte-identical before/after -- "zero
behavior change" held exactly as scoped, since every gatekeeper's
override was left unset per checkpoint B. One real implementation
finding beyond the spec's own scope, caught by `npm run check` rather
than left latent: `resolve.test.ts`/`mods.test.ts`/`enemy-
passives.test.ts` also call `createCombatState` *directly* (not just
through `playCombat`), several with a 4th positional `classId` arg and a
5th positional `winThreshold` arg -- the spec's own file list (checkpoint
E) named the `playCombat`-based test files by object-literal `gaugeThreshold:`/
`winThreshold:` keys, which a grep for that exact string pattern doesn't
catch when the same values are passed positionally. All ~150 additional
call sites across those 3 files migrated the same mechanical way. Spec
below is kept as-authored (session 40) for the historical
checkpoint-by-checkpoint reference.

Explored `gauges.ts`, `resolve.ts`, `combat.ts`, `encounters.ts`,
`enemies.ts`, and `scripts/gatekeeper-check.ts` before proposing
anything. Key findings:

- **`DuelGauge`/`InitiativeGauge` (`gauges.ts`) already store `progress`/
  `threshold` per side as independent objects** -- nothing about the
  underlying data structure forces symmetry. The sharing happens one
  layer up: `createCombatState`/`createCombatSideState` (`resolve.ts`)
  take a single `gaugeThreshold`/`winThreshold` number and pass the exact
  same value to both sides' `createCombatSideState` calls. This checkpoint
  set only needs to remove that artificially-imposed symmetry, not touch
  `gauges.ts` itself.
- **`magnitudeScaler` (session 39, `enemies.ts`) is an exact structural
  precedent to mirror**: an optional field on `EnemyDefinition`,
  gatekeeper-only (they never repeat across layers, so a stored
  per-identity value makes sense in a way it wouldn't for regular/elite),
  defaulting to no-scaling when unset, read through one shared
  `magnitudeScalerFor(enemy, layerIndex, fightsResolved)` accessor used
  by both `encounters.ts` and `scripts/gatekeeper-check.ts`. Threshold
  overrides follow the identical shape.
- **`onCombatStart` (session 31, `resolve.ts`'s
  `applyModOnCombatStartPassives`) is already real and already used**
  (Warm Boot) -- fires once per fight, right after `createCombatState`,
  before the first hand and therefore before `combat.ts`'s
  `applyEscalation` ever shrinks a threshold. The natural, lowest-risk
  hook for a threshold-adjusting Mod: no ordering question against
  escalation to resolve, since it always runs first.
- **`scripts/gatekeeper-check.ts` duplicates `encounters.ts`'s own
  `playCombat` call site** (its own `scaledEnemyLoadout`/
  `magnitudeScalerFor` usage, not a call through `resolveFight`) --
  needs the identical threshold-accessor wiring as `encounters.ts`
  itself, not just a mention.
- **~30 existing call sites pass a bare scalar** for `gaugeThreshold`
  and/or `winThreshold`: `combat.test.ts`, `subroutines.test.ts`,
  `burners.test.ts`, `scripts/sweep.ts`, `scripts/cribbage-skill-
  matrix.ts`. Every one needs mechanical migration to the new tuple
  shape -- no dual-type shim kept around to avoid touching them.

**Checkpoints:**

- **A -- Type shape** (`combat.ts`, `resolve.ts`): `CombatOptions.
  gaugeThreshold` changes from `number` to `[number, number]` (still
  required); `CombatOptions.winThreshold` changes from `number` to
  `[number, number]` (still optional, default `[100, 100]`, same default
  magnitude as today's shared `100`). `createCombatState`/
  `createCombatSideState` (`resolve.ts`) take the per-side pair and pass
  each side's own number to its own `createCombatSideState` call, instead
  of the same scalar to both. `gauges.ts` itself is unchanged.
- **B -- Enemy-side authoring** (`enemies.ts`): `EnemyDefinition` gains
  two new optional fields, `gaugeThreshold?: number` and `winThreshold?:
  number`, gatekeeper-only by convention (mirrors `magnitudeScaler`'s own
  doc-comment reasoning exactly). Every existing gatekeeper leaves both
  unset in this checkpoint -- that's what makes this session a zero
  behavior change. Two new accessor functions, `gaugeThresholdFor(enemy,
  layerIndex, fightsResolved): number` and `winThresholdFor(enemy,
  layerIndex, fightsResolved): number`, mirroring `magnitudeScalerFor`'s
  exact shape: a gatekeeper reads its own stored value (falling back to
  the existing flat `GAUGE_THRESHOLD`/`WIN_THRESHOLD` constants when
  unset); regular/elite always return the flat constant, full stop -- no
  per-layer formula the way magnitude gets one (a real, separate future
  balance question, deliberately out of scope here per the "plumbing
  only" decision).
- **C -- Wiring** (`encounters.ts`, `scripts/gatekeeper-check.ts`): both
  call sites that build the `playCombat` options object change
  `gaugeThreshold: GAUGE_THRESHOLD, winThreshold: WIN_THRESHOLD` to
  `gaugeThreshold: [GAUGE_THRESHOLD, gaugeThresholdFor(enemy, layerIndex,
  fightNumber)], winThreshold: [WIN_THRESHOLD, winThresholdFor(enemy,
  layerIndex, fightNumber)]` -- player side (index 0) always the flat
  constant, enemy side (index 1) resolved per-identity. Both call sites
  need the identical change (per the `gatekeeper-check.ts` finding
  above).
- **D -- Dynamic hook** (`resolve.ts`): extend the existing
  `onCombatStart` fold (today: just `applyModOnCombatStartPassives`'s
  single Warm Boot check) with a second case that can adjust a side's own
  `winGauge.threshold`, reusing `gauges.ts`'s existing
  `shrinkDuelThreshold` (already exactly "shrink a gauge's threshold,
  floored") rather than inventing a new gauge primitive. A
  threshold-raising counterpart (`growDuelThreshold`) is not built this
  checkpoint -- nothing needs one yet, and `shrinkDuelThreshold` alone is
  enough to prove the mechanism reaches the right field. No real Mod is
  authored or shipped here -- verified by a synthetic test-only Mod id
  exercised directly in `resolve.test.ts`, proving the hook can actually
  reach and mutate `CombatSideState.winGauge.threshold` via the same
  `hasMod`/`replaceSide` pattern every other Mod hook already uses, not a
  new entry in `mods.ts`.
- **E -- Migrate existing call sites** (`combat.test.ts`,
  `subroutines.test.ts`, `burners.test.ts`, `scripts/sweep.ts`,
  `scripts/cribbage-skill-matrix.ts`): every bare-scalar `gaugeThreshold`/
  `winThreshold` becomes a symmetric tuple (`gaugeThreshold: 5` ->
  `gaugeThreshold: [5, 5]`) -- purely mechanical, preserves every existing
  test's actual intent (both sides sharing one threshold), no shimmed
  dual-type support kept around afterward.
- **F -- Verification**: full suite green (542 tests today, plus
  whatever coverage checkpoints B/D add -- mirrors `enemies.test.ts`'s
  own `magnitudeScalerFor` coverage for the new accessors, plus D's
  mechanism test), `npm run check` clean. A same-seed regression check,
  same discipline as session 35's own precedent: run a sweep (or a
  smaller seed sample) before and after this lands, confirm bit-identical
  win rates with every gatekeeper's override left unset -- the whole
  point of "plumbing only" is that this checkpoint should show zero
  measured change.

**Not done this session**: no code -- this is a scoping session, same as
sessions 15/17/19/21/27/33/37. No gatekeeper gets a real `gaugeThreshold`/
`winThreshold` override authored (checkpoint B's fields all stay unset) --
that's the balance pass this work was explicitly built to unblock,
sequenced after, not part of it. No real Mod ships using checkpoint D's
hook -- the mechanism is proven, not used. Regular/elite per-layer
threshold scaling (the magnitude-style formula) is flagged as a real,
separate future question, not decided here.
