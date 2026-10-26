<script lang="ts">
  import type { Stars } from '../engine/skill';

  // A Cribbage rating in stars (session 72): five ★, the unearned ones
  // dimmed. Not ☆ for the empty ones: in the game's monospace font ☆
  // draws much like ★, and a 2-star rating read as 5.
  let { stars }: { stars: Stars } = $props();
</script>

<span class="stars" role="img" aria-label="{stars} of 5 stars">{#each [1, 2, 3, 4, 5] as i (i)}<span class:off={i > stars}>★</span>{/each}</span>

<style>
  .stars {
    color: var(--accent);
    letter-spacing: 1px;
    white-space: nowrap;
  }
  .off {
    color: var(--line);
  }
</style>
