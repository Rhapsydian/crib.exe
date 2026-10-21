import { describe, expect, it } from 'vitest';
import { discardSkillStrategy, pegSkillStrategy } from '../engine/ai';
import { LiveRun } from './live-run.svelte';
import { createRng } from '../engine/rng';

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

  it('a save replays to exactly where the run was, mid-fight included', () => {
    const discard = discardSkillStrategy(0.85);
    const peg = pegSkillStrategy(0.85);
    const run = new LiveRun('exploit-overclock', 11);
    const where = (r: LiveRun) =>
      JSON.stringify({
        pause: r.pause?.kind,
        request: r.pause && 'request' in r.pause ? r.pause.request.kind : r.fight?.frame?.request.kind,
        player: r.pause && 'request' in r.pause && 'playerState' in r.pause.request ? r.pause.request.playerState : null,
        hand: r.fight?.frame?.request.context && 'hand' in r.fight.frame.request.context ? r.fight.frame.request.context.hand : null,
        fights: r.fights,
      });
    let checked = 0;
    for (let i = 0; i < 400 && run.pause && run.pause.kind !== 'over'; i++) {
      const pause = run.pause;
      if (pause.kind === 'notice') run.answer(null);
      else if (pause.kind === 'safehouse') run.chooseSafehouse('rest');
      else if (pause.kind === 'fight') {
        if (run.fight?.result) run.answer(null);
        else {
          // The AI gets its own generator: the request's context shares the
          // engine's AI-noise generator, and drawing from it would change
          // the fight in a way a replay (of the answers alone) can't
          // reproduce. A person never draws from it.
          const r = run.fight!.frame!.request;
          const rng = createRng(i);
          run.answer(r.kind === 'discard' ? discard({ ...r.context, rng }) : r.kind === 'play' ? peg({ ...r.context, rng }) : null);
        }
      } else run.answer(pause.request.fallback());
      // Every so often, save through JSON and resume: same place.
      if (i % 41 === 20) {
        const resumed = LiveRun.resume(JSON.parse(JSON.stringify(run.save)));
        expect(resumed).not.toBeNull();
        expect(where(resumed!)).toBe(where(run));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(2);
  });

  it('a trace evasion: its intro, your Cribbage, its result -- and a save mid-evasion resumes there (session 63)', () => {
    const discard = discardSkillStrategy(0.85);
    const peg = pegSkillStrategy(0.85);
    // Found by search: this run's layer-4 gatekeeper toll maxes Heat.
    const run = new LiveRun('daemon-overclock', 18);
    const answerFight = (i: number) => {
      if (run.fight?.result) return run.answer(null);
      const r = run.fight!.frame!.request;
      const rng = createRng(i);
      run.answer(r.kind === 'discard' ? discard({ ...r.context, rng }) : r.kind === 'play' ? peg({ ...r.context, rng }) : null);
    };
    let i = 0;
    for (; i < 20000 && run.pause && run.pause.kind !== 'evasionStart' && run.pause.kind !== 'over'; i++) {
      const pause = run.pause;
      if (pause.kind === 'notice') run.answer(null);
      else if (pause.kind === 'safehouse') run.chooseSafehouse('rest');
      else if (pause.kind === 'fight') answerFight(i);
      else run.answer((pause as { request: { fallback: () => unknown } }).request.fallback());
    }
    expect(run.pause?.kind).toBe('evasionStart');
    if (run.pause?.kind !== 'evasionStart') return;
    expect(run.pause.request.layer).toBe(4);
    expect(run.evasion?.headStart).toBe(run.pause.request.headStart);
    run.answer(null);
    // Your decisions, answered with the AI's own generator (as a person,
    // never drawing from the game's); a save mid-way resumes in the same spot.
    const where = (r: LiveRun) => JSON.stringify({ pause: r.pause?.kind, request: r.evasion?.frame?.request.kind, view: r.evasion?.frame?.request.view.scores, hand: r.evasion?.frame?.request.context && 'hand' in r.evasion.frame.request.context ? r.evasion.frame.request.context.hand : null });
    let resumed = 0;
    for (let k = 0; k < 200 && run.pause?.kind === 'evasion' && run.pause.request.kind === 'evasion'; k++) {
      if (k === 5) {
        const back = LiveRun.resume(JSON.parse(JSON.stringify(run.save)));
        expect(back).not.toBeNull();
        expect(where(back!)).toBe(where(run));
        resumed++;
      }
      const r = run.pause.request.request;
      const rng = createRng(1000 + k);
      run.answer(r.kind === 'discard' ? discard({ ...r.context, rng }) : peg({ ...r.context, rng }));
    }
    expect(resumed).toBe(1);
    // Its result, then the run's end: escaped on layer 4 wins it.
    expect(run.pause?.kind).toBe('evasion');
    const escaped = run.evasion!.escaped;
    expect(run.evasion!.result).not.toBeNull();
    run.answer(null);
    for (; i < 20000 && run.pause && run.pause.kind !== 'over'; i++) {
      const pause = run.pause;
      if (pause.kind === 'fight') answerFight(i);
      else run.answer((pause as { request: { fallback: () => unknown } }).request.fallback());
    }
    expect(run.pause?.kind).toBe('over');
    if (run.pause?.kind === 'over') expect(run.pause.result.outcome).toBe(escaped ? 'victory' : 'breachedThenCaught');
  }, 120_000);

  it('a save that no longer fits is refused', () => {
    const run = new LiveRun('exploit-overclock', 11);
    run.answer((run.pause as { request: { fallback: () => unknown } }).request.fallback());
    const save = run.save;
    save.answers[0] = { k: 'reward', a: 'nope' };
    expect(LiveRun.resume(save)).toBeNull();
  });
});
