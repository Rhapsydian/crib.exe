/**
 * Real-run layer-completion funnel (session 39).
 *
 * Every number here comes from playRun()'s own outcome/layersCompleted --
 * the same real, real-AI, real-acquisition run sweep.ts's "run" mode
 * counts for its full-run win rate, not a separate isolated re-fight (that
 * decoupled shape is gatekeeper-check.ts's job, and it does NOT reproduce
 * what a real run's own resolution decides -- see run.ts's
 * onBeforeGatekeeperFight doc comment). This script exists specifically so
 * "how many runs made it past layer N" can be read straight off real full
 * runs, per the project's standing rule that balance metrics should be
 * full-run-derived by default, with any departure from that called out
 * explicitly.
 *
 * By default this passes run.ts's own playerSkill option (session 39,
 * built specifically so player and enemy skill are never interlocked --
 * see encounters.ts's strategiesForFight) at PLAYER_SKILL below, rather
 * than playCombat's dumb floor baseline. The enemy's own per-fight
 * enemySkill()-scaled AI is untouched either way -- playerSkill only ever
 * changes the player's own strategy, never the enemy's.
 *
 * layersCompleted >= 4 is asserted to exactly equal outcome === 'victory'
 * for every class -- clearing layer 4 is definitionally a full-run win,
 * with nothing that can go wrong afterward. Fails loudly if that ever
 * stops being true (e.g. a future "layer 5" or post-victory check).
 *
 * `--excludeGatekeeper=<enemyId>` ablates one gatekeeper from selection
 * entirely at every layer (run.ts's excludedGatekeeperIds) -- lets a
 * before/after comparison isolate whether a specific gatekeeper is a
 * difficulty outlier vs. its layer-mates, rather than guessing from its
 * own isolated win rate alone (which doesn't account for how often it's
 * even drawn, or how the rest of a run's difficulty compares).
 *
 * Usage:
 *   npx tsx scripts/layer-funnel.ts [--classes=breacher,ghost] [--seeds=600] [--playerSkill=0.85] [--excludeGatekeeper=firewall-prime] [--out=file.jsonl]
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import type { ClassId } from '../src/engine/classes';
import type { EnemyId } from '../src/engine/enemies';

const ALL_CLASSES: ClassId[] = ['breacher', 'blackhat', 'saboteur', 'operator', 'warden', 'ghost'];
const LAYER_COUNT = 4;
// Session 39: the player's own standing default for full-run diagnostics
// -- anchored to the hardest real enemy skill in the game (layer-4
// gatekeeper, enemySkill() tops out at 0.84, enemies.ts) rather than
// picked arbitrarily, chosen so a raw-Cribbage mirror match against that
// ceiling comes out close to a fair 50% (scripts/cribbage-skill-matrix.ts
// calibration table). Opt-in only -- run.ts's own playerSkill option
// still defaults to undefined (playCombat's dumb baseline) when nothing
// passes it, so this is a script-level convention, not an engine default.
const PLAYER_SKILL = 0.85;

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

const args = parseArgs(process.argv.slice(2));
const classes = args.classes ? (args.classes.split(',') as ClassId[]) : ALL_CLASSES;
const seeds = Number(args.seeds ?? 600);
const playerSkill = args.playerSkill === undefined ? PLAYER_SKILL : Number(args.playerSkill);
const excludedGatekeeperIds = args.excludeGatekeeper ? [args.excludeGatekeeper as EnemyId] : undefined;
const outFile = args.out;
if (outFile) writeFileSync(outFile, '');

console.log(
  'class'.padEnd(10),
  'n'.padEnd(6),
  ...Array.from({ length: LAYER_COUNT }, (_, i) => `L${i + 1}`.padEnd(16)),
);

for (const classId of classes) {
  const reachedLayer = new Array(LAYER_COUNT).fill(0);
  let victories = 0;
  for (let seed = 0; seed < seeds; seed++) {
    const result = playRun({ seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill, excludedGatekeeperIds });
    for (let i = 0; i < LAYER_COUNT; i++) if (result.layersCompleted >= i + 1) reachedLayer[i]++;
    if (result.outcome === 'victory') victories++;
    emit(JSON.stringify({ classId, seed, outcome: result.outcome, layersCompleted: result.layersCompleted }), outFile);
  }

  if (reachedLayer[LAYER_COUNT - 1] !== victories) {
    throw new Error(
      `layer-funnel.ts: clearing layer ${LAYER_COUNT} (${reachedLayer[LAYER_COUNT - 1]}) no longer equals 'victory' outcome (${victories}) for ${classId} -- a layer-${LAYER_COUNT} clear is assumed to BE a full-run win; investigate before trusting this funnel.`,
    );
  }

  console.log(
    classId.padEnd(10),
    String(seeds).padEnd(6),
    ...reachedLayer.map((count) => `${count} (${((count / seeds) * 100).toFixed(1)}%)`.padEnd(16)),
  );
}
