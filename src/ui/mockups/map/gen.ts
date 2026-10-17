import { createNode, isReachable, type LayerGraph, type MapEdge, type NodeType } from '../../../engine/map-types';
import { createRng, type Rng } from '../../../engine/rng';

/** A position per node id, in a 0..1 square (x right, y down). */
export type Positions = Record<string, { x: number; y: number }>;

/**
 * The map-generation prototype for milestone 3: *scatter* (the user's
 * pick over subnets, a hybrid and hex-grid variants, after the current
 * generator measured as a hairball: ~3 links a node, hubs of up to 9,
 * the gatekeeper 1-2 moves from the entry). Nodes are placed first with
 * even spacing, centred on the backdrop's hexes, then linked only to near
 * neighbours, never crossing, so the map draws itself. Then node types
 * are dealt from the layer's set mix (M7) under placement rules, and
 * sometimes a Cache is hung off the far side (M8). It keeps the engine's
 * resilience rule: no single lost node can cut the entry off from the
 * gatekeeper.
 *
 * Mockup code: once refined it moves into the engine's map-gen.ts.
 */

/** Node kinds on the map: the engine's types plus the Cache (M8), which
 * the engine doesn't have yet. */
export type MapKind = NodeType | 'cache';

export interface GenMap {
  graph: LayerGraph;
  pos: Positions;
  kind: Record<string, MapKind>;
  /** The Cache's id, when this layer has one. */
  cache?: string;
  /** False when the generator gave up on resilience (shown, not hidden). */
  resilient: boolean;
}

type Pt = { x: number; y: number };
type Filler = Exclude<NodeType, 'gatekeeperFight'>;
export type LayerNumber = 1 | 2 | 3 | 4;

/** Layer sizes (M5) and each layer's dealt mix (M7): a set core plus
 * flex slots drawn from FLEX. */
export const LAYER_SIZE: Record<LayerNumber, number> = { 1: 10, 2: 12, 3: 12, 4: 14 };
const CORE: Record<LayerNumber, { mix: Partial<Record<Filler, number>>; flex: number }> = {
  1: { mix: { regularFight: 3, eliteFight: 1, safehouse: 1, shop: 1, event: 1 }, flex: 1 },
  2: { mix: { regularFight: 4, eliteFight: 1, safehouse: 1, shop: 1, event: 1 }, flex: 2 },
  3: { mix: { regularFight: 3, eliteFight: 2, safehouse: 1, shop: 1, event: 1 }, flex: 2 },
  4: { mix: { regularFight: 4, eliteFight: 2, safehouse: 2, shop: 1, event: 1 }, flex: 2 },
};
const FLEX: [Filler, number][] = [
  ['relay', 0.35],
  ['regularFight', 0.3],
  ['event', 0.2],
  ['eliteFight', 0.15],
];
/** Chance a layer has a Cache (M8). */
const CACHE_CHANCE: Record<LayerNumber, number> = { 1: 0.35, 2: 0.5, 3: 0.5, 4: 0.5 };

function pickFlex(rng: Rng): Filler {
  let roll = rng.next();
  for (const [t, w] of FLEX) {
    if (roll < w) return t;
    roll -= w;
  }
  return 'regularFight';
}

/** The engine's resilience rule: removing any single node other than the
 * entry and gatekeeper still leaves the gatekeeper reachable. */
export function isResilient(graph: LayerGraph): boolean {
  if (!isReachable(graph, graph.entryNodeId, graph.gatekeeperNodeId)) return false;
  for (const n of graph.nodes) {
    if (n.id === graph.entryNodeId || n.id === graph.gatekeeperNodeId) continue;
    const without = { ...graph, edges: graph.edges.filter((e) => e.a !== n.id && e.b !== n.id) };
    if (!isReachable(without, graph.entryNodeId, graph.gatekeeperNodeId)) return false;
  }
  return true;
}

/** Breadth-first distances from any of `from`. */
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

export function hops(graph: LayerGraph): number {
  return bfs(graph.edges, [graph.entryNodeId])[graph.gatekeeperNodeId] ?? Infinity;
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const o = (a: Pt, b: Pt, c: Pt) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  return o(p1, p2, p3) * o(p1, p2, p4) < 0 && o(p3, p4, p1) * o(p3, p4, p2) < 0;
}

