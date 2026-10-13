/**
 * Beta-pricing validation (step 2, checkpoint 5; `docs/recalibration-design.md`
 * R3, parts 2-4).
 *
 * For a sample of real beta configurations -- every shape, common and rare
 * sources, own and opponent watching, enhance and different-effect, the
 * Ward-context sources -- compares R3's FORMULA price
 * (`src/engine/beta-pricing.ts`) with a DIRECT mirror-duel price
 * (`src/engine/pricing.ts`, R2's method against a Credit-2 host). Where
 * they agree the formula is the authoring rule; where they don't, that
 * shape earns a measured correction.
 *
 * Also prices CHARGE (R3 part 4): a charger feeding the next piece is
 * worth the receiver's price with the charger minus without it.
 *
 * PROVENANCE: isolated piece-vs-piece duels at equal skill (0.85). Not a
 * full-run metric.
 *
 * Usage:
 *   npx tsx scripts/beta-validate.ts [--seeds=200] [--part=1/3] [--out=f.jsonl]
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { creditPiece, refinedPrice, type MirrorOptions } from '../src/engine/pricing';
import { piecePrice } from '../src/engine/beta-pricing';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import type { Alpha, Beta, SubroutineDefinition } from '../src/engine/subroutine-types';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const options: MirrorOptions = { seeds: Number(args.seeds ?? 200), skill: 0.85, gaugeThreshold: GAUGE_THRESHOLD, winThreshold: BREACH_THRESHOLD };
const [partIndex, partCount] = (args.part ?? '1/1').split('/').map(Number);
const outFile = args.out;
if (outFile) writeFileSync(outFile, '');

const CREDIT_1: Alpha = { verb: 'credit', amount: 1 };
const enhance = (amount: number) => ({ verb: 'enhance', amount }) as const;
const piece = (id: string, alpha: Alpha, beta: Beta): SubroutineDefinition => ({ id, name: id, archetype: 'exploit', alpha, beta });

interface Sample {
  label: string;
  pieces: SubroutineDefinition[];
  /** The formula's prediction; computed from piecePrice unless given. */
  predicted?: number | null;
}

const RECEIVER = piece('receiver', CREDIT_1, { source: 'cards', category: 'flush', shape: 'graded', cap: 3, effect: enhance(1) });
const CHARGER: SubroutineDefinition = { id: 'charger', name: 'charger', archetype: 'overclock', alpha: { verb: 'charge', amount: 1, target: 'next' } };

