import { createRng } from './rng';
import { isReachable, neighborsOf, type LayerGraph, type MapNode, type NodeType, type RunPosition } from './map-types';
import { generateLayer, LAYER_SIZES, type LayerNumber } from './map-gen';
import { assignGatekeeperEnemy, eligibleEnemies, enemySkill, gatekeeperEnemyForNode, type EnemyDefinition, type EnemyId } from './enemies';
import { traceEvasion } from './evasion';
import { move } from './traversal';
import { resolveEncounterRequests, alwaysFirstEventChoice, type EncounterOutcome, type EventChoiceStrategy, type SyntheticGatekeeper } from './encounters';
import { ask, driveWithFallbacks, type MoveAnswer, type RunRequest } from './run-requests';
import { addHeat, currentHeatCeiling, layerHeatAllowance, postedFightRisk, HEAT_PER_MOVE, HEAT_HIGH_FRACTION, HEAT_LOW_FRACTION } from './heat';
import { CLASS_DEFINITIONS, DEFAULT_CLASS_ID, type ClassId } from './classes';
import type { SubroutineDefinition } from './subroutine-types';
import { ALL_SUBROUTINES } from './subroutines';
import { applySecurity, applyUpgrades, type MetaBonuses, type RunSetup, type SecurityRules } from './meta';
import { applyDailyStart, dailyMapOptions, rollDaily, type DailyEffects } from './daily';
import {
  acquireSubroutine,
  alwaysAcquireFirst,
  installGrantedSubroutine,
  keepAcquisitionOrder,
  slotCapOf,
  BENCH_CAP,
  dropFromBench,
  arrangeLoadout,
  replaceInstalledWithNewest,
  weakestOnBench,
  type AcquisitionStrategy,
  type ReorderStrategy,
  type SubroutineAcquirer,
} from './loadout';
import {
  mergeEverything,
  pickMergeTarget,
  preferMergeWhenAvailable,
  MATERIAL_HIGH_THRESHOLD,
  type MergeTargetStrategy,
  type SafehouseStrategy,
} from './merge';
import {
  buyCheapestAffordable,
  rerollIfNothingAffordable,
  DATA_HIGH_THRESHOLD,
  DATA_LOW_THRESHOLD,
  buyCheapestAffordableMod,
  rerollModIfNothingAffordable,
  buyCheapestAffordableBurner,
  rerollBurnerIfNothingAffordable,
  neverActivateShopBurner,
  type ShopStrategy,
  type ShopRerollStrategy,
  type ModShopStrategy,
  type ModShopRerollStrategy,
  type ShopBurnerStrategy,
  type BurnerShopStrategy,
  type BurnerShopRerollStrategy,
  subroutineSellPrice,
  burnerSellPrice,
} from './shop';
import type { DiscardStrategy } from './deal';
import type { PlayStrategy } from './pegging';
import type { ModDefinition, ModId } from './mod-types';
import {
  MOD_DEFINITIONS,
  GHOST_CREDENTIALS_FIGHT_HEAT,
  applyOnMoveMods,
  applyQuietHoursMod,
  applyOnSubroutineAcquiredMods,
  applyOnModAcquiredMods,
  alwaysAcquireFirstMod,
  type ModAcquisitionStrategy,
} from './mods';
import type { BurnerDefinition, BurnerId } from './burner-types';
import { BURNER_DEFINITIONS, alwaysAcquireFirstBurner, burnerCapOf, type BurnerAcquisitionStrategy } from './burners';
import type { BurnerActivationStrategy } from './combat';

/**
 * The run orchestrator (session 19/20 checkpoint F): ties layer
 * generation, free-roam traversal, Heat, and real combat resolution
 * together into a full 4-layer run, playable end-to-end by script with
 * zero UI -- mirroring how Phase 1/2's orchestrators were driven by
 * legal-not-good scripted players.
 */

// Milestone 3 (M5, the user's call): 10 / 12 / 12 / 14, was 10 / 12 / 12 / 8.
const DEFAULT_LAYER_NODE_COUNTS: [number, number, number, number] = LAYER_SIZES;

/** The player's own state for the run, threaded into every encounter
 * (Phase 4 checkpoint A). `data` (checkpoint C) accumulates Data awarded
 * from combat wins. `bench` (checkpoint D, loadout.ts) holds owned-but-
 * uninstalled pieces -- only `installedLoadout` is evaluated each
 * fight. `material`/`rank` (checkpoint E, merge.ts) track banked
 * duplicate material and current Merge rank, both keyed by subroutine
 * id -- acquiring an already-owned id banks material instead of adding
 * a second copy. `ownedModIds`/`grantedByMod`/`maxHeatBonus`/
 * `modRunState` (Phase 5 Mods checkpoints B/E/F) track every Mod owned
 * this run (beyond the class's own guaranteed starting one -- see
 * resolve.ts's createCombatState), which installedLoadout subroutine
 * (if any) was granted by which Mod, any permanent max-Heat raise
 * (Backup Generator), and generic one-shot/counter scratch bookkeeping
 * for run-scoped Mods (mirrors resolve.ts's per-combat passiveState). */
export interface RunPlayerState {
  classId: ClassId;
  installedLoadout: SubroutineDefinition[];
  data: number;
  bench: SubroutineDefinition[];
  material: Record<string, number>;
  rank: Record<string, number>;
  ownedModIds: ModId[];
  grantedByMod: Record<string, string>;
  maxHeatBonus: number;
  /** The current layer's Heat allowance, Backup Generator bonus included
   * (heat.ts's layerHeatAllowance) -- recorded by playRun at each layer
   * start and after each encounter, so strategies that only see the
   * player state can plan against the live ceiling. Absent outside a run;
   * heat.ts's currentHeatCeiling falls back to layer 1's. */
  heatAllowance?: number;
  /** The run's Heat as an encounter starts (session 63): recorded beside
   * heatAllowance so a fight's screen can show Heat and what a win would
   * cost. Read-only for display; the run's own `heat` is the truth. */
  heat?: number;
  modRunState: Record<string, number>;
  /** The class Mod is upgraded to its "II" version (session 65,
   * docs/mods-design.md M10): its rule plus a second clause. Set by an
   * Event; permanent. */
  classModUpgraded?: boolean;
  /** Events met this run (session 65, the user's rule): an Event never
   * comes up twice in a run. */
  seenEventIds?: string[];
  /** Every Burner currently carried this run (Phase 5 Burners checkpoint
   * B) -- a capped, unordered inventory, no bench/installed split (see
   * burner-types.ts's own header). Duplicates are allowed to stack
   * (unlike ownedModIds' uniqueness), since a Burner is a consumable
   * item, not a permanent passive. */
  carriedBurnerIds: BurnerId[];
  /** Map Burners in effect (session 64, BE4): free moves left, a cut to
   * the next fight's Heat and to the next gatekeeper's Heat toll, and a
   * Tunnel waiting for the next Shop or Safehouse. Absent when none. */
  mapEffects?: MapEffects;
  /**
   * Meta-progression sockets for the three combat thresholds (session
   * 48). All optional and all unset today -- there is no
   * meta-progression system yet. They exist so that when there is one,
   * it has somewhere to write, instead of encounters.ts hardcoding the
   * flat constants at the call site the way it did before.
   *
   * The first two are the player's own numbers and are absolute
   * overrides: nothing else authors a per-encounter value for them, so
   * there is nothing for an override to erase.
   *
   * `containmentThresholdScaler` is deliberately a *multiplier* rather
   * than an override, because the quantity it modifies is not the
   * player's -- it is the enemy's own Containment bar, which gatekeepers
   * already author individually (EnemyDefinition.winThreshold; Null
   * Session's 65). An absolute player-side override would flatten that
   * identity to a single number for every enemy in the game. A scaler
   * composes with it: "every enemy needs 20% more Containment to beat
   * me" stays true whether the enemy is a regular at 50 or Null Session
   * at 65.
   */
  initiativeThreshold?: number;
  breachThreshold?: number;
  containmentThresholdScaler?: number;
  /** The rest of the profile's upgrades in this run (session 71, MP7):
   * fight and rest Heat, Shop prices, archetype Process, the Burner and
   * subroutine caps. Absent without upgrades. */
  meta?: MetaBonuses;
  /** The run's Security Level rules (session 71, MP13-MP14). Absent at
   * level 0. */
  security?: SecurityRules;
  /** A Daily Run's Advisory effects (session 72, DR3). */
  daily?: DailyEffects;
}


/** Map Burners in effect (RunPlayerState.mapEffects). */
export interface MapEffects {
  freeMoves: number;
  /** Multiplies the next fights' Heat, win or lose (Proxy Chain), for
   * `nextFightHeatFights` more fights. */
  nextFightHeat?: number;
  nextFightHeatFights?: number;
  /** Multiplies the next gatekeeper's Heat toll on a win (Spoofed
   * Credentials 0.5, Golden Ticket 0). */
  nextGatekeeperToll?: number;
  /** The next Shop or Safehouse moved onto is passed through (Tunnel). */
  tunnel?: boolean;
}

export function createInitialPlayerState(classId: ClassId): RunPlayerState {
  return {
    classId,
    installedLoadout: CLASS_DEFINITIONS[classId].startingLoadout,
    data: 0,
    bench: [],
    material: {},
    rank: {},
    ownedModIds: [CLASS_DEFINITIONS[classId].startingPassiveId],
    grantedByMod: {},
    maxHeatBonus: 0,
    modRunState: {},
    carriedBurnerIds: [],
  };
}

