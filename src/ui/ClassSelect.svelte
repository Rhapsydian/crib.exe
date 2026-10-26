<script lang="ts">
  import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
  import SuitIcon from './SuitIcon.svelte';
  import { classModFor } from './kit';
  import { profile } from './profile.svelte';
  import { CLASS_FALLBACK_REP, CLASS_ORDER } from '../engine/meta';
  import { securityEffects } from './security-text';
  import { ALL_SUBROUTINES } from '../engine/subroutines';
  import { BURNER_DEFINITIONS } from '../engine/burners';
  import type { BurnerId } from '../engine/burner-types';
  import StartPickSheet from './StartPickSheet.svelte';
  import RichText from './RichText.svelte';
  import { burnerText, burnerWhere, pieceLines, rarityOf } from './reward-text';

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
    ontest?: () => void;
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
  // The pickers (session 72, the user: the drop-downs' names weren't
  // enough): a sheet with every choice's full rules. A subroutine already
  // in the class's loadout can't be the auxiliary, and a pick that becomes
  // one when the class changes clears itself.
  let picking = $state<'starter' | 'burner' | null>(null);
  const classPieces = $derived(new Set(CLASS_DEFINITIONS[chosen].startingLoadout.map((p) => p.id)));
  const inClass = $derived(new Map([...classPieces].map((id) => [id, `in ${CLASS_DEFINITIONS[chosen].name}'s loadout`])));
  $effect(() => {
    if (starter && classPieces.has(starter)) starter = '';
  });
  const starterPiece = $derived(library.find((p) => p.id === starter));
  const burnerDef = $derived(burner ? BURNER_DEFINITIONS[burner as BurnerId] : undefined);
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
    <div class="sec">
      <!-- A stepper and the level's effects as a list (session 72, the
           user's ask; it was a drop-down and a sentence). -->
      <div class="stepper">
        <span>Security Level:</span>
        <button class="step" aria-label="lower" disabled={securityLevel <= 0} onclick={() => (securityLevel = Math.max(0, securityLevel - 1))}>◀</button>
        <span class="level" aria-live="polite">{securityLevel}</span>
        <button class="step" aria-label="higher" disabled={securityLevel >= profile.securityOpen} onclick={() => (securityLevel = Math.min(profile.securityOpen, securityLevel + 1))}>▶</button>
      </div>
      {#if securityLevel === 0}
        <div class="dim">Standard network</div>
      {:else}
        <ul class="effects">
          {#each securityEffects(securityLevel) as e (e.text)}<li class:new={e.isNew}>{e.text}{#if e.isNew}<span class="tag">new</span>{/if}</li>{/each}
        </ul>
      {/if}
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
        <div class="pick">
          <div class="pick-head"><span class="dim">AUXILIARY SUBROUTINE</span>{#if starterPiece}<button class="link" onclick={() => (picking = 'starter')}>change</button><button class="link" onclick={() => (starter = '')}>✕ clear</button>{/if}</div>
          {#if starterPiece}
            <div class="pick-name"><SuitIcon archetype={starterPiece.archetype} size={14} /> <b>{starterPiece.name}</b> <span class="dim">· {rarityOf(starterPiece.id)}</span></div>
            {#each pieceLines(starterPiece) as line (line)}<div class="pick-text"><RichText text={line} /></div>{/each}
          {:else}
            <button class="choose" onclick={() => (picking = 'starter')}>Select auxiliary subroutine</button>
          {/if}
        </div>
      {/if}
      {#if profile.burners.length}
        <div class="pick">
          <div class="pick-head"><span class="dim">STARTING BURNER</span>{#if burnerDef}<button class="link" onclick={() => (picking = 'burner')}>change</button><button class="link" onclick={() => (burner = '')}>✕ clear</button>{/if}</div>
          {#if burnerDef}
            <div class="pick-name"><b>⏏︎ {burnerDef.name}</b> <span class="dim">· {burnerWhere(burnerDef)}</span></div>
            <div class="pick-text"><RichText text={burnerText(burnerDef)} /></div>
          {:else}
            <button class="choose" onclick={() => (picking = 'burner')}>Select starting Burner</button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
  <button class="start" onclick={start}>▶ jack in as {CLASS_DEFINITIONS[chosen].name}</button>
  <!-- Development only (go-live step 1): App passes ontest only there. -->
  {#if import.meta.env.DEV && ontest}<button class="test" onclick={ontest}>test a single fight instead</button>{/if}
</div>

{#if picking === 'starter'}
  <StartPickSheet title="SELECT AUXILIARY SUBROUTINE" subroutines={library} disabled={inClass} chosen={starter} onpick={(id) => ((starter = id), (picking = null))} onclose={() => (picking = null)} />
{:else if picking === 'burner'}
  <StartPickSheet title="SELECT STARTING BURNER" burners={profile.burners.map((id) => BURNER_DEFINITIONS[id])} chosen={burner} onpick={(id) => ((burner = id), (picking = null))} onclose={() => (picking = null)} />
{/if}

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
  .stepper {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }
  .step {
    width: 26px;
    height: 24px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--accent);
    font: inherit;
    font-size: 10px;
    cursor: pointer;
  }
  .step:disabled {
    color: var(--text-dim);
    opacity: 0.5;
    cursor: default;
  }
  .level {
    min-width: 28px;
    padding: 2px 0;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    text-align: center;
    font-weight: 700;
    color: var(--accent);
  }
  .effects {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    color: var(--text-dim);
  }
  .effects li.new {
    color: var(--text);
  }
  .effects .tag {
    margin-left: 6px;
    font-size: 9px;
    letter-spacing: 0.06em;
    color: var(--accent);
    text-transform: uppercase;
  }
  .picks {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }
  .pick {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .pick-head {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 10px;
    letter-spacing: 0.06em;
  }
  .pick-head .link:first-of-type {
    margin-left: auto;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  .pick-name {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .pick-text {
    font-size: 11px;
    color: var(--text-dim);
    line-height: 1.4;
  }
  .choose {
    align-self: flex-start;
    padding: 5px 10px;
    border: 1px dashed var(--accent);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--accent);
    font: inherit;
    cursor: pointer;
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
