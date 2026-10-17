<script lang="ts">
  import type { Card } from '../engine/cards';
  import type { PlayerIndex } from '../engine/game';
  import type { PileCard } from './timeline';
  import CardView from './CardView.svelte';

  // The table: the pegging pile since the last reset, the running count,
  // the starter (face down until it is cut) and who deals (whose crib it is), and how many cards the
  // opponent still holds. The crib itself isn't drawn -- it is always 4
  // cards once discards are chosen (the user's call).
  //
  // Live (checkpoint 3a): `pile` carries who played each card, so a new
  // card animates in -- yours up from the hand, theirs flipped out of
  // their face-down stack -- and `callout` pops a score ("fifteen for 2")
  // over the pile in the scorer's colour. `leaving` is the pile sweeping
  // off after a go or a 31, so a fresh count is obvious.
  let {
    sequence,
    count,
    starter,
    playerIsDealer,
    opponentCardsLeft,
    small = false,
    pile,
    leaving = [],
    callout,
  }: {
    sequence: Card[];
    count: number;
    starter?: Card;
    playerIsDealer: boolean;
    opponentCardsLeft: number;
    small?: boolean;
    pile?: PileCard[];
    leaving?: PileCard[];
    callout?: { text: string; side: PlayerIndex; key: number } | null;
  } = $props();
  const cards = $derived<PileCard[]>(pile ?? sequence.map((card, i) => ({ card, player: 0, key: -1 - i })));
</script>

<div class="table" class:small>
  <div class="side">
    <div class="caption">STARTER</div>
    {#if starter}<CardView card={starter} small />{:else}<CardView faceDown small />{/if}
    <div class="caption dealer">{playerIsDealer ? 'YOU DEAL' : 'THEY DEAL'}</div>
  </div>
  <div class="pile">
    <div class="count">{count}<span>/31</span></div>
    <div class="cards">
      {#each cards as c, i (c.key)}
        <div class="arrive" class:over7={i === 6} class:over8={i === 7} class:from-you={pile && c.player === 0} class:from-them={pile && c.player === 1}>
          <CardView card={c.card} small />
        </div>
      {/each}
      {#each leaving as c, i (c.key)}
        <div class="leave" class:over7={i === 6} class:over8={i === 7}><CardView card={c.card} small /></div>
      {/each}
      {#if cards.length === 0 && leaving.length === 0}<span class="empty">—</span>{/if}
    </div>
    {#if callout}
      {#key callout.key}
        <div class="callout" class:them={callout.side === 1}>{callout.side === 0 ? '+' : '−'} {callout.text}</div>
      {/key}
    {/if}
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
  .dealer {
    margin-top: 4px;
    color: var(--accent);
  }
  .stack {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 11px;
    color: var(--text-dim);
  }
  .pile {
    position: relative;
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
    /* One small card tall even when empty, so the count doesn't shift
       as the pile empties and fills. */
    min-height: 48px;
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
  }
  .empty {
    color: var(--text-dim);
  }
  /* Phones fit six pile cards in a row (the user's call): the 7th lies
     over the 2nd and 3rd, the 8th over the 4th and 5th, canted a little
     clockwise. The row shrinks to its first six cards so these offsets
     (one card 34px + a 3px gap = 37px a slot) line up with them; a count
     never runs past 8 cards. */
  @media (max-width: 899px) {
    .cards {
      position: relative;
      flex-wrap: nowrap;
      width: fit-content;
      margin: 0 auto;
    }
    .over7,
    .over8 {
      position: absolute;
      top: calc(50% - 24px);
      rotate: 8deg;
      filter: drop-shadow(0 2px 4px rgb(0 0 0 / 70%));
      z-index: 1;
    }
    .over7 {
      left: 55.5px;
    }
    .over8 {
      left: 129.5px;
    }
  }
  .from-you {
    animation: from-you 0.28s ease-out;
  }
  .from-them {
    animation: from-them 0.42s ease-out;
  }
  @keyframes from-you {
    from {
      transform: translateY(140px) scale(1.4);
      opacity: 0.3;
    }
  }
  @keyframes from-them {
    0% {
      transform: translate(90px, 0) rotateY(90deg);
      opacity: 0.4;
    }
    45% {
      transform: translate(45px, 0) rotateY(0deg);
      opacity: 1;
    }
  }
  .leave {
    animation: leave 0.4s ease-in forwards;
  }
  .leave:nth-child(2) {
    animation-delay: 0.03s;
  }
  .leave:nth-child(3) {
    animation-delay: 0.06s;
  }
  .leave:nth-child(n + 4) {
    animation-delay: 0.09s;
  }
  @keyframes leave {
    to {
      transform: translate(-110px, 18px) rotate(-14deg);
      opacity: 0;
    }
  }
  .callout {
    position: absolute;
    left: 50%;
    top: 30%;
    transform: translateX(-50%);
    white-space: nowrap;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
    pointer-events: none;
    animation: callout 0.9s ease-out forwards;
  }
  .callout.them {
    border-color: var(--danger);
    color: var(--danger);
  }
  @keyframes callout {
    0% {
      opacity: 0;
      transform: translate(-50%, 10px) scale(0.8);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, 0) scale(1.1);
    }
    70% {
      opacity: 1;
      transform: translate(-50%, -14px) scale(1);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -26px) scale(1);
    }
  }
</style>
