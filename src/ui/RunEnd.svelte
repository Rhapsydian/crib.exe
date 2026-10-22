<script lang="ts">
  import type { RunResult } from '../engine/run';
  import SuitIcon from './SuitIcon.svelte';
  import { summarizeRun } from './run-summary';
  import { NODE_KIND } from './map-kinds';
  import { rankMark } from './visit-text';
  import { MOD_DEFINITIONS } from '../engine/mods';
  import { BURNER_DEFINITIONS } from '../engine/burners';
  import type { SubroutineDefinition } from '../engine/subroutine-types';

  // The end of a run (milestone 3 checkpoint 2): how it ended, how deep
  // you got, and what you were running. Session 63 (the user's sketch):
  // who or what ended it, one row per layer, the whole kit (ranks,
  // banked copies, bench, Mods, Burners), final Heat and the seed (not
  // in the tutorial). Scrolls on phones if it must.
  // The guided first run (session 63) ends on its own screen: done, or
  // try again, and then the way into a real run.
  let {
    result,
    className,
    onagain,
    onretry,
    onmenu,
    seed,
    tutorial = false,
  }: { result: RunResult; className: string; onagain: () => void; onretry?: () => void; onmenu?: () => void; seed?: number; tutorial?: boolean } = $props();
  const TUTORIAL_ENDINGS = {
    won: { title: '>> TUTORIAL COMPLETE', line: "You breached your first layer. A real run is four layers deep, and you choose your class. You're ready.", won: true },
    lost: { title: '>> TUTORIAL OVER', line: "Not this time. Try the tutorial again, or jump into a real run.", won: false },
  };

  const ENDINGS: Record<RunResult['outcome'], { title: string; line: string; won: boolean }> = {
    victory: { title: '>> ROOT ACCESS', line: 'You breached all four layers. The network is yours.', won: true },
    quarantined: { title: '>> QUARANTINED', line: 'A gatekeeper purged you from the network.', won: false },
    heatMaxed: { title: '>> TRACED', line: 'Your Heat maxed out. They found you.', won: false },
    breachedThenCaught: { title: '>> BREACHED, THEN CAUGHT', line: 'You beat the gatekeeper, but its toll maxed your Heat and it traced you. The layer counts as breached.', won: false },
    noRouteRemains: { title: '>> NO ROUTE', line: 'Closed nodes cut off every path to the gatekeeper.', won: false },
  };
  const end = $derived(tutorial ? TUTORIAL_ENDINGS[result.outcome === 'victory' ? 'won' : 'lost'] : ENDINGS[result.outcome]);
  const summary = $derived(summarizeRun(result));
  const ENDING_TEXT = { breached: 'breached', quarantined: 'quarantined', traced: 'traced', breachedThenCaught: 'breached, then caught', noRoute: 'no route' };
  const player = $derived(result.playerState);
  const mods = $derived(player.ownedModIds.map((id) => MOD_DEFINITIONS[id]?.name ?? id));
  const burners = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const id of player.carriedBurnerIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts].map(([id, n]) => `${BURNER_DEFINITIONS[id as keyof typeof BURNER_DEFINITIONS]?.name ?? id}${n > 1 ? ` ×${n}` : ''}`);
  });
  const fightsWon = $derived(
    result.log.filter((e) => e.type === 'encounter' && ['regularFight', 'eliteFight', 'gatekeeperFight'].includes(e.nodeType) && e.outcome.newState === 'inert').length,
  );
</script>

<div class="end" class:won={end.won}>
  <div class="title">{end.title}</div>
  <div class="line">{tutorial ? end.line : summary.headline}</div>
  <div class="stats">
    <div><b>{result.layersCompleted}</b>/{tutorial ? 1 : 4} layer{tutorial ? '' : 's'} breached</div>
    <div><b>{fightsWon}</b> fight{fightsWon === 1 ? '' : 's'} won</div>
    <div><b>{player.data}</b> Data left</div>
    <!-- Heat resets on a breach, so it only tells a story on a loss. -->
    {#if result.outcome !== 'victory'}<div>Heat <b>{Math.round(summary.finalHeat)}</b>/{summary.allowance} at the end</div>{/if}
  </div>

  {#if !tutorial && summary.layers.length}
    <div class="caption">THE RUN</div>
    {#each summary.layers as row (row.layer)}
      <div class="layer">
        <div class="layer-head">
          <span class="lnum">L{row.layer}</span>
          <span class="stops">
            {#each row.stops as stop, i (i)}
              <span class="stop" class:lost={stop.won === false} style="color: {stop.won === false ? 'var(--danger)' : NODE_KIND[stop.type].tone}" title={NODE_KIND[stop.type].label}>{stop.won === false ? '✕' : NODE_KIND[stop.type].glyph}</span>
            {/each}
          </span>
          <span class="ending" class:bad={row.ending !== 'breached'}>{ENDING_TEXT[row.ending]}{#if row.evasion?.escaped}, evaded {row.evasion.scores[0]}-{row.evasion.scores[1]}{/if}</span>
        </div>
        {#if row.enemies.length}<div class="enemies">{row.enemies.join(' · ')}</div>{/if}
      </div>
    {/each}
  {/if}

  <div class="caption">{className.toUpperCase()} · FINAL LOADOUT</div>
  {#snippet piece(p: SubroutineDefinition)}
    <div class="piece">
      <SuitIcon archetype={p.archetype} size={14} />
      {p.name}{#if p.rank}&nbsp;<span class="rank">rank {rankMark(p.rank)}</span>{/if}
      {#if player.material[p.id]}<span class="banked">+{player.material[p.id]} banked</span>{/if}
    </div>
  {/snippet}
  {#each player.installedLoadout as p, i (i)}{@render piece(p)}{/each}
  {#if player.bench.length}
    <div class="caption">BENCH</div>
    {#each player.bench as p, i (i)}{@render piece(p)}{/each}
  {/if}
  {#if mods.length}
    <div class="caption">MODS · {mods.length}</div>
    <div class="kit">{#each mods as m, i (i)}<span class="chip mod">◆ {m}</span>{/each}</div>
  {/if}
  {#if burners.length}
    <div class="caption">BURNERS</div>
    <div class="kit">{#each burners as b, i (i)}<span class="chip burner">⏏︎ {b}</span>{/each}</div>
  {/if}
  {#if !tutorial && seed !== undefined}<div class="seed">seed {seed}</div>{/if}
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
  .layer {
    padding: 4px 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    font-size: 12px;
  }
  .layer-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lnum {
    color: var(--text-dim);
    font-size: 11px;
  }
  .stops {
    display: flex;
    gap: 4px;
    flex: 1;
    flex-wrap: wrap;
  }
  .stop {
    width: 14px;
    text-align: center;
  }
  .ending {
    color: var(--accent);
    font-size: 11px;
  }
  .ending.bad {
    color: var(--danger);
  }
  .enemies {
    color: var(--text-dim);
    font-size: 11px;
    margin-top: 2px;
  }
  .rank {
    color: var(--warn);
    font-size: 11px;
  }
  .banked {
    margin-left: auto;
    color: var(--text-dim);
    font-size: 11px;
  }
  .kit {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chip {
    font-size: 11px;
    padding: 2px 8px;
    border: 1px solid var(--line);
    border-radius: 999px;
  }
  .chip.mod {
    color: var(--mod);
  }
  .chip.burner {
    color: var(--warn);
  }
  .seed {
    margin-top: 10px;
    font-size: 10px;
    color: var(--text-dim);
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
