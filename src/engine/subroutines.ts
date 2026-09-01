import type { SubroutineDefinition } from './subroutine-types';

/**
 * All 78 named subroutines in the game (session 12's 18 class
 * starting-loadout pieces from `DESIGN.md`, plus session 21+'s 60
 * archetype-pool pieces — 7 common/5 uncommon/3 rare per archetype).
 * Authored as real data for the first time; previously only prose in
 * `DESIGN.md` and the session 21+ plan doc, or small representative test
 * fixtures.
 *
 * Every numeric field is a TBD/playtesting placeholder, sized relatively
 * (common < uncommon < rare, per session 21's rarity-as-power-and-
 * complexity principle) — see `BACKLOG.md` Phase 5 for the real balance
 * pass this needs, same treatment as every other placeholder number
 * already in the engine (`HEAT_MAX`, `REST_HEAT_REDUCTION`, etc.).
 * Re-run session 20's `playRun()` outcome-distribution sweep once Phase
 * 4 exists, per `BACKLOG.md`'s own note, rather than tuning these by feel.
 *
 * **Rarity isn't a field on `SubroutineDefinition` yet** (deferred to
 * Phase 4's own implementation — engine gap catalog item F9). Encoded
 * here structurally instead: which exported array a piece lives in.
 *
 * **Content-level simplifications and corrections from the design docs**
 * (flagged inline where they occur too):
 * - Silent Worm's "also feeds a Root subroutine's condition" compound
 *   effect isn't representable by a single-payload subroutine — kept as
 *   a plain DoT.
 * - Full Rollback's "removes all active debuffs" simplified to
 *   Cleanse's existing single-debuff removal.
 * - Redundant Systems' and Null Session's DESIGN.md trigger ("Self-state:
 *   Breach/Containment in enemy's favor") doesn't match any real
 *   SelfStateTrigger condition (Breach/Containment isn't "self" state) —
 *   corrected to the trigger that actually means this,
 *   `enemyState: breachContainmentAbove`.
 * - `instantManipulation`'s `subroutineProgress` target needs a specific
 *   `targetSubroutineId`, which only makes sense when that id is
 *   guaranteed present (a class's own fixed starting kit, or a piece a
 *   Chained trigger already hard-depends on). Pool pieces with no such
 *   guarantee (ARP Spoof) use the generic `suitTally` target instead of
 *   guessing at another id that might not be in the loadout.
 */

// ---------------------------------------------------------------------
// Magnitude tiers — all TBD/playtesting, see file header.
// ---------------------------------------------------------------------

// Points a self-Haste piece's own side must score before it may fire
// again (session 47). Denominated in real scoring specifically because a
// Haste piece cannot manufacture that -- see
// SubroutineDefinition.pointsCooldown. Sized against a real fight: an
// always-trigger piece fires ~12.7 times per fight, so a cooldown of 15
// points meaningfully spaces these out without silencing them.
// TBD/playtesting, same treatment as every other constant here.
const HASTE_POINTS_COOLDOWN = 15;

// Trace costs (session 47). Anchored to a measured budget: HEAT_MAX is
// 100, an average run ends around 38, and ~75% of all Heat gain is
// movement at HEAT_PER_MOVE 2 -- so 1 Trace is worth about half a map
// move. Exploit pays the most by design (the user's own framing: the
// tradeoff is the archetype's identity); every other archetype makes
// noise as a small side-effect of its own normal work.
// TBD/playtesting, same treatment as every other constant here.
const EXPLOIT_TRACE_COST = 3;
const LOUD_TRACE_COST = 2; // noisy non-Exploit pieces, and the self-limiting pairings
const FAINT_TRACE_COST = 1; // frequent or incidental noise

const COMMON = { burst: 5, tick: 2, pointsPerTick: 8, threshold: 6, bankTarget: 2, cap: 3, duration: 3, trace: 8, debuffMag: 3, debuffDur: 2 };
const UNCOMMON = { burst: 8, tick: 3, pointsPerTick: 8, threshold: 8, bankTarget: 3, cap: 4, duration: 4, trace: 10, debuffMag: 4, debuffDur: 3 };
const RARE = { burst: 13, tick: 5, pointsPerTick: 8, threshold: 10, bankTarget: 4, cap: 5, duration: 5, trace: 12, debuffMag: 6, debuffDur: 3 };

/** HoT/Instant Counter-Push reduce the *opponent's* gauge directly
 * (resolve.ts) rather than advancing the caster's own -- a fundamentally
 * more defensive job than direct offense, so per session 21's "should
 * generally be tuned to noticeably higher magnitude" principle, they get
 * their own, larger tier. Ward's shield amount reuses this tier too
 * (same "defensive numeric knob" shape). */
const CAPPED = { common: 7, uncommon: 11, rare: 18 };

// Exported (session 39): enemy-subroutines.ts's own enemyState-triggered
// content shares these same semantic thresholds ("what fraction counts as
// the player winning") -- a real shared concept, unlike COMMON/UNCOMMON/
// CAPPED below, which are player-content power-tier tuning and stay
// private/uncoupled from the enemy-only catalog on purpose.
export const BREACH_CONTAINMENT_THRESHOLD = { low: 40, high: 60 };
// gaugeFillAbove (session 40 continued: confirmed, not just banked as
// "unconfirmed" — real fire-frequency instrumentation against Incident
// Response, session 40's own gatekeeper balance pass) reads the
// InitiativeGauge (resolve.ts's buildTriggerContext:
// `gaugeFillFraction: enemy.gauge.progress / enemy.gauge.threshold`) —
// the turn-cadence meter, which cycles/resets on every crossing
// (gauges.ts's addPoints: "overshoot carries into the next cycle"), not
// a monotonic win-progress signal. "Above 50%" (or even 75%) of a gauge
// that fills and resets every turn or two is true roughly every other
// turn by construction — not rare, not escalating, not "opponent about
// to win." Priority Override and Sinkhole (below) both use this
// condition too, but their own design intent is genuinely *about* enemy
// tempo/cadence (Priority Override primes Precision Strike often, by
// design, mirroring Primed's own frequent-proc identity; Sinkhole's
// "catch-up" framing is literally "when the enemy's about to get a
// turn, accelerate my own") — left untouched, this condition's actual
// behavior fits what they're for. Honeypot and Vulnerability Scan
// (below) were each authored as a rare, late-game reactive punish —
// exactly the framing gaugeFillAbove can't deliver — migrated to
// breachContainmentAbove instead (already used by Fail-Secure/
// Escalating Response/Intercept in enemy-subroutines.ts for the
// identical reason).
export const GAUGE_FILL_FRACTION = 0.5;

// ---------------------------------------------------------------------
// Neutral archetype (18: 9 session 28, +9 session 41) — session 28's `/decision-session`, DESIGN.md's
// "Neutral Archetype". A genuine 5th Archetype value, not one of the 4
// real ones reused for flavor — built entirely from trigger families
// that don't pin the piece to one specific suit (Always, self-state,
// every occurrence category -- Flush and His Nobs included, since firing
// off "a flush happened"/"his nobs happened" doesn't reference any
// particular suit index, unlike suitTally's own required `suit:` field),
// so these pieces can drop into *any* kit, including a pure Encryption/
// Root one, without borrowing another archetype's identity.
// Deliberately small (8 common/6 uncommon/4 rare, session 41's own +4/
// +3/+2 parity growth) next to each real archetype's 14/10/6 — this
// exists to patch a structural gap (only Exploit's direct-damage kinds
// and Malware's DoT ever credit a side's own win-gauge; every
// Encryption/Root payload only denies or manipulates), not to become a
// 5th full content pillar. Mirror Server's afterTag chaining is a
// deliberate, reasoned exception to the old "no chained triggers" line,
// not an oversight (see its own comment). Defined here,
// ahead of the class starting loadouts below, so Ghost's own Cantrip
// retrofit sits next to (but is NOT the same object as) NEUTRAL_COMMONS'
// own Always-triggered common -- same precedent every real archetype
// already follows: a class's own Cantrip (Breacher's Lock Fatigue,
// Warden's Routine Maintenance) is never literally the same object/id
// as its archetype pool's own Always-triggered common (Exploit's Script
// Kiddie). Reusing one object for both would violate ALL_SUBROUTINES'
// global-id-uniqueness invariant (subroutines.test.ts) the instant a
// class's starting kit and the pool both listed it.
//
// Session 46: NEUTRAL_POOL is now included in rewardPoolForClass
// (rewards.ts) at full weight, for every class and every rarity — so
// combat rewards, the Shop slate and Event grants all offer these,
// since all three derive from that one function. It stays out of
// ARCHETYPE_POOLS itself (no suit, no class specializes in it) and out
// of universalCantrips (which reads ARCHETYPE_POOLS' own commons).
// The "acquisition is explicitly banked" note this comment used to
// carry had outlived the decision behind it: measured in session 46,
// all 18 pieces were unreachable through every acquisition path, which
// was a bug rather than gating.
// ---------------------------------------------------------------------

/** Ghost's new Cantrip (session 28), replacing Low Profile — deliberately
 * low-power per session 4's own Cantrip convention ("guarantee something
 * always happens"), same mechanical shape as Background Task below
 * (NEUTRAL_COMMONS' own Always-triggered common) but its own bespoke
 * object, matching every other class's Cantrip-vs-pool-common
 * separation. */
