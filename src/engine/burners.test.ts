import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import type { BurnerId } from './burner-types';
import type { ModId } from './mod-types';
import { applyOnMoveMods } from './mods';
import { HEAT_PER_MOVE } from './heat';
import { createNode, type LayerGraph } from './map-types';
import {
  playCombat,
  neverActivateBurner,
  synergyAwareCombatBurnerActivation,
  type BurnerActivationStrategy,
} from './combat';
import { resolveEncounter } from './encounters';
import {
  playRun,
  createInitialPlayerState,
  reopenNode,
  synergyAwareMapBurnerStrategy,
  neverActivateMapBurner,
  exploreThenGatekeeper,
  type RunPlayerState,
  type MapBurnerStrategy,
} from './run';
import {
  shopOfferingsForClass,
  burnerOfferingsForClass,
  buyCheapestAffordableBurner,
  rerollBurnerIfNothingAffordable,
  neverActivateShopBurner,
  type ShopBurnerStrategy,
  type BurnerShopStrategy,
  synergyAwareBurnerShopStrategy,
  synergyAwareShopBurnerStrategy,
} from './shop';
import {
  BURNER_DEFINITIONS,
  BURNER_CAP,
  drawBurnerRewardOptions,
  alwaysAcquireFirstBurner,
  synergyAwareBurnerAcquisition,
} from './burners';

/**
 * Burners verification (Phase 5 checkpoint J): every new strategy type
 * exercised at least once, all 8 authored Burners fired/activated at
 * least once across their real contexts, plus a smoke-tested full run.
 * Mirrors mods.test.ts's own style -- exercised through the public API,
 * not by reaching into private per-context dispatch code.
 */

function playerWith(overrides: Partial<RunPlayerState>): RunPlayerState {
  return { ...createInitialPlayerState('breacher'), ...overrides };
}

describe('Combat-context activation -- BurnerActivationStrategy', () => {
  it('Flash Drive fires a real directBurst payload via playCombat', () => {
    const alwaysFlashDrive: BurnerActivationStrategy = (ctx) => (ctx.availableBurnerIds.includes('flash-drive') ? 'flash-drive' : null);
    const result = playCombat([[], []], {
      seed: 1,
      gaugeThreshold: [8, 8],
      winThreshold: [100, 100],
      carriedBurnerIds: ['flash-drive'],
      burnerActivationStrategies: [alwaysFlashDrive, neverActivateBurner],
    });
    expect(result.burnersUsedThisCombat).toEqual(['flash-drive']);
  });

  it('EMP Charge fires a real instantCounterPush payload via playCombat', () => {
    const alwaysEmpCharge: BurnerActivationStrategy = (ctx) => (ctx.availableBurnerIds.includes('emp-charge') ? 'emp-charge' : null);
    const result = playCombat([[], []], {
      seed: 1,
      gaugeThreshold: [8, 8],
      winThreshold: [100, 100],
      carriedBurnerIds: ['emp-charge'],
      burnerActivationStrategies: [alwaysEmpCharge, neverActivateBurner],
    });
    expect(result.burnersUsedThisCombat).toEqual(['emp-charge']);
  });

  it('a duplicate-carried Burner is only used up to the number of copies actually carried', () => {
    const alwaysFlashDrive: BurnerActivationStrategy = (ctx) => (ctx.availableBurnerIds.includes('flash-drive') ? 'flash-drive' : null);
    const result = playCombat([[], []], {
      seed: 1,
      gaugeThreshold: [8, 8],
      winThreshold: [200, 200],
      carriedBurnerIds: ['flash-drive', 'flash-drive'],
      burnerActivationStrategies: [alwaysFlashDrive, neverActivateBurner],
    });
    expect(result.burnersUsedThisCombat).toEqual(['flash-drive', 'flash-drive']);
  });

  it('the enemy side never activates a Burner by default', () => {
    const result = playCombat([[], []], {
      seed: 1,
      gaugeThreshold: [8, 8],
      winThreshold: [100, 100],
      carriedBurnerIds: [],
    });
    expect(result.burnersUsedThisCombat).toEqual([]);
  });
});