/** Finalizes a Mod acquisition (reward pick or Shop purchase alike) --
 * Phase 5 Mods checkpoints E/F: records ownership, runs onModAcquired
 * (Backup Generator's max-Heat raise), and inserts a granted-subroutine
 * Mod's own piece (Auxiliary Process) into installedLoadout, cap-exempt
 * and removal-locked. The uniqueness guard is defensive -- every Mod
 * pool draw already excludes owned ids (mods.ts's modPoolForClass), so
 * this should never actually trigger against real content. */
function acquireMod(playerState: RunPlayerState, mod: ModDefinition): RunPlayerState {
  if (playerState.ownedModIds.includes(mod.id)) return playerState;
  let state: RunPlayerState = { ...playerState, ownedModIds: [...playerState.ownedModIds, mod.id] };
  state = applyOnModAcquiredMods(state, mod.id);
  if (mod.grantedSubroutine) state = installGrantedSubroutine(state, mod.grantedSubroutine, mod.id);
  return state;
}

/** Finalizes a Burner acquisition (reward pick, Shop purchase, or a
 * future Event grant alike) -- Phase 5 Burners checkpoint B, mirroring
 * acquireMod's real shape/location above (not burners.ts -- see
 * burner-types.ts's own header). Declines (no-op) once BURNER_CAP is
 * reached; acquireBurnerAsking below asks which Burner to swap out
 * instead (a hard cap, no owned-but-not-carried state). Unlike acquireMod,
 * duplicates aren't deduplicated -- a Burner is a consumable item, not a
 * unique permanent passive, so carrying two of the same one is legal. */
function acquireBurner(playerState: RunPlayerState, burner: BurnerDefinition): RunPlayerState {
  if (playerState.carriedBurnerIds.length >= burnerCapOf(playerState)) return playerState;
  return { ...playerState, carriedBurnerIds: [...playerState.carriedBurnerIds, burner.id] };
}

/** acquireBurner, but at the carry cap asks which carried Burner to swap
 * out for the new one (null keeps them all and leaves the new one, which
 * is also the simulated player's answer -- so simulations are unchanged). */
export function* acquireBurnerAsking(playerState: RunPlayerState, burner: BurnerDefinition): Generator<RunRequest, RunPlayerState, unknown> {
  if (playerState.carriedBurnerIds.length < burnerCapOf(playerState)) return acquireBurner(playerState, burner);
  const out = yield* ask({ kind: 'burnerSwap', incoming: burner, playerState, fallback: (): BurnerId | null => null });
  if (!out || !playerState.carriedBurnerIds.includes(out)) return playerState;
  return acquireBurner(removeOneCarriedBurner(playerState, out), burner);
}

/** Removes exactly one instance of `burnerId` from carriedBurnerIds --
 * duplicates aren't deduplicated (checkpoint B), so this only ever
 * consumes the one copy actually used, same one-for-one bookkeeping
 * combat.ts's own remainingBurnerIds helper uses. */
function removeOneCarriedBurner(playerState: RunPlayerState, burnerId: BurnerId): RunPlayerState {
  const remaining = [...playerState.carriedBurnerIds];
  const index = remaining.indexOf(burnerId);
  if (index !== -1) remaining.splice(index, 1);
  return { ...playerState, carriedBurnerIds: remaining };
}

/**
 * How a run ends. `breachedThenCaught` (session 52, R8): the layer's
 * gatekeeper was beaten, but its toll -- charged after the fight -- took
 * Heat over the layer's allowance. Distinct from `quarantined` (gatekeeper
 * lost) and `heatMaxed` (caught mid-layer); counted as a breach
 * (layersCompleted includes that layer). Future meta-progression is meant
 * to credit it -- "rep for how deep you got" -- below a full continue.
 */
export type RunOutcome = 'heatMaxed' | 'quarantined' | 'noRouteRemains' | 'breachedThenCaught' | 'victory';

export type RunEvent =
  | { type: 'layerGenerated'; layerIndex: number; nodeCount: number }
  | { type: 'move'; layerIndex: number; from: string; to: string; heatCost: number; heatAfter: number }
  | { type: 'mapBurnerActivated'; layerIndex: number; burnerId: BurnerId; targetNodeId?: string }
  | { type: 'encounter'; layerIndex: number; nodeId: string; nodeType: NodeType; outcome: EncounterOutcome; heatAfter: number }
  | { type: 'layerCleared'; layerIndex: number }
  /** A trace evasion (session 63): its head start, the final scores and
   * whether you slipped away. */
  | { type: 'evasion'; layerIndex: number; headStart: number; finalScores: [number, number]; escaped: boolean }
  | { type: 'runEnded'; outcome: RunOutcome };

/** Gross totals over a run (session 72, the daily score): Data earned
 * and spent (not the net left over), Merges, Burners used. */
export interface RunTally {
  dataEarned: number;
  dataSpent: number;
  merges: number;
  burnersUsed: number;
}

export interface RunResult {
  outcome: RunOutcome;
  tally?: RunTally;
  layersCompleted: number;
  finalHeat: number;
  log: RunEvent[];
  /** The player's state as of run end -- lets a caller/test confirm
   * which class actually drove the run and inspect its loadout. */
  playerState: RunPlayerState;
}

/** A flat, JSON-friendly view of a finished run's player state --
 * everything a balance query needs about what the run actually ended up
 * holding, and nothing that isn't serializable (SubroutineDefinition
 * carries nested trigger/payload objects that would bloat a JSONL line
 * without adding anything a "which runs had X" query can use).
 *
 * Session 46: added because sweeps recorded outcome and layersCompleted
 * only, so "how many winning runs included subroutine X" wasn't
 * answerable from anything on disk -- it needed a bespoke script every
 * time, which is exactly the throwaway-scratch pattern scripts/sweep.ts
 * itself was written to end.
 *
 * `installed` is ordered, since firing order is a real lever
 * (loadout.ts's reorderInstalled) and session 46's reorder strategy
 * changes it -- so the order here is itself a measurable outcome, not
 * incidental. `rank` records Merge level per id; ids are stable across
 * Merges (mergeSubroutine upgrades in place, preserving id), so a
 * ranked piece still matches a plain "did this run have X" query. */
export interface RunLoadoutSummary {
  installed: string[];
  bench: string[];
  /** Merge rank per subroutine id, omitting unranked (rank-0) pieces. */
  rank: Record<string, number>;
  /** Banked duplicate material per id, omitting zero counts. */
  material: Record<string, number>;
  mods: string[];
  burners: string[];
  /** Which installed ids came from a Mod grant rather than acquisition --
   * they're cap-exempt and removal-locked, so they shouldn't be read as
   * evidence the run chose them. */
  grantedByMod: string[];
}

/** Derives a RunLoadoutSummary from a finished run's player state. Pure
 * and cheap -- callers that don't want it simply don't call it. */
export function summarizeRunLoadout(playerState: RunPlayerState): RunLoadoutSummary {
  const nonZero = (record: Record<string, number>): Record<string, number> =>
    Object.fromEntries(Object.entries(record).filter(([, value]) => value > 0));
  return {
    installed: playerState.installedLoadout.map((piece) => piece.id),
    bench: playerState.bench.map((piece) => piece.id),
    rank: nonZero(playerState.rank),
    material: nonZero(playerState.material),
    mods: [...playerState.ownedModIds],
    burners: [...playerState.carriedBurnerIds],
    grantedByMod: Object.keys(playerState.grantedByMod),
  };
}

/** Decides the next node to move to, given the current layer graph,
 * position, and Heat. Must always return a node in legalMoves(graph,
 * position) -- "legal-not-good," the same contract as Phase 1/2's
 * scripted discard/play strategies. `playerState` is optional -- added
 * for opportunisticTraversal below, which needs to see material/Data
 * alongside Heat; beelineToGatekeeper/exploreThenGatekeeper both ignore
 * it, the same way beelineToGatekeeper already ignores `heat` itself
 * (a function with fewer declared params still satisfies a wider type). */
export type TraversalStrategy = (graph: LayerGraph, position: RunPosition, heat: number, playerState?: RunPlayerState) => string;

/** Rush straight for the gatekeeper by shortest path, ignoring
 * everything else in the layer. */
export const beelineToGatekeeper: TraversalStrategy = (graph, position) => {
  const path = shortestPath(withoutClosedNodes(graph), position.nodeId, graph.gatekeeperNodeId);
  if (path.length < 2) {
    throw new Error('beelineToGatekeeper: no path to the gatekeeper from the current position');
  }
  return path[1];
};

/** Visit every still-unresolved node in the layer (nearest first) before
 * finally heading for the gatekeeper. */
export const exploreThenGatekeeper: TraversalStrategy = (graph, position, heat) => {
  const live = withoutClosedNodes(graph);
  const unresolvedTargets = graph.nodes.filter((n) => n.state === 'unresolved' && n.id !== graph.gatekeeperNodeId);
  for (const target of unresolvedTargets) {
    const path = shortestPath(live, position.nodeId, target.id);
    if (path.length >= 2) return path[1];
  }
  return beelineToGatekeeper(graph, position, heat);
};

// TBD/playtesting -- extra Heat headroom (beyond the raw detour cost)
// opportunisticTraversal insists on keeping in reserve before taking any
// non-fight detour, so exploring never itself strands the player short of
// the gatekeeper. Roughly 2 moves' worth of cushion.
const OPPORTUNISTIC_RESERVE_MARGIN = 2 * HEAT_PER_MOVE;

