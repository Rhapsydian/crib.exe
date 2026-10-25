import { describe, expect, it } from 'vitest';
import { DAILY_BLOCKED_PAIRS, DAILY_MAX_BURNERS, DAILY_MAX_SUBROUTINES, DAILY_MODS, dailyDate, dailyRunStart, dailySeed, rollDaily } from './daily';
import { ALL_SUBROUTINES } from './subroutines';
import { BURNER_DEFINITIONS } from './burners';

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
