<script lang="ts">
  import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
  import SuitIcon from './SuitIcon.svelte';
  import { classModFor } from './kit';
  import { profile } from './profile.svelte';
  import { CLASS_FALLBACK_REP, CLASS_ORDER } from '../engine/meta';

  // Run setup (milestone 3 checkpoint 2): pick a class and jack in. Each
  // card shows its two suits, its class Mod (the bridge between them) and
  // its starting pieces. Classes unlock in a chain (session 71, MP2-MP6):
  // a locked one says what opens it, and the next locked one can be
  // bought outright with Rep.
  // A saved run (checkpoint 5) shows a resume button above the classes;
  // starting a new run replaces it.
  let {
    onstart,
    ontest,
    onmenu,
    saved = null,
    onresume,
    resumeFailed = false,
  }: {
    onstart: (classId: ClassId) => void;
    ontest: () => void;
    onmenu?: () => void;
    saved?: { className: string; layer: number; savedAt: number } | null;
    onresume?: () => void;
    resumeFailed?: boolean;
  } = $props();
  const classes = CLASS_ORDER.map((id) => CLASS_DEFINITIONS[id]);
  let chosen = $state<ClassId>(CLASS_ORDER.findLast((id) => profile.hasClass(id)) ?? CLASS_ORDER[0]);
  const prevName = (id: ClassId) => CLASS_DEFINITIONS[CLASS_ORDER[CLASS_ORDER.indexOf(id) - 1]].name;
</script>

<div class="setup">
  {#if onmenu}<button class="back" onclick={onmenu}>◂ menu</button>{/if}
  <h1>crib.exe <span>// new contract</span></h1>
  {#if saved}
    <button class="resume" onclick={() => onresume?.()}>▶ resume run · {saved.className} · layer {saved.layer}</button>
    <div class="small dim">Starting a new run below replaces it.</div>
  {/if}
  {#if resumeFailed}
    <div class="small warn">That save is from an older version of the game and couldn't be loaded. Start a new run below.</div>
  {/if}
  <div class="caption">CHOOSE A CLASS{#if profile.data.repEarned > 0}<span class="rep">◆ {profile.data.rep} rep</span>{/if}</div>
  <div class="classes">
    {#each classes as c (c.id)}
      {@const mod = classModFor(c.id)}
      {#if !profile.hasClass(c.id)}
        <div class="cls locked">
          <div class="head">
            <span class="icons">{#each c.archetypes as a (a)}<SuitIcon archetype={a} size={15} />{/each}</span>
            <b>{c.name}</b> <span class="lock">locked</span>
          </div>
          <div class="dim">Beat the first gatekeeper as {prevName(c.id)} to unlock.</div>
          {#if profile.nextLocked === c.id}
            <button class="buy" disabled={profile.data.rep < CLASS_FALLBACK_REP} onclick={() => profile.buyClass(c.id) && (chosen = c.id)}>
              or unlock it now for ◆ {CLASS_FALLBACK_REP}{profile.data.rep < CLASS_FALLBACK_REP ? ` (you have ${profile.data.rep})` : ''}
            </button>
          {/if}
        </div>
      {:else}
      <button class="cls" class:chosen={chosen === c.id} onclick={() => (chosen = c.id)}>
        <div class="head">
          <span class="icons">{#each c.archetypes as a (a)}<SuitIcon archetype={a} size={15} />{/each}</span>
          <b>{c.name}</b>
        </div>
        <div class="mod"><span class="glyph">◆</span> {mod.name}: <span class="dim">{mod.text}</span></div>
        <div class="pieces dim">{c.startingLoadout.map((p) => p.name).join(' · ')}</div>
      </button>
      {/if}
    {/each}
  </div>
  <button class="start" onclick={() => onstart(chosen)}>▶ jack in as {CLASS_DEFINITIONS[chosen].name}</button>
  <button class="test" onclick={ontest}>test a single fight instead</button>
</div>

<style>
  .setup {
    max-width: 640px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  h1 {
    font-size: 18px;
    color: var(--accent);
    margin: 6px 0;
  }
  h1 span {
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 400;
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 6px;
  }
  .classes {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cls {
    text-align: left;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11.5px;
  }
  .cls.locked {
    opacity: 0.75;
    border-style: dashed;
  }
  .lock {
    font-size: 10px;
    color: var(--text-dim);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 0 5px;
  }
  .buy {
    align-self: flex-start;
    padding: 4px 8px;
    border: 1px solid var(--mod);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--mod);
    font: inherit;
    font-size: 11px;
  }
  .buy:disabled {
    border-color: var(--line);
    color: var(--text-dim);
  }
  .caption .rep {
    float: right;
    color: var(--mod);
    letter-spacing: 0;
  }
  .cls.chosen {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
  .icons {
    display: inline-flex;
    gap: 2px;
  }
  .glyph {
    color: var(--mod);
  }
  .dim {
    color: var(--text-dim);
  }
  .pieces {
    font-size: 10.5px;
  }
  .start {
    margin-top: 10px;
    padding: 10px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
  .resume {
    padding: 10px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: rgb(57 255 156 / 8%);
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
    text-align: left;
  }
  .small {
    font-size: 11px;
  }
  .warn {
    color: var(--warn);
  }
  .back {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 11px;
    padding: 2px 0;
  }
  .test {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 11px;
    text-decoration: underline;
    padding: 6px;
  }
</style>
