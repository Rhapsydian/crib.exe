import type { Rng } from './rng';
import { createNode, isReachable, type LayerGraph, type MapEdge, type MapNode, type NodeType } from './map-types';

/**
 * Layer generation, rebuilt in milestone 3 (docs/playable-design.md
 * M1-M9). The old generator -- a random tree plus ~n/2 links between any
 * two nodes -- measured as a hairball: ~3 links a node, hubs of up to 9,
 * and the gatekeeper 1-2 moves from the entry (one move in 37-52% of
 * layers). This one places nodes first and links only near neighbours,
 * so a layer reads as a network and draws itself:
 *
 * 1. Scatter: entry bottom-centre, gatekeeper top-centre, the rest spread
 *    evenly (best-candidate sampling), each centred on a hex of the
 *    map's backdrop grid with no two on neighbouring hexes (M9).
 * 2. Link: non-crossing near-neighbour links, none much longer than the
 *    typical gap (long links were the shortcuts); the entry keeps its
 *    three nearest, the gatekeeper exactly its two nearest, and the two
 *    are never linked. A spanning tree first, then links until the
 *    layer is resilient -- removing any one node other than the entry
 *    and gatekeeper still leaves the gatekeeper reachable (session 19) --
 *    and nothing is reachable only through the gatekeeper.
 * 3. Types: a real layer (`layer` 1-4 at its own size) is dealt its set
 *    mix (M7) under placement rules: no elite next to the entry, a
 *    Safehouse within two moves of the gatekeeper, no two of the same
 *    special node adjacent, a relay only where it has 2+ links (M6).
 *    Any other call rolls types by weight, as before, with at least one
 *    Safehouse (D7).
 * 4. Maybe a Cache (M8, real layers only): a dead end hung off the node
 *    farthest from the shortest entry-to-gatekeeper route.
 *
 * Layers too small for those rules (the tests' tiny layers) fall back to
 * a relaxed pass: same scatter and links, rules waived where they can't
 * hold.
 */
type FillerNodeType = Exclude<NodeType, 'gatekeeperFight' | 'cache'>;
type Pt = { x: number; y: number };
export type LayerNumber = 1 | 2 | 3 | 4;

/** Layer sizes (M5): the run climbs toward a bigger final layer. */
export const LAYER_SIZES: [number, number, number, number] = [10, 12, 12, 14];

/** Each real layer's dealt mix (M7): a set core plus flex slots. */
const LAYER_MIX: Record<LayerNumber, { core: Partial<Record<FillerNodeType, number>>; flex: number }> = {
  1: { core: { regularFight: 3, eliteFight: 1, safehouse: 1, shop: 1, event: 1 }, flex: 1 },
  2: { core: { regularFight: 4, eliteFight: 1, safehouse: 1, shop: 1, event: 1 }, flex: 2 },
  3: { core: { regularFight: 3, eliteFight: 2, safehouse: 1, shop: 1, event: 1 }, flex: 2 },
  4: { core: { regularFight: 4, eliteFight: 2, safehouse: 2, shop: 1, event: 1 }, flex: 2 },
};
const FLEX_WEIGHTS: [FillerNodeType, number][] = [
  ['relay', 0.35],
  ['regularFight', 0.3],
  ['event', 0.2],
  ['eliteFight', 0.15],
];
/** Chance a real layer has a Cache (M8), by layer. */
const CACHE_CHANCE: Record<LayerNumber, number> = { 1: 0.35, 2: 0.5, 3: 0.5, 4: 0.5 };

/** The weighted roll every non-dealt layer uses (the pre-M7 mix). */
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
  /** Total node count including the entry and gatekeeper (a Cache, if
   * any, is extra). */
  nodeCount: number;
  /** Which layer of the run (1-4). With its own size (LAYER_SIZES), the
   * layer is dealt its mix and may get a Cache; without it, types roll by
   * weight and there's no Cache. */
  layer?: LayerNumber;
  /** Overrides for the weighted roll (forces the roll, even for a real
   * layer). Unspecified types fall back to the default. */
  typeWeights?: Partial<Record<FillerNodeType, number>>;
}

