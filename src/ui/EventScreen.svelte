<script lang="ts">
  import type { RunRequest } from '../engine/run-requests';
  import type { EventChoice } from '../engine/event-types';
  import { choiceOutcomes } from './visit-text';
  import { choiceUnavailable } from '../engine/events';
  import { BRIDGE_II_TEXT, classModFor, modTag, modText } from './kit';

  // An Event (milestone 3 checkpoint 4): a situation and its choices,
  // the scene told first (session 64).
  // A sure choice shows what it does, a risky one its odds, a gamble
  // nothing. Tap to select, then commit.
  let { request, onchoose }: { request: Extract<RunRequest, { kind: 'event' }>; onchoose: (choice: EventChoice) => void } = $props();

  const RISK = { transparent: 'sure', visibleOdds: 'risky', gamble: 'gamble' } as const;
  let selected = $state<string | null>(null);
  // A choice that pays in Data needs the Data (session 64); one granting
  // a Mod you hold, or upgrading an upgraded class Mod, isn't open (65).
  const unavailable = (c: EventChoice) => choiceUnavailable(c, request.playerState);
  const chosen = $derived(request.event.choices.find((c) => c.id === selected));
  // What a sure choice's Mod does (session 65): its name, tag and rules,
  // or what the II upgrade adds. A gamble keeps its secret.
  function grants(c: EventChoice): { name: string; tag: string; text: string }[] {
    if (c.riskTier === 'gamble') return [];
    return c.outcomes.flatMap(({ effect }) => {
      const out: { name: string; tag: string; text: string }[] = [];
      const g = effect.modGrant;
      if (g && 'specific' in g) out.push({ name: g.specific.name, tag: modTag(g.specific.id), text: modText(g.specific.id) });
      const cls = request.playerState.classId;
      if (effect.classModUpgrade) out.push({ name: classModFor(cls, true).name, tag: 'adds:', text: BRIDGE_II_TEXT[cls] });
      return out;
    });
  }
</script>

<div class="event">
  <div class="kicker">EVENT · LAYER {request.layer}</div>
  <div class="title">{request.event.name}</div>
  <!-- The scene first (session 64, BE10): never a bare choice. -->
  <p class="scene">{request.event.text}</p>
  {#each request.event.choices as c (c.id)}
    <button class="choice" class:sel={selected === c.id} disabled={unavailable(c) !== null} onclick={() => (selected === c.id ? onchoose(c) : (selected = c.id))}>
      <div class="label"><b>{c.label}</b> <span class="risk {c.riskTier}">{RISK[c.riskTier]}</span></div>
      {#each choiceOutcomes(c, request.layer).filter((line) => !grants(c).some((m) => m.name === line)) as line, i (i)}<div class="line">{line}</div>{/each}
      {#each grants(c) as m, i (i)}<div class="line grant"><b>◆ {m.name}</b> <span class="grant-tag">{m.tag}</span> {m.text}</div>{/each}
      {#if unavailable(c)}<div class="line short">{unavailable(c)}</div>{/if}
    </button>
  {/each}
  <button class="confirm" disabled={!chosen} onclick={() => chosen && onchoose(chosen)}>{chosen ? chosen.label : 'tap a choice'}</button>
</div>

<style>
  .event {
    max-width: 520px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(16px + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kicker {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.1em;
  }
  .title {
    color: var(--accent);
    font-weight: 700;
    font-size: 16px;
    margin-bottom: 4px;
  }
  .scene {
    margin: 0 0 6px;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text);
  }
  .choice:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .short {
    color: var(--danger);
  }
  .choice {
    text-align: left;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .choice.sel {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .risk {
    margin-left: auto;
    font-size: 9.5px;
    padding: 1px 6px;
    border-radius: 999px;
    border: 1px solid var(--line);
    color: var(--text-dim);
  }
  .risk.visibleOdds {
    color: var(--warn);
  }
  .risk.gamble {
    color: var(--danger);
  }
  .line {
    color: var(--text-dim);
    line-height: 1.4;
  }
  .grant b {
    color: var(--mod);
    font-weight: 600;
  }
  .grant-tag {
    font-size: 10px;
    opacity: 0.8;
    margin-right: 2px;
  }
  .confirm {
    padding: 10px;
    border-radius: var(--radius);
    border: 1px solid var(--accent);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
  .confirm:disabled {
    border-color: var(--line);
    color: var(--text-dim);
    font-weight: 400;
  }
</style>
