<script lang="ts">
  import type { FightSnapshot } from '../snapshot';
  import { fightParts, pickedEntry, pickFromLog, type Picked } from '../fight';
  import Gauges from '../Gauges.svelte';
  import Loadout from '../Loadout.svelte';
  import Table from '../Table.svelte';
  import Hand from '../Hand.svelte';
  import Log from '../Log.svelte';
  import DetailSheet from '../DetailSheet.svelte';

  // Variant B -- DRAWERS. One table view with everything in place: their
  // loadout as initials across the top, the table in the middle, yours
  // above your hand. The Log pulls up from the bottom; full Loadouts slide
  // in from the right. Wide screens keep both drawers open as panels.
  let { snapshot }: { snapshot: FightSnapshot } = $props();
  const f = $derived(fightParts(snapshot));
  let drawer = $state<'none' | 'log' | 'loadouts'>('none');
  let picked = $state<Picked | null>(null);
  const detail = $derived(pickedEntry(snapshot, picked));
  const lastLine = $derived(f.view.log.length ? f.view.log[f.view.log.length - 1] : null);
</script>

<div class="screen">
  <section class="enemy">
    <div class="who"><span class="tag">TARGET</span> {f.enemyName}</div>
    <Gauges side={f.them} isPlayer={false} compact />
    <Loadout entries={f.them.loadout} dense onpick={(i) => (picked = { side: 1, index: i })} />
  </section>

  <section class="middle">
    <Table sequence={f.sequence} count={f.count} starter={f.starter} playerIsDealer={f.playerIsDealer} opponentCardsLeft={f.opponentCardsLeft} />
    <div class="drawer-buttons">
      <button onclick={() => (drawer = drawer === 'log' ? 'none' : 'log')}>▲ log ({f.view.log.length})</button>
      <button onclick={() => (drawer = drawer === 'loadouts' ? 'none' : 'loadouts')}>◀ loadouts</button>
    </div>
    {#if lastLine}<div class="ticker">last fired: {lastLine.side === 0 ? 'you' : 'them'} · {f.view.combatState.sides[lastLine.side].loadout.find((e) => e.definition.id === lastLine.subroutineId)?.definition.name}</div>{/if}
  </section>

  <section class="you">
    <Loadout entries={f.you.loadout} dense onpick={(i) => (picked = { side: 0, index: i })} />
    <Gauges side={f.you} isPlayer compact />
    <Hand hand={f.hand} legal={f.legal} count={f.count} sequence={f.sequence} />
  </section>

  <div class="drawer bottom" class:open={drawer === 'log'}>
    <button class="grab" onclick={() => (drawer = 'none')} aria-label="close log">━━</button>
    <Log view={f.view} onpick={(s, id) => (picked = pickFromLog(snapshot, s, id))} />
  </div>
  <div class="drawer side-drawer" class:open={drawer === 'loadouts'}>
    <button class="grab" onclick={() => (drawer = 'none')} aria-label="close loadouts">▶ close</button>
    <div class="caption">THEIR LOADOUT (fires top → bottom)</div>
    <Loadout entries={f.them.loadout} vertical onpick={(i) => (picked = { side: 1, index: i })} />
    <div class="caption">YOUR LOADOUT · {f.className}</div>
    <Loadout entries={f.you.loadout} vertical onpick={(i) => (picked = { side: 0, index: i })} />
  </div>
</div>

{#if detail}<DetailSheet entry={detail.entry} lastFire={detail.lastFire} enemy={picked?.side === 1} onclose={() => (picked = null)} />{/if}

<style>
  .screen {
    position: relative;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: var(--gutter);
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    overflow: hidden;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .middle {
    flex: 1;
    justify-content: center;
  }
  .you {
    padding-bottom: env(safe-area-inset-bottom);
  }
  .who {
    font-size: 13px;
  }
  .tag {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid var(--danger);
    color: var(--danger);
    margin-right: 4px;
  }
  .drawer-buttons {
    display: flex;
    gap: 6px;
  }
  .drawer-buttons button {
    flex: 1;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    font-size: 11px;
    color: var(--text-dim);
  }
  .ticker {
    font-size: 11px;
    color: var(--text-dim);
    text-align: center;
  }
  .drawer {
    position: absolute;
    background: var(--bg-raised);
    border: 1px solid var(--line);
    padding: 10px;
    overflow: auto;
    transition: transform 0.18s ease;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .bottom {
    left: 0;
    right: 0;
    bottom: 0;
    height: 60%;
    border-radius: 12px 12px 0 0;
    transform: translateY(100%);
  }
  .side-drawer {
    top: 0;
    right: 0;
    bottom: 0;
    width: 78%;
    transform: translateX(100%);
  }
  .drawer.open {
    transform: none;
  }
  .grab {
    align-self: center;
    background: none;
    border: none;
    color: var(--text-dim);
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 6px;
  }

  @media (min-width: 900px) {
    .screen {
      max-width: 1280px;
      margin: 0 auto;
      padding-right: 340px;
      padding-left: 260px;
    }
    .drawer-buttons,
    .grab {
      display: none;
    }
    .bottom {
      top: 0;
      left: auto;
      right: 0;
      width: 320px;
      height: auto;
      border-radius: 0;
      transform: none;
    }
    .side-drawer {
      left: 0;
      right: auto;
      width: 250px;
      transform: none;
    }
  }
</style>
