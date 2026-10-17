<script lang="ts">
  import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
  import SuitIcon from './SuitIcon.svelte';
  import { classModFor } from './kit';

  // Run setup (milestone 3 checkpoint 2): pick a class and jack in. Each
  // card shows its two suits, its class Mod (the bridge between them) and
  // its starting pieces. All six are open (meta-progression unlocks come
  // later).
  let { onstart, ontest }: { onstart: (classId: ClassId) => void; ontest: () => void } = $props();
  const classes = Object.values(CLASS_DEFINITIONS);
  let chosen = $state<ClassId>(classes[0].id);
</script>

<div class="setup">
  <h1>crib.exe <span>// new contract</span></h1>
  <div class="caption">CHOOSE A CLASS</div>
  <div class="classes">
    {#each classes as c (c.id)}
      {@const mod = classModFor(c.id)}
      <button class="cls" class:chosen={chosen === c.id} onclick={() => (chosen = c.id)}>
        <div class="head">
          <span class="icons">{#each c.archetypes as a (a)}<SuitIcon archetype={a} size={15} />{/each}</span>
          <b>{c.name}</b>
        </div>
        <div class="mod"><span class="glyph">◆</span> {mod.name}: <span class="dim">{mod.text}</span></div>
        <div class="pieces dim">{c.startingLoadout.map((p) => p.name).join(' · ')}</div>
      </button>
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
  .test {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 11px;
    text-decoration: underline;
    padding: 6px;
  }
</style>
