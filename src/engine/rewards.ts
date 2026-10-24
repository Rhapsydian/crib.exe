import { ARCHETYPES, type Archetype, type SubroutineDefinition } from './subroutine-types';
import type { ClassId } from './classes';
import { CLASS_DEFINITIONS } from './classes';
import { ARCHETYPE_POOLS } from './subroutines';
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
  for (const pool of Object.values(ARCHETYPE_POOLS)) {
    for (const piece of pool.commons) map[piece.id] = 'common';
    for (const piece of pool.uncommons) map[piece.id] = 'uncommon';
    for (const piece of pool.rares) map[piece.id] = 'rare';
  }
  return map;
}

const RARITY_BY_ID: Record<string, Rarity> = buildRarityById();

/** Rarity for any subroutine id -- 'common' for anything outside the
 * archetype pools (a Mod's granted subroutine, a test fixture). */
export function rarityOf(id: string): Rarity {
  return RARITY_BY_ID[id] ?? 'common';
}

/**
 * How much less likely an off-class piece is to be offered than an
 * on-class one of the same rarity (session 51). DESIGN.md: a class draws
 * "primarily from its 2 specialized archetypes, with occasional off-class
 * picks from the other two" -- primarily, not exclusively, so a class can
 * still stumble into the other half of the game.
 *
 * Replaces the two mechanisms that used to supply off-class pieces: the
 * universal Cantrips (one Always-triggered common per archetype -- under
 * D11 every piece fires every turn, so a Cantrip is no longer a distinct
 * kind of piece) and the Neutral pool (removed with the Neutral
 * archetype). TBD/playtesting, like every number here.
 */
export const OFF_CLASS_WEIGHT = 0.2;

function allRarities(archetype: Archetype): SubroutineDefinition[] {
  const pool = ARCHETYPE_POOLS[archetype];
  return [...pool.commons, ...pool.uncommons, ...pool.rares];
}

function dedupeById(pieces: SubroutineDefinition[]): SubroutineDefinition[] {
  const seen = new Set<string>();
  return pieces.filter((piece) => (seen.has(piece.id) ? false : (seen.add(piece.id), true)));
}

/** A class's own reward pool: both of its archetypes' pools, all 3
 * rarities, plus its own starting loadout (a class's own pieces stay in
 * its own pool -- drawing a duplicate becomes Merge material later, not
 * a wasted offer). De-duplicated by id, since the skeleton starting
 * loadouts are pool pieces. On-class only: the Shop and Event grants
 * read this directly, and off-class pieces enter only through the
 * combat-reward draw, down-weighted (see offClassPoolForClass). */
export function rewardPoolForClass(classId: ClassId): SubroutineDefinition[] {
  const classDef = CLASS_DEFINITIONS[classId];
  return dedupeById([...classDef.startingLoadout, ...classDef.archetypes.flatMap(allRarities)]);
}

/** The other two archetypes' pools -- the "occasional off-class picks"
 * a combat reward can offer at OFF_CLASS_WEIGHT. */
export function offClassPoolForClass(classId: ClassId): SubroutineDefinition[] {
  const own = new Set<Archetype>(CLASS_DEFINITIONS[classId].archetypes);
  return ARCHETYPES.filter((archetype) => !own.has(archetype)).flatMap(allRarities);
}

/** How much likelier a subroutine the player already owns is to be
 * offered (session 66, docs/subroutines-design.md S13): copies are what
 * Merging needs, and a bigger pool made them rare. TBD/measured. */
export const OWNED_REWARD_WEIGHT = 3;

/** On-class pieces at their rarity weight, off-class ones scaled down by
 * OFF_CLASS_WEIGHT, owned ones (`ownedIds`) scaled up by
 * OWNED_REWARD_WEIGHT -- the weighted list the reward draws sample from. */
function weightedRewardPool(classId: ClassId, rarityWeights: Record<Rarity, number>, ownedIds: readonly string[] = []): { piece: SubroutineDefinition; weight: number }[] {
  const owned = (piece: SubroutineDefinition) => (ownedIds.includes(piece.id) ? OWNED_REWARD_WEIGHT : 1);
  const onClass = rewardPoolForClass(classId).map((piece) => ({ piece, weight: rarityWeights[rarityOf(piece.id)] * owned(piece) }));
  const offClass = offClassPoolForClass(classId).map((piece) => ({ piece, weight: rarityWeights[rarityOf(piece.id)] * OFF_CLASS_WEIGHT * owned(piece) }));
  return [...onClass, ...offClass];
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
export function drawRewardOptions(classId: ClassId, tier: RewardTier, rng: Rng, ownedIds: readonly string[] = []): SubroutineDefinition[] {
  if (tier === 'none') return [];
  const weights = RARITY_WEIGHTS_BY_TIER[tier];
  const weighted = weightedRewardPool(classId, weights, ownedIds);
  return weightedSampleWithoutReplacement(weighted, REWARD_OPTIONS_COUNT, rng);
}

/** A Cache's subroutines are uncommon or better (the user's playtest
 * call, session 61): 'better''s odds with the commons taken out. */
const CACHE_RARITY_WEIGHTS: Record<Rarity, number> = { common: 0, uncommon: 40, rare: 20 };

/** A Cache's subroutine choice: REWARD_OPTIONS_COUNT distinct pieces, no
 * commons (starting-loadout pieces count as commons, so they're out too). */
export function drawCacheRewardOptions(classId: ClassId, rng: Rng, ownedIds: readonly string[] = []): SubroutineDefinition[] {
  return weightedSampleWithoutReplacement(weightedRewardPool(classId, CACHE_RARITY_WEIGHTS, ownedIds), REWARD_OPTIONS_COUNT, rng);
}

// TBD/playtesting -- a real shot at rares beyond even 'better', Black
// Budget's own "upgrade rarity by one tier" (Mods checkpoint H).
const UPGRADED_RARITY_WEIGHTS: Record<Rarity, number> = { common: 20, uncommon: 40, rare: 40 };

/** Black Budget (Mods checkpoint H): re-draws a reward choice at a
 * rarity weighting even more generous than 'better', rather than adding
 * a 4th RewardTier value just for one Mod's own upgrade chance. */
export function drawUpgradedRewardOptions(classId: ClassId, rng: Rng, ownedIds: readonly string[] = []): SubroutineDefinition[] {
  const weighted = weightedRewardPool(classId, UPGRADED_RARITY_WEIGHTS, ownedIds);
  return weightedSampleWithoutReplacement(weighted, REWARD_OPTIONS_COUNT, rng);
}