export const IDLE_PROCESS: SubroutineDefinition = {
  id: 'idle-process',
  name: 'Idle Process',
  archetype: 'neutral',
  trigger: { kind: 'always' },
  // amount 2 -> 1 (session 39 balance fix, combined with Return to
  // Sender's own ratio 0.5 -> 0.25 in resolve.ts). Zeroing this alone
  // collapsed Ghost entirely (0.0% win rate, avgLayers 0.01, 99%
  // noRoute) -- it's Ghost's only *guaranteed* credit source (Tripwire
  // is pure denial, Return to Sender only pays off when Steganography's
  // Ward actually absorbs a hit), so it stays real, just smaller.
  payload: { kind: 'directBurst', amount: 1 },
  tags: ['daemon'],
};

export const NEUTRAL_COMMONS: SubroutineDefinition[] = [
  {
    id: 'background-task',
    name: 'Background Task',
    archetype: 'neutral',
    trigger: { kind: 'always' },
    payload: { kind: 'directBurst', amount: 2 },
    tags: ['daemon'],
  },
  {
    id: 'elevated-session',
    name: 'Elevated Session',
    archetype: 'neutral',
    trigger: { kind: 'selfState', condition: 'isDealer' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'checksum-match',
    name: 'Checksum Match',
    archetype: 'neutral',
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'steady-drip',
    name: 'Steady Drip',
    archetype: 'neutral',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['daemon'],
  },
  // --- Session 41 pool expansion (+4) ---
  {
    id: 'ping',
    name: 'Ping',
    archetype: 'neutral',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'status-check',
    name: 'Status Check',
    archetype: 'neutral',
    trigger: { kind: 'selfState', condition: 'isNonDealer' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'cache-hit',
    name: 'Cache Hit',
    archetype: 'neutral',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'failover',
    name: 'Failover',
    archetype: 'neutral',
    trigger: { kind: 'enemyState', condition: 'breachContainmentBelow', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
];

export const NEUTRAL_UNCOMMONS: SubroutineDefinition[] = [
  {
    // Archetype-agnostic version of Exploit's Zero-Day Chain (occurrence:
    // pair) -- Run instead, so a kit could plausibly carry both without
    // redundancy, and it scales off *any* subroutine that already fired
    // this turn, not just neutral ones.
    id: 'chain-reaction',
    name: 'Chain Reaction',
    archetype: 'neutral',
    trigger: { kind: 'occurrence', category: 'run', variation: 'instant' },
    payload: { kind: 'chainFinisherScaling', baseAmount: UNCOMMON.burst - 3, perPriorFire: 3 },
    tags: ['worm'],
  },
  {
    id: 'overclock',
    name: 'Overclock',
    archetype: 'neutral',
    trigger: { kind: 'selfState', condition: 'traceAbove', value: UNCOMMON.trace },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'uptime',
    name: 'Uptime',
    archetype: 'neutral',
    trigger: { kind: 'occurrence', category: 'thirtyOne', variation: 'threshold', bankTarget: UNCOMMON.bankTarget },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: ['trap'],
  },
  // --- Session 41 pool expansion (+3) ---
  {
    id: 'redundant-node',
    name: 'Redundant Node',
    archetype: 'neutral',
    trigger: { kind: 'selfState', condition: 'traceBelow', value: UNCOMMON.trace },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'load-balancer',
    name: 'Load Balancer',
    archetype: 'neutral',
    trigger: { kind: 'occurrence', category: 'hisNobs', variation: 'instant' },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'mirror-server',
    name: 'Mirror Server',
    archetype: 'neutral',
    // Chained triggers were previously banned outright for Neutral
    // content (DESIGN.md: a piece meant to drop into *any* kit can't
    // assume a *specific* subroutine id is present) -- but that objection
    // is about id-based chaining specifically. afterTag (this session's
    // own checkpoint A redesign) fires off *any* daemon-tagged piece
    // firing this turn, not one guaranteed id, so it doesn't carry the
    // portability problem the ban was written against.
    trigger: { kind: 'chained', afterTag: 'daemon' },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: ['worm'],
  },
];

export const NEUTRAL_RARES: SubroutineDefinition[] = [
  {
    // The capstone: converts the caster's own already-cast mitigation
    // (Ward/instantCounterPush/hot amounts, resolve.ts's
    // creditMitigationBanked) into a real credit -- a genuine "shield
    // bash." Encryption/Root's actual identity (denial) becomes a
    // legitimate win path instead of needing borrowed offense.
    id: 'circuit-breaker',
    name: 'Circuit Breaker',
    archetype: 'neutral',
    trigger: { kind: 'accumulator', metric: 'mitigationBanked', threshold: RARE.threshold },
    payload: { kind: 'directBurst', amount: RARE.burst + 3 },
    tags: ['daemon'],
  },
  {
    id: 'watchdog-timer',
    name: 'Watchdog Timer',
    archetype: 'neutral',
    trigger: { kind: 'occurrence', category: 'go', variation: 'scaling', cap: RARE.cap },
    payload: { kind: 'directBurst', amount: RARE.burst + 2 },
    tags: ['trap'],
  },
  // --- Session 41 pool expansion (+2) ---
  {
    id: 'failsafe-cluster',
    name: 'Failsafe Cluster',
    archetype: 'neutral',
    // hasDebuff: 'any' (session 41, added checkpoint C) -- fires off the
    // enemy carrying any active debuff at all.
    trigger: { kind: 'enemyState', condition: 'hasDebuff', debuffId: 'any' },
    payload: { kind: 'directBurst', amount: RARE.burst + 2 },
    tags: ['direct'],
  },
  {
    id: 'redundant-array',
    name: 'Redundant Array',
    archetype: 'neutral',
    trigger: { kind: 'accumulator', metric: 'points', threshold: RARE.threshold },
    payload: { kind: 'chainFinisherScaling', baseAmount: RARE.burst - 4, perPriorFire: 5 },
    tags: ['worm'],
  },
];

export const NEUTRAL_POOL = { commons: NEUTRAL_COMMONS, uncommons: NEUTRAL_UNCOMMONS, rares: NEUTRAL_RARES };

// ---------------------------------------------------------------------
// Class starting loadouts (18) — DESIGN.md's "Starting Loadouts",
// session 12. 3 per class: 1 per specialized archetype + 1 Cantrip.
// ---------------------------------------------------------------------

export const BREACHER_LOADOUT: SubroutineDefinition[] = [
  {
    id: 'buffer-overflow',
    name: 'Buffer Overflow',
    archetype: 'exploit',
    // category 'run' -> 'fifteen' (balance pass, session 38 follow-up):
    // Breacher's only fast, unconditional offense piece was gated on
    // Cribbage's less-common occurrence category, starving it of real
    // win-gauge progress against fast/efficient gatekeepers. 'fifteen'
    // fires far more often, the single highest-leverage lever found
    // empirically against the diagnosing matchups (see BACKLOG.md's
    // Breacher gatekeeper-fragility writeup for the full candidate
    // comparison) -- a bigger identity change than a pure magnitude
    // tweak, confirmed deliberately rather than defaulted to.
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'session-lock',
    name: 'Session Lock',
    archetype: 'encryption',
    // Onboarding fix from session 12: originally "heat above threshold,"
    // changed to "dealer this hand" so it isn't dead on turn one for the
    // introductory class.
    trigger: { kind: 'selfState', condition: 'isDealer' },
    payload: { kind: 'instantCounterPush', amount: CAPPED.common },
    tags: ['direct'],
  },
  {
    // Session 29 replacement for Steady Hand: Breacher's suppression pair
    // (this + Session Lock) fed every mitigation cast into
    // mitigationBanked but never converted it into a real credit, so a
    // patient/defensive opponent could out-stall Breacher until the
    // hand-20 hard tiebreak (always resolves to the defender) sealed an
    // automatic loss. Same accumulator/mitigationBanked mechanism as the
    // Neutral Archetype's Circuit Breaker (see NEUTRAL_RARES above),
    // sized for a single starting-kit mitigation source rather than a
    // full grown loadout -- "holding the position" now eventually forces
    // an opening instead of only ever denying one. threshold: 28 (~4
    // Session Lock casts) / amount: COMMON.burst chosen after an initial
    // CAPPED.uncommon/threshold-14 pass overshot badly (10%->99% win rate
    // against the diagnosing matchup, Legacy Firewall) -- retuned down to
    // a real, not trivializing, improvement (see BACKLOG.md session 29).
    //
    // threshold 28 -> 20, amount COMMON.burst(5) -> 7 (balance pass,
    // session 38 follow-up): a gatekeeper-tier sweep found Breacher's
    // own mitigationBanked->credit conversion was dramatically less
    // efficient than the same mechanism on gatekeepers that use it
    // (Firewall Prime's Circuit Breaker: threshold 10, payload 16, fed
    // by 2 mitigation-banking sources vs Breacher's 1) -- not trying to
    // match that ratio outright (Breacher is a starting-kit piece, not a
    // bespoke gatekeeper one), just closing enough of the gap to raise
    // the floor without trivializing easy matchups (still 100% against
    // weak enemies after this change, empirically). See BACKLOG.md's
    // Breacher gatekeeper-fragility writeup for the full candidate
    // comparison against Firewall Prime/Ghost Process/Incident Response/
    // Zero-Sum. Still TBD/playtesting like every other numeric constant.
    id: 'lock-fatigue',
    name: 'Lock Fatigue',
    archetype: 'encryption',
    trigger: { kind: 'accumulator', metric: 'mitigationBanked', threshold: 20 },
    payload: { kind: 'directBurst', amount: 7 },
    tags: ['daemon'],
  },
];

export const BLACKHAT_LOADOUT: SubroutineDefinition[] = [
  {
    id: 'payload-drop',
    name: 'Payload Drop',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    // traceCost 4 -> 3 (balance pass, session 38/checkpoint-J follow-up):
    // empirically swept against explore-heavy play alongside Static
    // Noise's own fix below -- see BACKLOG.md's Blackhat Heat-fragility
    // writeup for the full candidate comparison.
    payload: { kind: 'riskRewardBurst', amount: COMMON.burst + 2 },
    traceCost: EXPLOIT_TRACE_COST,
    tags: ['direct'],
  },
  {
    id: 'logic-bomb',
    name: 'Logic Bomb',
    archetype: 'malware',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'castersTurnPulse', duration: COMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'static-noise',
    name: 'Static Noise',
    archetype: 'exploit',
    trigger: { kind: 'always' },
    // traceCost 1 -> 0 (balance pass): an Always-triggered Cantrip fires
    // essentially every turn, so any nonzero traceCost here multiplies
    // directly with fight length/count -- empirically the dominant driver
    // of Blackhat's explore-mode Heat fragility (a 2% explore win rate,
    // 65.5% heat-outs), far more than Payload Drop's own reduction above.
    // A guaranteed-every-turn, deliberately low-power Cantrip shouldn't
    // also be a guaranteed Heat tax -- that was a side effect of reusing
    // riskRewardBurst for it, not an intended part of its "always fires"
    // identity.
    payload: { kind: 'riskRewardBurst', amount: 3 },
    // Session 47: a cantrip named *static noise* that generated none.
    // 1 rather than EXPLOIT_TRACE_COST because an `always` trigger fires
    // ~12.7 times a fight -- this is a constant hum, not a spike.
    traceCost: 1,
    tags: ['daemon'],
  },
];

export const SABOTEUR_LOADOUT: SubroutineDefinition[] = [
  {
    id: 'silent-worm',
    name: 'Silent Worm',
    archetype: 'malware',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    // Simplified: DESIGN.md also has this "feed a Root subroutine's
    // condition each tick" — not representable by one payload, see file
    // header. Background Process below covers the same "corrupt and
    // manipulate together" idea independently.
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'globalPulse', duration: COMMON.duration, pointsPerTick: COMMON.pointsPerTick },
    tags: ['worm'],
  },
  {
    id: 'time-bomb',
    name: 'Time Bomb',
    archetype: 'root',
    trigger: { kind: 'enemyState', condition: 'breachContainmentBelow', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: {
      kind: 'scheduledSabotage',
      resolvesAt: 'nextDeal',
      effect: { kind: 'instantManipulation', target: 'enemyGauge', amount: COMMON.burst },
    },
    tags: ['trap'],
  },
  {
    id: 'background-process',
    name: 'Background Process',
    archetype: 'root',
    trigger: { kind: 'always' },
    payload: { kind: 'instantManipulation', target: 'subroutineProgress', amount: 2, targetSubroutineId: 'time-bomb' },
    tags: ['daemon'],
  },
];

export const OPERATOR_LOADOUT: SubroutineDefinition[] = [
  {
    id: 'precision-strike',
    name: 'Precision Strike',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'instant' },
    payload: { kind: 'piercing', amount: COMMON.burst },
    tags: ['piercing'],
  },
  {
    id: 'priority-override',
    name: 'Priority Override',
    archetype: 'root',
    trigger: { kind: 'enemyState', condition: 'gaugeFillAbove', fraction: GAUGE_FILL_FRACTION },
    payload: { kind: 'instantManipulation', target: 'subroutineProgress', amount: 3, targetSubroutineId: 'precision-strike' },
    tags: ['direct'],
  },
  {
    id: 'ping-sweep',
    name: 'Ping Sweep',
    archetype: 'root',
    trigger: { kind: 'always' },
    payload: { kind: 'instantManipulation', target: 'enemyGauge', amount: 1 },
    tags: ['daemon'],
  },
];

export const WARDEN_LOADOUT: SubroutineDefinition[] = [
  {
    id: 'memory-leak',
    name: 'Memory Leak',
    archetype: 'malware',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'globalPulse', duration: COMMON.duration, pointsPerTick: COMMON.pointsPerTick },
    tags: ['daemon'],
  },
  {
    id: 'redundant-systems',
    name: 'Redundant Systems',
    archetype: 'encryption',
    // Corrected from DESIGN.md's "Self-state: Breach/Containment in
    // enemy's favor" -- see file header. Kept as a buildup-requiring
    // trigger per session 12 (Warden's own grind-back theme).
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'hot', amountPerTick: CAPPED.common - 2, cadence: 'castersTurnPulse', duration: COMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'routine-maintenance',
    name: 'Routine Maintenance',
    archetype: 'encryption',
    trigger: { kind: 'always' },
    payload: { kind: 'hot', amountPerTick: 3, cadence: 'castersTurnPulse', duration: 3 },
    tags: ['daemon'],
  },
];

export const GHOST_LOADOUT: SubroutineDefinition[] = [
  {
    // Session 26: replaces Null Session. Null Session's enemyState-
    // gated trigger meant it (and Kill Switch below) couldn't fire
    // until the *enemy's own* gauge crossed a threshold, regardless of
    // how well the player was playing -- the actual mechanism behind
    // Ghost's win rate barely moving with player skill (the 4x4
    // class-balance sweep, BACKLOG.md). Steganography's trigger is the
    // player's own accumulated points instead, and its Ward payload
    // reaches Return to Sender's absorb hook for the first time from
    // the starting kit (previously unreachable -- none of Ghost's 3
    // starting pieces cast Ward or HoT).
    id: 'steganography',
    name: 'Steganography',
    archetype: 'encryption',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'ward', amount: CAPPED.common },
    tags: ['daemon', 'firewall'],
  },
  {
    // Session 26: replaces Kill Switch -- same denial effect and tag,
    // re-triggered off the player's own play (an instant pair, not
    // enemy gauge state) for the same reason as Steganography above.
    // Occurrence rather than Accumulator so the two pieces don't fire
    // in lockstep; reactive + 'instant' fits the trap/ambush flavor.
    id: 'tripwire',
    name: 'Tripwire',
    archetype: 'root',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'instant' },
    payload: {
      kind: 'scheduledSabotage',
      resolvesAt: 'nextDeal',
      effect: { kind: 'instantManipulation', target: 'enemyGaugeThreshold', amount: COMMON.burst },
    },
    tags: ['trap'],
    reactive: true,
  },
  // Session 28: Low Profile retired in favor of the neutral Idle
  // Process -- Ghost's real starting kit measured a 0% genuine win rate
  // (30-seed check against a plain opponent, all attrition losses,
  // peak fill fraction never above ~0.17) once resolveHardTiebreak
  // stopped rewarding a thin fractional lead. Root cause: Encryption/
  // Root have no payload kind that ever credits the caster's own
  // win-gauge, so Ghost's kit (Steganography/Tripwire, both real, but
  // neither one a credit) had zero path to victory. Idle Process is the
  // fix -- same Always-triggered, guaranteed-every-turn Cantrip slot
  // Low Profile held, but Neutral instead of Root, and it actually
  // moves Ghost's own gauge. See DESIGN.md's "Neutral Archetype".
  IDLE_PROCESS,
];

