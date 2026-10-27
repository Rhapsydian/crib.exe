import { describe, expect, it } from 'vitest';
import { applyDailyStart, dailyScore, type DailyMod, type DailyPlan, DAILY_BLOCKED_PAIRS, DAILY_MAX_BURNERS, DAILY_MAX_SUBROUTINES, DAILY_MODS, dailyDate, dailyRunStart, dailySeed, rollDaily } from './daily';
import { ALL_SUBROUTINES } from './subroutines';
import { BURNER_DEFINITIONS } from './burners';
import { burnersUsedIn, createInitialPlayerState, playRun, opportunisticTraversal, type RunEvent } from './run';
import { burnerCapOf } from './burners';
import { slotCapOf } from './loadout';
import { ENEMY_ROSTER } from './enemies';
import { securityMods } from './encounters';
import { generateLayer } from './map-gen';
import { createRng } from './rng';
import { SYNERGY_AWARE_PROFILE } from './profiles';

// Session 72 (docs/daily-runs-design.md DR4-DR8): the day.
const dates = Array.from({ length: 400 }, (_, i) => dailyDate(new Date(2026, 0, 1 + i)));

describe('the daily', () => {
  it('names the local date as YYYY-MM-DD', () => {
    expect(dailyDate(new Date(2026, 9, 5))).toBe('2026-10-05');
  });

  it('the same date always rolls the same day; different dates differ', () => {
    expect(rollDaily('2026-10-25')).toEqual(rollDaily('2026-10-25'));
    expect(dailySeed('2026-10-25')).not.toBe(dailySeed('2026-10-26'));
    expect(new Set(dates.map(dailySeed)).size).toBe(dates.length);
  });

  it('one Directive first, then two or three others, never a blocked pair, within the caps', () => {
    for (const date of dates) {
      const { mods } = rollDaily(date);
      const cats = mods.map((m) => DAILY_MODS[m.id].category);
      expect(cats[0]).toBe('directive');
      expect(cats.filter((c) => c === 'directive')).toHaveLength(1);
      expect(mods.length === 3 || mods.length === 4).toBe(true);
      expect(new Set(mods.map((m) => m.id)).size).toBe(mods.length);
      const ids = mods.map((m) => m.id);
      for (const [a, b] of DAILY_BLOCKED_PAIRS) expect(ids.includes(a) && ids.includes(b)).toBe(false);
      const burners = mods.reduce((n, m) => n + (m.burners?.length ?? 0), 0);
      const subs = mods.filter((m) => m.subroutine).length;
      expect(burners).toBeLessThanOrEqual(DAILY_MAX_BURNERS);
      expect(subs).toBeLessThanOrEqual(DAILY_MAX_SUBROUTINES);
    }
  });

  it('deals the Directives as a deck: no repeat within each 13-day cycle', () => {
    const directives = Object.values(DAILY_MODS).filter((m) => m.category === 'directive').length;
    const day0 = Math.floor(Date.UTC(2026, 0, 1) / 86_400_000);
    const start = Math.ceil(day0 / directives) * directives; // a cycle's first day
    const cycle = Array.from({ length: directives }, (_, i) => dailyDate(new Date((start + i) * 86_400_000 + 12 * 3_600_000)));
    expect(new Set(cycle.map((d) => rollDaily(d).mods[0].id)).size).toBe(directives);
  });

  it('never repeats a Directive on consecutive days, cycle boundaries included', () => {
    const run = Array.from({ length: 1300 }, (_, i) => rollDaily(dailyDate(new Date(2026, 0, 1 + i))).mods[0].id);
    for (let i = 1; i < run.length; i++) expect(run[i]).not.toBe(run[i - 1]);
  });

  it("rolls each Bulletin's items: common or contraband Burners, an uncommon subroutine, a suit", () => {
    const rolled = dates.flatMap((d) => rollDaily(d).mods);
    const goBag = rolled.find((m) => m.id === 'go-bag')!;
    expect(goBag.burners).toHaveLength(2);
    expect(new Set(goBag.burners).size).toBe(2);
    expect(goBag.burners!.every((id) => BURNER_DEFINITIONS[id].rarity === 'common')).toBe(true);
    const drop = rolled.find((m) => m.id === 'contraband-drop')!;
    expect(BURNER_DEFINITIONS[drop.burners![0]].contraband).toBe(true);
    const kit = rolled.find((m) => m.id === 'field-kit')!;
    expect(ALL_SUBROUTINES.some((p) => p.id === kit.subroutine)).toBe(true);
    expect(rolled.find((m) => m.id === 'suit-surge')!.suit).toBeTruthy();
  });

  it('every class and every Mod turns up over a year; the subroutine slot more rarely', () => {
    const plans = dates.map(rollDaily);
    expect(new Set(plans.map((p) => p.classId)).size).toBe(6);
    const count = (id: string) => plans.filter((p) => p.mods.some((m) => m.id === id)).length;
    for (const id of Object.keys(DAILY_MODS)) expect(count(id)).toBeGreaterThan(0);
    expect(count('expanded-memory')).toBeLessThan(count('burner-rig'));
  });

  it('a daily starts plain, with the day pinned', () => {
    const start = dailyRunStart('2026-10-25');
    expect(start).toMatchObject({ classId: rollDaily('2026-10-25').classId, seed: dailySeed('2026-10-25'), setup: { plain: true, daily: { date: '2026-10-25' } } });
    expect(dailyRunStart('2026-10-25', true).setup.daily?.practice).toBe(true);
  });
});

