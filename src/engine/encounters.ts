import type { MapNode, NodeState } from './map-types';
import type { Rng } from './rng';
import type { SubroutineDefinition } from './subroutine-types';
import type { RunPlayerState } from './run';
import { playCombat, type BurnerActivationStrategy } from './combat';
import { discardSkillStrategy, pegSkillStrategy } from './ai';
import { discardLowestTwo, type DiscardStrategy } from './deal';
import { playLowestLegal, type PlayStrategy } from './pegging';
import { heatFromLoss } from './heat';
import { drawRewardOptions, drawUpgradedRewardOptions, rewardPoolForClass, rarityOf, type RewardTier, type Rarity } from './rewards';
import { dataForTier } from './data';
import { pickMergeTarget, preferMergeWhenAvailable, type SafehouseStrategy } from './merge';
import { pickRegularOrEliteEnemy, gatekeeperEnemyForNode, enemySkill, ENEMY_ROSTER, type EnemyDefinition, type EnemyId } from './enemies';
import {
  shopOfferingsForClass,
  modOfferingsForClass,
  burnerOfferingsForClass,
  buyCheapestAffordable,
  buyCheapestAffordableMod,
  buyCheapestAffordableBurner,
  rerollIfNothingAffordable,
  rerollModIfNothingAffordable,
  rerollBurnerIfNothingAffordable,
  neverActivateShopBurner,
  REROLL_COST,
  type ShopOffering,
  type ShopStrategy,
  type ShopRerollStrategy,
  type ModOffering,
  type ModShopStrategy,
  type ModShopRerollStrategy,
  type BurnerOffering,
  type BurnerShopStrategy,
  type BurnerShopRerollStrategy,
  type ShopBurnerStrategy,
} from './shop';
import type { ModDefinition, ModId } from './mod-types';
import { drawModRewardOptions, applyOnWinEncounterResolvedMods, shopModifiersForOwnedMods, modPoolForClass } from './mods';
import type { BurnerId, BurnerDefinition } from './burner-types';
import { BURNER_DEFINITIONS, shopModifiersForActivatedBurner, drawBurnerRewardOptions, generalBurnerPool } from './burners';
import type { ClassId } from './classes';
import type { EventDefinition, EventChoice, Grant } from './event-types';
import { EVENT_ROSTER } from './events';

/**
 * Node encounter resolution (session 19/20 checkpoint E, player loadout
 * wired in at Phase 4 checkpoint A; real enemy selection/skill-dial
 * wired in at Phase 5 checkpoint C): the point where Phase 3 calls Phase
 * 2's real playCombat() rather than an injected win/loss stub, against a
 * real named enemy (enemies.ts) instead of the old flat single-piece
 * dummy loadouts.
 */

const REST_HEAT_REDUCTION = 20; // TBD/playtesting

// Phase 5 checkpoint C replaced the old flat single-burst-per-tier
// dummy loadouts with real named-enemy selection (enemies.ts) -- see
// resolveFight below. GAUGE_THRESHOLD/WIN_THRESHOLD/FIGHT_MAX_HANDS
// were tuned against the old flat shape (Phase 4 checkpoint E); real
// per-enemy retuning against the actual roster is checkpoint E's job.
const GAUGE_THRESHOLD = 8;
// Same empirical sweep as above -- 50 gave fast (~10-25 hand),
// consistent convergence across the whole competitive magnitude range
// while still leaving enough resolution for the amount-differences
// between tiers to matter. TBD/playtesting, same as every numeric
// constant in this project, but now grounded in the new model's actual
// behavior rather than carried over from the old one.
const WIN_THRESHOLD = 50;

