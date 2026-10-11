# Archetype & subroutine redesign — working decision record

Session 51 (`/decision-session`, 2026-10-11). Builds on
`docs/run-economy-design.md` D11–D15 (every subroutine fires every turn;
triggers modulate rather than gate). **Folded into `DESIGN.md` →
Archetypes & Subroutines in step 1, checkpoint 1**; this file remains
the decision trail.

## Framing (from the user)

- Every subroutine has two effects. **Alpha**: fires on every turn
  activation. **Beta**: fires on turn activation when its criteria are
  met. A beta may be a different effect, an enhancement of the alpha, or
  (for criteria-triggered pieces) fire the moment its criteria are met,
  disconnected from the turn.
  - Maps onto D11/D12: alpha = floor, beta = rider; the three beta shapes
    match D12's condition/charge, added mechanic, and extra fire.
- Every archetype needs an **offensive theme** (how it moves the player
  toward winning) and a **utility effect** (how it empowers the player:
  defense, empowering other subroutines, "healing", etc.).

## Inventory (proposed buckets, not contested by the user)

- **Keep**: Cribbage engine, initiative turn gate, Breach/Containment,
  Heat/Trace (D1–D7), map structure, Burners, Events, Mods system,
  loadout ordering/adjacency (D13), slot cap and bench.
- **Redesign**: the 4 archetypes, subroutine pool (alpha+beta), classes
  and passives, starting loadouts, enemy kits/roster, Merge, the
  trigger-easing Mods (Overclocked Accumulator, Threshold Exploit, Primed).
- **Simplify**: payload catalog (~22 kinds), trigger catalog, tags,
  debuffs, recon hand-lifecycle timing and scheduled sabotage.
- **Remove**: Neutral archetype, Togglable, dead Cribbage-layer bits
  (peekCrib, markSuit/skewCut, His Heels as a trigger).

## Decisions

### A1 — Four archetypes, still bound 1:1 to the four suits ✅

Suits stay four and stay named identically to their archetype. The
archetype *themes* are designed from scratch — names, icons and colours
follow the new themes rather than carrying over Exploit/Malware/
Encryption/Root.

### A2 — Mechanics first: four offense themes × four utilities ✅

Archetypes are built from a win route and a utility, named only after.
The old archetypes were role/flavour-first, which is how two of four
ended up with no win path.

| Archetype | Offensive theme | Utility | Why they pair |
|---|---|---|---|
| (TBD) | **Spike** — big beta moments on Cribbage scoring | **Control** — Cribbage layer, enemy tempo | Steer the cards toward the spike |
| (TBD) | **Ramp** — alpha strengthens as the fight runs | **Healing** — push the enemy's gauge back | Survive long enough to scale |
| (TBD) | **Tempo** — win by taking more turns | **Empowerment** — buff other subroutines | More turns × stronger fires |
| (TBD) | **Conversion** — turn other resources into own progress | **Defense** — stop enemy gain before it lands | Banked defense is the fuel |

Each archetype's own suit tally is a natural beta charge source.

**Watch item (user):** Conversion/Defense is accepted as the
higher-skill-floor archetype, but it is the pairing most at risk of
repeating the old Encryption problem — defense that never converts.
Check it explicitly when its subroutines are authored and when the
pillars price it.

### A3 — Signature beta shape per archetype (affinity, not exclusivity) ✅

| Theme | Typical alpha | Signature beta | Beta charge source |
|---|---|---|---|
| Spike / Control | small credit or control nudge | **enhance** — banked charges, big fire | Cribbage occurrences |
| Ramp / Healing | credit that grows per fire | **different effect** — healing rider at a growth step | points / fire count over the fight |
| Tempo / Empowerment | small credit or buff-the-next | **immediate** — extra fire outside the turn | own turn rhythm (dealer, initiative) |
| Conversion / Defense | Ward (+ credit, see rule) | **different effect** — spend banked defense as credit | state: shield size, enemy gauge |

Primary affinity, like the old trigger catalog — other shapes are allowed
where a piece calls for them.

**Credit rule, archetype-level (user's refinement).** Not every
subroutine must credit the win gauge, but every *archetype* must have a
reliable way to move toward winning on its own. Checkable form: a kit
drawn from one archetype's commons (and every class's starting loadout)
must have a real credit path. This is the rule whose absence produced
Ghost's 0% (session 28) and the Encryption/Root audit (session 40).

