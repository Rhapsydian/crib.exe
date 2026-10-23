/**
 * Mod check (session 65, docs/mods-design.md checkpoint 2): what each
 * combat Mod is worth, measured with and without it (the user's rule, as
 * burner-check.ts does for Burners).
 *
 * Duels of six 6-subroutine class loadouts (as burner-check.ts builds
 * them) against a layer's elites, owning one Mod against owning none (the
 * class Mod always on). Reports the player's win rate and the enemy's final
 * Containment fill, and each Mod's fill reduction as a multiple of its
 * rarity's existing average (the yardstick: today's uncommons and rares).
 * An archetype-gated Mod is only measured for the classes it is offered to.
 *
 * Fixtures: Hot Standby gets a bench of the next two common subroutines of
 * the class's archetypes; Persistent Payload is measured with Bootstrap
 * Loader carried in both arms; a granted-subroutine Mod adds its
 * subroutine to the loadout.
 *
 * PROVENANCE: duels, not a full-run metric.
 *
 * Usage:
 *   npx tsx scripts/mod-check.ts [--layer=2] [--seeds=20] [--only=nobs-exploit,deep-cache]
 */
import { playCombat, synergyAwareCombatBurnerActivation, neverActivateBurner } from '../src/engine/combat';
import { CLASS_STARTING_LOADOUTS, ALL_POOL_SUBROUTINES } from '../src/engine/subroutines';
import { CLASS_DEFINITIONS, ALL_CLASS_IDS, type ClassId } from '../src/engine/classes';
import { rarityOf } from '../src/engine/rewards';
import { ENEMY_ROSTER, enemyCombatOptions, enemySkill as enemySkillFor, scaledEnemyLoadout, type EnemyDefinition } from '../src/engine/enemies';
import { ENEMY_LAYER_SCALER } from '../src/engine/content/enemies';
import { GAUGE_THRESHOLD } from '../src/engine/encounters';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { MOD_DEFINITIONS, generalModPool } from '../src/engine/mods';
import type { ModId } from '../src/engine/mod-types';
import type { BurnerId } from '../src/engine/burner-types';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const layer = Number(args.layer ?? 2);
const seeds = Number(args.seeds ?? 20);
const only = args.only ? new Set(String(args.only).split(',')) : null;
const WIN = 50;

/** Mods that never act in a fight (map, Shop, rewards, Data, Heat). */
const RUN_ONLY = new Set<ModId>([
  'static-shield', 'light-footing', 'vendor-discount', 'backup-generator', 'petty-cache', 'quiet-hours', 'petty-theft', 'init-script',
  'salvage-protocol', 'bulk-buyer', 'fast-learner', 'scrap-merchant', 'black-budget', 'heat-sink',
]);
/** The twelve rule-benders (M6), reported against the existing Mods. */
const NEW = new Set<ModId>(['nobs-exploit', 'run-splicer', 'last-word', 'lucky-cut', 'ward-converter', 'mirror-hand', 'hot-standby', 'echo-chamber', 'thirty-one', 'deep-cache', 'root-cause', 'persistent-payload']);

const commonsFor = (classId: ClassId) =>
  ALL_POOL_SUBROUTINES.filter((q) => CLASS_DEFINITIONS[classId].archetypes.includes(q.archetype) && rarityOf(q.id) === 'common' && !CLASS_STARTING_LOADOUTS[classId].some((x) => x.id === q.id));
const loadoutFor = (classId: ClassId) => [...CLASS_STARTING_LOADOUTS[classId], ...commonsFor(classId).slice(0, 6 - CLASS_STARTING_LOADOUTS[classId].length)];
const benchFor = (classId: ClassId) => commonsFor(classId).slice(6 - CLASS_STARTING_LOADOUTS[classId].length, 8 - CLASS_STARTING_LOADOUTS[classId].length);
const scalerAt = (e: EnemyDefinition) => (e.scale ?? 1) * (ENEMY_LAYER_SCALER[layer - 1] / ENEMY_LAYER_SCALER[e.minLayer - 1]);
const enemySkill = enemySkillFor('elite', layer, 99);
const elites = ENEMY_ROSTER.filter((e) => e.tier === 'elite' && e.minLayer <= layer);
const allowed = (mod: ModId, classId: ClassId) => {
  const archetype = MOD_DEFINITIONS[mod].archetype;
  return archetype === undefined || CLASS_DEFINITIONS[classId].archetypes.includes(archetype);
};

