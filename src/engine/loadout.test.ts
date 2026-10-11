import { describe, it, expect } from 'vitest';
import { playRun, opportunisticTraversal, type RunPlayerState } from './run';
import { rarityOf } from './rewards';
import { CLASS_DEFINITIONS } from './classes';
import { hasCreditCapablePiece, matchesSequence, type Alpha, type Archetype, type Beta, type SubroutineDefinition } from './subroutine-types';
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

// Session 51: fixtures rebuilt for the alpha/beta model. The default
// class is exploit-daemon, so overclock and honeypot are the
// off-archetype cases throughout.

const CREDIT: Alpha = { verb: 'credit', amount: 3 };
const DEFENSIVE: Alpha = { verb: 'ward', amount: 3 };

function piece(id: string, archetype: Archetype = 'exploit', alpha: Alpha = { verb: 'credit', amount: 1 }, beta?: Beta): SubroutineDefinition {
  return { id, name: id, archetype, alpha, beta };
}

function playerState(installedLoadout: SubroutineDefinition[], bench: SubroutineDefinition[], material: Record<string, number> = {}): RunPlayerState {
  return {
    classId: 'exploit-daemon',
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
    expect(installSubroutine(state, 'not-there')).toEqual(state);
  });

  it('is a no-op when installedLoadout is already at the slot cap', () => {
    const full = Array.from({ length: 2 }, (_, i) => piece(`installed-${i}`));
    const state = playerState(full, [piece('b')]);
    expect(installSubroutine(state, 'b', 2)).toEqual(state);
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
    expect(uninstallSubroutine(state, 'not-there')).toEqual(state);
  });
});

describe('reorderInstalled', () => {
  it('moves an entry from one index to another', () => {
    const state = playerState([piece('a'), piece('b'), piece('c')], []);
    expect(reorderInstalled(state, 0, 2).installedLoadout.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('is a no-op for an out-of-range index', () => {
    const state = playerState([piece('a'), piece('b')], []);
    expect(reorderInstalled(state, -1, 1)).toEqual(state);
    expect(reorderInstalled(state, 0, 5)).toEqual(state);
  });
});

describe('acquireSubroutine', () => {
  it('benches then auto-installs when there is room', () => {
    const result = acquireSubroutine(playerState([piece('a')], []), piece('new'));
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['a', 'new']);
    expect(result.bench).toEqual([]);
  });

  it('leaves the piece benched when installedLoadout is already at the slot cap', () => {
    const full = Array.from({ length: 2 }, (_, i) => piece(`installed-${i}`));
    const result = acquireSubroutine(playerState(full, []), piece('new'), 2);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['installed-0', 'installed-1']);
    expect(result.bench.map((p) => p.id)).toEqual(['new']);
  });

  it('respects the default INSTALLED_SLOT_CAP when none is passed', () => {
    const full = Array.from({ length: INSTALLED_SLOT_CAP }, (_, i) => piece(`installed-${i}`));
    const result = acquireSubroutine(playerState(full, []), piece('new'));
    expect(result.installedLoadout).toHaveLength(INSTALLED_SLOT_CAP);
    expect(result.bench.map((p) => p.id)).toEqual(['new']);
  });

  it('acquiring an already-installed id banks Merge material instead of a second copy', () => {
    const result = acquireSubroutine(playerState([piece('a')], []), piece('a'));
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['a']);
    expect(result.bench).toEqual([]);
    expect(result.material.a).toBe(1);
  });

  it('acquiring an already-benched id banks Merge material and stacks on repeat', () => {
    const result = acquireSubroutine(playerState([], [piece('a')], { a: 2 }), piece('a'));
    expect(result.bench.map((p) => p.id)).toEqual(['a']);
    expect(result.material.a).toBe(3);
  });
});

describe('alwaysAcquireFirst', () => {
  it('picks the first offered option', () => {
    expect(alwaysAcquireFirst([piece('x'), piece('y')], playerState([], []))?.id).toBe('x');
  });

  it('declines when nothing is offered', () => {
    expect(alwaysAcquireFirst([], playerState([], []))).toBeNull();
  });
});

