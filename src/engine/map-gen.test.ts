import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { isReachable, type LayerGraph } from './map-types';
import { generateLayer } from './map-gen';

function graphExcluding(graph: LayerGraph, excludeId: string): LayerGraph {
  return { ...graph, edges: graph.edges.filter((e) => e.a !== excludeId && e.b !== excludeId) };
}

describe('generateLayer', () => {
  it('produces exactly nodeCount nodes', () => {
    const graph = generateLayer({ rng: createRng(1), nodeCount: 12 });
    expect(graph.nodes).toHaveLength(12);
  });

  it('always makes the entry a Relay and the gatekeeper a gatekeeperFight', () => {
    const graph = generateLayer({ rng: createRng(1), nodeCount: 12 });
    const entry = graph.nodes.find((n) => n.id === graph.entryNodeId);
    const gatekeeper = graph.nodes.find((n) => n.id === graph.gatekeeperNodeId);
    expect(entry?.type).toBe('relay');
    expect(entry?.state).toBe('inert');
    expect(gatekeeper?.type).toBe('gatekeeperFight');
    expect(gatekeeper?.state).toBe('unresolved');
  });

  it('is deterministic for the same seed', () => {
    const a = generateLayer({ rng: createRng(42), nodeCount: 12 });
    const b = generateLayer({ rng: createRng(42), nodeCount: 12 });
    expect(a).toEqual(b);
  });

  it('produces different layouts for different seeds', () => {
    const a = generateLayer({ rng: createRng(1), nodeCount: 12 });
    const b = generateLayer({ rng: createRng(2), nodeCount: 12 });
    expect(a).not.toEqual(b);
  });

  it('handles the minimum 2-node case by connecting entry directly to gatekeeper', () => {
    const graph = generateLayer({ rng: createRng(1), nodeCount: 2 });
    expect(isReachable(graph, graph.entryNodeId, graph.gatekeeperNodeId)).toBe(true);
  });

  it('rejects fewer than 2 nodes', () => {
    expect(() => generateLayer({ rng: createRng(1), nodeCount: 1 })).toThrow();
  });

  it('the gatekeeper survives removal of any single other node, across many seeds', () => {
    for (let seed = 0; seed < 25; seed++) {
      const graph = generateLayer({ rng: createRng(seed), nodeCount: 12 });
      for (const node of graph.nodes) {
        if (node.id === graph.entryNodeId || node.id === graph.gatekeeperNodeId) continue;
        const withoutNode = graphExcluding(graph, node.id);
        expect(isReachable(withoutNode, graph.entryNodeId, graph.gatekeeperNodeId)).toBe(true);
      }
    }
  });

  it('respects custom type weights (e.g. all-relay fillers)', () => {
    const graph = generateLayer({
      rng: createRng(1),
      nodeCount: 8,
      typeWeights: { regularFight: 0, eliteFight: 0, safehouse: 0, shop: 0, event: 0, relay: 1 },
    });
    const fillers = graph.nodes.filter((n) => n.id !== graph.entryNodeId && n.id !== graph.gatekeeperNodeId);
    expect(fillers.every((n) => n.type === 'relay')).toBe(true);
  });
});
