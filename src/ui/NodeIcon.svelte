<script lang="ts">
  import { NODE_KIND } from './map-kinds';
  import type { NodeType } from '../engine/map-types';

  // A map node's icon inline in HTML (the run summary, the node card): its
  // line icon at the text's size, or its text symbol.
  let { type, color }: { type: NodeType; color?: string } = $props();
  const k = $derived(NODE_KIND[type]);
</script>

{#if k.icon}
  <svg class="node-icon" viewBox="0 0 24 24" aria-hidden="true" style="color: {color ?? k.tone}">
    {#each k.icon as d, i (i)}<path {d} />{/each}
  </svg>
{:else}
  <span style="color: {color ?? k.tone}">{k.glyph || '·'}</span>
{/if}

<style>
  .node-icon {
    width: 1.1em;
    height: 1.1em;
    vertical-align: -0.2em;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
