import { describe, it, expect } from 'vitest';
import { playRun, opportunisticTraversal, type RunPlayerState } from './run';
import { rarityOf } from './rewards';
import { hasCreditCapablePiece, type Archetype, type SubroutineDefinition, type Tag } from './subroutine-types';
import {
  installSubroutine,
  uninstallSubroutine,
  reorderInstalled,
  acquireSubroutine,
  alwaysAcquireFirst,
  INSTALLED_SLOT_CAP,
  fillsCreditGap,
  ladderRank,
  synergyAwareAcquisition,
  synergyAwareReorder,
  keepAcquisitionOrder,
  acquireSubroutineWithSwap,
} from './loadout';

function piece(id: string): SubroutineDefinition {
  return { id, name: id, archetype: 'exploit', trigger: { kind: 'always' }, payload: { kind: 'directBurst', amount: 1 }, tags: [] };
}

function playerState(installedLoadout: SubroutineDefinition[], bench: SubroutineDefinition[], material: Record<string, number> = {}): RunPlayerState {
  return {
    classId: 'breacher',
    installedLoadout,
    data: 0,
    bench,
    material,
    rank: {},
    ownedModIds: [],
    grantedByMod: {},
    maxHeatBonus: 0,
    modRunState: {},
    carriedBurnerIds: [],
  };
}

describe('installSubroutine', () => {
  it('moves a benched piece into installedLoadout', () => {
    const state = playerState([piece('a')], [piece('b')]);
    const result = installSubroutine(state, 'b');
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['a', 'b']);
    expect(result.bench).toEqual([]);
  });

  it('is a no-op when the id is not on the bench', () => {
    const state = playerState([piece('a')], [piece('b')]);
    const result = installSubroutine(state, 'not-there');
    expect(result).toEqual(state);
  });

  it('is a no-op when installedLoadout is already at the slot cap', () => {
    const full = Array.from({ length: 2 }, (_, i) => piece(`installed-${i}`));
    const state = playerState(full, [piece('b')]);
    const result = installSubroutine(state, 'b', 2);
    expect(result).toEqual(state);
  });
});

describe('uninstallSubroutine', () => {
  it('moves an installed piece onto the bench', () => {
    const state = playerState([piece('a'), piece('b')], []);
    const result = uninstallSubroutine(state, 'a');
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['b']);
    expect(result.bench.map((p) => p.id)).toEqual(['a']);
  });

  it('is a no-op when the id is not installed', () => {
    const state = playerState([piece('a')], []);
    const result = uninstallSubroutine(state, 'not-there');
    expect(result).toEqual(state);
  });
});

describe('reorderInstalled', () => {
  it('moves an entry from one index to another', () => {
    const state = playerState([piece('a'), piece('b'), piece('c')], []);
    const result = reorderInstalled(state, 0, 2);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('is a no-op for an out-of-range index', () => {
    const state = playerState([piece('a'), piece('b')], []);
    expect(reorderInstalled(state, -1, 1)).toEqual(state);
    expect(reorderInstalled(state, 0, 5)).toEqual(state);
  });
});

describe('acquireSubroutine', () => {
  it('benches then auto-installs when there is room', () => {
    const state = playerState([piece('a')], []);
    const result = acquireSubroutine(state, piece('new'));
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['a', 'new']);
    expect(result.bench).toEqual([]);
  });

  it('leaves the piece benched when installedLoadout is already at the slot cap', () => {
    const full = Array.from({ length: 2 }, (_, i) => piece(`installed-${i}`));
    const state = playerState(full, []);
    const result = acquireSubroutine(state, piece('new'), 2);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['installed-0', 'installed-1']);
    expect(result.bench.map((p) => p.id)).toEqual(['new']);
  });

  it('respects the default INSTALLED_SLOT_CAP when none is passed', () => {
    const full = Array.from({ length: INSTALLED_SLOT_CAP }, (_, i) => piece(`installed-${i}`));
    const state = playerState(full, []);
    const result = acquireSubroutine(state, piece('new'));
    expect(result.installedLoadout).toHaveLength(INSTALLED_SLOT_CAP);
    expect(result.bench.map((p) => p.id)).toEqual(['new']);
  });

  it('acquiring an already-installed id banks Merge material instead of a second copy', () => {
    const state = playerState([piece('a')], []);
    const result = acquireSubroutine(state, piece('a'));
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['a']); // no duplicate
    expect(result.bench).toEqual([]);
    expect(result.material.a).toBe(1);
  });

  it('acquiring an already-benched id banks Merge material and stacks on repeat', () => {
    const state = playerState([], [piece('a')], { a: 2 });
    const result = acquireSubroutine(state, piece('a'));
    expect(result.bench.map((p) => p.id)).toEqual(['a']); // no duplicate
    expect(result.material.a).toBe(3);
  });
});

