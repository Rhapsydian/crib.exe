<script lang="ts">
  import type { RunRequest } from '../engine/run-requests';
  import type { SubroutineDefinition } from '../engine/subroutine-types';
  import { BENCH_CAP } from '../engine/loadout';
  import SuitIcon from './SuitIcon.svelte';
  import { pieceLines, rarityOf } from './reward-text';

  // The bench is over its cap (milestone 3 checkpoint 3, M2): drop one
  // piece for good. The newest piece is marked; dropping it turns the
  // reward down. Dropping an installed piece puts the newest in its slot.
  let { request, ondrop }: { request: Extract<RunRequest, { kind: 'drop' }>; ondrop: (id: string) => void } = $props();

  const player = $derived(request.playerState);
  const newest = $derived(player.bench[player.bench.length - 1]);
  let selected = $state<string | null>(null);
  const all = $derived([...player.installedLoadout, ...player.bench]);
  const chosen = $derived(all.find((p) => p.id === selected));
  const isInstalled = (p: SubroutineDefinition) => player.installedLoadout.some((x) => x.id === p.id);
  const consequence = $derived(
    !chosen
      ? 'Tap a piece to choose it.'
      : chosen.id === newest.id
        ? `Turns ${newest.name} down.`
        : isInstalled(chosen)
          ? `${newest.name} takes its slot in your loadout.`
          : 'Leaves your bench.',
  );
</script>

<div class="drop">
  <div class="title">BENCH FULL · DROP ONE</div>
  <div class="blurb">Your bench holds {BENCH_CAP}. One piece goes for good (its Merge upgrades are kept, should you find it again).</div>

  <div class="caption">LOADOUT</div>
  {#each player.installedLoadout as p (p.id)}
    {@const granted = Boolean(player.grantedByMod[p.id])}
    <button class="piece" class:sel={selected === p.id} disabled={granted} onclick={() => (selected = selected === p.id ? null : p.id)}>
      <SuitIcon archetype={p.archetype} size={14} />
      {p.name}
      {#if granted}<span class="tag">Mod-granted</span>{/if}
    </button>
  {/each}
  <div class="caption">BENCH</div>
  {#each player.bench as p (p.id)}
    <button class="piece" class:sel={selected === p.id} onclick={() => (selected = selected === p.id ? null : p.id)}>
      <SuitIcon archetype={p.archetype} size={14} />
      {p.name}
      {#if p.id === newest.id}<span class="tag new">NEW</span>{/if}
    </button>
  {/each}

  {#if chosen}
    <div class="detail">
      <div class="name"><SuitIcon archetype={chosen.archetype} size={15} /> <b>{chosen.name}</b> <span class="dim">· {rarityOf(chosen.id)}</span></div>
      {#each pieceLines(chosen) as line (line)}<div>{line}</div>{/each}
    </div>
  {/if}
  <div class="consequence">{consequence}</div>
  <button class="confirm" disabled={!chosen} onclick={() => chosen && ondrop(chosen.id)}>{chosen ? `drop ${chosen.name}` : 'drop…'}</button>
</div>

<style>
  .drop {
    max-width: 480px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(16px + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .title {
    color: var(--warn);
    font-weight: 700;
    letter-spacing: 0.08em;
    font-size: 14px;
  }
  .blurb {
    color: var(--text-dim);
    font-size: 11.5px;
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 8px;
  }
  .piece {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    text-align: left;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .piece:disabled {
    opacity: 0.5;
  }
  .piece.sel {
    border-color: var(--danger);
    box-shadow: 0 0 0 1px var(--danger) inset;
  }
  .tag {
    margin-left: auto;
    font-size: 9.5px;
    color: var(--mod);
  }
  .tag.new {
    color: var(--accent);
    font-weight: 700;
  }
  .detail {
    margin-top: 6px;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    font-size: 11.5px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    line-height: 1.35;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dim {
    color: var(--text-dim);
  }
  .consequence {
    font-size: 11.5px;
    color: var(--text-dim);
    margin-top: 6px;
  }
  .confirm {
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid var(--danger);
    background: transparent;
    color: var(--danger);
    font-weight: 700;
    font-size: 13px;
  }
  .confirm:disabled {
    border-color: var(--line);
    color: var(--text-dim);
    font-weight: 400;
  }
</style>
