import { describe, expect, it } from 'vitest';
import { opportunisticTraversal, playRun, runRequests } from './run';
import { SYNERGY_AWARE_PROFILE } from './profiles';
import { driveWithFallbacks, type RunRequest } from './run-requests';

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
  });

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
