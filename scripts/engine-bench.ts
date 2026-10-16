/**
 * Engine speed benchmark (milestone 1, `docs/playable-design.md` P1).
 *
 * The pausable-engine refactor must not slow simulation down: balance
 * sweeps play hundreds of thousands of fights. This times a fixed batch of
 * real fights -- every class's starting loadout against every gatekeeper,
 * at the standing skill 0.85 on both sides -- and reports fights per
 * second. Run it before and after an engine change and compare.
 *
 * Usage:
 *   npx tsx scripts/engine-bench.ts [--seeds=20] [--repeat=3]
 */
import { playCombat } from '../src/engine/combat';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD, CONTAINMENT_THRESHOLD } from '../src/engine/encounters';
import { ENEMY_ROSTER, enemyCombatOptions } from '../src/engine/enemies';
import { ALL_CLASS_IDS, CLASS_DEFINITIONS } from '../src/engine/classes';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const seeds = Number(args.seeds ?? 20);
const repeat = Number(args.repeat ?? 3);
const gatekeepers = ENEMY_ROSTER.filter((e) => e.tier === 'gatekeeper');

function batch(): number {
  let fights = 0;
  for (const classId of ALL_CLASS_IDS) {
    for (const enemy of gatekeepers) {
      for (let seed = 0; seed < seeds; seed++) {
        playCombat([CLASS_DEFINITIONS[classId].startingLoadout, enemy.loadout], {
          seed,
          gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
          winThreshold: [BREACH_THRESHOLD, CONTAINMENT_THRESHOLD],
          discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.85)],
          playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.85)],
          classId,
          ...enemyCombatOptions(enemy),
        });
        fights++;
      }
    }
  }
  return fights;
}

batch(); // warm-up (JIT)
const times: number[] = [];
let fights = 0;
for (let r = 0; r < repeat; r++) {
  const start = performance.now();
  fights = batch();
  times.push(performance.now() - start);
}
const best = Math.min(...times);
console.log(`${fights} fights per batch; best of ${repeat}: ${best.toFixed(0)} ms = ${((fights / best) * 1000).toFixed(0)} fights/s (all: ${times.map((t) => t.toFixed(0)).join(', ')} ms)`);