export interface EncounterOutcome {
  newState: NodeState;
  heatDelta: number;
  quarantined: boolean;
  rewardTier: RewardTier;
  /** Data awarded, tiered via rewardTier (data.ts) -- 0 for any non-win
   * outcome. */
  dataAwarded: number;
  /** The subroutine-choice reward actually offered (rewards.ts),
   * rarity-weighted by rewardTier -- empty for any non-win outcome.
   * Not yet installed/benched anywhere; Checkpoint D is what a script
   * does with an offer like this. */
  rewardOptions: SubroutineDefinition[];
  /** The subroutine id a Safehouse Merge action spent material on, or
   * null for a Rest visit (or any non-Safehouse node) -- checkpoint E.
   * The actual mutation (merge.ts's mergeSubroutine) happens in
   * playRun(), which owns RunPlayerState; this just records which id it
   * should apply to. */
  mergeTargetId: string | null;
  /** What a Shop visit bought, or null for a decline (or any non-Shop
   * node) -- checkpoint F. Same split as mergeTargetId: this just
   * records the pick; playRun() applies the actual Data spend and
   * acquisition, since it's the one place holding RunPlayerState. */
  shopPurchase: ShopOffering | null;
  /** REROLL_COST if a Shop visit spent Data to reroll its slate once,
   * else 0 -- checkpoint F follow-up. Same split as the other
   * playerState-affecting fields: this just records the cost incurred;
   * playRun() applies it. */
  rerollCost: number;
  /** The additive Mod-choice reward actually offered on an elite/
   * gatekeeper win (Phase 5 Mods checkpoint G) -- empty for a regular
   * win, a loss, or any non-fight outcome. Never competes with
   * rewardOptions; playRun() applies whichever (if either) gets picked. */
  modRewardOptions: ModDefinition[];
  /** What a Shop visit bought from the Mod slate, or null -- mirrors
   * shopPurchase for the parallel, independently-generated/rerolled Mod
   * slate (session 30). */
  modShopPurchase: ModOffering | null;
  /** REROLL_COST if a Shop visit spent Data to reroll the Mod slate
   * once, else 0 -- mirrors rerollCost for the Mod slate's own
   * independent reroll decision. */
  modRerollCost: number;
  /** Which carried Burner(s) side 0 actually activated during this
   * encounter's combat, if any -- Phase 5 Burners checkpoint B, mirrors
   * CombatResult.burnersUsedThisCombat straight through. Always empty
   * for a non-fight outcome (Safehouse/Shop/Event -- no combat
   * happened). run.ts's loop uses this to remove used Burners from
   * RunPlayerState.carriedBurnerIds once the encounter resolves. */
  burnersUsedThisCombat: BurnerId[];
  /** Which carried shop-context "coupon" Burner (if any) was spent on
   * this Shop visit -- Phase 5 Burners checkpoint E. Always null for any
   * non-Shop node. Same "recorded, not applied" split as shopPurchase/
   * modShopPurchase: run.ts's loop removes it from RunPlayerState.
   * carriedBurnerIds since resolveEncounter is a pure function that
   * doesn't hold RunPlayerState itself. */
  shopBurnerUsed: BurnerId | null;
  /** The additive Burner-choice reward actually offered on a fight win --
   * Phase 5 Burners checkpoint F. Unlike modRewardOptions (elite/
   * gatekeeper only), offered on **every** fight tier including regular
   * (DESIGN.md's Burners section). Empty for a loss, a non-win outcome,
   * or any non-fight node. */
  burnerRewardOptions: BurnerDefinition[];
  /** What a Shop visit bought from the Burner slate, or null -- mirrors
   * shopPurchase/modShopPurchase for the third, independently-generated/
   * rerolled slate (checkpoint F). */
  burnerShopPurchase: BurnerOffering | null;
  /** REROLL_COST (or 0 if Loyalty Token's freeReroll was active) if a
   * Shop visit spent Data to reroll the Burner slate once -- mirrors
   * rerollCost/modRerollCost for the Burner slate's own independent
   * reroll decision. */
  burnerRerollCost: number;
  /** What an Event's resolved choice granted, if anything -- checkpoint
   * H. Deliberately optional and distinct in shape from *RewardOptions
   * (burnerRewardOptions/modRewardOptions/rewardOptions): an Event grant
   * is a direct single item a script never picks between, not an
   * offered N-of-M choice, so there's no parallel acquisition-strategy
   * step in run.ts -- the grant (if any) is just applied outright. Only
   * ever set on an 'event' node; every other node omits the field
   * entirely rather than setting it to an empty object. */
  eventGrant?: { subroutine?: SubroutineDefinition; mod?: ModDefinition; burner?: BurnerDefinition };
}

type FightKind = 'regular' | 'elite' | 'gatekeeper';

