import type { Archetype, SubroutineDefinition } from '../subroutine-types';
import type { EnemyTier } from '../enemies';
import type { GatekeeperModId } from '../gatekeeper-mods';
import {
  AUDIT_LOG,
  CANARY_TOKEN,
  CONTEXT_SWITCH,
  COUNTERMEASURE,
  ENDPOINT_AGENT,
  GARBAGE_COLLECTOR,
  HONEYNET,
  LOG_ROTATION,
  PACKET_FILTER,
  PRIVILEGE_DROP,
  SESSION_RESET,
  THROTTLE,
} from './enemy-subroutines';
import { authoredPiece } from './starting-loadouts';

/**
 * The authored enemy roster (step 3, enemies; `docs/authoring-design.md`
 * E1-E7). Every enemy is the target network's own defenses -- its
 * security team and countermeasures hacking back -- never a rival group
 * (session 27's tonal rule).
 *
 * Priced as kit power (pricing.ts's `kitPower`) against the budget table
 * (E3 stage 1): regular 0.6x the player's in-layer power, elite 0.9x,
 * gatekeeper 1.0-1.1x end-of-layer power. Checked by
 * `scripts/enemy-check.ts`. Not yet wired: the skeleton roster runs until
 * all three tiers exist (E5 step 5).
 */

export interface AuthoredEnemy {
  id: string;
  name: string;
  tier: EnemyTier;
  archetypes: Archetype[];
  /** First layer it appears at (Honeypot enemies: 2+, E6). */
  minLayer: number;
  loadout: SubroutineDefinition[];
  /** Authored magnitude at its first layer (1 = the pieces as written):
   * the knob that lands a kit on its budget without adding a piece. */
  scale?: number;
  /** A gatekeeper's bespoke Mod (E4; gatekeeper-mods.ts). */
  mods?: GatekeeperModId[];
}

/** Regular/elite magnitude by layer, following the player's measured
 * power curve (E3 stage 1: +38% into layer 2, then nearly flat) instead
 * of enemies.ts's linear +0.3 a layer, which would outrun a player whose
 * slots fill in layer 2. Kit power rises less than magnitude does (x1.3
 * magnitude bought ~+24% power), so the steps are a little steeper than
 * the budget's ratios. Proposed here; the engine adopts it at wiring
 * (E5 step 5). */
export const ENEMY_LAYER_SCALER: [number, number, number, number] = [1, 1.4, 1.6, 1.65];

const p = authoredPiece;

/** A piece that also raises an alarm (E7's tracers): session 47's
 * pressure, Heat added to the player's layer each time it fires (direct
 * since session 58). */
function tracing(piece: SubroutineDefinition, pressure: number): SubroutineDefinition {
  return { ...piece, id: `${piece.id}-tracer`, heatPressure: pressure };
}

