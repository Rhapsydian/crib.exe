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
  // Desktop keys (P5): 1-6 tap the card in that position, Enter sends the
  // discard or plays the lifted card. `inactive` (a turn still playing
  // out) ignores them, and taps too (session 63: with tap-to-skip gone,
  // a card tapped mid-replay would jump ahead of what's on screen).
  let {
    hand,
    legal,
    count,
    sequence,
    phase = 'play',
    playerIsDealer = false,
    countLimit = 31,
    onplay,
    ondiscard,
    inactive = false,
  }: {
    hand: Card[];
    legal: Card[];
    count: number;
    sequence: Card[];
    phase?: 'discard' | 'play';
    playerIsDealer?: boolean;
    countLimit?: number;
    onplay?: (card: Card) => void;
    ondiscard?: (cards: [Card, Card]) => void;
    inactive?: boolean;
  } = $props();

  function onkey(e: KeyboardEvent) {
    // defaultPrevented: the fight screen already used this key (Enter
    // skipping a turn shouldn't also play a card).
    if (inactive || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!onplay && !ondiscard) return;
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= shown.length) {
      e.preventDefault();
      tap(shown[n - 1]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (phase === 'discard') discard();
      else play();
    }
  }

  let lifted = $state<Card[]>([]);
  let mockNote = $state<string | null>(null);
  // Cards already played or sent to the crib, hidden until the engine's
  // next pause brings a new hand. A play that ends the fight brings none
  // (the last frame stays up behind the result), so without this the
  // played card stayed in the hand (session 61's playtest bug).
  let sent = $state<Card[]>([]);
  const shown = $derived(hand.filter((c) => !sent.some((s) => cardsEqual(s, c))));

  // A new request (the hand changed) drops whatever was lifted or sent.
  $effect(() => {
    void hand;
    lifted = [];
    sent = [];
  });

  const isLegal = (c: Card) => legal.some((l) => cardsEqual(l, c));
  const isLifted = (c: Card) => lifted.some((l) => cardsEqual(l, c));
  const preview = $derived.by(() => {
    if (phase !== 'play' || lifted.length === 0) return null;
    const card = lifted[0];
    const next = count + cardValue(card);
    const b = scoreCardPlay([...sequence, card], next, countLimit);
    const parts = [b.fifteen && 'fifteen', b.pair && (b.pair === 2 ? 'pair' : b.pair === 6 ? 'pair royal' : 'double pair royal'), b.run && `run of ${b.run}`, b.thirtyOne && String(countLimit)].filter(Boolean);
    return { count: next, score: b.total, label: parts.length ? `${parts.join(' + ')} for ${b.total}` : 'no score' };
  });

  function tap(card: Card) {
    // Waiting on the engine after a play or discard, or a turn still
    // playing out: nothing to tap.
    if (inactive || sent.length > 0 || !isLegal(card)) return;
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
    if (!card || inactive) return;
    lifted = [];
    if (onplay) {
      sent = [card];
      onplay(card);
    }
    else mockNote = `would play ${card.rank}/${card.suit} → engine`;
  }
  function discard() {
    if (lifted.length !== 2 || inactive) return;
    const cards: [Card, Card] = [lifted[0], lifted[1]];
    lifted = [];
    if (ondiscard) {
      sent = cards;
      ondiscard(cards);
    }
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
    {#each shown as card, i (i)}
      <div class="slot">
        <CardView {card} lifted={isLifted(card)} dimmed={!isLegal(card)} onclick={() => tap(card)} />
        <span class="key">{i + 1}</span>
      </div>
    {/each}
  </div>
</div>

<svelte:window onkeydown={onkey} />

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
  .slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  /* Number-key hints, only where there's a keyboard and a mouse. */
  .key {
    display: none;
    font-size: 10px;
    color: var(--text-dim);
  }
  @media (hover: hover) and (pointer: fine) {
    .key {
      display: block;
    }
  }
  .hand {
    display: flex;
    justify-content: center;
    gap: 6px;
    padding-top: 14px;
  }
  /* The narrowest phones (320px): six full cards need 342px, so the hand
     shrinks a little to fit. */
  @media (max-width: 359px) {
    .hand {
      gap: 3px;
    }
    .slot :global(.card) {
      width: 46px;
      height: 66px;
    }
  }
</style>
