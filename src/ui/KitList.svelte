<script lang="ts">
  import type { KitItem } from './kit';
  import { tip } from './tip';

  // A side's Mods (◆) or Burners (⏏︎) in the loadouts drawer / desktop
  // panel. Tap one to read it; a Mod that is acting right now flashes.
  let { items, flashing = new Set(), onpick }: { items: KitItem[]; flashing?: Set<string>; onpick: (item: KitItem) => void } = $props();
</script>

<ul class="kit">
  {#each items as item (item.key)}
    <li>
      <button class="item {item.kind}" class:spent={item.spent} class:flash={flashing.has(item.key)} onclick={() => onpick(item)} use:tip={`${item.name} · ${item.tag}${item.spent ? ' · spent' : ''}\n${item.text}`}>
        <span class="icon">{item.kind === 'mod' ? '◆' : '⏏︎'}</span>
        <span class="name">{item.name}</span>
        {#if item.spent}<span class="note">spent</span>{/if}
      </button>
    </li>
  {/each}
</ul>

<style>
  .kit {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .item {
    --tone: var(--mod);
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 7px;
    border-radius: var(--radius);
    border: 1px dashed var(--line);
    border-left: 3px solid var(--tone);
    background: var(--bg-raised);
    font-size: 12px;
    text-align: left;
    transition:
      background 0.12s,
      color 0.12s;
  }
  .burner {
    --tone: var(--warn);
  }
  .icon {
    color: var(--tone);
  }
  .spent {
    opacity: 0.4;
    text-decoration: line-through;
  }
  .note {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-dim);
  }
  .flash {
    animation: flash 0.5s ease-out;
  }
  @keyframes flash {
    0%,
    60% {
      background: var(--tone);
      color: var(--bg);
    }
  }
  .flash .icon {
    color: inherit;
  }
</style>