export const CLASS_STARTING_LOADOUTS = {
  breacher: BREACHER_LOADOUT,
  blackhat: BLACKHAT_LOADOUT,
  saboteur: SABOTEUR_LOADOUT,
  operator: OPERATOR_LOADOUT,
  warden: WARDEN_LOADOUT,
  ghost: GHOST_LOADOUT,
} as const;

// ---------------------------------------------------------------------
// Exploit archetype pool (30, session 21+ / session 41's +15).
// ---------------------------------------------------------------------

export const EXPLOIT_COMMONS: SubroutineDefinition[] = [
  {
    id: 'fuzzer',
    name: 'Fuzzer',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'race-condition',
    name: 'Race Condition',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'go', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'off-by-one',
    name: 'Off-By-One',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'thirtyOne', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'credential-stuffing',
    name: 'Credential Stuffing',
    archetype: 'exploit',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['daemon'],
  },
  {
    id: 'port-scan',
    name: 'Port Scan',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'instant' },
    payload: { kind: 'piercing', amount: COMMON.burst },
    tags: ['piercing'],
  },
  {
    id: 'privilege-escalation',
    name: 'Privilege Escalation',
    archetype: 'exploit',
    trigger: { kind: 'selfState', condition: 'isDealer' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'script-kiddie',
    name: 'Script Kiddie',
    archetype: 'exploit',
    trigger: { kind: 'always' },
    payload: { kind: 'directBurst', amount: 2 },
    tags: ['daemon'],
  },
  // --- Session 41 pool expansion (+7) ---
  {
    id: 'ssh-bruteforce',
    name: 'SSH Bruteforce',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'hisNobs', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'deuces-wild',
    name: 'Deuces Wild',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'threshold', bankTarget: COMMON.bankTarget },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['trap'],
  },
  {
    id: 'rainbow-table',
    name: 'Rainbow Table',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'run', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'drone-recon',
    name: 'Drone Recon',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'threshold', bankTarget: COMMON.bankTarget },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['trap'],
  },
  {
    id: 'skimmer',
    name: 'Skimmer',
    archetype: 'exploit',
    // hasDebuff: 'any' (session 41) -- fires off the enemy carrying any
    // active debuff at all, not one specific kind.
    trigger: { kind: 'enemyState', condition: 'hasDebuff', debuffId: 'any' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'dictionary-attack',
    name: 'Dictionary Attack',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'thirtyOne', variation: 'threshold', bankTarget: COMMON.bankTarget },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['trap'],
  },
  {
    id: 'doorknob-rattle',
    name: 'Doorknob Rattle',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'go', variation: 'threshold', bankTarget: COMMON.bankTarget },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: ['trap'],
  },
];

