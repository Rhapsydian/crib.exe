<script lang="ts">
  import { cardsEqual, type Card } from '../engine/cards';
  import CardView from './CardView.svelte';
  import { showTitle, type ShowState } from './timeline';

  // The show (checkpoint 3b), in the table's place: the hand being counted
  // (four cards and the starter), each score lighting up the cards that
  // make it, and the running count announced the way it's said at the
  // table -- "fifteen 2, fifteen 4, pair 6".
  let { show }: { show: ShowState } = $props();

  const isLit = (c: Card) => show.lit?.some((l) => cardsEqual(l, c)) ?? false;
  const recent = $derived(show.announced.slice(-3));
</script>

<div class="show" class:them={show.player === 1}>
  <div class="head">
    <span class="title">{showTitle(show.owner, show.player).toUpperCase()}</span>
    <span class="score">{show.scored}<span class="of">/{show.total}</span></span>
  </div>
  {#key `${show.owner}${show.player}`}
    <div class="cards" class:lighting={show.lit !== null}>
      {#each show.cards as card, i (i)}
        <div class="slot" class:lit={isLit(card)} style="animation-delay: {i * 60}ms"><CardView {card} small /></div>
      {/each}
      <div class="slot starter" class:lit={isLit(show.starter)} style="animation-delay: 240ms"><CardView card={show.starter} small /></div>
    </div>
  {/key}
  <div class="said">
    {#if show.total === 0}
      nineteen (no score)
    {:else if recent.length}
      {#if show.announced.length > recent.length}… {/if}{recent.join(' · ')}
    {:else}
      &nbsp;
    {/if}
  </div>
</div>

<style>
  .show {
    --who: var(--accent);
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px 8px;
    border: 1px solid var(--who);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    box-sizing: border-box;
  }
  .them {
    --who: var(--danger);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .title {
    color: var(--who);
  }
  .score {
    font-size: 18px;
    font-weight: 700;
    color: var(--who);
    line-height: 1;
  }
  .of {
    font-size: 10px;
    color: var(--text-dim);
  }
  .cards {
    display: flex;
    justify-content: center;
    gap: 4px;
  }
  .slot {
    transition:
      transform 0.15s ease-out,
      opacity 0.15s;
    animation: deal-in 0.3s ease-out backwards;
  }
  .starter {
    margin-left: 10px;
  }
  .lighting .slot {
    opacity: 0.35;
  }
  .lighting .slot.lit {
    opacity: 1;
    transform: translateY(-5px);
    filter: drop-shadow(0 0 5px var(--who));
  }
  @keyframes deal-in {
    from {
      transform: translateY(-12px) rotateY(90deg);
      opacity: 0;
    }
  }
  .said {
    font-size: 11px;
    text-align: center;
    color: var(--who);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