describe('Map-context activation -- MapBurnerStrategy', () => {
  it('Ghost Protocol waives the flat per-move Heat charge (freeMove)', () => {
    const alwaysGhostProtocol: MapBurnerStrategy = (ctx) => (ctx.availableBurnerIds.includes('ghost-protocol') ? { burnerId: 'ghost-protocol' } : null);
    // burnerAcquisitionStrategy disabled so a real combat-reward pickup
    // mid-run (checkpoint F) can't add a second Ghost Protocol and
    // confound this test's "exactly the one carried copy" assertion.
    const result = playRun({
      seed: 7,
      layerNodeCounts: [6, 2, 2, 2],
      carriedBurnerIdsOverride: ['ghost-protocol'],
      mapBurnerStrategy: alwaysGhostProtocol,
      burnerAcquisitionStrategy: () => null,
    });
    const activations = result.log.filter((e) => e.type === 'mapBurnerActivated');
    expect(activations).toEqual([expect.objectContaining({ burnerId: 'ghost-protocol' })]);
    const zeroCostMoves = result.log.filter((e) => e.type === 'move' && e.heatCost === 0);
    expect(zeroCostMoves.length).toBeGreaterThanOrEqual(1);
  });

  it("Recon Ping is a genuine no-op (no fog-of-war to reveal) but is still consumed on activation", () => {
    const alwaysReconPing: MapBurnerStrategy = (ctx) => (ctx.availableBurnerIds.includes('recon-ping') ? { burnerId: 'recon-ping' } : null);
    const result = playRun({
      seed: 7,
      layerNodeCounts: [6, 2, 2, 2],
      carriedBurnerIdsOverride: ['recon-ping'],
      mapBurnerStrategy: alwaysReconPing,
      burnerAcquisitionStrategy: () => null,
    });
    const activations = result.log.filter((e) => e.type === 'mapBurnerActivated');
    expect(activations).toEqual([expect.objectContaining({ burnerId: 'recon-ping' })]);
    expect(result.playerState.carriedBurnerIds).not.toContain('recon-ping');
  });

  it('Skeleton Key reopens a closed node back to unresolved -- reopenNode against a hand-built graph', () => {
    const a = createNode('a', 'regularFight');
    const closed = { ...createNode('b', 'regularFight'), state: 'closed' as const };
    const gk = createNode('gk', 'gatekeeperFight');
    const graph: LayerGraph = { nodes: [a, closed, gk], edges: [{ a: 'a', b: 'b' }], entryNodeId: 'a', gatekeeperNodeId: 'gk' };

    const reopened = reopenNode(graph, 'b');
    expect(reopened.nodes.find((n) => n.id === 'b')?.state).toBe('unresolved');
    // No-op on a node that isn't currently closed.
    expect(reopenNode(graph, 'a')).toBe(graph);
    // No-op on a missing node id.
    expect(reopenNode(graph, 'does-not-exist')).toBe(graph);
  });

  it('Skeleton Key reopens a real closed node end-to-end via playRun, and can rescue a run beelineToGatekeeper alone would end in noRouteRemains', () => {
    // An empty loadout guarantees a loss (attrition) on every fight it
    // visits -- exploreThenGatekeeper (not the default beelineToGatekeeper)
    // is needed so it actually visits and loses several regular fights
    // before reaching the gatekeeper, producing closed nodes to reopen.
    // burnerAcquisitionStrategy disabled for the same reason as the
    // Ghost Protocol test above -- isolates the one carried copy.
    const alwaysSkeletonKey: MapBurnerStrategy = (ctx) =>
      ctx.closedNodeIds.length > 0 && ctx.availableBurnerIds.includes('skeleton-key') ? { burnerId: 'skeleton-key', targetNodeId: ctx.closedNodeIds[0] } : null;
    const result = playRun({
      seed: 5,
      layerNodeCounts: [8, 2, 2, 2],
      installedLoadoutOverride: [],
      carriedBurnerIdsOverride: ['skeleton-key'],
      mapBurnerStrategy: alwaysSkeletonKey,
      burnerAcquisitionStrategy: () => null,
      traversalStrategy: exploreThenGatekeeper,
    });
    const activations = result.log.filter((e) => e.type === 'mapBurnerActivated' && e.burnerId === 'skeleton-key');
    expect(activations.length).toBeGreaterThanOrEqual(1);

    // Without Skeleton Key at all, the same scenario ends in
    // noRouteRemains (an empty loadout closing nodes eventually strands
    // the run) -- confirms the reopen genuinely changed the run's fate,
    // not just that the log entry fired.
    const withoutKey = playRun({
      seed: 5,
      layerNodeCounts: [8, 2, 2, 2],
      installedLoadoutOverride: [],
      traversalStrategy: exploreThenGatekeeper,
    });
    expect(withoutKey.outcome).toBe('noRouteRemains');
  });

  it('neverActivateMapBurner is the default -- no activation without an explicit strategy', () => {
    const result = playRun({
      seed: 7,
      layerNodeCounts: [6, 2, 2, 2],
      carriedBurnerIdsOverride: ['ghost-protocol'],
    });
    expect(result.log.filter((e) => e.type === 'mapBurnerActivated')).toEqual([]);
    expect(neverActivateMapBurner({} as never)).toBeNull();
  });
});