// The two-gauge redesign's race-to-threshold dynamics converge fast and
// consistently (empirically ~10-25 hands at the magnitudes above, even
// at the extremes of the swept range) -- a generous but no longer
// enormous margin over that. Escalation (checkpoint B) starts at hand
// 100 as a backstop for any matchup this placeholder tuning didn't
// anticipate (e.g. a heavily-grown late-run loadout), well under this.
const FIGHT_MAX_HANDS = 5_000;

/** Picks the real named enemy for this fight (enemies.ts, checkpoint C):
 * gatekeeper reads the identity map-gen already fixed onto the node;
 * regular/elite pick randomly from the eligible tier+layer pool
 * (or the opener-window override), every time. `enemyIdOverride` is a
 * test-only escape hatch (same treatment as run.ts's
 * installedLoadoutOverride/this file's discardStrategies) -- real
 * content varies enough in solo offense (some kits, by design, mirror
 * the player-side Ghost class's "never wins outright alone" property)
 * that a test needing a *specific*, reliably-offensive or reliably-weak
 * matchup can't depend on the random tier/layer pick landing on one. */
function enemyForFight(kind: FightKind, node: MapNode, layerIndex: number, fightNumber: number, rng: Rng, enemyIdOverride?: EnemyId): EnemyDefinition {
  if (enemyIdOverride) {
    const found = ENEMY_ROSTER.find((e) => e.id === enemyIdOverride);
    if (!found) throw new Error(`encounters.ts: no enemy with id "${enemyIdOverride}"`);
    return found;
  }
  return kind === 'gatekeeper' ? gatekeeperEnemyForNode(node) : pickRegularOrEliteEnemy(kind, layerIndex, fightNumber, rng);
}

/** Builds this fight's discard/play strategies from the enemy's
 * skill-dial level -- only when the caller didn't already supply an
 * explicit override. The session-24 test escape hatch stays
 * authoritative: an explicit override always wins outright, real
 * content only ever supplies a *default*. */
function strategiesForFight(
  kind: FightKind,
  layerIndex: number,
  fightNumber: number,
  discardStrategies?: [DiscardStrategy, DiscardStrategy],
  playStrategies?: [PlayStrategy, PlayStrategy],
): { discardStrategies?: [DiscardStrategy, DiscardStrategy]; playStrategies?: [PlayStrategy, PlayStrategy] } {
  if (discardStrategies || playStrategies) return { discardStrategies, playStrategies };
  // Only the enemy (side 1) gets a skill-derived strategy -- side 0
  // (the player) keeps playCombat's own baseline default exactly
  // (discardLowestTwo/playLowestLegal), same as before this checkpoint.
  const skill = enemySkill(kind, layerIndex, fightNumber);
  return {
    discardStrategies: [discardLowestTwo, discardSkillStrategy(skill)],
    playStrategies: [playLowestLegal, pegSkillStrategy(skill)],
  };
}

