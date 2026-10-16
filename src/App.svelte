<script lang="ts">
  import { mockSnapshot } from './ui/snapshot';
  import TabsLayout from './ui/mockups/TabsLayout.svelte';
  import DrawersLayout from './ui/mockups/DrawersLayout.svelte';
  import CompactLayout from './ui/mockups/CompactLayout.svelte';
  import FightScreen from './ui/FightScreen.svelte';

  // The fight screen (milestone 2), over one real paused fight. The
  // default is the chosen layout: compact on phones, drawers on desktop.
  // The three P3 mockups stay reachable at #tabs / #drawers / #compact,
  // with a switcher, for comparison.
  const snapshot = mockSnapshot();
  const layouts = ['fight', 'tabs', 'drawers', 'compact'] as const;
  type Layout = (typeof layouts)[number];
  const fromHash = (): Layout => (layouts.find((l) => location.hash === `#${l}`) ?? 'fight');
  let layout = $state<Layout>(fromHash());
  $effect(() => {
    const onHash = () => (layout = fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });
</script>

{#if layout !== 'fight'}
  <div class="switcher">
    {#each layouts as l (l)}
      <a href="#{l}" class:active={layout === l}>{l}</a>
    {/each}
  </div>
{/if}

{#if layout === 'fight'}
  <FightScreen {snapshot} />
{:else if layout === 'tabs'}
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