/** The "middle ground" traversal strategy (session 39, `/decision-session`
 * -- banked since session 35's beeline/explore sweep comparison, which
 * found neither extreme reflects DESIGN.md's own stated ideal: "a middle
 * ground between beelining and fully exploring a layer, managing Heat
 * along the way"). Priority, resolved live one tier at a time:
 *
 * 1. Reachable fight nodes (regular/elite) always win -- direct,
 *    reliable power, no state-dependence. Then a Cache (milestone 3),
 *    a free reward, when its detour fits the reserve.
 * 2. Heat pressure: if current Heat is already high, a reachable
 *    Safehouse outranks everything below (Heat is the run-ending
 *    resource -- relieving it is safety-critical in a way the other
 *    detours below aren't; opportunisticSafehouseStrategy, merge.ts,
 *    carries the same Heat-wins-the-tie call into the Rest-vs-Merge
 *    decision once there).
 * 3. Otherwise, banked material or high Data each pull toward their own
 *    node type (Safehouse->Merge, Shop) -- co-equal tiers, both real
 *    (if less direct than a fight's) power gains the user specifically
 *    corrected this session's first draft to include, rather than
 *    scoping the strategy to fights-only. Nearest reachable candidate
 *    wins if both fire at once.
 * 4. If Heat, material, and Data are *all* low together, an Event is the
 *    one node type left worth a gamble-driven detour.
 * 5. Otherwise: beeline the rest of the way, same fallback
 *    exploreThenGatekeeper already uses.
 *
 * Every detour (any tier above) is additionally gated by a safety
 * reserve: a node is only ever a candidate if reaching it, then taking
 * the shortest remaining path from there to the gatekeeper, keeps total
 * Heat spent under the current layer's allowance with
 * OPPORTUNISTIC_RESERVE_MARGIN to spare -- this strategy never explores
 * its way into a Heat-maxed dead end.
 *
 * Session 52 (per-layer Heat): a detour is priced at what the economy
 * POSTS, not just its moves -- a fight node's worst-case win Heat
 * (heat.ts's postedFightRisk) -- and the reserve also holds the
 * gatekeeper's worst-case toll, charged after that fight (R8). That is
 * the safe end of R8's gamble: this player never banks on a clean
 * gatekeeper fight. A bolder strategy would reserve less. */
export const opportunisticTraversal: TraversalStrategy = (graph, position, heat, playerState) => {
  if (!playerState) return beelineToGatekeeper(graph, position, heat);

  const live = withoutClosedNodes(graph);
  const maxHeat = currentHeatCeiling(playerState);
  const gatekeeperToll = postedFightRisk('gatekeeper', position.layerIndex).worstWin;
  const postedWorstWin = (nodeId: string): number => {
    const type = graph.nodes.find((n) => n.id === nodeId)?.type;
    if (type === 'regularFight') return postedFightRisk('regular', position.layerIndex).worstWin;
    if (type === 'eliteFight') return postedFightRisk('elite', position.layerIndex).worstWin;
    return 0;
  };

  const detourHeatCost = (targetId: string): number | null => {
    const toTarget = shortestPath(live, position.nodeId, targetId);
    if (toTarget.length < 2) return null;
    const toGatekeeper = targetId === graph.gatekeeperNodeId ? [targetId] : shortestPath(live, targetId, graph.gatekeeperNodeId);
    if (toGatekeeper.length === 0) return null;
    return (toTarget.length - 1 + toGatekeeper.length - 1) * HEAT_PER_MOVE + postedWorstWin(targetId) + gatekeeperToll;
  };
  const withinReserve = (targetId: string): boolean => {
    const cost = detourHeatCost(targetId);
    return cost !== null && heat + cost + OPPORTUNISTIC_RESERVE_MARGIN <= maxHeat;
  };
  /** Next hop toward whichever of `nodes` has the shortest path, or null
   * if none are reachable within the safety reserve. */
  const nearestOf = (nodes: MapNode[]): string | null => {
    let best: { nextHop: string; length: number } | null = null;
    for (const node of nodes) {
      if (!withinReserve(node.id)) continue;
      const path = shortestPath(live, position.nodeId, node.id);
      if (path.length >= 2 && (!best || path.length < best.length)) best = { nextHop: path[1], length: path.length };
    }
    return best?.nextHop ?? null;
  };
  const unresolvedOfType = (type: NodeType): MapNode[] => graph.nodes.filter((n) => n.state === 'unresolved' && n.type === type);

  const fightTarget = nearestOf([...unresolvedOfType('regularFight'), ...unresolvedOfType('eliteFight')]);
  if (fightTarget) return fightTarget;

  // A Cache (milestone 3, M8): a free reward whose price is the detour,
  // which the reserve gate above already prices -- so take it when the
  // walk out and back is affordable.
  const cacheTarget = nearestOf(unresolvedOfType('cache'));
  if (cacheTarget) return cacheTarget;

  const heatHigh = heat >= HEAT_HIGH_FRACTION * maxHeat;
  if (heatHigh) {
    const safehouseTarget = nearestOf(unresolvedOfType('safehouse'));
    if (safehouseTarget) return safehouseTarget;
  }

  const totalMaterial = Object.values(playerState.material).reduce((sum, count) => sum + count, 0);
  const materialHigh = totalMaterial >= MATERIAL_HIGH_THRESHOLD;
  const dataHigh = playerState.data >= DATA_HIGH_THRESHOLD;
  if (materialHigh || dataHigh) {
    const candidates = [...(materialHigh ? unresolvedOfType('safehouse') : []), ...(dataHigh ? unresolvedOfType('shop') : [])];
    const target = nearestOf(candidates);
    if (target) return target;
  }

  const heatLow = heat <= HEAT_LOW_FRACTION * maxHeat;
  const materialLow = totalMaterial === 0;
  const dataLow = playerState.data <= DATA_LOW_THRESHOLD;
  if (heatLow && materialLow && dataLow) {
    const eventTarget = nearestOf(unresolvedOfType('event'));
    if (eventTarget) return eventTarget;
  }

  return beelineToGatekeeper(graph, position, heat);
};

/** Context passed to a MapBurnerStrategy for one traversal-loop
 * iteration's decision -- mirrors combat.ts's BurnerActivationContext
 * shape. availableBurnerIds is playerState.carriedBurnerIds filtered to
 * map-context ones (no per-move "already used" bookkeeping needed here,
 * unlike combat -- a used map Burner is removed from carriedBurnerIds
 * immediately, in the same loop iteration, since there's no nested
 * combat round-trip to surface usage back out of). closedNodeIds is the
 * live target list for a reopenClosedNode pick. */
export interface MapBurnerActivationContext {
  graph: LayerGraph;
  position: RunPosition;
  heat: number;
  playerState: RunPlayerState;
  availableBurnerIds: BurnerId[];
  closedNodeIds: string[];
}

/** Picks which (if any) available map-context Burner to activate before
 * this iteration's traversal decision, or null to activate none.
 * `targetNodeId` is only consulted for a reopenClosedNode pick (ignored,
 * not required, for freeMove/revealUpcoming) and must be one of
 * ctx.closedNodeIds -- an id outside that list is treated as null. */
export type MapBurnerStrategy = (ctx: MapBurnerActivationContext) => { burnerId: BurnerId; targetNodeId?: string } | null;

/** Default until a script actually wants to spend a map Burner --
 * mirrors combat.ts's neverActivateBurner. */
export const neverActivateMapBurner: MapBurnerStrategy = () => null;

/** Snapshot passed to onBeforeGatekeeperFight (session 39): the player's
 * real accumulated state at the exact moment a gatekeeper fight is about
 * to resolve -- whatever combat rewards/Shop purchases/Merges/Mods/
 * Burners the run actually picked up getting here, not a bare starting
 * kit. `layerIndex` is 1-based (enemies.ts's own convention) and
 * `fightsResolved` is the run's running fight counter as of this exact
 * fight -- both are exactly what a real resolveFight call would feed
 * enemySkill/strategiesForFight, so a diagnostic script can reproduce
 * the real skill-dial AI this fight would actually use. */
export interface GatekeeperFightContext {
  playerState: RunPlayerState;
  layerIndex: number;
  fightsResolved: number;
  enemy: EnemyDefinition;
}

/** One layer's gatekeeper override (session 49) -- see
 * RunOptions.gatekeeperOverrides. `synthetic` replaces the fight,
 * `pinned` replaces the draw; neither is ever set by real play. */
export type GatekeeperOverride = ({ kind: 'synthetic' } & SyntheticGatekeeper) | { kind: 'pinned'; enemyId: EnemyId };

