<script lang="ts">
  // A trace evasion's score (session 63; laid out again in v0.9.1, the
  // user's ask: centred, the name never cut off). Three equal columns:
  // you, the hand (one dot each), them, each name above its score; then
  // the gap you must close, in the colour of whoever leads. You escape
  // only strictly ahead: a tie goes to the network. The head start is in
  // their score already, and the intro tells it.
  let { scores, name, hand, hands }: { scores: [number, number]; name: string; hand: number; hands: number } = $props();
  const gap = $derived(scores[0] - scores[1]);
</script>

<div class="score">
  <div class="row">
    <div class="side you"><span class="who">YOU</span><b>{scores[0]}</b></div>
    <div class="hand">
      <span class="who">HAND</span>
      <span class="dots" aria-hidden="true">{#each { length: hands } as _, i (i)}<span class:done={i < hand}>{i < hand ? '●' : '○'}</span>{/each}</span>
      <span class="of">{hand} of {hands}</span>
    </div>
    <div class="side them"><span class="who">{name.toUpperCase()}</span><b>{scores[1]}</b></div>
  </div>
  <div class="status" class:ahead={gap > 0}>
    <b>{gap > 0 ? `${gap} ahead` : gap === 0 ? 'level' : `${-gap} behind`}</b>
    <span>· {gap > 0 ? 'stay ahead to escape' : gap === 0 ? `a tie goes to ${name}` : 'get ahead to escape'}</span>
  </div>
</div>

<style>
  .score {
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-sunken);
  }
  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 6px;
  }
  .side,
  .hand {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    min-width: 0;
  }
  .side b {
    font-size: 26px;
    line-height: 1.1;
  }
  .you {
    color: var(--accent);
  }
  .them {
    color: var(--danger);
  }
  .who {
    font-size: 10px;
    letter-spacing: 0.06em;
    overflow-wrap: anywhere;
  }
  .hand {
    color: var(--text-dim);
    padding: 0 6px;
  }
  .dots {
    font-size: 13px;
    letter-spacing: 3px;
  }
  .dots .done {
    color: var(--text);
  }
  .of {
    font-size: 10px;
  }
  .status {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--line);
    text-align: center;
    font-size: 11px;
    color: var(--text-dim);
  }
  .status b {
    font-size: 13px;
    color: var(--danger);
  }
  .status.ahead b {
    color: var(--accent);
  }
</style>
