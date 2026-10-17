import type { Alpha, Beta, BetaEffect, Effect, SubroutineDefinition } from '../engine/subroutine-types';
import type { SubroutineRuntimeState } from '../engine/triggers';
import type { FireEvent } from '../engine/resolve';

/**
 * Plain-language text for pieces and fires (milestone 2). Players see
 * "Process" (the alpha, every turn) and "Hook" (the beta, when its
 * condition is met) -- P7 of docs/playable-design.md. Display only: the
 * engine keeps alpha/beta.
 */

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));
const turnFraction = (n: number) => {
  const known: Record<string, string> = { '0.125': '⅛', '0.25': '¼', '0.375': '⅜', '0.5': '½', '0.75': '¾', '0.0625': '1/16' };
  return known[String(n)] ?? fmt(n);
};

export function describeEffect(effect: Effect): string {
  const trace = effect.trace ? `, +${fmt(effect.trace)} Trace` : '';
  switch (effect.verb) {
    case 'credit':
      if (effect.from === 'opponent') return `steal ${fmt(effect.amount)}${trace}`;
      if (effect.from === 'ward') return `Credit ${fmt(effect.amount)} from your Ward${trace}`;
      return `Credit ${fmt(effect.amount)}${effect.piercing ? ' (piercing)' : ''}${trace}`;
    case 'suppress':
      return `Suppress ${fmt(effect.amount)}${trace}`;
    case 'ward':
      return `Ward ${fmt(effect.amount)}${trace}`;
    case 'empower':
      return `Empower ${effect.scope === 'next' ? 'the next piece' : 'every piece below'} +${fmt(effect.amount)}${trace}`;
    case 'tempo': {
      const who = effect.target === 'own' ? 'you' : 'them';
      if (effect.mode === 'gauge') return effect.target === 'own' ? `Haste ${turnFraction(effect.amount)} turn${trace}` : `Slow them ${turnFraction(effect.amount)} turn${trace}`;
      return `${effect.target === 'own' ? 'lower' : 'raise'} ${who === 'you' ? 'your' : 'their'} initiative threshold ${turnFraction(effect.amount)}${effect.duration ? ` for ${effect.duration} turn${effect.duration > 1 ? 's' : ''}` : ''}${trace}`;
    }
    case 'disrupt':
      return { revealHand: 'reveal their hand next hand', revealCrib: 'reveal the crib next hand', forceDiscard: 'force a discard next hand' }[effect.action] + trace;
    case 'charge':
      return `charge ${effect.target === 'self' ? 'itself' : effect.target === 'next' ? 'the next piece' : 'every other piece'} ${fmt(effect.amount)}${trace}`;
  }
}

export function describeProcess(alpha: Alpha): string {
  const base = describeEffect(alpha as Effect);
  return alpha.growth ? `${base}, +${fmt(alpha.growth)} each fire (up to +${fmt(alpha.growthCap ?? 0)})` : base;
}

function describeHookEffect(effect: BetaEffect, shape: Beta['shape']): string {
  if (effect.verb === 'enhance') {
    if (shape === 'immediate') return effect.amount === 0 ? 'fire again' : `fire again, +${fmt(effect.amount)}`;
    return `+${fmt(effect.amount)}${effect.trace ? `, +${fmt(effect.trace)} Trace` : ''}`;
  }
  return describeEffect(effect);
}

const CATEGORY: Record<string, string> = {
  fifteen: 'fifteen',
  pair: 'pair',
  run: 'run',
  flush: 'flush',
  hisNobs: 'nobs',
  thirtyOne: '31',
  go: 'go',
};

function describeCondition(beta: Beta): string {
  switch (beta.source) {
    case 'cards': {
      const who = beta.watch === 'opponent' ? 'the opponent' : beta.watch === 'either' ? 'anyone' : 'you';
      if (beta.category === 'suit') return `each card of this suit ${who === 'you' ? 'you play' : `${who} plays`}`;
      const what = CATEGORY[beta.category] ?? beta.category;
      const min = beta.minMagnitude ? ` worth ${beta.minMagnitude}+` : '';
      return `each ${what}${min} ${who === 'you' ? 'you score' : `${who} scores`}`;
    }
    case 'progress':
      return beta.metric === 'points'
        ? `every ${beta.per} points you score`
        : beta.metric === 'fires'
          ? `every ${beta.per === 1 ? '' : `${beta.per}${beta.per === 2 ? 'nd' : beta.per === 3 ? 'rd' : 'th'} `}fire`
          : `every ${beta.per} Ward absorbed`;
    case 'state': {
      const c = beta.condition;
      switch (c.kind) {
        case 'dealer':
          return 'while you deal';
        case 'nonDealer':
          return "while you don't deal";
        case 'wardAbove':
          return `while your Ward is over ${c.amount}`;
        case 'ownGaugeAbove':
          return `while your win gauge is over ${turnFraction(c.fraction)}`;
        case 'ownGaugeBelow':
          return `while your win gauge is under ${turnFraction(c.fraction)}`;
        case 'opponentGaugeAbove':
          return `while their win gauge is over ${turnFraction(c.fraction)}`;
        case 'opponentGaugeBelow':
          return `while their win gauge is under ${turnFraction(c.fraction)}`;
        case 'handPointsAtLeast':
          return `while you've scored ${c.amount}+ this hand`;
      }
      return '';
    }
    case 'sequence':
      return beta.reach === 'adjacent' ? 'for each matching neighbour' : 'for each earlier matching piece that hooked this turn';
  }
}

export function describeHook(beta: Beta): string {
  const condition = describeCondition(beta);
  const effect = describeHookEffect(beta.effect, beta.shape);
  switch (beta.shape) {
    case 'graded':
      return `${condition}: ${effect} (up to ${beta.cap})`;
    case 'stepped':
      return beta.at > 1 ? `after ${beta.at}× ${condition}: ${effect}` : `${condition}: ${effect}`;
    case 'immediate':
      return `instant (outside the turn) · the moment ${condition.replace(/^each /, 'a ').replace(/^while /, '')}${beta.at && beta.at > 1 ? ` (×${beta.at})` : ''}: ${effect}`;
    case 'whileTrue':
      return `${condition}: ${effect}`;
  }
}

/** The live-state line in a piece's detail panel. */
export function describeState(piece: SubroutineDefinition, state: SubroutineRuntimeState): string[] {
  const lines: string[] = [];
  if (piece.beta && (piece.beta.source === 'cards' || piece.beta.source === 'progress')) lines.push(`${fmt(state.charges)} charge${state.charges === 1 ? '' : 's'} banked`);
  if (piece.alpha.growth) lines.push(`growth +${fmt(state.growthTotal)} of +${fmt(piece.alpha.growthCap ?? 0)}`);
  if (state.fireCount > 0) lines.push(`fired ${state.fireCount}×`);
  if (state.cooldownRemaining > 0) lines.push(`cooling down: ${fmt(state.cooldownRemaining)} points to go`);
  return lines;
}

/** Text written from the player's side ("your Ward", "you score")
 * re-voiced for an enemy piece ("its Ward", "it scores"). */
export function forEnemy(text: string): string {
  return text
    .replace(/\byou've\b/g, "it's")
    .replace(/\byou score\b/g, 'it scores')
    .replace(/\byou play\b/g, 'it plays')
    .replace(/\byou deal\b/g, 'it deals')
    .replace(/\byour\b/g, 'its')
    .replace(/\btheir\b/g, 'your')
    .replace(/\bthe opponent\b/g, 'you')
    .replace(/\bSlow them\b/g, 'Slow you');
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
