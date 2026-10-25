import type { CombatAnswer, CombatRequest, CombatResult } from '../engine/combat';
import { RunEvasion } from './evasion-session.svelte';
import { TUTORIAL_OPTIONS } from '../engine/tutorial';
import type { EnemyDefinition } from '../engine/enemies';
import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
import { SYNERGY_AWARE_PROFILE } from '../engine/profiles';
import { gatekeeperReachable, opportunisticTraversal, runRequests, type RunPlayerState, type RunResult } from '../engine/run';
import { currentHeatCeiling } from '../engine/heat';
import { GHOST_CREDENTIALS_FIGHT_HEAT, HEAT_SINK_HEAT_REFUND } from '../engine/mods';
import { tips } from './tips.svelte';
import type { RunRequest } from '../engine/run-requests';
import { BURNER_DEFINITIONS } from '../engine/burners';
import { acquireSubroutine } from '../engine/loadout';
import { cloneKeepingPrototypes } from './live-fight.svelte';
import type { FightHeatContext, FightSession } from './fight-session';
import type { FightSnapshot } from './snapshot';
import { decisionFor, type SkillDecision } from './skill-review';
import type { RunSetup } from '../engine/meta';
import type { EventChoice } from '../engine/event-types';
import { SAVE_VERSION, decodeCombat, encodeCombat, type RunSave, type SavedAnswer } from './run-save';