// ---------------------------------------------------------------------
// The credit-path classification (session 46, re-pointed session 51 to
// "credits through its alpha or its beta").
// ---------------------------------------------------------------------

describe('hasCreditCapablePiece', () => {
  it('is true when a piece of that archetype has a Credit alpha', () => {
    expect(hasCreditCapablePiece([piece('hit', 'daemon', CREDIT)], 'daemon')).toBe(true);
  });

  it('is true when the credit path is only in the beta (Honeypot-style conversion)', () => {
    const tarpit = piece('tarpit', 'honeypot', DEFENSIVE, {
      source: 'state',
      condition: { kind: 'wardAbove', amount: 6 },
      shape: 'whileTrue',
      effect: { verb: 'credit', amount: 3, from: 'ward' },
    });
    expect(hasCreditCapablePiece([tarpit], 'honeypot')).toBe(true);
  });

  it('is false when the only piece of that archetype never credits', () => {
    expect(hasCreditCapablePiece([piece('shield', 'honeypot', DEFENSIVE)], 'honeypot')).toBe(false);
  });

  it('an enhance beta on a non-credit alpha does not count -- it only makes that effect bigger', () => {
    const shield = piece('shield', 'honeypot', DEFENSIVE, { source: 'progress', metric: 'points', per: 5, shape: 'graded', cap: 2, effect: { verb: 'enhance', amount: 1 } });
    expect(hasCreditCapablePiece([shield], 'honeypot')).toBe(false);
  });

  it('is archetype-scoped', () => {
    const loadout = [piece('hit', 'exploit', CREDIT)];
    expect(hasCreditCapablePiece(loadout, 'exploit')).toBe(true);
    expect(hasCreditCapablePiece(loadout, 'daemon')).toBe(false);
  });

  it('is false for an empty loadout', () => {
    expect(hasCreditCapablePiece([], 'overclock')).toBe(false);
  });
});

// ---------------------------------------------------------------------
// The synergy-aware acquisition ladder. Real pool ids are used wherever
// a test depends on the rarity rung, since rarityOf() derives rarity
// from which subroutines.ts array a piece lives in -- an invented id
// would silently read as 'common'. probe = common, fuzzer = uncommon,
// packet-sniffer = rare (all Exploit).
// ---------------------------------------------------------------------

describe('ladderRank / synergyAwareAcquisition', () => {
  it('credit-gap outranks a higher-rarity off-archetype option', () => {
    const gapFiller = piece('probe', 'daemon', CREDIT);
    const shinyButOff = piece('packet-sniffer', 'overclock', CREDIT);
    expect(synergyAwareAcquisition([shinyButOff, gapFiller], playerState([], []))?.id).toBe('probe');
  });

  it('stops counting a gap once that archetype already credits', () => {
    const another = piece('probe', 'daemon', CREDIT);
    const closed = playerState([piece('installed-daemon', 'daemon', CREDIT)], []);
    expect(ladderRank(another, closed).creditGap).toBe(1);
  });

  it('a piece with no credit path never fills the gap', () => {
    expect(fillsCreditGap(piece('ward-only', 'daemon', DEFENSIVE), playerState([], []))).toBe(false);
  });

  it('an off-archetype credit piece never fills a gap', () => {
    expect(fillsCreditGap(piece('off-hit', 'honeypot', CREDIT), playerState([], []))).toBe(false);
  });

  it('ranks on-archetype above off-archetype; only Mods with no archetype sit in the middle', () => {
    const state = playerState([], []);
    expect(ladderRank(piece('on', 'exploit', DEFENSIVE), state).archetype).toBe(0);
    expect(ladderRank(piece('off', 'overclock', DEFENSIVE), state).archetype).toBe(2);
    expect(synergyAwareAcquisition([piece('off', 'overclock', DEFENSIVE), piece('on', 'exploit', DEFENSIVE)], state)?.id).toBe('on');
  });

  it('breaks a full tie by rarity, preferring the rarer piece', () => {
    const state = playerState([piece('installed-exp', 'exploit', CREDIT)], []);
    expect(rarityOf('packet-sniffer')).toBe('rare');
    expect(synergyAwareAcquisition([piece('probe', 'exploit', CREDIT), piece('packet-sniffer', 'exploit', CREDIT)], state)?.id).toBe('packet-sniffer');
  });

  it('falls to the earliest option when ranks tie exactly, matching alwaysAcquireFirst', () => {
    const state = playerState([], []);
    expect(synergyAwareAcquisition([piece('first', 'overclock', DEFENSIVE), piece('second', 'overclock', DEFENSIVE)], state)?.id).toBe('first');
  });

  it('returns null for an empty slate', () => {
    expect(synergyAwareAcquisition([], playerState([], []))).toBeNull();
  });
});

