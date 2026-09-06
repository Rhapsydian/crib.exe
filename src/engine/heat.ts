/**
 * The Heat resource (session 19/20 checkpoint C): a persistent,
 * run-spanning, *rising* danger meter -- accumulates toward getting
 * caught rather than draining like an HP bar. See DESIGN.md Resources.
 *
 * Two independent accumulation sources: a lost regular/elite fight
 * (heatFromLoss, a flat per-tier charge -- elite costing much more,
 * higher stakes for a harder, better-rewarded fight) and a flat cost per
 * map move (HEAT_PER_MOVE, session 19's free-roam pressure). Gatekeeper
 * losses bypass Heat entirely -- they go straight to Quarantine -- so
 * heatFromLoss only ever applies to regular/elite.
 */

export const HEAT_MAX = 100; // TBD/playtesting
export const HEAT_PER_MOVE = 2; // TBD/playtesting

// Fractions of max Heat used by the opportunistic traversal/Safehouse
// strategy pair (run.ts/merge.ts) to decide when Heat pressure should
// pull toward a Safehouse (high) or count as one of the three "nothing
// worth detouring for" conditions behind an Event pull (low). TBD/
// playtesting, same treatment as every other numeric constant here.
export const HEAT_HIGH_FRACTION = 0.5;
export const HEAT_LOW_FRACTION = 0.2;

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
 * Heat gained from losing a regular or elite fight: a flat charge by
 * tier, so entering a fight is a legible risk/reward decision -- a
 * regular costs a chunk, an elite costs much more.
 *
 * Session 50 removed the margin-of-loss scaler this used to apply
 * (`BASE * (1 - peakFillFraction)`, session 9). It discounted a
 * near-miss loss almost to nothing, which cost more in complexity and
 * obfuscation than it returned: the player could not see the peak fill
 * fraction, so the Heat charged for an apparently identical defeat
 * varied for reasons they had no way to read. It also made the two loss
 * kinds silently unequal -- attrition losses carry high player gauge
 * fill by construction, so they were being discounted hardest, which was
 * an accident of the formula rather than a design intent.
 *
 * Measured before removal: it was discounting real loss Heat by roughly
 * half overall and ~70% for Warden, the class that loses narrowest and
 * most often.
 */
export function heatFromLoss(tier: 'regular' | 'elite'): number {
  return BASE_HEAT_BY_TIER[tier];
}
