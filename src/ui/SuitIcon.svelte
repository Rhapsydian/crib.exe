<script lang="ts">
  import type { Archetype } from '../engine/subroutine-types';

  // Bold, mutually distinct silhouettes (DESIGN.md Theming): a bug, a
  // gear, a lightning bolt, a honey jar. Placeholder art for the
  // mockups; the style guide (milestone 4) replaces them.
  let { archetype, size = 16 }: { archetype: Archetype; size?: number } = $props();
</script>

<svg class="suit" width={size} height={size} viewBox="0 0 24 24" style="color: var(--suit-{archetype})" aria-label={archetype} role="img">
  {#if archetype === 'exploit'}
    <ellipse cx="12" cy="13.5" rx="5" ry="6.5" fill="currentColor" />
    <circle cx="12" cy="5.5" r="2.6" fill="currentColor" />
    <path d="M7 10 L3 8 M7 14 L2.5 14 M7.5 18 L3.5 21 M17 10 L21 8 M17 14 L21.5 14 M16.5 18 L20.5 21 M10.5 3.5 L9 1 M13.5 3.5 L15 1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none" />
  {:else if archetype === 'daemon'}
    <path
      d="M10.3 2h3.4l.5 2.6 1.8.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.8 2.6.5v3.4l-2.6.5-.8 1.8 1.5 2.2-2.4 2.4-2.2-1.5-1.8.8-.5 2.6h-3.4l-.5-2.6-1.8-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.8L2 13.7v-3.4l2.6-.5.8-1.8-1.5-2.2 2.4-2.4 2.2 1.5 1.8-.8z"
      fill="currentColor"
    />
    <circle cx="12" cy="12" r="3.4" fill="var(--bg)" />
  {:else if archetype === 'overclock'}
    <path d="M13.5 1 L4 14 H11 L9.5 23 L20 9 H13 Z" fill="currentColor" />
  {:else}
    <rect x="8" y="2" width="8" height="3" rx="1" fill="currentColor" />
    <path d="M6 6 H18 Q21 9 20 15 Q19 22 12 22 Q5 22 4 15 Q3 9 6 6 Z" fill="currentColor" />
    <path d="M7.5 12 H16.5" stroke="var(--bg)" stroke-width="1.6" />
  {/if}
</svg>

<style>
  .suit {
    display: inline-block;
    vertical-align: middle;
    flex: none;
  }
</style>
