<script lang="ts">
  import type { RunRequest } from '../engine/run-requests';
  import { HEAT_PER_MOVE } from '../engine/heat';
  import { applyOnMoveMods } from '../engine/mods';
  import { MOD_DEFINITIONS } from '../engine/mods';
  import { BURNER_DEFINITIONS } from '../engine/burners';
  import MapView from './MapView.svelte';
  import LoadoutEditor from './LoadoutEditor.svelte';
  import { modText } from './kit';
  import { burnerText } from './reward-text';
  import { NODE_KIND } from './map-kinds';

  // The map screen (milestone 3 checkpoint 2): one layer, where you are,
  // and the run's state. Tap a linked node to see what it is and what the
  // move costs; tap it again, or Move, to go (the same tap-then-confirm as
  // cards, so a stray tap never spends Heat). The loadout drawer edits the
  // loadout and bench (checkpoint 3), and lists Mods and Burners.
  let {
    request,
    className,
    notes,
    onmove,
    onarrange,
  }: {
    request: Extract<RunRequest, { kind: 'move' }>;
    className: string;
    notes: string[];
    onmove: (id: string) => void;
    onarrange: (installed: string[], bench: string[]) => void;
  } = $props();

  const graph = $derived(request.graph);
  const here = $derived(request.position.nodeId);
  const player = $derived(request.playerState);
  const layer = $derived(request.position.layerIndex + 1);
  const allowance = $derived(player.heatAllowance ?? 1);
  const heatPct = $derived(Math.min(100, (request.heat / allowance) * 100));
  const moveCost = $derived(applyOnMoveMods(player.ownedModIds, HEAT_PER_MOVE));
  const linked = $derived(
    new Set(
      graph.edges
        .flatMap((e) => (e.a === here ? [e.b] : e.b === here ? [e.a] : []))
        .filter((id) => graph.nodes.find((n) => n.id === id)?.state !== 'closed'),
    ),
  );
  let selected = $state<string | null>(null);
  // A new position (a move resolved) clears the selection.
  $effect(() => {
    void here;
    selected = null;
  });
  const node = $derived(selected ? graph.nodes.find((n) => n.id === selected) : null);
  let showLoadout = $state(false);

  function pick(id: string) {
    if (selected === id) onmove(id);
    else selected = id;
  }
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
</script>

<div class="run-map">
  <div class="top">
    <span class="layer">LAYER {layer}/4</span>
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
    <MapView {graph} {here} selectable={linked} {selected} onpick={pick} />
  </div>

  <div class="card">
    {#if node}
      {@const k = NODE_KIND[node.type]}
      <div class="what">
        <span class="glyph" style="color: {k.tone}">{k.glyph || '·'}</span>
        <b style="color: {k.tone}">{k.label}</b>
        {#if node.state === 'inert' && node.type !== 'relay'}<span class="dim">· cleared</span>{/if}
      </div>
      <div class="about">{node.state === 'inert' && node.type !== 'relay' ? 'Already resolved: passing through only costs the move.' : k.about}</div>
      <button class="move" onclick={() => onmove(node.id)}>Move here · +{fmt(moveCost)} Heat</button>
    {:else}
      <div class="hint">Tap a linked node to see what it is. Each move costs {fmt(moveCost)} Heat; the gatekeeper ⛨︎ leads to the next layer.</div>
    {/if}
  </div>

  {#if notes.length}
    <div class="notes">
      {#each notes.slice(-2) as n, i (i)}<div>· {n} <span class="dim">(auto for now)</span></div>{/each}
    </div>
  {/if}
</div>

{#if showLoadout}
  <div class="scrim" onclick={() => (showLoadout = false)} role="presentation"></div>
  <aside class="drawer">
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
{/if}

<style>
  .run-map {
    max-width: 640px;
    margin: 0 auto;
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
    min-height: 92px;
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
  }
  .hint {
    color: var(--text-dim);
    line-height: 1.4;
    margin: auto 0;
  }
  .move {
    align-self: flex-end;
    padding: 6px 14px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 12px;
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
    background: var(--bg-sunken);
    border-left: 1px solid var(--line);
    padding: 12px;
    padding-top: calc(12px + env(safe-area-inset-top));
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
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
