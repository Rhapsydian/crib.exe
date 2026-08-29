import type { SubroutineDefinition, SuitedArchetype } from './subroutine-types';
import { ALL_POOL_SUBROUTINES } from './subroutines';
import { ENEMY_ONLY_SUBROUTINES } from './enemy-subroutines';
import { scaledPayloadMagnitude } from './merge';
import type { Rng } from './rng';
import type { LayerGraph, MapNode } from './map-types';

/**
 * Enemy type system (Phase 5 checkpoint A, session 27's `/decision-session`
 * design). Enemies are a real, named roster with identity -- structurally
 * close to player classes (classes.ts's ClassDefinition) rather than
 * procedural generation. See DESIGN.md's "Enemy Design"/"The Roster"
 * sections for the full design writeup and BACKLOG.md's Phase 5 spec for
 * the checkpoint breakdown this file implements.
 */

export type EnemyTier = 'regular' | 'elite' | 'gatekeeper';

/** One id per named enemy in the roster (checkpoint D fills in the real
 * EnemyDefinition data). Deliberately allowed to collide with a
 * subroutine id in subroutines.ts (e.g. 'script-kiddie', 'total-compromise')
 * when an enemy is named after its own signature piece -- different
 * keyspaces (ENEMY_DEFINITIONS vs ALL_POOL_SUBROUTINES), never looked up
 * interchangeably. */
export type EnemyId =
  // Regular (12)
  | 'script-kiddie'
  | 'fuzzer-bot'
  | 'botnet-node'
  | 'keylogger-process'
  | 'legacy-firewall'
  | 'access-gate'
  | 'drive-by-kit'
  | 'rogue-endpoint'
  | 'patch-runner'
  | 'perimeter-sentry'
  | 'quarantine-daemon'
  | 'hardened-workstation'
  // Elite (8)
  | 'zero-day-broker'
  | 'ransomware-deployment'
  | 'zero-trust-node'
  | 'compromised-ad-server'
  | 'hardened-perimeter'
  | 'blackout-cell'
  | 'backchannel-handler'
  | 'compromised-dependency'
  // Gatekeeper, layer 1 (3)
  | 'the-concierge'
  | 'firewall-prime'
  | 'ghost-process'
  // Gatekeeper, layer 2 (3)
  | 'incident-response'
  | 'the-quarantine-ward'
  | 'zero-sum'
  // Gatekeeper, layer 3 (3)
  | 'total-compromise'
  | 'adaptive-threat'
  | 'silent-corruption'
  // Gatekeeper, layer 4 (3)
  | 'null-session'
  | 'kernel-panic'
  | 'ghost-in-the-machine';

/** One id per named enemy passive (checkpoint B implements the actual
 * hook logic each of these drives; checkpoint D wires them onto
 * EnemyDefinition.passiveIds). 34 total across the 32 enemies (Blackout
 * Cell and Backchannel Handler each carry 2). */
