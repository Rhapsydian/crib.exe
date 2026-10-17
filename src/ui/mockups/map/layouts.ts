import type { LayerGraph } from '../../../engine/map-types';
import { createRng } from '../../../engine/rng';

/**
 * Map layout candidates for milestone 3's mockups. The engine's layers
 * are free-roam networks with no positions (map-gen.ts), so the screen
 * has to place the nodes. Each layout returns a position per node id in
 * a 0..1 square (x right, y down); the entry sits at the bottom and the
 * gatekeeper at the top in all three, so the climb reads the same way.
 */
export type Positions = Record<string, { x: number; y: number }>;

/** Hops from the entry, by breadth-first search. */
function depths(graph: LayerGraph): Record<string, number> {
  const d: Record<string, number> = { [graph.entryNodeId]: 0 };
  const queue = [graph.entryNodeId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const e of graph.edges) {
      const next = e.a === id ? e.b : e.b === id ? e.a : null;
      if (next !== null && d[next] === undefined) {
        d[next] = d[id] + 1;
        queue.push(next);
      }
    }
  }
  return d;
}

const neighbors = (graph: LayerGraph, id: string) => graph.edges.flatMap((e) => (e.a === id ? [e.b] : e.b === id ? [e.a] : []));

/** Rows by distance from the entry (gatekeeper alone on the top row),
 * each row ordered to keep links short (barycentre sweeps). */
export function layered(graph: LayerGraph): Positions {
  const d = depths(graph);
  const others = graph.nodes.filter((n) => n.id !== graph.gatekeeperNodeId);
  const rowDepths = [...new Set(others.map((n) => d[n.id] ?? 0))].sort((a, b) => a - b);
  const rows: string[][] = rowDepths.map((depth) => others.filter((n) => (d[n.id] ?? 0) === depth).map((n) => n.id));
  rows.push([graph.gatekeeperNodeId]);

  const xOf = (row: string[], id: string) => (row.indexOf(id) + 1) / (row.length + 1);
  for (let pass = 0; pass < 4; pass++) {
    const down = pass % 2 === 0;
    const order = down ? rows.map((_, i) => i).slice(1) : rows.map((_, i) => i).reverse().slice(1);
    for (const r of order) {
      const ref = rows[down ? r - 1 : r + 1];
      if (!ref) continue;
      const bary = (id: string) => {
        const ns = neighbors(graph, id).filter((n) => ref.includes(n));
        return ns.length ? ns.reduce((s, n) => s + xOf(ref, n), 0) / ns.length : xOf(rows[r], id);
      };
      rows[r] = [...rows[r]].sort((a, b) => bary(a) - bary(b));
    }
  }

  const pos: Positions = {};
  rows.forEach((row, r) => {
    const y = 1 - r / (rows.length - 1);
    row.forEach((id) => (pos[id] = { x: xOf(row, id), y }));
  });
  return pos;
}

/** A spring layout (Fruchterman-Reingold): links pull, nodes push. The
 * entry is pinned bottom-centre and the gatekeeper top-centre; seeded,
 * so a layer always lays out the same way. */
export function force(graph: LayerGraph, seed = 1): Positions {
  const rng = createRng(seed);
  const ids = graph.nodes.map((n) => n.id);
  const d = depths(graph);
  const maxD = Math.max(1, ...Object.values(d));
  const pos: Positions = {};
  for (const id of ids) pos[id] = { x: 0.2 + rng.next() * 0.6, y: 1 - (d[id] ?? 0) / maxD };
  const pinned = (id: string) => id === graph.entryNodeId || id === graph.gatekeeperNodeId;
  pos[graph.entryNodeId] = { x: 0.5, y: 1 };
  pos[graph.gatekeeperNodeId] = { x: 0.5, y: 0 };
  const k = Math.sqrt(1 / ids.length);
  let temp = 0.12;
  for (let it = 0; it < 300; it++) {
    const disp: Positions = Object.fromEntries(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++) {
        const a = pos[ids[i]];
        const b = pos[ids[j]];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.max(0.01, Math.hypot(dx, dy));
        const f = (k * k) / dist;
        disp[ids[i]].x += (dx / dist) * f;
        disp[ids[i]].y += (dy / dist) * f;
        disp[ids[j]].x -= (dx / dist) * f;
        disp[ids[j]].y -= (dy / dist) * f;
      }
    for (const e of graph.edges) {
      const a = pos[e.a];
      const b = pos[e.b];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.max(0.01, Math.hypot(dx, dy));
      const f = (dist * dist) / k;
      disp[e.a].x -= (dx / dist) * f;
      disp[e.a].y -= (dy / dist) * f;
      disp[e.b].x += (dx / dist) * f;
      disp[e.b].y += (dy / dist) * f;
    }
    for (const id of ids) {
      if (pinned(id)) continue;
      const v = disp[id];
      const len = Math.max(0.0001, Math.hypot(v.x, v.y));
      pos[id] = {
        x: Math.min(0.95, Math.max(0.05, pos[id].x + (v.x / len) * Math.min(len, temp))),
        y: Math.min(0.92, Math.max(0.08, pos[id].y + (v.y / len) * Math.min(len, temp))),
      };
    }
    temp *= 0.985;
  }
  return pos;
}

/** The layered positions snapped to a grid, for a circuit-board /
 * rack-diagram look; links are drawn as right-angle traces. */
export function schematic(graph: LayerGraph, columns = 5): Positions {
  const base = layered(graph);
  const pos: Positions = {};
  const rowsY = [...new Set(Object.values(base).map((p) => p.y))];
  for (const y of rowsY) {
    const inRow = Object.entries(base)
      .filter(([, p]) => p.y === y)
      .sort((a, b) => a[1].x - b[1].x);
    const used = new Set<number>();
    for (const [id, p] of inRow) {
      let col = Math.round(p.x * (columns - 1));
      while (used.has(col) && col < columns - 1) col++;
      while (used.has(col) && col > 0) col--;
      used.add(col);
      pos[id] = { x: (col + 0.5) / columns, y };
    }
  }
  return pos;
}
