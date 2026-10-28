import type { Alpha, Beta, BetaEffect, Effect, SubroutineDefinition } from '../engine/subroutine-types';
import { ARCHETYPE_SUITS } from '../engine/subroutine-types';
import type { SubroutineRuntimeState } from '../engine/triggers';
import type { FireEvent } from '../engine/resolve';
import { GAUGE_THRESHOLD } from '../engine/encounters';
import { suitInfo } from './suits';

/**
 * Plain-language text for subroutines and fires (milestone 2). Players
 * see "Process" (the alpha, every turn) and "Hook" (the beta, when its
 * condition is met) -- P7 of docs/playable-design.md. Display only: the
 * engine keeps alpha/beta.
 *
 * Written to the rules in docs/archive/text-audit.md (session 60): "subroutine",
 * never "piece"; say what gets bigger; counts are "since it last fired";
 * the on-screen gauge names (Breach, Containment); initiative in turns
 * with the number spelled out. Every text is in the player's voice;
 * forEnemy re-voices it for an enemy subroutine.
 */

// Quarters exactly (0.75, 1.25: the design's own steps), anything else
// -- scaled enemy values -- to one decimal.
const fmt = (n: number) => {
  if (Number.isInteger(n)) return String(n);
  const quarters = n * 4;
  if (Math.abs(quarters - Math.round(quarters)) < 1e-9) return String(Math.round(quarters) / 4);
  return n.toFixed(1).replace(/\.0$/, '');
};
const FRACTIONS: [number, string][] = [
  [1 / 48, '1/48'],
  [1 / 24, '1/24'],
  [1 / 12, '1/12'],
  [1 / 16, '1/16'],
  [1 / 8, '⅛'],
  [1 / 6, '⅙'],
  [1 / 4, '¼'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [3 / 4, '¾'],
];
const turnFraction = (n: number) => FRACTIONS.find(([v]) => Math.abs(v - n) < 1e-9)?.[1] ?? fmt(n);
/** A share of a gauge, in words: "half", "three-quarters". */
const gaugeShare = (n: number) => ({ '0.25': 'a quarter', '0.5': 'half', '0.75': 'three-quarters' })[String(n)] ?? `${Math.round(n * 100)}%`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'}`;

/**
 * The initiative thresholds a text's turn fractions are worked out
 * against: the subroutine's own side's and its opponent's. A fight's
 * detail panel passes the live ones; everywhere else (rewards, the Shop)
 * the usual starting threshold stands in.
 */
export interface Thresholds {
  own: number;
  opponent: number;
}
const USUAL: Thresholds = { own: GAUGE_THRESHOLD, opponent: GAUGE_THRESHOLD };

/** A noisy effect's drawback (`feed`), in words. */
const feedText = (feed: number | undefined) => (feed ? `, and add ${fmt(feed)} to their Containment` : '');

/** One effect, as an instruction: "Credit 1", "Ward 2". */
export function describeEffect(effect: Effect, thresholds: Thresholds = USUAL): string {
  const feed = feedText(effect.feed);
  switch (effect.verb) {
    case 'credit':
      if (effect.from === 'opponent') return `take ${fmt(effect.amount)} from their Containment and add it to your Breach${feed}`;
      if (effect.from === 'ward') return `spend ${fmt(effect.amount)} of your Ward to Credit ${fmt(effect.amount)}${feed}`;
      return `Credit ${fmt(effect.amount)}${effect.piercing ? ' that ignores their Ward' : ''}${feed}`;
    case 'suppress':
      return `Suppress ${fmt(effect.amount)}${feed}`;
    case 'ward':
      return `Ward ${fmt(effect.amount)}${feed}`;
    case 'empower': {
      const a = fmt(effect.amount);
      return effect.scope === 'next'
        ? `Empower ${a}: the next subroutine's Process Credits, Suppresses or Wards ${a} more this turn${feed}`
        : `Empower ${a}: every subroutine below it Credits, Suppresses or Wards ${a} more with its Process this turn${feed}`;
    }
    case 'tempo': {
      const own = effect.target === 'own';
      if (effect.mode === 'gauge') {
        const points = fmt(effect.amount * (own ? thresholds.own : thresholds.opponent));
        return own
          ? `add ${turnFraction(effect.amount)} of a turn (${points} initiative) to your initiative gauge${feed}`
          : `remove ${turnFraction(effect.amount)} of a turn (${points} initiative) from their initiative gauge${feed}`;
      }
      // Threshold mode: a share of the starting threshold, as a percentage
      // (1/24 would otherwise print as "0").
      const pct = `${Math.max(1, Math.round(effect.amount * 100))}%`;
      const span = effect.duration ? ` for ${effect.duration === 1 ? 'their next turn' : `their next ${effect.duration} turns`}` : '';
      return own
        ? `lower your initiative threshold by ${pct}, so your turns come sooner${span.replace('their', 'your')}${feed}`
        : `raise their initiative threshold by ${pct}, so their turns come later${span}${feed}`;
    }
    case 'disrupt':
      return {
        revealHand: 'next hand, reveal their hand',
        revealCrib: 'next hand, reveal the cards they put in the crib before you choose yours',
        forceDiscard: 'next hand, move the card they can least spare from their hand into the crib',
      }[effect.action] + feed;
    case 'charge': {
      const counts = effect.amount === 1 ? 'one extra count' : `${fmt(effect.amount)} extra counts`;
      const whose = effect.target === 'self' ? 'its own Hook' : effect.target === 'next' ? "the next subroutine's Hook" : "every other subroutine's Hook";
      // Not an Instant Hook's (v0.9.1): the engine skips those.
      return `give ${whose} ${counts}${effect.target === 'self' ? '' : ' (not Instant Hooks)'}${feed}`;
    }
    // The enemy-only effects (CP1) always land on the other side, so they
    // read as what happens to it ("they gain 1 Heat"); forEnemy turns
    // that into "you gain 1 Heat".
    case 'trace':
      return `they gain ${fmt(effect.amount)} Heat${feed}`;
    case 'wipe':
      return `each of their Hooks loses ${effect.amount === 1 ? '1 count' : `${fmt(effect.amount)} counts`}${feed}`;
    case 'strip':
      return `they lose ${fmt(effect.amount)} Ward${feed}`;
    case 'suspend':
      return `their bottom subroutine skips its next ${effect.amount === 1 ? 'turn' : `${fmt(effect.amount)} turns`}${feed}`;
  }
}

/** A Process: its effect, and its growth if it has one. */
export function describeProcess(alpha: Alpha, thresholds: Thresholds = USUAL): string {
  const base = describeEffect(alpha as Effect, thresholds);
  if (!alpha.growth) return cap(base);
  const top = 'amount' in alpha ? alpha.amount + (alpha.growthCap ?? 0) : 0;
  return cap(`${base}, growing ${fmt(alpha.growth)} each time it fires (up to ${fmt(top)})`);
}

// ---------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------

/** What an `enhance` Hook makes bigger, as a verb phrase: "Credits 1 more". */
function moreText(alpha: Alpha, amount: number): string {
  const a = fmt(amount);
  switch (alpha.verb) {
    case 'credit':
      if (alpha.from === 'opponent') return `takes ${a} more from their Containment`;
      if (alpha.from === 'ward') return `spends and Credits ${a} more`;
      return `Credits ${a} more`;
    case 'suppress':
      return `Suppresses ${a} more`;
    case 'ward':
      return `Wards ${a} more`;
    case 'empower':
      return `Empowers ${a} more`;
    case 'charge':
      return `gives ${amount === 1 ? '1 more count' : `${a} more counts`}`;
    default:
      return `does ${a} more`;
  }
}

const CATEGORY: Record<string, [one: string, many: string]> = {
  fifteen: ['a fifteen', 'fifteens'],
  pair: ['a pair', 'pairs'],
  run: ['a run', 'runs'],
  flush: ['a flush', 'flushes'],
  hisNobs: ['his nobs', 'his nobs'],
  thirtyOne: ['a 31', '31s'],
  go: ['a go', 'gos'],
};

/**
 * A counting Hook's event, three ways: `noun` for "for each ___" ("pair
 * you've scored"), `clause(n)` for "if/once ___" ("you've scored 3
 * pairs"), and `per` for a progress Hook's step (null for cards Hooks).
 */
interface Events {
  noun: string;
  clause: (n: number) => string;
}

function counted(beta: Beta, archetype: SubroutineDefinition['archetype']): Events {
  if (beta.source === 'cards') {
    const who = beta.watch === 'opponent' ? 'the opponent has' : beta.watch === 'either' ? 'anyone has' : "you've";
    if (beta.category === 'suit') {
      const suit = suitToken(ARCHETYPE_SUITS[archetype]);
      const verb = `${who} played`;
      return { noun: `${suit} card ${verb}`, clause: (n) => `${verb} ${n === 1 ? `a ${suit} card` : `${n} ${suit} cards`}` };
    }
    const [one, many] = CATEGORY[beta.category] ?? [beta.category, beta.category];
    const worth = beta.minMagnitude ? ` worth ${beta.minMagnitude}+` : '';
    const verb = `${who} scored`;
    return { noun: `${one.replace(/^an? /, '')}${worth} ${verb}`, clause: (n) => `${verb} ${n === 1 ? one : `${n} ${many}`}${worth}` };
  }
  if (beta.source === 'progress') {
    const per = beta.per;
    if (beta.metric === 'points') return { noun: `${per} points you've scored`, clause: (n) => `you've scored ${n * per} points` };
    if (beta.metric === 'absorbed')
      return {
        noun: per === 1 ? 'point of their Credit your Ward has absorbed' : `${per} points of their Credit your Ward has absorbed`,
        clause: (n) => `your Ward has absorbed ${n * per} of their Credit`,
      };
    return { noun: `${per} times it's fired`, clause: (n) => `it's fired ${n * per} times` };
  }
  return { noun: '', clause: () => '' };
}

/** A `sequence` Hook's match: "Overclock subroutine". */
function matchText(beta: Extract<Beta, { source: 'sequence' }>): string {
  const m = beta.match;
  if ('archetype' in m) return `${cap(m.archetype)} subroutine`;
  if ('verb' in m) return `subroutine whose Process is ${cap(m.verb)}`;
  return 'matching subroutine';
}

/** A `state` condition, as "while ___" and as "the moment ___". */
function stateText(beta: Extract<Beta, { source: 'state' }>): { while: string; moment: string } {
  const c = beta.condition;
  switch (c.kind) {
    case 'dealer':
      return { while: "you're the dealer", moment: 'you become the dealer' };
    case 'nonDealer':
      return { while: "you're not the dealer", moment: 'you stop being the dealer' };
    case 'wardAbove':
      return { while: `your Ward is over ${fmt(c.amount)}`, moment: `your Ward goes over ${fmt(c.amount)}` };
    case 'ownGaugeAbove':
      return { while: `your Breach is over ${gaugeShare(c.fraction)}`, moment: `your Breach goes over ${gaugeShare(c.fraction)}` };
    case 'ownGaugeBelow':
      return { while: `your Breach is under ${gaugeShare(c.fraction)}`, moment: `your Breach drops under ${gaugeShare(c.fraction)}` };
    case 'opponentGaugeAbove':
      return { while: `their Containment is over ${gaugeShare(c.fraction)}`, moment: `their Containment goes over ${gaugeShare(c.fraction)}` };
    case 'opponentGaugeBelow':
      return { while: `their Containment is under ${gaugeShare(c.fraction)}`, moment: `their Containment drops under ${gaugeShare(c.fraction)}` };
    case 'handPointsAtLeast':
      return { while: `you've scored ${c.amount}+ points this hand`, moment: `you've scored ${c.amount} points this hand` };
  }
}

/** The most a graded Hook adds, as an amount ("at most 2") or, for an
 * effect with no amount to add up, a count ("at most twice"). */
function gradedCap(effect: BetaEffect, capCount: number, enhance: boolean): string {
  if (effect.verb === 'tempo' || effect.verb === 'disrupt' || effect.verb === 'charge' || effect.verb === 'suspend') return `at most ${times(capCount)}`;
  return `at most ${fmt(effect.amount * capCount)}${enhance ? ' more' : ''}`;
}

/** An effect's instruction ("Credit 1", "give every other ...") as what
 * a subroutine does ("Credits 1", "gives every other ..."). */
function thirdPerson(text: string): string {
  return text.replace(/^(\w+)/, (verb) => (/(s|sh|ch|x)$/.test(verb) ? `${verb}es` : `${verb}s`));
}

/** A Hook's label: "Hook", or "Hook · Instant" for one that goes off the
 * moment its event happens instead of on a turn (v0.9.1, the user's ask:
 * say so up front). */
export function hookLabel(piece: SubroutineDefinition): string {
  return piece.beta?.shape === 'immediate' ? 'Hook · Instant' : 'Hook';
}

/** A Hook in a sentence -- what sets it off, and what it does. */
export function describeHook(piece: SubroutineDefinition, thresholds: Thresholds = USUAL): string {
  const beta = piece.beta;
  if (!beta) return '';
  const effect = beta.effect;
  const enhance = effect.verb === 'enhance';
  // "Credits 1 more" (enhance) or "also Suppress 1" (its own effect).
  // A Disrupt reads on its own ("next hand, ..."), without the "also";
  // so do the enemy-only effects, which say what happens to the other side.
  const standalone = effect.verb === 'disrupt' || effect.verb === 'trace' || effect.verb === 'wipe' || effect.verb === 'strip' || effect.verb === 'suspend';
  const does = enhance ? moreText(piece.alpha, effect.amount) : `${standalone ? '' : 'also '}${describeEffect(effect, thresholds)}`;
  // A noisy enhance Hook's drawback, paid each time it applies.
  const noise = enhance && effect.feed ? ` — and whenever it does, it also adds ${fmt(effect.feed)} to their Containment` : '';
  const since = 'since it last fired';

  if (beta.shape === 'immediate') {
    const now = enhance
      ? effect.amount === 0
        ? 'it fires an extra time right away'
        : `it fires an extra time right away and ${moreText(piece.alpha, effect.amount)}`
      : `${describeEffect(effect, thresholds)} right away`;
    // "Instant" is in the label (hookLabel), not the sentence (v0.9.1).
    const when = beta.source === 'state' ? `The moment ${stateText(beta).moment}` : `Every time ${counted(beta, piece.archetype).clause(beta.at ?? 1)}`;
    return `${when}, ${now}${noise}`;
  }

  if (beta.source === 'state') return `While ${stateText(beta).while}, ${enhance ? 'it ' : ''}${does}${noise}`;

  if (beta.source === 'sequence') {
    const each = beta.reach === 'adjacent' ? `${matchText(beta)} next to it, above or below` : `${matchText(beta)} above it whose Hook went off this turn`;
    if (beta.shape === 'whileTrue') {
      const cond = beta.reach === 'adjacent' ? `it's next to a ${matchText(beta)}` : `a ${matchText(beta)} above it has had its Hook go off this turn`;
      return `While ${cond}, ${enhance ? 'it ' : ''}${does}${noise}`;
    }
    const most = beta.shape === 'graded' ? ` (${gradedCap(effect, beta.cap, enhance)})` : '';
    return enhance ? `${cap(does)} for each ${each}${most}${noise}` : `For each ${each}, ${does}${most}${noise}`;
  }

  // Counting Hooks: cards and progress.
  if (beta.source === 'progress' && beta.metric === 'fires') {
    const every = beta.per === 1 ? 'Every time it fires' : `Every ${ordinal(beta.per)} time it fires`;
    return `${every}, ${enhance ? 'it ' : ''}${does}${noise}`;
  }
  const events = counted(beta, piece.archetype);
  if (beta.shape === 'graded') {
    if (beta.cap === 1) return enhance ? `${cap(does)} if ${events.clause(1)} ${since}${noise}` : `If ${events.clause(1)} ${since}, ${does}${noise}`;
    const forEach = beta.source === 'progress' && beta.per > 1 ? 'every' : 'each';
    const most = gradedCap(effect, beta.cap, enhance);
    return enhance
      ? `${cap(does)} for ${forEach} ${events.noun} ${since} (${most})${noise}`
      : `For ${forEach} ${events.noun} ${since}, ${does} (${most})${noise}`;
  }
  if (beta.shape === 'stepped') {
    // Points carry over toward the next step, and the Hook waits for its
    // next fire (session 61: "since it last fired" misread as a reset).
    if (beta.at === 1 && beta.source === 'progress' && beta.metric === 'points') {
      return `Every ${beta.per} points you score, its next fire ${enhance ? does : `also ${thirdPerson(describeEffect(effect as Effect, thresholds))}`}${noise}`;
    }
    if (beta.at === 1) return enhance ? `${cap(does)} if ${events.clause(1)} ${since}${noise}` : `If ${events.clause(1)} ${since}, ${does}${noise}`;
    return `Once ${events.clause(beta.at)} since its Hook last went off, ${enhance ? 'it ' : ''}${does}${noise}`;
  }
  return `${cap(does)}${noise}`;
}

// ---------------------------------------------------------------------
// Everything else
// ---------------------------------------------------------------------

/** A suit marked in text: renders as the suit's icon and name (RichText). */
export const suitToken = (suit: number) => `[[suit:${suit}]]`;

/** Text with its suit tokens spelled out, for plain-text places (hover
 * tips). */
export function plainText(text: string): string {
  return text.replace(/\[\[suit:([0-3])\]\]/g, (_, s) => suitInfo(Number(s) as 0 | 1 | 2 | 3).name);
}

/** An enemy subroutine's alarm (`heatPressure`), or null for none. */
export function describeAlarm(piece: SubroutineDefinition): string | null {
  return piece.heatPressure ? `+${fmt(piece.heatPressure)} Heat to you each time it fires` : null;
}

/** The live-state line in a subroutine's detail panel. */
export function describeState(piece: SubroutineDefinition, state: SubroutineRuntimeState): string[] {
  const lines: string[] = [];
  if (piece.beta && (piece.beta.source === 'cards' || piece.beta.source === 'progress')) lines.push(`Hook count: ${fmt(state.charges)}`);
  if (piece.alpha.growth) lines.push(`grown ${fmt(state.growthTotal)} of ${fmt(piece.alpha.growthCap ?? 0)}`);
  if (state.fireCount > 0) lines.push(`fired ${state.fireCount}×`);
  if (state.cooldownRemaining > 0) lines.push(`cooling down: ${fmt(state.cooldownRemaining)} points to go`);
  return lines;
}

/**
 * Text written from the player's side ("your Ward", "you've scored")
 * re-voiced for an enemy subroutine ("its Ward", "it's scored"). One
 * pass, so a swap is never swapped back: the gauges trade names too --
 * their Containment is your Breach.
 */
const ENEMY_VOICE: Record<string, string> = {
  "you've": "it's",
  "you're": "it's",
  'you score': 'it scores',
  'you play': 'it plays',
  'you deal': 'it deals',
  'you become': 'it becomes',
  'you stop': 'it stops',
  'you choose yours': 'it chooses its own',
  'your Breach': 'its Containment',
  'their Containment': 'your Breach',
  'your turns': 'its turns',
  your: 'its',
  their: 'your',
  they: 'you',
  them: 'you',
  'the opponent has': "you've",
  'the opponent': 'you',
};
const ENEMY_PATTERN = new RegExp(
  `\\b(${Object.keys(ENEMY_VOICE)
    .sort((a, b) => b.length - a.length)
    .join('|')})\\b`,
  'g',
);
export function forEnemy(text: string): string {
  return text.replace(ENEMY_PATTERN, (m) => ENEMY_VOICE[m]);
}

/** One running-log line for a fire. */
export function describeFire(event: FireEvent, name: string): string {
  const alpha = describeEffect(event.alpha);
  // An immediate Hook fires outside the turn; the log says so in words
  // (the user's call: no ⚡ glyph, which phones draw as an emoji).
  const hookName = event.immediate ? 'instant Hook' : 'Hook';
  const hook = event.beta ? `; ${hookName}: ${describeEffect(event.beta)}` : event.elevated ? ` (${hookName})` : '';
  const line = `${name}: ${alpha}${hook}`;
  return event.side === 1 ? forEnemy(line) : line;
}

// ---------------------------------------------------------------------
// The glossary (R11)
// ---------------------------------------------------------------------

/** One-line definitions of the game's terms, in a neutral voice (they
 * read the same for either side). */
const GLOSSARY: { term: string; test: RegExp; text: string }[] = [
  { term: 'Credit', test: /\bCredit/, text: "fills its owner's win gauge (your Breach, their Containment); a full gauge wins the fight. Ward absorbs it first, unless it ignores Ward." },
  { term: 'Suppress', test: /\bSuppress/, text: "pushes the other side's win gauge back." },
  { term: 'Ward', test: /\bWard/, text: "a shield that absorbs the other side's Credit until it's used up." },
  { term: 'Empower', test: /\bEmpower/, text: 'makes a Process bigger for the rest of this turn, if it Credits, Suppresses or Wards; anything else ignores it.' },
  {
    term: 'Extra count',
    test: /extra counts?\b|Hook count|loses \d+ counts?/,
    text: "one more count toward a Hook, as if its event happened once more. A Hook that goes off on a single event goes off; one waiting for 3 gets one closer; Hooks that check a condition ('while…') ignore it, and a subroutine's extra counts don't reach Instant Hooks.",
  },
  { term: 'Initiative', test: /initiative/, text: `fills as the fight goes on; each time it reaches its threshold (usually ${GAUGE_THRESHOLD}) that side takes a turn, and every one of its subroutines fires.` },
  { term: 'Heat', test: /\bHeat\b/, text: "the layer's alarm level: map moves, fights and some enemies add to it. Reach the layer's limit and you're caught; clearing the layer resets it." },
  { term: 'Instant', test: /\bInstant\b/, text: 'goes off the moment it happens, even in the middle of a hand, without waiting for a turn.' },
];

/** The glossary lines for the terms `texts` use. */
export function glossaryFor(...texts: string[]): { term: string; text: string }[] {
  const all = texts.join('\n');
  return GLOSSARY.filter((g) => g.test.test(all)).map(({ term, text }) => ({ term, text }));
}