export type EnemyPassiveId =
  // Regular
  | 'lucky-guess'
  | 'trial-and-error'
  | 'still-spreading'
  | 'long-runtime'
  | 'stubborn-default'
  | 'locked-down'
  | 'smash-and-grab'
  | 'opportunist'
  | 'cover-your-tracks'
  | 'hold-the-line'
  | 'steady-state'
  | 'grinds-you-down'
  // Elite
  | 'fresh-exploit'
  | 'escalating-demand'
  | 'no-exceptions'
  | 'infection-vector'
  | 'foothold-reinforced'
  | 'attrition'
  | 'held-together'
  | 'dead-drop-protocol'
  | 'off-the-grid'
  | 'sleeper-network'
  // Gatekeeper
  | 'reception-protocol'
  | 'no-way-in'
  | 'digital-ghost'
  | 'highest-bidder'
  | 'total-quarantine'
  | 'primed-to-strike'
  | 'cascading-failure'
  | 'adaptive-defense'
  | 'total-corruption'
  | 'null-session-passive'
  | 'redundant-kernel'
  | 'total-access';

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  tier: EnemyTier;
  /** Not locked to a fixed pair like ClassDefinition's [Archetype,
   * Archetype] -- session 27's decision: 2-archetype pairing is the
   * default but not a hard lock, single-archetype and bespoke 3+
   * archetype gatekeepers are both fine. */
  archetypes: SuitedArchetype[];
  /** The layer (1-4) this identity starts appearing at -- it stays in
   * its tier's pool at every layer afterward, not just this one. */
  minLayer: number;
  loadout: SubroutineDefinition[];
  /** 0-2 entries -- most enemies carry exactly one, a few Elites carry
   * two (session 27's "1-2 real passives" for that tier). */
  passiveIds: EnemyPassiveId[];
  /** Per-layer difficulty scaler (session 39), gatekeeper-only -- an
   * explicit, individually authored/tunable multiplier applied to this
   * gatekeeper's own loadout magnitude, rather than derived live from a
   * shared formula the way regular/elite scaling is (see
   * enemyMagnitudeScaler below). Gatekeepers never repeat across layers
   * (eligibleEnemies' exact-match rule), so "the same enemy at a higher
   * layer" doesn't apply to them the way it does to regular/elite -- but
   * the same underlying problem (gatekeeper-check.ts's session 39
   * finding: layer 1 gatekeepers were harder than layer 4's, backwards
   * from DESIGN.md's "meant to be very challenging for the layer it's
   * presented at" intent) still needs a real per-identity knob. Seeded
   * per-gatekeeper below from the same step regular/elite use, as a
   * starting point for empirical retuning, not a final answer. Undefined
   * (treated as 1, no scaling) for regular/elite -- they use
   * enemyMagnitudeScaler instead, since a stored value wouldn't make
   * sense for an identity that can legitimately appear at several
   * different layers. */
  magnitudeScaler?: number;
}

const SUBROUTINE_BY_ID: ReadonlyMap<string, SubroutineDefinition> = new Map(
  [...ALL_POOL_SUBROUTINES, ...ENEMY_ONLY_SUBROUTINES].map((subroutine) => [subroutine.id, subroutine]),
);

/** Looks up a real subroutine by id, from either the shared player-pool
 * catalog or enemy-subroutines.ts's own enemy-only catalog -- throws
 * immediately on a typo/missing id rather than silently shipping a gap
 * in an enemy's kit. Enemies can draw from either (DESIGN.md:
 * "subroutines can be drawn straight from the player's own catalog... or
 * be fully bespoke to one enemy") -- the session 27 roster draft used
 * only pool pieces, no bespoke content at all, until session 39's roster
 * audit found that produced real dead content (Heat-gated triggers,
 * which no enemy can ever satisfy) and enemy-subroutines.ts's catalog
 * was added to fix it. Enemy-only ids are never reachable through a
 * player's own Merge/Shop/reward draw -- this function is the only thing
 * that ever resolves one. */
export function pool(id: string): SubroutineDefinition {
  const found = SUBROUTINE_BY_ID.get(id);
  if (!found) throw new Error(`enemies.ts: no pool subroutine with id "${id}"`);
  return found;
}

/**
 * The enemy roster (checkpoint C plumbing, checkpoint D content).
 *
 * A plain array, not a Record<EnemyId, EnemyDefinition> -- EnemyId's
 * union already lists all 32 real names, and a keyed Record would force
 * every one of them to be defined before this file type-checks. An
 * array has no such exhaustiveness requirement, so checkpoint C's
 * selection/skill-dial machinery can be built and tested now against a
 * small placeholder set; checkpoint D swaps this array's contents for
 * the real 32 `EnemyDefinition`s with no change needed anywhere that
 * reads from it.
 *
 * `minLayer` means two different things depending on tier, documented
 * on EnemyDefinition's own JSDoc: for regular/elite it's a floor (starts
 * appearing at this layer, stays in the pool afterward); for gatekeeper
 * it's the exact layer that enemy's stable belongs to (one stable per
 * layer, not a floor).
 */
