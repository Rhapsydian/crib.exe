import { BREACH_CONTAINMENT_CENTER, BREACH_CONTAINMENT_MAX } from './gauges';

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
 * clamped to [0, HEAT_MAX]. */
export function addHeat(current: number, amount: number): HeatUpdate {
  const heat = Math.min(HEAT_MAX, Math.max(0, current + amount));
  return { heat, maxed: heat >= HEAT_MAX };
}

/**
 * Heat gained from losing a regular or elite fight, scaled by how close
 * the player got to their own win before being dragged back -- not
 * literal overshoot (Breach/Containment stops dead at 0/100), but the
 * peak value reached during the match (see
 * CombatResult.peakBreachContainment). Getting the meter to 80% in your
 * favor before it swung costs noticeably less than being dominated from
 * the first hand.
 */
export function heatFromLoss(tier: 'regular' | 'elite', peakBreachContainment: number): number {
  const span = BREACH_CONTAINMENT_MAX - BREACH_CONTAINMENT_CENTER;
  const margin = Math.max(0, Math.min(1, (peakBreachContainment - BREACH_CONTAINMENT_CENTER) / span));
  return Math.round(BASE_HEAT_BY_TIER[tier] * (1 - margin));
}
