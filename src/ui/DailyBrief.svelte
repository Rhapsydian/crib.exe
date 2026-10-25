<script lang="ts">
  import { rollDaily, DAILY_MODS } from '../engine/daily';
  import { CLASS_DEFINITIONS } from '../engine/classes';
  import { classModFor } from './kit';
  import { profile } from './profile.svelte';
  import { CATEGORY_NAME, dailyModName, dailyModText } from './daily-text';
  import SuitIcon from './SuitIcon.svelte';
  import RichText from './RichText.svelte';

  // The daily briefing (session 72, docs/daily-runs-design.md DR9): the
  // day's class and every Mod in full, whether this is the scored attempt
  // or practice, the streak and the last 14 days.
  // `saved` is a daily in progress in its own save slot (session 72): today's
  // is resumed rather than restarted (a restart would replace the scored
  // attempt's save); an earlier date's can be resumed, or replaced with a
  // warning.
  let {
    date,
    saved = null,
    onresume,
    onstart,
    onmenu,
  }: { date: string; saved?: { date: string; layer: number; practice: boolean } | null; onresume: () => void; onstart: () => void; onmenu: () => void } = $props();
  const todayInProgress = $derived(saved?.date === date);
  const plan = $derived(rollDaily(date));
  const cls = $derived(CLASS_DEFINITIONS[plan.classId]);
  const mod = $derived(classModFor(plan.classId));
  const record = $derived(profile.data.daily[date]);
  const streak = $derived(profile.dailyStreak(date));
  const history = $derived(profile.dailyHistory(date));
  const fmt = (n: number) => n.toLocaleString('en-US');
</script>

<div class="brief">
  <button class="back" onclick={onmenu}>◂ menu</button>
  <div class="kicker">DAILY RUN</div>
  <h1>{date}</h1>

  <div class="card cls">
    <div class="head"><span class="icons">{#each cls.archetypes as a (a)}<SuitIcon archetype={a} size={15} />{/each}</span><b>{cls.name}</b><span class="dim">today's class</span></div>
    <div class="line"><span class="glyph">◆</span> {mod.name}: <span class="dim">{mod.text}</span></div>
    <div class="line dim">{cls.startingLoadout.map((p) => p.name).join(' · ')} · no Message Board upgrades</div>
  </div>

  <div class="mods">
    {#each plan.mods as m (m.id)}
      {@const cat = DAILY_MODS[m.id].category}
      <div class="mod {cat}">
        <span class="tag">{CATEGORY_NAME[cat]}</span>
        <div><b>{dailyModName(m)}:</b> <RichText text={dailyModText(m)} /></div>
      </div>
    {/each}
  </div>

  {#if todayInProgress && saved}
    <div class="note scored">Today's {saved.practice ? 'practice run' : 'scored attempt'} is in progress, on layer {saved.layer}.</div>
    <button class="start" onclick={onresume}>▶ resume today's {saved.practice ? 'practice run' : 'scored attempt'}</button>
  {:else}
  {#if saved}
    <button class="resume-old" onclick={onresume}>▶ resume your daily from {saved.date} · layer {saved.layer}</button>
  {/if}
  {#if record?.scored !== undefined}
    <div class="note">You've played today's scored attempt: <b>{fmt(record.scored)}</b>. This run is practice{record.best ? `; your best practice is ${fmt(record.best)}` : ''}.</div>
  {:else if record?.started}
    <div class="note">Today's scored attempt was started and not finished. This run is practice.</div>
  {:else}
    <div class="note scored">This is your <b>scored attempt</b>. Runs after it are practice.</div>
  {/if}
  {#if saved}<div class="note warn">Starting today's daily replaces your unfinished daily from {saved.date}.</div>{/if}
  <button class="start" onclick={onstart}>▶ jack in as {cls.name}</button>
  {/if}

  <div class="caption">STREAK · {streak} day{streak === 1 ? '' : 's'}</div>
  <div class="history">
    {#each history as h (h.date)}
      <div class="day" class:played={h.record?.scored !== undefined} class:today={h.date === date}>
        <span class="date">{h.date.slice(5)}</span>
        <span class="score">{h.record?.scored !== undefined ? fmt(h.record.scored) : '·'}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .brief {
    max-width: 640px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .back {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--text-dim);
    font: inherit;
    font-size: 12px;
    padding: 0;
  }
  .kicker,
  .caption {
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--text-dim);
  }
  .caption {
    margin-top: 8px;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    color: var(--accent);
  }
  .card {
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11.5px;
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
  .mods {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mod {
    display: flex;
    gap: 10px;
    align-items: baseline;
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-left: 3px solid var(--c);
    border-radius: var(--radius);
    background: var(--bg-raised);
    font-size: 12px;
    line-height: 1.4;
  }
  .mod.directive {
    --c: var(--accent);
  }
  .mod.glitch {
    --c: var(--suit-exploit);
  }
  .mod.advisory {
    --c: var(--heat);
  }
  .mod.bulletin {
    --c: var(--mod);
  }
  .tag {
    flex: none;
    width: 70px;
    font-size: 10px;
    letter-spacing: 0.06em;
    color: var(--c);
  }
  .note {
    font-size: 12px;
    color: var(--text-dim);
  }
  .note.scored {
    color: var(--text);
  }
  .note.warn {
    color: var(--warn);
  }
  .resume-old {
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--bg-raised);
    color: var(--text);
    font: inherit;
    font-size: 12px;
  }
  .start {
    padding: 10px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    background: var(--bg-sunken);
    color: var(--accent);
    font: inherit;
    font-weight: 700;
  }
  .history {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }
  .day {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 2px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    font-size: 10px;
    color: var(--text-dim);
  }
  .day.played {
    border-color: var(--accent);
    color: var(--text);
  }
  .day.today {
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  .score {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
</style>
