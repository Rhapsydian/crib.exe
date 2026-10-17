<script lang="ts">
  import type { FightSnapshot } from './snapshot';
  import type { Card } from '../engine/cards';
  import type { Replay } from './replay.svelte';
  import { fightParts, pickedEntry, pickFromLog, type Picked } from './fight';
  import Gauges from './Gauges.svelte';
  import Loadout from './Loadout.svelte';
  import Table from './Table.svelte';
  import Hand from './Hand.svelte';
  import Log from './Log.svelte';
  import DetailSheet from './DetailSheet.svelte';
  import { scoreLabel, stepLine, tableAt, type Step } from './timeline';

  // The chosen fight-screen layout (the user's picks from the P3 mockups):
  // COMPACT on phones -- everything on one screen, a three-line log
  // ticker that slides the full log in from the left, and a loadouts
  // button (top right) that slides the full loadouts in from the right
  // -- and DRAWERS on desktop:
  // full loadouts in a left panel, the log in a right panel, both on a
  // darker background, the table and hand in the centre.
  // `onplay` / `ondiscard` answer the live engine; without them (the
  // fixed mockup moment) the hand only says what it would send.
  // `replay` steps through each turn's fires (P4): while it plays, the
  // log, gauges and lit piece follow it, and a tap anywhere skips.
  let {
    snapshot,
    onplay,
    ondiscard,
    replay,
  }: { snapshot: FightSnapshot; onplay?: (card: Card) => void; ondiscard?: (cards: [Card, Card]) => void; replay?: Replay } = $props();
  const f = $derived(fightParts(snapshot));
  let picked = $state<Picked | null>(null);
  let sheet = $state<'none' | 'log' | 'loadouts'>('none');
  const detail = $derived(pickedEntry(snapshot, picked));
  const names = $derived(new Map(f.view.combatState.sides.flatMap((s) => s.loadout.map((e) => [e.definition.id, e.definition.name] as const))));
  // Live, the table, the log and the gauges follow the replay's position
  // in the fight's steps; for the mockups, the paused frame as it is.
  const steps = $derived<readonly Step[]>(replay ? replay.steps.slice(0, replay.shown) : f.view.log.map((fire) => ({ type: 'fire', fire })));
  const table = $derived(replay ? tableAt(replay.steps, replay.shown) : null);
  const ticker = $derived(
    steps
      .map((s) => stepLine(s, names))
      .filter((l) => l !== null)
      .slice(-3),
  );
  const callout = $derived.by(() => {
    const step = replay?.current;
    if (step?.type !== 'beat' || step.beat.kind !== 'points') return null;
    return { text: scoreLabel(step.beat.occurrence, step.beat.phase), side: step.beat.occurrence.player, key: replay!.shown };
  });
  // While the replay is still on an earlier hand, the new hand stays
  // face down.
  const handReady = $derived(!table || table.handIndex === f.view.handIndex);
  const firingSlot = (side: 0 | 1) => {
    const fire = replay?.firing;
    if (!fire || fire.side !== side) return -1;
    return f.view.combatState.sides[side].loadout.findIndex((e) => e.definition.id === fire.subroutineId);
  };

  function pickLog(side: 0 | 1, id: string) {
    // The log drawer stays open underneath, so closing the detail
    // returns the player to where they were in the log.
    picked = pickFromLog(snapshot, side, id);
  }
</script>

<div class="screen">
  <aside class="panel loadouts-panel" class:open={sheet === 'loadouts'}>
    <button class="close" onclick={() => (sheet = 'none')} aria-label="close loadouts">✕</button>
    <div class="caption">THEIR LOADOUT · fires top → bottom</div>
    <Loadout entries={f.them.loadout} vertical firing={firingSlot(1)} onpick={(i) => (picked = { side: 1, index: i })} />
    <div class="caption">YOUR LOADOUT · {f.className}</div>
    <Loadout entries={f.you.loadout} vertical firing={firingSlot(0)} onpick={(i) => (picked = { side: 0, index: i })} />
  </aside>

  <main class="main">
    <div class="band enemy">
      <div class="who">
        <span class="tag">TARGET</span> {f.enemyName}
        {#if replay}<button class="speed" onclick={() => replay.cycleSpeed()} title="turn speed">» {replay.speed}</button>{/if}
        <button class="loadouts-button" onclick={() => (sheet = 'loadouts')}>◀ loadouts</button>
      </div>
      <Gauges side={f.them} reading={replay?.gauges?.[1]} isPlayer={false} compact />
      <Loadout entries={f.them.loadout} dense firing={firingSlot(1)} onpick={(i) => (picked = { side: 1, index: i })} />
    </div>

    {#if table}
      <Table sequence={[]} pile={table.pile} leaving={table.leaving} count={table.count} starter={table.starter} playerIsDealer={table.dealer === 0} opponentCardsLeft={table.cardsLeft[1]} {callout} />
    {:else}
      <Table sequence={f.sequence} count={f.count} starter={f.starter} playerIsDealer={f.playerIsDealer} opponentCardsLeft={f.opponentCardsLeft} />
    {/if}

    <button class="ticker" onclick={() => (sheet = 'log')}>
      {#each ticker as line, i (i)}
        <div class:them={line.side === 1} class:quiet={line.kind === 'table'}>{line.side === null ? '' : line.side === 0 ? '$ ' : '> '}{line.text}</div>
      {/each}
      <div class="more">tap for full log</div>
    </button>

    <div class="band you">
      <Loadout entries={f.you.loadout} dense firing={firingSlot(0)} onpick={(i) => (picked = { side: 0, index: i })} />
      <Gauges side={f.you} reading={replay?.gauges?.[0]} isPlayer compact />
    </div>
    {#if handReady}
      <Hand hand={f.hand} legal={f.legal} count={f.count} sequence={f.sequence} phase={f.phase} playerIsDealer={f.playerIsDealer} {onplay} {ondiscard} />
    {:else}
      <div class="hand-wait">…</div>
    {/if}
  </main>

  <aside class="panel log-panel" class:open={sheet === 'log'}>
    <button class="close" onclick={() => (sheet = 'none')} aria-label="close log">✕</button>
    <Log view={f.view} {steps} onpick={pickLog} />
  </aside>
</div>

{#if replay?.playing}
  <button class="skip" onclick={() => replay.skip()} aria-label="skip to the end of the turn"><span>tap to skip ▸▸</span></button>
{/if}
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
  .speed {
    margin-left: auto;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-raised);
    font-size: 11px;
    color: var(--text-dim);
  }
  .speed + .loadouts-button {
    margin-left: 0;
  }
  .skip {
    position: fixed;
    inset: 0;
    z-index: 14;
    background: transparent;
    border: none;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding-bottom: calc(150px + env(safe-area-inset-bottom));
  }
  .skip span {
    font-size: 11px;
    color: var(--text-dim);
    background: rgb(0 0 0 / 60%);
    padding: 3px 10px;
    border-radius: 999px;
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
  /* Always three single-line rows, so the table above doesn't shift as
     lines arrive or wrap; the full text is in the log drawer. */
  .ticker > div:not(.more) {
    height: 1.3em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ticker {
    min-height: calc(3 * 1.3em + 10px + 12px);
    overflow: hidden;
  }
  .ticker .them {
    color: var(--danger);
  }
  .ticker .quiet {
    color: var(--text-dim);
  }
  .hand-wait {
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
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
