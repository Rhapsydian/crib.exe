<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { sound } from './sound';
  import { gambleWidths, rollMs, rollPath, rollPosition, rollTarget, segmentAt } from './roll';
  import type { OutcomeTone } from './visit-text';

  // An Event roll played out (v0.9.0, the user's design; the path is
  // roll.ts): a bar of the choice's outcomes and a marker that sweeps,
  // ticking as it crosses into each segment, and settles in the one rolled.
  // A risky choice's bar is its true odds, and the rolled segment lights
  // up. A gamble's segments shift (its odds are unknown) and say "?",
  // coloured good or bad all the same (the user's call); the
  // rolled one then fills the bar, so the odds never show. Tap to skip.
  let {
    odds,
    tones,
    landed,
    gamble,
    result,
    fast = false,
    onsettled,
  }: {
    /** Each outcome's probability. */
    odds: number[];
    tones: OutcomeTone[];
    /** The outcome the engine rolled. */
    landed: number;
    gamble: boolean;
    /** What the rolled outcome did, shown in a gamble's filled bar. */
    result: string;
    fast?: boolean;
    onsettled: () => void;
  } = $props();

  // Per roll: a gamble's wobble, and where in its segment the marker stops.
  const wobble = odds.map(() => ({ hz: 0.6 + Math.random() * 0.8, phase: Math.random() * 2 * Math.PI }));
  const widthsAt = (ms: number) => (gamble ? gambleWidths(wobble, ms) : odds);
  const scale = fast ? 0.5 : 1;
  const total = rollMs(rollPath(0.5, scale));
  const target = rollTarget(widthsAt(total), landed, Math.random());
  const path = rollPath(target, scale);

  let widths = $state(widthsAt(0));
  let pos = $state(0);
  let settled = $state(false);
  let filled = $state(false);
  let frame = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];

  function settle(): void {
    if (settled) return;
    cancelAnimationFrame(frame);
    widths = widthsAt(total);
    pos = target;
    settled = true;
    sound.play(tones[landed] === 'bad' ? 'rollBad' : 'rollGood');
    if (gamble) {
      timers.push(setTimeout(() => (filled = true), 350));
      timers.push(setTimeout(onsettled, 850));
    } else timers.push(setTimeout(onsettled, 300));
  }

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return settle();
    const start = performance.now();
    let under = -1;
    const step = (now: number) => {
      const ms = now - start;
      if (ms >= total) return settle();
      widths = widthsAt(ms);
      pos = rollPosition(path, ms);
      const at = segmentAt(widths, pos);
      if (at !== under) {
        if (under !== -1) sound.play('rollTick');
        under = at;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    // Settled regardless, should frames stop (a page in the background).
    timers.push(setTimeout(settle, total + 400));
  });
  onDestroy(() => {
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
  });

  const shown = (i: number) => (filled ? (i === landed ? 1 : 0) : widths[i]);
</script>

<button class="roll" class:gamble class:settled class:filled onclick={settle} aria-label={settled ? 'the roll' : 'skip the roll'}>
  <div class="bar">
    {#each odds as p, i (i)}
      <div class="seg {tones[i]}" class:landed={settled && i === landed} style="flex-basis: {shown(i) * 100}%">
        <span>{filled && i === landed ? result : gamble ? '?' : `${Math.round(p * 100)}%`}</span>
      </div>
    {/each}
  </div>
  {#if !filled}<div class="marker" style="left: {pos * 100}%"></div>{/if}
</button>

<style>
  .roll {
    position: relative;
    display: block;
    width: 100%;
    padding: 6px 0 12px;
    background: none;
    border: none;
    cursor: pointer;
  }
  .settled {
    cursor: default;
  }
  .bar {
    display: flex;
    gap: 2px;
    height: 34px;
  }
  .seg {
    flex-grow: 0;
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    border: 1px solid var(--tone);
    background: color-mix(in srgb, var(--tone) 16%, transparent);
    color: var(--tone);
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    transition: opacity 0.3s;
  }
  .seg.good {
    --tone: var(--accent);
  }
  .seg.bad {
    --tone: var(--danger);
  }
  .seg.mixed {
    --tone: var(--warn);
  }
  /* A risky roll: the rolled segment lights up, the rest dim. */
  .settled .seg:not(.landed) {
    opacity: 0.3;
  }
  .seg.landed {
    background: color-mix(in srgb, var(--tone) 32%, transparent);
  }
  /* A gamble: the rolled segment fills the bar. */
  .filled .seg {
    transition:
      flex-basis 0.45s ease-out,
      opacity 0.3s,
      border-width 0.45s;
  }
  .filled .seg:not(.landed) {
    border-width: 0;
    opacity: 0;
  }
  .marker {
    position: absolute;
    top: 0;
    bottom: 4px;
    width: 3px;
    margin-left: -1.5px;
    background: var(--text);
    border-radius: 2px;
    box-shadow: 0 0 6px rgb(255 255 255 / 50%);
    pointer-events: none;
  }
  .marker::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: -4px;
    border: 5.5px solid transparent;
    border-bottom-color: var(--text);
  }
</style>
