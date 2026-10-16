<script lang="ts">
  import type { FightSnapshot } from '../snapshot';
  import { fightParts, pickedEntry, pickFromLog, type Picked } from '../fight';
  import Gauges from '../Gauges.svelte';
  import Loadout from '../Loadout.svelte';
  import Table from '../Table.svelte';
  import Hand from '../Hand.svelte';
  import Log from '../Log.svelte';
  import DetailSheet from '../DetailSheet.svelte';
  import { describeFire } from '../describe';

  // Variant C -- COMPACT. Everything on one screen, nothing hidden: both
  // loadouts as initials, single-line meters, a three-line log ticker in
  // the middle, the hand at the bottom. Detail comes from tapping. The
  // ticker opens the full log as a sheet. Wide screens add the full log
  // as a side panel.
  let { snapshot }: { snapshot: FightSnapshot } = $props();
  const f = $derived(fightParts(snapshot));
  let picked = $state<Picked | null>(null);
  let logOpen = $state(false);
  const detail = $derived(pickedEntry(snapshot, picked));
  const names = $derived(new Map(f.view.combatState.sides.flatMap((s) => s.loadout.map((e) => [e.definition.id, e.definition.name] as const))));
  const ticker = $derived(f.view.log.slice(-3));
</script>

<div class="screen">
  <div class="main">
    <div class="band enemy">
      <div class="who"><span class="tag">TARGET</span> {f.enemyName}</div>
      <Gauges side={f.them} isPlayer={false} compact />
      <Loadout entries={f.them.loadout} dense onpick={(i) => (picked = { side: 1, index: i })} />
    </div>

    <Table sequence={f.sequence} count={f.count} starter={f.starter} playerIsDealer={f.playerIsDealer} opponentCardsLeft={f.opponentCardsLeft} />

    <button class="ticker" onclick={() => (logOpen = true)}>
      {#each ticker as e, i (i)}
        <div class:them={e.side === 1}>{e.side === 0 ? '$' : '>'} {describeFire(e, names.get(e.subroutineId) ?? e.subroutineId)}</div>
      {/each}
      <div class="more">tap for full log</div>
    </button>

    <div class="band you">
      <Loadout entries={f.you.loadout} dense onpick={(i) => (picked = { side: 0, index: i })} />
      <Gauges side={f.you} isPlayer compact />
    </div>
    <Hand hand={f.hand} legal={f.legal} count={f.count} sequence={f.sequence} />
  </div>
  <aside class="side-log"><Log view={f.view} onpick={(s, id) => (picked = pickFromLog(snapshot, s, id))} /></aside>
</div>

{#if logOpen}
  <div class="scrim" onclick={() => (logOpen = false)} role="presentation"></div>
  <div class="log-sheet"><Log view={f.view} onpick={(s, id) => (picked = pickFromLog(snapshot, s, id))} /></div>
{/if}
{#if detail}<DetailSheet entry={detail.entry} lastFire={detail.lastFire} enemy={picked?.side === 1} onclose={() => (picked = null)} />{/if}

<style>
  .screen {
    height: 100%;
    display: flex;
    gap: var(--gutter);
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    justify-content: space-between;
    padding-bottom: env(safe-area-inset-bottom);
    max-width: 640px;
    margin: 0 auto;
  }
  .band {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .who {
    font-size: 12px;
  }
  .tag {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid var(--danger);
    color: var(--danger);
    margin-right: 4px;
  }
  .ticker {
    text-align: left;
    font-size: 10.5px;
    line-height: 1.3;
    background: var(--bg-sunken);
    border: 1px dashed var(--line);
    border-radius: var(--radius);
    padding: 5px 7px;
    color: var(--accent);
  }
  .ticker .them {
    color: var(--danger);
  }
  .more {
    color: var(--text-dim);
    font-size: 9px;
    text-align: right;
  }
  .side-log {
    display: none;
  }
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    z-index: 15;
  }
  .log-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 70%;
    overflow: auto;
    background: var(--bg-raised);
    border-top: 2px solid var(--accent);
    border-radius: 12px 12px 0 0;
    padding: 12px;
    z-index: 16;
  }
  @media (min-width: 900px) {
    .side-log {
      display: block;
      width: 320px;
      overflow: auto;
      border-left: 1px solid var(--line);
      padding-left: var(--gutter);
    }
    .ticker {
      display: none;
    }
  }
</style>
