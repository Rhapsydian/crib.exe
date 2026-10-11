/**
 * Where a run's Heat actually comes from (session 50).
 *
 * Heat has three inflows and, until now, no attribution: a lost
 * regular/elite fight, Trace carried out of combat, and the per-move
 * cost. Only the last was separable, because `move` log entries carry
 * their own `heatCost`; the other two were fused into one `heatDelta`.
 * `EncounterOutcome.heatSources` (encounters.ts) now splits them, and
 * splits the loss further by whether the enemy genuinely filled its
 * Containment gauge or merely ran out the `HARD_RESOLUTION_HAND` clock.
 *
 * Also prices two counterfactuals without changing any content:
 *
 *   --containmentMult=N  scales Containment-loss Heat only, to size the
 *                        lever before touching heat.ts.
 *
 * (--noNearMissScaler was removed in session 50 along with the scaler it
 * priced -- heatFromLoss is now a flat per-tier charge, so the
 * counterfactual and the actual are the same number.)
 *
 * Both are arithmetic over `EncounterOutcome.fight`, not re-simulations:
 * they say what the SAME runs would have been charged, which isolates
 * the pricing question from the behavioural one. Runs would of course
 * diverge if the charge actually changed -- that is a separate
 * measurement, and this script does not pretend otherwise.
 *
 * Usage:
 *   npx tsx scripts/heat-sources.ts [--seeds=300] [--classes=exploit-daemon]
 *                                   [--acquisition=floor|synergy]
 *                                   [--noNearMissScaler] [--containmentMult=2]
 */
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { HEAT_MAX } from '../src/engine/heat';
import { ALL_CLASS_IDS, type ClassId } from '../src/engine/classes';

const ALL_CLASSES: ClassId[] = ALL_CLASS_IDS;
const PLAYER_SKILL = 0.85;

// Mirrors heat.ts's own table -- imported values would be better, but
// BASE_HEAT_BY_TIER is deliberately module-private there. Kept here only
// for the counterfactual, never for live scoring.
const BASE_HEAT_BY_TIER = { regular: 15, elite: 30 } as const;

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? 'true';
  }
  return args;
}
const args = parseArgs(process.argv.slice(2));
const seeds = Number(args.seeds ?? 300);
const classes = args.classes ? (args.classes.split(',') as ClassId[]) : ALL_CLASSES;
const acquisition = args.acquisition ?? 'synergy';
const containmentMult = Number(args.containmentMult ?? 1);

interface Bucket {
  containmentLoss: number;
  attritionLoss: number;
  trace: number;
  refund: number;
  rest: number;
  event: number;
  move: number;
  /** Counterfactual loss Heat under the flags above. */
  counterfactualLoss: number;
  actualLoss: number;
  containmentLossCount: number;
  attritionLossCount: number;
  heatMaxed: number;
  runs: number;
  finalHeat: number;
}

const empty = (): Bucket => ({
  containmentLoss: 0, attritionLoss: 0, trace: 0, refund: 0, rest: 0, event: 0, move: 0,
  counterfactualLoss: 0, actualLoss: 0, containmentLossCount: 0, attritionLossCount: 0,
  heatMaxed: 0, runs: 0, finalHeat: 0,
});

const byClass: Record<string, Bucket> = {};

/** Win/loss per fight tier. A loss is the only encounter that charges
 * Heat, so "how often is a fight actually lost" is the upstream question
 * behind every Heat number below. */
type Tier = 'regular' | 'elite' | 'gatekeeper';
const fightsByClass: Record<string, Record<Tier, { wins: number; losses: number }>> = {};
const emptyFights = (): Record<Tier, { wins: number; losses: number }> => ({
  regular: { wins: 0, losses: 0 },
  elite: { wins: 0, losses: 0 },
  gatekeeper: { wins: 0, losses: 0 },
});

for (const classId of classes) {
  const b = (byClass[classId] = empty());
  const f = (fightsByClass[classId] = emptyFights());
  for (let seed = 0; seed < seeds; seed++) {
    const result = playRun({
      ...(acquisition === 'synergy' ? SYNERGY_AWARE_PROFILE : {}),
      seed,
      classId,
      traversalStrategy: opportunisticTraversal,
      safehouseStrategy: opportunisticSafehouseStrategy,
      playerSkill: PLAYER_SKILL,
    });
    b.runs++;
    b.finalHeat += result.finalHeat;
    if (result.outcome === 'heatMaxed') b.heatMaxed++;

    for (const entry of result.log) {
      if (entry.type === 'move') {
        b.move += entry.heatCost;
        continue;
      }
      if (entry.type !== 'encounter') continue;
      const { heatSources: h, fight } = entry.outcome;
      if (entry.nodeType === 'regularFight' || entry.nodeType === 'eliteFight' || entry.nodeType === 'gatekeeperFight') {
        const tier: Tier = entry.nodeType === 'regularFight' ? 'regular' : entry.nodeType === 'eliteFight' ? 'elite' : 'gatekeeper';
        if (entry.outcome.newState === 'inert') f[tier].wins++;
        else f[tier].losses++;
      }
      b.containmentLoss += h.containmentLoss;
      b.attritionLoss += h.attritionLoss;
      b.trace += h.trace;
      b.refund += h.refund;
      b.rest += h.rest;
      b.event += h.event;

      const charged = h.containmentLoss + h.attritionLoss;
      if (charged === 0 && !(fight && entry.outcome.newState === 'closed')) continue;
      if (!fight || entry.outcome.newState !== 'closed') continue;

      const isContainment = fight.resolvedBy === 'threshold';
      if (isContainment) b.containmentLossCount++;
      else b.attritionLossCount++;

      // The tier is not on the outcome, but BASE * (1 - margin) is
      // invertible whenever margin < 1: recover BASE, then re-price.
      const margin = Math.max(0, Math.min(1, fight.peakFillFraction[0]));
      const base = margin < 0.999 ? charged / (1 - margin) : NaN;
      const tierBase = Number.isFinite(base)
        ? Math.abs(base - BASE_HEAT_BY_TIER.elite) < Math.abs(base - BASE_HEAT_BY_TIER.regular)
          ? BASE_HEAT_BY_TIER.elite
          : BASE_HEAT_BY_TIER.regular
        : BASE_HEAT_BY_TIER.regular;

      const repriced = tierBase; // flat per-tier since session 50
      b.actualLoss += charged;
      b.counterfactualLoss += isContainment ? repriced * containmentMult : repriced;
    }
  }
}

