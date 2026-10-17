<script lang="ts">
  import { backdropCells, generateLayer, LAYER_SIZES, MAP_VIEW, type LayerNumber } from '../../../engine/map-gen';
  import { isReachable, type LayerGraph, type NodeType } from '../../../engine/map-types';
  import { createRng } from '../../../engine/rng';

  // Milestone 3 map mockup, now drawing the engine's own generator
  // (map-gen.ts), on the faint hex grid it lays nodes out on.
  // Only the current layer shows (the user's call: earlier layers can't
  // be revisited). Tap a linked node to walk there.
  let seed = $state(1);
  let layer = $state<LayerNumber>(2);
  // For review: show a Cache whenever there's room (really 35-50%).
  let forceCache = $state(false);

  const make = (s: number) => generateLayer({ rng: createRng(s * 7919 + layer), nodeCount: LAYER_SIZES[layer - 1], layer });
  // "Force a cache" walks forward from this seed to the next layer with one.
  const graph = $derived.by<LayerGraph>(() => {
    let g = make(seed);
    for (let s = seed + 1000; forceCache && !g.nodes.some((n) => n.type === 'cache') && s < seed + 1100; s++) g = make(s);
    return g;
  });
  const pos = $derived(Object.fromEntries(graph.nodes.map((n) => [n.id, { x: n.x ?? 0.5, y: n.y ?? 0.5 }])));
  const kindOf = (id: string): NodeType => graph.nodes.find((n) => n.id === id)!.type;
  const cache = $derived(graph.nodes.find((n) => n.type === 'cache')?.id);
  const hopsToGatekeeper = $derived.by(() => {
    const d: Record<string, number> = { [graph.entryNodeId]: 0 };
    const q = [graph.entryNodeId];
    while (q.length) {
      const id = q.shift()!;
      for (const e of graph.edges) {
        const x = e.a === id ? e.b : e.b === id ? e.a : null;
        if (x !== null && d[x] === undefined) (d[x] = d[id] + 1), q.push(x);
      }
    }
    return d[graph.gatekeeperNodeId];
  });
  const resilient = $derived(
    graph.nodes.every(
      (n) => n.id === graph.entryNodeId || n.id === graph.gatekeeperNodeId || n.id === cache || isReachable({ ...graph, edges: graph.edges.filter((e) => e.a !== n.id && e.b !== n.id) }, graph.entryNodeId, graph.gatekeeperNodeId),
    ),
  );
  const stats = $derived({
    hops: hopsToGatekeeper,
    links: graph.edges.length,
    perNode: ((graph.edges.length * 2) / graph.nodes.length).toFixed(1),
    resilient,
  });
  const counts = $derived.by(() => {
    const c: Partial<Record<NodeType, number>> = {};
    for (const n of graph.nodes) if (n.id !== graph.entryNodeId && n.id !== graph.gatekeeperNodeId) c[n.type] = (c[n.type] ?? 0) + 1;
    return c;
  });

  let here = $state('n0');
  let visited = $state<string[]>(['n0']);
  let moves = $state(0);
  $effect(() => {
    void graph;
    here = graph.entryNodeId;
    visited = [graph.entryNodeId];
    moves = 0;
  });
  const linked = $derived(new Set(graph.edges.flatMap((e) => (e.a === here ? [e.b] : e.b === here ? [e.a] : []))));

  // Drawing area and the hex backdrop (shared with the generator).
  const { W, H, P, R } = MAP_VIEW;
  const X = (x: number) => P + x * (W - 2 * P);
  const Y = (y: number) => P + y * (H - 2 * P);
  const hexPath = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(Math.cos(a) * R).toFixed(2)},${(Math.sin(a) * R).toFixed(2)}`;
  }).join(' ');
  const backdrop = backdropCells();

  const KIND: Record<NodeType, { glyph: string; label: string; tone: string }> = {
    regularFight: { glyph: '⚔︎', label: 'fight', tone: 'var(--danger)' },
    eliteFight: { glyph: '☠︎', label: 'elite', tone: 'var(--warn)' },
    gatekeeperFight: { glyph: '⛨︎', label: 'gatekeeper', tone: 'var(--danger)' },
    safehouse: { glyph: '⌂︎', label: 'safehouse', tone: 'var(--ward)' },
    shop: { glyph: '$', label: 'shop', tone: 'var(--accent)' },
    event: { glyph: '?', label: 'event', tone: 'var(--mod)' },
    relay: { glyph: '', label: 'relay', tone: 'var(--text-dim)' },
    cache: { glyph: '◈', label: 'cache', tone: 'var(--suit-honeypot)' },
  };

  function step(id: string) {
    if (!linked.has(id)) return;
    here = id;
    moves++;
    if (!visited.includes(id)) visited = [...visited, id];
  }
</script>

<div class="mock">
  <div class="bar small">
    <button onclick={() => (seed = Math.max(1, seed - 1))}>‹</button>
    <span>map {seed}</span>
    <button onclick={() => seed++}>›</button>
    <span class="sep"></span>
    {#each [1, 2, 3, 4] as const as l (l)}
      <button class:on={layer === l} onclick={() => (layer = l)}>L{l}</button>
    {/each}
  </div>
  <div class="bar small">
    <span class="stat">{LAYER_SIZES[layer - 1]} nodes · entry→gatekeeper <b>{stats.hops}</b> · links <b>{stats.links}</b> · {stats.perNode}/node · <b class:bad={!stats.resilient}>{stats.resilient ? 'resilient' : 'NOT resilient'}</b></span>
    <span class="sep"></span>
    <span class="stat">moves <b>{moves}</b></span>
  </div>
  <div class="bar small">
    <span class="stat">
      {#each Object.entries(counts) as [k, v] (k)}<span class="count" style="color: {KIND[k as NodeType].tone}">{KIND[k as NodeType].glyph || '·'}{v}</span>{/each}
    </span>
    <span class="sep"></span>
    <label class="force"><input type="checkbox" bind:checked={forceCache} /> force a cache</label>
  </div>

  <svg viewBox="0 0 {W} {H}" class="map">
    <g class="backdrop">
      {#each backdrop as h, i (i)}
        <polygon points={hexPath} transform="translate({h.x},{h.y})" />
      {/each}
    </g>
    {#each graph.edges as e, i (i)}
      {@const hot = (e.a === here && linked.has(e.b)) || (e.b === here && linked.has(e.a))}
      <line x1={X(pos[e.a].x)} y1={Y(pos[e.a].y)} x2={X(pos[e.b].x)} y2={Y(pos[e.b].y)} class="link" class:hot />
    {/each}
    {#each graph.nodes as n (n.id)}
      {@const p = pos[n.id]}
      {@const k = KIND[kindOf(n.id)]}
      {@const big = n.type === 'gatekeeperFight'}
      {@const r = n.type === 'relay' ? 2 : big ? 6 : 4.4}
      <g class="node" class:can={linked.has(n.id)} class:done={visited.includes(n.id) && n.id !== here} transform="translate({X(p.x)},{Y(p.y)})" onclick={() => step(n.id)} role="button" tabindex="-1" onkeydown={() => {}}>
        <circle {r} style="--tone: {k.tone}" />
        {#if k.glyph}<text dominant-baseline="central" style="fill: {k.tone}" font-size={big ? 6 : 4.6}>{k.glyph}</text>{/if}
        {#if n.id === here}<circle r={r + 1.8} class="here" />{/if}
      </g>
    {/each}
  </svg>

  <div class="legend">
    {#each Object.entries(KIND) as [type, k] (type)}
      <span><b style="color: {k.tone}">{k.glyph || '·'}</b> {k.label}</span>
    {/each}
    <span><b class="you">◯</b> you</span>
  </div>
</div>

<style>
  .mock {
    max-width: 520px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + 26px + env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
    box-sizing: border-box;
  }
  .bar {
    display: flex;
    gap: 4px;
    align-items: center;
    flex-wrap: wrap;
  }
  .bar button {
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--bg-raised);
    color: var(--text-dim);
    font-size: 11px;
  }
  .bar button.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .small span {
    font-size: 11px;
    color: var(--text-dim);
  }
  .sep {
    flex: 1;
  }
  .stat b {
    color: var(--text);
  }
  .stat b.bad {
    color: var(--danger);
  }
  .map {
    flex: 1;
    min-height: 0;
    width: 100%;
    background: var(--bg-sunken);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .backdrop polygon {
    fill: none;
    stroke: var(--line);
    stroke-width: 0.25;
    opacity: 0.55;
  }
  .link {
    stroke: var(--line);
    stroke-width: 0.6;
  }
  .link.hot {
    stroke: var(--accent);
    stroke-dasharray: 1.2 0.8;
    animation: flow 0.8s linear infinite;
  }
  @keyframes flow {
    to {
      stroke-dashoffset: -2;
    }
  }
  .node circle {
    fill: var(--bg);
    stroke: var(--tone);
    stroke-width: 0.6;
  }
  .node text {
    text-anchor: middle;
    font-family: var(--mono);
    pointer-events: none;
  }
  /* No browser focus box or phone tap flash on a tapped node: the dashed
     ring marks where you are (the user's call). */
  .node {
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .node.can {
    cursor: pointer;
  }
  .node.can circle:not(.here) {
    stroke-width: 1;
    filter: drop-shadow(0 0 1.5px var(--tone));
  }
  .node.done {
    opacity: 0.45;
  }
  .here {
    fill: none !important;
    stroke: var(--accent) !important;
    stroke-width: 0.6 !important;
    stroke-dasharray: 1.5 1;
  }
  .count {
    margin-right: 8px;
    font-weight: 700;
  }
  .force {
    font-size: 11px;
    color: var(--text-dim);
    display: flex;
    gap: 4px;
    align-items: center;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: 11px;
    color: var(--text-dim);
  }
  .you {
    color: var(--accent);
  }
</style>
