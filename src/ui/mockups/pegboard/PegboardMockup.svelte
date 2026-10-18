<script lang="ts">
  import { playCribbageGame, SKUNK_THRESHOLD, DOUBLE_SKUNK_THRESHOLD, WIN_SCORE, type CribbageBeat } from '../../../engine/basic-cribbage';

  // Milestone 4 checkpoint 2 (V6): pegboard mockups. Three takes on the
  // score -- a two-track strip, a folded "street" board, and minimal bars
  // -- all replaying the same real game (basic-cribbage.ts), so they can
  // be compared side by side. Each player has two pegs that leapfrog: the
  // back peg jumps ahead of the front by the points scored, so the gap
  // between them is always the last score.

  let seed = $state(7);
  const game = $derived(playCribbageGame({ seed, skills: [0.75, 0.75] }));
  // Only beats that scored.
  const scoring = $derived(game.timeline.filter((b, i, all) => i === 0 || b.scores[0] !== all[i - 1].scores[0] || b.scores[1] !== all[i - 1].scores[1]));
  let step = $state(0);
  let playing = $state(true);
  let speed = $state(450);

  $effect(() => {
    void seed;
    step = 0;
  });
  $effect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      if (step < scoring.length - 1) step++;
      else playing = false;
    }, speed);
    return () => clearInterval(t);
  });

  /** Each player's two pegs after `upTo` scoring beats: [front, back]. */
  function pegsAt(upTo: number): [[number, number], [number, number]] {
    const pegs: [[number, number], [number, number]] = [
      [0, 0],
      [0, 0],
    ];
    let prev: [number, number] = [0, 0];
    for (let i = 0; i <= upTo && i < scoring.length; i++) {
      const s = scoring[i].scores;
      for (const p of [0, 1] as const) if (s[p] !== prev[p]) pegs[p] = [s[p], prev[p]];
      prev = s;
    }
    return pegs;
  }
  const pegs = $derived(pegsAt(step));
  const beat = $derived<CribbageBeat | undefined>(scoring[step]);
  const scores = $derived(beat?.scores ?? [0, 0]);

  /** The last score, in words. */
  const caption = $derived.by(() => {
    if (!beat || step === 0) return 'new game';
    const prev = scoring[step - 1].scores;
    const who = beat.scores[0] !== prev[0] ? 0 : 1;
    const pts = beat.scores[who] - prev[who];
    const name = who === 0 ? 'you' : 'opponent';
    const what =
      beat.kind === 'cut'
        ? 'His Heels'
        : beat.kind === 'peg'
          ? beat.event.type === 'go-point'
            ? 'go / last card'
            : 'pegging'
          : beat.kind === 'show'
            ? beat.owner === 'crib'
              ? 'crib'
              : 'hand'
            : '';
    return `${name} +${pts} · ${what}`;
  });
  const winner = $derived(step === scoring.length - 1 ? game.winner : null);

  // --- Board geometry -------------------------------------------------
  const GAP = 3.2; // extra space between groups of five
  const PITCH = 5.4;
  /** x of hole `i` (0-based) in a row, holes grouped in fives. */
  const rowX = (i: number, pad = 4) => pad + i * PITCH + Math.floor(i / 5) * GAP;
  const rowWidth = (n: number, pad = 4) => rowX(n - 1, pad) + pad;

  // A: the strip -- per player, 1-60 on top, 61-120 below, then the finish.
  const STRIP_W = rowWidth(60) + 10;
  function stripPos(score: number, player: 0 | 1): { x: number; y: number } {
    const top = player === 0 ? 6 : 30;
    if (score <= 0) return { x: 1.5, y: top + 4 };
    if (score >= WIN_SCORE) return { x: STRIP_W - 4, y: top + 4 };
    const i = score - 1;
    return { x: rowX(i % 60), y: top + (i < 60 ? 0 : 8) };
  }

  // B: the street board -- three streets of 40, out / back / out, the two
  // players' tracks side by side in each street.
  const STREET_W = rowWidth(40) + 6;
  function streetPos(score: number, player: 0 | 1): { x: number; y: number } {
    const lane = (street: number) => 6 + street * 22 + player * 7;
    if (score <= 0) return { x: 1.5, y: lane(0) };
    if (score >= WIN_SCORE) return { x: STREET_W - 3, y: lane(2) };
    const i = score - 1;
    const street = Math.floor(i / 40);
    const along = i % 40;
    const col = street === 1 ? 39 - along : along;
    return { x: rowX(col, 5), y: lane(street) };
  }

  const holes = (count: number) => Array.from({ length: count }, (_, i) => i);
  const COLORS = ['var(--accent)', 'var(--danger)'];
  const isMarker = (score: number) => score === SKUNK_THRESHOLD || score === DOUBLE_SKUNK_THRESHOLD;
