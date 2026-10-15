import { describe, it, expect } from 'vitest';
import { creditPiece, mirrorWinRate, priceAddition, refinedPrice, type MirrorOptions } from './pricing';

// The pricing instrument's own guarantees (step 2, R1/R2). Uses the fast
// baseline strategies (skill undefined) so the suite stays quick; the real
// runs use skill 0.85 through scripts/price-check.ts.

const FAST: MirrorOptions = { seeds: 60, gaugeThreshold: 12, winThreshold: 50 };

describe('mirrorWinRate', () => {
  it('scores two identical loadouts at EXACTLY 0.5 -- the seat swap cancels both seat biases', () => {
    // Played in both seats, an identical pair is the same fight mirrored:
    // one win each per seed, whatever the defender/dealer biases are.
    const host = [creditPiece(2)];
    expect(mirrorWinRate(host, host, FAST).winRate).toBe(0.5);
    const two = [creditPiece(1), creditPiece(3)];
    expect(mirrorWinRate(two, two, FAST).winRate).toBe(0.5);
  });

  it('favours the stronger side', () => {
    expect(mirrorWinRate([creditPiece(3)], [creditPiece(2)], FAST).winRate).toBeGreaterThan(0.5);
    expect(mirrorWinRate([creditPiece(2)], [creditPiece(3)], FAST).winRate).toBeLessThan(0.5);
  });

  it('plays 2 x seeds fights and reports a binomial standard error', () => {
    const result = mirrorWinRate([creditPiece(3)], [creditPiece(2)], FAST);
    expect(result.fights).toBe(2 * FAST.seeds);
    expect(result.se).toBeCloseTo(Math.sqrt((result.winRate * (1 - result.winRate)) / result.fights));
  });
});

describe('priceAddition -- the instrument check (R2)', () => {
  it('wiring: with c ON the grid, Credit c ties exactly at c -- identical loadouts tie by construction', () => {
    // NOT a measurement check, and labelled so: at Δ = c the two sides are
    // the same loadout, so the seat-swapped duel is exactly 0.5. It proves
    // the sign, the seat swap and the solver are wired correctly.
    const result = priceAddition([creditPiece(2)], creditPiece(2), [0, 1, 2, 3, 4], FAST);
    expect(result.curve.find((c) => c.delta === 2)!.winRate).toBe(0.5);
    expect(result.low!).toBeLessThanOrEqual(2);
    expect(result.high!).toBeGreaterThanOrEqual(2);
  });

  it('the curve is a staircase: Credit values needing the same turns-to-win tie EXACTLY (session 52)', () => {
    // A pure-Credit race is decided by how many turns each side needs; at
    // a host of 2, Credit 1.6 and 1.75 both need the same number, so the
    // duel is a mirror and scores exactly 0.5 -- not merely close.
    const opts = { ...FAST, seeds: 40 };
    expect(priceAddition([creditPiece(2)], creditPiece(1.75), [1.6], opts).curve[0].winRate).toBe(0.5);
  });

  it('prices a flat 0.5 step at its midpoint', () => {
    // At c = 1.75, every Δ in roughly [1.5, 1.75] ties; the midpoint is the
    // honest estimate, and c must sit inside the reported interval.
    const result = priceAddition([creditPiece(2)], creditPiece(1.75), [0, 1, 1.5, 1.75, 2, 2.5, 3, 4], FAST);
    expect(result.price!).toBeGreaterThan(1.5);
    expect(result.price!).toBeLessThanOrEqual(1.75);
  });

  it('resolution: an OFF-grid Credit c prices near c, inside its interval', () => {
    // The real check Credit can support: c = 1.75 is not a grid point, so
    // this measures interpolation error plus noise. Validity across
    // different verbs (do prices add up?) is checkpoint 3's.
    const result = priceAddition([creditPiece(2)], creditPiece(1.75), [0, 1, 1.5, 2, 2.5, 3, 4], FAST);
    expect(result.price).not.toBeNull();
    expect(Math.abs(result.price! - 1.75)).toBeLessThan(0.5);
    expect(result.low!).toBeLessThanOrEqual(1.75);
    expect(result.high!).toBeGreaterThanOrEqual(1.75);
  });

  it('returns the whole curve, ascending, falling as the reference side gets more Credit', () => {
    const result = priceAddition([creditPiece(2)], creditPiece(2), [4, 0, 2], FAST);
    expect(result.curve.map((c) => c.delta)).toEqual([0, 2, 4]);
    expect(result.curve[0].winRate).toBeGreaterThan(result.curve[2].winRate);
  });

  it('reports no price when the grid never brackets 0.5', () => {
    // A huge addition the grid's largest Δ cannot offset.
    expect(priceAddition([creditPiece(1)], creditPiece(40), [0, 1, 2], FAST).price).toBeNull();
  });
});

describe('refinedPrice', () => {
  it('narrows the interval inside the coarse bracket, and keeps the true price inside it', () => {
    const { coarse, fine } = refinedPrice([creditPiece(2)], creditPiece(1.75), [0, 1, 2, 3, 4], FAST);
    expect(fine).not.toBeNull();
    expect(fine!.high! - fine!.low!).toBeLessThan(coarse.high! - coarse.low!);
    expect(fine!.low!).toBeLessThanOrEqual(1.75);
    expect(fine!.high!).toBeGreaterThanOrEqual(1.75);
  });

  it('returns no fine pass when the coarse grid never brackets 0.5', () => {
    expect(refinedPrice([creditPiece(1)], creditPiece(40), [0, 1, 2], FAST).fine).toBeNull();
  });
});

describe('priceAddition -- placement and multi-piece additions', () => {
  it('a two-piece addition is priced against Credit Δ padded to the same piece count', () => {
    // Credit 1 + Credit 1 is mechanically Credit 2 per turn, so the pair
    // must tie with Credit 2 (+ a Credit-0 pad) exactly.
    const result = priceAddition([creditPiece(2)], [creditPiece(1, 'a'), creditPiece(1, 'b')], [2], FAST);
    expect(result.curve[0].winRate).toBe(0.5);
  });

  it("'before' puts the addition above the host -- which is what Empower needs to boost anything", () => {
    const empower = { id: 'emp', name: 'emp', archetype: 'overclock' as const, alpha: { verb: 'empower' as const, amount: 2, scope: 'rest' as const } };
    // Below the host, Empower boosts nothing and is worth ~0; above it, it
    // adds its amount to the host's Credit every turn.
    expect(priceAddition([creditPiece(2)], empower, [0], FAST, 'after').curve[0].winRate).toBe(0.5);
    expect(priceAddition([creditPiece(2)], empower, [0], FAST, 'before').curve[0].winRate).toBeGreaterThan(0.5);
  });

  it('a numeric placement inserts the addition mid-build: Empower above one piece and below another boosts only the lower one', () => {
    const empower = { id: 'emp', name: 'emp', archetype: 'overclock' as const, alpha: { verb: 'empower' as const, amount: 2, scope: 'next' as const } };
    // [Credit 2, Empower 2, Credit 2]: the next piece gets +2, the same as
    // a Credit-2 addition at that slot.
    expect(priceAddition([creditPiece(2, 'top'), creditPiece(2, 'bottom')], empower, [2], FAST, 1).curve[0].winRate).toBe(0.5);
  });
});
