<script lang="ts">
  import type { LoadoutEntry } from '../engine/resolve';
  import type { FireEvent } from '../engine/resolve';
  import { rarityOf } from '../engine/rewards';
  import SuitIcon from './SuitIcon.svelte';
  import { archetypeInfo } from './suits';
  import { describeFire, describeHook, describeProcess, describeState, forEnemy } from './describe';

  // The inspect panel (P6): a bottom sheet on phones (a centred card on
  // wide screens). Name, archetype and rarity; Process and Hook in plain
  // words (P7); live state; what it did last.
  let { entry, lastFire, enemy = false, onclose }: { entry: LoadoutEntry; lastFire?: FireEvent; enemy?: boolean; onclose: () => void } = $props();
  const voice = (t: string) => (enemy ? forEnemy(t) : t);

  const def = $derived(entry.definition);
  const info = $derived(archetypeInfo(def.archetype));
</script>

<div class="scrim" onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-label={def.name}>
  <div class="title" style="--suit: {info.color}">
    <SuitIcon archetype={def.archetype} size={20} />
    <div>
      <div class="name">{def.name}</div>
      <div class="meta">{info.name} · {rarityOf(def.id)}</div>
    </div>
    <button class="close" onclick={onclose} aria-label="close">✕</button>
  </div>
  <div class="field"><span class="key">Process</span>{voice(describeProcess(def.alpha))}</div>
  {#if def.beta}<div class="field"><span class="key">Hook</span>{voice(describeHook(def.beta))}</div>{/if}
  {#if describeState(def, entry.state).length}
    <div class="state">{describeState(def, entry.state).join(' · ')}</div>
  {/if}
  {#if lastFire}<div class="last">last: {describeFire(lastFire, def.name)}</div>{/if}
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    z-index: 20;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 21;
    background: var(--bg-raised);
    border-top: 2px solid var(--accent);
    border-radius: 12px 12px 0 0;
    padding: 14px 16px calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
  }
  @media (min-width: 900px) {
    .sheet {
      left: 50%;
      right: auto;
      bottom: auto;
      top: 50%;
      transform: translate(-50%, -50%);
      width: 420px;
      border: 1px solid var(--line);
      border-top: 2px solid var(--accent);
      border-radius: 12px;
    }
  }
  .title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .name {
    font-weight: 700;
    font-size: 15px;
    color: var(--suit);
  }
  .meta {
    font-size: 11px;
    color: var(--text-dim);
  }
  .close {
    margin-left: auto;
    background: none;
    border: none;
    font-size: 16px;
    cursor: pointer;
  }
  .key {
    display: inline-block;
    width: 64px;
    color: var(--text-dim);
  }
  .state,
  .last {
    font-size: 11px;
    color: var(--text-dim);
  }
</style>
