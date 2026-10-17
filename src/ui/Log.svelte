<script lang="ts">
  import type { CombatView } from '../engine/combat';
  import { stepLine, type Step } from './timeline';

  // The running log (a hard requirement): a session log of what happened
  // and why, newest at the bottom, in a terminal voice -- cards played,
  // points scored, and every fire. Tap a fire line to inspect its piece.
  // `steps` (the live fight's timeline) when given; otherwise just the
  // fires in `view.log` (the mockups).
  let { view, steps, onpick }: { view: CombatView; steps?: readonly Step[]; onpick?: (side: 0 | 1, subroutineId: string) => void } = $props();

  const names = $derived.by(() => {
    const m = new Map<string, string>();
    for (const side of view.combatState.sides) for (const e of side.loadout) m.set(e.definition.id, e.definition.name);
    return m;
  });
  const lines = $derived((steps ?? view.log.map((fire): Step => ({ type: 'fire', fire }))).map((s) => stepLine(s, names)).filter((l) => l !== null).slice(-60));
</script>

<div class="log">
  <div class="head">// session log · hand {view.handIndex + 1}</div>
  {#each lines as line, i (i)}
    {#if line.fire}
      {@const fire = line.fire}
      <button class="line" class:them={line.side === 1} onclick={() => onpick?.(fire.side, fire.subroutineId)}>
        <span class="who">{line.side === 0 ? '$' : '>'}</span>{line.text}
      </button>
    {:else}
      <div class="line {line.kind}" class:them={line.side === 1} class:you={line.side === 0}>
        {#if line.side !== null}<span class="who">{line.side === 0 ? '$' : '>'}</span>{/if}{line.text}
      </div>
    {/if}
  {/each}
</div>

<style>
  .log {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 11px;
    line-height: 1.35;
  }
  .head {
    color: var(--text-dim);
    margin-bottom: 4px;
  }
  .line {
    text-align: left;
    background: none;
    border: none;
    padding: 1px 0;
    color: var(--accent);
    cursor: pointer;
  }
  .them {
    color: var(--danger);
  }
  .table {
    color: var(--text-dim);
    cursor: default;
  }
  .points {
    cursor: default;
    font-weight: 700;
  }
  .points.you {
    color: var(--accent);
  }
  .mod {
    color: var(--mod);
    cursor: default;
  }
  .who {
    opacity: 0.6;
    margin-right: 4px;
  }
</style>
