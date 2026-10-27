<script lang="ts">
  import WithKit from './WithKit.svelte';
  import type { DailyPlan } from '../engine/daily';
  import RichText from './RichText.svelte';
  import type { RunRequest, ShopAction, ShopSlate } from '../engine/run-requests';
  import { BENCH_CAP, slotCapOf } from '../engine/loadout';
  import SuitIcon from './SuitIcon.svelte';
  import { modText } from './kit';
  import { acquireNote, burnerText, burnerWhere, pieceLines, rarityOf } from './reward-text';
  import type { Archetype } from '../engine/subroutine-types';
  import { burnerCapOf, BURNER_DEFINITIONS } from '../engine/burners';
  import { burnerSellPrice, subroutineSellPrice } from '../engine/shop';
  import { ALL_SUBROUTINES } from '../engine/subroutines';
  import { rankMark } from './visit-text';
  import type { BurnerId } from '../engine/burner-types';

  // A Shop (milestone 3 checkpoint 4, the user's call: buy freely): three
  // slates -- subroutines, Mods, Burners. Buy anything you can afford,
  // each once; reroll each slate once; leave when done. Tap an item to
  // select it, then buy. What you buy is yours when you leave (a full
  // bench or Burner pouch asks then). Below the slates, SELL (session
  // 61): benched subroutines (+25% a Merge rank), banked copies and
  // carried Burners, for half their price (Cold Wallet: its own), the
  // Data available at once.
  let { request, onact, daily }: { request: Extract<RunRequest, { kind: 'shop' }>; onact: (action: ShopAction) => void; daily?: { plan: DailyPlan; practice: boolean } | null } = $props();

  const shop = $derived(request.shop);
  const player = $derived(request.playerState);
  // The player as this visit's purchases leave them (session 69, a
  // tester's note: every note read as if nothing had been bought, so
  // buying past the loadout and bench, or past the Burner limit, came with
  // no warning).
  // Sales count too (session 72, the user's ask): a sold bench subroutine
  // is no longer owned, a sold copy leaves the bank, and a bought copy of
  // an owned one joins it.
  const afterBuys = $derived.by(() => {
    const installed = [...player.installedLoadout];
    const bench = player.bench.filter((p) => !shop.sold.subroutine.includes(p.id));
    const material = { ...player.material };
    for (const id of shop.sold.copy) material[id] = Math.max(0, (material[id] ?? 0) - 1);
    const owned = (id: string) => installed.some((p) => p.id === id) || bench.some((p) => p.id === id);
    for (const i of shop.bought.subroutine) {
      const piece = shop.slates.subroutine[i]?.piece;
      if (!piece) continue;
      if (owned(piece.id)) {
        material[piece.id] = (material[piece.id] ?? 0) + 1;
        continue;
      }
      const used = installed.filter((p) => !player.grantedByMod[p.id]).length;
      (used < slotCapOf(player) ? installed : bench).push(piece);
    }
    // Mods and Burners too, for the kit drawer (v0.9.1): bought ones
    // join, sold Burners (one of each sale) leave.
    const ownedModIds = [...player.ownedModIds, ...shop.bought.mod.flatMap((i) => shop.slates.mod[i]?.mod.id ?? [])];
    const carriedBurnerIds = [...player.carriedBurnerIds];
    for (const id of shop.sold.burner) carriedBurnerIds.splice(carriedBurnerIds.indexOf(id), 1);
    for (const i of shop.bought.burner) if (shop.slates.burner[i]) carriedBurnerIds.push(shop.slates.burner[i].burner.id);
    return { ...player, installedLoadout: installed, bench, material, ownedModIds, carriedBurnerIds };
  });
  const burnersAfterBuys = $derived(afterBuys.carriedBurnerIds.length);
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
        note: shop.bought.subroutine.includes(index) ? undefined : acquireNote(o.piece, afterBuys, slotCapOf(player), BENCH_CAP),
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
      items: shop.slates.burner.map((o, index) => ({
        slate: 'burner',
        index,
        name: o.burner.name,
        tag: `${o.burner.contraband ? 'contraband' : o.burner.rarity} · ${burnerWhere(o.burner)}`,
        lines: [burnerText(o.burner)],
        note:
          !shop.bought.burner.includes(index) && burnersAfterBuys >= burnerCapOf(player)
            ? `You carry ${burnerCapOf(player)} Burners, the most you can: buying this means giving one up.`
            : o.burner.contexts.includes('shop')
              ? // A tester's Stolen Coupon "didn't prompt" (session 69): one
                // bought here works from the next Shop you enter.
                "A Shop Burner: you're offered it as you enter your next Shop."
              : undefined,
        glyph: '⏏︎',
        cost: o.cost,
      })),
    },
  ]);
  // What's left to sell: the bench and carried Burners, less what this
  // visit already sold (one entry per copy).
  const without = <T extends string>(ids: T[], sold: T[]) => {
    const left = [...sold];
    return ids.filter((id) => {
      const i = left.indexOf(id);
      if (i === -1) return true;
      left.splice(i, 1);
      return false;
    });
  };
  type Sellable = { key: string; item: 'subroutine' | 'copy' | 'burner'; id: string; name: string; tag: string; lines: string[]; icon?: Archetype; price: number };
  const sellables = $derived.by((): Sellable[] => [
    ...without(player.bench.map((p) => p.id), shop.sold.subroutine).map((id, i) => {
      const piece = player.bench.find((p) => p.id === id)!;
      const mark = rankMark(piece.rank);
      return { key: `sell:s:${i}:${id}`, item: 'subroutine' as const, id, name: `${piece.name}${mark ? ` ${mark}` : ''}`, tag: `${rarityOf(id)} · benched`, lines: pieceLines(piece), icon: piece.archetype, price: subroutineSellPrice(id, piece.rank ?? 0) };
    }),
    // Banked copies, one row per copy left (a copy is rank 0).
    ...Object.entries(player.material).flatMap(([id, n]) => {
      const left = n - shop.sold.copy.filter((c) => c === id).length;
      const piece = ALL_SUBROUTINES.find((p) => p.id === id) ?? player.installedLoadout.find((p) => p.id === id) ?? player.bench.find((p) => p.id === id);
      if (!piece || left <= 0) return [];
      return Array.from({ length: left }, (_, i) => ({ key: `sell:c:${i}:${id}`, item: 'copy' as const, id, name: piece.name, tag: `${rarityOf(id)} · banked copy`, lines: ['A spare copy, banked for Refactoring at a Quiet Host.'], icon: piece.archetype, price: subroutineSellPrice(id) }));
    }),
    ...without(player.carriedBurnerIds, shop.sold.burner).map((id, i) => {
      const def = BURNER_DEFINITIONS[id];
      return { key: `sell:b:${i}:${id}`, item: 'burner' as const, id, name: def.name, tag: `${def.contraband ? 'contraband' : def.rarity} Burner`, lines: [burnerText(def)], price: burnerSellPrice(def) };
    }),
  ]);
  const sell = (s: Sellable) =>
    onact(
      s.item === 'burner' ? { kind: 'sell', item: 'burner', id: s.id as BurnerId } : s.item === 'copy' ? { kind: 'sell', item: 'copy', id: s.id } : { kind: 'sell', item: 'subroutine', id: s.id },
    );

  let selected = $state<string | null>(null);
  const key = (i: Item) => `${i.slate}:${i.index}`;
  const isBought = (i: Item) => shop.bought[i.slate].includes(i.index);
  // A reroll replaces a slate: drop a selection that pointed into it.
  // (A Sell row's selection counts too: without it, tapping one cleared
  // itself at once and the row never opened -- session 61's playtest bug.)
  $effect(() => {
    void shop;
    if (!selected) return;
    const buying = sections.some((s) => s.items.some((i) => key(i) === selected && !isBought(i)));
    const selling = sellables.some((s) => s.key === selected);
    if (!buying && !selling) selected = null;
  });
