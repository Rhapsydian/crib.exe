import type { SubroutineDefinition } from './subroutine-types';
import { BREACH_CONTAINMENT_THRESHOLD } from './subroutines';

/**
 * Enemy-only subroutine catalog (session 39). Structurally separate from
 * subroutines.ts's ALL_POOL_SUBROUTINES/ARCHETYPE_POOLS: never included in
 * ALL_SUBROUTINES, never reachable through a player's Merge/Shop/reward
 * draw -- enemies.ts's pool() lookup is the only thing that ever resolves
 * an id from here.
 *
 * Exists because the roster's own design always allowed enemy content to
 * be "fully bespoke to one enemy" (DESIGN.md, cited in enemies.ts's own
 * pool() doc comment), but the session-27 roster draft used only
 * player-pool pieces for speed, every single enemy, no bespoke content at
 * all -- which produced enemy-side pieces gated on mechanics that don't
 * structurally exist for an enemy. The session-39 roster audit found the
 * concrete case: Heat-gated triggers. Enemies never accumulate Heat at
 * all (the only Heat-raising pool piece, Payload Multiplier, requires
 * Heat already above threshold to fire in the first place -- no pool
 * piece can ever be the first mover), so every enemy-held selfState:
 * heatAbove trigger is unconditionally dead. These 5 pieces are direct,
 * theme-appropriate replacements for the 5 dead pieces that audit found
 * (7 dead instances across the roster, since two of the five -- Air Gap
 * and Backchannel -- were each shared by two enemies).
 *
 * User-directed scope, explicitly: this is a fix for the currently-broken
 * slots only, not a wholesale replacement of the roster's shared-pool
 * content. The broader "give every enemy real bespoke content" initiative
 * is intentionally banked in BACKLOG.md, not attempted here.
 *
 * Tier constants below are seeded at the same magnitudes as the
 * player-facing pieces each entry replaces (a like-for-like swap, not a
 * balance retune) but kept as this catalog's own copy rather than
 * importing subroutines.ts's private COMMON/UNCOMMON/CAPPED -- enemy-only
 * content is meant to be free to diverge from player tuning over time
 * (the banked broader initiative), not permanently coupled to it.
 */
const ENEMY_COMMON = { tick: 2, duration: 3 };
const ENEMY_UNCOMMON = { burst: 8 };
const ENEMY_CAPPED = { common: 7 };
// Seeded at subroutines.ts's own RARE tier's tick shape (5/5/8) -- these
// two replace RARE-tier DoT/HoT pieces (session 40 continued, below),
// same like-for-like magnitude convention as the rest of this file, kept
// as this catalog's own copy per this file's own header.
const ENEMY_RARE = { tick: 2, duration: 5, pointsPerTick: 8 };
// Stack Overflow's own burst, decoupled from ENEMY_UNCOMMON.burst rather
// than reusing it (Fracture Point/Escalating Response's shared tier
// value) -- tuned down from that shared value specifically for firing on
// every single pair occurrence instead of once per rare condition,
// mirroring session 39's Zero-Sum/Operator decoupling precedent (split a
// shared constant once one consumer needs independent tuning).
const STACK_OVERFLOW_BURST = 5; // TBD/playtesting

// Gatekeeper thematic-piece pass (session 43's own decision-session): a new
// design rule confirmed live -- every gatekeeper (not elite/regular, which
// stay pure magnitude-scaled "stronger commons" by deliberate design) gets
// at least one bespoke, highly thematic piece, unless its own design is to
// win by stalling to the hand-20 attrition resolution instead. Checked
// coverage first: only Firewall Prime/Kernel Panic/Ghost in the Machine
// already had one (each a side effect of an earlier dead-content fix), so
// the other 9 gatekeepers get a new piece here -- Quarantine Ward and
// Zero-Sum get two each, since both share Kernel Panic's exact pre-fix
// problem (suitTally-threshold/occurrence-threshold pieces too slow to
// bank in a realistically short fight) confirmed directly against
// subroutines.ts before designing the fix, not assumed. Every new piece
// below reuses an existing trigger/payload mechanism (no engine changes
// needed) and either ties into its gatekeeper's own passive or fixes a
// concrete finding from that check -- not filled in to hit a quota.
const QUICK_DRAW_BURST = 5; // TBD/playtesting -- decoupled per this file's own STACK_OVERFLOW_BURST precedent
const REDISTRIBUTION_HIJACK = 8; // TBD/playtesting

