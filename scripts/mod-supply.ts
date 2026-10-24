/**
 * Mod supply (session 69, docs/tuning-design.md T1): how many Mods a run
 * ends with (besides the class Mod), in all runs and in winning ones, and
 * where they came from. Target: about 10 by a winning run's end.
 *
 * Usage:
 *   npx tsx scripts/mod-supply.ts [--seeds=60]
 */
import { runRequests, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { ALL_CLASS_IDS } from '../src/engine/classes';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const seeds = Number(args.seeds ?? 60);
let runs = 0, wins = 0, mods = 0, modsWin = 0;
const sources: Record<string, number> = {};
const sourcesWin: Record<string, number> = {};
for (const classId of ALL_CLASS_IDS) {
  for (let seed = 0; seed < seeds; seed++) {
    const run = runRequests({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
    const got: Record<string, number> = {};
    let step = run.next();
    while (!step.done) {
      const req = step.value;
      const answer = req.fallback();
      if (req.kind === 'reward' && req.reward === 'mod' && answer) got['gatekeeper/cache'] = (got['gatekeeper/cache'] ?? 0) + 1;
      if (req.kind === 'reward' && req.reward === 'eliteChoice' && answer && req.mods.includes(answer as never)) got.elite = (got.elite ?? 0) + 1;
      if (req.kind === 'eventResult' && req.grant.mod) got.event = (got.event ?? 0) + 1;
      if (req.kind === 'shop' && answer && typeof answer === 'object' && 'slate' in answer && answer.kind === 'buy' && answer.slate === 'mod') got.shop = (got.shop ?? 0) + 1;
      step = run.next(answer);
    }
    const r = step.value;
    const n = r.playerState.ownedModIds.length - 1;
    runs++;
    mods += n;
    for (const [k, v] of Object.entries(got)) sources[k] = (sources[k] ?? 0) + v;
    if (r.outcome === 'victory') {
      wins++;
      modsWin += n;
      for (const [k, v] of Object.entries(got)) sourcesWin[k] = (sourcesWin[k] ?? 0) + v;
    }
  }
}
const per = (o: Record<string, number>, d: number) => Object.entries(o).map(([k, v]) => `${k} ${(v / d).toFixed(1)}`).join(', ');
console.log(`MOD SUPPLY -- ${seeds} seeds x 6 classes`);
console.log(`all runs: ${(mods / runs).toFixed(1)} Mods (${per(sources, runs)})`);
console.log(`winning runs: ${(modsWin / wins).toFixed(1)} Mods (${per(sourcesWin, wins)})`);