export const EXPLOIT_UNCOMMONS: SubroutineDefinition[] = [
  {
    id: 'zero-day-chain',
    name: 'Zero-Day Chain',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'instant' },
    payload: { kind: 'chainFinisherScaling', baseAmount: UNCOMMON.burst - 3, perPriorFire: 3 },
    tags: ['worm'],
  },
  {
    id: 'buffer-overrun',
    name: 'Buffer Overrun',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'run', variation: 'threshold', bankTarget: UNCOMMON.bankTarget },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: ['trap'],
  },
  {
    id: 'watering-hole',
    name: 'Watering Hole',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'scaling', cap: UNCOMMON.cap },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: ['trap'],
  },
  {
    id: 'drive-by-exploit',
    name: 'Drive-By Exploit',
    archetype: 'exploit',
    trigger: { kind: 'chained', afterArchetype: 'exploit' },
    payload: { kind: 'piercing', amount: UNCOMMON.burst },
    tags: ['worm', 'piercing'],
  },
  {
    id: 'payload-multiplier',
    name: 'Payload Multiplier',
    archetype: 'exploit',
    trigger: { kind: 'selfState', condition: 'traceAbove', value: UNCOMMON.trace },
    payload: { kind: 'riskRewardBurst', amount: UNCOMMON.burst + 2 },
    traceCost: EXPLOIT_TRACE_COST,
    // Session 41's own retrofit list missed this piece (37 named vs. the
    // real 38 untagged) -- Direct per the same reasoning as its sibling
    // Payload Drop (starting loadout): immediate single-shot risk/reward,
    // none of the other 5 mechanisms.
    tags: ['direct'],
  },
  // --- Session 41 pool expansion (+5) ---
  {
    id: 'jackpot',
    name: 'Jackpot',
    archetype: 'exploit',
    // Scaling cap held at 3, below UNCOMMON.cap (4) -- His Nobs is a
    // scarcer occurrence than Flush/Pair, so a lower cap keeps the bank
    // reachable in a real match (session 41's spec).
    trigger: { kind: 'occurrence', category: 'hisNobs', variation: 'scaling', cap: 3 },
    payload: { kind: 'piercing', amount: UNCOMMON.burst },
    tags: ['piercing', 'trap'],
  },
  {
    id: 'race-to-the-bottom',
    name: 'Race to the Bottom',
    archetype: 'exploit',
    trigger: { kind: 'enemyState', condition: 'breachContainmentBelow', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: { kind: 'riskRewardBurst', amount: UNCOMMON.burst + 2 },
    traceCost: EXPLOIT_TRACE_COST,
    tags: ['direct'],
  },
  {
    id: 'botnet-recruiter',
    name: 'Botnet Recruiter',
    archetype: 'exploit',
    trigger: { kind: 'chained', afterTag: 'daemon' },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: ['worm'],
  },
  {
    id: 'turbo-mode',
    name: 'Turbo Mode',
    archetype: 'exploit',
    trigger: { kind: 'selfState', condition: 'isNonDealer' },
    payload: { kind: 'riskRewardBurst', amount: UNCOMMON.burst + 2 },
    traceCost: EXPLOIT_TRACE_COST,
    tags: ['direct'],
  },
  {
    id: 'smash-and-grab',
    name: 'Smash and Grab',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'scaling', cap: UNCOMMON.cap },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: ['trap'],
  },
];

export const EXPLOIT_RARES: SubroutineDefinition[] = [
  {
    id: 'supply-chain-compromise',
    name: 'Supply Chain Compromise',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'run', variation: 'scaling', cap: RARE.cap },
    payload: { kind: 'chainFinisherScaling', baseAmount: RARE.burst - 4, perPriorFire: 5 },
    tags: ['worm'],
    togglable: true,
  },
  {
    id: 'total-pwnage',
    name: 'Total Pwnage',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'threshold', bankTarget: RARE.bankTarget },
    payload: { kind: 'piercing', amount: RARE.burst },
    tags: ['piercing'],
  },
  {
    id: 'vulnerability-scan',
    name: 'Vulnerability Scan',
    archetype: 'exploit',
    // gaugeFillAbove -> breachContainmentAbove (session 40 continued —
    // see GAUGE_FILL_FRACTION's own header comment above for why): this
    // was authored as a rare, late-game "opponent's about to win, punish
    // them" reactive piercing burst, but gaugeFillAbove can't deliver
    // that framing. High threshold for the same late-punish timing the
    // original HOT_GAUGE_FILL_FRACTION intended.
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'piercing', amount: RARE.burst },
    tags: ['piercing'],
    reactive: true,
  },
  // --- Session 41 pool expansion (+3) ---
  {
    id: 'zero-click-exploit',
    name: 'Zero-Click Exploit',
    archetype: 'exploit',
    // Threshold held at 3, below RARE.bankTarget (4) -- same His Nobs
    // scarcity reasoning as Jackpot above.
    trigger: { kind: 'occurrence', category: 'hisNobs', variation: 'threshold', bankTarget: 3 },
    payload: { kind: 'piercing', amount: RARE.burst },
    tags: ['piercing', 'trap'],
  },
  {
    id: 'full-compromise',
    name: 'Full Compromise',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'run', variation: 'scaling', cap: RARE.cap },
    payload: { kind: 'piercing', amount: RARE.burst },
    tags: ['piercing', 'trap'],
  },
  {
    id: 'botnet-herder',
    name: 'Botnet Herder',
    archetype: 'exploit',
    trigger: { kind: 'chained', afterArchetype: 'malware' },
    payload: { kind: 'chainFinisherScaling', baseAmount: RARE.burst - 4, perPriorFire: 5 },
    tags: ['worm'],
  },
];

// ---------------------------------------------------------------------
// Malware archetype pool (30, session 21+ / session 41's +15).
// ---------------------------------------------------------------------

export const MALWARE_COMMONS: SubroutineDefinition[] = [
  {
    id: 'ransomware',
    name: 'Ransomware',
    archetype: 'malware',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'castersTurnPulse', duration: COMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'trojan',
    name: 'Trojan',
    archetype: 'malware',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'globalPulse', duration: COMMON.duration, pointsPerTick: COMMON.pointsPerTick },
    tags: ['daemon'],
  },
  {
    id: 'keylogger',
    name: 'Keylogger',
    archetype: 'malware',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'instant' },
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'castersTurnPulse', duration: COMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'adware',
    name: 'Adware',
    archetype: 'malware',
    trigger: { kind: 'always' },
    payload: { kind: 'dot', amountPerTick: 1, cadence: 'castersTurnPulse', duration: COMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'slowloris',
    name: 'Slowloris',
    archetype: 'malware',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'debuff', debuffId: 'throttled', magnitude: COMMON.debuffMag, duration: COMMON.debuffDur },
    tags: ['daemon'],
  },
  {
    id: 'botnet',
    name: 'Botnet',
    archetype: 'malware',
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'debuff', debuffId: 'choked', magnitude: COMMON.debuffMag, duration: COMMON.debuffDur },
    tags: ['direct'],
  },
  {
    id: 'corrupted-cache',
    name: 'Corrupted Cache',
    archetype: 'malware',
    trigger: { kind: 'selfState', condition: 'traceAbove', value: COMMON.trace },
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'castersTurnPulse', duration: COMMON.duration },
    tags: ['daemon'],
  },
  // --- Session 41 pool expansion (+7) ---
  {
    id: 'cache-poisoning',
    name: 'Cache Poisoning',
    archetype: 'malware',
    // Threshold held at 4, above COMMON.bankTarget (2) -- Fifteen is
    // common enough that the default bank would fire almost every hand,
    // out of step with a debuff's own DESIGN.md-intended pacing.
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'threshold', bankTarget: 4 },
    payload: { kind: 'debuff', debuffId: 'corrupted', magnitude: COMMON.debuffMag, duration: COMMON.debuffDur },
    tags: ['trap'],
  },
  {
    id: 'dead-mans-switch',
    name: "Dead Man's Switch",
    archetype: 'malware',
    trigger: { kind: 'occurrence', category: 'hisNobs', variation: 'instant' },
    payload: { kind: 'debuff', debuffId: 'choked', magnitude: COMMON.debuffMag, duration: COMMON.debuffDur },
    tags: ['direct'],
  },
  {
    id: 'rootkit',
    name: 'Rootkit',
    archetype: 'malware',
    trigger: { kind: 'occurrence', category: 'thirtyOne', variation: 'instant' },
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'castersTurnPulse', duration: COMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'backdoor-shell',
    name: 'Backdoor Shell',
    archetype: 'malware',
    trigger: { kind: 'occurrence', category: 'go', variation: 'instant' },
    payload: { kind: 'debuff', debuffId: 'throttled', magnitude: COMMON.debuffMag, duration: COMMON.debuffDur },
    tags: ['direct'],
  },
  {
    id: 'cryptojacker',
    name: 'Cryptojacker',
    archetype: 'malware',
    trigger: { kind: 'accumulator', metric: 'suitTally', suit: 1, threshold: COMMON.threshold },
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'castersTurnPulse', duration: COMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'drive-by-download',
    name: 'Drive-By Download',
    archetype: 'malware',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'instant' },
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'globalPulse', duration: COMMON.duration, pointsPerTick: COMMON.pointsPerTick },
    tags: ['daemon'],
  },
  {
    id: 'sleeper-agent',
    name: 'Sleeper Agent',
    archetype: 'malware',
    trigger: { kind: 'selfState', condition: 'isDealer' },
    payload: { kind: 'dot', amountPerTick: COMMON.tick, cadence: 'castersTurnPulse', duration: COMMON.duration },
    tags: ['daemon'],
  },
];

