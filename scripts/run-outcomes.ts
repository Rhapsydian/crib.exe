/**
 * Full-run outcomes by class (session 58; the run half of the retired
 * trace-price.ts): how runs end, how deep they get, and where each run's
 * Heat came from. The standing check for a Heat retune.
 *
 * Columns: victory / heatMaxed / breached-then-caught / quarantined, mean
 * layers breached; then per run: fights won, and Heat from fight
 * baselines (won fights), the performance term, enemy alarms, lost
 * fights, and map moves.
 *
 * PROVENANCE: synergy acquisition, opportunistic traversal and
 * Safehouse, skill 0.85, current content -- a full-run metric.
 *
 * Usage:
 *   npx tsx scripts/run-outcomes.ts [--seeds=300] [--classes=exploit-daemon,...]
 */
import { playRun, opportunisticTraversal, type RunOutcome } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { LAYER_HEAT_ALLOWANCE } from '../src/engine/heat';
import { ALL_CLASS_IDS, type ClassId } from '../src/engine/classes';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const seeds = Number(args.seeds ?? 300);
const classes = args.classes ? (args.classes.split(',') as ClassId[]) : ALL_CLASS_IDS;

interface Tally {
  outcomes: Record<RunOutcome, number>;
  layers: number;
  wins: number;
  baseline: number;
  performance: number;
  alarm: number;
  loss: number;
  moves: number;
}
const empty = (): Tally => ({
  outcomes: { victory: 0, heatMaxed: 0, breachedThenCaught: 0, quarantined: 0, noRouteRemains: 0 },
  layers: 0, wins: 0, baseline: 0, performance: 0, alarm: 0, loss: 0, moves: 0,
});

const pct = (n: number) => `${((100 * n) / seeds).toFixed(1).padStart(5)}%`;
const per = (n: number) => (n / seeds).toFixed(1).padStart(6);

console.log(`\nRUN OUTCOMES -- ${seeds} seeds/class, synergy/opportunistic, skill 0.85, current content.`);
console.log(`Layer allowances ${LAYER_HEAT_ALLOWANCE.join('/')}.\n`);
console.log(`${'class'.padEnd(20)} victory heatMax  caught  quarant  layers | per run: wins  baseline  perf  alarm   loss  moves`);

for (const classId of classes) {
  const t = empty();
  for (let seed = 0; seed < seeds; seed++) {
    const result = playRun({
      ...SYNERGY_AWARE_PROFILE,
      seed,
      classId,
      traversalStrategy: opportunisticTraversal,
      safehouseStrategy: opportunisticSafehouseStrategy,
      playerSkill: 0.85,
    });
    t.outcomes[result.outcome]++;
    t.layers += result.layersCompleted;
    for (const entry of result.log) {
      if (entry.type === 'move') t.moves += entry.heatCost;
      if (entry.type !== 'encounter') continue;
      const h = entry.outcome.heatSources;
      if (entry.outcome.fight && entry.outcome.newState === 'inert') t.wins++;
      t.baseline += h.baseline;
      t.performance += h.performance;
      t.alarm += h.alarm;
      t.loss += h.containmentLoss + h.attritionLoss;
    }
  }
  console.log(
    `${classId.padEnd(20)} ${pct(t.outcomes.victory)} ${pct(t.outcomes.heatMaxed)} ${pct(t.outcomes.breachedThenCaught)} ${pct(t.outcomes.quarantined)}  ${(t.layers / seeds).toFixed(2).padStart(5)} | ${per(t.wins)} ${per(t.baseline)}   ${per(t.performance)} ${per(t.alarm)} ${per(t.loss)} ${per(t.moves)}`,
  );
}
