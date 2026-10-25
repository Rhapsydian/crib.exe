<script lang="ts">
  import type { CombatSideState, GaugeReading } from '../engine/resolve';
  import { tip } from './tip';
  import { untrack } from 'svelte';

  // One side's meters: the win gauge (Breach for you, Containment for
  // them), initiative toward the next turn, Ward, and -- yours only, once
  // an alarm has gone off -- the Heat raised this fight. `compact` collapses to a single line for tight layouts.
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
    ending = false,
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
    /** This gauge just filled and ended the fight: it blinks (session 63). */
    ending?: boolean;
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
    heat: 'Alarms: Heat their alarms have added to this layer so far this fight.',
    mods: `Mods: ${modNames.join(', ')}. Click to see them.`,
    burners: `Burners: ${burnerNames.join(', ')}. Offered before each of your turns.`,
  });

  const g = $derived(
    reading ?? {
      win: side.winGauge.progress,
      winThreshold: side.winGauge.threshold,
      initiative: side.gauge.progress,
      initiativeThreshold: side.gauge.threshold,
      initiativeFills: side.gauge.fills ?? 0,
      ward: side.wardShield,
      heat: side.heat,
    },
  );
  const win = $derived(Math.min(1, g.win / g.winThreshold));
  const init = $derived(Math.min(1, g.initiative / g.initiativeThreshold));
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  // The initiative bar only fills left to right (session 72, the user's
  // ask): when the gauge fills (its count of fills rises), the bar fills to
  // the end, flashes once, resets to the left without animating, then fills
  // to what's left over. A real drain (initiative taken away) still
  // shrinks it, and a turn a Mod grants outright leaves it alone.
  const WRAP_MS = 220;
  const fills = $derived(g.initiativeFills ?? 0);
  let shownInit = $state(0);
  let instant = $state(false);
  let filled = $state(false);
  let fillsSeen: number | null = null;
  let latest = 0;
  let wrapping: ReturnType<typeof setTimeout> | null = null;
  $effect(() => {
    const target = init;
    const f = fills;
    untrack(() => {
      latest = target;
      if (fillsSeen === null || f < fillsSeen) {
        // A rewind (or the first reading) also calls off a wrap under
        // way, so a fill the readings took back never plays out.
        if (wrapping) clearTimeout(wrapping);
        wrapping = null;
        instant = false;
        filled = false;
        fillsSeen = f;
        shownInit = target;
        return;
      }
      if (f > fillsSeen) {
        fillsSeen = f;
        if (wrapping) clearTimeout(wrapping);
        instant = false;
        shownInit = 1;
        filled = true;
        wrapping = setTimeout(() => {
          instant = true;
          shownInit = 0;
          // A short beat so the reset paints before the fill animates again
          // (a timer, not animation frames, which stall in a background tab
          // and would leave the bar stuck at empty).
          wrapping = setTimeout(() => {
            instant = false;
            filled = false;
            wrapping = null;
            shownInit = latest;
          }, 40);
        }, WRAP_MS);
        return;
      }
      if (!wrapping) shownInit = target;
    });
  });
  $effect(() => () => {
    if (wrapping) clearTimeout(wrapping);
  });
</script>

<div class="gauges" class:compact>
  <div class="row" use:tip={tips.win}>
    <span class="label">{isPlayer ? 'BREACH' : 'CONTAIN'}</span>
    <div class="bar win" class:enemy={!isPlayer} class:ending><span style="width: {win * 100}%"></span></div>
    <span class="num">{fmt(g.win)}/{fmt(g.winThreshold)}</span>
  </div>
  <div class="row" use:tip={tips.init}>
    <span class="label">INIT</span>
    <div class="bar init" class:filled><span class:instant style="width: {shownInit * 100}%"></span></div>
    <span class="num">{fmt(g.initiative)}/{fmt(g.initiativeThreshold)}</span>
  </div>
  <div class="row chips">
    <span class="chip ward" use:tip={tips.ward}>⛨ {fmt(g.ward)}</span>
    {#if isPlayer && g.heat > 0}<span class="chip heat" use:tip={tips.heat}>▲ {fmt(g.heat)}</span>{/if}
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
  /* The information badges (Ward, alarm Heat, Mods, Burners) always take
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
  /* The gauge that ended the fight: three short blinks before the result
     card (the user's pattern). */
  .bar.win.ending {
    animation: gauge-end 0.9s linear both;
  }
  @keyframes gauge-end {
    0%,
    16% {
      box-shadow: 0 0 0 2px var(--accent);
    }
    17%,
    33% {
      box-shadow: none;
    }
    34%,
    50% {
      box-shadow: 0 0 0 2px var(--accent);
    }
    51%,
    67% {
      box-shadow: none;
    }
    68%,
    84% {
      box-shadow: 0 0 0 2px var(--accent);
    }
    85%,
    100% {
      box-shadow: none;
    }
  }
  .bar.win.enemy.ending {
    animation-name: gauge-end-enemy;
  }
  @keyframes gauge-end-enemy {
    0%,
    16% {
      box-shadow: 0 0 0 2px var(--danger);
    }
    17%,
    33% {
      box-shadow: none;
    }
    34%,
    50% {
      box-shadow: 0 0 0 2px var(--danger);
    }
    51%,
    67% {
      box-shadow: none;
    }
    68%,
    84% {
      box-shadow: 0 0 0 2px var(--danger);
    }
    85%,
    100% {
      box-shadow: none;
    }
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
  .bar span.instant {
    transition: none;
  }
  /* The turn's flash: once, as the bar fills. */
  .bar.init.filled {
    animation: init-flash 0.32s ease-out;
  }
  @keyframes init-flash {
    0%,
    50% {
      box-shadow: 0 0 0 2px var(--suit-overclock);
      background: var(--suit-overclock);
    }
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
  .heat {
    color: var(--heat);
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
