<script lang="ts">
  import type { FightSnapshot } from './snapshot';
  import { fightParts, pickedEntry, pickFromLog, type Picked } from './fight';
  import Gauges from './Gauges.svelte';
  import Loadout from './Loadout.svelte';
  import Table from './Table.svelte';
  import Hand from './Hand.svelte';
  import Log from './Log.svelte';
  import DetailSheet from './DetailSheet.svelte';
  import { describeFire } from './describe';

  // The chosen fight-screen layout (the user's picks from the P3 mockups):
  // COMPACT on phones -- everything on one screen, a three-line log
  // ticker that slides the full log in from the left, and a loadouts
  // button (top right) that slides the full loadouts in from the right
  // -- and DRAWERS on desktop:
  // full loadouts in a left panel, the log in a right panel, both on a
  // darker background, the table and hand in the centre.
  let { snapshot }: { snapshot: FightSnapshot } = $props();
  const f = $derived(fightParts(snapshot));
  let picked = $state<Picked | null>(null);
  let sheet = $state<'none' | 'log' | 'loadouts'>('none');
  const detail = $derived(pickedEntry(snapshot, picked));
  const names = $derived(new Map(f.view.combatState.sides.flatMap((s) => s.loadout.map((e) => [e.definition.id, e.definition.name] as const))));
  const ticker = $derived(f.view.log.slice(-3));

  function pickLog(side: 0 | 1, id: string) {
    picked = pickFromLog(snapshot, side, id);
    sheet = 'none';
  }
</script>

<div class="screen">
  <aside class="panel loadouts-panel" class:open={sheet === 'loadouts'}>
    <button class="close" onclick={() => (sheet = 'none')} aria-label="close loadouts">✕</button>
    <div class="caption">THEIR LOADOUT · fires top → bottom</div>
    <Loadout entries={f.them.loadout} vertical onpick={(i) => (picked = { side: 1, index: i })} />
    <div class="caption">YOUR LOADOUT · {f.className}</div>
    <Loadout entries={f.you.loadout} vertical onpick={(i) => (picked = { side: 0, index: i })} />
  </aside>

  <main class="main">
    <div class="band enemy">
      <div class="who">
        <span class="tag">TARGET</span> {f.enemyName}
        <button class="loadouts-button" onclick={() => (sheet = 'loadouts')}>◀ loadouts</button>
      </div>
      <Gauges side={f.them} isPlayer={false} compact />
      <Loadout entries={f.them.loadout} dense onpick={(i) => (picked = { side: 1, index: i })} />
    </div>

    <Table sequence={f.sequence} count={f.count} starter={f.starter} playerIsDealer={f.playerIsDealer} opponentCardsLeft={f.opponentCardsLeft} />

    <button class="ticker" onclick={() => (sheet = 'log')}>
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
  </main>

  <aside class="panel log-panel" class:open={sheet === 'log'}>
    <button class="close" onclick={() => (sheet = 'none')} aria-label="close log">✕</button>
    <Log view={f.view} onpick={pickLog} />
  </aside>
</div>

{#if sheet !== 'none'}<div class="scrim" onclick={() => (sheet = 'none')} role="presentation"></div>{/if}
{#if detail}<DetailSheet entry={detail.entry} lastFire={detail.lastFire} enemy={picked?.side === 1} onclose={() => (picked = null)} />{/if}

<style>
  .screen {
    height: 100%;
    display: flex;
    justify-content: center;
  }
  .main {
    flex: 1;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    justify-content: space-between;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
  }
  .band {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }
  .tag {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid var(--danger);
    color: var(--danger);
  }
  .loadouts-button {
    margin-left: auto;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-raised);
    font-size: 11px;
    color: var(--text-dim);
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

  /* Phone: both panels are off-canvas drawers (log left, loadouts right). */
  .panel {
    position: fixed;
    z-index: 16;
    background: var(--bg-sunken);
    border: 1px solid var(--line);
    padding: 12px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: transform 0.18s ease;
  }
  .loadouts-panel {
    top: 0;
    right: 0;
    bottom: 0;
    width: 80%;
    transform: translateX(105%);
    padding-top: calc(12px + env(safe-area-inset-top));
  }
  .log-panel {
    top: 0;
    left: 0;
    bottom: 0;
    width: 85%;
    transform: translateX(-105%);
    padding-top: calc(12px + env(safe-area-inset-top));
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }
  .panel.open {
    transform: none;
  }
  .close {
    align-self: flex-end;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 15px;
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 6px;
  }
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    z-index: 15;
  }

  /* Desktop: the drawers layout -- both panels always open, darker. */
  @media (min-width: 900px) {
    .panel {
      position: static;
      transform: none;
      width: 280px;
      flex: none;
      border-radius: 0;
      border-top: none;
      border-bottom: none;
      max-height: none;
    }
    .log-panel {
      width: 340px;
    }
    .close,
    .loadouts-button,
    .ticker,
    .scrim {
      display: none;
    }
    .main {
      max-width: 720px;
    }
  }
</style>
