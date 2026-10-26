<script lang="ts">
  import { sound, type SoundId } from './sound';

  // The sound audition page (#sounds, development only; go-live step 4):
  // every sound by moment, to hear and tune them.
  const GROUPS: { name: string; ids: SoundId[] }[] = [
    { name: 'CARDS', ids: ['handStart', 'cardYou', 'cardThem', 'cut', 'clear'] },
    { name: 'CRIBBAGE SCORING', ids: ['peg', 'show'] },
    { name: 'A FIGHT', ids: ['turnYou', 'turnThem', 'fire', 'mod', 'alarm', 'breached', 'contained'] },
    { name: 'A RUN', ids: ['move', 'cache', 'reward'] },
    { name: 'THE RATING', ids: ['flawless'] },
  ];
  const LABELS: Record<SoundId, string> = {
    handStart: 'A hand starts', cardYou: 'Your card played', cardThem: 'Their card played', cut: 'The cut', clear: 'The table clears',
    peg: 'Pegging points', show: 'A show count',
    turnYou: 'Your turn starts', turnThem: 'Their turn starts', fire: 'A subroutine fires', mod: 'A Mod or Burner acts', alarm: 'An alarm raises Heat', breached: 'Breached (win)', contained: 'Contained (loss)',
    move: 'Moving on the map', cache: 'Opening a Cache', reward: 'Taking a reward',
    flawless: 'Flawless (5 stars)',
  };
  let volume = $state(sound.volume);
</script>

<div class="audition">
  <h1>Sound audition</h1>
  <div class="row">Volume <input type="range" min="0" max="1" step="0.05" bind:value={volume} oninput={() => sound.setVolume(volume)} /> {Math.round(volume * 100)}%</div>
  {#each GROUPS as g (g.name)}
    <div class="caption">{g.name}</div>
    {#each g.ids as id (id)}
      <div class="row"><button onclick={() => sound.play(id, { force: true })}>▶ {LABELS[id]}</button></div>
    {/each}
  {/each}
</div>

<style>
  .audition {
    max-width: 640px;
    margin: 0 auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }
  h1 {
    font-size: 18px;
    color: var(--accent);
  }
  .caption {
    margin-top: 10px;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  button {
    padding: 4px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
</style>
