<script lang="ts">
  import { cardValue, cardsEqual, type Card } from '../engine/cards';
  import { scoreCardPlay } from '../engine/pegging';
  import CardView from './CardView.svelte';

  // The player's hand during pegging (P5): tap a card to lift it, which
  // previews what it would score; tap it again (or Play) to play it.
  // Cards that would pass 31 are dimmed. A mockup: playing only shows
  // what would be sent to the engine.
  let { hand, legal, count, sequence }: { hand: Card[]; legal: Card[]; count: number; sequence: Card[] } = $props();

  let lifted = $state<Card | null>(null);
  let played = $state<string | null>(null);

  const isLegal = (c: Card) => legal.some((l) => cardsEqual(l, c));
  const preview = $derived.by(() => {
    if (!lifted) return null;
    const next = count + cardValue(lifted);
    const b = scoreCardPlay([...sequence, lifted], next);
    const parts = [b.fifteen && 'fifteen', b.pair && (b.pair === 2 ? 'pair' : b.pair === 6 ? 'pair royal' : 'double pair royal'), b.run && `run of ${b.run}`, b.thirtyOne && '31'].filter(Boolean);
    return { count: next, score: b.total, label: parts.length ? `${parts.join(' + ')} for ${b.total}` : 'no score' };
  });

  function tap(card: Card) {
    if (!isLegal(card)) return;
    if (lifted && cardsEqual(lifted, card)) play();
    else lifted = card;
  }
  function play() {
    if (lifted) played = `would play ${lifted.rank}/${lifted.suit} → engine`;
    lifted = null;
  }
</script>

<div class="hand-area">
  <div class="preview">
    {#if preview}
      <span>→ count {preview.count}: <b class:score={preview.score > 0}>{preview.label}</b></span>
      <button class="play" onclick={play}>Play</button>
    {:else if played}
      <span class="dim">{played}</span>
    {:else}
      <span class="dim">tap a card to lift it</span>
    {/if}
  </div>
  <div class="hand">
    {#each hand as card, i (i)}
      <CardView {card} lifted={lifted !== null && cardsEqual(lifted, card)} dimmed={!isLegal(card)} onclick={() => tap(card)} />
    {/each}
  </div>
</div>

<style>
  .hand-area {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .preview {
    min-height: 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
  }
  .dim {
    color: var(--text-dim);
  }
  .score {
    color: var(--accent);
  }
  .play {
    padding: 4px 14px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
  }
  .hand {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding-top: 14px;
  }
</style>
