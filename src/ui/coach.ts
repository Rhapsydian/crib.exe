import { cardsEqual, cardValue, type Card } from '../engine/cards';
import { cribTableValue, handExpectedValue, pegSkillStrategy, predictBestDiscard, scoreDiscard, unseenCards } from '../engine/ai';
import type { CribbageBeat } from '../engine/basic-cribbage';
import { rankLabel, suitInfo } from './suits';
import { suitToken } from './RichText.svelte';

/**
 * The coach (milestone 4 checkpoint 4, V1/V3): plain-words help for a
 * new player. Pure functions over the game's own data, so the screen
 * decides when to show them:
 * - phaseIntro: what this part of the hand is about (fuller the first
 *   time in a game, a short reminder after);
 * - discardHint / discardReview: the keep the coach suggests, and yours
 *   beside it afterwards, each with its average points over every
 *   possible cut, and what each keeps;
 * - pegHint / pegReview: the best pegging play now, and your last one
 *   beside it -- each play judged by what it scores less the opponent's
 *   expected reply over the cards they could hold;
 * - showSummary: last hand's count, walked through.
 * The coach's own choices come from the AI at full strength.
 */

const label = (c: Card) => rankLabel(c.rank);
/** "a" or "an" for a word as it's said: an 8, an A, an 11, an Overclock
 * (the user's catch); a 7, a Daemon. */
export const article = (word: string) => (/^(8|11|18|A|[AEIOUaeiou])/.test(word) ? 'an' : 'a');
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

/** What kept cards are sure to score among themselves, before the cut:
 * the points, and each part in words ("4 fifteens for 8"). */
export function keepScore(cards: Card[]): { pts: number; parts: string[] } {
  const parts: string[] = [];
  let pts = 0;
  // Fifteens: every combination adding to 15.
  let fifteens = 0;
  for (let mask = 1; mask < 1 << cards.length; mask++) {
    let sum = 0;
    for (let i = 0; i < cards.length; i++) if (mask & (1 << i)) sum += cardValue(cards[i]);
    if (sum === 15) fifteens++;
  }
  if (fifteens) (pts += fifteens * 2), parts.push(`${plural(fifteens, 'fifteen')} for ${fifteens * 2}`);
  // Pairs (three of a kind is three pairs).
  const byRank = new Map<number, number>();
  for (const c of cards) byRank.set(c.rank, (byRank.get(c.rank) ?? 0) + 1);
  for (const [rank, n] of byRank) if (n >= 2) {
    const p = n * (n - 1);
    pts += p;
    parts.push(n === 2 ? `a pair of ${rankLabel(rank)}s for 2` : `${n} ${rankLabel(rank)}s for ${p}`);
  }
  // Runs: the longest among the ranks, once per combination of duplicates.
  const ranks = [...byRank.keys()].sort((a, b) => a - b);
  let best: number[] = [];
  let cur: number[] = [];
  for (const r of ranks) {
    cur = cur.length && r === cur[cur.length - 1] + 1 ? [...cur, r] : [r];
    if (cur.length > best.length) best = cur;
  }
  if (best.length >= 3) {
    const times = best.reduce((m, r) => m * (byRank.get(r) ?? 1), 1);
    pts += best.length * times;
    parts.push(`${times > 1 ? `${times} runs` : 'a run'} ${best.map(rankLabel).join('-')} for ${best.length * times}`);
  }
  if (cards.length === 4 && cards.every((c) => c.suit === cards[0].suit)) (pts += 4), parts.push(`${article(suitInfo(cards[0].suit).name)} ${suitToken(cards[0].suit)} flush for 4`);
  return { pts, parts };
}

/** A keep in words: what it's sure to score, then what the cut adds on
 * average (the user's ask: "12 points, plus about 0.8 from the cut"). */
function keepLine(kept: Card[], unseen: Card[]): { text: string; average: number } {
  const { pts, parts } = keepScore(kept);
  const average = handExpectedValue(kept, unseen);
  const extra = (average - pts).toFixed(1);
  const text = pts
    ? `${pts} point${pts === 1 ? '' : 's'} in hand (${parts.join(', ')}), plus about ${extra} more on average from the cut`
    : `nothing in hand yet, about ${extra} on average from the cut`;
  return { text, average };
}

