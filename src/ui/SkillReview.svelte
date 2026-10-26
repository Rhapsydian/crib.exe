<script lang="ts">
  import ChoiceReview from './ChoiceReview.svelte';
  import type { SkillRating } from './skill-review';
  import { nextStar } from '../engine/skill';
  import StarRating from './StarRating.svelte';

  // The review coach's drawer (session 70): a fight's Cribbage rating and
  // its costliest mistakes, each the coach's own review of that choice.
  // A bottom sheet on phones, a centred card on wide screens (as
  // DetailSheet).
  let { rating, onclose }: { rating: SkillRating; onclose: () => void } = $props();
  const pts = (n: number) => `${n.toFixed(1)} point${n.toFixed(1) === '1.0' ? '' : 's'}`;
  // What the next star asks (session 72, stars): "Expert is 1.2 or less."
  const next = $derived(nextStar(rating.stars));
</script>

<div class="scrim" onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-label="Cribbage review">
  <div class="head">
    <div class="kicker">CRIBBAGE REVIEW</div>
    <div class="score"><StarRating stars={rating.stars} /> <span class="label">{rating.label}</span></div>
    <!-- The sum in words (session 72, the user: the rating should be
         transparent; stars, not a percentage): the points given up per
         hand, and what the next star asks. -->
    <div class="about">You gave up an average of {pts(rating.lostPerHand)} a hand to the coach's choices, over {rating.hands} {rating.hands === 1 ? 'hand' : 'hands'}.{next ? ` ${next.label} is ${next.maxLostPerHand.toFixed(1)} or less.` : ''}</div>
  </div>
  {#if rating.mistakes.length}
    <div class="caption">COSTLIEST {rating.mistakes.length === 1 ? 'MISTAKE' : 'MISTAKES'}</div>
    {#each rating.mistakes as m, i (i)}
      {@const d = m.decision}
      <div class="mistake">
        <div class="where">Hand {m.hand} · {d.kind === 'discard' ? `discard · ${d.ownCrib ? 'your crib' : 'their crib'}` : 'pegging'}</div>
        <!-- Your choice beside the coach's (session 72, the user's design;
             it was the cards drawn large and a paragraph of prose). -->
        <ChoiceReview choice={d} />
      </div>
    {/each}
  {:else}
    <div class="clean">No mistakes: every choice matched the coach's.</div>
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
