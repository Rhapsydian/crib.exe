<script lang="ts">
  import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
  import SuitIcon from './SuitIcon.svelte';
  import { classModFor } from './kit';
  import { profile } from './profile.svelte';
  import { CLASS_FALLBACK_REP, CLASS_ORDER, SECURITY_REP_STEP } from '../engine/meta';
  import { SECURITY_LEVEL_TEXT } from './security-text';
  import { ALL_SUBROUTINES } from '../engine/subroutines';
  import { BURNER_DEFINITIONS } from '../engine/burners';
  import type { BurnerId } from '../engine/burner-types';

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
    onstart: (classId: ClassId, picks: { starter?: string; burner?: BurnerId; securityLevel?: number; plain?: boolean }) => void;
    ontest: () => void;
    onmenu?: () => void;
    saved?: { className: string; layer: number; savedAt: number } | null;
    onresume?: () => void;
    resumeFailed?: boolean;
  } = $props();
  const classes = CLASS_ORDER.map((id) => CLASS_DEFINITIONS[id]);
  let chosen = $state<ClassId>(CLASS_ORDER.findLast((id) => profile.hasClass(id)) ?? CLASS_ORDER[0]);
  // Starting picks (MP8-MP9): a 4th starter from the library and a common
  // Burner, once any are unlocked; the last picks are remembered.
  const library = $derived(profile.library.map((id) => ALL_SUBROUTINES.find((p) => p.id === id)).filter((p) => p !== undefined));
  let starter = $state<string>(profile.library.includes(profile.data.starter ?? '') ? (profile.data.starter ?? '') : '');
  let burner = $state<string>(profile.burners.includes(profile.data.burner as BurnerId) ? (profile.data.burner ?? '') : '');
  // Security Level (MP13): once open, any level up to the highest.
  let securityLevel = $state(Math.min(profile.data.securityPick, profile.securityOpen));
  // Without the Message Board (the user, session 71): no upgrades and no
  // starting picks this run; off unless chosen, then remembered.
  const hasBoard = $derived(Object.values(profile.data.upgrades).some((l) => l > 0) || library.length > 0 || profile.burners.length > 0);
  let plain = $state(profile.data.plainPick);
  function start() {
    profile.rememberPicks(starter || null, (burner || null) as BurnerId | null, securityLevel, plain);
    const level = securityLevel || undefined;
    if (plain && hasBoard) onstart(chosen, { securityLevel: level, plain: true });
    else onstart(chosen, { starter: starter || undefined, burner: (burner || undefined) as BurnerId | undefined, securityLevel: level });
  }
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
          {#if profile.data.securityBest[c.id] !== undefined}<span class="best">★ SEC {profile.data.securityBest[c.id]}</span>{/if}
        </div>
        <div class="mod"><span class="glyph">◆</span> {mod.name}: <span class="dim">{mod.text}</span></div>
        <div class="pieces dim">{c.startingLoadout.map((p) => p.name).join(' · ')}</div>
      </button>
      {/if}
    {/each}
  </div>
  {#if profile.securityOpen > 0}
    <div class="caption">SECURITY LEVEL</div>
    <div class="sec">
      <select bind:value={securityLevel} id="security-pick">
        {#each Array.from({ length: profile.securityOpen + 1 }, (_, i) => i) as level (level)}
          <option value={level}>{level === 0 ? 'Standard network' : `Security Level ${level}`}</option>
        {/each}
      </select>
      <span class="dim">{securityLevel ? `+${Math.round(securityLevel * SECURITY_REP_STEP * 100)}% Rep · ${SECURITY_LEVEL_TEXT[securityLevel]}` : 'No changes.'}</span>
    </div>
  {/if}
  {#if hasBoard}
    <label class="plain">
      <input type="checkbox" bind:checked={plain} id="plain-pick" />
      <span><b>Play without Message Board upgrades</b> <span class="dim">no upgrades and no starting picks this run</span></span>
    </label>
  {/if}
  {#if (library.length || profile.burners.length) && !plain}
    <div class="caption">STARTING PICKS</div>
    <div class="picks">
      {#if library.length}
        <label>
          <span class="dim">4th starting subroutine</span>
          <select bind:value={starter} id="starter-pick">
            <option value="">none</option>
            {#each library as p (p.id)}<option value={p.id}>{p.name} ({p.archetype})</option>{/each}
          </select>
        </label>
      {/if}
      {#if profile.burners.length}
        <label>
          <span class="dim">Starting Burner</span>
          <select bind:value={burner} id="burner-pick">
            <option value="">none</option>
            {#each profile.burners as id (id)}<option value={id}>{BURNER_DEFINITIONS[id].name}</option>{/each}
          </select>
        </label>
      {/if}
    </div>
  {/if}
  <button class="start" onclick={start}>▶ jack in as {CLASS_DEFINITIONS[chosen].name}</button>
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
  .plain {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 11.5px;
    margin-top: 6px;
  }
  .best {
    margin-left: auto;
    font-size: 10px;
    color: var(--accent);
  }
  .sec {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11.5px;
  }
  .sec select {
    align-self: flex-start;
    padding: 4px 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font: inherit;
  }
  .picks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    font-size: 12px;
  }
  .picks label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .picks select {
    padding: 4px 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font: inherit;
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