/** Every link that can be drawn without crossing a shorter one: shortest
 * first, greedily (a near-triangulation). */
function planarCandidates(ids: string[], pos: Positions): MapEdge[] {
  const pairs: [string, string, number][] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) pairs.push([ids[i], ids[j], dist(pos[ids[i]], pos[ids[j]])]);
  pairs.sort((a, b) => a[2] - b[2]);
  const kept: MapEdge[] = [];
  for (const [a, b] of pairs) {
    const crosses = kept.some((e) => e.a !== a && e.a !== b && e.b !== a && e.b !== b && segmentsCross(pos[a], pos[b], pos[e.a], pos[e.b]));
    if (!crosses) kept.push({ a, b });
  }
  return kept;
}

/** From candidate links: a spanning tree (shortest-ish first), then more
 * candidates until the map is resilient and has about `degree` links a
 * node. Returns null if the candidates can't make it resilient. */
function linkUp(ids: string[], entry: string, gk: string, cands: MapEdge[], pos: Positions, rng: Rng, degree: number): MapEdge[] | null {
  const weight = (e: MapEdge) => dist(pos[e.a], pos[e.b]) * (0.75 + rng.next() * 0.5);
  const order = cands.map((e) => ({ e, w: weight(e) })).sort((a, b) => a.w - b.w).map((x) => x.e);
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
  const graphOf = (es: MapEdge[]): LayerGraph => ({ nodes: ids.map((id) => createNode(id, 'relay')), edges: es, entryNodeId: entry, gatekeeperNodeId: gk });
  for (const e of rest) {
    if (isResilient(graphOf(edges)) && (edges.length * 2) / ids.length >= degree) break;
    edges.push(e);
  }
  return isResilient(graphOf(edges)) ? edges : null;
}

// ------------------------------------------------------------ the grid

/** The map's drawing area (SVG units, portrait) and its backdrop of
 * pointy-top hexes of radius R, odd rows shifted right. Shared with the
 * screen, so a node nudged to a cell sits on the hex that's drawn. */
export const VIEW = { W: 100, H: 150, P: 9, R: 5 };
const HEX_W = Math.sqrt(3) * VIEW.R;

export function backdropCells(): Pt[] {
  const cells: Pt[] = [];
  for (let r = 0; r * 1.5 * VIEW.R < VIEW.H + VIEW.R; r++)
    for (let c = -1; c * HEX_W < VIEW.W + HEX_W; c++) cells.push({ x: c * HEX_W + (r % 2) * (HEX_W / 2), y: r * 1.5 * VIEW.R });
  return cells;
}

const toUnit = (p: Pt) => ({ x: (p.x - VIEW.P) / (VIEW.W - 2 * VIEW.P), y: (p.y - VIEW.P) / (VIEW.H - 2 * VIEW.P) });
const toView = (p: Pt) => ({ x: VIEW.P + p.x * (VIEW.W - 2 * VIEW.P), y: VIEW.P + p.y * (VIEW.H - 2 * VIEW.P) });

/** Nudges every node to the centre of its nearest free backdrop hex
 * inside the padded area (entry and gatekeeper first). */
function snapToBackdrop(ids: string[], pos: Positions) {
  const free = backdropCells().filter((c) => {
    const u = toUnit(c);
    return u.x >= -0.01 && u.x <= 1.01 && u.y >= -0.01 && u.y <= 1.01;
  });
  for (const id of ['n0', 'n1', ...ids.filter((i) => i !== 'n0' && i !== 'n1')]) {
    const v = toView(pos[id]);
    let best = 0;
    for (let i = 1; i < free.length; i++) if (dist(free[i], v) < dist(free[best], v)) best = i;
    pos[id] = toUnit(free.splice(best, 1)[0]);
  }
}

// ------------------------------------------------------------ links

/** Lengths as drawn (the unit square is stretched to a portrait area). */
const drawnDist = (a: Pt, b: Pt) => Math.hypot((a.x - b.x) * (VIEW.W - 2 * VIEW.P), (a.y - b.y) * (VIEW.H - 2 * VIEW.P));

/** How much longer than the typical gap between neighbours a link may
 * be. Long links are the shortcuts that collapse the climb, so this is
 * the main lever on the distance to the gatekeeper (the user: "a bit"
 * further than the ~3-4 moves free scatter gave). */
