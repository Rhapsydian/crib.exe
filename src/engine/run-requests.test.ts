import { describe, expect, it } from 'vitest';
import { opportunisticTraversal, playRun, runRequests } from './run';
import { SYNERGY_AWARE_PROFILE } from './profiles';
import { driveWithFallbacks, type RunRequest } from './run-requests';
import { arrangeLoadout, replaceInstalledWithNewest } from './loadout';
import { createInitialPlayerState } from './run';
import type { BurnerId } from './burner-types';

// The run as a pausable engine (milestone 3 checkpoint 1).
describe('runRequests', () => {
  const options = (seed: number) => ({ ...SYNERGY_AWARE_PROFILE, seed, classId: 'daemon-honeypot' as const, traversalStrategy: opportunisticTraversal, playerSkill: 0.85 });

  it('answered by its fallbacks, is playRun exactly', () => {
    for (const seed of [3, 17]) expect(JSON.stringify(driveWithFallbacks(runRequests(options(seed))))).toBe(JSON.stringify(playRun(options(seed))));
  });

  it('an elite win is one choice, a subroutine (uncommon or better) or a Mod, never both (session 62)', async () => {
    const { rarityOf } = await import('./rewards');
    let seen = 0;
    for (let seed = 0; seed < 12 && seen < 3; seed++) {
      const run = runRequests(options(seed));
      let step = run.next();
      let lastWasElite = false;
      while (!step.done) {
        const r = step.value;
        if (r.kind === 'reward' && r.reward === 'eliteChoice') {
          seen++;
          expect(r.options).toEqual([...r.subroutines, ...r.mods]);
          for (const p of r.subroutines) expect(rarityOf(p.id)).not.toBe('common');
          lastWasElite = true;
        } else if (r.kind === 'reward' && (r.reward === 'subroutine' || r.reward === 'mod')) {
          // No separate subroutine/Mod reward right after an elite's choice.
          expect(lastWasElite).toBe(false);
        } else if (r.kind !== 'reward') {
          lastWasElite = false;
        }
        step = run.next(r.fallback());
      }
    }
    expect(seen).toBeGreaterThan(0);
  }, 60_000);

  it('pauses at every kind of decision, and only for the player inside fights', () => {
    const kinds = new Set<string>();
    let enemyRequests = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const run = runRequests(options(seed));
      let step = run.next();
      while (!step.done) {
        const r: RunRequest = step.value;
        kinds.add(r.kind === 'reward' ? `${r.kind}:${r.reward}` : r.kind);
        if (r.kind === 'combat' && r.request.side !== 0) enemyRequests++;
        step = run.next(r.fallback());
      }
    }
    expect(enemyRequests).toBe(0);
    for (const kind of ['move', 'combat', 'reward:subroutine', 'reward:burner', 'reorder', 'safehouse', 'shop', 'event']) {
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
  }, 60_000);

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

// The user's call (session 58): a Burner arriving at the carry cap can be
// swapped in for one you carry.
describe('Burner swap at the carry cap', () => {
  const options = (seed: number) => ({ ...SYNERGY_AWARE_PROFILE, seed, classId: 'exploit-overclock' as const, traversalStrategy: opportunisticTraversal, playerSkill: 0.85, carriedBurnerIdsOverride: ['flash-drive', 'flash-drive', 'flash-drive'] as ('flash-drive')[] });

  it('swaps out the Burner the driver names for the new one, or keeps them all', async () => {
    const { acquireBurnerAsking } = await import('./run');
    const { BURNER_DEFINITIONS } = await import('./burners');
    const full = { ...createInitialPlayerState('exploit-overclock'), carriedBurnerIds: ['flash-drive', 'emp-charge', 'zero-day'] as BurnerId[] };
    const incoming = BURNER_DEFINITIONS['stolen-coupon'];
    const ask = acquireBurnerAsking(full, incoming);
    const first = ask.next();
    expect(first.done).toBe(false);
    expect(first.value).toMatchObject({ kind: 'burnerSwap', incoming });
    const swapped = ask.next('emp-charge');
    expect(swapped.done && swapped.value.carriedBurnerIds).toEqual(['flash-drive', 'zero-day', 'stolen-coupon']);
    const keep = acquireBurnerAsking(full, incoming);
    keep.next();
    const kept = keep.next(null);
    expect(kept.done && kept.value.carriedBurnerIds).toEqual(full.carriedBurnerIds);
    // Below the cap there's nothing to ask.
    const roomy = acquireBurnerAsking({ ...full, carriedBurnerIds: ['flash-drive'] }, incoming).next();
    expect(roomy.done && roomy.value.carriedBurnerIds).toEqual(['flash-drive', 'stolen-coupon']);
  });

  it('answered by its fallback, keeps what you carry', () => {
    const run = runRequests(options(3));
    let step = run.next();
    while (!step.done) {
      const r = step.value;
      if (r.kind === 'burnerSwap') expect(r.fallback()).toBeNull();
      step = run.next(r.fallback());
    }
  });
});

// Milestone 3 checkpoint 4: a person's Shop (the user's call: buy freely)
// and map Burners used from the map pause.
describe('the Shop as one visit (checkpoint 4)', () => {
  it('buys several offerings, each once, rerolls each slate once, and leaves', async () => {
    const { resolveEncounterRequests } = await import('./encounters');
    const { createNode } = await import('./map-types');
    const { createRng } = await import('./rng');
    const player = { ...createInitialPlayerState('exploit-overclock'), data: 1000 };
    const visit = resolveEncounterRequests(createNode('s', 'shop'), createRng(5), player);
    let step = visit.next();
    const next = (answer: unknown) => (step = visit.next(answer));
    const shop = () => {
      if (step.done || step.value.kind !== 'shop') throw new Error('expected a shop request');
      return step.value.shop;
    };
    const first = shop();
    const firstPieces = first.slates.subroutine.map((o) => o.piece.id);
    next({ kind: 'buy', slate: 'subroutine', index: 0 });
    next({ kind: 'buy', slate: 'subroutine', index: 0 }); // already bought: ignored
    next({ kind: 'buy', slate: 'subroutine', index: 1 });
    next({ kind: 'buy', slate: 'mod', index: 0 });
    expect(shop().bought.subroutine).toEqual([0, 1]);
    const spent = first.slates.subroutine[0].cost + first.slates.subroutine[1].cost + first.slates.mod[0].cost;
    expect(shop().data).toBe(1000 - spent);
    next({ kind: 'reroll', slate: 'burner' });
    expect(shop().rerolled.burner).toBe(true);
    const afterReroll = shop().data;
    next({ kind: 'reroll', slate: 'burner' }); // once per slate: ignored
    expect(shop().data).toBe(afterReroll);
    next({ kind: 'leave' });
    expect(step.done).toBe(true);
    if (!step.done) return;
    expect(step.value.shopPurchases.map((p) => p.piece.id)).toEqual(firstPieces.slice(0, 2));
    expect(step.value.modShopPurchases).toHaveLength(1);
    expect(step.value.burnerRerollCost).toBeGreaterThan(0);
  });

  it("a rerolled Mod slate never offers a Mod bought earlier that visit (session 63, the user's catch)", async () => {
    const { resolveEncounterRequests } = await import('./encounters');
    const { createNode } = await import('./map-types');
    const { createRng } = await import('./rng');
    const player = { ...createInitialPlayerState('exploit-overclock'), data: 5000 };
    for (let seed = 1; seed <= 40; seed++) {
      const visit = resolveEncounterRequests(createNode('s', 'shop'), createRng(seed), player);
      let step = visit.next();
      if (step.done || step.value.kind !== 'shop') throw new Error('expected a shop request');
      const bought = step.value.shop.slates.mod.map((o) => o.mod.id);
      for (let i = 0; i < bought.length; i++) step = visit.next({ kind: 'buy', slate: 'mod', index: i });
      step = visit.next({ kind: 'reroll', slate: 'mod' });
      if (step.done || step.value.kind !== 'shop') throw new Error('expected a shop request');
      for (const o of step.value.shop.slates.mod) expect(bought).not.toContain(o.mod.id);
    }
  });

  it("a Shop Burner used on the way in can't then be sold (session 63, the user's catch)", async () => {
    const { resolveEncounterRequests } = await import('./encounters');
    const { createNode } = await import('./map-types');
    const { createRng } = await import('./rng');
    const player = { ...createInitialPlayerState('exploit-overclock'), data: 0, carriedBurnerIds: ['stolen-coupon', 'stolen-coupon'] as BurnerId[] };
    const visit = resolveEncounterRequests(createNode('s', 'shop'), createRng(5), player);
    let step = visit.next();
    if (step.done || step.value.kind !== 'shopBurner') throw new Error('expected the Shop Burner ask');
    step = visit.next('stolen-coupon');
    if (step.done || step.value.kind !== 'shop') throw new Error('expected a shop request');
    // The Shop sees one coupon left, not two.
    expect(step.value.playerState.carriedBurnerIds).toEqual(['stolen-coupon']);
    step = visit.next({ kind: 'sell', item: 'burner', id: 'stolen-coupon' });
    step = visit.next({ kind: 'sell', item: 'burner', id: 'stolen-coupon' }); // the used one: ignored
    if (step.done || step.value.kind !== 'shop') throw new Error('expected a shop request');
    expect(step.value.shop.sold.burner).toEqual(['stolen-coupon']);
    step = visit.next({ kind: 'leave' });
    if (!step.done) throw new Error('expected the visit to end');
    expect(step.value.shopBurnerUsed).toBe('stolen-coupon');
  });

  it('sells benched subroutines and carried Burners for Data, each copy once (session 61)', async () => {
    const { resolveEncounterRequests } = await import('./encounters');
    const { createNode } = await import('./map-types');
    const { createRng } = await import('./rng');
    const { subroutineSellPrice, burnerSellPrice } = await import('./shop');
    const { BURNER_DEFINITIONS } = await import('./burners');
    const { applyShopSales } = await import('./run');
    const base = createInitialPlayerState('exploit-overclock');
    const benched = base.installedLoadout[0];
    const player = { ...base, data: 0, bench: [benched], carriedBurnerIds: ['cold-wallet', 'flash-drive'] as BurnerId[] };
    const visit = resolveEncounterRequests(createNode('s', 'shop'), createRng(5), player);
    let step = visit.next();
    const next = (answer: unknown) => (step = visit.next(answer));
    const shop = () => {
      if (step.done || step.value.kind !== 'shop') throw new Error('expected a shop request');
      return step.value.shop;
    };
    next({ kind: 'sell', item: 'subroutine', id: benched.id });
    next({ kind: 'sell', item: 'subroutine', id: benched.id }); // only one copy: ignored
    next({ kind: 'sell', item: 'burner', id: 'cold-wallet' });
    next({ kind: 'sell', item: 'burner', id: 'emp-charge' }); // not carried: ignored
    const proceeds = subroutineSellPrice(benched.id) + burnerSellPrice(BURNER_DEFINITIONS['cold-wallet']);
    expect(burnerSellPrice(BURNER_DEFINITIONS['cold-wallet'])).toBe(30);
    expect(shop().data).toBe(proceeds);
    expect(shop().sold).toEqual({ subroutine: [benched.id], copy: [], burner: ['cold-wallet'] });
    next({ kind: 'leave' });
    if (!step.done) throw new Error('expected the visit to end');
    const after = applyShopSales(player, step.value.shopSales!);
    expect(after.bench).toEqual([]);
    expect(after.carriedBurnerIds).toEqual(['flash-drive']);
    expect(after.data).toBe(proceeds);
  });

  it('sells banked copies, and a ranked subroutine at a premium that takes its rank with it (session 61)', async () => {
    const { subroutineSellPrice, SELL_RANK_PREMIUM } = await import('./shop');
    const { applyShopSales } = await import('./run');
    const { upgradedDefinition } = await import('./merge');
    const base = createInitialPlayerState('exploit-overclock');
    const ranked = upgradedDefinition(upgradedDefinition(base.installedLoadout[0]));
    const player = { ...base, data: 0, bench: [ranked], rank: { [ranked.id]: 2 }, material: { [ranked.id]: 2 } };
    // A starting piece is a common: buys for 20, sells for 10, +25% a rank.
    expect(SELL_RANK_PREMIUM).toBe(0.25);
    expect(subroutineSellPrice(ranked.id)).toBe(10);
    expect(subroutineSellPrice(ranked.id, 2)).toBe(15);
    const after = applyShopSales(player, { subroutine: [ranked.id], copy: [ranked.id], burner: [] });
    expect(after.bench).toEqual([]);
    expect(after.rank[ranked.id]).toBeUndefined();
    expect(after.material[ranked.id]).toBe(1);
    expect(after.data).toBe(subroutineSellPrice(ranked.id, 2) + subroutineSellPrice(ranked.id));
  });

  it('the simulated player spending freely sells what it cannot use, buys past one per slate, and leaves (session 62)', async () => {
    const { resolveEncounterRequests } = await import('./encounters');
    const { createNode } = await import('./map-types');
    const { createRng } = await import('./rng');
    const { synergyAwareShopStrategy, synergyAwareModShopStrategy, synergyAwareBurnerShopStrategy } = await import('./shop');
    const base = createInitialPlayerState('exploit-overclock');
    const player = { ...base, data: 1000, bench: [base.installedLoadout[2]], installedLoadout: base.installedLoadout.slice(0, 2), carriedBurnerIds: ['cold-wallet'] as BurnerId[] };
    const visit = resolveEncounterRequests(
      createNode('s', 'shop'), createRng(5), player, undefined, synergyAwareShopStrategy, undefined, undefined, undefined, 1, 0, undefined,
      synergyAwareModShopStrategy, undefined, undefined, synergyAwareBurnerShopStrategy, undefined, undefined, undefined, 0, undefined, undefined, undefined, true,
    );
    let step = visit.next();
    const actions: string[] = [];
    for (let guard = 0; !step.done && guard < 200; guard++) {
      const r = step.value;
      if (r.kind === 'shop') actions.push((r.fallback() as { kind: string }).kind);
      step = visit.next(r.fallback());
    }
    expect(step.done).toBe(true);
    expect(actions.slice(0, 2)).toEqual(['sell', 'sell']);
    expect(actions.filter((a) => a === 'buy').length).toBeGreaterThan(3);
    expect(actions.at(-1)).toBe('leave');
  });

  it('never offers a sell-only Burner in the Shop', async () => {
    const { burnerOfferingsForClass } = await import('./shop');
    const { createRng } = await import('./rng');
    for (let seed = 0; seed < 200; seed++) {
      expect(burnerOfferingsForClass('exploit-overclock', createRng(seed)).map((o) => o.burner.id)).not.toContain('cold-wallet');
    }
  });

  it('refuses what it cannot afford', async () => {
    const { resolveEncounterRequests } = await import('./encounters');
    const { createNode } = await import('./map-types');
    const { createRng } = await import('./rng');
    const visit = resolveEncounterRequests(createNode('s', 'shop'), createRng(5), { ...createInitialPlayerState('exploit-overclock'), data: 1 });
    visit.next();
    const step = visit.next({ kind: 'buy', slate: 'subroutine', index: 0 });
    expect(!step.done && step.value.kind === 'shop' && step.value.shop.bought.subroutine).toEqual([]);
  });
});

describe('map Burners from the map pause (checkpoint 4)', () => {
  it('Ghost Protocol makes the next move free', () => {
    const run = runRequests({ seed: 6, classId: 'exploit-overclock', carriedBurnerIdsOverride: ['ghost-protocol'] });
    let step = run.next();
    while (!step.done && step.value.kind !== 'move') step = run.next(step.value.kind === 'mapBurner' ? null : step.value.fallback());
    if (step.done || step.value.kind !== 'move') throw new Error('no move');
    const target = step.value.fallback() as string;
    step = run.next({ useBurner: { burnerId: 'ghost-protocol' } });
    if (step.done || step.value.kind !== 'move') throw new Error('expected the move asked again');
    expect(step.value.freeMove).toBe(true);
    expect(step.value.playerState.carriedBurnerIds).not.toContain('ghost-protocol');
    step = run.next(target);
    let result = step;
    while (!result.done) result = run.next(result.value.fallback());
    const firstMove = result.value.log.find((e) => e.type === 'move');
    expect(firstMove && firstMove.type === 'move' && firstMove.heatCost).toBe(0);
  });
});
