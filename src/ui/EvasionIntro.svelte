<script lang="ts">
  import type { RunRequest } from '../engine/run-requests';
  import { EVASION_HANDS } from '../engine/evasion';

  // A trace evasion's intro (session 63, docs/trace-evasion-design.md):
  // you beat the gatekeeper, but its toll maxed your Heat. Before the
  // Cribbage, the stakes: three hands, its head start and where that came
  // from, that you deal twice, and that only finishing ahead escapes.
  let { request, onbegin }: { request: Extract<RunRequest, { kind: 'evasionStart' }>; onbegin: () => void } = $props();
  const pct = $derived(Math.round(request.enemyFill * 100));
</script>

<div class="intro">
  <div class="kicker">LAYER {request.layer} · GATEKEEPER BREACHED · HEAT MAXED</div>
  <div class="title">&gt;&gt; TRACE EVASION</div>
  <div class="line">You beat {request.enemy.name}, but its Heat toll maxed out your Heat. Now it's tracing you.</div>
  <div class="line">
    To escape, outscore it over {EVASION_HANDS} hands of plain Cribbage. Win and you {request.layer >= 4 ? 'take the network' : `move on to layer ${request.layer + 1}`}. Lose or tie and you're caught.
  </div>
  <div class="facts">
    <div><span class="label">Its head start:</span> {request.headStart} {request.headStart === 1 ? 'point' : 'points'}, 1 for every 10% of Containment it reached ({pct}%).</div>
    <div><span class="label">Your edge:</span> you deal the 1st and 3rd hands, so two of the three cribs are yours.</div>
  </div>
  <button class="begin" onclick={onbegin}>▶ start the evasion</button>
</div>

<style>
  .intro {
    max-width: 480px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(32px + env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kicker {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.1em;
  }
  .title {
    color: var(--danger);
    font-weight: 700;
    font-size: 20px;
  }
  .line {
    font-size: 13px;
    line-height: 1.45;
  }
  .facts {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 4px;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    font-size: 12px;
    color: var(--text-dim);
  }
  .facts .label {
    color: var(--text);
  }
  .begin {
    margin-top: 12px;
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid var(--danger);
    background: transparent;
    color: var(--danger);
    font-weight: 700;
    font-size: 13px;
  }
</style>
