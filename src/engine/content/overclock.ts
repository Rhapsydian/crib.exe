import type { SubroutineDefinition } from '../subroutine-types';
import type { ArchetypePool } from '../subroutines';
import { DAEMON_POOL } from './daemon';


/** A plain Credit piece, for pricing positions. Local rather than
 * pricing.ts's creditPiece: content must not import the combat engine
 * (classes -> subroutines -> content would close a cycle). Same shape. */
function creditPiece(amount: number, id: string): SubroutineDefinition {
  return { id, name: id, archetype: 'exploit', alpha: { verb: 'credit', amount } };
}

/**
 * Overclock's authored pool (step 3, checkpoint 3; `docs/archive/authoring-design.md`).
 * Tempo / Empowerment: taking more turns, and boosting other pieces.
 * Signature beta: immediate. The step-2 retention risk, so payoffs are
 * kept smooth, Turbo Mode's tempo is threshold-mode (it scales the
 * points-driven turn rate rather than granting free turns), and every
 * alpha self-haste carries a points cooldown (session 47's invariant). A
 * beta self-haste on a once-per-hand edge (Priority Override) is
 * self-limiting and needs none.
 *
 * Many of these are worth something only relative to their neighbours
 * (Empower boosts the piece below; sequence betas count other Overclock
 * pieces), so each is priced in the position it is designed for --
 * OVERCLOCK_CONTEXTS. Not yet wired into acquisition (S7).
 */

const HASTE_POINTS_COOLDOWN = 15;

// --- Commons ---

/** Every 2nd pair you score: fire again, immediately. */
const PING: SubroutineDefinition = {
  id: 'ping',
  name: 'Ping',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'pair', shape: 'immediate', at: 2, effect: { verb: 'enhance', amount: 0 } },
};

const CACHE_HIT: SubroutineDefinition = {
  id: 'cache-hit',
  name: 'Cache Hit',
  archetype: 'overclock',
  alpha: { verb: 'empower', amount: 1, scope: 'next' },
  beta: { source: 'cards', category: 'fifteen', shape: 'graded', cap: 1, effect: { verb: 'enhance', amount: 1 } },
};

/** Rewards clustering: +1 per Overclock neighbour. */
const BURST_CLOCK: SubroutineDefinition = {
  id: 'burst-clock',
  name: 'Burst Clock',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'sequence', reach: 'adjacent', match: { archetype: 'overclock' }, shape: 'graded', cap: 2, effect: { verb: 'enhance', amount: 1 } },
};

/** Plain tempo: every 2nd go, take most of a turn sooner. Flat haste is
 * worth little (checkpoint 3: a 1/8-turn alpha haste with its cooldown
 * priced 0.96), so the haste is a big, occasional beta instead. */
const ELEVATED_SESSION: SubroutineDefinition = {
  id: 'elevated-session',
  name: 'Elevated Session',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'go', shape: 'immediate', at: 2, effect: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 3 / 4 } },
};

// --- Uncommons ---

/** The user's big-hand idea as tempo: reach 12+ this hand and you go
 * again sooner. */
const PRIORITY_OVERRIDE: SubroutineDefinition = {
  id: 'priority-override',
  name: 'Priority Override',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'state', condition: { kind: 'handPointsAtLeast', amount: 12 }, shape: 'immediate', effect: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 3 / 4 } },
};

/** A bigger, rarer boost to the next piece. */
const PORT_FORWARD: SubroutineDefinition = {
  id: 'port-forward',
  name: 'Port Forward',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'pair', shape: 'stepped', at: 2, effect: { verb: 'empower', amount: 2, scope: 'next' } },
};

/** Chain finisher: +1 per Overclock piece whose beta fired earlier this
 * turn. Goes last. */
const GRAND_SLAM: SubroutineDefinition = {
  id: 'grand-slam',
  name: 'Grand Slam',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'sequence', reach: 'anyPrior', match: { archetype: 'overclock' }, shape: 'graded', cap: 3, effect: { verb: 'enhance', amount: 1 } },
};

// --- Rares ---

/** Mid-loadout: Overclock pieces above feed it, and it empowers every
 * piece below -- +1/4 each per earlier elevated Overclock fire. Its worth
 * scales with the pieces below it (checkpoint 3: +1 each priced 4.25 with
 * just two below), hence the small per-piece amount. */
const CHAIN_REACTION: SubroutineDefinition = {
  id: 'chain-reaction',
  name: 'Chain Reaction',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: 2 },
  beta: { source: 'sequence', reach: 'anyPrior', match: { archetype: 'overclock' }, shape: 'graded', cap: 2, effect: { verb: 'empower', amount: 0.25, scope: 'rest' } },
};

/** Each fire permanently lowers your initiative threshold (to the 1/3
 * floor), so everything per-turn scales with it. Cross-archetype: Daemon's
 * fire-counting ramp ramps faster -- the Daemon + Overclock rare. */
