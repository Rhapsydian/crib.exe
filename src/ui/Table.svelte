<script lang="ts">
  import type { Card } from '../engine/cards';
  import CardView from './CardView.svelte';

  // The table: the pegging pile since the last reset, the running count,
  // the starter, the crib (face down) and whose crib it is, and how many
  // cards the opponent still holds.
  let {
    sequence,
    count,
    starter,
    playerIsDealer,
    opponentCardsLeft,
    small = false,
  }: { sequence: Card[]; count: number; starter: Card; playerIsDealer: boolean; opponentCardsLeft: number; small?: boolean } = $props();
</script>

<div class="table" class:small>
  <div class="side">
    <div class="caption">STARTER</div>
    <CardView card={starter} small />
    <div class="caption crib">{playerIsDealer ? 'YOUR CRIB' : 'THEIR CRIB'}</div>
    <div class="stack"><CardView faceDown small /><span>×4</span></div>
  </div>
  <div class="pile">
    <div class="count">{count}<span>/31</span></div>
    <div class="cards">
      {#each sequence as card, i (i)}
        <CardView {card} small />
      {/each}
      {#if sequence.length === 0}<span class="empty">—</span>{/if}
    </div>
  </div>
  <div class="side right">
    <div class="caption">THEY HOLD</div>
    <div class="stack"><CardView faceDown small /><span>×{opponentCardsLeft}</span></div>
  </div>
</div>

<style>
  .table {
    display: flex;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-sunken);
  }
  .side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
  }
  .caption {
    font-size: 9px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
  }
  .crib {
    margin-top: 4px;
  }
  .stack {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--text-dim);
  }
  .pile {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .count {
    font-size: 30px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1;
  }
  .count span {
    font-size: 13px;
    color: var(--text-dim);
  }
  .cards {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
  }
  .empty {
    color: var(--text-dim);
  }
</style>
