import { cardsEqual, cardValue, type Card } from '../engine/cards';
import { handExpectedValue, pegSkillStrategy, predictBestDiscard, scoreDiscard, unseenCards } from '../engine/ai';
import type { CribbageBeat } from '../engine/basic-cribbage';
import { rankLabel, suitInfo } from './suits';

/**
 * The coach (milestone 4 checkpoint 4, V1/V3): plain-words help for a
 * new player. Pure functions over the game's own data, so the screen
 * decides when to show them:
 * - phaseIntro: what this part of the hand is about (fuller the first
 *   time in a game, a short reminder after);
 * - discardReview: your keep beside the coach's own, each with its
 *   average points over every possible cut, and what each keeps;
 * - pegHint / pegReview: the best pegging play now, and your last one
 *   beside it -- each play judged by what it scores less the opponent's
 *   expected reply over the cards they could hold;
 * - showSummary: last hand's count, walked through.
 * The coach's own choices come from the AI at full strength.
 */

const label = (c: Card) => rankLabel(c.rank);
const list = (cards: Card[]) => cards.map(label).join(' ');
const plural = (n: number, word: string) => `${n === 1 ? 'a' : n} ${word}${n === 1 ? '' : 's'}`;

export type CoachPhase = 'discard' | 'peg' | 'show';

export function phaseIntro(phase: CoachPhase, ownCrib: boolean, first: boolean): string {
  const whose = ownCrib ? 'You deal, so the crib is yours: cards you throw there score for you.' : "They deal, so the crib is theirs: don't throw them points.";
  if (phase === 'discard') {
    return first
      ? 'Each hand you keep 4 cards and put 2 in the crib. Keep cards that score together -- fifteens (cards adding to 15), pairs, runs. The crib belongs to the dealer and is counted for them at the end of the hand.'
      : `Discard: keep the 4 that score best. ${whose}`;
  }
  if (phase === 'peg') {
    return first
      ? 'Pegging: take turns playing a card; the count adds up but can never pass 31. Score 2 for making 15 or 31, 2 for a pair, 3+ for a run. Say "go" when you can\'t play; the last card scores 1.'
      : 'Pegging: make 15, 31, pairs and runs; keep the count away from easy scores for them.';
  }
  return first
    ? 'The show: each hand is counted with the cut card -- fifteens, pairs, runs, flushes, and nobs (the Jack of the cut\'s suit). Non-dealer counts first, then dealer, then the crib.'
    : 'The show: hands count with the cut card, non-dealer first.';
}

/** What a set of cards scores among themselves (no cut card), in words. */
export function keepNotes(cards: Card[]): string[] {
  const notes: string[] = [];
  // Fifteens: every combination adding to 15.
  let fifteens = 0;
  for (let mask = 1; mask < 1 << cards.length; mask++) {
    let sum = 0;
    for (let i = 0; i < cards.length; i++) if (mask & (1 << i)) sum += cardValue(cards[i]);
    if (sum === 15) fifteens++;
  }
  if (fifteens) notes.push(`${plural(fifteens, 'fifteen')} (${fifteens * 2})`);
  // Pairs (three of a kind is three pairs).
  const byRank = new Map<number, number>();
  for (const c of cards) byRank.set(c.rank, (byRank.get(c.rank) ?? 0) + 1);
  for (const [rank, n] of byRank) if (n >= 2) notes.push(n === 2 ? `a pair of ${rankLabel(rank)}s (2)` : `${n} ${rankLabel(rank)}s (${n * (n - 1)})`);
  // The longest run among distinct ranks.
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  let best: number[] = [];
  let cur: number[] = [];
  for (const r of ranks) {
    cur = cur.length && r === cur[cur.length - 1] + 1 ? [...cur, r] : [r];
    if (cur.length > best.length) best = cur;
  }
  if (best.length >= 3) notes.push(`a run ${best.map(rankLabel).join('-')} (${best.length})`);
  if (cards.length === 4 && cards.every((c) => c.suit === cards[0].suit)) notes.push(`a ${suitInfo(cards[0].suit).name} flush (4)`);
  const fives = cards.filter((c) => c.rank === 5).length;
  if (!notes.length && fives) notes.push(`${fives > 1 ? 'fives' : 'a five'}, which make fifteen with any ten-card cut`);
  return notes;
}

export interface DiscardReview {
  same: boolean;
  yours: { kept: Card[]; thrown: Card[]; average: number; notes: string[] };
  coach: { kept: Card[]; thrown: Card[]; average: number; notes: string[] };
  text: string;
}

/** Your discard beside the coach's: `hand` is the six dealt, `thrown`
 * the two you put in the crib. */
