<script lang="ts">
  import { mockSnapshot } from './ui/snapshot';
  import TabsLayout from './ui/mockups/TabsLayout.svelte';
  import DrawersLayout from './ui/mockups/DrawersLayout.svelte';
  import CompactLayout from './ui/mockups/CompactLayout.svelte';
  import FightScreen from './ui/FightScreen.svelte';
  import SetupScreen from './ui/SetupScreen.svelte';
  import LiveFightView from './ui/LiveFightView.svelte';
  import MapMockup from './ui/mockups/map/MapMockup.svelte';
  import PegboardMockup from './ui/mockups/pegboard/PegboardMockup.svelte';
  import { LiveFight } from './ui/live-fight.svelte';
  import { LiveRun } from './ui/live-run.svelte';
  import ClassSelect from './ui/ClassSelect.svelte';
  import RunView from './ui/RunView.svelte';
  import { clearSave, loadSave, writeSave } from './ui/run-save';
  import { profile } from './ui/profile.svelte';
  import { firstGatekeeperBeaten, nextClass, repForRun } from './engine/meta';
  import MainMenu from './ui/MainMenu.svelte';
  import MessageBoard from './ui/MessageBoard.svelte';
  import TipBanner from './ui/TipBanner.svelte';
  import GuideBanner from './ui/GuideBanner.svelte';
  import { guide } from './ui/guide.svelte';
  import TutorialStart from './ui/TutorialStart.svelte';
  import { TUTORIAL_CLASS, TUTORIAL_SEED } from './engine/tutorial';
  import CribbageScreen from './ui/CribbageScreen.svelte';
  import { LiveCribbage, clearCribbageSave, loadCribbageSave, writeCribbageSave } from './ui/live-cribbage.svelte';
  import type { Difficulty } from './engine/basic-cribbage';
  import LearnHub from './ui/LearnHub.svelte';
  import LessonScreen from './ui/LessonScreen.svelte';
  import { LESSONS, loadProgress, markDone } from './ui/lessons';
  import type { ClassId } from './engine/classes';
  import type { EnemyDefinition } from './engine/enemies';

  // The default page is a run (milestone 3): class choice, then the run.
  // #test is milestone 2's single-fight harness. The mockups stay
  // reachable -- #mock (the chosen fight screen), the three P3 fight
  // mockups at #tabs / #drawers / #compact, and #map -- with a switcher.
  const mocks = ['mock', 'tabs', 'drawers', 'compact', 'map', 'pegboard'] as const;
  type Route = 'run' | 'test' | (typeof mocks)[number];
  const fromHash = (): Route => (location.hash === '#test' ? 'test' : (mocks.find((l) => location.hash === `#${l}`) ?? 'run'));
  let route = $state<Route>(fromHash());
  $effect(() => {
    const onHash = () => (route = fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  let snapshot = $state.raw<ReturnType<typeof mockSnapshot> | null>(null);
  $effect(() => {
    if (route !== 'run' && route !== 'test' && !snapshot) snapshot = mockSnapshot();
  });

  let fight = $state.raw<LiveFight | null>(null);
  let last = $state<{ classId: ClassId; enemyId: string; burners: boolean } | null>(null);
  const newSeed = () => Math.floor(Math.random() * 1_000_000);
  function start(classId: ClassId, enemy: EnemyDefinition, burners: boolean) {
    last = { classId, enemyId: enemy.id, burners };
    fight = new LiveFight({ classId, enemy, seed: newSeed(), carriedBurnerIds: burners ? ['packet-storm', 'bootstrap-loader', 'flash-drive'] : [] });
  }

  let run = $state.raw<LiveRun | null>(null);
  // Saves (milestone 3 checkpoint 5): a run writes itself after every
  // answer and clears its save when it ends; the class screen offers to
  // resume one.
  let saved = $state.raw(loadSave());
  let resumeFailed = $state(false);
  function begin(next: LiveRun) {
    next.onsave = () => {
      if (next.pause?.kind === 'over') {
        // The run's Rep (session 71): awarded once, before the save goes.
        if (next.tutorial) profile.finishTutorial(next.id);
        else {
          const result = next.pause.result;
          // The class milestone (MP2): the first gatekeeper beaten opens the next class.
          const securityLevel = next.setup.securityLevel ?? 0;
          profile.awardRun(next.id, repForRun(result, securityLevel).lines, firstGatekeeperBeaten(result) ? nextClass(next.classId) : null, { classId: next.classId, securityLevel, won: result.outcome === 'victory' });
        }
        clearSave();
      } else writeSave(next.save);
    };
    if (next.pause?.kind !== 'over') writeSave(next.save);
    run = next;
  }
  function resume() {
    const save = loadSave();
    const next = save && LiveRun.resume(save);
    if (next) begin(next);
    else {
      resumeFailed = true;
      clearSave();
      saved = null;
    }
  }
  function backToClasses() {
    run = null;
    saved = loadSave();
  }

  // The front door (milestone 4, V5): the main menu, then a mode. A run
  // keeps its class screen; a Cribbage game saves itself like a run.
  let screen = $state<'menu' | 'classes' | 'cribbage' | 'learn' | 'lesson' | 'tutorial' | 'board'>('menu');
  // Learn to play (checkpoint 5): the hub, a lesson, and progress.
  let lessonIndex = $state(0);
  let lessonsDone = $state.raw(loadProgress());
  function finishLesson() {
    lessonsDone = markDone(LESSONS[lessonIndex].id);
    screen = 'learn';
  }
  let cribbage = $state.raw<LiveCribbage | null>(null);
  let cribbageSaved = $state.raw(loadCribbageSave());
  let menuWarning = $state<string | null>(null);
  const VISITED_KEY = 'cribexe.visited';
  const readVisited = () => {
    try {
      return localStorage.getItem(VISITED_KEY) === '1';
    } catch {
      return true;
    }
  };
  let firstVisit = $state(!readVisited());
  function markVisited() {
    firstVisit = false;
    try {
      localStorage.setItem(VISITED_KEY, '1');
    } catch {
      // Unsaved: the nudge just shows again next time.
    }
  }
  function beginCribbage(next: LiveCribbage) {
    markVisited();
    next.onsave = () => {
      if (next.result) clearCribbageSave();
      else writeCribbageSave(next.save);
    };
    writeCribbageSave(next.save);
    cribbage = next;
    screen = 'cribbage';
  }
  function resumeCribbage() {
    const save = loadCribbageSave();
    const next = save && LiveCribbage.resume(save);
    if (next) beginCribbage(next);
    else {
      menuWarning = "That saved game is from an older version of the game and couldn't be loaded.";
      clearCribbageSave();
      cribbageSaved = null;
    }
  }
  function toMenu() {
    cribbage = null;
    run = null;
    saved = loadSave();
    cribbageSaved = loadCribbageSave();
    screen = 'menu';
  }
  // Development builds only: the live run on window.__run, for driving and
  // inspecting a run from the console (never in a production build).
  $effect(() => {
    if (import.meta.env.DEV) (window as unknown as { __run: LiveRun | null }).__run = run;
  });
  $effect(() => {
    if (import.meta.env.DEV) (window as unknown as { __cribbage: LiveCribbage | null }).__cribbage = cribbage;
  });
</script>

<TipBanner />
{#if guide.active && !guide.inFight}<GuideBanner />{/if}

{#if route === 'run'}
  {#if run}
    <RunView {run} onagain={backToClasses} onretry={() => begin(new LiveRun(TUTORIAL_CLASS, TUTORIAL_SEED, true))} onmenu={toMenu} />
  {:else if screen === 'cribbage' && cribbage}
    {#key cribbage}
      <CribbageScreen
        game={cribbage}
        onagain={() => cribbage && beginCribbage(new LiveCribbage(cribbage.difficulty, cribbage.coach, newSeed(), cribbage.hints))}
        onmenu={toMenu}
      />
    {/key}
  {:else if screen === 'learn'}
    <LearnHub
      done={lessonsDone}
      resume={cribbageSaved?.difficulty === 'learn' ? { scores: cribbageSaved.summary.scores } : null}
      onlesson={(i: number) => {
        lessonIndex = i;
        screen = 'lesson';
      }}
      oncoached={() => beginCribbage(new LiveCribbage('learn', true, newSeed()))}
      onresume={resumeCribbage}
      onmenu={toMenu}
    />
  {:else if screen === 'lesson'}
    {#key lessonIndex}
      <LessonScreen lesson={LESSONS[lessonIndex]} number={lessonIndex + 1} total={LESSONS.length} onexit={() => (screen = 'learn')} onfinish={finishLesson} />
    {/key}
  {:else if screen === 'menu'}
    <MainMenu
      runSave={saved?.summary ?? null}
      cribbageSave={cribbageSaved ? { difficulty: cribbageSaved.difficulty, scores: cribbageSaved.summary.scores } : null}
      {firstVisit}
      onlearn={() => {
        markVisited();
        screen = 'learn';
      }}
      oncribbage={(d: Difficulty, coach: boolean, hints: boolean) => beginCribbage(new LiveCribbage(d, coach, newSeed(), hints))}
      onresumecribbage={resumeCribbage}
      onrun={() => {
        markVisited();
        screen = 'classes';
      }}
      ontutorial={() => {
        markVisited();
        screen = 'tutorial';
      }}
      onboard={() => (screen = 'board')}
      resumeFailed={menuWarning}
    />
  {:else if screen === 'board'}
    <MessageBoard onmenu={toMenu} />
  {:else if screen === 'tutorial'}
    <TutorialStart
      resumable={Boolean(saved?.tutorial)}
      onstart={() => (saved?.tutorial ? resume() : begin(new LiveRun(TUTORIAL_CLASS, TUTORIAL_SEED, true)))}
      onlearn={() => (screen = 'learn')}
      onmenu={toMenu}
    />
  {:else}
    <ClassSelect
      onmenu={toMenu}
      onstart={(classId, picks) => begin(new LiveRun(classId, newSeed(), false, picks.plain ? picks : { upgrades: { ...profile.data.upgrades }, ...picks }))}
      ontest={() => (location.hash = '#test')}
      saved={saved?.summary ?? null}
      onresume={resume}
      {resumeFailed}
    />
  {/if}
{:else if route === 'test'}
  {#if fight}
    <LiveFightView
      {fight}
      actions={[
        { label: 'fight again', onclick: () => fight && start(fight.setup.classId, fight.setup.enemy, (fight.setup.carriedBurnerIds?.length ?? 0) > 0) },
        { label: 'change setup', onclick: () => (fight = null) },
      ]}
    />
  {:else}
    <SetupScreen onstart={start} classId={last?.classId} enemyId={last?.enemyId} burners={last?.burners} />
  {/if}
{:else if snapshot}
  <div class="switcher">
    {#each mocks as l (l)}
      <a href="#{l}" class:active={route === l}>{l}</a>
    {/each}
    <a href="#run">run</a>
  </div>
  {#if route === 'map'}
    <MapMockup />
  {:else if route === 'pegboard'}
    <PegboardMockup />
  {:else if route === 'mock'}
    <FightScreen {snapshot} />
  {:else if route === 'tabs'}
    <TabsLayout {snapshot} />
  {:else if route === 'drawers'}
    <DrawersLayout {snapshot} />
  {:else}
    <CompactLayout {snapshot} />
  {/if}
{/if}

<style>
  .switcher {
    position: fixed;
    top: calc(4px + env(safe-area-inset-top));
    right: 6px;
    z-index: 30;
    display: flex;
    gap: 2px;
    background: rgb(0 0 0 / 70%);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 2px;
    font-size: 10px;
  }
  .switcher a {
    padding: 2px 8px;
    border-radius: 999px;
    color: var(--text-dim);
    text-decoration: none;
  }
  .switcher a.active {
    background: var(--accent);
    color: var(--bg);
  }
</style>
