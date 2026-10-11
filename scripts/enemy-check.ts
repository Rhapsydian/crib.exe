/**
 * How hard regular and elite enemies actually are, against real
 * accumulated player state (session 50).
 *
 * `gatekeeper-check.ts` answers this for gatekeepers by capturing state
 * and re-fighting in isolation. This script deliberately does NOT do
 * that: every fight it reports is a real in-run fight, read off the run
 * log, which is the project's standing default (full-run-derived unless
 * stated otherwise) and needs no re-fight to be faithful. The reason
 * gatekeeper-check re-fights -- decoupling a layer's difficulty from the
 * survivorship of reaching it -- does not apply here, because regular
 * and elite fights happen continuously throughout a run rather than
 * gating it.
 *
 * Win rate alone is the wrong instrument for this question. A 99% win
 * rate where the enemy's Containment gauge never clears 10% is not a
 * hard fight scored generously; it is not a fight. So every table below
 * carries **enemy peak fill** (how close the enemy came to winning) and
 * **hands** (how long it took) alongside the win rate.
 *
 * Usage:
 *   npx tsx scripts/enemy-check.ts [--seeds=200] [--classes=daemon-honeypot,overclock-honeypot]
 *                                  [--acquisition=floor|synergy] [--out=f.jsonl]
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { ENEMY_ROSTER, OPENER_FIGHT_WINDOW } from '../src/engine/enemies';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { ALL_CLASS_IDS, type ClassId } from '../src/engine/classes';

const ALL_CLASSES: ClassId[] = ALL_CLASS_IDS;
const PLAYER_SKILL = 0.85;

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const seeds = Number(args.seeds ?? 200);
const classes = args.classes ? (args.classes.split(',') as ClassId[]) : ALL_CLASSES;
const acquisition = args.acquisition ?? 'synergy';
const outFile = args.out;
if (outFile) writeFileSync(outFile, '');

interface Cell {
  wins: number;
  losses: number;
  enemyPeak: number[];
  playerPeak: number[];
  hands: number[];
}
const cell = (): Cell => ({ wins: 0, losses: 0, enemyPeak: [], playerPeak: [], hands: [] });
const bump = (m: Record<string, Cell>, k: string): Cell => (m[k] ??= cell());

const byTier: Record<string, Cell> = {};
const byTierLayer: Record<string, Cell> = {};
const byEnemy: Record<string, Cell> = {};
/** Keyed by how many fights the run had already resolved -- the closest
 * available proxy for "how much power has the player accumulated". */
const byProgress: Record<string, Cell> = {};
let openerFights = 0;
let mismatched = 0;

for (const classId of classes) {
  for (let seed = 0; seed < seeds; seed++) {
    const result = playRun({
      ...(acquisition === 'synergy' ? SYNERGY_AWARE_PROFILE : {}),
      seed,
      classId,
      traversalStrategy: opportunisticTraversal,
      safehouseStrategy: opportunisticSafehouseStrategy,
      playerSkill: PLAYER_SKILL,
    });

    let fightsSoFar = 0;
    for (const entry of result.log) {
      if (entry.type !== 'encounter' || !entry.outcome.fight) continue;
      const f = entry.outcome.fight;
      const won = entry.outcome.newState === 'inert';
      const idx = fightsSoFar++;
      if (f.tier === 'gatekeeper') continue; // gatekeeper-check.ts owns that tier
      // f.tier is the NODE's tier. During the opener window
      // pickRegularOrEliteEnemy returns a regular enemy whatever the node
      // is, so keying on node tier counts easy regulars as elites -- 23%
      // of them. Bucket by the enemy's OWN tier, and segregate openers.
      const enemyTier = ENEMY_ROSTER.find((e) => e.id === f.enemyId)?.tier ?? f.tier;
      if (idx < OPENER_FIGHT_WINDOW) { openerFights++; continue; }
      if (enemyTier !== f.tier) mismatched++;

      const bucket = idx < 5 ? '00-04' : idx < 10 ? '05-09' : idx < 15 ? '10-14' : idx < 20 ? '15-19' : '20+';
      for (const c of [bump(byTier, enemyTier), bump(byTierLayer, `${enemyTier}|L${entry.layerIndex + 1}`), bump(byEnemy, `${enemyTier}|${f.enemyId}`), bump(byProgress, `${enemyTier}|${bucket}`)]) {
        if (won) c.wins++;
        else c.losses++;
        c.enemyPeak.push(f.peakFillFraction[1]);
        c.playerPeak.push(f.peakFillFraction[0]);
        c.hands.push(f.hands);
      }

      if (outFile) {
        appendFileSync(outFile, JSON.stringify({ classId, seed, layer: entry.layerIndex + 1, fightIndex: idx, ...f, won }) + '\n');
      }
    }
  }
}

const mean = (xs: number[]) => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);
const p90 = (xs: number[]) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))];
};
const row = (label: string, c: Cell) => {
  const n = c.wins + c.losses;
  console.log(
    `${label.padEnd(30)} ${String(n).padStart(6)}  ${((c.wins / n) * 100).toFixed(1).padStart(6)}%   ` +
      `${mean(c.enemyPeak).toFixed(3).padStart(6)}   ${p90(c.enemyPeak).toFixed(3).padStart(6)}   ` +
      `${mean(c.playerPeak).toFixed(3).padStart(6)}   ${mean(c.hands).toFixed(1).padStart(5)}`,
  );
};
const header = (title: string) => {
  console.log(`\n=== ${title} ===`);
  console.log(`${''.padEnd(30)} ${'n'.padStart(6)}  ${'win%'.padStart(7)}   ${'enemyPk'.padStart(6)}   ${'pk p90'.padStart(6)}   ${'plyrPk'.padStart(6)}   ${'hands'.padStart(5)}`);
};

console.log(`\n${seeds} seeds/class x ${classes.length} classes, ${acquisition}/opportunistic, skill ${PLAYER_SKILL}`);
console.log(`excluded ${openerFights} opener-window fights (deliberately easy regulars, any node tier); ${mismatched} remaining node/enemy tier mismatches`);
console.log('enemyPk = how full the ENEMY got its Containment gauge (0-1). This is how close the fight was.');

header('by tier');
for (const k of Object.keys(byTier).sort()) row(k, byTier[k]);

header('by tier and layer (does difficulty ramp with depth?)');
for (const k of Object.keys(byTierLayer).sort()) row(k, byTierLayer[k]);

header('by run progress, in fights resolved (does accumulated power outrun the ramp?)');
for (const k of Object.keys(byProgress).sort()) row(k, byProgress[k]);

header('by enemy identity');
for (const k of Object.keys(byEnemy).sort((a, b) => {
  const wr = (x: string) => byEnemy[x].wins / (byEnemy[x].wins + byEnemy[x].losses);
  return wr(a) - wr(b);
})) {
  row(k, byEnemy[k]);
}
