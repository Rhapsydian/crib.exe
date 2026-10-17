<script lang="ts">
  import type { CombatSideState, GaugeReading } from '../engine/resolve';

  // One side's meters: the win gauge (Breach for you, Containment for
  // them), initiative toward the next turn, Ward, and -- yours only --
  // Trace. `compact` collapses to a single line for tight layouts.
  // `reading`, when given, overrides the side's live state: the turn
  // step-through (P4) shows the meters as they stood after each fire.
  // `mods` / `burners` add ◆ / ⏏︎ count chips (tap: `onkit`); `flashMods`
  // lights the ◆ chip while one of this side's Mods acts.
  let {
    side,
    reading,
    isPlayer,
    compact = false,
    mods = 0,
    burners = 0,
    flashMods = false,
    onkit,
  }: {
    side: CombatSideState;
    reading?: GaugeReading | null;
    isPlayer: boolean;
    compact?: boolean;
    mods?: number;
    burners?: number;
    flashMods?: boolean;
    onkit?: () => void;
  } = $props();

  const g = $derived(
    reading ?? {
      win: side.winGauge.progress,
      winThreshold: side.winGauge.threshold,
      initiative: side.gauge.progress,
      initiativeThreshold: side.gauge.threshold,
      ward: side.wardShield,
      trace: side.trace,
    },
  );
  const win = $derived(Math.min(1, g.win / g.winThreshold));
  const init = $derived(Math.min(1, g.initiative / g.initiativeThreshold));
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
</script>

<div class="gauges" class:compact>
  <div class="row">
    <span class="label">{isPlayer ? 'BREACH' : 'CONTAIN'}</span>
    <div class="bar win" class:enemy={!isPlayer}><span style="width: {win * 100}%"></span></div>
    <span class="num">{fmt(g.win)}/{fmt(g.winThreshold)}</span>
  </div>
  <div class="row">
    <span class="label">INIT</span>
    <div class="bar init"><span style="width: {init * 100}%"></span></div>
    <span class="num">{fmt(g.initiative)}/{fmt(g.initiativeThreshold)}</span>
  </div>
  <div class="row chips">
    <span class="chip ward" title="Ward">⛨ {fmt(g.ward)}</span>
    {#if isPlayer}<span class="chip trace" title="Trace">◉ {fmt(g.trace)}</span>{/if}
    {#if mods > 0}<button class="chip mod" class:flash={flashMods} title="Mods" onclick={onkit}>◆ {mods}</button>{/if}
    {#if burners > 0}<button class="chip burner" title="Burners" onclick={onkit}>⏏︎ {burners}</button>{/if}
  </div>
</div>

<style>
  .gauges {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 11px;
  }
  .compact {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 10px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .compact .row {
    flex: 1 1 140px;
  }
  .compact .chips {
    flex: none;
  }
  .label {
    width: 56px;
    color: var(--text-dim);
    letter-spacing: 0.05em;
  }
  .compact .label {
    width: auto;
  }
  .bar {
    flex: 1;
    height: 8px;
    background: var(--bg-sunken);
    border: 1px solid var(--line);
    border-radius: 3px;
    overflow: hidden;
    min-width: 40px;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.2s ease-out;
  }
  .bar.enemy span {
    background: var(--danger);
  }
  .bar.init span {
    background: var(--suit-overclock);
  }
  .num {
    width: 48px;
    text-align: right;
    color: var(--text-dim);
  }
  .chip {
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid var(--line);
  }
  .ward {
    color: var(--ward);
  }
  .trace {
    color: var(--trace);
  }
  button.chip {
    background: transparent;
    font: inherit;
    cursor: pointer;
  }
  .mod {
    color: var(--mod);
    border-color: var(--mod);
  }
  .burner {
    color: var(--warn);
  }
  .mod.flash {
    animation: chip-flash 0.5s ease-out;
  }
  @keyframes chip-flash {
    0%,
    60% {
      background: var(--mod);
      color: var(--bg);
      transform: scale(1.15);
    }
  }
</style>