/**
 * The full 32-enemy roster (Phase 5 checkpoint D), transcribed from
 * DESIGN.md's "The Roster" -- every subroutine drawn from the shared
 * pool catalog via pool() above (no bespoke subroutine content in this
 * roster), every passive id wired to its real hook logic in resolve.ts
 * (checkpoint B). Both real technical issues DESIGN.md documents were
 * already designed around: no included subroutine's `chained` trigger
 * is missing its pool-legal prerequisite from the same kit, and no
 * enemy includes `zero-knowledge-exploit` (which needs a Corrupted-
 * applier partner it would otherwise lack).
 */
export const ENEMY_ROSTER: EnemyDefinition[] = [
  // --- Regular (12) -- commons only, no Root ---
  { id: 'script-kiddie', name: 'Script Kiddie', tier: 'regular', archetypes: ['exploit'], minLayer: 1, loadout: [pool('script-kiddie'), pool('port-scan')], passiveIds: ['lucky-guess'] },
  { id: 'fuzzer-bot', name: 'Fuzzer Bot', tier: 'regular', archetypes: ['exploit'], minLayer: 2, loadout: [pool('fuzzer'), pool('race-condition')], passiveIds: ['trial-and-error'] },
  { id: 'botnet-node', name: 'Botnet Node', tier: 'regular', archetypes: ['malware'], minLayer: 1, loadout: [pool('botnet'), pool('adware')], passiveIds: ['still-spreading'] },
  { id: 'keylogger-process', name: 'Keylogger Process', tier: 'regular', archetypes: ['malware'], minLayer: 2, loadout: [pool('keylogger'), pool('memory-leak')], passiveIds: ['long-runtime'] },
  // Session 28 retrofit: Legacy Firewall's original 2-piece kit
  // (basic-auth/checksum, both instantCounterPush) had zero payload
  // that credits its own gauge -- structurally incapable of ever
  // winning outright (DESIGN.md's Neutral Archetype section). Background
  // Task (neutral common) gives it a small, real, unconditional credit.
  { id: 'legacy-firewall', name: 'Legacy Firewall', tier: 'regular', archetypes: ['encryption'], minLayer: 1, loadout: [pool('basic-auth'), pool('checksum'), pool('background-task')], passiveIds: ['stubborn-default'] },
  // Session 28 retrofit: same structural gap as Legacy Firewall --
  // two-factor/sandboxing are both pure mitigation. Checksum Match
  // (neutral common, occurrence:fifteen) instead of Background Task for
  // roster variety (see Legacy Firewall's own note).
  { id: 'access-gate', name: 'Access Gate', tier: 'regular', archetypes: ['encryption'], minLayer: 2, loadout: [pool('two-factor'), pool('sandboxing'), pool('checksum-match')], passiveIds: ['locked-down'] },
  { id: 'drive-by-kit', name: 'Drive-By Kit', tier: 'regular', archetypes: ['exploit', 'malware'], minLayer: 1, loadout: [pool('off-by-one'), pool('ransomware')], passiveIds: ['smash-and-grab'] },
  { id: 'rogue-endpoint', name: 'Rogue Endpoint', tier: 'regular', archetypes: ['exploit', 'malware'], minLayer: 2, loadout: [pool('credential-stuffing'), pool('trojan'), pool('race-condition')], passiveIds: ['opportunist'] },
  { id: 'patch-runner', name: 'Patch Runner', tier: 'regular', archetypes: ['exploit', 'encryption'], minLayer: 1, loadout: [pool('port-scan'), pool('patch')], passiveIds: ['cover-your-tracks'] },
  { id: 'perimeter-sentry', name: 'Perimeter Sentry', tier: 'regular', archetypes: ['exploit', 'encryption'], minLayer: 2, loadout: [pool('privilege-escalation'), pool('access-control')], passiveIds: ['hold-the-line'] },
  { id: 'quarantine-daemon', name: 'Quarantine Daemon', tier: 'regular', archetypes: ['malware', 'encryption'], minLayer: 1, loadout: [pool('patch-notes'), pool('adware')], passiveIds: ['steady-state'] },
  // Session 28 retrofit: Slowloris applies a debuff only (no DoT), so
  // this kit had no credit-capable piece either -- swapped for Steady
  // Drip (neutral common, accumulator:points) rather than adding a 4th
  // piece, keeping Regular's 1-3-subroutine sizing.
  { id: 'hardened-workstation', name: 'Hardened Workstation', tier: 'regular', archetypes: ['malware', 'encryption'], minLayer: 3, loadout: [pool('sandboxing'), pool('two-factor'), pool('steady-drip')], passiveIds: ['grinds-you-down'] },

  // --- Elite (8) -- 3+ subroutines, mostly uncommons ---
  // Session 35: widened from minLayer 2 to 1 -- the 3 single-archetype
  // Elites are the tier's simplest identities (mirroring Regular's own
  // layer-1/layer-2 split by archetype simplicity), so layer 1 gets a
  // real Elite presence without new authoring. The 2-archetype and Root
  // Elites below stay at their original minLayer, preserving the
  // "deeper layers draw from a harder-skewing subset" progression.
  { id: 'zero-day-broker', name: 'Zero-Day Broker', tier: 'elite', archetypes: ['exploit'], minLayer: 1, loadout: [pool('zero-day-chain'), pool('buffer-overrun'), pool('fracture-point')], passiveIds: ['fresh-exploit'] },
  { id: 'ransomware-deployment', name: 'Ransomware Deployment', tier: 'elite', archetypes: ['malware'], minLayer: 1, loadout: [pool('fork-bomb'), pool('polymorphic-worm'), pool('spyware')], passiveIds: ['escalating-demand'] },
  // Session 28 retrofit: an all-mitigation Elite kit (same structural
  // gap) -- Overclock (neutral uncommon, selfState:heatAbove) added as
  // a 4th piece, "pushed to its limits, it strikes back."
  { id: 'zero-trust-node', name: 'Zero Trust Node', tier: 'elite', archetypes: ['encryption'], minLayer: 1, loadout: [pool('rate-limiting'), pool('honeypot'), pool('redundant-backup'), pool('escalating-response')], passiveIds: ['no-exceptions'] },
  { id: 'compromised-ad-server', name: 'Compromised Ad Server', tier: 'elite', archetypes: ['exploit', 'malware'], minLayer: 2, loadout: [pool('watering-hole'), pool('polymorphic-worm'), pool('off-by-one')], passiveIds: ['infection-vector'] },
  { id: 'hardened-perimeter', name: 'Hardened Perimeter', tier: 'elite', archetypes: ['exploit', 'encryption'], minLayer: 2, loadout: [pool('watering-hole'), pool('fail-secure'), pool('privilege-escalation')], passiveIds: ['foothold-reinforced'] },
  { id: 'blackout-cell', name: 'Blackout Cell', tier: 'elite', archetypes: ['malware', 'encryption'], minLayer: 3, loadout: [pool('persistent-threat'), pool('redundant-backup'), pool('slowloris')], passiveIds: ['attrition', 'held-together'] },
  // Session 28 retrofit: a pure recon/denial Root kit, zero credit --
  // Chain Reaction (neutral uncommon, occurrence:run) added as a 4th
  // piece, "the recon pays off in a real strike."
  { id: 'backchannel-handler', name: 'Backchannel Handler', tier: 'elite', archetypes: ['root'], minLayer: 3, loadout: [pool('intercept'), pool('dns-poisoning'), pool('dead-drop'), pool('chain-reaction')], passiveIds: ['dead-drop-protocol', 'off-the-grid'] },
  { id: 'compromised-dependency', name: 'Compromised Dependency', tier: 'elite', archetypes: ['root', 'malware'], minLayer: 3, loadout: [pool('supply-route'), pool('polymorphic-worm'), pool('fork-bomb')], passiveIds: ['sleeper-network'] },

  // --- Gatekeeper (12) -- fully bespoke, one stable per layer ---
  // magnitudeScaler (session 39) seeded uniformly per layer here --
  // 1.0/1.3/1.6/1.9, the same 0.3-per-layer step regular/elite get from
  // enemyMagnitudeScaler below (bumped from an initial 0.15 -- see that
  // constant's own comment) -- as a starting point for empirical
  // retuning against gatekeeper-check.ts, not a final answer. Each is a
  // real, independent per-gatekeeper knob from here on, not slaved to
  // this formula (e.g. Firewall Prime, already the roster's hardest
  // fight at its own layer, is an obvious first candidate to dial back
  // rather than leaving at the layer-1 baseline).
  // Layer 1 -- perimeter/DMZ
  { id: 'the-concierge', name: 'The Concierge', tier: 'gatekeeper', archetypes: ['exploit', 'encryption'], minLayer: 1, loadout: [pool('total-pwnage'), pool('patch'), pool('full-rollback'), pool('privilege-escalation')], passiveIds: ['reception-protocol'], magnitudeScaler: 1.0 },
  // Session 28 retrofit: an all-mitigation gatekeeper -- Circuit
  // Breaker (neutral rare) is a near-perfect thematic fit for the
  // roster's purest defensive identity, converting exactly the
  // mitigation this kit already generates into a real strike.
  // Session 39, ground-up redesign (in progress): Zero Trust's own
  // reactive enemyState trigger re-arms every time the player's own
  // Breach/Containment climbs back above the threshold after being
  // pushed down -- unbounded, it fired an average of 8.28 times per real
  // match against Warden (600-seed check), dragging fights toward the
  // hard-resolution deadline and giving Circuit Breaker far more time to
  // build than a normal fight would. A hard fire cap either does nothing
  // or trivializes the matchup for every class (tested, no good middle
  // value exists) -- redesigned instead as a self-limiting decay via the
  // new magnitudeDecayPerFire mechanism: still hits close to full
  // strength the first couple of times, tapers toward a real-but-
  // survivable floor rather than an infinite wall. A bespoke copy (not
  // the shared pool piece -- Null Session and any future user of Zero
  // Trust stay unaffected). Decay/floor values TBD/playtesting, being
  // tuned empirically against the real matchup next.
  {
    id: 'firewall-prime',
    name: 'Firewall Prime',
    tier: 'gatekeeper',
    archetypes: ['encryption'],
    minLayer: 1,
    loadout: [
      { ...pool('zero-trust'), id: 'zero-trust-firewall-prime', magnitudeDecayPerFire: 1, magnitudeFloor: 10 },
      // Was Air Gap, session 39's original dead-piece finding (selfState:
      // heatAbove, unreachable -- enemies never accumulate Heat). Replaced
      // with Fail-Secure (enemy-subroutines.ts), a genuinely enemy-viable
      // Ward-caster -- which also resurrects `no-way-in` below: that
      // passive only ever re-casts a just-fired Ward, and Air Gap being
      // the kit's sole (and dead) Ward-caster made it doubly dead. Now
      // that Fail-Secure can actually fire, no-way-in has something real
      // to refresh again.
      pool('fail-secure'),
      // Redundant Backup's hot payload credits mitigationBanked its full
      // amountPerTick*duration at cast time (resolve.ts's `case 'hot':`) --
      // at the shared player value (5*4=20) a single cast alone armed
      // Circuit Breaker (threshold 10) more than 2x over, before Zero
      // Trust ever fired. Tuned down here (2*4=8, below threshold alone)
      // so Circuit Breaker needs contribution from more than one piece.
      // TBD/playtesting.
      { ...pool('redundant-backup'), id: 'redundant-backup-firewall-prime', payload: { kind: 'hot', amountPerTick: 2, cadence: 'castersTurnPulse', duration: 4 } },
      pool('circuit-breaker'),
    ],
    passiveIds: ['no-way-in'],
    magnitudeScaler: 1.0,
  },
  // Session 28 retrofit: cron-job/full-system-compromise/dns-poisoning
  // are all denial/manipulation, zero credit -- Watchdog Timer (neutral
  // rare, occurrence:go, scaling) added: "keep calling Go, it corners you."
  { id: 'ghost-process', name: 'Ghost Process', tier: 'gatekeeper', archetypes: ['root'], minLayer: 1, loadout: [pool('cron-job'), pool('full-system-compromise'), pool('dns-poisoning'), pool('watchdog-timer')], passiveIds: ['digital-ghost'], magnitudeScaler: 1.0 },
  // Layer 2 -- internal LAN
  { id: 'incident-response', name: 'Incident Response', tier: 'gatekeeper', archetypes: ['exploit'], minLayer: 2, loadout: [pool('supply-chain-compromise'), pool('vulnerability-scan'), pool('zero-day-chain')], passiveIds: ['highest-bidder'], magnitudeScaler: 1.3 },
  { id: 'the-quarantine-ward', name: 'The Quarantine Ward', tier: 'gatekeeper', archetypes: ['malware', 'encryption'], minLayer: 2, loadout: [pool('epidemic'), pool('cold-storage'), pool('slowloris')], passiveIds: ['total-quarantine'], magnitudeScaler: 1.3 },
  { id: 'zero-sum', name: 'Zero-Sum', tier: 'gatekeeper', archetypes: ['root', 'exploit'], minLayer: 2, loadout: [pool('supply-route'), pool('dead-drop'), pool('total-pwnage')], passiveIds: ['primed-to-strike'], magnitudeScaler: 1.3 },
  // Layer 3 -- secured subnet
  { id: 'total-compromise', name: 'Total Compromise', tier: 'gatekeeper', archetypes: ['malware'], minLayer: 3, loadout: [pool('fork-bomb'), pool('ransomware-cascade'), pool('total-compromise')], passiveIds: ['cascading-failure'], magnitudeScaler: 1.6 },
  { id: 'adaptive-threat', name: 'Adaptive Threat', tier: 'gatekeeper', archetypes: ['exploit', 'malware'], minLayer: 3, loadout: [pool('vulnerability-scan'), pool('polymorphic-worm'), pool('spyware')], passiveIds: ['adaptive-defense'], magnitudeScaler: 1.6 },
  { id: 'silent-corruption', name: 'Silent Corruption', tier: 'gatekeeper', archetypes: ['root', 'malware'], minLayer: 3, loadout: [pool('rootkit-deployment'), pool('epidemic'), pool('supply-route')], passiveIds: ['total-corruption'], magnitudeScaler: 1.6 },
  // Layer 4 -- core
  // Session 28 retrofit: air-gap was already dead weight (its reactive
  // trigger needs the caster's own Heat above a threshold, and enemies
  // have no Heat source) on top of the kit's zero-credit problem --
  // swapped for Circuit Breaker (neutral rare), the run's real
  // final-boss layer earning the strongest fix.
  { id: 'null-session', name: 'Null Session', tier: 'gatekeeper', archetypes: ['root', 'encryption'], minLayer: 4, loadout: [pool('cron-job'), pool('full-system-compromise'), pool('zero-trust'), pool('circuit-breaker')], passiveIds: ['null-session-passive'], magnitudeScaler: 1.9 },
  { id: 'kernel-panic', name: 'Kernel Panic', tier: 'gatekeeper', archetypes: ['exploit', 'malware', 'encryption'], minLayer: 4, loadout: [pool('total-pwnage'), pool('epidemic'), pool('cold-storage')], passiveIds: ['redundant-kernel'], magnitudeScaler: 1.9 },
  // Session 28 retrofit: same pure recon/denial trio as its Layer 1
  // echo, Ghost Process -- Watchdog Timer again (deliberate reuse,
  // reinforcing the two enemies' own intentional narrative link).
  { id: 'ghost-in-the-machine', name: 'Ghost in the Machine', tier: 'gatekeeper', archetypes: ['root'], minLayer: 4, loadout: [pool('dns-poisoning'), pool('dead-drop'), pool('intercept'), pool('watchdog-timer')], passiveIds: ['total-access'], magnitudeScaler: 1.9 },
];

