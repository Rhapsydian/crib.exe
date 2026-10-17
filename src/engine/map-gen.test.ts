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

describe('generateLayer -- guaranteed Safehouse (D7, session 52)', () => {
  it('every layer has at least one Safehouse, across many seeds and sizes', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const nodeCount of [4, 8, 12]) {
        const graph = generateLayer({ rng: createRng(seed), nodeCount });
        expect(graph.nodes.some((n) => n.type === 'safehouse'), `seed ${seed}, ${nodeCount} nodes`).toBe(true);
      }
    }
  });

  it('consumes no extra randomness: the guarantee only re-types a node, so the edges match an unguaranteed draw', () => {
    for (let seed = 0; seed < 50; seed++) {
      const guaranteed = generateLayer({ rng: createRng(seed), nodeCount: 10 });
      const plain = generateLayer({ rng: createRng(seed), nodeCount: 10, typeWeights: { safehouse: 0 } });
      expect(guaranteed.edges).toEqual(plain.edges);
    }
  });

  it('respects a caller that weights Safehouses out entirely', () => {
    const graph = generateLayer({ rng: createRng(3), nodeCount: 10, typeWeights: { safehouse: 0 } });
    expect(graph.nodes.some((n) => n.type === 'safehouse')).toBe(false);
  });
});

describe('generateLayer -- milestone 3 layers (M1-M9)', () => {
  const real = (layer: 1 | 2 | 3 | 4, seed: number) => generateLayer({ rng: createRng(seed), nodeCount: [10, 12, 12, 14][layer - 1], layer });
  const neighbours = (g: LayerGraph, id: string) => g.edges.flatMap((e) => (e.a === id ? [e.b] : e.b === id ? [e.a] : []));
  const hops = (g: LayerGraph, from: string) => {
    const d: Record<string, number> = { [from]: 0 };
    const q = [from];
    while (q.length) {
      const id = q.shift()!;
      for (const x of neighbours(g, id)) if (d[x] === undefined) (d[x] = d[id] + 1), q.push(x);
    }
    return d;
  };

  it('deals each layer its mix, plus at most one Cache', () => {
    const mix = { 1: { regularFight: 3, eliteFight: 1, safehouse: 1, shop: 1, event: 1 }, 2: { regularFight: 4, eliteFight: 1, safehouse: 1, shop: 1, event: 1 }, 3: { regularFight: 3, eliteFight: 2, safehouse: 1, shop: 1, event: 1 }, 4: { regularFight: 4, eliteFight: 2, safehouse: 2, shop: 1, event: 1 } } as const;
    for (const layer of [1, 2, 3, 4] as const)
      for (let seed = 1; seed <= 20; seed++) {
        const g = real(layer, seed);
        const count = (t: string) => g.nodes.filter((n) => n.type === t && n.id !== g.entryNodeId).length;
        for (const [type, at] of Object.entries(mix[layer])) expect(count(type), `${type} L${layer}`).toBeGreaterThanOrEqual(at);
        expect(count('cache')).toBeLessThanOrEqual(1);
      }
  });

  it('keeps every rule: resilience, nothing behind the gatekeeper, placement, spacing', () => {
    for (const layer of [1, 2, 3, 4] as const)
      for (let seed = 1; seed <= 25; seed++) {
        const g = real(layer, seed);
        const cache = g.nodes.find((n) => n.type === 'cache')?.id;
        const core: LayerGraph = { ...g, nodes: g.nodes.filter((n) => n.id !== cache), edges: g.edges.filter((e) => e.a !== cache && e.b !== cache) };
        const type = (id: string) => g.nodes.find((n) => n.id === id)!.type;
        // Resilient, and the entry never linked straight to the gatekeeper.
        for (const n of core.nodes) if (n.id !== g.entryNodeId && n.id !== g.gatekeeperNodeId) expect(isReachable(graphExcluding(core, n.id), g.entryNodeId, g.gatekeeperNodeId)).toBe(true);
        expect(neighbours(g, g.entryNodeId)).not.toContain(g.gatekeeperNodeId);
        expect(neighbours(g, g.gatekeeperNodeId)).toHaveLength(2);
        // Nothing reachable only through the gatekeeper.
        const noGk = graphExcluding(core, g.gatekeeperNodeId);
        for (const n of core.nodes) if (n.id !== g.gatekeeperNodeId) expect(isReachable(noGk, g.entryNodeId, n.id)).toBe(true);
        // Placement.
        expect(neighbours(g, g.entryNodeId).some((id) => type(id) === 'eliteFight')).toBe(false);
        const fromGk = hops(core, g.gatekeeperNodeId);
        expect(core.nodes.some((n) => n.type === 'safehouse' && fromGk[n.id] <= 2)).toBe(true);
        for (const e of g.edges) if (['safehouse', 'shop', 'event'].includes(type(e.a))) expect(type(e.b)).not.toBe(type(e.a));
        for (const n of g.nodes) if (n.type === 'relay' && n.id !== g.entryNodeId) expect(neighbours(g, n.id).length).toBeGreaterThanOrEqual(2);
        // Every node has a position, none on a neighbouring hex (M9).
        const pts = g.nodes.map((n) => ({ x: 9 + n.x! * 82, y: 9 + n.y! * 132 }));
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)).toBeGreaterThan(Math.sqrt(3) * 5 * 1.5);
        // A Cache is a dead end, at least two moves off the shortest route.
        if (cache) expect(neighbours(g, cache)).toHaveLength(1);
      }
  });

  it('climbs farther than the old generator: 3+ moves to the gatekeeper', () => {
    for (const layer of [1, 2, 3, 4] as const) for (let seed = 1; seed <= 25; seed++) expect(hops(real(layer, seed), 'n0').n1).toBeGreaterThanOrEqual(3);
  });

  it('still makes tiny test layers (relaxed rules)', () => {
    for (const n of [2, 3, 4, 6]) {
      const g = generateLayer({ rng: createRng(n), nodeCount: n });
      expect(g.nodes).toHaveLength(n);
      expect(isReachable(g, g.entryNodeId, g.gatekeeperNodeId)).toBe(true);
    }
  });
});