export interface RunOptions {
  seed: number;
  /** Defaults to Breacher, the designed starting/onboarding class
   * (session 8) -- see classes.ts's DEFAULT_CLASS_ID. */
  classId?: ClassId;
  /** Nodes per layer; also how many layers the run has (a shorter list is
   * a shorter run -- the guided run is one layer, session 63). */
  layerNodeCounts?: readonly number[];
  /** Hand-made layers (session 63, the guided run): where a layer has one
   * here, it replaces the generated map. A gatekeeper node that already
   * names its enemy (`assignedEnemyId`) keeps it. */
  layerGraphs?: readonly (LayerGraph | undefined)[];
  /** The player's opening Data and banked Merge copies, by subroutine id
   * (session 63, the guided run). */
  startingData?: number;
  startingMaterial?: Record<string, number>;
  traversalStrategy?: TraversalStrategy;
  /** Test-only escape hatch: replaces the class's real starting loadout.
   * A real class kit's Breach/Containment convergence time is sharply
   * seed-sensitive (session 20/Phase 4 checkpoint A finding), which
   * makes tests that need a *guaranteed* win or loss unable to rely on
   * natural variance across classId-driven seeds -- same reasoning
   * that led encounters.test.ts to a deliberately lopsided player
   * construction instead of a seed sweep. Never used outside tests. */
  installedLoadoutOverride?: SubroutineDefinition[];
  /** Test-only escape hatch, same treatment as installedLoadoutOverride
   * -- lets a test start a run with a specific set of Mods already
   * owned (beyond the class's own guaranteed starting one), rather than
   * depending on natural elite/gatekeeper reward luck across a seed. */
  ownedModIdsOverride?: ModId[];
  /** Test-only: start the run with the class Mod already upgraded (M10). */
  classModUpgradedOverride?: boolean;
  /** Test-only escape hatch, same treatment as ownedModIdsOverride --
   * lets a test start a run with specific Burners already carried,
   * rather than depending on real acquisition (checkpoint F, not built
   * yet as of checkpoint D). Routed through acquireBurner so BURNER_CAP
   * is still respected. */
  carriedBurnerIdsOverride?: BurnerId[];
  /** Per-traversal-iteration map-context Burner activation (checkpoint
   * D) -- called once per while-loop iteration, before that iteration's
   * traversalStrategy call. Defaults to neverActivateMapBurner. */
  mapBurnerStrategy?: MapBurnerStrategy;
  /** Which (if any) of a won fight's reward options a script acquires --
   * checkpoint D. Defaults to alwaysAcquireFirst (legal-not-good, no
   * rarity/synergy judgment). */
  acquisitionStrategy?: AcquisitionStrategy;
  /** Which (if any) of an elite/gatekeeper win's additive Mod-reward
   * options a script acquires (Phase 5 Mods checkpoint G) -- same
   * legal-not-good default treatment as acquisitionStrategy. */
  modAcquisitionStrategy?: ModAcquisitionStrategy;
  /** Which (if any) of a won fight's additive Burner-reward options a
   * script acquires (Burners checkpoint F) -- offered on every fight
   * tier including regular, unlike modAcquisitionStrategy's elite/
   * gatekeeper-only reward. Cap-respecting via acquireBurner. Defaults
   * to alwaysAcquireFirstBurner (legal-not-good). */
  burnerAcquisitionStrategy?: BurnerAcquisitionStrategy;
  /** Slot cap for installedLoadout -- checkpoint D. */
  installedSlotCap?: number;
  /** The bench's cap (BENCH_CAP, milestone 3); Infinity restores the old
   * unlimited bench. */
  benchCap?: number;
  /** Rest-vs-Merge choice at a Safehouse -- checkpoint E. Defaults to
   * preferMergeWhenAvailable (legal-not-good). */
  safehouseStrategy?: SafehouseStrategy;
  /** What (if anything) a script buys at the Shop -- checkpoint F.
   * Defaults to buyCheapestAffordable (legal-not-good). */
  shopStrategy?: ShopStrategy;
  /** Whether a script spends Data to reroll the Shop's slate once
   * before buying -- checkpoint F follow-up. Defaults to
   * rerollIfNothingAffordable (legal-not-good). */
  shopRerollStrategy?: ShopRerollStrategy;
  /** Mirrors shopStrategy/shopRerollStrategy for the parallel Mod slate
   * (Phase 5 Mods checkpoint G). */
  modShopStrategy?: ModShopStrategy;
  modShopRerollStrategy?: ModShopRerollStrategy;
  /** Which (if any) carried shop-context "coupon" Burner a script spends
   * on a Shop visit (Burners checkpoint E). Defaults to
   * neverActivateShopBurner. */
  shopBurnerStrategy?: ShopBurnerStrategy;
  /** Mirrors shopStrategy/shopRerollStrategy (and modShopStrategy/
   * modShopRerollStrategy) for the Burner slate's own third independent
   * draw/reroll (checkpoint F). */
  burnerShopStrategy?: BurnerShopStrategy;
  burnerShopRerollStrategy?: BurnerShopRerollStrategy;
  /** Which of an Event's choices a script takes (Events checkpoint H --
   * missed in that checkpoint's own pass, caught and fixed here while
   * verifying checkpoint I's bonus-fight path end-to-end via playRun).
   * Defaults to alwaysFirstEventChoice. */
  eventChoiceStrategy?: EventChoiceStrategy;
  /** Per-side combat-context Burner activation for every real fight the
   * run resolves (Burners checkpoint C -- missed threading past
   * combat.ts in that checkpoint's own pass, caught and fixed here at
   * checkpoint J while writing the smoke test that needed it). Defaults
   * to playCombat's own [neverActivateBurner, neverActivateBurner]. */
  burnerActivationStrategies?: [BurnerActivationStrategy, BurnerActivationStrategy];
  /** Test-only escape hatch (session 24, tunable-skill AI checkpoint A),
   * same treatment as installedLoadoutOverride above -- lets a sweep
   * exercise a skilled opponent (either side) in real fights via
   * resolveEncounter/resolveFight. Real per-tier enemy skill selection
   * for shipped content remains a separate, later decision; undefined
   * here falls all the way through to playCombat's own baseline
   * defaults. */
  discardStrategies?: [DiscardStrategy, DiscardStrategy];
  playStrategies?: [PlayStrategy, PlayStrategy];
  /** Player-side (side 0) skill dial, decoupled from the enemy's own --
   * session 39's "never interlocked" rule. Enemy skill is always
   * computed from enemySkill(tier, layerIndex, fightNumber) regardless
   * of this value; this only ever changes the player's own strategy.
   * Ignored when discardStrategies/playStrategies above are set (that
   * escape hatch still wins outright). Undefined keeps the player at
   * playCombat's baseline default (discardLowestTwo/playLowestLegal),
   * same as before this option existed -- so every full-run metric
   * generated without setting this is a floor-skill-player number, not
   * a "the player" number; say so explicitly when reporting one. */
  playerSkill?: number;
  /** Gatekeepers to exclude from selection entirely at every layer
   * (session 39) -- lets a diagnostic ablate one gatekeeper at a time to
   * isolate whether it's a difficulty outlier vs. its layer-mates.
   * Undefined/empty changes nothing, the default. */
  excludedGatekeeperIds?: EnemyId[];
  /** Per-layer gatekeeper override (session 49), indexed by 0-based
   * layerIndex the same way `layerNodeCounts` is -- an omitted or
   * undefined slot is today's behaviour exactly. Diagnostic-only, same
   * standing as `excludedGatekeeperIds` above, and never set by real
   * play.
   *
   * `synthetic` replaces that layer's gatekeeper FIGHT with a weighted
   * coin (encounters.ts's SyntheticGatekeeper), leaving the whole
   * reward/Heat/Mod/Burner pipeline downstream of it untouched.
   * `pinned` leaves the fight real but forces which member of the
   * layer's stable is drawn -- the complement of
   * `excludedGatekeeperIds`, which can only remove. The two compose:
   * synthesise three layers and pin the fourth to measure one
   * gatekeeper's cost against a controlled background.
   *
   * Any number produced with this set is NOT a plain full-run metric and
   * must say so when reported -- see README's conventions. */
  gatekeeperOverrides?: [GatekeeperOverride?, GatekeeperOverride?, GatekeeperOverride?, GatekeeperOverride?];
  /** Which banked id a 'merge' Safehouse action spends itself on
   * (session 46, Gameplay Simulation Heuristics checkpoint E) -- until
   * that checkpoint this was hardcoded to pickMergeTarget inside
   * resolveEncounter. Defaults to pickMergeTarget, unchanged behavior
   * for every existing caller. */
  mergeTargetStrategy?: MergeTargetStrategy;
  /** The simulated player shops like a person (session 62): at every
   * Shop it sells what it can't use (bench, unmergeable banked copies,
   * Cold Wallet), then keeps buying whatever its Shop strategies want
   * and can afford -- not at most one per slate. Off by default; the
   * synergy profile turns it on. */
  shopSpendFreely?: boolean;
  /** How the installed loadout is reordered after each node's encounter
   * fully resolves (session 46, Gameplay Simulation Heuristics
   * checkpoint F) -- firing order is a real lever (see loadout.ts's
   * reorderInstalled) that no script has ever pulled. Defaults to
   * keepAcquisitionOrder, i.e. exactly what every run did before this
   * option existed. */
  reorderStrategy?: ReorderStrategy;
  /** How an acquired subroutine is applied (session 46, Gameplay
   * Simulation Heuristics checkpoint G) -- acquireSubroutine benches a
   * piece forever once the loadout is full, acquireSubroutineWithSwap
   * evicts the weakest installed piece when the new one outranks it.
   * Defaults to acquireSubroutine, unchanged behavior for every existing
   * caller. Applies to all three acquisition routes below (reward pick,
   * Shop purchase, Event grant). */
  subroutineAcquirer?: SubroutineAcquirer;
  /** Observational only -- called once per gatekeeper fight, right
   * before it resolves, with the player's real accumulated state at
   * that moment (session 39: the "realistic difficulty" diagnostic
   * banked while investigating Null Session's kit-only floor numbers).
   * Never consumed or awaited; has zero effect on how the run actually
   * plays out. Purely a way for a script to snapshot (playerState,
   * layerIndex, fightsResolved, enemy) for a *separate* playCombat call
   * against the same enemy using the real production skill-dial AI,
   * rather than replaying the run's own outcome. Undefined by default --
   * a no-op for every existing caller. */
  onBeforeGatekeeperFight?: (context: GatekeeperFightContext) => void;
  /** What the run starts with from the profile (session 71): upgrades,
   * a 4th starter, a starting Burner. Absent for the simulation's usual
   * fresh player. */
  setup?: RunSetup;
}

/** runRequests, answered by its fallbacks (the simulation): every
 * strategy in `options` is called exactly as before the run became
 * pausable, so results are byte-identical. */
export function playRun(options: RunOptions): RunResult {
  return driveWithFallbacks(runRequests(options));
}

/** While the bench is over its cap, asks which bench piece to drop (the
 * simulated player drops the ladder's weakest). */
