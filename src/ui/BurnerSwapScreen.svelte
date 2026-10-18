<script lang="ts">
  import type { RunRequest } from '../engine/run-requests';
  import type { BurnerId } from '../engine/burner-types';
  import { BURNER_CAP, BURNER_DEFINITIONS } from '../engine/burners';
  import { burnerText, burnerWhere } from './reward-text';

  // A Burner arriving at the carry cap (the user's call, session 58):
  // swap one you carry out for it, or keep yours and leave it.
  let { request, onswap }: { request: Extract<RunRequest, { kind: 'burnerSwap' }>; onswap: (out: BurnerId | null) => void } = $props();

  const incoming = $derived(request.incoming);
  const carried = $derived(request.playerState.carriedBurnerIds);
  let selected = $state<number | null>(null);
  const out = $derived(selected === null ? null : carried[selected]);
</script>

<div class="swap">
  <div class="title">BURNERS FULL · SWAP ONE?</div>
  <div class="blurb">You carry {BURNER_CAP}, the most you can. Swap one out for the new one, or keep yours.</div>

  <div class="caption">NEW</div>
  <div class="burner incoming">
    <div class="name"><span class="glyph">⏏︎</span> <b>{incoming.name}</b> <span class="tag">{incoming.rarity} · {burnerWhere(incoming)}</span></div>
    <div class="text">{burnerText(incoming)}</div>
  </div>

  <div class="caption">YOU CARRY · tap one to swap it out</div>
  {#each carried as id, i (i)}
    {@const def = BURNER_DEFINITIONS[id]}
    <button class="burner" class:sel={selected === i} onclick={() => (selected = selected === i ? null : i)}>
      <div class="name"><span class="glyph">⏏︎</span> <b>{def.name}</b> <span class="tag">{def.rarity} · {burnerWhere(def)}</span></div>
      <div class="text">{burnerText(def)}</div>
    </button>
  {/each}

  <div class="actions">
    <button class="keep" onclick={() => onswap(null)}>keep mine</button>
    <button class="confirm" disabled={!out} onclick={() => out && onswap(out)}>{out ? `swap ${BURNER_DEFINITIONS[out].name} for ${incoming.name}` : 'tap one to swap'}</button>
  </div>
</div>

<style>
  .swap {
    max-width: 480px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(16px + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 6px;
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
  .burner {
    text-align: left;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 12px;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .burner.incoming {
    border-color: var(--warn);
  }
  .burner.sel {
    border-color: var(--danger);
    box-shadow: 0 0 0 1px var(--danger) inset;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .glyph {
    color: var(--warn);
  }
  .tag {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-dim);
  }
  .text {
    line-height: 1.4;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }
  .actions button {
    padding: 10px;
    border-radius: var(--radius);
    font-size: 12.5px;
    background: transparent;
  }
  .keep {
    border: 1px solid var(--line);
    color: var(--text-dim);
  }
  .confirm {
    flex: 1;
    border: 1px solid var(--warn);
    color: var(--warn);
    font-weight: 700;
  }
  .confirm:disabled {
    border-color: var(--line);
    color: var(--text-dim);
    font-weight: 400;
  }
</style>
