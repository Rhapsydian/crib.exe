import { describe, expect, it } from 'vitest';
import { opportunisticTraversal, playRun, runRequests } from './run';
import { SYNERGY_AWARE_PROFILE } from './profiles';
import { driveWithFallbacks, type RunRequest } from './run-requests';
import { arrangeLoadout, replaceInstalledWithNewest } from './loadout';
import { createInitialPlayerState } from './run';

// The run as a pausable engine (milestone 3 checkpoint 1).
describe('runRequests', () => {
  const options = (seed: number) => ({ ...SYNERGY_AWARE_PROFILE, seed, classId: 'daemon-honeypot' as const, traversalStrategy: opportunisticTraversal, playerSkill: 0.85 });

  it('answered by its fallbacks, is playRun exactly', () => {
    for (const seed of [3, 17]) expect(JSON.stringify(driveWithFallbacks(runRequests(options(seed))))).toBe(JSON.stringify(playRun(options(seed))));
  });

  it('pauses at every kind of decision, and only for the player inside fights', () => {
    const kinds = new Set<string>();
    let enemyRequests = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const run = runRequests(options(seed));
      let step = run.next();
      while (!step.done) {
        const r: RunRequest = step.value;
        kinds.add(r.kind === 'shopReroll' || r.kind === 'shopBuy' || r.kind === 'reward' ? `${r.kind}:${'slate' in r ? r.slate : r.reward}` : r.kind);
        if (r.kind === 'combat' && r.request.side !== 0) enemyRequests++;
        step = run.next(r.fallback());
      }
    }
    expect(enemyRequests).toBe(0);
    for (const kind of ['move', 'combat', 'reward:subroutine', 'reward:burner', 'reorder', 'safehouse', 'shopBuy:subroutine', 'shopBuy:mod', 'shopBuy:burner', 'event']) {
      expect(kinds, kind).toContain(kind);
    }
  });

  it('follows its driver: a different move changes the run', () => {
    const run = runRequests(options(5));
    let step = run.next();
    let steered = false;
    while (!step.done) {
      const r = step.value;
      let answer: unknown = r.fallback();
      if (!steered && r.kind === 'move') {
        // Take a different linked node than the strategy would.
        const fromHere = r.graph.edges.flatMap((e) => (e.a === r.position.nodeId ? [e.b] : e.b === r.position.nodeId ? [e.a] : []));
        const other = fromHere.find((id) => id !== answer);
        if (other) {
          answer = other;
          steered = true;
        }
      }
      step = run.next(answer);
    }
    expect(steered).toBe(true);
    const moves = step.value.log.filter((e) => e.type === 'move');
    const baseline = playRun(options(5)).log.filter((e) => e.type === 'move');
    expect(JSON.stringify(moves)).not.toBe(JSON.stringify(baseline));
  });
});

describe('the bench cap (milestone 3, M2)', () => {
  const options = (seed: number) => ({ ...SYNERGY_AWARE_PROFILE, seed, classId: 'exploit-overclock' as const, traversalStrategy: opportunisticTraversal, playerSkill: 0.85 });

  it('keeps the bench at 3 or fewer, asking what to drop when it overflows', () => {
    let drops = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const run = runRequests(options(seed));
      let step = run.next();
      while (!step.done) {
        const r = step.value;
        if (r.kind === 'drop') {
          drops++;
          expect(r.playerState.bench.length).toBe(4);
        }
        step = run.next(r.fallback());
      }
      expect(step.value.playerState.bench.length).toBeLessThanOrEqual(3);
    }
    expect(drops).toBeGreaterThan(0);
  }, 20_000);

  it("drops the piece its driver names", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = runRequests(options(seed));
      let step = run.next();
      while (!step.done) {
        const r = step.value;
        if (r.kind === 'drop') {
          const chosen = r.playerState.bench[0].id; // not necessarily the weakest
          step = run.next(chosen);
          // Walk to the next request carrying the player's state (or the
          // result): the chosen piece is off the bench.
          while (!step.done && !('playerState' in step.value)) step = run.next(step.value.fallback());
          const state = step.done ? step.value.playerState : (step.value as { playerState: { bench: { id: string }[] } }).playerState;
          expect(state.bench.some((p) => p.id === chosen)).toBe(false);
          return;
        }
        step = run.next(r.fallback());
      }
    }
    throw new Error('no drop request in 30 runs');
  });
});

