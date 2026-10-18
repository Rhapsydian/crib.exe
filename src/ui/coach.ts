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
 * - pegHint: what to play now and why -- take an immediate score, or
 *   avoid handing the opponent an easy 15 or 31;
 * - pegReview: your last pegging card beside the coach's choice;
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

/** The easy score a play hands the opponent, if any: a count of 5 or 21
 * gives them 15 or 31 with any ten-card (the most common rank there is). */
function riskOf(card: Card, count: number): string {
  const after = count + cardValue(card);
  // A lead of 5 or more can be made into 15 (a lead under 5 can't).
  if (count === 0 && after >= 5) return `them a 15 off your lead with ${after === 5 ? 'any ten-card' : `a ${rankLabel(15 - after)}`}`;
  return after === 5 || after === 21 ? `the count on ${after}, so a ten-card makes ${after + 10} for them` : '';
}

/** What to play now, and why. */
export function pegHint(legal: Card[], count: number, sequence: Card[]): string {
  const scoring = legal.map((c) => ({ c, ...playScore(c, count, sequence) })).filter((s) => s.pts > 0).sort((a, b) => b.pts - a.pts);
  if (scoring.length) return `Play ${label(scoring[0].c)}: ${scoring[0].what.join(' and ')}.`;
  if (count === 0) {
    const safe = legal.filter((c) => cardValue(c) < 5);
    if (safe.length) return `Leading: a card under 5 (like ${label(safe[0])}) is safe -- they can't make 15 off it.`;
    const notFive = legal.find((c) => c.rank !== 5);
    return notFive ? `Leading: avoid a 5 -- any ten-card makes 15 off it. ${label(notFive)} is safer.` : "Leading a 5 is risky, but it's all you have.";
  }
  const warn = legal.map((c) => ({ c, r: riskOf(c, count) })).filter((x) => x.r);
  const ok = legal.filter((c) => !warn.some((w) => cardsEqual(w.c, c)));
  if (warn.length && ok.length) return `Careful: ${label(warn[0].c)} leaves ${warn[0].r}. ${label(ok[0])} is safer.`;
  return 'Nothing scores now. Hold on to cards that could pair or make 15 later.';
}

/** Your last pegging card beside the coach's choice, in the past tense:
 * `legal`, `count` and `sequence` as they stood when you played. */
export function pegReview(legal: Card[], count: number, sequence: Card[], played: Card): { same: boolean; text: string } {
  // The coach's pick follows its own advice (pegHint): the most points,
  // then no easy score handed over; the AI at full strength breaks ties.
  const ai = pegSkillStrategy(1)({ legalCards: legal, count, sequence });
  const rank = (card: Card) => [playScore(card, count, sequence).pts, riskOf(card, count) ? 0 : 1, cardsEqual(card, ai) ? 1 : 0];
  const coach = [...legal].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    return rb[0] - ra[0] || rb[1] - ra[1] || rb[2] - ra[2];
  })[0];
  const describe = (card: Card) => {
    const { pts, what } = playScore(card, count, sequence);
    const risk = riskOf(card, count);
    const parts = [pts ? what.join(' and ') : 'no score', risk && `it left ${risk}`].filter(Boolean);
    return { pts, risk, text: parts.join('; ') };
  };
  const yours = describe(played);
  const theirs = describe(coach);
  const same = cardsEqual(coach, played) || (yours.pts >= theirs.pts && !(yours.risk && !theirs.risk));
  const text = same
    ? `Good play: ${label(played)} (${yours.text}).`
    : `You played ${label(played)} (${yours.text}). I would have played ${label(coach)} (${theirs.text}).`;
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
