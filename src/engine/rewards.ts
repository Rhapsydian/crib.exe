import type { Archetype, SubroutineDefinition } from './subroutine-types';
import type { ClassId } from './classes';
import { CLASS_DEFINITIONS } from './classes';
import { ARCHETYPE_POOLS, NEUTRAL_POOL } from './subroutines';
import type { Rng } from './rng';

/**
 * Combat-reward pool & rarity weighting (Phase 4 checkpoint C): what a
 * won fight actually offers, replacing the RewardTier stub Phase 3 only
 * recorded. Rarity isn't a SubroutineDefinition field -- encoded
 * structurally in subroutines.ts via which array a piece lives in (see
 * that file's header) -- so this file derives a lookup from it.
 */

export type Rarity = 'common' | 'uncommon' | 'rare';

/** What tier of reward a won fight grants -- a regular fight offers a
 * standard choice, an elite or gatekeeper fight offers a better one
 * (DESIGN.md's own reward-scoping language). Lives here rather than
 * encounters.ts, since Data award and rarity weighting both key off it
 * and encounters.ts needs to import both -- keeping the type in
 * encounters.ts would make that a circular import. */
export type RewardTier = 'none' | 'standard' | 'better';

function buildRarityById(): Record<string, Rarity> {
  const map: Record<string, Rarity> = {};
  // NEUTRAL_POOL stays out of ARCHETYPE_POOLS proper (it has no suit and
  // no class specializes in it) but is included here, and since session
  // 46 in rewardPoolForClass below too -- the "real acquisition is still
  // banked" note this comment used to carry turned out to describe a bug
  // rather than a decision, and is resolved.
  for (const pool of [...Object.values(ARCHETYPE_POOLS), NEUTRAL_POOL]) {
    for (const piece of pool.commons) map[piece.id] = 'common';
    for (const piece of pool.uncommons) map[piece.id] = 'uncommon';
    for (const piece of pool.rares) map[piece.id] = 'rare';
  }
  return map;
}

const RARITY_BY_ID: Record<string, Rarity> = buildRarityById();

/** Rarity for any subroutine id -- 'common' for anything outside the
 * archetype pools (the 18 class starting-loadout pieces have no
 * authored rarity of their own; treated as common, matching their
 * deliberately simple onboarding-piece design). */
export function rarityOf(id: string): Rarity {
  return RARITY_BY_ID[id] ?? 'common';
}

/** The 4 pool-level Cantrips (one per archetype, Always-triggered,
 * common) -- DESIGN.md's "universal Chained/Cantrip pool," available to
 * every class's reward pool regardless of its own 2 archetypes, even
 * though each is still structurally tagged with one specific archetype
 * (see subroutines.ts's own header on this distinction). Identified
 * structurally (Always trigger among the commons) rather than a
 * hardcoded id list, so a future archetype's own Cantrip is picked up
 * automatically. */
function universalCantrips(): SubroutineDefinition[] {
  return Object.values(ARCHETYPE_POOLS).flatMap((pool) => pool.commons.filter((piece) => piece.trigger.kind === 'always'));
}

/** A class's full combat-reward pool: both of its own archetype pools
 * (all 3 rarities), its own starting loadout (a class's own pieces stay
 * in its own pool -- drawing a duplicate becomes Merge material later,
 * not a wasted offer), and the universal Cantrips from its OTHER 2
 * archetypes (its own archetypes' Cantrips are already included via
 * their pools). De-duplicated by id, in case a starting piece ever
 * shares an id with a pool piece (it doesn't today, but cheap to
 * guarantee). */
