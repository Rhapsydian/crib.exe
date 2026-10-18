<script lang="ts">
  // The coach's panel (milestone 4 checkpoint 4): in the log ticker's
  // place while the coach is on. The first line is the advice for what's
  // in front of you now; the rest -- a discard review, last hand's count,
  // what this phase is about -- follow, smaller. "log" opens the full log.
  let { lines, onlog }: { lines: { text: string; kind: 'now' | 'review' | 'count' | 'intro' }[]; onlog: () => void } = $props();
</script>

<div class="coach">
  <div class="head">
    <span class="tag">◈ COACH</span>
    <button class="log" onclick={onlog}>log ▸</button>
  </div>
  <div class="body">
    {#each lines as line, i (i)}
      <div class="line {line.kind}" class:lead={i === 0}>{line.text}</div>
    {:else}
      <div class="line intro">Watching the play…</div>
    {/each}
  </div>
</div>

<style>
  .coach {
    border: 1px solid var(--mod);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    /* Holds a steady height so the table above doesn't shift. */
    height: 132px;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: center;
  }
  .tag {
    font-size: 10px;
    color: var(--mod);
    letter-spacing: 0.08em;
    font-weight: 700;
  }
  .log {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 10px;
    padding: 0;
  }
  .body {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .line {
    font-size: 11px;
    line-height: 1.35;
    color: var(--text-dim);
  }
  .line.lead {
    font-size: 12px;
    color: var(--text);
  }
  .line.review {
    color: var(--text);
  }
  .line.count {
    color: var(--accent);
  }
</style>
