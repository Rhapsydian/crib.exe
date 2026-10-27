import { cardValue, type Card, type Rank, type Suit } from '../engine/cards';
import { countHand, countHandEvents, type ShowScoreEvent } from '../engine/scoring';
import { scoreCardPlay } from '../engine/pegging';

/**
 * Learn to play (milestone 4 checkpoint 5, V1): short lessons on set-up
 * deals, written as data. Each lesson is a few steps:
 * - read: a short explanation, with cards shown where they help;
 * - find: tap the cards that make each fifteen / pair / run in a hand
 *   (the answers are the engine's own scoring events, so a lesson can't
 *   teach a wrong count);
 * - choice: a quick question (counts are checked against countHand in
 *   the tests);
 * - peg: play a card to make 15, make 31, pair the last card, or lead
 *   safely;
 * - discard: throw two from six, judged by the coach.
 * Progress -- which lessons are done -- is kept in this browser.
 */

/** A card, briefly: c(5, 2) is the 5 of suit 2. */
export const c = (rank: number, suit = 0): Card => ({ rank: rank as Rank, suit: suit as Suit });

export type LessonStep =
  | { kind: 'read'; text: string; cards?: Card[]; starter?: Card }
  | { kind: 'find'; prompt: string; category: 'fifteen' | 'pair' | 'run'; hand: Card[]; starter: Card; explain: string }
  | { kind: 'choice'; prompt: string; cards?: Card[]; starter?: Card; options: string[]; answer: number; explain: string }
  | { kind: 'peg'; prompt: string; sequence: Card[]; hand: Card[]; goal: 'fifteen' | 'thirtyOne' | 'pair' | 'safeLead'; explain: string }
  | { kind: 'discard'; prompt: string; hand: Card[]; ownCrib: boolean };

