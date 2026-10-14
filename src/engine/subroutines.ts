import type { Archetype, SubroutineDefinition } from './subroutine-types';

/**
 * The SKELETON subroutine pool (session 51, A11).
 *
 * Not content. The archetype redesign scrapped the old 159-piece pool
 * (docs/design-history.md), and real content can't be authored until the
 * against step 2's pricing rules (DESIGN.md "Archetypes & Subroutines"
 * -> Pricing), which step 3 applies. This pool exists so
 * that, in the meantime, everything downstream of a pool keeps working --
 * acquisition, the Shop, Merge, full simulated runs and the calibration
 * scripts -- and so tests have fixtures.
 *
 * Shape: four pieces per archetype (two common, one uncommon, one rare),
 * each using that archetype's verbs and signature beta shape (A3), so the
 * whole model is exercised end to end. Every archetype's commons carry a
 * credit path, satisfying A3's credit rule from the first draw.
 *
 * Numbers are deliberately plain and roughly level, not tuned. They are
 * sized against session 50's D11 anchor: a fight reaches a 50-point win
 * threshold in ~4.5 turns, ~11 progress per turn across a six-piece
 * loadout, so a per-piece per-turn floor near 1.5-2. Rarity buys a
 * little more amplitude, never existence (D11). Everything here is
 * expected to be deleted when step 3 authors the real pool.
 *
 * Rarity is still encoded structurally -- by which array a piece lives
 * in -- rather than as a SubroutineDefinition field (rewards.ts derives
 * its lookup from these arrays).
 */

// Points a self-Haste piece's own side must score before it may fire
// again (session 47) -- a piece that grants its own side tempo can
// otherwise pay for its own next turn and compound. Sized against a real
// fight; TBD/playtesting like every number in this file.
const HASTE_POINTS_COOLDOWN = 15;

// --- Exploit: Spike / Control. Signature beta: graded enhance on Cards. ---

const PROBE: SubroutineDefinition = {
  id: 'probe',
  name: 'Probe',
  archetype: 'exploit',
  alpha: { verb: 'credit', amount: 2 },
  beta: { source: 'cards', category: 'fifteen', shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 } },
};

const PORT_KNOCK: SubroutineDefinition = {
  id: 'port-knock',
  name: 'Port Knock',
  archetype: 'exploit',
  alpha: { verb: 'tempo', target: 'opponent', mode: 'gauge', amount: 1 / 8 },
  beta: { source: 'cards', category: 'pair', shape: 'stepped', at: 2, effect: { verb: 'disrupt', action: 'forceDiscard' } },
};

const FUZZER: SubroutineDefinition = {
  id: 'fuzzer',
  name: 'Fuzzer',
  archetype: 'exploit',
  alpha: { verb: 'credit', amount: 2 },
  beta: { source: 'cards', category: 'suit', shape: 'graded', cap: 4, effect: { verb: 'enhance', amount: 1, trace: 1 } },
};

const PACKET_SNIFFER: SubroutineDefinition = {
  id: 'packet-sniffer',
  name: 'Packet Sniffer',
  archetype: 'exploit',
  alpha: { verb: 'disrupt', action: 'revealHand' },
  beta: { source: 'cards', category: 'run', shape: 'graded', cap: 3, effect: { verb: 'credit', amount: 2 } },
};

// --- Daemon: Ramp / Healing. Signature beta: stepped different effect on Progress. ---

const CRON_JOB: SubroutineDefinition = {
  id: 'cron-job',
  name: 'Cron Job',
  archetype: 'daemon',
  alpha: { verb: 'credit', amount: 1, growth: 0.5, growthCap: 3 },
  beta: { source: 'progress', metric: 'fires', per: 3, shape: 'stepped', at: 1, effect: { verb: 'suppress', amount: 2 } },
};

const SELF_REPAIR: SubroutineDefinition = {
  id: 'self-repair',
  name: 'Self-Repair',
  archetype: 'daemon',
  alpha: { verb: 'suppress', amount: 2 },
  beta: { source: 'progress', metric: 'points', per: 10, shape: 'graded', cap: 2, effect: { verb: 'enhance', amount: 1 } },
};

const RESPAWN: SubroutineDefinition = {
  id: 'respawn',
  name: 'Respawn',
  archetype: 'daemon',
  alpha: { verb: 'credit', amount: 1, growth: 1, growthCap: 4 },
  beta: { source: 'cards', category: 'suit', shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 } },
};

const ROLLBACK: SubroutineDefinition = {
  id: 'rollback',
  name: 'Rollback',
  archetype: 'daemon',
  alpha: { verb: 'suppress', amount: 2, growth: 0.5, growthCap: 2 },
  beta: { source: 'progress', metric: 'fires', per: 4, shape: 'stepped', at: 1, effect: { verb: 'credit', amount: 4 } },
};

// --- Overclock: Tempo / Empowerment. Signature beta: immediate, on State/Sequence. ---

