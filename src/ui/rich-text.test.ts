import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import RichText, { suitToken } from './RichText.svelte';
import { keepScore } from './coach';
import type { Card, Rank, Suit } from '../engine/cards';
import { suitInfo } from './suits';

// The user's ask: a suit's icon before its name (mostly flushes).
describe('RichText', () => {
  it('renders a suit token as the icon then the name, inline', () => {
    const html = render(RichText, { props: { text: `a ${suitToken(2)} flush for 4` } }).body.replace(/<!--[^>]*-->/g, '');
    expect(html).toMatch(/a <span class="suit[^"]*"><svg[^>]*aria-label="overclock"[\s\S]*<\/svg>Overclock<\/span> flush for 4/);
  });

  it("the coach's flush names its suit with a token", () => {
    const c = (rank: number, suit: number): Card => ({ rank: rank as Rank, suit: suit as Suit });
    const { parts } = keepScore([c(2, 2), c(4, 2), c(8, 2), c(12, 2)]);
    // "an" before a vowel (the user's catch): an Overclock / an Exploit
    // flush, a Daemon / a Honeypot flush.
    const flush = (suit: number) => keepScore([c(2, suit), c(4, suit), c(8, suit), c(12, suit)]).parts.find((p) => p.includes('flush'));
    const names = [0, 1, 2, 3].map((suit) => flush(suit)!.split(' ')[0] + ' ' + suitInfo(suit as Suit).name);
    expect(names.sort()).toEqual(['a Daemon', 'a Honeypot', 'an Exploit', 'an Overclock']);
    expect(parts).toContain(`an ${suitToken(2)} flush for 4`);
  });
});
