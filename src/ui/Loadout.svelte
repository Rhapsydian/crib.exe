<script lang="ts">
  import type { LoadoutEntry } from '../engine/resolve';
  import SuitIcon from './SuitIcon.svelte';
  import { tip } from './tip';
  import { rankMark } from './visit-text';
  import { describeAlarm, describeHook, hookLabel, describeProcess, forEnemy, plainText } from './describe';

  // A loadout, top to bottom = firing order. Each piece shows its suit,
  // name, banked charges and whether its Hook is primed; tap to inspect
  // (P6). `dense` drops names to initials for the tightest layout.
  // `firing` is the slot lit up by the turn step-through (P4).
  let {
    entries,
    onpick,
    dense = false,
    vertical = false,
    firing = -1,
    enemy = false,
  }: { entries: LoadoutEntry[]; onpick: (index: number) => void; dense?: boolean; vertical?: boolean; firing?: number; enemy?: boolean } = $props();

  // The hover tip (desktop): the subroutine in brief.
  const tipText = (e: LoadoutEntry) => {
    const voice = (t: string) => plainText(enemy ? forEnemy(t) : t);
    const d = e.definition;
    return [`${d.name}${d.rank ? ` ${rankMark(d.rank)}` : ''}`, `Process: ${voice(describeProcess(d.alpha))}`, d.beta ? `${hookLabel(d)}: ${voice(describeHook(d))}` : null, describeAlarm(d) ? `Alarm: ${describeAlarm(d)}` : null].filter(Boolean).join('\n');
  };

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
      <button class="piece" class:primed={primed(entry)} class:firing={i === firing} style="--suit: var(--suit-{entry.definition.archetype})" onclick={() => onpick(i)} aria-label={entry.definition.name} use:tip={tipText(entry)}>
        <SuitIcon archetype={entry.definition.archetype} size={dense ? 13 : 15} />
        <span class="name">{entry.temp ? '⏏︎ ' : ''}{dense ? initials(entry.definition.name) : entry.definition.name}</span>
        {#if entry.temp}<span class="rank burner-tag" title="A Burner's temporary subroutine: turns it has left">{dense ? entry.temp.firesLeft : `Burner · ${entry.temp.firesLeft} left`}</span>
        {:else if entry.definition.rank}<span class="rank" title="Refactor rank">{rankMark(entry.definition.rank)}</span>{/if}
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
  .rank {
    font-size: 9px;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.04em;
  }
  .dense .piece {
    padding: 2px 5px;
    font-size: 11px;
  }
  .primed {
    box-shadow: 0 0 6px -1px var(--suit);
  }
  .firing {
    background: var(--suit);
    color: var(--bg);
    transform: scale(1.06);
  }
  /* The icon is drawn in the suit colour (an inline style), which would
     vanish on the lit piece's suit-coloured fill. */
  .firing :global(svg) {
    color: var(--bg) !important;
  }
  .piece {
    transition:
      background 0.12s,
      transform 0.12s;
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
  .burner-tag {
    color: var(--warn);
  }
</style>
