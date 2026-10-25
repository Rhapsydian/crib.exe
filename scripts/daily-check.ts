/**
 * Daily Runs check (session 72, docs/daily-runs-design.md DR2): how big
 * each part of the daily score runs over many days, so none swamps depth,
 * and what each Directive adds on average.
 *
 * Plays each day as a daily starts (the day's class and seed, no
 * upgrades). The Cribbage rating can't be worked out here (the review
 * coach lives in the UI), so it's taken as the simulated player's measured
 * ~87. Daily Mods other than the Directive aren't applied until they're
 * built.
 *
 * PROVENANCE: synergy acquisition, opportunistic traversal and Safehouse,
 * skill 0.85, current content.
 *
 * Usage:
 *   npx tsx scripts/daily-check.ts [--days=120]
 */
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { DAILY_MODS, dailyDate, dailyRunStart, dailyScore, type DailyModId } from '../src/engine/daily';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const days = Number(args.days ?? 120);
const RATING = 87;
const directives = (Object.keys(DAILY_MODS) as DailyModId[]).filter((id) => DAILY_MODS[id].category === 'directive');

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
console.log(`\nDAILY SCORE -- ${days} days, skill 0.85, Cribbage rating taken as ${RATING}.\n`);
console.log(`average base score ${(total / days).toFixed(0)}`);
for (const [k, v] of Object.entries(parts)) console.log(`  ${k.padEnd(9)} ${(v / days).toFixed(0).padStart(5)}  (${((100 * v) / total).toFixed(0)}%)`);
console.log('\naverage a Directive adds:');
for (const d of directives) console.log(`  ${DAILY_MODS[d].name.padEnd(16)} +${(bonus[d] / days).toFixed(0)}`);
