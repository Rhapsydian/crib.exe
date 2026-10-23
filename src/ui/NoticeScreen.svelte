<script lang="ts">
  import type { RunRequest } from '../engine/run-requests';
  import { effectPhrases } from './visit-text';

  // What just happened, before the run carries on (milestone 3 checkpoint
  // 4): an Event choice's outcome, or what a Cache held. Anything you
  // gained to choose from (a piece, a Mod) follows on the reward screen.
  let {
    request,
    layer,
    oncontinue,
  }: { request: Extract<RunRequest, { kind: 'eventResult' | 'cacheOpened' }>; layer: number; oncontinue: () => void } = $props();

  const view = $derived.by(() => {
    if (request.kind === 'cacheOpened') {
      const lines =
        request.contents === 'subroutine'
          ? ['A choice of better-than-usual subroutines.']
          : request.contents === 'mod'
            ? ['A choice of Mods.']
            : [`${request.data} Data`, ...request.burners.map((b) => `Burner: ${b.name}`)];
      return { kicker: 'CACHE', title: 'You crack the cache open.', lines };
    }
    const e = request.effect;
    // Data and Heat as phrased for the choice; grants by what was rolled.
    const amounts = effectPhrases(e, layer).filter((p) => /(Data|Heat)$/.test(p));
    const g = request.grant;
    const named = [g.subroutine && `Subroutine: ${g.subroutine.name}`, g.mod && `Mod: ${g.mod.name}`, g.burner && `Burner: ${g.burner.name}`].filter(Boolean) as string[];
    const shown = [...amounts, ...named];
    if (e.bonusFight) shown.push(`A fight breaks out (${e.bonusFight.tier}).`);
    return { kicker: `EVENT · ${request.event.name}`, title: request.choice.label, story: request.text, lines: shown.length ? shown : ['Nothing came of it.'] };
  });
</script>

<div class="notice">
  <div class="kicker">{view.kicker}</div>
  <div class="title">{view.title}</div>
  {#if 'story' in view && view.story}<p class="story">{view.story}</p>{/if}
  {#each view.lines as line, i (i)}<div class="line">· {line}</div>{/each}
  <button class="continue" onclick={oncontinue}>continue ▸</button>
</div>

<style>
  .notice {
    max-width: 480px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(32px + env(safe-area-inset-top));
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .kicker {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.1em;
  }
  .title {
    color: var(--accent);
    font-weight: 700;
    font-size: 15px;
    margin-bottom: 6px;
  }
  .line {
    font-size: 13px;
  }
  .story {
    margin: 0 0 6px;
    font-size: 13px;
    line-height: 1.5;
  }
  .continue {
    margin-top: 16px;
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
</style>
