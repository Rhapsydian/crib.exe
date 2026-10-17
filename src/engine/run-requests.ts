import type { BurnerDefinition, BurnerId } from './burner-types';
import type { CombatAnswer, CombatRequest } from './combat';
import type { EventChoice, EventDefinition } from './event-types';
import type { LayerGraph, RunPosition } from './map-types';
import type { ModDefinition } from './mod-types';
import type { SafehouseAction } from './merge';
import type { MapBurnerActivationContext, RunPlayerState } from './run';
import type { BurnerOffering, ModOffering, ShopOffering } from './shop';
import type { SubroutineDefinition } from './subroutine-types';

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
  /** Where to move next: a linked node's id. */
  | Ask<'move', { graph: LayerGraph; position: RunPosition; heat: number; playerState: RunPlayerState }, string>
  /** One of the player's own decisions inside a fight. */
  | Ask<'combat', { request: CombatRequest }, CombatAnswer>
  /** A Safehouse visit: Rest or Merge. */
  | Ask<'safehouse', { playerState: RunPlayerState; heat: number }, SafehouseAction>
  /** Which owned piece a Merge upgrades (null: Rest instead). */
  | Ask<'mergeTarget', { playerState: RunPlayerState }, string | null>
  /** A shop-context Burner before the slates are drawn (null: none). */
  | Ask<'shopBurner', { burnerIds: BurnerId[]; playerState: RunPlayerState }, BurnerId | null>
  /** Whether to reroll a slate, once, after seeing its first draw. */
  | Ask<'shopReroll', { slate: 'subroutine'; offerings: ShopOffering[]; playerState: RunPlayerState }, boolean>
  | Ask<'shopReroll', { slate: 'mod'; offerings: ModOffering[]; playerState: RunPlayerState }, boolean>
  | Ask<'shopReroll', { slate: 'burner'; offerings: BurnerOffering[]; playerState: RunPlayerState }, boolean>
  /** What to buy from a slate (null: nothing). */
  | Ask<'shopBuy', { slate: 'subroutine'; offerings: ShopOffering[]; playerState: RunPlayerState }, ShopOffering | null>
  | Ask<'shopBuy', { slate: 'mod'; offerings: ModOffering[]; playerState: RunPlayerState }, ModOffering | null>
  | Ask<'shopBuy', { slate: 'burner'; offerings: BurnerOffering[]; playerState: RunPlayerState }, BurnerOffering | null>
  /** An Event's choice. */
  | Ask<'event', { event: EventDefinition; playerState: RunPlayerState; heat: number }, EventChoice>
  /** A reward pick after a win (null: decline). */
  | Ask<'reward', { reward: 'subroutine'; options: SubroutineDefinition[]; playerState: RunPlayerState }, SubroutineDefinition | null>
  | Ask<'reward', { reward: 'mod'; options: ModDefinition[]; playerState: RunPlayerState }, ModDefinition | null>
  | Ask<'reward', { reward: 'burner'; options: BurnerDefinition[]; playerState: RunPlayerState }, BurnerDefinition | null>
  /** The bench is over its cap (BENCH_CAP): which bench piece to drop. */
  | Ask<'drop', { playerState: RunPlayerState }, string>
  /** The loadout's firing order after an encounter: the reordered state. */
  | Ask<'reorder', { playerState: RunPlayerState }, RunPlayerState>;

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
