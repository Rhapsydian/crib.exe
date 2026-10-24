/**
 * Subroutine check (session 66, docs/subroutines-design.md checkpoint 2):
 * what each pool subroutine is worth in a loadout, measured the user's way
 * (with and without), against its own archetype and rarity.
 *
 * For each archetype, the classes that have it play six-subroutine
 * loadouts (as mod-check.ts builds them) against a layer's elites, the top
 * slot held by a plain placeholder (Credit 1, no Hook: swapping against a
 * real common read each swap against a different piece per class). Each
 * subroutine of that archetype not already in a class's loadout takes the
 * top slot (so Charge-next and Empower-the-rest pieces have subroutines
 * below them), and the enemy's final Containment fill is compared with the
 * placeholder's. A subroutine's cut is reported as a
 * multiple of the average cut of its archetype's existing subroutines of
 * the same rarity (session 66's sixteen are marked * and left out of the
 * average).
 *
 * PROVENANCE: duels, not a full-run metric; rank 0 (no Merge).
 *
 * Usage:
 *   npx tsx scripts/subroutine-check.ts [--layer=2] [--seeds=20] [--archetypes=exploit,daemon]
 */
import { playCombat, synergyAwareCombatBurnerActivation, neverActivateBurner } from '../src/engine/combat';
import { CLASS_STARTING_LOADOUTS, ALL_POOL_SUBROUTINES, ARCHETYPE_POOLS } from '../src/engine/subroutines';
import { CLASS_DEFINITIONS, ALL_CLASS_IDS, type ClassId } from '../src/engine/classes';
import { rarityOf } from '../src/engine/rewards';
import { ENEMY_ROSTER, enemyCombatOptions, enemySkill as enemySkillFor, scaledEnemyLoadout, type EnemyDefinition } from '../src/engine/enemies';
import { ENEMY_LAYER_SCALER } from '../src/engine/content/enemies';
import { GAUGE_THRESHOLD } from '../src/engine/encounters';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import type { Archetype, SubroutineDefinition } from '../src/engine/subroutine-types';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const layer = Number(args.layer ?? 2);
const seeds = Number(args.seeds ?? 20);
const archetypes = (args.archetypes ? String(args.archetypes).split(',') : Object.keys(ARCHETYPE_POOLS)) as Archetype[];
const WIN = 50;

/** Session 66's sixteen (S7, S9-S11). */
const NEW = new Set([
  'sequence-attack', 'replay-attack', 'packet-sniffer', 'circuit-breaker',
  'rolling-update', 'thread-pool', 'backpressure', 'deadlock',
  'pipeline-flush', 'superscalar', 'branch-predictor', 'clock-skew',
  'anomaly-detector', 'mantrap', 'bait-file', 'reflector',
]);

const commonsFor = (classId: ClassId) =>
  ALL_POOL_SUBROUTINES.filter((q) => CLASS_DEFINITIONS[classId].archetypes.includes(q.archetype) && rarityOf(q.id) === 'common' && !NEW.has(q.id) && !CLASS_STARTING_LOADOUTS[classId].some((x) => x.id === q.id));
const PLACEHOLDER: SubroutineDefinition = { id: 'placeholder', name: 'Placeholder', archetype: 'exploit', alpha: { verb: 'credit', amount: 1 } };
// The tested slot is the top, so a subroutine that acts on the ones below
// it (Charge next, Empower the rest) has something to act on.
const loadoutFor = (classId: ClassId) => [PLACEHOLDER, ...CLASS_STARTING_LOADOUTS[classId], ...commonsFor(classId).slice(0, 5 - CLASS_STARTING_LOADOUTS[classId].length)];
const scalerAt = (e: EnemyDefinition) => (e.scale ?? 1) * (ENEMY_LAYER_SCALER[layer - 1] / ENEMY_LAYER_SCALER[e.minLayer - 1]);
const enemySkill = enemySkillFor('elite', layer, 99);
const elites = ENEMY_ROSTER.filter((e) => e.tier === 'elite' && e.minLayer <= layer);

/** The enemy's mean final fill (%) against `loadout`. */
function fill(classId: ClassId, loadout: SubroutineDefinition[]): number {
  let total = 0, n = 0;
  for (const e of elites) {
    const enemy = scaledEnemyLoadout(e.loadout, scalerAt(e));
    for (let seed = 0; seed < seeds; seed++) {
      const r = playCombat([loadout, enemy], {
        seed, gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD], winThreshold: [WIN, WIN], classId,
        ...enemyCombatOptions(e),
        burnerActivationStrategies: [synergyAwareCombatBurnerActivation, neverActivateBurner],
        discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(enemySkill)],
        playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(enemySkill)],
      });
      total += r.finalFillFraction[1];
      n++;
    }
  }
  return (100 * total) / n;
}

console.log(`SUBROUTINE CHECK -- layer ${layer} elites (${elites.map((e) => e.name).join(', ')}), ${seeds} seeds each; swapped into the top slot`);
for (const archetype of archetypes) {
  const classes = ALL_CLASS_IDS.filter((c) => CLASS_DEFINITIONS[c].archetypes.includes(archetype));
  const base = new Map(classes.map((c) => [c, fill(c, loadoutFor(c))]));
  const pool = ALL_POOL_SUBROUTINES.filter((p) => p.archetype === archetype);
  const cuts = pool.map((piece) => {
    let cut = 0, n = 0;
    for (const c of classes) {
      const loadout = loadoutFor(c);
      if (loadout.some((x) => x.id === piece.id)) continue;
      cut += base.get(c)! - fill(c, [piece, ...loadout.slice(1)]);
      n++;
    }
    return { piece, rarity: rarityOf(piece.id), cut: n ? cut / n : NaN };
  });
  console.log(`\n=== ${archetype} (${classes.map((c) => CLASS_DEFINITIONS[c].name).join(', ')}) ===`);
  for (const rarity of ['common', 'uncommon', 'rare']) {
    const rows = cuts.filter((r) => r.rarity === rarity && !Number.isNaN(r.cut));
    const old = rows.filter((r) => !NEW.has(r.piece.id));
    const yardstick = old.reduce((s, r) => s + r.cut, 0) / (old.length || 1);
    console.log(`--- ${rarity} (existing average fill cut ${yardstick.toFixed(2)}) ---`);
    for (const r of rows) console.log(`${(NEW.has(r.piece.id) ? '* ' : '  ') + r.piece.name.padEnd(22)} fill cut ${r.cut.toFixed(2)}  x${(r.cut / yardstick).toFixed(2)}`);
  }
}