const MAX_LINK_FACTOR = 1.35;

/** The median distance from a node to its nearest neighbour, as drawn. */
function typicalGap(ids: string[], pos: Positions): number {
  const nearest = ids.map((id) => Math.min(...ids.filter((o) => o !== id).map((o) => drawnDist(pos[id], pos[o])))).sort((a, b) => a - b);
  return nearest[Math.floor(nearest.length / 2)];
}

/** Non-crossing near-neighbour links, minus the long ones. The entry
 * keeps its three nearest (it sits apart, at the bottom) and the
 * gatekeeper its two nearest (two is what resilience needs; more would
 * be shortcuts into it); the two are never linked to each other. */
function climbCandidates(ids: string[], pos: Positions): MapEdge[] {
  const typical = typicalGap(ids, pos);
  const len = (e: MapEdge) => drawnDist(pos[e.a], pos[e.b]);
  const touches = (e: MapEdge, id: string) => e.a === id || e.b === id;
  const planar = planarCandidates(ids, pos).filter((e) => !(touches(e, 'n0') && touches(e, 'n1')));
  const shortest = (id: string, k: number) => planar.filter((e) => touches(e, id)).sort((a, b) => len(a) - len(b)).slice(0, k);
  const middle = planar.filter((e) => !touches(e, 'n0') && !touches(e, 'n1') && len(e) <= typical * MAX_LINK_FACTOR);
  return [...middle, ...shortest('n0', 3), ...shortest('n1', 2)];
}

// ------------------------------------------------------------ types

/**
 * Deals the layer's mix onto its nodes (M7), retrying shuffles until the
 * placement rules hold: no elite next to the entry; a Safehouse within two
 * moves of the gatekeeper; two of the same special node (Safehouse, Shop,
 * Event) never adjacent; and a relay only where it has two or more links,
 * so it's never a dead end (M6). Null if no shuffle fits.
 */
function dealTypes(ids: string[], edges: MapEdge[], layer: LayerNumber, rng: Rng): Record<string, NodeType> | null {
  const filler = ids.filter((id) => id !== 'n0' && id !== 'n1');
  const { mix, flex } = CORE[layer];
  const deck: Filler[] = (Object.entries(mix) as [Filler, number][]).flatMap(([t, k]) => Array<Filler>(k).fill(t));
  for (let i = 0; i < flex; i++) deck.push(pickFlex(rng));
  const neighbours = (id: string) => edges.flatMap((e) => (e.a === id ? [e.b] : e.b === id ? [e.a] : []));
  const fromGk = bfs(edges, ['n1']);
  const special = new Set<NodeType>(['safehouse', 'shop', 'event']);
  for (let attempt = 0; attempt < 400; attempt++) {
    const cards = [...deck];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    const type: Record<string, NodeType> = { n0: 'relay', n1: 'gatekeeperFight' };
    filler.forEach((id, i) => (type[id] = cards[i]));
    const ok =
      filler.every((id) => type[id] !== 'relay' || neighbours(id).length >= 2) &&
      neighbours('n0').every((id) => type[id] !== 'eliteFight') &&
      filler.some((id) => type[id] === 'safehouse' && fromGk[id] <= 2) &&
      edges.every((e) => !(type[e.a] === type[e.b] && special.has(type[e.a])));
    if (ok) return type;
  }
  return null;
}

/**
 * Hangs a Cache (M8) as a dead end off the node farthest from the
 * shortest entry-to-gatekeeper route (or the next farthest, if there's
 * no room), on a free hex near it whose link crosses nothing. Null if no
 * off-route node has room (the layer just has none).
 */
