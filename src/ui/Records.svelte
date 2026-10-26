<script lang="ts">
  import { profile } from './profile.svelte';
  import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
  import { CLASS_ORDER } from '../engine/meta';
  import { DIFFICULTIES, type Difficulty } from '../engine/basic-cribbage';
  import { starLabel, starsFor } from '../engine/skill';
  import { dailyRecords } from './records';
  import StarRating from './StarRating.svelte';
  import SuitIcon from './SuitIcon.svelte';

  // Records (go-live step 6, the user's set): runs, by class, fights, the
  // career Cribbage rating and Play Cribbage, and the Daily Runs. The
  // per-class, fight and Cribbage figures count from v0.9.0 on; the run
  // totals, Security Levels and Daily history are older.
  let { onmenu, today }: { onmenu: () => void; today: string } = $props();

  const d = $derived(profile.data);
  const s = $derived(d.stats);
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '–');
  const n = (x: number) => x.toLocaleString('en-US');
  const career = $derived(s.skill.hands ? { stars: starsFor(s.skill.lost / s.skill.hands), perHand: s.skill.lost / s.skill.hands } : null);
  const daily = $derived(dailyRecords(d.daily));
  const streak = $derived(profile.dailyStreak(today));
  const cribbage = $derived((Object.keys(DIFFICULTIES) as Difficulty[]).filter((k) => s.cribbage[k]?.played));
  const played = $derived(cribbage.reduce((t, k) => t + s.cribbage[k].played, 0));
  const won = $derived(cribbage.reduce((t, k) => t + s.cribbage[k].won, 0));
  const classRow = (id: ClassId) => s.byClass[id] ?? { runs: 0, wins: 0, deepest: 0 };
</script>

<div class="records">
  <button class="back" onclick={onmenu}>◂ menu</button>
  <h1>Records</h1>

  <div class="caption">RUNS</div>
  <div>{n(d.runsFinished)} finished · {n(d.victories)} {d.victories === 1 ? 'victory' : 'victories'} · deepest: {s.deepest ? `${s.deepest} layer${s.deepest === 1 ? '' : 's'} breached` : '–'}</div>
  <div class="dim">Rep earned: {n(d.repEarned)}</div>

  <div class="caption">BY CLASS</div>
  <div class="table">
    {#each CLASS_ORDER as id (id)}
      {@const c = classRow(id)}
      {@const cls = CLASS_DEFINITIONS[id]}
      <div class="trow" class:locked={!profile.hasClass(id)}>
        <span class="cname"><span class="icons">{#each cls.archetypes as a (a)}<SuitIcon archetype={a} size={13} />{/each}</span>{cls.name}</span>
        {#if profile.hasClass(id)}
          <span>{c.runs} run{c.runs === 1 ? '' : 's'}</span>
          <span>{c.wins} win{c.wins === 1 ? '' : 's'}{c.runs ? ` (${pct(c.wins, c.runs)})` : ''}</span>
          <span>best SEC {d.securityBest[id] ?? '–'}</span>
          <span>deepest {c.deepest ? `L${c.deepest}` : '–'}</span>
        {:else}
          <span class="dim">locked</span>
        {/if}
      </div>
    {/each}
  </div>

  <div class="caption">FIGHTS</div>
  <div>{n(s.fights)} won · {n(s.elites)} elite{s.elites === 1 ? '' : 's'} · {n(s.gatekeepers)} gatekeeper{s.gatekeepers === 1 ? '' : 's'} · {n(s.flawless)} Flawless</div>

  <div class="caption">CRIBBAGE</div>
  {#if career}
    <div class="row">Career rating: <StarRating stars={career.stars} /> {starLabel(career.stars)} <span class="dim">({career.perHand.toFixed(1)} points given up a hand, over {n(s.skill.hands)} hands)</span></div>
  {:else}
    <div class="dim">No rated hands yet.</div>
  {/if}
  <div>Play Cribbage: {played ? `${won} won of ${played}` : 'no games yet'}</div>
  {#if cribbage.length}
    <div class="dim">{cribbage.map((k) => `${DIFFICULTIES[k].name} ${s.cribbage[k].won}/${s.cribbage[k].played}`).join(' · ')}</div>
  {/if}

  <div class="caption">DAILY RUNS</div>
  <div>streak {streak} · best streak {daily.bestStreak} · {daily.played} day{daily.played === 1 ? '' : 's'} played</div>
  <div class="dim">best score: {daily.best ? `${n(daily.best.score)} (${daily.best.date})` : '–'}</div>

  <div class="note dim">Class, fight and Cribbage records count from v0.9.0.</div>
</div>

<style>
  .records {
    max-width: 640px;
    margin: 0 auto;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    line-height: 1.5;
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
  .dim {
    color: var(--text-dim);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .table {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .trow {
    display: grid;
    grid-template-columns: 9em 5em 9em 6.5em 1fr;
    white-space: nowrap;
    gap: 6px;
    align-items: center;
  }
  .trow.locked {
    opacity: 0.5;
  }
  .cname {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 700;
  }
  .icons {
    display: inline-flex;
  }
  .note {
    margin-top: 10px;
    font-size: 10px;
  }
  @media (max-width: 520px) {
    .trow {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
