import type { PlayerIndex } from './pegging';
import type { ClassId } from './classes';
import type { GatekeeperModId } from './gatekeeper-mods';
import type { SubroutineDefinition } from './subroutine-types';
import { playCombat } from './combat';
import { discardSkillStrategy, pegSkillStrategy } from './ai';
import type { DiscardStrategy } from './deal';
import type { PlayStrategy } from './pegging';

/**
 * The pricing instrument (step 2, `docs/archive/recalibration-design.md` R1/R2).
 *
 * Prices are **Credit-equivalents measured in mirror duels**: one side
 * fights with `host + addition`, the other with `host + Credit Δ`, and Δ
 * is moved until the duel is 50/50. That Δ is the addition's price, in
 * Credit per turn.
 *
 * What Credit can and cannot check: with c on the grid, "Credit c prices
 * at c" is a tautology (identical loadouts tie by construction) -- a
 * wiring check, nothing more. Credit is linear by construction, so the
 * only Credit-based measurement check is RESOLUTION (an off-grid c). The
 * validity check -- do prices of different verbs add up? -- needs two
 * different verbs, and is step 2's checkpoint 3.
 *
 * Lives in the engine rather than only in a script so its properties are
 * unit-tested -- this project has had a silently broken measuring
 * instrument corrupt a whole balance pass before (session 47).
 *
 * ## Why every duel is played twice
 *
 * `playCombat` is not seat-symmetric: side 1 is the defender and wins at
 * the hand-20 deadline, and side 0 always deals first. Measured: in a pure
 * mirror at skill 0.85, **side 0 wins 65.5%**. So every seed is played
 * with the two loadouts in both seats and the results pooled, which
 * cancels both biases. A side effect worth having: two IDENTICAL loadouts
 * then score exactly 0.5 -- the same fight, mirrored, is one win each.
 *
 * ## Why a grid, not bisection
 *
 * A fight at skill 0.85 costs ~17ms (the Cribbage AI dominates), so
 * repeated bisection with an interval is minutes per price. Instead the
 * win rate is evaluated at a fixed grid of Δ values on the SAME seeds
 * (common random numbers, which keeps the curve near-monotone), and the
 * price is where it crosses 0.5, by linear interpolation. The interval is
 * where the ±2 SE band crosses 0.5. The whole curve is returned, so a
 * non-monotone or saturated one is visible rather than averaged away.
 */

export interface MirrorOptions {
  /** Seeds per evaluation; each is played in both seats, so 2x fights. */
  seeds: number;
  /** Cribbage skill for BOTH sides -- a mirror duel is at equal skill.
   * Undefined uses playCombat's fast baseline strategies (tests). */
  skill?: number;
  /** Initiative threshold, both sides. */
  gaugeThreshold: number;
  /** Win threshold, both sides -- equal, or it is not a mirror. */
  winThreshold: number;
  /** Offsets the seed range, so separate runs can be independent. */
  seedOffset?: number;
}

export interface WinRate {
  winRate: number;
  /** Binomial standard error over all 2 x seeds fights. */
  se: number;
  fights: number;
}

function strategiesFor(skill: number | undefined): { discardStrategies?: [DiscardStrategy, DiscardStrategy]; playStrategies?: [PlayStrategy, PlayStrategy] } {
  if (skill === undefined) return {};
  return {
    discardStrategies: [discardSkillStrategy(skill), discardSkillStrategy(skill)],
    playStrategies: [pegSkillStrategy(skill), pegSkillStrategy(skill)],
  };
}

/** How often `test` beats `reference`, each seed played in both seats. */
export function mirrorWinRate(test: SubroutineDefinition[], reference: SubroutineDefinition[], options: MirrorOptions): WinRate {
  const { seeds, skill, gaugeThreshold, winThreshold, seedOffset = 0 } = options;
  const common = { gaugeThreshold: [gaugeThreshold, gaugeThreshold] as [number, number], winThreshold: [winThreshold, winThreshold] as [number, number], ...strategiesFor(skill) };
  let wins = 0;
  for (let s = 0; s < seeds; s++) {
    const seed = seedOffset + s;
    for (const testSeat of [0, 1] as PlayerIndex[]) {
      const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = testSeat === 0 ? [test, reference] : [reference, test];
      if (playCombat(loadouts, { seed, ...common }).winner === testSeat) wins++;
    }
  }
  const fights = 2 * seeds;
  const winRate = wins / fights;
  return { winRate, se: Math.sqrt((winRate * (1 - winRate)) / fights), fights };
}

