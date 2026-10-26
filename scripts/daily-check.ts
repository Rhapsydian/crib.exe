/**
 * Daily Runs check (session 72, docs/daily-runs-design.md DR2): how big
 * each part of the daily score runs over many days, so none swamps depth,
 * and what each Directive adds on average.
 *
 * Plays each day as a daily starts (the day's class and seed, no
 * upgrades). The Cribbage rating can't be worked out here (the review
 * coach lives in the UI), so it's taken as the simulated player's measured
 * 4 stars (Expert: ~0.6 points given up a hand).
 * Daily Mods other than the Directive aren't applied until they're
 * built.
 *
 * PROVENANCE: synergy acquisition, opportunistic traversal and Safehouse,
 * skill 0.85, current content.
 *
 * --part=mods: each Glitch, Advisory and Bulletin forced alone on the same
 * seeds, against none: victory, layers and base score.
 *
 * Usage:
 *   npx tsx scripts/daily-check.ts [--days=120]
 *   npx tsx scripts/daily-check.ts --part=mods [--days=60] [--only=early-cut,...]
 */
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { DAILY_MODS, dailyDate, dailyRunStart, dailyScore, rollDaily, type DailyMod, type DailyModId } from '../src/engine/daily';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const days = Number(args.days ?? 120);
const RATING = 4;
const directives = (Object.keys(DAILY_MODS) as DailyModId[]).filter((id) => DAILY_MODS[id].category === 'directive');

if (args.part === 'mods') {
  const play = (i: number, mods: DailyMod[]) => {
    const date = dailyDate(new Date(2026, 0, 1 + i));
    const { classId, seed, setup } = dailyRunStart(date);
    return playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85, setup: { ...setup, daily: { date, mods } } });
  };
  const measure = (mods: (i: number) => DailyMod[]) => {
    let v = 0, layers = 0, score = 0;
    for (let i = 0; i < days; i++) {
      const r = play(i, mods(i));
      v += Number(r.outcome === 'victory');
      layers += r.layersCompleted;
      score += dailyScore(r, 'clean-breach', RATING).lines.filter((l) => !l.directive).reduce((s, l) => s + l.points, 0);
    }
    return { v: (100 * v) / days, layers: layers / days, score: score / days };
  };
  const none = measure(() => []);
  console.log(`
DAILY MODS ALONE -- ${days} days, skill 0.85. None: victory ${none.v.toFixed(1)}%, layers ${none.layers.toFixed(2)}, score ${none.score.toFixed(0)}.
`);
  const only = args.only ? String(args.only).split(',') : null;
  for (const id of (Object.keys(DAILY_MODS) as DailyModId[]).filter((m) => DAILY_MODS[m].category !== 'directive' && (!only || only.includes(m)))) {
    // A Bulletin's rolled items: borrow them from the first day that rolls it.
    const rolled = Array.from({ length: 400 }, (_, i) => rollDaily(dailyDate(new Date(2026, 0, 1 + i))).mods.find((m) => m.id === id)).find(Boolean) ?? { id };
    const m = measure(() => [rolled]);
    const d = (x: number, y: number, f = 1) => `${x - y >= 0 ? '+' : ''}${(x - y).toFixed(f)}`;
    console.log(`  ${DAILY_MODS[id].category.padEnd(9)} ${DAILY_MODS[id].name.padEnd(17)} victory ${m.v.toFixed(1).padStart(5)}% (${d(m.v, none.v)})  layers ${d(m.layers, none.layers, 2)}  score ${d(m.score, none.score, 0)}`);
  }
  process.exit(0);
}

const parts: Record<string, number> = { layers: 0, victory: 0, elites: 0, caches: 0, data: 0, cribbage: 0 };
const bonus: Record<string, number> = Object.fromEntries(directives.map((d) => [d, 0]));
let total = 0;
for (let i = 0; i < days; i++) {
  const { classId, seed, setup } = dailyRunStart(dailyDate(new Date(2026, 0, 1 + i)));
  const result = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85, setup });
  // The base score: a Directive with no line of its own changes nothing
  // here only if it adds one, so read the base from Clean Breach's lines
  // minus its own.
  const base = dailyScore(result, 'clean-breach', RATING);
  for (const l of base.lines.filter((x) => !x.directive)) {
    const key = l.label.startsWith('Layer') ? 'layers' : l.label === 'Victory' ? 'victory' : l.label.includes('elite') ? 'elites' : l.label.includes('Cache') ? 'caches' : l.label.includes('Data') ? 'data' : 'cribbage';
    parts[key] += l.points;
  }
  const baseTotal = base.lines.filter((x) => !x.directive).reduce((s, l) => s + l.points, 0);
  total += baseTotal;
  for (const d of directives) bonus[d] += dailyScore(result, d, RATING).total - baseTotal;
}
console.log(`\nDAILY SCORE -- ${days} days, skill 0.85, Cribbage rating taken as ${RATING} stars.\n`);
console.log(`average base score ${(total / days).toFixed(0)}`);
for (const [k, v] of Object.entries(parts)) console.log(`  ${k.padEnd(9)} ${(v / days).toFixed(0).padStart(5)}  (${((100 * v) / total).toFixed(0)}%)`);
console.log('\naverage a Directive adds:');
for (const d of directives) console.log(`  ${DAILY_MODS[d].name.padEnd(16)} +${(bonus[d] / days).toFixed(0)}`);
