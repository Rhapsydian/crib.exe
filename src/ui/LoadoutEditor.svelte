<script lang="ts">
  import type { RunPlayerState } from '../engine/run';
  import { BENCH_CAP, INSTALLED_SLOT_CAP } from '../engine/loadout';
  import SuitIcon from './SuitIcon.svelte';
  import { pieceLines, rarityOf } from './reward-text';

  // The loadout, editable between fights (milestone 3 checkpoint 3, M2).
  // Tap a piece to select it and read it; then move it up or down, bench
  // it, install it, or tap a piece on the other side to swap the two.
  // Every change goes to the engine at once (`onarrange`), which checks it
  // and hands back the new state.
  let { player, onarrange }: { player: RunPlayerState; onarrange: (installed: string[], bench: string[]) => void } = $props();

  type Zone = 'loadout' | 'bench';
  let selected = $state<{ zone: Zone; id: string } | null>(null);

  const installed = $derived(player.installedLoadout.map((p) => p.id));
  const bench = $derived(player.bench.map((p) => p.id));
  const capped = $derived(player.installedLoadout.filter((p) => !player.grantedByMod[p.id]).length);
  const locked = (id: string) => Boolean(player.grantedByMod[id]);
  const piece = $derived(selected ? [...player.installedLoadout, ...player.bench].find((p) => p.id === selected!.id) : undefined);
  // A selection whose piece moved zones (or left) follows it or clears.
  $effect(() => {
    if (!selected) return;
    const zone: Zone | null = installed.includes(selected.id) ? 'loadout' : bench.includes(selected.id) ? 'bench' : null;
    if (zone === null) selected = null;
    else if (zone !== selected.zone) selected = { zone, id: selected.id };
  });

  function send(nextInstalled: string[], nextBench: string[]) {
    onarrange(nextInstalled, nextBench);
  }

  function tap(zone: Zone, id: string) {
    const s = selected;
    if (s && s.id === id) {
      selected = null;
      return;
    }
    // A piece on each side: swap them, each taking the other's place.
    if (s && s.zone !== zone) {
      const inId = zone === 'loadout' ? id : s.id;
      const outId = zone === 'loadout' ? s.id : id;
      if (locked(inId)) return;
      send(
        installed.map((x) => (x === inId ? outId : x)),
        bench.map((x) => (x === outId ? inId : x)),
      );
      selected = null;
      return;
    }
    selected = { zone, id };
  }

  function shift(delta: number) {
    if (!selected) return;
    const i = installed.indexOf(selected.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= installed.length) return;
    const next = installed.slice();
    [next[i], next[j]] = [next[j], next[i]];
    send(next, bench);
  }
  function toBench() {
    if (!selected) return;
    send(
      installed.filter((x) => x !== selected!.id),
      [...bench, selected.id],
    );
  }
  function install() {
    if (!selected) return;
    send(
      [...installed, selected.id],
      bench.filter((x) => x !== selected!.id),
    );
  }
</script>

<div class="editor">
  <div class="caption">LOADOUT · {capped}/{INSTALLED_SLOT_CAP} · fires top → bottom</div>
  {#each player.installedLoadout as p, i (p.id)}
    <button class="piece" class:sel={selected?.id === p.id} onclick={() => tap('loadout', p.id)}>
      <span class="n">{i + 1}</span>
      <SuitIcon archetype={p.archetype} size={14} />
      {p.name}
      {#if locked(p.id)}<span class="tag">Mod-granted</span>{/if}
    </button>
  {/each}
  <div class="caption">BENCH · {player.bench.length}/{BENCH_CAP} · not firing</div>
  {#each player.bench as p (p.id)}
    <button class="piece benched" class:sel={selected?.id === p.id} onclick={() => tap('bench', p.id)}>
      <SuitIcon archetype={p.archetype} size={14} />
      {p.name}
    </button>
  {:else}
    <div class="empty">empty</div>
  {/each}

  {#if piece && selected}
    <div class="detail">
      <div class="name"><SuitIcon archetype={piece.archetype} size={15} /> <b>{piece.name}</b> <span class="dim">· {rarityOf(piece.id)}</span></div>
      {#each pieceLines(piece) as line (line)}<div class="line">{line}</div>{/each}
      <div class="actions">
        {#if selected.zone === 'loadout'}
          <button onclick={() => shift(-1)} disabled={installed.indexOf(selected.id) === 0}>▲ up</button>
          <button onclick={() => shift(1)} disabled={installed.indexOf(selected.id) === installed.length - 1}>▼ down</button>
          <button onclick={toBench} disabled={locked(selected.id) || bench.length >= BENCH_CAP}>to bench</button>
        {:else}
          <button onclick={install} disabled={capped >= INSTALLED_SLOT_CAP}>install</button>
        {/if}
      </div>
      <div class="hint">
        {#if selected.zone === 'bench'}Or tap a loadout piece to swap them.{:else if bench.length}Or tap a bench piece to swap them.{/if}
        {#if locked(selected.id)} A Mod-granted piece can't leave the loadout.{/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .editor {
    display: flex;
    flex-direction: column;
    gap: 4px;
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
    padding: 5px 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    text-align: left;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .piece.benched {
    color: var(--text-dim);
  }
  .piece.sel {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
    color: var(--text);
  }
  .n {
    width: 12px;
    color: var(--text-dim);
    font-size: 10px;
  }
  .tag {
    margin-left: auto;
    font-size: 9.5px;
    color: var(--mod);
  }
  .empty {
    font-size: 11px;
    color: var(--text-dim);
  }
  .detail {
    margin-top: 8px;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11.5px;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .line {
    line-height: 1.35;
  }
  .dim,
  .hint {
    color: var(--text-dim);
  }
  .hint {
    font-size: 10.5px;
  }
  .actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 2px;
  }
  .actions button {
    padding: 4px 10px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-size: 11px;
  }
  .actions button:disabled {
    border-color: var(--line);
    color: var(--text-dim);
    opacity: 0.6;
  }
</style>
