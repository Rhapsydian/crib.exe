/**
 * Skill-retention check (step 2, checkpoint 6b; `src/engine/skill-retention.ts`).
 *
 * Confirms Cribbage skill still decides fights once loadouts are installed.
 * Three readings:
 *
 *   1. REFERENCE -- the better player's win rate in plain Cribbage to 121
 *      at each skill matchup: the signal we want to keep.
 *   2. LOADOUT MIRRORS -- the same loadout on both sides, better player in
 *      both seats, at the same matchups; retention = combat edge /
 *      Cribbage edge. Run for two plain Credit piles (pure turn leverage),
 *      every class's starting loadout, and its loadout late in real runs
 *      (the final installed loadout of runs that cleared 2+ layers).
 *   3. RUN LEVEL -- each class's victory rate at player skill 0.5 vs 0.85
 *      (the whole build: passive, Mods, real enemies).
 *
 * Step 3 runs this on authored content; `--loadout` is not offered -- add
 * a named entry to EXTRA below for a one-off piece mix.
 *
 * PROVENANCE: mirrors are isolated duels with no class passive or Mods;
 * the run level uses synergy acquisition and opportunistic traversal on
 * skeleton content. Neither is a balance measurement of real content.
 *
 * Usage:
 *   npx tsx scripts/skill-check.ts [--seeds=300] [--classes=a,b] [--late=5] [--runSeeds=150] [--skip=runs]
 */
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import { creditPiece } from '../src/engine/pricing';
import { combatSkillEdge, cribbageSkillEdge, skillRetention, type SkillMatchup } from '../src/engine/skill-retention';
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { ALL_CLASS_IDS, CLASS_DEFINITIONS, type ClassId } from '../src/engine/classes';
import type { SubroutineDefinition } from '../src/engine/subroutine-types';

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
const lateCount = Number(args.late ?? 5);
const runSeeds = Number(args.runSeeds ?? 150);
const skip = new Set((args.skip ?? '').split(',').filter(Boolean));
const showReference = !skip.has('reference');

const MATCHUPS: SkillMatchup[] = [
  { high: 0.85, low: 0.5 },
  { high: 0.85, low: 0.25 },
];
const edgeOptions = { seeds, gaugeThreshold: GAUGE_THRESHOLD, winThreshold: BREACH_THRESHOLD };
const label = (m: SkillMatchup) => `${m.high} v ${m.low}`;
const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(6);

/** One-off piece mixes to check alongside the classes. */
const EXTRA: Record<string, SubroutineDefinition[]> = {
  'Credit 1 (turn leverage)': [creditPiece(1)],
  'Credit 4 x 3 (heavy flat)': [creditPiece(4, 'a'), creditPiece(4, 'b'), creditPiece(4, 'c')],
};

const reference = MATCHUPS.map((m) => cribbageSkillEdge(m, 2000));
if (showReference) {
  console.log(`\nSKILL RETENTION -- isolated mirrors (no passive/Mods), skeleton content. NOT a balance measurement.`);
  console.log(`${seeds} seeds x 2 seats per mirror; Cribbage reference 2000 games to 121.\n`);
  console.log(`plain Cribbage, better player wins: ${MATCHUPS.map((m, i) => `${label(m)} ${pct(reference[i].winRate)}`).join('   ')}\n`);
}

console.log(`${'loadout'.padEnd(36)} ${MATCHUPS.map((m) => `${label(m).padStart(11)} win  retain`).join('   ')}`);
function report(name: string, loadouts: SubroutineDefinition[][]): void {
  const cells = MATCHUPS.map((m, i) => {
    // Several loadouts (the late-run sample) share the seed budget.
    const per = Math.max(1, Math.round(seeds / loadouts.length));
    let wins = 0;
    let fights = 0;
    loadouts.forEach((l, j) => {
      const r = combatSkillEdge(l, m, { ...edgeOptions, seeds: per, seedOffset: j * per });
      wins += r.winRate * r.fights;
      fights += r.fights;
    });
    const winRate = wins / fights;
    const combat = { winRate, se: Math.sqrt((winRate * (1 - winRate)) / fights), fights };
    const retain = skillRetention(combat, reference[i]);
    return `${' '.repeat(11)} ${pct(winRate)}  ${retain === null ? '  -- ' : retain.toFixed(2).padStart(5)}`;
  });
  console.log(`${name.padEnd(36)} ${cells.join('   ')}`);
}

if (showReference) for (const [name, loadout] of Object.entries(EXTRA)) report(name, [loadout]);

function lateLoadouts(classId: ClassId): SubroutineDefinition[][] {
  const found: SubroutineDefinition[][] = [];
  for (let seed = 0; found.length < lateCount && seed < 200; seed++) {
    const result = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
    if (result.layersCompleted >= 2) found.push(result.playerState.installedLoadout);
  }
  return found;
}

for (const classId of classes) {
  report(`${classId} start`, [CLASS_DEFINITIONS[classId].startingLoadout]);
  const late = lateLoadouts(classId);
  report(`${classId} late (${late.length} runs, ~${(late.reduce((s, l) => s + l.length, 0) / late.length).toFixed(1)} pieces)`, late);
}

if (!skip.has('runs')) {
  console.log(`\nRUN LEVEL -- victory by player skill, ${runSeeds} seeds/class (synergy/opportunistic, skeleton content).`);
  console.log(`${'class'.padEnd(20)}  skill 0.5   skill 0.85   gap`);
  for (const classId of classes) {
    const victory = [0.5, 0.85].map((skill) => {
      let wins = 0;
      for (let seed = 0; seed < runSeeds; seed++) {
        if (playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: skill }).outcome === 'victory') wins++;
      }
      return wins / runSeeds;
    });
    console.log(`${classId.padEnd(20)}  ${pct(victory[0])}     ${pct(victory[1])}     ${((victory[1] - victory[0]) * 100).toFixed(1).padStart(5)} pts`);
  }
}
