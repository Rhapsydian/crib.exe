/**
 * Prices a noisy piece's `feed` (session 58, replacing trace-price.ts).
 *
 * A noisy piece carries a Credit premium (DESIGN Pricing rule 3e) and
 * pays for it with `feed`: progress handed to the opponent's win gauge.
 * Both halves resolve inside the fight, so the ordinary mirror duel
 * prices them together. For each noisy piece this prints:
 *
 *   - its BAND: the piece without premium or feed (alpha Credit one
 *     lower, no feed), priced now on the same instrument -- the price an
 *     ordinary piece of its rarity carries;
 *   - its price at each candidate feed, with the premium in.
 *
 * The feed to pick is the one that brings the noisy piece back to its
 * band: the premium is then exactly paid for.
 *
 * PROVENANCE: isolated piece-vs-piece duels at equal Cribbage skill 0.85
 * on the standard Credit-2 host. A relative price, not a run metric.
 *
 * Usage:
 *   npx tsx scripts/feed-price.ts [--feeds=0,0.5,1,1.5,2] [--seeds=300] [--pieces=fuzzer,jackpot]
 */
import { creditPiece, refinedPrice, type MirrorOptions } from '../src/engine/pricing';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import { ALL_SUBROUTINES } from '../src/engine/subroutines';
import type { BetaEffect, SubroutineDefinition } from '../src/engine/subroutine-types';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const feeds = (args.feeds ?? '0,0.5,1,1.5,2').split(',').map(Number);
const seeds = Number(args.seeds ?? 300);
const ids = (args.pieces ?? 'fuzzer,jackpot').split(',');

const options: MirrorOptions = { seeds, skill: 0.85, gaugeThreshold: GAUGE_THRESHOLD, winThreshold: BREACH_THRESHOLD };
const host = [creditPiece(2, 'host')];
const coarse = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5];

/** The piece with its beta's feed set to `feed` (on either beta form). */
function withFeed(piece: SubroutineDefinition, feed: number): SubroutineDefinition {
  if (!piece.beta) return piece;
  const effect = { ...piece.beta.effect, feed } as BetaEffect;
  return { ...piece, beta: { ...piece.beta, effect } as SubroutineDefinition['beta'] };
}

function price(piece: SubroutineDefinition): string {
  const { coarse: c, fine } = refinedPrice(host, piece, coarse, options);
  const r = fine ?? c;
  return r.price === null ? '   --' : `${r.price.toFixed(2)} [${r.low?.toFixed(2)}, ${r.high?.toFixed(2)}]`;
}

console.log(`\nFEED PRICE -- Credit-2 host, ${seeds} seeds x 2 seats, skill 0.85.`);
for (const id of ids) {
  const piece = ALL_SUBROUTINES.find((p) => p.id === id);
  if (!piece || piece.alpha.verb !== 'credit') throw new Error(`no Credit-alpha piece "${id}"`);
  const band = withFeed({ ...piece, alpha: { ...piece.alpha, amount: piece.alpha.amount - 1 } }, 0);
  console.log(`\n${piece.name}  band (alpha ${piece.alpha.amount - 1}, no feed): ${price(band)}`);
  for (const feed of feeds) console.log(`  alpha ${piece.alpha.amount}, feed ${String(feed).padEnd(4)} ${price(withFeed(piece, feed))}`);
}
