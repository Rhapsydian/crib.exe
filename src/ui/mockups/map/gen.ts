import { createNode, isReachable, type LayerGraph, type MapEdge, type MapNode, type NodeType } from '../../../engine/map-types';
import { createRng, type Rng } from '../../../engine/rng';
import type { Positions } from './layouts';

/**
 * Map-generation prototypes for milestone 3 (the user's ask, after the
 * current generator measured as a hairball: ~3 links a node, hubs of up
 * to 9, the gatekeeper 1-2 moves from the entry). Each generator places
 * nodes first and links only near neighbours, so the map draws itself.
 * All keep the engine's rules: n nodes, a relay at the entry, the type
 * mix with at least one Safehouse, and resilience (no single lost node
 * can cut the entry off from the gatekeeper).
 *
 * Mockup code: if one is chosen it moves into the engine's map-gen.ts.
 */
export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export interface GenMap {
  graph: LayerGraph;
  pos: Positions;
  regions: Region[];
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

/** Node types: entry relay, gatekeeper, `forced` (routers), the rest by
 * weight, with at least one Safehouse (as map-gen.ts's D7). */
function nodesFor(ids: string[], entry: string, gk: string, rng: Rng, forced: Record<string, NodeType> = {}): MapNode[] {
  const nodes = ids.map((id) => createNode(id, id === entry ? 'relay' : id === gk ? 'gatekeeperFight' : (forced[id] ?? pickType(rng))));
  if (!nodes.some((n) => n.type === 'safehouse')) {
    const i = nodes.findIndex((n) => n.id !== entry && n.id !== gk && !forced[n.id]);
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
 * first, greedily (a near-triangulation). `allowed` filters pairs. */
function planarCandidates(ids: string[], pos: Positions, allowed: (a: string, b: string) => boolean = () => true): MapEdge[] {
  const pairs: [string, string, number][] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) if (allowed(ids[i], ids[j])) pairs.push([ids[i], ids[j], dist(pos[ids[i]], pos[ids[j]])]);
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

// ---------------------------------------------------------------- hex

/** A pointy-top hex field, odd rows shifted right; `cols` x `rows`. */
function hexField(cols: number, rows: number) {
  const cells: { c: number; r: number; id: string; p: Pt }[] = [];
  const w = 1 / (cols + 0.5);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) cells.push({ c, r, id: `${c},${r}`, p: { x: (c + 0.5 + (r % 2) * 0.5) * w, y: 1 - r / (rows - 1) } });
  const adjacent = (a: { c: number; r: number }, b: { c: number; r: number }) => {
    if (a.r === b.r) return Math.abs(a.c - b.c) === 1;
    if (Math.abs(a.r - b.r) !== 1) return false;
    const lower = a.r < b.r ? a : b;
    const upper = a.r < b.r ? b : a;
    const shift = lower.r % 2; // odd rows sit half a cell right
    return upper.c === lower.c + shift || upper.c === lower.c + shift - 1;
  };
  return { cells, adjacent };
}

const rowsFor = (n: number) => (n <= 8 ? 5 : 6);
const hexRowsFor = (n: number) => (n <= 8 ? 4 : 5);

/** Hex placement with resilience built in: two lanes climb from the
 * entry (bottom centre) to the gatekeeper (top centre), one cell per row
 * each, never crossing -- two routes with no node in common -- then the
 * remaining nodes go on free cells beside what's placed. Returns ids'
 * cells in order (entry, gatekeeper, the rest) and which links the
 * lanes make. Null if this try can't fit. */
function hexLanes(n: number, rng: Rng) {
  const rows = hexRowsFor(n);
  const { cells, adjacent } = hexField(5, rows);
  const at = (c: number, r: number) => cells.find((x) => x.c === c && x.r === r);
  const entry = at(2, 0)!;
  const gk = at(2, rows - 1)!;
  const up = (cell: (typeof cells)[number]) => cells.filter((x) => x.r === cell.r + 1 && adjacent(cell, x));
  let a = up(entry).sort((x, y) => x.c - y.c);
  let laneA = [a[0]];
  let laneB = [a[1]];
  for (let r = 2; r < rows - 1; r++) {
    const optsA = up(laneA[laneA.length - 1]);
    const optsB = up(laneB[laneB.length - 1]);
    const pairs = optsA.flatMap((x) => optsB.filter((y) => y.c > x.c).map((y) => [x, y] as const));
    if (!pairs.length) return null;
    const [x, y] = pairs[rng.nextInt(pairs.length)];
    laneA.push(x);
    laneB.push(y);
  }
  if (!adjacent(laneA[laneA.length - 1], gk) || !adjacent(laneB[laneB.length - 1], gk)) return null;
  const chosen = [entry, gk, ...laneA, ...laneB];
  if (chosen.length > n) return null;
  while (chosen.length < n) {
    const free = cells.filter((x) => !chosen.includes(x) && x.r > 0 && x.r < rows - 1 && chosen.some((y) => adjacent(x, y)));
    if (!free.length) return null;
    chosen.push(free[rng.nextInt(free.length)]);
  }
  const laneLinks = new Set<string>();
  const key = (p: (typeof cells)[number], q: (typeof cells)[number]) => [p.id, q.id].sort().join('|');
  for (const lane of [laneA, laneB]) {
    laneLinks.add(key(entry, lane[0]));
    for (let i = 1; i < lane.length; i++) laneLinks.add(key(lane[i - 1], lane[i]));
    laneLinks.add(key(lane[lane.length - 1], gk));
  }
  return { chosen, adjacent, isLaneLink: (p: (typeof cells)[number], q: (typeof cells)[number]) => laneLinks.has(key(p, q)) };
}

// ------------------------------------------------------------ scatter

/** Option 1: even scatter in a portrait band, near-neighbour links that
 * never cross; with `hex`, cells of a hex field and links only between
 * neighbouring cells. */
export function scatter(n: number, seed: number, hex: boolean): GenMap {
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = createRng(seed * 1009 + attempt);
    const ids = Array.from({ length: n }, (_, i) => `n${i}`);
    const pos: Positions = {};
    let allowed = (_a: string, _b: string) => true;
    if (hex) {
      const lanes = hexLanes(n, rng);
      if (!lanes) continue;
      const cellOf: Record<string, (typeof lanes.chosen)[number]> = {};
      ids.forEach((id, i) => {
        cellOf[id] = lanes.chosen[i];
        pos[id] = lanes.chosen[i].p;
      });
      allowed = (a, b) => lanes.adjacent(cellOf[a], cellOf[b]);
    } else {
      pos.n0 = { x: 0.5, y: 0.97 };
      pos.n1 = { x: 0.5, y: 0.03 };
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
    }
    const edges = linkUp(ids, 'n0', 'n1', planarCandidates(ids, pos, allowed), pos, rng, 2.4);
    if (!edges) continue;
    return { graph: { nodes: nodesFor(ids, 'n0', 'n1', rng), edges, entryNodeId: 'n0', gatekeeperNodeId: 'n1' }, pos, regions: [], resilient: true };
  }
  // Free scatter on a near-triangulation essentially always links up; if
  // it ever doesn't, show the last try flagged rather than recursing.
  const rng = createRng(seed);
  const ids = Array.from({ length: n }, (_, i) => `n${i}`);
  const pos: Positions = Object.fromEntries(ids.map((id, i) => [id, { x: (i % 4) / 3, y: Math.floor(i / 4) / 3 }]));
  const edges = planarCandidates(ids, pos);
  return { graph: { nodes: nodesFor(ids, 'n0', 'n1', rng), edges, entryNodeId: 'n0', gatekeeperNodeId: 'n1' }, pos, regions: [], resilient: false };
}

// ------------------------------------------------------------ subnets

const subnetSizes = (filler: number): number[] => {
  const k = filler <= 6 ? 2 : 3;
  const sizes = Array(k).fill(Math.floor(filler / k));
  for (let i = 0; i < filler % k; i++) sizes[k - 1 - i]++;
  return sizes;
};

/** Option 3: clusters ("LAN segments") stacked up the layer. Each
 * boundary is crossed through a router (a relay) plus one direct link,
 * so no single node is a chokepoint. Hex snaps nodes to a grid. */
export function subnets(n: number, seed: number, hex: boolean): GenMap {
  for (let attempt = 0; attempt < 200; attempt++) {
    const rng = createRng(seed * 2003 + attempt);
    const routerCount = n >= 10 ? subnetSizes(n - 2).length - 1 : 1;
    const sizes = subnetSizes(n - 2 - routerCount);
    const ids: string[] = ['n0', 'n1'];
    const pos: Positions = { n0: { x: 0.5, y: 0.97 }, n1: { x: 0.5, y: 0.03 } };
    const groups: string[][] = [];
    const regions: Region[] = [];
    const k = sizes.length;
    const band = 0.78 / (k + (k - 1) * 0.35);
    let next = 2;
    let y = 0.88;
    const forced: Record<string, NodeType> = {};
    const routers: string[] = [];
    sizes.forEach((size, g) => {
      const cx = 0.5 + (g % 2 === 0 ? -0.12 : 0.12) * (k > 2 ? 1 : 0.6);
      const cy = y - band / 2;
      const members: string[] = [];
      for (let m = 0; m < size; m++) {
        const id = `n${next++}`;
        const a = (m / size) * Math.PI * 2 + rng.next() * 0.6;
        pos[id] = { x: cx + Math.cos(a) * 0.17, y: cy + Math.sin(a) * band * 0.33 };
        members.push(id);
        ids.push(id);
      }
      groups.push(members);
      regions.push({ x: cx - 0.27, y: cy - band * 0.52, w: 0.54, h: band * 1.04, label: `subnet ${String.fromCharCode(65 + g)}` });
      y -= band;
      if (g < k - 1 && routers.length < routerCount) {
        const id = `n${next++}`;
        pos[id] = { x: 0.5 + (rng.next() - 0.5) * 0.3, y: y - band * 0.175 };
        forced[id] = 'relay';
        routers.push(id);
        ids.push(id);
        y -= band * 0.35;
      }
    });
    // Leftover ids (when the router budget ran short) join the top subnet.
    while (next < n) {
      const id = `n${next++}`;
      const top = regions[k - 1];
      pos[id] = { x: top.x + 0.1 + rng.next() * 0.34, y: top.y + top.h * (0.3 + rng.next() * 0.4) };
      groups[k - 1].push(id);
      ids.push(id);
    }
    if (hex) snapToHex(ids, pos, n);

    const edges: MapEdge[] = [];
    const link = (a: string, b: string) => edges.push({ a, b });
    // Inside each subnet: a ring (3+) or a pair.
    for (const gr of groups) {
      const ring = [...gr].sort((a, b) => Math.atan2(pos[a].y - 0.5, pos[a].x - 0.5) - Math.atan2(pos[b].y - 0.5, pos[b].x - 0.5));
      for (let i = 0; i < ring.length - (ring.length > 2 ? 0 : 1); i++) link(ring[i], ring[(i + 1) % ring.length]);
    }
    const nearest = (from: string, among: string[], not: string[] = []) =>
      among.filter((x) => !not.includes(x)).sort((a, b) => dist(pos[from], pos[a]) - dist(pos[from], pos[b]))[0];
    // Entry and gatekeeper each reach two nodes of their subnet.
    const bottom = groups[0];
    const top = groups[k - 1];
    const e1 = nearest('n0', bottom);
    link('n0', e1);
    link('n0', nearest('n0', bottom, [e1]));
    const g1 = nearest('n1', top);
    link('n1', g1);
    link('n1', nearest('n1', top, [g1]));
    // Boundaries: through the router, plus one direct link elsewhere.
    for (let g = 0; g < k - 1; g++) {
      const lower = groups[g];
      const upper = groups[g + 1];
      const r = routers[g];
      let usedLow: string[] = [];
      let usedUp: string[] = [];
      if (r) {
        const l = nearest(r, lower);
        const u = nearest(r, upper);
        link(r, l);
        link(r, u);
        usedLow = [l];
        usedUp = [u];
      }
      const pairs = lower.filter((a) => !usedLow.includes(a)).flatMap((a) => upper.filter((b) => !usedUp.includes(b)).map((b) => [a, b] as const));
      pairs.sort((p, q) => dist(pos[p[0]], pos[p[1]]) - dist(pos[q[0]], pos[q[1]]));
      if (pairs[0]) link(pairs[0][0], pairs[0][1]);
      if (!r && pairs[1]) link(pairs.find((p) => p[0] !== pairs[0][0] && p[1] !== pairs[0][1])?.[0] ?? pairs[1][0], pairs.find((p) => p[0] !== pairs[0][0] && p[1] !== pairs[0][1])?.[1] ?? pairs[1][1]);
    }
    const graph: LayerGraph = { nodes: nodesFor(ids, 'n0', 'n1', rng, forced), edges, entryNodeId: 'n0', gatekeeperNodeId: 'n1' };
    if (!isResilient(graph)) continue;
    return { graph, pos, regions: hex ? [] : regions, resilient: true };
  }
  return fallback(n, seed);
}

// ------------------------------------------------------------- hybrid

/** Options 1 + 3: scatter's spacing and non-crossing near-neighbour links,
 * but in regions (subnets) stacked up the layer, with only two links
 * between neighbouring regions. Hex: regions are bands of hex rows. */
export function hybrid(n: number, seed: number, hex: boolean): GenMap {
  for (let attempt = 0; attempt < 400; attempt++) {
    const rng = createRng(seed * 3001 + attempt);
    const ids = Array.from({ length: n }, (_, i) => `n${i}`);
    const pos: Positions = {};
    const k = n <= 8 ? 2 : 3;
    const regionOf: Record<string, number> = { n0: -1, n1: k };
    let allowed: (a: string, b: string) => boolean;
    const regions: Region[] = [];
    if (hex) {
      // Each interior hex row is a subnet; between rows, only the two
      // lanes link (so every boundary has exactly two crossings).
      const lanes = hexLanes(n, rng);
      if (!lanes) continue;
      const cellOf: Record<string, (typeof lanes.chosen)[number]> = {};
      ids.forEach((id, i) => {
        cellOf[id] = lanes.chosen[i];
        pos[id] = lanes.chosen[i].p;
        if (i >= 2) regionOf[id] = lanes.chosen[i].r - 1;
      });
      const rowsK = hexRowsFor(n) - 2;
      regionOf.n1 = rowsK;
      allowed = (a, b) => lanes.adjacent(cellOf[a], cellOf[b]) && (regionOf[a] === regionOf[b] || lanes.isLaneLink(cellOf[a], cellOf[b]));
    } else {
      pos.n0 = { x: 0.5, y: 0.97 };
      pos.n1 = { x: 0.5, y: 0.03 };
      const filler = ids.slice(2);
      const per = Math.ceil(filler.length / k);
      filler.forEach((id, i) => {
        const g = Math.min(k - 1, Math.floor(i / per));
        regionOf[id] = g;
        const yTop = 0.86 - ((g + 1) * 0.72) / k + 0.04;
        const yBot = 0.86 - (g * 0.72) / k - 0.04;
        let best: Pt = { x: 0, y: 0 };
        let bestD = -1;
        for (let t = 0; t < 14; t++) {
          const p = { x: 0.08 + rng.next() * 0.84, y: yTop + rng.next() * (yBot - yTop) };
          const d = Math.min(...Object.values(pos).map((q) => dist(p, q)));
          if (d > bestD) [best, bestD] = [p, d];
        }
        pos[id] = best;
      });
      for (let g = 0; g < k; g++) {
        const yTop = 0.86 - ((g + 1) * 0.72) / k + 0.01;
        regions.push({ x: 0.03, y: yTop, w: 0.94, h: 0.72 / k - 0.02, label: `subnet ${String.fromCharCode(65 + g)}` });
      }
      allowed = () => true;
    }
    // Within a region: near-neighbour links. Between neighbouring regions
    // (the entry and gatekeeper count as regions -1 and k): two links.
    const within = planarCandidates(ids, pos, (a, b) => allowed(a, b) && regionOf[a] === regionOf[b]);
    const across: MapEdge[] = [];
    for (let g = -1; g < k; g++) {
      const lower = ids.filter((id) => regionOf[id] === g);
      const upper = ids.filter((id) => regionOf[id] === g + 1);
      const pairs = lower.flatMap((a) => upper.filter((b) => allowed(a, b)).map((b) => ({ a, b, d: dist(pos[a], pos[b]) * (0.8 + rng.next() * 0.4) })));
      pairs.sort((p, q) => p.d - q.d);
      const first = pairs[0];
      if (!first) continue;
      across.push(first);
      const second = pairs.find((p) => (lower.length === 1 || p.a !== first.a) && (upper.length === 1 || p.b !== first.b) && !segmentsCross(pos[p.a], pos[p.b], pos[first.a], pos[first.b]));
      if (second) across.push(second);
    }
    const linked = linkUp(ids, 'n0', 'n1', [...across, ...within], pos, rng, 2.3);
    if (!linked) continue;
    // Keep every across-link (they define the subnet boundaries).
    const edges = [...linked, ...across.filter((x) => !linked.some((e) => (e.a === x.a && e.b === x.b) || (e.a === x.b && e.b === x.a)))];
    const graph: LayerGraph = { nodes: nodesFor(ids, 'n0', 'n1', rng), edges, entryNodeId: 'n0', gatekeeperNodeId: 'n1' };
    if (!isResilient(graph)) continue;
    return { graph, pos, regions, resilient: true };
  }
  return fallback(n, seed);
}

/** Moves every node to the nearest free cell of a hex field. */
function snapToHex(ids: string[], pos: Positions, n: number) {
  const { cells } = hexField(6, rowsFor(n) + 3);
  const free = [...cells];
  for (const id of ['n0', 'n1', ...ids.filter((i) => i !== 'n0' && i !== 'n1')]) {
    free.sort((a, b) => dist(a.p, pos[id]) - dist(b.p, pos[id]));
    pos[id] = free.shift()!.p;
  }
}

function fallback(n: number, seed: number): GenMap {
  const g = scatter(n, seed + 1, false);
  return { ...g, resilient: false };
}
