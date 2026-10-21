<script lang="ts">
  import type { FightHeatOutlook } from '../engine/heat';

  // The fight's Heat (session 63, the user's ask: be clearer about Heat).
  // A slim bar at the top of a run's fight: the solid part is your Heat now
  // (it grows as an enemy's alarms go off, with a flash), the faint part
  // what winning at this moment would add. It turns red once a win now
  // would get you caught -- a gatekeeper's toll climbs as its Containment
  // fills, so this is where "breached, then caught" shows coming.
  let { outlook, gatekeeper = false }: { outlook: FightHeatOutlook; gatekeeper?: boolean } = $props();
  const fmt = (n: number) => String(Math.round(n));
  const pct = (n: number) => `${Math.min(100, (n / outlook.allowance) * 100)}%`;
  let flash = $state(false);
  // The Heat last seen, to flash when an alarm raises it (starts unset,
  // so the first reading never flashes).
  let last: number | null = null;
  $effect(() => {
    if (last !== null && outlook.now > last + 0.01) {
      flash = true;
      const t = setTimeout(() => (flash = false), 700);
      last = outlook.now;
      return () => clearTimeout(t);
    }
    last = outlook.now;
  });
</script>

<div class="heat" class:danger={outlook.caughtIfWin} class:flash title="Heat now, and what winning now would add">
  <span class="label">HEAT</span>
  <div class="bar">
    <span class="win" style="width: {pct(outlook.ifWin)}"></span>
    <span class="now" style="width: {pct(outlook.now)}"></span>
  </div>
  <span class="num"><b>{fmt(outlook.now)}</b>/{fmt(outlook.allowance)}</span>
  <span class="if">
    {#if outlook.caughtIfWin}⚠ {gatekeeper ? 'its toll' : 'a win'} now gets you caught{:else}win now → {fmt(outlook.ifWin)}{/if}
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
  .flash .bar {
    box-shadow: 0 0 0 2px var(--warn);
  }
</style>
