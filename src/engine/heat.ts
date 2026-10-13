/**
 * The Heat resource -- the risk of getting caught (DESIGN.md Resources).
 *
 * Since session 52 (step 2, checkpoint 1) Heat is a **per-layer budget**,
 * not a run-long accumulator: session 50's run-economy decisions D1-D7
 * (`docs/run-economy-design.md`) plus step 2's R5-R8
 * (`docs/recalibration-design.md`).
 *
 * - Each layer has its own **allowance**, tightening with depth (D5).
 *   Reaching it gets you caught.
 * - Clearing a layer's gatekeeper **resets Heat to 0** (D4) -- after the
 *   gatekeeper's own toll has been charged and survived (R8).
 * - Heat comes from three places: a flat cost per map move, the Trace a
 *   fight leaves behind, and the extra cost of losing one.
 *
 * Every fight's Trace has a **posted** part, knowable before committing
 * to the node (D2's rule, the house style for Heat), and a part the player
 * watches accrue on the enemy's Containment gauge during the fight (R6).
 * A fight's full risk is a posted triple: ~baseline on a clean win, up to
 * baseline + performance on a scrappy one, LOSS_MULTIPLIER times that on a
 * loss (R7). A UI can print all three on the node.
 *
 * Every number here is a first-pass placeholder, sized against the old
 * run-long budget's proportions and checked on the skeleton -- unpriced,
 * like every other constant until the calibration lands.
 */

/** Heat per map move (session 19), regardless of direction. */
export const HEAT_PER_MOVE = 2; // TBD/playtesting

/**
 * Each layer's Heat allowance (D5: tightening with depth). Was a single
 * run-long HEAT_MAX of 100; a run averaged ~38 at its end, about three
 * quarters of it movement. A layer is roughly a quarter of a run, so these
 * start a little above a quarter of the old cap each -- the reset (D4)
 * forgives what used to carry over, and D5's tightening is the ramp.
 */
export const LAYER_HEAT_ALLOWANCE: readonly number[] = [40, 36, 32, 28]; // TBD/playtesting

/** The allowance for a 0-based layer index, plus any Backup Generator
 * bonus (RunPlayerState.maxHeatBonus, now added to every layer). Layers
 * past the table reuse its last entry. */
export function layerHeatAllowance(layerIndex: number, bonus: number = 0): number {
  const table = LAYER_HEAT_ALLOWANCE;
  return table[Math.min(Math.max(0, layerIndex), table.length - 1)] + bonus;
}

/** The ceiling a strategy should plan against: the live layer allowance
 * playRun records on the player state, or layer 1's when there is none
 * (a test or helper constructing state outside a run). */
export function currentHeatCeiling(playerState: { heatAllowance?: number; maxHeatBonus: number }): number {
  return playerState.heatAllowance ?? layerHeatAllowance(0, playerState.maxHeatBonus);
}

// Fractions of the current ceiling used by the opportunistic traversal/
// Safehouse/Event strategies to read Heat pressure as high or low.
export const HEAT_HIGH_FRACTION = 0.5;
export const HEAT_LOW_FRACTION = 0.2;

// ---------------------------------------------------------------------
// Fight Trace (D1, D2, R6, R7, R8)
// ---------------------------------------------------------------------

export type FightTier = 'regular' | 'elite' | 'gatekeeper';

/**
 * The posted baseline Trace of a fight, by tier, at layer 1 (D1, D2):
 * hitting a node always makes some noise, elite meaningfully more than
 * regular. The gatekeeper's is a small floor (R8): the fight can't be
 * declined, so its price is carried by the performance term, not the
 * posted part.
 */
const BASELINE_TRACE: Record<FightTier, number> = {
  regular: 3, // TBD/playtesting
  elite: 6, // TBD/playtesting
  gatekeeper: 2, // TBD/playtesting -- the floor of R8's toll
};

/** How much the baseline grows per layer past the first (D2: tier x
 * layer). Multiplicative, so elite stays proportionally above regular. */
const BASELINE_LAYER_STEP = 0.2; // TBD/playtesting

