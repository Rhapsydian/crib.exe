<script lang="ts">
  import { DAILY_MODS, type DailyPlan } from '../engine/daily';
  import { CATEGORY_NAME, dailyModName, dailyModText } from './daily-text';
  import RichText from './RichText.svelte';

  // A Daily Run's Mods beside the loadout (session 72, the user's ask): on
  // the map's loadout drawer and the fight screen's loadouts panel, so the
  // day's twists are in view wherever they matter.
  // `flashing` is the daily Mod acting right now in a fight's replay (the
  // user's ask: a flash when a daily effect triggers).
  let { plan, practice = false, flashing = null }: { plan: DailyPlan; practice?: boolean; flashing?: string | null } = $props();
</script>

<div class="caption">DAILY · {plan.date}{practice ? ' · practice' : ''}</div>
{#each plan.mods as m (m.id)}
  {@const cat = DAILY_MODS[m.id].category}
  <div class="kit {cat}" class:flash={flashing === m.id}>
    <div><span class="tag">{CATEGORY_NAME[cat]}</span> {dailyModName(m)}:</div>
    <div class="kit-text"><RichText text={dailyModText(m)} /></div>
  </div>
{/each}

<style>
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 6px;
  }
  .kit {
    border-left: 2px solid var(--c);
    padding-left: 6px;
    font-size: 11.5px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .kit-text {
    color: var(--text-dim);
    font-size: 11px;
  }
  .tag {
    font-size: 9px;
    letter-spacing: 0.06em;
    color: var(--c);
  }
  .flash {
    animation: flash 0.55s ease-out;
  }
  @keyframes flash {
    0%,
    60% {
      background: var(--c);
      color: var(--bg);
    }
  }
  .directive {
    --c: var(--accent);
  }
  .glitch {
    --c: var(--suit-exploit);
  }
  .advisory {
    --c: var(--heat);
  }
  .bulletin {
    --c: var(--mod);
  }
</style>
