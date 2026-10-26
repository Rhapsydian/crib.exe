<script lang="ts">
  import { SPEEDS, setTurnSpeed, turnSpeed, type Speed } from './replay.svelte';
  import { tips } from './tips.svelte';
  import { decodeProgress, encodeProgress, progressSummary, type ProgressPayload } from './progress-code';
  import { currentProgress, eraseProgress, importProgress } from './progress-store';
  import { sound } from './sound';

  // Settings (go-live step 3; the user's decisions are in
  // docs/go-live-plan.md): turn speed, tips, and progress -- a code to
  // export and import, and an erase. Import and erase reload the game, so
  // every screen starts from the new progress. Sound joins in step 4.
  let { onmenu }: { onmenu: () => void } = $props();

  let speed = $state<Speed>(turnSpeed());
  function pickSpeed(s: Speed) {
    speed = s;
    setTurnSpeed(s);
  }
  let tipsReset = $state(false);
  // Sound (go-live step 4): a preference, kept when progress is erased.
  let volume = $state(sound.volume);
  let muted = $state(sound.muted);

  // One progress panel open at a time.
  let panel = $state<'none' | 'export' | 'import' | 'erase'>('none');
  let exported = $state('');
  let copied = $state<'idle' | 'done' | 'select'>('idle');
  let exportBox = $state<HTMLTextAreaElement | null>(null);
  async function openExport() {
    panel = 'export';
    copied = 'idle';
    exported = await encodeProgress(currentProgress());
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(exported);
      copied = 'done';
    } catch {
      exportBox?.select();
      copied = 'select';
    }
  }

  let pasted = $state('');
  let checked = $state<ProgressPayload | { error: string } | null>(null);
  async function check() {
    checked = await decodeProgress(pasted);
  }
  function replace(payload: ProgressPayload) {
    importProgress(payload);
    location.reload();
  }
  function erase() {
    eraseProgress();
    location.reload();
  }
</script>

<div class="settings">
  <button class="back" onclick={onmenu}>◂ menu</button>
  <h1>Settings</h1>

  <div class="caption">SOUND</div>
  <div class="row">
    <span>Volume</span>
    <input type="range" min="0" max="1" step="0.05" bind:value={volume} disabled={muted} oninput={() => sound.setVolume(volume)} onchange={() => sound.play('peg', { force: true })} aria-label="volume" />
    <span class="dim">{Math.round(volume * 100)}%</span>
    <label class="mute"><input type="checkbox" bind:checked={muted} onchange={() => sound.setMuted(muted)} /> mute</label>
  </div>

  <div class="caption">GAMEPLAY</div>
  <div class="row">
    <span>Turn speed</span>
    <span class="seg" role="radiogroup" aria-label="turn speed">
      {#each SPEEDS as s (s)}<button role="radio" aria-checked={speed === s} class:on={speed === s} onclick={() => pickSpeed(s)}>{s}</button>{/each}
    </span>
  </div>
  <div class="dim">How fast turns play out in fights and Play Cribbage; the » button in a game changes it too. Learn to play keeps its own, slower speed.</div>

  <div class="caption">TIPS</div>
  <div class="row">
    <button class="act" onclick={() => { tips.reset(); tipsReset = true; }} disabled={tipsReset}>{tipsReset ? 'tips will show again' : 'show tips again'}</button>
  </div>
  <div class="dim">The first-time tips show once each; this brings them back.</div>

  <div class="caption">PROGRESS</div>
  <div class="dim">Your Rep, unlocks, upgrades, Daily Runs and lessons. A code carries them to another device or browser, or keeps them safe if this browser's data is cleared.</div>
  <div class="row">
    <button class="act" class:on={panel === 'export'} onclick={openExport}>export progress</button>
    <button class="act" class:on={panel === 'import'} onclick={() => ((panel = 'import'), (checked = null))}>import progress</button>
    <button class="act danger" class:on={panel === 'erase'} onclick={() => (panel = 'erase')}>erase all progress…</button>
  </div>

  {#if panel === 'export'}
    <div class="panel">
      <div>Your progress code. Copy it somewhere safe; paste it into <b>import progress</b> to bring it back.</div>
      <textarea bind:this={exportBox} readonly rows="5" value={exported}></textarea>
      <div class="row">
        <button class="act" onclick={copy} disabled={!exported}>copy</button>
        {#if copied === 'done'}<span class="ok">copied</span>{:else if copied === 'select'}<span class="dim">selected: copy it with your device's copy command</span>{/if}
      </div>
    </div>
  {:else if panel === 'import'}
    <div class="panel">
      <div>Paste a progress code.</div>
      <textarea bind:value={pasted} rows="5" placeholder="CRIBEXE1-…" oninput={() => (checked = null)}></textarea>
      {#if !checked}
        <div class="row"><button class="act" onclick={check} disabled={!pasted.trim()}>check code</button></div>
      {:else if 'error' in checked}
        <div class="warn">{checked.error}</div>
      {:else}
        {@const payload = checked}
        <div>This code holds: <b>{progressSummary(payload)}</b>.</div>
        <div class="warn">Importing replaces your current progress, and clears any saved games. This can't be undone.</div>
        <div class="row">
          <button class="act danger" onclick={() => replace(payload)}>replace my progress</button>
          <button class="act" onclick={() => (panel = 'none')}>cancel</button>
        </div>
      {/if}
    </div>
  {:else if panel === 'erase'}
    <div class="panel">
      <div><b>Erase all progress?</b> Your Rep, unlocks, upgrades, Daily Runs, lessons, saved games and seen tips go, and the game starts over as it does for a new player. Turn speed and sound stay. This can't be undone.</div>
      <div class="dim">Export your progress first if you might want it back.</div>
      <div class="row">
        <button class="act" onclick={openExport}>export first</button>
        <button class="act danger" onclick={erase}>erase</button>
        <button class="act" onclick={() => (panel = 'none')}>cancel</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .settings {
    max-width: 640px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
  }
  h1 {
    font-size: 18px;
    color: var(--accent);
    margin: 6px 0;
  }
  .back {
    align-self: flex-start;
    border: none;
    background: none;
    color: var(--text-dim);
    font: inherit;
    padding: 0;
    cursor: pointer;
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
    flex-wrap: wrap;
  }
  .dim {
    color: var(--text-dim);
    font-size: 11px;
    line-height: 1.4;
  }
  .mute {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  input[type='range'] {
    width: 160px;
    accent-color: var(--accent);
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .seg button {
    padding: 4px 10px;
    border: none;
    background: var(--bg-raised);
    color: var(--text-dim);
    font: inherit;
    cursor: pointer;
  }
  .seg button.on {
    background: var(--accent);
    color: var(--bg);
  }
  .act {
    padding: 5px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }
  .act.on {
    border-color: var(--accent);
  }
  .act.danger {
    color: var(--warn);
  }
  .act:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    line-height: 1.4;
  }
  textarea {
    width: 100%;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--text);
    font: inherit;
    font-size: 11px;
    word-break: break-all;
    resize: vertical;
  }
  .warn {
    color: var(--warn);
  }
  .ok {
    color: var(--accent);
  }
</style>
