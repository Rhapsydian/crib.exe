<script lang="ts">
  import { KEY_FILES, sound, type SoundId } from './sound';
  import RollBar from './RollBar.svelte';

  // The sound audition page (#sounds, development only; go-live step 4):
  // every sound by moment, to hear and tune them.
  const GROUPS: { name: string; ids: SoundId[] }[] = [
    { name: 'CARDS', ids: ['handStart', 'cardYou', 'cardThem', 'cardLift', 'cardDrop', 'cribSend', 'cut', 'clear'] },
    { name: 'CRIBBAGE SCORING', ids: ['peg', 'show'] },
    { name: 'A FIGHT', ids: ['turnYou', 'turnThem', 'fire', 'mod', 'alarm', 'breached', 'contained'] },
    { name: 'A RUN', ids: ['move', 'cache', 'reward'] },
    { name: 'AN EVENT ROLL', ids: ['rollTick', 'rollGood', 'rollBad'] },
    { name: 'THE RATING', ids: ['flawless'] },
  ];
  const LABELS: Record<SoundId, string> = {
    handStart: 'A hand starts', cardYou: 'Your card played', cardThem: 'Their card played', cardLift: 'Lifting a card', cardDrop: 'Dropping a card back', cribSend: 'Sending two to the crib', cut: 'The cut', clear: 'The table clears',
    peg: 'Pegging points', show: 'A show count',
    turnYou: 'Your turn starts', turnThem: 'Their turn starts', fire: 'A subroutine fires', mod: 'A Mod or Burner acts', alarm: 'An alarm raises Heat', breached: 'Breached (win)', contained: 'Contained (loss)',
    move: 'Moving on the map', cache: 'Opening a Cache', reward: 'Taking a reward',
    rollTick: 'The roll crosses a segment', rollGood: 'The roll lands well', rollBad: 'The roll lands badly',
    flawless: 'Flawless (5 stars)',
  };
  let volume = $state(sound.volume);
  // The Event roll (v0.9.0), to watch and hear: a risky 60/25/15, or a
  // gamble of three, landing on a random outcome.
  let demo = $state<{ gamble: boolean; landed: number; fast: boolean; key: number } | null>(null);
  const rollDemo = (gamble: boolean, fast = false) => (demo = { gamble, landed: Math.floor(Math.random() * 3), fast, key: Date.now() });
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
  <div class="caption">AN EVENT ROLL, PLAYED OUT</div>
  <div class="row">
    <button onclick={() => rollDemo(false)}>▶ risky roll</button>
    <button onclick={() => rollDemo(true)}>▶ gamble roll</button>
    <button onclick={() => rollDemo(false, true)}>▶ risky, fast</button>
  </div>
  {#if demo}
    {#key demo.key}
      <RollBar odds={[0.6, 0.25, 0.15]} tones={['good', 'mixed', 'bad']} landed={demo.landed} gamble={demo.gamble} result={['+40 Data', '+20 Data, +4 Heat', '+8 Heat'][demo.landed]} fast={demo.fast} onsettled={() => {}} />
    {/key}
  {/if}
  <div class="caption">THE CARD SOUNDS' KEYS (unicaegames, CC0)</div>
  <div class="keys">{#each KEY_FILES as f, i (f)}<button onclick={() => sound.playSample({ files: [f], gain: 0.8 })}>{i + 1}</button>{/each}</div>
  <div class="row"><button onclick={() => { for (let i = 0; i < 16; i++) setTimeout(() => sound.play(i % 2 ? 'cardThem' : 'cardYou', { force: true }), i * 420); }}>▶ sixteen cards, you and them (listen for double taps)</button></div>
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
  .keys {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
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
