<script lang="ts">
  import type { NodeType } from '../../../engine/map-types';
  import { backdropCells, hops, isResilient, scatter, VIEW, type Positions } from './gen';

  // Milestone 3 map mockup: the scatter generator (the user's pick), on a
  // faint hex grid; each node is centred on its nearest hex.
  // Only the current layer shows (the user's call: earlier layers can't
  // be revisited). Tap a linked node to walk there.
  let seed = $state(1);
  let size = $state(12);

  const made = $derived(scatter(size, seed));
  const graph = $derived(made.graph);
  const pos = $derived<Positions>(made.pos);
  const stats = $derived({
    hops: hops(graph),
    links: graph.edges.length,
    perNode: ((graph.edges.length * 2) / graph.nodes.length).toFixed(1),
    resilient: made.resilient && isResilient(graph),
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
  const { W, H, P, R } = VIEW;
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
    {#each [10, 12] as n (n)}
      <button class:on={size === n} onclick={() => (size = n)}>{n} nodes</button>
    {/each}
  </div>
  <div class="bar small">
    <span class="stat">entry→gatekeeper <b>{stats.hops}</b> · links <b>{stats.links}</b> · {stats.perNode}/node · <b class:bad={!stats.resilient}>{stats.resilient ? 'resilient' : 'NOT resilient'}</b></span>
    <span class="sep"></span>
    <span class="stat">moves <b>{moves}</b></span>
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
      {@const k = KIND[n.type]}
      {@const big = n.type === 'gatekeeperFight'}
      {@const r = n.type === 'relay' ? 2 : big ? 6 : 4.4}
      <g class="node" class:can={linked.has(n.id)} class:done={visited.includes(n.id) && n.id !== here} transform="translate({X(p.x)},{Y(p.y)})" onclick={() => step(n.id)} role="button" tabindex="-1" onkeydown={() => {}}>
        <circle {r} style="--tone: {k.tone}" />
        {#if k.glyph}<text y="1.5" style="fill: {k.tone}" font-size={big ? 6 : 4.6}>{k.glyph}</text>{/if}
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