</script>

<div class="page">
  <div class="head">
    <b>Pegboard mockups</b>
    <span class="dim">milestone 4 · V6 · one real game, replayed</span>
  </div>
  <div class="controls">
    <button onclick={() => (playing = !playing)}>{playing ? '❚❚ pause' : '▶ play'}</button>
    <button onclick={() => step > 0 && step--}>◀</button>
    <button onclick={() => step < scoring.length - 1 && step++}>▶</button>
    <button onclick={() => { seed++; playing = true; }}>new game</button>
    <label class="dim">speed <select bind:value={speed}><option value={800}>slow</option><option value={450}>normal</option><option value={150}>fast</option></select></label>
  </div>
  <div class="status">
    <span style="color: var(--accent)">you {scores[0]}</span>
    <span style="color: var(--danger)">opponent {scores[1]}</span>
    <span class="dim">{winner === null ? caption : `${winner === 0 ? 'you win' : 'opponent wins'}${game.skunk !== 'none' ? ` · ${game.skunk === 'double' ? 'double ' : ''}skunk` : ''}`}</span>
  </div>

  <!-- A: strip -->
  <section>
    <div class="title">A · two-track strip</div>
    <div class="about">Each player's track runs 1-60, then 61-120 below it, then the finish. Slim enough to sit across the top of a phone.</div>
    <svg viewBox="0 0 {STRIP_W} 50" class="board">
      {#each [0, 1] as const as p (p)}
        {#each holes(120) as i (i)}
          {@const pos = stripPos(i + 1, p)}
          <circle cx={pos.x} cy={pos.y} r={isMarker(i + 1) ? 1.25 : 0.9} class="hole" class:marker={isMarker(i + 1)} />
        {/each}
        {@const fin = stripPos(WIN_SCORE, p)}
        <circle cx={fin.x} cy={fin.y} r="1.8" class="finish" />
        {#each pegs[p] as score, k (k)}
          {@const pos = stripPos(score, p)}
          <circle r={k === 0 ? 1.9 : 1.5} class="peg" style="transform: translate({pos.x}px, {pos.y}px); fill: {COLORS[p]}; opacity: {k === 0 ? 1 : 0.55}" />
        {/each}
      {/each}
      <text x="1" y="47" class="label">orange holes: 61 (double skunk) and 91 (skunk)</text>
    </svg>
  </section>

  <!-- B: street board -->
  <section>
    <div class="title">B · folded street board</div>
    <div class="about">The classic board: three streets of 40 (out, back, out), both players' tracks side by side. Reads like a real pegboard.</div>
    <svg viewBox="0 0 {STREET_W} 72" class="board">
      {#each [0, 1, 2] as street (street)}
        <rect x="1" y={2 + street * 22} width={STREET_W - 2} height="15" rx="2" class="street" />
        <text x={STREET_W / 2} y={21.5 + street * 22} class="dir">{street === 1 ? '◂ back' : 'out ▸'}</text>
      {/each}
      {#each [0, 1] as const as p (p)}
        {#each holes(120) as i (i)}
          {@const pos = streetPos(i + 1, p)}
          <circle cx={pos.x} cy={pos.y} r={isMarker(i + 1) ? 1.3 : 0.95} class="hole" class:marker={isMarker(i + 1)} />
        {/each}
        {@const fin = streetPos(WIN_SCORE, p)}
        <circle cx={fin.x} cy={fin.y} r="1.8" class="finish" />
        {#each pegs[p] as score, k (k)}
          {@const pos = streetPos(score, p)}
          <circle r={k === 0 ? 2 : 1.6} class="peg" style="transform: translate({pos.x}px, {pos.y}px); fill: {COLORS[p]}; opacity: {k === 0 ? 1 : 0.55}" />
        {/each}
      {/each}
    </svg>
  </section>

  <!-- C: bars -->
  <section>
    <div class="title">C · minimal bars</div>
    <div class="about">Two progress bars with the pegs as markers -- the back peg a ghost tick -- and the skunk lines. Matches combat's gauges.</div>
    {#each [0, 1] as const as p (p)}
      <div class="bar-row">
        <span class="who" style="color: {COLORS[p]}">{p === 0 ? 'YOU' : 'OPP'}</span>
        <div class="bar">
          <span class="fill" style="width: {(pegs[p][0] / WIN_SCORE) * 100}%; background: {COLORS[p]}"></span>
          <span class="ghost" style="left: {(pegs[p][1] / WIN_SCORE) * 100}%; border-color: {COLORS[p]}"></span>
          <span class="line" style="left: {(DOUBLE_SKUNK_THRESHOLD / WIN_SCORE) * 100}%"></span>
          <span class="line" style="left: {(SKUNK_THRESHOLD / WIN_SCORE) * 100}%"></span>
        </div>
        <span class="num">{pegs[p][0]}</span>
      </div>
    {/each}
  </section>

  <a class="dim back" href="#run">◂ back to the game</a>
</div>

<style>
  .page {
    max-width: 640px;
    margin: 0 auto;
    padding: var(--gutter);
    /* Clear of the mockup switcher bar fixed across the top. */
    padding-top: calc(48px + env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 12px;
  }
  .head {
    display: flex;
    gap: 8px;
    align-items: baseline;
    flex-wrap: wrap;
  }
  .head b {
    color: var(--accent);
    font-size: 15px;
  }
  .dim {
    color: var(--text-dim);
  }
  .controls {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .controls button,
  .controls select {
    padding: 4px 9px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font: inherit;
    font-size: 11px;
  }
  .status {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 13px;
  }
  section {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .title {
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .about {
    color: var(--text-dim);
    font-size: 11px;
    line-height: 1.35;
  }
  .board {
    width: 100%;
    height: auto;
    background: var(--bg-sunken);
    border-radius: 4px;
  }
  .hole {
    fill: var(--line);
  }
  .hole.marker {
    fill: var(--warn);
  }
  .finish {
    fill: none;
    stroke: var(--text-dim);
    stroke-width: 0.5;
  }
  .peg {
    transition: transform 0.35s ease-out;
    filter: drop-shadow(0 0 1.2px currentColor);
  }
  .street {
    fill: none;
    stroke: var(--line);
    stroke-width: 0.4;
  }
  .dir {
    fill: var(--text-dim);
    font-size: 3.2px;
    text-anchor: middle;
  }
  .label {
    fill: var(--text-dim);
    font-size: 3px;
  }
  .bar-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .who {
    width: 28px;
    font-size: 11px;
    letter-spacing: 0.05em;
  }
  .bar {
    position: relative;
    flex: 1;
    height: 10px;
    background: var(--bg-sunken);
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    transition: width 0.35s ease-out;
    opacity: 0.85;
  }
  .ghost {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 0;
    border-left: 2px solid;
    opacity: 0.55;
    transition: left 0.35s ease-out;
  }
  .line {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 0;
    border-left: 1px dashed var(--warn);
    opacity: 0.6;
  }
  .num {
    width: 28px;
    text-align: right;
  }
  .back {
    font-size: 11px;
  }
</style>
