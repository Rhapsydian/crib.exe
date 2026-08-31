import { describe, it, expect } from 'vitest';
import type { RunPlayerState } from './run';
import { hasCreditCapablePiece, type Archetype, type SubroutineDefinition } from './subroutine-types';
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
