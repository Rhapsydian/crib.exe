<script lang="ts">
  // The tutorial's front door (session 63, docs/tutorial-design.md T2):
  // the guided run assumes the Cribbage basics, so it asks first. "New to
  // Cribbage" goes to the Learn-to-play lessons; "I know Cribbage" starts
  // the guided run.
  let {
    resumable,
    onstart,
    onlearn,
    onmenu,
  }: { resumable: boolean; onstart: () => void; onlearn: () => void; onmenu: () => void } = $props();
</script>

<div class="start">
  <button class="back" onclick={onmenu}>◀ menu</button>
  <div class="title">TUTORIAL</div>
  <div class="blurb">
    A short guided run: one small layer of the network, explained step by step as you play. Every fight is a game of Cribbage, so
    it helps to know the card game first.
  </div>

  <button class="choice primary" onclick={onstart}>
    <b>I know Cribbage</b>
    <span>{resumable ? 'Resume the tutorial where you left off.' : 'Start the guided run.'}</span>
  </button>
  <button class="choice" onclick={onlearn}>
    <b>New to Cribbage</b>
    <span>Learn the card game first: short lessons, then a game with a coach. Come back here when you're ready.</span>
  </button>
</div>

<style>
  .start {
    max-width: 480px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(16px + env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .back {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 11px;
    padding: 0;
    cursor: pointer;
  }
  .title {
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.08em;
    font-size: 14px;
  }
  .blurb {
    color: var(--text-dim);
    font-size: 12px;
    line-height: 1.5;
  }
  .choice {
    text-align: left;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    cursor: pointer;
  }
  .choice b {
    font-size: 13px;
  }
  .choice span {
    color: var(--text-dim);
  }
  .choice.primary {
    border-color: var(--accent);
  }
</style>