// ---------------------------------------------------------------------
// Loadout reorder over `sequence` betas (D13).
// ---------------------------------------------------------------------

function wants(id: string, reach: 'adjacent' | 'anyPrior', match: Extract<Beta, { source: 'sequence' }>['match']): SubroutineDefinition {
  return piece(id, 'exploit', CREDIT, { source: 'sequence', reach, match, shape: 'whileTrue', effect: { verb: 'enhance', amount: 1 } });
}

const order = (state: RunPlayerState): string[] => state.installedLoadout.map((p) => p.id);

describe('matchesSequence', () => {
  it('matches by id, archetype or alpha verb', () => {
    const target = piece('target', 'daemon', { verb: 'suppress', amount: 1 });
    expect(matchesSequence({ id: 'target' }, target)).toBe(true);
    expect(matchesSequence({ archetype: 'daemon' }, target)).toBe(true);
    expect(matchesSequence({ verb: 'suppress' }, target)).toBe(true);
    expect(matchesSequence({ verb: 'credit' }, target)).toBe(false);
  });
});

describe('synergyAwareReorder', () => {
  it('moves an anyPrior prerequisite ahead of its dependent', () => {
    const state = playerState([wants('dependent', 'anyPrior', { archetype: 'daemon' }), piece('a-daemon', 'daemon')], []);
    expect(order(synergyAwareReorder(state))).toEqual(['a-daemon', 'dependent']);
  });

  it('moves an earlier, non-neighbouring adjacent prerequisite to sit directly above', () => {
    const state = playerState([piece('a-daemon', 'daemon'), piece('filler'), wants('dependent', 'adjacent', { archetype: 'daemon' })], []);
    expect(order(synergyAwareReorder(state))).toEqual(['filler', 'a-daemon', 'dependent']);
  });

  it('pulls a later, non-neighbouring adjacent prerequisite up to sit directly below (A12: either side counts)', () => {
    const state = playerState([wants('dependent', 'adjacent', { id: 'prereq' }), piece('filler'), piece('prereq')], []);
    expect(order(synergyAwareReorder(state))).toEqual(['dependent', 'prereq', 'filler']);
  });

  it('leaves an adjacent chain alone when the match is already the neighbour below', () => {
    const state = playerState([piece('x'), wants('dependent', 'adjacent', { archetype: 'daemon' }), piece('d', 'daemon')], []);
    expect(order(synergyAwareReorder(state))).toEqual(['x', 'dependent', 'd']);
  });

  it('leaves an anyPrior chain alone when something earlier already satisfies it', () => {
    const state = playerState([piece('a-daemon', 'daemon'), piece('filler'), wants('dependent', 'anyPrior', { archetype: 'daemon' })], []);
    expect(order(synergyAwareReorder(state))).toEqual(['a-daemon', 'filler', 'dependent']);
  });

  it('leaves a sequence piece alone when nothing installed satisfies it', () => {
    const state = playerState([piece('other'), wants('orphan', 'anyPrior', { archetype: 'honeypot' })], []);
    expect(order(synergyAwareReorder(state))).toEqual(['other', 'orphan']);
  });

  it('terminates on a cycle rather than spinning', () => {
    const state = playerState([wants('a', 'adjacent', { id: 'b' }), wants('b', 'adjacent', { id: 'a' })], []);
    expect(order(synergyAwareReorder(state))).toHaveLength(2);
  });

  it('is idempotent -- running it twice changes nothing further', () => {
    const state = playerState([wants('dep', 'adjacent', { archetype: 'daemon' }), piece('x'), piece('d', 'daemon')], []);
    const once = synergyAwareReorder(state);
    expect(order(synergyAwareReorder(once))).toEqual(order(once));
  });

  it('is a no-op on a loadout with no sequence betas', () => {
    const state = playerState([piece('a'), piece('b'), piece('c')], []);
    expect(order(synergyAwareReorder(state))).toEqual(['a', 'b', 'c']);
  });
});