function* settleBench(playerState: RunPlayerState, cap: number): Generator<RunRequest, RunPlayerState, unknown> {
  let state = playerState;
  while (state.bench.length > cap) {
    const over = state;
    const id = yield* ask({ kind: 'drop', playerState: over, fallback: () => weakestOnBench(over) });
    const after = over.installedLoadout.some((piece) => piece.id === id) ? replaceInstalledWithNewest(over, id) : dropFromBench(over, id);
    // An id that isn't on the bench drops the weakest instead, so a bad
    // answer can't stall the run.
    state = after.bench.length < over.bench.length ? after : dropFromBench(over, weakestOnBench(over));
  }
  return state;
}

/** A whole run, pausing at each decision (see run-requests.ts): the map,
 * every encounter's choices, the player's fights, rewards and loadout
 * order. A UI drives this; playRun answers it with `options`' strategies. */
export function* runRequests(options: RunOptions): Generator<RunRequest, RunResult, unknown> {
  const {
    seed,
    classId = DEFAULT_CLASS_ID,
    layerNodeCounts = DEFAULT_LAYER_NODE_COUNTS,
    layerGraphs,
    startingData,
    startingMaterial,
    traversalStrategy = beelineToGatekeeper,
    installedLoadoutOverride,
    ownedModIdsOverride,
    classModUpgradedOverride,
    carriedBurnerIdsOverride,
    mapBurnerStrategy = neverActivateMapBurner,
    acquisitionStrategy = alwaysAcquireFirst,
    modAcquisitionStrategy = alwaysAcquireFirstMod,
    burnerAcquisitionStrategy = alwaysAcquireFirstBurner,
    installedSlotCap: installedSlotCapOption,
    benchCap = BENCH_CAP,
    safehouseStrategy = preferMergeWhenAvailable,
    mergeTargetStrategy = pickMergeTarget,
    shopSpendFreely = false,
    reorderStrategy = keepAcquisitionOrder,
    subroutineAcquirer = acquireSubroutine,
    shopStrategy = buyCheapestAffordable,
    shopRerollStrategy = rerollIfNothingAffordable,
    modShopStrategy = buyCheapestAffordableMod,
    modShopRerollStrategy = rerollModIfNothingAffordable,
    shopBurnerStrategy = neverActivateShopBurner,
    burnerShopStrategy = buyCheapestAffordableBurner,
    burnerShopRerollStrategy = rerollBurnerIfNothingAffordable,
    eventChoiceStrategy = alwaysFirstEventChoice,
    burnerActivationStrategies,
    discardStrategies,
    playStrategies,
    playerSkill,
    excludedGatekeeperIds,
    gatekeeperOverrides,
    onBeforeGatekeeperFight,
    setup,
  } = options;

  const rng = createRng(seed);
  const log: RunEvent[] = [];
  let heat = 0;
  let layersCompleted = 0;
  // Phase 5 checkpoint A/C: counts real combats resolved this run
  // (win or loss both count -- "a combat happened," not "a combat was
  // won"), regardless of layer -- feeds the opener-window override
  // (enemies.ts's pickRegularOrEliteEnemy/enemySkill) so the first few
  // fights of a run are easy regardless of which node the player visits
  // first (layer 1 is free-roam, so "the first node" isn't well-defined
  // by position).
  let fightsResolved = 0;
  let playerState = installedLoadoutOverride
    ? { ...createInitialPlayerState(classId), installedLoadout: installedLoadoutOverride }
    : createInitialPlayerState(classId);
  // The profile's upgrades and starting picks (session 71, MP7-MP9): a
  // 4th starter from the library, a starting common Burner.
  playerState = applyUpgrades(playerState, setup?.upgrades);
  playerState = applySecurity(playerState, setup?.securityLevel);
  const security = playerState.security;
  // A Daily Run (session 72): the day's Bulletins and Advisories.
  const dailyPlan = setup?.daily ? rollDaily(setup.daily.date) : undefined;
  if (dailyPlan) playerState = applyDailyStart(playerState, dailyPlan);
  const mapOptions = dailyPlan ? dailyMapOptions(dailyPlan) : undefined;
  const starter = setup?.starter ? ALL_SUBROUTINES.find((p) => p.id === setup.starter) : undefined;
  // A starter the class already starts with arrives as a Merge copy.
  if (starter && playerState.installedLoadout.some((p) => p.id === starter.id)) playerState = { ...playerState, material: { ...playerState.material, [starter.id]: (playerState.material[starter.id] ?? 0) + 1 } };
  else if (starter) playerState = { ...playerState, installedLoadout: [...playerState.installedLoadout, starter] };
  if (setup?.burner && BURNER_DEFINITIONS[setup.burner]) playerState = acquireBurner(playerState, BURNER_DEFINITIONS[setup.burner]);
  const installedSlotCap = installedSlotCapOption ?? slotCapOf(playerState);
  // Routed through the same acquireMod each real Mod pickup uses (not a
  // raw ownedModIds splice), so onModAcquired's real side effects
  // (Backup Generator's max-Heat raise, Auxiliary Process's granted
  // subroutine) apply exactly as they would from a real acquisition.
  for (const modId of ownedModIdsOverride ?? []) {
    const mod = MOD_DEFINITIONS[modId];
    if (mod) playerState = acquireMod(playerState, mod);
  }
  if (classModUpgradedOverride) playerState = { ...playerState, classModUpgraded: true };
  // Same treatment for Burners (checkpoint D's test-only escape hatch,
  // routed through acquireBurner so BURNER_CAP is still respected).
  for (const burnerId of carriedBurnerIdsOverride ?? []) {
    const burner = BURNER_DEFINITIONS[burnerId];
    if (burner) playerState = acquireBurner(playerState, burner);
  }

  if (startingData !== undefined) playerState = { ...playerState, data: startingData };
  if (startingMaterial) playerState = { ...playerState, material: { ...playerState.material, ...startingMaterial } };

  // The run's tally (session 72): Data and rank changes settle at each
  // step between nodes; the Shop's costs and negative Data awards are
  // noted as they happen, so spending isn't netted against earning.
  const tally: RunTally = { dataEarned: 0, dataSpent: 0, merges: 0, burnersUsed: 0 };
  const rankSum = () => Object.values(playerState.rank).reduce((s, r) => s + r, 0);
  let markData = playerState.data;
  let markRank = rankSum();
  let pendingSpent = 0;
  const spend = (amount: number) => (pendingSpent += amount);
  const settle = () => {
    const earned = playerState.data - markData + pendingSpent;
    tally.dataEarned += Math.max(0, earned);
    tally.dataSpent += pendingSpent + Math.max(0, -earned);
    tally.merges += Math.max(0, rankSum() - markRank);
    markData = playerState.data;
    markRank = rankSum();
    pendingSpent = 0;
  };
  const finish = (outcome: RunOutcome): RunResult => {
    settle();
    for (const e of log) {
      if (e.type === 'mapBurnerActivated') tally.burnersUsed++;
      if (e.type === 'encounter') tally.burnersUsed += e.outcome.burnersUsedThisCombat.length + (e.outcome.shopBurnerUsed ? 1 : 0);
    }
    return { outcome, layersCompleted, finalHeat: heat, log, playerState, tally };
  };

  for (let layerIndex = 0; layerIndex < layerNodeCounts.length; layerIndex++) {
    const authored = layerGraphs?.[layerIndex];
    let graph = authored
      ? { ...authored, nodes: authored.nodes.map((n) => ({ ...n })), edges: [...authored.edges] }
      : generateLayer({ rng, nodeCount: layerNodeCounts[layerIndex], layer: (layerIndex + 1) as LayerNumber, ...mapOptions });
    // Fixes this layer's gatekeeper identity for the whole run (Phase 5
    // checkpoint C) -- kept as a separate post-processing step rather
    // than a generateLayer option, so map-gen.ts itself stays
    // content-agnostic (its own "pure topology" scope). enemies.ts's
    // layer numbering is 1-based (minLayer/eligibleEnemies), while this
    // loop's layerIndex is 0-based -- +1 here is the only place that
    // conversion needs to happen.
    // Session 49: `pinned` is expressed as an exclusion of the layer's
    // OTHER stable members, so assignGatekeeperEnemy keeps its single
    // selection path and enemies.ts gains no new surface. Validated
    // here rather than left to assignGatekeeperEnemy's own empty-stable
    // throw, which would report a misleading "no stable defined".
    const override = gatekeeperOverrides?.[layerIndex];
    let excludedThisLayer = excludedGatekeeperIds;
    if (override?.kind === 'pinned') {
      const stable = eligibleEnemies('gatekeeper', layerIndex + 1).map((e) => e.id);
      if (!stable.includes(override.enemyId)) {
        throw new Error(`run.ts: gatekeeperOverrides pinned "${override.enemyId}" at layer ${layerIndex + 1}, whose stable is [${stable.join(', ')}]`);
      }
      excludedThisLayer = [...(excludedGatekeeperIds ?? []), ...stable.filter((id) => id !== override.enemyId)];
    }
    if (!graph.nodes.find((n) => n.id === graph.gatekeeperNodeId)?.assignedEnemyId) graph = assignGatekeeperEnemy(graph, layerIndex + 1, rng, excludedThisLayer);
    log.push({ type: 'layerGenerated', layerIndex, nodeCount: graph.nodes.length });
    let position: RunPosition = { layerIndex, nodeId: graph.entryNodeId };
    let layerCleared = false;
    // D4/D5: each layer has its own allowance, tightening with depth.
    // Read live rather than once, since Backup Generator can raise it
    // mid-layer, and recorded on the player state for strategies.
    // A Security Level shrinks the allowance (MP14, levels 6 and 9).
    const ceiling = (): number => Math.round(layerHeatAllowance(layerIndex, playerState.maxHeatBonus) * (security?.allowance ?? 1));
    playerState = { ...playerState, heatAllowance: ceiling() };

    while (!layerCleared) {
      settle();
      const fromNodeId = position.nodeId;

      // Map-context Burner activation (checkpoint D), before both this
      // iteration's traversal decision AND the no-route-remains check
      // right below -- checkpoint J verification found that checking
      // reachability first defeated Skeleton Key's entire purpose: the
      // moment a closing node cuts off the last route, the run ended
      // before the player ever got a chance to reopen it, even carrying
      // the one Burner designed to save exactly that situation.
      // DESIGN.md's own framing for this ("recoverable, not automatic,"
      // resolving the session-9 banked node-bypass idea) only holds if
      // reopening can happen before the run gives up, not after.
      // Applies a map Burner (from the pre-move ask, or a person's map
      // pause -- milestone 3 checkpoint 4). Ignored unless it's carried
      // and its target, if any, is a closed node.
      const useMapBurner = (picked: { burnerId: BurnerId; targetNodeId?: string } | null) => {
        const available = playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('map'));
        const burnerDef = picked && available.includes(picked.burnerId) ? BURNER_DEFINITIONS[picked.burnerId] : undefined;
        if (!picked || !burnerDef?.mapEffect) return;
        const closedNodeIds = graph.nodes.filter((n) => n.state === 'closed').map((n) => n.id);
        if (burnerDef.mapEffect.kind === 'reopenClosedNode' && picked.targetNodeId && closedNodeIds.includes(picked.targetNodeId)) {
          const targetNodeId = picked.targetNodeId;
          graph = reopenNode(graph, targetNodeId);
          playerState = removeOneCarriedBurner(playerState, picked.burnerId);
          log.push({ type: 'mapBurnerActivated', layerIndex, burnerId: picked.burnerId, targetNodeId });
        } else if (burnerDef.mapEffect.kind !== 'reopenClosedNode') {
          // Session 64 (BE4): Heat tools and Tunnel, kept on the player
          // state until they're used up.
          const effect = burnerDef.mapEffect;
          const current: MapEffects = playerState.mapEffects ?? { freeMoves: 0 };
          let next: MapEffects = current;
          if (effect.kind === 'freeMoves') next = { ...current, freeMoves: current.freeMoves + effect.count };
          else if (effect.kind === 'nextFightHeat') next = { ...current, nextFightHeat: Math.min(current.nextFightHeat ?? 1, effect.multiplier), nextFightHeatFights: (current.nextFightHeatFights ?? 0) + effect.fights };
          else if (effect.kind === 'nextGatekeeperToll') {
            next = { ...current, nextGatekeeperToll: Math.min(current.nextGatekeeperToll ?? 1, effect.multiplier) };
            if (effect.clearHeat) heat = 0;
          }
          else if (effect.kind === 'tunnel') next = { ...current, tunnel: true };
          else if (effect.kind === 'lowerHeat') heat = Math.max(0, heat - effect.amount);
          playerState = { ...removeOneCarriedBurner(playerState, picked.burnerId), mapEffects: next };
          log.push({ type: 'mapBurnerActivated', layerIndex, burnerId: picked.burnerId });
        }
      };
      const availableMapBurnerIds = playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('map'));
      if (availableMapBurnerIds.length > 0) {
        const closedNodeIds = graph.nodes.filter((n) => n.state === 'closed').map((n) => n.id);
        const context: MapBurnerActivationContext = { graph, position, heat, playerState, availableBurnerIds: availableMapBurnerIds, closedNodeIds };
        useMapBurner(yield* ask({ kind: 'mapBurner', context, fallback: () => mapBurnerStrategy(context) }));
      }

      if (!gatekeeperReachable(graph, position.nodeId)) {
        log.push({ type: 'runEnded', outcome: 'noRouteRemains' });
        return finish('noRouteRemains');
      }

      // A rearranged loadout (M2: any time outside a fight) or a map
      // Burner (checkpoint 4) answers the move pause too; it is applied and
      // the move asked again.
      let targetId: string;
      for (;;) {
        const [moveGraph, movePosition, moveHeat, movePlayer] = [graph, position, heat, playerState];
        const answer = yield* ask({
          kind: 'move',
          graph: moveGraph,
          position: movePosition,
          heat: moveHeat,
          playerState: movePlayer,
          freeMove: (playerState.mapEffects?.freeMoves ?? 0) > 0,
          fallback: (): MoveAnswer => traversalStrategy(moveGraph, movePosition, moveHeat, movePlayer),
        });
        if (typeof answer === 'string') {
          targetId = answer;
          break;
        }
        if ('useBurner' in answer) useMapBurner(answer.useBurner);
        else playerState = arrangeLoadout(playerState, answer.arrange.installed, answer.arrange.bench, installedSlotCap);
      }
      const moveResult = move(graph, position, targetId);
      position = moveResult.position;

      // Light Footing (Phase 5 Mods checkpoint E) and Ghost Protocol
      // (Burners checkpoint D) both discount/waive the flat per-move Heat
      // cost before it's applied -- a free move skips the charge outright,
      // same floored-at-0 treatment applyOnMoveMods already gives Light
      // Footing (a move can never refund Heat, only discount/waive it).
      const freeMove = (playerState.mapEffects?.freeMoves ?? 0) > 0;
      if (freeMove) playerState = { ...playerState, mapEffects: { ...playerState.mapEffects!, freeMoves: playerState.mapEffects!.freeMoves - 1 } };
      // A Security Level raises all Heat gained (MP14).
      const moveHeatCost = (freeMove ? 0 : applyOnMoveMods(playerState.ownedModIds, moveResult.heatCost)) * (security?.heatGain ?? 1) * (playerState.daily?.moveHeat ?? 1);
      playerState = applyQuietHoursMod(playerState); // session 44: Data trickle every QUIET_HOURS_MOVE_INTERVAL moves
      const afterMove = addHeat(heat, moveHeatCost, ceiling());
      heat = afterMove.heat;
      log.push({ type: 'move', layerIndex, from: fromNodeId, to: position.nodeId, heatCost: moveHeatCost, heatAfter: heat });
      if (afterMove.maxed) {
        log.push({ type: 'runEnded', outcome: 'heatMaxed' });
        return finish('heatMaxed');
      }

      const node = graph.nodes.find((n) => n.id === position.nodeId);
      if (!node) throw new Error(`playRun: node "${position.nodeId}" is missing from its own layer graph`);
      if (node.state !== 'unresolved') continue; // already resolved -- just passing through
      // Tunnel (session 64): pass through the next Shop or Safehouse
      // without visiting it; it stays for later.
      if (playerState.mapEffects?.tunnel && (node.type === 'shop' || node.type === 'safehouse')) {
        playerState = { ...playerState, mapEffects: { ...playerState.mapEffects, tunnel: false } };
        continue;
      }

      const isFightNode = node.type === 'regularFight' || node.type === 'eliteFight' || node.type === 'gatekeeperFight';
      if (node.type === 'gatekeeperFight' && onBeforeGatekeeperFight) {
        onBeforeGatekeeperFight({
          playerState,
          layerIndex: layerIndex + 1, // enemies.ts's layer numbering is 1-based, same conversion resolveEncounter's own call below uses
          fightsResolved,
          enemy: gatekeeperEnemyForNode(node),
        });
      }
      playerState = { ...playerState, heat };
      const outcome = yield* resolveEncounterRequests(
        node,
        rng,
        playerState,
        safehouseStrategy,
        shopStrategy,
        shopRerollStrategy,
        discardStrategies,
        playStrategies,
        layerIndex + 1, // enemies.ts's layer numbering is 1-based
        fightsResolved,
        undefined, // enemyIdOverride -- test-only, never set by real play
        modShopStrategy,
        modShopRerollStrategy,
        shopBurnerStrategy,
        burnerShopStrategy,
        burnerShopRerollStrategy,
        eventChoiceStrategy,
        burnerActivationStrategies,
        heat,
        playerSkill,
        mergeTargetStrategy,
        override?.kind === 'synthetic' ? override : undefined,
        shopSpendFreely,
      );
      if (isFightNode) fightsResolved++;
      graph = { ...graph, nodes: graph.nodes.map((n) => (n.id === node.id ? { ...n, state: outcome.newState } : n)) };
      // A lost regular or elite fight closes its node and ejects the player
      // back where they came from (DESIGN.md). Left standing on the closed
      // node, the route check below found no way out and ended the run
      // (session 67: a third of runs, once players started losing elites).
      if (outcome.newState === 'closed') position = { ...position, nodeId: fromNodeId };
      // Ghost Credentials (session 65): each fight adds more Heat, booked
      // as `mod` Heat (before any map Burner's cut, which then cuts it too).
      if (isFightNode && playerState.ownedModIds.includes('ghost-credentials') && outcome.heatDelta > 0) {
        const extra = outcome.heatDelta * (GHOST_CREDENTIALS_FIGHT_HEAT - 1);
        outcome.heatDelta += extra;
        outcome.heatSources = { ...outcome.heatSources, mod: outcome.heatSources.mod + extra };
      }
      // The fight Heat upgrade (session 71, MP7): a fight that adds Heat
      // adds less, booked as `upgrade` Heat.
      // A Security Level raises all Heat an encounter adds (MP14), booked
      // as `security` Heat.
      if (security && outcome.heatDelta > 0) {
        const extra = outcome.heatDelta * (security.heatGain - 1);
        outcome.heatDelta += extra;
        outcome.heatSources = { ...outcome.heatSources, security: outcome.heatSources.security + extra };
      }
      const fightHeat = playerState.meta?.fightHeat ?? 1;
      if (isFightNode && fightHeat !== 1 && outcome.heatDelta > 0) {
        const cut = outcome.heatDelta * (fightHeat - 1);
        outcome.heatDelta += cut;
        outcome.heatSources = { ...outcome.heatSources, upgrade: outcome.heatSources.upgrade + cut };
      }
      // Map Burners' cuts (session 64, BE4): Proxy Chain cuts the next
      // fight's Heat, win or lose; Spoofed Credentials / Golden Ticket cut
      // the next gatekeeper's Heat toll on a win. Booked as `burner` Heat.
      if (isFightNode && playerState.mapEffects) {
        const fx = playerState.mapEffects;
        const gatekeeperWin = node.type === 'gatekeeperFight' && outcome.newState === 'inert';
        const multiplier = (fx.nextFightHeat ?? 1) * (gatekeeperWin ? (fx.nextGatekeeperToll ?? 1) : 1);
        if (multiplier !== 1 && outcome.heatDelta > 0) {
          const cut = outcome.heatDelta * (multiplier - 1);
          outcome.heatDelta += cut;
          outcome.heatSources = { ...outcome.heatSources, burner: outcome.heatSources.burner + cut };
        }
        const fightsLeft = (fx.nextFightHeatFights ?? 0) - 1;
        const fightCut = fightsLeft > 0 ? { nextFightHeatFights: fightsLeft } : { nextFightHeat: undefined, nextFightHeatFights: undefined };
        playerState = { ...playerState, mapEffects: { ...fx, ...fightCut, ...(gatekeeperWin ? { nextGatekeeperToll: undefined } : {}) } };
      }
      const afterEncounter = addHeat(heat, outcome.heatDelta, ceiling());
      heat = afterEncounter.heat;
      // Removes any Burner(s) actually activated in this encounter's
      // combat (checkpoint C wires the real activation) -- removes one
      // instance per use, not every copy, so a duplicate-stacked Burner
      // isn't wiped out by using just one.
      if (outcome.burnersUsedThisCombat.length > 0) {
        const remaining = [...playerState.carriedBurnerIds];
        for (const usedId of outcome.burnersUsedThisCombat) {
          const index = remaining.indexOf(usedId);
          if (index !== -1) remaining.splice(index, 1);
        }
        playerState = { ...playerState, carriedBurnerIds: remaining };
      }
      // Shop-context "coupon" Burner (checkpoint E) -- same "recorded,
      // not applied" split as shopPurchases/modShopPurchases below.
      if (outcome.shopBurnerUsed) {
        playerState = removeOneCarriedBurner(playerState, outcome.shopBurnerUsed);
      }
      // Trace evasion (session 63, docs/trace-evasion-design.md): a beaten
      // gatekeeper whose toll maxed your Heat tries to trace you. Played
      // before any rewards, which only follow an escape.
      let evaded = false;
      let evasionEvent: RunEvent | null = null;
      if (afterEncounter.maxed && node.type === 'gatekeeperFight' && outcome.newState === 'inert' && outcome.fight) {
        const enemy = gatekeeperEnemyForNode(node);
        const result = yield* traceEvasion(enemy, layerIndex, outcome.fight.finalFillFraction[1], rng.nextInt(2 ** 31), enemySkill('gatekeeper', layerIndex + 1, fightsResolved - 1), playerSkill);
        evasionEvent = { type: 'evasion', layerIndex, headStart: result.headStart, finalScores: result.finalScores, escaped: result.escaped };
        if (!result.escaped) {
          log.push({ type: 'encounter', layerIndex, nodeId: node.id, nodeType: node.type, outcome, heatAfter: heat });
          log.push(evasionEvent);
          layersCompleted++;
          log.push({ type: 'layerCleared', layerIndex });
          log.push({ type: 'runEnded', outcome: 'breachedThenCaught' });
          return finish('breachedThenCaught');
        }
        evaded = true;
      }
      // !== 0, not > 0: combat/Data-tier rewards are always non-negative
      // in practice, but an Event's dataDelta (checkpoint H) is a
      // genuine signed delta -- a future negative-cost Event choice
      // should still apply correctly, not get silently dropped.
      // Lean Times (a daily Advisory): fights pay half the Data.
      if (isFightNode && outcome.dataAwarded > 0 && playerState.daily && playerState.daily.fightData !== 1) outcome.dataAwarded = Math.round(outcome.dataAwarded * playerState.daily.fightData);
      if (outcome.dataAwarded < 0) spend(-outcome.dataAwarded);
      if (outcome.dataAwarded !== 0) playerState = { ...playerState, data: playerState.data + outcome.dataAwarded };
      // An elite win (session 62): one choice, a subroutine or a Mod. The
      // simulated player takes a subroutine while it has a free loadout
      // slot, else the Mod -- build the loadout early, collect Mods later.
      // (If either list is empty, the rewards below apply one at a time.)
      // The last layer's gatekeeper ends the run (session 63, the tutorial
      // playthrough): its rewards would never be used, so none are offered.
      const runOver = node.type === 'gatekeeperFight' && layerIndex === layerNodeCounts.length - 1 && !outcome.quarantined;
      // Caught by this encounter's Heat (session 69, a tester's note): the
      // run ends below, so its rewards would never be used either.
      const caught = afterEncounter.maxed && !evaded;
      if (runOver || caught) {
        outcome.rewardOptions = [];
        outcome.modRewardOptions = [];
        outcome.burnerRewardOptions = [];
      }
      const oneChoice = Boolean(outcome.eliteChoice) && outcome.rewardOptions.length > 0 && outcome.modRewardOptions.length > 0;
      if (oneChoice) {
        const offeredTo = playerState;
        const subroutines = outcome.rewardOptions;
        const mods = outcome.modRewardOptions;
        const pickedEither = yield* ask({
          kind: 'reward',
          reward: 'eliteChoice',
          options: [...subroutines, ...mods],
          subroutines,
          mods,
          playerState: offeredTo,
          fallback: () => {
            const used = offeredTo.installedLoadout.filter((p) => !offeredTo.grantedByMod[p.id]).length;
            return used < installedSlotCap ? acquisitionStrategy(subroutines, offeredTo) : modAcquisitionStrategy(mods, offeredTo);
          },
        });
        const took = pickedEither === null ? null : mods.includes(pickedEither as ModDefinition) ? 'mod' : 'subroutine';
        if (took === 'mod') playerState = acquireMod(playerState, pickedEither as ModDefinition);
        if (took === 'subroutine') {
          const picked = pickedEither as SubroutineDefinition;
          playerState = subroutineAcquirer(playerState, picked, installedSlotCap);
          playerState = applyOnSubroutineAcquiredMods(playerState, picked);
          playerState = yield* settleBench(playerState, benchCap);
        }
      }
      if (!oneChoice && outcome.rewardOptions.length > 0) {
        const offeredTo = playerState;
        const picked = yield* ask({ kind: 'reward', reward: 'subroutine', options: outcome.rewardOptions, playerState: offeredTo, fallback: () => acquisitionStrategy(outcome.rewardOptions, offeredTo) });
        if (picked) {
          playerState = subroutineAcquirer(playerState, picked, installedSlotCap);
          // Salvage Protocol (checkpoint E) -- checked against every
          // acquired piece, reward or Shop alike, per its own no-op guards.
          playerState = applyOnSubroutineAcquiredMods(playerState, picked);
          playerState = yield* settleBench(playerState, benchCap);
        }
      }
      // Mod-choice reward (checkpoint G) -- additive, elite/gatekeeper
      // wins only, never competing with the subroutine reward above.
      if (!oneChoice && outcome.modRewardOptions.length > 0) {
        const offeredTo = playerState;
        const pickedMod = yield* ask({ kind: 'reward', reward: 'mod', options: outcome.modRewardOptions, playerState: offeredTo, fallback: () => modAcquisitionStrategy(outcome.modRewardOptions, offeredTo) });
        if (pickedMod) playerState = acquireMod(playerState, pickedMod);
      }
      // Burner-choice reward (checkpoint F) -- additive, every fight tier
      // including regular, never competing with the subroutine/Mod
      // rewards above.
      if (outcome.burnerRewardOptions.length > 0) {
        const offeredTo = playerState;
        const pickedBurner = yield* ask({
          kind: 'reward',
          reward: 'burner',
          options: outcome.burnerRewardOptions,
          playerState: offeredTo,
          fallback: () => burnerAcquisitionStrategy(outcome.burnerRewardOptions, offeredTo),
        });
        if (pickedBurner) playerState = yield* acquireBurnerAsking(playerState, pickedBurner);
      }
      // A Safehouse Merge spends every banked copy (session 61); the target
      // id now only says a Merge happened.
      if (outcome.mergeTargetId) playerState = mergeEverything(playerState);
      // Sales first (session 61): their Data may have paid for the buys.
      if (outcome.shopSales) playerState = applyShopSales(playerState, outcome.shopSales);
      spend(outcome.rerollCost + outcome.modRerollCost + outcome.burnerRerollCost);
      for (const p of [...outcome.shopPurchases, ...outcome.modShopPurchases, ...outcome.burnerShopPurchases]) spend(p.cost);
      if (outcome.rerollCost > 0) playerState = { ...playerState, data: playerState.data - outcome.rerollCost };
      for (const purchase of outcome.shopPurchases) {
        playerState = { ...playerState, data: playerState.data - purchase.cost };
        playerState = subroutineAcquirer(playerState, purchase.piece, installedSlotCap);
        playerState = applyOnSubroutineAcquiredMods(playerState, purchase.piece);
        playerState = yield* settleBench(playerState, benchCap);
      }
      if (outcome.modRerollCost > 0) playerState = { ...playerState, data: playerState.data - outcome.modRerollCost };
      for (const purchase of outcome.modShopPurchases) {
        playerState = { ...playerState, data: playerState.data - purchase.cost };
        playerState = acquireMod(playerState, purchase.mod);
      }
      if (outcome.burnerRerollCost > 0) playerState = { ...playerState, data: playerState.data - outcome.burnerRerollCost };
      for (const purchase of outcome.burnerShopPurchases) {
        playerState = { ...playerState, data: playerState.data - purchase.cost };
        playerState = yield* acquireBurnerAsking(playerState, purchase.burner);
      }
      // An Event grant (checkpoint H) is a direct single item, applied
      // outright -- no acquisitionStrategy step, unlike the *RewardOptions
      // fields above (those are offered choices; this isn't).
      if (outcome.eventGrant?.subroutine) {
        playerState = subroutineAcquirer(playerState, outcome.eventGrant.subroutine, installedSlotCap);
        playerState = applyOnSubroutineAcquiredMods(playerState, outcome.eventGrant.subroutine);
        playerState = yield* settleBench(playerState, benchCap);
      }
      if (outcome.eventGrant?.mod) playerState = acquireMod(playerState, outcome.eventGrant.mod);
      // An Event comes up once a run (session 65).
      if (outcome.eventId) playerState = { ...playerState, seenEventIds: [...(playerState.seenEventIds ?? []), outcome.eventId] };
      // The class Mod's "II" upgrade (session 65): permanent.
      if (outcome.eventGrant?.classModUpgrade) playerState = { ...playerState, classModUpgraded: true };
      if (outcome.eventGrant?.burner) playerState = yield* acquireBurnerAsking(playerState, outcome.eventGrant.burner);
      for (const burner of outcome.cacheBurners ?? []) playerState = yield* acquireBurnerAsking(playerState, burner);
      // Loadout reorder (session 46, checkpoint F) -- applied once here,
      // after the whole resolution block, rather than at each of the four
      // places above that can change installedLoadout (reward pick, Shop
      // purchase, Event grant, and acquireMod's own granted-subroutine
      // insert). The rule is a pure idempotent function of the loadout,
      // so one call after the last change is equivalent to four calls
      // interleaved with them, and it can't miss a path a future
      // acquisition route might add. Between fights only (a loadout never
      // changes mid-fight) -- this sits after this node's encounter has
      // fully resolved and before the next node's, which is exactly that
      // window.
      const beforeReorder = playerState;
      playerState = yield* ask({ kind: 'reorder', playerState: beforeReorder, fallback: () => reorderStrategy(beforeReorder) });
      log.push({ type: 'encounter', layerIndex, nodeId: node.id, nodeType: node.type, outcome, heatAfter: heat });
      if (evasionEvent) log.push(evasionEvent);

      playerState = { ...playerState, heatAllowance: ceiling() };

      if (outcome.quarantined) {
        log.push({ type: 'runEnded', outcome: 'quarantined' });
        return finish('quarantined');
      }
      const gatekeeperBeaten = node.type === 'gatekeeperFight' && outcome.newState === 'inert';
      if (gatekeeperBeaten) {
        layersCompleted++;
        log.push({ type: 'layerCleared', layerIndex });
      }
      if (afterEncounter.maxed && !evaded) {
        // R8: the gatekeeper's toll is charged after the fight, so a
        // breach can still end the run -- counted as a breach, distinct
        // from being caught mid-layer.
        const ending: RunOutcome = gatekeeperBeaten ? 'breachedThenCaught' : 'heatMaxed';
        log.push({ type: 'runEnded', outcome: ending });
        return finish(ending);
      }
      if (gatekeeperBeaten) {
        // D4: survive the toll and Heat resets for the next layer -- in
        // part only at Security Level 2+ (D6).
        heat = heat * (security?.heatCarry ?? playerState.daily?.heatCarry ?? 0);
        layerCleared = true;
      }
    }
  }

  log.push({ type: 'runEnded', outcome: 'victory' });
  return finish('victory');
}