describe('alwaysAcquireFirst', () => {
  it('picks the first offered option', () => {
    const state = playerState([], []);
    expect(alwaysAcquireFirst([piece('x'), piece('y')], state)?.id).toBe('x');
  });

  it('declines when nothing is offered', () => {
    const state = playerState([], []);
    expect(alwaysAcquireFirst([], state)).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46) -- checkpoint A's shared
// credit-capable classification. Lives here rather than in its own
// subroutine-types.test.ts because it exists purely as the acquisition
// ladder's own primitive, and the ladder tests it feeds are in this file.
// ---------------------------------------------------------------------

/** Like `piece` above, but lets a test pin the two fields the ladder
 * actually reads (archetype, payload kind) instead of the fixed
 * exploit/directBurst default. */
function typedPiece(id: string, archetype: Archetype, payload: SubroutineDefinition['payload']): SubroutineDefinition {
  return { id, name: id, archetype, trigger: { kind: 'always' }, payload, tags: [] };
}

describe('hasCreditCapablePiece', () => {
  it('is true when the loadout has a credit-capable piece of that archetype', () => {
    const loadout = [typedPiece('burst', 'encryption', { kind: 'wardCounter', amount: 3, ratio: 0.2 })];
    expect(hasCreditCapablePiece(loadout, 'encryption')).toBe(true);
  });

  it('is false when the only piece of that archetype is defensive-only', () => {
    // The exact gap session 40 existed to fix: a pure `ward` piece is
    // Encryption content that can never push toward a threshold win.
    const loadout = [typedPiece('shield', 'encryption', { kind: 'ward', amount: 4 })];
    expect(hasCreditCapablePiece(loadout, 'encryption')).toBe(false);
  });

  it('is archetype-scoped -- a credit-capable Exploit piece does not close an Encryption gap', () => {
    const loadout = [typedPiece('hit', 'exploit', { kind: 'directBurst', amount: 5 })];
    expect(hasCreditCapablePiece(loadout, 'exploit')).toBe(true);
    expect(hasCreditCapablePiece(loadout, 'encryption')).toBe(false);
  });

  it('is false for an empty loadout', () => {
    expect(hasCreditCapablePiece([], 'root')).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Checkpoint B -- the synergy-aware acquisition ladder.
// ---------------------------------------------------------------------

/** Breacher's own two specializations are exploit + encryption
 * (classes.ts), so 'malware'/'root' are the off-archetype cases in every
 * test below. Real pool ids are used wherever a test depends on the
 * rarity rung, since rarityOf() derives rarity structurally from which
 * subroutines.ts array a piece lives in -- an invented id would silently
 * read as 'common'. */
function breacherState(installedLoadout: SubroutineDefinition[]): RunPlayerState {
  return playerState(installedLoadout, []);
}

describe('ladderRank / synergyAwareAcquisition', () => {
  it('credit-gap outranks a higher-rarity off-archetype option', () => {
    // The ladder's whole reason for being a ladder rather than a
    // weighted sum: no rarity edge, however large, outvotes rung 1.
    const gapFiller = typedPiece('fuzzer', 'encryption', { kind: 'wardCounter', amount: 3, ratio: 0.2 });
    const shinyButOff = typedPiece('supply-chain-compromise', 'malware', { kind: 'directBurst', amount: 9 });
    const state = breacherState([]); // no credit-capable encryption piece installed
    expect(synergyAwareAcquisition([shinyButOff, gapFiller], state)?.id).toBe('fuzzer');
  });

  it('stops preferring a piece once that archetype gap is already closed', () => {
    const another = typedPiece('fuzzer', 'encryption', { kind: 'wardCounter', amount: 3, ratio: 0.2 });
    const shinyButOff = typedPiece('supply-chain-compromise', 'malware', { kind: 'directBurst', amount: 9 });
    // Same two options, but Encryption already credits -- rung 1 ties,
    // so rung 2 (on-archetype) decides, still landing on the Encryption
    // piece but now for a different reason.
    const closed = breacherState([typedPiece('installed-enc', 'encryption', { kind: 'wardBash', fraction: 0.4 })]);
    expect(ladderRank(another, closed).creditGap).toBe(1);
    expect(synergyAwareAcquisition([shinyButOff, another], closed)?.id).toBe('fuzzer');
  });

  it('a defensive-only on-archetype piece does not count as filling the gap', () => {
    const wardOnly = typedPiece('ward-only', 'encryption', { kind: 'ward', amount: 4 });
    expect(fillsCreditGap(wardOnly, breacherState([]))).toBe(false);
  });

  it('ranks on-archetype above neutral above off-archetype', () => {
    const state = breacherState([]);
    const on = typedPiece('on', 'exploit', { kind: 'ward', amount: 1 });
    const neutral = typedPiece('neutral', 'neutral', { kind: 'ward', amount: 1 });
    const off = typedPiece('off', 'root', { kind: 'ward', amount: 1 });
    expect(ladderRank(on, state).archetype).toBe(0);
    expect(ladderRank(neutral, state).archetype).toBe(1);
    expect(ladderRank(off, state).archetype).toBe(2);
    expect(synergyAwareAcquisition([off, neutral, on], state)?.id).toBe('on');
  });

  it('breaks a full tie by rarity, preferring the rarer piece', () => {
    // Both on-archetype exploit, both credit-capable, and Exploit's gap
    // is already closed by the installed piece -- so only rung 3 is live.
    const state = breacherState([typedPiece('installed-exp', 'exploit', { kind: 'directBurst', amount: 2 })]);
    const common = typedPiece('fuzzer', 'exploit', { kind: 'directBurst', amount: 3 });
    const rare = typedPiece('supply-chain-compromise', 'exploit', { kind: 'directBurst', amount: 3 });
    expect(synergyAwareAcquisition([common, rare], state)?.id).toBe('supply-chain-compromise');
  });

  it('falls to the earliest option when ranks tie exactly, matching alwaysAcquireFirst', () => {
    const state = breacherState([]);
    const first = typedPiece('first', 'root', { kind: 'ward', amount: 1 });
    const second = typedPiece('second', 'root', { kind: 'ward', amount: 1 });
    expect(synergyAwareAcquisition([first, second], state)?.id).toBe('first');
  });

  it('returns null for an empty slate', () => {
    expect(synergyAwareAcquisition([], breacherState([]))).toBeNull();
  });
});

describe('fillsCreditGap -- neutral handling (session 46)', () => {
  // Warden specializes in malware + encryption and ships with no
  // credit-capable Encryption piece (classes.ts) -- one of the 4 classes
  // that starts a run with a real gap, which is what makes this rung
  // live rather than theoretical.
  function wardenState(installedLoadout: SubroutineDefinition[]): RunPlayerState {
    return { ...playerState(installedLoadout, []), classId: 'warden' };
  }

  const creditCapableNeutral = typedPiece('neutral-hit', 'neutral', { kind: 'directBurst', amount: 4 });

  it('a credit-capable neutral piece fills an open gap in either specialization', () => {
    // malware credits (starting kit), encryption does not -- one open
    // gap is enough for a suit-independent piece to be worth prioritizing.
    const state = wardenState([typedPiece('mal', 'malware', { kind: 'dot', amountPerTick: 2, cadence: 'globalPulse', duration: 3, pointsPerTick: 4 })]);
    expect(fillsCreditGap(creditCapableNeutral, state)).toBe(true);
  });

  it('stops filling a gap once both specializations already credit', () => {
    const state = wardenState([
      typedPiece('mal', 'malware', { kind: 'dot', amountPerTick: 2, cadence: 'globalPulse', duration: 3, pointsPerTick: 4 }),
      typedPiece('enc', 'encryption', { kind: 'wardCounter', amount: 3, ratio: 0.2 }),
    ]);
    expect(fillsCreditGap(creditCapableNeutral, state)).toBe(false);
  });

  it('a defensive-only neutral piece never fills a gap', () => {
    const defensiveNeutral = typedPiece('neutral-ward', 'neutral', { kind: 'ward', amount: 3 });
    expect(fillsCreditGap(defensiveNeutral, wardenState([]))).toBe(false);
  });

  it('does not let neutral outrank an on-archetype piece that fills the same gap', () => {
    // Both reach rung 1; rung 2 resolves toward on-archetype. This is
    // the specific worry that made neutral-on-rung-1 look risky -- it
    // does not actually materialize.
    const state = wardenState([typedPiece('mal', 'malware', { kind: 'dot', amountPerTick: 2, cadence: 'globalPulse', duration: 3, pointsPerTick: 4 })]);
    const onArchetype = typedPiece('enc-hit', 'encryption', { kind: 'wardCounter', amount: 3, ratio: 0.2 });
    expect(fillsCreditGap(onArchetype, state)).toBe(true);
    expect(fillsCreditGap(creditCapableNeutral, state)).toBe(true);
    expect(synergyAwareAcquisition([creditCapableNeutral, onArchetype], state)?.id).toBe('enc-hit');
  });

  it('but neutral wins over a defensive-only on-archetype piece', () => {
    // The outcome that was backwards before this change: a credit-starved
    // class preferring a piece that can never push toward a win.
    const state = wardenState([typedPiece('mal', 'malware', { kind: 'dot', amountPerTick: 2, cadence: 'globalPulse', duration: 3, pointsPerTick: 4 })]);
    const defensiveOnArchetype = typedPiece('enc-ward', 'encryption', { kind: 'ward', amount: 4 });
    expect(synergyAwareAcquisition([defensiveOnArchetype, creditCapableNeutral], state)?.id).toBe('neutral-hit');
  });

  it('an off-archetype credit-capable piece still never fills a gap', () => {
    const offArchetype = typedPiece('root-hit', 'root', { kind: 'sessionHijack', amount: 3 });
    expect(fillsCreditGap(offArchetype, wardenState([]))).toBe(false);
  });
});

// ---------------------------------------------------------------------
// Checkpoint F -- loadout reorder.
// ---------------------------------------------------------------------

function chainedPiece(id: string, trigger: SubroutineDefinition['trigger'], archetype: Archetype = 'exploit', tags: Tag[] = []): SubroutineDefinition {
  return { id, name: id, archetype, trigger, payload: { kind: 'directBurst', amount: 1 }, tags };
}

function finisher(id: string, archetype: Archetype = 'exploit'): SubroutineDefinition {
  return {
    id,
    name: id,
    archetype,
    trigger: { kind: 'always' },
    payload: { kind: 'chainFinisherScaling', baseAmount: 2, perPriorFire: 1 },
    tags: [],
  };
}

const order = (state: RunPlayerState): string[] => state.installedLoadout.map((p) => p.id);

describe('synergyAwareReorder -- prerequisites before dependents', () => {
  it('moves an afterSubroutineId prerequisite before its dependent', () => {
    const state = playerState([chainedPiece('dependent', { kind: 'chained', afterSubroutineId: 'prereq' }), piece('prereq')], []);
    expect(order(synergyAwareReorder(state))).toEqual(['prereq', 'dependent']);
  });

  it('moves an afterArchetype prerequisite before its dependent', () => {
    // The variant that actually has content -- 9 pool pieces chain this
    // way, versus 0 on afterSubroutineId.
    const state = playerState(
      [chainedPiece('needs-malware', { kind: 'chained', afterArchetype: 'malware' }), chainedPiece('a-malware-piece', { kind: 'always' }, 'malware')],
      [],
    );
    expect(order(synergyAwareReorder(state))).toEqual(['a-malware-piece', 'needs-malware']);
  });

  it('moves an afterTag prerequisite before its dependent', () => {
    const state = playerState(
      [chainedPiece('needs-worm', { kind: 'chained', afterTag: 'worm' }), chainedPiece('a-worm', { kind: 'always' }, 'malware', ['worm'])],
      [],
    );
    expect(order(synergyAwareReorder(state))).toEqual(['a-worm', 'needs-worm']);
  });

  it('leaves an order alone when the chain is already satisfied earlier', () => {
    const state = playerState(
      [chainedPiece('a-malware-piece', { kind: 'always' }, 'malware'), chainedPiece('needs-malware', { kind: 'chained', afterArchetype: 'malware' })],
      [],
    );
    expect(order(synergyAwareReorder(state))).toEqual(['a-malware-piece', 'needs-malware']);
  });

  it('leaves a chained piece alone when nothing installed satisfies it', () => {
    const state = playerState([piece('other'), chainedPiece('orphan', { kind: 'chained', afterArchetype: 'root' })], []);
    expect(order(synergyAwareReorder(state))).toEqual(['other', 'orphan']);
  });

  it('terminates on a chain cycle rather than spinning', () => {
    // A-after-B and B-after-A is expressible in the type system; an
    // unsatisfiable chain is dead content however it's ordered, so the
    // rule just needs to stop.
    const state = playerState(
      [chainedPiece('a', { kind: 'chained', afterSubroutineId: 'b' }), chainedPiece('b', { kind: 'chained', afterSubroutineId: 'a' })],
      [],
    );
    expect(order(synergyAwareReorder(state))).toHaveLength(2);
  });
});

describe('synergyAwareReorder -- finishers last', () => {
  it('moves a chainFinisherScaling piece to the end', () => {
    const state = playerState([finisher('big-finish'), piece('a'), piece('b')], []);
    expect(order(synergyAwareReorder(state))).toEqual(['a', 'b', 'big-finish']);
  });

  it('keeps multiple finishers in their existing relative order', () => {
    const state = playerState([finisher('first-finisher'), piece('a'), finisher('second-finisher')], []);
    expect(order(synergyAwareReorder(state))).toEqual(['a', 'first-finisher', 'second-finisher']);
  });

  it('sends a finisher last even when it is another piece\'s prerequisite', () => {
    // The deliberate conflict resolution: pass 2 wins, because a
    // finisher's whole payoff is positional in a way a chained
    // trigger's is not.
    const state = playerState([chainedPiece('dependent', { kind: 'chained', afterSubroutineId: 'fin' }), finisher('fin')], []);
    expect(order(synergyAwareReorder(state))).toEqual(['dependent', 'fin']);
  });

  it('is idempotent -- running it twice changes nothing further', () => {
    // This is what lets run.ts apply it once per node rather than at
    // every individual acquisition call site.
    const state = playerState(
      [finisher('fin'), chainedPiece('needs-malware', { kind: 'chained', afterArchetype: 'malware' }), chainedPiece('mal', { kind: 'always' }, 'malware')],
      [],
    );
    const once = synergyAwareReorder(state);
    expect(order(synergyAwareReorder(once))).toEqual(order(once));
  });

  it('is a no-op on a loadout with no chains and no finishers', () => {
    const state = playerState([piece('a'), piece('b'), piece('c')], []);
    expect(order(synergyAwareReorder(state))).toEqual(['a', 'b', 'c']);
  });
});

describe('reorderStrategy wiring (checkpoint F)', () => {
  it('playRun calls the reorder strategy after each resolved encounter', () => {
    let calls = 0;
    playRun({
      seed: 0,
      classId: 'breacher',
      traversalStrategy: opportunisticTraversal,
      reorderStrategy: (state) => {
        calls++;
        return state;
      },
    });
    expect(calls).toBeGreaterThan(0);
  });

  it('defaults to keepAcquisitionOrder -- unchanged behavior when omitted', () => {
    const withDefault = playRun({ seed: 3, classId: 'breacher', traversalStrategy: opportunisticTraversal });
    const withExplicit = playRun({
      seed: 3,
      classId: 'breacher',
      traversalStrategy: opportunisticTraversal,
      reorderStrategy: keepAcquisitionOrder,
    });
    expect(withDefault.outcome).toBe(withExplicit.outcome);
    expect(withDefault.layersCompleted).toBe(withExplicit.layersCompleted);
  });

  it('a real run with synergyAwareReorder leaves every finisher trailing', () => {
    // End-to-end: whatever the run actually acquired, the invariant the
    // rule exists to enforce holds on the final loadout.
    const result = playRun({
      seed: 0,
      classId: 'breacher',
      traversalStrategy: opportunisticTraversal,
      acquisitionStrategy: synergyAwareAcquisition,
      reorderStrategy: synergyAwareReorder,
    });
    const loadout = result.playerState.installedLoadout;
    const firstFinisher = loadout.findIndex((p) => p.payload.kind === 'chainFinisherScaling');
    if (firstFinisher !== -1) {
      expect(loadout.slice(firstFinisher).every((p) => p.payload.kind === 'chainFinisherScaling')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------
// Checkpoint G -- swap-out on a full loadout.
// ---------------------------------------------------------------------

describe('acquireSubroutineWithSwap', () => {
  const CREDIT = { kind: 'directBurst', amount: 3 } as const;
  const DEFENSIVE = { kind: 'ward', amount: 3 } as const;

  it('behaves exactly like acquireSubroutine when there is room', () => {
    const state = playerState([piece('a')], []);
    expect(acquireSubroutineWithSwap(state, piece('new'), 6)).toEqual(acquireSubroutine(state, piece('new'), 6));
  });

  it('banks Merge material for an already-owned id, same as acquireSubroutine', () => {
    const state = playerState([piece('a')], []);
    expect(acquireSubroutineWithSwap(state, piece('a'), 6).material.a).toBe(1);
  });

  it('evicts the worst-ranked installed piece when the candidate outranks it', () => {
    // Breacher: exploit + encryption. The off-archetype root piece is
    // the weakest thing installed; an on-archetype candidate displaces it.
    const state = playerState(
      [typedPiece('keep-exploit', 'exploit', CREDIT), typedPiece('weak-root', 'root', DEFENSIVE)],
      [],
    );
    const result = acquireSubroutineWithSwap(state, typedPiece('new-exploit', 'exploit', CREDIT), 2);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['keep-exploit', 'new-exploit']);
    expect(result.bench.map((p) => p.id)).toEqual(['weak-root']);
  });

  it('benches the candidate when it does not outrank anything installed', () => {
    const state = playerState(
      [typedPiece('strong-a', 'exploit', CREDIT), typedPiece('strong-b', 'encryption', CREDIT)],
      [],
    );
    const result = acquireSubroutineWithSwap(state, typedPiece('weak-root', 'root', DEFENSIVE), 2);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['strong-a', 'strong-b']);
    expect(result.bench.map((p) => p.id)).toEqual(['weak-root']);
  });

  it('does not evict the sole credit-capable piece of an archetype', () => {
    // The inversion this checkpoint had to work around. 'lone-enc' is
    // the only thing crediting Encryption; ranked by the plain
    // acquisition ladder it scores as "fills no gap" -- precisely
    // because it is what fills it -- and would look cheap to evict.
    // Counterfactual ranking protects it, so the lower-value defensive
    // exploit piece goes instead.
    const state = playerState(
      [typedPiece('lone-enc', 'encryption', CREDIT), typedPiece('spare-exploit', 'exploit', DEFENSIVE)],
      [],
    );
    const result = acquireSubroutineWithSwap(state, typedPiece('new-exploit', 'exploit', CREDIT), 2);
    expect(result.installedLoadout.map((p) => p.id)).toContain('lone-enc');
    expect(result.bench.map((p) => p.id)).toEqual(['spare-exploit']);
  });

  it('never evicts a Mod-granted piece, even when it ranks worst', () => {
    // Granted entries are cap-exempt and removal-locked
    // (uninstallSubroutine refuses them outright), so evicting one
    // silently fails and would waste the acquisition entirely.
    // 'granted-junk' is off-archetype and defensive -- the weakest thing
    // installed, and what a naive worst-ranked search would reach for --
    // so the evictable 'weak-root' has to go instead.
    const state = {
      ...playerState([typedPiece('granted-junk', 'root', DEFENSIVE), typedPiece('weak-root', 'root', DEFENSIVE)], []),
      grantedByMod: { 'granted-junk': 'some-mod' },
    };
    const result = acquireSubroutineWithSwap(state, typedPiece('strong-exploit', 'exploit', CREDIT), 1);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['granted-junk', 'strong-exploit']);
    expect(result.bench.map((p) => p.id)).toEqual(['weak-root']);
  });

  it('declines the swap when the only evictable piece is a sole credit provider it cannot beat', () => {
    // Cap-exempt granted entries mean the evictable set can be a single
    // piece that is load-bearing -- benching the candidate is correct.
    const state = {
      ...playerState([typedPiece('granted-junk', 'root', DEFENSIVE), typedPiece('lone-exploit', 'exploit', CREDIT)], []),
      grantedByMod: { 'granted-junk': 'some-mod' },
    };
    const result = acquireSubroutineWithSwap(state, typedPiece('another-exploit', 'exploit', CREDIT), 1);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['granted-junk', 'lone-exploit']);
    expect(result.bench.map((p) => p.id)).toEqual(['another-exploit']);
  });

  it('leaves acquireSubroutine itself unchanged -- bench-forever stays the default', () => {
    const full = [typedPiece('a', 'root', DEFENSIVE), typedPiece('b', 'root', DEFENSIVE)];
    const state = playerState(full, []);
    const strong = typedPiece('strong', 'exploit', CREDIT);
    expect(acquireSubroutine(state, strong, 2).installedLoadout.map((p) => p.id)).toEqual(['a', 'b']);
    expect(acquireSubroutineWithSwap(state, strong, 2).installedLoadout.map((p) => p.id)).toContain('strong');
  });
});

describe('acquireSubroutineWithSwap -- rarity is not an eviction criterion (session 46 regression)', () => {
  const CREDIT = { kind: 'directBurst', amount: 3 } as const;

  it('does not evict an incumbent merely because the candidate is rarer', () => {
    // The bug this guards: rarityOf() reports 'common' for all 18 class
    // starting-loadout pieces because they carry no authored rarity at
    // all, not because they are weak. With rarity on the eviction
    // comparison that parked every hand-designed starting piece at the
    // bottom of the order, and an ablation sweep measured 73% of them
    // being dismantled for pool pieces -- dropping the full synergy
    // profile below the dumb baseline it was built to beat.
    const state = playerState([typedPiece('buffer-overflow', 'exploit', CREDIT)], []);
    const rarerSameRungs = typedPiece('supply-chain-compromise', 'exploit', CREDIT);
    expect(rarityOf('supply-chain-compromise')).toBe('rare');
    expect(rarityOf('buffer-overflow')).toBe('common'); // unauthored, not weak
    const result = acquireSubroutineWithSwap(state, rarerSameRungs, 1);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['buffer-overflow']);
    expect(result.bench.map((p) => p.id)).toEqual(['supply-chain-compromise']);
  });

  it('still evicts on a genuine credit-gap or archetype improvement', () => {
    // The bar is higher, not gone -- an off-archetype incumbent still
    // loses to an on-archetype candidate of identical rarity.
    const state = playerState([typedPiece('off-arch', 'root', CREDIT)], []);
    const result = acquireSubroutineWithSwap(state, typedPiece('on-arch', 'exploit', CREDIT), 1);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['on-arch']);
  });
});
