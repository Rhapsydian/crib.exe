import { describe, expect, it } from 'vitest';
import { discardSkillStrategy, pegSkillStrategy } from '../engine/ai';
import { LiveRun } from './live-run.svelte';

// The run's UI driver (milestone 3 checkpoint 2): a player answering the
// map and their fights reaches the end of a run.
describe('LiveRun', () => {
  it('plays a whole run: moves, fights (each with a result), then the end', () => {
    const discard = discardSkillStrategy(0.85);
    const peg = pegSkillStrategy(0.85);
    let reachedLayer2 = false;
    for (const seed of [2, 9, 14]) {
      const run = new LiveRun('daemon-honeypot', seed);
      let moves = 0;
      let deepest = 0;
      let fightsEnded = 0;
      let guard = 0;
      while (run.pause && run.pause.kind !== 'over' && guard++ < 20000) {
        const pause = run.pause;
        if (pause.kind === 'move') {
          moves++;
          deepest = Math.max(deepest, pause.request.position.layerIndex);
          run.answer(pause.request.fallback());
        } else if (run.fight?.result) {
          fightsEnded++;
          run.answer(null);
        } else {
          const r = run.fight!.frame!.request;
          run.answer(r.kind === 'discard' ? discard(r.context) : r.kind === 'play' ? peg(r.context) : null);
        }
      }
      expect(run.pause?.kind).toBe('over');
      expect(moves).toBeGreaterThan(2);
      expect(fightsEnded).toBeGreaterThan(0);
      expect(run.fights).toBe(fightsEnded);
      // Decisions answered for the player are noted.
      expect(run.notes.length).toBeGreaterThan(0);
      if (deepest >= 1) reachedLayer2 = true;
    }
    // At least one run breached a gatekeeper and carried on to layer 2.
    expect(reachedLayer2).toBe(true);
  });
});
