import { describe, it, expect, beforeEach } from 'vitest';
import { tips, TIP_TEXT } from './tips.svelte';

// Session 63 (docs/design/tutorial.md T6): first-time tips, once each.
describe('first-time tips', () => {
  beforeEach(() => tips.reset());

  it('shows an offered tip, one at a time, in the order offered', () => {
    tips.offer('elite');
    tips.offer('event');
    expect(tips.current).toBe('elite');
    tips.dismiss();
    expect(tips.current).toBe('event');
    tips.dismiss();
    expect(tips.current).toBeNull();
  });

  it('never shows a tip again once dismissed, nor queues it twice', () => {
    tips.offer('heat');
    tips.offer('heat');
    tips.dismiss();
    expect(tips.current).toBeNull();
    tips.offer('heat');
    expect(tips.current).toBeNull();
  });

  it('"show tips again" brings them all back', () => {
    tips.offer('cache');
    tips.dismiss();
    tips.reset();
    tips.offer('cache');
    expect(tips.current).toBe('cache');
  });

  it('has text for every tip', () => {
    for (const text of Object.values(TIP_TEXT)) expect(text.length).toBeGreaterThan(20);
  });
});
