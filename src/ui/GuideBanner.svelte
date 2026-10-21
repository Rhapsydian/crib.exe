<script lang="ts">
  import { GUIDE_TEXT, guide } from './guide.svelte';

  // The tutorial coach (session 63): a banner at the top on the map and
  // between-fight screens, or (`inline`) a card over the fight's table.
  let { inline = false }: { inline?: boolean } = $props();
</script>

{#if guide.current}
  <div class="guide" class:inline role="status">
    <span class="mark">coach</span>
    <span class="text">{GUIDE_TEXT[guide.current]}</span>
    <button onclick={() => guide.dismiss()}>got it</button>
  </div>
{/if}

<style>
  .guide {
    position: fixed;
    top: calc(8px + env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, calc(100% - 24px));
    box-sizing: border-box;
    z-index: 31;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 11px;
    background: var(--bg-raised);
    border: 1px solid var(--warn);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgb(0 0 0 / 45%);
    font-size: 12px;
    line-height: 1.45;
  }
  /* In a fight: over the top of the table, inside its own slot, so nothing
     around it moves. */
  .guide.inline {
    position: absolute;
    top: 6px;
    width: calc(100% - 12px);
    z-index: 12;
  }
  .mark {
    flex: none;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--warn);
    text-transform: uppercase;
  }
  .text {
    flex: 1;
  }
  button {
    flex: none;
    padding: 4px 10px;
    border: 1px solid var(--warn);
    border-radius: var(--radius);
    background: transparent;
    color: var(--warn);
    font-size: 11px;
  }
</style>
