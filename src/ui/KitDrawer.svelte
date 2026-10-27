<script lang="ts">
  import DailyKit from './DailyKit.svelte';
  import type { DailyPlan } from '../engine/daily';
  import type { RunPlayerState } from '../engine/run';
  import { BURNER_DEFINITIONS } from '../engine/burners';
  import LoadoutEditor from './LoadoutEditor.svelte';
  import { playerModView } from './kit';
  import { burnerText } from './reward-text';

  // Your kit: the loadout and bench, Mods, Burners and a Daily's Mods. A
  // slide-in drawer on phones, a standing left panel on desktop. The map
  // edits the loadout here (`onarrange`); the reward and Shop screens show
  // it read-only (v0.9.1, a tester's ask), since the engine only takes a
  // new arrangement on the map.
  let {
    player,
    onarrange,
    daily,
    open = $bindable(false),
  }: {
    player: RunPlayerState;
    onarrange?: (installed: string[], bench: string[]) => void;
    daily?: { plan: DailyPlan; practice: boolean } | null;
    open?: boolean;
  } = $props();
</script>

<aside class="drawer" class:open>
  <button class="close" onclick={() => (open = false)} aria-label="close">✕</button>
  <LoadoutEditor {player} {onarrange} />
  {#if player.ownedModIds.length}
    <div class="caption">MODS</div>
    {#each player.ownedModIds as id (id)}
      {@const mod = playerModView(id, player.classModUpgraded)}
      <div class="kit"><div><span class="mod-glyph">◆</span> {mod.name} <span class="kit-tag">{mod.tag}</span></div><div class="kit-text">{mod.text}</div></div>
    {/each}
  {/if}
  {#if player.carriedBurnerIds.length}
    <div class="caption">BURNERS</div>
    {#each player.carriedBurnerIds as id, i (i)}
      <div class="kit"><div><span class="burner-glyph">⏏︎</span> {BURNER_DEFINITIONS[id].name}</div><div class="kit-text">{burnerText(BURNER_DEFINITIONS[id])}</div></div>
    {/each}
  {/if}
  {#if daily}<DailyKit plan={daily.plan} practice={daily.practice} />{/if}
</aside>
{#if open}<div class="scrim" onclick={() => (open = false)} role="presentation"></div>{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    z-index: 15;
  }
  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(80%, 320px);
    z-index: 16;
    transform: translateX(105%);
    transition: transform 0.18s ease;
    background: var(--bg-sunken);
    border-left: 1px solid var(--line);
    padding: 12px;
    padding-top: calc(12px + env(safe-area-inset-top));
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .drawer.open {
    transform: none;
  }
  /* Desktop: it stands open on the left, as in combat, and stays put
     while a long screen (the Shop) scrolls. */
  @media (min-width: 900px) {
    .drawer {
      position: sticky;
      top: 0;
      align-self: flex-start;
      height: 100dvh;
      box-sizing: border-box;
      transform: none;
      transition: none;
      width: 300px;
      flex: none;
      border-left: none;
      border-right: 1px solid var(--line);
      order: -1;
    }
    .close,
    .scrim {
      display: none;
    }
  }
  .close {
    align-self: flex-end;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 15px;
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 8px;
  }
  .kit {
    font-size: 12px;
    padding: 4px 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  .kit-text {
    font-size: 10.5px;
    color: var(--text-dim);
    line-height: 1.35;
    margin-top: 2px;
  }
  .mod-glyph {
    color: var(--mod);
  }
  .kit-tag {
    font-size: 9.5px;
    color: var(--text-dim);
    margin-left: 4px;
  }
  .burner-glyph {
    color: var(--warn);
  }
</style>
