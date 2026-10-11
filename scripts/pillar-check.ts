/**
 * Pillar calibration sweep (session 50, checkpoint 2).
 *
 * Answers "what is a given enemy win condition worth" by sweeping each
 * diagnostic pillar (`src/engine/diagnostic-enemies.ts`) across two axes
 * — payload **magnitude** and trigger **frequency** (as `pointsCooldown`)
 * — against real accumulated player state, per layer.
 *
 * ## Three things this deliberately does
 *
 * **Player state is captured from real runs, not constructed.** A bare
 * starting kit understates difficulty badly at layers 3-4; that is the
 * lesson `gatekeeper-check.ts` learned in session 39 and this harness
 * inherits it.
 *
 * **Captures are taken with the gatekeepers synthesised at passRate 1**
 * (`RunOptions.gatekeeperOverrides`, session 49). Without that, layer
 * N+1's cohort contains only runs that beat layer N — pre-selected by
 * the very trait a difficulty sweep measures. Session 49 measured that
 * bias at up to 11.9pp. Setting every gatekeeper to a free pass gives an
 * unfiltered cohort at all four layers.
 *
 * **Two success metrics, because the pillars are two families.** Burst /
 * DoT-turn / DoT-points CREDIT the enemy's Containment gauge. Suppress /
 * Stall / Tempo / Throttle never touch it — they deny the player and win
 * at `HARD_RESOLUTION_HAND` by attrition, so their enemy peak fill is 0
 * at every scalar. Reporting one metric would print a table of zeros for
 * four of seven pillars and it would look like data. Player win rate is
 * the shared headline; the supporting column differs by family.
 *
 * PROVENANCE: every number here is an isolated re-fight against a
 * diagnostic fixture. It is NOT a full-run metric and must say so when
 * quoted, per README's conventions.
 *
 * Usage:
 *   npx tsx scripts/pillar-check.ts [--seeds=25] [--pillars=pillar-credit,...]
 *                                   [--scalars=2,4,6,9,13,18] [--cooldowns=8,20,50,120,320]
 *                                   [--layers=1,2,3,4] [--playerSkill=0.85] [--out=f.jsonl]
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { playRun, opportunisticTraversal, type GatekeeperFightContext, type GatekeeperOverride } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { playCombat } from '../src/engine/combat';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD, CONTAINMENT_THRESHOLD } from '../src/engine/encounters';
import { enemySkill } from '../src/engine/enemies';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { CREDIT_PILLAR_IDS, PILLAR_IDS, pillarEnemy, type DiagnosticEnemyId } from '../src/engine/diagnostic-enemies';
import { BURNER_DEFINITIONS } from '../src/engine/burners';
import { ALL_CLASS_IDS, type ClassId } from '../src/engine/classes';

const ALL_CLASSES: ClassId[] = ALL_CLASS_IDS;
const DEFAULT_PLAYER_SKILL = 0.85;

/** Pillars whose win condition is filling their OWN Containment gauge.
 * The rest deny the player and win by attrition instead. */
const CREDIT_PILLARS = new Set<DiagnosticEnemyId>(CREDIT_PILLAR_IDS);

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const nums = (k: string, d: number[]): number[] => (args[k] ? args[k].split(',').map(Number) : d);

const seeds = Number(args.seeds ?? 25);
const pillars = (args.pillars ? args.pillars.split(',') : [...PILLAR_IDS]) as DiagnosticEnemyId[];
const scalars = nums('scalars', [5, 10, 20, 35, 50, 70]);
const cooldowns = nums('cooldowns', [8, 20, 50, 120, 320]);
const layers = nums('layers', [1, 2, 3, 4]);
const playerSkill = Number(args.playerSkill ?? DEFAULT_PLAYER_SKILL);
const outFile = args.out;
if (outFile) writeFileSync(outFile, '');

// --- capture real accumulated player state, per layer, unfiltered ---
const FREE_PASS: GatekeeperOverride = { kind: 'synthetic', passRate: 1, traceGenerated: 2.8 };
const captures: GatekeeperFightContext[] = [];
for (const classId of ALL_CLASSES) {
  for (let seed = 0; seed < seeds; seed++) {
    playRun({
      ...SYNERGY_AWARE_PROFILE,
      seed,
      classId,
      traversalStrategy: opportunisticTraversal,
      safehouseStrategy: opportunisticSafehouseStrategy,
      playerSkill,
      gatekeeperOverrides: [FREE_PASS, FREE_PASS, FREE_PASS, FREE_PASS],
      onBeforeGatekeeperFight: (ctx) => captures.push(ctx),
    });
  }
}

interface Cell {
  wins: number;
  n: number;
  enemyPeak: number;
  playerPeak: number;
  hands: number;
  attrition: number;
  fires: number;
}
const cell = (): Cell => ({ wins: 0, n: 0, enemyPeak: 0, playerPeak: 0, hands: 0, attrition: 0, fires: 0 });
const results = new Map<string, Cell>();
const key = (p: string, layer: number, scalar: number, cooldown: number) => `${p}|${layer}|${scalar}|${cooldown}`;

