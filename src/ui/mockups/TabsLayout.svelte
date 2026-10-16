<script lang="ts">
  import type { FightSnapshot } from '../snapshot';
  import { fightParts, pickedEntry, pickFromLog, type Picked } from '../fight';
  import Gauges from '../Gauges.svelte';
  import Loadout from '../Loadout.svelte';
  import Table from '../Table.svelte';
  import Hand from '../Hand.svelte';
  import Log from '../Log.svelte';
  import DetailSheet from '../DetailSheet.svelte';

  // Variant A -- TABS (the user's idea). The opponent's meters are always
  // at the top and your hand always at the bottom; the middle switches
  // between the Table, both Loadouts, and the Log. On wide screens the
  // tabs go away: table centre, loadouts left, log right.
  let { snapshot }: { snapshot: FightSnapshot } = $props();
  const f = $derived(fightParts(snapshot));
  let tab = $state<'table' | 'loadouts' | 'log'>('table');
  let picked = $state<Picked | null>(null);
  const detail = $derived(pickedEntry(snapshot, picked));
</script>

<div class="screen">
  <header class="enemy">
    <div class="who"><span class="tag them">TARGET</span> {f.enemyName}</div>
    <Gauges side={f.them} isPlayer={false} compact />
  </header>

  <nav class="tabs">
    {#each ['table', 'loadouts', 'log'] as t (t)}
      <button class:active={tab === t} onclick={() => (tab = t as typeof tab)}>{t}</button>
    {/each}
  </nav>

  <aside class="left">
    <div class="caption">THEIR LOADOUT</div>
    <Loadout entries={f.them.loadout} vertical onpick={(i) => (picked = { side: 1, index: i })} />
    <div class="caption">YOUR LOADOUT · {f.className}</div>
    <Loadout entries={f.you.loadout} vertical onpick={(i) => (picked = { side: 0, index: i })} />
  </aside>

  <main class="middle">
    <div class="pane table-pane" class:shown={tab === 'table'}>
      <Loadout entries={f.them.loadout} dense onpick={(i) => (picked = { side: 1, index: i })} />
      <Table sequence={f.sequence} count={f.count} starter={f.starter} playerIsDealer={f.playerIsDealer} opponentCardsLeft={f.opponentCardsLeft} />
      <Loadout entries={f.you.loadout} dense onpick={(i) => (picked = { side: 0, index: i })} />
    </div>
    <div class="pane loadouts-pane" class:shown={tab === 'loadouts'}>
      <div class="caption">THEIR LOADOUT (fires top → bottom)</div>
      <Loadout entries={f.them.loadout} vertical onpick={(i) => (picked = { side: 1, index: i })} />
      <div class="caption">YOUR LOADOUT · {f.className}</div>
      <Loadout entries={f.you.loadout} vertical onpick={(i) => (picked = { side: 0, index: i })} />
    </div>
    <div class="pane log-pane" class:shown={tab === 'log'}>
      <Log view={f.view} onpick={(s, id) => (picked = pickFromLog(snapshot, s, id))} />
    </div>
  </main>

  <aside class="right">
    <Log view={f.view} onpick={(s, id) => (picked = pickFromLog(snapshot, s, id))} />
  </aside>

  <footer class="you">
    <Gauges side={f.you} isPlayer compact />
    <Hand hand={f.hand} legal={f.legal} count={f.count} sequence={f.sequence} />
  </footer>
</div>

{#if detail}<DetailSheet entry={detail.entry} lastFire={detail.lastFire} enemy={picked?.side === 1} onclose={() => (picked = null)} />{/if}

<style>
  .screen {
    height: 100%;
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    grid-template-areas: 'enemy' 'tabs' 'middle' 'you';
    gap: var(--gutter);
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
  }
  .enemy {
    grid-area: enemy;
  }
  .tabs {
    grid-area: tabs;
    display: flex;
    gap: 4px;
  }
  .tabs button {
    flex: 1;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }
  .tabs .active {
    color: var(--accent);
    border-color: var(--accent);
  }
  .middle {
    grid-area: middle;
    overflow: auto;
    min-height: 0;
  }
  .pane {
    display: none;
    flex-direction: column;
    gap: 8px;
  }
  .pane.shown {
    display: flex;
  }
  .you {
    grid-area: you;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .left,
  .right {
    display: none;
  }
  .who {
    font-size: 13px;
    margin-bottom: 4px;
  }
  .tag {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid currentColor;
    margin-right: 4px;
  }
  .them {
    color: var(--danger);
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 6px;
  }

  @media (min-width: 900px) {
    .screen {
      grid-template-columns: 240px 1fr 320px;
      grid-template-rows: auto 1fr auto;
      grid-template-areas: 'left enemy right' 'left middle right' 'left you right';
      max-width: 1280px;
      margin: 0 auto;
    }
    .tabs {
      display: none;
    }
    .left,
    .right {
      display: flex;
      flex-direction: column;
      gap: 4px;
      overflow: auto;
    }
    .left {
      grid-area: left;
    }
    .right {
      grid-area: right;
      border-left: 1px solid var(--line);
      padding-left: var(--gutter);
    }
    .pane {
      display: none !important;
    }
    .table-pane {
      display: flex !important;
    }
  }
</style>