/**
 * The performance term's weight, k (R6): Trace added in proportion to
 * the enemy's FINAL Containment fill, 0-1, on a win. A clean stomp (0%)
 * pays only the baseline; a win scraped at 99% pays nearly baseline + k.
 * For the gatekeeper it carries the whole of R8's gamble, so it is much
 * the largest -- the toll the player watches climb on the gatekeeper's
 * gauge.
 */
const PERFORMANCE_TRACE: Record<FightTier, number> = {
  regular: 3, // TBD/playtesting -- equal to the baseline: a scraped win costs ~double a clean one
  elite: 6, // TBD/playtesting
  gatekeeper: 10, // TBD/playtesting
};

/** R7: a loss costs this multiple of the node's worst-case win. Must stay
 * above 1, or a loss would cost no more than a scraped win. */
export const LOSS_MULTIPLIER = 1.5; // TBD/playtesting

function layerFactor(layerIndex: number): number {
  return 1 + BASELINE_LAYER_STEP * Math.max(0, layerIndex);
}

/** The posted baseline Trace for a fight at a 0-based layer. Initialised
 * into the fight's own Trace (D1), so the player's cover-your-tracks
 * effects can work against it during the fight. */
export function fightBaselineTrace(tier: FightTier, layerIndex: number): number {
  return BASELINE_TRACE[tier] * layerFactor(layerIndex);
}

/** The performance term's full weight, k, at a 0-based layer -- scaled by
 * layer like the baseline, so the posted triple keeps its shape. */
export function fightPerformanceWeight(tier: FightTier, layerIndex: number): number {
  return PERFORMANCE_TRACE[tier] * layerFactor(layerIndex);
}

/** R6: the performance Trace a won fight adds, from the enemy's final
 * Containment fill (clamped to 0-1 -- the final value, never the peak,
 * which the player cannot see). */
export function fightPerformanceTrace(tier: FightTier, layerIndex: number, enemyFinalFill: number): number {
  return fightPerformanceWeight(tier, layerIndex) * Math.min(1, Math.max(0, enemyFinalFill));
}

/** R7: the Heat a lost regular/elite fight costs -- LOSS_MULTIPLIER times
 * the node's worst-case win. Gatekeeper losses never reach this: they
 * end the run as Quarantine, bypassing Heat. */
export function heatFromLoss(tier: 'regular' | 'elite', layerIndex: number): number {
  return LOSS_MULTIPLIER * (fightBaselineTrace(tier, layerIndex) + fightPerformanceWeight(tier, layerIndex));
}

/** Step 2, checkpoint 6: an Event's Heat, given as a multiple of the
 * layer's elite-loss charge. Anchored to the loss price rather than a flat
 * number so Events keep their weight against fights on every layer and
 * follow any retuning of the posted prices. The roster's multiples are the
 * old run-long values over the old elite charge (30), so each Event kept
 * its ratio to losing an elite fight. */
export function eventHeat(heatLosses: number, layerIndex: number): number {
  return heatLosses * heatFromLoss('elite', layerIndex);
}

/** A fight's posted risk, all knowable before committing (D2, R7): what
 * a clean win, the worst win and a loss each cost, before any Trace the
 * player's own noisy effects add. `loss` is undefined for a gatekeeper,
 * whose loss is Quarantine. */
export function postedFightRisk(tier: FightTier, layerIndex: number): { cleanWin: number; worstWin: number; loss?: number } {
  const cleanWin = fightBaselineTrace(tier, layerIndex);
  const worstWin = cleanWin + fightPerformanceWeight(tier, layerIndex);
  return { cleanWin, worstWin, loss: tier === 'gatekeeper' ? undefined : heatFromLoss(tier, layerIndex) };
}

// ---------------------------------------------------------------------

export interface HeatUpdate {
  heat: number;
  maxed: boolean;
}

/** Adds (or, with a negative amount, subtracts -- e.g. Rest) Heat,
 * clamped to [0, max]. `max` is the current layer's allowance. */
export function addHeat(current: number, amount: number, max: number): HeatUpdate {
  const heat = Math.min(max, Math.max(0, current + amount));
  return { heat, maxed: heat >= max };
}