function resolveFight(
  kind: FightKind,
  node: MapNode,
  layerIndex: number,
  fightNumber: number,
  rng: Rng,
  playerState: RunPlayerState,
  discardStrategies?: [DiscardStrategy, DiscardStrategy],
  playStrategies?: [PlayStrategy, PlayStrategy],
  enemyIdOverride?: EnemyId,
  /** Per-side combat-context Burner activation (checkpoint C's own
   * mechanism, threaded all the way through here -- checkpoint J
   * verification caught that resolveFight never actually passed this to
   * playCombat, meaning a real playRun fight had no way to reach it at
   * all until now). Defaults to playCombat's own [neverActivateBurner,
   * neverActivateBurner] when omitted. */
  burnerActivationStrategies?: [BurnerActivationStrategy, BurnerActivationStrategy],
): EncounterOutcome {
  const enemy = enemyForFight(kind, node, layerIndex, fightNumber, rng, enemyIdOverride);
  const strategies = strategiesForFight(kind, layerIndex, fightNumber, discardStrategies, playStrategies);
  const seed = rng.nextInt(2 ** 31);
  const result = playCombat([playerState.installedLoadout, enemy.loadout], {
    seed,
    gaugeThreshold: GAUGE_THRESHOLD,
    winThreshold: WIN_THRESHOLD,
    maxHands: FIGHT_MAX_HANDS,
    classId: playerState.classId,
    enemyPassiveIds: enemy.passiveIds,
    ownedModIds: playerState.ownedModIds,
    // Filtered to combat-context Burners only -- a carried map/shop-only
    // Burner has nothing to activate here (checkpoint C).
    carriedBurnerIds: playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('combat')),
    discardStrategies: strategies.discardStrategies,
    playStrategies: strategies.playStrategies,
    burnerActivationStrategies,
  });

  if (result.winner === 0) {
    const rewardTier: RewardTier = kind === 'regular' ? 'standard' : 'better';
    // Additive Mod-choice reward on elite/gatekeeper wins only (session
    // 30) -- never on a regular win, alongside Petty Cache/Black Budget's
    // onEncounterResolved hooks (Phase 5 Mods checkpoint E).
    const modRewardOptions = kind === 'regular' ? [] : drawModRewardOptions(playerState.classId, playerState.ownedModIds, rng);
    // Additive Burner-choice reward on EVERY fight tier including regular
    // (checkpoint F -- unlike modRewardOptions above, no kind gate).
    const burnerRewardOptions = drawBurnerRewardOptions(rng);
    const modified = applyOnWinEncounterResolvedMods(
      playerState.ownedModIds,
      dataForTier(rewardTier),
      drawRewardOptions(playerState.classId, rewardTier, rng),
      kind,
      rng,
      (r) => drawUpgradedRewardOptions(playerState.classId, r),
    );
    return {
      newState: 'inert',
      heatDelta: result.playerHeatGenerated,
      quarantined: false,
      rewardTier,
      dataAwarded: modified.dataAwarded,
      rewardOptions: modified.rewardOptions,
      mergeTargetId: null,
      shopPurchase: null,
      rerollCost: 0,
      modRewardOptions,
      modShopPurchase: null,
      modRerollCost: 0,
      burnersUsedThisCombat: result.burnersUsedThisCombat,
      shopBurnerUsed: null,
      burnerRewardOptions,
      burnerShopPurchase: null,
      burnerRerollCost: 0,
    };
  }
  if (kind === 'gatekeeper') {
    // Quarantine ends the run outright -- no Heat cost, and the node's
    // state doesn't matter (there's no run left to route around it in).
    return {
      newState: 'unresolved',
      heatDelta: 0,
      quarantined: true,
      rewardTier: 'none',
      dataAwarded: 0,
      rewardOptions: [],
      mergeTargetId: null,
      shopPurchase: null,
      rerollCost: 0,
      modRewardOptions: [],
      modShopPurchase: null,
      modRerollCost: 0,
      burnersUsedThisCombat: result.burnersUsedThisCombat,
      shopBurnerUsed: null,
      burnerRewardOptions: [],
      burnerShopPurchase: null,
      burnerRerollCost: 0,
    };
  }
  return {
    newState: 'closed',
    heatDelta: heatFromLoss(kind, result.peakFillFraction[0]) + result.playerHeatGenerated,
    quarantined: false,
    rewardTier: 'none',
    dataAwarded: 0,
    rewardOptions: [],
    mergeTargetId: null,
    shopPurchase: null,
    rerollCost: 0,
    modRewardOptions: [],
    modShopPurchase: null,
    modRerollCost: 0,
    burnersUsedThisCombat: result.burnersUsedThisCombat,
    shopBurnerUsed: null,
    burnerRewardOptions: [],
    burnerShopPurchase: null,
    burnerRerollCost: 0,
  };
}

// ---------------------------------------------------------------------
// Event choice resolution (Phase 5 Events checkpoint H) -- lives
// directly here rather than in events.ts (which is roster data only) or
// event-types.ts (pure types), matching this checkpoint's own file-
// organization note: no registry/hook-fan-out shape here the way Mods
// needed one.
// ---------------------------------------------------------------------

/** Decides which of an Event's choices a script takes -- mirrors
 * ShopStrategy/AcquisitionStrategy's "legal-not-good scripted decision"
 * shape, but picks from a fixed list rather than an offered slate. */
export type EventChoiceStrategy = (event: EventDefinition, playerState: RunPlayerState) => EventChoice;

/** Legal-not-good default: always takes the first listed choice, no
 * risk/reward judgment. */
export const alwaysFirstEventChoice: EventChoiceStrategy = (event) => event.choices[0];

/** Rolls one of a choice's weighted outcomes against `rng` -- a
 * `transparent` choice's single outcome (probability 1) always "rolls"
 * true on the first iteration, so this needs no special-casing per risk
 * tier. Same cumulative-roll-with-fallback shape as rewards.ts's/
 * mods.ts's/burners.ts's own weighted-sampling helpers, guarding against
 * a probability sum that lands a hair under 1 by floating-point error. */
