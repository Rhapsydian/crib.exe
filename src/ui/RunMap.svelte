<script lang="ts">
  import { tips } from './tips.svelte';
  import type { RunRequest } from '../engine/run-requests';
  import { HEAT_PER_MOVE } from '../engine/heat';
  import { applyOnMoveMods } from '../engine/mods';
  import { MOD_DEFINITIONS } from '../engine/mods';
  import { BURNER_DEFINITIONS } from '../engine/burners';
  import type { BurnerId } from '../engine/burner-types';
  import MapView from './MapView.svelte';
  import LoadoutEditor from './LoadoutEditor.svelte';
  import { modText } from './kit';
  import { burnerText } from './reward-text';
  import { NODE_KIND } from './map-kinds';

  // The map screen (milestone 3 checkpoint 2): one layer, where you are,
  // and the run's state. Tap a linked node to see what it is and what the
  // move costs; tap it again, or Move, to go (the same tap-then-confirm as
  // cards, so a stray tap never spends Heat). The loadout drawer edits the
  // loadout and bench (checkpoint 3), and lists Mods and Burners. Map
  // Burners are used here (checkpoint 4): Ghost Protocol from the card,
  // Skeleton Key by tapping a closed node.
  let {
    request,
    className,
    notes,
    onmove,
    onarrange,
    onburner,
    tutorial = false,
  }: {
    request: Extract<RunRequest, { kind: 'move' }>;
    className: string;
    notes: string[];
    onmove: (id: string) => void;
    onarrange: (installed: string[], bench: string[]) => void;
    onburner: (burnerId: BurnerId, targetNodeId?: string) => void;
    tutorial?: boolean;
  } = $props();

  const graph = $derived(request.graph);
  const here = $derived(request.position.nodeId);
  const player = $derived(request.playerState);
  const layer = $derived(request.position.layerIndex + 1);
  const allowance = $derived(player.heatAllowance ?? 1);
  const heatPct = $derived(Math.min(100, (request.heat / allowance) * 100));
  const moveCost = $derived(request.freeMove ? 0 : applyOnMoveMods(player.ownedModIds, HEAT_PER_MOVE));
  const has = (id: BurnerId) => player.carriedBurnerIds.includes(id);
  const linked = $derived(
    new Set(
      graph.edges
        .flatMap((e) => (e.a === here ? [e.b] : e.b === here ? [e.a] : []))
        .filter((id) => graph.nodes.find((n) => n.id === id)?.state !== 'closed'),
    ),
  );
  // With a Skeleton Key, closed nodes can be tapped too (to reopen them).
  const selectable = $derived(has('skeleton-key') ? new Set([...linked, ...graph.nodes.filter((n) => n.state === 'closed').map((n) => n.id)]) : linked);
  let selected = $state<string | null>(null);
  // First-time tips (T6) the map can see: an elite on the map, a
  // gatekeeper one move away, Heat past three-quarters, a ranked
  // subroutine, a handful of Mods.
  $effect(() => {
    if (graph.nodes.some((n) => n.type === 'eliteFight' && n.state === 'unresolved')) tips.offer('elite');
    if ([...linked].some((id) => graph.nodes.find((n) => n.id === id)?.type === 'gatekeeperFight')) tips.offer('quarantine');
    if (heatPct >= 75) tips.offer('heat');
    if ([...player.installedLoadout, ...player.bench].some((p) => p.rank)) tips.offer('rank');
    if (player.ownedModIds.length >= 3) tips.offer('mods');
  });
  // A new position (a move resolved) clears the selection.
  $effect(() => {
    void here;
    selected = null;
  });
  const node = $derived(selected ? graph.nodes.find((n) => n.id === selected) : null);
  let showLoadout = $state(false);

  function pick(id: string) {
    const closed = graph.nodes.find((n) => n.id === id)?.state === 'closed';
    if (selected === id && !closed) onmove(id);
    else selected = id;
  }
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
</script>

<!-- The loadout: a slide-in drawer on phones, a standing left panel on
     desktop like the fight screen's (the user's ask). -->
