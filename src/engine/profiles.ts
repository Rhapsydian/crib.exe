import type { RunOptions } from './run';
import { synergyAwareMapBurnerStrategy } from './run';
import { synergyAwareAcquisition, synergyAwareReorder, acquireSubroutineWithSwap } from './loadout';
import { synergyAwareShopStrategy, synergyAwareModShopStrategy, synergyAwareBurnerShopStrategy, synergyAwareShopBurnerStrategy } from './shop';
import { synergyAwareModAcquisition } from './mods';
import { synergyAwareBurnerAcquisition } from './burners';
import { synergyAwareMergeTarget } from './merge';
import { synergyAwareEventChoice } from './encounters';
import { synergyAwareCombatBurnerActivation } from './combat';
import { neverActivateBurner } from './combat';

/**
 * Named scripted-player profiles (session 46, Gameplay Simulation
 * Heuristics checkpoint J).
 *
 * Every strategy this session added is individually opt-in, and every
 * engine default stayed exactly where it was -- which is correct for the
 * engine but useless for a sweep, where the point is to run one coherent
 * "smart player" against the same content the dumb defaults face. This
 * module is that bundle, and the single definition both scripts/sweep.ts
 * and scripts/layer-funnel.ts share rather than each assembling their own
 * (which would drift the moment one of them gained a strategy the other
 * didn't).
 *
 * Lives in its own module rather than in run.ts deliberately: assembling
 * a profile means importing values from shop.ts, mods.ts, burners.ts,
 * merge.ts, encounters.ts and combat.ts, several of which import run.ts
 * themselves. Keeping the bundle downstream of everything it references
 * means no module here needs to know a profile exists.
 *
 * Traversal and Safehouse are deliberately NOT included -- those are the
 * separate `--traversal=opportunistic` profile (session 39's
 * opportunisticTraversal/opportunisticSafehouseStrategy pair), which
 * combines with this one rather than being subsumed by it. The two dials
 * stay independent so a sweep can isolate which half moved a number.
 */

/** Gamble-tier Event choices are allowed, but only below half of this
 * run's own max Heat -- reusing HEAT_HIGH_FRACTION's own framing so the
 * profile shares one notion of "safe enough to take a risk" with
 * opportunisticSafehouseStrategy/opportunisticTraversal rather than
 * inventing a second. TBD/playtesting, same as every other numeric
 * constant in this project. The permissive tier cap is deliberate: a
 * tighter cap would leave the gamble path unexercised by every sweep,
 * which is how it went unmeasured this long.
 */
export const SYNERGY_EVENT_RISK = { maxRiskTier: 'gamble', gambleSafetyMargin: 0.5 } as const;

/**
 * The "synergy-aware player" profile: every checkpoint B-I strategy
 * wired together. Spread into a playRun call over the top of seed/class/
 * traversal, e.g.
 *
 *   playRun({ seed, classId, ...SYNERGY_AWARE_PROFILE })
 *
 * Deliberately typed as a Partial<RunOptions> subset rather than a
 * function, so a caller can still override any single field after
 * spreading it -- an ablation sweep turning exactly one strategy back to
 * its dumb default is the obvious next diagnostic once this lands.
 */
export const SYNERGY_AWARE_PROFILE: Omit<RunOptions, 'seed'> = {
  // Checkpoint B/C/D -- the three acquisition ladders, reward side.
  acquisitionStrategy: synergyAwareAcquisition,
  modAcquisitionStrategy: synergyAwareModAcquisition,
  burnerAcquisitionStrategy: synergyAwareBurnerAcquisition,
  // Checkpoint B/C/D -- the same three ladders, Shop side.
  shopStrategy: synergyAwareShopStrategy,
  modShopStrategy: synergyAwareModShopStrategy,
  burnerShopStrategy: synergyAwareBurnerShopStrategy,
  // Checkpoint E -- Merge target (rank-cap aware, so a Safehouse visit
  // that can't merge falls back to Rest instead of wasting itself).
  mergeTargetStrategy: synergyAwareMergeTarget,
  // Checkpoint F/G -- firing order, and swap-out on a full loadout.
  reorderStrategy: synergyAwareReorder,
  subroutineAcquirer: acquireSubroutineWithSwap,
  // Checkpoint H -- Burner activation, all three contexts. Side 1 is the
  // enemy, which has no Burner economy and keeps the never-fire default.
  burnerActivationStrategies: [synergyAwareCombatBurnerActivation, neverActivateBurner],
  mapBurnerStrategy: synergyAwareMapBurnerStrategy,
  shopBurnerStrategy: synergyAwareShopBurnerStrategy,
  // Checkpoint I -- Event risk tolerance.
  eventChoiceStrategy: synergyAwareEventChoice(SYNERGY_EVENT_RISK),
  // Reroll strategies are deliberately left at their defaults: session
  // 45 scoped no new heuristic for them, and rerollIfNothingAffordable
  // is already a sensible rule rather than a legal-not-good placeholder.
};
