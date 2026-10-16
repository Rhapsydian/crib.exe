import type { Suit } from '../engine/cards';
import type { Archetype } from '../engine/subroutine-types';
import { SUIT_ARCHETYPES, ARCHETYPE_SUITS } from '../engine/subroutine-types';

/** Display data for each suit, which IS its archetype (DESIGN.md
 * Theming): name, colour token, and which icon to draw. */
export interface SuitInfo {
  archetype: Archetype;
  name: string;
  color: string;
}

const NAMES: Record<Archetype, string> = { exploit: 'Exploit', daemon: 'Daemon', overclock: 'Overclock', honeypot: 'Honeypot' };

export function suitInfo(suit: Suit): SuitInfo {
  const archetype = SUIT_ARCHETYPES[suit];
  return { archetype, name: NAMES[archetype], color: `var(--suit-${archetype})` };
}

export function archetypeInfo(archetype: Archetype): SuitInfo {
  return suitInfo(ARCHETYPE_SUITS[archetype]);
}

export function rankLabel(rank: number): string {
  return rank === 1 ? 'A' : rank === 11 ? 'J' : rank === 12 ? 'Q' : rank === 13 ? 'K' : String(rank);
}
