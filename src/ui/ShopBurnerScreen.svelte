<script lang="ts">
  import WithKit from './WithKit.svelte';
  import type { DailyPlan } from '../engine/daily';
  import type { RunRequest } from '../engine/run-requests';
  import type { BurnerId } from '../engine/burner-types';
  import { BURNER_DEFINITIONS } from '../engine/burners';
  import { burnerText } from './reward-text';

  // Entering a Shop with a Shop Burner (milestone 3 checkpoint 4): use one
  // on this visit before the slates are laid out, or save it.
  let { request, onpick, daily }: { request: Extract<RunRequest, { kind: 'shopBurner' }>; onpick: (id: BurnerId | null) => void; daily?: { plan: DailyPlan; practice: boolean } | null } = $props();
  const ids = $derived([...new Set(request.burnerIds)]);
</script>

<WithKit player={request.playerState} {daily}>
{#snippet children(kitButton)}
<div class="sb">
  <div class="head"><span class="title">SHOP · USE A BURNER?</span>{@render kitButton()}</div>
  <div class="blurb">A Shop Burner works on this whole visit. Use one now, or save it.</div>
  {#each ids as id (id)}
    {@const def = BURNER_DEFINITIONS[id]}
    <button class="burner" onclick={() => onpick(id)}>
      <div class="name"><span class="glyph">⏏︎</span> <b>Use {def.name}</b></div>
      <div class="text">{burnerText(def)}</div>
    </button>
  {/each}
  <button class="none" onclick={() => onpick(null)}>save them · enter the Shop ▸</button>
</div>
{/snippet}
</WithKit>

<style>
  .sb {
    max-width: 480px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(24px + env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
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
  .burner {
    text-align: left;
    padding: 10px;
    border: 1px solid var(--warn);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 12px;
  }
  .name {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .glyph {
    color: var(--warn);
  }
  .none {
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text-dim);
    font-size: 12.5px;
  }
</style>
