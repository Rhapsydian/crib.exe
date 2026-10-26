<script lang="ts" module>
  import type { CoachChoice } from './coach';
  export interface CoachSection {
    title: 'NOW' | 'YOUR DISCARD' | 'YOUR LAST PLAY' | "LAST HAND'S COUNT" | 'HOW IT WORKS';
    lines: string[];
    /** Your choice beside the coach's (session 72), under the lines. */
    choice?: CoachChoice;
  }
</script>

<script lang="ts">
  import RichText from './RichText.svelte';
  import ChoiceReview from './ChoiceReview.svelte';
  // The coach's panel (milestone 4 checkpoint 4): in the log ticker's
  // place while the coach is on. Titled sections, so advice for now is
  // never mistaken for a look back (the user's catch): NOW first, then
  // the review of your last discard or play, last hand's count, and --
  // the first time only -- how this phase works. "log" opens the log.
  // `hints` / `onhints`: the suggestions switch (the user's call) -- off,
  // the coach still explains and reviews, but doesn't suggest first.
  let { sections, onlog, hints, onhints }: { sections: CoachSection[]; onlog: () => void; hints: boolean; onhints: () => void } = $props();
</script>

<div class="coach">
  <div class="head">
    <span class="tag">◈ COACH</span>
    <button class="hints" class:on={hints} aria-pressed={hints} onclick={onhints} title="suggestions before you choose">suggestions {hints ? 'on' : 'off'}</button>
    <button class="log" onclick={onlog}>log ▸</button>
  </div>
  <div class="body">
    {#each sections as section (section.title)}
      <div class="section" class:now={section.title === 'NOW'}>
        <div class="title">{section.title}</div>
        {#each section.lines as line, i (i)}<div class="line"><RichText text={line} /></div>{/each}
        {#if section.choice}<div class="line"><ChoiceReview choice={section.choice} /></div>{/if}
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
    /* It fills the space between the table and the hand (the user's call)
       -- a size fixed by the screen, not the text, so nothing shifts --
       and never shrinks below what a small phone can spare. */
    flex: 1 1 auto;
    min-height: 132px;
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
  .hints {
    margin-left: auto;
    margin-right: 10px;
    background: none;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--text-dim);
    font-size: 10px;
    padding: 1px 7px;
  }
  .hints.on {
    border-color: var(--mod);
    color: var(--mod);
  }
  .log {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 10px;
    padding: 0;
  }
  .body {
    flex: 1;
    min-height: 0;
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