function placeCache(ids: string[], edges: MapEdge[], pos: Positions): { id: string; at: Pt; anchor: string } | null {
  const toEntry = bfs(edges, ['n0']);
  // The route: walk back from the gatekeeper along decreasing distance.
  const route = ['n1'];
  while (route[route.length - 1] !== 'n0') {
    const at = route[route.length - 1];
    const back = edges.flatMap((e) => (e.a === at ? [e.b] : e.b === at ? [e.a] : [])).find((x) => toEntry[x] === toEntry[at] - 1);
    if (!back) return null;
    route.push(back);
  }
  const offRoute = bfs(edges, route);
  const anchors = ids.filter((id) => id !== 'n0' && id !== 'n1' && offRoute[id] >= 1).sort((a, b) => offRoute[b] - offRoute[a]);
  if (!anchors.length) return null;
  const gap = typicalGap(ids, pos);
  const cells = backdropCells()
    .map(toUnit)
    .filter((u) => u.x >= 0 && u.x <= 1 && u.y >= 0.05 && u.y <= 0.95);
  // The farthest node first; if there's no room beside it, the next.
  for (const anchor of anchors) {
    const spots = cells
      .filter((u) => {
        const d = drawnDist(u, pos[anchor]);
        return d >= gap * 0.75 && d <= gap * 1.5;
      })
      .filter((u) => !edges.some((e) => e.a !== anchor && e.b !== anchor && segmentsCross(u, pos[anchor], pos[e.a], pos[e.b])))
      .map((u) => ({ u, room: Math.min(...ids.map((id) => drawnDist(u, pos[id]))) }))
      .filter((x) => x.room >= gap * 0.65)
      .sort((a, b) => b.room - a.room);
    if (spots[0]) return { id: `n${ids.length}`, at: spots[0].u, anchor };
  }
  return null;
}

// ------------------------------------------------------------ a layer

/** One layer: even scatter in a portrait band (entry bottom-centre,
 * gatekeeper top-centre), near-neighbour links that never cross, the
 * layer's mix dealt under the placement rules, and maybe a Cache.
 * `forceCache` shows one whenever there's room (for review). */
export function layerMap(layer: LayerNumber, seed: number, forceCache = false): GenMap {
  const n = LAYER_SIZE[layer];
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = createRng(seed * 1009 + layer * 7 + attempt);
    const ids = Array.from({ length: n }, (_, i) => `n${i}`);
    const pos: Positions = { n0: { x: 0.5, y: 0.97 }, n1: { x: 0.5, y: 0.03 } };
    // Best-candidate sampling: each new node is the farthest of a few tries.
    for (let i = 2; i < n; i++) {
      let best: Pt = { x: 0, y: 0 };
      let bestD = -1;
      for (let t = 0; t < 14; t++) {
        const p = { x: 0.08 + rng.next() * 0.84, y: 0.14 + rng.next() * 0.72 };
        const d = Math.min(...Object.values(pos).map((q) => dist(p, q) * (Math.abs(p.y - q.y) > 0.1 ? 1 : 0.9)));
        if (d > bestD) [best, bestD] = [p, d];
      }
      pos[`n${i}`] = best;
    }
    // Centred on the backdrop's hexes before linking, so the links come
    // from where the nodes are drawn and still never cross.
    snapToBackdrop(ids, pos);
    const edges = linkUp(ids, 'n0', 'n1', climbCandidates(ids, pos), pos, rng, 2.4);
    if (!edges) continue;
    // Nothing may sit behind the gatekeeper: breaching it moves you to the
    // next layer, so a node reachable only through it could never be used.
    const withoutGk: LayerGraph = { nodes: [], edges: edges.filter((e) => e.a !== 'n1' && e.b !== 'n1'), entryNodeId: 'n0', gatekeeperNodeId: 'n1' };
    if (ids.some((id) => id !== 'n1' && !isReachable(withoutGk, 'n0', id))) continue;
    const type = dealTypes(ids, edges, layer, rng);
    if (!type) continue;
    const kind: Record<string, MapKind> = { ...type };
    const graph: LayerGraph = { nodes: ids.map((id) => createNode(id, type[id])), edges, entryNodeId: 'n0', gatekeeperNodeId: 'n1' };
    let cache: string | undefined;
    const roll = rng.next();
    if (forceCache || roll < CACHE_CHANCE[layer]) {
      const spot = placeCache(ids, edges, pos);
      if (spot) {
        cache = spot.id;
        pos[spot.id] = spot.at;
        kind[spot.id] = 'cache';
        // A dead end on purpose. The engine has no Cache type yet, so the
        // mockup's graph carries it as an Event; it's on no route, so
        // resilience is unaffected.
        graph.nodes.push(createNode(spot.id, 'event'));
        graph.edges = [...edges, { a: spot.anchor, b: spot.id }];
      }
    }
    return { graph, pos, kind, cache, resilient: true };
  }
  throw new Error(`layerMap: no layer ${layer} for seed ${seed}`);
}
