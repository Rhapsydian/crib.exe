<script lang="ts">
  import type { TurnPanelState } from './turn-panel';
  import RichText from './RichText.svelte';

  // The detailed turn display (session 82): the turn-taker's subroutines
  // over the middle of the fight screen, lit as they fire, with what each
  // Process did, Hook callouts and the turn's tally. The bands above and
  // below (loadout strips, gauges) stay in view and keep moving. A tap
  // jumps to the totals, a second one closes it (`onskip`).
  let { panel, onskip }: { panel: TurnPanelState; onskip: () => void } = $props();

  // Keep the lit row in view when a long loadout overflows the panel.
  let list = $state<HTMLElement | null>(null);
  $effect(() => {
    const firing = panel.rows.findIndex((r) => r.state === 'firing');
    if (firing < 0 || !list) return;
    list.children[firing]?.scrollIntoView({ block: 'nearest' });
  });
</script>

<button class="turn-panel" class:them={panel.side === 1} onclick={onskip} aria-label={panel.ended ? 'close the turn' : 'skip to the turn’s totals'}>
  <div class="head">
    <b>▶ {panel.side === 0 ? 'YOUR' : 'THEIR'} TURN</b>
    <span class="hint">{panel.ended ? 'tap to close' : 'tap to skip'}</span>
  </div>
  {#each panel.notes.filter((n) => n.tone === 'burner') as note, i (i)}
    <div class="note burner">{note.text}</div>
  {/each}
  <ol class="rows" bind:this={list}>
    {#each panel.rows as row, i (i)}
      <li class="row {row.state}">
        <div class="line">
          <span class="name"><span class="slot">{i + 1}</span>{row.name}</span>
          <span class="did">{row.state === 'pending' ? '…' : row.state === 'skipped' ? 'skipped' : row.process}</span>
        </div>
        {#if row.hook}
          <div class="hook">
            <div class="line"><span><span class="tag">HOOK</span></span><span class="did">{row.hook.effect}</span></div>
            {#if row.hook.why}<div class="why"><RichText text={row.hook.why} /></div>{/if}
          </div>
        {/if}
        {#if row.mods.length}<div class="mods">◆ {row.mods.join(', ')}</div>{/if}
      </li>
    {/each}
  </ol>
  {#each panel.notes.filter((n) => n.tone !== 'burner') as note, i (i)}
    <div class="note {note.tone}">{note.text}</div>
  {/each}
  <div class="tally" class:final={panel.ended}>
    {#if panel.tally.length}
      {#each panel.tally as item (item)}<span>{item}</span>{/each}
    {:else}
      <span class="quiet">…</span>
    {/if}
  </div>
</button>

<style>
  .turn-panel {
    --side: var(--accent);
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 7px 9px;
    text-align: left;
    font: inherit;
    color: var(--text);
    background: var(--bg-raised);
    border: 1px solid var(--side);
    border-radius: var(--radius);
    overflow: hidden;
    cursor: pointer;
    animation: panel-in 0.18s ease-out;
  }
  .turn-panel.them {
    --side: var(--danger);
  }
  @keyframes panel-in {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    color: var(--side);
    font-size: 13px;
    letter-spacing: 0.1em;
  }
  .hint {
    font-size: 10px;
    letter-spacing: 0;
    color: var(--text-dim);
  }
  .rows {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row {
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid transparent;
    font-size: 12px;
    transition: background 0.15s, border-color 0.15s;
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .slot {
    display: inline-block;
    width: 1.4em;
    color: var(--text-dim);
  }
  .did {
    flex: none;
    max-width: 60%;
    text-align: right;
  }
  .row.pending .did,
  .row.skipped {
    color: var(--text-dim);
  }
  .row.fired .did {
    color: var(--side);
  }
  .row.firing {
    background: var(--bg-sunken);
    border-color: var(--side);
  }
  .row.firing .did {
    color: var(--side);
    font-weight: 700;
  }
  .hook {
    margin: 2px 0 0 1.4em;
    padding-left: 6px;
    border-left: 2px solid var(--mod);
  }
  .hook .did {
    color: var(--mod);
  }
  .tag {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 3px;
    border: 1px solid var(--mod);
    color: var(--mod);
    letter-spacing: 0.08em;
  }
  .why {
    font-size: 10.5px;
    line-height: 1.3;
    color: var(--text-dim);
  }
  .mods {
    margin-left: 1.4em;
    font-size: 10.5px;
    color: var(--mod);
  }
  .note {
    font-size: 11px;
    color: var(--mod);
  }
  .note.burner,
  .note.strain {
    color: var(--warn);
  }
  .tally {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    padding-top: 4px;
    border-top: 1px dashed var(--line);
    font-size: 12px;
    color: var(--side);
  }
  .tally.final {
    font-weight: 700;
  }
  .tally .quiet {
    color: var(--text-dim);
  }
</style>