// ---------------------------------------------------------------- grid

/**
 * The map's drawing area (SVG units, portrait) and its backdrop of
 * pointy-top hexes of radius R, odd rows shifted right. Positions are
 * stored as 0..1 within the padded area; the screen draws them on this
 * same grid, so a node centred on a hex here sits on the hex drawn.
 */
export const MAP_VIEW = { W: 100, H: 150, P: 9, R: 5 };
const HEX_W = Math.sqrt(3) * MAP_VIEW.R;
/** Neighbouring hexes are HEX_W apart; the next ring out is 1.73x. */
const NEIGHBOUR_REACH = HEX_W * 1.5;

export function backdropCells(): Pt[] {
  const cells: Pt[] = [];
  for (let r = 0; r * 1.5 * MAP_VIEW.R < MAP_VIEW.H + MAP_VIEW.R; r++)
    for (let c = -1; c * HEX_W < MAP_VIEW.W + HEX_W; c++) cells.push({ x: c * HEX_W + (r % 2) * (HEX_W / 2), y: r * 1.5 * MAP_VIEW.R });
  return cells;
}

const toUnit = (p: Pt): Pt => ({ x: (p.x - MAP_VIEW.P) / (MAP_VIEW.W - 2 * MAP_VIEW.P), y: (p.y - MAP_VIEW.P) / (MAP_VIEW.H - 2 * MAP_VIEW.P) });
const toView = (p: Pt): Pt => ({ x: MAP_VIEW.P + p.x * (MAP_VIEW.W - 2 * MAP_VIEW.P), y: MAP_VIEW.P + p.y * (MAP_VIEW.H - 2 * MAP_VIEW.P) });
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
/** Lengths as drawn (unit positions stretched to the portrait area). */
const drawnDist = (a: Pt, b: Pt) => dist(toView(a), toView(b));

// ---------------------------------------------------------------- generate

const STRICT_ATTEMPTS = 300;

export function generateLayer(options: LayerGenOptions): LayerGraph {
  const { nodeCount } = options;
  if (nodeCount < 2) throw new Error('generateLayer requires at least 2 nodes (entry + gatekeeper)');
  const dealt = options.layer !== undefined && !options.typeWeights && LAYER_SIZES[options.layer - 1] === nodeCount ? options.layer : undefined;
  for (let attempt = 0; attempt < STRICT_ATTEMPTS; attempt++) {
    const layer = tryLayer(options, dealt, true);
    if (layer) return layer;
  }
  // Too small (or too constrained) for the full rules: relax them.
  for (;;) {
    const layer = tryLayer(options, undefined, false);
    if (layer) return layer;
  }
}

function tryLayer(options: LayerGenOptions, dealt: LayerNumber | undefined, strict: boolean): LayerGraph | null {
  const { rng, nodeCount } = options;
  const ids = Array.from({ length: nodeCount }, (_, i) => `n${i}`);
  const pos = scatter(ids, rng);
  const edges = link(ids, pos, rng, strict);
  if (!edges) return null;
  if (strict && somethingBehindGatekeeper(ids, edges)) return null;
  const types = dealt ? dealTypes(ids, edges, dealt, rng) : rollTypes(ids, rng, options.typeWeights);
  if (!types) return null;
  const nodes: MapNode[] = ids.map((id) => ({ ...createNode(id, types[id]), x: pos[id].x, y: pos[id].y }));
  const graph: LayerGraph = { nodes, edges, entryNodeId: 'n0', gatekeeperNodeId: 'n1' };
  if (dealt && rng.next() < CACHE_CHANCE[dealt]) {
    const spot = placeCache(ids, edges, pos);
    if (spot) {
      graph.nodes.push({ ...createNode(spot.id, 'cache'), x: spot.at.x, y: spot.at.y });
      graph.edges = [...edges, { a: spot.anchor, b: spot.id }];
    }
  }
  return graph;
}

