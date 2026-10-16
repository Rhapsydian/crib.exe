<script lang="ts">
  import type { LoadoutEntry } from '../engine/resolve';
  import SuitIcon from './SuitIcon.svelte';

  // A loadout, top to bottom = firing order. Each piece shows its suit,
  // name, banked charges and whether its Hook is primed; tap to inspect
  // (P6). `dense` drops names to initials for the tightest layout.
  let { entries, onpick, dense = false, vertical = false }: { entries: LoadoutEntry[]; onpick: (index: number) => void; dense?: boolean; vertical?: boolean } = $props();

  const initials = (name: string) =>
    name
      .split(/[\s-]+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase();
  const primed = (e: LoadoutEntry) => e.state.charges > 0 || e.state.lastConditionTrue;
</script>

<ol class="loadout" class:dense class:vertical>
  {#each entries as entry, i (i)}
    <li>
      <button class="piece" class:primed={primed(entry)} style="--suit: var(--suit-{entry.definition.archetype})" onclick={() => onpick(i)} aria-label={entry.definition.name}>
        <SuitIcon archetype={entry.definition.archetype} size={dense ? 13 : 15} />
        <span class="name">{dense ? initials(entry.definition.name) : entry.definition.name}</span>
        {#if entry.state.charges > 0}<span class="charges">{entry.state.charges}</span>{/if}
      </button>
    </li>
  {/each}
</ol>

<style>
  .loadout {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .vertical {
    flex-direction: column;
    flex-wrap: nowrap;
  }
  .piece {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 7px;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    border-left: 3px solid var(--suit);
    background: var(--bg-raised);
    font-size: 12px;
    cursor: pointer;
    width: 100%;
    text-align: left;
  }
  .dense .piece {
    padding: 2px 5px;
    font-size: 11px;
  }
  .primed {
    box-shadow: 0 0 6px -1px var(--suit);
  }
  .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .charges {
    margin-left: auto;
    font-size: 10px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--suit);
    color: var(--bg);
    font-weight: 700;
  }
</style>
