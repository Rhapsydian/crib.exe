<script lang="ts">
  import { mockSnapshot } from './ui/snapshot';
  import TabsLayout from './ui/mockups/TabsLayout.svelte';
  import DrawersLayout from './ui/mockups/DrawersLayout.svelte';
  import CompactLayout from './ui/mockups/CompactLayout.svelte';

  // Milestone 2 layout mockups (docs/playable-design.md P3): three
  // phone-first layouts of the fight screen over one real, paused fight.
  // Switch with the pill at the top, or #tabs / #drawers / #compact.
  const snapshot = mockSnapshot();
  const layouts = ['tabs', 'drawers', 'compact'] as const;
  type Layout = (typeof layouts)[number];
  const fromHash = (): Layout => (layouts.find((l) => location.hash === `#${l}`) ?? 'tabs');
  let layout = $state<Layout>(fromHash());
  $effect(() => {
    const onHash = () => (layout = fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });
</script>

<div class="switcher">
  {#each layouts as l (l)}
    <a href="#{l}" class:active={layout === l}>{l}</a>
  {/each}
</div>

{#if layout === 'tabs'}
  <TabsLayout {snapshot} />
{:else if layout === 'drawers'}
  <DrawersLayout {snapshot} />
{:else}
  <CompactLayout {snapshot} />
{/if}

<style>
  .switcher {
    position: fixed;
    top: calc(4px + env(safe-area-inset-top));
    right: 6px;
    z-index: 30;
    display: flex;
    gap: 2px;
    background: rgb(0 0 0 / 70%);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 2px;
    font-size: 10px;
  }
  .switcher a {
    padding: 2px 8px;
    border-radius: 999px;
    color: var(--text-dim);
    text-decoration: none;
  }
  .switcher a.active {
    background: var(--accent);
    color: var(--bg);
  }
</style>
