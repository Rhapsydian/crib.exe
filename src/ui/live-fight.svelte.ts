import { combatGenerator, type CombatAnswer, type CombatOptions, type CombatRequest, type CombatResult } from '../engine/combat';
import { discardSkillStrategy, pegSkillStrategy } from '../engine/ai';
import { BREACH_THRESHOLD, CONTAINMENT_THRESHOLD, GAUGE_THRESHOLD } from '../engine/encounters';
import {
  enemyCombatOptions,
  enemySkill,
  gaugeThresholdFor,
  magnitudeScalerFor,
  OPENER_FIGHT_WINDOW,
  scaledEnemyLoadout,
  winThresholdFor,
  type EnemyDefinition,
} from '../engine/enemies';
import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
import type { BurnerId } from '../engine/burner-types';
import type { FightSnapshot, PlayerRequest } from './snapshot';
import type { FightSession } from './fight-session';
import { decisionFor, type SkillDecision } from './skill-review';

/**
 * The UI driver (P1): runs one real fight through `combatGenerator`.
 * The enemy's requests are answered at once by the same skill-dial AI a
 * real run uses; the player's discard and play requests stop the engine
 * until the screen answers them, as do Burner requests before the
 * player's own turns (they only come when the player carries a Burner;
 * the setup screen can give it one of each combat Burner). The engine
 * offers the carried Burners before the enemy's turns too; those are
 * declined, as the simulation does.
 *
 * Each pause publishes a fresh `frame` for the screen to draw. When the
 * fight ends, the last frame stays up behind the result.
 */
export interface FightSetup {
  classId: ClassId;
  enemy: EnemyDefinition;
  seed: number;
  carriedBurnerIds?: BurnerId[];
}

export class LiveFight implements FightSession {
  frame = $state.raw<FightSnapshot | null>(null);
  result = $state.raw<CombatResult | null>(null);

  readonly setup: FightSetup;
  readonly skill: SkillDecision[] = [];
  get enemyName(): string {
    return this.setup.enemy.name;
  }
  get detail(): string {
    return `seed ${this.setup.seed}`;
  }
  readonly #fight: Generator<CombatRequest, CombatResult, CombatAnswer>;
  readonly #enemyDiscard;
  readonly #enemyPlay;

  constructor(setup: FightSetup) {
    this.setup = setup;
    const { enemy, classId, seed } = setup;
    // A test-harness fight is pitched as the enemy's first layer, past
    // the opener window, matching encounters.ts's resolveFight.
    const layer = enemy.minLayer;
    const fightNumber = OPENER_FIGHT_WINDOW;
    const skill = enemySkill(enemy.tier, layer, fightNumber);
    this.#enemyDiscard = discardSkillStrategy(skill);
    this.#enemyPlay = pegSkillStrategy(skill);
    const options: CombatOptions = {
      seed,
      gaugeThreshold: [GAUGE_THRESHOLD, gaugeThresholdFor(enemy, layer, fightNumber, GAUGE_THRESHOLD)],
      winThreshold: [BREACH_THRESHOLD, winThresholdFor(enemy, layer, fightNumber, CONTAINMENT_THRESHOLD)],
      classId,
      ...enemyCombatOptions(enemy),
      carriedBurnerIds: setup.carriedBurnerIds ?? [],
    };
    const enemyLoadout = scaledEnemyLoadout(enemy.loadout, magnitudeScalerFor(enemy, layer, fightNumber));
    this.#fight = combatGenerator([CLASS_DEFINITIONS[classId].startingLoadout, enemyLoadout], options);
    this.#run(this.#fight.next());
  }

  /** The player's answer to the current request. */
  answer(answer: CombatAnswer): void {
    if (!this.frame || this.result) return;
    const decision = decisionFor(this.frame.request, answer);
    if (decision) this.skill.push(decision);
    this.#run(this.#fight.next(answer));
  }

  #run(step: IteratorResult<CombatRequest, CombatResult>): void {
    while (!step.done) {
      const r = step.value;
      if (r.side === 0) {
        this.frame = this.#frameFor(r);
        return;
      }
      step = this.#fight.next(this.#aiAnswer(r));
    }
    this.result = step.value;
  }

  #aiAnswer(r: CombatRequest): CombatAnswer {
    if (r.kind === 'burner') return null;
    return r.kind === 'discard' ? this.#enemyDiscard(r.context) : this.#enemyPlay(r.context);
  }

  // The engine mutates one combat state in place, so each frame gets its
  // own copy: new object identities are what tell Svelte to redraw.
  #frameFor(request: PlayerRequest): FightSnapshot {
    const { classId, enemy } = this.setup;
    return { request: cloneKeepingPrototypes(request), classId, className: CLASS_DEFINITIONS[classId].name, enemy };
  }
}

/** A deep copy that keeps class instances (the gauges) working. */
export function cloneKeepingPrototypes<T>(value: T, seen = new Map<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value) as T;
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);
    for (const v of value) out.push(cloneKeepingPrototypes(v, seen));
    return out as T;
  }
  const out = Object.create(Object.getPrototypeOf(value));
  seen.set(value, out);
  for (const key of Object.keys(value)) out[key] = cloneKeepingPrototypes((value as Record<string, unknown>)[key], seen);
  return out;
}