function rollWeightedOutcome(outcomes: EventChoice['outcomes'], rng: Rng): EventChoice['outcomes'][number] {
  let roll = rng.next();
  for (const outcome of outcomes) {
    roll -= outcome.probability;
    if (roll <= 0) return outcome;
  }
  return outcomes[outcomes.length - 1];
}

/** Resolves a subroutineGrant -- a named piece outright, or a uniform
 * random pick from the player's class reward pool filtered by rarity
 * (rewards.ts's rewardPoolForClass/rarityOf, the same pool combat
 * rewards draw from). Undefined if a randomFromRarity draw finds nothing
 * at that rarity for this class -- a real possibility for a narrow pool,
 * treated as "no grant" rather than throwing. */
function resolveSubroutineGrant(grant: Grant<SubroutineDefinition>, classId: ClassId, rng: Rng): SubroutineDefinition | undefined {
  if ('specific' in grant) return grant.specific;
  const filtered = rewardPoolForClass(classId).filter((piece) => rarityOf(piece.id) === grant.randomFromRarity);
  if (filtered.length === 0) return undefined;
  return filtered[rng.nextInt(filtered.length)];
}

/** Mirrors resolveSubroutineGrant for Mods -- modPoolForClass (mods.ts)
 * already excludes owned ids, so a randomFromRarity draw never hands
 * back a duplicate. */
function resolveModGrant(grant: Grant<ModDefinition>, classId: ClassId, ownedModIds: ModId[], rng: Rng): ModDefinition | undefined {
  if ('specific' in grant) return grant.specific;
  const filtered = modPoolForClass(classId, ownedModIds).filter((mod) => mod.rarity === grant.randomFromRarity);
  if (filtered.length === 0) return undefined;
  return filtered[rng.nextInt(filtered.length)];
}

/** Mirrors resolveSubroutineGrant/resolveModGrant for Burners -- no
 * class scoping needed (archetype-agnostic pool, same as checkpoint F's
 * burnerOfferingsForClass). */
function resolveBurnerGrant(grant: Grant<BurnerDefinition>, rng: Rng): BurnerDefinition | undefined {
  if ('specific' in grant) return grant.specific;
  const filtered = generalBurnerPool().filter((burner) => burner.rarity === grant.randomFromRarity);
  if (filtered.length === 0) return undefined;
  return filtered[rng.nextInt(filtered.length)];
}

