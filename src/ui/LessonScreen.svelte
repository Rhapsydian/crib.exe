<script lang="ts">
  import { cardsEqual, cardValue, type Card } from '../engine/cards';
  import { findTargets, matchesTarget, pegGoalMet, type Lesson, type LessonStep } from './lessons';
  import { article, discardReview } from './coach';
  import CardView from './CardView.svelte';
  import RichText from './RichText.svelte';

  // A lesson (milestone 4 checkpoint 5): its steps one at a time. Read
  // steps just continue; the others are done once answered right (a
  // discard is done once tried -- the coach's review says how it went).
  // `number` / `total` for the header; `onfinish` when the last step is
  // done (the hub marks it and offers the next).
  let {
    lesson,
    number,
    total,
    onexit,
    onfinish,
  }: { lesson: Lesson; number: number; total: number; onexit: () => void; onfinish: () => void } = $props();

  let at = $state(0);
  const step = $derived<LessonStep>(lesson.steps[at]);
  // Per-step working state, reset when the step changes.
  let selected = $state<Card[]>([]);
  let found = $state<number[]>([]);
  let feedback = $state<{ ok: boolean; text: string } | null>(null);
  let done = $state(false);
  let wrong = $state<number[]>([]);
  $effect(() => {
    void at;
    selected = [];
    found = [];
    feedback = null;
    wrong = [];
    done = lesson.steps[at].kind === 'read';
  });

  const isSel = (card: Card) => selected.some((x) => cardsEqual(x, card));
  function toggle(card: Card, max: number) {
    // Finds and discards stay open: more to find, or another throw to try.
    if (done && step.kind !== 'find' && step.kind !== 'discard') return;
    selected = isSel(card) ? selected.filter((x) => !cardsEqual(x, card)) : selected.length < max ? [...selected, card] : selected;
  }

  // find
  const targets = $derived(step.kind === 'find' ? findTargets(step) : []);
  function checkFind() {
    if (step.kind !== 'find') return;
    const hit = targets.findIndex((t, i) => !found.includes(i) && matchesTarget(selected, t));
    if (hit >= 0) {
      found = [...found, hit];
      selected = [];
      const left = targets.length - found.length;
      feedback = { ok: true, text: left ? `Yes -- ${targets[hit].points} points. ${left} more to find.` : `All found. ${step.explain}` };
      if (!left) done = true;
      return;
    }
    const already = targets.some((t, i) => found.includes(i) && matchesTarget(selected, t));
    const sum = selected.reduce((s, x) => s + cardValue(x), 0);
    // Each attempt starts fresh.
    selected = [];
    feedback = {
      ok: false,
      text: already
        ? 'You found that one already.'
        : step.category === 'fifteen'
          ? `Those add to ${sum}, not 15. Try again.`
          : step.category === 'pair'
            ? 'A pair is two cards of the same rank. Try again.'
            : 'A run is three or more cards in a row -- all of them. Try again.',
    };
  }

  // choice
  function choose(i: number) {
    if (step.kind !== 'choice' || done) return;
    if (i === step.answer) {
      done = true;
      feedback = { ok: true, text: step.explain };
    } else {
      wrong = [...wrong, i];
      feedback = { ok: false, text: 'Not quite. Try again.' };
    }
  }

  // peg
  const pegCount = $derived(step.kind === 'peg' ? step.sequence.reduce((s, x) => s + cardValue(x), 0) : 0);
  function peg(card: Card) {
    if (step.kind !== 'peg' || done) return;
    if (pegGoalMet(step, card)) {
      done = true;
      selected = [card];
      feedback = { ok: true, text: step.explain };
    } else {
      feedback = { ok: false, text: step.goal === 'safeLead' ? `${article(String(cardValue(card))) === 'an' ? 'An' : 'A'} ${cardValue(card)} lets them make 15 off it. Try again.` : `That makes the count ${pegCount + cardValue(card)} -- no score. Try again.` };
    }
  }

  // discard
  function throwPair() {
    if (step.kind !== 'discard' || selected.length !== 2) return;
    const review = discardReview(step.hand, [selected[0], selected[1]], step.ownCrib);
    feedback = { ok: review.same, text: review.same ? review.text : `${review.text} Try another, or continue.` };
    done = true;
    if (!review.same) selected = [];
  }

  function next() {
    if (at < lesson.steps.length - 1) at++;
    else onfinish();
  }
</script>

