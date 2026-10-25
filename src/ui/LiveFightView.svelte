<script lang="ts">
  import type { FightSession, ResultAction } from './fight-session';
  import FightScreen from './FightScreen.svelte';
  import { Replay } from './replay.svelte';
  import { readGauges } from '../engine/resolve';
  import { untrack } from 'svelte';
  import { mergeSteps, pointsSummary, stepGauges } from './timeline';
  import { fightHeatOutlook } from '../engine/heat';
  import { rateSkill } from './skill-review';
  import SkillReview from './SkillReview.svelte';

  // A live fight on the chosen screen, and its result panel at the end.
  // Every engine pause is handed to the replay, which steps through the
  // turns that resolved since the last one (P4); the result panel waits
  // until the final turn has played out.
  // `actions` are the result panel's buttons (fight again / continue).
  let { fight, actions }: { fight: FightSession; actions: ResultAction[] } = $props();
  const replay = new Replay();
  /** Whether a resumed fight has been brought up to the present. */
  let caughtUp = false;
  // Before the screen redraws (session 72, the user's report: INIT
  // re-ran its fill at the end of pegging): a plain effect let the screen
  // draw the new pause's end state for an instant before the replay
  // rewound it, and the gauges took that instant as a fill.
  $effect.pre(() => {
    const { frame, result } = fight;
    const source = result ?? frame?.request.view;
    if (!source) return;
    const steps = mergeSteps(source.timeline, source.log);
    const fromSteps = steps.map(stepGauges).findLast((g) => g !== null) ?? null;
    const live = result ? (fromSteps ?? readGauges(frame!.request.view.combatState)) : readGauges(frame!.request.view.combatState);
    // Only a new pause re-runs this, not the replay's own stepping.
    untrack(() => {
      replay.sync(steps, live);
      // A fight rebuilt from a save opens at its current moment (session
      // 72): its steps so far were already seen before the reload.
      if (fight.resumed && !caughtUp) replay.skip();
      caughtUp = true;
    });
  });
  $effect(() => () => replay.reset());
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  // The end of a fight (session 63, the user's pattern): once its last turn
  // has played out, the gauge that filled blinks three times, then the
  // result card comes up.
  const ENDING_MS = 900;
  const done = $derived(!!fight.result && !replay.playing);
  let cardUp = $state(false);
  $effect(() => {
    if (!done) {
      cardUp = false;
      return;
    }
    const t = setTimeout(() => (cardUp = true), ENDING_MS);
    return () => clearTimeout(t);
  });
  const ending = $derived(done && !cardUp && fight.result ? fight.result.winner : null);
  // Reading the log after the fight (session 69, a tester's note): the
  // result card steps aside, and comes back on request.
  let reviewing = $state(false);
  $effect(() => {
    if (!fight.result) reviewing = false;
  });
  // A run's fight: the Heat its result cost, as the engine charges it (the
  // user's ask, session 63) -- a win's baseline, alarms and performance
  // term; a loss's price and alarms. A lost gatekeeper is Quarantine, not
  // Heat, so it shows none.
  const heatGained = $derived.by(() => {
    const r = fight.result;
    if (!r || !fight.heat) return null;
    const o = fightHeatOutlook({ ...fight.heat, alarm: r.heatGenerated, enemyFill: r.finalFillFraction[1] });
    if (r.winner === 0) return { gain: o.winGain, after: o.ifWin, allowance: o.allowance, maxed: o.caughtIfWin };
    if (o.loseGain === undefined || o.ifLose === undefined) return null;
    return { gain: o.loseGain, after: o.ifLose, allowance: o.allowance, maxed: o.caughtIfLose };
  });
  // The review coach (session 70): the fight's Cribbage rating, and a
  // drawer of its costliest mistakes.
  const rating = $derived(fight.result && fight.skill ? rateSkill(fight.skill) : null);
  let coachOpen = $state(false);
  $effect(() => {
    if (!fight.result) coachOpen = false;
  });
  const fmtHeat = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
</script>

{#if fight.frame}
  <FightScreen snapshot={fight.frame} {replay} heat={fight.heat} {ending} over={done} showLog={reviewing} daily={fight.daily} onplay={(c) => fight.answer(c)} ondiscard={(c) => fight.answer(c)} onburner={(id) => fight.answer(id)} />
{/if}

{#if fight.result && cardUp && reviewing}
  <button class="back-to-result" onclick={() => (reviewing = false)}>result ▸</button>
{/if}

{#if fight.result && cardUp && !reviewing}
  {@const r = fight.result}
  {@const pts = pointsSummary(r.timeline)}
  <div class="scrim"></div>
  <div class="result" class:won={r.winner === 0}>
    <div class="title">{r.winner === 0 ? '>> BREACHED' : '>> CONTAINED'}</div>
    <div class="line">{r.winner === 0 ? `You broke into ${fight.enemyName}.` : `${fight.enemyName} locked you out.`}</div>
    <div class="line dim">
      breach {pct(r.finalFillFraction[0])} · containment {pct(r.finalFillFraction[1])} · {r.hands.length} hands · {fight.detail}
    </div>
    {#if heatGained}
      <div class="line heat" class:maxed={heatGained.maxed}>
        Heat {heatGained.gain < 0 ? '−' : '+'}{fmtHeat(Math.abs(heatGained.gain))} → {fmtHeat(heatGained.after)}/{fmtHeat(heatGained.allowance)}{heatGained.maxed ? ' · maxed' : ''}
      </div>
    {/if}
    {#if rating}
      <button class="rating" onclick={() => (coachOpen = true)}>Cribbage: <b>{rating.rating}%</b> ({rating.label}) <span class="review">review ▸</span></button>
    {/if}
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
      <button class="secondary" onclick={() => (reviewing = true)}>view log</button>
      {#each actions as a (a.label)}<button onclick={a.onclick}>{a.label}</button>{/each}
    </div>
  </div>
  {#if coachOpen && rating}<SkillReview {rating} onclose={() => (coachOpen = false)} />{/if}
{/if}

<style>
  .back-to-result {
    position: fixed;
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    z-index: 26;
    padding: 8px 14px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--accent);
    font: inherit;
  }
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
  .heat {
    color: var(--warn);
  }
  .heat.maxed {
    color: var(--danger);
  }
  .dim {
    color: var(--text-dim);
    font-size: 11px;
  }
  .rating {
    display: flex;
    align-items: baseline;
    gap: 4px;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
  }
  .rating b {
    color: var(--accent);
  }
  .rating .review {
    margin-left: auto;
    font-size: 11px;
    color: var(--accent);
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
