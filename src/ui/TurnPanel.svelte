<script lang="ts">
  import { untrack } from 'svelte';
  import type { Verb } from '../engine/subroutine-types';
  import { countMs, tallyText, type Burst, type TurnPanelState } from './turn-panel';
  import RichText from './RichText.svelte';

  // The detailed turn display (session 82): the turn-taker's subroutines
  // over the middle of the fight screen, lit as they fire, with what each
  // Process did, Hook callouts and the turn's tally. The bands above and
  // below (loadout strips, gauges) stay in view and keep moving. A tap
  // jumps to the totals, a second one closes it (`onskip`).
  //
  // The impact pass (session 82): the tally is big numbers, centred, and
  // each fire sends a burst of dots from the row to the number it adds to
  // (an Empower or Charge to the rows it lands on); the number counts up
  // and pops as they land. Dots are plain spans moved with transform and
  // opacity only, a dozen at most per fire, so they cost next to nothing.
  // `flight` is how long a burst flies (flightMs: shorter at faster turn
  // speeds). A tap-skip lands on the totals, which play no bursts; with
  // reduced motion asked for, the numbers just pop.
  // `waiting`: held on the totals until a tap (the panel closes on a tap).
  let { panel, onskip, flight = 300, waiting = false }: { panel: TurnPanelState; onskip: () => void; flight?: number; waiting?: boolean } = $props();

  let root = $state<HTMLElement | null>(null);
  let fx = $state<HTMLElement | null>(null);
  /** Each tally number as on screen, which trails the panel's while dots fly. */
  let shown = $state<Partial<Record<Verb, number>>>({});
  /** Bumped to replay a number's pop. */
  let pops = $state<Partial<Record<Verb, number>>>({});
  // Not reactive: which turn and step have played; a count per verb, so a
  // landing overtaken by a jump (`set`) leaves the number alone, and one
  // per turn; and each verb's count-up in progress.
  let turnStart = -1;
  let playedAt = -1;
  let epoch = 0;
  const runs: Partial<Record<Verb, number>> = {};
  const counting: Partial<Record<Verb, { from: number; to: number; began: number }>> = {};
  /** Landings scheduled but not yet arrived, per verb. */
  const pending: Partial<Record<Verb, number>> = {};
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  $effect(() => {
    const p = panel;
    untrack(() => play(p));
  });

  function play(p: TurnPanelState) {
    if (p.start !== turnStart) {
      turnStart = p.start;
      playedAt = -1;
      epoch++;
      for (const v of Object.keys(pending) as Verb[]) delete pending[v];
      shown = {};
    }
    if (p.at === playedAt) return;
    playedAt = p.at;
    const flying = !reduced && fx && root ? p.bursts : [];
    const landing = new Set(flying.flatMap((b) => (b.to.kind === 'tally' ? [b.to.verb] : [])));
    for (const item of p.tally) {
      if (shown[item.verb] === item.value) continue;
      if (landing.has(item.verb)) countUp(item.verb, item.value, flight);
      // A count still on its way gets there itself; the totals (or a jump
      // to them) set every number exactly.
      else if (p.ended || !pending[item.verb]) set(item.verb, item.value);
    }
    flying.forEach(spawn);
  }

  function set(verb: Verb, value: number) {
    runs[verb] = (runs[verb] ?? 0) + 1;
    delete counting[verb];
    shown = { ...shown, [verb]: value };
    pops = { ...pops, [verb]: (pops[verb] ?? 0) + 1 };
  }

  /** After `delay` (the dots' flight), count from the number on screen up
   * to `to`, and pop. A later landing on the same number takes over from
   * wherever the count has got to: it never cancels it (the user's report,
   * session 82: a run of Credit fires each cut the last count short, so the
   * number sat still until the totals). */
  function countUp(verb: Verb, to: number, delay: number) {
    const run = runs[verb] ?? 0;
    const turn = epoch;
    pending[verb] = (pending[verb] ?? 0) + 1;
    setTimeout(() => {
      if (turn === epoch) pending[verb] = Math.max(0, (pending[verb] ?? 0) - 1);
      if (turn !== epoch || (runs[verb] ?? 0) !== run) return;
      const count = { from: shown[verb] ?? 0, to, began: performance.now() };
      counting[verb] = count;
      pops = { ...pops, [verb]: (pops[verb] ?? 0) + 1 };
      const frame = (now: number) => {
        if (counting[verb] !== count || turn !== epoch) return;
        const t = Math.min(1, (now - count.began) / countMs(flight));
        shown = { ...shown, [verb]: t < 1 ? Math.max(count.from, Math.floor(count.from + (count.to - count.from) * t)) : count.to };
        if (t < 1) requestAnimationFrame(frame);
        else delete counting[verb];
      };
      requestAnimationFrame(frame);
    }, delay);
  }

  const centre = (el: Element, box: DOMRect) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
  };

  /** One burst: dots on an arc from the row's value to its target. */
  function spawn(b: Burst) {
    if (!root || !fx) return;
    const box = root.getBoundingClientRect();
    const rows = root.querySelectorAll('.rows > .row');
    const fromEl = rows[b.from]?.querySelector('.line .did');
    if (!fromEl) return;
    const from = centre(fromEl, box);
    const toEl =
      b.to.kind === 'tally' ? root.querySelector(`.num[data-verb="${b.to.verb}"] b`) : b.to.kind === 'row' ? rows[b.to.index]?.querySelector('.line .did') : null;
    if (b.to.kind !== 'fizzle' && !toEl) return;
    const to = toEl ? centre(toEl, box) : from;
    const count = b.mixed ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.color = b.to.kind === 'fizzle' ? 'var(--warn)' : b.tone === 'hook' || (b.mixed && i % 2) ? 'var(--mod)' : 'var(--side)';
      fx.appendChild(dot);
      const sx = from.x + (Math.random() - 0.5) * 24;
      const sy = from.y + (Math.random() - 0.5) * 8;
      let frames: Keyframe[];
      if (b.to.kind === 'fizzle') {
        const a = Math.random() * Math.PI * 2;
        const d = 10 + Math.random() * 16;
        frames = [
          { transform: `translate(${sx}px, ${sy}px) scale(1)`, opacity: 1 },
          { transform: `translate(${sx + Math.cos(a) * d}px, ${sy + Math.sin(a) * d}px) scale(0.2)`, opacity: 0 },
        ];
      } else {
        // A quadratic arc, bowed sideways by a random amount, sampled.
        const dx = to.x - sx;
        const dy = to.y - sy;
        const len = Math.hypot(dx, dy) || 1;
        const bow = (Math.random() - 0.5) * Math.min(120, len * 0.6);
        const cx = (sx + to.x) / 2 - (dy / len) * bow;
        const cy = (sy + to.y) / 2 + (dx / len) * bow;
        frames = [0, 0.25, 0.5, 0.75, 1].map((t) => {
          const u = 1 - t;
          const x = u * u * sx + 2 * u * t * cx + t * t * to.x;
          const y = u * u * sy + 2 * u * t * cy + t * t * to.y;
          return { transform: `translate(${x}px, ${y}px) scale(${1 - t * 0.4})`, opacity: t === 1 ? 0.3 : 1 };
        });
      }
      const spread = flight * 0.2;
      const anim = dot.animate(frames, { duration: flight - spread, delay: (spread * i) / count, easing: 'ease-in', fill: 'backwards' });
      anim.onfinish = () => dot.remove();
      anim.oncancel = () => dot.remove();
    }
    // An Empower or Charge: the row it lands on pops as the dots arrive.
    if (b.to.kind === 'row' && toEl) {
      setTimeout(() => (toEl as HTMLElement).animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' }), flight);
    }
  }

  // Keep the lit row in view when a long loadout overflows the panel.
  let list = $state<HTMLElement | null>(null);
  $effect(() => {
    const firing = panel.rows.findIndex((r) => r.state === 'firing');
    if (firing < 0 || !list) return;
    list.children[firing]?.scrollIntoView({ block: 'nearest' });
  });