/** Regulars (E2: 6; E4: no Mods). Commons only. */
export const AUTHORED_REGULARS: AuthoredEnemy[] = [
  // The simplest attacker: spikes on pairs and fifteens.
  { id: 'pentest-script', name: 'Pentest Script', tier: 'regular', archetypes: ['exploit'], minLayer: 1, loadout: [p('port-scan'), p('buffer-overflow')], scale: 1.25 },
  // Heals you back and slowly ramps: long fights favour it.
  { id: 'quarantine-daemon', name: 'Quarantine Daemon', tier: 'regular', archetypes: ['daemon'], minLayer: 1, loadout: [p('watchdog-timer'), p('cron-job')], scale: 1.15 },
  // Fast and clustered: extra fires and an adjacency bonus.
  { id: 'relay-node', name: 'Relay Node', tier: 'regular', archetypes: ['overclock'], minLayer: 1, loadout: [p('ping'), p('burst-clock')], scale: 1.4 },
  // Hits, then patches itself up.
  { id: 'patch-runner', name: 'Patch Runner', tier: 'regular', archetypes: ['exploit', 'daemon'], minLayer: 1, loadout: [p('port-scan'), p('patch')], scale: 1.3 },
  // The first Ward wall: absorbs plain Credit, then spends its banked
  // Ward. A third piece (Rate Limiting) rather than a very large scale.
  { id: 'legacy-firewall', name: 'Legacy Firewall', tier: 'regular', archetypes: ['honeypot'], minLayer: 2, loadout: [p('basic-auth'), p('tarpit'), p('rate-limiting')], scale: 1.2 },
  // E7's regular tracer: barely fights back, slows you, makes you loud.
  { id: 'tripwire', name: 'Tripwire', tier: 'regular', archetypes: ['overclock', 'exploit'], minLayer: 2, loadout: [tracing(p('ping'), 0.25), p('doorknob-rattle')], scale: 1.6 },
  // --- Session 60's content pass (docs/enemy-review.md CP2-CP4): enemy-only
  // subroutines, and new faces for the deep layers. Named as defenders.
  // A gentle first Wipe: its pairs chip your Hook counts.
  { id: 'session-monitor', name: 'Session Monitor', tier: 'regular', archetypes: ['exploit'], minLayer: 1, loadout: [SESSION_RESET, p('buffer-overflow')], scale: 1.4 },
  // Strips your Ward: its gos and its own Ward both eat yours.
  { id: 'wireless-ids', name: 'Wireless IDS', tier: 'regular', archetypes: ['overclock', 'honeypot'], minLayer: 2, loadout: [PACKET_FILTER, COUNTERMEASURE, p('tarpit')], scale: 2.6 },
  // Your Hook engines leak on its clock.
  { id: 'log-shipper', name: 'Log Shipper', tier: 'regular', archetypes: ['daemon'], minLayer: 2, loadout: [LOG_ROTATION, p('patch'), p('steady-drip')], scale: 2.1 },
  // Makes you loud: hitting its shield and passing half both cost Heat.
  { id: 'honeyfarm', name: 'Honeyfarm', tier: 'regular', archetypes: ['honeypot'], minLayer: 3, loadout: [HONEYNET, CANARY_TOKEN, p('basic-auth')], scale: 2.15 },
  // Grows, and costs Heat the longer it lives.
  { id: 'edr-sensor', name: 'EDR Sensor', tier: 'regular', archetypes: ['daemon', 'exploit'], minLayer: 3, loadout: [ENDPOINT_AGENT, AUDIT_LOG, p('steady-drip')], scale: 1.4 },
  // A Wipe cluster: punishes Hook-heavy loadouts late in the fight.
  { id: 'integrity-monitor', name: 'Integrity Monitor', tier: 'regular', archetypes: ['overclock', 'daemon'], minLayer: 4, loadout: [p('burst-clock'), CONTEXT_SWITCH, GARBAGE_COLLECTOR], scale: 1.6 },
  // Slows you, and strips Ward as you get close.
  { id: 'firewall-cluster', name: 'Firewall Cluster', tier: 'regular', archetypes: ['exploit', 'overclock'], minLayer: 4, loadout: [PRIVILEGE_DROP, THROTTLE, p('port-scan')], scale: 1.52 },
];

/** Elites (E2: 4; each one small rule-bending Mod -- docs/enemy-review.md
 * EM1-EM4; class Mods are the player's alone since session 60). Better pieces
 * than regulars -- a rare or uncommons (E1). The first four pair a class's
 * archetypes, covering each twice; session 60 added two for the deep
 * layers. */