</script>

<WithKit player={afterBuys} {daily}>
{#snippet children(kitButton)}
<div class="shop">
  <div class="head">
    <span class="title">SHOP</span>
    <span class="data">◫ {shop.data} Data</span>
    {@render kitButton()}
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

  {#if sellables.length}
    <div class="section-head"><span class="caption">SELL · benched subroutines, banked copies, Burners</span></div>
    {#each sellables as s (s.key)}
      <div class="item" class:sel={selected === s.key}>
        <button class="body" onclick={() => (selected = selected === s.key ? null : s.key)}>
          <div class="name">
            {#if s.icon}<SuitIcon archetype={s.icon} size={14} />{:else}<span class="glyph">⏏︎</span>{/if}
            <b>{s.name}</b>
            <span class="tag">{s.tag}</span>
            <span class="cost">+{s.price}</span>
          </div>
          {#if selected === s.key}
            {#each s.lines as line (line)}<div class="line"><RichText text={line} /></div>{/each}
          {/if}
        </button>
        {#if selected === s.key}
          <button class="buy" onclick={() => { sell(s); selected = null; }}>sell · +{s.price} Data</button>
        {/if}
      </div>
    {/each}
  {/if}

  <button class="leave" onclick={() => onact({ kind: 'leave' })}>leave the Shop ▸</button>
</div>
{/snippet}
</WithKit>

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
