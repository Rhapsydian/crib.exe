import { describe, it, expect, beforeEach } from 'vitest';
import { guide, GUIDE_TEXT } from './guide.svelte';
import { tips } from './tips.svelte';

// Session 63 (docs/tutorial-design.md T1, T5): the tutorial coach.
describe('the tutorial coach', () => {
  beforeEach(() => guide.stop());

  it('says nothing outside the guided run', () => {
    guide.offer('map');
    expect(guide.current).toBeNull();
  });

  it('explains each step once per guided run, one at a time, in the order they happen', () => {
    guide.start();
    guide.offer('map');
    guide.offer('class');
    guide.offer('map');
    expect(guide.current).toBe('map');
    guide.dismiss();
    expect(guide.current).toBe('class');
    guide.dismiss();
    expect(guide.current).toBeNull();
    guide.offer('map');
    expect(guide.current).toBeNull();
  });

  it('starts fresh with each guided run', () => {
    guide.start();
    guide.offer('shop');
    guide.dismiss();
    guide.start();
    guide.offer('shop');
    expect(guide.current).toBe('shop');
  });

  it('has text for every step, and points out both Safehouse options (the user\'s ask)', () => {
    for (const text of Object.values(GUIDE_TEXT)) expect(text.length).toBeGreaterThan(20);
    expect(GUIDE_TEXT.safehouse).toMatch(/Rest to lower your Heat/);
    expect(GUIDE_TEXT.safehouse).toMatch(/Merge/);
  });

  it('holds the first-time tips back while suspended', () => {
    tips.reset();
    tips.suspended = true;
    tips.offer('elite');
    expect(tips.current).toBeNull();
    tips.suspended = false;
  });
});