export const AUTHORED_ELITES: AuthoredEnemy[] = [
  // The spike engine: each fifteen charges Ping, Ping fires again on
  // pairs, and your fifteens and pairs count toward its Hooks too
  // (Reverse Engineering) -- Ping's Hook has no cap, so they really add.
  { id: 'threat-intel-feed', name: 'Threat Intel Feed', tier: 'elite', archetypes: ['exploit', 'overclock'], minLayer: 1, mods: ['reverse-engineering'], loadout: [p('zero-day-chain'), p('ping'), p('port-scan')], scale: 1.05 },
  // Keeps you down: Heartbeat heals hardest while you lead, Race
  // Condition pays while you're under half, and the first time you pass
  // three-quarters it rolls you back to half (Rollback).
  { id: 'incident-response', name: 'Incident Response', tier: 'elite', archetypes: ['exploit', 'daemon'], minLayer: 1, mods: ['rollback'], loadout: [p('race-condition'), p('heartbeat-monitor'), p('cron-job')], scale: 0.98 },
  // The grinder: it walls up, Memory Leak ramps the longer you take, and
  // hitting its Ward speeds the ramp (Power Siphon).
  { id: 'blackout-cell', name: 'Blackout Cell', tier: 'elite', archetypes: ['daemon', 'honeypot'], minLayer: 2, mods: ['power-siphon'], loadout: [p('memory-leak'), p('sinkhole'), p('basic-auth')], scale: 1.54 },
  // E7's elite tracer: fast and getting faster (Escalation), and every
  // fire makes you louder -- win fast or pay in Heat. Pressure is 1/8 a
  // fire: at 1/2 it pushed ~20 Heat a fight (57% of layer 2's
  // allowance), since its pieces fire on turns AND as immediate betas.
  { id: 'intrusion-alarm', name: 'Intrusion Alarm', tier: 'elite', archetypes: ['overclock', 'honeypot'], minLayer: 2, mods: ['escalation'], loadout: [tracing(p('priority-override'), 0.125), tracing(p('elevated-session'), 0.125), p('tarpit')], scale: 1.18 },
  // Builds a case: its fifteens and its Ward absorbing your Credit give you
  // Heat, and every bit of Heat it gives you Credits it too (Evidence Chain).
  { id: 'threat-hunter', name: 'Threat Hunter', tier: 'elite', archetypes: ['exploit', 'honeypot'], minLayer: 3, mods: ['evidence-chain'], loadout: [AUDIT_LOG, HONEYNET, p('fail2ban')], scale: 1.84 },
  // Rations your CPU: your bottom subroutine never fires (Resource Quota).
  // Context Switch sits beside Priority Override so its Hook can apply.
  { id: 'hypervisor', name: 'Hypervisor', tier: 'elite', archetypes: ['daemon', 'overclock'], minLayer: 4, mods: ['resource-quota'], loadout: [p('priority-override'), CONTEXT_SWITCH, p('fork-bomb')], scale: 1.31 },
];

// --- Gatekeepers' bespoke pieces (session 43's rule: every gatekeeper
// carries at least one; they appear nowhere else). ---

const WELCOME_PACKET: SubroutineDefinition = {
  id: 'welcome-packet', name: 'Welcome Packet', archetype: 'exploit',
  alpha: { verb: 'credit', amount: 2 },
  beta: { source: 'cards', category: 'go', shape: 'immediate', at: 2, effect: { verb: 'enhance', amount: 0 } },
};
const DEFAULT_DENY: SubroutineDefinition = {
  id: 'default-deny', name: 'Default Deny', archetype: 'daemon',
  alpha: { verb: 'suppress', amount: 2 },
  beta: { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 2 } },
};
const ISOLATION_CHAMBER: SubroutineDefinition = {
  id: 'isolation-chamber', name: 'Isolation Chamber', archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 3 },
  beta: { source: 'state', condition: { kind: 'wardAbove', amount: 6 }, shape: 'whileTrue', effect: { verb: 'suppress', amount: 2 } },
};
const BALANCE_SHEET: SubroutineDefinition = {
  id: 'balance-sheet', name: 'Balance Sheet', archetype: 'honeypot',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'whileTrue', effect: { verb: 'credit', amount: 1, from: 'opponent' } },
};
const SELF_MODIFYING_CODE: SubroutineDefinition = {
  id: 'self-modifying-code', name: 'Self-Modifying Code', archetype: 'daemon',
  alpha: { verb: 'credit', amount: 1, growth: 0.5, growthCap: 4 },
  beta: { source: 'state', condition: { kind: 'handPointsAtLeast', amount: 12 }, shape: 'immediate', effect: { verb: 'enhance', amount: 0 } },
};
const BEACON: SubroutineDefinition = {
  id: 'beacon', name: 'Beacon', archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 2 },
  beta: { source: 'cards', category: 'pair', shape: 'graded', cap: 2, effect: { verb: 'enhance', amount: 1 } },
  heatPressure: 0.25,
};
const NULL_ROUTE: SubroutineDefinition = {
  id: 'null-route', name: 'Null Route', archetype: 'honeypot',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.75 }, shape: 'whileTrue', effect: { verb: 'credit', amount: 2, from: 'opponent' } },
};
const KERNEL_PANIC: SubroutineDefinition = {
  id: 'kernel-panic', name: 'Kernel Panic', archetype: 'daemon',
  alpha: { verb: 'credit', amount: 2 },
  beta: { source: 'progress', metric: 'fires', per: 4, shape: 'stepped', at: 1, effect: { verb: 'suppress', amount: 4 } },
};