describe('the daily score (DR2)', () => {
  const run = playRun({ ...SYNERGY_AWARE_PROFILE, seed: 21, classId: 'exploit-overclock', traversalStrategy: opportunisticTraversal, playerSkill: 0.85 });

  it('tallies Data earned and spent, Merges and Burners used', () => {
    expect(run.tally).toBeDefined();
    const t = run.tally!;
    // What's left is what came in less what went out (starting with none).
    expect(t.dataEarned - t.dataSpent).toBe(run.playerState.data);
    expect(t.merges).toBeGreaterThanOrEqual(0);
  });

  it('itemizes depth, elites, Caches, Data and the Cribbage rating', () => {
    const s = dailyScore(run, 'clean-sweep', 3);
    const layers = run.log.filter((e) => e.type === 'layerCleared').length;
    // Fixed amounts by stars (session 72): 100 / 200 / 350 / 500 / 700.
    expect(s.lines.find((l) => l.label.startsWith('Cribbage'))).toMatchObject({ label: 'Cribbage: Sharp (3 stars)', points: 350 });
    expect(dailyScore(run, 'clean-sweep', 5).lines.find((l) => l.label.startsWith('Cribbage'))?.points).toBe(700);
    expect(s.total).toBeGreaterThanOrEqual(layers * 750 + 350);
    expect(s.total).toBe(s.lines.reduce((a, l) => a + l.points, 0));
  });

  it('each Directive changes the score its own way', () => {
    const base = dailyScore(run, 'clean-sweep', 3);
    const without = base.total - (base.lines.find((l) => l.directive)?.points ?? 0);
    expect(dailyScore(run, 'card-sharp', 3).total).toBe(without + 350);
    expect(dailyScore(run, 'payday', 3).total).toBe(without + (run.tally!.dataEarned));
    expect(dailyScore(run, 'flawless-form', 5).lines.at(-1)?.points).toBe(1000);
    expect(dailyScore(run, 'flawless-form', 4).lines.some((l) => l.directive)).toBe(false);
    expect(dailyScore(run, 'shopping-spree', 3).total).toBe(without + run.tally!.dataSpent);
  });

  // v0.9.1 (the user's call): selling a Cold Wallet is its use, so it
  // counts for Burn Rate; selling any other Burner doesn't.
  it('counts Burners fired, and a Cold Wallet sold, as Burners used', () => {
    const shop = (sold: string[], used: string | null = null) =>
      ({ type: 'encounter', layerIndex: 0, nodeId: 'n', nodeType: 'shop', heatAfter: 0, outcome: { burnersUsedThisCombat: [], shopBurnerUsed: used, shopSales: { subroutine: [], copy: [], burner: sold } } }) as unknown as RunEvent;
    const fight = { type: 'encounter', layerIndex: 0, nodeId: 'f', nodeType: 'fight', heatAfter: 0, outcome: { burnersUsedThisCombat: ['flash-drive', 'emp-charge'], shopBurnerUsed: null } } as unknown as RunEvent;
    const map: RunEvent = { type: 'mapBurnerActivated', layerIndex: 0, burnerId: 'ghost-protocol' };
    expect(burnersUsedIn([fight])).toBe(2);
    expect(burnersUsedIn([shop(['cold-wallet', 'cold-wallet'])])).toBe(2);
    expect(burnersUsedIn([shop(['flash-drive'])])).toBe(0);
    expect(burnersUsedIn([fight, map, shop(['cold-wallet', 'flash-drive'], 'stolen-coupon')])).toBe(5);
  });
});

