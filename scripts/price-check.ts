/**
 * Mirror-duel pricing (step 2, `docs/archive/recalibration-design.md` R1/R2).
 *
 * Prices a verb in Credit-equivalents: both sides get a Credit-B host, one
 * adds the verb under test, the other adds Credit Δ, and the price is the
 * Δ where the duel is 50/50. The engine half (seat-swapped duels, the
 * grid solver, the instrument's own tests) is `src/engine/pricing.ts`.
 *
 * PROVENANCE: isolated piece-vs-piece duels at equal Cribbage skill. Not
 * a full-run metric, and not a difficulty measurement -- a relative price.
 *
 * Usage:
 *   npx tsx scripts/price-check.ts --check                 # resolution check: off-grid Credit c must price at ~c
 *   npx tsx scripts/price-check.ts --verbs=suppress,ward,suppress+ward --amount=2
 *        [--hosts=1,2,4] [--hostWard=2] [--seeds=200] [--skill=0.85] [--deltas=0,0.5,1,...] [--out=f.jsonl]
 *
 * Verbs: credit, suppress, ward, empower, tempo-haste, tempo-haste-cd,
 * tempo-slow, disrupt-reveal, disrupt-crib, disrupt-force,
 * credit-piercing, credit-from-ward, credit-from-opponent. `a+b` prices
 * the two together as one addition (the validity check: do prices add?).
 * `--amount` is the verb's own magnitude (ignored by Disrupt; a fraction
 * of a turn for the Tempo verbs). `--hostWard=W` gives BOTH hosts a Ward-W
 * piece too -- needed to price piercing (against a Ward) and credit from
 * Ward (spending your own). Empower is placed ABOVE the host, since it
 * boosts only pieces below it.
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { creditPiece, refinedPrice, type MirrorOptions, type PriceResult } from '../src/engine/pricing';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import type { Alpha, SubroutineDefinition } from '../src/engine/subroutine-types';

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

const options: MirrorOptions = {
  seeds: Number(args.seeds ?? 200),
  skill: Number(args.skill ?? 0.85),
  gaugeThreshold: GAUGE_THRESHOLD,
  winThreshold: BREACH_THRESHOLD,
};
const hosts = nums('hosts', [1, 2, 4]);
const hostWard = args.hostWard ? Number(args.hostWard) : 0;
const outFile = args.out;
if (outFile) writeFileSync(outFile, '');

/** The verb under test, as a one-piece addition. Empower needs the host
 * BELOW it to have anything to boost, so the harness always appends the
 * addition AFTER the host -- see `loadoutFor`. */
function verbAlpha(verb: string, amount: number): Alpha {
  switch (verb) {
    case 'credit': return { verb: 'credit', amount };
    case 'credit-piercing': return { verb: 'credit', amount, piercing: true };
    case 'credit-from-ward': return { verb: 'credit', amount, from: 'ward' };
    case 'credit-from-opponent': return { verb: 'credit', amount, from: 'opponent' };
    case 'suppress': return { verb: 'suppress', amount };
    case 'ward': return { verb: 'ward', amount };
    case 'empower': return { verb: 'empower', amount, scope: 'rest' };
    case 'tempo-haste': return { verb: 'tempo', target: 'own', mode: 'gauge', amount };
    case 'tempo-slow': return { verb: 'tempo', target: 'opponent', mode: 'gauge', amount };
    case 'disrupt-reveal': return { verb: 'disrupt', action: 'revealHand' };
    case 'disrupt-crib': return { verb: 'disrupt', action: 'revealCrib' };
    case 'disrupt-force': return { verb: 'disrupt', action: 'forceDiscard' };
    default: throw new Error(`price-check: unknown verb "${verb}"`);
  }
}

