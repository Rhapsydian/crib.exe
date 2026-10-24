import type { BurnerDefinition, BurnerId } from './burner-types';
import type { CombatAnswer, CombatRequest, CombatResult } from './combat';
import type { EnemyDefinition } from './enemies';
import type { EventChoice, EventDefinition, EventEffect, EventGrant } from './event-types';
import type { LayerGraph, RunPosition } from './map-types';
import type { ModDefinition } from './mod-types';
import type { SafehouseAction } from './merge';
import type { MapBurnerActivationContext, RunPlayerState } from './run';
import type { BurnerOffering, ModOffering, ShopOffering } from './shop';
import type { SubroutineDefinition } from './subroutine-types';
import type { CribbageAnswer, CribbageRequest } from './basic-cribbage';
import type { EvasionResult } from './evasion';

/**
 * The run as a pausable engine (milestone 3 checkpoint 1, P1's run half).
 * Every decision the run used to hand a strategy function is now yielded
 * as a RunRequest, and the run resumes with the answer -- the same
 * generator pattern combat uses (combat.ts's CombatRequest).
 *
 * Each request carries `fallback`: the exact strategy call the run made
 * before this refactor, with the same arguments, at the same moment. The
 * simulation driver (driveWithFallbacks; playRun and resolveEncounter use
 * it) answers every request with its fallback, so simulated runs are
 * byte-identical to before. A UI driver answers the player's requests
 * itself (and can show the fallback as a hint).
 *
 * Fights pause inside the run: only the player's own combat requests
 * surface (kind 'combat'); the enemy's are answered inside the engine.
 */
type Ask<K extends string, Context, Answer> = { kind: K; fallback: () => Answer } & Context;

export type RunRequest =
  /** A map Burner before moving (null: keep it). */
  | Ask<'mapBurner', { context: MapBurnerActivationContext }, { burnerId: BurnerId; targetNodeId?: string } | null>
  /** Where to move next: a linked node's id -- or a rearranged loadout
   * (milestone 3 checkpoint 3, M2: pieces move between loadout and bench
   * any time outside a fight), or a map Burner to use (checkpoint 4),
   * applied before the same move is asked again. The simulated player
   * only ever moves (its map Burners go through 'mapBurner'). */
  | Ask<'move', { graph: LayerGraph; position: RunPosition; heat: number; playerState: RunPlayerState; freeMove?: boolean }, MoveAnswer>
  /** Notices (milestone 3 checkpoint 2): a fight is starting / has ended.
   * Nothing to decide -- a UI shows the enemy, then the result, and
   * resumes; the fallback is a no-op, so simulations are unchanged. */
  | Ask<'fightStart', { enemy: EnemyDefinition; tier: 'regular' | 'elite' | 'gatekeeper'; layer: number; playerState: RunPlayerState }, null>
  | Ask<'fightEnd', { enemy: EnemyDefinition; tier: 'regular' | 'elite' | 'gatekeeper'; result: CombatResult }, null>
  /** Notices (milestone 3 checkpoint 4): what an Event's choice came to
   * (before any bonus fight it starts), and what a Cache held. Nothing to
   * decide; the fallback is a no-op. */
  | Ask<'eventResult', { event: EventDefinition; choice: EventChoice; effect: EventEffect; text?: string; grant: EventGrant; heat: number }, null>
  | Ask<'cacheOpened', { contents: 'subroutine' | 'bundle' | 'mod'; data: number; burners: BurnerDefinition[] }, null>
  /** A trace evasion (session 63, docs/trace-evasion-design.md): its
   * start and end are notices; in between, the player's own decisions in
   * its plain Cribbage. The simulated player plays at its skill. */
  | Ask<'evasionStart', { enemy: EnemyDefinition; layer: number; enemyFill: number; headStart: number }, null>
  | Ask<'evasion', { request: CribbageRequest }, CribbageAnswer>
  | Ask<'evasionEnd', { enemy: EnemyDefinition; layer: number; result: EvasionResult }, null>
  /** One of the player's own decisions inside a fight. */
  | Ask<'combat', { request: CombatRequest }, CombatAnswer>
  /** A Safehouse visit: Rest or Merge. */
  | Ask<'safehouse', { playerState: RunPlayerState; heat: number }, SafehouseAction>
  /** Which owned piece a Merge upgrades (null: Rest instead). */
  | Ask<'mergeTarget', { playerState: RunPlayerState }, string | null>
  /** A shop-context Burner before the slates are drawn (null: none). */
  | Ask<'shopBurner', { burnerIds: BurnerId[]; playerState: RunPlayerState }, BurnerId | null>
  /** A Shop visit, one action at a time (milestone 3 checkpoint 4, the
   * user's call: buy freely): buy any offering you can afford, each once;
   * reroll each slate once; leave. Asked again after every action. */
  | Ask<'shop', { shop: ShopVisit; playerState: RunPlayerState }, ShopAction>
  /** An Event's choice. */
  | Ask<'event', { event: EventDefinition; playerState: RunPlayerState; heat: number; layer: number }, EventChoice>
  /** A reward pick after a win (null: decline). */
  | Ask<'reward', { reward: 'subroutine'; options: SubroutineDefinition[]; playerState: RunPlayerState }, SubroutineDefinition | null>
  | Ask<'reward', { reward: 'mod'; options: ModDefinition[]; playerState: RunPlayerState }, ModDefinition | null>
  | Ask<'reward', { reward: 'burner'; options: BurnerDefinition[]; playerState: RunPlayerState }, BurnerDefinition | null>
  /** An elite win's one choice (session 62): a subroutine OR a Mod.
   * `options` lists both (ids don't collide), for saves. */
  | Ask<
      'reward',
      { reward: 'eliteChoice'; options: (SubroutineDefinition | ModDefinition)[]; subroutines: SubroutineDefinition[]; mods: ModDefinition[]; playerState: RunPlayerState },
      SubroutineDefinition | ModDefinition | null
    >
  /** A Burner arriving at the carry cap (BURNER_CAP; the user's call,
   * session 58): which carried Burner to swap out for it, or null to keep
   * yours and leave the new one. The simulated player keeps its own. */
  | Ask<'burnerSwap', { incoming: BurnerDefinition; playerState: RunPlayerState }, BurnerId | null>
  /** The bench is over its cap (BENCH_CAP): which piece to drop -- a
   * bench piece, or an installed one, whose slot the newest bench piece
   * then takes (milestone 3 checkpoint 3). */
  | Ask<'drop', { playerState: RunPlayerState }, string>
  /** The loadout's firing order after an encounter: the reordered state. */
  | Ask<'reorder', { playerState: RunPlayerState }, RunPlayerState>;

