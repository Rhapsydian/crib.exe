<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { DailyPlan } from '../engine/daily';
  import type { RunPlayerState } from '../engine/run';
  import KitDrawer from './KitDrawer.svelte';

  // A run screen with your kit beside it, read-only (v0.9.0, a tester's
  // ask: the reward and Shop screens): a standing left panel on desktop,
  // and on phones a "◀ loadout" button that the screen puts in its own
  // header (`children` gets it as a snippet) to slide the drawer in.
  let { player, daily, children }: { player: RunPlayerState; daily?: { plan: DailyPlan; practice: boolean } | null; children: Snippet<[Snippet]> } = $props();
  let open = $state(false);
</script>

{#snippet button()}
  <button class="kit-button" onclick={() => (open = true)}>◀ loadout</button>
{/snippet}

<div class="with-kit">
  <KitDrawer {player} {daily} bind:open />
  <div class="screen">{@render children(button)}</div>
</div>

<style>
  .with-kit {
    min-height: 100%;
    display: flex;
    justify-content: center;
  }
  /* The run screens are at most 560px wide; asking for that much makes
     the right-hand spacer give way before the screen does. */
  .screen {
    flex: 1 1 560px;
    min-width: 0;
  }
  .kit-button {
    margin-left: auto;
    align-self: center;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-raised);
    font-size: 11px;
    color: var(--text-dim);
    white-space: nowrap;
  }
  @media (min-width: 900px) {
    .kit-button {
      display: none;
    }
    /* A matching empty column on the right, so the screen sits in the
       middle (as on the map); it gives way first when space is short. */
    .with-kit::after {
      content: '';
      flex: 0 100 300px;
      min-width: 0;
    }
  }
</style>