/** Even scatter in a portrait band, each node centred on its nearest
 * free backdrop hex, none on a hex next to one already taken (M9). */
function scatter(ids: string[], rng: Rng): Record<string, Pt> {
  const pos: Record<string, Pt> = { n0: { x: 0.5, y: 0.97 }, n1: { x: 0.5, y: 0.03 } };
  for (const id of ids.slice(2)) {
    let best: Pt = { x: 0.5, y: 0.5 };
    let bestD = -1;
    for (let t = 0; t < 14; t++) {
      const p = { x: 0.08 + rng.next() * 0.84, y: 0.14 + rng.next() * 0.72 };
      const d = Math.min(...Object.values(pos).map((q) => dist(p, q) * (Math.abs(p.y - q.y) > 0.1 ? 1 : 0.9)));
      if (d > bestD) [best, bestD] = [p, d];
    }
    pos[id] = best;
  }
  const free = backdropCells().filter((c) => {
    const u = toUnit(c);
    return u.x >= -0.01 && u.x <= 1.01 && u.y >= -0.01 && u.y <= 1.01;
  });
  for (const id of ids) {
    const v = toView(pos[id]);
    let best = -1;
    for (let i = 0; i < free.length; i++) if (best === -1 || dist(free[i], v) < dist(free[best], v)) best = i;
    const cell = free[best];
    pos[id] = toUnit(cell);
    for (let i = free.length - 1; i >= 0; i--) if (dist(free[i], cell) < NEIGHBOUR_REACH) free.splice(i, 1);
  }
  return pos;
}

function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const o = (a: Pt, b: Pt, c: Pt) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0;
}

/** Every link drawable without crossing a shorter one (greedy, shortest
 * first: a near-triangulation). */
function planarCandidates(ids: string[], pos: Record<string, Pt>): MapEdge[] {
  const pairs: [string, string, number][] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j], dist(pos[ids[i]], pos[ids[j]])]);
  pairs.sort((a, b) => a[2] - b[2]);
  const kept: MapEdge[] = [];
  for (const [a, b] of pairs) {
    if (!kept.some((e) => e.a !== a && e.a !== b && e.b !== a && e.b !== b && segmentsCross(pos[a], pos[b], pos[e.a], pos[e.b]))) kept.push({ a, b });
  }
  return kept;
}

/** The median distance from a node to its nearest neighbour, as drawn. */
function typicalGap(ids: string[], pos: Record<string, Pt>): number {
  const nearest = ids.map((id) => Math.min(...ids.filter((o) => o !== id).map((o) => drawnDist(pos[id], pos[o])))).sort((a, b) => a - b);
  return nearest[Math.floor(nearest.length / 2)];
}

/** How much longer than the typical gap a link may be: the main lever on
 * the distance to the gatekeeper (long links are shortcuts). */
const MAX_LINK_FACTOR = 1.35;
/** Links a layer aims for, per node, once it's resilient. */
const TARGET_LINKS_PER_NODE = 2.4;

const touches = (e: MapEdge, id: string) => e.a === id || e.b === id;

/** Candidates (strict: capped length; the entry's three nearest and the
 * gatekeeper's two nearest; never entry-gatekeeper), then a spanning tree
 * and links until resilient. Relaxed: any non-crossing link, and the best
 * it can manage. Null if strict can't make it resilient. */
