/**
 * Enemy rates (session 67, docs/design/enemies.md): the player's win rate
 * against each tier at each layer, from full runs' fight logs -- so each
 * fight is judged at the player's real strength at that point in a run.
 * Keyed on the enemy's own tier, not the node's (an opener-window fight at
 * an elite node is a regular). Targets (E1): elites 80-85%, gatekeepers
 * 70-75%, per layer; fights averaging at least 5 hands (E5).
 *
 * Usage:
 *   npx tsx scripts/enemy-rates.ts [--seeds=100] [--by=enemy] [--classes=overclock-honeypot]
 */
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { ALL_CLASS_IDS } from '../src/engine/classes';
import { enemyById } from '../src/engine/enemies';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const seeds = Number(args.seeds ?? 100);
const byEnemy = args.by === 'enemy';
const classes = (args.classes ? String(args.classes).split(',') : ALL_CLASS_IDS) as typeof ALL_CLASS_IDS;

type Tally = { wins: number; fights: number; hands: number };
const tiers: Record<string, Tally[]> = { regular: [], elite: [], gatekeeper: [] };
const enemies: Record<string, Tally & { tier: string; layers: Set<number> }> = {};
for (const t of Object.values(tiers)) for (let l = 0; l < 4; l++) t.push({ wins: 0, fights: 0, hands: 0 });

for (const classId of classes) {
  for (let seed = 0; seed < seeds; seed++) {
    const r = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
    for (const e of r.log) {
      if (e.type !== 'encounter' || !e.outcome.fight) continue;
      const enemy = enemyById(e.outcome.fight.enemyId);
      if (!enemy) continue;
      const won = e.outcome.newState === 'inert' ? 1 : 0;
      const cell = tiers[enemy.tier][e.layerIndex]; // 0-based in the log
      cell.fights++;
      cell.wins += won;
      cell.hands += e.outcome.fight.hands;
      const row = (enemies[enemy.id] ??= { wins: 0, fights: 0, hands: 0, tier: enemy.tier, layers: new Set() });
      row.fights++;
      row.wins += won;
      row.hands += e.outcome.fight.hands;
      row.layers.add(e.layerIndex + 1);
    }
  }
}

// Fight length (E5, the user): under 5 hands on average is too fast.
const pct = (t: Tally) => (t.fights ? `${((100 * t.wins) / t.fights).toFixed(1)}% ${(t.hands / t.fights).toFixed(1)}h` : '-');
console.log(`ENEMY RATES -- player win rate and mean hands a fight (h), by tier and layer, ${seeds} seeds x ${classes.length} classes`);
console.log(`${'tier'.padEnd(11)}${['layer 1', 'layer 2', 'layer 3', 'layer 4'].map((s) => s.padEnd(16)).join('')}`);
for (const [tier, cells] of Object.entries(tiers)) console.log(`${tier.padEnd(11)}${cells.map((c) => pct(c).padEnd(16)).join('')}`);
if (byEnemy) {
  console.log('\nby enemy:');
  for (const [id, t] of Object.entries(enemies).sort((a, b) => a[1].tier.localeCompare(b[1].tier))) {
    console.log(`  ${t.tier.padEnd(10)} ${(enemyById(id)?.name ?? id).padEnd(22)} layers ${[...t.layers].sort().join(',').padEnd(8)} ${pct(t)} (${t.fights} fights)`);
  }
}
