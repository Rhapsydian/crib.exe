<script lang="ts">
  import { profile } from './profile.svelte';
  import {
    UPGRADE_TRACKS,
    UPGRADE_VIEW,
    STARTING_BURNERS,
    STARTING_BURNER_PRICE,
    libraryOffers,
    upgradeLevel,
    upgradePrice,
    type UpgradeId,
  } from '../engine/meta';
  import { ALL_SUBROUTINES, ARCHETYPE_POOLS } from '../engine/subroutines';
  import { BURNER_DEFINITIONS } from '../engine/burners';
  import { rarityOf } from '../engine/rewards';
  import { describeHook, hookLabel, describeProcess } from './describe';
  import { archetypeInfo } from './suits';
  import SuitIcon from './SuitIcon.svelte';
  import RichText from './RichText.svelte';

  // The Message Board (session 71, docs/design/meta-progression.md MP16):
  // where Rep is spent between runs. Upgrades (MP7), the library (MP8:
  // one subroutine per archetype, every common before any uncommon), and
  // starting Burners (MP9). Its first visit opens on an introduction.
  // Purchases are permanent (MP12).
  let { onmenu }: { onmenu: () => void } = $props();
  let tab = $state<'upgrades' | 'library' | 'burners'>('upgrades');
  const tracks = Object.keys(UPGRADE_TRACKS) as UpgradeId[];
  const offers = $derived(libraryOffers(profile.data.library));
  const tierOf = $derived(offers[0]?.rarity);
  const poolSize = (rarity: string) => Object.values(ARCHETYPE_POOLS).reduce((n, p) => n + p[rarity === 'common' ? 'commons' : rarity === 'uncommon' ? 'uncommons' : 'rares'].length, 0);
  const unlockedOf = (rarity: string) => ALL_SUBROUTINES.filter((p) => profile.data.library.includes(p.id) && rarityOf(p.id) === rarity).length;
</script>

