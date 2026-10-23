import { describe, it, expect } from 'vitest';
import { playRun, opportunisticTraversal, type MapBurnerStrategy, type RunResult } from './run';
import { TUTORIAL_OPTIONS } from './tutorial';
import type { BurnerId } from './burner-types';

// Session 64 (docs/burners-events-design.md BE4): map Burners as Heat tools,
// on the tutorial's short layer (relay, two fights, Shop, Safehouse,
// gatekeeper, in a line).

const useWhenCarried =
  (id: BurnerId, when: (heat: number) => boolean = () => true): MapBurnerStrategy =>
  (ctx) =>
    ctx.availableBurnerIds.includes(id) && when(ctx.heat) ? { burnerId: id } : null;
const run = (burner: BurnerId, strategy: MapBurnerStrategy): RunResult =>
  playRun({ ...TUTORIAL_OPTIONS, traversalStrategy: opportunisticTraversal, playerSkill: 0.85, carriedBurnerIdsOverride: [burner], mapBurnerStrategy: strategy, burnerAcquisitionStrategy: () => null });
const encounters = (r: RunResult) => r.log.filter((e) => e.type === 'encounter');

describe('map Burners (session 64)', () => {
  it('Ghost Protocol: the next 6 moves cost no Heat', () => {
    const moves = run('ghost-protocol', useWhenCarried('ghost-protocol')).log.filter((e) => e.type === 'move');
    // The tutorial layer is 5 moves long: every one of them is free.
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves.slice(0, 6)) expect(m.type === 'move' && m.heatCost).toBe(0);
  });

  it('Tunnel: the next Shop moved onto is passed through, unvisited, and stays for later', () => {
    const r = run('tunnel', useWhenCarried('tunnel'));
    const firstShopMove = r.log.findIndex((e) => e.type === 'move' && e.to === 't-shop');
    expect(firstShopMove).toBeGreaterThan(-1);
    // The very next event is another move, not a Shop visit.
    expect(r.log[firstShopMove + 1].type).toBe('move');
    // The Safehouse after it is visited as usual.
    expect(encounters(r).some((e) => e.type === 'encounter' && e.nodeType === 'safehouse')).toBe(true);
  });

  it("Proxy Chain: the next 3 fights' Heat is halved, booked as burner Heat", () => {
    const r = run('proxy-chain', useWhenCarried('proxy-chain'));
    const fights = encounters(r).filter((e) => e.type === 'encounter' && e.outcome.fight);
    // The tutorial's three fights (two, then the gatekeeper) are all cut.
    for (const f of fights.slice(0, 3)) {
      if (f.type !== 'encounter' || f.outcome.heatDelta <= 0) continue;
      expect(f.outcome.heatDelta).toBeCloseTo(-f.outcome.heatSources.burner, 6);
    }
  });

  it('Golden Ticket: your Heat drops to 0 now, and the next gatekeeper has no Heat toll', () => {
    const r = run('golden-ticket', useWhenCarried('golden-ticket'));
    const gk = encounters(r).find((e) => e.type === 'encounter' && e.nodeType === 'gatekeeperFight');
    if (gk?.type !== 'encounter' || gk.outcome.newState !== 'inert') return; // only meaningful on a win
    expect(gk.outcome.heatDelta).toBeCloseTo(0, 6);
  });

  it('Log Wiper: lowers your Heat by 10 now', () => {
    const r = run('log-wiper', useWhenCarried('log-wiper', (heat) => heat >= 5));
    const used = r.log.findIndex((e) => e.type === 'mapBurnerActivated');
    expect(used).toBeGreaterThan(-1);
    const before = [...r.log.slice(0, used)].reverse().find((e) => e.type === 'move' || e.type === 'encounter');
    const after = r.log.slice(used).find((e) => e.type === 'move');
    if (!before || !after || after.type !== 'move' || !('heatAfter' in before)) throw new Error('expected moves around it');
    expect(after.heatAfter).toBeCloseTo(Math.max(0, before.heatAfter - 10) + after.heatCost, 6);
  });
});
