/**
 * What choosing your discard is worth (2026-11-07, for a reply to an
 * r/cribbage post charting every random 4-card hand plus a cut). Goes
 * through every 6-card deal, exactly: deals that differ only by suit
 * names are scored once and counted for each of them (about 1.1 million
 * stand in for all 20,358,520). For each, the game's own discard AI at
 * full strength (`predictBestDiscard`, the coach's pick) chooses a keep
 * twice: with the crib yours (dealer) and with it theirs (non-dealer).
 *
 * Four distributions, as % of keeps, by points:
 * 1. kept  -- the 4 kept cards' own points, before the cut (guaranteed);
 * 2. cut   -- the kept hand scored with each of the 46 possible cuts;
 * 3. mine  -- the keep's expected hand value + its expected crib (dealer);
 * 4. theirs -- the keep's expected hand value - their expected crib
 *    (non-dealer).
 * 1 and 2 count every deal twice, once as each side (you alternate who
 * deals); 3 uses the dealer keeps, 4 the non-dealer keeps. 3 and 4 are
 * rounded to the nearest point to pick their bar. Crib values are the
 * AI's own (the crib table). Plus the random-hand baseline: every 4-card
 * hand with every cut (12,994,800), as the post charted it.
 *
 * Usage:
 *   npx tsx scripts/discard-value-chart.ts [--shards=24] [--out=file.json]
 *   (runs the shards as child processes and merges them; --sample=N times
 *   N canonical deals on one process instead)
 */
import { execFile } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import type { Card, Rank, Suit } from '../src/engine/cards';
import { cardValue } from '../src/engine/cards';
import { predictBestDiscard, cribTableValue, unseenCards } from '../src/engine/ai';
import { countHand } from '../src/engine/scoring';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));

// --- Canonical deals: a deal is four 13-bit rank masks, one per suit;
// renaming suits permutes them, so masks sorted high to low name the
// class, and 24 / (the product of each repeated mask's count!) deals
// share it.
const POP: number[][] = Array.from({ length: 7 }, () => []);
for (let m = 0; m < 1 << 13; m++) {
  const p = popcount(m);
  if (p <= 6) POP[p].push(m);
}
function popcount(m: number): number {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
}
const FACT = [1, 1, 2, 6, 24];

function* canonicalDeals(): Generator<{ masks: number[]; weight: number }> {
  const masks: number[] = [];
  function* level(left: number, prev: number, suitsLeft: number): Generator<{ masks: number[]; weight: number }> {
    if (suitsLeft === 0) {
      if (left !== 0) return;
      const runs = new Map<number, number>();
      for (const m of masks) runs.set(m, (runs.get(m) ?? 0) + 1);
      let div = 1;
      for (const n of runs.values()) div *= FACT[n];
      yield { masks: [...masks], weight: 24 / div };
      return;
    }
    for (let p = Math.min(left, 6); p >= 0; p--) {
      for (const m of POP[p]) {
        if (m > prev) continue;
        masks.push(m);
        yield* level(left - p, m, suitsLeft - 1);
        masks.pop();
      }
    }
  }
  yield* level(6, Infinity, 4);
}

function cardsOf(masks: number[]): Card[] {
  const cards: Card[] = [];
  masks.forEach((m, suit) => {
    for (let r = 0; r < 13; r++) if (m & (1 << r)) cards.push({ rank: (r + 1) as Rank, suit: suit as Suit });
  });
  return cards;
}

/** The 4 kept cards' own points, before any cut: fifteens, pairs, runs
 * and a four-card flush (nobs needs the cut). */
function keptPoints(hand: Card[]): number {
  let pts = 0;
  for (let mask = 1; mask < 16; mask++) {
    let sum = 0;
    for (let i = 0; i < 4; i++) if (mask & (1 << i)) sum += cardValue(hand[i]);
    if (sum === 15) pts += 2;
  }
  const counts = new Map<number, number>();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  for (const n of counts.values()) pts += n * (n - 1);
  const ranks = [...counts.keys()].sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; ) {
    let j = i;
    while (j + 1 < ranks.length && ranks[j + 1] === ranks[j] + 1) j++;
    if (j - i + 1 >= 3) {
      let product = 1;
      for (let k = i; k <= j; k++) product *= counts.get(ranks[k])!;
      pts += (j - i + 1) * product;
    }
    i = j + 1;
  }
  if (hand.every((c) => c.suit === hand[0].suit)) pts += 4;
  return pts;
}

type Hist = Record<string, number>;
interface Tally {
  deals: number;
  kept: Hist;
  cut: Hist;
  mine: Hist;
  theirs: Hist;
  /** Weighted sums, for the averages. */
  sum: { kept: number; cut: number; dealerHand: number; poneHand: number; myCrib: number; theirCrib: number; mine: number; theirs: number };
}
const emptyTally = (): Tally => ({ deals: 0, kept: {}, cut: {}, mine: {}, theirs: {}, sum: { kept: 0, cut: 0, dealerHand: 0, poneHand: 0, myCrib: 0, theirCrib: 0, mine: 0, theirs: 0 } });
const add = (h: Hist, k: number, w: number) => {
  h[k] = (h[k] ?? 0) + w;
};

