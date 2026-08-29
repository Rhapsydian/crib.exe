/**
 * Pure-cribbage skill-vs-skill distribution (session 39).
 *
 * Thin driver over basic-cribbage.ts's playBasicCribbageGame -- the real,
 * permanent Basic Cribbage mode engine (game.ts's playOneHand underneath),
 * not a bespoke loop reimplemented here. Deliberately NOT playCombat:
 * combat.ts's "win" condition (winThreshold) is not raw cribbage score at
 * all, it's a separate winGauge fed exclusively through creditWinGauge,
 * and every single call site for that is a subroutine payload/Mod/passive
 * effect (resolve.ts). With no loadout installed there's nothing to ever
 * credit it, so an empty-loadout playCombat match never resolves by score
 * and falls straight to the hard-resolution-deadline tiebreak regardless
 * of either side's actual cribbage skill -- confirmed the hard way (every
 * cell of a first attempt at this via playCombat came back 0% for side A).
 * Real cribbage skill has no route into playCombat's win condition except
 * by way of the roguelite subroutine layer, so isolating the skill dial
 * itself requires going around that layer entirely.
 *
 * Exists to let a skill *level* be calibrated against what it actually
 * means in cribbage terms (win rate vs a fixed opponent skill) before it
 * gets adopted as "the player" default anywhere in the engine (run.ts's
 * playerSkill option, gatekeeper-check.ts's --playerSkills, etc).
 *
 * Usage:
 *   npx tsx scripts/cribbage-skill-matrix.ts [--levels=0,0.25,0.5,0.75,1] [--games=500] [--out=file.jsonl]
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { playBasicCribbageGame } from '../src/engine/basic-cribbage';
import type { PlayerIndex } from '../src/engine/game';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const levels = (args.levels ?? '0,0.25,0.5,0.75,1').split(',').map(Number);
const rowLevels = args.rows ? args.rows.split(',').map(Number) : levels; // optional row-only override, e.g. to fill in a subset of a larger grid across separate runs
const games = Number(args.games ?? 500);
const outFile = args.out;
if (outFile) writeFileSync(outFile, '');

console.log(`\nWin rate for side A (row) vs side B (column), ${games} games/pairing, real race to 121:\n`);
const header = ['A\\B', ...levels.map((l) => l.toFixed(2).padStart(7))].join('  ');
console.log(header);

for (const skillA of rowLevels) {
  const row: string[] = [skillA.toFixed(2).padEnd(4)];
  for (const skillB of levels) {
    let winsA = 0;
    for (let seed = 0; seed < games; seed++) {
      // Dealer alternates by seed parity so first-move/crib advantage
      // cancels out across the sample rather than biasing whichever
      // skill sits at side A.
      const result = playBasicCribbageGame({ seed, playerSkill: skillA, enemySkill: skillB, startingDealer: (seed % 2) as PlayerIndex });
      if (result.winner === 0) winsA++;
      if (outFile) appendFileSync(outFile, JSON.stringify({ skillA, skillB, seed, winner: result.winner, finalScores: result.finalScores, handCount: result.hands.length }) + '\n');
    }
    row.push(`${((winsA / games) * 100).toFixed(1)}%`.padStart(7));
  }
  console.log(row.join('  '));
}
