<script lang="ts">
  import { ARCHETYPES, type SubroutineDefinition } from '../engine/subroutine-types';
  import type { BurnerDefinition } from '../engine/burner-types';
  import SuitIcon from './SuitIcon.svelte';
  import RichText from './RichText.svelte';
  import { archetypeInfo } from './suits';
  import { burnerText, burnerWhere, pieceLines, rarityOf } from './reward-text';

  // The run's starting picks (session 72, the user: the drop-downs' names
  // weren't enough to choose by). A sheet listing every unlocked choice
  // with its full rules; tapping one picks it. Subroutines come grouped by
  // archetype, and the ones already in the class's loadout are dimmed with
  // the reason. A bottom sheet on phones, a centred card on wide screens
  // (as the review drawer).
  let {
    title,
    subroutines = [],
    burners = [],
    disabled = new Map(),
    chosen,
    onpick,
    onclose,
  }: {
    title: string;
    subroutines?: SubroutineDefinition[];
    burners?: BurnerDefinition[];
    /** Unpickable ids, with why. */
    disabled?: ReadonlyMap<string, string>;
    chosen?: string;
    onpick: (id: string) => void;
    onclose: () => void;
  } = $props();

  const groups = $derived(ARCHETYPES.map((a) => ({ archetype: a, pieces: subroutines.filter((p) => p.archetype === a) })).filter((g) => g.pieces.length));
</script>

<div class="scrim" onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-label={title}>
  <div class="head">
    <div class="kicker">{title}</div>
    <button class="x" onclick={onclose} aria-label="close">✕</button>
  </div>
  {#each groups as g (g.archetype)}
    <div class="group"><SuitIcon archetype={g.archetype} size={14} /> {archetypeInfo(g.archetype).name.toUpperCase()}</div>
    {#each g.pieces as p (p.id)}
      {@const why = disabled.get(p.id)}
      <button class="item" class:chosen={chosen === p.id} disabled={!!why} onclick={() => onpick(p.id)}>
        <div class="name"><b>{p.name}</b> <span class="dim">· {rarityOf(p.id)}</span>{#if why}<span class="why">{why}</span>{/if}</div>
        {#each pieceLines(p) as line (line)}<div class="text"><RichText text={line} /></div>{/each}
      </button>
    {/each}
  {/each}
  {#each burners as b (b.id)}
    <button class="item" class:chosen={chosen === b.id} onclick={() => onpick(b.id)}>
      <div class="name"><b>⏏︎ {b.name}</b> <span class="dim">· {burnerWhere(b)}</span></div>
      <div class="text"><RichText text={burnerText(b)} /></div>
    </button>
  {/each}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    z-index: 30;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 31;
    max-height: 85vh;
    overflow-y: auto;
    background: var(--bg-raised);
    border-top: 2px solid var(--accent);
    border-radius: 12px 12px 0 0;
    padding: 12px 14px calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }
  @media (min-width: 900px) {
    .sheet {
      left: 50%;
      right: auto;
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 480px;
      border: 1px solid var(--line);
      border-top: 2px solid var(--accent);
      border-radius: 12px;
    }
  }
  .head {
    display: flex;
    align-items: center;
    position: sticky;
    top: -12px;
    margin-top: -12px;
    padding-top: 12px;
    background: var(--bg-raised);
  }
  .kicker {
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }
  .x {
    margin-left: auto;
    border: none;
    background: none;
    color: var(--text-dim);
    font: inherit;
    font-size: 14px;
  }
  .group {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .item:not(:disabled):hover {
    border-color: var(--accent);
  }
  .item.chosen {
    border-color: var(--accent);
  }
  .item:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .name {
    display: flex;
    align-items: baseline;
    gap: 4px;
    flex-wrap: wrap;
  }
  .dim {
    color: var(--text-dim);
    font-size: 11px;
  }
  .why {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-dim);
  }
  .text {
    font-size: 11px;
    color: var(--text-dim);
    line-height: 1.4;
  }
</style>
