/**
 * Merge frequency (session 66, docs/design/subroutines.md checkpoint 3):
 * how far the simulated player Merges -- installed subroutines by rank at
 * a run's end, and how many runs end with a rank III -- since S1 needs
 * Merging to still happen with a bigger pool.
 *
 * Usage:
 *   npx tsx scripts/merge-frequency.ts [--seeds=50]
 */
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { ALL_CLASS_IDS } from '../src/engine/classes';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const seeds = Number(args.seeds ?? 50);
const byRank = [0, 0, 0, 0];
let runs = 0, withRankThree = 0, banked = 0;
for (const classId of ALL_CLASS_IDS) {
  for (let seed = 0; seed < seeds; seed++) {
    const r = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
    runs++;
    const ranks = r.playerState.installedLoadout.map((p) => p.rank ?? 0);
    for (const k of ranks) byRank[k]++;
    if (ranks.some((k) => k >= 3)) withRankThree++;
    banked += Object.values(r.playerState.material).reduce((s, n) => s + n, 0);
  }
}
console.log(`MERGE FREQUENCY -- ${seeds} seeds x 6 classes`);
console.log(`installed subroutines by rank at run end, per run: ${byRank.map((n, k) => `rank ${k}: ${(n / runs).toFixed(2)}`).join('  ')}`);
console.log(`runs ending with a rank III: ${((100 * withRankThree) / runs).toFixed(1)}%; copies left banked per run: ${(banked / runs).toFixed(2)}`);
