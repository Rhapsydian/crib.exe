import { createNode, isReachable, type LayerGraph, type MapEdge, type MapNode, type NodeType } from '../../../engine/map-types';
import { createRng, type Rng } from '../../../engine/rng';
/** A position per node id, in a 0..1 square (x right, y down). */
export type Positions = Record<string, { x: number; y: number }>;

/**
 * The map-generation prototype for milestone 3: *scatter* (the user's
 * pick over subnets, a hybrid and hex-grid variants, after the current
 * generator measured as a hairball: ~3 links a node, hubs of up to 9,
 * the gatekeeper 1-2 moves from the entry). Nodes are placed first with
 * even spacing, then linked only to near neighbours, never crossing, so
 * the map draws itself. It keeps the engine's rules: n nodes, a relay at
 * the entry, the type mix with at least one Safehouse, and resilience
 * (no single lost node can cut the entry off from the gatekeeper).
 *
 * Mockup code: once refined it moves into the engine's map-gen.ts.
 */
export interface GenMap {
  graph: LayerGraph;
  pos: Positions;
  /** False when the generator gave up on resilience (shown, not hidden). */
  resilient: boolean;
}

type Pt = { x: number; y: number };
type Filler = Exclude<NodeType, 'gatekeeperFight'>;
const WEIGHTS: Record<Filler, number> = { regularFight: 0.4, eliteFight: 0.15, safehouse: 0.15, shop: 0.1, event: 0.1, relay: 0.1 };

function pickType(rng: Rng): Filler {
  let roll = rng.next();
  for (const [t, w] of Object.entries(WEIGHTS) as [Filler, number][]) {
    if (roll < w) return t;
    roll -= w;
  }
  return 'regularFight';
}

/** Node types: entry relay, gatekeeper, the rest by weight, with at
 * least one Safehouse (as map-gen.ts's D7). */
function nodesFor(ids: string[], entry: string, gk: string, rng: Rng): MapNode[] {
  const nodes = ids.map((id) => createNode(id, id === entry ? 'relay' : id === gk ? 'gatekeeperFight' : pickType(rng)));
  if (!nodes.some((n) => n.type === 'safehouse')) {
    const i = nodes.findIndex((n) => n.id !== entry && n.id !== gk);
    if (i !== -1) nodes[i] = createNode(nodes[i].id, 'safehouse');
  }
  return nodes;
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

export function hops(graph: LayerGraph): number {
  const d: Record<string, number> = { [graph.entryNodeId]: 0 };
  const q = [graph.entryNodeId];
  while (q.length) {
    const id = q.shift()!;
    for (const e of graph.edges) {
      const x = e.a === id ? e.b : e.b === id ? e.a : null;
      if (x !== null && d[x] === undefined) {
        d[x] = d[id] + 1;
        q.push(x);
      }
    }
  }
  return d[graph.gatekeeperNodeId] ?? Infinity;
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

/** Nudges every node to the centre of its nearest free backdrop hex
 * inside the padded area (entry and gatekeeper first). */
function snapToBackdrop(ids: string[], pos: Positions) {
  const { W, H, P } = VIEW;
  const toView = (p: Pt) => ({ x: P + p.x * (W - 2 * P), y: P + p.y * (H - 2 * P) });
  const toUnit = (p: Pt) => ({ x: (p.x - P) / (W - 2 * P), y: (p.y - P) / (H - 2 * P) });
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

// ------------------------------------------------------------ scatter

/** Lengths as drawn (the unit square is stretched to a portrait area). */
const drawnDist = (a: Pt, b: Pt) => Math.hypot((a.x - b.x) * (VIEW.W - 2 * VIEW.P), (a.y - b.y) * (VIEW.H - 2 * VIEW.P));

/** How much longer than the typical gap between neighbours a link may
 * be. Long links are the shortcuts that collapse the climb, so this is
 * the main lever on the distance to the gatekeeper (the user: "a bit"
 * further than the ~3-4 moves free scatter gave). */
const MAX_LINK_FACTOR = 1.35;

/** Non-crossing near-neighbour links, minus the long ones. The entry
 * keeps its three nearest (it sits apart, at the bottom) and the
 * gatekeeper its two nearest (two is what resilience needs; more would
 * be shortcuts into it); the two are never linked to each other. */
function climbCandidates(ids: string[], pos: Positions): MapEdge[] {
  const nearest = ids.map((id) => Math.min(...ids.filter((o) => o !== id).map((o) => drawnDist(pos[id], pos[o])))).sort((a, b) => a - b);
  const typical = nearest[Math.floor(nearest.length / 2)];
  const len = (e: MapEdge) => drawnDist(pos[e.a], pos[e.b]);
  const touches = (e: MapEdge, id: string) => e.a === id || e.b === id;
  const planar = planarCandidates(ids, pos).filter((e) => !(touches(e, 'n0') && touches(e, 'n1')));
  const shortest = (id: string, k: number) => planar.filter((e) => touches(e, id)).sort((a, b) => len(a) - len(b)).slice(0, k);
  const middle = planar.filter((e) => !touches(e, 'n0') && !touches(e, 'n1') && len(e) <= typical * MAX_LINK_FACTOR);
  return [...middle, ...shortest('n0', 3), ...shortest('n1', 2)];
}

/** Even scatter in a portrait band (entry bottom-centre, gatekeeper
 * top-centre), near-neighbour links that never cross. */
export function scatter(n: number, seed: number): GenMap {
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = createRng(seed * 1009 + attempt);
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
    return { graph: { nodes: nodesFor(ids, 'n0', 'n1', rng), edges, entryNodeId: 'n0', gatekeeperNodeId: 'n1' }, pos, resilient: true };
  }
  throw new Error(`scatter: no resilient layer for n=${n}, seed=${seed}`);
}
