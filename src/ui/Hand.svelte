<script lang="ts">
  import { cardValue, cardsEqual, type Card } from '../engine/cards';
  import { scoreCardPlay } from '../engine/pegging';
  import CardView from './CardView.svelte';

  // The player's hand (P5), tap to lift then confirm.
  // - Discard: lift two cards, then "Send to crib". Tapping a lifted card
  //   drops it back.
  // - Pegging: tap a card to lift it, which previews what it would score;
  //   tap it again (or Play) to play it. Cards that would pass 31 are
  //   dimmed.
  // Without the callbacks (the mockups) it only shows what it would send.
  let {
    hand,
    legal,
    count,
    sequence,
    phase = 'play',
    playerIsDealer = false,
    onplay,
    ondiscard,
  }: {
    hand: Card[];
    legal: Card[];
    count: number;
    sequence: Card[];
    phase?: 'discard' | 'play';
    playerIsDealer?: boolean;
    onplay?: (card: Card) => void;
    ondiscard?: (cards: [Card, Card]) => void;
  } = $props();

  let lifted = $state<Card[]>([]);
  let mockNote = $state<string | null>(null);

  // A new request (the hand changed) drops whatever was lifted.
  $effect(() => {
    void hand;
    lifted = [];
  });

  const isLegal = (c: Card) => legal.some((l) => cardsEqual(l, c));
  const isLifted = (c: Card) => lifted.some((l) => cardsEqual(l, c));
  const preview = $derived.by(() => {
    if (phase !== 'play' || lifted.length === 0) return null;
    const card = lifted[0];
    const next = count + cardValue(card);
    const b = scoreCardPlay([...sequence, card], next);
    const parts = [b.fifteen && 'fifteen', b.pair && (b.pair === 2 ? 'pair' : b.pair === 6 ? 'pair royal' : 'double pair royal'), b.run && `run of ${b.run}`, b.thirtyOne && '31'].filter(Boolean);
    return { count: next, score: b.total, label: parts.length ? `${parts.join(' + ')} for ${b.total}` : 'no score' };
  });

  function tap(card: Card) {
    if (!isLegal(card)) return;
    if (phase === 'discard') {
      if (isLifted(card)) lifted = lifted.filter((l) => !cardsEqual(l, card));
      else if (lifted.length < 2) lifted = [...lifted, card];
      return;
    }
    if (isLifted(card)) play();
    else lifted = [card];
  }
  function play() {
    const card = lifted[0];
    if (!card) return;
    lifted = [];
    if (onplay) onplay(card);
    else mockNote = `would play ${card.rank}/${card.suit} → engine`;
  }
  function discard() {
    if (lifted.length !== 2) return;
    const cards: [Card, Card] = [lifted[0], lifted[1]];
    lifted = [];
    if (ondiscard) ondiscard(cards);
    else mockNote = 'would send 2 cards to the crib → engine';
  }
</script>

<div class="hand-area">
  <div class="preview">
    {#if phase === 'discard'}
      <span class:dim={lifted.length < 2}>{lifted.length < 2 ? `pick 2 for ${playerIsDealer ? 'your' : 'their'} crib (${lifted.length}/2)` : `send to ${playerIsDealer ? 'your' : 'their'} crib?`}</span>
      {#if lifted.length === 2}<button class="play" onclick={discard}>Send to crib</button>{/if}
    {:else if preview}
      <span>→ count {preview.count}: <b class:score={preview.score > 0}>{preview.label}</b></span>
      <button class="play" onclick={play}>Play</button>
    {:else if mockNote}
      <span class="dim">{mockNote}</span>
    {:else}
      <span class="dim">tap a card to lift it</span>
    {/if}
  </div>
  <div class="hand">
    {#each hand as card, i (i)}
      <CardView {card} lifted={isLifted(card)} dimmed={!isLegal(card)} onclick={() => tap(card)} />
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