// Needs a working resolver -- red until checkpoint 3.
describe('reorderStrategy wiring', () => {
  it('playRun calls the reorder strategy after each resolved encounter', () => {
    let calls = 0;
    playRun({
      seed: 0,
      classId: 'exploit-daemon',
      traversalStrategy: opportunisticTraversal,
      reorderStrategy: (state) => {
        calls++;
        return state;
      },
    });
    expect(calls).toBeGreaterThan(0);
  });

  it('defaults to keepAcquisitionOrder -- unchanged behavior when omitted', () => {
    const withDefault = playRun({ seed: 3, classId: 'exploit-daemon', traversalStrategy: opportunisticTraversal });
    const withExplicit = playRun({ seed: 3, classId: 'exploit-daemon', traversalStrategy: opportunisticTraversal, reorderStrategy: keepAcquisitionOrder });
    expect(withDefault.outcome).toBe(withExplicit.outcome);
    expect(withDefault.layersCompleted).toBe(withExplicit.layersCompleted);
  });

  it('a real run with synergyAwareReorder leaves every satisfiable adjacent chain satisfied', () => {
    const result = playRun({
      seed: 0,
      classId: 'daemon-overclock',
      traversalStrategy: opportunisticTraversal,
      acquisitionStrategy: synergyAwareAcquisition,
      reorderStrategy: synergyAwareReorder,
    });
    const loadout = result.playerState.installedLoadout;
    loadout.forEach((p, i) => {
      if (p.beta?.source !== 'sequence' || p.beta.reach !== 'adjacent') return;
      const match = p.beta.match;
      const satisfiable = loadout.some((other, j) => j !== i && matchesSequence(match, other));
      const neighbourMatches = [loadout[i - 1], loadout[i + 1]].some((n) => n !== undefined && matchesSequence(match, n));
      if (satisfiable) expect(neighbourMatches, p.id).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------
// Swap-out on a full loadout.
// ---------------------------------------------------------------------

describe('acquireSubroutineWithSwap', () => {
  it('behaves exactly like acquireSubroutine when there is room', () => {
    const state = playerState([piece('a')], []);
    expect(acquireSubroutineWithSwap(state, piece('new'), 6)).toEqual(acquireSubroutine(state, piece('new'), 6));
  });

  it('banks Merge material for an already-owned id, same as acquireSubroutine', () => {
    expect(acquireSubroutineWithSwap(playerState([piece('a')], []), piece('a'), 6).material.a).toBe(1);
  });

  it('evicts the worst-ranked installed piece when the candidate outranks it', () => {
    const state = playerState([piece('keep-exploit', 'exploit', CREDIT), piece('weak-off', 'overclock', DEFENSIVE)], []);
    const result = acquireSubroutineWithSwap(state, piece('new-exploit', 'exploit', CREDIT), 2);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['keep-exploit', 'new-exploit']);
    expect(result.bench.map((p) => p.id)).toEqual(['weak-off']);
  });

  it('benches the candidate when it does not outrank anything installed', () => {
    const state = playerState([piece('strong-a', 'exploit', CREDIT), piece('strong-b', 'daemon', CREDIT)], []);
    const result = acquireSubroutineWithSwap(state, piece('weak-off', 'overclock', DEFENSIVE), 2);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['strong-a', 'strong-b']);
    expect(result.bench.map((p) => p.id)).toEqual(['weak-off']);
  });

  it('does not evict the sole credit provider of an archetype', () => {
    // Ranked by the plain acquisition ladder, 'lone-daemon' scores as
    // "fills no gap" -- precisely because it is what fills it -- and
    // would look cheap to evict. Counterfactual ranking protects it.
    const state = playerState([piece('lone-daemon', 'daemon', CREDIT), piece('spare-exploit', 'exploit', DEFENSIVE)], []);
    const result = acquireSubroutineWithSwap(state, piece('new-exploit', 'exploit', CREDIT), 2);
    expect(result.installedLoadout.map((p) => p.id)).toContain('lone-daemon');
    expect(result.bench.map((p) => p.id)).toEqual(['spare-exploit']);
  });

  it('never evicts a Mod-granted piece, even when it ranks worst', () => {
    const state = {
      ...playerState([piece('granted-junk', 'overclock', DEFENSIVE), piece('weak-off', 'overclock', DEFENSIVE)], []),
      grantedByMod: { 'granted-junk': 'some-mod' },
    };
    const result = acquireSubroutineWithSwap(state, piece('strong-exploit', 'exploit', CREDIT), 1);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['granted-junk', 'strong-exploit']);
    expect(result.bench.map((p) => p.id)).toEqual(['weak-off']);
  });

  it('declines the swap when the only evictable piece is a sole credit provider it cannot beat', () => {
    const state = {
      ...playerState([piece('granted-junk', 'overclock', DEFENSIVE), piece('lone-exploit', 'exploit', CREDIT)], []),
      grantedByMod: { 'granted-junk': 'some-mod' },
    };
    const result = acquireSubroutineWithSwap(state, piece('another-exploit', 'exploit', CREDIT), 1);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['granted-junk', 'lone-exploit']);
    expect(result.bench.map((p) => p.id)).toEqual(['another-exploit']);
  });

  it('leaves acquireSubroutine itself unchanged -- bench-forever stays the default', () => {
    const state = playerState([piece('a', 'overclock', DEFENSIVE), piece('b', 'overclock', DEFENSIVE)], []);
    const strong = piece('strong', 'exploit', CREDIT);
    expect(acquireSubroutine(state, strong, 2).installedLoadout.map((p) => p.id)).toEqual(['a', 'b']);
    expect(acquireSubroutineWithSwap(state, strong, 2).installedLoadout.map((p) => p.id)).toContain('strong');
  });

  it('does not evict an incumbent merely because the candidate is rarer (session 46 regression)', () => {
    const state = playerState([piece('probe', 'exploit', CREDIT)], []);
    const result = acquireSubroutineWithSwap(state, piece('packet-sniffer', 'exploit', CREDIT), 1);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['probe']);
    expect(result.bench.map((p) => p.id)).toEqual(['packet-sniffer']);
  });

  it('still evicts on a genuine archetype improvement', () => {
    const result = acquireSubroutineWithSwap(playerState([piece('off-arch', 'overclock', CREDIT)], []), piece('on-arch', 'exploit', CREDIT), 1);
    expect(result.installedLoadout.map((p) => p.id)).toEqual(['on-arch']);
  });
});

describe("acquireSubroutineWithSwap -- starting kits are never evicted (session 47 regression)", () => {
  // Session 47's bug: a class's starting ward ranked bottom (no credit
  // path) and was swapped out in 72% of runs, leaving the class passive
  // with nothing to fire on. Starting pieces are protected wholesale.
  it("does not evict a class's starting piece, even when it ranks worst", () => {
    const kit = CLASS_DEFINITIONS['exploit-honeypot'].startingLoadout;
    const state = { ...playerState([...kit], []), classId: 'exploit-honeypot' as const };
    const strongOffer = piece('strong-offer', 'honeypot', CREDIT);
    const result = acquireSubroutineWithSwap(state, strongOffer, kit.length);
    for (const starting of kit) expect(result.installedLoadout.map((p) => p.id), `${starting.id} was evicted`).toContain(starting.id);
    expect(result.bench.map((p) => p.id)).toEqual(['strong-offer']);
  });

  it('still evicts a non-starting piece that the candidate outranks', () => {
    const kit = CLASS_DEFINITIONS['exploit-honeypot'].startingLoadout;
    const acquired = piece('weak-acquired', 'overclock', DEFENSIVE);
    const state = { ...playerState([...kit, acquired], []), classId: 'exploit-honeypot' as const };
    const result = acquireSubroutineWithSwap(state, piece('strong-offer', 'honeypot', CREDIT), kit.length + 1);
    expect(result.installedLoadout.map((p) => p.id)).toContain('strong-offer');
    expect(result.bench.map((p) => p.id)).toEqual(['weak-acquired']);
  });
});