<div class="lesson">
  <div class="head">
    <span class="kicker">LESSON {number} OF {total}</span>
    <button class="x" onclick={onexit} aria-label="leave the lesson">✕</button>
  </div>
  <div class="title">{lesson.title}</div>
  <div class="dots">
    {#each lesson.steps as _, i (i)}<span class="dot" class:on={i <= at}></span>{/each}
  </div>

  <div class="body">
    {#if step.kind === 'read'}
      <p>{step.text}</p>
      {#if step.cards || step.starter}
        <div class="cards">
          {#each step.cards ?? [] as card, i (i)}<CardView {card} />{/each}
          {#if step.starter}<div class="starter"><span>starter</span><CardView card={step.starter} /></div>{/if}
        </div>
      {/if}
    {:else if step.kind === 'find'}
      <p>{step.prompt}</p>
      <div class="cards">
        {#each step.hand as card, i (i)}<CardView {card} lifted={isSel(card)} onclick={() => toggle(card, 5)} />{/each}
        <div class="starter"><span>starter</span><CardView card={step.starter} lifted={isSel(step.starter)} onclick={() => toggle(step.starter, 5)} /></div>
      </div>
      <div class="found">found {found.length} of {targets.length}</div>
      {#if !done}<button class="act" disabled={!selected.length} onclick={checkFind}>check</button>{/if}
    {:else if step.kind === 'choice'}
      <p>{step.prompt}</p>
      {#if step.cards || step.starter}
        <div class="cards">
          {#each step.cards ?? [] as card, i (i)}<CardView {card} />{/each}
          {#if step.starter}<div class="starter"><span>starter</span><CardView card={step.starter} /></div>{/if}
        </div>
      {/if}
      <div class="options">
        {#each step.options as option, i (i)}
          <button class="option" class:right={done && i === step.answer} class:wrong={wrong.includes(i)} onclick={() => choose(i)}>{option}</button>
        {/each}
      </div>
    {:else if step.kind === 'peg'}
      <p>{step.prompt}</p>
      <div class="table">
        <span class="count">{pegCount}<small>/31</small></span>
        <div class="pile">{#each step.sequence as card, i (i)}<CardView {card} small />{/each}</div>
      </div>
      <div class="cards">
        {#each step.hand as card, i (i)}<CardView {card} lifted={done && isSel(card)} dimmed={done && !isSel(card)} onclick={() => peg(card)} />{/each}
      </div>
    {:else if step.kind === 'discard'}
      <p>{step.prompt}</p>
      <div class="cards">
        {#each step.hand as card, i (i)}<CardView {card} lifted={isSel(card)} onclick={() => toggle(card, 2)} />{/each}
      </div>
      <button class="act" disabled={selected.length !== 2} onclick={throwPair}>throw {selected.length}/2 into {step.ownCrib ? 'your' : 'their'} crib</button>
    {/if}

    {#if feedback}<div class="feedback" class:ok={feedback.ok}><RichText text={feedback.text} /></div>{/if}
  </div>

  <div class="nav">
    <button class="back" disabled={at === 0} onclick={() => at--}>◂ back</button>
    <button class="next" disabled={!done} onclick={next}>{at < lesson.steps.length - 1 ? 'next ▸' : 'finish ▸'}</button>
  </div>
</div>

<style>
  .lesson {
    max-width: 560px;
    margin: 0 auto;
    min-height: 100%;
    box-sizing: border-box;
    padding: var(--gutter);
    padding-top: calc(16px + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .head {
    display: flex;
    align-items: center;
  }
  .kicker {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.1em;
  }
  .x {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 15px;
  }
  .title {
    color: var(--accent);
    font-weight: 700;
    font-size: 17px;
  }
  .dots {
    display: flex;
    gap: 4px;
  }
  .dot {
    flex: 1;
    height: 3px;
    border-radius: 2px;
    background: var(--line);
  }
  .dot.on {
    background: var(--accent);
  }
  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding-top: 6px;
  }
  p {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.5;
  }
  .cards {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: center;
    align-items: flex-end;
    padding-top: 12px;
  }
  /* The narrowest phones: six cards fit one row. */
  @media (max-width: 359px) {
    .cards {
      gap: 4px;
    }
    .cards :global(.card) {
      width: 42px;
      height: 60px;
    }
  }
  .starter {
    margin-left: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .starter span {
    font-size: 9px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
  }
  .found {
    text-align: center;
    font-size: 11px;
    color: var(--text-dim);
  }
  .act {
    align-self: center;
    padding: 9px 18px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
  .act:disabled {
    border-color: var(--line);
    color: var(--text-dim);
    font-weight: 400;
  }
  .options {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .option {
    min-width: 72px;
    padding: 10px 14px;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--bg-raised);
    color: var(--text);
    font-size: 13px;
  }
  .option.right {
    border-color: var(--accent);
    color: var(--accent);
  }
  .option.wrong {
    border-color: var(--danger);
    color: var(--danger);
    opacity: 0.7;
  }
  .table {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-sunken);
  }
  .count {
    font-size: 28px;
    font-weight: 700;
    color: var(--accent);
  }
  .count small {
    font-size: 13px;
    color: var(--text-dim);
  }
  .pile {
    display: flex;
    gap: 4px;
  }
  .feedback {
    font-size: 13px;
    line-height: 1.45;
    padding: 8px 10px;
    border-radius: var(--radius);
    border: 1px solid var(--danger);
    color: var(--text);
    background: var(--bg-sunken);
  }
  .feedback.ok {
    border-color: var(--accent);
  }
  .nav {
    display: flex;
    gap: 8px;
  }
  .nav button {
    padding: 10px;
    border-radius: var(--radius);
    font-size: 13px;
    background: transparent;
  }
  .back {
    border: 1px solid var(--line);
    color: var(--text-dim);
  }
  .back:disabled {
    opacity: 0.4;
  }
  .next {
    flex: 1;
    border: 1px solid var(--accent);
    color: var(--accent);
    font-weight: 700;
  }
  .next:disabled {
    border-color: var(--line);
    color: var(--text-dim);
    font-weight: 400;
  }
</style>