/** Two cards thrown, in words: whose crib, and what they make there on
 * average (the crib table: every other two crib cards, every cut). */
function throwLine(pair: [Card, Card], ownCrib: boolean): string {
  const v = cribTableValue(pair).toFixed(1);
  return ownCrib ? `${list(pair)} into your crib, worth about ${v} to you there on average` : `${list(pair)} into their crib, worth about ${v} to them on average`;
}

export interface DiscardReview {
  same: boolean;
  text: string;
}

/** Your discard beside the coach's: `hand` is the six dealt, `thrown`
 * the two you put in the crib. */
export function discardReview(hand: Card[], thrown: [Card, Card], ownCrib: boolean): DiscardReview {
  const best = predictBestDiscard(hand, ownCrib);
  const keep = (pair: Card[]) => hand.filter((c) => !pair.some((p) => cardsEqual(p, c)));
  const unseen = unseenCards(hand);
  const yours = { kept: keep(thrown), score: scoreDiscard(hand, thrown, ownCrib) };
  const coach = { kept: keep(best), score: scoreDiscard(hand, best, ownCrib) };
  // Good if it's the coach's discard, or within a whisker of it.
  const same = best.every((c) => thrown.some((t) => cardsEqual(t, c))) || yours.score >= coach.score - 0.3;
  const y = keepLine(yours.kept, unseen);
  const c = keepLine(coach.kept, unseen);
  const text = same
    ? `Good discard. You kept ${list(yours.kept)}: ${y.text}; and threw ${throwLine(thrown, ownCrib)}.`
    : `You kept ${list(yours.kept)}: ${y.text}; and threw ${throwLine(thrown, ownCrib)}. I would have kept ${list(coach.kept)}: ${c.text}; and thrown ${throwLine(best, ownCrib)}.`;
  return { same, text };
}

/** The discard the coach suggests, before you choose: what to keep and
 * why, and what to throw. */