</script>

<button class="turn-panel" bind:this={root} class:them={panel.side === 1} onclick={onskip} aria-label={panel.ended ? 'close the turn' : 'skip to the turn’s totals'}>
  <div class="head">
    <b>▶ {panel.side === 0 ? 'YOUR' : 'THEIR'} TURN</b>
    <span class="hint" class:waiting>{waiting ? 'tap to continue ▸' : panel.ended ? 'tap to close' : 'tap to skip'}</span>
  </div>
  {#each panel.notes.filter((n) => n.tone === 'burner') as note, i (i)}
    <div class="note burner">{note.text}</div>
  {/each}
  <ol class="rows" bind:this={list}>
    {#each panel.rows as row, i (i)}
      <li class="row {row.state}">
        <div class="line">
          <span class="name"><span class="slot">{i + 1}</span>{row.name}</span>
          <span class="did">{row.state === 'pending' ? '…' : row.state === 'skipped' ? 'skipped' : row.process}</span>
        </div>
        {#if row.empower && row.state !== 'pending'}
          <div class="boost" class:wasted={row.empower.wasted}>{row.empower.text}</div>
        {/if}
        {#if row.hook}
          <div class="hook">
            <div class="line"><span><span class="tag">HOOK</span></span><span class="did">{row.hook.effect}</span></div>
            {#if row.hook.why}<div class="why"><RichText text={row.hook.why} /></div>{/if}
          </div>
        {/if}
        {#if row.mods.length}<div class="mods">◆ {row.mods.join(', ')}</div>{/if}
      </li>
    {/each}
  </ol>
  {#each panel.notes.filter((n) => n.tone !== 'burner') as note, i (i)}
    <div class="note {note.tone}">{note.text}</div>
  {/each}
  <div class="tally" class:final={panel.ended}>
    {#if panel.tally.length}
      {#each panel.tally as item (item.verb)}
        <div class="num" data-verb={item.verb}>
          {#key pops[item.verb]}<b class:pop={!!pops[item.verb]}>{tallyText({ value: shown[item.verb] ?? 0, counted: item.counted })}</b>{/key}
          <span>{item.label}</span>
        </div>
      {/each}
    {:else}
      <span class="quiet">…</span>
    {/if}
  </div>
  <div class="fx" bind:this={fx} aria-hidden="true"></div>
</button>

<style>
  .turn-panel {
    --side: var(--accent);
    position: absolute;
    inset: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 7px 9px;
    text-align: left;
    font: inherit;
    color: var(--text);
    background: var(--bg-raised);
    border: 1px solid var(--side);
    border-radius: var(--radius);
    overflow: hidden;
    cursor: pointer;
    animation: panel-in 0.18s ease-out;
  }
  .turn-panel.them {
    --side: var(--danger);
  }
  @keyframes panel-in {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
  }
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    color: var(--side);
    font-size: 13px;
    letter-spacing: 0.1em;
  }
  .hint {
    font-size: 10px;
    letter-spacing: 0;
    color: var(--text-dim);
  }
  .hint.waiting {
    font-size: 12px;
    font-weight: 700;
    color: var(--side);
    animation: beckon 1.1s ease-in-out infinite;
  }
  @keyframes beckon {
    50% {
      opacity: 0.45;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hint.waiting {
      animation: none;
    }
  }
  .rows {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row {
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid transparent;
    font-size: 12px;
    transition: background 0.15s, border-color 0.15s;
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .slot {
    display: inline-block;
    width: 1.4em;
    color: var(--text-dim);
  }
  .did {
    flex: none;
    max-width: 60%;
    text-align: right;
  }
  .row.pending .did,
  .row.skipped {
    color: var(--text-dim);
  }
  .row.fired .did {
    color: var(--side);
  }
  .row.firing {
    background: var(--bg-sunken);
    border-color: var(--side);
  }
  .row.firing .did {
    color: var(--side);
    font-weight: 700;
  }
  /* Empower it took, right-aligned under what it did; a wasted "next"
     Empower in the warning colour (session 82). */
  .boost {
    text-align: right;
    font-size: 10.5px;
    color: var(--side);
  }
  .boost.wasted {
    color: var(--warn);
  }
  .hook {
    margin: 2px 0 0 1.4em;
    padding-left: 6px;
    border-left: 2px solid var(--mod);
  }
  .hook .did {
    color: var(--mod);
  }
  .tag {
    font-size: 9px;
    padding: 0 4px;
    border-radius: 3px;
    border: 1px solid var(--mod);
    color: var(--mod);
    letter-spacing: 0.08em;
  }
  .why {
    font-size: 10.5px;
    line-height: 1.3;
    color: var(--text-dim);
  }
  .mods {
    margin-left: 1.4em;
    font-size: 10.5px;
    color: var(--mod);
  }
  .note {
    font-size: 11px;
    color: var(--mod);
  }
  .note.burner,
  .note.strain {
    color: var(--warn);
  }
  /* The tally (the impact pass): big numbers, centred, side by side. */
  .tally {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 26px;
    padding: 8px 0 2px;
    border-top: 1px dashed var(--line);
  }
  .num {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 3em;
  }
  .num b {
    font-size: 30px;
    line-height: 1.05;
    color: var(--side);
    font-variant-numeric: tabular-nums;
  }
  .num span {
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .tally.final .num b {
    text-shadow: 0 0 12px color-mix(in srgb, var(--side) 55%, transparent);
  }
  .tally .quiet {
    font-size: 22px;
    color: var(--text-dim);
  }
  .pop {
    animation: pop 0.32s ease-out;
  }
  @keyframes pop {
    from {
      transform: scale(1.35);
      text-shadow: 0 0 16px var(--side);
    }
  }
  /* The boost a row took pops as it fires. */
  .row.firing .boost:not(.wasted) {
    transform-origin: right center;
    animation: pop 0.32s ease-out;
  }
  /* The dots fly over everything in the panel (the user, session 82: they
     were lost behind the rows), each with a dark ring so it stands out
     from text in its own colour. */
  .fx {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
    overflow: hidden;
  }
  .fx :global(.dot) {
    position: absolute;
    left: -4px;
    top: -4px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: radial-gradient(circle, #fff 0 25%, currentColor 45%);
    box-shadow:
      0 0 0 1.5px var(--bg-raised),
      0 0 10px 2px currentColor;
    will-change: transform, opacity;
  }
</style>
