<script lang="ts">
  import { LESSONS } from './lessons';

  // Learn to play (milestone 4 checkpoint 5, V1/V5): the lessons in order,
  // each ticked once done and replayable, the next one highlighted; then a
  // coached game (Learn to play difficulty, coach on), with its resume.
  let {
    done,
    resume,
    onlesson,
    oncoached,
    onresume,
    onmenu,
  }: {
    done: Set<string>;
    resume: { scores: [number, number] } | null;
    onlesson: (index: number) => void;
    oncoached: () => void;
    onresume: () => void;
    onmenu: () => void;
  } = $props();
  const nextIndex = $derived(LESSONS.findIndex((l) => !done.has(l.id)));
</script>

<div class="hub">
  <button class="back" onclick={onmenu}>◂ menu</button>
  <h1>Learn to play</h1>
  <div class="sub">
    {nextIndex === 0 ? 'Five short lessons, a few minutes each, then a game with the coach beside you.' : nextIndex === -1 ? 'All five lessons done. Replay any of them, or play a coached game.' : `${done.size} of ${LESSONS.length} lessons done.`}
  </div>

  {#each LESSONS as lesson, i (lesson.id)}
    <button class="lesson" class:next={i === nextIndex} class:done={done.has(lesson.id)} onclick={() => onlesson(i)}>
      <span class="mark">{done.has(lesson.id) ? '✓' : i + 1}</span>
      <span class="text"><b>{lesson.title}</b><span>{lesson.blurb}</span></span>
      <span class="go">{done.has(lesson.id) ? 'replay' : i === nextIndex ? 'start ▸' : ''}</span>
    </button>
  {/each}

  <div class="caption">THEN</div>
  <button class="coached" class:next={nextIndex === -1} onclick={oncoached}>
    <b>Play a coached game</b>
    <span>A real game to 121 against a gentle opponent. The coach suggests moves and reviews yours.</span>
  </button>
  {#if resume}<button class="resume" onclick={onresume}>▶ resume coached game · {resume.scores[0]}–{resume.scores[1]}</button>{/if}
</div>

<style>
  .hub {
    max-width: 520px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(16px + env(safe-area-inset-top));
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .back {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 11px;
    padding: 2px 0;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    color: var(--accent);
  }
  .sub {
    color: var(--text-dim);
    font-size: 12px;
    margin-bottom: 4px;
  }
  .lesson,
  .coached {
    text-align: left;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font-size: 12px;
  }
  .lesson {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .lesson.next,
  .coached.next {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .mark {
    width: 22px;
    height: 22px;
    flex: none;
    border-radius: 50%;
    border: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: var(--text-dim);
  }
  .done .mark {
    border-color: var(--accent);
    color: var(--accent);
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .text b {
    font-size: 13px;
  }
  .text span,
  .coached span {
    color: var(--text-dim);
  }
  .go {
    margin-left: auto;
    font-size: 11px;
    color: var(--accent);
    white-space: nowrap;
  }
  .done .go {
    color: var(--text-dim);
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 6px;
  }
  .coached {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .coached b {
    font-size: 14px;
  }
  .resume {
    text-align: left;
    padding: 9px 12px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: rgb(57 255 156 / 8%);
    color: var(--accent);
    font-weight: 700;
    font-size: 12.5px;
  }
</style>
