<script lang="ts">
  import { MOCKS, type DevRoute } from './dev-routes';
  import { mockSnapshot } from './ui/snapshot';
  import TabsLayout from './ui/mockups/TabsLayout.svelte';
  import DrawersLayout from './ui/mockups/DrawersLayout.svelte';
  import CompactLayout from './ui/mockups/CompactLayout.svelte';
  import FightScreen from './ui/FightScreen.svelte';
  import SetupScreen from './ui/SetupScreen.svelte';
  import LiveFightView from './ui/LiveFightView.svelte';
  import MapMockup from './ui/mockups/map/MapMockup.svelte';
  import PegboardMockup from './ui/mockups/pegboard/PegboardMockup.svelte';
  import { LiveFight } from './ui/live-fight.svelte';
  import type { ClassId } from './engine/classes';
  import type { EnemyDefinition } from './engine/enemies';

  // App.svelte loads this only in development (import.meta.env.DEV), so
  // none of it ships in the release build.
  let { route }: { route: DevRoute } = $props();

  let snapshot = $state.raw<ReturnType<typeof mockSnapshot> | null>(null);
  $effect(() => {
    if (route !== 'test' && !snapshot) snapshot = mockSnapshot();
  });

  let fight = $state.raw<LiveFight | null>(null);
  let last = $state<{ classId: ClassId; enemyId: string; burners: boolean } | null>(null);
  const newSeed = () => Math.floor(Math.random() * 1_000_000);
  function start(classId: ClassId, enemy: EnemyDefinition, burners: boolean) {
    last = { classId, enemyId: enemy.id, burners };
    fight = new LiveFight({ classId, enemy, seed: newSeed(), carriedBurnerIds: burners ? ['packet-storm', 'bootstrap-loader', 'flash-drive'] : [] });
  }
</script>

{#if route === 'test'}
  {#if fight}
    <LiveFightView
      {fight}
      actions={[
        { label: 'fight again', onclick: () => fight && start(fight.setup.classId, fight.setup.enemy, (fight.setup.carriedBurnerIds?.length ?? 0) > 0) },
        { label: 'change setup', onclick: () => (fight = null) },
      ]}
    />
  {:else}
    <SetupScreen onstart={start} classId={last?.classId} enemyId={last?.enemyId} burners={last?.burners} />
  {/if}
{:else if snapshot}
  <div class="switcher">
    {#each MOCKS as l (l)}
      <a href="#{l}" class:active={route === l}>{l}</a>
    {/each}
    <a href="#run">run</a>
  </div>
  {#if route === 'map'}
    <MapMockup />
  {:else if route === 'pegboard'}
    <PegboardMockup />
  {:else if route === 'mock'}
    <FightScreen {snapshot} />
  {:else if route === 'tabs'}
    <TabsLayout {snapshot} />
  {:else if route === 'drawers'}
    <DrawersLayout {snapshot} />
  {:else}
    <CompactLayout {snapshot} />
  {/if}
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
