<script lang="ts">
  import { stickToBottom } from './stick-to-bottom';
  import { untrack } from 'svelte';
  import RichText from './RichText.svelte';
  import type { FightSnapshot } from './snapshot';
  import type { Card } from '../engine/cards';
  import type { Replay } from './replay.svelte';
  import { fightParts, pickedEntry, pickFromLog, type Picked } from './fight';
  import Gauges from './Gauges.svelte';
  import Loadout from './Loadout.svelte';
  import Table from './Table.svelte';
  import Hand from './Hand.svelte';
  import Log from './Log.svelte';
  import DetailSheet from './DetailSheet.svelte';
  import { burnerLabel, scoreLabel, stepLine, stepMods, tableAt, type Step } from './timeline';
  import { burnersOf, modKey, modName, modsOf, type KitItem } from './kit';
  import KitList from './KitList.svelte';
  import ShowPanel from './ShowPanel.svelte';
  import type { BurnerId } from '../engine/burner-types';
  import { BURNER_DEFINITIONS } from '../engine/burners';
  import { tips } from './tips.svelte';
  import { guide } from './guide.svelte';
  import GuideBanner from './GuideBanner.svelte';
  import CoachPanel, { type CoachSection } from './CoachPanel.svelte';
  import { discardHint, discardReview, pegHint, pegReview, phaseIntro, type PegSpot } from './coach';
  import { fightPegSpot } from './fight';
  import HeatBar from './HeatBar.svelte';
  import { fightHeatOutlook } from '../engine/heat';
  import { readGauges } from '../engine/resolve';
  import type { FightHeatContext } from './fight-session';

  // The chosen fight-screen layout (the user's picks from the P3 mockups):
  // COMPACT on phones -- everything on one screen, a three-line log
  // ticker that slides the full log in from the left, and a loadouts
  // button (top right) that slides the full loadouts in from the right
  // -- and DRAWERS on desktop:
  // full loadouts in a left panel, the log in a right panel, both on a
  // darker background, the table and hand in the centre.
  // `onplay` / `ondiscard` answer the live engine; without them (the
  // fixed mockup moment) the hand only says what it would send.
  // `replay` steps through each turn's fires (P4): while it plays, the
  // log, gauges and lit piece follow it. (A tap anywhere used to skip it;
  // removed in session 63, the user's call -- Space / Enter / Esc still do.)
  let {
    snapshot,
    onplay,
    ondiscard,
    replay,
    onburner,
    heat,
    ending = null,
    over = false,
    showLog = false,
  }: {
    snapshot: FightSnapshot;
    onplay?: (card: Card) => void;
    ondiscard?: (cards: [Card, Card]) => void;
    replay?: Replay;
    onburner?: (id: BurnerId | null) => void;
    heat?: FightHeatContext;
    /** The fight just ended: the side whose win gauge filled, which blinks
     * before the result card (session 63). The gauges show the final state. */
    ending?: 0 | 1 | null;
    /** The fight is over and played out: the gauges hold its final state
     * (the frame's are from the last decision, before the final turn). */
    over?: boolean;
    /** The result card's "view log" (session 70): opens the log, the
     * slide-in drawer on phones; false closes it again. */
    showLog?: boolean;
  } = $props();
  const f = $derived(fightParts(snapshot));
  let picked = $state<Picked | null>(null);
  let sheet = $state<'none' | 'log' | 'loadouts'>('none');
  $effect(() => {
    const open = showLog;
    untrack(() => {
      if (open) sheet = 'log';
      else if (sheet === 'log') sheet = 'none';
    });
  });
  const detail = $derived(pickedEntry(snapshot, picked));
  // Live, the table, the log and the gauges follow the replay's position
  // in the fight's steps; for the mockups, the paused frame as it is.
  const steps = $derived<readonly Step[]>(replay ? replay.steps.slice(0, replay.shown) : f.view.log.map((fire) => ({ type: 'fire', fire })));
  let pickedKit = $state<KitItem | null>(null);
  // Mods (both sides) and the player's Burners, spent ones marked from
  // the Burner beats played so far.
  const theirMods = $derived(modsOf(f.view.combatState, 1));
  const yourMods = $derived(modsOf(f.view.combatState, 0));
  const yourBurners = $derived(
    burnersOf(
      f.view.combatState.carriedBurnerIds,
      steps.flatMap((s) => (s.type === 'beat' && s.beat.kind === 'burner' && s.beat.side === 0 ? [s.beat.burnerId] : [])),
    ),
  );
  const burnersLeft = $derived(yourBurners.filter((b) => !b.spent).length);

  // The tutorial coach (session 63) reacts to the fight as it plays out:
  // the first turn, Hook, enemy turn and Burner it sees. While a fight is
  // up, the coach speaks over the table, not in the top banner.
  $effect(() => {
    guide.inFight = true;
    return () => (guide.inFight = false);
  });
  // It reads every step as it appears, not just the one on screen, so a
  // skipped replay still counts.
  let coached = 0;
  $effect(() => {
    if (!replay || !guide.active) return;
    const { shown, steps } = replay;
    if (shown < coached) coached = 0;
    for (; coached < shown; coached++) {
      const step = steps[coached];
      if (step.type === 'beat' && step.beat.kind === 'turn') guide.offer(step.beat.side === 0 ? 'turn' : 'enemyTurn');
      if (step.type === 'beat' && step.beat.kind === 'burner' && step.beat.side === 0) guide.offer('burnerFired');
      if (step.type === 'fire' && step.fire.side === 0 && (step.fire.elevated || step.fire.beta)) guide.offer('hook');
    }
  });

  // First-time tips (T6): your first Instant Hook going off; an enemy
  // carrying Wipe, Strip or Trace.
  $effect(() => {
    const fire = replay?.current?.type === 'fire' ? replay.current.fire : null;
    if (fire && fire.side === 0 && fire.immediate) tips.offer('instant');
  });
  // System strain (S12): its first time.
  $effect(() => {
    const step = replay?.current;
    if (step?.type === 'beat' && step.beat.kind === 'strain') tips.offer('strain');
  });
  $effect(() => {
    const enemyOnly = ['trace', 'wipe', 'strip'];
    if (f.view.combatState.sides[1].loadout.some((e) => enemyOnly.includes(e.definition.alpha.verb) || enemyOnly.includes(e.definition.beta?.effect.verb ?? ''))) tips.offer('enemyEffects');
  });

  // Burners are armed, not prompted for (the user's playtest call,
  // session 61): a toggle under your gauges per kind of combat Burner
  // you still carry. One at a time -- arming another disarms the first.
  // An armed Burner is used at the start of your next turn: the engine
  // already asks just after the turn beat and before the fires, so it
  // plays out right after "your turn" shows, then disarms.
  const spentIds = $derived(steps.flatMap((s) => (s.type === 'beat' && s.beat.kind === 'burner' && s.beat.side === 0 ? [s.beat.burnerId] : [])));
  const armable = $derived.by(() => {
    const spent = [...spentIds];
    const left = f.view.combatState.carriedBurnerIds.filter((id) => {
      const i = spent.indexOf(id);
      if (i !== -1) {
        spent.splice(i, 1);
        return false;
      }
      return BURNER_DEFINITIONS[id].combat !== undefined;
    });
    return [...new Set(left)].map((id) => ({ id, count: left.filter((b) => b === id).length }));
  });
  let armed = $state<BurnerId | null>(null);
  // Each Burner says when it acts (session 64, BE2): "Now" ones go off with
  // your next discard or card (undo until then), "Next turn" ones at the
  // start of your next turn.
  const timingLabel = (id: BurnerId) => (BURNER_DEFINITIONS[id].combat?.timing === 'now' ? 'Now' : 'Next turn');
  const armNote = $derived.by(() => {
    if (!armed) return 'Arm a Burner: "Now" ones go off with your next discard or card, "Next turn" ones at the start of your next turn.';
    const def = BURNER_DEFINITIONS[armed];
    return def.combat?.timing === 'now'
      ? `${def.name} goes off with your next discard or card. Undo it until then.`
      : `${def.name} goes off at the start of your next turn.`;
  });
  // The engine's Burner pause: answer it at once with whatever is armed.
  let answered: FightSnapshot | null = null;
  $effect(() => {
    if (f.phase !== 'burner' || !onburner || answered === snapshot) return;
    answered = snapshot;
    const use = armed !== null && f.burners.includes(armed) ? armed : null;
    if (use) armed = null;
    onburner(use);
  });
  // The Mods acting at the replay's current step flash (the user's ask).
  const flashing = $derived(new Set(stepMods(replay?.current ?? null).map((t) => modKey(t.side, t.mod))));
  const flashSide = (side: 0 | 1) => stepMods(replay?.current ?? null).some((t) => t.side === side);
  const names = $derived(new Map(f.view.combatState.sides.flatMap((s) => s.loadout.map((e) => [e.definition.id, e.definition.name] as const))));
  const table = $derived(replay ? tableAt(replay.steps, replay.shown) : null);
  const ticker = $derived(
    steps
      .map((s) => stepLine(s, names))
      .filter((l) => l !== null)
      .slice(-3),
  );
  const callout = $derived.by(() => {
    const step = replay?.current;
    if (step?.type !== 'beat') return null;
    const b = step.beat;
    // Show scores are announced in the show panel instead.
    if (b.kind === 'points' && b.phase !== 'show') return { text: scoreLabel(b.occurrence, b.phase), side: b.occurrence.player, key: replay!.shown };
    return null;
  });
  // Mod and Burner callouts float over whichever panel is up (the table
  // or the show), since either can act during the show's turns.
  // Toasts in the open gap above the table / show panel (the user's
  // asks): a show score, like pegging's callout but clear of the panel's
  // cards and count; and a turn starting, either side, in either phase
  // (pegging's own score callout sits over the pile, so they never meet).
  const gapToast = $derived.by(() => {
    const step = replay?.current;
    if (step?.type !== 'beat') return null;
    const b = step.beat;
    if (b.kind === 'points' && b.phase === 'show') {
      return { text: `${b.occurrence.player === 0 ? '+' : '−'} ${scoreLabel(b.occurrence, 'show')}`, side: b.occurrence.player, key: replay!.shown, turn: false };
    }
    if (b.kind === 'turn') return { text: `▶ ${b.side === 0 ? 'YOUR' : 'THEIR'} TURN`, side: b.side, key: replay!.shown, turn: true };
    return null;
  });
  const slotCallout = $derived.by(() => {
    const step = replay?.current;
    if (step?.type !== 'beat') return null;
    const b = step.beat;
    if (b.kind === 'burner') return { text: `⏏︎ ${burnerLabel(b.burnerId)}`, side: b.side, key: replay!.shown, tone: 'burner' };
    if (b.kind === 'strain') return { text: `⚠ strain +${Number.isInteger(b.heat) ? b.heat : b.heat.toFixed(1)} Heat`, side: 0, key: replay!.shown, tone: 'burner' };
    if (b.kind === 'mod') return { text: `◆ ${b.side === 0 ? 'your' : 'their'} ${modName(b.mod, f.view.combatState.bridgeUpgraded?.[b.side])}`, side: b.side, key: replay!.shown, tone: 'mod' };
    return null;
  });
  // A new hand: a banner over the table while its beat is up.
  const banner = $derived.by(() => {
    const step = replay?.current;
    if (step?.type !== 'beat' || step.beat.kind !== 'hand') return null;
    return { title: `HAND ${step.beat.handIndex + 1}`, sub: step.beat.dealer === 0 ? 'you deal · your crib' : 'they deal · their crib', key: replay!.shown };
  });
  const handReady = $derived(!table || table.handIndex === f.view.handIndex);

  // The Heat bar (session 63): in a run's fights, your Heat now (alarms
  // included, as the replay reaches them) and what winning now would leave.
  const heatOutlook = $derived.by(() => {
    if (!heat) return null;
    const [you, them] = replay?.gauges ?? readGauges(f.view.combatState);
    return fightHeatOutlook({ ...heat, alarm: you.heat, enemyFill: them.winThreshold ? them.win / them.winThreshold : 0 });
  });

  // The Cribbage coach (T3): in the guided run, a switch starting off.
  // On, its panel takes the log ticker's place, as in Play Cribbage:
  // advice for the decision in front of you, then a review of your
  // discard and last play. (Last hand's count is on the table already,
  // in the show.)
  const cribbageCoach = $derived(guide.active && guide.cribbageCoach);
  let lastDiscard = $state.raw<{ handIndex: number; hand: Card[]; thrown: [Card, Card]; ownCrib: boolean } | null>(null);
  let lastPlay = $state.raw<{ handIndex: number; spot: PegSpot; played: Card } | null>(null);
  function play(card: Card) {
    const spot = fightPegSpot(snapshot);
    if (spot) lastPlay = { handIndex: f.view.handIndex, spot, played: card };
    onplay?.(card);
  }
  function discard(cards: [Card, Card]) {
    lastDiscard = { handIndex: f.view.handIndex, hand: f.hand, thrown: cards, ownCrib: f.playerOwnsCrib };
    ondiscard?.(cards);
  }
  const coachSections = $derived.by<CoachSection[]>(() => {
    if (!cribbageCoach || !handReady || replay?.playing) return [];
    const ownCrib = f.playerOwnsCrib;
    const first = f.view.handIndex === 0;
    const sections: CoachSection[] = [];
    if (f.phase === 'discard') {
      sections.push({ title: 'NOW', lines: [...(guide.cribbageHints ? [discardHint(f.hand, ownCrib)] : []), phaseIntro('discard', ownCrib, false)] });
      if (first) sections.push({ title: 'HOW IT WORKS', lines: [phaseIntro('discard', ownCrib, true)] });
    } else if (f.phase === 'play') {
      const spot = fightPegSpot(snapshot);
      sections.push({ title: 'NOW', lines: [guide.cribbageHints && spot ? pegHint(spot) : phaseIntro('peg', ownCrib, false)] });
      if (lastPlay && lastPlay.handIndex === f.view.handIndex) sections.push({ title: 'YOUR LAST PLAY', lines: [pegReview(lastPlay.spot, lastPlay.played).text] });
      if (lastDiscard && lastDiscard.handIndex === f.view.handIndex) sections.push({ title: 'YOUR DISCARD', lines: [discardReview(lastDiscard.hand, lastDiscard.thrown, lastDiscard.ownCrib).text] });
      if (first) sections.push({ title: 'HOW IT WORKS', lines: [phaseIntro('peg', ownCrib, true)] });
    }
    return sections;
  });
  const firingSlot = (side: 0 | 1) => {
    const fire = replay?.firing;
    if (!fire || fire.side !== side) return -1;
    return f.view.combatState.sides[side].loadout.findIndex((e) => e.definition.id === fire.subroutineId);
  };

  // Desktop keys (P5): Space / Enter / Esc skip a turn that's playing
  // out; Esc closes the detail panel or a drawer. The hand takes 1-6 /
  // Enter.
  function onkey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (replay?.playing && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      replay.skip();
      return;
    }
    if (e.key === 'Escape' && (picked || pickedKit)) {
      picked = null;
      pickedKit = null;
      return;
    }
    if (e.key === 'Escape' && sheet !== 'none') {
      sheet = 'none';
      return;
    }
  }

  function pickLog(side: 0 | 1, id: string) {
    // The log drawer stays open underneath, so closing the detail
    // returns the player to where they were in the log.
    picked = pickFromLog(snapshot, side, id);
  }
