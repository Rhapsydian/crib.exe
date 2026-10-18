/**
 * Roster check (step 3, enemies; `docs/authoring-design.md` E3, E5).
 * (Not scripts/enemy-check.ts, session 50's per-enemy difficulty
 * diagnostic against accumulated state.)
 *
 * Prices each authored enemy as kit power (pricing.ts) at every layer it
 * can appear, with that layer's magnitude scaler, against E3's budget
 * table (regulars and elites are authored to their first layer's budget).
 * For enemies carrying Trace pressure (E7's tracers), also reports the
 * Trace they push onto a typical player per fight, as a share of that
 * layer's Heat allowance.
 *
 * PROVENANCE: duels at equal skill 0.85 (real fights use the enemy skill
 * dial), no Mods. Not a full-run metric.
 *
 * Usage:
 *   npx tsx scripts/roster-check.ts [--tier=regular] [--seeds=60] [--only=id,...]
 */
import { kitPower } from '../src/engine/pricing';
import { playCombat } from '../src/engine/combat';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import { scaledEnemyLoadout } from '../src/engine/enemies';
import { LAYER_HEAT_ALLOWANCE } from '../src/engine/heat';
import { CLASS_DEFINITIONS, ALL_CLASS_IDS } from '../src/engine/classes';
import { AUTHORED_REGULARS, AUTHORED_ELITES, AUTHORED_GATEKEEPERS, ENEMY_BUDGET, ENEMY_LAYER_SCALER, type AuthoredEnemy } from '../src/engine/content/enemies';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const seeds = Number(args.seeds ?? 60);
const only = args.only ? new Set(args.only.split(',')) : null;
const TIERS: Record<string, AuthoredEnemy[]> = { regular: AUTHORED_REGULARS, elite: AUTHORED_ELITES, gatekeeper: AUTHORED_GATEKEEPERS };
const roster = TIERS[args.tier ?? 'regular'];

/** The enemy's magnitude at `layer`: its authored scale, times the
 * proposed layer scaler relative to its first layer (gatekeepers appear
 * at one layer only). */
const scalerAt = (enemy: AuthoredEnemy, layer: number) =>
  (enemy.scale ?? 1) * (enemy.tier === 'gatekeeper' ? 1 : ENEMY_LAYER_SCALER[layer - 1] / ENEMY_LAYER_SCALER[enemy.minLayer - 1]);
const options = { seeds, skill: 0.85, gaugeThreshold: GAUGE_THRESHOLD, winThreshold: BREACH_THRESHOLD };

/** The Heat an enemy's alarms raise against the player per fight:
 * against each class's starting loadout (the player in seat 0, where
 * alarm Heat accrues). Since session 58 the player makes no Heat of their
 * own in a fight, so this is the alarm's Heat directly. */
function alarmPerFight(enemy: AuthoredEnemy, layer: number): number {
  return alarmAgainst(scaledEnemyLoadout(enemy.loadout, scalerAt(enemy, layer)), enemy);
}

function alarmAgainst(loadout: ReturnType<typeof scaledEnemyLoadout>, enemy: AuthoredEnemy): number {
  let trace = 0;
  let fights = 0;
  for (const classId of ALL_CLASS_IDS) {
    for (let seed = 0; seed < Math.ceil(seeds / 3); seed++) {
      const r = playCombat([CLASS_DEFINITIONS[classId].startingLoadout, loadout], {
        seed,
        gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
        winThreshold: [BREACH_THRESHOLD, BREACH_THRESHOLD],
        discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.85)],
        playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.85)],
        classId,
        opponentBridge: enemy.bridge,
        gatekeeperMods: [[], enemy.mods ?? []],
      });
      trace += r.heatGenerated;
      fights++;
    }
  }
  return trace / fights;
}

console.log(`\nROSTER CHECK (${args.tier ?? 'regular'}) -- kit power, Credit/turn, ${seeds} seeds x 2 seats; skill 0.85; no Mods. Budget = E3's table.`);
console.log(`${'enemy'.padEnd(20)} first  budget   power by layer (scaled)                       first-layer verdict`);
for (const enemy of roster) {
  if (only && !only.has(enemy.id)) continue;
  // Gatekeepers appear at one layer only (eligibleEnemies' exact match).
  const layers = enemy.tier === 'gatekeeper' ? [enemy.minLayer] : [1, 2, 3, 4].filter((l) => l >= enemy.minLayer);
  const powers = layers.map((layer) => kitPower(scaledEnemyLoadout(enemy.loadout, scalerAt(enemy, layer)), { ...options, bridge: enemy.bridge, mods: enemy.mods }));
  const budget = ENEMY_BUDGET[enemy.tier][enemy.minLayer - 1];
  const first = powers[0];
  const verdict = first === null ? '?' : Math.abs(first - budget) <= 0.15 * budget ? 'ok (within 15%)' : first < budget ? 'LOW' : 'HIGH';
  const cells = layers.map((l, i) => `L${l} ${powers[i] === null ? '--' : powers[i]!.toFixed(1)} / ${ENEMY_BUDGET[enemy.tier][l - 1].toFixed(1)}`).join('  ');
  console.log(`${enemy.name.padEnd(20)} L${enemy.minLayer}     ${budget.toFixed(1).padStart(5)}   ${cells.padEnd(46)} ${verdict}`);
  if (enemy.loadout.some((piece) => (piece.heatPressure ?? 0) > 0) || enemy.mods?.includes('spotlight')) {
    const t = alarmPerFight(enemy, enemy.minLayer);
    console.log(`${''.padEnd(20)} alarm: ${t.toFixed(2)} Heat/fight on the player = ${((100 * t) / LAYER_HEAT_ALLOWANCE[enemy.minLayer - 1]).toFixed(1)}% of layer ${enemy.minLayer}'s allowance`);
  }
}
