import type { CombatAnswer, CombatResult } from '../engine/combat';
import type { EnemyDefinition } from '../engine/enemies';
import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
import { SYNERGY_AWARE_PROFILE } from '../engine/profiles';
import { gatekeeperReachable, opportunisticTraversal, runRequests, type RunResult } from '../engine/run';
import type { RunRequest } from '../engine/run-requests';
import { BURNER_DEFINITIONS } from '../engine/burners';
import { acquireSubroutine } from '../engine/loadout';
import { cloneKeepingPrototypes } from './live-fight.svelte';
import type { FightSession } from './fight-session';
import type { FightSnapshot } from './snapshot';

/**
 * The UI driver for a whole run (milestone 3 checkpoints 2-4): drives
 * run.ts's runRequests. The player answers map moves (or rearranges the
 * loadout, or uses a map Burner, there), their own fight decisions,
 * rewards, what to drop from a full bench, which Burner to swap out at
 * the carry cap, Safehouses, Shops and Events. What's left -- the
 * pre-move map Burner ask (answered "no" unless the gatekeeper is cut off,
 * when the simulated player's rescue is used and noted) and the Merge
 * target (taken from the Safehouse screen's pick) -- is answered here.
 *
 * Two of the simulated player's habits are switched off for a person: a
 * new piece is never swapped in automatically (it installs if there's
 * room, or waits on the bench), and the loadout is never reordered for
 * you (the engine's after-encounter reorder keeps your order).
 */
export type RunPause =
  | { kind: 'move'; request: Extract<RunRequest, { kind: 'move' }> }
  | { kind: 'fight' }
  | { kind: 'reward'; request: Extract<RunRequest, { kind: 'reward' }>; gained: number }
  | { kind: 'drop'; request: Extract<RunRequest, { kind: 'drop' }> }
  | { kind: 'burnerSwap'; request: Extract<RunRequest, { kind: 'burnerSwap' }> }
  | { kind: 'safehouse'; request: Extract<RunRequest, { kind: 'safehouse' }> }
  | { kind: 'shopBurner'; request: Extract<RunRequest, { kind: 'shopBurner' }> }
  | { kind: 'shop'; request: Extract<RunRequest, { kind: 'shop' }> }
  | { kind: 'event'; request: Extract<RunRequest, { kind: 'event' }> }
  | { kind: 'notice'; request: Extract<RunRequest, { kind: 'eventResult' | 'cacheOpened' }>; layer: number }
  | { kind: 'over'; result: RunResult };

/** A fight inside the run, as the fight screen sees it. */
class RunFight implements FightSession {
  frame = $state.raw<FightSnapshot | null>(null);
  result = $state.raw<CombatResult | null>(null);
  readonly enemyName: string;
  readonly detail: string;
  readonly enemy: EnemyDefinition;
  readonly tier: 'regular' | 'elite' | 'gatekeeper';
  readonly #answer: (a: CombatAnswer) => void;

  constructor(enemy: EnemyDefinition, tier: 'regular' | 'elite' | 'gatekeeper', layer: number, answer: (a: CombatAnswer) => void) {
    this.enemy = enemy;
    this.tier = tier;
    this.enemyName = enemy.name;
    this.detail = `${tier} · layer ${layer}`;
    this.#answer = answer;
  }

  answer(answer: CombatAnswer): void {
    this.#answer(answer);
  }
}

export class LiveRun {
  pause = $state.raw<RunPause | null>(null);
  fight = $state.raw<RunFight | null>(null);
  /** How many fights this run has started (keys each fight's screen). */
  fights = $state(0);
  /** Decisions answered for the player for now, newest last. */
  notes = $state.raw<string[]>([]);

  readonly classId: ClassId;
  readonly className: string;
  readonly seed: number;
  readonly #run: Generator<RunRequest, RunResult, unknown>;
  /** Data before the current encounter, so the first reward after it can
   * say what it paid. */
  #dataMark = 0;
  /** The layer the run is on (1-based), for screens that price by it. */
  #layer = 1;
  /** The piece the Safehouse screen chose to Merge, answered when the run
   * asks for the target. */
  #mergeTarget: string | null = null;

