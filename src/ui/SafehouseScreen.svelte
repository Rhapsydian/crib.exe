<script lang="ts">
  import type { RunRequest } from '../engine/run-requests';
  import { REST_HEAT_REDUCTION } from '../engine/encounters';
  import SuitIcon from './SuitIcon.svelte';
  import { MERGE_RANK_CAP, mergeChange, rankMark } from './visit-text';
  import { mergePlan } from '../engine/merge';

  // A Safehouse (milestone 3 checkpoint 4): one action per visit -- Rest
  // to shed Heat, or Merge. Since session 61 (the user's call) a Merge
  // spends every banked copy you hold, ranking each subroutine as far as
  // its copies allow; the screen shows the whole plan.
  let { request, onchoose }: { request: Extract<RunRequest, { kind: 'safehouse' }>; onchoose: (action: 'rest' | 'merge', targetId?: string) => void } = $props();

  const player = $derived(request.playerState);
  const allowance = $derived(player.heatAllowance ?? 1);
  const plan = $derived(mergePlan(player));
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
</script>

<div class="safe">
  <div class="title">SAFEHOUSE</div>
  <div class="blurb">Lie low or tune your kit: one, not both.</div>

  <button class="option rest" onclick={() => onchoose('rest')}>
    <div class="name"><b>Rest</b> <span class="tag">−{REST_HEAT_REDUCTION} Heat</span></div>
    <div class="line">Heat {fmt(request.heat)} → {fmt(Math.max(0, request.heat - REST_HEAT_REDUCTION))} of {fmt(allowance)}.</div>
  </button>

  <div class="caption">MERGE · spend every banked copy (each subroutine up to rank {rankMark(MERGE_RANK_CAP)})</div>
  {#if plan.length}
    <div class="option merge">
      {#each plan as o (o.piece.id)}
        <div class="name"><SuitIcon archetype={o.piece.archetype} size={15} /> <b>{o.piece.name}</b> <span class="tag">rank {rankMark(o.from) || '0'} → {rankMark(o.to)}</span></div>
        {#each mergeChange(o.piece, o.to - o.from) as c (c.after)}
          <div class="line dim">{c.before}</div>
          <div class="line up">→ {c.after}</div>
        {/each}
      {/each}
    </div>
    <button class="confirm" onclick={() => onchoose('merge', plan[0].piece.id)}>merge everything</button>
  {:else}
    <div class="empty">Nothing to merge: pick up a second copy of a subroutine you own to bank a copy for Merging.</div>
  {/if}
</div>

<style>
  .safe {
    max-width: 520px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(16px + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 7px;
  }
  .title {
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.08em;
    font-size: 14px;
  }
  .blurb,
  .empty {
    color: var(--text-dim);
    font-size: 11.5px;
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 8px;
  }
  .option {
    text-align: left;
    padding: 10px;
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
  .option.rest {
    border-color: var(--heat);
  }
  .option.merge {
    border-color: var(--accent);
    gap: 4px;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
  }
  .tag {
    margin-left: auto;
    font-size: 10px;
    color: var(--text-dim);
  }
  .line {
    line-height: 1.4;
  }
  .dim {
    color: var(--text-dim);
    text-decoration: line-through;
    text-decoration-color: rgb(125 143 161 / 50%);
  }
  .up {
    color: var(--accent);
  }
  .confirm {
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
</style>