const BURST_CLOCK: SubroutineDefinition = {
  id: 'burst-clock',
  name: 'Burst Clock',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: 2 },
  beta: { source: 'sequence', reach: 'anyPrior', match: { archetype: 'overclock' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 1 } },
};

const VOLTAGE_BOOST: SubroutineDefinition = {
  id: 'voltage-boost',
  name: 'Voltage Boost',
  archetype: 'overclock',
  alpha: { verb: 'empower', amount: 1, scope: 'next' },
  beta: { source: 'state', condition: { kind: 'nonDealer' }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 1 } },
};

const TURBO: SubroutineDefinition = {
  id: 'turbo',
  name: 'Turbo',
  archetype: 'overclock',
  alpha: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 1 / 8 },
  beta: { source: 'cards', category: 'suit', shape: 'immediate', at: 4, effect: { verb: 'credit', amount: 3 } },
  pointsCooldown: HASTE_POINTS_COOLDOWN,
};

const PIPELINE: SubroutineDefinition = {
  id: 'pipeline',
  name: 'Pipeline',
  archetype: 'overclock',
  alpha: { verb: 'charge', amount: 1, target: 'next' },
  beta: { source: 'sequence', reach: 'adjacent', match: { archetype: 'overclock' }, shape: 'whileTrue', effect: { verb: 'empower', amount: 2, scope: 'rest' } },
};

// --- Honeypot: Conversion / Defense. Signature beta: different effect on State/Progress. ---

const TARPIT: SubroutineDefinition = {
  id: 'tarpit',
  name: 'Tarpit',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 3 },
  beta: { source: 'state', condition: { kind: 'wardAbove', amount: 6 }, shape: 'whileTrue', effect: { verb: 'credit', amount: 3, from: 'ward' } },
};

const LURE: SubroutineDefinition = {
  id: 'lure',
  name: 'Lure',
  archetype: 'honeypot',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'progress', metric: 'absorbed', per: 4, shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 } },
};

const SINKHOLE: SubroutineDefinition = {
  id: 'sinkhole',
  name: 'Sinkhole',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 2 },
  beta: { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'whileTrue', effect: { verb: 'credit', amount: 2, from: 'opponent' } },
};

const MIRROR_PORT: SubroutineDefinition = {
  id: 'mirror-port',
  name: 'Mirror Port',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 2 },
  beta: { source: 'progress', metric: 'absorbed', per: 3, shape: 'immediate', at: 2, effect: { verb: 'credit', amount: 3, from: 'ward' } },
};

export interface ArchetypePool {
  commons: SubroutineDefinition[];
  uncommons: SubroutineDefinition[];
  rares: SubroutineDefinition[];
}

export const ARCHETYPE_POOLS: Record<Archetype, ArchetypePool> = {
  exploit: { commons: [PROBE, PORT_KNOCK], uncommons: [FUZZER], rares: [PACKET_SNIFFER] },
  daemon: { commons: [CRON_JOB, SELF_REPAIR], uncommons: [RESPAWN], rares: [ROLLBACK] },
  overclock: { commons: [BURST_CLOCK, VOLTAGE_BOOST], uncommons: [TURBO], rares: [PIPELINE] },
  honeypot: { commons: [LURE, TARPIT], uncommons: [SINKHOLE], rares: [MIRROR_PORT] },
};

export const ALL_POOL_SUBROUTINES: SubroutineDefinition[] = Object.values(ARCHETYPE_POOLS).flatMap((pool) => [
  ...pool.commons,
  ...pool.uncommons,
  ...pool.rares,
]);

/**
 * Starting loadouts for the six placeholder classes (A9: offense,
 * utility, bridge). Drawn from the pool itself rather than bespoke
 * pieces -- the bridge piece can't be designed until the bridge passive
 * is, so the third slot is a placeholder: the partner archetype's own
 * credit common, which keeps A3's credit rule satisfied from turn one
 * for both halves of the class. For Honeypot pairs the offense piece
 * comes from the partner archetype, since conversion pays off only once
 * defense is banked (A9).
 *
 * Because these are pool pieces, drawing one later in a run becomes
 * Merge material rather than a dead offer -- the same outcome the old
 * "a class's own pieces stay in its own pool" rule produced.
 */
export const CLASS_STARTING_LOADOUTS = {
  'exploit-overclock': [PROBE, VOLTAGE_BOOST, BURST_CLOCK],
  'exploit-daemon': [PROBE, SELF_REPAIR, CRON_JOB],
  'daemon-overclock': [CRON_JOB, VOLTAGE_BOOST, BURST_CLOCK],
  'exploit-honeypot': [PROBE, TARPIT, LURE],
  'daemon-honeypot': [CRON_JOB, TARPIT, LURE],
  'overclock-honeypot': [BURST_CLOCK, TARPIT, LURE],
} satisfies Record<string, SubroutineDefinition[]>;

export const ALL_SUBROUTINES: SubroutineDefinition[] = ALL_POOL_SUBROUTINES;