const SAMPLES: Sample[] = [
  { label: 'graded fifteen cap 3, +1', pieces: [piece('a', CREDIT_1, { source: 'cards', category: 'fifteen', shape: 'graded', cap: 3, effect: enhance(1) })] },
  { label: 'graded flush cap 1, +3 (rare)', pieces: [piece('a', CREDIT_1, { source: 'cards', category: 'flush', shape: 'graded', cap: 1, effect: enhance(3) })] },
  { label: 'graded suit cap 3, +1', pieces: [piece('a', CREDIT_1, { source: 'cards', category: 'suit', shape: 'graded', cap: 3, effect: enhance(1) })] },
  { label: 'graded OPP fifteen cap 3, +1', pieces: [piece('a', CREDIT_1, { source: 'cards', category: 'fifteen', watch: 'opponent', shape: 'graded', cap: 3, effect: enhance(1) })] },
  { label: 'graded pair royal cap 1, +3 (rare)', pieces: [piece('a', CREDIT_1, { source: 'cards', category: 'pair', minMagnitude: 6, shape: 'graded', cap: 1, effect: enhance(3) })] },
  { label: 'stepped pair at 2, +2', pieces: [piece('a', CREDIT_1, { source: 'cards', category: 'pair', shape: 'stepped', at: 2, effect: enhance(2) })] },
  { label: 'stepped run at 1, suppress 2', pieces: [piece('a', CREDIT_1, { source: 'cards', category: 'run', shape: 'stepped', at: 1, effect: { verb: 'suppress', amount: 2 } })] },
  { label: 'stepped points/10 at 3, suppress 2', pieces: [piece('a', CREDIT_1, { source: 'progress', metric: 'points', per: 10, shape: 'stepped', at: 3, effect: { verb: 'suppress', amount: 2 } })] },
  { label: 'whileTrue dealer, +2', pieces: [piece('a', CREDIT_1, { source: 'state', condition: { kind: 'dealer' }, shape: 'whileTrue', effect: enhance(2) })] },
  { label: 'whileTrue non-dealer, +2', pieces: [piece('a', CREDIT_1, { source: 'state', condition: { kind: 'nonDealer' }, shape: 'whileTrue', effect: enhance(2) })] },
  { label: 'whileTrue opp gauge > 1/2, suppress 2', pieces: [piece('a', CREDIT_1, { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'whileTrue', effect: { verb: 'suppress', amount: 2 } })] },
  { label: 'immediate pair at 2, credit 3', pieces: [piece('a', CREDIT_1, { source: 'cards', category: 'pair', shape: 'immediate', at: 2, effect: { verb: 'credit', amount: 3 } })] },
  { label: 'immediate run at 1, +1 (extra fire)', pieces: [piece('a', CREDIT_1, { source: 'cards', category: 'run', shape: 'immediate', at: 1, effect: enhance(1) })] },
  { label: 'graded go cap 2, steal 1', pieces: [piece('a', CREDIT_1, { source: 'cards', category: 'go', shape: 'graded', cap: 2, effect: { verb: 'credit', amount: 1, from: 'opponent' } })] },
  { label: 'ward 2 + wardAbove 4, +2 (ward ctx)', pieces: [piece('a', { verb: 'ward', amount: 2 }, { source: 'state', condition: { kind: 'wardAbove', amount: 4 }, shape: 'whileTrue', effect: enhance(2) })] },
  { label: 'ward 2 + absorbed/2 cap 3, credit 1', pieces: [piece('a', { verb: 'ward', amount: 2 }, { source: 'progress', metric: 'absorbed', per: 2, shape: 'graded', cap: 3, effect: { verb: 'credit', amount: 1 } })] },
  { label: 'receiver: flush cap 3, +1', pieces: [RECEIVER] },
  // Charge: the receiver gets +1 charge every turn, so its beta applies at
  // least once a turn; predicted from the receiver's own table below.
  { label: 'charger -> receiver', pieces: [CHARGER, RECEIVER], predicted: null },
];

const mine = SAMPLES.filter((_, i) => i % partCount === partIndex - 1);
const GRID = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6];
const fmt = (x: number | null | undefined) => (x === null || x === undefined ? '  --  ' : x.toFixed(2).padStart(6));

console.log(`\nBETA VALIDATION -- formula vs direct mirror-duel price, host Credit 2, skill 0.85. NOT a full-run metric.`);
console.log(`${options.seeds} seeds x 2 seats per point; part ${partIndex}/${partCount}\n`);
console.log(`${'sample'.padEnd(40)} formula  measured  [  low,   high]   verdict`);
for (const sample of mine) {
  const predicted = sample.predicted === undefined ? piecePrice(sample.pieces[0]).total : sample.predicted;
  const { coarse, fine } = refinedPrice([creditPiece(2, 'host')], sample.pieces.length === 1 ? sample.pieces[0] : sample.pieces, GRID, options);
  const r = fine ?? coarse;
  const inside = predicted !== null && r.low !== null && r.high !== null && r.low <= predicted && predicted <= r.high;
  const verdict = predicted === null ? 'n/a' : inside ? 'HOLDS' : `MISS (${(r.price ?? NaN) - predicted >= 0 ? '+' : ''}${((r.price ?? NaN) - predicted).toFixed(2)})`;
  console.log(`${sample.label.padEnd(40)} ${fmt(predicted)}   ${fmt(r.price)}  [${fmt(r.low)}, ${fmt(r.high)}]   ${verdict}`);
  if (outFile) appendFileSync(outFile, JSON.stringify({ label: sample.label, predicted, measured: r.price, low: r.low, high: r.high, curve: r.curve }) + '\n');
}
