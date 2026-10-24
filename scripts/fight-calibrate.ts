/**
 * Fight calibration (session 67, docs/enemies-design.md checkpoint 3):
 * plays full runs once, captures the player exactly as they stood at every
 * fight of one tier, then replays only those fights under trial settings
 * -- each layer's Breach gauge, Containment gauge and enemy strength as
 * multiples of today's -- reporting the player's win rate and mean hands a
 * fight by layer. Real player strength at each point of a run, at a
 * fraction of a full run's cost. Targets: elites 80-85% (E1), gatekeepers
 * 70-75%; at least 5 hands (E5).
 *
 * The replay matches resolveFight's setup (thresholds, the enemy's scaled
 * loadout and Mods, skills, the player's Mods, Burners, bench and class
 * upgrade); later fights in a run don't see a replay's outcome, so it
 * measures each fight as it stood.
 *
 * Usage:
 *   npx tsx scripts/fight-calibrate.ts [--tier=elite] [--seeds=60] \
 *     [--breach=1,1,1.4,2] [--containment=1,1,1.4,2] [--strength=1,1,1,1]
 */
import { runRequests, opportunisticTraversal, type RunPlayerState } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { ALL_CLASS_IDS } from '../src/engine/classes';
import { playCombat, synergyAwareCombatBurnerActivation, neverActivateBurner } from '../src/engine/combat';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { enemyCombatOptions, enemySkill, magnitudeScalerFor, scaledEnemyLoadout, type EnemyDefinition } from '../src/engine/enemies';
import { combatThresholdsFor } from '../src/engine/encounters';
import { BURNER_DEFINITIONS } from '../src/engine/burners';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const tier = (args.tier ?? 'elite') as 'elite' | 'gatekeeper';
const seeds = Number(args.seeds ?? 60);
const perLayer = (key: string): number[] => (args[key] ? String(args[key]).split(',').map(Number) : [1, 1, 1, 1]);
const breach = perLayer('breach');
const containment = perLayer('containment');
const strength = perLayer('strength');

interface Sample { playerState: RunPlayerState; enemy: EnemyDefinition; layer: number; seed: number }
const samples: Sample[] = [];
for (const classId of ALL_CLASS_IDS) {
  for (let seed = 0; seed < seeds; seed++) {
    const run = runRequests({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
    let step = run.next();
    let n = 0;
    while (!step.done) {
      const req = step.value;
      if (req.kind === 'fightStart' && req.enemy.tier === tier) samples.push({ playerState: req.playerState, enemy: req.enemy, layer: req.layer, seed: seed * 101 + n++ });
      step = run.next(req.fallback());
    }
  }
}

const cells = [0, 1, 2, 3].map(() => ({ wins: 0, fights: 0, hands: 0 }));
const byEnemy: Record<string, { wins: number; fights: number; hands: number }> = {};
for (const s of samples) {
  const l = s.layer - 1;
  const t = combatThresholdsFor(s.playerState, s.enemy, s.layer, 99);
  const enemySide = scaledEnemyLoadout(s.enemy.loadout, magnitudeScalerFor(s.enemy, s.layer, 99) * strength[l]);
  const skill = enemySkill(tier, s.layer, 99);
  const r = playCombat([s.playerState.installedLoadout, enemySide], {
    seed: s.seed,
    gaugeThreshold: t.gaugeThreshold,
    winThreshold: [Math.round(t.winThreshold[0] * breach[l]), Math.round(t.winThreshold[1] * containment[l])],
    classId: s.playerState.classId,
    ...enemyCombatOptions(s.enemy),
    ownedModIds: s.playerState.ownedModIds,
    classModUpgraded: s.playerState.classModUpgraded,
    benched: s.playerState.bench,
    fightTier: tier,
    carriedBurnerIds: s.playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('combat')),
    burnerActivationStrategies: [synergyAwareCombatBurnerActivation, neverActivateBurner],
    discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(skill)],
    playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(skill)],
  });
  cells[l].fights++;
  cells[l].wins += r.winner === 0 ? 1 : 0;
  cells[l].hands += r.hands.length;
  const row = (byEnemy[s.enemy.name] ??= { wins: 0, fights: 0, hands: 0 });
  row.fights++;
  row.wins += r.winner === 0 ? 1 : 0;
  row.hands += r.hands.length;
}

console.log(`FIGHT CALIBRATION -- ${tier}s, ${samples.length} fights captured from ${seeds} seeds x 6 classes`);
console.log(`breach x${breach.join('/')}  containment x${containment.join('/')}  strength x${strength.join('/')}`);
for (const [name, c] of Object.entries(byEnemy).sort((a, b) => a[1].wins / a[1].fights - b[1].wins / b[1].fights)) {
  console.log(`  ${name.padEnd(22)} ${((100 * c.wins) / c.fights).toFixed(1)}% ${(c.hands / c.fights).toFixed(1)}h (${c.fights})`);
}
console.log(cells.map((c, l) => `L${l + 1}: ${c.fights ? `${((100 * c.wins) / c.fights).toFixed(1)}% ${(c.hands / c.fights).toFixed(1)}h (${c.fights})` : '-'}`).join('   '));
