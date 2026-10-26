<script lang="ts">
  // A dismissable notice at the top of a screen (go-live step 2): a save an
  // update cleared (`warn`), and (step 5b) what's new in a version (`news`),
  // with an optional link. Stays until dismissed.
  let {
    title,
    lines,
    ondismiss,
    tone = 'warn',
    action,
  }: { title: string; lines: string[]; ondismiss: () => void; tone?: 'warn' | 'news'; action?: { label: string; onclick: () => void } } = $props();
</script>

<div class="notice" class:news={tone === 'news'} role="status">
  <div class="head"><span class="title">{title}</span><button class="x" onclick={ondismiss} aria-label="dismiss">✕</button></div>
  {#each lines as line (line)}<div class="line">{tone === 'news' ? '· ' : ''}{line}</div>{/each}
  <div class="buttons">
    <button class="ok" onclick={ondismiss}>got it</button>
    {#if action}<button class="link" onclick={action.onclick}>{action.label}</button>{/if}
  </div>
</div>

<style>
  .notice {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid var(--warn);
    border-left-width: 3px;
    border-radius: var(--radius);
    background: var(--bg-raised);
    font-size: 12px;
  }
  .notice.news {
    border-color: var(--accent);
  }
  .notice.news .title {
    color: var(--accent);
  }
  .buttons {
    display: flex;
    align-items: center;
    gap: 10px;
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
  .head {
    display: flex;
    align-items: center;
  }
  .title {
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--warn);
  }
  .x {
    margin-left: auto;
    border: none;
    background: none;
    color: var(--text-dim);
    font: inherit;
    cursor: pointer;
  }
  .line {
    line-height: 1.4;
  }
  .ok {
    margin-top: 2px;
    padding: 3px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--text);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }
</style>