export const MALWARE_UNCOMMONS: SubroutineDefinition[] = [
  {
    id: 'fork-bomb',
    name: 'Fork Bomb',
    archetype: 'malware',
    trigger: { kind: 'occurrence', category: 'run', variation: 'threshold', bankTarget: UNCOMMON.bankTarget },
    payload: { kind: 'dot', amountPerTick: UNCOMMON.tick, cadence: 'castersTurnPulse', duration: UNCOMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'polymorphic-worm',
    name: 'Polymorphic Worm',
    archetype: 'malware',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'scaling', cap: UNCOMMON.cap },
    payload: { kind: 'debuff', debuffId: 'corrupted', magnitude: UNCOMMON.debuffMag, duration: UNCOMMON.debuffDur },
    tags: ['worm'],
  },
  {
    id: 'spyware',
    name: 'Spyware',
    archetype: 'malware',
    trigger: { kind: 'enemyState', condition: 'hasDebuff', debuffId: 'corrupted' },
    payload: { kind: 'dot', amountPerTick: UNCOMMON.tick, cadence: 'castersTurnPulse', duration: UNCOMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'chain-infection',
    name: 'Chain Infection',
    archetype: 'malware',
    trigger: { kind: 'chained', afterArchetype: 'malware' },
    payload: { kind: 'debuff', debuffId: 'throttled', magnitude: UNCOMMON.debuffMag, duration: UNCOMMON.debuffDur },
    tags: ['worm'],
  },
  {
    id: 'persistent-threat',
    name: 'Persistent Threat',
    archetype: 'malware',
    trigger: { kind: 'selfState', condition: 'isNonDealer' },
    payload: { kind: 'dot', amountPerTick: UNCOMMON.tick, cadence: 'globalPulse', duration: UNCOMMON.duration, pointsPerTick: UNCOMMON.pointsPerTick },
    tags: ['daemon'],
  },
  // --- Session 41 pool expansion (+5) ---
  {
    id: 'zombie-network',
    name: 'Zombie Network',
    archetype: 'malware',
    // Threshold held at 2, below UNCOMMON.bankTarget (3) -- spec's own
    // explicit "(2)" call.
    trigger: { kind: 'occurrence', category: 'pair', variation: 'threshold', bankTarget: 2 },
    payload: { kind: 'debuff', debuffId: 'corrupted', magnitude: UNCOMMON.debuffMag, duration: UNCOMMON.debuffDur },
    tags: ['trap'],
  },
  {
    id: 'supply-chain-malware',
    name: 'Supply Chain Malware',
    archetype: 'malware',
    trigger: { kind: 'occurrence', category: 'run', variation: 'instant' },
    payload: { kind: 'dot', amountPerTick: UNCOMMON.tick, cadence: 'globalPulse', duration: UNCOMMON.duration, pointsPerTick: UNCOMMON.pointsPerTick },
    tags: ['daemon'],
  },
  {
    id: 'data-exfiltration',
    name: 'Data Exfiltration',
    archetype: 'malware',
    // Grab-and-go framing: the enemy's own containment running high means
    // they're close to breaching, the moment worth stealing data before
    // it's over.
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'debuff', debuffId: 'choked', magnitude: UNCOMMON.debuffMag, duration: UNCOMMON.debuffDur },
    tags: ['direct'],
    reactive: true,
  },
  {
    id: 'fileless-malware',
    name: 'Fileless Malware',
    archetype: 'malware',
    trigger: { kind: 'chained', afterTag: 'daemon' },
    payload: { kind: 'dot', amountPerTick: UNCOMMON.tick, cadence: 'castersTurnPulse', duration: UNCOMMON.duration },
    tags: ['daemon', 'worm'],
  },
  {
    id: 'insider-threat',
    name: 'Insider Threat',
    archetype: 'malware',
    trigger: { kind: 'accumulator', metric: 'suitTally', suit: 2, threshold: UNCOMMON.threshold },
    payload: { kind: 'debuff', debuffId: 'throttled', magnitude: UNCOMMON.debuffMag, duration: UNCOMMON.debuffDur },
    tags: ['daemon'],
  },
];

export const MALWARE_RARES: SubroutineDefinition[] = [
  {
    id: 'epidemic',
    name: 'Epidemic',
    archetype: 'malware',
    trigger: { kind: 'accumulator', metric: 'suitTally', suit: 1, threshold: RARE.threshold },
    payload: { kind: 'dot', amountPerTick: RARE.tick, cadence: 'globalPulse', duration: RARE.duration, pointsPerTick: RARE.pointsPerTick },
    tags: ['daemon'],
    togglable: true,
  },
  {
    id: 'ransomware-cascade',
    name: 'Ransomware Cascade',
    archetype: 'malware',
    trigger: { kind: 'chained', afterArchetype: 'malware' },
    payload: { kind: 'dot', amountPerTick: RARE.tick + 3, cadence: 'globalPulse', duration: RARE.duration, pointsPerTick: RARE.pointsPerTick },
    tags: ['worm'],
  },
  {
    id: 'total-compromise',
    name: 'Total Compromise',
    archetype: 'malware',
    trigger: { kind: 'enemyState', condition: 'breachContainmentBelow', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: { kind: 'dot', amountPerTick: RARE.tick, cadence: 'globalPulse', duration: RARE.duration, pointsPerTick: RARE.pointsPerTick },
    tags: ['daemon'],
    reactive: true,
  },
  // --- Session 41 pool expansion (+3) ---
  {
    id: 'doomsday-clock',
    name: 'Doomsday Clock',
    archetype: 'malware',
    // The only His Heels piece in the whole 57-piece pass (session 41's
    // spec): real frequency data (scripts/occurrence-frequency.ts) puts
    // His Heels at 0.076/hand, the rarest category in the game -- Instant
    // variation only, rare tier only, exactly this one instance, or a
    // Threshold/Scaling piece here would be functionally dead content.
    trigger: { kind: 'occurrence', category: 'hisHeels', variation: 'instant' },
    payload: { kind: 'dot', amountPerTick: RARE.tick, cadence: 'globalPulse', duration: RARE.duration, pointsPerTick: RARE.pointsPerTick },
    tags: ['daemon'],
  },
  {
    id: 'cascading-failure',
    name: 'Cascading Failure',
    archetype: 'malware',
    trigger: { kind: 'chained', afterArchetype: 'malware' },
    payload: { kind: 'dot', amountPerTick: RARE.tick, cadence: 'globalPulse', duration: RARE.duration, pointsPerTick: RARE.pointsPerTick },
    tags: ['worm', 'daemon'],
  },
  {
    id: 'digital-plague',
    name: 'Digital Plague',
    archetype: 'malware',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'scaling', cap: RARE.cap },
    payload: { kind: 'debuff', debuffId: 'corrupted', magnitude: RARE.debuffMag, duration: RARE.debuffDur },
    // Trap, not Worm -- session 41's own correction to its first-pass
    // draft (a scaling-bank occurrence piece with no chain/propagation of
    // its own is Trap's shape, not Worm's).
    tags: ['trap'],
  },
];

// ---------------------------------------------------------------------
// Encryption archetype pool (30: 15 session 21+, +6 session 40, +9 session 41).
// ---------------------------------------------------------------------