export type ShopSlate = 'subroutine' | 'mod' | 'burner';

/** A Shop visit as it stands: the three slates, what's been bought
 * (indices into the current slates), which slates have been rerolled,
 * the Data left, and what a reroll costs this visit. */
export interface ShopVisit {
  slates: { subroutine: ShopOffering[]; mod: ModOffering[]; burner: BurnerOffering[] };
  bought: Record<ShopSlate, number[]>;
  rerolled: Record<ShopSlate, boolean>;
  data: number;
  rerollCost: number;
  /** Sold so far this visit (session 61): benched subroutine ids, banked
   * copies' ids and carried Burner ids, one entry per item sold. */
  sold: { subroutine: string[]; copy: string[]; burner: BurnerId[] };
}

export type ShopAction =
  | { kind: 'buy'; slate: ShopSlate; index: number }
  | { kind: 'reroll'; slate: ShopSlate }
  | { kind: 'sell'; item: 'subroutine'; id: string }
  | { kind: 'sell'; item: 'copy'; id: string }
  | { kind: 'sell'; item: 'burner'; id: BurnerId }
  | { kind: 'leave' };

/** A whole loadout, rearranged: which owned pieces are installed, in
 * firing order, and which sit on the bench (loadout.ts's arrangeLoadout
 * checks it). */
export interface LoadoutArrangement {
  arrange: { installed: string[]; bench: string[] };
}

/** A map Burner used from the map pause (Ghost Protocol: the next move
 * is free; Skeleton Key: reopen `targetNodeId`). */
export interface MapBurnerUse {
  useBurner: { burnerId: BurnerId; targetNodeId?: string };
}

export type MoveAnswer = string | LoadoutArrangement | MapBurnerUse;

/** A request's answer type. */
export type AnswerOf<R extends RunRequest> = ReturnType<R['fallback']>;

/** Yields one request and returns its answer, typed. */
export function* ask<R extends RunRequest>(request: R): Generator<RunRequest, AnswerOf<R>, unknown> {
  return (yield request) as AnswerOf<R>;
}

/** The simulation driver: answers every request with its fallback. */
export function driveWithFallbacks<T>(run: Generator<RunRequest, T, unknown>): T {
  let step = run.next();
  while (!step.done) step = run.next(step.value.fallback());
  return step.value;
}