/** Every enemy eligible for `tier` at `layerIndex` -- a floor for
 * regular/elite (minLayer <= layerIndex, stays eligible afterward), an
 * exact match for gatekeeper (one fixed stable per layer). */
export function eligibleEnemies(tier: EnemyTier, layerIndex: number): EnemyDefinition[] {
  if (tier === 'gatekeeper') return ENEMY_ROSTER.filter((e) => e.tier === 'gatekeeper' && e.minLayer === layerIndex);
  return ENEMY_ROSTER.filter((e) => e.tier === tier && e.minLayer <= layerIndex);
}

// DESIGN.md's opener rule: "the first 1-3 combats of the run, full
// stop" -- a run-order counter, not a layer/node-position rule (layer 1
// is free-roam, so "the first node" isn't well-defined by position).
// Overrides tier/layer selection for regular AND elite nodes alike (an
// Elite node hit as the run's 2nd fight still resolves as an easy
// opener) -- gatekeepers are never affected, since they're already
// fixed per-layer bosses assigned at map-gen time, and overriding one
// would contradict that fixed-identity design. TBD/playtesting, same as
// every other numeric placeholder in this project.
const OPENER_FIGHT_WINDOW = 3;
const OPENER_LAYER = 1;

function isOpenerWindow(fightsResolved: number): boolean {
  return fightsResolved < OPENER_FIGHT_WINDOW;
}

