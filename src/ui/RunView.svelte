<script lang="ts">
  import { untrack } from 'svelte';
  import { sound } from './sound';
  import type { LiveRun } from './live-run.svelte';
  import RunMap from './RunMap.svelte';
  import RunEnd from './RunEnd.svelte';
  import EvasionIntro from './EvasionIntro.svelte';
  import CribbageScreen from './CribbageScreen.svelte';
  import LiveFightView from './LiveFightView.svelte';
  import RewardScreen from './RewardScreen.svelte';
  import DropScreen from './DropScreen.svelte';
  import BurnerSwapScreen from './BurnerSwapScreen.svelte';
  import SafehouseScreen from './SafehouseScreen.svelte';
  import ShopScreen from './ShopScreen.svelte';
  import ShopBurnerScreen from './ShopBurnerScreen.svelte';
  import EventScreen from './EventScreen.svelte';
  import NoticeScreen from './NoticeScreen.svelte';
  import { tips } from './tips.svelte';
  import { guide } from './guide.svelte';

  // A run in progress (milestone 3 checkpoints 2-3): the map, a fight, a
  // reward, a full bench, or the end, whichever the run is paused on. A
  // banner marks each new layer.
  let { run, onagain, onretry, onmenu }: { run: LiveRun; onagain: () => void; onretry?: () => void; onmenu?: () => void } = $props();

  // First-time tips (T6): an Event, a Cache.
  $effect(() => {
    const pause = run.pause;
    if (pause?.kind === 'event') tips.offer('event');
    if (pause?.kind === 'notice' && pause.request.kind === 'cacheOpened') tips.offer('cache');
  });
  // Sound (go-live step 4): a Cache opening.
  $effect(() => {
    const pause = run.pause;
    if (pause?.kind === 'notice' && pause.request.kind === 'cacheOpened') untrack(() => sound.play('cache'));
  });

  // The tutorial coach (session 63): on for the guided run, which also
  // holds the first-time tips back (the coach covers them), and the
  // moments it explains away from fights.
  $effect(() => {
    if (!run.tutorial) return;
    guide.start();
    tips.suspended = true;
    return () => {
      guide.stop();
      tips.suspended = false;
    };
  });
  $effect(() => {
    if (!run.tutorial) return;
    const pause = run.pause;
    // The coach's cards belong to their screen: leaving one drops its
    // leftovers rather than carrying them into the next.
    const kind = pause?.kind;
    guide.enter(kind === 'move' ? 'map' : kind === 'fight' ? 'fight' : kind === 'reward' ? 'reward' : kind === 'shop' ? 'shop' : kind === 'safehouse' ? 'safehouse' : null);
    if (pause?.kind === 'move') {
      guide.offer('map');
      guide.offer('class');
      const player = pause.request.playerState;
      // A reward subroutine has joined the loadout: order matters now.
      if (player.installedLoadout.length > 3) guide.offer('order');
      const here = pause.request.position.nodeId;
      const graph = pause.request.graph;
      const nextToGatekeeper = graph.edges.some((e) => (e.a === here && e.b === graph.gatekeeperNodeId) || (e.b === here && e.a === graph.gatekeeperNodeId));
      if (nextToGatekeeper) guide.offer('gatekeeperNear');
    }
    if (pause?.kind === 'fight' && run.fight) {
      guide.offer('fight');
      guide.offer('cribbageCoach');
      if (run.fight.tier === 'gatekeeper') guide.offer('gatekeeper');
      else if (pause.kind === 'fight' && run.fights >= 2 && player0Burners(run)) guide.offer('burner');
    }
    if (pause?.kind === 'reward' && pause.request.reward !== 'burner') {
      guide.offer('won');
      guide.offer('reward');
    }
    if (pause?.kind === 'shop') guide.offer('shop');
    if (pause?.kind === 'safehouse') guide.offer('safehouse');
  });
  /** Whether the player carries a combat Burner into this fight. */
  const player0Burners = (r: LiveRun) => Boolean(r.fight?.frame?.request.view.combatState.carriedBurnerIds.length);

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
    onmove={(id) => (sound.play('move'), run.answer(id))}
    onarrange={(installed, bench) => run.answer({ arrange: { installed, bench } })}
    onburner={(burnerId, targetNodeId) => run.answer({ useBurner: { burnerId, targetNodeId } })}
    tutorial={run.tutorial}
    daily={run.daily}
    {onmenu}
  />
{:else if run.pause?.kind === 'reward'}
  <RewardScreen request={run.pause.request} gained={run.pause.gained} onpick={(choice) => (choice !== null && sound.play('reward'), run.answer(choice))} />
{:else if run.pause?.kind === 'drop'}
  <DropScreen request={run.pause.request} ondrop={(id) => run.answer(id)} />
{:else if run.pause?.kind === 'burnerSwap'}
  <BurnerSwapScreen request={run.pause.request} onswap={(out) => run.answer(out)} />
{:else if run.pause?.kind === 'safehouse'}
  <SafehouseScreen request={run.pause.request} onchoose={(action, target) => run.chooseSafehouse(action, target)} />
{:else if run.pause?.kind === 'shopBurner'}
  <ShopBurnerScreen request={run.pause.request} onpick={(id) => run.answer(id)} />
{:else if run.pause?.kind === 'shop'}
  <ShopScreen request={run.pause.request} onact={(action) => run.answer(action)} />
{:else if run.pause?.kind === 'event'}
  <EventScreen request={run.pause.request} onchoose={(choice) => run.answer(choice)} />
{:else if run.pause?.kind === 'notice'}
  <NoticeScreen request={run.pause.request} layer={run.pause.layer} oncontinue={() => run.answer(null)} />
{:else if run.pause?.kind === 'fight' && run.fight}
  {#key run.fights}
    <LiveFightView fight={run.fight} actions={[{ label: 'continue ▸', onclick: () => run.answer(null) }]} />
  {/key}
{:else if run.pause?.kind === 'evasionStart'}
  <EvasionIntro request={run.pause.request} onbegin={() => run.answer(null)} />
{:else if run.pause?.kind === 'evasion' && run.evasion}
  {#key run.evasion}
    <CribbageScreen game={run.evasion} onagain={() => run.answer(null)} />
  {/key}
{:else if run.pause?.kind === 'over'}
  <RunEnd result={run.pause.result} className={run.className} {onagain} {onretry} {onmenu} seed={run.seed} tutorial={run.tutorial} skill={run.skill} runId={run.id} securityLevel={run.setup.securityLevel ?? 0} />
{/if}

{#if banner}
  {#key banner.key}
    <div class="layer-banner">
      <b>LAYER {banner.layer}</b>
      <span>{banner.layer === 1 ? 'perimeter · find the gatekeeper' : `layer ${banner.layer - 1} breached · going deeper`}</span>
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
