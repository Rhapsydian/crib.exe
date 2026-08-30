/**
 * Real occurrence-frequency and hand/crib/pegging-score distribution
 * analysis (session 40 continued) -- calibration data for the new
 * Root-native trigger families (rareOccurrence's minMagnitude,
 * handOutcome's value thresholds) and, more broadly, for any future
 * Occurrence-trigger tuning (bankTarget/cap values): rarer real event ->
 * higher magnitude/reward, set from actual play rather than guessed.
 *
 * Thin driver over basic-cribbage.ts's playBasicCribbageGame -- real,
 * permanent Basic Cribbage mode, same reasoning cribbage-skill-matrix.ts
 * already gives for going around playCombat's own subroutine-gated win
 * condition entirely: this is about raw Cribbage occurrence frequency,
 * nothing to do with the roguelite layer at all. Reuses triggers.ts's
 * own occurrence-extraction functions (occurrencesFromPeggingEvent/
 * occurrencesFromHandEvents/occurrenceFromHisHeels) -- the exact
 * conversion combat.ts's own (private) occurrencesForHand does -- so
 * "how often does X occur" here is measured the identical way the real
 * engine would see it, not a reimplementation.
 *
 * Usage:
 *   npx tsx scripts/occurrence-frequency.ts [--games=300] [--skill=0.85] [--out=file.jsonl]
 */
import { writeFileSync, appendFileSync } from 'node:fs';
import { playBasicCribbageGame } from '../src/engine/basic-cribbage';
import { occurrencesFromPeggingEvent, occurrencesFromHandEvents, occurrenceFromHisHeels, type ScoringOccurrence } from '../src/engine/triggers';
import type { HandResult } from '../src/engine/game';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function occurrencesForHand(hand: HandResult): ScoringOccurrence[] {
  const nonDealer = (1 - hand.dealer) as 0 | 1;
  const heels = occurrenceFromHisHeels(hand.hisHeelsPoints, hand.dealer);
  return [
    ...(heels ? [heels] : []),
    ...hand.peggingEvents.flatMap(occurrencesFromPeggingEvent),
    ...occurrencesFromHandEvents(hand.nonDealerHandEvents, nonDealer),
    ...occurrencesFromHandEvents(hand.dealerHandEvents, hand.dealer),
    ...occurrencesFromHandEvents(hand.cribEvents, hand.dealer),
  ];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

const args = parseArgs(process.argv.slice(2));
const games = Number(args.games ?? 300);
const skill = Number(args.skill ?? 0.85);
const outFile = args.out;
if (outFile) writeFileSync(outFile, '');

let totalHands = 0;
// key: category -> magnitude -> count
const occurrenceCounts: Record<string, Record<number, number>> = {};
const cribScores: number[] = [];
const dealerHandScores: number[] = [];
const nonDealerHandScores: number[] = [];
const peggingScoresPerSide: number[] = [];

for (let seed = 0; seed < games; seed++) {
  const result = playBasicCribbageGame({ seed, playerSkill: skill, enemySkill: skill });
  for (const hand of result.hands) {
    totalHands++;
    cribScores.push(hand.cribScore);
    dealerHandScores.push(hand.dealerHandScore);
    nonDealerHandScores.push(hand.nonDealerHandScore);
    peggingScoresPerSide.push(hand.peggingScores[0], hand.peggingScores[1]);

    for (const occ of occurrencesForHand(hand)) {
      const byMagnitude = (occurrenceCounts[occ.category] ??= {});
      byMagnitude[occ.magnitude] = (byMagnitude[occ.magnitude] ?? 0) + 1;
    }
  }
}

console.log(`=== ${games} games, skill=${skill}, ${totalHands} total hands ===\n`);

console.log('--- occurrence category x magnitude: count, and per-hand frequency ---');
for (const category of Object.keys(occurrenceCounts).sort()) {
  const byMagnitude = occurrenceCounts[category];
  const magnitudes = Object.keys(byMagnitude)
    .map(Number)
    .sort((a, b) => a - b);
  const totalForCategory = magnitudes.reduce((sum, m) => sum + byMagnitude[m], 0);
  console.log(`  ${category}  (total ${totalForCategory}, ${(totalForCategory / totalHands).toFixed(3)}/hand)`);
  for (const m of magnitudes) {
    const count = byMagnitude[m];
    const line = `    magnitude=${m}  count=${count}  ${(count / totalHands).toFixed(4)}/hand  (${((count / totalForCategory) * 100).toFixed(1)}% of this category)`;
    console.log(line);
    if (outFile) appendFileSync(outFile, JSON.stringify({ category, magnitude: m, count, perHand: count / totalHands }) + '\n');
  }
}

console.log('\n--- phase-total score distributions (for handOutcome value calibration) ---');
for (const [label, values] of [
  ['cribScore', cribScores],
  ['dealerHandScore', dealerHandScores],
  ['nonDealerHandScore', nonDealerHandScores],
  ['peggingScore (per side)', peggingScoresPerSide],
] as const) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  console.log(
    `  ${label.padEnd(24)} mean=${mean.toFixed(2)}  p50=${percentile(sorted, 0.5)}  p75=${percentile(sorted, 0.75)}  p90=${percentile(sorted, 0.9)}  p95=${percentile(sorted, 0.95)}  p99=${percentile(sorted, 0.99)}  max=${sorted[sorted.length - 1]}`,
  );
}
