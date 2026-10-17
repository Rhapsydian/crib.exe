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
