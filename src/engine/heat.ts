/**
 * The Heat resource -- the risk of getting caught (DESIGN.md Resources).
 *
 * Since session 52 (step 2, checkpoint 1) Heat is a **per-layer budget**,
 * not a run-long accumulator: session 50's run-economy decisions D1-D7
 * (`docs/archive/run-economy-design.md`) plus step 2's R5-R8
 * (`docs/archive/recalibration-design.md`).
 *
 * - Each layer has its own **allowance**, tightening with depth (D5).
 *   Reaching it gets you caught.
 * - Clearing a layer's gatekeeper **resets Heat to 0** (D4) -- after the
 *   gatekeeper's own toll has been charged and survived (R8).
 * - Heat comes from four places (session 58, when Trace was removed): a
 *   flat cost per map move, each fight's own cost, Events, and enemy
 *   alarms that add Heat directly during a fight.
 *
 * A fight's cost is **posted**, knowable before committing to the node
 * (D2's rule, the house style for Heat): a baseline, plus a performance
 * term the player watches accrue on the enemy's Containment gauge (R6).
 * A clean win pays the baseline; a win scraped at 99% pays nearly
 * baseline + k; a loss pays baseline + LOSS_MULTIPLIER x k (R7, the
 * user's session 58 form). A UI can print all three on the node.
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
 *
 * Milestone 3 (session 58, the user's two-lever pass): 40/36/32/28 ->
 * 76/68/61/53 (x1.9). The new maps deal every layer more fights and
 * elites and climb farther, so players win more fights a layer and each
 * win posts its Heat; at the old allowances Heat endings jumped from
 * ~2% to 13-22% maxed. x1.9 restores their shape (Exploit classes 18-28%
 * maxed or caught, the rest ~10%); the gatekeepers were then re-tuned to
 * the pass-rate curve (enemies content scales).
 */
export const LAYER_HEAT_ALLOWANCE: readonly number[] = [76, 68, 61, 53]; // TBD/playtesting

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
// Fight Heat (D1, D2, R6, R7, R8)
// ---------------------------------------------------------------------

export type FightTier = 'regular' | 'elite' | 'gatekeeper';

/**
 * The posted baseline Heat of a fight, by tier, at layer 1 (D1, D2):
 * hitting a node always makes some noise, elite meaningfully more than
 * regular. The gatekeeper's is a small floor (R8): the fight can't be
 * declined, so its price is carried by the performance term, not the
 * posted part.
 */
const BASELINE_HEAT: Record<FightTier, number> = {
  regular: 3, // TBD/playtesting
  elite: 6, // TBD/playtesting
  gatekeeper: 2, // TBD/playtesting -- the floor of R8's toll
};

/** How much the baseline grows per layer past the first (D2: tier x
 * layer). Multiplicative, so elite stays proportionally above regular. */
const BASELINE_LAYER_STEP = 0.2; // TBD/playtesting

/**
 * The performance term's weight, k (R6): Heat added in proportion to
 * the enemy's FINAL Containment fill, 0-1, on a win. A clean stomp (0%)
 * pays only the baseline; a win scraped at 99% pays nearly baseline + k.
 * For the gatekeeper it carries the whole of R8's gamble, so it is much
 * the largest -- the toll the player watches climb on the gatekeeper's
 * gauge.
 */
const PERFORMANCE_HEAT: Record<FightTier, number> = {
  regular: 3, // TBD/playtesting -- equal to the baseline: a scraped win costs ~double a clean one
  elite: 6, // TBD/playtesting
  gatekeeper: 10, // TBD/playtesting
};

/** R7: a loss pays the baseline plus this multiple of the performance
 * weight (session 58: the multiple no longer touches the baseline). Must
 * stay above 1, or a loss would cost no more than a scraped win. */
export const LOSS_MULTIPLIER = 1.5; // TBD/playtesting

