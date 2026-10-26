<script lang="ts">
  import type { Card } from '../engine/cards';
  import SuitIcon from './SuitIcon.svelte';
  import { rankLabel, suitInfo } from './suits';

  // A card named inline, like a badge (session 72, the user's design): the
  // suit's icon and the rank in a rounded outline of the suit's colour.
  // Text carries it as a card token (RichText's cardToken); the review and
  // the log read a card at a glance this way.
  let { card }: { card: Card } = $props();
  const info = $derived(suitInfo(card.suit));
</script>

<span class="chip" style="--suit: {info.color}" role="img" aria-label="{rankLabel(card.rank)} of {info.name}"><SuitIcon archetype={info.archetype} size={11} /><b>{rankLabel(card.rank)}</b></span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0 4px 0 3px;
    border: 1px solid var(--suit);
    border-radius: 6px;
    line-height: 15px;
    font-size: 11px;
    vertical-align: middle;
    position: relative;
    top: -1px;
    white-space: nowrap;
    /* A little air between chips in a row (the user: they read crowded). */
    margin: 0 2px;
  }
  b {
    color: var(--text);
    font-weight: 700;
  }
</style>
