/**
 * Trace price and the Exploit noise check (step 2, checkpoint 6;
 * `docs/recalibration-design.md` R5).
 *
 * R5 prices Trace as a fraction of a layer's Heat allowance, traded
 * against Credit by judgment rather than a shared-currency formula. This
 * script gives that judgment two numbers:
 *
 *   1. SENSITIVITY -- every class's run outcomes with `extraFightTrace`
 *      0/1/2/4: the same runs with a noisy piece's worth of extra Trace
 *      in every fight (unposted, counted as the player's own noise). The
 *      change in victory and heatMaxed per point is what one Trace per
 *      fight costs a run.
 *   2. ATTRIBUTION -- at extra 0, each class's fight Trace split into the
 *      posted baseline, the performance term (R6) and the player's own
 *      noise above the baseline. The Exploit noise check (session 50's
 *      Blackhat check, now Exploit's): is a class's extra Heat its own
 *      noise, or just more fights won?
 *
 * PROVENANCE: full runs, synergy acquisition, opportunistic traversal,
 * skill 0.85, SKELETON content -- `extraFightTrace` set means these are
 * NOT plain full-run metrics.
 *
 * Usage:
 *   npx tsx scripts/trace-price.ts [--seeds=200] [--classes=exploit-daemon,...] [--extras=0,1,2,4]
 */
import { playRun, opportunisticTraversal, type RunOutcome } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { fightBaselineTrace, LAYER_HEAT_ALLOWANCE } from '../src/engine/heat';
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
const seeds = Number(args.seeds ?? 200);
const classes = args.classes ? (args.classes.split(',') as ClassId[]) : ALL_CLASS_IDS;
const extras = (args.extras ?? '0,1,2,4').split(',').map(Number);

interface Tally {
  outcomes: Record<RunOutcome, number>;
  layers: number;
  wins: number;
  baseline: number;
  performance: number;
  ownNoise: number;
  moves: number;
}
const empty = (): Tally => ({
  outcomes: { victory: 0, heatMaxed: 0, breachedThenCaught: 0, quarantined: 0, noRouteRemains: 0 },
  layers: 0, wins: 0, baseline: 0, performance: 0, ownNoise: 0, moves: 0,
});

const pct = (n: number) => `${((100 * n) / seeds).toFixed(1).padStart(5)}%`;
const per = (n: number) => (n / seeds).toFixed(1).padStart(6);

console.log(`\nTRACE PRICE -- ${seeds} seeds/class, synergy/opportunistic, skill 0.85, current content. NOT plain full-run metrics.`);
console.log(`Layer allowances ${LAYER_HEAT_ALLOWANCE.join('/')}: 1 Trace = ${LAYER_HEAT_ALLOWANCE.map((a) => `${((100 * 1) / a).toFixed(1)}%`).join(' / ')} of a layer.\n`);
console.log(`${'class'.padEnd(20)} extra  victory heatMax  caught  quarant  layers | per run: wins  baseline  perf  ownNoise  moves`);

for (const classId of classes) {
  for (const extra of extras) {
    const t = empty();
    for (let seed = 0; seed < seeds; seed++) {
      const result = playRun({
        ...SYNERGY_AWARE_PROFILE,
        seed,
        classId,
        traversalStrategy: opportunisticTraversal,
        safehouseStrategy: opportunisticSafehouseStrategy,
        playerSkill: 0.85,
        extraFightTrace: extra,
      });
      t.outcomes[result.outcome]++;
      t.layers += result.layersCompleted;
      for (const entry of result.log) {
        if (entry.type === 'move') t.moves += entry.heatCost;
        if (entry.type !== 'encounter' || !entry.outcome.fight) continue;
        const h = entry.outcome.heatSources;
        // A won fight carries its Trace; a loss carries only noise above
        // the baseline (R7), so attribute wins only.
        if (h.trace <= 0) continue;
        const base = fightBaselineTrace(entry.outcome.fight.tier, entry.layerIndex);
        t.wins++;
        t.baseline += base;
        t.performance += h.performance;
        t.ownNoise += h.trace - base;
      }
    }
    console.log(
      `${classId.padEnd(20)} ${String(extra).padStart(5)}  ${pct(t.outcomes.victory)} ${pct(t.outcomes.heatMaxed)} ${pct(t.outcomes.breachedThenCaught)} ${pct(t.outcomes.quarantined)}  ${(t.layers / seeds).toFixed(2).padStart(5)} | ${per(t.wins)} ${per(t.baseline)}   ${per(t.performance)}  ${per(t.ownNoise)}   ${per(t.moves)}`,
    );
  }
}
