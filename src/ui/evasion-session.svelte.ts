import type { CribbageAnswer, CribbageGameResult, CribbageRequest } from '../engine/basic-cribbage';
import type { EvasionResult } from '../engine/evasion';
import { EVASION_HANDS } from '../engine/evasion';
import type { CribbageFrame } from './live-cribbage.svelte';
import { cribbageBeats } from './cribbage-steps';
import { mergeSteps, type Step } from './timeline';

/**
 * A trace evasion inside a run (session 63, docs/design/trace-evasion.md),
 * as the Cribbage screen reads it: the run's engine plays it (the
 * gatekeeper's decisions answered there), and each of your decisions
 * arrives here as a frame. Your answers go back to the run, which saves
 * them like any other.
 */
export class RunEvasion {
  frame = $state.raw<CribbageFrame | null>(null);
  result = $state.raw<CribbageGameResult | null>(null);
  finalSteps = $state.raw<Step[]>([]);
  escaped = $state<boolean | null>(null);
  readonly enemyName: string;
  readonly headStart: number;
  readonly enemyFill: number;
  readonly layer: number;
  readonly hands = EVASION_HANDS;
  // What the Cribbage screen also reads: no coach here (TE8).
  readonly difficulty = 'normal' as const;
  coach = $state(false);
  hints = $state(true);
  readonly lastPlay = null;
  readonly lastDiscard = null;
  readonly #answer: (a: CribbageAnswer) => void;

  constructor(enemyName: string, headStart: number, enemyFill: number, layer: number, answer: (a: CribbageAnswer) => void) {
    this.enemyName = enemyName;
    this.headStart = headStart;
    this.enemyFill = enemyFill;
    this.layer = layer;
    this.#answer = answer;
  }

  answer(answer: CribbageAnswer): void {
    this.#answer(answer);
  }

  /** One of your decisions, paused. */
  show(r: CribbageRequest): void {
    // Copies: the engine keeps writing to its own arrays.
    const request = (r.kind === 'play' ? { ...r, pegging: { ...r.pegging, events: r.pegging.events.slice() } } : r) as CribbageFrame['request'];
    this.frame = { request, steps: mergeSteps(cribbageBeats(r.view.timeline.slice()), []) };
  }

  /** The evasion's end. */
  finish(result: EvasionResult): void {
    this.escaped = result.escaped;
    this.result = { winner: result.escaped ? 0 : 1, finalScores: result.finalScores, hands: this.hands, skunk: 'none', timeline: result.timeline };
    this.finalSteps = mergeSteps(cribbageBeats(result.timeline), []);
    this.frame = null;
  }
}