describe('Advisories and Bulletins (DR3, DR7)', () => {
  const plan = (...mods: DailyMod[]): DailyPlan => ({ date: 'test', seed: 1, classId: 'exploit-overclock', mods });
  const fresh = () => createInitialPlayerState('exploit-overclock');
  /** A real date whose roll includes `id`. */
  const dateWith = (id: string) => dates.find((d) => rollDaily(d).mods.some((m) => m.id === id))!;
  const daily = (id: string) => {
    const date = dateWith(id);
    const { classId, seed, setup } = dailyRunStart(date);
    return playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, playerSkill: 0.85, setup });
  };

  it('Bulletins set the kit: Burners, a 4th starter, rank II, Data, the class Mod II, the caps', () => {
    const s = applyDailyStart(fresh(), plan({ id: 'go-bag', burners: ['flash-drive', 'log-wiper'] }, { id: 'field-kit', subroutine: 'thread-pool' }, { id: 'veteran-loadout' }, { id: 'seed-money' }, { id: 'new-hardware' }, { id: 'burner-rig' }));
    expect(s.carriedBurnerIds).toEqual(['flash-drive', 'log-wiper']);
    expect(s.installedLoadout.map((p) => p.id)).toContain('thread-pool');
    expect(s.installedLoadout.slice(0, 3).every((p) => p.rank === 1)).toBe(true);
    expect(s.data).toBe(150);
    expect(s.classModUpgraded).toBe(true);
    expect(burnerCapOf(s)).toBe(4);
    expect(slotCapOf(applyDailyStart(fresh(), plan({ id: 'expanded-memory' })))).toBe(7);
    expect(slotCapOf(applyDailyStart(fresh(), plan({ id: 'memory-leak' })))).toBe(5);
  });

  it('Advisories set the run: move and fight Heat, Heat carry, fight Data, elite Mods, Shop prices', () => {
    const s = applyDailyStart(fresh(), plan({ id: 'quiet-network' }, { id: 'cold-trail' }, { id: 'lean-times' }, { id: 'hardened-elites' }));
    expect(s.daily).toEqual({ moveHeat: 0, heatCarry: 0.25, fightData: 0.5, eliteMods: 1 });
    expect(s.meta).toMatchObject({ fightHeat: 1.5, shopPrice: 0.7 });
    const elite = ENEMY_ROSTER.find((e) => e.tier === 'elite')!;
    expect(securityMods(elite, 'elite', 1, undefined, 1)).toHaveLength(1);
  });

  it('Port Flood deals a second Shop; Cache Bloom always places a Cache when it fits', () => {
    const shops = (extraShops: number) => generateLayer({ rng: createRng(4), nodeCount: 12, layer: 2, extraShops }).nodes.filter((n) => n.type === 'shop').length;
    expect(shops(1)).toBe(shops(0) + 1);
    const caches = Array.from({ length: 30 }, (_, i) => generateLayer({ rng: createRng(i), nodeCount: 12, layer: 2, cacheChance: 1 }).nodes.some((n) => n.type === 'cache')).filter(Boolean).length;
    expect(caches).toBeGreaterThan(25);
  });

  it('a Quiet Network day charges no move Heat', () => {
    const r = daily('quiet-network');
    expect(r.log.filter((e) => e.type === 'move').every((e) => e.type === 'move' && e.heatCost === 0)).toBe(true);
  });
});