function layerFactor(layerIndex: number): number {
  return 1 + BASELINE_LAYER_STEP * Math.max(0, layerIndex);
}

/** The posted baseline Heat for a fight at a 0-based layer, paid win or
 * lose. */
export function fightBaselineHeat(tier: FightTier, layerIndex: number): number {
  return BASELINE_HEAT[tier] * layerFactor(layerIndex);
}

/** The performance term's full weight, k, at a 0-based layer -- scaled by
 * layer like the baseline, so the posted triple keeps its shape. */
export function fightPerformanceWeight(tier: FightTier, layerIndex: number): number {
  return PERFORMANCE_HEAT[tier] * layerFactor(layerIndex);
}

/** R6: the performance Heat a won fight adds, from the enemy's final
 * Containment fill (clamped to 0-1 -- the final value, never the peak,
 * which the player cannot see). */
export function fightPerformanceHeat(tier: FightTier, layerIndex: number, enemyFinalFill: number): number {
  return fightPerformanceWeight(tier, layerIndex) * Math.min(1, Math.max(0, enemyFinalFill));
}

/** R7: the Heat a lost regular/elite fight costs -- the baseline plus
 * LOSS_MULTIPLIER times the full performance weight. Gatekeeper losses
 * never reach this: they end the run as Quarantine, bypassing Heat. */
export function heatFromLoss(tier: 'regular' | 'elite', layerIndex: number): number {
  return fightBaselineHeat(tier, layerIndex) + LOSS_MULTIPLIER * fightPerformanceWeight(tier, layerIndex);
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
 * a clean win, the worst win and a loss each cost, before any Heat an
 * enemy's alarms add. `loss` is undefined for a gatekeeper,
 * whose loss is Quarantine. */
export function postedFightRisk(tier: FightTier, layerIndex: number): { cleanWin: number; worstWin: number; loss?: number } {
  const cleanWin = fightBaselineHeat(tier, layerIndex);
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

/**
 * Where a fight leaves your Heat (session 63, the user's "I just got
 * completely surprised by a Breached, then caught"): the fight screen's
 * Heat bar. `now` is the run's Heat plus what the enemy's alarms have
 * raised so far; `ifWin` is what winning at this moment would leave --
 * the same sum encounters.ts charges (baseline, alarms, the performance
 * term off the enemy's Containment fill, less any Heat Sink refund);
 * `ifLose` what losing would (none for a gatekeeper: losing is
 * Quarantine). `caught*` is whether that reaches the layer's allowance.
 */
export interface FightHeatOutlook {
  now: number;
  ifWin: number;
  ifLose?: number;
  allowance: number;
  caughtIfWin: boolean;
  caughtIfLose: boolean;
}

export function fightHeatOutlook(o: {
  heat: number;
  allowance: number;
  tier: FightTier;
  /** 0-based. */
  layerIndex: number;
  /** Heat the enemy's alarms have raised this fight. */
  alarm: number;
  /** The enemy's Containment fill, 0-1. */
  enemyFill: number;
  /** A Heat Sink refund on this win, if any. */
  refund?: number;
}): FightHeatOutlook {
  const now = Math.min(o.allowance, o.heat + o.alarm);
  const ifWin = Math.max(0, o.heat + fightBaselineHeat(o.tier, o.layerIndex) + o.alarm + fightPerformanceHeat(o.tier, o.layerIndex, o.enemyFill) - (o.refund ?? 0));
  const ifLose = o.tier === 'gatekeeper' ? undefined : o.heat + heatFromLoss(o.tier, o.layerIndex) + o.alarm;
  return {
    now,
    ifWin: Math.min(o.allowance, ifWin),
    ifLose: ifLose === undefined ? undefined : Math.min(o.allowance, ifLose),
    allowance: o.allowance,
    caughtIfWin: ifWin >= o.allowance,
    caughtIfLose: ifLose !== undefined && ifLose >= o.allowance,
  };
}
