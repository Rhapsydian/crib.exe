<script lang="ts">
  import { tips } from './tips.svelte';
  import { profile } from './profile.svelte';
  import { DAILY_MODS, rollDaily } from '../engine/daily';
  import { CLASS_DEFINITIONS } from '../engine/classes';
  import CardView from './CardView.svelte';
  import type { Card } from '../engine/cards';
  let tipsReset = $state(false);
  const HEADER_CARDS: Card[] = [
    { rank: 4, suit: 0 },
    { rank: 5, suit: 1 },
    { rank: 6, suit: 2 },
    { rank: 11, suit: 3 },
  ];
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
    ontutorial,
    onboard,
    ondaily,
    today,
    dailyInProgress = null,
    resumeFailed = null,
  }: {
    runSave: { className: string; layer: number } | null;
    cribbageSave: { difficulty: Difficulty; scores: [number, number] } | null;
    firstVisit: boolean;
    onlearn: () => void;
    oncribbage: (difficulty: Difficulty, coach: boolean, hints: boolean) => void;
    onresumecribbage: () => void;
    onrun: () => void;
    ontutorial: () => void;
    onboard: () => void;
    ondaily: () => void;
    today: string;
    dailyInProgress?: { date: string; practice: boolean } | null;
    resumeFailed?: string | null;
  } = $props();

  const plan = $derived(rollDaily(today));
  const scored = $derived(profile.data.daily[today]?.scored);
  const levels = Object.entries(DIFFICULTIES) as [Difficulty, (typeof DIFFICULTIES)[Difficulty]][];
  let setup = $state(false);
  let difficulty = $state<Difficulty>('easy');
  let coach = $state<boolean>(DIFFICULTIES.easy.coach);
  let hints = $state(true);
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
  <!-- The title as a command being run, with a fifteen and nobs (4 5 6,
       a Jack) flying off to the right, one card of each suit (session 63,
       the user's ask). -->
  <div class="masthead">
    <h1><span class="prompt">&gt;</span> ./crib.exe<span class="cursor" aria-hidden="true"></span></h1>
    <div class="fly" aria-hidden="true">
      {#each HEADER_CARDS as card, i (i)}
        <span class="flying" style="--i: {i}"><CardView {card} small /></span>
      {/each}
    </div>
  </div>
  <div class="sub">A hacking roguelite where every fight is a game of Cribbage</div>

  {#if resumeFailed}<div class="warn">{resumeFailed}</div>{/if}

  <!-- Two sections (the user's call): the roguelite -- a run for now;
       meta-progression and its tutorial join it later -- and vanilla
       Cribbage. -->
  <section>
    <div class="section-title">CRIB.EXE · THE ROGUELITE</div>
    <!-- The tutorial (session 63, T1-T2): the first-visit nudge points
         here; it asks whether you know Cribbage before it starts. -->
    <button class="entry learn" class:nudge={firstVisit} onclick={ontutorial}>
      {#if firstVisit}<span class="badge">new here? start here</span>{/if}
      <b>Tutorial</b>
      <span>A short guided run that explains the game as you play.</span>
    </button>
    <button class="entry run" onclick={onrun}>
      <b>Start a Run</b>
      <span>{runSave ? `Saved run: ${runSave.className}, layer ${runSave.layer}. Resume it on the next screen.` : 'Break into a network, four layers deep. Every fight is Cribbage.'}</span>
    </button>
    <!-- The Daily Run (session 72, DR9): today's class and Directive at a
         glance, and today's scored attempt once played. -->
    <button class="entry daily" onclick={ondaily}>
      <b>Daily Run <span class="date">{today}</span>{#if scored !== undefined}<span class="rep">★ {scored.toLocaleString('en-US')} today</span>{/if}</b>
      <span>{dailyInProgress ? (dailyInProgress.date === today ? `Today's ${dailyInProgress.practice ? 'practice run' : 'scored attempt'} is in progress: resume it on the next screen.` : `Your daily from ${dailyInProgress.date} is unfinished: resume it on the next screen.`) : `Today: ${CLASS_DEFINITIONS[plan.classId].name} · ${DAILY_MODS[plan.mods[0].id].name} · ${plan.mods.length - 1} more twist${plan.mods.length === 2 ? '' : 's'}. One scored attempt a day.`}</span>
    </button>
    <!-- The Message Board (session 71, MP16): not listed until a first
         finished run (the tutorial counts). -->
    {#if profile.data.runsFinished > 0}
      <button class="entry board" class:nudge={!profile.data.boardIntroduced} onclick={onboard}>
        {#if !profile.data.boardIntroduced}<span class="badge">new</span>{/if}
        <b>Message Board <span class="rep">◆ {profile.data.rep} rep</span></b>
        <span>Spend the Rep your runs earn on upgrades, subroutines and Burners.</span>
      </button>
    {/if}
  </section>

  <section>
    <div class="section-title">CRIBBAGE</div>
    <div class="entry-group">
      <button class="entry learn" onclick={onlearn}>
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
            <span><b>Coach</b> <span class="dim">explains each phase, reviews your discards and plays, walks through each count</span></span>
          </label>
          <label class="coach sub" class:off={!coach}>
            <input type="checkbox" bind:checked={hints} disabled={!coach} />
            <span><b>Suggestions</b> <span class="dim">the coach also suggests a discard or play before you choose</span></span>
          </label>
          <button class="start" onclick={() => oncribbage(difficulty, coach, hints)}>▶ deal · {DIFFICULTIES[difficulty].name}{coach ? ` · coach on${hints ? '' : ', no suggestions'}` : ''}</button>
          {#if cribbageSave}<div class="dim small">Starting a new game replaces the saved one.</div>{/if}
        </div>
      {/if}
    </div>
  </section>

  <!-- First-time tips (session 63, T6): shown once each; this brings them
       back, e.g. for a new tester on the same machine. -->
  <button class="tips-reset" onclick={() => { tips.reset(); tipsReset = true; }} disabled={tipsReset}>{tipsReset ? 'tips will show again' : 'show tips again'}</button>
</div>

<style>
  .tips-reset {
    align-self: center;
    margin-top: 8px;
    padding: 4px 10px;
    border: none;
    background: none;
    color: var(--text-dim);
    font-size: 11px;
    text-decoration: underline;
    cursor: pointer;
  }
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
  .masthead {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  h1 {
    margin: 0;
    font-size: 26px;
    color: var(--accent);
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .prompt {
    color: var(--text-dim);
  }
  .cursor {
    display: inline-block;
    width: 0.55em;
    height: 0.9em;
    margin-left: 3px;
    vertical-align: -0.08em;
    background: var(--accent);
    animation: blink 1.1s steps(1) infinite;
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  /* Each card further along, higher, more tilted and fainter, with a
     motion streak behind it: a hand thrown off to the right. */
  .fly {
    position: relative;
    flex: 1;
    height: 56px;
    min-width: 0;
    overflow: visible;
    pointer-events: none;
  }
  .flying {
    position: absolute;
    /* Spaced to fit the room beside the title (tighter on phones). */
    left: calc(8px + var(--i) * min(46px, (100% - 56px) / 3));
    top: calc(10px - var(--i) * 3px);
    transform: rotate(calc(6deg + var(--i) * 7deg));
    opacity: calc(1 - var(--i) * 0.16);
    animation: drift 3.2s ease-in-out infinite;
    animation-delay: calc(var(--i) * -0.4s);
  }
  .flying::before {
    content: '';
    position: absolute;
    right: 100%;
    top: 40%;
    width: calc(8px + var(--i) * 2px);
    height: 2px;
    margin-right: 2px;
    background: linear-gradient(to right, transparent, var(--accent));
    opacity: 0.45;
  }
  @keyframes drift {
    50% {
      translate: 4px -2px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cursor,
    .flying {
      animation: none;
    }
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
  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 6px;
  }
  .section-title {
    font-size: 10px;
    letter-spacing: 0.1em;
    color: var(--text-dim);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--line);
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
  .coach.sub {
    padding-left: 22px;
  }
  .coach.off {
    opacity: 0.5;
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
  .rep {
    float: right;
    color: var(--mod);
    font-weight: 400;
  }
  .date {
    margin-left: 6px;
    font-weight: 400;
    color: var(--text-dim);
  }
</style>
