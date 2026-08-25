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

const COMMON = { burst: 5, tick: 2, pointsPerTick: 8, threshold: 6, bankTarget: 2, cap: 3, duration: 3, heat: 8, debuffMag: 3, debuffDur: 2 };
const UNCOMMON = { burst: 8, tick: 3, pointsPerTick: 8, threshold: 8, bankTarget: 3, cap: 4, duration: 4, heat: 10, debuffMag: 4, debuffDur: 3 };
const RARE = { burst: 13, tick: 5, pointsPerTick: 8, threshold: 10, bankTarget: 4, cap: 5, duration: 5, heat: 12, debuffMag: 6, debuffDur: 3 };

/** HoT/Instant Counter-Push are capped at the Breach/Containment
 * midpoint (resolve.ts), so per session 21's "should generally be tuned
 * to noticeably higher magnitude" principle, they get their own,
 * larger tier. */
const CAPPED = { common: 7, uncommon: 11, rare: 18 };

const BREACH_CONTAINMENT_THRESHOLD = { low: 40, high: 60 };
const GAUGE_FILL_FRACTION = 0.5;
const HOT_GAUGE_FILL_FRACTION = 0.75; // Vulnerability Scan's edge-triggered rare — see resolve.test.ts's Reactive coverage for why this is fine at a high fraction.

// ---------------------------------------------------------------------
// Class starting loadouts (18) — DESIGN.md's "Starting Loadouts",
// session 12. 3 per class: 1 per specialized archetype + 1 Cantrip.
// ---------------------------------------------------------------------

export const BREACHER_LOADOUT: SubroutineDefinition[] = [
  {
    id: 'buffer-overflow',
    name: 'Buffer Overflow',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'run', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: [],
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
    tags: [],
  },
  {
    id: 'steady-hand',
    name: 'Steady Hand',
    archetype: 'encryption',
    trigger: { kind: 'always' },
    payload: { kind: 'instantCounterPush', amount: 3 },
    tags: ['daemon'],
  },
];

export const BLACKHAT_LOADOUT: SubroutineDefinition[] = [
  {
    id: 'payload-drop',
    name: 'Payload Drop',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'riskRewardBurst', amount: COMMON.burst + 2, heatCost: 4 },
    tags: [],
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
    payload: { kind: 'riskRewardBurst', amount: 3, heatCost: 1 },
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
    tags: [],
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
    id: 'null-session',
    name: 'Null Session',
    archetype: 'encryption',
    // Corrected from DESIGN.md's "Self-state: Breach/Containment in
    // enemy's favor" -- see file header.
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'instantCounterPush', amount: CAPPED.common },
    tags: [],
  },
  {
    id: 'kill-switch',
    name: 'Kill Switch',
    archetype: 'root',
    trigger: { kind: 'enemyState', condition: 'breachContainmentBelow', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: {
      kind: 'scheduledSabotage',
      resolvesAt: 'nextDeal',
      effect: { kind: 'instantManipulation', target: 'enemyGaugeThreshold', amount: COMMON.burst },
    },
    tags: ['trap'],
  },
  {
    id: 'low-profile',
    name: 'Low Profile',
    archetype: 'root',
    trigger: { kind: 'always' },
    payload: { kind: 'selfHeatReduction', amount: 3, floor: 10 },
    tags: ['daemon'],
  },
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
// Exploit archetype pool (15) — session 21+.
// ---------------------------------------------------------------------

export const EXPLOIT_COMMONS: SubroutineDefinition[] = [
  {
    id: 'fuzzer',
    name: 'Fuzzer',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: [],
  },
  {
    id: 'race-condition',
    name: 'Race Condition',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'go', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: [],
  },
  {
    id: 'off-by-one',
    name: 'Off-By-One',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'thirtyOne', variation: 'instant' },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: [],
  },
  {
    id: 'credential-stuffing',
    name: 'Credential Stuffing',
    archetype: 'exploit',
    trigger: { kind: 'accumulator', metric: 'points', threshold: COMMON.threshold },
    payload: { kind: 'directBurst', amount: COMMON.burst },
    tags: [],
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
    tags: [],
  },
  {
    id: 'script-kiddie',
    name: 'Script Kiddie',
    archetype: 'exploit',
    trigger: { kind: 'always' },
    payload: { kind: 'directBurst', amount: 2 },
    tags: ['daemon'],
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
    tags: [],
  },
  {
    id: 'watering-hole',
    name: 'Watering Hole',
    archetype: 'exploit',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'scaling', cap: UNCOMMON.cap },
    payload: { kind: 'directBurst', amount: UNCOMMON.burst },
    tags: [],
  },
  {
    id: 'drive-by-exploit',
    name: 'Drive-By Exploit',
    archetype: 'exploit',
    trigger: { kind: 'chained', afterSubroutineId: 'precision-strike' },
    payload: { kind: 'piercing', amount: UNCOMMON.burst },
    tags: ['worm', 'piercing'],
  },
  {
    id: 'payload-multiplier',
    name: 'Payload Multiplier',
    archetype: 'exploit',
    trigger: { kind: 'selfState', condition: 'heatAbove', value: UNCOMMON.heat },
    payload: { kind: 'riskRewardBurst', amount: UNCOMMON.burst + 2, heatCost: 3 },
    tags: [],
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
    trigger: { kind: 'enemyState', condition: 'gaugeFillAbove', fraction: HOT_GAUGE_FILL_FRACTION },
    payload: { kind: 'piercing', amount: RARE.burst },
    tags: ['piercing'],
    reactive: true,
  },
];