function withoutClosedNodes(graph: LayerGraph): LayerGraph {
  const closedIds = new Set(graph.nodes.filter((n) => n.state === 'closed').map((n) => n.id));
  return { ...graph, edges: graph.edges.filter((e) => !closedIds.has(e.a) && !closedIds.has(e.b)) };
}

/** The live, state-aware version of the graph-resilience question: is
 * the gatekeeper still reachable from here, given whatever has closed so
 * far? Exported so it can be unit-tested directly against hand-built
 * graphs, independent of generateLayer's randomness. */
export function gatekeeperReachable(graph: LayerGraph, fromNodeId: string): boolean {
  return isReachable(withoutClosedNodes(graph), fromNodeId, graph.gatekeeperNodeId);
}

/** Reopens a closed node back to 'unresolved' -- the real engine gap
 * Skeleton Key's map effect needed (session 37's exploration:
 * map-types.ts's NodeState previously only ever tightened, unresolved ->
 * inert/closed, never the reverse). No-ops (returns graph unchanged) if
 * nodeId isn't currently closed -- same defensive-guard treatment as
 * every other "declines if invalid" pick in this file. Exported so it's
 * directly unit-testable against a hand-built graph, same precedent
 * gatekeeperReachable set above. */
export function reopenNode(graph: LayerGraph, nodeId: string): LayerGraph {
  const target = graph.nodes.find((n) => n.id === nodeId);
  if (!target || target.state !== 'closed') return graph;
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, state: 'unresolved' } : n)) };
}