export function discardReview(hand: Card[], thrown: [Card, Card], ownCrib: boolean): DiscardReview {
  const best = predictBestDiscard(hand, ownCrib);
  const keep = (pair: Card[]) => hand.filter((c) => !pair.some((p) => cardsEqual(p, c)));
  const unseen = unseenCards(hand);
  const side = (pair: [Card, Card]) => {
    const kept = keep(pair);
    return { kept, thrown: pair, average: handExpectedValue(kept, unseen), notes: keepNotes(kept), score: scoreDiscard(hand, pair, ownCrib) };
  };
  const yours = side(thrown);
  const coach = side(best);
  const same = best.every((c) => thrown.some((t) => cardsEqual(t, c)));
  const avg = (n: number) => n.toFixed(1);
  const why = (notes: string[]) => (notes.length ? notes.join(', ') : 'nothing scoring yet');
  const text = same
    ? `Good discard -- the one I would have made. You kept ${list(yours.kept)} (${why(yours.notes)}), worth about ${avg(yours.average)} with the cut.`
    : `You kept ${list(yours.kept)} (${why(yours.notes)}), about ${avg(yours.average)} with the cut. I would have kept ${list(coach.kept)} (${why(coach.notes)}), about ${avg(coach.average)}${ownCrib ? `, and thrown ${list(coach.thrown)} into your crib` : `, throwing them ${list(coach.thrown)}`}.`;
  return { same, yours: { ...yours }, coach: { ...coach }, text };
}

/** What playing `card` scores right now, in words. */
function playScore(card: Card, count: number, sequence: Card[]): { pts: number; what: string[] } {
  const after = count + cardValue(card);
  const what: string[] = [];
  let pts = 0;
  if (after === 15) (pts += 2), what.push('fifteen for 2');
  if (after === 31) (pts += 2), what.push('31 for 2');
  // Pairs with the cards just played.
  let same = 0;
  for (let i = sequence.length - 1; i >= 0 && sequence[i].rank === card.rank; i--) same++;
  if (same) (pts += [0, 2, 6, 12][same]), what.push(['', 'a pair for 2', 'three of a kind for 6', 'four of a kind for 12'][same]);
  // Runs ending with this card.
  const seq = [...sequence, card];
  for (let len = seq.length; len >= 3; len--) {
    const tail = seq.slice(-len).map((c) => c.rank).sort((a, b) => a - b);
    if (tail.every((r, i) => i === 0 || r === tail[i - 1] + 1)) {
      pts += len;
      what.push(`a run of ${len} for ${len}`);
      break;
    }
  }
  return { pts, what };
}

/** The table at a pegging decision, as the coach reads it. */
export interface PegSpot {
  legal: Card[];
  count: number;
  sequence: Card[];
  /** Every card the player can see: their hand, the cut, the cards
   * played this hand. The opponent's cards are among the rest. */
  known: Card[];
  /** How many cards the opponent still holds. */
  opponentCards: number;
}

/** C(n, k) ratio C(n - m, k) / C(n, k): the chance k random cards from n
 * miss all m particular ones. */
function missAll(n: number, m: number, k: number): number {
  let p = 1;
  for (let i = 0; i < k; i++) p *= Math.max(0, n - m - i) / (n - i);
  return p;
}

/**
 * A pegging play judged the way a good player does: the points it scores
 * now, less what it hands the opponent -- their best reply's expected
 * points, over every card they could still hold (more cards left, more
 * likely they hold the one that scores). The biggest threat is named.
 */
function judgePlay(card: Card, spot: PegSpot): { pts: number; what: string[]; risk: number; net: number; threat: string } {
  const { pts, what } = playScore(card, spot.count, spot.sequence);
  const after = spot.count + cardValue(card);
  const count = after === 31 ? 0 : after;
  const sequence = after === 31 ? [] : [...spot.sequence, card];
  const unseen = unseenCards([...spot.known, card]);
  const replies = unseen.map((u) => (count + cardValue(u) <= 31 ? { u, ...playScore(u, count, sequence) } : { u, pts: 0, what: [] as string[] }));
  const k = Math.min(spot.opponentCards, unseen.length);
  // E[best reply] = sum over t of P(they hold a reply worth at least t).
  let risk = 0;
  for (let t = 1; t <= 12; t++) {
    const m = replies.filter((r) => r.pts >= t).length;
    if (m) risk += 1 - missAll(unseen.length, m, k);
  }
  // The threat to name: the reply with the most at stake -- grouped by
  // what it scores, so every card that makes the same 15 counts together.
  const byWhat = new Map<string, { n: number; pts: number; ranks: Set<number> }>();
  for (const r of replies) if (r.pts > 0) {
    const g = byWhat.get(r.what[0]) ?? { n: 0, pts: r.pts, ranks: new Set<number>() };
    g.n++;
    g.ranks.add(r.u.rank);
    byWhat.set(r.what[0], g);
  }
  const top = [...byWhat].sort((a, b) => b[1].n * b[1].pts - a[1].n * a[1].pts)[0];
  const cards = (g: { n: number; ranks: Set<number> }) => {
    const rs = [...g.ranks].sort((a, b) => a - b);
    if (rs.length > 1 && rs.every((r) => r >= 10)) return 'any ten-card (10, J, Q, K)';
    return `${g.n > 1 ? 'any' : 'a'} ${rs.map(rankLabel).join(' or ')}`;
  };
  const threat = top ? `${cards(top[1])} would give them ${top[0]}` : '';
  return { pts, what, risk, net: pts - risk, threat };
}

