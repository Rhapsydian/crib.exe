import type { DiagnosticEnemyId } from './diagnostic-enemies';
import { scaledDefinition, type Archetype, type SubroutineDefinition } from './subroutine-types';
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

/** One id per enemy in the roster. Session 51 deleted the session 27
 * roster -- its kits were built from the scrapped subroutine pool -- and
 * replaced it with a SKELETON roster (A11), which stands in until the
 * roster is re-authored against the pillar calibration (run-economy
 * D10). The old roster is archived in docs/design-history.md.
 *
 * Diagnostic pillar ids are part of EnemyId so fixtures type-check
 * everywhere a real enemy does, while staying absent from ENEMY_ROSTER --
 * which is what actually makes them unreachable (every selection path
 * filters that array). Type-only import, so there is no runtime cycle
 * with diagnostic-enemies.ts. */
export type EnemyId =
  | DiagnosticEnemyId
  // Regular
  | 'skeleton-crawler'
  | 'skeleton-watchdog'
  | 'skeleton-relay'
  | 'skeleton-tarpit'
  // Elite
  | 'skeleton-hunter'
  | 'skeleton-sentinel'
  // Gatekeepers, one per layer
  | 'skeleton-gate-1'
  | 'skeleton-gate-2'
  | 'skeleton-gate-3'
  | 'skeleton-gate-4';

/** Enemy passive ids. Empty since session 51: all 34 named passives
 * belonged to the deleted roster, and the skeleton roster carries none.
 * The registry machinery (resolve.ts) survives for the rebuilt roster;
 * new passive ids get added here when it is authored. */
export type EnemyPassiveId = never;

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
  /** Per-side threshold overrides (session 40 plumbing; first real value
   * authored the same session, continued as the balance pass),
   * gatekeeper-only -- same reasoning as magnitudeScaler above:
   * gatekeepers never repeat across layers, so a stored per-identity
   * value is meaningful in a way it wouldn't be for regular/elite (which
   * always read the flat GAUGE_THRESHOLD/WIN_THRESHOLD constants
   * instead, see gaugeThresholdFor/winThresholdFor below). Undefined
   * (falls back to the flat constant) for most gatekeepers still -- the
   * balance pass this plumbing was built for is ongoing, one layer at a
   * time. */
  winThreshold?: number;
  /**
   * Per-gatekeeper tempo dial (session 48) -- multiplies the flat
   * GAUGE_THRESHOLD to set how often this enemy gets a turn. Replaces
   * session 40's `gaugeThreshold` absolute override, which no gatekeeper
   * ever actually used: a stored absolute would pin a number that stops
   * tracking the base the moment GAUGE_THRESHOLD moves, reintroducing
   * exactly the units problem this session exists to fix. A multiplier
   * tracks it. (`winThreshold` above stays absolute -- Null Session's 65
   * is a real authored value, and the win gauge isn't denominated in
   * anything that moves.)
   *
   * **Polarity is the inverse of magnitudeScaler's** -- this scales the
   * *threshold*, and a lower threshold means more turns. So < 1 makes an
   * enemy faster and more dangerous; > 1 slows it down. 1 (or undefined)
   * is no change.
   *
   * Gatekeeper-only, same reasoning as magnitudeScaler: gatekeepers never
   * repeat across layers, so a stored per-identity value is meaningful in
   * a way it wouldn't be for regular/elite.
   *
   * BACKLOG.md's "Turn economy has no tuning dial" is what this closes:
   * every prior tuning tool in the project targeted *damage*, so a tempo
   * outlier could only be fixed by rewriting content. Note the measured
   * limit, though -- this only moves output for an enemy whose firing is
   * actually *turn-bound*. It will not move a readiness-bound kit
   * (Adaptive Threat fires 2.3 times a fight at any threshold, because
   * its whole loadout chains off a flush) and it will not fix the
   * Quarantine Ward, whose total-quarantine nudge rides DoT/HoT ticks
   * and so scales with fight *length* rather than turn count.
   */
  gaugeThresholdScaler?: number;
}