/** Picks a Regular or Elite enemy for a real encounter -- random per
 * encounter (session 27: "many nodes share these tiers... re-rolled
 * variety across a run is desirable"), restricted to the easiest
 * Regular identities during the run's opener window regardless of the
 * node's actual tier. Gatekeeper selection is a separate function
 * (assignGatekeeperEnemy) since it's fixed at map-gen time instead. */
export function pickRegularOrEliteEnemy(tier: 'regular' | 'elite', layerIndex: number, fightsResolved: number, rng: Rng): EnemyDefinition {
  const candidates = isOpenerWindow(fightsResolved)
    ? ENEMY_ROSTER.filter((e) => e.tier === 'regular' && e.minLayer === OPENER_LAYER)
    : eligibleEnemies(tier, layerIndex);
  if (candidates.length === 0) throw new Error(`enemies.ts: no eligible ${tier} enemy for layer ${layerIndex}`);
  return candidates[rng.nextInt(candidates.length)];
}

/** Assigns a random member of layer `layerIndex`'s gatekeeper stable to
 * that layer's (sole) gatekeeper node, once, at layer-generation time --
 * stable for the run. Called from run.ts right after generateLayer,
 * keeping map-gen.ts itself content-agnostic (its own "pure topology"
 * scope). */
export function assignGatekeeperEnemy(graph: LayerGraph, layerIndex: number, rng: Rng): LayerGraph {
  const stable = eligibleEnemies('gatekeeper', layerIndex);
  if (stable.length === 0) throw new Error(`enemies.ts: no gatekeeper stable defined for layer ${layerIndex}`);
  const chosen = stable[rng.nextInt(stable.length)];
  const nodes = graph.nodes.map((n) => (n.id === graph.gatekeeperNodeId ? { ...n, assignedEnemyId: chosen.id } : n));
  return { ...graph, nodes };
}

