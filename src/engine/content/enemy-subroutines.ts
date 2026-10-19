import type { SubroutineDefinition } from '../subroutine-types';

/**
 * Enemy-only subroutines (session 60, docs/enemy-review.md CP1-CP2):
 * twelve, three per archetype, built around the three enemy-only effects
 * -- Trace (Heat), Wipe (your Hook counts) and Strip (your Ward) -- four
 * each. Each follows its archetype's habits: Exploit Hooks on scoring,
 * Daemon on its fire clock, Overclock on tempo and neighbours, Honeypot on
 * Ward. Trace Hooks trigger on the enemy's own play (its scoring, fires or
 * Ward), never on yours, so good Cribbage is never what costs you Heat --
 * the one exception is Canary Token, which watches your Breach.
 *
 * Amounts are first-layer values before the enemy's scale (Trace and Wipe
 * never scale). Not in the player pool; regulars and elites mix them with
 * pool subroutines.
 */

// --- Exploit ---
export const PAYLOAD_WIPER: SubroutineDefinition = {
  id: 'payload-wiper', name: 'Payload Wiper', archetype: 'exploit',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'pair', shape: 'graded', cap: 1, effect: { verb: 'wipe', amount: 1 } },
};
export const CREDENTIAL_DUMP: SubroutineDefinition = {
  id: 'credential-dump', name: 'Credential Dump', archetype: 'exploit',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'fifteen', shape: 'immediate', at: 2, effect: { verb: 'trace', amount: 1 } },
};
export const PRIVILEGE_DROP: SubroutineDefinition = {
  id: 'privilege-drop', name: 'Privilege Drop', archetype: 'exploit',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'fifteen', shape: 'graded', cap: 2, effect: { verb: 'strip', amount: 1 } },
};

// --- Daemon ---
export const LOG_ROTATION: SubroutineDefinition = {
  id: 'log-rotation', name: 'Log Rotation', archetype: 'daemon',
  alpha: { verb: 'suppress', amount: 1 },
  beta: { source: 'progress', metric: 'fires', per: 3, shape: 'stepped', at: 1, effect: { verb: 'wipe', amount: 1 } },
};
export const PERSISTENCE_AGENT: SubroutineDefinition = {
  id: 'persistence-agent', name: 'Persistence Agent', archetype: 'daemon',
  alpha: { verb: 'credit', amount: 1, growth: 0.25, growthCap: 1 },
  beta: { source: 'progress', metric: 'fires', per: 4, shape: 'stepped', at: 1, effect: { verb: 'trace', amount: 1 } },
};
export const GARBAGE_COLLECTOR: SubroutineDefinition = {
  id: 'garbage-collector', name: 'Garbage Collector', archetype: 'daemon',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'whileTrue', effect: { verb: 'wipe', amount: 1 } },
};

// --- Overclock ---
export const THROTTLE: SubroutineDefinition = {
  id: 'throttle', name: 'Throttle', archetype: 'overclock',
  alpha: { verb: 'tempo', target: 'opponent', mode: 'gauge', amount: 0.125 },
  beta: { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'whileTrue', effect: { verb: 'strip', amount: 2 } },
};
export const PACKET_STORM: SubroutineDefinition = {
  id: 'packet-storm', name: 'Packet Storm', archetype: 'overclock',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'go', shape: 'immediate', at: 2, effect: { verb: 'strip', amount: 2 } },
};
export const CONTEXT_SWITCH: SubroutineDefinition = {
  id: 'context-switch', name: 'Context Switch', archetype: 'overclock',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'sequence', reach: 'adjacent', match: { archetype: 'overclock' }, shape: 'graded', cap: 2, effect: { verb: 'wipe', amount: 1 } },
};

// --- Honeypot ---
export const HONEYNET: SubroutineDefinition = {
  id: 'honeynet', name: 'Honeynet', archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 2 },
  beta: { source: 'progress', metric: 'absorbed', per: 2, shape: 'graded', cap: 2, effect: { verb: 'trace', amount: 1 } },
};
export const COUNTERMEASURE: SubroutineDefinition = {
  id: 'countermeasure', name: 'Countermeasure', archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 1 },
  beta: { source: 'state', condition: { kind: 'wardAbove', amount: 3 }, shape: 'whileTrue', effect: { verb: 'strip', amount: 1 } },
};
export const CANARY_TOKEN: SubroutineDefinition = {
  id: 'canary-token', name: 'Canary Token', archetype: 'honeypot',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'immediate', effect: { verb: 'trace', amount: 2 } },
};

export const ENEMY_SUBROUTINES: readonly SubroutineDefinition[] = [
  PAYLOAD_WIPER,
  CREDENTIAL_DUMP,
  PRIVILEGE_DROP,
  LOG_ROTATION,
  PERSISTENCE_AGENT,
  GARBAGE_COLLECTOR,
  THROTTLE,
  PACKET_STORM,
  CONTEXT_SWITCH,
  HONEYNET,
  COUNTERMEASURE,
  CANARY_TOKEN,
];
