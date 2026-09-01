import { describe, it, expect } from 'vitest';
import { SYNERGY_AWARE_PROFILE, SYNERGY_EVENT_RISK } from './profiles';
import { createInitialPlayerState, playRun, opportunisticTraversal, summarizeRunLoadout } from './run';
import { opportunisticSafehouseStrategy } from './merge';
import { CLASS_DEFINITIONS, type ClassId } from './classes';

/**
 * Gameplay Simulation Heuristics checkpoint J -- the bundled profile.
 *
 * These are guards on the bundle itself rather than on any individual
 * heuristic (each of those is tested in its own module's file): that it
 * covers every decision point session 46 built a strategy for, that it
 * genuinely changes how a run plays rather than merely being accepted,
 * and that it leaves the traversal dial alone so the two profiles stay
 * independently comparable.
 */

const ALL_CLASSES: ClassId[] = ['breacher', 'blackhat', 'saboteur', 'operator', 'warden', 'ghost'];

describe('SYNERGY_AWARE_PROFILE', () => {
  it('covers every decision point checkpoints B-I added a strategy for', () => {
    // A structural guard: adding a new heuristic without adding it here
    // would silently leave it unexercised by every sweep, which is
    // exactly how Burners went unused for 9 sessions.
    expect(Object.keys(SYNERGY_AWARE_PROFILE).sort()).toEqual(
      [
        'acquisitionStrategy',
        'burnerAcquisitionStrategy',
        'burnerActivationStrategies',
        'burnerShopStrategy',
        'eventChoiceStrategy',
        'mapBurnerStrategy',
        'mergeTargetStrategy',
        'modAcquisitionStrategy',
        'modShopStrategy',
        'reorderStrategy',
        'shopBurnerStrategy',
        'shopStrategy',
        'subroutineAcquirer',
      ].sort(),
    );
  });

  it('deliberately sets neither traversal nor safehouse -- those are the separate --traversal dial', () => {
    expect(SYNERGY_AWARE_PROFILE.traversalStrategy).toBeUndefined();
    expect(SYNERGY_AWARE_PROFILE.safehouseStrategy).toBeUndefined();
  });

  it('leaves the enemy side of combat Burner activation at never-fire', () => {
    // Side 1 has no Burner economy at all; only side 0 should ever act.
    const [playerSide, enemySide] = SYNERGY_AWARE_PROFILE.burnerActivationStrategies!;
    expect(playerSide({ combatState: {} as never, side: 0, isDealer: true, availableBurnerIds: ['flash-drive'] })).toBe('flash-drive');
    expect(enemySide({ combatState: {} as never, side: 1, isDealer: true, availableBurnerIds: ['flash-drive'] })).toBeNull();
  });

  it('allows gambles only below half of max Heat', () => {
    expect(SYNERGY_EVENT_RISK.maxRiskTier).toBe('gamble');
    expect(SYNERGY_EVENT_RISK.gambleSafetyMargin).toBe(0.5);
  });

  it('runs every class end-to-end without crashing or hanging', () => {
    for (const classId of ALL_CLASSES) {
      const result = playRun({
        ...SYNERGY_AWARE_PROFILE,
        seed: 1,
        classId,
        traversalStrategy: opportunisticTraversal,
        safehouseStrategy: opportunisticSafehouseStrategy,
      });
      expect(['victory', 'heatMaxed', 'quarantined', 'noRouteRemains']).toContain(result.outcome);
    }
  });

  it('actually changes how a run plays, rather than merely being accepted', () => {
    // If this ever passes trivially, the profile has stopped being
    // wired to anything -- the failure mode this whole session exists to
    // prevent.
    const shared = { traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy };
    const differing = ALL_CLASSES.filter((classId) => {
      const floor = playRun({ seed: 2, classId, ...shared });
      const synergy = playRun({ ...SYNERGY_AWARE_PROFILE, seed: 2, classId, ...shared });
      return (
        floor.outcome !== synergy.outcome ||
        floor.layersCompleted !== synergy.layersCompleted ||
        floor.playerState.installedLoadout.map((p) => p.id).join() !== synergy.playerState.installedLoadout.map((p) => p.id).join()
      );
    });
    expect(differing.length).toBeGreaterThan(0);
  });
});

describe('SYNERGY_AWARE_PROFILE -- loadout preservation (session 46 regression)', () => {
  it('keeps the hand-designed starting loadout largely intact across a real run', () => {
    // End-to-end guard on the swap-out bug that the unit tests could not
    // see: an eviction rule that looked locally reasonable dismantled
    // 73% of every class's authored starting kit over a full run. The
    // threshold is deliberately loose -- swapping out a genuinely
    // outclassed starting piece is the feature working, wholesale
    // teardown is not.
    let kept = 0;
    let total = 0;
    for (const classId of ALL_CLASSES) {
      const startingIds = new Set(CLASS_DEFINITIONS[classId].startingLoadout.map((p) => p.id));
      for (let seed = 0; seed < 10; seed++) {
        const result = playRun({
          ...SYNERGY_AWARE_PROFILE,
          seed,
          classId,
          traversalStrategy: opportunisticTraversal,
          safehouseStrategy: opportunisticSafehouseStrategy,
        });
        kept += result.playerState.installedLoadout.filter((p) => startingIds.has(p.id)).length;
        total += startingIds.size;
      }
    }
    expect(kept / total).toBeGreaterThan(0.75);
  });
});

describe('summarizeRunLoadout (session 46)', () => {
  it('captures what a finished run actually held, in a JSON-safe shape', () => {
    const result = playRun({
      ...SYNERGY_AWARE_PROFILE,
      seed: 0,
      classId: 'breacher',
      traversalStrategy: opportunisticTraversal,
      safehouseStrategy: opportunisticSafehouseStrategy,
    });
    const summary = summarizeRunLoadout(result.playerState);

    // Ordered, because reorderStrategy makes firing order a real outcome
    // rather than an artifact of acquisition order.
    expect(summary.installed).toEqual(result.playerState.installedLoadout.map((p) => p.id));
    expect(summary.mods).toEqual(result.playerState.ownedModIds);
    // Survives a JSON round-trip -- the whole point is a JSONL line.
    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary);
  });

  it('omits zero-valued rank and material entries rather than emitting noise', () => {
    const summary = summarizeRunLoadout({
      ...createInitialPlayerState('breacher'),
      rank: { ranked: 2, unranked: 0 },
      material: { banked: 1, spent: 0 },
    });
    expect(summary.rank).toEqual({ ranked: 2 });
    expect(summary.material).toEqual({ banked: 1 });
  });

  it('reports Mod-granted installed ids separately from chosen ones', () => {
    // A granted piece is cap-exempt and removal-locked, so counting it
    // as evidence the run "picked" that subroutine would be wrong.
    const summary = summarizeRunLoadout({
      ...createInitialPlayerState('ghost'),
      grantedByMod: { 'some-piece': 'auxiliary-process' },
    });
    expect(summary.grantedByMod).toEqual(['some-piece']);
  });
});