/** Resolves a gatekeeper node's pre-assigned identity back into its
 * EnemyDefinition -- throws if the node has no assignment (every
 * gatekeeperFight node must have gone through assignGatekeeperEnemy at
 * generation time) or the id doesn't match anything in the roster. */
export function gatekeeperEnemyForNode(node: MapNode): EnemyDefinition {
  const found = ENEMY_ROSTER.find((e) => e.id === node.assignedEnemyId);
  if (!found) throw new Error(`enemies.ts: gatekeeper node "${node.id}" has no valid assignedEnemyId ("${node.assignedEnemyId}")`);
  return found;
}

// Skill-dial formula (DESIGN.md: "tier is the primary axis, layer is a
// secondary modifier" -- resolves the session 26 banked fight-kind-vs-
// layer question). All TBD/playtesting.
const TIER_SKILL_BASE: Record<EnemyTier, number> = { regular: 0.15, elite: 0.5, gatekeeper: 0.75 };
const LAYER_SKILL_STEP = 0.03; // modest climb across layers 1-4 within a tier
const OPENER_SKILL = 0; // the opener window pins skill to the floor regardless of tier/layer

/** The enemy Cribbage-play skill level (0-1, ai.ts's discardSkillStrategy/
 * pegSkillStrategy dial) for a fight at `tier`/`layerIndex`. */
