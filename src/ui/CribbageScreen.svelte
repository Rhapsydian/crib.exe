<script lang="ts">
  import { stickToBottom } from './stick-to-bottom';
  import RichText from './RichText.svelte';
  import { untrack } from 'svelte';
  import type { Card } from '../engine/cards';
  import { DIFFICULTIES, WIN_SCORE } from '../engine/basic-cribbage';
  import { pegSpot, type LiveCribbage } from './live-cribbage.svelte';
  import { RunEvasion } from './evasion-session.svelte';
  import EvasionScore from './EvasionScore.svelte';
  import { Replay } from './replay.svelte';
  import { cribbageBeats, scoreReadings, pegsAfter } from './cribbage-steps';
  import { pointsSummary, scoreLabel, stepLine, tableAt, type Step } from './timeline';
  import Table from './Table.svelte';
  import Hand from './Hand.svelte';
  import ShowPanel from './ShowPanel.svelte';
  import ScoreBars from './ScoreBars.svelte';
  import CoachPanel, { type CoachSection } from './CoachPanel.svelte';
  import { discardHint, pegHint, phaseIntro, showSummary } from './coach';
  import { rateSkill } from './skill-review';
  import StarRating from './StarRating.svelte';
  import SkillReview from './SkillReview.svelte';

  // A game of vanilla Cribbage (milestone 4 checkpoint 3): the fight
  // screen's table, hand, show panel, callouts and step-through, with the
  // score as two bars (V7) in place of the gauges and loadouts. Each
  // engine pause hands the replay the game so far; it plays out what's
  // new -- the opponent's cards, the scores, the show -- before your hand
  // is live again. The end panel names the winner and any skunk. With
  // the coach on (V3; a header pill switches it), its panel takes the log
  // ticker's place: advice for the decision in front of you, then a
  // review of your discard, last hand's count, and what the phase is.
  // A trace evasion (session 63) plays here too: its own header, a
  // score that shows the gap, no coach, and its own result.
  let { game, onagain, onmenu }: { game: LiveCribbage | RunEvasion; onagain: () => void; onmenu?: () => void } = $props();
  const evasion = $derived(game instanceof RunEvasion ? game : null);
  // A vanilla game's Cribbage rating at the end (session 72, the user), as
  // fights rate theirs, with the same review drawer.
  const rating = $derived(!evasion && game.result && 'skill' in game ? rateSkill(game.skill) : null);
  let reviewOpen = $state(false);

  // Learn to play remembers its own speed, starting slow (session 61).
  // (Each game mounts its own screen, so reading the difficulty once is right.)
  const replay = untrack(() => game.difficulty) === 'learn' ? new Replay('cribexe.turnSpeed.learn', 'slow') : new Replay();
  // A game resumed from a save opens at its present (session 72): its steps
  // so far were already seen before the reload.
  let caughtUp = false;
  $effect(() => {
    const steps = game.result ? game.finalSteps : (game.frame?.steps ?? []);
    const scores = game.result?.finalScores ?? game.frame?.request.view.scores ?? [0, 0];
    untrack(() => {
      replay.sync(steps, scoreReadings(scores));
      if (!caughtUp && 'resumed' in game && game.resumed) replay.skip();
      caughtUp = true;
    });
  });
  $effect(() => () => replay.reset());

  const r = $derived(game.frame?.request ?? null);
  const shownSteps = $derived<readonly Step[]>(replay.steps.slice(0, replay.shown));
  const table = $derived(tableAt(replay.steps, replay.shown));
  const pegs = $derived(pegsAfter(replay.steps, replay.shown));
  const handReady = $derived(!!r && table.handIndex === r.view.handIndex && !replay.playing);
  const hand = $derived<Card[]>(r ? (r.kind === 'discard' ? r.context.hand : r.pegging.hand) : []);
  const legal = $derived<Card[]>(r ? (r.kind === 'discard' ? r.context.hand : r.context.legalCards) : []);
  const ticker = $derived(
    shownSteps
      .map((s) => stepLine(s, new Map()))
      .filter((l) => l !== null)
      .slice(-3),
  );
  const fullLog = $derived(shownSteps.map((s) => stepLine(s, new Map())).filter((l) => l !== null));
  let showLog = $state(false);

  const callout = $derived.by(() => {
    const step = replay.current;
    if (step?.type !== 'beat') return null;
    const b = step.beat;
    if (b.kind === 'points' && b.phase !== 'show') return { text: scoreLabel(b.occurrence, b.phase), side: b.occurrence.player, key: replay.shown };
    return null;
  });
  const gapToast = $derived.by(() => {
    const step = replay.current;
    if (step?.type !== 'beat') return null;
    const b = step.beat;
    if (b.kind === 'points' && b.phase === 'show') return { text: `${b.occurrence.player === 0 ? '+' : '−'} ${scoreLabel(b.occurrence, 'show')}`, side: b.occurrence.player, key: replay.shown };
    return null;
  });
  const banner = $derived.by(() => {
    const step = replay.current;
    if (step?.type !== 'beat' || step.beat.kind !== 'hand') return null;
    return { title: `HAND ${step.beat.handIndex + 1}`, sub: step.beat.dealer === 0 ? 'you deal · your crib' : 'they deal · their crib', key: replay.shown };
  });

  // What the coach says at this pause (checkpoint 4): titled sections,
  // advice for now first, then looking back (CoachPanel).
  const coachSections = $derived.by<CoachSection[]>(() => {
    if (!game.coach || !r || !handReady) return [];
    const ownCrib = r.view.dealer === 0;
    const first = r.view.handIndex === 0;
    const sections: CoachSection[] = [];
    if (r.kind === 'discard') {
      // A suggestion before you choose, as pegging gets (the user's call);
      // the review of what you did follows at your first pegging card.
      sections.push({ title: 'NOW', lines: [...(game.hints ? [discardHint(r.context.hand, ownCrib)] : []), phaseIntro('discard', ownCrib, false)] });
      if (first) sections.push({ title: 'HOW IT WORKS', lines: [phaseIntro('discard', ownCrib, true)] });
      else {
        sections.push({ title: "LAST HAND'S COUNT", lines: showSummary(r.view.timeline) });
        if (r.view.handIndex === 1) sections.push({ title: 'HOW IT WORKS', lines: [phaseIntro('show', ownCrib, true)] });
      }
    } else {
      sections.push({ title: 'NOW', lines: [game.hints ? pegHint(pegSpot(r)) : phaseIntro('peg', ownCrib, false)] });
      const p = game.lastPlay;
      if (p && p.handIndex === r.view.handIndex) sections.push({ title: 'YOUR LAST PLAY', lines: [], choice: { kind: 'play', spot: p.spot, played: p.played } });
      const d = game.lastDiscard;
      if (d && d.handIndex === r.view.handIndex) sections.push({ title: 'YOUR DISCARD', lines: [], choice: { kind: 'discard', hand: d.hand, thrown: d.thrown, ownCrib: d.ownCrib } });
      if (first) sections.push({ title: 'HOW IT WORKS', lines: [phaseIntro('peg', ownCrib, true)] });
    }
    return sections;
  });

  const level = $derived(DIFFICULTIES[game.difficulty]);
  const over = $derived(game.result && !replay.playing ? game.result : null);
  const pts = $derived(over ? pointsSummary(cribbageBeats(over.timeline)) : null);
  // The evasion's score as it plays: the gatekeeper's never shows below
  // its head start (no scoring beat carries it until it first scores).
  const evasionScores = $derived<[number, number]>(evasion ? [pegs[0][0], Math.max(pegs[1][0], evasion.headStart)] : [0, 0]);

  function onkey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (replay.playing && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      replay.skip();
    } else if (e.key === 'Escape' && showLog) showLog = false;
  }
