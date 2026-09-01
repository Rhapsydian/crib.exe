/**
 * Reusable balance/regression sweep harness (session 28, checkpoint E).
 *
 * Replaces one-off scratch-*.ts scripts that got written, run, and
 * deleted for every sweep this project has done (session 20 onward) --
 * with real named-enemy content now in the roster, sweeps run real
 * skill-dial AI and are slow enough, and rare-but-real engine hangs are
 * now a demonstrated risk (a live infinite loop was found and fixed via
 * exactly this kind of sweep), that a throwaway script buffering all
 * its output until the end is actively dangerous: if seed N hangs, you
 * lose every seed before it too, and have no idea which one is stuck.
 *
 * This script instead prints (and appends to --out, if given) one line
 * per unit of work as it completes, so a hang is immediately visible
 * (the last printed line names exactly which seed/class/enemy was in
 * flight) and prior progress is never lost. It cannot *survive* a real
 * hang by itself (playRun/playCombat are synchronous, so a genuine
 * infinite loop blocks the whole process -- there's no way to time out
 * a synchronous call from within the same thread) -- if one recurs, kill
 * the process from outside (Ctrl+C, or `taskkill`/`kill` on the pid) and
 * the last printed line tells you exactly where to start a minimal
 * repro, the same way this file's own predecessor bug was found.
 *
 * Usage:
 *   npx tsx scripts/sweep.ts run [--classes=breacher,ghost] [--seeds=200] [--traversal=beeline|explore|opportunistic] [--acquisition=floor|synergy] [--playerSkill=0.85] [--out=file.jsonl]
 *   npx tsx scripts/sweep.ts enemy --enemy=ghost-in-the-machine [--vs=blackhat] [--seeds=200] [--out=file.jsonl]
 *
 * `run` sweeps playRun() outcome distribution per class (RunOutcome +
 * layersCompleted). `--traversal` selects which of run.ts's
 * TraversalStrategy exports drives movement (default beeline, i.e.
 * beelineToGatekeeper -- matches every sweep before session 35).
 * `opportunistic` (session 39) is the "middle ground" strategy banked
 * since session 35 -- paired automatically with merge.ts's
 * opportunisticSafehouseStrategy (beeline/explore keep the old
 * preferMergeWhenAvailable default), since the two were designed as one
 * coherent player profile, not independent dials.
 * `--acquisition` (session 46) selects the acquisition/Shop/Event/Burner
 * heuristic profile: `floor` (default) keeps the legal-not-good defaults
 * every sweep before session 46 ran on -- alwaysAcquireFirst,
 * buyCheapestAffordable, alwaysFirstEventChoice, and Burners never
 * activated at all -- while `synergy` wires in the whole checkpoint B-I
 * heuristic layer (profiles.ts's SYNERGY_AWARE_PROFILE). Independent of
 * and combinable with `--traversal`: the two are separate dials on
 * purpose, so a before/after can isolate which half moved a number.
 * Comparing the two is the entire point of the exercise -- a floor sweep
 * can't distinguish a real class-balance problem from the AI never using
 * half its own toolkit.
 * `enemy` sweeps a direct playCombat() between one named enemy
 * (enemies.ts) and one class's real starting kit, real game settings
 * (gaugeThreshold 8, winThreshold 50), reporting threshold vs.
 * attrition wins on each side -- exactly the shape used to verify the
 * 9 credit-incapable-enemy retrofits this session.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import {
  playRun,
  beelineToGatekeeper,
  exploreThenGatekeeper,
  opportunisticTraversal,
  summarizeRunLoadout,
  type RunOutcome,
  type TraversalStrategy,
} from '../src/engine/run';
import { playCombat } from '../src/engine/combat';
import { CLASS_STARTING_LOADOUTS } from '../src/engine/subroutines';
import { ENEMY_ROSTER } from '../src/engine/enemies';
import { preferMergeWhenAvailable, opportunisticSafehouseStrategy, type SafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import type { ClassId } from '../src/engine/classes';

const ALL_CLASSES: ClassId[] = ['breacher', 'blackhat', 'saboteur', 'operator', 'warden', 'ghost'];

const TRAVERSAL_STRATEGIES: Record<string, TraversalStrategy> = {
  beeline: beelineToGatekeeper,
  explore: exploreThenGatekeeper,
  opportunistic: opportunisticTraversal,
};

// opportunisticTraversal is designed as one coherent "mindful mid-tier
// player" alongside opportunisticSafehouseStrategy (session 39,
// `/decision-session`) -- pairing them here so `--traversal=opportunistic`
// exercises both halves together, not just the movement half with the
// old always-merge default.
const SAFEHOUSE_STRATEGIES: Record<string, SafehouseStrategy> = {
  beeline: preferMergeWhenAvailable,
  explore: preferMergeWhenAvailable,
  opportunistic: opportunisticSafehouseStrategy,
};

// `floor` is spelled out as an explicit empty override rather than left
// implicit, so `--acquisition=floor` and omitting the flag entirely are
// visibly the same run and neither silently drifts if playRun's own
// defaults ever change.
const ACQUISITION_PROFILES: Record<string, Partial<Parameters<typeof playRun>[0]>> = {
  floor: {},
  synergy: SYNERGY_AWARE_PROFILE,
};

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function emit(line: string, outFile?: string): void {
  console.log(line);
  if (outFile) appendFileSync(outFile, line + '\n');
}

// Session 39: the player's own standing default for full-run diagnostics
// -- anchored to the hardest real enemy skill in the game (layer-4
// gatekeeper, enemySkill() tops out at 0.84, enemies.ts) rather than
// picked arbitrarily, chosen so a raw-Cribbage mirror match against that
// ceiling comes out close to a fair 50% (scripts/cribbage-skill-matrix.ts
// calibration table). Opt-in only -- run.ts's own playerSkill option
// still defaults to undefined (playCombat's dumb baseline) when nothing
// passes it, so this is a script-level convention, not an engine default.
const PLAYER_SKILL = 0.85;

function sweepRun(args: Record<string, string>): void {
  const classes = args.classes ? (args.classes.split(',') as ClassId[]) : ALL_CLASSES;
  const seeds = Number(args.seeds ?? 100);
  const outFile = args.out;
  const traversalName = args.traversal ?? 'beeline';
  const traversalStrategy = TRAVERSAL_STRATEGIES[traversalName];
  const safehouseStrategy = SAFEHOUSE_STRATEGIES[traversalName];
  const playerSkill = args.playerSkill === undefined ? PLAYER_SKILL : Number(args.playerSkill);
  const acquisitionName = args.acquisition ?? 'floor';
  const acquisitionProfile = ACQUISITION_PROFILES[acquisitionName];
  if (!traversalStrategy) {
    throw new Error(`sweep.ts run: unknown --traversal="${traversalName}" (expected one of: ${Object.keys(TRAVERSAL_STRATEGIES).join(', ')})`);
  }
  if (!acquisitionProfile) {
    throw new Error(
      `sweep.ts run: unknown --acquisition="${acquisitionName}" (expected one of: ${Object.keys(ACQUISITION_PROFILES).join(', ')})`,
    );
  }
  if (outFile) writeFileSync(outFile, ''); // truncate/create fresh

  for (const classId of classes) {
    const outcomes: Record<RunOutcome, number> = { victory: 0, heatMaxed: 0, quarantined: 0, noRouteRemains: 0 };
    let layersSum = 0;
    for (let seed = 0; seed < seeds; seed++) {
      // Profile first, then the per-run knobs -- traversal/safehouse are
      // the separate --traversal dial and must not be overwritten by the
      // acquisition profile (which deliberately sets neither).
      const result = playRun({ ...acquisitionProfile, seed, classId, traversalStrategy, safehouseStrategy, playerSkill });
      outcomes[result.outcome]++;
      layersSum += result.layersCompleted;
      emit(
        JSON.stringify({
          mode: 'run',
          classId,
          seed,
          traversal: traversalName,
          acquisition: acquisitionName,
          outcome: result.outcome,
          layersCompleted: result.layersCompleted,
          // Session 46: the run's actual final holdings, so
          // "how many winning runs included X" is a query over --out
          // rather than a bespoke script written from scratch each time.
          loadout: summarizeRunLoadout(result.playerState),
        }),
        outFile,
      );
    }
    const total = seeds;
    console.log(
      `\n${classId.padEnd(10)} [${traversalName}/${acquisitionName}] victory=${outcomes.victory}/${total} (${((outcomes.victory / total) * 100).toFixed(1)}%)  heatMaxed=${outcomes.heatMaxed}  quarantined=${outcomes.quarantined}  noRoute=${outcomes.noRouteRemains}  avgLayers=${(layersSum / total).toFixed(2)}\n`,
    );
  }
}

function sweepEnemy(args: Record<string, string>): void {
  const enemyId = args.enemy;
  if (!enemyId) throw new Error('sweep.ts enemy: --enemy=<id> is required');
  const enemy = ENEMY_ROSTER.find((e) => e.id === enemyId);
  if (!enemy) throw new Error(`sweep.ts enemy: no enemy with id "${enemyId}"`);
  const classId = (args.vs ?? 'breacher') as ClassId;
  const seeds = Number(args.seeds ?? 100);
  const outFile = args.out;
  if (outFile) writeFileSync(outFile, '');

  let playerWins = 0;
  let enemyThresholdWins = 0;
  let enemyAttritionWins = 0;
  for (let seed = 0; seed < seeds; seed++) {
    const result = playCombat([CLASS_STARTING_LOADOUTS[classId], enemy.loadout], {
      seed,
      gaugeThreshold: [8, 8],
      winThreshold: [50, 50],
      classId,
      enemyPassiveIds: enemy.passiveIds,
    });
    if (result.winner === 0) playerWins++;
    else if (result.resolvedBy === 'threshold') enemyThresholdWins++;
    else enemyAttritionWins++;
    emit(JSON.stringify({ mode: 'enemy', enemyId, classId, seed, winner: result.winner, resolvedBy: result.resolvedBy }), outFile);
  }
  console.log(
    `\n${enemy.name} vs ${classId}: playerWins=${playerWins}/${seeds}  enemyThresholdWins=${enemyThresholdWins}  enemyAttritionWins=${enemyAttritionWins}\n`,
  );
}

const [, , mode, ...rest] = process.argv;
const args = parseArgs(rest);

if (mode === 'run') sweepRun(args);
else if (mode === 'enemy') sweepEnemy(args);
else {
  console.error('Usage: npx tsx scripts/sweep.ts run|enemy [options] -- see this file\'s header for details');
  process.exit(1);
}