function tallyDeal(t: Tally, masks: number[], weight: number): void {
  const hand = cardsOf(masks);
  const unseen = unseenCards(hand);
  t.deals += weight;
  for (const dealer of [true, false]) {
    const pair = predictBestDiscard(hand, dealer);
    const kept = hand.filter((c) => !pair.includes(c));
    const w = weight / 2;
    const k = keptPoints(kept);
    add(t.kept, k, w);
    t.sum.kept += k * w;
    let cutTotal = 0;
    for (const cut of unseen) {
      const s = countHand(kept, cut).total;
      add(t.cut, s, w / unseen.length);
      cutTotal += s;
    }
    const handEV = cutTotal / unseen.length;
    t.sum.cut += handEV * w;
    const crib = cribTableValue(pair);
    if (dealer) {
      const v = handEV + crib;
      add(t.mine, Math.round(v), weight);
      t.sum.dealerHand += handEV * weight;
      t.sum.myCrib += crib * weight;
      t.sum.mine += v * weight;
    } else {
      const v = handEV - crib;
      add(t.theirs, Math.round(v), weight);
      t.sum.poneHand += handEV * weight;
      t.sum.theirCrib += crib * weight;
      t.sum.theirs += v * weight;
    }
  }
}

function merge(into: Tally, from: Tally): void {
  into.deals += from.deals;
  for (const key of ['kept', 'cut', 'mine', 'theirs'] as const) for (const [k, v] of Object.entries(from[key])) add(into[key], Number(k), v);
  for (const key of Object.keys(into.sum) as (keyof Tally['sum'])[]) into.sum[key] += from.sum[key];
}

/** The post's chart: every 4-card hand with every cut, equally. */
function baseline(): { hist: Hist; mean: number; hands: number } {
  const deck = unseenCards([]);
  const hist: Hist = {};
  let n = 0;
  let total = 0;
  for (let a = 0; a < 52; a++)
    for (let b = a + 1; b < 52; b++)
      for (let c = b + 1; c < 52; c++)
        for (let d = c + 1; d < 52; d++) {
          const hand = [deck[a], deck[b], deck[c], deck[d]];
          for (let e = 0; e < 52; e++) {
            if (e === a || e === b || e === c || e === d) continue;
            const s = countHand(hand, deck[e]).total;
            add(hist, s, 1);
            total += s;
            n++;
          }
        }
  return { hist, mean: total / n, hands: n };
}

const shard = args.shard ? args.shard.split('/').map(Number) : null;
if (shard) {
  // One child's share: every Nth canonical deal.
  const [i, n] = shard;
  const t = emptyTally();
  let idx = 0;
  for (const { masks, weight } of canonicalDeals()) if (idx++ % n === i) tallyDeal(t, masks, weight);
  process.stdout.write(JSON.stringify(t));
} else if (args.sample) {
  const n = Number(args.sample);
  const t = emptyTally();
  const start = Date.now();
  let total = 0;
  let deals = 0;
  for (const { masks, weight } of canonicalDeals()) {
    total++;
    deals += weight;
    if (total <= n) tallyDeal(t, masks, weight);
  }
  const ms = Date.now() - start;
  console.log(`${total} canonical deals standing for ${deals} (C(52,6) = 20358520); ${n} scored in ${ms} ms`);
  console.log(`about ${Math.round(((ms / n) * total) / 1000 / 60)} min on one process`);
} else {
  const shards = Number(args.shards ?? Math.max(1, cpus().length - 4));
  const out = args.out ?? 'discard-value-chart.json';
  const started = Date.now();
  const run = (i: number) =>
    new Promise<Tally>((resolve, reject) =>
      execFile(process.execPath, [...process.execArgv, process.argv[1], `--shard=${i}/${shards}`], { maxBuffer: 1 << 26 }, (err, stdout) => (err ? reject(err) : resolve(JSON.parse(stdout)))),
    );
  const parts = await Promise.all(Array.from({ length: shards }, (_, i) => run(i)));
  const t = emptyTally();
  for (const p of parts) merge(t, p);
  const base = baseline();
  const avg = (s: number, w: number) => s / w;
  const result = {
    deals: t.deals,
    baseline: base,
    histograms: { kept: t.kept, cut: t.cut, mine: t.mine, theirs: t.theirs },
    averages: {
      random: base.mean,
      kept: avg(t.sum.kept, t.deals),
      cut: avg(t.sum.cut, t.deals),
      dealerHand: avg(t.sum.dealerHand, t.deals),
      poneHand: avg(t.sum.poneHand, t.deals),
      myCrib: avg(t.sum.myCrib, t.deals),
      theirCrib: avg(t.sum.theirCrib, t.deals),
      mine: avg(t.sum.mine, t.deals),
      theirs: avg(t.sum.theirs, t.deals),
    },
  };
  writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(`${t.deals} deals in ${Math.round((Date.now() - started) / 1000)}s; written to ${out}`);
  console.log(result.averages);
}
