<script lang="ts">
  import { DOUBLE_SKUNK_THRESHOLD, SKUNK_THRESHOLD, WIN_SCORE } from '../engine/basic-cribbage';

  // The score as minimal bars (milestone 4, V7 -- pegboard mockup C): a
  // bar per player filling to 121, the front peg its end, the back peg a
  // ghost tick (the gap is the last score), the skunk lines dashed.
  let { pegs, names = ['YOU', 'OPP'] }: { pegs: [[number, number], [number, number]]; names?: [string, string] } = $props();
  const COLORS = ['var(--accent)', 'var(--danger)'];
  const at = (score: number) => `${(Math.min(score, WIN_SCORE) / WIN_SCORE) * 100}%`;
</script>

<div class="bars">
  {#each [1, 0] as const as p (p)}
    <div class="row" title="{names[p]}: {pegs[p][0]} of {WIN_SCORE}">
      <span class="who" style="color: {COLORS[p]}">{names[p]}</span>
      <div class="bar">
        <span class="fill" style="width: {at(pegs[p][0])}; background: {COLORS[p]}"></span>
        <span class="ghost" style="left: {at(pegs[p][1])}; border-color: {COLORS[p]}"></span>
        <span class="line" style="left: {at(DOUBLE_SKUNK_THRESHOLD)}"></span>
        <span class="line" style="left: {at(SKUNK_THRESHOLD)}"></span>
      </div>
      <span class="num">{pegs[p][0]}</span>
    </div>
  {/each}
</div>

<style>
  .bars {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .who {
    width: 30px;
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
    opacity: 0.85;
    transition: width 0.3s ease-out;
  }
  .ghost {
    position: absolute;
    top: -3px;
    bottom: -3px;
    width: 0;
    border-left: 2px solid;
    opacity: 0.55;
    transition: left 0.3s ease-out;
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
    width: 30px;
    text-align: right;
    font-size: 13px;
  }
</style>