/** Win % and enemy fill % for `classes`, owning `mod` or nothing. */
function measure(mod: ModId | null, classes: ClassId[]) {
  let wins = 0, fill = 0, n = 0;
  const burners: BurnerId[] = mod === 'persistent-payload' || only?.has('persistent-payload') ? ['bootstrap-loader'] : [];
  for (const e of elites) {
    const enemy = scaledEnemyLoadout(e.loadout, scalerAt(e));
    for (const classId of classes) {
      const granted = mod ? MOD_DEFINITIONS[mod].grantedSubroutine : undefined;
      const loadout = granted ? [...loadoutFor(classId), granted] : loadoutFor(classId);
      for (let seed = 0; seed < seeds; seed++) {
        const r = playCombat([loadout, enemy], {
          seed, gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD], winThreshold: [WIN, WIN], classId,
          ...enemyCombatOptions(e),
          ownedModIds: mod ? [mod] : [],
          benched: benchFor(classId),
          carriedBurnerIds: mod === 'persistent-payload' ? burners : [],
          burnerActivationStrategies: [synergyAwareCombatBurnerActivation, neverActivateBurner],
          discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(enemySkill)],
          playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(enemySkill)],
        });
        if (r.winner === 0) wins++;
        fill += r.finalFillFraction[1];
        n++;
      }
    }
  }
  return { win: (100 * wins) / n, fill: (100 * fill) / n };
}

const baseCache = new Map<string, { win: number; fill: number }>();
const baseFor = (classes: ClassId[]) => {
  const key = classes.join(',');
  if (!baseCache.has(key)) baseCache.set(key, measure(null, classes));
  return baseCache.get(key)!;
};
// Persistent Payload's arm carries the Burner; so does its baseline.
const payloadBase = () => {
  let wins = 0, fill = 0, n = 0;
  for (const e of elites) {
    const enemy = scaledEnemyLoadout(e.loadout, scalerAt(e));
    for (const classId of ALL_CLASS_IDS) {
      for (let seed = 0; seed < seeds; seed++) {
        const r = playCombat([loadoutFor(classId), enemy], {
          seed, gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD], winThreshold: [WIN, WIN], classId, ...enemyCombatOptions(e),
          carriedBurnerIds: ['bootstrap-loader'], burnerActivationStrategies: [synergyAwareCombatBurnerActivation, neverActivateBurner],
          discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(enemySkill)], playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(enemySkill)],
        });
        if (r.winner === 0) wins++;
        fill += r.finalFillFraction[1];
        n++;
      }
    }
  }
  return { win: (100 * wins) / n, fill: (100 * fill) / n };
};

const combatMods = generalModPool().map((m) => m.id).filter((id) => !RUN_ONLY.has(id) && (!only || only.has(id)));
console.log(`MOD CHECK -- layer ${layer} elites (${elites.map((e) => e.name).join(', ')}), six class loadouts, ${seeds} seeds each`);
const all = baseFor(ALL_CLASS_IDS);
console.log(`none                  win ${all.win.toFixed(1)}%  enemy fill ${all.fill.toFixed(1)}%`);

const rows: { id: ModId; rarity: string; win: number; cut: number }[] = [];
for (const id of combatMods) {
  const classes = ALL_CLASS_IDS.filter((c) => allowed(id, c));
  const base = id === 'persistent-payload' ? payloadBase() : baseFor(classes);
  const m = measure(id, classes);
  rows.push({ id, rarity: MOD_DEFINITIONS[id].rarity, win: m.win - base.win, cut: base.fill - m.fill });
}
for (const rarity of ['common', 'uncommon', 'rare']) {
  const old = rows.filter((r) => r.rarity === rarity && !NEW.has(r.id));
  const yardstick = old.length ? old.reduce((s, r) => s + r.cut, 0) / old.length : NaN;
  console.log(`\n--- ${rarity} (existing average fill cut ${yardstick.toFixed(2)} points) ---`);
  for (const r of rows.filter((x) => x.rarity === rarity)) {
    console.log(`${(NEW.has(r.id) ? '* ' : '  ') + MOD_DEFINITIONS[r.id].name.padEnd(22)} win ${r.win >= 0 ? '+' : ''}${r.win.toFixed(1)}  fill cut ${r.cut.toFixed(2)}  x${(r.cut / yardstick).toFixed(2)}`);
  }
}
