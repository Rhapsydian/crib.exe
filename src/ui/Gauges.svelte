<script lang="ts">
  import type { CombatSideState, GaugeReading } from '../engine/resolve';
  import { tip } from './tip';

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
    modNames = [],
    burnerNames = [],
  }: {
    side: CombatSideState;
    reading?: GaugeReading | null;
    isPlayer: boolean;
    compact?: boolean;
    mods?: number;
    burners?: number;
    flashMods?: boolean;
    onkit?: () => void;
    modNames?: string[];
    burnerNames?: string[];
  } = $props();

  // Hover tips (desktop): what each meter is.
  const tips = $derived({
    win: isPlayer
      ? 'Breach: your win gauge. Your Credit fills it; their Suppress drains it. Fill it to break in.'
      : 'Containment: their win gauge. Their Credit fills it; your Suppress drains it. If it fills, you are locked out.',
    init: isPlayer
      ? 'Initiative: points you score fill it. When it fills, your loadout fires, top to bottom (a turn).'
      : 'Initiative: points they score fill it. When it fills, their loadout fires (a turn).',
    ward: isPlayer ? 'Ward: absorbs Credit aimed at you before it reaches their gauge.' : 'Ward: absorbs your Credit before it reaches your gauge.',
    trace: 'Trace: how visible you are. What you carry out of the fight becomes Heat.',
    mods: `Mods: ${modNames.join(', ')}. Click to see them.`,
    burners: `Burners: ${burnerNames.join(', ')}. Offered before each of your turns.`,
  });

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
  <div class="row" use:tip={tips.win}>
    <span class="label">{isPlayer ? 'BREACH' : 'CONTAIN'}</span>
    <div class="bar win" class:enemy={!isPlayer}><span style="width: {win * 100}%"></span></div>
    <span class="num">{fmt(g.win)}/{fmt(g.winThreshold)}</span>
  </div>
  <div class="row" use:tip={tips.init}>
    <span class="label">INIT</span>
    <div class="bar init"><span style="width: {init * 100}%"></span></div>
    <span class="num">{fmt(g.initiative)}/{fmt(g.initiativeThreshold)}</span>
  </div>
  <div class="row chips">
    <span class="chip ward" use:tip={tips.ward}>⛨ {fmt(g.ward)}</span>
    {#if isPlayer}<span class="chip trace" use:tip={tips.trace}>◉ {fmt(g.trace)}</span>{/if}
    {#if mods > 0}<button class="chip mod" class:flash={flashMods} onclick={onkit} use:tip={tips.mods}>◆ {mods}</button>{/if}
    {#if burners > 0}<button class="chip burner" onclick={onkit} use:tip={tips.burners}>⏏︎ {burners}</button>{/if}
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
  /* The information badges (Ward, Trace, Mods, Burners) always take
     their own line under the meters (the user's call). */
  .compact .chips {
    flex: 1 0 100%;
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
