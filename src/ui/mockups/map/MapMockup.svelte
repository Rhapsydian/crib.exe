<script lang="ts">
  import { generateLayer } from '../../../engine/map-gen';
  import { createRng } from '../../../engine/rng';
  import type { NodeType } from '../../../engine/map-types';
  import { force, layered, schematic, type Positions } from './layouts';

  // Milestone 3 map mockups: one real generated layer (map-gen.ts), drawn
  // three ways. Only the current layer shows (the user's call: earlier
  // layers can't be revisited). Tap a linked node to walk there, to get
  // a feel for moving; each step costs the flat move Heat.
  const styles = ['layered', 'force', 'schematic'] as const;
  type Style = (typeof styles)[number];
  let style = $state<Style>('layered');
  let seed = $state(1);
  let size = $state(12);

  const graph = $derived(generateLayer({ rng: createRng(seed * 7919), nodeCount: size }));
  const pos = $derived<Positions>(style === 'layered' ? layered(graph) : style === 'force' ? force(graph, seed) : schematic(graph));
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

  // Drawing area: portrait, padded.
  const W = 100;
  const H = 150;
  const P = 9;
  const X = (x: number) => P + x * (W - 2 * P);
  const Y = (y: number) => P + y * (H - 2 * P);

  const KIND: Record<NodeType, { glyph: string; label: string; tone: string }> = {
    regularFight: { glyph: '⚔︎', label: 'fight', tone: 'var(--danger)' },
    eliteFight: { glyph: '☠︎', label: 'elite', tone: 'var(--warn)' },
    gatekeeperFight: { glyph: '⛨︎', label: 'gatekeeper', tone: 'var(--danger)' },
    safehouse: { glyph: '⌂︎', label: 'safehouse', tone: 'var(--ward)' },
    shop: { glyph: '$', label: 'shop', tone: 'var(--accent)' },
    event: { glyph: '?', label: 'event', tone: 'var(--mod)' },
    relay: { glyph: '', label: 'relay', tone: 'var(--text-dim)' },
  };

  function trace(a: { x: number; y: number }, b: { x: number; y: number }, lane = 0): string {
    const [x1, y1, x2, y2] = [X(a.x), Y(a.y), X(b.x), Y(b.y)];
    const sameRow = Math.abs(y1 - y2) < 0.5;
    // A link along a row would run straight through the nodes between
    // its ends, so it bows (or, in the schematic, routes) up and over.
    if (style !== 'schematic') {
      if (!sameRow) return `M${x1},${y1} L${x2},${y2}`;
      const lift = Math.min(14, 3 + Math.abs(x2 - x1) * 0.35);
      return `M${x1},${y1} Q${(x1 + x2) / 2},${y1 - lift} ${x2},${y2}`;
    }
    if (sameRow) {
      const up = y1 - (Math.abs(x2 - x1) > 22 ? 9 : 6.5);
      return `M${x1},${y1} L${x1},${up} L${x2},${up} L${x2},${y2}`;
    }
    // Each link gets its own horizontal lane between the rows, so traces
    // don't merge into one ambiguous bus line.
    const mid = y1 + (y2 - y1) * (0.3 + 0.4 * ((lane % 5) / 4));
    return `M${x1},${y1} L${x1},${mid} L${x2},${mid} L${x2},${y2}`;
  }

  function step(id: string) {
    if (!linked.has(id)) return;
    here = id;
    moves++;
    if (!visited.includes(id)) visited = [...visited, id];
  }
</script>

<div class="mock">
  <div class="bar">
    {#each styles as s (s)}
      <button class:on={style === s} onclick={() => (style = s)}>{s}</button>
    {/each}
  </div>
  <div class="bar small">
    <button onclick={() => (seed = Math.max(1, seed - 1))}>‹</button>
    <span>map {seed}</span>
    <button onclick={() => seed++}>›</button>
    <span class="sep"></span>
    {#each [8, 10, 12] as n (n)}
      <button class:on={size === n} onclick={() => (size = n)}>{n} nodes</button>
    {/each}
    <span class="sep"></span>
    <span class="heat">moves {moves}</span>
  </div>

  <svg viewBox="0 0 {W} {H}" class="map {style}">
    {#if style === 'schematic'}
      <defs>
        <pattern id="grid" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0 L0 0 0 5" fill="none" stroke="var(--line)" stroke-width="0.15" /></pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grid)" />
    {/if}
    {#each graph.edges as e, i (i)}
      {@const hot = (e.a === here && linked.has(e.b)) || (e.b === here && linked.has(e.a))}
      <path d={trace(pos[e.a], pos[e.b], i)} class="link" class:hot />
    {/each}
    {#each graph.nodes as n (n.id)}
      {@const p = pos[n.id]}
      {@const k = KIND[n.type]}
      {@const big = n.type === 'gatekeeperFight'}
      {@const r = n.type === 'relay' ? 2 : big ? 6 : 4.4}
      <g class="node" class:can={linked.has(n.id)} class:done={visited.includes(n.id) && n.id !== here} transform="translate({X(p.x)},{Y(p.y)})" onclick={() => step(n.id)} role="button" tabindex="-1" onkeydown={() => {}}>
        {#if style === 'schematic' && n.type !== 'relay'}
          <rect x={-r} y={-r} width={r * 2} height={r * 2} rx="1.2" style="--tone: {k.tone}" />
        {:else}
          <circle {r} style="--tone: {k.tone}" />
        {/if}
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
    font-size: 12px;
  }
  .bar button.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .small button,
  .small span {
    font-size: 11px;
  }
  .small span {
    color: var(--text-dim);
  }
  .sep {
    flex: 1;
  }
  .map {
    flex: 1;
    min-height: 0;
    width: 100%;
    background: var(--bg-sunken);
    border: 1px solid var(--line);
    border-radius: var(--radius);
  }
  .link {
    fill: none;
    stroke: var(--line);
    stroke-width: 0.6;
  }
  .schematic .link {
    stroke-width: 0.7;
    stroke-linejoin: round;
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
  .node circle,
  .node rect {
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
  .node.can circle:not(.here),
  .node.can rect {
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