export interface Lesson {
  id: string;
  title: string;
  blurb: string;
  steps: LessonStep[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'basics',
    title: 'The goal and the deal',
    blurb: 'A race to 121, the crib, and the cut.',
    steps: [
      {
        kind: 'read',
        text: 'Cribbage is a race to 121 points. You score in two ways: while playing cards ("pegging"), and by counting your hand ("the show"). The first to 121 wins, even in the middle of a hand.',
      },
      {
        kind: 'read',
        text: 'Each hand, both players get 6 cards. You keep 4, and throw 2 face down into the crib: a third hand that belongs to the dealer. The deal switches every hand, so the crib does too.',
        cards: [c(3, 0), c(7, 1), c(8, 2), c(11, 3), c(2, 1), c(13, 0)],
      },
      {
        kind: 'read',
        text: 'Then the deck is cut and a card turned up: the starter, or cut card. It counts as a fifth card for both hands and the crib. If it is a Jack, the dealer scores 2 straight away: "His Heels".',
        starter: c(11, 2),
      },
      { kind: 'choice', prompt: 'You are dealing this hand. Whose crib is it?', options: ['Yours', "Your opponent's"], answer: 0, explain: 'The crib always belongs to the dealer, so cards you throw into it score for you this hand.' },
      { kind: 'choice', prompt: 'You are dealt 6 cards. How many do you keep?', options: ['2', '4', '6'], answer: 1, explain: 'You keep 4 and throw 2 into the crib.' },
    ],
  },
  {
    id: 'counting',
    title: 'Fifteens, pairs and runs',
    blurb: 'The combinations that score.',
    steps: [
      {
        kind: 'read',
        text: 'Hands score for combinations of cards. For adding up, face cards (J, Q, K) count 10, an Ace counts 1, and the rest count their number. Any cards that add to exactly 15 score 2: "fifteen two".',
        cards: [c(7, 0), c(8, 1)],
      },
      { kind: 'find', prompt: 'Find every fifteen in this hand and its starter. Tap the cards that add to 15, then check.', category: 'fifteen', hand: [c(7, 0), c(8, 1), c(5, 2), c(13, 3)], starter: c(3, 0), explain: '7+8, 5+K, and 7+5+3. Each combination counts, even when cards are reused.' },
      { kind: 'read', text: 'Two cards of the same rank make a pair: 2 points. Three of a kind count as three pairs (6); four of a kind as six pairs (12).', cards: [c(9, 0), c(9, 2)] },
      { kind: 'find', prompt: 'Find the pair.', category: 'pair', hand: [c(9, 0), c(4, 1), c(12, 2), c(9, 3)], starter: c(1, 0), explain: 'The two 9s: 2 points.' },
      { kind: 'choice', prompt: 'You hold three 6s. What are they worth?', cards: [c(6, 0), c(6, 1), c(6, 2)], options: ['2', '4', '6'], answer: 2, explain: 'Three of a kind is three different pairs: 6 points.' },
      { kind: 'read', text: 'Three or more cards in a row (suits don\'t matter) make a run: 1 point per card. A-2-3 is a run, but Q-K-A is not: the Ace is always low.', cards: [c(4, 0), c(5, 1), c(6, 2)] },
      { kind: 'find', prompt: 'Find the run.', category: 'run', hand: [c(4, 0), c(11, 1), c(6, 2), c(5, 3)], starter: c(9, 1), explain: '4-5-6: a run of 3, for 3 points.' },
      { kind: 'choice', prompt: 'Count this hand with its starter: fifteens, pairs and runs.', cards: [c(4, 0), c(5, 1), c(6, 2), c(10, 3)], starter: c(5, 0), options: ['12', '14', '16'], answer: 2, explain: 'Fifteens: 4+5+6 twice (once with each 5) and 5+10 twice, 8. The pair of 5s, 2. Two runs of 4-5-6, one with each 5, 6. Total 16.' },
    ],
  },
  {
    id: 'pegging',
    title: 'Pegging to 31',
    blurb: 'Scoring as the cards are played.',
    steps: [
      { kind: 'read', text: 'After the discard, players take turns laying one card face up, the non-dealer first, and saying the running total. The count can never go over 31.' },
      { kind: 'read', text: 'You score as you play: 2 for making the count exactly 15, 2 for exactly 31, 2 for pairing the card just played, and a point per card for a run among the last cards played.' },
      { kind: 'peg', prompt: 'They played a 10. The count is 10. Make fifteen.', sequence: [c(10, 1)], hand: [c(9, 0), c(5, 2), c(2, 3), c(13, 0)], goal: 'fifteen', explain: 'The 5 makes 15: two points.' },
      { kind: 'peg', prompt: 'The count is 7: they just played a 7. Pair it.', sequence: [c(7, 3)], hand: [c(3, 0), c(12, 1), c(7, 1), c(9, 2)], goal: 'pair', explain: 'Your 7 pairs theirs: two points.' },
      { kind: 'peg', prompt: 'The count is 21. Make 31.', sequence: [c(13, 0), c(4, 1), c(7, 2)], hand: [c(4, 3), c(10, 2), c(1, 0), c(7, 0)], goal: 'thirtyOne', explain: 'The 10 makes exactly 31: two points, and the count starts again from 0.' },
      { kind: 'read', text: 'If you can\'t play without going over 31, you say "go". Your opponent keeps playing while they can; whoever lays the last card scores 1 for the go. Then the count starts again at 0. The very last card of the hand scores 1 too.' },
      { kind: 'choice', prompt: 'The count is 25. You hold a 9 and a 10. What happens?', options: ['You play the 9', 'You say "go"', 'You play the 10'], answer: 1, explain: 'Either card would take the count past 31, so you say "go".' },
      { kind: 'peg', prompt: 'You are leading: the count is 0. Which card is safest?', sequence: [], hand: [c(5, 0), c(10, 1), c(3, 2), c(8, 3)], goal: 'safeLead', explain: 'A card under 5 is safe: no single card can make 15 off it. Leading a 5 is the riskiest: every ten-card makes 15.' },
    ],
  },
  {
    id: 'show',
    title: 'The show and the crib',
    blurb: 'Counting hands, flushes and nobs.',
    steps: [
      { kind: 'read', text: 'When play ends, the hands are counted, each with the starter: the non-dealer\'s first, then the dealer\'s, then the dealer\'s crib. Count fifteens, pairs and runs, then flushes and nobs.' },
      { kind: 'read', text: 'A flush: all four cards in your hand of one suit score 4, or 5 if the starter matches too. In the crib, only a five-card flush counts.', cards: [c(2, 1), c(6, 1), c(9, 1), c(12, 1)], starter: c(4, 1) },
      { kind: 'read', text: 'Nobs: a Jack in your hand of the same suit as the starter scores 1.', cards: [c(11, 2)], starter: c(8, 2) },
      { kind: 'choice', prompt: 'Who counts first?', options: ['The dealer', 'The non-dealer', 'Whoever has more points'], answer: 1, explain: 'The non-dealer counts first. It matters at the end: they can reach 121 before the dealer counts.' },
      { kind: 'choice', prompt: 'Count this hand.', cards: [c(2, 1), c(6, 1), c(9, 1), c(12, 1)], starter: c(4, 3), options: ['4', '6', '8'], answer: 2, explain: 'Fifteens: 6+9 and 2+4+9, 4. A four-card flush (the starter is a different suit), 4. Total 8.' },
      { kind: 'choice', prompt: 'Count this hand.', cards: [c(11, 0), c(5, 1), c(5, 2), c(10, 3)], starter: c(8, 0), options: ['9', '10', '11'], answer: 2, explain: 'Fifteens: the J with each 5 and the 10 with each 5, 8. The pair of 5s, 2. Nobs, the Jack matching the suit of the starter, 1. Total 11.' },
    ],
  },
  {
    id: 'discard',
    title: 'Choosing a discard',
    blurb: 'What to keep, and what to throw.',
    steps: [
      { kind: 'read', text: 'Keep the four cards that score best together, and mind the crib: good cards into your own crib, poor ones into theirs. Fives are gold: every ten-card makes 15 with one.' },
      { kind: 'discard', prompt: 'It\'s their crib. Choose 2 to throw.', hand: [c(5, 0), c(5, 1), c(11, 2), c(12, 3), c(2, 0), c(9, 1)], ownCrib: false },
      { kind: 'discard', prompt: 'Now it\'s your crib. Choose 2 to throw.', hand: [c(4, 0), c(5, 1), c(6, 2), c(6, 3), c(13, 0), c(1, 1)], ownCrib: true },
      { kind: 'read', text: 'That\'s the game. Play a coached game next: the coach will suggest moves and review yours as you go.' },
    ],
  },
];

