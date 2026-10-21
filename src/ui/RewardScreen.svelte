<script lang="ts">
  import RichText from './RichText.svelte';
  import type { RunRequest } from '../engine/run-requests';
  import type { SubroutineDefinition } from '../engine/subroutine-types';
  import type { ModDefinition } from '../engine/mod-types';
  import type { BurnerDefinition } from '../engine/burner-types';
  import { BENCH_CAP, INSTALLED_SLOT_CAP } from '../engine/loadout';
  import { BURNER_CAP } from '../engine/burners';
  import SuitIcon from './SuitIcon.svelte';
  import { modText } from './kit';
  import { acquireNote, burnerText, burnerWhere, pieceLines, rarityOf } from './reward-text';

  // A reward after a win (milestone 3 checkpoint 3): pick one of the
  // offered pieces, Mods or Burners, or skip. Tap to select, then take it
  // (the same tap-then-confirm as cards). `gained` is the Data this
  // encounter paid, shown with the first reward.
  let {
    request,
    gained = 0,
    onpick,
  }: { request: Extract<RunRequest, { kind: 'reward' }>; gained?: number; onpick: (choice: unknown) => void } = $props();

  type Option = { key: string; kind: 'subroutine' | 'mod' | 'burner'; name: string; tag: string; lines: string[]; note?: string; icon?: SubroutineDefinition['archetype']; value: unknown };
  const player = $derived(request.playerState);
  const subOption = (p: SubroutineDefinition): Option => ({
    key: p.id,
    kind: 'subroutine',
    name: p.name,
    tag: rarityOf(p.id),
    lines: pieceLines(p),
    note: acquireNote(p, player, INSTALLED_SLOT_CAP, BENCH_CAP),
    icon: p.archetype,
    value: p,
  });
  const modOption = (m: ModDefinition): Option => ({ key: m.id, kind: 'mod', name: m.name, tag: `${m.rarity} Mod`, lines: [modText(m.id)], value: m });
  const options = $derived.by((): Option[] => {
    // An elite win (session 62): one choice among subroutines and Mods.
    if (request.reward === 'eliteChoice') return [...request.subroutines.map(subOption), ...request.mods.map(modOption)];
    if (request.reward === 'subroutine') return (request.options as SubroutineDefinition[]).map(subOption);
    if (request.reward === 'mod') return (request.options as ModDefinition[]).map(modOption);
    return (request.options as BurnerDefinition[]).map((b) => ({
      key: b.id,
      kind: 'burner' as const,
      name: b.name,
      tag: `${b.rarity} Burner · ${burnerWhere(b)}`,
      lines: [burnerText(b)],
      note: player.carriedBurnerIds.length >= BURNER_CAP ? `You carry ${BURNER_CAP}, the most you can: you'll choose one to swap out.` : undefined,
      value: b,
    }));
  });
  const TITLE = { subroutine: 'CHOOSE A SUBROUTINE', mod: 'CHOOSE A MOD', burner: 'CHOOSE A BURNER', eliteChoice: 'CHOOSE ONE' } as const;
  const BLURB = {
    subroutine: 'A new subroutine for your loadout.',
    mod: 'A permanent effect for the rest of the run.',
    burner: 'A one-use item.',
    eliteChoice: 'A subroutine for your loadout, or a Mod for the rest of the run: one, not both.',
  } as const;
  let selected = $state<string | null>(null);
  $effect(() => {
    void request;
    selected = null;
  });
  const chosen = $derived(options.find((o) => o.key === selected));
</script>

<div class="reward">
  <div class="head">
    <span class="title">{TITLE[request.reward]}</span>
    {#if gained > 0}<span class="data">+{gained} Data · {player.data} total</span>{/if}
  </div>
  <div class="blurb">{BLURB[request.reward]}</div>
  <div class="options">
    {#each options as o, i (o.key)}
      {#if request.reward === 'eliteChoice' && (i === 0 || options[i - 1].kind !== o.kind)}
        <div class="section">{o.kind === 'mod' ? 'OR A MOD' : 'A SUBROUTINE'}</div>
      {/if}
      <button class="option" class:sel={selected === o.key} class:mod={o.kind === 'mod'} class:burner={o.kind === 'burner'} onclick={() => (selected === o.key ? onpick(o.value) : (selected = o.key))}>
        <div class="name">
          {#if o.icon}<SuitIcon archetype={o.icon} size={16} />{:else if o.kind === 'mod'}<span class="glyph mod-c">◆</span>{:else}<span class="glyph burner-c">⏏︎</span>{/if}
          <b>{o.name}</b>
          <span class="tag">{o.tag}</span>
        </div>
        {#each o.lines as line (line)}<div class="line"><RichText text={line} /></div>{/each}
        {#if o.note}<div class="note">{o.note}</div>{/if}
      </button>
    {/each}
  </div>
  <div class="actions">
    <button class="skip" onclick={() => onpick(null)}>skip</button>
    <button class="take" disabled={!chosen} onclick={() => chosen && onpick(chosen.value)}>{chosen ? `take ${chosen.name}` : 'tap one to choose'}</button>
  </div>
</div>

<style>
  .section {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 6px;
  }
  .reward {
    max-width: 560px;
    margin: 0 auto;
    min-height: 100%;
    box-sizing: border-box;
    padding: var(--gutter);
    padding-top: calc(16px + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }
  .title {
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.08em;
    font-size: 14px;
  }
  .data {
    margin-left: auto;
    color: var(--accent);
    font-size: 11px;
  }
  .blurb {
    color: var(--text-dim);
    font-size: 11.5px;
  }
  .options {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .option {
    text-align: left;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .option.sel {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .option.mod.sel {
    border-color: var(--mod);
    box-shadow: 0 0 0 1px var(--mod) inset;
  }
  .option.burner.sel {
    border-color: var(--warn);
    box-shadow: 0 0 0 1px var(--warn) inset;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
  }
  .glyph {
    font-size: 14px;
  }
  .mod-c {
    color: var(--mod);
  }
  .burner-c {
    color: var(--warn);
  }
  .tag {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-dim);
  }
  .line {
    line-height: 1.4;
  }
  .note {
    font-size: 10.5px;
    color: var(--text-dim);
    font-style: italic;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .actions button {
    padding: 10px;
    border-radius: var(--radius);
    font-size: 13px;
    background: transparent;
  }
  .skip {
    border: 1px solid var(--line);
    color: var(--text-dim);
  }
  .take {
    flex: 1;
    border: 1px solid var(--accent);
    color: var(--accent);
    font-weight: 700;
  }
  .take:disabled {
    border-color: var(--line);
    color: var(--text-dim);
    font-weight: 400;
  }
</style>
