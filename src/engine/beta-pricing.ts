import type { Alpha, Beta, BetaEffect, Effect, SubroutineDefinition } from './subroutine-types';
import { BETA_FREQUENCY } from './beta-frequency-data';
import { createRng } from './rng';

/**
 * R3's pricing formula (step 2, checkpoint 5; `docs/archive/recalibration-design.md`).
 * The authoring tool step 3 prices content with.
 *
 *     piece price = alpha price + beta price
 *     beta price  = expected scale per turn x price of the beta's effect
 *
 * in Credit per turn. Expected scale comes from checkpoint 4's measured
 * per-turn charge distributions (`beta-frequency-data.ts`) run through
 * the shape's own rules; effect prices are checkpoint 3's per-point verb
 * prices. Checkpoint 5's validation compares this against direct
 * mirror-duel prices and records where it holds.
 *
 * **Returns null rather than guessing** wherever the measurements don't
 * support a number: a beta source that wasn't measured (an unusual
 * `minMagnitude`, a gauge threshold other than the ones probed), a
 * `sequence` beta (its scale is fixed by the loadout around it -- see
 * `adjacentMatches`), an immediate `state` beta (its rate is an edge
 * count, not a fraction), and effects whose worth scales with the loadout
 * they act on (Tempo, Disrupt, Empower, credit spent from your own Ward).
 * Those are priced in context, not by a flat rule.
 *
 * Validated in checkpoint 5 (`docs/calibration/step2-cp5-beta-validation.txt`):
 * within ~3% for card, progress and dealer/non-dealer sources. It does NOT
 * hold for gauge/Ward conditions (correlated with the effect's worth) or
 * immediate extra-fire betas (a timing premium) -- price those by duel.
 */

/** Checkpoint 5: one charge per turn into a beta still below its cap is
 * worth about one extra application of that beta (measured 1.01 Credit
 * for a +1 enhance on a Credit-1 alpha). */
export const CHARGE_PRICE_PER_APPLICATION = 1;

/** Checkpoint 3's prices, in Credit per point of the effect's amount, at
 * a Credit-2 host (`docs/calibration/step2-cp3-verb-prices.txt`). Only
 * the verbs whose price was flat across hosts are here. */
export const POINT_PRICE = {
  credit: 1, // the unit
  creditFromOpponent: 1.85, // ~Credit + Suppress in one
  suppress: 0.955,
  ward: 0.97,
} as const;

/** Credit per point of an effect, or null when its worth depends on
 * context the formula doesn't have. Piercing is priced as plain Credit:
 * its extra worth is exactly the Ward it bypasses, which depends on the
 * opponent (checkpoint 3). */
export function pointPrice(effect: Effect): number | null {
  switch (effect.verb) {
    case 'credit':
      if (effect.from === 'opponent') return POINT_PRICE.creditFromOpponent;
      if (effect.from === 'ward') return null;
      return POINT_PRICE.credit;
    case 'suppress':
      return POINT_PRICE.suppress;
    case 'ward':
      return POINT_PRICE.ward;
    default:
      return null;
  }
}

/** An alpha's price: its amount x its per-point price. Growth is not
 * priced here -- it depends on how long the fight runs. */
export function alphaPrice(alpha: Alpha): number | null {
  if (alpha.verb === 'disrupt') return null;
  const per = pointPrice(alpha as Effect);
  return per === null ? null : alpha.amount * per;
}

/** The measured distribution key for a beta's source, or null if that
 * exact source wasn't measured. */
export function frequencyKey(beta: Beta): string | null {
  switch (beta.source) {
    case 'cards': {
      const watch = beta.watch ?? 'own';
      if (beta.category === 'suit') return watch === 'own' && beta.minMagnitude === undefined ? 'cards:suit (own)' : null;
      if (watch === 'either') return null;
      if (beta.minMagnitude !== undefined) {
        if (watch !== 'own') return null;
        if (beta.category === 'pair' && beta.minMagnitude === 6) return 'cards:pair>=6 (royal)';
        if (beta.category === 'run' && beta.minMagnitude === 4) return 'cards:run>=4';
        return null;
      }
      return watch === 'own' ? `cards:${beta.category}` : `cards:${beta.category} (opponent)`;
    }
    case 'progress':
      return `progress:${beta.metric}`;
    case 'state': {
      const c = beta.condition;
      switch (c.kind) {
        case 'dealer':
        case 'nonDealer':
          return `state:${c.kind}`;
        case 'wardAbove':
          return [2, 4, 8].includes(c.amount) ? `state:wardAbove ${c.amount}` : null;
        case 'ownGaugeAbove':
          return c.fraction === 0.5 ? 'state:ownGauge>0.5' : null;
        case 'ownGaugeBelow':
          return c.fraction === 0.25 ? 'state:ownGauge<0.25' : null;
        case 'opponentGaugeAbove':
          return c.fraction === 0.5 ? 'state:oppGauge>0.5' : null;
        case 'opponentGaugeBelow':
          return c.fraction === 0.25 ? 'state:oppGauge<0.25' : null;
      }
      return null;
    }
    case 'sequence':
      // No measured distribution: a sequence beta's scale is fixed by the
      // loadout around it, so it is priced in context, not by the table.
      return null;
  }
}