export function discardHint(hand: Card[], ownCrib: boolean): string {
  const best = predictBestDiscard(hand, ownCrib);
  const kept = hand.filter((c) => !best.some((p) => cardsEqual(p, c)));
  return `Keep ${list(kept)}: ${keepLine(kept, unseenCards(hand)).text}. Throw ${throwLine(best, ownCrib)}.`;
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
function judgePlay(
  card: Card,
  spot: PegSpot,
): { pts: number; what: string[]; risk: number; net: number; threat: string; threatWho: string; threatWhat: string; scorers: number; scorerText: string } {
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
    const ranks = rs.map(rankLabel).join(' or ');
    return `${g.n > 1 ? 'any' : article(ranks)} ${ranks}`;
  };
  const threatWho = top ? cards(top[1]) : '';
  const threatWhat = top ? top[0] : '';
  const threat = top ? `${threatWho} would give them ${threatWhat}` : '';
  // For comparisons: every card still out that scores off this play,
  // counted and named by what it does ("2 fives to make fifteen, 3 tens to
  // pair it"). A card that scores two ways is counted once, under its
  // first.
  const PLURAL = ['', 'aces', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings'];
  const verbOf = (w: string) => (w.startsWith('fifteen') ? 'make fifteen' : w.startsWith('31') ? 'make 31' : w.includes('run') ? 'make a run' : 'pair it');
  const groups = [...byWhat].map(([w, g]) => {
    const rs = [...g.ranks].sort((a, b) => a - b);
    const single = (r: number) => (g.n === 1 ? PLURAL[r].replace(/s$/, '').replace(/sixe$/, 'six') : PLURAL[r]);
    // One rank: "4 fives". Several: counted as cards, the ranks in
    // brackets -- "8 cards (fives or eights)" (the user's wording; "8
    // fives or eights" read as eight fives).
    const who =
      rs.length > 1 && rs.every((r) => r >= 10)
        ? `${g.n} ten-card${g.n === 1 ? '' : 's'}`
        : rs.length === 1
          ? `${g.n} ${single(rs[0])}`
          : `${g.n} cards (${rs.map((r) => PLURAL[r]).join(' or ')})`;
    return { n: g.n, text: `${who} to ${verbOf(w)}` };
  });
  const scorers = replies.filter((r) => r.pts > 0).length;
  const ORDER = ['make fifteen', 'make 31', 'make a run', 'pair it'];
  const scorerText = groups
    .sort((x, y) => ORDER.findIndex((o) => x.text.endsWith(o)) - ORDER.findIndex((o) => y.text.endsWith(o)))
    .map((g) => g.text)
    .join(', ');
  return { pts, what, risk, net: pts - risk, threat, threatWho, threatWhat, scorers, scorerText };
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
  // Why this card: how few cards left can score off it, beside the
  // runner-up (the user asked why a 10 beat a 7 or 8 -- the fives were
  // already out). Then the clearly worst card, if there is one.
  const ranked = [...spot.legal].filter((card) => card.rank !== best.rank).sort((a, b) => judgePlay(b, spot).net - judgePlay(a, spot).net);
  const alt = ranked[0];
  const a = alt ? judgePlay(alt, spot) : null;
  const plural = (n: number) => `${n} card${n === 1 ? '' : 's'}`;
  const why = j.scorers ? `${plural(j.scorers)} left can score off it: ${j.scorerText}` : 'Nothing left can score off it right away';
  const compare = a && alt && a.scorers > j.scorers ? ` ${article(label(alt)) === 'an' ? 'An' : 'A'} ${label(alt)} leaves ${a.scorers}: ${a.scorerText}.` : '';
  const worst = ranked[ranked.length - 1];
  const w = worst ? judgePlay(worst, spot) : null;
  const avoid = worst && w && alt && worst.rank !== alt.rank && j.net - w.net >= 0.5 && w.threat ? ` Avoid ${label(worst)}: ${w.threat}.` : '';
  return `Play ${label(best)}. ${why}.${compare}${avoid}`;
}

/** Your last pegging card beside the coach's choice, in the past tense. */
export function pegReview(spot: PegSpot, played: Card): { same: boolean; text: string } {
  const coach = bestPlay(spot);
  const yours = judgePlay(played, spot);
  const theirs = judgePlay(coach, spot);
  const scored = (j: ReturnType<typeof judgePlay>) => (j.pts ? j.what.join(' and ') : 'no score');
  const risky = (j: ReturnType<typeof judgePlay>) => j.risk >= 0.5 && j.threat;
  // Good if it's the coach's play, or within a whisker of it.
  const same = cardsEqual(coach, played) || yours.net >= theirs.net - 0.2;
  if (same) {
    // A good play can still leave them something: say it was the least.
    const note = risky(yours) && spot.legal.length > 1 ? `; it still leaves ${yours.threatWho} ${yours.threatWhat}, but your other cards gave them more` : risky(yours) ? `; then ${yours.threat}` : '';
    return { same, text: `Good play: ${label(played)} (${scored(yours)}${note}).` };
  }
  const you = `You played ${label(played)} (${scored(yours)}${risky(yours) ? `; then ${yours.threat}` : ''}).`;
  // Why the coach's card instead: more points, or less handed over --
  // and when it still risks something, that it's the smaller risk.
  let why: string;
  if (theirs.pts > yours.pts) why = `I would have played ${label(coach)}: ${scored(theirs)}${risky(theirs) ? `, even though ${theirs.threat}` : ''}.`;
  else if (risky(theirs) && risky(yours)) why = `I would have played ${label(coach)} instead: it gives them less to score off -- its main danger is ${theirs.threatWho} making ${theirs.threatWhat}, against ${yours.threatWho} making ${yours.threatWhat} off yours.`;
  else if (risky(theirs)) why = `I would have played ${label(coach)} instead: it gives them less to score off overall, though ${theirs.threat}.`;
  else why = `I would have played ${label(coach)} instead: it gives them almost nothing to score off.`;
  return { same, text: `${you} ${why}` };
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
