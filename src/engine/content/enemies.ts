import type { Archetype, SubroutineDefinition } from '../subroutine-types';
import type { EnemyTier } from '../enemies';
import type { ClassId } from '../classes';
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
  /** The class bridge it carries as a Mod (E4: elites and gatekeepers). */
  bridge?: ClassId;
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

/** A piece that also makes the player loud (E7's tracers): session 47's
 * `tracePressure`, Trace added to the player each time it fires. */
function tracing(piece: SubroutineDefinition, pressure: number): SubroutineDefinition {
  return { ...piece, id: `${piece.id}-tracer`, tracePressure: pressure };
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
];

/** Elites (E2: 4; E4: their pair's class bridge as a Mod). Better pieces
 * than regulars -- a rare or uncommons (E1). Each pair is a class's, so
 * the four cover every archetype twice. */
export const AUTHORED_ELITES: AuthoredEnemy[] = [
  // The spike engine: each fifteen charges Port Scan; each Exploit beta
  // Empowers the next piece (Exploit Chain).
  { id: 'zero-day-broker', name: 'Zero-Day Broker', tier: 'elite', archetypes: ['exploit', 'overclock'], minLayer: 1, bridge: 'exploit-overclock', loadout: [p('zero-day-chain'), p('port-scan'), p('credential-stuffing')], scale: 0.9 },
  // Keeps you down: its fifteens Suppress you (Backdoor Maintenance),
  // Heartbeat heals hardest while you lead, Race Condition pays while
  // you're under half.
  { id: 'incident-response', name: 'Incident Response', tier: 'elite', archetypes: ['exploit', 'daemon'], minLayer: 1, bridge: 'exploit-daemon', loadout: [p('race-condition'), p('heartbeat-monitor'), p('cron-job')], scale: 0.95 },
  // The grinder: its Suppress banks Ward (Hardened Perimeter), it walls
  // up, and Memory Leak ramps the longer you take.
  { id: 'blackout-cell', name: 'Blackout Cell', tier: 'elite', archetypes: ['daemon', 'honeypot'], minLayer: 2, bridge: 'daemon-honeypot', loadout: [p('memory-leak'), p('sinkhole'), p('basic-auth')], scale: 1.5 },
  // E7's elite tracer: fast, banks Ward every turn (Siphon), and every
  // fire makes you louder -- win fast or pay in Heat. Pressure is 1/8 a
  // fire: at 1/2 it pushed ~20 Trace a fight (57% of layer 2's
  // allowance), since its pieces fire on turns AND as immediate betas.
  { id: 'intrusion-alarm', name: 'Intrusion Alarm', tier: 'elite', archetypes: ['overclock', 'honeypot'], minLayer: 2, bridge: 'overclock-honeypot', loadout: [tracing(p('priority-override'), 0.125), tracing(p('elevated-session'), 0.125), p('tarpit')] },
];

/** E3's budget table: Credit per turn by tier and first layer. */
export const ENEMY_BUDGET: Record<EnemyTier, [number, number, number, number]> = {
  regular: [5.1, 7.0, 8.0, 8.2],
  elite: [7.7, 10.5, 12.0, 12.3],
  gatekeeper: [10.8, 13.75, 14.2, 14.6], // midpoints of the 1.0-1.1x bands
};
