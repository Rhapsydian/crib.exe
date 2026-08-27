/**
 * The Heat resource (session 19/20 checkpoint C): a persistent,
 * run-spanning, *rising* danger meter -- accumulates toward getting
 * caught rather than draining like an HP bar. See DESIGN.md Resources.
 *
 * Two independent accumulation sources: a lost regular/elite fight
 * (heatFromLoss, session 9's margin-of-loss formula, elite costing
 * noticeably more -- higher stakes for a harder, better-rewarded fight)
 * and a flat cost per map move (HEAT_PER_MOVE, session 19's free-roam
 * pressure). Gatekeeper losses bypass Heat entirely -- they go straight
 * to Quarantine -- so heatFromLoss only ever applies to regular/elite.
 */

export const HEAT_MAX = 100; // TBD/playtesting
export const HEAT_PER_MOVE = 2; // TBD/playtesting

const BASE_HEAT_BY_TIER: Record<'regular' | 'elite', number> = {
  regular: 15, // TBD/playtesting
  elite: 30, // TBD/playtesting -- deliberately much higher: real risk for the better reward
};

export interface HeatUpdate {
  heat: number;
  maxed: boolean;
}

/** Adds (or, with a negative amount, subtracts -- e.g. Rest) Heat,
 * clamped to [0, max]. `max` defaults to HEAT_MAX but is overridable --
 * Backup Generator (Mods checkpoint E/H) permanently raises a run's own
 * cap via RunPlayerState.maxHeatBonus, threaded in from run.ts. */
export function addHeat(current: number, amount: number, max: number = HEAT_MAX): HeatUpdate {
  const heat = Math.min(max, Math.max(0, current + amount));
  return { heat, maxed: heat >= max };
}

/**
 * Heat gained from losing a regular or elite fight, scaled by how close
 * the player got to their own win before the fight ended -- the peak
 * fill-fraction their own win-gauge reached during the match (see
 * CombatResult.peakFillFraction[0], session 22+'s two-gauge redesign;
 * previously derived from the old shared scalar's peak value instead).
 * Getting your own gauge to 80% full before losing costs noticeably less
 * than being dominated from the first hand.
 */
export function heatFromLoss(tier: 'regular' | 'elite', peakFillFraction: number): number {
  const margin = Math.max(0, Math.min(1, peakFillFraction));
  return Math.round(BASE_HEAT_BY_TIER[tier] * (1 - margin));
}