export function rewardPoolForClass(classId: ClassId): SubroutineDefinition[] {
  const classDef = CLASS_DEFINITIONS[classId];
  const [archetypeA, archetypeB] = classDef.archetypes;
  const ownArchetypes = new Set<Archetype>([archetypeA, archetypeB]);

  const ownPools = [archetypeA, archetypeB].flatMap((archetype) => {
    const pool = ARCHETYPE_POOLS[archetype];
    return [...pool.commons, ...pool.uncommons, ...pool.rares];
  });
  const otherCantrips = universalCantrips().filter((piece) => !ownArchetypes.has(piece.archetype));

  // The whole Neutral pool, every class, every rarity (session 46). It
  // had been unreachable through *any* acquisition path since session 28
  // -- absent from combat rewards, the Shop slate and Event grants alike,
  // since all three derive from this one function -- leaving 18 authored
  // pieces with no way into a run but a single scripted Event grant. That
  // was a real bug rather than a deliberate gating: the archetype exists
  // precisely as "a small, shared toolbox anyone can draw from"
  // (subroutine-types.ts's Archetype comment).
  //
  // Enters at full weight, no special-casing. drawRewardOptions weights
  // purely by rarity, and NEUTRAL_POOL's own 8/6/4 split is near-
  // proportional to the 28/20/12 a class's two archetype pools already
  // contribute, so the rarity distribution barely shifts -- measured at
  // +0.1pp on a standard-tier rare draw and +0.5pp on a better-tier one.
  // A reduced weight was considered and rejected: it would need
  // per-piece weighting machinery that doesn't exist, set by a number
  // with no calibration target behind it.
  const neutralPool = [...NEUTRAL_POOL.commons, ...NEUTRAL_POOL.uncommons, ...NEUTRAL_POOL.rares];

  const seen = new Set<string>();
  const combined = [...classDef.startingLoadout, ...ownPools, ...otherCantrips, ...neutralPool];
  return combined.filter((piece) => (seen.has(piece.id) ? false : (seen.add(piece.id), true)));
}

// TBD/playtesting, same convention as every other placeholder numeric
// constant in this project.
const RARITY_WEIGHTS_BY_TIER: Record<'standard' | 'better', Record<Rarity, number>> = {
  standard: { common: 70, uncommon: 25, rare: 5 },
  better: { common: 40, uncommon: 40, rare: 20 }, // a real shot at rares, per the checkpoint plan
};

export const REWARD_OPTIONS_COUNT = 3; // TBD/playtesting

/** Weighted sampling without replacement: repeatedly rolls against the
 * remaining pool's total weight, removing whatever's picked so the same
 * item can't be offered twice in one reward choice. */
function weightedSampleWithoutReplacement(
  items: { piece: SubroutineDefinition; weight: number }[],
  count: number,
  rng: Rng,
): SubroutineDefinition[] {
  const pool = items.filter((entry) => entry.weight > 0);
  const picked: SubroutineDefinition[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = rng.next() * totalWeight;
    let index = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight;
      if (roll <= 0) {
        index = j;
        break;
      }
    }
    picked.push(pool[index].piece);
    pool.splice(index, 1);
  }
  return picked;
}

/** Draws this fight's reward choice: REWARD_OPTIONS_COUNT distinct
 * subroutines from the class's full reward pool, rarity-weighted by
 * tier (regular fights skew common/uncommon; elite/gatekeeper fights
 * give a real shot at rares). Empty for a 'none' tier (a loss). */
export function drawRewardOptions(classId: ClassId, tier: RewardTier, rng: Rng): SubroutineDefinition[] {
  if (tier === 'none') return [];
  const weights = RARITY_WEIGHTS_BY_TIER[tier];
  const pool = rewardPoolForClass(classId);
  const weighted = pool.map((piece) => ({ piece, weight: weights[rarityOf(piece.id)] }));
  return weightedSampleWithoutReplacement(weighted, REWARD_OPTIONS_COUNT, rng);
}

// TBD/playtesting -- a real shot at rares beyond even 'better', Black
// Budget's own "upgrade rarity by one tier" (Mods checkpoint H).
const UPGRADED_RARITY_WEIGHTS: Record<Rarity, number> = { common: 20, uncommon: 40, rare: 40 };

/** Black Budget (Mods checkpoint H): re-draws a reward choice at a
 * rarity weighting even more generous than 'better', rather than adding
 * a 4th RewardTier value just for one Mod's own upgrade chance. */
export function drawUpgradedRewardOptions(classId: ClassId, rng: Rng): SubroutineDefinition[] {
  const pool = rewardPoolForClass(classId);
  const weighted = pool.map((piece) => ({ piece, weight: UPGRADED_RARITY_WEIGHTS[rarityOf(piece.id)] }));
  return weightedSampleWithoutReplacement(weighted, REWARD_OPTIONS_COUNT, rng);
}