/** The scoring events a find step is looking for. */
export function findTargets(step: Extract<LessonStep, { kind: 'find' }>): ShowScoreEvent[] {
  return countHandEvents(step.hand, step.starter).filter((e) => e.category === step.category);
}

/** Whether a set of cards is exactly one of the targets. */
export function matchesTarget(selected: Card[], target: ShowScoreEvent): boolean {
  const key = (cs: Card[]) => cs.map((x) => `${x.rank}-${x.suit}`).sort().join(',');
  return key(selected) === key(target.cards);
}

/** Whether a pegging card meets the step's goal. */
export function pegGoalMet(step: Extract<LessonStep, { kind: 'peg' }>, card: Card): boolean {
  const count = step.sequence.reduce((sum, x) => sum + cardValue(x), 0) + cardValue(card);
  const b = scoreCardPlay([...step.sequence, card], count);
  switch (step.goal) {
    case 'fifteen':
      return b.fifteen > 0;
    case 'thirtyOne':
      return b.thirtyOne > 0;
    case 'pair':
      return b.pair > 0;
    case 'safeLead':
      return cardValue(card) < 5;
  }
}

/** A choice step's true count, for steps that ask for a hand's total. */
export function handTotal(cards: Card[], starter: Card): number {
  return countHand(cards, starter).total;
}

export const LESSONS_KEY = 'cribexe.lessons';
const KEY = LESSONS_KEY;
export function loadProgress(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
export function markDone(id: string): Set<string> {
  const done = loadProgress();
  done.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch {
    // Unsaved: progress just isn't remembered.
  }
  return done;
}