/** The currency: a plain "Credit `amount` per turn" piece. Archetype is
 * inert in a duel without Mods or class passives. */
export function creditPiece(amount: number, id = `credit-${amount}`): SubroutineDefinition {
  return { id, name: id, archetype: 'exploit', alpha: { verb: 'credit', amount } };
}

export interface PricePoint extends WinRate {
  delta: number;
}

export interface PriceResult {
  /** Δ where the test side's win rate crosses 0.5, or null if the grid
   * never brackets it (the addition is worth less than the grid's lowest
   * Δ or more than its highest -- widen the grid). */
  price: number | null;
  /** The interval: the wider of (a) where the +/-2 SE band crosses 0.5
   * and (b) the grid bracket -- the last grid Δ still above 0.5 and the
   * first below it. (b) matters because inside a flat step the outcome is
   * deterministic (exactly 0.5, zero variance), so the SE band alone is
   * overconfident there; the real uncertainty is grid resolution. A bound
   * is null when neither crosses inside the grid. */
  low: number | null;
  high: number | null;
  /** Every grid point, ascending Δ. */
  curve: PricePoint[];
}

/** Where `values` (aligned to ascending `deltas`) crosses 0.5.
 *
 * Win rate against Δ is a STAIRCASE, not a smooth curve (measured, session
 * 52): a pure-Credit race is decided by how many turns each side needs to
 * reach its threshold, and when both need the same number the fight plays
 * out exactly as a mirror does -- exactly 0.5, on every seed. So the curve
 * has flat steps at exactly 0.5, and any Δ inside one is equally correct.
 *
 * The crossing is therefore found as an interval: its lower edge is where
 * the curve first stops being ABOVE 0.5, its upper edge where it first
 * drops BELOW 0.5 (both linearly interpolated), and the price is their
 * midpoint. With no exact-0.5 step the two edges coincide with the
 * ordinary crossing. Null if the curve never crosses inside the grid. */
export function crossing(deltas: number[], values: number[]): number | null {
  const at = (i: number, level: number): number => {
    const [a, b] = [values[i], values[i + 1]];
    return a === b ? deltas[i] : deltas[i] + ((a - level) / (a - b)) * (deltas[i + 1] - deltas[i]);
  };
  let lower: number | null = null;
  let upper: number | null = null;
  for (let i = 0; i + 1 < values.length; i++) {
    if (lower === null && values[i] > 0.5 && values[i + 1] <= 0.5) lower = at(i, 0.5);
    if (upper === null && values[i] >= 0.5 && values[i + 1] < 0.5) upper = at(i, 0.5);
  }
  // A curve starting exactly at 0.5 has its lower edge at the grid's start.
  if (lower === null && values.length > 0 && values[0] === 0.5) lower = deltas[0];
  if (lower === null || upper === null) return lower ?? upper;
  return (lower + upper) / 2;
}

/** Where the addition sits relative to the host. Order matters for
 * Empower (it boosts only pieces BELOW it) and for sequence betas. A
 * number inserts it at that index of the host list (step 3: a piece
 * priced in the middle of a build, with pieces above and below it). */
export type Placement = 'after' | 'before' | number;

/**
 * R2's host-plus-difference method. Both sides get `host`; the test side
 * adds `addition` (one piece or several); the reference side adds Credit
 * Δ for each Δ in `deltas`, padded with Credit-0 pieces so both sides
 * always have the same piece count -- loadout size is never a confound.
 * `placement` puts the addition (and, symmetrically, the reference's
 * Credit Δ) after or before the host. Returns the crossing and interval.
 */
