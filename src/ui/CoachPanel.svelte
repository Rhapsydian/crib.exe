<script lang="ts" module>
  export interface CoachSection {
    title: 'NOW' | 'YOUR DISCARD' | 'YOUR LAST PLAY' | "LAST HAND'S COUNT" | 'HOW IT WORKS';
    lines: string[];
  }
</script>

<script lang="ts">
  // The coach's panel (milestone 4 checkpoint 4): in the log ticker's
  // place while the coach is on. Titled sections, so advice for now is
  // never mistaken for a look back (the user's catch): NOW first, then
  // the review of your last discard or play, last hand's count, and --
  // the first time only -- how this phase works. "log" opens the log.
  let { sections, onlog }: { sections: CoachSection[]; onlog: () => void } = $props();
</script>

<div class="coach">
  <div class="head">
    <span class="tag">◈ COACH</span>
    <button class="log" onclick={onlog}>log ▸</button>
  </div>
  <div class="body">
    {#each sections as section (section.title)}
      <div class="section" class:now={section.title === 'NOW'}>
        <div class="title">{section.title}</div>
        {#each section.lines as line, i (i)}<div class="line">{line}</div>{/each}
      </div>
    {:else}
      <div class="line">Watching the play…</div>
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
    /* A steady height, so the table above doesn't shift. */
    height: 132px;
    flex: none;
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
    gap: 6px;
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 4px;
    border-top: 1px solid var(--line);
  }
  .section.now {
    padding-top: 0;
    border-top: none;
  }
  .title {
    font-size: 9px;
    letter-spacing: 0.1em;
    color: var(--text-dim);
  }
  .now .title {
    color: var(--mod);
  }
  .line {
    font-size: 11px;
    line-height: 1.35;
    color: var(--text-dim);
  }
  .now .line {
    font-size: 12px;
    color: var(--text);
  }
</style>