function addition(verb: string, amount: number): SubroutineDefinition {
  // Self-haste priced twice: 'tempo-haste' is the bare verb (safe below a
  // whole turn per fire), 'tempo-haste-cd' carries the 15-point cooldown
  // real content must (session 47) -- the verb as it would actually ship.
  const base = verb === 'tempo-haste-cd' ? 'tempo-haste' : verb;
  const cooldown = verb === 'tempo-haste-cd' ? { pointsCooldown: 15 } : {};
  return { id: `test-${verb}`, name: verb, archetype: 'exploit', alpha: verbAlpha(base, amount), ...cooldown };
}

function hostFor(host: number): SubroutineDefinition[] {
  const credit = creditPiece(host, 'host');
  return hostWard > 0 ? [credit, { id: 'host-ward', name: 'host-ward', archetype: 'honeypot', alpha: { verb: 'ward', amount: hostWard } }] : [credit];
}

/** Default grid relative to the host: prices are expected on the host's
 * scale, and a price outside it is reported as null, not guessed. */
const gridFor = (host: number): number[] => nums('deltas', [0, 0.25, 0.5, 1, 1.5, 2, 3, 4].map((f) => f * host));

const fmt = (x: number | null): string => (x === null ? '  --  ' : x.toFixed(2).padStart(6));

function report(label: string, host: number, result: PriceResult, expected?: number): void {
  const curve = result.curve.map((c) => `${c.delta}:${(c.winRate * 100).toFixed(0)}%`).join(' ');
  const check = expected === undefined ? '' : `   expected ~${expected} ${result.low !== null && result.high !== null && result.low <= expected && expected <= result.high ? 'PASS' : 'FAIL'}`;
  console.log(`${label.padEnd(26)} host ${String(host).padStart(3)}   price ${fmt(result.price)}  [${fmt(result.low)}, ${fmt(result.high)}]${check}`);
  console.log(`${''.padEnd(26)} curve ${curve}`);
  if (outFile) appendFileSync(outFile, JSON.stringify({ label, host, ...result, expected }) + '\n');
}

console.log(`\nMIRROR-DUEL PRICES -- Credit-equivalents, piece vs piece, equal skill. NOT a full-run metric.`);
console.log(`${options.seeds} seeds x 2 seats per point; skill ${options.skill}; initiative ${options.gaugeThreshold}, win ${options.winThreshold}${hostWard ? `; both hosts carry Ward ${hostWard}` : ''}\n`);

if (args.check) {
  // The resolution check. R2 planned "adding Credit c must price at ~c",
  // but with c ON the grid that is a tautology: at Δ = c the two loadouts
  // are identical, so the seat-swapped duel is exactly 0.5 by construction
  // (pricing.test.ts pins that as the wiring check). Credit is linear by
  // construction, so no Credit-only check can test validity. What it CAN
  // test is resolution: c deliberately OFF the grid (0.75x and 1.25x the
  // host) measures interpolation error plus noise, and the interval width
  // is the measurement's real precision at this seed count. Validity --
  // do prices of different verbs add up? -- is checkpoint 3's.
  for (const host of hosts) {
    for (const c of [0.75 * host, 1.25 * host]) {
      const { coarse, fine } = refinedPrice([creditPiece(host)], creditPiece(c), gridFor(host), options);
      report(`check: +credit ${c}`, host, fine ?? coarse, c);
    }
  }
} else {
  const verbs = (args.verbs ?? '').split(',').filter(Boolean);
  if (verbs.length === 0) throw new Error('price-check: pass --check or --verbs=...');
  const amount = Number(args.amount ?? 2);
  for (const spec of verbs) {
    const parts = spec.split('+');
    const pieces = parts.map((verb) => addition(verb, amount));
    const placement = parts.includes('empower') ? 'before' : 'after';
    for (const host of hosts) {
      const { coarse, fine } = refinedPrice(hostFor(host), pieces.length === 1 ? pieces[0] : pieces, gridFor(host), options, placement);
      report(`${spec} ${parts.every((v) => v.startsWith('disrupt')) ? '' : amount}`, host, fine ?? coarse);
    }
  }
}
