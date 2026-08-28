/**
 * Realistic gatekeeper-difficulty diagnostic (session 39).
 *
 * Unlike sweep.ts's "run" mode (whole-run outcome distributions) or
 * "enemy" mode (a class's bare STARTING kit vs. one enemy), this measures
 * gatekeeper difficulty against what a player actually has by the time
 * they get there -- real acquired loadout/Mods/Burners/Data from a real
 * playRun(), not a worst-case floor. Prompted by the Null Session
 * investigation: testing bare starting kits understated real difficulty,
 * since a layer-4 gatekeeper is reached after 3 layers of acquisition.
 *
 * Doesn't try to construct one "average" loadout -- acquired content
 * (which specific subroutines, which Mods, at what Merge rank) can't be
 * meaningfully blended across seeds into a single coherent object.
 * Instead: run N real seeds per class (opportunisticTraversal + the usual
 * legal-not-good acquisition/Shop/Merge/Mod/Burner defaults), capture
 * every gatekeeper actually encountered via run.ts's
 * onBeforeGatekeeperFight hook, then re-fight each captured state
 * separately in isolation -- real production skill-dial enemy AI
 * (enemies.ts's enemySkill, same formula resolveFight uses) against a
 * chosen player skill level -- and aggregate win rate per (class,
 * gatekeeper, player skill) bucket. Each layer's gatekeeper is randomly
 * assigned from a small eligible pool, so N seeds naturally spreads
 * samples across the whole roster, not just one target gatekeeper. Also
 * reports the same win rate aggregated by layerIndex instead of enemy id
 * (per class, and combined across all classes) -- the per-layer
 * difficulty *curve* DESIGN.md's Enemy Design section describes as
 * authoring intent ("meant to be very challenging for the layer it's
 * presented at"), which nothing in the engine actually enforces
 * automatically (the only real per-layer mechanism is the skill dial's
 * modest LAYER_SKILL_STEP).
 *
 * Usage:
 *   npx tsx scripts/gatekeeper-check.ts [--classes=breacher,ghost] [--seeds=300] [--playerSkills=0.75,1] [--out=file.jsonl]
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { playRun, opportunisticTraversal, type GatekeeperFightContext } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { playCombat } from '../src/engine/combat';
import { GAUGE_THRESHOLD, WIN_THRESHOLD } from '../src/engine/encounters';
import { enemySkill } from '../src/engine/enemies';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { BURNER_DEFINITIONS } from '../src/engine/burners';
import type { ClassId } from '../src/engine/classes';

const ALL_CLASSES: ClassId[] = ['breacher', 'blackhat', 'saboteur', 'operator', 'warden', 'ghost'];

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
const seeds = Number(args.seeds ?? 300);
const playerSkills = (args.playerSkills ?? '0.75,1').split(',').map(Number);
const outFile = args.out;
if (outFile) writeFileSync(outFile, '');

// key: `${classId}|${enemyId}|${playerSkill}`
const wins: Record<string, number> = {};
const totals: Record<string, number> = {};
// Same shape, keyed by layer instead of enemy id (`${classId}|${layerIndex}|${playerSkill}`)
// -- aggregates across whichever 1-4 gatekeepers each layer happened to
// draw, to see the difficulty *curve* across layers rather than one
// enemy at a time. A separate `all|...` bucket (classId '(all classes)')
// gives the cross-class trend too.
const layerWins: Record<string, number> = {};
const layerTotals: Record<string, number> = {};
function bump(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

for (const classId of classes) {
  for (let seed = 0; seed < seeds; seed++) {
    const captures: GatekeeperFightContext[] = [];
    playRun({
      seed,
      classId,
      traversalStrategy: opportunisticTraversal,
      safehouseStrategy: opportunisticSafehouseStrategy,
      onBeforeGatekeeperFight: (ctx) => captures.push(ctx),
    });

    for (const capture of captures) {
      const enemySkillValue = enemySkill(capture.enemy.tier, capture.layerIndex, capture.fightsResolved);
      // Same context-filtering resolveFight itself applies (encounters.ts)
      // -- a carried map/shop-only Burner has nothing to activate here.
      const combatBurnerIds = capture.playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('combat'));

      for (const playerSkill of playerSkills) {
        // Deterministic and decorrelated per layer within a run -- not
        // meant to be cryptographically independent, just repeatable.
        const fightSeed = seed * 4 + capture.layerIndex;
        const result = playCombat([capture.playerState.installedLoadout, capture.enemy.loadout], {
          seed: fightSeed,
          gaugeThreshold: GAUGE_THRESHOLD,
          winThreshold: WIN_THRESHOLD,
          classId: capture.playerState.classId,
          enemyPassiveIds: capture.enemy.passiveIds,
          ownedModIds: capture.playerState.ownedModIds,
          carriedBurnerIds: combatBurnerIds,
          discardStrategies: [discardSkillStrategy(playerSkill), discardSkillStrategy(enemySkillValue)],
          playStrategies: [pegSkillStrategy(playerSkill), pegSkillStrategy(enemySkillValue)],
        });

        const key = `${classId}|${capture.enemy.id}|${playerSkill}`;
        bump(totals, key);
        if (result.winner === 0) bump(wins, key);

        for (const layerKeyClass of [classId, '(all classes)']) {
          const layerKey = `${layerKeyClass}|${capture.layerIndex}|${playerSkill}`;
          bump(layerTotals, layerKey);
          if (result.winner === 0) bump(layerWins, layerKey);
        }

        emit(
          JSON.stringify({
            classId,
            seed,
            enemyId: capture.enemy.id,
            layerIndex: capture.layerIndex,
            playerSkill,
            enemySkill: enemySkillValue,
            winner: result.winner,
          }),
          outFile,
        );
      }
    }
  }

  console.log(`\n=== ${classId} ===`);
  const keysForClass = Object.keys(totals)
    .filter((k) => k.startsWith(`${classId}|`))
    .sort();
  for (const key of keysForClass) {
    const [, enemyId, playerSkill] = key.split('|');
    const w = wins[key] ?? 0;
    const t = totals[key];
    console.log(`  ${enemyId.padEnd(22)} skill=${playerSkill.padEnd(5)} ${w}/${t} (${((w / t) * 100).toFixed(1)}%)`);
  }

  console.log(`\n--- ${classId} by layer (aggregated across whichever gatekeeper each layer drew) ---`);
  const layerKeysForClass = Object.keys(layerTotals)
    .filter((k) => k.startsWith(`${classId}|`))
    .sort();
  for (const key of layerKeysForClass) {
    const [, layerIndex, playerSkill] = key.split('|');
    const w = layerWins[key] ?? 0;
    const t = layerTotals[key];
    console.log(`  layer ${layerIndex}  skill=${playerSkill.padEnd(5)} ${w}/${t} (${((w / t) * 100).toFixed(1)}%)`);
  }
}

console.log(`\n=== difficulty curve across all classes ===`);
const allClassesKeys = Object.keys(layerTotals)
  .filter((k) => k.startsWith('(all classes)|'))
  .sort();
for (const key of allClassesKeys) {
  const [, layerIndex, playerSkill] = key.split('|');
  const w = layerWins[key] ?? 0;
  const t = layerTotals[key];
  console.log(`  layer ${layerIndex}  skill=${playerSkill.padEnd(5)} ${w}/${t} (${((w / t) * 100).toFixed(1)}%)`);
}