export const ENCRYPTION_COMMONS: SubroutineDefinition[] = [
  {
    id: 'basic-auth',
    name: 'Basic Auth',
    archetype: 'encryption',
    trigger: { kind: 'selfState', condition: 'isDealer' },
    payload: { kind: 'instantCounterPush', amount: CAPPED.common },
    tags: ['direct'],
  },
  {
    id: 'checksum',
    name: 'Checksum',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'instantCounterPush', amount: CAPPED.common },
    tags: ['direct'],
  },
  {
    id: 'patch',
    name: 'Patch',
    archetype: 'encryption',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'cleanse' },
    tags: ['daemon'],
  },
  {
    id: 'sandboxing',
    name: 'Sandboxing',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'instant' },
    payload: { kind: 'ward', amount: CAPPED.common },
    tags: ['firewall'],
  },
  {
    id: 'two-factor',
    name: 'Two-Factor',
    archetype: 'encryption',
    trigger: { kind: 'selfState', condition: 'traceBelow', value: COMMON.trace },
    payload: { kind: 'instantCounterPush', amount: CAPPED.common },
    tags: ['direct'],
  },
  {
    id: 'access-control',
    name: 'Access Control',
    archetype: 'encryption',
    trigger: { kind: 'selfState', condition: 'isNonDealer' },
    payload: { kind: 'ward', amount: CAPPED.common },
    tags: ['firewall'],
  },
  {
    id: 'patch-notes',
    name: 'Patch Notes',
    archetype: 'encryption',
    trigger: { kind: 'always' },
    payload: { kind: 'instantCounterPush', amount: 2 },
    tags: ['daemon'],
  },
  {
    // Content-validation sample (session 40 continued, Archetype
    // Win-Condition Audit) -- wardCounter's own smallest, most-common
    // exposure: fires on every fifteen, arming a modest counter ratio.
    id: 'intrusion-alarm',
    name: 'Intrusion Alarm',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'wardCounter', amount: CAPPED.common, ratio: 0.1 },
    tags: ['firewall'],
  },
  {
    // Content-validation sample -- wardBash at a low, common-tier
    // fraction: spends a modest slice of the shield, leaves most of it
    // intact for continued defense.
    id: 'quick-patch',
    name: 'Quick Patch',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'instant' },
    payload: { kind: 'wardBash', fraction: 0.25 },
    tags: ['piercing'],
  },
  // --- Session 41 pool expansion (+5) ---
  {
    id: 'secure-boot',
    name: 'Secure Boot',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'thirtyOne', variation: 'instant' },
    payload: { kind: 'instantCounterPush', amount: CAPPED.common },
    tags: ['direct'],
  },
  {
    id: 'rate-shaping',
    name: 'Rate Shaping',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'go', variation: 'instant' },
    payload: { kind: 'ward', amount: CAPPED.common },
    tags: ['firewall'],
  },
  {
    id: 'key-rotation',
    name: 'Key Rotation',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'hisNobs', variation: 'instant' },
    payload: { kind: 'cleanse' },
    tags: ['firewall'],
  },
  {
    id: 'fail2ban',
    name: 'Fail2Ban',
    archetype: 'encryption',
    // hasDebuff: 'any' (session 41, added checkpoint C) -- fires off the
    // enemy carrying any active debuff at all.
    trigger: { kind: 'enemyState', condition: 'hasDebuff', debuffId: 'any' },
    payload: { kind: 'instantCounterPush', amount: CAPPED.common },
    tags: ['direct'],
  },
  {
    id: 'heartbeat-monitor',
    name: 'Heartbeat Monitor',
    archetype: 'encryption',
    // Renamed before authoring (session 41): the conversational draft's
    // "Watchdog Timer" duplicated the existing Neutral rare of the same
    // name.
    // Threshold held at 4, below COMMON.threshold (6) -- a steady
    // low-bar defensive tick, distinct from Patch's own points-threshold
    // piece.
    trigger: { kind: 'accumulator', metric: 'points', threshold: 4 },
    payload: { kind: 'ward', amount: CAPPED.common },
    tags: ['daemon', 'firewall'],
  },
];

export const ENCRYPTION_UNCOMMONS: SubroutineDefinition[] = [
  {
    id: 'rate-limiting',
    name: 'Rate Limiting',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'threshold', bankTarget: UNCOMMON.bankTarget },
    payload: { kind: 'instantCounterPush', amount: CAPPED.uncommon },
    tags: ['trap'],
  },
  {
    id: 'honeypot',
    name: 'Honeypot',
    archetype: 'encryption',
    // gaugeFillAbove -> breachContainmentAbove (session 40 continued --
    // see GAUGE_FILL_FRACTION's own header comment above for why): a
    // proactive "ward up before things get dangerous" defensive
    // reaction, same low-threshold early-warning framing as Fail-Secure
    // (enemy-subroutines.ts). Also gained reactive:true here -- it was
    // missing entirely, a second, compounding bug: a non-reactive
    // enemyState trigger re-arms every evaluation pass while its
    // condition holds, refiring every remaining turn rather than once
    // per real renewed crossing (see enemy-subroutines.ts's own
    // Escalating Response/Fail-Secure comments for the same structural
    // requirement).
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: { kind: 'ward', amount: CAPPED.uncommon },
    tags: ['firewall'],
    reactive: true,
  },
  {
    id: 'sinkhole',
    name: 'Sinkhole',
    archetype: 'encryption',
    trigger: { kind: 'chained', afterArchetype: 'encryption' },
    payload: { kind: 'cleanse' },
    tags: ['worm'],
  },
  {
    id: 'redundant-backup',
    name: 'Redundant Backup',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'run', variation: 'scaling', cap: UNCOMMON.cap },
    payload: { kind: 'hot', amountPerTick: UNCOMMON.tick + 2, cadence: 'castersTurnPulse', duration: UNCOMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'air-gap',
    name: 'Air Gap',
    archetype: 'encryption',
    trigger: { kind: 'selfState', condition: 'traceAbove', value: UNCOMMON.trace },
    payload: { kind: 'ward', amount: CAPPED.common },
    tags: ['firewall'],
    reactive: true,
  },
  {
    // Content-validation sample -- drainingHot at uncommon tier, same
    // occurrence:run,scaling trigger shape as Redundant Backup above (a
    // real sibling, not a new pattern).
    id: 'honeytoken',
    name: 'Honeytoken',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'run', variation: 'scaling', cap: UNCOMMON.cap },
    payload: { kind: 'drainingHot', amountPerTick: UNCOMMON.tick, cadence: 'castersTurnPulse', duration: UNCOMMON.duration, ratio: 0.15 },
    tags: ['daemon'],
  },
  // --- Session 41 pool expansion (+4) ---
  {
    id: 'circuit-isolation',
    name: 'Circuit Isolation',
    archetype: 'encryption',
    // An early insurance-policy ward: arms while the enemy is still
    // behind (same low threshold Port Forward reads offensively), so
    // defense is already up well before it's actually needed. reactive:
    // true for the same "don't refire every remaining turn" reason
    // Honeypot/Air Gap need it (see Honeypot's own comment above).
    trigger: { kind: 'enemyState', condition: 'breachContainmentBelow', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: { kind: 'ward', amount: CAPPED.uncommon },
    tags: ['firewall'],
    reactive: true,
  },
  {
    id: 'session-timeout',
    name: 'Session Timeout',
    archetype: 'encryption',
    // Threshold held at 2, below UNCOMMON.bankTarget (3) -- spec's own
    // explicit "(2)" call.
    trigger: { kind: 'occurrence', category: 'hisNobs', variation: 'threshold', bankTarget: 2 },
    payload: { kind: 'wardCounter', amount: CAPPED.uncommon, ratio: 0.15 },
    // Firewall + Trap (session 41's own correction to its first-pass
    // draft): a counter-ward armed off a banked occurrence is both a
    // defensive mechanism and delayed/conditional in the Trap sense.
    tags: ['firewall', 'trap'],
  },
  {
    id: 'air-gapped-vault',
    name: 'Air-Gapped Vault',
    archetype: 'encryption',
    trigger: { kind: 'accumulator', metric: 'suitTally', suit: 2, threshold: UNCOMMON.threshold },
    payload: { kind: 'hot', amountPerTick: UNCOMMON.tick, cadence: 'castersTurnPulse', duration: UNCOMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'isolation-chamber',
    name: 'Isolation Chamber',
    archetype: 'encryption',
    trigger: { kind: 'chained', afterTag: 'firewall' },
    payload: { kind: 'ward', amount: CAPPED.uncommon },
    // Firewall + Worm (session 41's own correction to its first-pass
    // draft): Worm for the chain/propagation itself, Firewall for what
    // it actually does.
    tags: ['firewall', 'worm'],
  },
];

export const ENCRYPTION_RARES: SubroutineDefinition[] = [
  {
    id: 'zero-trust',
    name: 'Zero Trust',
    archetype: 'encryption',
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'instantCounterPush', amount: CAPPED.rare },
    tags: ['firewall'],
    reactive: true,
  },
  {
    id: 'cold-storage',
    name: 'Cold Storage',
    archetype: 'encryption',
    trigger: { kind: 'accumulator', metric: 'suitTally', suit: 2, threshold: RARE.threshold },
    payload: { kind: 'hot', amountPerTick: RARE.tick + 4, cadence: 'globalPulse', duration: RARE.duration, pointsPerTick: RARE.pointsPerTick },
    tags: ['daemon'],
    togglable: true,
  },
  {
    id: 'full-rollback',
    name: 'Full Rollback',
    archetype: 'encryption',
    // Simplified from "removes all active debuffs" -- Cleanse only
    // removes one, see file header.
    trigger: { kind: 'chained', afterTag: 'firewall' },
    payload: { kind: 'cleanse' },
    tags: ['worm'],
  },
  {
    // Content-validation sample -- wardCounter at rare tier, paired with
    // a heat-fluctuating selfState trigger (same reactive:true need as
    // Air Gap above, for the same reason: re-arms on each new crossing
    // rather than latching once and staying ready forever).
    id: 'deep-packet-inspection',
    name: 'Deep Packet Inspection',
    archetype: 'encryption',
    trigger: { kind: 'selfState', condition: 'traceAbove', value: RARE.trace },
    payload: { kind: 'wardCounter', amount: CAPPED.rare, ratio: 0.2 },
    tags: ['firewall'],
    reactive: true,
  },
  {
    // Content-validation sample -- drainingHot at rare tier, same
    // accumulator:suitTally/globalPulse shape as Cold Storage above but
    // watching a different suit (suit 1, not Cold Storage's suit 2) so
    // the two don't compete for the same tally.
    id: 'honeynet',
    name: 'Honeynet',
    archetype: 'encryption',
    trigger: { kind: 'accumulator', metric: 'suitTally', suit: 1, threshold: RARE.threshold },
    payload: { kind: 'drainingHot', amountPerTick: RARE.tick + 2, cadence: 'globalPulse', duration: RARE.duration, pointsPerTick: RARE.pointsPerTick, ratio: 0.2 },
    tags: ['daemon'],
    togglable: true,
  },
  {
    // Content-validation sample -- wardBash at a high, rare-tier
    // fraction: the "large percentage -> ward consumed" behavior the
    // payload's own design was built around, paired with a reactive
    // late-game punish trigger matching Zero Trust's own shape above.
    id: 'scorched-earth',
    name: 'Scorched Earth',
    archetype: 'encryption',
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'wardBash', fraction: 0.85 },
    tags: ['piercing'],
    reactive: true,
  },
];

