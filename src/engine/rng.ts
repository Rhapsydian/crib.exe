export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

/**
 * mulberry32 — small, fast, deterministic PRNG. Not cryptographic; fine
 * for reproducible game simulation, which is the whole point here.
 */
/** Derives a second, decorrelated seed from a base seed -- used to give
 * AI-decision noise (session 26, skill-dial range expansion) its own
 * independent Rng stream, separate from whatever `createRng(seed)`
 * already drives (deck shuffles, cuts). Sharing one stream between
 * "world" randomness and AI-decision randomness would mean any change
 * to how often the AI rolls dice shifts every subsequent shuffle/cut
 * draw too -- this keeps them fully decoupled while staying
 * deterministic per base seed. Simple golden-ratio XOR mix, not
 * cryptographic; only needs to decorrelate, not resist attack. */
export function deriveAiNoiseSeed(seed: number): number {
  return (seed ^ 0x9e3779b9) >>> 0;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;

  function next(): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    nextInt(maxExclusive: number) {
      return Math.floor(next() * maxExclusive);
    },
  };
}
