<script lang="ts">
  import RichText from './RichText.svelte';
  import CardView from './CardView.svelte';
  import { cardsEqual } from '../engine/cards';
  import type { SkillRating } from './skill-review';

  // The review coach's drawer (session 70): a fight's Cribbage rating and
  // its costliest mistakes, each the coach's own review of that choice.
  // A bottom sheet on phones, a centred card on wide screens (as
  // DetailSheet).
  let { rating, onclose }: { rating: SkillRating; onclose: () => void } = $props();
  const pts = (n: number) => `${n.toFixed(1)} point${n.toFixed(1) === '1.0' ? '' : 's'}`;
</script>

<div class="scrim" onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-label="Cribbage review">
  <div class="head">
    <div class="kicker">CRIBBAGE REVIEW</div>
    <div class="score">{rating.rating}% <span class="label">{rating.label}</span></div>
    <div class="about">How close your {rating.decisions} discards and pegging plays came to the coach's, by the points each gave up.</div>
  </div>
  {#if rating.mistakes.length}
    <div class="caption">COSTLIEST {rating.mistakes.length === 1 ? 'MISTAKE' : 'MISTAKES'}</div>
    {#each rating.mistakes as m, i (i)}
      {@const d = m.decision}
      <div class="mistake">
        <div class="where">Hand {m.hand} · {m.kind === 'discard' ? 'discard' : 'pegging'} · cost about {pts(m.lost)}</div>
        <!-- The cards as they were (the user, session 70): a discard's whole
             hand and whose crib; pegging's table. -->
        {#if d.kind === 'discard'}
          <div class="table">
            <div class="row">
              <span class="tag">dealt · {d.ownCrib ? 'your crib' : 'their crib'}</span>
              <span class="cards">{#each d.hand as card, i (i)}<span class="slot" class:thrown={d.thrown.some((t) => cardsEqual(t, card))}><CardView {card} small /></span>{/each}</span>
            </div>
            <div class="note">The two raised are the ones you threw into {d.ownCrib ? 'your' : 'their'} crib.</div>
          </div>
        {:else}
          <div class="table">
            <div class="row">
              <span class="tag">table · count {d.spot.count}</span>
              <span class="cards">
                {#each d.spot.sequence as card, i (i)}<CardView {card} small />{/each}
                {#if !d.spot.sequence.length}<span class="empty">nothing played yet</span>{/if}
              </span>
            </div>
            <div class="row">
              <span class="tag">your hand</span>
              <span class="cards">{#each d.hand as card, i (i)}<span class="slot" class:thrown={cardsEqual(card, d.played)}><CardView {card} small dimmed={!d.spot.legal.some((l) => cardsEqual(l, card))} /></span>{/each}</span>
            </div>
            {#if d.starter}
              <div class="row">
                <span class="tag">cut</span>
                <span class="cards"><CardView card={d.starter} small /></span>
              </div>
            {/if}
            <div class="note">They hold {d.spot.opponentCards} card{d.spot.opponentCards === 1 ? '' : 's'}. The raised card is the one you played; dimmed cards couldn't be played.</div>
          </div>
        {/if}
        <div class="text"><RichText text={m.text} /></div>
      </div>
    {/each}
  {:else}
    <div class="clean">No costly mistakes: every choice came within half a point of the coach's.</div>
  {/if}
  <button class="close" onclick={onclose}>close</button>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    z-index: 30;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 31;
    max-height: 85vh;
    overflow-y: auto;
    background: var(--bg-raised);
    border-top: 2px solid var(--accent);
    border-radius: 12px 12px 0 0;
    padding: 14px 16px calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
  }
  @media (min-width: 900px) {
    .sheet {
      left: 50%;
      right: auto;
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 440px;
      border: 1px solid var(--line);
      border-top: 2px solid var(--accent);
      border-radius: 12px;
    }
  }
  .kicker,
  .caption {
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }
  .score {
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
  }
  .label {
    font-size: 14px;
    font-weight: 400;
    color: var(--text);
  }
  .about,
  .clean {
    color: var(--text-dim);
    font-size: 12px;
  }
  .caption {
    margin-top: 4px;
  }
  .mistake {
    border-left: 2px solid var(--warn);
    padding-left: 8px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .where {
    font-size: 11px;
    color: var(--warn);
  }
  .text {
    line-height: 1.4;
  }
  .table {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px 0 2px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .tag {
    font-size: 10px;
    color: var(--text-dim);
    min-width: 70px;
  }
  .cards {
    display: flex;
    gap: 3px;
    align-items: flex-end;
    min-height: 46px;
  }
  .slot.thrown {
    transform: translateY(-6px);
  }
  .empty,
  .note {
    font-size: 11px;
    color: var(--text-dim);
  }
  .close {
    margin-top: 4px;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--text);
    font: inherit;
  }
</style>