<div class="map-screen">
<aside class="drawer" class:open={showLoadout}>
  <button class="close" onclick={() => (showLoadout = false)} aria-label="close">✕</button>
  <LoadoutEditor {player} {onarrange} />
  {#if player.ownedModIds.length}
    <div class="caption">MODS</div>
    {#each player.ownedModIds as id (id)}
      <div class="kit"><div><span class="mod-glyph">◆</span> {MOD_DEFINITIONS[id].name}</div><div class="kit-text">{modText(id)}</div></div>
    {/each}
  {/if}
  {#if player.carriedBurnerIds.length}
    <div class="caption">BURNERS</div>
    {#each player.carriedBurnerIds as id, i (i)}
      <div class="kit"><div><span class="burner-glyph">⏏︎</span> {BURNER_DEFINITIONS[id].name}</div><div class="kit-text">{burnerText(BURNER_DEFINITIONS[id])}</div></div>
    {/each}
  {/if}
</aside>
<div class="run-map">
  <div class="top">
    <span class="layer">{tutorial ? 'TUTORIAL' : `LAYER ${layer}/4`}</span>
    <span class="cls">{className}</span>
    <button class="loadout-button" onclick={() => (showLoadout = true)}>◀ loadout</button>
  </div>
  <div class="hud">
    <div class="heat">
      <span class="label">HEAT</span>
      <div class="bar" class:hot={heatPct >= 75}><span style="width: {heatPct}%"></span></div>
      <span class="num">{fmt(request.heat)}/{fmt(allowance)}</span>
    </div>
    <span class="chip data">◫ {player.data} Data</span>
    {#if player.ownedModIds.length}<span class="chip mod">◆ {player.ownedModIds.length}</span>{/if}
    {#if player.carriedBurnerIds.length}<span class="chip burner">⏏︎ {player.carriedBurnerIds.length}</span>{/if}
  </div>

  <div class="map-area">
    <MapView {graph} {here} {selectable} {selected} onpick={pick} />
  </div>

  <div class="card">
    {#if node}
      {@const k = NODE_KIND[node.type]}
      <div class="what">
        <span class="glyph" style="color: {k.tone}">{k.glyph || '·'}</span>
        <b style="color: {k.tone}">{k.label}</b>
        {#if node.state === 'inert' && node.type !== 'relay'}<span class="dim">· cleared</span>{/if}
      </div>
      {#if node.state === 'closed'}
        <div class="about">Closed: a fight lost here shut it. Routes through it are cut.</div>
        <button class="move burner-use" onclick={() => onburner('skeleton-key', node.id)}>⏏︎ Reopen with Skeleton Key</button>
      {:else}
        <div class="about">{node.state === 'inert' && node.type !== 'relay' ? 'Already resolved: passing through only costs the move.' : k.about}</div>
        <button class="move" onclick={() => onmove(node.id)}>Move here · {moveCost ? `+${fmt(moveCost)} Heat` : 'free'}</button>
      {/if}
    {:else}
      <div class="hint">
        Tap a linked node to see what it is. {request.freeMove ? 'Your next move is free (Ghost Protocol).' : `Each move costs ${fmt(moveCost)} Heat.`} The gatekeeper ⛨︎ leads to the next layer.
        {#if has('skeleton-key') && graph.nodes.some((n) => n.state === 'closed')}Tap a closed node to reopen it with your Skeleton Key.{/if}
      </div>
      {#if has('ghost-protocol') && !request.freeMove}
        <button class="move burner-use" onclick={() => onburner('ghost-protocol')}>⏏︎ Use Ghost Protocol · next move free</button>
      {/if}
    {/if}
  </div>

  {#if notes.length}
    <div class="notes">
      {#each notes.slice(-2) as n, i (i)}<div>· {n} <span class="dim">(auto)</span></div>{/each}
    </div>
  {/if}
</div>

</div>
{#if showLoadout}<div class="scrim" onclick={() => (showLoadout = false)} role="presentation"></div>{/if}

<style>
  .map-screen {
    height: 100%;
    display: flex;
    justify-content: center;
  }
  .run-map {
    flex: 1 1 640px;
    min-width: 0;
    max-width: 640px;
    height: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
  }
  .top {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .layer {
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .cls {
    color: var(--text-dim);
  }
  .loadout-button {
    margin-left: auto;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-raised);
    font-size: 11px;
    color: var(--text-dim);
    white-space: nowrap;
  }
  .hud {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 11px;
  }
  .heat {
    flex: 1 1 180px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .label {
    color: var(--heat);
    letter-spacing: 0.05em;
  }
  .bar {
    flex: 1;
    height: 8px;
    background: var(--bg-sunken);
    border: 1px solid var(--line);
    border-radius: 3px;
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--heat);
    transition: width 0.3s ease-out;
  }
  .bar.hot span {
    background: var(--danger);
  }
  .num {
    color: var(--text-dim);
  }
  .chip {
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid var(--line);
  }
  .data {
    color: var(--accent);
  }
  .mod {
    color: var(--mod);
  }
  .burner {
    color: var(--warn);
  }
  .map-area {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .card {
    /* A fixed height (the user's ask): selecting a node fills it in
       without resizing the map above. Sized for the tallest card (a node,
       its blurb, the move button); a long blurb is clamped. */
    height: 132px;
    flex: none;
    overflow: hidden;
    box-sizing: border-box;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 12px;
  }
  .what {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }
  .glyph {
    font-size: 15px;
  }
  .about {
    color: var(--text-dim);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .hint {
    color: var(--text-dim);
    line-height: 1.4;
    margin: auto 0;
  }
  .move {
    align-self: flex-end;
    margin-top: auto;
    padding: 6px 14px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 12px;
  }
  .move.burner-use {
    border-color: var(--warn);
    color: var(--warn);
  }
  .notes {
    font-size: 10.5px;
    color: var(--text);
    line-height: 1.35;
  }
  .dim {
    color: var(--text-dim);
  }
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    z-index: 15;
  }
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(80%, 320px);
    z-index: 16;
    transform: translateX(105%);
    transition: transform 0.18s ease;
    background: var(--bg-sunken);
    border-left: 1px solid var(--line);
    padding: 12px;
    padding-top: calc(12px + env(safe-area-inset-top));
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .drawer.open {
    transform: none;
  }
  /* Desktop: the loadout stands open on the left, as in combat. */
  @media (min-width: 900px) {
    .drawer {
      position: static;
      transform: none;
      transition: none;
      width: 300px;
      flex: none;
      border-left: none;
      border-right: 1px solid var(--line);
      order: -1;
    }
    .close,
    .loadout-button,
    .scrim {
      display: none;
    }
    /* A matching empty column on the right, so the map itself sits in
       the middle of the screen (the user's ask). It gives way first
       when the window is too narrow for both. */
    .map-screen::after {
      content: '';
      flex: 0 100 300px;
      min-width: 0;
    }
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
    margin-top: 8px;
  }
  .kit {
    font-size: 12px;
    padding: 4px 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .kit-text {
    font-size: 10.5px;
    color: var(--text-dim);
    line-height: 1.35;
    margin-top: 2px;
  }
  .mod-glyph {
    color: var(--mod);
  }
  .burner-glyph {
    color: var(--warn);
  }
</style>