const SUBROUTINE_BY_ID: ReadonlyMap<string, SubroutineDefinition> = new Map(
  ALL_POOL_SUBROUTINES.map((subroutine) => [subroutine.id, subroutine]),
);

/** Looks up a pool subroutine by id -- throws immediately on a
 * typo/missing id rather than silently shipping a gap in an enemy's kit.
 * Enemies may also carry bespoke enemy-only pieces (DESIGN.md: "drawn
 * straight from the player's own catalog... or fully bespoke"), but the
 * skeleton roster uses none, so session 51 deleted enemy-subroutines.ts
 * along with the roster it served. */
export function pool(id: string): SubroutineDefinition {
  const found = SUBROUTINE_BY_ID.get(id);
  if (!found) throw new Error(`enemies.ts: no pool subroutine with id "${id}"`);
  return found;
}

/**
 * The SKELETON roster (session 51, A11). Not content: it exists so full
 * runs keep their regular, elite and gatekeeper fights while the real
 * roster waits on the pillar calibration. Calibration's controlled
 * background is still the synthetic gatekeeper (`gatekeeperOverrides`),
 * not this roster.
 *
 * Shape follows the tier-authoring split (DESIGN.md Enemy Design): one
 * regular per archetype, two elites, one gatekeeper per layer, each a
 * pairing of skeleton pool pieces with a credit path (the standing
 * "every enemy can credit its own gauge" rule) and no passive.
 * Gatekeeper magnitudeScaler is seeded from the same 0.3-per-layer step
 * regular/elite scaling uses, not tuned.
 *
 * `minLayer` means two different things depending on tier: for
 * regular/elite it's a floor (starts appearing at this layer, stays in
 * the pool afterward); for gatekeeper it's the exact layer that enemy's
 * stable belongs to.
 */