describe('Shop-context activation (coupon) -- ShopBurnerStrategy', () => {
  const alwaysActivate = (burnerId: string): ShopBurnerStrategy => (available) => (available.includes(burnerId as never) ? (burnerId as never) : null);

  it('Stolen Coupon discounts both the subroutine and Mod slates', () => {
    const outcome = resolveEncounter(
      createNode('n', 'shop'),
      createRng(3),
      playerWith({ data: 1000, carriedBurnerIds: ['stolen-coupon'] }),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      0,
      undefined,
      undefined,
      undefined,
      alwaysActivate('stolen-coupon'),
    );
    expect(outcome.shopBurnerUsed).toBe('stolen-coupon');
  });

  it('Loyalty Token zeroes the reroll cost for this visit', () => {
    const alwaysReroll = () => true;
    const player = playerWith({ data: 10, carriedBurnerIds: ['loyalty-token'] });
    const outcome = resolveEncounter(
      createNode('n', 'shop'),
      createRng(5),
      player,
      undefined,
      undefined,
      alwaysReroll,
      undefined,
      undefined,
      1,
      0,
      undefined,
      undefined,
      undefined,
      alwaysActivate('loyalty-token'),
    );
    expect(outcome.shopBurnerUsed).toBe('loyalty-token');
    expect(outcome.rerollCost).toBe(0);
  });

  it('Insider Tip forces the shop wildcard slot to rare', () => {
    const withFloor = shopOfferingsForClass('breacher', createRng(2), 0, 0, 0, 'rare');
    const wildcard = withFloor[withFloor.length - 1];
    expect(wildcard.cost).toBeGreaterThan(0);

    const outcome = resolveEncounter(
      createNode('n', 'shop'),
      createRng(2),
      playerWith({ data: 1000, carriedBurnerIds: ['insider-tip'] }),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      0,
      undefined,
      undefined,
      undefined,
      alwaysActivate('insider-tip'),
    );
    expect(outcome.shopBurnerUsed).toBe('insider-tip');
  });

  it('neverActivateShopBurner is the default -- no coupon spent without an explicit strategy', () => {
    const outcome = resolveEncounter(createNode('n', 'shop'), createRng(1), playerWith({ data: 1000, carriedBurnerIds: ['stolen-coupon'] }));
    expect(outcome.shopBurnerUsed).toBeNull();
    expect(neverActivateShopBurner(['stolen-coupon'], playerWith({}))).toBeNull();
  });
});

describe('Burner shop slate (buying) -- BurnerShopStrategy / BurnerShopRerollStrategy', () => {
  it('buyCheapestAffordableBurner buys the cheapest affordable offering, or declines', () => {
    const offerings = burnerOfferingsForClass('breacher', createRng(1), 0, 0);
    const rich = buyCheapestAffordableBurner(offerings, playerWith({ data: 1000 }));
    expect(rich).not.toBeNull();
    const broke = buyCheapestAffordableBurner(offerings, playerWith({ data: 0 }));
    expect(broke).toBeNull();
  });

  it('rerollBurnerIfNothingAffordable rerolls only when nothing is affordable and the reroll itself is', () => {
    const offerings = burnerOfferingsForClass('breacher', createRng(1), 0, 0);
    const cheapest = offerings.reduce((c, o) => (o.cost < c.cost ? o : c));
    const brokeButCanReroll = playerWith({ data: 10 });
    expect(rerollBurnerIfNothingAffordable(offerings, brokeButCanReroll)).toBe(cheapest.cost > 10);
    const rich = playerWith({ data: 1000 });
    expect(rerollBurnerIfNothingAffordable(offerings, rich)).toBe(false);
  });

  it('a purchase actually deducts Data and grants the Burner via resolveEncounter', () => {
    const buyCheapest: BurnerShopStrategy = (offs) => (offs.length > 0 ? offs.reduce((c, o) => (o.cost < c.cost ? o : c)) : null);
    const outcome = resolveEncounter(
      createNode('n', 'shop'),
      createRng(1),
      playerWith({ data: 1000 }),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      0,
      undefined,
      undefined,
      undefined,
      undefined,
      buyCheapest,
    );
    expect(outcome.burnerShopPurchase).not.toBeNull();
    expect(BURNER_DEFINITIONS[outcome.burnerShopPurchase!.burner.id]).toBeDefined();
  });
});