export const ENEMY_ONLY_SUBROUTINES: SubroutineDefinition[] = [
  {
    id: 'memory-leak',
    name: 'Memory Leak',
    archetype: 'malware',
    // Replaces Corrupted Cache (subroutines.ts) on Keylogger Process.
    // Keylogger Process's own kit already covers occurrence:pair
    // (Keylogger itself), so this picks a different category rather
    // than duplicating it.
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'dot', amountPerTick: ENEMY_COMMON.tick, cadence: 'castersTurnPulse', duration: ENEMY_COMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'fracture-point',
    name: 'Fracture Point',
    archetype: 'exploit',
    // Replaces Payload Multiplier on Zero-Day Broker. The original
    // doubly coupled itself to Heat (a heatAbove trigger AND its own
    // riskRewardBurst payload's extra heatCost) -- "risk" has no
    // enemy-side analog at all (Heat is a player-only run-level
    // resource), so this drops the risk/reward mechanic entirely rather
    // than forcing it onto a condition enemies structurally can't have.
    // Plain burst, same magnitude, on a fresh occurrence category
    // (Zero-Day Broker's kit already covers pair via Zero-Day Chain, run
    // via Buffer Overrun).
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'directBurst', amount: ENEMY_UNCOMMON.burst + 2 },
    tags: [],
  },
  {
    id: 'escalating-response',
    name: 'Escalating Response',
    archetype: 'neutral',
    // Replaces Overclock on Zero Trust Node -- "increasingly aggressive
    // defense as the intrusion progresses," now keyed to something an
    // enemy can actually read instead of Heat.
    //
    // Uses breachContainmentAbove, NOT gaugeFillAbove -- an earlier draft
    // of this piece used gaugeFillAbove (matching Honeypot/Vulnerability
    // Scan's own precedent) and empirically fired 15+ times in an
    // 18-20-hand match. Root cause, confirmed by reading
    // resolve.ts:1396: gaugeFillAbove reads gauges.ts's InitiativeGauge
    // (the turn-cadence meter, `gauge`), which is DESIGNED to cycle --
    // "overshoot carries into the next cycle" (gauges.ts's addPoints) --
    // so it crosses any given fraction roughly every other turn by
    // construction, not a rare or escalating signal at all.
    // breachContainmentAbove instead reads the real win-gauge
    // (`winGauge.progress/threshold`, resolve.ts:1391) -- "how close is
    // the opponent to winning," matching this piece's actual intent and
    // the same condition DNS Poisoning already uses for its own "come
    // from behind" identity. High threshold (the same
    // BREACH_CONTAINMENT_THRESHOLD.high DNS Poisoning uses) for a late,
    // hard punish; Fail-Secure below uses the low threshold for an
    // earlier, proactive reaction.
    //
    // reactive:true is still structurally required, independent of
    // which condition is used -- see subroutine-types.ts's own
    // `reactive` doc comment and resolve.ts's refreshTriggerReadiness: a
    // non-reactive selfState/enemyState trigger re-arms on every single
    // evaluation pass while its condition holds (no false->true edge
    // debounce), so once armed it would refire every remaining turn
    // rather than once per real renewed crossing. Matches DNS
    // Poisoning's own reactive:true for the same trigger family.
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'directBurst', amount: ENEMY_UNCOMMON.burst },
    tags: [],
    reactive: true,
  },
  {
    id: 'fail-secure',
    name: 'Fail-Secure',
    archetype: 'encryption',
    // Replaces Air Gap on Hardened Perimeter and Firewall Prime -- the
    // original finding this whole audit started from. "Fail-secure" is a
    // real systems-design term (default to the safe/closed state the
    // instant something goes wrong), fitting "ward up defensively" at
    // least as well as Air Gap's own isolation flavor did.
    //
    // breachContainmentAbove, not gaugeFillAbove -- see Escalating
    // Response's own comment above for why (gaugeFillAbove reads the
    // cyclical InitiativeGauge, not real win-progress; empirically fired
    // 26+ times in an 18-hand match before this fix). Low threshold
    // (BREACH_CONTAINMENT_THRESHOLD.low) for a proactive, early defensive
    // reaction, rather than Escalating Response's later punish at the
    // high threshold. reactive:true for the same structural reason
    // (matches Air Gap's own original reactive:true too).
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: { kind: 'ward', amount: ENEMY_CAPPED.common },
    tags: ['firewall'],
    reactive: true,
  },
  {
    id: 'intercept',
    name: 'Intercept',
    archetype: 'root',
    // Replaces Backchannel on Backchannel Handler and Ghost in the
    // Machine -- the original fired "while the caster's own Heat is
    // running hot" per its own doc comment. Both enemies that carried it
    // already carry DNS Poisoning, whose own doc comment frames
    // breachContainmentAbove(high) as "the instant the enemy pulls
    // significantly ahead" -- reusing that exact condition here fits
    // Root's whole "come from behind" identity at least as well as the
    // original Heat framing did.
    //
    // firesAt:onCribSelected means this doesn't go through the
    // reactive/ready-flag machinery at all -- fireHandLifecycleSubroutines
    // checks the trigger condition fresh at that one fixed moment each
    // hand (isReady called directly, not the precomputed ready flag),
    // so it's naturally bounded to at most once per hand regardless of
    // reactive. Matches the original Backchannel's own choice not to set
    // it.
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'revealCrib' },
    tags: [],
    firesAt: 'onCribSelected',
  },
  {
    id: 'stack-overflow',
    name: 'Stack Overflow',
    archetype: 'exploit',
    // Replaces Total Pwnage on Kernel Panic (session 40 continued,
    // gatekeeper balance pass). Diagnosed via a real firing-frequency
    // instrument: realistic layer-4 fights against Kernel Panic average
    // 2.33 hands (100% resolved by the player's own threshold, 0%
    // attrition) -- Total Pwnage's occurrence:pair,threshold,bankTarget:4
    // essentially never banks up in that window (fired in ~10% of
    // fights; Epidemic/Cold Storage in ~0.6%). Neither the new per-side
    // gaugeThreshold nor winThreshold levers moved this at all when
    // tested directly -- a subroutine that never becomes ready doesn't
    // fire more often just because it's the enemy's turn more often. The
    // real fix is trigger *shape*: same piercing-burst identity, but
    // Instant instead of Threshold -- fires on every single pair
    // occurrence, no banking, so it can actually contribute within a
    // realistically short fight. Magnitude uses its own decoupled
    // STACK_OVERFLOW_BURST (below ENEMY_UNCOMMON.burst), since firing on
    // every occurrence instead of once per 4 banked is a large frequency
    // increase in its own right -- empirically tuned, not assumed
    // correct on the first pass (see this file's own decoupling note
    // above).
    trigger: { kind: 'occurrence', category: 'pair', variation: 'instant' },
    payload: { kind: 'piercing', amount: STACK_OVERFLOW_BURST },
    tags: ['piercing'],
  },
  {
    id: 'escort-out',
    name: 'Escort Out',
    archetype: 'encryption',
    // The Concierge -- front-desk/bouncer identity: it lets mitigation
    // pile up while it verifies you, then walks you right back out once
    // it's banked enough of it. Same mitigationBanked mechanism as
    // Circuit Breaker (subroutines.ts, threshold 10), tuned down for a
    // layer-1 kit fed by only two mitigation sources (Patch/Full Rollback).
    trigger: { kind: 'accumulator', metric: 'mitigationBanked', threshold: 8 },
    payload: { kind: 'instantCounterPush', amount: 6 },
    tags: ['firewall'],
  },
  {
    id: 'orphaned-thread',
    name: 'Orphaned Thread',
    archetype: 'root',
    // Ghost Process -- a background process nobody's tracking anymore,
    // lingering through repeated exchanges and quietly making the job
    // harder each time it's noticed again.
    //
    // Real regression found this session, through two failed attempts, not
    // guessed right the first time: the original design used
    // instantManipulation/enemyGaugeThreshold (a permanent raise to the
    // *InitiativeGauge* threshold -- resolve.ts's instantManipulation
    // case -- whose own default, GAUGE_THRESHOLD, is only 8, encounters.ts
    // -- not the 50-point win gauge, as Tripwire/Ghost Protocol's own
    // precedent amounts of 5/8 might suggest at a glance). Even after
    // capping fires (which needed its own engine fix -- see triggers.ts's
    // isReady, maxFiresPerCombat was previously unenforced on this trigger
    // kind) and cutting the amount, a direct sweepEnemy check
    // (scripts/sweep.ts, starting-kit Breacher) still only won 9/100
    // against Ghost Process, a real outlier next to a Layer-1 sibling's
    // 93/100. First redesign attempt (an uncapped, refiring 'throttled'
    // debuff) made it *worse* (9/100 -> 3/100) -- checked why rather than
    // guessing again: applyThrottled (resolve.ts) ignores the debuff's own
    // `magnitude` entirely, applying a flat THROTTLED_REDUCTION(4)/floor(1)
    // to every scoring event for as long as *any* throttled instance is
    // active, so a refiring, uncapped source keeps the player throttled
    // for a large fraction of a long fight regardless of the magnitude
    // field I'd set. Capped to a single application (maxFiresPerCombat:1)
    // -- a real but bounded "occasional hiccup," not sustained pressure.
    trigger: { kind: 'occurrence', category: 'go', variation: 'threshold', bankTarget: 3 },
    payload: { kind: 'debuff', debuffId: 'throttled', magnitude: 3, duration: 2 },
    tags: ['trap'],
    maxFiresPerCombat: 1,
  },
  {
    id: 'escalation-path',
    name: 'Escalation Path',
    archetype: 'exploit',
    // Incident Response -- correction, mid-session: my original design
    // claimed Highest Bidder ("chain-finisher pieces get a bonus per
    // Exploit already fired") had nothing to buff. Wrong -- re-reading its
    // actual loadout, supply-chain-compromise AND zero-day-chain are
    // *both* already chainFinisherScaling pieces (subroutines.ts), so the
    // passive was never dead. A third escalating piece, chained directly
    // off any Exploit fire (meaning it could itself chain right off either
    // of those two), would have compounded into a real snowball on top of
    // an already-live mechanic, not fixed a gap. Redesigned onto a plain,
    // non-escalating burst on a category its kit doesn't otherwise cover
    // (fifteen -- the single most frequent occurrence, ~5.3/hand per
    // scripts/occurrence-frequency.ts) instead.
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'directBurst', amount: ENEMY_UNCOMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'contagion-protocol',
    name: 'Contagion Protocol',
    archetype: 'malware',
    // The Quarantine Ward -- replaces Epidemic (same suitTally-threshold
    // dead-trigger problem confirmed directly from subroutines.ts, the
    // Kernel Panic diagnosis before Memory Corruption's own fix). Also
    // unblocks the ward's own pre-existing Total Quarantine passive
    // ("every tick nudges its own gauge forward" -- resolve.ts's
    // tickBonus/nudgeInitiative, EP_SMALL=2 per tick), which structurally
    // couldn't fire at all while its DoT/HoT never cast -- a real,
    // never-before-tested interaction, not a new one I introduced.
    //
    // Real regression found via sweepEnemy even after cutting Cryo Lock's
    // own trigger down (see that piece's own note): Contagion Protocol
    // ALONE, paired with the now-finally-live Total Quarantine passive,
    // still held starting-kit Breacher to 0/100. `globalPulse` cadence
    // ticks off *combined* points from both sides regardless of whose
    // turn it is, so the initiative-nudge fired far more often than the
    // Ward's own actual turn frequency would otherwise allow -- a
    // tempo-multiplier effectively decoupled from turn economy. Switched
    // to `castersTurnPulse` (ticks only on the Ward's own turns), which
    // ties the nudge's own frequency back to how often it's already
    // getting to act, closing the decoupled-amplification loop rather
    // than just further cutting the DoT's own magnitude.
    trigger: { kind: 'always' },
    payload: { kind: 'dot', amountPerTick: ENEMY_RARE.tick, cadence: 'castersTurnPulse', duration: ENEMY_RARE.duration },
    tags: ['daemon'],
  },
  {
    id: 'cryo-lock',
    name: 'Cryo Lock',
    archetype: 'encryption',
    // The Quarantine Ward -- replaces Cold Storage, same original diagnosis
    // as Contagion Protocol above (its sibling suitTally-threshold piece).
    // "Freeze the intrusion in place" fits a containment ward better than
    // Cold Storage's original flavor did anyway.
    //
    // NOT Always, unlike Contagion Protocol -- a real regression found via
    // sweepEnemy (scripts/sweep.ts): two simultaneous Always-triggered
    // ticks (a DoT and a HoT, both live from turn 1) is Kernel Panic's own
    // shape, but Kernel Panic is a Layer-4 boss (magnitudeScaler 1.9); the
    // same treatment on a Layer-2 gatekeeper (1.3) took starting-kit
    // Breacher's win rate to 0/100, a real outlier next to Zero-Sum's own
    // 79/100 at the same layer. Left real but attainable instead --
    // accumulator:points is a common, fast-filling metric (unlike the
    // original's dead suitTally), so this still fires reliably within a
    // real fight, just not unconditionally from the first turn. Also
    // switched to castersTurnPulse, same Total Quarantine
    // decoupled-amplification fix as Contagion Protocol above -- the
    // passive's tickBonus applies to hots exactly like dots
    // (resolve.ts).
    trigger: { kind: 'accumulator', metric: 'points', threshold: 10 },
    payload: { kind: 'hot', amountPerTick: ENEMY_RARE.tick + 4, cadence: 'castersTurnPulse', duration: ENEMY_RARE.duration },
    tags: ['daemon'],
  },
  {
    id: 'quick-draw',
    name: 'Quick Draw',
    archetype: 'exploit',
    // Zero-Sum -- replaces Total Pwnage (occurrence:pair,threshold,
    // bankTarget:4 -- the identical dead-trigger shape Kernel Panic's own
    // Total Pwnage had before Stack Overflow's fix, confirmed from
    // subroutines.ts, not assumed). Also makes Primed to Strike ("each
    // Root fire lowers the cost of its own next Exploit fire") a reliable
    // payoff instead of a passive that rarely gets to matter -- Zero-Sum's
    // only other Exploit piece was this same dead one.
    trigger: { kind: 'occurrence', category: 'pair', variation: 'instant' },
    payload: { kind: 'piercing', amount: QUICK_DRAW_BURST },
    tags: ['piercing'],
  },
  {
    id: 'redistribution',
    name: 'Redistribution',
    archetype: 'root',
    // Zero-Sum -- replaces Dead Drop (occurrence:flush,threshold,
    // bankTarget:3, essentially never banks in a real fight -- flush-6+ is
    // ~0.13/hand per scripts/occurrence-frequency.ts, and threshold-3
    // needs three of those). sessionHijack (session 40's genuine two-sided
    // transfer -- steals opponent progress, credits your own) is the
    // literal mechanical definition of "zero-sum," a stronger thematic fit
    // than Dead Drop's original scheduled-sabotage flavor for this
    // specific gatekeeper.
    trigger: { kind: 'occurrence', category: 'flush', variation: 'instant' },
    payload: { kind: 'sessionHijack', amount: REDISTRIBUTION_HIJACK },
    tags: ['direct'],
  },
  {
    id: 'system-meltdown',
    name: 'System Meltdown',
    archetype: 'malware',
    // Total Compromise -- ties directly into its own Cascading Failure
    // passive ("once DoTs have ticked 3 times combined, all gain a
    // permanent tick-magnitude boost"): a DoT that casts itself off the
    // back of any other daemon-tagged fire literally cascades, compounding
    // toward that threshold faster the more of its own kit has already
    // gone off.
    trigger: { kind: 'chained', afterTag: 'daemon' },
    payload: { kind: 'dot', amountPerTick: ENEMY_COMMON.tick, cadence: 'castersTurnPulse', duration: ENEMY_COMMON.duration },
    tags: ['worm'],
  },
  {
    id: 'behavioral-model',
    name: 'Behavioral Model',
    archetype: 'exploit',
    // Adaptive Threat -- reads the player's own current debuff state and
    // presses the advantage the instant it's carrying any of Adaptive
    // Threat's own effects, the same "adapts to what you just did" shape
    // its Adaptive Defense passive already has for cleanses. Reuses the
    // hasDebuff:'any' wildcard (session 41-42's own addition) in a fresh
    // enemy-authored context rather than a new mechanism.
    trigger: { kind: 'enemyState', condition: 'hasDebuff', debuffId: 'any' },
    payload: { kind: 'directBurst', amount: ENEMY_UNCOMMON.burst },
    tags: [],
    reactive: true,
  },
  {
    id: 'undetected',
    name: 'Undetected',
    archetype: 'root',
    // Silent Corruption -- stays hidden until a genuinely exceptional play
    // happens, from either side, then the corruption nobody noticed starts
    // spreading. minMagnitude:6 (double run or better) grounded against
    // real data (scripts/occurrence-frequency.ts): run-magnitude-6+ is
    // ~0.43/hand per side, ~0.6-0.8/hand combined watching both sides --
    // rare enough to read as a real "exceptional play" trigger, not dead
    // content the way an ungrounded guess risks (the project's own
    // repeated His Heels/Wiretap lesson).
    trigger: { kind: 'rareOccurrence', category: 'run', minMagnitude: 6, watchSide: 'either' },
    payload: { kind: 'dot', amountPerTick: ENEMY_RARE.tick, cadence: 'castersTurnPulse', duration: ENEMY_RARE.duration },
    tags: ['daemon'],
  },
  {
    id: 'impersonation',
    name: 'Impersonation',
    archetype: 'encryption',
    // Null Session -- the run's final-layer capstone: once it's absorbed
    // enough of the player's own probing (mitigationBanked, fed alongside
    // its existing Circuit Breaker off the same accumulator -- real
    // in-kit synergy, not just a bolt-on), it starts posing as a
    // legitimate authenticated session, turning your own attempts into its
    // access. wardCounter (session 40's generalization of Ghost's Return
    // to Sender) is the literal mechanical shape of "your probing now
    // credits me." ratio 0.15, below Return to Sender's own 0.25 per that
    // payload's own doc comment -- this is a kit bonus, not a whole win
    // condition the way Ghost's Mod is.
    trigger: { kind: 'accumulator', metric: 'mitigationBanked', threshold: 14 },
    payload: { kind: 'wardCounter', amount: 6, ratio: 0.15 },
    tags: ['firewall'],
  },
  {
    id: 'memory-corruption',
    name: 'Memory Corruption',
    archetype: 'malware',
    // Replaces Epidemic on Kernel Panic (session 40 continued, same
    // diagnostic as Stack Overflow above) -- accumulator:suitTally
    // threshold:10 essentially never completes in a ~2-3 hand fight, so
    // the DoT itself (globalPulse cadence, same tick shape as the
    // original) never even gets cast. Always -- fires the instant Kernel
    // Panic gets its first turn, giving the tick the maximum possible
    // number of hands to actually pulse in a short fight, rather than
    // waiting on an accumulator built for a much longer one. Tick
    // shape/magnitude kept at ENEMY_RARE (== the original Epidemic's own
    // RARE-tier tick) -- only the casting condition changed, not the
    // DoT's own bite once applied.
    trigger: { kind: 'always' },
    payload: { kind: 'dot', amountPerTick: ENEMY_RARE.tick, cadence: 'globalPulse', duration: ENEMY_RARE.duration, pointsPerTick: ENEMY_RARE.pointsPerTick },
    tags: ['daemon'],
  },
  {
    id: 'failsafe-reboot',
    name: 'Failsafe Reboot',
    archetype: 'encryption',
    // Replaces Cold Storage on Kernel Panic (session 40 continued, same
    // diagnostic as Stack Overflow/Memory Corruption above) -- same
    // accumulator:suitTally dead-trigger problem, same Always fix. HoT
    // suppresses the *player's* gauge rather than crediting Kernel
    // Panic's own, so getting it applying from turn 1 matters even more
    // here: a fast-closing player is exactly what this piece exists to
    // slow down, and it was never getting the chance to. Tick
    // shape/magnitude kept at ENEMY_RARE + 4 (== the original Cold
    // Storage's own RARE.tick+4 HoT amount) -- only the casting condition
    // changed.
    trigger: { kind: 'always' },
    payload: { kind: 'hot', amountPerTick: ENEMY_RARE.tick + 4, cadence: 'globalPulse', duration: ENEMY_RARE.duration, pointsPerTick: ENEMY_RARE.pointsPerTick },
    tags: ['daemon'],
  },
];
