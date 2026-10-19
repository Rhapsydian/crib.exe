/**
 * Enemy parity (session 60, docs/enemy-review.md CP4): an enemy's win rate
 * against the six classes, each with a 6-subroutine loadout (its starting
 * three plus the first three commons from its own archetypes), at a given
 * layer's scale -- next to the same tier's existing enemies at that layer.
 * The comparison is the enemy's Containment fill when the fight ends:
 * win rate saturates (the player wins nearly every regular fight).
 *
 * Why: kit power (roster-check.ts) duels a plain Credit reference with no
 * Hooks and no Ward, so it can't see Wipe or Strip (or Mods like Resource
 * Quota) at all. Parity against real-shaped loadouts can. Enemies carrying
 * those are priced by matching their tier's existing enemies here.
 *
 * PROVENANCE: duels, player skill 0.85, enemy skill as encounters set it
 * for the tier and layer (past the opener window); not a full-run metric. Also reports Heat per fight on the player.
 *
 * Usage:
 *   npx tsx scripts/enemy-parity.ts --layer=3 --tier=regular [--seeds=100] [--only=id,...]
 */
import { playCombat } from '../src/engine/combat';
import { CLASS_STARTING_LOADOUTS, ALL_POOL_SUBROUTINES } from '../src/engine/subroutines';
import { CLASS_DEFINITIONS, type ClassId } from '../src/engine/classes';
import { rarityOf } from '../src/engine/rewards';
import { ENEMY_ROSTER, enemyCombatOptions, enemySkill as enemySkillFor, scaledEnemyLoadout, type EnemyDefinition } from '../src/engine/enemies';
import { ENEMY_LAYER_SCALER } from '../src/engine/content/enemies';
import { GAUGE_THRESHOLD } from '../src/engine/encounters';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const layer = Number(args.layer ?? 1);
const tier = args.tier ?? 'regular';
const seeds = Number(args.seeds ?? 100);
const only = args.only ? new Set(String(args.only).split(',')) : null;
const WIN = 50;

const classes = Object.keys(CLASS_STARTING_LOADOUTS) as ClassId[];
const loadoutFor = (classId: ClassId) => {
  const start = CLASS_STARTING_LOADOUTS[classId];
  const extra = ALL_POOL_SUBROUTINES.filter((q) => CLASS_DEFINITIONS[classId].archetypes.includes(q.archetype) && rarityOf(q.id) === 'common' && !start.some((x) => x.id === q.id)).slice(0, 6 - start.length);
  return [...start, ...extra];
};
/** Regular/elite: authored scale times the layer's scaler from its first layer. */
const scalerAt = (e: EnemyDefinition) => (e.scale ?? 1) * (ENEMY_LAYER_SCALER[layer - 1] / ENEMY_LAYER_SCALER[e.minLayer - 1]);
const enemySkill = enemySkillFor(tier as EnemyDefinition['tier'], layer, 99);

function measure(e: EnemyDefinition): { playerWin: number; fill: number; heat: number } {
  const loadout = scaledEnemyLoadout(e.loadout, scalerAt(e));
  let wins = 0, heat = 0, fill = 0, n = 0;
  for (const classId of classes) {
    for (let seed = 0; seed < seeds; seed++) {
      const r = playCombat([loadoutFor(classId), loadout], {
        seed, gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD], winThreshold: [WIN, WIN], classId,
        ...enemyCombatOptions(e),
        discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(enemySkill)],
        playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(enemySkill)],
      });
      if (r.winner === 0) wins++;
      heat += r.heatGenerated;
      fill += r.finalFillFraction[1];
      n++;
    }
  }
  return { playerWin: (100 * wins) / n, fill: (100 * fill) / n, heat: heat / n };
}

/** Session 60's new enemies, priced by parity with the rest. */
const NEW = new Set(['session-monitor', 'wireless-ids', 'log-shipper', 'honeyfarm', 'edr-sensor', 'integrity-monitor', 'firewall-cluster', 'threat-hunter', 'hypervisor']);
const pool = ENEMY_ROSTER.filter((e) => e.tier === tier && e.minLayer <= layer && (!only || only.has(e.id) || !NEW.has(e.id)));
console.log(`ENEMY PARITY -- ${tier}s at layer ${layer}, vs six 6-subroutine class loadouts, ${seeds} seeds each`);
for (const e of pool) {
  const m = measure(e);
  console.log(`${e.name.padEnd(20)} L${e.minLayer} scale ${(e.scale ?? 1).toFixed(2)}  player wins ${m.playerWin.toFixed(1)}%  enemy fill ${m.fill.toFixed(1)}%  Heat/fight ${m.heat.toFixed(2)}${NEW.has(e.id) ? '  (new)' : ''}`);
}
