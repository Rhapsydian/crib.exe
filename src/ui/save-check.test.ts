import { beforeEach, describe, expect, it } from 'vitest';
import { checkSaves } from './save-check';
import { SAVE_KEYS, writeSave } from './run-save';
import { CRIBBAGE_SAVE_KEY } from './live-cribbage.svelte';
import { LiveRun } from './live-run.svelte';
import { profile } from './profile.svelte';

// Go-live step 2: saves an update left behind are cleared at startup and
// reported. Storage, in memory (the tests run without a browser).
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> }).localStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
};

describe('checkSaves', () => {
  beforeEach(() => store.clear());

  it('reports nothing with nothing saved', () => {
    expect(checkSaves()).toEqual({ run: false, daily: null, cribbage: false });
  });

  it('keeps a save that still loads', () => {
    writeSave(new LiveRun('exploit-overclock', 7).save);
    expect(checkSaves().run).toBe(false);
    expect(store.has(SAVE_KEYS.run)).toBe(true);
  });

  it('clears and reports a save from an older version, or one that is unreadable', () => {
    store.set(SAVE_KEYS.run, JSON.stringify({ version: 1, answers: [] }));
    store.set(CRIBBAGE_SAVE_KEY, '{not json');
    const dropped = checkSaves();
    expect(dropped.run).toBe(true);
    expect(dropped.cribbage).toBe(true);
    expect(store.has(SAVE_KEYS.run)).toBe(false);
    expect(store.has(CRIBBAGE_SAVE_KEY)).toBe(false);
  });

  it("says whether a dropped Daily was a scored attempt, and the profile releases it", () => {
    const date = '2026-10-26';
    store.set(SAVE_KEYS.daily, JSON.stringify({ version: 1, setup: { daily: { date } }, answers: [] }));
    expect(checkSaves().daily).toEqual({ date, scored: true });
    profile.startDaily(date);
    expect(profile.releaseDaily(date)).toBe(true);
    expect(profile.startDaily(date)).toBe(false); // the scored attempt again, not practice
    // A practice run's drop leaves the day as it was.
    store.set(SAVE_KEYS.daily, JSON.stringify({ version: 1, setup: { daily: { date, practice: true } }, answers: [] }));
    expect(checkSaves().daily).toEqual({ date, scored: false });
  });
});