// ---------------------------------------------------------------------
// Malware archetype pool (15) — session 21+.
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
    tags: [],
  },
  {
    id: 'corrupted-cache',
    name: 'Corrupted Cache',
    archetype: 'malware',
    trigger: { kind: 'selfState', condition: 'heatAbove', value: COMMON.heat },
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
    trigger: { kind: 'chained', afterSubroutineId: 'silent-worm' },
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
    trigger: { kind: 'chained', afterSubroutineId: 'fork-bomb' },
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
];

// ---------------------------------------------------------------------
// Encryption archetype pool (15) — session 21+.
// ---------------------------------------------------------------------

export const ENCRYPTION_COMMONS: SubroutineDefinition[] = [
  {
    id: 'basic-auth',
    name: 'Basic Auth',
    archetype: 'encryption',
    trigger: { kind: 'selfState', condition: 'isDealer' },
    payload: { kind: 'instantCounterPush', amount: CAPPED.common },
    tags: [],
  },
  {
    id: 'checksum',
    name: 'Checksum',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'instantCounterPush', amount: CAPPED.common },
    tags: [],
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
    payload: { kind: 'ward', blocksArchetype: 'exploit' },
    tags: [],
  },
  {
    id: 'two-factor',
    name: 'Two-Factor',
    archetype: 'encryption',
    trigger: { kind: 'selfState', condition: 'heatBelow', value: COMMON.heat },
    payload: { kind: 'instantCounterPush', amount: CAPPED.common },
    tags: [],
  },
  {
    id: 'access-control',
    name: 'Access Control',
    archetype: 'encryption',
    trigger: { kind: 'selfState', condition: 'isNonDealer' },
    payload: { kind: 'ward', blocksArchetype: 'root' },
    tags: [],
  },
  {
    id: 'patch-notes',
    name: 'Patch Notes',
    archetype: 'encryption',
    trigger: { kind: 'always' },
    payload: { kind: 'instantCounterPush', amount: 2 },
    tags: ['daemon'],
  },
];

export const ENCRYPTION_UNCOMMONS: SubroutineDefinition[] = [
  {
    id: 'rate-limiting',
    name: 'Rate Limiting',
    archetype: 'encryption',
    trigger: { kind: 'occurrence', category: 'flush', variation: 'threshold', bankTarget: UNCOMMON.bankTarget },
    payload: { kind: 'instantCounterPush', amount: CAPPED.uncommon },
    tags: [],
  },
  {
    id: 'honeypot',
    name: 'Honeypot',
    archetype: 'encryption',
    trigger: { kind: 'enemyState', condition: 'gaugeFillAbove', fraction: GAUGE_FILL_FRACTION },
    payload: { kind: 'ward', blocksArchetype: 'malware' },
    tags: [],
  },
  {
    id: 'sinkhole',
    name: 'Sinkhole',
    archetype: 'encryption',
    trigger: { kind: 'chained', afterSubroutineId: 'access-control' },
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
    trigger: { kind: 'selfState', condition: 'heatAbove', value: UNCOMMON.heat },
    payload: { kind: 'ward', blocksArchetype: 'root' },
    tags: ['firewall'],
    reactive: true,
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
    trigger: { kind: 'chained', afterSubroutineId: 'patch' },
    payload: { kind: 'cleanse' },
    tags: ['worm'],
  },
];