function link(ids: string[], pos: Record<string, Pt>, rng: Rng, strict: boolean): MapEdge[] | null {
  if (ids.length === 2) return strict ? null : [{ a: 'n0', b: 'n1' }];
  const len = (e: MapEdge) => drawnDist(pos[e.a], pos[e.b]);
  const planar = planarCandidates(ids, pos);
  let candidates = planar;
  if (strict) {
    const typical = typicalGap(ids, pos);
    const allowed = planar.filter((e) => !(touches(e, 'n0') && touches(e, 'n1')));
    const nearest = (id: string, k: number) => allowed.filter((e) => touches(e, id)).sort((a, b) => len(a) - len(b)).slice(0, k);
    candidates = [...allowed.filter((e) => !touches(e, 'n0') && !touches(e, 'n1') && len(e) <= typical * MAX_LINK_FACTOR), ...nearest('n0', 3), ...nearest('n1', 2)];
  }
  const order = candidates.map((e) => ({ e, w: len(e) * (0.75 + rng.next() * 0.5) })).sort((a, b) => a.w - b.w).map((x) => x.e);
  const parent: Record<string, string> = Object.fromEntries(ids.map((id) => [id, id]));
  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const edges: MapEdge[] = [];
  const rest: MapEdge[] = [];
  for (const e of order) {
    const [ra, rb] = [find(e.a), find(e.b)];
    if (ra !== rb) {
      parent[ra] = rb;
      edges.push(e);
    } else rest.push(e);
  }
  if (new Set(ids.map(find)).size > 1) return null;
  const resilientNow = () => isResilient(ids, edges);
  for (const e of rest) {
    if (resilientNow() && (edges.length * 2) / ids.length >= TARGET_LINKS_PER_NODE) break;
    edges.push(e);
  }
  return !strict || resilientNow() ? edges : null;
}

/** Removing any one node other than the entry and gatekeeper still leaves
 * the gatekeeper reachable. */
function isResilient(ids: string[], edges: MapEdge[]): boolean {
  const graphOf = (es: MapEdge[]): LayerGraph => ({ nodes: [], edges: es, entryNodeId: 'n0', gatekeeperNodeId: 'n1' });
  if (!isReachable(graphOf(edges), 'n0', 'n1')) return false;
  return ids.every((id) => id === 'n0' || id === 'n1' || isReachable(graphOf(edges.filter((e) => !touches(e, id))), 'n0', 'n1'));
}

/** True if some node is reachable only through the gatekeeper: breaching
 * it moves you to the next layer, so that node could never be used. */
function somethingBehindGatekeeper(ids: string[], edges: MapEdge[]): boolean {
  const without: LayerGraph = { nodes: [], edges: edges.filter((e) => !touches(e, 'n1')), entryNodeId: 'n0', gatekeeperNodeId: 'n1' };
  return ids.some((id) => id !== 'n1' && !isReachable(without, 'n0', id));
}

// ---------------------------------------------------------------- types

function bfs(edges: MapEdge[], from: string[]): Record<string, number> {
  const d: Record<string, number> = Object.fromEntries(from.map((id) => [id, 0]));
  const q = [...from];
  while (q.length) {
    const id = q.shift()!;
    for (const e of edges) {
      const x = e.a === id ? e.b : e.b === id ? e.a : null;
      if (x !== null && d[x] === undefined) {
        d[x] = d[id] + 1;
        q.push(x);
      }
    }
  }
  return d;
}

function pickWeighted<T extends string>(weights: [T, number][], rng: Rng): T {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.next() * total;
  for (const [t, w] of weights) {
    if (roll < w) return t;
    roll -= w;
  }
  return weights[weights.length - 1][0];
}

/** Weighted roll (the pre-M7 behaviour), with at least one Safehouse
 * unless Safehouses are weighted out (D7). */
function rollTypes(ids: string[], rng: Rng, overrides?: Partial<Record<FillerNodeType, number>>): Record<string, NodeType> {
  const weights = Object.entries({ ...DEFAULT_TYPE_WEIGHTS, ...overrides }) as [FillerNodeType, number][];
  const types: Record<string, NodeType> = { n0: 'relay', n1: 'gatekeeperFight' };
  const filler = ids.slice(2);
  for (const id of filler) types[id] = pickWeighted(weights, rng);
  const safehouseWeight = (overrides?.safehouse ?? DEFAULT_TYPE_WEIGHTS.safehouse) > 0;
  if (safehouseWeight && filler.length > 0 && !filler.some((id) => types[id] === 'safehouse')) types[filler[filler.length - 1]] = 'safehouse';
  return types;
}

