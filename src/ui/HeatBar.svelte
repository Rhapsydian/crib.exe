<script lang="ts">
  import type { FightHeatOutlook } from '../engine/heat';

  // The fight's Heat (session 63, the user's ask: be clearer about Heat).
  // A slim bar at the top of a run's fight: the solid part is your Heat now
  // (it grows as an enemy's alarms go off, with a flash), the faint part
  // what winning at this moment would add. It turns red once a win now
  // would get you caught -- or, a gatekeeper's toll climbing as its
  // Containment fills, would mean a trace evasion (session 63).
  let { outlook, gatekeeper = false }: { outlook: FightHeatOutlook; gatekeeper?: boolean } = $props();
  const fmt = (n: number) => String(Math.round(n));
  const pct = (n: number) => `${Math.min(100, (n / outlook.allowance) * 100)}%`;
  // Each time an alarm raises your Heat, the bar plays its alert once:
  // highlight, a beat, two blinks, off (the user's pattern). A CSS
  // animation restarted by a count, not a timer -- the bar redraws on
  // every replay step, which kept cancelling the old timer, so the
  // highlight never went away.
  let alerts = $state(0);
  // The Heat last seen (unset at first, so the first reading never alerts).
  let last: number | null = null;
  $effect(() => {
    if (last !== null && outlook.now > last + 0.01) alerts++;
    last = outlook.now;
  });
</script>

<div class="heat" class:danger={outlook.caughtIfWin} title="Heat now, and what winning now would add">
  <span class="label">HEAT</span>
  {#key alerts}
    <div class="bar" class:alert={alerts > 0}>
      <span class="win" style="width: {pct(outlook.ifWin)}"></span>
      <span class="now" style="width: {pct(outlook.now)}"></span>
    </div>
  {/key}
  <span class="num"><b>{fmt(outlook.now)}</b>/{fmt(outlook.allowance)}</span>
  <span class="if">
    {#if outlook.caughtIfWin}⚠ {gatekeeper ? 'its toll now means a trace evasion' : 'a win now gets you caught'}{:else}win now → {fmt(outlook.ifWin)}{/if}
  </span>
</div>

<style>
  .heat {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
    color: var(--text-dim);
    min-width: 0;
  }
  .label {
    letter-spacing: 0.06em;
    color: var(--warn);
  }
  .bar {
    position: relative;
    flex: 1;
    min-width: 40px;
    height: 6px;
    border-radius: 999px;
    background: var(--bg-sunken);
    border: 1px solid var(--line);
    overflow: hidden;
  }
  .bar span {
    position: absolute;
    inset: 0 auto 0 0;
    transition: width 0.25s ease;
  }
  .now {
    background: var(--warn);
  }
  .win {
    background: var(--warn);
    opacity: 0.3;
  }
  .num b {
    color: var(--text);
  }
  .if {
    white-space: nowrap;
  }
  .danger .label,
  .danger .if {
    color: var(--danger);
  }
  .danger .now,
  .danger .win {
    background: var(--danger);
  }
  .bar.alert {
    animation: heat-alert 1.5s linear both;
  }
  /* Highlight, a beat, blink, blink, off. */
  @keyframes heat-alert {
    0%,
    34% {
      box-shadow: 0 0 0 2px var(--warn);
    }
    35%,
    52% {
      box-shadow: none;
    }
    53%,
    64% {
      box-shadow: 0 0 0 2px var(--warn);
    }
    65%,
    76% {
      box-shadow: none;
    }
    77%,
    88% {
      box-shadow: 0 0 0 2px var(--warn);
    }
    89%,
    100% {
      box-shadow: none;
    }
  }
</style>