/** Walks a run with fallbacks until `pick` matches a request, then
 * returns that request with the generator. */
function walkTo(options: Parameters<typeof runRequests>[0], pick: (r: RunRequest) => boolean) {
  const run = runRequests(options);
  let step = run.next();
  while (!step.done && !pick(step.value)) step = run.next(step.value.fallback());
  if (step.done) throw new Error('no matching request');
  return { run, request: step.value };
}

// Milestone 3 checkpoint 3: the player manages the loadout.
describe('loadout management (milestone 3 checkpoint 3)', () => {
  const options = (seed: number) => ({ ...SYNERGY_AWARE_PROFILE, seed, classId: 'exploit-overclock' as const, traversalStrategy: opportunisticTraversal, playerSkill: 0.85 });

  it('a drop can turn out an installed piece: the newest bench piece takes its slot', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = runRequests(options(seed));
      let step = run.next();
      while (!step.done) {
        const r = step.value;
        if (r.kind === 'drop') {
          const out = r.playerState.installedLoadout.find((p) => !r.playerState.grantedByMod[p.id])!;
          const index = r.playerState.installedLoadout.indexOf(out);
          const newest = r.playerState.bench[r.playerState.bench.length - 1];
          step = run.next(out.id);
          while (!step.done && !('playerState' in step.value)) step = run.next(step.value.fallback());
          const state = step.done ? step.value.playerState : (step.value as { playerState: typeof r.playerState }).playerState;
          expect(state.installedLoadout.some((p) => p.id === out.id) || state.bench.some((p) => p.id === out.id)).toBe(false);
          expect(state.installedLoadout[index].id).toBe(newest.id);
          expect(state.bench.length).toBe(3);
          return;
        }
        step = run.next(r.fallback());
      }
    }
    throw new Error('no drop request in 30 runs');
  });

  it('a rearranged loadout answers the map pause, then the same move is asked again', () => {
    const { run, request } = walkTo(options(4), (r) => r.kind === 'move' && r.playerState.installedLoadout.length >= 2);
    if (request.kind !== 'move') throw new Error('unreachable');
    const installed = request.playerState.installedLoadout.map((p) => p.id);
    const reversed = [...installed].reverse();
    const step = run.next({ arrange: { installed: reversed, bench: request.playerState.bench.map((p) => p.id) } });
    expect(step.done).toBe(false);
    const again = step.value as RunRequest;
    expect(again.kind).toBe('move');
    if (again.kind !== 'move') return;
    expect(again.position).toEqual(request.position);
    expect(again.playerState.installedLoadout.map((p) => p.id)).toEqual(reversed);
  });

  it('arrangeLoadout refuses anything but the owned pieces within the caps', () => {
    const start = createInitialPlayerState('exploit-overclock');
    const ids = start.installedLoadout.map((p) => p.id);
    expect(arrangeLoadout(start, [...ids].reverse(), []).installedLoadout.map((p) => p.id)).toEqual([...ids].reverse());
    expect(arrangeLoadout(start, ids.slice(1), [ids[0]]).bench.map((p) => p.id)).toEqual([ids[0]]);
    // Missing, duplicated or unknown pieces, or a slot cap broken: unchanged.
    expect(arrangeLoadout(start, ids.slice(1), [])).toBe(start);
    expect(arrangeLoadout(start, [...ids, ids[0]], [])).toBe(start);
    expect(arrangeLoadout(start, [...ids.slice(1), 'nope'], [])).toBe(start);
    expect(arrangeLoadout(start, ids, [], ids.length - 1)).toBe(start);
  });

  it('replaceInstalledWithNewest leaves a Mod-granted piece alone', () => {
    const start = createInitialPlayerState('exploit-overclock');
    const piece = start.installedLoadout[0];
    const extra = { ...start.installedLoadout[1], id: 'extra' };
    const state = { ...start, bench: [extra], grantedByMod: { [piece.id]: 'auxiliary-process' } };
    expect(replaceInstalledWithNewest(state, piece.id)).toBe(state);
    expect(replaceInstalledWithNewest(state, start.installedLoadout[1].id).installedLoadout[1].id).toBe('extra');
  });
});
