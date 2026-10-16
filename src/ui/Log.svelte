<script lang="ts">
  import type { CombatView } from '../engine/combat';
  import { describeFire } from './describe';

  // The running log (a hard requirement): a session log of what fired and
  // why, newest at the bottom, in a terminal voice. Tap a line to
  // highlight the piece that caused it (wired in the real screen).
  let { view, onpick }: { view: CombatView; onpick?: (side: 0 | 1, subroutineId: string) => void } = $props();

  const names = $derived.by(() => {
    const m = new Map<string, string>();
    for (const side of view.combatState.sides) for (const e of side.loadout) m.set(e.definition.id, e.definition.name);
    return m;
  });
  const lines = $derived(view.log.slice(-40));
</script>

<div class="log">
  <div class="head">// session log · hand {view.handIndex + 1}</div>
  {#each lines as event, i (i)}
    <button class="line" class:them={event.side === 1} onclick={() => onpick?.(event.side, event.subroutineId)}>
      <span class="who">{event.side === 0 ? '$' : '>'}</span>
      {describeFire(event, names.get(event.subroutineId) ?? event.subroutineId)}
    </button>
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
  .who {
    opacity: 0.6;
    margin-right: 4px;
  }
</style>
