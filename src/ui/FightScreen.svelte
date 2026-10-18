<script lang="ts">
  import { stickToBottom } from './stick-to-bottom';
  import RichText from './RichText.svelte';
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
  import { burnerLabel, scoreLabel, stepLine, stepMods, tableAt, type Step } from './timeline';
  import { burnersOf, modKey, modName, modsOf, type KitItem } from './kit';
  import KitList from './KitList.svelte';
  import ShowPanel from './ShowPanel.svelte';
  import type { BurnerId } from '../engine/burner-types';

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
    onburner,
  }: {
    snapshot: FightSnapshot;
    onplay?: (card: Card) => void;
    ondiscard?: (cards: [Card, Card]) => void;
    replay?: Replay;
    onburner?: (id: BurnerId | null) => void;
  } = $props();
  const f = $derived(fightParts(snapshot));
  let picked = $state<Picked | null>(null);
  let sheet = $state<'none' | 'log' | 'loadouts'>('none');
  const detail = $derived(pickedEntry(snapshot, picked));
  // Live, the table, the log and the gauges follow the replay's position
  // in the fight's steps; for the mockups, the paused frame as it is.
  const steps = $derived<readonly Step[]>(replay ? replay.steps.slice(0, replay.shown) : f.view.log.map((fire) => ({ type: 'fire', fire })));
  let pickedKit = $state<KitItem | null>(null);
  // Mods (both sides) and the player's Burners, spent ones marked from
  // the Burner beats played so far.
  const theirMods = $derived(modsOf(f.view.combatState, 1));
  const yourMods = $derived(modsOf(f.view.combatState, 0));
  const yourBurners = $derived(
    burnersOf(
      f.view.combatState.carriedBurnerIds,
      steps.flatMap((s) => (s.type === 'beat' && s.beat.kind === 'burner' && s.beat.side === 0 ? [s.beat.burnerId] : [])),
    ),
  );
  const burnersLeft = $derived(yourBurners.filter((b) => !b.spent).length);
  // The Mods acting at the replay's current step flash (the user's ask).
  const flashing = $derived(new Set(stepMods(replay?.current ?? null).map((t) => modKey(t.side, t.mod))));
  const flashSide = (side: 0 | 1) => stepMods(replay?.current ?? null).some((t) => t.side === side);
  const names = $derived(new Map(f.view.combatState.sides.flatMap((s) => s.loadout.map((e) => [e.definition.id, e.definition.name] as const))));
  const table = $derived(replay ? tableAt(replay.steps, replay.shown) : null);
  const ticker = $derived(
    steps
      .map((s) => stepLine(s, names))
      .filter((l) => l !== null)
      .slice(-3),
  );
  const callout = $derived.by(() => {
    const step = replay?.current;
    if (step?.type !== 'beat') return null;
    const b = step.beat;
    // Show scores are announced in the show panel instead.
    if (b.kind === 'points' && b.phase !== 'show') return { text: scoreLabel(b.occurrence, b.phase), side: b.occurrence.player, key: replay!.shown };
    return null;
  });
  // Mod and Burner callouts float over whichever panel is up (the table
  // or the show), since either can act during the show's turns.
  // Toasts in the open gap above the table / show panel (the user's
  // asks): a show score, like pegging's callout but clear of the panel's
  // cards and count; and a turn starting, either side, in either phase
  // (pegging's own score callout sits over the pile, so they never meet).
  const gapToast = $derived.by(() => {
    const step = replay?.current;
    if (step?.type !== 'beat') return null;
    const b = step.beat;
    if (b.kind === 'points' && b.phase === 'show') {
      return { text: `${b.occurrence.player === 0 ? '+' : '−'} ${scoreLabel(b.occurrence, 'show')}`, side: b.occurrence.player, key: replay!.shown, turn: false };
    }
    if (b.kind === 'turn') return { text: `▶ ${b.side === 0 ? 'YOUR' : 'THEIR'} TURN`, side: b.side, key: replay!.shown, turn: true };
    return null;
  });
  const slotCallout = $derived.by(() => {
    const step = replay?.current;
    if (step?.type !== 'beat') return null;
    const b = step.beat;
    if (b.kind === 'burner') return { text: `⏏︎ ${burnerLabel(b.burnerId)}`, side: b.side, key: replay!.shown, tone: 'burner' };
    if (b.kind === 'mod') return { text: `◆ ${b.side === 0 ? 'your' : 'their'} ${modName(b.mod)}`, side: b.side, key: replay!.shown, tone: 'mod' };
    return null;
  });
  // A new hand: a banner over the table while its beat is up.
  const banner = $derived.by(() => {
    const step = replay?.current;
    if (step?.type !== 'beat' || step.beat.kind !== 'hand') return null;
    return { title: `HAND ${step.beat.handIndex + 1}`, sub: step.beat.dealer === 0 ? 'you deal · your crib' : 'they deal · their crib', key: replay!.shown };
  });
  const handReady = $derived(!table || table.handIndex === f.view.handIndex);
  const firingSlot = (side: 0 | 1) => {
    const fire = replay?.firing;
    if (!fire || fire.side !== side) return -1;
    return f.view.combatState.sides[side].loadout.findIndex((e) => e.definition.id === fire.subroutineId);
  };

  // Desktop keys (P5): Space / Enter / Esc skip a turn that's playing
  // out; Esc closes the detail panel or a drawer; at the Burner prompt,
  // 1-n burn that Burner and Esc keeps them. The hand takes 1-6 / Enter.
  function onkey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (replay?.playing && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      replay.skip();
      return;
    }
    if (e.key === 'Escape' && (picked || pickedKit)) {
      picked = null;
      pickedKit = null;
      return;
    }
    if (e.key === 'Escape' && sheet !== 'none') {
      sheet = 'none';
      return;
    }
    if (handReady && f.phase === 'burner' && onburner) {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= burnerChoices.length) onburner(burnerChoices[n - 1].id);
      else if (e.key === 'Escape') onburner(null);
    }
  }

  // The Burner prompt's choices: each kind once, with how many you carry
  // (Burners stack, so the same id can be offered twice).
  const burnerChoices = $derived(
    [...new Set(f.burners)].map((id) => ({ id, count: f.burners.filter((b) => b === id).length })),
  );

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
    <Loadout entries={f.them.loadout} vertical enemy firing={firingSlot(1)} onpick={(i) => (picked = { side: 1, index: i })} />
    {#if theirMods.length}
      <div class="caption sub">THEIR MODS</div>
      <KitList items={theirMods} {flashing} onpick={(k) => (pickedKit = k)} />
    {/if}
    <div class="caption">YOUR LOADOUT · {f.className}</div>
    <Loadout entries={f.you.loadout} vertical firing={firingSlot(0)} onpick={(i) => (picked = { side: 0, index: i })} />
    {#if yourMods.length}
      <div class="caption sub">YOUR MODS</div>
      <KitList items={yourMods} {flashing} onpick={(k) => (pickedKit = k)} />
    {/if}
    {#if yourBurners.length}
      <div class="caption sub">YOUR BURNERS</div>
      <KitList items={yourBurners} onpick={(k) => (pickedKit = k)} />
    {/if}
  </aside>

  <main class="main">
    <div class="band enemy">
      <div class="who">
        <span class="tag">TARGET</span> <span class="enemy-name">{f.enemyName}</span>
        {#if replay}<button class="speed" onclick={() => replay.cycleSpeed()} title="turn speed">» {replay.speed}</button>{/if}
        <button class="loadouts-button" onclick={() => (sheet = 'loadouts')}>◀ loadouts</button>
      </div>
      <Loadout entries={f.them.loadout} dense enemy firing={firingSlot(1)} onpick={(i) => (picked = { side: 1, index: i })} />
      <Gauges side={f.them} reading={replay?.gauges?.[1]} isPlayer={false} compact mods={theirMods.length} modNames={theirMods.map((m) => m.name)} flashMods={flashSide(1)} onkit={() => (sheet = 'loadouts')} />
    </div>

    <div class="table-slot">
      {#if table?.show}
        <ShowPanel show={table.show} />
      {:else if table}
        <Table sequence={[]} pile={table.pile} leaving={table.leaving} count={table.count} starter={table.starter} playerIsDealer={table.dealer === 0} opponentCardsLeft={table.cardsLeft[1]} {callout} />
      {:else}
        <Table sequence={f.sequence} count={f.count} starter={f.starter} playerIsDealer={f.playerIsDealer} opponentCardsLeft={f.opponentCardsLeft} />
      {/if}
      {#if gapToast}
        {#key gapToast.key}
          <div class="gap-toast" class:them={gapToast.side === 1} class:turn={gapToast.turn}>{gapToast.text}</div>
        {/key}
      {/if}
      {#if slotCallout}
        {#key slotCallout.key}
          <div class="slot-callout {slotCallout.tone}">{slotCallout.text}</div>
        {/key}
      {/if}
      {#if banner}
        {#key banner.key}
          <div class="banner"><b>{banner.title}</b><span>{banner.sub}</span></div>
        {/key}
      {/if}
    </div>

    <button class="ticker" onclick={() => (sheet = 'log')}>
      {#each ticker as line, i (i)}
        <div class:them={line.side === 1} class:quiet={line.kind === 'table'}>{line.side === null ? '' : line.side === 0 ? '$ ' : '> '}<RichText text={line.text} /></div>
      {/each}
      <div class="more">tap for full log</div>
    </button>

    <div class="band you">
      <Loadout entries={f.you.loadout} dense firing={firingSlot(0)} onpick={(i) => (picked = { side: 0, index: i })} />
      <Gauges
        side={f.you}
        reading={replay?.gauges?.[0]}
        isPlayer
        compact
        mods={yourMods.length}
        modNames={yourMods.map((m) => m.name)}
        burners={burnersLeft}
        burnerNames={yourBurners.filter((b) => !b.spent).map((b) => b.name)}
        flashMods={flashSide(0)}
        onkit={() => (sheet = 'loadouts')}
      />
    </div>
    <!-- A steady slot for the prompt / hand / wait, so the screen above
         doesn't shift as it changes or as the hand empties (the user's
         catch, milestone 4). -->
    <div class="hand-slot">
    {#if handReady && f.phase === 'burner'}
      <div class="burner-prompt">
        <div class="ask">Your turn is about to fire. Burn one?</div>
        <div class="choices">
          {#each burnerChoices as choice, i (choice.id)}
            <button class="burn" onclick={() => onburner?.(choice.id)}
              ><span class="burn-key">{i + 1}</span>{burnerLabel(choice.id)}{choice.count > 1 ? ` ×${choice.count}` : ''}</button
            >
          {/each}
          <button class="keep" onclick={() => onburner?.(null)}>not now<span class="burn-key after">esc</span></button>
        </div>
      </div>
    {:else if handReady}
      <Hand hand={f.hand} legal={f.legal} count={f.count} sequence={f.sequence} phase={f.phase === 'discard' ? 'discard' : 'play'} playerIsDealer={f.playerIsDealer} {onplay} {ondiscard} inactive={replay?.playing ?? false} />
    {:else}
      <div class="hand-wait">…</div>
    {/if}
    </div>
  </main>

  <aside class="panel log-panel" class:open={sheet === 'log'} use:stickToBottom>
    <button class="close" onclick={() => (sheet = 'none')} aria-label="close log">✕</button>
    <Log view={f.view} {steps} onpick={pickLog} />
  </aside>
</div>

<svelte:window onkeydown={onkey} />

{#if replay?.playing}
  <button class="skip" onclick={() => replay.skip()} aria-label="skip to the end of the turn"><span>tap to skip ▸▸</span></button>
{/if}
{#if sheet !== 'none'}<div class="scrim" onclick={() => (sheet = 'none')} role="presentation"></div>{/if}
{#if detail}<DetailSheet entry={detail.entry} lastFire={detail.lastFire} enemy={picked?.side === 1} onclose={() => (picked = null)} />{/if}
{#if pickedKit}<DetailSheet kit={pickedKit} onclose={() => (pickedKit = null)} />{/if}

<style>
  .screen {
    height: 100%;
    display: flex;
    justify-content: center;
  }
  .main {
    flex: 1;
    /* Let long single-line content (the ticker) clip instead of widening
       the column past the screen. */
    min-width: 0;
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
  .enemy-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .speed,
  .loadouts-button {
    white-space: nowrap;
    flex: none;
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
    min-width: 0;
    width: 100%;
  }
  .ticker .them {
    color: var(--danger);
  }
  .ticker .quiet {
    color: var(--text-dim);
  }
  .table-slot {
    position: relative;
    height: 104px;
  }
  .table-slot > :global(*:not(.banner):not(.slot-callout):not(.gap-toast)) {
    height: 100%;
    box-sizing: border-box;
  }
  .gap-toast {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 9px);
    transform: translateX(-50%);
    z-index: 2;
    white-space: nowrap;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
    pointer-events: none;
    animation: gap-toast 0.9s ease-out forwards;
  }
  .gap-toast.them {
    border-color: var(--danger);
    color: var(--danger);
  }
  .gap-toast.turn {
    letter-spacing: 0.1em;
    background: var(--accent);
    color: var(--bg);
  }
  .gap-toast.turn.them {
    background: var(--danger);
    color: var(--bg);
  }
  @keyframes gap-toast {
    0% {
      opacity: 0;
      transform: translate(-50%, 8px) scale(0.85);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, 0) scale(1.04);
    }
    70% {
      opacity: 1;
      transform: translate(-50%, -2px) scale(1);
    }
    /* A short drift: on a 320px phone the gap above the panel is ~32px. */
    100% {
      opacity: 0;
      transform: translate(-50%, -4px);
    }
  }
  .slot-callout {
    position: absolute;
    left: 50%;
    top: 8px;
    transform: translateX(-50%);
    z-index: 2;
    max-width: 92%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid var(--mod);
    color: var(--mod);
    font-weight: 700;
    font-size: 12px;
    pointer-events: none;
    animation: slot-callout 0.9s ease-out forwards;
  }
  .slot-callout.burner {
    border-color: var(--warn);
    color: var(--warn);
  }
  @keyframes slot-callout {
    0% {
      opacity: 0;
      transform: translate(-50%, 8px) scale(0.85);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, 0) scale(1.05);
    }
    75% {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -8px);
    }
  }
  .banner {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: rgb(7 10 14 / 88%);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    color: var(--accent);
    animation: banner 1.1s ease-out forwards;
    pointer-events: none;
  }
  .banner b {
    font-size: 20px;
    letter-spacing: 0.12em;
  }
  .banner span {
    font-size: 11px;
    color: var(--text-dim);
  }
  @keyframes banner {
    0% {
      opacity: 0;
      transform: scaleY(0.2);
    }
    15% {
      opacity: 1;
      transform: none;
    }
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  .burner-prompt {
    min-height: 120px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    font-size: 12px;
  }
  .ask {
    color: var(--warn);
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .burn,
  .keep {
    padding: 8px 10px;
    border-radius: var(--radius);
    border: 1px solid var(--warn);
    background: transparent;
    color: var(--warn);
    font-size: 12px;
  }
  .keep {
    border-color: var(--line);
    color: var(--text-dim);
  }
  /* Key hints at the Burner prompt, only with a keyboard and a mouse. */
  .burn-key {
    display: none;
    margin-right: 6px;
    opacity: 0.6;
    font-size: 10px;
  }
  .burn-key.after {
    margin: 0 0 0 6px;
  }
  @media (hover: hover) and (pointer: fine) {
    .burn-key {
      display: inline;
    }
  }
  .hand-slot {
    min-height: 124px;
    flex: none;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .hand-wait {
    flex: 1;
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
  .caption.sub {
    margin-top: 2px;
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
