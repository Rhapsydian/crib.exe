import type { CombatAnswer, CombatResult } from '../engine/combat';
import type { EnemyDefinition } from '../engine/enemies';
import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
import { SYNERGY_AWARE_PROFILE } from '../engine/profiles';
import { opportunisticTraversal, runRequests, type RunResult } from '../engine/run';
import type { RunRequest } from '../engine/run-requests';
import { BURNER_DEFINITIONS } from '../engine/burners';
import { cloneKeepingPrototypes } from './live-fight.svelte';
import type { FightSession } from './fight-session';
import type { FightSnapshot } from './snapshot';

/**
 * The UI driver for a whole run (milestone 3 checkpoint 2): drives
 * run.ts's runRequests. The player answers map moves and their own fight
 * decisions; every other decision -- rewards, Safehouses, Shops, Events,
 * loadout order, what to drop -- is answered for now by the simulated
 * player's strategies (the synergy-aware profile, the same one the
 * balance sweeps use), and each such choice is noted so the screen can
 * say what was decided. Checkpoints 3 and 4 give those their own screens.
 */
export type RunPause =
  | { kind: 'move'; request: Extract<RunRequest, { kind: 'move' }> }
  | { kind: 'fight' }
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

  constructor(classId: ClassId, seed: number) {
    this.classId = classId;
    this.className = CLASS_DEFINITIONS[classId].name;
    this.seed = seed;
    this.#run = runRequests({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, playerSkill: 0.85 });
    this.#advance(this.#run.next());
  }

  /** The player's answer to what's paused: a node id for a move, a combat
   * answer inside a fight, or nothing to continue after a fight. */
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
          this.pause = { kind: 'move', request: r };
          return;
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
          const answer = r.fallback();
          const note = describeAuto(r, answer);
          if (note) this.notes = [...this.notes, note];
          step = this.#run.next(answer);
        }
      }
    }
    this.pause = { kind: 'over', result: step.value };
  }
}

/** A line for a decision answered for the player (null: not worth one). */
function describeAuto(r: RunRequest, answer: unknown): string | null {
  switch (r.kind) {
    case 'reward': {
      const picked = answer as { name: string } | null;
      return picked ? `took ${picked.name} (${r.reward} reward)` : `passed on a ${r.reward} reward`;
    }
    case 'safehouse':
      return answer === 'merge' ? 'Safehouse: merged' : 'Safehouse: rested (-Heat)';
    case 'mergeTarget':
      return answer ? `merged ${r.playerState.installedLoadout.concat(r.playerState.bench).find((p) => p.id === answer)?.name ?? answer}` : null;
    case 'shopBuy': {
      const bought = answer as { cost: number; piece?: { name: string }; mod?: { name: string }; burner?: { name: string } } | null;
      if (!bought) return null;
      const name = bought.piece?.name ?? bought.mod?.name ?? bought.burner?.name ?? 'something';
      return `Shop: bought ${name} (${bought.cost} Data)`;
    }
    case 'shopReroll':
      return answer ? `Shop: rerolled the ${r.slate} slate` : null;
    case 'event':
      return `Event "${r.event.name}": ${(answer as { label: string }).label}`;
    case 'drop':
      return `bench full: dropped ${r.playerState.bench.find((p) => p.id === answer)?.name ?? answer}`;
    case 'mapBurner':
    case 'shopBurner': {
      const id = r.kind === 'mapBurner' ? (answer as { burnerId: keyof typeof BURNER_DEFINITIONS } | null)?.burnerId : (answer as keyof typeof BURNER_DEFINITIONS | null);
      return id ? `used ${BURNER_DEFINITIONS[id].name}` : null;
    }
    default:
      return null;
  }
}
