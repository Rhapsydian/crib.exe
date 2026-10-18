<script lang="ts">
  import RichText from './RichText.svelte';
  import type { RunRequest, ShopAction, ShopSlate } from '../engine/run-requests';
  import { BENCH_CAP, INSTALLED_SLOT_CAP } from '../engine/loadout';
  import SuitIcon from './SuitIcon.svelte';
  import { modText } from './kit';
  import { acquireNote, burnerText, burnerWhere, pieceLines, rarityOf } from './reward-text';
  import type { Archetype } from '../engine/subroutine-types';

  // A Shop (milestone 3 checkpoint 4, the user's call: buy freely): three
  // slates -- subroutines, Mods, Burners. Buy anything you can afford,
  // each once; reroll each slate once; leave when done. Tap an item to
  // select it, then buy. What you buy is yours when you leave (a full
  // bench or Burner pouch asks then).
  let { request, onact }: { request: Extract<RunRequest, { kind: 'shop' }>; onact: (action: ShopAction) => void } = $props();

  const shop = $derived(request.shop);
  const player = $derived(request.playerState);
  type Item = { slate: ShopSlate; index: number; name: string; tag: string; lines: string[]; note?: string; icon?: Archetype; glyph?: string; cost: number };
  const sections = $derived.by((): { slate: ShopSlate; title: string; items: Item[] }[] => [
    {
      slate: 'subroutine',
      title: 'SUBROUTINES',
      items: shop.slates.subroutine.map((o, index) => ({
        slate: 'subroutine',
        index,
        name: o.piece.name,
        tag: rarityOf(o.piece.id),
        lines: pieceLines(o.piece),
        note: acquireNote(o.piece, player, INSTALLED_SLOT_CAP, BENCH_CAP),
        icon: o.piece.archetype,
        cost: o.cost,
      })),
    },
    {
      slate: 'mod',
      title: 'MODS',
      items: shop.slates.mod.map((o, index) => ({ slate: 'mod', index, name: o.mod.name, tag: `${o.mod.rarity} Mod`, lines: [modText(o.mod.id)], glyph: '◆', cost: o.cost })),
    },
    {
      slate: 'burner',
      title: 'BURNERS',
      items: shop.slates.burner.map((o, index) => ({ slate: 'burner', index, name: o.burner.name, tag: `${o.burner.rarity} · ${burnerWhere(o.burner)}`, lines: [burnerText(o.burner)], glyph: '⏏︎', cost: o.cost })),
    },
  ]);
  let selected = $state<string | null>(null);
  const key = (i: Item) => `${i.slate}:${i.index}`;
  const isBought = (i: Item) => shop.bought[i.slate].includes(i.index);
  // A reroll replaces a slate: drop a selection that pointed into it.
  $effect(() => {
    void shop;
    if (selected && !sections.some((s) => s.items.some((i) => key(i) === selected && !isBought(i)))) selected = null;
  });
</script>

<div class="shop">
  <div class="head">
    <span class="title">SHOP</span>
    <span class="data">◫ {shop.data} Data</span>
  </div>
  <div class="blurb">Buy anything you can afford. Each slate can be rerolled once{shop.rerollCost ? ` for ${shop.rerollCost} Data` : ', free this visit'}.</div>

  {#each sections as section (section.slate)}
    <div class="section-head">
      <span class="caption">{section.title}</span>
      <button class="reroll" disabled={shop.rerolled[section.slate] || shop.data < shop.rerollCost} onclick={() => onact({ kind: 'reroll', slate: section.slate })}>
        {shop.rerolled[section.slate] ? 'rerolled' : `↻ reroll${shop.rerollCost ? ` · ${shop.rerollCost}` : ''}`}
      </button>
    </div>
    {#each section.items as item (key(item))}
      {@const bought = isBought(item)}
      {@const afford = item.cost <= shop.data}
      <div class="item" class:sel={selected === key(item)} class:bought class:poor={!afford && !bought}>
        <button class="body" disabled={bought} onclick={() => (selected = selected === key(item) ? null : key(item))}>
          <div class="name">
            {#if item.icon}<SuitIcon archetype={item.icon} size={14} />{:else}<span class="glyph" class:mod={item.slate === 'mod'}>{item.glyph}</span>{/if}
            <b>{item.name}</b>
            <span class="tag">{item.tag}</span>
            <span class="cost">{bought ? 'bought' : `${item.cost}`}</span>
          </div>
          {#if selected === key(item)}
            {#each item.lines as line (line)}<div class="line"><RichText text={line} /></div>{/each}
            {#if item.note}<div class="note">{item.note}</div>{/if}
          {/if}
        </button>
        {#if selected === key(item) && !bought}
          <button class="buy" disabled={!afford} onclick={() => { onact({ kind: 'buy', slate: item.slate, index: item.index }); selected = null; }}>
            {afford ? `buy · ${item.cost} Data` : `need ${item.cost - shop.data} more Data`}
          </button>
        {/if}
      </div>
    {/each}
  {/each}

  <button class="leave" onclick={() => onact({ kind: 'leave' })}>leave the Shop ▸</button>
</div>

<style>
  .shop {
    max-width: 560px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(16px + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .head {
    display: flex;
    align-items: baseline;
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
    font-size: 12px;
  }
  .blurb {
    color: var(--text-dim);
    font-size: 11px;
  }
  .section-head {
    display: flex;
    align-items: center;
    margin-top: 10px;
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
  }
  .reroll {
    margin-left: auto;
    padding: 2px 9px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-raised);
    color: var(--text-dim);
    font-size: 10.5px;
  }
  .reroll:disabled {
    opacity: 0.5;
  }
  .item {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    display: flex;
    flex-direction: column;
  }
  .item.sel {
    border-color: var(--accent);
  }
  .item.bought {
    opacity: 0.45;
  }
  .body {
    text-align: left;
    padding: 7px 8px;
    background: none;
    border: none;
    color: var(--text);
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 12px;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .glyph {
    color: var(--warn);
  }
  .glyph.mod {
    color: var(--mod);
  }
  .tag {
    font-size: 9.5px;
    color: var(--text-dim);
  }
  .cost {
    margin-left: auto;
    color: var(--accent);
    font-size: 11.5px;
  }
  .poor .cost {
    color: var(--text-dim);
  }
  .line {
    line-height: 1.4;
    font-size: 11.5px;
  }
  .note {
    font-size: 10.5px;
    color: var(--text-dim);
    font-style: italic;
  }
  .buy {
    margin: 0 8px 8px;
    padding: 7px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 12px;
  }
  .buy:disabled {
    border-color: var(--line);
    color: var(--text-dim);
    font-weight: 400;
  }
  .leave {
    margin-top: 12px;
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
</style>
