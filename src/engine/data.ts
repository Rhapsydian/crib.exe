import type { RewardTier } from './rewards';

/**
 * The Data resource (Phase 4 checkpoint C): the run's currency, spent
 * at the Shop (DESIGN.md Resources). Awarded on every combat win,
 * tiered via the same RewardTier abstraction the subroutine-reward
 * choice uses (rewards.ts) -- independent of which piece is actually
 * picked, same "tier-scaling shape as Heat's own loss formula" the
 * Phase 4 plan called for.
 */

const DATA_BY_TIER: Record<'standard' | 'better', number> = {
  standard: 20, // TBD/playtesting
  better: 35, // TBD/playtesting -- more Data for a harder, better-rewarded fight
};

export function dataForTier(tier: RewardTier): number {
  return tier === 'none' ? 0 : DATA_BY_TIER[tier];
}