<div class="board">
  <button class="back" onclick={onmenu}>◂ menu</button>
  <div class="head">
    <h1>Message Board</h1>
    <span class="rep">◆ {profile.data.rep} rep</span>
  </div>

  {#if !profile.data.boardIntroduced}
    <div class="intro">
      <b>Welcome to the Message Board.</b>
      <p>Every run earns <b>Rep</b>: breach layers, beat elites, win. Spend it here between runs:</p>
      <ul>
        <li><b>Upgrades</b> make every run a little stronger.</li>
        <li><b>Library</b> subroutines can join your starting loadout.</li>
        <li><b>Burners</b> can be carried into a run.</li>
      </ul>
      <p class="dim">Purchases are permanent. Choose your starting picks on the class screen.</p>
      <button class="ok" onclick={() => profile.introduceBoard()}>got it</button>
    </div>
  {/if}

  <div class="tabs" role="tablist">
    <button role="tab" class:on={tab === 'upgrades'} onclick={() => (tab = 'upgrades')}>Upgrades</button>
    <button role="tab" class:on={tab === 'library'} onclick={() => (tab = 'library')}>Library</button>
    <button role="tab" class:on={tab === 'burners'} onclick={() => (tab = 'burners')}>Burners</button>
  </div>

  {#if tab === 'upgrades'}
    <div class="list">
      {#each tracks as id (id)}
        {@const view = UPGRADE_VIEW[id]}
        {@const level = upgradeLevel(profile.data.upgrades, id)}
        {@const max = UPGRADE_TRACKS[id].levels}
        {@const price = upgradePrice(id, level)}
        <div class="row">
          <div class="info">
            <div class="name"><b>{view.name}</b> <span class="pips" aria-label="level {level} of {max}">{'■'.repeat(level)}<span class="off">{'□'.repeat(max - level)}</span></span></div>
            <div class="dim">{level ? view.effect(level) : 'Not bought yet'}{price !== null ? ` · next: ${view.effect(level + 1)}` : ''}</div>
          </div>
          {#if price === null}
            <span class="maxed">maxed</span>
          {:else}
            <button class="buy" disabled={profile.data.rep < price} onclick={() => profile.buyUpgrade(id)}>◆ {price}</button>
          {/if}
        </div>
      {/each}
    </div>
  {:else if tab === 'library'}
    <div class="dim small">
      Unlocked subroutines can start a run as your auxiliary subroutine, from any archetype. One per archetype is on offer at a time; every common comes before any uncommon, and every uncommon before the rares.
    </div>
    {#if tierOf}
      <div class="caption">{tierOf.toUpperCase()}S · {unlockedOf(tierOf)} of {poolSize(tierOf)} unlocked</div>
      <div class="list">
        {#each offers as o (o.piece.id)}
          {@const info = archetypeInfo(o.piece.archetype)}
          <div class="row">
            <div class="info">
              <div class="name" style="--suit: {info.color}"><SuitIcon archetype={o.piece.archetype} size={14} /> <b>{o.piece.name}</b> <span class="dim">{info.name} · {o.rarity}</span></div>
              <div class="rules"><RichText text={`Process: ${describeProcess(o.piece.alpha)}`} /></div>
              {#if o.piece.beta}<div class="rules"><RichText text={`${hookLabel(o.piece)}: ${describeHook(o.piece)}`} /></div>{/if}
            </div>
            <button class="buy" disabled={profile.data.rep < o.price} onclick={() => profile.buyLibrary(o.piece.id)}>◆ {o.price}</button>
          </div>
        {/each}
      </div>
    {:else}
      <div class="caption">THE WHOLE LIBRARY IS UNLOCKED</div>
    {/if}
  {:else}
    <div class="dim small">Unlock a common Burner to choose it as you start a run; you carry it in.</div>
    <div class="list">
      {#each STARTING_BURNERS as id (id)}
        {@const b = BURNER_DEFINITIONS[id]}
        <div class="row">
          <div class="info">
            <div class="name"><b>⏏︎ {b.name}</b></div>
            <div class="rules"><RichText text={b.text} /></div>
          </div>
          {#if profile.data.burners.includes(id)}
            <span class="maxed">unlocked</span>
          {:else}
            <button class="buy" disabled={profile.data.rep < STARTING_BURNER_PRICE} onclick={() => profile.buyBurner(id)}>◆ {STARTING_BURNER_PRICE}</button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .board {
    max-width: 640px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .back {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--text-dim);
    font: inherit;
    font-size: 12px;
    padding: 0;
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  h1 {
    font-size: 18px;
    color: var(--accent);
    margin: 4px 0;
  }
  .rep {
    color: var(--mod);
    font-weight: 700;
  }
  .intro {
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: var(--bg-raised);
    padding: 10px 12px;
    font-size: 12.5px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .intro p,
  .intro ul {
    margin: 0;
  }
  .intro ul {
    padding-left: 18px;
  }
  .ok {
    align-self: flex-start;
    margin-top: 4px;
    padding: 5px 12px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--accent);
    font: inherit;
  }
  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--line);
  }
  .tabs button {
    padding: 6px 12px;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: var(--radius) var(--radius) 0 0;
    background: none;
    color: var(--text-dim);
    font: inherit;
    font-size: 12px;
  }
  .tabs button.on {
    border-color: var(--line);
    background: var(--bg-raised);
    color: var(--text);
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11.5px;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 13px;
  }
  .pips {
    color: var(--accent);
    letter-spacing: 1px;
    font-size: 11px;
  }
  .pips .off {
    color: var(--text-dim);
  }
  .rules {
    line-height: 1.35;
  }
  .buy {
    flex: none;
    padding: 5px 10px;
    border: 1px solid var(--mod);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--mod);
    font: inherit;
    font-size: 12px;
  }
  .buy:disabled {
    border-color: var(--line);
    color: var(--text-dim);
  }
  .maxed {
    flex: none;
    font-size: 11px;
    color: var(--text-dim);
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 4px;
  }
  .dim {
    color: var(--text-dim);
  }
  .small {
    font-size: 11.5px;
  }
</style>