export function enemySkill(tier: EnemyTier, layerIndex: number, fightsResolved: number): number {
  if (isOpenerWindow(fightsResolved)) return OPENER_SKILL;
  return Math.min(1, TIER_SKILL_BASE[tier] + LAYER_SKILL_STEP * (layerIndex - 1));
}

// Per-layer magnitude scaler (session 39, gatekeeper-check.ts's own
// finding: layer 1 was measurably harder than layer 4 across every
// class once real acquired power was accounted for -- nothing in the
// engine scaled enemy payload magnitude by layer at all, only Cribbage
// skill did, via a much smaller step). Regular/elite reuse this one
// shared formula, computed live per encounter, since the same identity
// can legitimately appear at several different layers (eligibleEnemies'
// floor rule) -- a stored per-identity value wouldn't make sense the way
// it does for gatekeepers (EnemyDefinition.magnitudeScaler above).
// Tier-agnostic, unlike enemySkill's own tier-primary formula --
// regular/elite already differ in base difficulty via kit size/passive
// count, so this doesn't also need a tier split on top. Same
// 0.3-per-layer step gatekeepers were seeded from (bumped from an
// initial 0.15 -- gatekeeper-check.ts showed 0.15 narrowed the
// layer-1-hardest gap but didn't close it). TBD/playtesting.
const REGULAR_ELITE_MAGNITUDE_STEP = 0.3;
const OPENER_MAGNITUDE_SCALER = 1; // the opener window pins this to no scaling too, same as skill