</script>

<div class="screen">
  <aside class="panel loadouts-panel" class:open={sheet === 'loadouts'}>
    <button class="close" onclick={() => (sheet = 'none')} aria-label="close loadouts">✕</button>
    <div class="caption">THEIR LOADOUT · fires top → bottom</div>
    <Loadout entries={f.them.loadout} vertical enemy firing={firingSlot(1)} onpick={(i) => (picked = { side: 1, index: i })} />
    {#if theirMods.length}
      <div class="caption sub">THEIR MODS</div>
      <KitList items={theirMods} {flashing} onpick={(k) => (pickedKit = k)} />
    {/if}
    <div class="caption">YOUR LOADOUT · {f.className}</div>
    <Loadout entries={f.you.loadout} vertical firing={firingSlot(0)} onpick={(i) => (picked = { side: 0, index: i })} />
    {#if yourMods.length}
      <div class="caption sub">YOUR MODS</div>
      <KitList items={yourMods} {flashing} onpick={(k) => (pickedKit = k)} />
    {/if}
    {#if yourBurners.length}
      <div class="caption sub">YOUR BURNERS</div>
      <KitList items={yourBurners} onpick={(k) => (pickedKit = k)} />
    {/if}
  </aside>

  <main class="main">
    <div class="band enemy">
      <div class="who">
        <span class="tag">TARGET</span> <span class="enemy-name">{f.enemyName}</span>
        {#if guide.active}<button class="speed" class:on={guide.cribbageCoach} aria-pressed={guide.cribbageCoach} onclick={() => (guide.cribbageCoach = !guide.cribbageCoach)} title="the Cribbage coach: {guide.cribbageCoach ? 'on' : 'off'}">◈ coach</button>{/if}
        {#if replay}<button class="speed" class:after={guide.active} onclick={() => replay.cycleSpeed()} title="turn speed">» {replay.speed}</button>{/if}
        <button class="loadouts-button" onclick={() => (sheet = 'loadouts')}>◀ loadouts</button>
      </div>
      <!-- Heat between the TARGET row and the enemy's subroutines (the
           user's call). -->
      {#if heatOutlook}<HeatBar outlook={heatOutlook} gatekeeper={heat?.tier === 'gatekeeper'} />{/if}
      <Loadout entries={f.them.loadout} dense enemy firing={firingSlot(1)} onpick={(i) => (picked = { side: 1, index: i })} />
      <Gauges side={f.them} reading={replay?.gauges?.[1] ?? (over ? replay?.live?.[1] : undefined)} ending={ending === 1} isPlayer={false} compact mods={theirMods.length} modNames={theirMods.map((m) => m.name)} flashMods={flashSide(1)} onkit={() => (sheet = 'loadouts')} />
    </div>

    <div class="table-slot">
      {#if table?.show}
        <ShowPanel show={table.show} />
      {:else if table}
        <Table sequence={[]} pile={table.pile} leaving={table.leaving} count={table.count} limit={f.countLimit} starter={table.starter} playerIsDealer={table.dealer === 0} opponentCardsLeft={table.cardsLeft[1]} {callout} />
      {:else}
        <Table sequence={f.sequence} count={f.count} limit={f.countLimit} starter={f.starter} playerIsDealer={f.playerIsDealer} opponentCardsLeft={f.opponentCardsLeft} />
      {/if}
      {#if gapToast}
        {#key gapToast.key}
          <div class="gap-toast" class:them={gapToast.side === 1} class:turn={gapToast.turn}>{gapToast.text}</div>
        {/key}
      {/if}
      {#if slotCallout}
        {#key slotCallout.key}
          <div class="slot-callout {slotCallout.tone}">{slotCallout.text}</div>
        {/key}
      {/if}
      {#if banner}
        {#key banner.key}
          <div class="banner"><b>{banner.title}</b><span>{banner.sub}</span></div>
        {/key}
      {/if}
      <!-- The tutorial coach, over the table (session 63). -->
      {#if guide.active}<GuideBanner inline />{/if}
    </div>

    {#if cribbageCoach}
      <div class="coach-slot"><CoachPanel sections={coachSections} onlog={() => (sheet = 'log')} hints={guide.cribbageHints} onhints={() => (guide.cribbageHints = !guide.cribbageHints)} /></div>
    {:else}
    <button class="ticker" onclick={() => (sheet = 'log')}>
      {#each ticker as line, i (i)}
        <div class:them={line.side === 1} class:quiet={line.kind === 'table'}>{line.side === null ? '' : line.side === 0 ? '$ ' : '> '}<RichText text={line.text} /></div>
      {/each}
      <div class="more">tap for full log</div>
    </button>
    {/if}

    <div class="band you">
      <Loadout entries={f.you.loadout} dense firing={firingSlot(0)} onpick={(i) => (picked = { side: 0, index: i })} />
      <Gauges
        side={f.you}
        reading={replay?.gauges?.[0] ?? (over ? replay?.live?.[0] : undefined)}
        ending={ending === 0}
        isPlayer
        compact
        mods={yourMods.length}
        modNames={yourMods.map((m) => m.name)}
        burners={burnersLeft}
        burnerNames={yourBurners.filter((b) => !b.spent).map((b) => b.name)}
        flashMods={flashSide(0)}
        onkit={() => (sheet = 'loadouts')}
      />
      {#if onburner && armable.length}
        <div class="arm-row">
          {#each armable as b (b.id)}
            <button
              class="arm"
              class:on={armed === b.id}
              aria-pressed={armed === b.id}
              title={BURNER_DEFINITIONS[b.id].text}
              onclick={() => (armed = armed === b.id ? null : b.id)}
              >⏏︎ {BURNER_DEFINITIONS[b.id].name}{b.count > 1 ? ` ×${b.count}` : ''} · {timingLabel(b.id)}{armed === b.id ? ' ✓' : ''}</button
            >
          {/each}
          <span class="arm-note">{armNote}</span>
        </div>
      {/if}
    </div>
    <!-- A steady slot for the prompt / hand / wait, so the screen above
         doesn't shift as it changes or as the hand empties (the user's
         catch, milestone 4). -->
    <div class="hand-slot">
    {#if handReady && f.phase !== 'burner'}
      <Hand hand={f.hand} legal={f.legal} count={f.count} sequence={f.sequence} phase={f.phase === 'discard' ? 'discard' : 'play'} playerIsDealer={f.playerOwnsCrib} countLimit={f.countLimit} onplay={onplay && play} ondiscard={ondiscard && discard} inactive={replay?.playing ?? false} />
    {:else}
      <div class="hand-wait">…</div>
    {/if}
    </div>
  </main>

  <aside class="panel log-panel" class:open={sheet === 'log'} use:stickToBottom>
    <button class="close" onclick={() => (sheet = 'none')} aria-label="close log">✕</button>
    <Log view={f.view} {steps} onpick={pickLog} />
  </aside>
</div>

<svelte:window onkeydown={onkey} />

{#if sheet !== 'none'}<div class="scrim" onclick={() => (sheet = 'none')} role="presentation"></div>{/if}
{#if detail}<DetailSheet entry={detail.entry} lastFire={detail.lastFire} thresholds={detail.thresholds} enemy={picked?.side === 1} onclose={() => (picked = null)} />{/if}
{#if pickedKit}<DetailSheet kit={pickedKit} onclose={() => (pickedKit = null)} />{/if}

<style>
  .screen {
    height: 100%;
    display: flex;
    justify-content: center;
  }
  .main {
    flex: 1;
    /* Let long single-line content (the ticker) clip instead of widening
       the column past the screen. */
    min-width: 0;
    max-width: 640px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    justify-content: space-between;
    padding: var(--gutter);
    padding-top: calc(var(--gutter) + env(safe-area-inset-top));
    padding-bottom: calc(var(--gutter) + env(safe-area-inset-bottom));
  }
  .band {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }
  .tag {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    border: 1px solid var(--danger);
    color: var(--danger);
  }
  .enemy-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .speed,
  .loadouts-button {
    white-space: nowrap;
    flex: none;
  }
  .loadouts-button {
    margin-left: auto;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-raised);
    font-size: 11px;
    color: var(--text-dim);
  }
  .speed {
    margin-left: auto;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--line);
    background: var(--bg-raised);
    font-size: 11px;
    color: var(--text-dim);
  }
  .speed + .loadouts-button,
  .speed.after {
    margin-left: 0;
  }
  .speed.on {
    border-color: var(--mod);
    color: var(--mod);
  }
  /* The Cribbage coach, in the ticker's place; on desktop, where the
     ticker is hidden, it still shows. */
  .coach-slot {
    display: flex;
    min-height: 132px;
  }
  .ticker {
    text-align: left;
    font-size: 10.5px;
    line-height: 1.3;
    background: var(--bg-sunken);
    border: 1px dashed var(--line);
    border-radius: var(--radius);
    padding: 5px 7px;
    color: var(--accent);
  }
  /* Always three single-line rows, so the table above doesn't shift as
     lines arrive or wrap; the full text is in the log drawer. */
  .ticker > div:not(.more) {
    height: 1.3em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ticker {
    min-height: calc(3 * 1.3em + 10px + 12px);
    overflow: hidden;
    min-width: 0;
    width: 100%;
  }
  .ticker .them {
    color: var(--danger);
  }
  .ticker .quiet {
    color: var(--text-dim);
  }
  .table-slot {
    position: relative;
    height: 104px;
  }
  .table-slot > :global(*:not(.banner):not(.slot-callout):not(.gap-toast):not(.guide)) {
    height: 100%;
    box-sizing: border-box;
  }
  .gap-toast {
    position: absolute;
    left: 50%;
    bottom: calc(100% + 9px);
    transform: translateX(-50%);
    z-index: 2;
    white-space: nowrap;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid var(--accent);
    color: var(--accent);
    font-weight: 700;
    font-size: 13px;
    pointer-events: none;
    animation: gap-toast 0.9s ease-out forwards;
  }
  .gap-toast.them {
    border-color: var(--danger);
    color: var(--danger);
  }
  .gap-toast.turn {
    letter-spacing: 0.1em;
    background: var(--accent);
    color: var(--bg);
  }
  .gap-toast.turn.them {
    background: var(--danger);
    color: var(--bg);
  }
  @keyframes gap-toast {
    0% {
      opacity: 0;
      transform: translate(-50%, 8px) scale(0.85);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, 0) scale(1.04);
    }
    70% {
      opacity: 1;
      transform: translate(-50%, -2px) scale(1);
    }
    /* A short drift: on a 320px phone the gap above the panel is ~32px. */
    100% {
      opacity: 0;
      transform: translate(-50%, -4px);
    }
  }
  .slot-callout {
    position: absolute;
    left: 50%;
    top: 8px;
    transform: translateX(-50%);
    z-index: 2;
    max-width: 92%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--bg);
    border: 1px solid var(--mod);
    color: var(--mod);
    font-weight: 700;
    font-size: 12px;
    pointer-events: none;
    animation: slot-callout 0.9s ease-out forwards;
  }
  .slot-callout.burner {
    border-color: var(--warn);
    color: var(--warn);
  }
  @keyframes slot-callout {
    0% {
      opacity: 0;
      transform: translate(-50%, 8px) scale(0.85);
    }
    15% {
      opacity: 1;
      transform: translate(-50%, 0) scale(1.05);
    }
    75% {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    100% {
      opacity: 0;
      transform: translate(-50%, -8px);
    }
  }
  .banner {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: rgb(7 10 14 / 88%);
    border: 1px solid var(--accent);
    border-radius: var(--radius);
    color: var(--accent);
    animation: banner 1.1s ease-out forwards;
    pointer-events: none;
  }
  .banner b {
    font-size: 20px;
    letter-spacing: 0.12em;
  }
  .banner span {
    font-size: 11px;
    color: var(--text-dim);
  }
  @keyframes banner {
    0% {
      opacity: 0;
      transform: scaleY(0.2);
    }
    15% {
      opacity: 1;
      transform: none;
    }
    80% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
  .arm-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-size: 11px;
  }
  .arm {
    padding: 4px 8px;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: transparent;
    color: var(--text-dim);
    font-size: 11px;
    cursor: pointer;
  }
  .arm.on {
    border-color: var(--warn);
    background: color-mix(in srgb, var(--warn) 18%, transparent);
    color: var(--warn);
  }
  .arm-note {
    color: var(--text-dim);
    font-size: 10px;
  }
  .hand-slot {
    min-height: 124px;
    flex: none;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  /* With a mouse, the hand shows the 1-6 key hints under its cards (Hand's
     own media query), 9px taller: reserve that too, or the screen shifts
     whenever the hand empties (session 63, the user's catch). */
  @media (hover: hover) and (pointer: fine) {
    .hand-slot {
      min-height: 133px;
    }
  }
  .hand-wait {
    flex: 1;
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
  }
  .more {
    color: var(--text-dim);
    font-size: 9px;
    text-align: right;
  }

  /* Phone: both panels are off-canvas drawers (log left, loadouts right). */
  .panel {
    position: fixed;
    z-index: 16;
    background: var(--bg-sunken);
    border: 1px solid var(--line);
    padding: 12px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: transform 0.18s ease;
  }
  .loadouts-panel {
    top: 0;
    right: 0;
    bottom: 0;
    width: 80%;
    transform: translateX(105%);
    padding-top: calc(12px + env(safe-area-inset-top));
  }
  .log-panel {
    top: 0;
    left: 0;
    bottom: 0;
    width: 85%;
    transform: translateX(-105%);
    padding-top: calc(12px + env(safe-area-inset-top));
    padding-bottom: calc(12px + env(safe-area-inset-bottom));
  }
  .panel.open {
    transform: none;
  }
  .close {
    align-self: flex-end;
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 15px;
  }
  .caption {
    font-size: 10px;
    color: var(--text-dim);
    letter-spacing: 0.06em;
    margin-top: 6px;
  }
  .caption.sub {
    margin-top: 2px;
  }
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 45%);
    z-index: 15;
  }

  /* Desktop: the drawers layout -- both panels always open, darker. */
  @media (min-width: 900px) {
    .panel {
      position: static;
      transform: none;
      width: 280px;
      flex: none;
      border-radius: 0;
      border-top: none;
      border-bottom: none;
      max-height: none;
    }
    .log-panel {
      width: 340px;
    }
    .close,
    .loadouts-button,
    .ticker,
    .scrim {
      display: none;
    }
    .main {
      max-width: 720px;
    }
  }
</style>