  constructor(classId: ClassId, seed: number) {
    this.classId = classId;
    this.className = CLASS_DEFINITIONS[classId].name;
    this.seed = seed;
    this.#run = runRequests({
      ...SYNERGY_AWARE_PROFILE,
      seed,
      classId,
      traversalStrategy: opportunisticTraversal,
      playerSkill: 0.85,
      subroutineAcquirer: acquireSubroutine,
    });
    this.#advance(this.#run.next());
  }

  /** The player's answer to what's paused: a node id for a move (or a
   * LoadoutArrangement), a combat answer inside a fight, nothing to
   * continue after a fight, a reward pick (or null), a piece id to drop, a
   * Burner id to swap out (or null). */
  /** A Safehouse choice: Rest, or Merge `targetId`. */
  chooseSafehouse(action: 'rest' | 'merge', targetId?: string): void {
    this.#mergeTarget = action === 'merge' ? (targetId ?? null) : null;
    this.answer(action);
  }

  answer(answer: unknown): void {
    if (!this.pause || this.pause.kind === 'over') return;
    if (this.pause.kind === 'fight' && this.fight?.result) this.fight = null;
    this.#advance(this.#run.next(answer));
  }

  #advance(step: IteratorResult<RunRequest, RunResult>): void {
    while (!step.done) {
      const r = step.value;
      switch (r.kind) {
        case 'move':
          this.#dataMark = r.playerState.data;
          this.#layer = r.position.layerIndex + 1;
          this.pause = { kind: 'move', request: r };
          return;
        case 'reward': {
          // The first reward after an encounter carries the Data it paid.
          const gained = r.playerState.data - this.#dataMark;
          this.#dataMark = r.playerState.data;
          this.pause = { kind: 'reward', request: r, gained };
          return;
        }
        case 'drop':
          this.pause = { kind: 'drop', request: r };
          return;
        case 'burnerSwap':
          this.pause = { kind: 'burnerSwap', request: r };
          return;
        case 'safehouse':
          this.pause = { kind: 'safehouse', request: r };
          return;
        case 'mergeTarget':
          step = this.#run.next(this.#mergeTarget);
          this.#mergeTarget = null;
          continue;
        case 'shopBurner':
          this.pause = { kind: 'shopBurner', request: r };
          return;
        case 'shop':
          this.pause = { kind: 'shop', request: r };
          return;
        case 'event':
          this.pause = { kind: 'event', request: r };
          return;
        case 'eventResult':
        case 'cacheOpened':
          this.pause = { kind: 'notice', request: r, layer: this.#layer };
          return;
        case 'mapBurner': {
          // Map Burners are used from the map (a move-pause answer); here
          // only the rescue: with the gatekeeper cut off, the run would end
          // before the map, so the simulated player's choice (a Skeleton
          // Key) is used and noted.
          const { graph, position } = r.context;
          const rescue = gatekeeperReachable(graph, position.nodeId) ? null : r.fallback();
          if (rescue) this.notes = [...this.notes, `used ${BURNER_DEFINITIONS[rescue.burnerId].name} to reopen a route`];
          step = this.#run.next(rescue);
          continue;
        }
        case 'reorder':
          // Your order stands: the loadout is yours to arrange on the map.
          step = this.#run.next(r.playerState);
          continue;
        case 'fightStart':
          this.fights++;
          this.fight = new RunFight(r.enemy, r.tier, r.layer, (a) => this.answer(a));
          step = this.#run.next(null);
          continue;
        case 'combat': {
          const fight = this.fight!;
          const request = cloneKeepingPrototypes(r.request);
          fight.frame = { request, classId: this.classId, className: this.className, enemy: fight.enemy };
          this.pause = { kind: 'fight' };
          return;
        }
        case 'fightEnd':
          if (this.fight) this.fight.result = cloneKeepingPrototypes(r.result);
          this.pause = { kind: 'fight' };
          return;
        default: {
          // Every kind is handled above; a new one surfaces here as a type
          // error, and at run time falls back to the simulated player.
          const unhandled: never = r;
          step = this.#run.next((unhandled as RunRequest).fallback());
        }
      }
    }
    this.pause = { kind: 'over', result: step.value };
  }
}
