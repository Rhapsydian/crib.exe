import type { Card } from '../engine/cards';
import { cribbageGame, DIFFICULTIES, type CribbageAnswer, type CribbageGameResult, type CribbageRequest, type Difficulty } from '../engine/basic-cribbage';
import { discardSkillStrategy, pegSkillStrategy } from '../engine/ai';
import type { CombatRequest } from '../engine/combat';
import { cribbageBeats } from './cribbage-steps';
import { mergeSteps, type Step } from './timeline';
import { decodeCombat, encodeCombat, type SavedAnswer } from './run-save';

/**
 * The UI driver for a game of vanilla Cribbage (milestone 4 checkpoint
 * 3): drives basic-cribbage.ts's cribbageGame. The player answers their
 * own discards and pegging cards; the opponent is answered here by the
 * AI at the difficulty's skill (V2). Each pause hands the screen the
 * game so far as fight-timeline steps (cribbage-steps.ts), which the
 * replay plays out.
 *
 * Saves work like a run's (run-save.ts): the game is a function of its
 * seed, difficulty and the player's answers, so a save stores those and
 * resuming replays them.
 */
export interface CribbageFrame {
  /** Always side 0's (the player's). */
  request: CribbageRequest;
  steps: Step[];
}

export interface CribbageSave {
  version: number;
  difficulty: Difficulty;
  coach: boolean;
  seed: number;
  answers: SavedAnswer[];
  summary: { scores: [number, number]; savedAt: number };
}

export const CRIBBAGE_SAVE_VERSION = 1;
const KEY = 'cribexe.cribbage';

export function loadCribbageSave(): CribbageSave | null {
  try {
    const raw = localStorage.getItem(KEY);
    const save = raw ? (JSON.parse(raw) as CribbageSave) : null;
    return save && save.version === CRIBBAGE_SAVE_VERSION && Array.isArray(save.answers) ? save : null;
  } catch {
    return null;
  }
}
export function writeCribbageSave(save: CribbageSave): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Storage blocked or full: play on unsaved.
  }
}
export function clearCribbageSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

export class LiveCribbage {
  /** The player's decision now due (null once the game is over). */
  frame = $state.raw<CribbageFrame | null>(null);
  result = $state.raw<CribbageGameResult | null>(null);
  /** The whole game as steps, at the end. */
  finalSteps = $state.raw<Step[]>([]);
  readonly difficulty: Difficulty;
  /** The coach (V3), switchable mid-game. */
  coach = $state(false);
  readonly seed: number;
  /** The player's latest discard -- the six dealt and the two thrown --
   * for the coach's review. */
  lastDiscard = $state.raw<{ handIndex: number; hand: Card[]; thrown: [Card, Card]; ownCrib: boolean } | null>(null);
  /** The player's latest pegging card, with the table as it stood. */
  lastPlay = $state.raw<{ handIndex: number; legal: Card[]; count: number; sequence: Card[]; played: Card } | null>(null);
  readonly answers: SavedAnswer[] = [];
  onsave: (() => void) | null = null;
  readonly #game: Generator<CribbageRequest, CribbageGameResult, CribbageAnswer>;
  readonly #discard;
  readonly #play;

  constructor(difficulty: Difficulty, coach: boolean, seed: number) {
    this.difficulty = difficulty;
    this.coach = coach;
    this.seed = seed;
    const skill = DIFFICULTIES[difficulty].skill;
    this.#discard = discardSkillStrategy(skill);
    this.#play = pegSkillStrategy(skill);
    this.#game = cribbageGame({ seed });
    this.#advance(this.#game.next());
  }

  static resume(save: CribbageSave): LiveCribbage | null {
    const game = new LiveCribbage(save.difficulty, save.coach, save.seed);
    for (const saved of save.answers) {
      const request = game.frame?.request;
      if (!request) return null;
      const answer = decodeCombat(request as unknown as CombatRequest, saved);
      if (answer === undefined) return null;
      game.answer(answer as CribbageAnswer);
    }
    return game;
  }

  get save(): CribbageSave {
    const scores = this.frame?.request.view.scores ?? this.result?.finalScores ?? [0, 0];
    return { version: CRIBBAGE_SAVE_VERSION, difficulty: this.difficulty, coach: this.coach, seed: this.seed, answers: this.answers, summary: { scores: [scores[0], scores[1]], savedAt: Date.now() } };
  }

  /** The player's discard (two cards) or pegging card. */
  answer(answer: CribbageAnswer): void {
    const request = this.frame?.request;
    if (!request) return;
    this.answers.push(encodeCombat(request as unknown as CombatRequest, answer));
    if (request.kind === 'play') this.lastPlay = { handIndex: request.view.handIndex, legal: request.context.legalCards, count: request.context.count, sequence: request.context.sequence, played: answer as Card };
    if (request.kind === 'discard') this.lastDiscard = { handIndex: request.view.handIndex, hand: request.context.hand, thrown: answer as [Card, Card], ownCrib: request.view.dealer === 0 };
    this.#advance(this.#game.next(answer));
    this.onsave?.();
  }

  #advance(step: IteratorResult<CribbageRequest, CribbageGameResult>): void {
    while (!step.done) {
      const r = step.value;
      if (r.side === 1) {
        // The opponent, at the difficulty's skill.
        step = this.#game.next(r.kind === 'discard' ? this.#discard(r.context) : this.#play(r.context));
        continue;
      }
      // Copies: the engine keeps writing to its own arrays.
      const request = (r.kind === 'play' ? { ...r, pegging: { ...r.pegging, events: r.pegging.events.slice() } } : r) as CribbageFrame['request'];
      this.frame = { request, steps: mergeSteps(cribbageBeats(r.view.timeline.slice()), []) };
      return;
    }
    this.result = step.value;
    this.finalSteps = mergeSteps(cribbageBeats(step.value.timeline), []);
    this.frame = null;
  }
}
