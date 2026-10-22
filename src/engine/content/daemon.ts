import type { SubroutineDefinition } from '../subroutine-types';
import type { ArchetypePool } from '../subroutines';
import { EXPLOIT_POOL } from './exploit';

/**
 * Daemon's authored pool (step 3, checkpoint 2; `docs/archive/authoring-design.md`).
 * Ramp / Healing: alphas that grow with every fire, and Suppress to push
 * the opponent's win gauge back. Signature beta: a stepped different
 * effect on Progress (points scored, or the piece's own fires).
 *
 * Growth isn't priced by the formula (its worth depends on fight length),
 * so most of these are priced by duel. Checked by
 * `scripts/archetype-check.ts --archetype=daemon`.
 *
 * Not yet wired into acquisition (S7).
 */

// --- Commons ---

const CRON_JOB: SubroutineDefinition = {
  id: 'cron-job',
  name: 'Cron Job',
  archetype: 'daemon',
  alpha: { verb: 'credit', amount: 1, growth: 0.25, growthCap: 2 },
  beta: { source: 'progress', metric: 'fires', per: 3, shape: 'stepped', at: 1, effect: { verb: 'suppress', amount: 1 } },
};

/** Plain healing; its credit path is its beta. */
const WATCHDOG_TIMER: SubroutineDefinition = {
  id: 'watchdog-timer',
  name: 'Watchdog Timer',
  archetype: 'daemon',
  alpha: { verb: 'suppress', amount: 1 },
  beta: { source: 'progress', metric: 'points', per: 10, shape: 'stepped', at: 1, effect: { verb: 'credit', amount: 1 } },
};

const STEADY_DRIP: SubroutineDefinition = {
  id: 'steady-drip',
  name: 'Steady Drip',
  archetype: 'daemon',
  alpha: { verb: 'credit', amount: 1, growth: 0.25, growthCap: 1 },
  beta: { source: 'progress', metric: 'points', per: 20, shape: 'stepped', at: 1, effect: { verb: 'enhance', amount: 1 } },
};

/** Healing that ramps. */
const PATCH: SubroutineDefinition = {
  id: 'patch',
  name: 'Patch',
  archetype: 'daemon',
  alpha: { verb: 'suppress', amount: 1, growth: 0.25, growthCap: 1 },
  beta: { source: 'progress', metric: 'fires', per: 2, shape: 'stepped', at: 1, effect: { verb: 'credit', amount: 1 } },
};

// --- Uncommons ---

/** Pure ramp: nothing on turn 1, Credit 3 by turn 7. */
const MEMORY_LEAK: SubroutineDefinition = {
  id: 'memory-leak',
  name: 'Memory Leak',
  archetype: 'daemon',
  alpha: { verb: 'credit', amount: 0, growth: 0.5, growthCap: 3 },
  beta: { source: 'progress', metric: 'points', per: 25, shape: 'stepped', at: 1, effect: { verb: 'suppress', amount: 2 } },
};

/** Heals hardest when you're behind. */
const HEARTBEAT_MONITOR: SubroutineDefinition = {
  id: 'heartbeat-monitor',
  name: 'Heartbeat Monitor',
  archetype: 'daemon',
  alpha: { verb: 'suppress', amount: 1 },
  beta: { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 3 } },
};

/** A comeback piece: stronger while you're short of halfway. */
const FAILOVER: SubroutineDefinition = {
  id: 'failover',
  name: 'Failover',
  archetype: 'daemon',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'state', condition: { kind: 'ownGaugeBelow', fraction: 0.5 }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 3 } },
};

// --- Rares ---

/** Stack stepped Daemon pieces: each charge is an extra step. */
const LOAD_BALANCER: SubroutineDefinition = {
  id: 'load-balancer',
  name: 'Load Balancer',
  archetype: 'daemon',
  alpha: { verb: 'credit', amount: 2 },
  beta: { source: 'progress', metric: 'points', per: 15, shape: 'stepped', at: 1, effect: { verb: 'charge', amount: 1, target: 'all' } },
};

/** Ramps on fires, so Overclock's extra turns ramp it faster: a rare for
 * Daemon + Overclock ("accelerated ramp"). */
const FORK_BOMB: SubroutineDefinition = {
  id: 'fork-bomb',
  name: 'Fork Bomb',
  archetype: 'daemon',
  alpha: { verb: 'credit', amount: 1, growth: 0.25, growthCap: 2 },
  beta: { source: 'progress', metric: 'fires', per: 4, shape: 'stepped', at: 1, effect: { verb: 'credit', amount: 3 } },
};

export const DAEMON_POOL: ArchetypePool = {
  commons: [CRON_JOB, WATCHDOG_TIMER, STEADY_DRIP, PATCH],
  uncommons: [MEMORY_LEAK, HEARTBEAT_MONITOR, FAILOVER],
  rares: [LOAD_BALANCER, FORK_BOMB],
};

/** A self-haste stand-in for Overclock's tempo until Overclock is
 * authored: a quarter turn, with the standard points cooldown. */
const HASTE_STAND_IN: SubroutineDefinition = {
  id: 'haste-stand-in',
  name: 'Haste 1/4 (Overclock stand-in)',
  archetype: 'overclock',
  alpha: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 1 / 4 },
  pointsCooldown: 15,
};

export const DAEMON_RARE_BUILDS: Record<string, SubroutineDefinition[]> = {
  'load-balancer': [CRON_JOB, WATCHDOG_TIMER],
  'fork-bomb': [HASTE_STAND_IN],
};

/** Cross-archetype re-checks: an earlier archetype's rare against this
 * archetype's real pieces. Exploit's Race Condition was priced against a
 * Suppress stand-in at checkpoint 1. */
const RACE_CONDITION = EXPLOIT_POOL.rares.find((p) => p.id === 'race-condition')!;
export const DAEMON_CROSS_BUILDS: [SubroutineDefinition, SubroutineDefinition[]][] = [
  [RACE_CONDITION, [WATCHDOG_TIMER]],
  [RACE_CONDITION, [PATCH, HEARTBEAT_MONITOR]],
];

export const DAEMON_KITS: Record<string, SubroutineDefinition[]> = {
  'commons only': [CRON_JOB, WATCHDOG_TIMER, STEADY_DRIP, PATCH],
  early: [CRON_JOB, WATCHDOG_TIMER, STEADY_DRIP],
  'late ramp': [FORK_BOMB, MEMORY_LEAK, CRON_JOB, STEADY_DRIP, FAILOVER, PATCH],
  'late heal': [LOAD_BALANCER, CRON_JOB, WATCHDOG_TIMER, PATCH, HEARTBEAT_MONITOR, STEADY_DRIP],
};
