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

  it("drops a screen's leftover cards when it's left, to show again next time (the user's report)", () => {
    guide.start();
    guide.enter('reward');
    guide.offer('won');
    guide.offer('reward'); // waits behind "Breached!"
    expect(guide.current).toBe('won');
    // The player picks a reward without "got it", and moves on.
    guide.enter('map');
    expect(guide.current).toBeNull();
    guide.enter('fight');
    guide.offer('fight');
    expect(guide.current).toBe('fight'); // not the reward card
    guide.dismiss();
    expect(guide.current).toBeNull();
    // The next reward screen explains rewards after all.
    guide.enter('reward');
    guide.offer('won');
    guide.offer('reward');
    expect(guide.current).toBe('won');
    guide.dismiss();
    expect(guide.current).toBe('reward');
    guide.stop();
  });

  it('starts fresh with each guided run', () => {
    guide.start();
    guide.offer('shop');
    guide.dismiss();
    guide.start();
    guide.offer('shop');
    expect(guide.current).toBe('shop');
  });

  it('has text for every step, and points out both Quiet Host options (the user\'s ask)', () => {
    for (const text of Object.values(GUIDE_TEXT)) expect(text.length).toBeGreaterThan(20);
    expect(GUIDE_TEXT.safehouse).toMatch(/Rest to lower your Heat/);
    // v0.9.1 (the Tutorial smoke test): Flash Drive's amount is the Burner's own.
    expect(GUIDE_TEXT.burner).toContain('Flash Drive Credits 10 at once.');
    expect(GUIDE_TEXT.safehouse).toMatch(/Refactor/);
  });

  it('starts each guided run with the Cribbage coach off and its suggestions on (T3)', () => {
    guide.start();
    expect(guide.cribbageCoach).toBe(false);
    expect(guide.cribbageHints).toBe(true);
    guide.cribbageCoach = true;
    guide.cribbageHints = false;
    guide.start();
    expect(guide.cribbageCoach).toBe(false);
    expect(guide.cribbageHints).toBe(true);
  });

  it('holds the first-time tips back while suspended', () => {
    tips.reset();
    tips.suspended = true;
    tips.offer('elite');
    expect(tips.current).toBeNull();
    tips.suspended = false;
  });
});