const TURBO_MODE: SubroutineDefinition = {
  id: 'turbo-mode',
  name: 'Turbo Mode',
  archetype: 'overclock',
  alpha: { verb: 'tempo', target: 'own', mode: 'threshold', amount: 1 / 24 },
  beta: { source: 'cards', category: 'fifteen', shape: 'immediate', at: 2, effect: { verb: 'credit', amount: 3 } },
  pointsCooldown: HASTE_POINTS_COOLDOWN,
};

// --- Session 66 (docs/subroutines-design.md S6-S11): a Run Hook, a
// stepped pair Hook, a new Process and a rare build-definer. TBD/measured.

/** Run Hook: each run is speed, mid-hand. */
const PIPELINE_FLUSH: SubroutineDefinition = {
  id: 'pipeline-flush',
  name: 'Pipeline Flush',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'run', shape: 'immediate', at: 1, effect: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 1 / 4 } },
};

/** Stepped pair Hook: Empowers everything below it. */
const SUPERSCALAR: SubroutineDefinition = {
  id: 'superscalar',
  name: 'Superscalar',
  archetype: 'overclock',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'pair', shape: 'stepped', at: 3, effect: { verb: 'empower', amount: 1, scope: 'rest' } },
};

/** New Process: pure Charge, powering the subroutine below. */
const BRANCH_PREDICTOR: SubroutineDefinition = {
  id: 'branch-predictor',
  name: 'Branch Predictor',
  archetype: 'overclock',
  alpha: { verb: 'charge', amount: 1, target: 'next' },
  beta: { source: 'cards', category: 'fifteen', shape: 'graded', cap: 1, effect: { verb: 'enhance', amount: 1 } },
};

/** Rare: slows them every turn, speeds you as runs pile in. */
const CLOCK_SKEW: SubroutineDefinition = {
  id: 'clock-skew',
  name: 'Clock Skew',
  archetype: 'overclock',
  alpha: { verb: 'tempo', target: 'opponent', mode: 'gauge', amount: 1 / 8 },
  beta: { source: 'cards', category: 'run', shape: 'immediate', at: 2, effect: { verb: 'tempo', target: 'own', mode: 'gauge', amount: 1 / 2 } },
};

export const OVERCLOCK_POOL: ArchetypePool = {
  commons: [PING, CACHE_HIT, BURST_CLOCK, ELEVATED_SESSION, PIPELINE_FLUSH],
  uncommons: [PRIORITY_OVERRIDE, PORT_FORWARD, GRAND_SLAM, SUPERSCALAR, BRANCH_PREDICTOR],
  rares: [CHAIN_REACTION, TURBO_MODE, CLOCK_SKEW],
};

/** A pricing position: the piece is inserted at index `at` of `host`. */
export interface PricingContext {
  host: SubroutineDefinition[];
  at: number;
}
const HOST = creditPiece(2, 'host');
/** A neutral, non-Overclock spacer, so a sequence piece's price isn't
 * inflated by the adjacency bonus its presence gives Burst Clock. */
const SPACER = creditPiece(0, 'spacer');
const FORK_BOMB = DAEMON_POOL.rares.find((p) => p.id === 'fork-bomb')!;
const CRON_JOB = DAEMON_POOL.commons.find((p) => p.id === 'cron-job')!;

/** Non-rares priced in their designed position rather than alone. */
export const OVERCLOCK_CONTEXTS: Record<string, PricingContext> = {
  'cache-hit': { host: [HOST], at: 0 }, // above a Credit piece
  'port-forward': { host: [HOST], at: 0 },
  'burst-clock': { host: [HOST, PING], at: 2 }, // one Overclock neighbour
  'grand-slam': { host: [PING, BURST_CLOCK, SPACER, HOST], at: 3 }, // after an Overclock pair, spaced
};

export const OVERCLOCK_RARE_BUILDS: Record<string, PricingContext> = {
  // Overclock pieces above (Burst Clock beside Ping, so it fires
  // elevated), spaced, then credit pieces below.
  'chain-reaction': { host: [PING, BURST_CLOCK, SPACER, HOST, creditPiece(1, 'below')], at: 3 },
  'turbo-mode': { host: [FORK_BOMB, CRON_JOB, HOST], at: 0 },
};

/** Daemon's Fork Bomb, re-checked against Overclock's real tempo (its
 * checkpoint-2 build used a Haste stand-in and added nothing). */
export const OVERCLOCK_CROSS_BUILDS: [SubroutineDefinition, SubroutineDefinition[]][] = [
  [FORK_BOMB, [TURBO_MODE]],
  [FORK_BOMB, [ELEVATED_SESSION]],
];

export const OVERCLOCK_KITS: Record<string, SubroutineDefinition[]> = {
  'commons only': [CACHE_HIT, PING, BURST_CLOCK, ELEVATED_SESSION],
  early: [CACHE_HIT, PING, BURST_CLOCK],
  'late chain': [PING, BURST_CLOCK, CHAIN_REACTION, PORT_FORWARD, PRIORITY_OVERRIDE, GRAND_SLAM],
  'late tempo': [TURBO_MODE, ELEVATED_SESSION, PRIORITY_OVERRIDE, CACHE_HIT, PING, BURST_CLOCK],
};
