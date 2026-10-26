import { beforeEach, describe, expect, it } from 'vitest';
import { VERSION_NOTES, markVersionSeen, whatsNew } from './version-notes';

// Go-live step 5b: the What's new card's notes.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }).localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
};

describe('whatsNew', () => {
  beforeEach(() => store.clear());

  it('has the current version on top, newest first', () => {
    expect(VERSION_NOTES[0].version).toBe(__APP_VERSION__);
    const versions = VERSION_NOTES.map((v) => v.version);
    expect([...versions].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))).toEqual(versions);
  });

  it("shows a returning player what they haven't seen, once", () => {
    expect(whatsNew('0.9.0', false).map((v) => v.version)).toEqual(['0.9.0']);
    markVersionSeen('0.9.0');
    expect(whatsNew('0.9.0', false)).toEqual([]);
  });

  it('shows a new player nothing, and marks the version seen', () => {
    expect(whatsNew('0.9.0', true)).toEqual([]);
    expect(whatsNew('0.9.0', false)).toEqual([]);
  });
});