const pct = (n: number, d: number) => (d === 0 ? '  n/a' : `${((n / d) * 100).toFixed(1)}%`.padStart(6));

console.log(`\n${seeds} seeds/class, ${acquisition}/opportunistic, skill ${PLAYER_SKILL}, HEAT_MAX ${HEAT_MAX}`);
if (containmentMult !== 1) console.log(`counterfactual: containment x${containmentMult}`);

console.log('\n=== gross Heat IN, per run, by source ===');
console.log('class        moves    trace  contain  attrit    event  |  total   %moves  %trace  %loss');
for (const c of classes) {
  const b = byClass[c];
  const loss = b.containmentLoss + b.attritionLoss;
  const total = b.move + b.trace + loss + b.event;
  console.log(
    `${c.padEnd(11)} ${(b.move / b.runs).toFixed(1).padStart(6)} ${(b.trace / b.runs).toFixed(1).padStart(8)} ` +
      `${(b.containmentLoss / b.runs).toFixed(1).padStart(8)} ${(b.attritionLoss / b.runs).toFixed(1).padStart(7)} ` +
      `${(b.event / b.runs).toFixed(1).padStart(8)}  | ${(total / b.runs).toFixed(1).padStart(6)}  ` +
      `${pct(b.move, total)}  ${pct(b.trace, total)}  ${pct(loss, total)}`,
  );
}

console.log('\n=== fight outcomes by tier (a loss is the only thing that charges Heat) ===');
console.log('class        regular W/L      win%    elite W/L      win%    gatekeeper W/L    win%');
for (const c of classes) {
  const f = fightsByClass[c];
  const row = (t: 'regular' | 'elite' | 'gatekeeper') => {
    const w = f[t].wins;
    const l = f[t].losses;
    return `${String(w) + '/' + String(l)}`.padStart(9) + '  ' + pct(w, w + l);
  };
  console.log(`${c.padEnd(11)} ${row('regular')}   ${row('elite')}   ${row('gatekeeper')}`);
}

console.log('\n=== Heat OUT per run (outflows), and net ===');
console.log('class          rest   refund  |  gross in     net   mean final   HEAT_MAX');
for (const c of classes) {
  const b = byClass[c];
  const gross = b.move + b.trace + b.containmentLoss + b.attritionLoss + b.event;
  const out = b.rest + b.refund; // both already negative
  console.log(
    `${c.padEnd(11)} ${(b.rest / b.runs).toFixed(1).padStart(7)} ${(b.refund / b.runs).toFixed(1).padStart(8)}  | ` +
      `${(gross / b.runs).toFixed(1).padStart(8)} ${((gross + out) / b.runs).toFixed(1).padStart(7)}   ` +
      `${(b.finalHeat / b.runs).toFixed(1).padStart(10)}   ${String(HEAT_MAX).padStart(8)}`,
  );
}

console.log('\n=== lost regular/elite fights (the only fights that charge Heat) ===');
console.log('class        containment   attrition   per run   mean Heat/loss   heatMaxed   mean final Heat');
for (const c of classes) {
  const b = byClass[c];
  const n = b.containmentLossCount + b.attritionLossCount;
  console.log(
    `${c.padEnd(11)} ${String(b.containmentLossCount).padStart(11)} ${String(b.attritionLossCount).padStart(11)}   ` +
      `${(n / b.runs).toFixed(2).padStart(7)}   ${(n === 0 ? 0 : b.actualLoss / n).toFixed(1).padStart(14)}   ` +
      `${pct(b.heatMaxed, b.runs)}      ${(b.finalHeat / b.runs).toFixed(1).padStart(13)}`,
  );
}

if (containmentMult !== 1) {
  console.log('\n=== counterfactual loss Heat (same runs, re-priced) ===');
  console.log('class        actual/run   repriced/run   delta/run   as % of total Heat in');
  for (const c of classes) {
    const b = byClass[c];
    const total = b.move + b.trace + b.containmentLoss + b.attritionLoss + b.event;
    const delta = b.counterfactualLoss - b.actualLoss;
    console.log(
      `${c.padEnd(11)} ${(b.actualLoss / b.runs).toFixed(1).padStart(10)} ${(b.counterfactualLoss / b.runs).toFixed(1).padStart(14)} ` +
        `${(delta / b.runs >= 0 ? '+' : '') + (delta / b.runs).toFixed(1)}`.padStart(12) +
        `   ${pct(delta, total)}`,
    );
  }
}
