import { describe, it, expect } from 'vitest';
import { createNode, isReachable, neighborsOf, type LayerGraph, type NodeType } from './map-types';

describe('createNode', () => {
  it('starts unresolved for every encounter-bearing node type', () => {
    const encounterTypes: NodeType[] = ['regularFight', 'gatekeeperFight', 'safehouse', 'shop', 'event'];
    for (const type of encounterTypes) {
      expect(createNode('n1', type).state).toBe('unresolved');
    }
  });

  it('starts a relay node already inert -- no encounter to resolve', () => {
    expect(createNode('n1', 'relay').state).toBe('inert');
  });

  it('preserves the id and type it was given', () => {
    expect(createNode('gatekeeper-0', 'gatekeeperFight')).toEqual({
      id: 'gatekeeper-0',
      type: 'gatekeeperFight',
      state: 'unresolved',
    });
  });
});

describe('neighborsOf / isReachable', () => {
  // a -- b -- c    d (isolated)
  const graph: LayerGraph = {
    nodes: [
      createNode('a', 'relay'),
      createNode('b', 'relay'),
      createNode('c', 'relay'),
      createNode('d', 'relay'),
    ],
    edges: [
      { a: 'a', b: 'b' },
      { a: 'b', b: 'c' },
    ],
    entryNodeId: 'a',
    gatekeeperNodeId: 'c',
  };

  it('lists neighbors from either edge direction', () => {
    expect(neighborsOf(graph, 'b').sort()).toEqual(['a', 'c']);
  });

  it('is reachable across multiple hops', () => {
    expect(isReachable(graph, 'a', 'c')).toBe(true);
  });

  it('is not reachable to an isolated node', () => {
    expect(isReachable(graph, 'a', 'd')).toBe(false);
  });

  it('treats a node as reachable from itself', () => {
    expect(isReachable(graph, 'b', 'b')).toBe(true);
  });
});
