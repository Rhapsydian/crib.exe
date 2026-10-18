<script lang="ts">
  import { DIFFICULTIES, type Difficulty } from '../engine/basic-cribbage';

  // The front door (milestone 4, V5): Learn to play, Play Cribbage, and
  // the crib.exe run, each with its resume where a save exists. A first
  // visit highlights Learn to play; nothing is locked. Play Cribbage opens
  // its setup here -- a difficulty (V2) and the coach toggle (V3).
  let {
    runSave,
    cribbageSave,
    firstVisit,
    onlearn,
    oncribbage,
    onresumecribbage,
    onrun,
    resumeFailed = null,
  }: {
    runSave: { className: string; layer: number } | null;
    cribbageSave: { difficulty: Difficulty; scores: [number, number] } | null;
    firstVisit: boolean;
    onlearn: () => void;
    oncribbage: (difficulty: Difficulty, coach: boolean) => void;
    onresumecribbage: () => void;
    onrun: () => void;
    resumeFailed?: string | null;
  } = $props();

  const levels = Object.entries(DIFFICULTIES) as [Difficulty, (typeof DIFFICULTIES)[Difficulty]][];
  let setup = $state(false);
  let difficulty = $state<Difficulty>('easy');
  let coach = $state<boolean>(DIFFICULTIES.easy.coach);
  // Picking a level resets the coach to that level's default (on for
  // Learn to play); the toggle can then change it.
  function pick(d: Difficulty) {
    difficulty = d;
    coach = DIFFICULTIES[d].coach;
  }
  const BLURB: Record<Difficulty, string> = {
    learn: 'A gentle opponent, with the coach on.',
    easy: 'A soft opponent.',
    normal: 'A fair game for someone who knows Cribbage.',
    hard: 'The opponent at full strength.',
  };
</script>

{#snippet resume(save: { difficulty: Difficulty; scores: [number, number] })}
  <button class="resume" onclick={onresumecribbage}>▶ resume game · {DIFFICULTIES[save.difficulty].name} · {save.scores[0]}–{save.scores[1]}</button>
{/snippet}

<div class="menu">
  <h1>crib.exe</h1>
  <div class="sub">a hacking roguelite where every fight is a game of Cribbage</div>

  {#if resumeFailed}<div class="warn">{resumeFailed}</div>{/if}

  <div class="entry-group">
    <button class="entry learn" class:nudge={firstVisit} onclick={onlearn}>
      {#if firstVisit}<span class="badge">new to Cribbage? start here</span>{/if}
      <b>Learn to play</b>
      <span>Short lessons on the card game, then games with a coach.</span>
    </button>
    <!-- A saved Learn-to-play game resumes from here (the user's call);
         any other level's, under Play Cribbage. -->
    {#if cribbageSave?.difficulty === 'learn'}{@render resume(cribbageSave)}{/if}
  </div>

  <div class="entry-group">
    <button class="entry" onclick={() => (setup = !setup)}>
      <b>Play Cribbage</b>
      <span>A game to 121 against the computer.</span>
    </button>
    {#if cribbageSave && cribbageSave.difficulty !== 'learn'}{@render resume(cribbageSave)}{/if}
    {#if setup}
      <div class="setup">
        <div class="caption">DIFFICULTY</div>
        {#each levels as [id, level] (id)}
          <button class="level" class:chosen={difficulty === id} onclick={() => pick(id)}>
            <b>{level.name}</b> <span class="dim">{BLURB[id]}</span>
          </button>
        {/each}
        <label class="coach">
          <input type="checkbox" bind:checked={coach} />
          <span><b>Coach</b> <span class="dim">explains each phase, compares your discard with its own, walks through each count</span></span>
        </label>
        <button class="start" onclick={() => oncribbage(difficulty, coach)}>▶ deal · {DIFFICULTIES[difficulty].name}{coach ? ' · coach on' : ''}</button>
        {#if cribbageSave}<div class="dim small">Starting a new game replaces the saved one.</div>{/if}
      </div>
    {/if}
  </div>

  <button class="entry run" onclick={onrun}>
    <b>crib.exe · the run</b>
    <span>{runSave ? `Saved run: ${runSave.className}, layer ${runSave.layer}.` : 'Break into a network, four layers deep. Every fight is Cribbage.'}</span>
  </button>
</div>

<style>
  .menu {
    max-width: 520px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(28px + env(safe-area-inset-top));
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h1 {
    margin: 0;
    font-size: 26px;
    color: var(--accent);
    letter-spacing: 0.04em;
  }
  .sub {
    color: var(--text-dim);
    font-size: 12px;
    margin-bottom: 8px;
  }
  .warn {
    color: var(--warn);
    font-size: 11.5px;
  }
  .entry {
    position: relative;
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
  }
  .entry b {
    font-size: 15px;
  }
  .entry span {
    color: var(--text-dim);
  }
  .entry.nudge {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .badge {
    align-self: flex-start;
    font-size: 10px;
    padding: 1px 7px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--bg) !important;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
  .entry.run b {
    color: var(--accent);
  }
  .entry-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
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
  .setup {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 4px 0 4px 10px;
    border-left: 2px solid var(--line);
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
  }
  .level {
    text-align: left;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font-size: 12px;
  }
  .level.chosen {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .dim {
    color: var(--text-dim);
  }
  .small {
    font-size: 11px;
  }
  .coach {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 12px;
    padding: 4px 2px;
  }
  .coach input {
    margin-top: 2px;
    accent-color: var(--accent);
  }
  .start {
    padding: 10px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
</style>
