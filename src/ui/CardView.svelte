<script lang="ts">
  import type { Card } from '../engine/cards';
  import SuitIcon from './SuitIcon.svelte';
  import { rankLabel, suitInfo } from './suits';

  let {
    card,
    faceDown = false,
    lifted = false,
    dimmed = false,
    small = false,
    onclick,
  }: { card?: Card; faceDown?: boolean; lifted?: boolean; dimmed?: boolean; small?: boolean; onclick?: () => void } = $props();

  const info = $derived(card ? suitInfo(card.suit) : null);
</script>

<button
  class="card"
  class:lifted
  class:dimmed
  class:small
  class:face-down={faceDown || !card}
  style={info ? `--suit: ${info.color}` : ''}
  disabled={!onclick}
  {onclick}
  aria-label={card && !faceDown ? `${rankLabel(card.rank)} of ${info?.name}` : 'face-down card'}
>
  {#if card && !faceDown && info}
    <span class="rank">{rankLabel(card.rank)}</span>
    <span class="icon"><SuitIcon archetype={info.archetype} size={small ? 14 : 22} /></span>
  {/if}
</button>

<style>
  .card {
    position: relative;
    width: 52px;
    height: 74px;
    border-radius: var(--radius);
    border: 1px solid var(--suit, var(--line));
    background: var(--bg-raised);
    padding: 4px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;
    transition: transform 0.12s ease;
    cursor: default;
    flex: none;
  }
  .card:not(:disabled) {
    cursor: pointer;
  }
  .small {
    width: 34px;
    height: 48px;
    padding: 2px 3px;
  }
  .rank {
    font-size: 18px;
    font-weight: 700;
    color: var(--suit);
    line-height: 1;
  }
  .small .rank {
    font-size: 13px;
  }
  .icon {
    align-self: flex-end;
  }
  .lifted {
    transform: translateY(-14px);
    box-shadow: 0 0 0 2px var(--accent);
  }
  .dimmed {
    opacity: 0.35;
  }
  .face-down {
    border-color: var(--line);
    background: repeating-linear-gradient(45deg, var(--bg-sunken) 0 4px, var(--bg-raised) 4px 8px);
  }
</style>
