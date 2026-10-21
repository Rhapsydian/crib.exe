<script lang="ts">
  // A trace evasion's score (session 63): the two totals, the gap you must
  // close (you escape only strictly ahead -- a tie goes to the network),
  // and which of the three hands this is.
  let { scores, name, hand, hands, headStart }: { scores: [number, number]; name: string; hand: number; hands: number; headStart: number } = $props();
  const gap = $derived(scores[0] - scores[1]);
</script>

<div class="score">
  <div class="side you"><span class="who">YOU</span><b>{scores[0]}</b></div>
  <div class="mid">
    <div class="gap" class:ahead={gap > 0}>{gap > 0 ? `${gap} ahead` : gap === 0 ? 'level: a tie goes to it' : `${-gap} behind`}</div>
    <div class="sub">hand {hand} of {hands} · it started {headStart} up</div>
  </div>
  <div class="side them"><b>{scores[1]}</b><span class="who">{name}</span></div>
</div>

<style>
  .score {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-sunken);
  }
  .side {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
  }
  .side b {
    font-size: 22px;
  }
  .you b,
  .you .who {
    color: var(--accent);
  }
  .them b,
  .them .who {
    color: var(--danger);
  }
  .who {
    font-size: 10px;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mid {
    flex: 1;
    text-align: center;
    min-width: 0;
  }
  .gap {
    font-size: 13px;
    color: var(--danger);
  }
  .gap.ahead {
    color: var(--accent);
  }
  .sub {
    font-size: 10px;
    color: var(--text-dim);
  }
</style>
