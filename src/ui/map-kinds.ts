import type { NodeType } from '../engine/map-types';

/** How each node type shows on the map: its symbol (text form, so phones
 * don't draw an emoji), name, colour, and a line for its info card. */
export const NODE_KIND: Record<NodeType, { glyph: string; label: string; tone: string; about: string }> = {
  regularFight: { glyph: '⚔︎', label: 'Fight', tone: 'var(--danger)', about: 'Win for a subroutine pick and Data, sometimes a Burner. Lose and the node closes for good, and costs Heat.' },
  eliteFight: { glyph: '☠︎', label: 'Elite', tone: 'var(--warn)', about: 'A tougher fight with better rewards: a stronger subroutine or a Mod (your choice), more Data, often a Burner.' },
  gatekeeperFight: { glyph: '⛨︎', label: 'Gatekeeper', tone: 'var(--danger)', about: 'The way into the next layer. Win to breach it; lose and the run ends. Its Heat toll is charged after the fight.' },
  safehouse: { glyph: '⌂︎', label: 'Safehouse', tone: 'var(--ward)', about: 'Rest to shed Heat, or Merge a duplicate into an upgrade. One or the other, once.' },
  shop: { glyph: '$', label: 'Shop', tone: 'var(--accent)', about: 'Spend Data on a subroutine, a Mod or a Burner.' },
  event: { glyph: '?', label: 'Event', tone: 'var(--mod)', about: 'A situation with choices: some safe, some a gamble.' },
  relay: { glyph: '', label: 'Relay', tone: 'var(--text-dim)', about: 'An empty junction. Passing through still costs the move.' },
  cache: { glyph: '◈', label: 'Cache', tone: 'var(--suit-honeypot)', about: 'A remote cache: a free reward, if the detour is worth the Heat.' },
};
