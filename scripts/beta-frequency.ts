/**
 * Beta frequency table (step 2, checkpoint 4; `docs/archive/recalibration-design.md`
 * R3, part 1).
 *
 * How often each beta SOURCE charges or holds, per turn of its owner --
 * the input R3's pricing formula multiplies by an effect's price. A graded
 * beta is worth E[min(charges, cap)] per turn, which needs the whole
 * per-turn distribution, P(charges >= k), not just the mean; a whileTrue
 * state beta needs the fraction of turns its condition holds.
 *
 * Measured with PROBES: pieces whose alpha is Credit 0 (no effect) and
 * whose beta has an inert effect (enhance 0) and an unreachable cap, so
 * each reports its raw charge count on every turn (FireEvent.charges) and
 * changes nothing about the fight. Every probe rides on one side of a
 * Credit-B mirror; each seed is played with the probes in both seats, so
 * the dealer/defender biases average out (`src/engine/pricing.ts`).
 *
 * Graded probes spend their charges on every turn they hold any, so a
 * probe's charges on a turn are exactly what banked since that side's
 * previous turn -- the interval a graded beta sees.
 *
 * PROVENANCE: isolated piece-vs-piece fights, equal skill. Not a full-run
 * metric.
 *
 * Usage:
 *   npx tsx scripts/beta-frequency.ts [--seeds=200] [--skill=0.85] [--host=2] [--ward=2] [--out=f.jsonl]
 *
 * `--ward=W` gives the probe side a Ward-W piece too, which the
 * `absorbed` and `wardAbove` probes need to read anything (default 2; 0
 * disables it).
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { playCombat } from '../src/engine/combat';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import { creditPiece } from '../src/engine/pricing';
import type { PlayerIndex } from '../src/engine/pegging';
import type { Beta, BetaSource, OccurrenceCategory, SubroutineDefinition } from '../src/engine/subroutine-types';

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
const skill = Number(args.skill ?? 0.85);
const hostAmount = Number(args.host ?? 2);
const wardAmount = Number(args.ward ?? 2);
const outFile = args.out;
if (outFile) writeFileSync(outFile, '');

const INERT = { verb: 'enhance', amount: 0 } as const;
const UNCAPPED = { shape: 'graded', cap: 1_000_000 } as const;

function probe(label: string, source: BetaSource): SubroutineDefinition {
  const shape = source.source === 'state' ? ({ shape: 'whileTrue' } as const) : UNCAPPED;
  const beta = { ...source, ...shape, effect: INERT } as Beta;
  return { id: `probe:${label}`, name: label, archetype: 'exploit', alpha: { verb: 'credit', amount: 0 }, beta };
}

const CATEGORIES: OccurrenceCategory[] = ['fifteen', 'pair', 'run', 'flush', 'hisNobs', 'thirtyOne', 'go'];

const probes: SubroutineDefinition[] = [
  ...CATEGORIES.map((category) => probe(`cards:${category}`, { source: 'cards', category })),
  probe('cards:pair>=6 (royal)', { source: 'cards', category: 'pair', minMagnitude: 6 }),
  probe('cards:run>=4', { source: 'cards', category: 'run', minMagnitude: 4 }),
  probe('cards:suit (own)', { source: 'cards', category: 'suit' }),
  ...CATEGORIES.map((category) => probe(`cards:${category} (opponent)`, { source: 'cards', category, watch: 'opponent' })),
  probe('progress:points', { source: 'progress', metric: 'points', per: 1 }),
  probe('progress:fires', { source: 'progress', metric: 'fires', per: 1 }),
  probe('progress:absorbed', { source: 'progress', metric: 'absorbed', per: 1 }),
  probe('state:dealer', { source: 'state', condition: { kind: 'dealer' } }),
  probe('state:nonDealer', { source: 'state', condition: { kind: 'nonDealer' } }),
  ...[2, 4, 8].map((amount) => probe(`state:wardAbove ${amount}`, { source: 'state', condition: { kind: 'wardAbove', amount } })),
  probe('state:ownGauge>0.5', { source: 'state', condition: { kind: 'ownGaugeAbove', fraction: 0.5 } }),
  probe('state:ownGauge<0.25', { source: 'state', condition: { kind: 'ownGaugeBelow', fraction: 0.25 } }),
  probe('state:oppGauge>0.5', { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 } }),
  probe('state:oppGauge<0.25', { source: 'state', condition: { kind: 'opponentGaugeBelow', fraction: 0.25 } }),
  ...[8, 12, 16].map((amount) => probe(`state:handPoints>=${amount}`, { source: 'state', condition: { kind: 'handPointsAtLeast', amount } })),
];

const host = creditPiece(hostAmount, 'host');
const ward: SubroutineDefinition[] = wardAmount > 0 ? [{ id: 'ward', name: 'ward', archetype: 'honeypot', alpha: { verb: 'ward', amount: wardAmount } }] : [];
const probeSide = [host, ...ward, ...probes];
const plainSide = [host];

const perProbe = new Map<string, number[]>(probes.map((p) => [p.id, []]));
let hands = 0;
let probeTurns = 0;

for (let seed = 0; seed < seeds; seed++) {
  for (const probeSeat of [0, 1] as PlayerIndex[]) {
    const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = probeSeat === 0 ? [probeSide, plainSide] : [plainSide, probeSide];
    const result = playCombat(loadouts, {
      seed,
      gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
      winThreshold: [BREACH_THRESHOLD, BREACH_THRESHOLD],
      discardStrategies: [discardSkillStrategy(skill), discardSkillStrategy(skill)],
      playStrategies: [pegSkillStrategy(skill), pegSkillStrategy(skill)],
    });
    hands += result.hands.length;
    for (const event of result.log) {
      if (event.side !== probeSeat || event.immediate) continue;
      if (event.subroutineId === 'host') probeTurns++;
      perProbe.get(event.subroutineId)?.push(event.charges);
    }
  }
}

const fmt = (x: number, w = 7, d = 3) => x.toFixed(d).padStart(w);
const at = (xs: number[], k: number) => xs.filter((x) => x >= k).length / xs.length;

console.log(`\nBETA FREQUENCY -- charges per turn of the owner. Isolated duels, equal skill; NOT a full-run metric.`);
console.log(`${seeds} seeds x 2 seats; skill ${skill}; host Credit ${hostAmount}${wardAmount ? `; probe side carries Ward ${wardAmount}` : ''}; initiative ${GAUGE_THRESHOLD}, win ${BREACH_THRESHOLD}`);
console.log(`${probeTurns} probe-side turns over ${hands} hands (${(probeTurns / (hands / 1)).toFixed(2)} probe turns per hand)\n`);
console.log(`${'source'.padEnd(28)}   mean/turn   P>=1    P>=2    P>=3    P>=4    max   per hand`);
for (const p of probes) {
  const xs = perProbe.get(p.id)!;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const perHand = (mean * probeTurns) / hands;
  console.log(
    `${p.name.padEnd(28)} ${fmt(mean, 10)} ${fmt(at(xs, 1))} ${fmt(at(xs, 2))} ${fmt(at(xs, 3))} ${fmt(at(xs, 4))} ${String(Math.max(...xs)).padStart(6)} ${fmt(perHand, 9)}`,
  );
  if (outFile) {
    const dist: Record<number, number> = {};
    for (const x of xs) dist[x] = (dist[x] ?? 0) + 1;
    appendFileSync(outFile, JSON.stringify({ source: p.name, turns: xs.length, mean, perHand, distribution: dist, skill, host: hostAmount, ward: wardAmount }) + '\n');
  }
}
