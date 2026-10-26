import { describe, expect, it } from 'vitest';
import { CODE_PREFIX, decodeProgress, encodeProgress, progressSummary } from './progress-code';
import { freshProfile } from './profile.svelte';

// Go-live step 3: progress as a copy-and-paste code.
describe('progress codes', () => {
  const payload = { profile: { ...freshProfile(), rep: 340, classes: ['exploit-overclock', 'exploit-honeypot'] as never, runsFinished: 9, victories: 2 }, lessons: ['basics', 'fifteens'] };

  it('round-trips the profile and lessons', async () => {
    const code = await encodeProgress(payload);
    expect(code.startsWith(CODE_PREFIX)).toBe(true);
    expect(await decodeProgress(code)).toEqual(payload);
    // Spaces and line breaks from a paste don't matter.
    expect(await decodeProgress(`  ${code.slice(0, 20)}\n${code.slice(20)} `)).toEqual(payload);
  });

  it('catches a typo, a stranger, and a code from an older profile', async () => {
    const code = await encodeProgress(payload);
    const typo = code.slice(0, 15) + (code[15] === 'A' ? 'B' : 'A') + code.slice(16);
    expect(await decodeProgress(typo)).toHaveProperty('error');
    expect(await decodeProgress('hello')).toHaveProperty('error');
    // An older profile, missing newer fields, is brought forward.
    const old = await encodeProgress({ profile: { version: 0, rep: 12 } as never, lessons: [] });
    const decoded = await decodeProgress(old);
    expect(decoded).toMatchObject({ profile: { rep: 12, classes: ['exploit-overclock'], daily: {} } });
  });

  it('summarises what a code holds', () => {
    expect(progressSummary(payload)).toBe('Rep 340 · 2 classes · 9 runs finished · 2 victories · 0 Daily Runs · 2 lessons');
  });
});
