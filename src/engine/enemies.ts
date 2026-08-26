import type { Archetype, SubroutineDefinition } from './subroutine-types';
import { ALL_POOL_SUBROUTINES } from './subroutines';
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
  archetypes: Archetype[];
  /** The layer (1-4) this identity starts appearing at -- it stays in
   * its tier's pool at every layer afterward, not just this one. */
  minLayer: number;
  loadout: SubroutineDefinition[];
  /** 0-2 entries -- most enemies carry exactly one, a few Elites carry
   * two (session 27's "1-2 real passives" for that tier). */
  passiveIds: EnemyPassiveId[];
}

const SUBROUTINE_BY_ID: ReadonlyMap<string, SubroutineDefinition> = new Map(
  ALL_POOL_SUBROUTINES.map((subroutine) => [subroutine.id, subroutine]),
);

/** Looks up a real subroutine from the shared pool catalog by id --
 * throws immediately on a typo/missing id rather than silently shipping
 * a gap in an enemy's kit. Enemies draw straight from this catalog
 * (DESIGN.md: "subroutines can be drawn straight from the player's own
 * catalog... or be fully bespoke to one enemy") -- the session 27 roster
 * draft used only pool pieces, no bespoke subroutine content, so this is
 * the only lookup path checkpoint D needs. */
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
/** Placeholder-only always-firing burst, deliberately NOT drawn from the
 * pool catalog -- every real pool piece uses a conditional trigger
 * (occurrence/accumulator/self-state/enemy-state/chained), so none of
 * them fire reliably enough, on their own, to make a placeholder
 * roster's win/loss outcome a predictable function of magnitude alone
 * (checkpoint C's actual concern: proving selection/eligibility/
 * gatekeeper-assignment/skill-dial wiring, not real kit balance -- that
 * needs the real thematic content, which is checkpoint D's job, plus a
 * real rebalancing sweep in checkpoint E). Mirrors the pre-checkpoint-C
 * `burstSubroutine` this file's predecessor used in encounters.ts. */
function alwaysBurst(id: string, amount: number, archetype: Archetype = 'exploit'): SubroutineDefinition {
  return { id, name: id, archetype, trigger: { kind: 'always' }, payload: { kind: 'directBurst', amount }, tags: [] };
}

export const ENEMY_ROSTER: EnemyDefinition[] = [
  // Placeholder regular/elite/gatekeeper entries -- checkpoint D replaces
  // these loadouts with the real thematic kits from DESIGN.md's "The
  // Roster" (real ids/names/tiers/archetypes/passiveIds are already
  // final; only the always-firing placeholder loadout itself changes).
  { id: 'script-kiddie', name: 'Script Kiddie', tier: 'regular', archetypes: ['exploit'], minLayer: 1, loadout: [alwaysBurst('placeholder-script-kiddie', 5)], passiveIds: ['lucky-guess'] },
  { id: 'legacy-firewall', name: 'Legacy Firewall', tier: 'regular', archetypes: ['encryption'], minLayer: 1, loadout: [alwaysBurst('placeholder-legacy-firewall', 5, 'encryption')], passiveIds: ['stubborn-default'] },
  { id: 'hardened-workstation', name: 'Hardened Workstation', tier: 'regular', archetypes: ['malware', 'encryption'], minLayer: 3, loadout: [alwaysBurst('placeholder-hardened-workstation', 6, 'malware')], passiveIds: ['grinds-you-down'] },
  { id: 'zero-day-broker', name: 'Zero-Day Broker', tier: 'elite', archetypes: ['exploit'], minLayer: 2, loadout: [alwaysBurst('placeholder-zero-day-broker', 10)], passiveIds: ['fresh-exploit'] },
  { id: 'backchannel-handler', name: 'Backchannel Handler', tier: 'elite', archetypes: ['root'], minLayer: 3, loadout: [alwaysBurst('placeholder-backchannel-handler', 10, 'root')], passiveIds: ['dead-drop-protocol', 'off-the-grid'] },
  { id: 'the-concierge', name: 'The Concierge', tier: 'gatekeeper', archetypes: ['exploit', 'encryption'], minLayer: 1, loadout: [alwaysBurst('placeholder-the-concierge', 11)], passiveIds: ['reception-protocol'] },
  { id: 'firewall-prime', name: 'Firewall Prime', tier: 'gatekeeper', archetypes: ['encryption'], minLayer: 1, loadout: [alwaysBurst('placeholder-firewall-prime', 11, 'encryption')], passiveIds: ['no-way-in'] },
  { id: 'ghost-process', name: 'Ghost Process', tier: 'gatekeeper', archetypes: ['root'], minLayer: 1, loadout: [alwaysBurst('placeholder-ghost-process', 11, 'root')], passiveIds: ['digital-ghost'] },
  { id: 'incident-response', name: 'Incident Response', tier: 'gatekeeper', archetypes: ['exploit'], minLayer: 2, loadout: [alwaysBurst('placeholder-incident-response', 11)], passiveIds: ['highest-bidder'] },
  // Placeholder layer 3/4 gatekeepers -- checkpoint D adds the real 2-4
  // per layer; one each keeps run.ts's full 4-layer traversal exercisable
  // until then (gatekeeper eligibility is an exact per-layer match, not
  // a floor, unlike regular/elite).
  { id: 'total-compromise', name: 'Total Compromise', tier: 'gatekeeper', archetypes: ['malware'], minLayer: 3, loadout: [alwaysBurst('placeholder-total-compromise', 11, 'malware')], passiveIds: ['cascading-failure'] },
  { id: 'null-session', name: 'Null Session', tier: 'gatekeeper', archetypes: ['root', 'encryption'], minLayer: 4, loadout: [alwaysBurst('placeholder-null-session', 11, 'root')], passiveIds: ['null-session-passive'] },
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