function shortestPath(graph: LayerGraph, fromId: string, toId: string): string[] {
  if (fromId === toId) return [fromId];
  const cameFrom = new Map<string, string>();
  const visited = new Set<string>([fromId]);
  const queue = [fromId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const neighbor of neighborsOf(graph, current)) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      cameFrom.set(neighbor, current);
      if (neighbor === toId) return reconstructPath(cameFrom, fromId, toId);
      queue.push(neighbor);
    }
  }
  return [];
}

function reconstructPath(cameFrom: Map<string, string>, fromId: string, toId: string): string[] {
  const path = [toId];
  let node = toId;
  while (node !== fromId) {
    node = cameFrom.get(node) as string;
    path.push(node);
  }
  return path.reverse();
}

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint H) -- the
// map-context half of Burner activation. Per-effect-kind dispatch, not a
// generic "is this worth using" scorer: with only 3 map Burners, each
// with a genuinely different shape of payoff, a shared scoring function
// would be inventing a common currency that doesn't exist.
//
// Priority when more than one is carried: Ghost Protocol first (Heat is
// the run-ending resource). (Skeleton Key's reopening went with its
// rework into Restore Point, session 68.)
// ---------------------------------------------------------------------

/** The map half of session 46's "smart player" profile. Opt-in only --
 * neverActivateMapBurner stays playRun's default. */