/** Gatekeepers (E2: 2 per layer; one bespoke Mod -- no class Mod since
 * session 60, the user's call). A
 * four-layer climb: one rule each at the perimeter; your tools stop
 * working as normal in the LAN; the enemy grows or makes you loud in the
 * servers; three archetypes and hard rule-bends at the core. Several
 * Mods cap or tax burst, which lengthens fights (CP6b: retention tracks
 * fight length). */
export const AUTHORED_GATEKEEPERS: AuthoredEnemy[] = [
  // --- Layer 1: the perimeter ---
  { id: 'the-concierge', name: 'The Concierge', tier: 'gatekeeper', archetypes: ['exploit', 'overclock'], minLayer: 1, mods: ['reception-protocol'], scale: 1.42,
    loadout: [WELCOME_PACKET, p('port-scan'), p('cache-hit'), p('burst-clock')] },
  { id: 'firewall-prime', name: 'Firewall Prime', tier: 'gatekeeper', archetypes: ['exploit', 'daemon'], minLayer: 1, mods: ['no-way-in'], scale: 0.982,
    loadout: [DEFAULT_DENY, p('watchdog-timer'), p('buffer-overflow'), p('cron-job')] },
  // --- Layer 2: the internal LAN ---
  { id: 'quarantine-ward', name: 'Quarantine Ward', tier: 'gatekeeper', archetypes: ['daemon', 'honeypot'], minLayer: 2, mods: ['containment'], scale: 1.98,
    loadout: [ISOLATION_CHAMBER, p('patch'), p('sinkhole'), p('memory-leak')] },
  { id: 'zero-sum', name: 'Zero-Sum', tier: 'gatekeeper', archetypes: ['overclock', 'honeypot'], minLayer: 2, mods: ['zero-sum'], scale: 1.52,
    loadout: [BALANCE_SHEET, p('ping'), p('elevated-session'), p('tarpit')] },
  // --- Layer 3: the servers ---
  { id: 'adaptive-threat', name: 'Adaptive Threat', tier: 'gatekeeper', archetypes: ['daemon', 'overclock'], minLayer: 3, mods: ['adaptation'], scale: 2.66,
    loadout: [SELF_MODIFYING_CODE, p('fork-bomb'), p('ping'), p('steady-drip')] },
  // E7 gatekeeper tracer: does not try hard to contain you; makes you loud
  // before the toll. Credential Stuffing rather than Jackpot, whose beta
  // feed would hand you Breach.
  { id: 'total-compromise', name: 'Total Compromise', tier: 'gatekeeper', archetypes: ['exploit', 'honeypot'], minLayer: 3, mods: ['spotlight'], scale: 2.4,
    loadout: [BEACON, p('port-scan'), p('tarpit'), p('credential-stuffing')] },
  // --- Layer 4: the core ---
  { id: 'null-session', name: 'Null Session', tier: 'gatekeeper', archetypes: ['exploit', 'overclock', 'honeypot'], minLayer: 4, mods: ['null-session'], scale: 2.17,
    loadout: [NULL_ROUTE, p('zero-day-chain'), p('priority-override'), p('zero-trust')] },
  { id: 'root-authority', name: 'Root Authority', tier: 'gatekeeper', archetypes: ['exploit', 'daemon', 'overclock'], minLayer: 4, mods: ['root-access'], scale: 1.91,
    loadout: [KERNEL_PANIC, p('chain-reaction'), p('memory-leak'), p('race-condition')] },
];

/** E3's budget table: Credit per turn by tier and first layer. */
export const ENEMY_BUDGET: Record<EnemyTier, [number, number, number, number]> = {
  regular: [5.1, 7.0, 8.0, 8.2],
  elite: [7.7, 10.5, 12.0, 12.3],
  gatekeeper: [10.8, 13.75, 14.2, 14.6], // midpoints of the 1.0-1.1x bands
};
