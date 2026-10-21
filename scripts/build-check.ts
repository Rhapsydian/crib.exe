/**
 * Build check (session 61): how strong one real player's build is against
 * a layer's gatekeepers, and what's carrying it -- next to what the
 * simulated player brings to the same fight.
 *
 * Part A re-fights a fixed build (the user's layer-4 Eidolon run, which
 * beat Root Authority in one hand) against each gatekeeper of the layer,
 * whole and with parts taken away: no general Mods, no Merge ranks, no
 * chain finishers. Part B plays real runs with the synergy profile and
 * reports the simulated player's state at that layer's gatekeeper: Mods,
 * Data, ranks, loadout size, and its own pass rate.
 *
 * PROVENANCE: duels at player skill 0.85, enemy skill and scale as
 * resolveFight sets them. Part B is a full-run cohort (whoever reached the
 * layer).
 *
 * Usage:
 *   npx tsx scripts/build-check.ts [--seeds=300] [--runs=100] [--layer=4]
 */
import { playCombat } from '../src/engine/combat';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD, CONTAINMENT_THRESHOLD } from '../src/engine/encounters';
import { ENEMY_ROSTER, enemySkill, magnitudeScalerFor, gaugeThresholdFor, winThresholdFor, scaledEnemyLoadout, enemyCombatOptions, type EnemyDefinition } from '../src/engine/enemies';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { authoredPiece as p } from '../src/engine/content/starting-loadouts';
import { upgradedDefinition } from '../src/engine/merge';
import { MOD_DEFINITIONS } from '../src/engine/mods';
import type { ModId } from '../src/engine/mod-types';
import type { SubroutineDefinition } from '../src/engine/subroutine-types';
import type { ClassId } from '../src/engine/classes';
import { ALL_CLASS_IDS } from '../src/engine/classes';
import { playRun, opportunisticTraversal, type GatekeeperFightContext } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const seeds = Number(args.seeds ?? 300);
const runs = Number(args.runs ?? 100);
const layer = Number(args.layer ?? 4);

const ranked = (id: string, ranks: number): SubroutineDefinition => {
  let d = p(id);
  for (let i = 0; i < ranks; i++) d = upgradedDefinition(d);
  return d;
};
const granted = (id: ModId) => MOD_DEFINITIONS[id].grantedSubroutine as SubroutineDefinition;

// The user's build at the start of the layer-4 gatekeeper (session 61).
const CLASS: ClassId = 'daemon-overclock';
const CHAIN: SubroutineDefinition[] = [
  p('turbo-mode'),
  ranked('cache-hit', 3),
  ranked('port-forward', 3),
  p('chain-reaction'),
  ranked('priority-override', 2),
  ranked('grand-slam', 1),
];
const MODS: ModId[] = [
  'auxiliary-process', 'surge-protector', 'petty-theft', 'salvage-protocol', 'firmware-patch', 'scrap-merchant',
  'cache-prefetch', 'daemon-amplifier', 'early-momentum', 'first-contact', 'overclock-amplifier', 'threshold-exploit',
  'vendor-discount', 'init-script', 'petty-cache', 'light-footing', 'cold-boot', 'boot-sector', 'backdoor-access',
  'warm-boot', 'backup-generator', 'quiet-hours',
] as ModId[];
const GRANTS = [granted('auxiliary-process' as ModId), granted('backdoor-access' as ModId)];

const variants: { name: string; loadout: SubroutineDefinition[]; mods: ModId[] }[] = [
  { name: 'the whole build', loadout: [...CHAIN, ...GRANTS], mods: MODS },
  { name: 'no general Mods', loadout: CHAIN, mods: [] },
  { name: 'no Merge ranks', loadout: [...CHAIN.map((d) => p(d.id)), ...GRANTS], mods: MODS },
  { name: 'no chain finishers', loadout: [...CHAIN.filter((d) => d.id !== 'chain-reaction' && d.id !== 'grand-slam'), ...GRANTS], mods: MODS },
  { name: 'no Amplifier/Firmware', loadout: [...CHAIN, ...GRANTS], mods: MODS.filter((m) => m !== 'overclock-amplifier' && m !== 'firmware-patch' && m !== 'daemon-amplifier') },
];

