/**
 * Run endings (session 67, docs/enemies-design.md E6-E7): how simulated
 * runs end -- victory, a lost gatekeeper, no route left, Heat -- and lost
 * regular and elite fights a run. Targets: victory 24-30%; no route left
 * occasional.
 *
 * Usage:
 *   npx tsx scripts/run-endings.ts [--seeds=50]
 */
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { ALL_CLASS_IDS } from '../src/engine/classes';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const seeds = Number(args.seeds ?? 50);
const ends: Record<string, number> = {};
let runs = 0, eliteLosses = 0, regularLosses = 0;
for (const classId of ALL_CLASS_IDS) {
  for (let seed = 0; seed < seeds; seed++) {
    const r = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
    runs++;
    ends[r.outcome] = (ends[r.outcome] ?? 0) + 1;
    for (const e of r.log) {
      if (e.type !== 'encounter' || !e.outcome.fight || e.outcome.newState === 'inert') continue;
      if (e.outcome.fight.tier === 'elite') eliteLosses++;
      if (e.outcome.fight.tier === 'regular') regularLosses++;
    }
  }
}
console.log(`RUN ENDINGS -- ${seeds} seeds x 6 classes`);
console.log(Object.entries(ends).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((100 * v) / runs).toFixed(1)}%`).join('  '));
console.log(`lost fights a run: elite ${(eliteLosses / runs).toFixed(2)}, regular ${(regularLosses / runs).toFixed(2)}`);
