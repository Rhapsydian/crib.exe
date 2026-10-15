/**
 * Player power by layer (step 3, enemies; `docs/authoring-design.md` E3
 * stage 1, E5 step 1).
 *
 * The enemy power budget is a fraction of how strong a real player is at
 * each layer, so this measures that. Runs are played per class
 * (synergy acquisition, opportunistic traversal, skill 0.85) with every
 * gatekeeper replaced by a guaranteed pass, so every run reaches all four
 * layers (an unfiltered cohort, as in session 49). The player's state is
 * captured at each gatekeeper (`onBeforeGatekeeperFight`, i.e. at the END
 * of that layer's exploring) and its loadout priced as **kit power**: the
 * flat Credit per turn it ties in a seat-swapped duel. The test side is
 * the loadout with its class bridge; the reference side is one Credit-Δ
 * piece padded with Credit-0 pieces to the same count. Other Mods and
 * Burners are left out (playCombat applies them to side 0 only).
 *
 * Also prices the current SKELETON enemies the same way at each layer
 * they can appear (with their layer's magnitude scaler), as a reference
 * for what today's ratio is.
 *
 * PROVENANCE: duels at equal skill 0.85 (real fights use the enemy skill
 * dial and different thresholds), and the state the run reached at each
 * gatekeeper. Not a balance measurement of the roster.
 *
 * Usage:
 *   npx tsx scripts/player-power.ts [--runs=20] [--seeds=30] [--classes=a,b] [--skip=enemies]
 */
import { playRun, opportunisticTraversal, type GatekeeperFightContext } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import { kitPower as enginePower } from '../src/engine/pricing';
import { ENEMY_ROSTER, magnitudeScalerFor, scaledEnemyLoadout } from '../src/engine/enemies';
import { ALL_CLASS_IDS, CLASS_DEFINITIONS, type ClassId } from '../src/engine/classes';
import type { SubroutineDefinition } from '../src/engine/subroutine-types';
import { parseSyntheticGatekeepers } from './synthetic-gatekeepers';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const runs = Number(args.runs ?? 20);
const seeds = Number(args.seeds ?? 30);
const classes = args.classes ? (args.classes.split(',') as ClassId[]) : ALL_CLASS_IDS;
const skip = new Set((args.skip ?? '').split(',').filter(Boolean));

const GRID = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 17, 20, 25, 30];
const always = parseSyntheticGatekeepers('1,1,1,1');

/** Kit power (pricing.ts): the Δ where `kit` (with `bridge`) ties Credit Δ. */
function kitPower(kit: SubroutineDefinition[], bridge: ClassId | undefined): number | null {
  return enginePower(kit, { seeds, skill: 0.85, gaugeThreshold: GAUGE_THRESHOLD, winThreshold: BREACH_THRESHOLD, bridge, grid: GRID });
}

const summary = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return `${mean.toFixed(1).padStart(5)}  [${q(0.25).toFixed(1).padStart(4)}, ${q(0.75).toFixed(1).padStart(4)}]  n=${s.length}`;
};

console.log(`\nPLAYER POWER BY LAYER -- kit power (flat Credit/turn it ties), at each layer's gatekeeper; ${runs} runs/class, ${seeds} seeds x 2 seats per price.`);
console.log(`Synergy acquisition, opportunistic traversal, skill 0.85, gatekeepers synthetic (always pass). Bridge included; other Mods not.\n`);
console.log(`${'class'.padEnd(20)} layer   mean  [ p25,  p75]   pieces`);
const byLayer: number[][] = [[], [], [], []];
const start: number[] = [];
for (const classId of classes) {
  const s = kitPower(CLASS_DEFINITIONS[classId].startingLoadout, classId);
  if (s !== null) start.push(s);
  console.log(`${classId.padEnd(20)} start  ${s === null ? '  -- ' : s.toFixed(1).padStart(5)}`);
  const captured: GatekeeperFightContext[] = [];
  for (let seed = 0; seed < runs; seed++) {
    playRun({
      ...SYNERGY_AWARE_PROFILE,
      seed,
      classId,
      traversalStrategy: opportunisticTraversal,
      safehouseStrategy: opportunisticSafehouseStrategy,
      playerSkill: 0.85,
      gatekeeperOverrides: always,
      onBeforeGatekeeperFight: (context) => captured.push(context),
    });
  }
  for (let layer = 1; layer <= 4; layer++) {
    const states = captured.filter((c) => c.layerIndex === layer);
    const powers = states.map((c) => kitPower(c.playerState.installedLoadout, classId)).filter((x): x is number => x !== null);
    byLayer[layer - 1].push(...powers);
    const pieces = states.reduce((n, c) => n + c.playerState.installedLoadout.length, 0) / Math.max(1, states.length);
    console.log(`${classId.padEnd(20)} ${String(layer).padStart(5)}  ${powers.length ? summary(powers) : '  -- '}   ${pieces.toFixed(1)}`);
  }
}
console.log(`\n${'ALL CLASSES'.padEnd(20)} start  ${summary(start)}`);
byLayer.forEach((xs, i) => console.log(`${'ALL CLASSES'.padEnd(20)} ${String(i + 1).padStart(5)}  ${summary(xs)}`));

if (!skip.has('enemies')) {
  console.log(`\nSKELETON ENEMIES (reference) -- kit power at each eligible layer, with that layer's magnitude scaler; no Mods.`);
  for (const enemy of ENEMY_ROSTER) {
    const layers = enemy.tier === 'gatekeeper' ? [enemy.minLayer] : [1, 2, 3, 4].filter((l) => l >= enemy.minLayer);
    const cells = layers.map((layer) => {
      const loadout = scaledEnemyLoadout(enemy.loadout, magnitudeScalerFor(enemy, layer, 99));
      const power = kitPower(loadout, undefined);
      return `L${layer} ${power === null ? '--' : power.toFixed(1)}`;
    });
    console.log(`${enemy.id.padEnd(20)} ${enemy.tier.padEnd(10)} ${cells.join('  ')}`);
  }
}