export const ENEMY_ROSTER: EnemyDefinition[] = [
  // --- Regular -- one per archetype ---
  { id: 'skeleton-crawler', name: 'Crawler', tier: 'regular', archetypes: ['exploit'], minLayer: 1, loadout: [pool('probe'), pool('port-knock')], passiveIds: [] },
  { id: 'skeleton-watchdog', name: 'Watchdog', tier: 'regular', archetypes: ['daemon'], minLayer: 1, loadout: [pool('cron-job'), pool('self-repair')], passiveIds: [] },
  { id: 'skeleton-relay', name: 'Relay Node', tier: 'regular', archetypes: ['overclock'], minLayer: 1, loadout: [pool('burst-clock'), pool('voltage-boost')], passiveIds: [] },
  { id: 'skeleton-tarpit', name: 'Tarpit Host', tier: 'regular', archetypes: ['honeypot'], minLayer: 1, loadout: [pool('lure'), pool('tarpit')], passiveIds: [] },
  // --- Elite ---
  { id: 'skeleton-hunter', name: 'Hunter Process', tier: 'elite', archetypes: ['exploit', 'overclock'], minLayer: 1, loadout: [pool('probe'), pool('burst-clock'), pool('turbo')], passiveIds: [] },
  { id: 'skeleton-sentinel', name: 'Sentinel', tier: 'elite', archetypes: ['daemon', 'honeypot'], minLayer: 1, loadout: [pool('cron-job'), pool('lure'), pool('sinkhole')], passiveIds: [] },
  // --- Gatekeepers, one per layer ---
  { id: 'skeleton-gate-1', name: 'Perimeter Gate', tier: 'gatekeeper', archetypes: ['exploit', 'daemon'], minLayer: 1, loadout: [pool('probe'), pool('cron-job'), pool('port-knock'), pool('respawn')], passiveIds: [], magnitudeScaler: 1 },
  { id: 'skeleton-gate-2', name: 'LAN Gate', tier: 'gatekeeper', archetypes: ['overclock', 'honeypot'], minLayer: 2, loadout: [pool('burst-clock'), pool('lure'), pool('turbo'), pool('sinkhole')], passiveIds: [], magnitudeScaler: 1.3 },
  { id: 'skeleton-gate-3', name: 'Subnet Gate', tier: 'gatekeeper', archetypes: ['exploit', 'honeypot'], minLayer: 3, loadout: [pool('probe'), pool('lure'), pool('packet-sniffer'), pool('mirror-port')], passiveIds: [], magnitudeScaler: 1.6 },
  { id: 'skeleton-gate-4', name: 'Core Gate', tier: 'gatekeeper', archetypes: ['daemon', 'overclock'], minLayer: 4, loadout: [pool('cron-job'), pool('burst-clock'), pool('rollback'), pool('pipeline')], passiveIds: [], magnitudeScaler: 1.9 },
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
// Exported so diagnostics can segregate opener fights instead of
// hardcoding the number -- same single-source-of-truth reasoning as
// GAUGE_THRESHOLD's own export (session 39). Session 50: an
// opener-window fight uses a REGULAR enemy whatever the node's tier is,
// so a diagnostic that keys on node tier silently counts easy regulars
// as elites (23% of them, measured).
export const OPENER_FIGHT_WINDOW = 3;
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
/** `excludedIds` (session 39): lets a diagnostic ablate one or more
 * gatekeepers from selection entirely -- e.g. "what does the funnel look
 * like with Firewall Prime never assigned anywhere," to isolate whether
 * a specific gatekeeper is an outlier. Undefined/empty changes nothing
 * (every existing caller). Throws the same way as an empty natural stable
 * if excluding narrows a layer's pool to nothing. The skeleton roster
 * (session 51) has ONE gatekeeper per layer, so excluding it does exactly
 * that -- ablation is meaningless until the real roster is rebuilt, and
 * the loud failure is the right outcome meanwhile. Use the synthetic
 * gatekeeper for controlled measurement instead. */
export function assignGatekeeperEnemy(graph: LayerGraph, layerIndex: number, rng: Rng, excludedIds?: EnemyId[]): LayerGraph {
  const stable = eligibleEnemies('gatekeeper', layerIndex).filter((e) => !excludedIds?.includes(e.id));
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

/** Per-side threshold accessors (session 40) -- the real initiative/
 * winThreshold for any enemy encounter, gatekeeper or not. Mirrors
 * magnitudeScalerFor's own shape, with one difference: there's no
 * universal "no override" constant the way magnitude has `1`, since the
 * flat values (GAUGE_THRESHOLD/WIN_THRESHOLD) live in encounters.ts,
 * which already imports from this file -- `flatDefault` is passed in by
 * the caller instead of imported here, to avoid a circular import.
 * Regular/elite always return flatDefault unchanged -- no per-layer
 * formula the way magnitude gets one (a real, separate future balance
 * question, out of scope for this plumbing-only session). */
export function gaugeThresholdFor(enemy: EnemyDefinition, _layerIndex: number, _fightsResolved: number, flatDefault: number): number {
  // Session 48: multiplicative (gaugeThresholdScaler) rather than the
  // absolute override this used to read, so a tuned gatekeeper keeps
  // tracking GAUGE_THRESHOLD instead of pinning a number that silently
  // stops meaning the same thing when the base moves. Rounded, and
  // floored at 1 for gauges.ts's addPoints loop guard -- a scaler small
  // enough to round to 0 would hang the engine.
  if (enemy.tier === 'gatekeeper') return Math.max(1, Math.round(flatDefault * (enemy.gaugeThresholdScaler ?? 1)));
  return flatDefault;
}

export function winThresholdFor(enemy: EnemyDefinition, _layerIndex: number, _fightsResolved: number, flatDefault: number): number {
  if (enemy.tier === 'gatekeeper') return enemy.winThreshold ?? flatDefault;
  return flatDefault;
}

/** Applies `multiplier` to every magnitude in `loadout` -- alpha,
 * growth and beta (subroutine-types.ts's scaledDefinition). Magnitude
 * only: nothing about *when* a beta applies is changed. A multiplier of 1
 * is a no-op. */
export function scaledEnemyLoadout(loadout: SubroutineDefinition[], multiplier: number): SubroutineDefinition[] {
  if (multiplier === 1) return loadout;
  return loadout.map((piece) => scaledDefinition(piece, multiplier));
}
