/**
 * Burner check (session 64, docs/burners-events-design.md checkpoint 2):
 * what each Burner is worth, measured with and without it (the user's rule).
 *
 * --part=combat: duels of six 6-subroutine class loadouts (as
 * enemy-parity.ts builds them) against a layer's elites, carrying one
 * combat Burner that the simulated player uses (synergyAwareCombatBurnerActivation),
 * against carrying none. Reports the player's win rate and the enemy's final
 * Containment fill, and each Burner's gain relative to Flash Drive's (the
 * common lump, the yardstick: value 1.0).
 *
 * --part=map: full runs (the synergy profile, skill 0.85) carrying one map
 * Burner from the start, against carrying none: victory, and the Heat it
 * saved (map cuts booked as `burner` Heat, free moves, Log Wiper).
 *
 * PROVENANCE: combat part is duels, not a full-run metric; map part is
 * full runs, one Burner at the start (not the real supply).
 *
 * Usage:
 *   npx tsx scripts/burner-check.ts --part=combat [--layer=2] [--seeds=40]
 *   npx tsx scripts/burner-check.ts --part=map [--seeds=50]
 */
import { playCombat, synergyAwareCombatBurnerActivation, neverActivateBurner } from '../src/engine/combat';
import { CLASS_STARTING_LOADOUTS, ALL_POOL_SUBROUTINES } from '../src/engine/subroutines';
import { CLASS_DEFINITIONS, ALL_CLASS_IDS, type ClassId } from '../src/engine/classes';
import { rarityOf } from '../src/engine/rewards';
import { ENEMY_ROSTER, enemyCombatOptions, enemySkill as enemySkillFor, scaledEnemyLoadout, type EnemyDefinition } from '../src/engine/enemies';
import { ENEMY_LAYER_SCALER } from '../src/engine/content/enemies';
import { GAUGE_THRESHOLD } from '../src/engine/encounters';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { BURNER_DEFINITIONS } from '../src/engine/burners';
import type { BurnerId } from '../src/engine/burner-types';
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const part = args.part ?? 'combat';
const layer = Number(args.layer ?? 2);
const seeds = Number(args.seeds ?? (part === 'combat' ? 40 : 50));
const WIN = 50;

if (part === 'combat') {
  const loadoutFor = (classId: ClassId) => {
    const start = CLASS_STARTING_LOADOUTS[classId];
    const extra = ALL_POOL_SUBROUTINES.filter((q) => CLASS_DEFINITIONS[classId].archetypes.includes(q.archetype) && rarityOf(q.id) === 'common' && !start.some((x) => x.id === q.id)).slice(0, 6 - start.length);
    return [...start, ...extra];
  };
  const scalerAt = (e: EnemyDefinition) => (e.scale ?? 1) * (ENEMY_LAYER_SCALER[layer - 1] / ENEMY_LAYER_SCALER[e.minLayer - 1]);
  const enemySkill = enemySkillFor('elite', layer, 99);
  const elites = ENEMY_ROSTER.filter((e) => e.tier === 'elite' && e.minLayer <= layer);

  const measure = (burner: BurnerId | null) => {
    let wins = 0, fill = 0, n = 0;
    for (const e of elites) {
      const loadout = scaledEnemyLoadout(e.loadout, scalerAt(e));
      for (const classId of ALL_CLASS_IDS) {
        for (let seed = 0; seed < seeds; seed++) {
          const r = playCombat([loadoutFor(classId), loadout], {
            seed, gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD], winThreshold: [WIN, WIN], classId,
            ...enemyCombatOptions(e),
            carriedBurnerIds: burner ? [burner] : [],
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
  };

  const combat = (Object.keys(BURNER_DEFINITIONS) as BurnerId[]).filter((id) => BURNER_DEFINITIONS[id].combat);
  console.log(`BURNER CHECK (combat) -- layer ${layer} elites (${elites.map((e) => e.name).join(', ')}), six class loadouts, ${seeds} seeds each`);
  const base = measure(null);
  const fd = measure('flash-drive');
  const fdWin = fd.win - base.win;
  const fdFill = base.fill - fd.fill;
  console.log(`none                  win ${base.win.toFixed(1)}%  enemy fill ${base.fill.toFixed(1)}%`);
  for (const id of combat) {
    const m = id === 'flash-drive' ? fd : measure(id);
    const dWin = m.win - base.win;
    const dFill = base.fill - m.fill;
    const def = BURNER_DEFINITIONS[id];
    const tag = def.contraband ? 'contraband' : def.rarity;
    console.log(
      `${def.name.padEnd(20)}  ${tag.padEnd(10)} ${def.combat!.timing.padEnd(8)} win ${m.win.toFixed(1)}% (${dWin >= 0 ? '+' : ''}${dWin.toFixed(1)})  fill ${m.fill.toFixed(1)}% (${dFill >= 0 ? '-' : '+'}${Math.abs(dFill).toFixed(1)})  vs Flash Drive: win x${(dWin / fdWin).toFixed(2)}, fill x${(dFill / fdFill).toFixed(2)}`,
    );
  }
} else {
  const map = (Object.keys(BURNER_DEFINITIONS) as BurnerId[]).filter((id) => BURNER_DEFINITIONS[id].mapEffect && id !== 'skeleton-key' && id !== 'tunnel');
  const runs = (burner: BurnerId | null) => {
    let wins = 0, saved = 0, n = 0;
    for (const classId of ALL_CLASS_IDS) {
      for (let seed = 0; seed < seeds; seed++) {
        const r = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85, carriedBurnerIdsOverride: burner ? [burner] : [] });
        if (r.outcome === 'victory') wins++;
        // Heat the Burner saved: map cuts, free moves (a move's usual cost),
        // and Log Wiper's 10 (the drop, floored at 0, isn't logged; count 10).
        for (const e of r.log) {
          if (e.type === 'encounter') saved -= e.outcome.heatSources.burner;
          if (e.type === 'move' && e.heatCost === 0) saved += 2;
          if (e.type === 'mapBurnerActivated' && e.burnerId === 'log-wiper') saved += 10;
        }
        n++;
      }
    }
    return { win: (100 * wins) / n, saved: saved / n };
  };
  console.log(`BURNER CHECK (map) -- full runs, one Burner carried from the start, ${seeds} seeds x 6 classes`);
  const base = runs(null);
  console.log(`none                  victory ${base.win.toFixed(1)}%`);
  for (const id of map) {
    const m = runs(id);
    const def = BURNER_DEFINITIONS[id];
    console.log(`${def.name.padEnd(20)}  ${(def.contraband ? 'contraband' : def.rarity).padEnd(10)} victory ${m.win.toFixed(1)}% (${m.win - base.win >= 0 ? '+' : ''}${(m.win - base.win).toFixed(1)})  Heat saved/run ${m.saved.toFixed(1)}`);
  }
}
