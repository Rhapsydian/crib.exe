<script lang="ts">
  import { untrack } from 'svelte';
  import { VERSION_NOTES } from './version-notes';
  import { DISCORD_URL, REPO_URL } from './links';

  // About (go-live step 5): the game, who made it and how, credits and
  // licenses, and (step 5b) every version's patch notes. The maker's credit
  // and the agentic-development note are the user's words.
  let { onmenu, notes = false }: { onmenu: () => void; notes?: boolean } = $props();
  // Opens on the view asked for; the page can switch after.
  let view = $state<'about' | 'notes'>(untrack(() => (notes ? 'notes' : 'about')));

  const REPO = REPO_URL;
  const DISCORD: string | null = DISCORD_URL;
  const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;
</script>

<div class="about">
  <button class="back" onclick={() => (view === 'notes' && !notes ? (view = 'about') : onmenu())}>◂ {view === 'notes' && !notes ? 'about' : 'menu'}</button>

  {#if view === 'about'}
    <h1>crib.exe <span class="ver">v{__APP_VERSION__}</span></h1>
    <div>A hacking roguelite where every fight is a game of Cribbage.</div>
    <div>Made by <b>Rhapsydian</b> (Justin Stephens).</div>
    <div class="dim">Developed with agentic development, using Claude Code. The source is on GitHub: <a href={REPO} target="_blank" rel="noopener">{REPO.replace('https://', '')}</a></div>
    {#if DISCORD}<div>Feedback, bugs and news: <a href={DISCORD} target="_blank" rel="noopener">the crib.exe Discord</a></div>{/if}
    <div class="row"><button class="act" onclick={() => (view = 'notes')}>patch notes</button></div>

    <div class="caption">CREDITS</div>
    <div>Map and menu icons: <a href="https://tabler.io/icons" target="_blank" rel="noopener">Tabler Icons</a>, © 2020-2024 Paweł Kuna (MIT License).</div>
    <div>Built with <a href="https://svelte.dev" target="_blank" rel="noopener">Svelte</a>, © 2016-2025 Svelte Contributors (MIT License).</div>
    <div>Card sounds: <a href="https://opengameart.org/content/keyboard-soundpack-1-typing-and-single-keystrokes" target="_blank" rel="noopener">Keyboard soundpack 1</a> by unicaegames (CC0). The other sounds are the game's own.</div>

    <div class="caption">MIT LICENSE</div>
    <div class="license">{MIT}</div>
  {:else}
    <h1>Patch notes</h1>
    {#each VERSION_NOTES as v (v.version)}
      <div class="version">
        <div class="vhead"><b>v{v.version}</b> <span class="dim">{v.date}</span></div>
        <ul>{#each v.notes as n (n)}<li>{n}</li>{/each}</ul>
        {#if v.full}<a href="patch-notes/{v.full}" target="_blank" rel="noopener">the full notes ▸</a>{/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .about {
    max-width: 640px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    line-height: 1.5;
  }
  h1 {
    font-size: 18px;
    color: var(--accent);
    margin: 6px 0;
  }
  .ver {
    font-size: 12px;
    color: var(--text-dim);
    font-weight: 400;
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
  .dim {
    color: var(--text-dim);
  }
  a {
    color: var(--accent);
  }
  .row {
    display: flex;
    gap: 8px;
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
  .license {
    font-size: 10px;
    color: var(--text-dim);
  }
  .version {
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
  }
  ul {
    margin: 4px 0;
    padding-left: 18px;
  }
</style>
