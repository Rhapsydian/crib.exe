import type { Card } from '../engine/cards';
import { cribbageGame, DIFFICULTIES, type CribbageAnswer, type CribbageGameResult, type CribbageRequest, type Difficulty } from '../engine/basic-cribbage';
import { discardSkillStrategy, pegSkillStrategy, pegTableOf } from '../engine/ai';
import type { CombatRequest } from '../engine/combat';
import { cribbageBeats } from './cribbage-steps';
import { mergeSteps, type Step } from './timeline';
import { decodeCombat, encodeCombat, type SavedAnswer } from './run-save';
import type { SkillDecision } from './skill-review';
import type { PegSpot } from './coach';

/** A pegging request as the coach reads it (coach.ts's PegSpot). */
export function pegSpot(request: Extract<CribbageRequest, { kind: 'play' }>): PegSpot {
  // The engine's own reading (ai.ts pegTableOf; session 72: one AI).
  return pegTableOf(request.context);
}

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
  /** Coach suggestions before you choose (absent in older saves: on). */
  hints?: boolean;
  seed: number;
  answers: SavedAnswer[];
  summary: { scores: [number, number]; savedAt: number };
}

export const CRIBBAGE_SAVE_VERSION = 1;
export const CRIBBAGE_SAVE_KEY = 'cribexe.cribbage';
const KEY = CRIBBAGE_SAVE_KEY;

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
  /** The coach's suggestions before you choose (the user's call); with
   * them off the coach still explains and reviews afterwards. */
  hints = $state(true);
  readonly seed: number;
  /** The player's latest discard -- the six dealt and the two thrown --
   * for the coach's review. */
  lastDiscard = $state.raw<{ handIndex: number; hand: Card[]; thrown: [Card, Card]; ownCrib: boolean } | null>(null);
  /** The player's latest pegging card, with the table as it stood. */
  lastPlay = $state.raw<{ handIndex: number; spot: PegSpot; played: Card } | null>(null);
  readonly answers: SavedAnswer[] = [];
  /** Every discard and pegging card the player chose, for the game's
   * Cribbage rating at the end (session 72, the user: stars in vanilla
   * games too). Rebuilt on resume, as the answers replay. */
  readonly skill: SkillDecision[] = [];
  /** Rebuilt from a save: the screen opens at the present, not replaying
   * the game from the first deal (session 72, the user; fights do the same). */
  resumed = false;
  onsave: (() => void) | null = null;
  readonly #game: Generator<CribbageRequest, CribbageGameResult, CribbageAnswer>;
  readonly #discard;
  readonly #play;

  constructor(difficulty: Difficulty, coach: boolean, seed: number, hints = true) {
    this.difficulty = difficulty;
    this.coach = coach;
    this.hints = hints;
    this.seed = seed;
    const skill = DIFFICULTIES[difficulty].skill;
    this.#discard = discardSkillStrategy(skill);
    this.#play = pegSkillStrategy(skill);
    this.#game = cribbageGame({ seed });
    this.#advance(this.#game.next());
  }

  static resume(save: CribbageSave): LiveCribbage | null {
    const game = new LiveCribbage(save.difficulty, save.coach, save.seed, save.hints ?? true);
    for (const saved of save.answers) {
      const request = game.frame?.request;
      if (!request) return null;
      const answer = decodeCombat(request as unknown as CombatRequest, saved);
      if (answer === undefined) return null;
      game.answer(answer as CribbageAnswer);
    }
    game.resumed = true;
    return game;
  }

  get save(): CribbageSave {
    const scores = this.frame?.request.view.scores ?? this.result?.finalScores ?? [0, 0];
    return { version: CRIBBAGE_SAVE_VERSION, difficulty: this.difficulty, coach: this.coach, hints: this.hints, seed: this.seed, answers: this.answers, summary: { scores: [scores[0], scores[1]], savedAt: Date.now() } };
  }

  /** The player's discard (two cards) or pegging card. */
  answer(answer: CribbageAnswer): void {
    const request = this.frame?.request;
    if (!request) return;
    this.answers.push(encodeCombat(request as unknown as CombatRequest, answer));
    if (request.kind === 'play') {
      this.lastPlay = { handIndex: request.view.handIndex, spot: pegSpot(request), played: answer as Card };
      this.skill.push({ kind: 'play', handIndex: request.view.handIndex, spot: this.lastPlay.spot, played: answer as Card, hand: request.pegging.hand, ...(request.view.starter ? { starter: request.view.starter } : {}) });
    }
    if (request.kind === 'discard') {
      this.lastDiscard = { handIndex: request.view.handIndex, hand: request.context.hand, thrown: answer as [Card, Card], ownCrib: request.view.dealer === 0 };
      if (request.context.hand.length === 6) this.skill.push({ kind: 'discard', ...this.lastDiscard });
    }
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
