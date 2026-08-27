import { describe, it, expect } from 'vitest';
import type { RunPlayerState } from './run';
import type { SubroutineDefinition } from './subroutine-types';
import { installSubroutine, uninstallSubroutine, reorderInstalled, acquireSubroutine, alwaysAcquireFirst, INSTALLED_SLOT_CAP } from './loadout';

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
