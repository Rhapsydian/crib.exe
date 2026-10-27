import type { EventChoice, EventEffect, Grant } from '../engine/event-types';
import { eventHeat } from '../engine/heat';
import { upgradedDefinition, MERGE_RANK_CAP } from '../engine/merge';
import type { SubroutineDefinition } from '../engine/subroutine-types';
import { pieceLines } from './reward-text';

/**
 * Words for the non-fight nodes (milestone 3 checkpoint 4): what an
 * Event's choices can do, and what a Merge would change.
 */

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function grantText<T extends { name: string }>(grant: Grant<T>, kind: string): string {
  return 'specific' in grant ? grant.specific.name : `a random ${grant.randomFromRarity} ${kind}`;
}

/** An Event effect as a list of short phrases ("+20 Data", "+9 Heat",
 * "a random rare Mod", "a fight (elite)"). `layer` is 1-based. */
export function effectPhrases(effect: EventEffect, layer: number): string[] {
  const out: string[] = [];
  if (effect.dataDelta) out.push(`${effect.dataDelta > 0 ? '+' : ''}${effect.dataDelta} Data`);
  if (effect.heatLosses) {
    const heat = eventHeat(effect.heatLosses, layer - 1);
    out.push(`${heat > 0 ? '+' : '−'}${fmt(Math.abs(heat))} Heat`);
  }
  if (effect.subroutineGrant) out.push(grantText(effect.subroutineGrant, 'subroutine'));
  if (effect.modGrant) out.push(grantText(effect.modGrant, 'Mod'));
  if (effect.burnerGrant) out.push('contraband' in effect.burnerGrant ? 'a contraband Burner' : grantText(effect.burnerGrant, 'Burner'));
  if (effect.bonusFight) out.push(`a fight (${effect.bonusFight.tier})`);
  if (effect.classModUpgrade) out.push('your class Mod upgraded to II');
  return out.length ? out : ['nothing'];
}

/** How an outcome reads (v0.9.1, the roll animation's colours and settle
 * sound): good if it only gains (Data, a grant, cooler Heat), bad if it
 * only costs (Heat, Data, a fight) or does nothing, mixed if both. */
export type OutcomeTone = 'good' | 'bad' | 'mixed';
export function outcomeTone(effect: EventEffect): OutcomeTone {
  const gains = (effect.dataDelta ?? 0) > 0 || (effect.heatLosses ?? 0) < 0 || Boolean(effect.subroutineGrant || effect.modGrant || effect.burnerGrant || effect.classModUpgrade);
  const costs = (effect.dataDelta ?? 0) < 0 || (effect.heatLosses ?? 0) > 0 || Boolean(effect.bonusFight);
  return gains && costs ? 'mixed' : gains ? 'good' : 'bad';
}

/** What a choice can lead to, as far as the player is told: a sure
 * outcome in full, visible odds with each chance, a gamble as unknown. */
export function choiceOutcomes(choice: EventChoice, layer: number): string[] {
  if (choice.riskTier === 'gamble') return ['Outcome unknown: a gamble.'];
  if (choice.outcomes.length === 1) return [effectPhrases(choice.outcomes[0].effect, layer).join(', ')];
  return choice.outcomes.map((o) => `${Math.round(o.probability * 100)}%: ${effectPhrases(o.effect, layer).join(', ')}`);
}

/** A piece's lines before and after `ranks` Merge ranks, only those that
 * change. */
export function mergeChange(piece: SubroutineDefinition, ranks = 1): { before: string; after: string }[] {
  const before = pieceLines(piece);
  let upgraded = piece;
  for (let i = 0; i < ranks; i++) upgraded = upgradedDefinition(upgraded);
  const after = pieceLines(upgraded);
  return after.map((line, i) => ({ before: before[i] ?? '', after: line })).filter((c) => c.before !== c.after);
}

export { MERGE_RANK_CAP };

/** A Merge rank as a short mark ("II"), empty at rank 0. */
export function rankMark(rank: number | undefined): string {
  return ['', 'I', 'II', 'III', 'IV', 'V'][rank ?? 0] ?? `${rank}`;
}