export const synergyAwareMapBurnerStrategy: MapBurnerStrategy = (ctx) => {
  const carries = (id: BurnerId): boolean => ctx.availableBurnerIds.includes(id);

  const fx = ctx.playerState.mapEffects;
  // Ghost Protocol: when moves cost Heat and none are already free.
  if (carries('ghost-protocol') && applyOnMoveMods(ctx.playerState.ownedModIds, HEAT_PER_MOVE) > 0 && !(fx?.freeMoves ?? 0)) {
    return { burnerId: 'ghost-protocol' };
  }
  // Session 64 (BE4). Log Wiper once Heat passes half the allowance.
  const allowance = ctx.playerState.heatAllowance ?? 1;
  if (carries('log-wiper') && ctx.heat >= allowance / 2) return { burnerId: 'log-wiper' };
  // The gatekeeper's toll cuts, once it's one move away.
  const linked = ctx.graph.edges.flatMap((e) => (e.a === ctx.position.nodeId ? [e.b] : e.b === ctx.position.nodeId ? [e.a] : []));
  const gatekeeperNext = linked.includes(ctx.graph.gatekeeperNodeId);
  if (gatekeeperNext && fx?.nextGatekeeperToll === undefined) {
    if (carries('golden-ticket')) return { burnerId: 'golden-ticket' };
    if (carries('spoofed-credentials')) return { burnerId: 'spoofed-credentials' };
  }
  // Proxy Chain on whatever fight comes next.
  if (carries('proxy-chain') && fx?.nextFightHeat === undefined) return { burnerId: 'proxy-chain' };
  // Tunnel: the simulated player routes by node type and wants every Shop
  // and Safehouse it walks into, so it holds Tunnel rather than skip one.

  return null;
};

/** A Shop visit's sales (session 61): each sold benched subroutine,
 * banked copy and carried Burner leaves (one each), and its price is paid
 * in Data. A sold subroutine takes its Merge rank with it (a copy found
 * later starts again at rank 0); its banked copies stay. */
export function applyShopSales(playerState: RunPlayerState, sales: { subroutine: string[]; copy: string[]; burner: BurnerId[] }): RunPlayerState {
  let bench = [...playerState.bench];
  let carried = [...playerState.carriedBurnerIds];
  const material = { ...playerState.material };
  const rank = { ...playerState.rank };
  let data = playerState.data;
  for (const id of sales.subroutine) {
    const i = bench.findIndex((p) => p.id === id);
    if (i === -1) continue;
    data += subroutineSellPrice(id, bench[i].rank ?? 0);
    bench = [...bench.slice(0, i), ...bench.slice(i + 1)];
    delete rank[id];
  }
  for (const id of sales.copy) {
    if ((material[id] ?? 0) <= 0) continue;
    material[id] -= 1;
    data += subroutineSellPrice(id);
  }
  for (const id of sales.burner) {
    const i = carried.indexOf(id);
    if (i === -1) continue;
    carried = [...carried.slice(0, i), ...carried.slice(i + 1)];
    data += burnerSellPrice(BURNER_DEFINITIONS[id]);
  }
  return { ...playerState, bench, carriedBurnerIds: carried, material, rank, data };
}
