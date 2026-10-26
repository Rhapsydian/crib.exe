<script lang="ts">
  import CardChip from './CardChip.svelte';
  import RichText from './RichText.svelte';
  import { discardComparison, playComparison, type CoachChoice } from './coach';

  // A choice beside the coach's (session 72, the user's design: the old
  // block of prose and big cards read clunky). A discard: what you kept and
  // threw, its points in hand, from the cut and from the crib, then the
  // coach's, then the difference. Pegging: the table, your card with its
  // points now and their expected reply, then the coach's card. A short
  // "why" stays under each (the user: keep it for now). Used by the review
  // drawer and by both coaches' look back at your last choice.
  let { choice }: { choice: CoachChoice } = $props();

  const discard = $derived(choice.kind === 'discard' ? discardComparison(choice.hand, choice.thrown, choice.ownCrib, choice.starter) : null);
  const play = $derived(choice.kind === 'play' ? playComparison(choice.spot, choice.played) : null);
  const whose = $derived(choice.kind === 'discard' && choice.ownCrib ? 'Your crib' : 'Their crib');
  // One decimal, a real minus sign; "~" where it's an average.
  const num = (n: number) => {
    const r = Math.round(n * 10) / 10;
    return `${r < 0 ? '−' : ''}${Math.abs(r).toFixed(Number.isInteger(r) ? 0 : 1)}`;
  };
  const pts = (n: number) => `${num(n)} point${num(n) === '1' ? '' : 's'}`;
  // An average: "~2.8", and "~ −4.0" (a tilde against a minus sign reads
  // as one mark in the monospace font).
  const approx = (n: number) => {
    const r = Math.round(n * 10) / 10;
    return `~${r < 0 ? ' −' : ''}${Math.abs(r).toFixed(1)}`;
  };
  // The difference as the shown numbers add up (each is rounded to a
  // tenth), so it can be checked by hand; the rating uses the exact one.
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const keepShown = (l: { inHand: number; fromCut: number; fromCrib: number }) => r1(l.inHand) + r1(l.fromCut) + r1(l.fromCrib);
  const playShown = (l: { pts: number; reply: number }) => r1(l.pts) + r1(l.reply);
</script>

{#if discard}
  {#each [{ label: 'You kept', line: discard.yours }, ...(discard.same ? [] : [{ label: 'Suggested', line: discard.suggested }])] as row (row.label)}
    <div class="block">
      <div class="cards"><span class="k">{row.label}:</span> {#each row.line.kept as card, i (i)}<CardChip {card} /> {/each}<span class="k gap">{whose}:</span> {#each row.line.crib as card, i (i)}<CardChip {card} /> {/each}</div>
      <div class="nums">
        {pts(row.line.inHand)} in hand, {row.line.exact ? num(row.line.fromCut) : approx(row.line.fromCut)} from the cut, {approx(row.line.fromCrib)} from the crib
      </div>
      <div class="why"><RichText text={row.line.why} /></div>
    </div>
  {/each}
  {#if discard.same}
    <div class="verdict good">The coach's discard too.</div>
  {:else}
    <div class="verdict">{num(Math.max(0, keepShown(discard.suggested) - keepShown(discard.yours)))} difference</div>
  {/if}
{:else if play && choice.kind === 'play'}
  <div class="cards"><span class="k">Table:</span> {#each choice.spot.sequence as card, i (i)}<CardChip {card} /> {/each}{#if !choice.spot.sequence.length}<span class="dim">nothing played yet</span>{/if}<span class="dim"> · count {choice.spot.count}</span></div>
  {#each [{ label: 'You played', line: play.yours }, ...(play.same ? [] : [{ label: 'Suggested play', line: play.suggested }])] as row (row.label)}
    <div class="block">
      <div class="cards"><span class="k">{row.label}:</span> <CardChip card={row.line.card} /> <span class="nums">{pts(row.line.pts)} now, {approx(row.line.reply)} from their reply</span></div>
      <div class="why"><RichText text={row.line.why} /></div>
    </div>
  {/each}
  {#if play.same}
    <div class="verdict good">The coach's play too.</div>
  {:else}
    <div class="verdict">{num(Math.max(0, playShown(play.suggested) - playShown(play.yours)))} difference</div>
  {/if}
{/if}

<style>
  .block {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cards {
    line-height: 1.7;
  }
  .k {
    color: var(--text-dim);
    font-size: 11px;
  }
  .gap {
    margin-left: 6px;
  }
  .nums {
    font-size: 12px;
  }
  .why,
  .dim {
    font-size: 11px;
    color: var(--text-dim);
  }
  .verdict {
    font-size: 12px;
    font-weight: 700;
    color: var(--warn);
  }
  .verdict.good {
    color: var(--accent);
  }
</style>
