<script lang="ts">
  import type { LiveRun } from './live-run.svelte';
  import RunMap from './RunMap.svelte';
  import RunEnd from './RunEnd.svelte';
  import LiveFightView from './LiveFightView.svelte';
  import RewardScreen from './RewardScreen.svelte';
  import DropScreen from './DropScreen.svelte';
  import BurnerSwapScreen from './BurnerSwapScreen.svelte';

  // A run in progress (milestone 3 checkpoints 2-3): the map, a fight, a
  // reward, a full bench, or the end, whichever the run is paused on. A
  // banner marks each new layer.
  let { run, onagain }: { run: LiveRun; onagain: () => void } = $props();

  let lastLayer = -1;
  let banner = $state<{ layer: number; key: number } | null>(null);
  $effect(() => {
    const pause = run.pause;
    if (pause?.kind !== 'move') return;
    const layer = pause.request.position.layerIndex;
    if (layer !== lastLayer) {
      lastLayer = layer;
      banner = { layer: layer + 1, key: Date.now() };
      setTimeout(() => (banner = null), 1600);
    }
  });
</script>

{#if run.pause?.kind === 'move'}
  <RunMap
    request={run.pause.request}
    className={run.className}
    notes={run.notes}
    onmove={(id) => run.answer(id)}
    onarrange={(installed, bench) => run.answer({ arrange: { installed, bench } })}
  />
{:else if run.pause?.kind === 'reward'}
  <RewardScreen request={run.pause.request} gained={run.pause.gained} onpick={(choice) => run.answer(choice)} />
{:else if run.pause?.kind === 'drop'}
  <DropScreen request={run.pause.request} ondrop={(id) => run.answer(id)} />
{:else if run.pause?.kind === 'burnerSwap'}
  <BurnerSwapScreen request={run.pause.request} onswap={(out) => run.answer(out)} />
{:else if run.pause?.kind === 'fight' && run.fight}
  {#key run.fights}
    <LiveFightView fight={run.fight} actions={[{ label: 'continue ▸', onclick: () => run.answer(null) }]} />
  {/key}
{:else if run.pause?.kind === 'over'}
  <RunEnd result={run.pause.result} className={run.className} {onagain} />
{/if}

{#if banner}
  {#key banner.key}
    <div class="layer-banner">
      <b>LAYER {banner.layer}</b>
      <span>{banner.layer === 1 ? 'perimeter · find the gatekeeper ⛨︎' : `layer ${banner.layer - 1} breached · going deeper`}</span>
    </div>
  {/key}
{/if}

<style>
  .layer-banner {
    position: fixed;
    left: 50%;
    top: 38%;
    transform: translate(-50%, -50%);
    z-index: 30;
    padding: 14px 22px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: rgb(7 10 14 / 92%);
    color: var(--accent);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    pointer-events: none;
    animation: layer-banner 1.6s ease-out forwards;
  }
  .layer-banner b {
    font-size: 22px;
    letter-spacing: 0.14em;
  }
  .layer-banner span {
    font-size: 11px;
    color: var(--text-dim);
  }
  @keyframes layer-banner {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.9);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
</style>
