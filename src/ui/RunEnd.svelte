<script lang="ts">
  import type { RunResult } from '../engine/run';
  import SuitIcon from './SuitIcon.svelte';

  // The end of a run (milestone 3 checkpoint 2): how it ended, how deep
  // you got, and what you were running.
  // The guided first run (session 63) ends on its own screen: done, or
  // try again, and then the way into a real run.
  let {
    result,
    className,
    onagain,
    onretry,
    onmenu,
    tutorial = false,
  }: { result: RunResult; className: string; onagain: () => void; onretry?: () => void; onmenu?: () => void; tutorial?: boolean } = $props();
  const TUTORIAL_ENDINGS = {
    won: { title: '>> TUTORIAL COMPLETE', line: "You breached your first layer. A real run is four layers deep, and you choose your class. You're ready.", won: true },
    lost: { title: '>> TUTORIAL OVER', line: "Not this time. Try the tutorial again, or jump into a real run.", won: false },
  };

  const ENDINGS: Record<RunResult['outcome'], { title: string; line: string; won: boolean }> = {
    victory: { title: '>> ROOT ACCESS', line: 'You breached all four layers. The network is yours.', won: true },
    quarantined: { title: '>> QUARANTINED', line: 'A gatekeeper purged you from the network.', won: false },
    heatMaxed: { title: '>> TRACED', line: 'Your Heat maxed out. They found you.', won: false },
    breachedThenCaught: { title: '>> BREACHED, THEN CAUGHT', line: 'You beat the gatekeeper, but its toll maxed your Heat. The layer counts as breached.', won: false },
    noRouteRemains: { title: '>> NO ROUTE', line: 'Closed nodes cut off every path to the gatekeeper.', won: false },
  };
  const end = $derived(tutorial ? TUTORIAL_ENDINGS[result.outcome === 'victory' ? 'won' : 'lost'] : ENDINGS[result.outcome]);
  const fightsWon = $derived(
    result.log.filter((e) => e.type === 'encounter' && ['regularFight', 'eliteFight', 'gatekeeperFight'].includes(e.nodeType) && e.outcome.newState === 'inert').length,
  );
</script>

<div class="end" class:won={end.won}>
  <div class="title">{end.title}</div>
  <div class="line">{end.line}</div>
  <div class="stats">
    <div><b>{result.layersCompleted}</b>/{tutorial ? 1 : 4} layer{tutorial ? '' : 's'} breached</div>
    <div><b>{fightsWon}</b> fight{fightsWon === 1 ? '' : 's'} won</div>
    <div><b>{result.playerState.data}</b> Data left</div>
  </div>
  <div class="caption">{className.toUpperCase()} · FINAL LOADOUT</div>
  {#each result.playerState.installedLoadout as p, i (i)}
    <div class="piece"><SuitIcon archetype={p.archetype} size={14} /> {p.name}</div>
  {/each}
  {#if tutorial && !end.won && onretry}<button class="again" onclick={onretry}>↻ try the tutorial again</button>{/if}
  <button class="again" class:quiet={tutorial && !end.won && onretry} onclick={onagain}>{tutorial ? '▶ start a real run' : '▶ new contract'}</button>
  {#if onmenu}<button class="menu" onclick={onmenu}>◀ menu</button>{/if}
</div>

<style>
  .end {
    max-width: 480px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(24px + env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .title {
    font-size: 22px;
    font-weight: 700;
    color: var(--danger);
  }
  .won .title {
    color: var(--accent);
  }
  .line {
    font-size: 13px;
    margin-bottom: 8px;
  }
  .stats {
    display: flex;
    gap: 14px;
    font-size: 12px;
    color: var(--text-dim);
    flex-wrap: wrap;
  }
  .stats b {
    color: var(--text);
    font-size: 15px;
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 12px;
  }
  .piece {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 3px 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .again {
    margin-top: 16px;
    padding: 10px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
  .menu {
    align-self: center;
    margin-top: 6px;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 11px;
    cursor: pointer;
  }
  .again + .again {
    margin-top: 8px;
  }
  .again.quiet {
    border-color: var(--line);
    color: var(--text);
  }
</style>