// ---------------------------------------------------------------------
// Root archetype pool (15) — session 21+.
// ---------------------------------------------------------------------

export const ROOT_COMMONS: SubroutineDefinition[] = [
  {
    id: 'port-forward',
    name: 'Port Forward',
    archetype: 'root',
    trigger: { kind: 'enemyState', condition: 'breachContainmentBelow', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: { kind: 'instantManipulation', target: 'enemyGauge', amount: COMMON.burst },
    tags: [],
  },
  {
    id: 'packet-sniffer',
    name: 'Packet Sniffer',
    archetype: 'root',
    trigger: { kind: 'enemyState', condition: 'gaugeFillAbove', fraction: GAUGE_FILL_FRACTION },
    payload: { kind: 'instantManipulation', target: 'enemyGauge', amount: COMMON.burst },
    tags: [],
  },
  {
    id: 'arp-spoof',
    name: 'ARP Spoof',
    archetype: 'root',
    trigger: { kind: 'enemyState', condition: 'hasDebuff', debuffId: 'corrupted' },
    // Generic suitTally target, not subroutineProgress -- see file header.
    payload: { kind: 'instantManipulation', target: 'suitTally', amount: 1 },
    tags: [],
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
    trigger: { kind: 'selfState', condition: 'isDealer' },
    payload: { kind: 'instantManipulation', target: 'suitTally', amount: 2 },
    tags: [],
  },
  {
    id: 'idle-scan',
    name: 'Idle Scan',
    archetype: 'root',
    trigger: { kind: 'always' },
    payload: { kind: 'instantManipulation', target: 'enemyGauge', amount: 1 },
    tags: ['daemon'],
  },
];

export const ROOT_UNCOMMONS: SubroutineDefinition[] = [
  {
    id: 'dns-poisoning',
    name: 'DNS Poisoning',
    archetype: 'root',
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'instantManipulation', target: 'enemyGaugeThreshold', amount: UNCOMMON.burst },
    tags: [],
    reactive: true,
  },
  {
    id: 'kernel-exploit',
    name: 'Kernel Exploit',
    archetype: 'root',
    // Feeds back into what triggered it -- safe self-reference since the
    // Chained trigger already hard-depends on priority-override being
    // present, same reasoning as Rootkit Deployment's suit-tally loop.
    trigger: { kind: 'chained', afterSubroutineId: 'priority-override' },
    payload: { kind: 'instantManipulation', target: 'subroutineProgress', amount: 3, targetSubroutineId: 'priority-override' },
    tags: ['worm'],
  },
  {
    id: 'supply-route',
    name: 'Supply Route',
    archetype: 'root',
    trigger: { kind: 'occurrence', category: 'run', variation: 'scaling', cap: UNCOMMON.cap },
    payload: { kind: 'instantManipulation', target: 'suitTally', amount: 2 },
    tags: [],
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
    trigger: { kind: 'selfState', condition: 'heatAbove', value: UNCOMMON.heat },
    payload: { kind: 'cribbageLayerManipulation', action: 'peekCrib' },
    tags: [],
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
    trigger: { kind: 'enemyState', condition: 'hasDebuff', debuffId: 'corrupted' },
    payload: { kind: 'instantManipulation', target: 'enemyGaugeThreshold', amount: RARE.burst },
    tags: [],
    reactive: true,
  },
  {
    id: 'full-system-compromise',
    name: 'Full System Compromise',
    archetype: 'root',
    trigger: { kind: 'chained', afterSubroutineId: 'cron-job' },
    payload: { kind: 'cribbageLayerManipulation', action: 'forceDiscard' },
    tags: ['worm'],
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
];

/** All 78 -- the 18 starting-loadout pieces are also part of their
 * class's reward pool (session 21: "a class's own already-owned pieces
 * stay in its reward pool too"), so this is the full universe of named
 * subroutines in the game, not just the drawable pool. */
export const ALL_SUBROUTINES: SubroutineDefinition[] = [...ALL_STARTING_LOADOUT_SUBROUTINES, ...ALL_POOL_SUBROUTINES];
