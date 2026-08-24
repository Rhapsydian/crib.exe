import type { Rng } from './rng';
import { createNode, isReachable, neighborsOf, type LayerGraph, type MapEdge, type NodeType } from './map-types';

/**
 * Layer generation (session 19/20 checkpoint B): generate-then-verify,
 * not a hand-proved topology. A random connected graph is built, extra
 * edges are added for density, and then the session 19 graph-resilience
 * guarantee is checked and repaired: the gatekeeper must stay reachable
 * from the entry after removing *any single* other node, so one closed
 * (lost) fight can never soft-lock the layer on its own.
 */

type FillerNodeType = Exclude<NodeType, 'gatekeeperFight'>;

const DEFAULT_TYPE_WEIGHTS: Record<FillerNodeType, number> = {
  regularFight: 0.4,
  eliteFight: 0.15, // rarer and tougher than a regular fight -- see heat.ts/encounters.ts
  safehouse: 0.15,
  shop: 0.1,
  event: 0.1,
  relay: 0.1,
};

export interface LayerGenOptions {
  rng: Rng;
  /** Total node count including the entry and gatekeeper. TBD/playtesting. */
  nodeCount: number;
  /** Overrides for the filler-node type mix (everything but the fixed
   * entry/gatekeeper nodes). Unspecified types fall back to the default. */
  typeWeights?: Partial<Record<FillerNodeType, number>>;
}

const MAX_RESILIENCE_ITERATIONS = 20;

export function generateLayer(options: LayerGenOptions): LayerGraph {
  const { rng, nodeCount, typeWeights } = options;
  if (nodeCount < 2) {
    throw new Error('generateLayer requires at least 2 nodes (entry + gatekeeper)');
  }

  const weights: Record<FillerNodeType, number> = { ...DEFAULT_TYPE_WEIGHTS, ...typeWeights };

  // The entry is always a Relay -- arriving at the layer's own starting
  // position should never itself be an encounter.
  const entryNode = createNode('n0', 'relay');
  const gatekeeperNode = createNode('n1', 'gatekeeperFight');
  const fillerNodes = [];
  for (let i = 2; i < nodeCount; i++) {
    fillerNodes.push(createNode(`n${i}`, pickWeightedType(weights, rng)));
  }

  const nodes = [entryNode, gatekeeperNode, ...fillerNodes];
  const nodeIds = nodes.map((n) => n.id);

  let edges = buildSpanningTree(nodeIds, rng);
  edges = addRandomEdges(nodeIds, edges, rng, Math.ceil(nodeCount / 2));

  const graph: LayerGraph = { nodes, edges, entryNodeId: entryNode.id, gatekeeperNodeId: gatekeeperNode.id };
  return { ...graph, edges: ensureResilience(graph, rng) };
}

function pickWeightedType(weights: Record<FillerNodeType, number>, rng: Rng): FillerNodeType {
  const entries = Object.entries(weights) as [FillerNodeType, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.next() * total;
  for (const [type, weight] of entries) {
    if (roll < weight) return type;
    roll -= weight;
  }
  return entries[entries.length - 1][0];
}

/** Randomized-attachment spanning tree: every new node attaches to an
 * already-connected one, which guarantees full connectivity by
 * construction without needing union-find. */
function buildSpanningTree(nodeIds: string[], rng: Rng): MapEdge[] {
  const connected = [nodeIds[0]];
  const remaining = nodeIds.slice(1);
  const edges: MapEdge[] = [];
  while (remaining.length > 0) {
    const newNode = remaining.splice(rng.nextInt(remaining.length), 1)[0];
    const existingNode = connected[rng.nextInt(connected.length)];
    edges.push({ a: existingNode, b: newNode });
    connected.push(newNode);
  }
  return edges;
}

function edgeExists(edges: MapEdge[], a: string, b: string): boolean {
  return edges.some((edge) => (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a));
}

function addRandomEdges(nodeIds: string[], edges: MapEdge[], rng: Rng, count: number): MapEdge[] {
  const result = edges.slice();
  const maxAttempts = Math.max(count * 10, 20);
  let added = 0;
  for (let attempt = 0; added < count && attempt < maxAttempts; attempt++) {
    const a = nodeIds[rng.nextInt(nodeIds.length)];
    const b = nodeIds[rng.nextInt(nodeIds.length)];
    if (a === b || edgeExists(result, a, b)) continue;
    result.push({ a, b });
    added++;
  }
  return result;
}

/** Every node except the entry/gatekeeper themselves must be safe to
 * lose -- removing it can't cut off the gatekeeper from the entry. */
function findWeakNodes(graph: LayerGraph): string[] {
  return graph.nodes
    .map((n) => n.id)
    .filter((id) => id !== graph.entryNodeId && id !== graph.gatekeeperNodeId)
    .filter((id) => {
      const withoutNode: LayerGraph = { ...graph, edges: graph.edges.filter((e) => e.a !== id && e.b !== id) };
      return !isReachable(withoutNode, graph.entryNodeId, graph.gatekeeperNodeId);
    });
}

function pickTwoDistinct(items: string[], rng: Rng): [string, string] {
  const i = rng.nextInt(items.length);
  let j = rng.nextInt(items.length - 1);
  if (j >= i) j++;
  return [items[i], items[j]];
}

function ensureResilience(graph: LayerGraph, rng: Rng): MapEdge[] {
  let edges = graph.edges;
  const nodeIds = graph.nodes.map((n) => n.id);

  for (let iteration = 0; iteration < MAX_RESILIENCE_ITERATIONS; iteration++) {
    const current: LayerGraph = { ...graph, edges };
    const weakNodes = findWeakNodes(current);
    if (weakNodes.length === 0) return edges;

    for (const weakId of weakNodes) {
      const neighbors = neighborsOf(current, weakId);
      const bypassable = neighbors.length >= 2 ? pickTwoDistinct(neighbors, rng) : null;
      if (bypassable && !edgeExists(edges, bypassable[0], bypassable[1])) {
        edges = [...edges, { a: bypassable[0], b: bypassable[1] }];
      } else {
        // Rare fallback for a near-isolated weak node: just add general
        // redundancy and let the next iteration re-check.
        edges = addRandomEdges(nodeIds, edges, rng, 1);
      }
    }
  }

  throw new Error('generateLayer could not achieve the graph-resilience guarantee within the retry budget');
}
