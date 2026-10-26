import { describe, expect, it } from 'vitest';
import { discardSkillStrategy, pegSkillStrategy } from '../engine/ai';
import { createRng } from '../engine/rng';
import { WIN_SCORE } from '../engine/basic-cribbage';
import { LiveCribbage } from './live-cribbage.svelte';
import { pegsAfter } from './cribbage-steps';
import { tableAt } from './timeline';
import { rateSkill } from './skill-review';

// Milestone 4 checkpoint 3: a game of vanilla Cribbage through the UI driver.
/** Plays the player's side with an AI on its own generator (the request's
 * context shares the engine's -- see run-save.ts's test note). */
function answerFor(game: LiveCribbage, i: number) {
  const r = game.frame!.request;
  const rng = createRng(1000 + i);
  return r.kind === 'discard' ? discardSkillStrategy(0.85)({ ...r.context, rng }) : pegSkillStrategy(0.85)({ ...r.context, rng });
}

describe('LiveCribbage', () => {
  it('plays a whole game: the player answers, the opponent is answered for, a result at 121', () => {
    const game = new LiveCribbage('normal', false, 4);
    let i = 0;
    while (game.frame && i < 2000) game.answer(answerFor(game, i++));
    expect(game.result).not.toBeNull();
    expect(game.result!.finalScores[game.result!.winner]).toBe(WIN_SCORE);
    // The steps' final scores (what the bars show) match the result.
    const steps = game.finalSteps;
    const pegs = pegsAfter(steps, steps.length);
    expect([pegs[0][0], pegs[1][0]]).toEqual(game.result!.finalScores);
    // Every frame was the player's own (side 0).
  });

  it("only ever pauses on the player's own decisions, with the table caught up", () => {
    const game = new LiveCribbage('easy', false, 9);
    for (let i = 0; i < 60 && game.frame; i++) {
      const r = game.frame.request;
      expect(r.side).toBe(0);
      expect(tableAt(game.frame.steps, game.frame.steps.length).handIndex).toBe(r.view.handIndex);
      game.answer(answerFor(game, i));
    }
  });

  it('a save replays to the same place, and a stale one is refused', () => {
    const game = new LiveCribbage('hard', true, 21);
    for (let i = 0; i < 37 && game.frame; i++) game.answer(answerFor(game, i));
    const resumed = LiveCribbage.resume(JSON.parse(JSON.stringify(game.save)))!;
    expect(resumed).not.toBeNull();
    expect(resumed.coach).toBe(true);
    expect(resumed.hints).toBe(true);
    game.hints = false;
    expect(LiveCribbage.resume(JSON.parse(JSON.stringify(game.save)))!.hints).toBe(false);
    expect(JSON.stringify(resumed.frame!.request.view.scores)).toBe(JSON.stringify(game.frame!.request.view.scores));
    expect(resumed.frame!.steps.length).toBe(game.frame!.steps.length);
    const stale = { ...game.save, answers: [{ k: 'play', a: { rank: 99, suit: 0 } }] };
    expect(LiveCribbage.resume(stale)).toBeNull();
  });
});

// Session 72 (the user): a vanilla game ends with a Cribbage rating, as a
// fight does.
describe("a vanilla game's Cribbage rating", () => {
  it('records every choice, survives a resume, and rates a full-strength player Flawless', () => {
    const game = new LiveCribbage('normal', false, 4);
    let i = 0;
    while (game.frame && i < 2000) {
      const r = game.frame.request;
      game.answer(r.kind === 'discard' ? discardSkillStrategy(1)(r.context) : pegSkillStrategy(1)(r.context));
      i++;
    }
    const rating = rateSkill(game.skill)!;
    expect(rating.hands).toBe(game.result!.hands);
    expect(rating.stars).toBe(5);
    expect(rating.mistakes).toEqual([]);
    const resumed = LiveCribbage.resume(game.save)!;
    expect(resumed.skill).toEqual(game.skill);
    // Marked, so the screen opens at the present (session 72).
    expect(resumed.resumed).toBe(true);
    expect(game.resumed).toBe(false);
  });
});