const gatekeepers = ENEMY_ROSTER.filter((e) => e.tier === 'gatekeeper' && e.minLayer === layer);

function fight(loadout: SubroutineDefinition[], mods: ModId[], enemy: EnemyDefinition, classId: ClassId, seed: number) {
  const skill = enemySkill(enemy.tier, layer, 99);
  return playCombat([loadout, scaledEnemyLoadout(enemy.loadout, magnitudeScalerFor(enemy, layer, 99))], {
    seed,
    gaugeThreshold: [GAUGE_THRESHOLD, gaugeThresholdFor(enemy, layer, 99, GAUGE_THRESHOLD)],
    winThreshold: [BREACH_THRESHOLD, winThresholdFor(enemy, layer, 99, CONTAINMENT_THRESHOLD)],
    classId,
    ...enemyCombatOptions(enemy),
    ownedModIds: mods,
    discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(skill)],
    playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(skill)],
  });
}

console.log(`BUILD CHECK -- layer ${layer} gatekeepers, ${seeds} fights each, player skill 0.85\n`);
console.log('Part A: the user\'s Eidolon build');
for (const v of variants) {
  const cells = gatekeepers.map((g) => {
    let wins = 0, hands = 0;
    for (let s = 0; s < seeds; s++) {
      const r = fight(v.loadout, v.mods, g, CLASS, s);
      if (r.winner === 0) wins++;
      hands += r.hands.length;
    }
    return `${g.name} ${((100 * wins) / seeds).toFixed(1)}% (${(hands / seeds).toFixed(1)} hands)`;
  });
  console.log(`  ${v.name.padEnd(24)} ${cells.join('   ')}`);
}

console.log(`\nPart B: the simulated player (synergy profile) at the layer-${layer} gatekeeper, ${runs} runs a class`);
for (const classId of ALL_CLASS_IDS) {
  const caps: GatekeeperFightContext[] = [];
  for (let seed = 0; seed < runs; seed++) {
    playRun({
      ...SYNERGY_AWARE_PROFILE,
      seed,
      classId,
      traversalStrategy: opportunisticTraversal,
      safehouseStrategy: opportunisticSafehouseStrategy,
      playerSkill: 0.85,
      onBeforeGatekeeperFight: (ctx) => {
        if (ctx.layerIndex === layer) caps.push(ctx);
      },
    });
  }
  if (!caps.length) {
    console.log(`  ${classId.padEnd(20)} none reached layer ${layer}`);
    continue;
  }
  const avg = (f: (c: GatekeeperFightContext) => number) => (caps.reduce((s, c) => s + f(c), 0) / caps.length).toFixed(1);
  const wins = caps.filter((c, i) => fight(c.playerState.installedLoadout, c.playerState.ownedModIds, c.enemy, classId, i).winner === 0).length;
  console.log(
    `  ${classId.padEnd(20)} n=${String(caps.length).padStart(3)}  Mods ${avg((c) => c.playerState.ownedModIds.length)}  Data ${avg((c) => c.playerState.data)}  ` +
      `ranks ${avg((c) => Object.values(c.playerState.rank).reduce((a, b) => a + b, 0))}  installed ${avg((c) => c.playerState.installedLoadout.length)}  ` +
      `banked ${avg((c) => Object.values(c.playerState.material).reduce((a, b) => a + b, 0))}  wins its gatekeeper ${((100 * wins) / caps.length).toFixed(0)}%`,
  );
}
console.log(`\nThe user's build: 22 general Mods, 200+ Data at Shops, ranks 9 (III, III, II, I), 8 installed.`);
