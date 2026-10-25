import type { NodeType } from '../engine/map-types';

/**
 * Line icons for map nodes (session 72, the user's picks): path data from
 * Tabler Icons 3.19.0 (https://tabler.io/icons), MIT License, Copyright
 * (c) 2020-2024 Paweł Kuna. Drawn on a 24x24 grid, stroked, unfilled.
 */
export const NODE_ICONS = {
  robot: ['M6 4m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v4a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z', 'M12 2v2', 'M9 12v9', 'M15 12v9', 'M5 16l4 -2', 'M15 14l4 2', 'M9 18h6', 'M10 8v.01', 'M14 8v.01'],
  skull: ['M12 4c4.418 0 8 3.358 8 7.5c0 1.901 -.755 3.637 -2 4.96l0 2.54a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1v-2.54c-1.245 -1.322 -2 -3.058 -2 -4.96c0 -4.142 3.582 -7.5 8 -7.5z', 'M10 17v3', 'M14 17v3', 'M9 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M15 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0'],
  wall: ['M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z', 'M4 8h16', 'M20 12h-16', 'M4 16h16', 'M9 4v4', 'M14 8v4', 'M8 12v4', 'M16 12v4', 'M11 16v4'],
  eyeOff: ['M10.585 10.587a2 2 0 0 0 2.829 2.828', 'M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87', 'M3 3l18 18'],
  messageQuestion: ['M8 9h8', 'M8 13h6', 'M14 18h-1l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v4.5', 'M19 22v.01', 'M19 19a2.003 2.003 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483'],
  floppy: ['M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2', 'M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M14 4l0 4l-6 0l0 -4'],
  /** On deck for the Quiet Host (the user: keep it in case of a switch). */
  coffee: ['M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1', 'M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2', 'M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2', 'M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z', 'M16.746 16.726a3 3 0 1 0 .252 -5.555'],
} as const satisfies Record<string, readonly string[]>;

/** How each node type shows on the map: a line icon where it has one
 * (NODE_ICONS), else a text symbol (text form, so phones don't draw an
 * emoji); its name, colour, and a line for its info card. */
export const NODE_KIND: Record<NodeType, { glyph: string; icon?: readonly string[]; label: string; tone: string; about: string }> = {
  regularFight: { glyph: '⚔︎', icon: NODE_ICONS.robot, label: 'Fight', tone: 'var(--danger)', about: 'Win for a subroutine pick and Data, sometimes a Burner. Lose and the node closes for good, and costs Heat.' },
  eliteFight: { glyph: '☠︎', icon: NODE_ICONS.skull, label: 'Elite', tone: 'var(--warn)', about: 'A tougher fight with better rewards: a stronger subroutine or a Mod (your choice), more Data, often a Burner.' },
  gatekeeperFight: { glyph: '⛨︎', icon: NODE_ICONS.wall, label: 'Gatekeeper', tone: 'var(--danger)', about: 'The way into the next layer. Win to breach it; lose and the run ends. Its Heat toll is charged after the fight; if that maxes your Heat, you must evade its trace.' },
  safehouse: { glyph: '⌂︎', icon: NODE_ICONS.eyeOff, label: 'Safehouse', tone: 'var(--ward)', about: 'Rest to shed Heat, or Merge a duplicate into an upgrade. One or the other, once.' },
  shop: { glyph: '$', label: 'Shop', tone: 'var(--accent)', about: 'Spend Data on a subroutine, a Mod or a Burner.' },
  event: { glyph: '?', icon: NODE_ICONS.messageQuestion, label: 'Event', tone: 'var(--mod)', about: 'A situation with choices: some safe, some a gamble.' },
  relay: { glyph: '', label: 'Relay', tone: 'var(--text-dim)', about: 'An empty junction. Passing through still costs the move.' },
  cache: { glyph: '◈', icon: NODE_ICONS.floppy, label: 'Cache', tone: 'var(--cache)', about: 'A remote cache: a free reward, if the detour is worth the Heat.' },
};
