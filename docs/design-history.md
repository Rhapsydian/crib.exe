# crib.exe — Design history

Sections of `DESIGN.md` superseded by the session 51 archetype and
subroutine redesign (`docs/archetype-redesign.md`), moved here
**verbatim** so their reasoning survives. Nothing below describes the
current design. Line references and "see above/below" pointers inside
these sections refer to `DESIGN.md` as it stood at the end of session 50.

Same convention as `docs/roadmap-history.md` (session 48) for `BACKLOG.md`.

---

## From Meta-Progression: archetypes, classes, loadouts, catalogs, tags, Neutral, win-condition audit, pool expansions (sessions 4–43)

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
  see docs/roadmap-history.md's session 41 write-up for the full list and conversions).
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

**The fix, shipped this session** (session log in `docs/roadmap-history.md`'s top
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
with a heavy ablation-driven balance pass — see `docs/roadmap-history.md`'s top "NEXT
SESSION" section for the complete roadmap). Session 41 scoped and
planned only; session 42 implemented all 8 checkpoints (A-H) — see
`docs/roadmap-history.md`'s "Player Pool Expansion — Implementation" section for the
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


---

## From Meta-Progression: Mods content passes (sessions 32 and 44)

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


---

## From Enemy Design: the session 27 roster

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


---

## From Theming: the session 13 suit table

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

