<script lang="ts">
  import { LiveRun } from './ui/live-run.svelte';
  import ClassSelect from './ui/ClassSelect.svelte';
  import RunView from './ui/RunView.svelte';
  import { clearSave, loadSave, writeSave } from './ui/run-save';
  import { profile } from './ui/profile.svelte';
  import { firstGatekeeperBeaten, nextClass, repForRun } from './engine/meta';
  import MainMenu from './ui/MainMenu.svelte';
  import MessageBoard from './ui/MessageBoard.svelte';
  import DailyBrief from './ui/DailyBrief.svelte';
  import { dailyDate, dailyRunStart, dailyScore, rollDaily } from './engine/daily';
  import { rateSkill } from './ui/skill-review';
  import TipBanner from './ui/TipBanner.svelte';
  import GuideBanner from './ui/GuideBanner.svelte';
  import { guide } from './ui/guide.svelte';
  import TutorialStart from './ui/TutorialStart.svelte';
  import { TUTORIAL_CLASS, TUTORIAL_SEED } from './engine/tutorial';
  import CribbageScreen from './ui/CribbageScreen.svelte';
  import { LiveCribbage, clearCribbageSave, loadCribbageSave, writeCribbageSave } from './ui/live-cribbage.svelte';
  import type { Difficulty } from './engine/basic-cribbage';
  import { DEV_ROUTES, type DevRoute } from './dev-routes';
  import { checkSaves } from './ui/save-check';
  import LearnHub from './ui/LearnHub.svelte';
  import LessonScreen from './ui/LessonScreen.svelte';
  import { LESSONS, loadProgress, markDone } from './ui/lessons';

  // The default page is a run (milestone 3): class choice, then the run.
  // The developer pages (#test, the single-fight harness, and the design
  // mockups; DevRoutes.svelte) answer only in development: the release
  // build has no route to them, and doesn't contain them (go-live step 1).
  type Route = 'run' | DevRoute;
  const fromHash = (): Route => (import.meta.env.DEV ? (DEV_ROUTES.find((l) => location.hash === `#${l}`) ?? 'run') : 'run');
  let route = $state<Route>(fromHash());
  $effect(() => {
    const onHash = () => (route = fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  const newSeed = () => Math.floor(Math.random() * 1_000_000);

  let run = $state.raw<LiveRun | null>(null);
  // Saves (milestone 3 checkpoint 5): a run writes itself after every
  // answer and clears its save when it ends; the class screen offers to
  // resume one.
  // Saves an update left behind are cleared before anything reads them,
  // and their screens say so (go-live step 2). A Daily Run's dropped scored
  // attempt is released, so today's can be played again.
  const checked = checkSaves();
  const dailyReleased = checked.daily?.scored ? profile.releaseDaily(checked.daily.date) : false;
  let dropped = $state({ run: checked.run, daily: checked.daily !== null, cribbage: checked.cribbage });
  let saved = $state.raw(loadSave());
  // A Daily Run's save has its own slot (session 72).
  let savedDaily = $state.raw(loadSave('daily'));
  const slotOf = (r: LiveRun) => (r.setup.daily ? 'daily' : 'run');
  function begin(next: LiveRun) {
    next.onsave = () => {
      if (next.pause?.kind === 'over') {
        // The run's Rep (session 71): awarded once, before the save goes.
        if (next.tutorial) profile.finishTutorial(next.id);
        else if (next.setup.daily) {
          // A Daily Run (session 72): its score, its record, and Rep for the
          // scored attempt only.
          const result = next.pause.result;
          const { date, practice } = next.setup.daily;
          const stars = rateSkill(next.skill, false)?.stars ?? null;
          const score = dailyScore(result, rollDaily(date).mods[0].id, stars);
          profile.finishDaily(next.id, date, practice ?? false, score.lines, stars, repForRun(result).lines);
        } else {
          const result = next.pause.result;
          // The class milestone (MP2): the first gatekeeper beaten opens the next class.
          const securityLevel = next.setup.securityLevel ?? 0;
          profile.awardRun(next.id, repForRun(result, securityLevel).lines, firstGatekeeperBeaten(result) ? nextClass(next.classId) : null, { classId: next.classId, securityLevel, won: result.outcome === 'victory' });
        }
        clearSave(slotOf(next));
      } else writeSave(next.save, slotOf(next));
    };
    if (next.pause?.kind !== 'over') writeSave(next.save, slotOf(next));
    run = next;
  }
  function resume() {
    const save = loadSave();
    const next = save && LiveRun.resume(save);
    if (next) begin(next);
    else {
      dropped.run = true;
      clearSave();
      saved = null;
    }
  }
  function backToClasses() {
    run = null;
    saved = loadSave();
    savedDaily = loadSave('daily');
  }
  /** The Daily Run in progress, resumed from its slot. */
  function resumeDaily() {
    const next = savedDaily && LiveRun.resume(savedDaily);
    if (next) begin(next);
    else {
      clearSave('daily');
      savedDaily = null;
      dropped.daily = true;
    }
  }

  // The front door (milestone 4, V5): the main menu, then a mode. A run
  // keeps its class screen; a Cribbage game saves itself like a run.
  let screen = $state<'menu' | 'classes' | 'cribbage' | 'learn' | 'lesson' | 'tutorial' | 'board' | 'daily'>('menu');
  // Today's daily (session 72): the local date as YYYY-MM-DD.
  const today = () => dailyDate(new Date());
  function beginDaily() {
    const date = today();
    const practice = profile.startDaily(date);
    const { classId, seed, setup } = dailyRunStart(date, practice);
    begin(new LiveRun(classId, seed, false, setup));
  }
  // Learn to play (checkpoint 5): the hub, a lesson, and progress.
  let lessonIndex = $state(0);
  let lessonsDone = $state.raw(loadProgress());
  function finishLesson() {
    lessonsDone = markDone(LESSONS[lessonIndex].id);
    screen = 'learn';
  }
  let cribbage = $state.raw<LiveCribbage | null>(null);
  let cribbageSaved = $state.raw(loadCribbageSave());
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
      dropped.cribbage = true;
      clearCribbageSave();
      cribbageSaved = null;
    }
  }
  function toMenu() {
    cribbage = null;
    run = null;
    saved = loadSave();
    savedDaily = loadSave('daily');
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
      ondaily={() => (screen = 'daily')}
      today={today()}
      dailyInProgress={savedDaily ? { date: savedDaily.setup.daily?.date ?? '', practice: savedDaily.setup.daily?.practice ?? false } : null}
      droppedGame={dropped.cribbage}
      ondismissdropped={() => (dropped.cribbage = false)}
    />
  {:else if screen === 'daily'}
    <DailyBrief date={today()} saved={savedDaily ? { date: savedDaily.setup.daily?.date ?? '', layer: savedDaily.summary.layer, practice: savedDaily.setup.daily?.practice ?? false } : null} onresume={resumeDaily} onstart={beginDaily} onmenu={toMenu} dropped={dropped.daily} released={dailyReleased} ondismissdropped={() => (dropped.daily = false)} />
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
      ontest={import.meta.env.DEV ? () => (location.hash = '#test') : undefined}
      saved={saved?.summary ?? null}
      onresume={resume}
      dropped={dropped.run}
      ondismissdropped={() => (dropped.run = false)}
    />
  {/if}
{:else if import.meta.env.DEV}
  <!-- Loaded on demand, and only in development: the release build
       drops this branch, and with it the developer pages. -->
  {#await import('./DevRoutes.svelte') then dev}<dev.default {route} />{/await}
{/if}
