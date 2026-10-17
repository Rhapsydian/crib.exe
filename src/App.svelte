<script lang="ts">
  import { mockSnapshot } from './ui/snapshot';
  import TabsLayout from './ui/mockups/TabsLayout.svelte';
  import DrawersLayout from './ui/mockups/DrawersLayout.svelte';
  import CompactLayout from './ui/mockups/CompactLayout.svelte';
  import FightScreen from './ui/FightScreen.svelte';
  import SetupScreen from './ui/SetupScreen.svelte';
  import LiveFightView from './ui/LiveFightView.svelte';
  import { LiveFight } from './ui/live-fight.svelte';
  import type { ClassId } from './engine/classes';
  import type { EnemyDefinition } from './engine/enemies';

  // The default page is a live fight (milestone 2): a test-harness setup
  // screen, then the fight. The fixed mockup moment stays reachable for
  // comparison -- #mock (the chosen screen) and the three P3 mockups at
  // #tabs / #drawers / #compact, with a switcher.
  const mocks = ['mock', 'tabs', 'drawers', 'compact'] as const;
  type Route = 'live' | (typeof mocks)[number];
  const fromHash = (): Route => mocks.find((l) => location.hash === `#${l}`) ?? 'live';
  let route = $state<Route>(fromHash());
  $effect(() => {
    const onHash = () => (route = fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  let snapshot = $state.raw<ReturnType<typeof mockSnapshot> | null>(null);
  $effect(() => {
    if (route !== 'live' && !snapshot) snapshot = mockSnapshot();
  });

  let fight = $state.raw<LiveFight | null>(null);
  let last = $state<{ classId: ClassId; enemyId: string; burners: boolean } | null>(null);
  const newSeed = () => Math.floor(Math.random() * 1_000_000);
  function start(classId: ClassId, enemy: EnemyDefinition, burners: boolean) {
    last = { classId, enemyId: enemy.id, burners };
    fight = new LiveFight({ classId, enemy, seed: newSeed(), carriedBurnerIds: burners ? ['flash-drive', 'emp-charge'] : [] });
  }
</script>

{#if route === 'live'}
  {#if fight}
    <LiveFightView {fight} onagain={() => fight && start(fight.setup.classId, fight.setup.enemy, (fight.setup.carriedBurnerIds?.length ?? 0) > 0)} onsetup={() => (fight = null)} />
  {:else}
    <SetupScreen onstart={start} classId={last?.classId} enemyId={last?.enemyId} burners={last?.burners} />
  {/if}
{:else if snapshot}
  <div class="switcher">
    {#each mocks as l (l)}
      <a href="#{l}" class:active={route === l}>{l}</a>
    {/each}
    <a href="#live">live</a>
  </div>
  {#if route === 'mock'}
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
