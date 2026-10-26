import { describe, expect, it } from 'vitest';
import { KEY_FILES, SOUNDS, pickFile } from './sound';

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
});