export function resolveEncounter(
  node: MapNode,
  rng: Rng,
  playerState: RunPlayerState,
  safehouseStrategy: SafehouseStrategy = preferMergeWhenAvailable,
  shopStrategy: ShopStrategy = buyCheapestAffordable,
  shopRerollStrategy: ShopRerollStrategy = rerollIfNothingAffordable,
  /** Test-only escape hatch (session 24, tunable-skill AI checkpoint A) --
   * an explicit override always wins outright over the real skill-dial
   * default checkpoint C now computes from the enemy/layer (see
   * strategiesForFight above). */
  discardStrategies?: [DiscardStrategy, DiscardStrategy],
  playStrategies?: [PlayStrategy, PlayStrategy],
  /** Which layer this node lives in (checkpoint C) -- feeds both
   * eligibleEnemies' minLayer filter and the skill-dial formula.
   * Defaults to 1 for any pre-checkpoint-C caller (none currently
   * exist outside tests that don't care). */
  layerIndex: number = 1,
  /** How many real combats this run has already resolved (checkpoint A/
   * C's opener-window fight counter) -- 0 means this is the very first
   * fight of the run. */
  fightNumber: number = 0,
  /** Test-only escape hatch (checkpoint D) -- forces a specific named
   * enemy instead of the real tier/layer selection, for tests that need
   * a matchup guaranteed to be reliably offensive (or reliably weak),
   * not whichever real enemy the random pick happens to land on. */
  enemyIdOverride?: EnemyId,
  /** Mirrors shopStrategy/shopRerollStrategy for the parallel Mod slate
   * (Phase 5 Mods checkpoint G) -- appended at the end rather than
   * inserted alongside the subroutine-shop params above, so every
   * existing positional call site stays valid unchanged. */
  modShopStrategy: ModShopStrategy = buyCheapestAffordableMod,
  modShopRerollStrategy: ModShopRerollStrategy = rerollModIfNothingAffordable,
  /** Which (if any) carried shop-context "coupon" Burner a script spends
   * on a Shop visit (checkpoint E) -- same append-at-the-end treatment
   * as modShopStrategy/modShopRerollStrategy above. Defaults to
   * neverActivateShopBurner. */
  shopBurnerStrategy: ShopBurnerStrategy = neverActivateShopBurner,
  /** Mirrors shopStrategy/shopRerollStrategy (and modShopStrategy/
   * modShopRerollStrategy) for the Burner slate's own third independent
   * draw/reroll -- checkpoint F. Defaults to buyCheapestAffordableBurner/
   * rerollBurnerIfNothingAffordable. */
  burnerShopStrategy: BurnerShopStrategy = buyCheapestAffordableBurner,
  burnerShopRerollStrategy: BurnerShopRerollStrategy = rerollBurnerIfNothingAffordable,
  /** Which of an Event's choices a script takes (checkpoint H) --
   * same append-at-the-end treatment as every prior checkpoint's new
   * strategy param. Defaults to alwaysFirstEventChoice. */
  eventChoiceStrategy: EventChoiceStrategy = alwaysFirstEventChoice,
  /** Per-side combat-context Burner activation for every real fight this
   * encounter resolves, event bonus fights included -- checkpoint J
   * verification caught that this was never threaded past combat.ts at
   * all (fixed here). Defaults to playCombat's own
   * [neverActivateBurner, neverActivateBurner] when omitted. */
  burnerActivationStrategies?: [BurnerActivationStrategy, BurnerActivationStrategy],
): EncounterOutcome {
  switch (node.type) {
    case 'regularFight':
      return resolveFight('regular', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride, burnerActivationStrategies);
    case 'eliteFight':
      return resolveFight('elite', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride, burnerActivationStrategies);
    case 'gatekeeperFight':
      return resolveFight('gatekeeper', node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, enemyIdOverride, burnerActivationStrategies);
    case 'safehouse': {
      // DESIGN.md's deliberate Rest-vs-Merge trade-off: one action per
      // visit (the node goes inert either way). Falls back to Rest if
      // the strategy chose 'merge' but nothing is actually banked to
      // spend -- 'merge' with no material would otherwise waste the
      // visit entirely.
      const targetId = safehouseStrategy(playerState) === 'merge' ? pickMergeTarget(playerState) : null;
      if (targetId) {
        return {
          newState: 'inert',
          heatDelta: 0,
          quarantined: false,
          rewardTier: 'none',
          dataAwarded: 0,
          rewardOptions: [],
          mergeTargetId: targetId,
          shopPurchase: null,
          rerollCost: 0,
          modRewardOptions: [],
          modShopPurchase: null,
          modRerollCost: 0,
          burnersUsedThisCombat: [],
          shopBurnerUsed: null,
          burnerRewardOptions: [],
          burnerShopPurchase: null,
          burnerRerollCost: 0,
        };
      }
      return {
        newState: 'inert',
        heatDelta: -REST_HEAT_REDUCTION,
        quarantined: false,
        rewardTier: 'none',
        dataAwarded: 0,
        rewardOptions: [],
        mergeTargetId: null,
        shopPurchase: null,
        rerollCost: 0,
        modRewardOptions: [],
        modShopPurchase: null,
        modRerollCost: 0,
        burnersUsedThisCombat: [],
        shopBurnerUsed: null,
        burnerRewardOptions: [],
        burnerShopPurchase: null,
        burnerRerollCost: 0,
      };
    }
    case 'shop': {
      // Shop-context Burner activation (checkpoint E), decided before
      // either slate is generated -- same timing as Vendor Discount/Bulk
      // Buyer's own onShopSlateGenerated hook below, just a one-shot
      // carried item instead of a standing owned Mod.
      const availableShopBurnerIds = playerState.carriedBurnerIds.filter((id) => BURNER_DEFINITIONS[id].contexts.includes('shop'));
      const chosenShopBurnerId =
        availableShopBurnerIds.length > 0 ? shopBurnerStrategy(availableShopBurnerIds, playerState) : null;
      const activatedShopBurner =
        chosenShopBurnerId && availableShopBurnerIds.includes(chosenShopBurnerId) ? BURNER_DEFINITIONS[chosenShopBurnerId] : undefined;
      const shopBurnerUsed = activatedShopBurner ? activatedShopBurner.id : null;
      const burnerModifiers = shopModifiersForActivatedBurner(activatedShopBurner);

      // Vendor Discount/Bulk Buyer (Phase 5 Mods checkpoint E) apply to
      // both independent slates equally -- a Shop-wide effect, not
      // subroutine-only. A Burner coupon's discount doesn't stack with
      // Vendor Discount (the larger of the two applies, not a compounded
      // multiply -- see burners.ts's shopModifiersForActivatedBurner).
      const { discountFraction: modDiscountFraction, extraCommons } = shopModifiersForOwnedMods(playerState.ownedModIds);
      const discountFraction = Math.max(modDiscountFraction, burnerModifiers.discountFraction);
      const rarityFloor = burnerModifiers.rarityFloor;
      const rerollCostThisVisit = burnerModifiers.freeReroll ? 0 : REROLL_COST;
      const firstSlate = shopOfferingsForClass(playerState.classId, rng, extraCommons, discountFraction, rarityFloor);
      // "Once": the reroll strategy is only ever asked against the
      // first slate, never against a slate it already produced.
      const rerolled = playerState.data >= REROLL_COST && shopRerollStrategy(firstSlate, playerState);
      const offerings = rerolled ? shopOfferingsForClass(playerState.classId, rng, extraCommons, discountFraction, rarityFloor) : firstSlate;
      const rerollCost = rerolled ? rerollCostThisVisit : 0;

      // The Mod slate (session 30: "two independent slates in one Shop
      // visit... both spending from the same Data pool") -- its own
      // separately-generated, separately-rerollable draw. Insider Tip's
      // rarityFloor/Loyalty Token's freeReroll apply here too -- a
      // Burner coupon is Shop-wide, same as Vendor Discount/Bulk Buyer.
      const firstModSlate = modOfferingsForClass(playerState.classId, playerState.ownedModIds, rng, extraCommons, discountFraction, rarityFloor);
      const modRerolled = playerState.data >= REROLL_COST && modShopRerollStrategy(firstModSlate, playerState);
      const modOfferings = modRerolled
        ? modOfferingsForClass(playerState.classId, playerState.ownedModIds, rng, extraCommons, discountFraction, rarityFloor)
        : firstModSlate;
      const modRerollCost = modRerolled ? rerollCostThisVisit : 0;

      // The Burner slate (checkpoint F) -- the third independent slate,
      // same shape/reroll treatment as the Mod slate above. classId is
      // accepted for call-site symmetry only (burnerOfferingsForClass is
      // archetype-agnostic, see shop.ts's own header).
      const firstBurnerSlate = burnerOfferingsForClass(playerState.classId, rng, extraCommons, discountFraction, rarityFloor);
      const burnerSlateRerolled = playerState.data >= REROLL_COST && burnerShopRerollStrategy(firstBurnerSlate, playerState);
      const burnerOfferingsSlate = burnerSlateRerolled
        ? burnerOfferingsForClass(playerState.classId, rng, extraCommons, discountFraction, rarityFloor)
        : firstBurnerSlate;
      const burnerRerollCost = burnerSlateRerolled ? rerollCostThisVisit : 0;

      // The purchase decisions need to see the post-reroll Data balance
      // -- otherwise a strategy could "spend" the reroll cost and then
      // still buy up to the full pre-reroll balance, overspending. All
      // three rerolls (if any happened) are deducted before any
      // purchase decision is made.
      const stateAfterRerolls =
        rerollCost + modRerollCost + burnerRerollCost > 0
          ? { ...playerState, data: playerState.data - rerollCost - modRerollCost - burnerRerollCost }
          : playerState;
      const shopPurchase = shopStrategy(offerings, stateAfterRerolls);
      const stateAfterShopPurchase = shopPurchase ? { ...stateAfterRerolls, data: stateAfterRerolls.data - shopPurchase.cost } : stateAfterRerolls;
      const modShopPurchase = modShopStrategy(modOfferings, stateAfterShopPurchase);
      const stateAfterModPurchase = modShopPurchase ? { ...stateAfterShopPurchase, data: stateAfterShopPurchase.data - modShopPurchase.cost } : stateAfterShopPurchase;
      const burnerShopPurchase = burnerShopStrategy(burnerOfferingsSlate, stateAfterModPurchase);

      return {
        newState: 'inert',
        heatDelta: 0,
        quarantined: false,
        rewardTier: 'none',
        dataAwarded: 0,
        rewardOptions: [],
        mergeTargetId: null,
        shopPurchase,
        rerollCost,
        modRewardOptions: [],
        modShopPurchase,
        modRerollCost,
        burnersUsedThisCombat: [],
        shopBurnerUsed,
        burnerRewardOptions: [],
        burnerShopPurchase,
        burnerRerollCost,
      };
    }
    case 'event': {
      // Random pick at resolution time, not a persisted map-gen-time
      // assignment -- mirrors enemyForFight's regular/elite treatment
      // (gatekeeperEnemyForNode's persisted-identity treatment doesn't
      // apply here: an Event, like a regular/elite fight, is one-and-
      // done, never needing a stable identity across revisits).
      const eventDef = EVENT_ROSTER[rng.nextInt(EVENT_ROSTER.length)];
      const choice = eventChoiceStrategy(eventDef, playerState);
      const { effect } = rollWeightedOutcome(choice.outcomes, rng);

      const eventGrant: { subroutine?: SubroutineDefinition; mod?: ModDefinition; burner?: BurnerDefinition } = {};
      if (effect.subroutineGrant) eventGrant.subroutine = resolveSubroutineGrant(effect.subroutineGrant, playerState.classId, rng);
      if (effect.modGrant) eventGrant.mod = resolveModGrant(effect.modGrant, playerState.classId, playerState.ownedModIds, rng);
      if (effect.burnerGrant) eventGrant.burner = resolveBurnerGrant(effect.burnerGrant, rng);

      // Bonus fight (checkpoint I) -- a classic gamble-tier beat, reusing
      // resolveFight's existing machinery directly (same module, no
      // export needed -- checkpoint H already put Event resolution in
      // this file, so the "export it" step the spec anticipated turned
      // out unnecessary). `node` is passed through but never actually
      // consulted for a 'regular'/'elite' kind (only gatekeeperEnemyForNode
      // reads it, gated on kind === 'gatekeeper', which a bonus fight can
      // never be -- confirmed against enemyForFight above). The Event
      // node's own newState/quarantined stay fixed (DESIGN.md: "inert
      // after one resolved encounter, same as every other stub node
      // type") regardless of whether the bonus fight is won or lost --
      // losing a bonus fight costs Heat like any lost fight, it just
      // doesn't close the Event tile itself the way a real lost
      // regular/eliteFight node would. Not folded into run.ts's
      // fightsResolved opener-window counter -- a deliberate, narrow-
      // scope call (the checkpoint's own text scopes this to producing a
      // correct EncounterOutcome, not to opener-window bookkeeping),
      // banked as a real open question rather than silently decided.
      const bonusFightOutcome = effect.bonusFight
        ? resolveFight(effect.bonusFight.tier, node, layerIndex, fightNumber, rng, playerState, discardStrategies, playStrategies, undefined, burnerActivationStrategies)
        : undefined;

      return {
        newState: 'inert',
        heatDelta: (effect.heatDelta ?? 0) + (bonusFightOutcome?.heatDelta ?? 0),
        quarantined: false,
        rewardTier: bonusFightOutcome?.rewardTier ?? 'none',
        dataAwarded: (effect.dataDelta ?? 0) + (bonusFightOutcome?.dataAwarded ?? 0),
        rewardOptions: bonusFightOutcome?.rewardOptions ?? [],
        mergeTargetId: null,
        shopPurchase: null,
        rerollCost: 0,
        modRewardOptions: bonusFightOutcome?.modRewardOptions ?? [],
        modShopPurchase: null,
        modRerollCost: 0,
        burnersUsedThisCombat: bonusFightOutcome?.burnersUsedThisCombat ?? [],
        shopBurnerUsed: null,
        burnerRewardOptions: bonusFightOutcome?.burnerRewardOptions ?? [],
        burnerShopPurchase: null,
        burnerRerollCost: 0,
        eventGrant,
      };
    }
    case 'relay':
      throw new Error('resolveEncounter should never be called on a Relay node -- it has no encounter');
  }
}
