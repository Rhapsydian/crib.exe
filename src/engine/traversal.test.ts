import { describe, it, expect } from 'vitest';
import { createNode, type LayerGraph } from './map-types';
import { legalMoves, move } from './traversal';
import { HEAT_PER_MOVE } from './heat';

// a -- b -- c
//      |
//      d (closed)
function buildGraph(dState: 'unresolved' | 'inert' | 'closed'): LayerGraph {
  const a = createNode('a', 'relay');
  const b = createNode('b', 'regularFight');
  const c = createNode('c', 'gatekeeperFight');
  const d = { ...createNode('d', 'regularFight'), state: dState };
  return {
    nodes: [a, b, c, d],
    edges: [
      { a: 'a', b: 'b' },
      { a: 'b', b: 'c' },
      { a: 'b', b: 'd' },
    ],
    entryNodeId: 'a',
    gatekeeperNodeId: 'c',
  };
}

describe('legalMoves', () => {
  it('lists only direct neighbors, not multi-hop nodes', () => {
    const graph = buildGraph('unresolved');
    expect(legalMoves(graph, { layerIndex: 0, nodeId: 'a' })).toEqual(['b']);
  });

  it('includes inert neighbors -- still fully passable', () => {
    const graph = buildGraph('inert');
    expect(legalMoves(graph, { layerIndex: 0, nodeId: 'b' }).sort()).toEqual(['a', 'c', 'd']);
  });

  it('excludes closed neighbors -- genuinely impassable', () => {
    const graph = buildGraph('closed');
    expect(legalMoves(graph, { layerIndex: 0, nodeId: 'b' }).sort()).toEqual(['a', 'c']);
  });
});

describe('move', () => {
  it('moves to a legal target and charges the flat per-move Heat cost', () => {
    const graph = buildGraph('unresolved');
    const result = move(graph, { layerIndex: 2, nodeId: 'a' }, 'b');
    expect(result).toEqual({ position: { layerIndex: 2, nodeId: 'b' }, heatCost: HEAT_PER_MOVE });
  });

  it('throws for a non-adjacent target', () => {
    const graph = buildGraph('unresolved');
    expect(() => move(graph, { layerIndex: 0, nodeId: 'a' }, 'c')).toThrow();
  });

  it('throws when moving into a closed node', () => {
    const graph = buildGraph('closed');
    expect(() => move(graph, { layerIndex: 0, nodeId: 'b' }, 'd')).toThrow();
  });

  it('allows moving back into already-resolved territory (free-roam)', () => {
    const graph = buildGraph('inert');
    const forward = move(graph, { layerIndex: 0, nodeId: 'a' }, 'b');
    const back = move(graph, forward.position, 'a');
    expect(back.position).toEqual({ layerIndex: 0, nodeId: 'a' });
  });
});
