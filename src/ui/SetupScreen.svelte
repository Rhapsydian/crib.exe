<script lang="ts">
  import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
  import { ENEMY_ROSTER, type EnemyDefinition, type EnemyTier } from '../engine/enemies';
  import SuitIcon from './SuitIcon.svelte';

  // Milestone 2's test harness: pick a class and an enemy, then fight.
  // The real run setup (class choice, the map) is milestone 3.
  let { onstart, classId: initialClass, enemyId: initialEnemy }: { onstart: (classId: ClassId, enemy: EnemyDefinition) => void; classId?: ClassId; enemyId?: string } =
    $props();

  const classes = Object.values(CLASS_DEFINITIONS);
  const tiers: EnemyTier[] = ['regular', 'elite', 'gatekeeper'];
  // svelte-ignore state_referenced_locally
  let classId = $state<ClassId>(initialClass ?? classes[0].id);
  // svelte-ignore state_referenced_locally
  let enemyId = $state<string>(initialEnemy ?? ENEMY_ROSTER[0].id);
  const enemy = $derived(ENEMY_ROSTER.find((e) => e.id === enemyId)!);
</script>

<div class="setup">
  <h1>crib.exe <span>// test fight</span></h1>

  <div class="caption">CLASS</div>
  <div class="grid">
    {#each classes as c (c.id)}
      <button class="option" class:chosen={c.id === classId} onclick={() => (classId = c.id)}>
        <span class="icons">{#each c.archetypes as a (a)}<SuitIcon archetype={a} size={13} />{/each}</span>
        {c.name}
      </button>
    {/each}
  </div>

  {#each tiers as tier (tier)}
    <div class="caption">{tier.toUpperCase()}S</div>
    <div class="grid">
      {#each ENEMY_ROSTER.filter((e) => e.tier === tier) as e (e.id)}
        <button class="option" class:chosen={e.id === enemyId} onclick={() => (enemyId = e.id)}>
          {e.name} <span class="layer">L{e.minLayer}</span>
        </button>
      {/each}
    </div>
  {/each}

  <button class="start" onclick={() => onstart(classId, enemy)}>▶ jack in: {CLASS_DEFINITIONS[classId].name} vs {enemy.name}</button>
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
    margin-top: 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 5px;
  }
  .option {
    display: flex;
    align-items: center;
    gap: 6px;
    text-align: left;
    padding: 7px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font-size: 12px;
  }
  .option.chosen {
    border-color: var(--accent);
    color: var(--accent);
  }
  .icons {
    display: inline-flex;
    gap: 2px;
  }
  .layer {
    margin-left: auto;
    color: var(--text-dim);
    font-size: 10px;
  }
  .start {
    margin-top: 14px;
    padding: 10px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: transparent;
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
  }
</style>