for (const capture of captures) {
  if (!layers.includes(capture.layerIndex)) continue;
  const combatBurnerIds = capture.playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('combat'));
  for (const id of pillars) {
    for (const scalar of scalars) {
      for (const cooldown of cooldowns) {
        const enemy = pillarEnemy(id, { scalar, pointsCooldown: cooldown });
        const skill = enemySkill(enemy.tier, capture.layerIndex, capture.fightsResolved);
        const result = playCombat([capture.playerState.installedLoadout, enemy.loadout], {
          // Deterministic per (capture, pillar, sweep point) so a re-run
          // reproduces exactly; the pillar/scalar/cooldown are folded in
          // so neighbouring sweep points do not share a deck.
          seed: (capture.layerIndex * 7919 + scalar * 104729 + cooldown * 1299709 + id.length * 31) >>> 0,
          gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
          winThreshold: [BREACH_THRESHOLD, CONTAINMENT_THRESHOLD],
          classId: capture.playerState.classId,
          enemyPassiveIds: [],
          ownedModIds: capture.playerState.ownedModIds,
          carriedBurnerIds: combatBurnerIds,
          discardStrategies: [discardSkillStrategy(playerSkill), discardSkillStrategy(skill)],
          playStrategies: [pegSkillStrategy(playerSkill), pegSkillStrategy(skill)],
        });
        const k = key(id, capture.layerIndex, scalar, cooldown);
        const c = results.get(k) ?? cell();
        c.n++;
        if (result.winner === 0) c.wins++;
        else if (result.resolvedBy === 'attrition') c.attrition++;
        c.enemyPeak += result.peakFillFraction[1];
        c.playerPeak += result.peakFillFraction[0];
        c.hands += result.hands.length;
        c.fires += result.log.filter((e) => e.side === 1).length;
        results.set(k, c);
        if (outFile) {
          appendFileSync(
            outFile,
            JSON.stringify({ pillar: id, layer: capture.layerIndex, scalar, cooldown, classId: capture.playerState.classId, won: result.winner === 0, resolvedBy: result.resolvedBy, enemyPeak: result.peakFillFraction[1], playerPeak: result.peakFillFraction[0], hands: result.hands.length }) + '\n',
          );
        }
      }
    }
  }
}

const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(1)}%`.padStart(6);

console.log(`\nPILLAR CALIBRATION -- isolated re-fights against diagnostic fixtures.`);
console.log(`NOT a full-run metric (README conventions). Captures taken with gatekeepers synthesised at passRate 1, so cohorts are unfiltered.`);
console.log(`${captures.length} captures from ${seeds} seeds x ${ALL_CLASSES.length} classes; playerSkill ${playerSkill}`);
console.log(`sweep: ${pillars.length} pillars x ${scalars.length} scalars x ${cooldowns.length} cooldowns x ${layers.length} layers\n`);

for (const id of pillars) {
  const credit = CREDIT_PILLARS.has(id);
  console.log(`=== ${id} ${credit ? '(CREDIT: fills its own gauge)' : '(DENIAL: wins by attrition, never credits)'} ===`);
  console.log(`  player win rate by scalar (rows) x cooldown (cols), layers ${layers.join('+')}`);
  console.log(`  ${'scalar'.padStart(7)}  ` + cooldowns.map((c) => `cd=${c}`.padStart(8)).join('  '));
  for (const scalar of scalars) {
    const cells = cooldowns.map((cd) => {
      let w = 0;
      let n = 0;
      for (const layer of layers) {
        const c = results.get(key(id, layer, scalar, cd));
        if (!c) continue;
        w += c.wins;
        n += c.n;
      }
      return n === 0 ? '   n/a' : pct(w, n);
    });
    console.log(`  ${String(scalar).padStart(7)}  ` + cells.map((x) => x.padStart(8)).join('  '));
  }
  // The family-specific supporting column, at the tightest cooldown.
  const cd = cooldowns[0];
  // NOT player peak fill for denial: peak is a high-water mark, so a
  // gauge pushed back after peaking still reads high, and the player wins
  // nearly always -- it is pinned above 1.0 regardless of the knob. Fight
  // LENGTH and attrition share are what respond.
  const label = credit ? 'enemy peak fill' : 'player peak fill (INERT -- see hands/attrition)';
  console.log(`\n  ${label}, cd=${cd}:`);
  console.log(`  ${'scalar'.padStart(7)}  ${'value'.padStart(8)}  ${'fires'.padStart(6)}  ${'hands'.padStart(6)}  ${credit ? '' : 'attrition losses'}`);
  for (const scalar of scalars) {
    let v = 0;
    let hands = 0;
    let attr = 0;
    let fires = 0;
    let n = 0;
    for (const layer of layers) {
      const c = results.get(key(id, layer, scalar, cd));
      if (!c) continue;
      v += credit ? c.enemyPeak : c.playerPeak;
      hands += c.hands;
      attr += c.attrition;
      fires += c.fires;
      n += c.n;
    }
    if (n === 0) continue;
    // SATURATION: once one fire alone carries the gauge over its
    // threshold, magnitude stops mattering and the fight is decided by
    // who gets the first turn -- the win rate flattens near 50% and
    // wobbles with noise. Flagged so a sweep cannot read that plateau as
    // a real response.
    const saturated = credit && v / n >= 1;
    console.log(
      `  ${String(scalar).padStart(7)}  ${(v / n).toFixed(3).padStart(8)}  ${(fires / n).toFixed(1).padStart(6)}  ${(hands / n).toFixed(1).padStart(6)}  ` +
        `${credit ? (saturated ? '  SATURATED -- one fire wins; magnitude inert above here' : '') : pct(attr, n)}`,
    );
  }
  console.log('');
}
