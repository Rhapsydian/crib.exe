<script lang="ts">
  import { TIP_TEXT, tips } from './tips.svelte';

  // The first-time tip on screen (session 63, T6): a small banner at the
  // top that never blocks play; "got it" retires it for good.
</script>

{#if tips.current}
  <div class="tip" role="status">
    <span class="mark">tip</span>
    <span class="text">{TIP_TEXT[tips.current]}</span>
    <button onclick={() => tips.dismiss()}>got it</button>
  </div>
{/if}

<style>
  .tip {
    position: fixed;
    top: calc(8px + env(safe-area-inset-top));
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, calc(100% - 24px));
    box-sizing: border-box;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--bg-raised);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgb(0 0 0 / 40%);
    font-size: 12px;
    line-height: 1.4;
  }
  .mark {
    flex: none;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--accent);
    text-transform: uppercase;
  }
  .text {
    flex: 1;
  }
  button {
    flex: none;
    padding: 4px 10px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: transparent;
    color: var(--accent);
    font-size: 11px;
  }
</style>