/** Deals a real layer's mix under the placement rules (see the header);
 * null if no shuffle fits this layout. */
function dealTypes(ids: string[], edges: MapEdge[], layer: LayerNumber, rng: Rng): Record<string, NodeType> | null {
  const filler = ids.slice(2);
  const { core, flex } = LAYER_MIX[layer];
  const deck: FillerNodeType[] = (Object.entries(core) as [FillerNodeType, number][]).flatMap(([t, k]) => Array<FillerNodeType>(k).fill(t));
  for (let i = 0; i < flex; i++) deck.push(pickWeighted(FLEX_WEIGHTS, rng));
  const neighbours = (id: string) => edges.flatMap((e) => (e.a === id ? [e.b] : e.b === id ? [e.a] : []));
  const fromGatekeeper = bfs(edges, ['n1']);
  const special = new Set<NodeType>(['safehouse', 'shop', 'event']);
  for (let attempt = 0; attempt < 400; attempt++) {
    const cards = [...deck];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    const types: Record<string, NodeType> = { n0: 'relay', n1: 'gatekeeperFight' };
    filler.forEach((id, i) => (types[id] = cards[i]));
    const ok =
      filler.every((id) => types[id] !== 'relay' || neighbours(id).length >= 2) &&
      neighbours('n0').every((id) => types[id] !== 'eliteFight') &&
      filler.some((id) => types[id] === 'safehouse' && fromGatekeeper[id] <= 2) &&
      edges.every((e) => !(types[e.a] === types[e.b] && special.has(types[e.a])));
    if (ok) return types;
  }
  return null;
}

/** A Cache spot: a free hex near the node farthest from the shortest
 * entry-to-gatekeeper route (or the next farthest, if there's no room),
 * keeping the hex spacing, its link crossing nothing. */
function placeCache(ids: string[], edges: MapEdge[], pos: Record<string, Pt>): { id: string; at: Pt; anchor: string } | null {
  const toEntry = bfs(edges, ['n0']);
  const route = ['n1'];
  while (route[route.length - 1] !== 'n0') {
    const at = route[route.length - 1];
    const back = edges.flatMap((e) => (e.a === at ? [e.b] : e.b === at ? [e.a] : [])).find((x) => toEntry[x] === toEntry[at] - 1);
    if (!back) return null;
    route.push(back);
  }
  const offRoute = bfs(edges, route);
  const anchors = ids.filter((id) => id !== 'n0' && id !== 'n1' && offRoute[id] >= 1).sort((a, b) => offRoute[b] - offRoute[a]);
  const gap = typicalGap(ids, pos);
  const cells = backdropCells()
    .map(toUnit)
    .filter((u) => u.x >= 0 && u.x <= 1 && u.y >= 0.05 && u.y <= 0.95);
  for (const anchor of anchors) {
    const spot = cells
      .filter((u) => drawnDist(u, pos[anchor]) >= gap * 0.75 && drawnDist(u, pos[anchor]) <= gap * 1.5)
      .filter((u) => !edges.some((e) => e.a !== anchor && e.b !== anchor && segmentsCross(u, pos[anchor], pos[e.a], pos[e.b])))
      .map((u) => ({ u, room: Math.min(...ids.map((id) => drawnDist(u, pos[id]))) }))
      .filter((x) => x.room >= gap * 0.65 && x.room >= NEIGHBOUR_REACH)
      .sort((a, b) => b.room - a.room)[0];
    if (spot) return { id: `n${ids.length}`, at: spot.u, anchor };
  }
  return null;
}