function enemyMagnitudeScaler(layerIndex: number, fightsResolved: number): number {
  if (isOpenerWindow(fightsResolved)) return OPENER_MAGNITUDE_SCALER;
  return 1 + REGULAR_ELITE_MAGNITUDE_STEP * (layerIndex - 1);
}

/** The real magnitude scaler for any enemy encounter, regardless of
 * tier -- gatekeepers read their own stored, individually tunable
 * `magnitudeScaler` (defaulting to 1, no scaling, if somehow unset);
 * regular/elite compute theirs live via enemyMagnitudeScaler above. One
 * call site for encounters.ts/gatekeeper-check.ts to use either way. */
export function magnitudeScalerFor(enemy: EnemyDefinition, layerIndex: number, fightsResolved: number): number {
  if (enemy.tier === 'gatekeeper') return enemy.magnitudeScaler ?? 1;
  return enemyMagnitudeScaler(layerIndex, fightsResolved);
}

/** Applies `multiplier` to every piece of `loadout` via
 * merge.ts's scaledPayloadMagnitude -- a payload with no magnitude field
 * (Ward/Cleanse/Cribbage-Layer Manipulation) is left unscaled, same
 * "magnitude only, not trigger ease" scope as this session's own ask
 * (unlike Merge's own upgradedDefinition, which falls back to easing the
 * trigger condition -- deliberately not mirrored here, since making an
 * enemy's condition easier to trigger is a different kind of change than
 * "hits harder," out of scope for this pass). multiplier of 1 is
 * effectively a no-op (new objects, same values). */
export function scaledEnemyLoadout(loadout: SubroutineDefinition[], multiplier: number): SubroutineDefinition[] {
  if (multiplier === 1) return loadout;
  return loadout.map((piece) => {
    const scaledPayload = scaledPayloadMagnitude(piece.payload, multiplier);
    return scaledPayload ? { ...piece, payload: scaledPayload } : piece;
  });
}
