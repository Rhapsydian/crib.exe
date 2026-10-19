<script lang="ts">
  import { backdropCells, MAP_VIEW } from '../engine/map-gen';
  import type { LayerGraph } from '../engine/map-types';
  import { NODE_KIND } from './map-kinds';

  // One layer of the map (milestone 3), drawn where the generator laid it
  // out (map-gen.ts stores each node's position): the faint hex backdrop,
  // the links, and the nodes. Cleared nodes dim; a lost (closed) node is
  // struck through and can't be entered. `here` is where the player is;
  // `selectable` nodes glow and can be tapped; `selected` is the one
  // tapped. No browser focus box or tap flash on nodes (the user's call).
  let {
    graph,
    here,
    selectable = new Set<string>(),
    selected = null,
    onpick,
  }: { graph: LayerGraph; here: string; selectable?: Set<string>; selected?: string | null; onpick?: (id: string) => void } = $props();

  const { W, H, P, R } = MAP_VIEW;
  const X = (x: number) => P + x * (W - 2 * P);
  const Y = (y: number) => P + y * (H - 2 * P);
  const hexPath = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(Math.cos(a) * R).toFixed(2)},${(Math.sin(a) * R).toFixed(2)}`;
  }).join(' ');
  const backdrop = backdropCells();

  const pos = (id: string) => {
    const n = graph.nodes.find((x) => x.id === id)!;
    return { x: X(n.x ?? 0.5), y: Y(n.y ?? 0.5) };
  };
</script>

<svg viewBox="0 0 {W} {H}" class="map">
  <g class="backdrop">
    {#each backdrop as h, i (i)}
      <polygon points={hexPath} transform="translate({h.x},{h.y})" />
    {/each}
  </g>
  {#each graph.edges as e, i (i)}
    {@const hot = (e.a === here && selectable.has(e.b)) || (e.b === here && selectable.has(e.a))}
    <!-- Edges are undirected; draw each from the current node outward, so
         a hot line's dashes always flow away from where you are. -->
    {@const a = pos(e.b === here ? e.b : e.a)}
    {@const b = pos(e.b === here ? e.a : e.b)}
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="link" class:hot />
  {/each}
  {#each graph.nodes as n (n.id)}
    {@const p = pos(n.id)}
    {@const k = NODE_KIND[n.type]}
    {@const big = n.type === 'gatekeeperFight'}
    {@const r = n.type === 'relay' ? 2 : big ? 6 : 4.4}
    {@const can = selectable.has(n.id)}
    <g
      class="node"
      class:can
      class:sel={selected === n.id}
      class:cleared={n.state === 'inert' && n.type !== 'relay' && n.id !== here}
      class:closed={n.state === 'closed'}
      transform="translate({p.x},{p.y})"
      onclick={() => can && onpick?.(n.id)}
      role="button"
      tabindex="-1"
      aria-label={k.label}
      onkeydown={() => {}}
    >
      <circle {r} style="--tone: {k.tone}" />
      {#if k.glyph}<text dominant-baseline="central" style="fill: {k.tone}" font-size={big ? 6 : 4.6}>{k.glyph}</text>{/if}
      {#if n.state === 'closed'}<path d="M{-r * 0.7},{-r * 0.7} L{r * 0.7},{r * 0.7} M{r * 0.7},{-r * 0.7} L{-r * 0.7},{r * 0.7}" class="strike" />{/if}
      {#if n.id === here}<circle r={r + 1.8} class="here" />{/if}
      {#if selected === n.id}<circle r={r + 2.6} class="pick" />{/if}
    </g>
  {/each}
</svg>

<style>
  .map {
    width: 100%;
    height: 100%;
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
  .node {
    outline: none;
    -webkit-tap-highlight-color: transparent;
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
  .node.can circle:not(.here):not(.pick) {
    stroke-width: 1;
    filter: drop-shadow(0 0 1.5px var(--tone));
  }
  .node.cleared {
    opacity: 0.4;
  }
  .node.closed {
    opacity: 0.55;
  }
  .strike {
    stroke: var(--danger);
    stroke-width: 0.9;
    stroke-linecap: round;
  }
  .here {
    fill: none !important;
    stroke: var(--accent) !important;
    stroke-width: 0.6 !important;
    stroke-dasharray: 1.5 1;
  }
  .pick {
    fill: none !important;
    stroke: var(--text) !important;
    stroke-width: 0.5 !important;
  }
</style>