/** A run's id (session 71): unique enough to award Rep once per run. */
const newRunId = () => `${Date.now().toString(36)}-${Math.floor(Math.random() * 2 ** 31).toString(36)}`;

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
  /** A trace evasion (session 63): its intro card, then the game. */
  | { kind: 'evasionStart'; request: Extract<RunRequest, { kind: 'evasionStart' }> }
  | { kind: 'evasion'; request: Extract<RunRequest, { kind: 'evasion' | 'evasionEnd' }> }
  | { kind: 'reward'; request: Extract<RunRequest, { kind: 'reward' }>; gained: number }
  | { kind: 'drop'; request: Extract<RunRequest, { kind: 'drop' }> }
  | { kind: 'burnerSwap'; request: Extract<RunRequest, { kind: 'burnerSwap' }> }
  | { kind: 'safehouse'; request: Extract<RunRequest, { kind: 'safehouse' }> }
  | { kind: 'shopBurner'; request: Extract<RunRequest, { kind: 'shopBurner' }> }
  | { kind: 'shop'; request: Extract<RunRequest, { kind: 'shop' }> }
  | { kind: 'event'; request: Extract<RunRequest, { kind: 'event' }> }
  | { kind: 'notice'; request: Extract<RunRequest, { kind: 'eventResult' | 'cacheOpened' | 'burnerSaved' }>; layer: number }
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
  readonly skill: SkillDecision[] = [];

  readonly heat: FightHeatContext;

  constructor(enemy: EnemyDefinition, tier: 'regular' | 'elite' | 'gatekeeper', layer: number, player: RunPlayerState, answer: (a: CombatAnswer) => void) {
    this.heat = {
      heat: player.heat ?? 0,
      allowance: player.heatAllowance ?? currentHeatCeiling(player),
      tier,
      layerIndex: layer - 1,
      refund: tier !== 'regular' && player.ownedModIds.includes('heat-sink') ? HEAT_SINK_HEAT_REFUND : 0,
      multiplier: (player.ownedModIds.includes('ghost-credentials') ? GHOST_CREDENTIALS_FIGHT_HEAT : 1) * (player.meta?.fightHeat ?? 1),
    };
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
  /** The trace evasion being played, if any (session 63). */
  evasion = $state.raw<RunEvasion | null>(null);
  /** How many fights this run has started (keys each fight's screen). */
  fights = $state(0);
  /** Every discard and pegging play of the run, for the review coach
   * (session 70); a resumed run rebuilds it as its answers replay. */
  readonly skill: SkillDecision[] = [];
  /** Decisions answered for the player for now, newest last. */
  notes = $state.raw<string[]>([]);

  readonly classId: ClassId;
  readonly className: string;
  readonly seed: number;
  /** Which run this is (Rep is awarded once per id), and what it started
   * with from the profile (session 71); both saved. */
  readonly id: string;
  readonly setup: RunSetup;
  readonly #run: Generator<RunRequest, RunResult, unknown>;
  /** Data before the current encounter, so the first reward after it can
   * say what it paid. */
  #dataMark = 0;
  /** The layer the run is on (1-based), for screens that price by it. */
  #layer = 1;
  /** The piece the Safehouse screen chose to Merge, answered when the run
   * asks for the target. */
  #mergeTarget: string | null = null;
  /** Every answer the player has given, in plain data -- the save
   * (run-save.ts). */
  readonly answers: SavedAnswer[] = [];
  /** Called after each answer, to write the save. */
  onsave: (() => void) | null = null;

  /** The guided first run (session 63): its fixed class, seed and layer
   * (engine/tutorial.ts), the coach, and its own ending. */
  readonly tutorial: boolean;

  constructor(classId: ClassId, seed: number, tutorial = false, setup: RunSetup = {}, id = newRunId()) {
    this.id = id;
    this.setup = setup;
    this.classId = classId;
    this.className = CLASS_DEFINITIONS[classId].name;
    this.seed = seed;
    this.tutorial = tutorial;
    this.#run = runRequests({
      ...SYNERGY_AWARE_PROFILE,
      seed,
      classId,
      traversalStrategy: opportunisticTraversal,
      playerSkill: 0.85,
      subroutineAcquirer: acquireSubroutine,
      // The profile's upgrades and starting picks (session 71); a
      // tutorial plays without them.
      ...(tutorial ? TUTORIAL_OPTIONS : { setup }),
    });
    this.#advance(this.#run.next());
  }

  /** A run rebuilt from a save: its answers replayed into a fresh run.
   * Null if any answer no longer fits (the game changed under the save). */
  static resume(save: RunSave): LiveRun | null {
    const run = new LiveRun(save.classId, save.seed, save.tutorial ?? false, save.setup, save.id);
    for (const saved of save.answers) if (!run.#replay(saved)) return null;
    return run;
  }

  /** The save as it stands. */
  get save(): RunSave {
    return {
      version: SAVE_VERSION,
      classId: this.classId,
      seed: this.seed,
      tutorial: this.tutorial || undefined,
      id: this.id,
      setup: this.setup,
      answers: this.answers,
      summary: { className: this.tutorial ? `the tutorial (${this.className})` : this.className, layer: this.#layer, savedAt: Date.now() },
    };
  }

  /** A Safehouse choice: Rest, or Merge `targetId`. */
  chooseSafehouse(action: 'rest' | 'merge', targetId?: string): void {
    this.#mergeTarget = action === 'merge' ? (targetId ?? null) : null;
    this.answer(action);
  }

  /** The player's answer to what's paused: a node id for a move (or a
   * LoadoutArrangement or MapBurnerUse), a combat answer inside a fight,
   * nothing to continue after a fight or a notice, a reward pick (or
   * null), a piece id to drop, a Burner id to swap out (or null), a Shop
   * action, an Event choice. */
  answer(answer: unknown): void {
    if (!this.pause || this.pause.kind === 'over') return;
    this.answers.push(this.#encode(answer));
    if (this.pause.kind === 'fight' && this.fight?.frame && !this.fight.result) {
      const decision = decisionFor(this.fight.frame.request, answer as CombatAnswer);
      if (decision) this.fight.skill.push(decision), this.skill.push(decision);
    }
    if (this.pause.kind === 'fight' && this.fight?.result) this.fight = null;
    if (this.pause.kind === 'evasion' && this.pause.request.kind === 'evasionEnd') this.evasion = null;
    this.#advance(this.#run.next(answer));
    this.onsave?.();
  }

  /** An answer to the current pause, in plain data (run-save.ts). */
  #encode(answer: unknown): SavedAnswer {
    const pause = this.pause!;
    switch (pause.kind) {
      case 'fight':
        return this.fight?.result || !this.fight?.frame ? { k: 'fightEnd', a: null } : encodeCombat(this.fight.frame.request, answer);
      case 'evasion':
        return pause.request.kind === 'evasionEnd' ? { k: 'evasionEnd', a: null } : encodeCombat(pause.request.request as unknown as CombatRequest, answer as CombatAnswer);
      case 'reward':
        return { k: 'reward', a: answer ? (answer as { id: string }).id : null };
      case 'event':
        return { k: 'event', a: (answer as EventChoice).id };
      case 'safehouse':
        return { k: 'safehouse', a: { action: answer, target: this.#mergeTarget } };
      default:
        return { k: pause.kind, a: answer ?? null };
    }
  }

  /** Replays one saved answer; false if it no longer fits the pause. */
  #replay(saved: SavedAnswer): boolean {
    const pause = this.pause;
    if (!pause || pause.kind === 'over') return false;
    if (pause.kind === 'fight') {
      if (this.fight?.result || !this.fight?.frame) {
        if (saved.k !== 'fightEnd') return false;
        this.answer(null);
        return true;
      }
      const answer = decodeCombat(this.fight.frame.request, saved);
      if (answer === undefined) return false;
      this.answer(answer);
      return true;
    }
    if (pause.kind === 'evasion') {
      if (pause.request.kind === 'evasionEnd') {
        if (saved.k !== 'evasionEnd') return false;
        this.answer(null);
        return true;
      }
      const answer = decodeCombat(pause.request.request as unknown as CombatRequest, saved);
      if (answer === undefined) return false;
      this.answer(answer);
      return true;
    }
    if (saved.k !== pause.kind) return false;
    switch (pause.kind) {
      case 'reward': {
        if (saved.a === null) return this.answer(null), true;
        const option = (pause.request.options as { id: string }[]).find((o) => o.id === saved.a);
        if (!option) return false;
        this.answer(option);
        return true;
      }
      case 'event': {
        const choice = pause.request.event.choices.find((c) => c.id === saved.a);
        if (!choice) return false;
        this.answer(choice);
        return true;
      }
      case 'safehouse': {
        const { action, target } = saved.a as { action: 'rest' | 'merge'; target: string | null };
        this.chooseSafehouse(action, target ?? undefined);
        return true;
      }
      default:
        this.answer(saved.a);
        return true;
    }
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
        case 'burnerSaved':
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
        case 'evasionStart':
          this.evasion = new RunEvasion(r.enemy.name, r.headStart, r.enemyFill, r.layer, (a) => this.answer(a));
          this.pause = { kind: 'evasionStart', request: r };
          return;
        case 'evasion':
          this.evasion!.show(r.request);
          this.pause = { kind: 'evasion', request: r };
          return;
        case 'evasionEnd':
          this.evasion!.finish(r.result);
          this.pause = { kind: 'evasion', request: r };
          return;
        case 'reorder':
          // Your order stands: the loadout is yours to arrange on the map.
          step = this.#run.next(r.playerState);
          continue;
        case 'fightStart':
          this.fights++;
          this.fight = new RunFight(r.enemy, r.tier, r.layer, r.playerState, (a) => this.answer(a));
          // Bigger gauges deep (session 68, E9): their first time on layers 3 and 4.
          if (r.tier !== 'regular' && r.layer >= 3) tips.offer(r.layer === 3 ? 'gauges3' : 'gauges4');
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
