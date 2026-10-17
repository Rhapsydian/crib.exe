<script lang="ts">
  import type { LiveFight } from './live-fight.svelte';
  import FightScreen from './FightScreen.svelte';
  import { Replay } from './replay.svelte';
  import { readGauges } from '../engine/resolve';
  import { untrack } from 'svelte';
  import { mergeSteps, stepGauges } from './timeline';

  // A live fight on the chosen screen, and its result panel at the end.
  // Every engine pause is handed to the replay, which steps through the
  // turns that resolved since the last one (P4); the result panel waits
  // until the final turn has played out.
  let { fight, onagain, onsetup }: { fight: LiveFight; onagain: () => void; onsetup: () => void } = $props();
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
  <FightScreen snapshot={fight.frame} {replay} onplay={(c) => fight.answer(c)} ondiscard={(c) => fight.answer(c)} onburner={(id) => fight.answer(id)} />
{/if}

{#if fight.result && !replay.playing}
  {@const r = fight.result}
  <div class="scrim"></div>
  <div class="result" class:won={r.winner === 0}>
    <div class="title">{r.winner === 0 ? '>> BREACHED' : '>> CONTAINED'}</div>
    <div class="line">{r.winner === 0 ? `You broke into ${fight.setup.enemy.name}.` : `${fight.setup.enemy.name} locked you out.`}</div>
    <div class="line dim">
      breach {pct(r.finalFillFraction[0])} · containment {pct(r.finalFillFraction[1])} · {r.hands.length} hands · seed {fight.setup.seed}
    </div>
    <div class="buttons">
      <button onclick={onagain}>fight again</button>
      <button onclick={onsetup}>change setup</button>
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
