import { describe, expect, it } from 'vitest';
import { KEY_FILES, SOUNDS, pickFile, pickKeys } from './sound';

// Go-live step 4: the card sounds are keystrokes, never the same twice in a row.
describe('the card sounds', () => {
  it('are the first ten recorded keys, shared by both sides', () => {
    expect(KEY_FILES).toHaveLength(10);
    expect(SOUNDS.cardYou).toMatchObject({ files: KEY_FILES, group: 'cards' });
    expect(SOUNDS.cardThem).toMatchObject({ files: KEY_FILES, group: 'cards' });
  });

  it('never play the same key twice in a row', () => {
    let last: string | undefined;
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const next = pickFile(KEY_FILES, last);
      expect(next).not.toBe(last);
      seen.add(next);
      last = next;
    }
    expect(seen.size).toBe(10);
    // With one file there's nothing else to pick.
    expect(pickFile(['a'], 'a')).toBe('a');
  });

  it('now and then double-tap: two different keys, about one card in eight', () => {
    const double = (SOUNDS.cardYou as { double: { chance: number; gapMs: [number, number]; gain: number } }).double;
    let doubles = 0;
    let last: string | undefined;
    for (let i = 0; i < 8000; i++) {
      const keys = pickKeys(KEY_FILES, last, double);
      expect(keys[0]).not.toBe(last);
      if (keys.length === 2) {
        doubles++;
        expect(keys[1]).not.toBe(keys[0]);
      }
      last = keys[keys.length - 1];
    }
    expect(doubles / 8000).toBeGreaterThan(0.1);
    expect(doubles / 8000).toBeLessThan(0.15);
    expect(pickKeys(KEY_FILES, undefined, undefined)).toHaveLength(1);
  });
});