// ---------------------------------------------------------------------
// Root archetype pool (30: 15 session 21+, +6 session 40, +9 session 41).
// ---------------------------------------------------------------------

export const ROOT_COMMONS: SubroutineDefinition[] = [
  {
    id: 'port-forward',
    name: 'Port Forward',
    archetype: 'root',
    trigger: { kind: 'enemyState', condition: 'breachContainmentBelow', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: { kind: 'instantManipulation', target: 'enemyGauge', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'packet-sniffer',
    name: 'Packet Sniffer',
    archetype: 'root',
    // Haste (session 24): "catch-up" identity -- when the enemy is
    // pulling ahead on tempo, accelerate the caster's own initiative
    // gauge instead of denying theirs.
    trigger: { kind: 'enemyState', condition: 'gaugeFillAbove', fraction: GAUGE_FILL_FRACTION },
    payload: { kind: 'instantManipulation', target: 'ownGauge', amount: COMMON.burst },
    // Self-Haste, and its trigger can stay continuously true while the
    // enemy gauge sits above the fraction -- same cooldown as Cold Call.
    pointsCooldown: HASTE_POINTS_COOLDOWN,
    tags: ['direct'],
  },
  {
    id: 'arp-spoof',
    name: 'ARP Spoof',
    archetype: 'root',
    trigger: { kind: 'enemyState', condition: 'hasDebuff', debuffId: 'corrupted' },
    // Generic suitTally target, not subroutineProgress -- see file header.
    payload: { kind: 'instantManipulation', target: 'suitTally', amount: 1 },
    tags: ['direct'],
  },
  {
    id: 'cron-job',
    name: 'Cron Job',
    archetype: 'root',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'instantManipulation', target: 'enemyGauge', amount: COMMON.burst },
    tags: ['daemon'],
  },
  {
    id: 'man-in-the-middle',
    name: 'Man in the Middle',
    archetype: 'root',
    trigger: { kind: 'occurrence', category: 'pair', variation: 'instant' },
    payload: {
      kind: 'scheduledSabotage',
      resolvesAt: 'nextDeal',
      effect: { kind: 'instantManipulation', target: 'enemyGauge', amount: COMMON.burst },
    },
    tags: ['trap'],
  },
  {
    id: 'directory-traversal',
    name: 'Directory Traversal',
    archetype: 'root',
    // Recon (session 24): reveals the opponent's kept hand at the start
    // of the play phase -- gated on being this hand's dealer, tying
    // recon quality to real Cribbage's own dealer-advantage flavor.
    trigger: { kind: 'selfState', condition: 'isDealer' },
    payload: { kind: 'revealOpponentKeptHand' },
    tags: ['direct'],
    firesAt: 'onPlayPhaseStart',
  },
  {
    id: 'idle-scan',
    name: 'Idle Scan',
    archetype: 'root',
    // Recon (session 24): reveals the opponent's full dealt hand every
    // hand -- a lightweight, always-on scan.
    trigger: { kind: 'always' },
    payload: { kind: 'revealOpponentHand' },
    tags: ['daemon'],
    firesAt: 'onDealt',
  },
  {
    // Content-validation sample (session 40 continued, Archetype
    // Win-Condition Audit) -- sessionHijack's own smallest, most-common
    // exposure: fires on every fifteen, same trigger shape Intrusion
    // Alarm (Encryption) uses for the same reason.
    id: 'packet-injection',
    name: 'Packet Injection',
    archetype: 'root',
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'sessionHijack', amount: COMMON.burst },
    tags: ['direct'],
  },
  // --- Session 41 pool expansion (+6) ---
  {
    id: 'traceroute',
    name: 'Traceroute',
    archetype: 'root',
    trigger: { kind: 'occurrence', category: 'thirtyOne', variation: 'instant' },
    payload: { kind: 'instantManipulation', target: 'enemyGauge', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'broadcast-storm',
    name: 'Broadcast Storm',
    archetype: 'root',
    // Renamed before authoring (session 41): the conversational draft's
    // "Ping Sweep" id already belongs to Operator's starting loadout.
    trigger: { kind: 'occurrence', category: 'go', variation: 'instant' },
    payload: { kind: 'instantManipulation', target: 'ownGauge', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'social-engineering',
    name: 'Social Engineering',
    archetype: 'root',
    trigger: { kind: 'occurrence', category: 'hisNobs', variation: 'instant' },
    // Generic suitTally target, not subroutineProgress -- see file header.
    payload: { kind: 'instantManipulation', target: 'suitTally', amount: 1 },
    tags: ['direct'],
  },
  {
    id: 'cold-call',
    name: 'Cold Call',
    archetype: 'root',
    trigger: { kind: 'selfState', condition: 'traceBelow', value: COMMON.trace },
    payload: { kind: 'instantManipulation', target: 'ownGauge', amount: COMMON.burst },
    tags: ['direct'],
    // Self-Haste: grants its own side tempo, so without a cooldown it can
    // buy its own next activation once Merge lifts it to the initiative
    // threshold (session 47's non-terminating fight).
    pointsCooldown: HASTE_POINTS_COOLDOWN,
  },
  {
    id: 'lurker',
    name: 'Lurker',
    archetype: 'root',
    trigger: { kind: 'selfState', condition: 'isNonDealer' },
    payload: { kind: 'instantManipulation', target: 'enemyGauge', amount: COMMON.burst },
    tags: ['direct'],
  },
  {
    id: 'payload-delivery',
    name: 'Payload Delivery',
    archetype: 'root',
    trigger: { kind: 'accumulator', metric: 'suitTally', suit: 3, threshold: COMMON.threshold },
    payload: { kind: 'instantManipulation', target: 'ownGauge', amount: COMMON.burst },
    tags: ['daemon'],
    // Self-Haste on a re-arming accumulator -- same cooldown as Cold
    // Call. (Broadcast Storm is the fourth self-Haste piece and needs no
    // cooldown: its occurrence:'go' trigger is already bounded by real
    // pegging events, which a Haste cannot manufacture.)
    pointsCooldown: HASTE_POINTS_COOLDOWN,
  },
];

export const ROOT_UNCOMMONS: SubroutineDefinition[] = [
  {
    id: 'dns-poisoning',
    name: 'DNS Poisoning',
    archetype: 'root',
    // Haste (session 24): "come from behind" identity -- the instant the
    // enemy pulls significantly ahead, permanently speed up the
    // caster's own initiative gauge instead of denying theirs.
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'instantManipulation', target: 'ownGaugeThreshold', amount: UNCOMMON.burst },
    tags: ['direct'],
    reactive: true,
  },
  {
    id: 'kernel-exploit',
    name: 'Kernel Exploit',
    archetype: 'root',
    // Session 41: was chained after priority-override (an Operator-
    // exclusive starting piece) with a matching subroutineProgress
    // payload targeting it -- both pool-content dead weight for 5 of 6
    // classes, since nothing guarantees a player ever owns that specific
    // id. Trigger widened to afterArchetype; payload retargeted to
    // suitTally, same fix ARP Spoof already uses for the identical
    // no-guaranteed-target problem (see file header).
    trigger: { kind: 'chained', afterArchetype: 'root' },
    payload: { kind: 'instantManipulation', target: 'suitTally', amount: 3 },
    tags: ['worm'],
  },
  {
    id: 'supply-route',
    name: 'Supply Route',
    archetype: 'root',
    trigger: { kind: 'occurrence', category: 'run', variation: 'scaling', cap: UNCOMMON.cap },
    payload: { kind: 'instantManipulation', target: 'suitTally', amount: 2 },
    tags: ['trap'],
  },
  {
    id: 'dead-drop',
    name: 'Dead Drop',
    archetype: 'root',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'threshold', bankTarget: UNCOMMON.bankTarget },
    payload: {
      kind: 'scheduledSabotage',
      resolvesAt: 'nextDeal',
      effect: { kind: 'instantManipulation', target: 'enemyGaugeThreshold', amount: UNCOMMON.burst },
    },
    tags: ['trap'],
  },
  {
    id: 'backchannel',
    name: 'Backchannel',
    archetype: 'root',
    // Recon (session 24): the real, working version of what peekCrib
    // was always meant to be -- see subroutine-types.ts's
    // InstantManipulationPayload doc comment for why peekCrib itself
    // stays a documented no-op. Reveals the crib right after it's
    // selected, before it's scored, while the caster's own Heat is
    // running hot.
    trigger: { kind: 'selfState', condition: 'traceAbove', value: UNCOMMON.trace },
    payload: { kind: 'revealCrib' },
    tags: ['direct'],
    firesAt: 'onCribSelected',
  },
  {
    // Content-validation sample -- sessionHijack at uncommon tier, same
    // occurrence:run,threshold shape Supply Route above uses.
    id: 'man-in-the-browser',
    name: 'Man-in-the-Browser',
    archetype: 'root',
    trigger: { kind: 'occurrence', category: 'run', variation: 'threshold', bankTarget: UNCOMMON.bankTarget },
    payload: { kind: 'sessionHijack', amount: UNCOMMON.burst },
    tags: ['trap'],
  },
  {
    // Content-validation sample -- "Crib Trap," the user's own
    // motivating example for handOutcome: gain progress when the enemy
    // scores a crib hand greater than 4. Real frequency data
    // (scripts/occurrence-frequency.ts, 300 games/skill=0.85, 2715
    // hands) puts crib score at mean=4.62/p50=4 -- "greater than 4" is
    // roughly "an above-median crib," not a rare event, which fits an
    // uncommon-tier piece that fires reasonably often for a modest
    // payoff (see Perfect Hand, ROOT_RARES, for the genuinely rare
    // version of the same mechanism).
    id: 'crib-trap',
    name: 'Crib Trap',
    archetype: 'root',
    trigger: { kind: 'handOutcome', phase: 'crib', side: 'enemy', comparison: 'above', value: 4 },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: ['trap'],
  },
  // --- Session 41 pool expansion (+3) ---
  {
    id: 'honey-trap',
    name: 'Honey Trap',
    archetype: 'root',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'scaling', cap: UNCOMMON.cap },
    payload: { kind: 'instantManipulation', target: 'suitTally', amount: 2 },
    tags: ['trap'],
  },
  {
    // Real frequency data (scripts/occurrence-frequency.ts, 300 games/
    // skill=0.85): per-side pegging score p90 is exactly 6 -- "above 6"
    // is a genuine top-10% pegging performance, verified against the
    // spec's own claim rather than trusted blind.
    id: 'wiretap',
    name: 'Wiretap',
    archetype: 'root',
    trigger: { kind: 'handOutcome', phase: 'pegging', side: 'enemy', comparison: 'above', value: 6 },
    payload: { kind: 'sessionHijack', amount: UNCOMMON.burst },
    tags: ['trap'],
  },
  {
    id: 'ghost-protocol',
    name: 'Ghost Protocol',
    archetype: 'root',
    trigger: { kind: 'chained', afterArchetype: 'root' },
    payload: { kind: 'instantManipulation', target: 'enemyGaugeThreshold', amount: UNCOMMON.burst },
    tags: ['worm'],
  },
];