/** A sampler over a measured per-turn distribution. */
function sampler(distribution: Readonly<Record<number, number>>): (u: number) => number {
  const entries = Object.entries(distribution).map(([k, n]) => [Number(k), n] as const);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  return (u: number) => {
    let roll = u * total;
    for (const [k, n] of entries) {
      roll -= n;
      if (roll < 0) return k;
    }
    return entries[entries.length - 1][0];
  };
}

/** Turns simulated for the shapes that carry state across turns (stepped,
 * and graded on a progress bank) -- accurate to about +/-0.01. Deterministic
 * (fixed seed), so the formula is a pure function of its inputs. */
const SIMULATED_TURNS = 100_000;

/**
 * Expected beta scale per owner-turn, or null where unsupported. Simulates
 * the shape's own rules over draws from the measured distribution:
 *
 * - graded: each turn holding charges applies min(charges, cap) and spends;
 * - stepped: charges bank until `at`, then apply once (scale 1) and spend;
 * - immediate: fires every time the bank reaches `at`, mid-interval,
 *   leftover carrying -- so its rate is exactly mean / at (closed form);
 * - whileTrue (state): the fraction of turns the condition held.
 *
 * Progress sources bank raw units (points, absorbed Ward) toward a charge
 * every `per`, remainder carrying, exactly as the engine does.
 */
export function expectedScale(beta: Beta): number | null {
  const key = frequencyKey(beta);
  if (key === null) return null;
  const distribution = BETA_FREQUENCY[key];
  if (!distribution) return null;
  if (beta.source === 'state') {
    if (beta.shape !== 'whileTrue') return null;
    const total = Object.values(distribution).reduce((a, b) => a + b, 0);
    return (distribution[1] ?? 0) / total;
  }
  const per = beta.source === 'progress' ? beta.per : 1;
  const entries = Object.entries(distribution).map(([k, n]) => [Number(k), n] as const);
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  // Exact closed forms where they exist, so the formula isn't carrying
  // simulation noise it doesn't need to:
  // - immediate fires once per `at` charges, leftovers carrying, so its
  //   long-run rate is exactly (mean charges per turn) / at;
  // - graded on a card source (one charge per occurrence, nothing banked
  //   across turns) applies min(N, cap) on every turn: sum of P(N >= k).
  if (beta.shape === 'immediate') {
    const meanUnits = entries.reduce((sum, [k, n]) => sum + k * n, 0) / total;
    return meanUnits / per / (beta.at ?? 1);
  }
  if (beta.shape === 'graded' && per === 1) {
    return entries.reduce((sum, [k, n]) => sum + Math.min(k, beta.cap) * n, 0) / total;
  }
  const draw = sampler(distribution);
  const rng = createRng(0x5ca1e);
  let bank = 0;
  let charges = 0;
  let scaleSum = 0;
  for (let t = 0; t < SIMULATED_TURNS; t++) {
    bank += draw(rng.next());
    const gained = Math.floor(bank / per);
    bank -= gained * per;
    charges += gained;
    if (beta.shape === 'graded' && charges >= 1) {
      scaleSum += Math.min(charges, beta.cap);
      charges = 0;
    } else if (beta.shape === 'stepped' && charges >= beta.at) {
      scaleSum += 1;
      charges = 0;
    } else if (beta.shape === 'whileTrue') {
      return null; // whileTrue only makes sense for state/sequence sources
    }
  }
  return scaleSum / SIMULATED_TURNS;
}

/** The value of ONE application of a beta's effect, in Credit. An
 * `enhance` adds to the alpha's amount, so it is priced at the alpha's
 * per-point price; an immediate `enhance` is an extra, elevated fire of
 * the whole alpha. */
function effectValue(effect: BetaEffect, alpha: Alpha, immediate: boolean): number | null {
  if (effect.verb === 'enhance') {
    if (alpha.verb === 'disrupt') return null;
    const per = pointPrice(alpha as Effect);
    if (per === null) return null;
    return immediate ? (alpha.amount + effect.amount) * per : effect.amount * per;
  }
  if (effect.verb === 'disrupt') return null;
  const per = pointPrice(effect);
  return per === null ? null : effect.amount * per;
}

export interface PiecePrice {
  alpha: number | null;
  beta: number | null;
  /** alpha + beta, or null if either is unpriceable. A piece with no beta
   * prices at its alpha. */
  total: number | null;
}

/** The formula's price for a whole piece, in Credit per turn. */
export function piecePrice(piece: SubroutineDefinition): PiecePrice {
  const alpha = alphaPrice(piece.alpha);
  if (!piece.beta) return { alpha, beta: 0, total: alpha };
  const scale = expectedScale(piece.beta);
  const value = effectValue(piece.beta.effect, piece.alpha, piece.beta.shape === 'immediate');
  const beta = scale === null || value === null ? null : scale * value;
  return { alpha, beta, total: alpha === null || beta === null ? null : alpha + beta };
}