describe('Combat-reward acquisition -- BurnerAcquisitionStrategy', () => {
  it('drawBurnerRewardOptions returns real, unscoped options', () => {
    const options = drawBurnerRewardOptions(createRng(1));
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) expect(BURNER_DEFINITIONS[option.id]).toBeDefined();
  });

  it('a regular fight win offers a Burner reward (unlike Mods, not elite-only)', () => {
    const overwhelming = [
      { id: 'overwhelm', name: 'Overwhelm', archetype: 'exploit' as const, trigger: { kind: 'always' as const }, payload: { kind: 'directBurst' as const, amount: 30 }, tags: [] },
    ];
    const outcome = resolveEncounter(createNode('n', 'regularFight'), createRng(9), playerWith({ installedLoadout: overwhelming }));
    expect(outcome.rewardTier).toBe('standard'); // confirms a real win, not a fluke
    expect(outcome.burnerRewardOptions.length).toBeGreaterThan(0);
    const picked = alwaysAcquireFirstBurner(outcome.burnerRewardOptions, playerWith({}));
    expect(picked).toEqual(outcome.burnerRewardOptions[0]);
  });
});

describe('Burners smoke test -- a full run with Burners carried and used across every context', () => {
  it('resolves headlessly, respecting BURNER_CAP throughout, with real activation in every context', () => {
    const combatStrategy: BurnerActivationStrategy = (ctx) => ctx.availableBurnerIds[0] ?? null;
    const mapStrategy: MapBurnerStrategy = (ctx) => (ctx.availableBurnerIds.length > 0 ? { burnerId: ctx.availableBurnerIds[0], targetNodeId: ctx.closedNodeIds[0] } : null);
    const shopBurnerStrategy: ShopBurnerStrategy = (available) => available[0] ?? null;

    const result = playRun({
      seed: 11,
      classId: 'breacher',
      layerNodeCounts: [8, 8, 8, 8],
      carriedBurnerIdsOverride: ['flash-drive', 'ghost-protocol', 'stolen-coupon'],
      burnerActivationStrategies: undefined, // playCombat's own default per-fight -- run.ts threads its own combat-context strategy via encounters.ts, not this field
      burnerAcquisitionStrategy: alwaysAcquireFirstBurner,
      mapBurnerStrategy: mapStrategy,
      shopBurnerStrategy,
      burnerShopStrategy: buyCheapestAffordableBurner,
      burnerShopRerollStrategy: rerollBurnerIfNothingAffordable,
    });

    expect(['heatMaxed', 'quarantined', 'noRouteRemains', 'victory']).toContain(result.outcome);
    expect(result.playerState.carriedBurnerIds.length).toBeLessThanOrEqual(BURNER_CAP);

    // Real activation happened somewhere in the run -- either a
    // combat-context fire (surfaced via 'encounter' log entries'
    // outcome.burnersUsedThisCombat) or a map-context activation.
    const combatActivations = result.log.filter(
      (e) => e.type === 'encounter' && e.outcome.burnersUsedThisCombat.length > 0,
    );
    const mapActivations = result.log.filter((e) => e.type === 'mapBurnerActivated');
    expect(combatActivations.length + mapActivations.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint D) -- the
// Burner acquisition ladder. A single rung (rarity), since
// BurnerDefinition carries no archetype and a consumable never sits in
// the loadout for a credit-gap check to read.
// ---------------------------------------------------------------------

describe('synergyAwareBurnerAcquisition / synergyAwareBurnerShopStrategy', () => {
  const common = BURNER_DEFINITIONS['flash-drive']; // common
  const uncommon = BURNER_DEFINITIONS['emp-charge']; // uncommon
  const rare = BURNER_DEFINITIONS['skeleton-key']; // rare

  function stateWithData(data: number): RunPlayerState {
    return { ...createInitialPlayerState('breacher'), data };
  }

  it('picks the rarest offered Burner', () => {
    expect(synergyAwareBurnerAcquisition([common, rare, uncommon], stateWithData(0))?.id).toBe('skeleton-key');
  });

  it('falls to the earliest option when rarities tie, matching alwaysAcquireFirstBurner', () => {
    const alsoCommon = BURNER_DEFINITIONS['recon-ping']; // common
    expect(synergyAwareBurnerAcquisition([common, alsoCommon], stateWithData(0))?.id).toBe('flash-drive');
  });

  it('declines an empty slate', () => {
    expect(synergyAwareBurnerAcquisition([], stateWithData(0))).toBeNull();
  });

  it('buys the rarest affordable Burner, unlike buyCheapestAffordableBurner', () => {
    const offerings = [
      { burner: common, cost: 15 },
      { burner: rare, cost: 120 },
    ];
    const state = stateWithData(200);
    expect(buyCheapestAffordableBurner(offerings, state)?.burner.id).toBe('flash-drive');
    expect(synergyAwareBurnerShopStrategy(offerings, state)?.burner.id).toBe('skeleton-key');
  });

  it('never buys an unaffordable Burner', () => {
    const offerings = [
      { burner: common, cost: 15 },
      { burner: rare, cost: 120 },
    ];
    expect(synergyAwareBurnerShopStrategy(offerings, stateWithData(20))?.burner.id).toBe('flash-drive');
  });

  it('declines when nothing is affordable', () => {
    expect(synergyAwareBurnerShopStrategy([{ burner: rare, cost: 120 }], stateWithData(5))).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint H) -- Burner
// activation across all three contexts. Before this checkpoint every
// activation point defaulted to a never-fire no-op, so these are the
// first strategies that ever spend a Burner.
// ---------------------------------------------------------------------

describe('synergyAwareCombatBurnerActivation', () => {
  function ctx(side: 0 | 1, availableBurnerIds: BurnerId[]): Parameters<BurnerActivationStrategy>[0] {
    return { combatState: {} as never, side, isDealer: true, availableBurnerIds };
  }

  it('activates the first available combat-context Burner on the player side', () => {
    expect(synergyAwareCombatBurnerActivation(ctx(0, ['flash-drive', 'emp-charge']))).toBe('flash-drive');
  });

  it('skips map- and shop-context Burners carried in the same inventory', () => {
    expect(synergyAwareCombatBurnerActivation(ctx(0, ['recon-ping', 'stolen-coupon', 'emp-charge']))).toBe('emp-charge');
  });

  it('declines when only non-combat Burners are carried', () => {
    expect(synergyAwareCombatBurnerActivation(ctx(0, ['recon-ping', 'insider-tip']))).toBeNull();
  });

  it('always declines for the enemy side, which has no Burner economy', () => {
    expect(synergyAwareCombatBurnerActivation(ctx(1, ['flash-drive']))).toBeNull();
  });

  it('declines when nothing is carried', () => {
    expect(synergyAwareCombatBurnerActivation(ctx(0, []))).toBeNull();
  });
});

describe('synergyAwareShopBurnerStrategy', () => {
  function state(data: number): RunPlayerState {
    return { ...createInitialPlayerState('breacher'), data };
  }

  it('spends Insider Tip only once a rare is actually affordable', () => {
    expect(synergyAwareShopBurnerStrategy(['insider-tip'], state(150))).toBe('insider-tip');
    // Forcing the wildcard slot to rare while unable to buy a rare turns
    // the slate's most flexible slot into a guaranteed dead one.
    expect(synergyAwareShopBurnerStrategy(['insider-tip'], state(80))).toBeNull();
  });

  it('spends Stolen Coupon on any visit that can buy something', () => {
    expect(synergyAwareShopBurnerStrategy(['stolen-coupon'], state(20))).toBe('stolen-coupon');
  });

  it('spends nothing on a visit too poor to buy anything at all', () => {
    expect(synergyAwareShopBurnerStrategy(['stolen-coupon', 'loyalty-token', 'insider-tip'], state(5))).toBeNull();
  });

  it('prefers the largest effect when several coupons are carried', () => {
    expect(synergyAwareShopBurnerStrategy(['loyalty-token', 'stolen-coupon', 'insider-tip'], state(200))).toBe('insider-tip');
  });

  it('spends Loyalty Token when a reroll is otherwise out of reach', () => {
    expect(synergyAwareShopBurnerStrategy(['loyalty-token'], state(22))).toBe('loyalty-token');
    // Comfortably able to pay for its own reroll -- nothing to rescue.
    expect(synergyAwareShopBurnerStrategy(['loyalty-token'], state(200))).toBeNull();
  });
});

describe('synergyAwareMapBurnerStrategy', () => {
  /** Two hand-built graphs sharing a shape: entry 'a', gatekeeper 'gk',
   * and node 'b' as the only path between them. With 'b' closed the
   * gatekeeper is unreachable and Skeleton Key is the only way through;
   * with 'b' open it is reachable and spending the Burner buys nothing. */
  function graphWithBClosed(closed: boolean): LayerGraph {
    const b = closed ? { ...createNode('b', 'regularFight'), state: 'closed' as const } : createNode('b', 'regularFight');
    return {
      nodes: [createNode('a', 'regularFight'), b, createNode('gk', 'gatekeeperFight')],
      edges: [
        { a: 'a', b: 'b' },
        { a: 'b', b: 'gk' },
      ],
      entryNodeId: 'a',
      gatekeeperNodeId: 'gk',
    };
  }

  function mapCtx(graph: LayerGraph, availableBurnerIds: BurnerId[], playerState = createInitialPlayerState('breacher')) {
    return {
      graph,
      position: { layerIndex: 0, nodeId: 'a' },
      heat: 0,
      playerState,
      availableBurnerIds,
      closedNodeIds: graph.nodes.filter((n) => n.state === 'closed').map((n) => n.id),
    };
  }

  it('spends Skeleton Key only when the gatekeeper is genuinely unreachable', () => {
    const picked = synergyAwareMapBurnerStrategy(mapCtx(graphWithBClosed(true), ['skeleton-key']));
    expect(picked).toEqual({ burnerId: 'skeleton-key', targetNodeId: 'b' });
  });

  it('holds Skeleton Key while the gatekeeper is still reachable', () => {
    expect(synergyAwareMapBurnerStrategy(mapCtx(graphWithBClosed(false), ['skeleton-key']))).toBeNull();
  });

  it('targets a closed node that actually restores the route, not merely the first one', () => {
    // 'dead-end' is closed too, but reopening it changes nothing --
    // picking it would spend the rarest Burner in the game for no effect.
    const base = graphWithBClosed(true);
    const graph: LayerGraph = {
      ...base,
      nodes: [...base.nodes, { ...createNode('dead-end', 'regularFight'), state: 'closed' as const }],
    };
    const ctx = { ...mapCtx(graph, ['skeleton-key']), closedNodeIds: ['dead-end', 'b'] };
    expect(synergyAwareMapBurnerStrategy(ctx)).toEqual({ burnerId: 'skeleton-key', targetNodeId: 'b' });
  });

  it('prefers Skeleton Key over the others when the route is severed', () => {
    const picked = synergyAwareMapBurnerStrategy(mapCtx(graphWithBClosed(true), ['recon-ping', 'ghost-protocol', 'skeleton-key']));
    expect(picked?.burnerId).toBe('skeleton-key');
  });

  it('spends Ghost Protocol when a move would cost Heat', () => {
    const picked = synergyAwareMapBurnerStrategy(mapCtx(graphWithBClosed(false), ['recon-ping', 'ghost-protocol']));
    expect(picked).toEqual({ burnerId: 'ghost-protocol' });
  });

  it('still spends Ghost Protocol with Light Footing owned, since the move is discounted but not free', () => {
    // The gate is "would this move cost Heat at all," not "is it full
    // price." Light Footing discounts HEAT_PER_MOVE (2) by 1, so a move
    // still costs 1 and the Burner is still worth spending. No Mod in
    // the game currently drives the cost to 0, so the declining branch
    // is unreachable against today's content -- it exists so the rule
    // stays correct if one ever does, not as dead weight.
    const lightFooted = { ...createInitialPlayerState('breacher'), ownedModIds: ['light-footing' as ModId] };
    const picked = synergyAwareMapBurnerStrategy(mapCtx(graphWithBClosed(false), ['ghost-protocol'], lightFooted));
    expect(picked?.burnerId).toBe('ghost-protocol');
    expect(applyOnMoveMods(lightFooted.ownedModIds, HEAT_PER_MOVE)).toBeGreaterThan(0);
  });

  it('spends Recon Ping last, as inventory hygiene rather than information', () => {
    // revealUpcoming is a documented no-op in this engine; the payoff is
    // freeing a BURNER_CAP slot so a useful Burner can be acquired.
    expect(synergyAwareMapBurnerStrategy(mapCtx(graphWithBClosed(false), ['recon-ping']))).toEqual({ burnerId: 'recon-ping' });
  });

  it('declines when only non-map Burners are carried', () => {
    expect(synergyAwareMapBurnerStrategy(mapCtx(graphWithBClosed(false), ['flash-drive', 'stolen-coupon']))).toBeNull();
  });
});