</script>

<div class="screen">
  <main class="main">
    <div class="top">
      <div class="who">
        {#if evasion}
          <span class="tag evade">TRACE EVASION</span> <span class="level">{evasion.enemyName}</span>
          <button class="pill" onclick={() => replay.cycleSpeed()} title="speed">» {replay.speed}</button>
        {:else}
          <span class="tag">CRIBBAGE</span> <span class="level">{level.name}</span>
          <button class="pill" class:on={game.coach} aria-pressed={game.coach} onclick={() => (game.coach = !game.coach)} title="the coach: {game.coach ? 'on' : 'off'}">◈ coach</button>
          <button class="pill" onclick={() => replay.cycleSpeed()} title="speed">» {replay.speed}</button>
          <button class="pill" onclick={onmenu}>menu</button>
        {/if}
      </div>
      {#if evasion}
        <EvasionScore scores={evasionScores} name={evasion.enemyName} hand={Math.min(evasion.hands, table.handIndex + 1)} hands={evasion.hands} headStart={evasion.headStart} />
      {:else}
        <ScoreBars {pegs} />
      {/if}
    </div>

    <div class="table-slot">
      {#if table.show}
        <ShowPanel show={table.show} />
      {:else}
        <Table sequence={[]} pile={table.pile} leaving={table.leaving} count={table.count} starter={table.starter} playerIsDealer={table.dealer === 0} opponentCardsLeft={table.cardsLeft[1]} {callout} />
      {/if}
      {#if gapToast}
        {#key gapToast.key}
          <div class="gap-toast" class:them={gapToast.side === 1}>{gapToast.text}</div>
        {/key}
      {/if}
      {#if banner}
        {#key banner.key}
          <div class="banner"><b>{banner.title}</b><span>{banner.sub}</span></div>
        {/key}
      {/if}
    </div>

    {#if game.coach}
      <CoachPanel sections={coachSections} onlog={() => (showLog = true)} hints={game.hints} onhints={() => (game.hints = !game.hints)} />
    {:else}
      <button class="ticker" onclick={() => (showLog = true)}>
        {#each ticker as line, i (i)}
          <div class:them={line.side === 1} class:quiet={line.kind === 'table'}>{line.side === null ? '' : line.side === 0 ? '$ ' : '> '}<RichText text={line.text} /></div>
        {/each}
        <div class="more">tap for full log</div>
      </button>
    {/if}

    <!-- A fixed slot: the hand, the wait, or an empty hand all take the same
         height, so nothing above it shifts (the user's catch). -->
    <div class="hand-slot">
      {#if handReady && r}
        <Hand {hand} {legal} count={r.kind === 'play' ? r.context.count : 0} sequence={r.kind === 'play' ? r.context.sequence : []} phase={r.kind} playerIsDealer={r.view.dealer === 0} onplay={(c) => game.answer(c)} ondiscard={(c) => game.answer(c)} inactive={replay.playing} />
      {:else}
        <div class="hand-wait">…</div>
      {/if}
    </div>
  </main>
</div>

<svelte:window onkeydown={onkey} />


{#if showLog}
  <div class="scrim" onclick={() => (showLog = false)} role="presentation"></div>
  <aside class="log" use:stickToBottom>
    <button class="close" onclick={() => (showLog = false)} aria-label="close log">✕</button>
    {#each fullLog as line, i (i)}
      <div class:them={line.side === 1} class:quiet={line.kind === 'table'}>{line.side === null ? '' : line.side === 0 ? '$ ' : '> '}<RichText text={line.text} /></div>
    {/each}
  </aside>
{/if}

{#if over && pts && evasion}
  <div class="scrim end-scrim"></div>
  <div class="result" class:won={over.winner === 0}>
    <div class="title">{over.winner === 0 ? '>> SLIPPED THE TRACE' : '>> TRACED'}</div>
    <div class="line">
      {over.winner === 0
        ? evasion.layer >= 4
          ? `You lost ${evasion.enemyName} in the noise, and the network is yours.`
          : `You lost ${evasion.enemyName} in the noise. On to the next layer.`
        : over.finalScores[0] === over.finalScores[1]
          ? `A tie goes to the network: ${evasion.enemyName} found you.`
          : `${evasion.enemyName} found you.`}
    </div>
    <table class="points">
      <thead><tr><th>points scored</th><th class="you">you</th><th class="them">them</th></tr></thead>
      <tbody>
        <tr><td>head start</td><td>0</td><td>{evasion.headStart}</td></tr>
        <tr><td>pegging</td><td>{pts[0].pegging}</td><td>{pts[1].pegging}</td></tr>
        <tr><td>hands</td><td>{pts[0].hands}</td><td>{pts[1].hands}</td></tr>
        <tr><td>crib</td><td>{pts[0].crib}</td><td>{pts[1].crib}</td></tr>
        {#if pts[0].heels + pts[1].heels > 0}<tr><td>his heels</td><td>{pts[0].heels}</td><td>{pts[1].heels}</td></tr>{/if}
        <tr class="total"><td>total</td><td class="you">{over.finalScores[0]}</td><td class="them">{over.finalScores[1]}</td></tr>
      </tbody>
    </table>
    <div class="buttons">
      <button onclick={onagain}>continue ▸</button>
    </div>
  </div>
{:else if over && pts}
  <div class="scrim end-scrim"></div>
  <div class="result" class:won={over.winner === 0}>
    <div class="title">{over.winner === 0 ? '>> YOU WIN' : '>> YOU LOSE'}</div>
    <div class="line">
      {over.finalScores[0]} – {over.finalScores[1]} · {over.hands} hands · {level.name}
    </div>
    {#if over.skunk !== 'none'}
      <div class="skunk">
        {over.skunk === 'double' ? 'DOUBLE SKUNK' : 'SKUNK'}: {over.winner === 0 ? 'they' : 'you'} finished under {over.skunk === 'double' ? 61 : 91}.
      </div>
    {/if}
    <table class="points">
      <thead><tr><th>points scored</th><th class="you">you</th><th class="them">them</th></tr></thead>
      <tbody>
        <tr><td>pegging</td><td>{pts[0].pegging}</td><td>{pts[1].pegging}</td></tr>
        <tr><td>hands</td><td>{pts[0].hands}</td><td>{pts[1].hands}</td></tr>
        <tr><td>crib</td><td>{pts[0].crib}</td><td>{pts[1].crib}</td></tr>
        {#if pts[0].heels + pts[1].heels > 0}<tr><td>his heels</td><td>{pts[0].heels}</td><td>{pts[1].heels}</td></tr>{/if}
        <tr class="total"><td>total (first to {WIN_SCORE})</td><td class="you">{over.finalScores[0]}</td><td class="them">{over.finalScores[1]}</td></tr>
      </tbody>
    </table>
    {#if rating}
      <button class="rating" onclick={() => (reviewOpen = true)}>Cribbage: <StarRating stars={rating.stars} /> {rating.label} <span class="review">review ▸</span></button>
    {/if}
    <div class="buttons">
      <button onclick={onagain}>play again</button>
      <button onclick={onmenu}>menu</button>
    </div>
  </div>
  {#if reviewOpen && rating}<SkillReview {rating} onclose={() => (reviewOpen = false)} />{/if}
{/if}

<style>
  .screen {
    height: 100%;
    display: flex;
    justify-content: center;
  }
  .main {
    flex: 1;
    min-width: 0;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    justify-content: space-between;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
  }
  .top {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .tag {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid var(--accent);
    color: var(--accent);
  }
  .level {
    color: var(--text);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pill {
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-raised);
    font-size: 11px;
    color: var(--text-dim);
    white-space: nowrap;
  }
  .pill:first-of-type {
    margin-left: auto;
  }
  .pill.on {
    border-color: var(--mod);
    color: var(--mod);
  }
  .table-slot {
    position: relative;
    height: 104px;
    flex: none;
    /* Room above for the score toasts, even when the coach panel takes up
       the middle of the screen. */
    margin-top: 32px;
  }
  .table-slot > :global(*:not(.banner):not(.gap-toast)) {
    height: 100%;
    box-sizing: border-box;
  }
  .gap-toast {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 9px);
    transform: translateX(-50%);
    z-index: 2;
    white-space: nowrap;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
    pointer-events: none;
    animation: gap-toast 0.9s ease-out forwards;
  }
  .gap-toast.them {
    border-color: var(--danger);
    color: var(--danger);
  }
  @keyframes gap-toast {
    0% {
      opacity: 0;
      transform: translate(-50%, 8px) scale(0.85);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, 0) scale(1.04);
    }
    70% {
      opacity: 1;
      transform: translate(-50%, -2px) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -4px);
    }
  }
  .banner {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: rgb(7 10 14 / 88%);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    color: var(--accent);
    animation: banner 1.1s ease-out forwards;
    pointer-events: none;
  }
  .banner b {
    font-size: 20px;
    letter-spacing: 0.12em;
  }
  .banner span {
    font-size: 11px;
    color: var(--text-dim);
  }
  @keyframes banner {
    0% {
      opacity: 0;
      transform: scaleY(0.2);
    }
    15% {
      opacity: 1;
      transform: none;
    }
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  .ticker {
    text-align: left;
    font-size: 10.5px;
    line-height: 1.3;
    background: var(--bg-sunken);
    border: 1px dashed var(--line);
    border-radius: var(--radius);
    padding: 5px 7px;
    color: var(--accent);
    min-height: calc(3 * 1.3em + 10px + 12px);
    overflow: hidden;
    min-width: 0;
    width: 100%;
  }
  .ticker > div:not(.more) {
    height: 1.3em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ticker .them,
  .log .them {
    color: var(--danger);
  }
  .ticker .quiet,
  .log .quiet {
    color: var(--text-dim);
  }
  .more {
    color: var(--text-dim);
    font-size: 9px;
    text-align: right;
  }
  .hand-slot {
    height: 124px;
    flex: none;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  /* With a mouse, the hand shows the 1-6 key hints under its cards (Hand's
     own media query), 9px taller (session 63). */
  @media (hover: hover) and (pointer: fine) {
    .hand-slot {
      height: 133px;
    }
  }
  .hand-wait {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
  }
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    z-index: 15;
  }
  .log {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(85%, 380px);
    z-index: 16;
    background: var(--bg-sunken);
    border-right: 1px solid var(--line);
    padding: 12px;
    padding-top: calc(12px + env(safe-area-inset-top));
    overflow: auto;
    font-size: 11px;
    line-height: 1.4;
    color: var(--accent);
    display: flex;
    flex-direction: column;
  }
  .close {
    align-self: flex-end;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 15px;
  }
  .end-scrim {
    z-index: 25;
    background: rgb(0 0 0 / 55%);
  }
  .tag.evade {
    color: var(--danger);
    border-color: var(--danger);
  }
  .result {
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(360px, calc(100% - 32px));
    z-index: 26;
    background: var(--bg-sunken);
    border: 1px solid var(--danger);
    border-radius: var(--radius);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .result.won {
    border-color: var(--accent);
  }
  .title {
    font-size: 20px;
    font-weight: 700;
    color: var(--danger);
  }
  .won .title {
    color: var(--accent);
  }
  .line {
    font-size: 12px;
    color: var(--text-dim);
  }
  .skunk {
    font-size: 12px;
    font-weight: 700;
    color: var(--warn);
  }
  .points {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .points th,
  .points td {
    padding: 3px 4px;
    text-align: right;
  }
  .points th:first-child,
  .points td:first-child {
    text-align: left;
    color: var(--text-dim);
  }
  .points th {
    font-weight: 400;
    font-size: 10px;
    color: var(--text-dim);
    border-bottom: 1px solid var(--line);
  }
  .points .total td {
    border-top: 1px solid var(--line);
    font-weight: 700;
  }
  .you {
    color: var(--accent);
  }
  .them {
    color: var(--danger);
  }
  .buttons {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .buttons button {
    flex: 1;
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
  .buttons button:last-child {
    border-color: var(--line);
    color: var(--text-dim);
    font-weight: 400;
  }
  .rating {
    display: flex;
    align-items: baseline;
    gap: 4px;
    width: 100%;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font: inherit;
    font-size: 13px;
    text-align: left;
  }
  .rating .review {
    margin-left: auto;
    font-size: 11px;
    color: var(--accent);
  }
</style>
