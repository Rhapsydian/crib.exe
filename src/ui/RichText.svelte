<script lang="ts" module>
  import type { Card, Rank, Suit } from '../engine/cards';
  /** A suit marked in text (the user's ask: the suit icon before its
   * name): `suitToken(2)` renders as the icon and the name. */
  export const suitToken = (suit: Suit) => `[[suit:${suit}]]`;
  /** A card marked in text (session 72): renders as a CardChip. */
  export const cardToken = (card: Card) => `[[card:${card.rank}:${card.suit}]]`;
</script>

<script lang="ts">
  import SuitIcon from './SuitIcon.svelte';
  import CardChip from './CardChip.svelte';
  import { suitInfo } from './suits';
  import type { Archetype } from '../engine/subroutine-types';

  // Text that may carry suit tokens (suitToken) and card tokens
  // (cardToken): a suit becomes its icon and name, a card a CardChip,
  // inline. Anything else is plain text.
  let { text }: { text: string } = $props();
  type Part = { kind: 'suit'; archetype: Archetype; name: string } | { kind: 'card'; card: Card } | { kind: 'text'; text: string };
  const parts = $derived(
    text.split(/(\[\[suit:[0-3]\]\]|\[\[card:\d{1,2}:[0-3]\]\])/).map((p): Part => {
      const card = p.match(/^\[\[card:(\d{1,2}):([0-3])\]\]$/);
      if (card) return { kind: 'card', card: { rank: Number(card[1]) as Rank, suit: Number(card[2]) as Suit } };
      const m = p.match(/^\[\[suit:([0-3])\]\]$/);
      if (!m) return { kind: 'text', text: p };
      const info = suitInfo(Number(m[1]) as Suit);
      return { kind: 'suit', archetype: info.archetype, name: info.name };
    }),
  );
</script>

{#each parts as part, i (i)}{#if part.kind === 'suit'}<span class="suit"><SuitIcon archetype={part.archetype} size={12} />{part.name}</span>{:else if part.kind === 'card'}<CardChip card={part.card} />{:else}{part.text}{/if}{/each}

<style>
  .suit {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    vertical-align: -1px;
    white-space: nowrap;
  }
</style>