/** The coach's pick: the best net play; the AI at full strength breaks
 * near-ties. */
function bestPlay(spot: PegSpot): Card {
  const ai = pegSkillStrategy(1)({ legalCards: spot.legal, count: spot.count, sequence: spot.sequence });
  return [...spot.legal].sort((a, b) => {
    const d = judgePlay(b, spot).net - judgePlay(a, spot).net;
    return Math.abs(d) > 0.05 ? d : (cardsEqual(b, ai) ? 1 : 0) - (cardsEqual(a, ai) ? 1 : 0);
  })[0];
}

/** What to play now, and why. */
export function pegHint(spot: PegSpot): string {
  const best = bestPlay(spot);
  const j = judgePlay(best, spot);
  if (j.pts > 0) return `Play ${label(best)}: ${j.what.join(' and ')}.${j.risk >= 1 && j.threat ? ` (Then watch out: ${j.threat}.)` : ''}`;
  if (spot.count === 0 && cardValue(best) < 5) return `Lead ${label(best)}: they can't make 15 off a card under 5.`;
  const worst = [...spot.legal].sort((a, b) => judgePlay(a, spot).net - judgePlay(b, spot).net)[0];
  const w = judgePlay(worst, spot);
  const avoid = !cardsEqual(worst, best) && j.net - w.net >= 0.5 && w.threat ? ` Avoid ${label(worst)}: ${w.threat}.` : '';
  return `Play ${label(best)}: it gives them the least to score off.${avoid}`;
}

/** Your last pegging card beside the coach's choice, in the past tense. */
export function pegReview(spot: PegSpot, played: Card): { same: boolean; text: string } {
  const coach = bestPlay(spot);
  const yours = judgePlay(played, spot);
  const theirs = judgePlay(coach, spot);
  const describe = (j: ReturnType<typeof judgePlay>) => [j.pts ? j.what.join(' and ') : 'no score', j.risk >= 0.5 && j.threat ? `then ${j.threat}` : ''].filter(Boolean).join('; ');
  // Good if it's the coach's play, or within a whisker of it.
  const same = cardsEqual(coach, played) || yours.net >= theirs.net - 0.2;
  const text = same
    ? `Good play: ${label(played)} (${describe(yours)}).`
    : `You played ${label(played)} (${describe(yours)}). I would have played ${label(coach)} (${describe(theirs)}).`;
  return { same, text };
}

/** Last hand's count, walked through: one line per hand counted. */
export function showSummary(timeline: readonly CribbageBeat[]): string[] {
  // The latest hand's show beats.
  let start = -1;
  for (let i = timeline.length - 1; i >= 0; i--) if (timeline[i].kind === 'hand') {
    start = i;
    break;
  }
  // Use the hand before the current one if the current hand has no show yet.
  const shows = (from: number) => timeline.slice(from).filter((b) => b.kind === 'show');
  let beats = start >= 0 ? shows(start) : [];
  if (!beats.length) {
    let prev = -1;
    for (let i = start - 1; i >= 0; i--) if (timeline[i].kind === 'hand') {
      prev = i;
      break;
    }
    beats = prev >= 0 ? timeline.slice(prev, start).filter((b) => b.kind === 'show') : [];
  }
  return beats.map((b) => {
    if (b.kind !== 'show') return '';
    const whose = `${b.player === 0 ? 'Your' : 'Their'} ${b.owner}`;
    if (!b.total) return `${whose}: nothing (${list(b.cards)} with the ${label(b.starter)} cut).`;
    const groups = new Map<string, { n: number; pts: number }>();
    for (const e of b.events) {
      const g = groups.get(e.category) ?? { n: 0, pts: 0 };
      groups.set(e.category, { n: g.n + 1, pts: g.pts + e.points });
    }
    const NAME: Record<string, string> = { fifteen: 'fifteen', pair: 'pair', run: 'run' };
    const parts = [...groups].map(([cat, g]) => (NAME[cat] ? `${plural(g.n, NAME[cat])} for ${g.pts}` : `${cat === 'nobs' ? 'nobs' : 'a flush'} for ${g.pts}`));
    return `${whose}: ${parts.join(', ')} = ${b.total}.`;
  });
}
