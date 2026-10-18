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
    const visits = new Set<string>();
    for (const seed of [2, 9, 14]) {
      const run = new LiveRun('daemon-honeypot', seed);
      let moves = 0;
      let deepest = 0;
      let fightsEnded = 0;
      let rewards = 0;
      let notices = 0;
      let guard = 0;
      while (run.pause && run.pause.kind !== 'over' && guard++ < 20000) {
        const pause = run.pause;
        if (pause.kind === 'move') {
          moves++;
          deepest = Math.max(deepest, pause.request.position.layerIndex);
          run.answer(pause.request.fallback());
        } else if (pause.kind === 'notice') {
          notices++;
          run.answer(null);
        } else if (pause.kind === 'safehouse') {
          visits.add('safehouse');
          run.chooseSafehouse('rest');
        } else if (pause.kind !== 'fight') {
          if (pause.kind === 'reward') rewards++;
          visits.add(pause.kind);
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
      expect(rewards).toBeGreaterThan(0);
      void notices;
      if (deepest >= 1) reachedLayer2 = true;
    }
    // At least one run breached a gatekeeper and carried on to layer 2.
    expect(reachedLayer2).toBe(true);
    // The non-fight screens all came up across the runs.
    for (const kind of ['safehouse', 'shop', 'event']) expect(visits, kind).toContain(kind);
  });

  it('applies the reward the player picks, and their loadout arrangement on the map', () => {
    const discard = discardSkillStrategy(0.85);
    const peg = pegSkillStrategy(0.85);
    const run = new LiveRun('daemon-honeypot', 2);
    let picked: string | null = null;
    let arranged = false;
    let guard = 0;
    while (run.pause && run.pause.kind !== 'over' && guard++ < 20000) {
      const pause = run.pause;
      if (pause.kind === 'move') {
        const player = pause.request.playerState;
        if (picked && !arranged) {
          // The picked piece is owned; move the first installed piece last.
          expect([...player.installedLoadout, ...player.bench].some((p) => p.id === picked)).toBe(true);
          const ids = player.installedLoadout.map((p) => p.id);
          const order = [...ids.slice(1), ids[0]];
          run.answer({ arrange: { installed: order, bench: player.bench.map((p) => p.id) } });
          const again = run.pause;
          expect(again?.kind).toBe('move');
          if (again?.kind === 'move') expect(again.request.playerState.installedLoadout.map((p) => p.id)).toEqual(order);
          arranged = true;
          return;
        }
        run.answer(pause.request.fallback());
      } else if (pause.kind === 'reward') {
        // Take the LAST option (not what the simulated player would pick).
        const options = pause.request.options;
        const choice: unknown = pause.request.reward === 'subroutine' && !picked ? options[options.length - 1] : null;
        if (choice) picked = (choice as { id: string }).id;
        run.answer(choice);
      } else if (pause.kind === 'notice') {
        run.answer(null);
      } else if (pause.kind === 'safehouse') {
        run.chooseSafehouse('rest');
      } else if (pause.kind !== 'fight') {
        run.answer(pause.request.fallback());
      } else if (run.fight?.result) {
        run.answer(null);
      } else {
        const r = run.fight!.frame!.request;
        run.answer(r.kind === 'discard' ? discard(r.context) : r.kind === 'play' ? peg(r.context) : null);
      }
    }
    throw new Error('never picked a reward and reached the map');
  });
});