export const ROOT_RARES: SubroutineDefinition[] = [
  {
    id: 'rootkit-deployment',
    name: 'Rootkit Deployment',
    archetype: 'root',
    // Self-reinforcing loop: marking suit 3 feeds its own suit-3 tally.
    trigger: { kind: 'accumulator', metric: 'suitTally', suit: 3, threshold: RARE.threshold },
    payload: { kind: 'cribbageLayerManipulation', action: 'markSuit', suit: 3 },
    tags: ['daemon'],
    togglable: true,
  },
  {
    id: 'zero-knowledge-exploit',
    name: 'Zero-Knowledge Exploit',
    archetype: 'root',
    // Manipulation (session 24): a rare, surgical payoff for a Corrupted
    // enemy -- forces away whichever specific card their own hand-value
    // heuristic would most want to keep (ai.ts's bestCardToForce), not
    // just a blunt whole-pair discardHighestTwo. `firesAt` supersedes
    // the old `reactive` bypass here -- it's a more specific "when" than
    // "the instant armed."
    trigger: { kind: 'enemyState', condition: 'hasDebuff', debuffId: 'corrupted' },
    payload: { kind: 'forceDiscardCard' },
    tags: ['direct'],
    firesAt: 'onDealt',
  },
  {
    id: 'full-system-compromise',
    name: 'Full System Compromise',
    // Unchanged (session 24): its chained-after-cron-job identity
    // doesn't map onto firesAt timing (hand-lifecycle gaps aren't
    // "anyone's turn," so within-turn chaining doesn't apply there --
    // see resolve.ts's fireHandLifecycleSubroutines) -- the blunt
    // whole-pair forceDiscard remains a real, distinct tool alongside
    // zero-knowledge-exploit's surgical forceDiscardCard, not redundant
    // with it.
    archetype: 'root',
    trigger: { kind: 'chained', afterArchetype: 'root' },
    payload: { kind: 'cribbageLayerManipulation', action: 'forceDiscard' },
    tags: ['worm'],
  },
  {
    // Content-validation sample -- "Royal Exploit," the user's own
    // motivating example for rareOccurrence: a genuine reactive payoff
    // when *either* side lands a pair royal or better. Real frequency
    // data (scripts/occurrence-frequency.ts) confirms magnitude>=6 (a
    // Pair occurrence's own points, n*(n-1)) captures the real rare tail
    // -- pair-royal-or-better is only 8.8% of all pair occurrences
    // (0.6/2715 hands hit magnitude 6, 13/2715 hit magnitude 12). Pairs
    // with sessionHijack rather than directBurst, showing the two new
    // Root mechanisms compose with each other, not just with old
    // payload kinds.
    id: 'royal-exploit',
    name: 'Royal Exploit',
    archetype: 'root',
    trigger: { kind: 'rareOccurrence', category: 'pair', minMagnitude: 6, watchSide: 'either' },
    payload: { kind: 'sessionHijack', amount: RARE.burst },
    tags: ['piercing'],
  },
  {
    // Content-validation sample -- a second rareOccurrence example on a
    // different category, to prove the mechanism generalizes beyond
    // "pair." Real data: a Run occurrence's own magnitude is runLength *
    // duplicate-count-product (scoring.ts's runEvents) -- magnitude>=8
    // (an 8+-point run: a "double run of 4," "triple run of 3," or
    // better) is a genuinely rare 7.8% of all run occurrences, roughly
    // matching Royal Exploit's own rarity band above. Composes with
    // directBurst instead of sessionHijack, for variety.
    id: 'grand-slam',
    name: 'Grand Slam',
    archetype: 'root',
    trigger: { kind: 'rareOccurrence', category: 'run', minMagnitude: 8, watchSide: 'own' },
    payload: { kind: 'directBurst', amount: RARE.burst },
    tags: ['piercing'],
  },
  {
    // Content-validation sample -- "Perfect Hand," the genuinely rare
    // counterpart to Crib Trap (ROOT_UNCOMMONS): rewards the caster's
    // own exceptional hand instead of punishing the enemy's decent crib.
    // Real data puts dealerHandScore/nonDealerHandScore at p95 ~16 --
    // "greater than 16" is a real top-5% hand, not just above average.
    id: 'perfect-hand',
    name: 'Perfect Hand',
    archetype: 'root',
    trigger: { kind: 'handOutcome', phase: 'hand', side: 'own', comparison: 'above', value: 16 },
    payload: { kind: 'sessionHijack', amount: RARE.burst },
    tags: ['trap'],
  },
];

// ---------------------------------------------------------------------
// Convenience aggregates.
// ---------------------------------------------------------------------

export const ARCHETYPE_POOLS = {
  exploit: { commons: EXPLOIT_COMMONS, uncommons: EXPLOIT_UNCOMMONS, rares: EXPLOIT_RARES },
  malware: { commons: MALWARE_COMMONS, uncommons: MALWARE_UNCOMMONS, rares: MALWARE_RARES },
  encryption: { commons: ENCRYPTION_COMMONS, uncommons: ENCRYPTION_UNCOMMONS, rares: ENCRYPTION_RARES },
  root: { commons: ROOT_COMMONS, uncommons: ROOT_UNCOMMONS, rares: ROOT_RARES },
} as const;

export const ALL_STARTING_LOADOUT_SUBROUTINES: SubroutineDefinition[] = [
  ...BREACHER_LOADOUT,
  ...BLACKHAT_LOADOUT,
  ...SABOTEUR_LOADOUT,
  ...OPERATOR_LOADOUT,
  ...WARDEN_LOADOUT,
  ...GHOST_LOADOUT,
];

export const ALL_POOL_SUBROUTINES: SubroutineDefinition[] = [
  ...EXPLOIT_COMMONS,
  ...EXPLOIT_UNCOMMONS,
  ...EXPLOIT_RARES,
  ...MALWARE_COMMONS,
  ...MALWARE_UNCOMMONS,
  ...MALWARE_RARES,
  ...ENCRYPTION_COMMONS,
  ...ENCRYPTION_UNCOMMONS,
  ...ENCRYPTION_RARES,
  ...ROOT_COMMONS,
  ...ROOT_UNCOMMONS,
  ...ROOT_RARES,
  // Session 28's 9-piece Neutral Archetype -- included here (unlike
  // NEUTRAL_POOL itself, which stays out of ARCHETYPE_POOLS/rewards.ts's
  // rarity lookup for now, acquisition being explicitly banked) so
  // enemies.ts's pool() helper can find them for the checkpoint E enemy
  // retrofits.
  ...NEUTRAL_COMMONS,
  ...NEUTRAL_UNCOMMONS,
  ...NEUTRAL_RARES,
];

/** All 78 real-archetype pieces plus the 9 neutral ones -- the 18
 * starting-loadout pieces are also part of their class's reward pool
 * (session 21: "a class's own already-owned pieces stay in its reward
 * pool too"), so this is the full universe of named subroutines in the
 * game, not just the drawable pool. Ghost's own Idle Process is the one
 * deliberate exception to "starting-loadout ids never collide with pool
 * ids" -- it's the *same* object in both ALL_STARTING_LOADOUT_SUBROUTINES
 * (via GHOST_LOADOUT) and ALL_POOL_SUBROUTINES (via NEUTRAL_COMMONS),
 * appearing twice here, harmlessly (id-keyed lookups just overwrite with
 * the same value). */
export const ALL_SUBROUTINES: SubroutineDefinition[] = [...ALL_STARTING_LOADOUT_SUBROUTINES, ...ALL_POOL_SUBROUTINES];