### A4 — Payloads are six shared verbs ✅

| Verb | Does | Primary user |
|---|---|---|
| **Credit** | fill own gauge | everyone (offense) |
| **Suppress** | push enemy gauge back | Healing |
| **Ward** | absorb enemy's incoming progress | Defense |
| **Empower** | boost other subroutines' output | Empowerment |
| **Tempo** | haste own initiative / slow enemy's | Tempo, Control |
| **Disrupt** | Cribbage layer: recon, forced discard | Control |

Folded away: DoT/HoT/draining-HoT (an alpha already fires every turn;
global pulse was the Quarantine Ward pathology); piercing,
chain-finisher, risk/reward become Credit beta modifiers; Ward Counter,
Ward Bash, Session Hijack become Conversion betas; debuffs become lasting
Tempo/Suppress (retiring the dead debuff `magnitude`); scheduled
sabotage and hand-lifecycle recon timing removed unless Control needs
them back as Disrupt betas. Archetype identity lives in betas, not kinds.

### A5 — Beta criteria are source × shape ✅

**Sources:** Cards (occurrence category, suit tally; optional watch-side
and minimum magnitude absorb `rareOccurrence`), Progress (own points,
own fire count, defense absorbed), State (dealer/non-dealer, Ward size,
either gauge's level), Sequence (D13 adjacent / any-prior chains).

**Shapes:** graded (per charge, capped), stepped (distinct effect at N),
while-true (condition = 1 charge, D15), immediate (fires the moment the
criteria are met, outside the turn).

Cut: `handOutcome`, His Heels as a trigger, Trace conditions (Trace
survives as a beta *cost* modifier), Togglable.

Added: an optional alpha `growth` (+x per fire) — Ramp's offensive
theme needs it.

**Alpha may be purely a charging mechanism (user).** An alpha does not
have to act on either gauge; "add charges to this piece's (or another
piece's) beta" is a legitimate alpha. Consistent with A3's credit rule,
which is archetype-level. In verb terms this is a seventh verb,
**Charge**, distinct from Empower (Empower boosts output, Charge feeds
criteria) — it absorbs the old Background Process / accumulator-feeding
pieces.

### A6 — Tags removed ✅

Mods and chains hook onto archetype, verb, source and shape instead —
dimensions every piece carries by construction, so nothing can be
mis-tagged. Flavour names (Daemon, Worm…) may return later as UI display
labels for a combination, never as authored data.

### A7 — Names and suit identities ✅

| Theme | Archetype / suit | Icon | Colour (decided in passing) |
|---|---|---|---|
| Spike / Control | **Exploit** | Bug | Magenta-red (the old pink/purple shift; also clears red/green proximity) |
| Ramp / Healing | **Daemon** | Gear / cog | Green |
| Tempo / Empowerment | **Overclock** | Lightning bolt | Electric cyan |
| Conversion / Defense | **Honeypot** | Honey jar | Amber / gold |

Malware, Encryption and Root are retired. Exploit keeps its name because
its theme barely moved; old references to it now mean the Spike/Control
archetype. "Overclock" is the name D12 rejected for elevation precisely
because it means *faster* — which is what Tempo is.

### A8 — Six classes, one per archetype pair, each with a bridge passive ✅

Exploit+Overclock, Exploit+Daemon, Daemon+Overclock, Exploit+Honeypot,
Daemon+Honeypot, Overclock+Honeypot. Each class passive is a **bridge**:
it makes one of its archetypes feed the other (e.g. "your A betas add a
charge to your B pieces"), the Primed/Sleeper Cell pattern. Cutting the
roster was rejected — session 49 placed ~2/3 of class spread in the
gatekeeper roster, not the classes. Names, passives and unlock order wait
for real subroutines; provisional ordering puts Exploit+Overclock first
and Honeypot pairs late (A2 watch item).

### A9 — Starting loadout: 3 pieces (offense, utility, bridge) ✅

One **offense** piece with a credit path (A3's rule holds from turn one),
one **utility** piece from the other archetype, one **bridge** piece
showcasing the class passive. Leaves 3 of 6 slots open for acquisition,
which matters more now that slot order is a puzzle (D13). The Cantrip
slot is retired — under D11 every piece is per-turn. Which archetype
supplies offense vs utility is decided per class at authoring time; for
Honeypot pairs, offense likely comes from the partner archetype.

### A10 — Sequencing: engine refactor → recalibrate → author ✅

1. **Engine refactor** to seven verbs + source × shape, alpha `growth`,
   removals; **`DESIGN.md` restructure folded in** (the ~700 superseded
   lines are replaced, not patched).
2. **Recalibrate**: pillar suite re-aligned one-per-verb (DoT-Points and
   Throttle retire; Ward, Empower, Disrupt, Charge gain pillars), then
   run-economy checkpoints 3–6 to price an alpha and a beta.
3. **Author**: archetype subroutines → classes → enemies.

Matches D10/D11's commitment that pillars are the authoring template.
`BACKLOG.md`'s next phase changes from "class audit" to this sequence.

### A11 — A skeleton pool stands in during calibration ✅

The pillar harness measures against real accumulated player state, which
needs a pool to accumulate from. Step 1 ships a **skeleton pool**: one
plain piece per archetype per verb it uses (~12–16), alpha-only or
simplest beta, roughly level numbers. Keeps acquisition/Shop/Merge and
full runs working, keeps the codebase compiling and testable, and doubles
as test fixtures. The old 159 pieces and 32 enemy kits are **deleted,
not migrated**. Rejected: a synthetic player kit — cleaner control, but
it removes acquisition and Merge from "accumulated state".

In passing: the same logic gives a **skeleton enemy roster** built from
the skeleton pieces, so regular/elite/gatekeeper fights still exist in
full runs; calibration's controlled background stays the synthetic
gatekeeper.

### Calls made in passing (flag to revisit)

- **Neutral archetype removed**, per the inventory — A3's archetype-level
  credit rule removes its reason to exist.
- **Merge upgrades the beta** (bigger rider, lower step, higher cap) —
  the run-economy record's "obvious replacement"; pricing still waits on
  pillar calibration.
- **Trigger-easing Mods re-point to beta knobs**; Primed goes away with
  the old classes.
- **Enemies use the same four archetypes, seven verbs and source × shape
  catalog**; enemy-only pieces still allowed. Trace cost modifiers stay
  player-only (Trace is player-only).
- **Escalation and the defender-favoured hard tiebreak stay** — they are
  combat-layer, and Honeypot's identity leans on them.

### Found while restructuring DESIGN.md (checkpoint 1)

- **Tick hooks lose their events.** With DoT/HoT removed,
  `onTick`/`onTickExpiring` never fire, so Redundant Ticks, Failsafe
  Cascade and Redline need re-pointing (alpha fires, lasting
  Tempo/Suppress durations) or retiring with the hooks. Decide in the
  content step.
- **Name collision:** the Overclocked Accumulator Mod now reads as an
  Overclock-archetype piece. It is in the re-point set anyway; rename it
  then.

### Implementation calls made in step 1, checkpoint 2 (flag to revisit)

Made while writing `subroutine-types.ts` and the skeleton content; each
follows from A1–A11 but was not discussed individually.

- **Suppress is instant only.** A lasting Suppress would re-create HoT,
  and an alpha already fires every turn. So of the old debuffs, only
  `choked` survives (as Tempo `threshold` with a `duration`); `throttled`
  and `corrupted` are dropped rather than folded. Refines A4.
- **Trace is a signed `trace` delta on any effect** — positive makes
  noise, negative covers tracks, floored at 0. Replaces `traceCost`,
  `riskRewardBurst` and `traceReduction` in one field. Low Profile's
  separate floor is gone.
- **Credit carries Honeypot's conversions** as `from: 'ward'` (spend own
  Ward 1:1) or `from: 'opponent'` (take from the opponent's gauge, capped
  at what is there), plus `piercing`. No separate conversion verbs.
- **Suit tally is implicit**: `category: 'suit'` always means the piece's
  own archetype's suit (A1/A2).
- **Disrupt arms for the next hand** and resolves at the right point in
  it — one timing mechanism replacing hand-lifecycle `firesAt` and
  `scheduledSabotage`.
- **Empower lasts only the current turn** (`scope: 'next' | 'rest'`), so
  order stays meaningful. **Charge** targets `self | next | all`.
- **`immediate` + `enhance`** means an extra, elevated alpha fire — D12's
  "extra fire".
- **Valid source × shape pairs** are an authoring rule (`VALID_SHAPES`),
  enforced by tests rather than the type: cards/progress →
  graded/stepped/immediate; state → whileTrue/immediate; sequence →
  whileTrue/graded (graded sequence = the old chain-finisher).
- **Removed fields**: `reactive`, `firesAt`, `magnitudeDecayPerFire`/
  `magnitudeFloor`, `togglable`, `tags`, `elevation`, `traceCost`.
  **Kept**: `pointsCooldown`, `maxFiresPerCombat`, `tracePressure`.
- **Off-class rewards**: combat rewards add the other two archetypes at
  `OFF_CLASS_WEIGHT` 0.2 (placeholder). The Shop and Event grants stay
  on-class only.
- **Skeleton starting loadouts reuse pool pieces**; the bridge slot is a
  placeholder (the partner archetype's credit common).
- **The Whistleblower event** granted Neutral's Checksum Match; it now
  grants Probe, which is off-class for half the classes.
- **Reorder heuristic**: session 46's "chain finishers last" pass retired
  with that payload kind. Empower-first is the obvious next rule, left
  for real Empower content.
- **Pool pieces with a `trace` effect can't sit in enemy kits** (the
  player-only Trace guard caught two in the skeleton roster).
- **Gatekeeper ablation (`excludedIds`) throws** on the skeleton's
  one-per-layer roster; use the synthetic gatekeeper instead.

### Implementation calls made in step 1, checkpoint 3 (flag to revisit)

Made while rewriting `resolve.ts`, `triggers.ts` and `combat.ts`.

- **Banked charges are consumed when the beta is evaluated**, before the
  fire resolves — so a charge the same fire banks (Charge `self`, Ward
  absorbed mid-fire) survives to the next turn.
- **Only plain Credit is absorbed by Ward** (and by the incoming-credit
  Mods, Static Shield / Surge Protector). Piercing skips both; so do the
  conversion credits (`from: 'ward' | 'opponent'`), which are transfers,
  not attacks.
- **Empower boosts only Credit, Suppress and Ward alphas** — never
  Tempo (session 48's units invariant), never a beta's own effect. A
  `next` Empower is spent by whichever piece fires next, even if that
  piece's verb can't use it.
- **"Adjacent" means the last piece to actually fire this turn**, so a
  piece skipped by its points cooldown doesn't break an adjacency it took
  no part in.
- **Charge `next` doesn't wrap**: the last piece's `next` charges
  nothing.
- **An immediate beta with its own effect** counts against
  `maxFiresPerCombat` but is not an alpha fire (no growth, no `fires`
  progress). An immediate `enhance` is a real extra alpha fire.
- **Timed Tempo** stores the threshold delta actually applied (after
  flooring) and counts the *affected* side's own turns; it reverts by
  exactly that delta.
- **Disrupt timing within the next hand**: `revealHand` and
  `forceDiscard` after the deal, `revealCrib` once the crib is selected,
  and a revealed hand narrows to the kept four at the start of play.
  Session 24's whole-pair forced discard and the cut bias (`skewCut`) are
  gone; the cut is always fair.
- **His Heels still scores** into the initiative gauge; it just can't be
  watched by a beta.
- **The enemy-passive registry is not rebuilt** — the skeleton roster has
  none, and the real roster writes its own hooks. Carried over as-is:
  Warm Boot, Cold Boot, Early Momentum, First Contact, Static Shield,
  Surge Protector. Everything else Mod- or passive-shaped is checkpoint 4.
- **Unchanged**: escalation, the defender-favoured hard tiebreak at hand
  20, the loop detector, the deal/peg/show sequence.

## Noted for later (not discussed)

- **Baseline Trace from every fight, scaled by the enemy's Containment %
  at fight end (user, session 51).** Motivation: easy fights were
  effectively Heat-free, which is what Trace was introduced to fix.
  Relates to run-economy D1 (a won fight costs Trace) and D2 (baseline
  Trace by tier × layer) — reconcile with those, and with the
  transparency reason session 50 removed the margin-of-loss Heat scaler
  (end-of-fight enemy Containment would need to be visible to the
  player).

## Open

- None blocking step 1. Planning step 1 next.