export function priceAddition(
  host: SubroutineDefinition[],
  addition: SubroutineDefinition | SubroutineDefinition[],
  deltas: number[],
  options: MirrorOptions,
  placement: Placement = 'after',
): PriceResult {
  const sorted = [...deltas].sort((a, b) => a - b);
  const added = Array.isArray(addition) ? addition : [addition];
  const place = (extra: SubroutineDefinition[]): SubroutineDefinition[] =>
    placement === 'after' ? [...host, ...extra] : placement === 'before' ? [...extra, ...host] : [...host.slice(0, placement), ...extra, ...host.slice(placement)];
  const test = place(added);
  const padding = Array.from({ length: added.length - 1 }, (_, i) => creditPiece(0, `credit-pad-${i}`));
  const curve = sorted.map((delta) => ({ delta, ...mirrorWinRate(test, place([creditPiece(delta, `credit-delta`), ...padding]), options) }));
  const p = curve.map((c) => c.winRate);
  const bandLow = crossing(sorted, curve.map((c) => c.winRate - 2 * c.se));
  const bandHigh = crossing(sorted, curve.map((c) => c.winRate + 2 * c.se));
  const lastAbove = [...curve].reverse().find((c) => c.winRate > 0.5)?.delta ?? null;
  const firstBelow = curve.find((c) => c.winRate < 0.5)?.delta ?? null;
  const widest = (a: number | null, b: number | null, pick: (x: number, y: number) => number): number | null =>
    a === null ? b : b === null ? a : pick(a, b);
  return {
    price: crossing(sorted, p),
    low: widest(bandLow, lastAbove, Math.min),
    high: widest(bandHigh, firstBelow, Math.max),
    curve,
  };
}

/**
 * Two-pass pricing: a coarse grid finds the bracket (the last Δ above 0.5
 * and the first below), then `points` evenly spaced Δ inside it pin the
 * price. The coarse grid alone leaves intervals as wide as its spacing
 * (measured: [2, 4] at a host of 4); refining narrows them to the fine
 * spacing, or to the staircase step, whichever is wider. Returns the
 * coarse result unchanged when it never brackets 0.5.
 */
export function refinedPrice(
  host: SubroutineDefinition[],
  addition: SubroutineDefinition | SubroutineDefinition[],
  coarseDeltas: number[],
  options: MirrorOptions,
  placement: Placement = 'after',
  points = 6,
): { coarse: PriceResult; fine: PriceResult | null } {
  const coarse = priceAddition(host, addition, coarseDeltas, options, placement);
  const lastAbove = [...coarse.curve].reverse().find((c) => c.winRate > 0.5)?.delta;
  const firstBelow = coarse.curve.find((c) => c.winRate < 0.5)?.delta;
  if (coarse.price === null || lastAbove === undefined || firstBelow === undefined || firstBelow <= lastAbove) return { coarse, fine: null };
  const step = (firstBelow - lastAbove) / (points - 1);
  const fineDeltas = Array.from({ length: points }, (_, i) => lastAbove + i * step);
  return { coarse, fine: priceAddition(host, addition, fineDeltas, options, placement) };
}

/**
 * Kit power (step 3, enemies; E3): the flat Credit per turn a whole
 * loadout ties in a seat-swapped duel. The reference side is one Credit-Δ
 * piece padded with Credit-0 pieces to the same count. `bridge` gives the
 * kit its class bridge in either seat. Puts players and enemies on one
 * scale. Null when the grid never brackets the tie.
 */
export function kitPower(
  kit: SubroutineDefinition[],
  options: Omit<MirrorOptions, 'seedOffset'> & { bridge?: ClassId; mods?: GatekeeperModId[]; grid?: number[] },
): number | null {
  const { seeds, skill, gaugeThreshold, winThreshold, bridge, mods = [] } = options;
  const grid = options.grid ?? [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 17, 20, 25, 30];
  const pads = Array.from({ length: Math.max(0, kit.length - 1) }, (_, i) => creditPiece(0, `pad-${i}`));
  const curve = grid.map((delta) => {
    const reference = [creditPiece(delta, 'delta'), ...pads];
    let wins = 0;
    for (let seed = 0; seed < seeds; seed++) {
      for (const seat of [0, 1] as PlayerIndex[]) {
        const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = seat === 0 ? [kit, reference] : [reference, kit];
        const r = playCombat(loadouts, {
          seed,
          gaugeThreshold: [gaugeThreshold, gaugeThreshold],
          winThreshold: [winThreshold, winThreshold],
          ...strategiesFor(skill),
          classId: seat === 0 ? bridge : undefined,
          opponentBridge: seat === 1 ? bridge : undefined,
          gatekeeperMods: seat === 0 ? [mods, []] : [[], mods],
        });
        if (r.winner === seat) wins++;
      }
    }
    return wins / (2 * seeds);
  });
  return crossing(grid, curve);
}
