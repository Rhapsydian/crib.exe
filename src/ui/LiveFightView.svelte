<script lang="ts">
  import type { FightSession, ResultAction } from './fight-session';
  import FightScreen from './FightScreen.svelte';
  import { Replay } from './replay.svelte';
  import { readGauges } from '../engine/resolve';
  import { untrack } from 'svelte';
  import { mergeSteps, pointsSummary, stepGauges } from './timeline';

  // A live fight on the chosen screen, and its result panel at the end.
  // Every engine pause is handed to the replay, which steps through the
  // turns that resolved since the last one (P4); the result panel waits
  // until the final turn has played out.
  // `actions` are the result panel's buttons (fight again / continue).
  let { fight, actions }: { fight: FightSession; actions: ResultAction[] } = $props();
  const replay = new Replay();
  $effect(() => {
    const { frame, result } = fight;
    const source = result ?? frame?.request.view;
    if (!source) return;
    const steps = mergeSteps(source.timeline, source.log);
    const fromSteps = steps.map(stepGauges).findLast((g) => g !== null) ?? null;
    const live = result ? (fromSteps ?? readGauges(frame!.request.view.combatState)) : readGauges(frame!.request.view.combatState);
    // Only a new pause re-runs this, not the replay's own stepping.
    untrack(() => replay.sync(steps, live));
  });
  $effect(() => () => replay.reset());
  const pct = (n: number) => `${Math.round(n * 100)}%`;
</script>

{#if fight.frame}
  <FightScreen snapshot={fight.frame} {replay} heat={fight.heat} onplay={(c) => fight.answer(c)} ondiscard={(c) => fight.answer(c)} onburner={(id) => fight.answer(id)} />
{/if}

{#if fight.result && !replay.playing}
  {@const r = fight.result}
  {@const pts = pointsSummary(r.timeline)}
  <div class="scrim"></div>
  <div class="result" class:won={r.winner === 0}>
    <div class="title">{r.winner === 0 ? '>> BREACHED' : '>> CONTAINED'}</div>
    <div class="line">{r.winner === 0 ? `You broke into ${fight.enemyName}.` : `${fight.enemyName} locked you out.`}</div>
    <div class="line dim">
      breach {pct(r.finalFillFraction[0])} · containment {pct(r.finalFillFraction[1])} · {r.hands.length} hands · {fight.detail}
    </div>
    <table class="points">
      <thead><tr><th>points scored</th><th class="you">you</th><th class="them">them</th></tr></thead>
      <tbody>
        <tr><td>pegging</td><td>{pts[0].pegging}</td><td>{pts[1].pegging}</td></tr>
        <tr><td>hands</td><td>{pts[0].hands}</td><td>{pts[1].hands}</td></tr>
        <tr><td>crib</td><td>{pts[0].crib}</td><td>{pts[1].crib}</td></tr>
        {#if pts[0].heels + pts[1].heels > 0}<tr><td>his heels</td><td>{pts[0].heels}</td><td>{pts[1].heels}</td></tr>{/if}
        <tr class="total"><td>total · fed initiative</td><td class="you">{pts[0].total}</td><td class="them">{pts[1].total}</td></tr>
      </tbody>
    </table>
    <div class="buttons">
      {#each actions as a (a.label)}<button onclick={a.onclick}>{a.label}</button>{/each}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 55%);
    z-index: 25;
  }
  .result {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(360px, calc(100% - 32px));
    z-index: 26;
    background: var(--bg-sunken);
    border: 1px solid var(--danger);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .result.won {
    border-color: var(--accent);
  }
  .title {
    font-size: 20px;
    font-weight: 700;
    color: var(--danger);
  }
  .won .title {
    color: var(--accent);
  }
  .line {
    font-size: 13px;
  }
  .dim {
    color: var(--text-dim);
    font-size: 11px;
  }
  .points {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-top: 2px;
  }
  .points th,
  .points td {
    padding: 2px 4px;
    text-align: right;
  }
  .points th:first-child,
  .points td:first-child {
    text-align: left;
    color: var(--text-dim);
  }
  .points th {
    font-weight: 400;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--text-dim);
    border-bottom: 1px solid var(--line);
  }
  .points .total td {
    border-top: 1px solid var(--line);
    font-weight: 700;
  }
  .points .you {
    color: var(--accent);
  }
  .points .them {
    color: var(--danger);
  }
  .buttons {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }
  .buttons button {
    flex: 1;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font-size: 12px;
  }
</style>
