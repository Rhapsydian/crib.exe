# Making crib.exe playable — working decision record

The first UI over the headless engine. Started session 57
(`/decision-session`, 2026-10-16), after the archetype redesign and the
class balance pass were merged into `master`.

## Shape (discovery, user)

**Milestones:**

1. **A pausable engine,** with no visible change. The engine can stop at
   a player decision and resume with the answer, while headless
   simulation stays fast and every test still passes.
2. **One playable fight:** hand, discard to the crib, pegging, the show,
   the loadout firing with a readable log, gauges, Ward and Trace, against
   one enemy.
3. **A playable run:** the map, then the reward, Shop, Merge and Event
   screens, run setup (class choice) and the end screens.
4. **Polish and playtesting,** including a **style / chrome guide** for
   Claude to follow (the user's suggestion: it needn't wait for the
   complete build).

**Platform:**

- **Desktop and mobile, both playable and enjoyable.** This is a hard
  requirement from the start, not a later port, so layout and input are
  designed for touch and small screens as well as mouse.
- **Hosting, eventually:** a custom domain pointed at the GitHub-hosted
  site, and itch.io. **For testing:** locally in a browser.

**Explaining the game:**

- **A running log the player can review** is required. It fits the
  hacking theme: a session log of what fired and why.
- **Tooltips:** what they show and how, to be designed.
- **An optional tutorial run** (a bespoke, single-layer, hard-coded
  layout that guides the player) goes on the backlog, not in these
  milestones.

## Decisions

### P1 — The engine pauses through generators ✅

The engine's main loops (pegging, the hand cycle, combat, the run)
become generator functions (`function*`). They **yield a decision
request** (for example "discard: here is the hand") and are resumed with
the answer via `.next(answer)`. Two drivers run the same engine:

- the **simulation driver** answers every request instantly from the
  existing AI strategies, so scripts, tests and balance sweeps keep their
  speed;
- the **UI driver** shows the request and resumes on the player's input.

Chosen over async/await, which resumes only on a later event-loop tick
(a several-fold slowdown across a sweep's millions of decisions) and
would spread `await` through every caller, and over a full state-machine
rewrite. A paused generator plus the log of answers given so far can
reconstruct a run, so saving stays possible later. Generators are
ES2015, supported by every current desktop and mobile browser and by
Node, and are fully typed in TypeScript (`Generator<Yield, Return,
Next>`).

### P2 — Portrait-first on phones; desktop spreads the same pieces wider ✅

- **On a phone,** the screen stacks: the opponent's loadout and gauges at
  the top, the table (pegging pile, count, crib, cut card) in the middle,
  and your loadout and hand at the bottom, under the thumb.
- **On desktop,** the same components spread wider, and the log becomes a
  permanent side panel.
- Both layouts are built from one set of components, with the phone
  layout designed first because it is the harder constraint.
- **Density is the open design problem**, to explore creatively in
  milestone 2. The user's idea: **tabs** holding different screens
  (log, loadout detail, etc.) if it doesn't all fit.

Chosen over landscape everywhere (phones rotated) and over full
designs for both orientations (about double the layout work).

### P3 — Fight-screen layout mockups before the real screen ✅

After milestone 1, and before the fight screen is wired to the engine:
2–3 phone layout variants as static, clickable pages in the dev server,
filled with a realistic fake fight state (hand, a pegging pile mid-count,
both loadouts, gauges, a log). Candidates: **tabs** (Table / Loadouts /
Log), **drawers** (one table view, loadouts and log sliding over it), and
a **compact single screen** (minimal icons and gauges, details on tap).
The user reviews each on a phone, over the home network from the dev
server, and in a desktop browser, then picks one or mixes them. Chosen
over building one layout straight onto the engine and iterating.

Order: engine refactor → layout mockups → the real fight screen.

### P4 — Turns are stepped through, piece by piece ✅

When a loadout fires, each piece lights up in turn, its effect animates
(Credit into a gauge, Ward up, Suppress pushing back), and a line goes
into the log: about ⅓ s a piece by default. There is a **speed setting**
(slow / normal / fast) and **tap to skip** to the end of the turn. Enemy
turns are shown the same way, faster by default. The UI replays the
engine's existing per-fire event record (`FireEvent`); nothing new is
needed engine-side. Chosen over instant resolution with a summary line,
and over instant-by-default with an optional replay: cause and effect,
and loadout order as a visible puzzle, are what make the design
readable.

### P5 — Cards: tap to lift, then confirm ✅

- **Discard:** tap two cards to lift them, then "Send to crib". Tapping a
  lifted card drops it back.
- **Pegging:** tap a card to lift it, which previews what it would score
  ("15 for 2"); tap it again to play. A stray tap only lifts.
- Cards that can't legally be played (they'd pass 31) are dimmed.
- **Desktop:** the same by click, plus keys 1–6 and Enter.

Chosen over drag and drop (fiddly one-handed on a small screen; can be
added later as an alternative) and over a single tap playing at once (a
mis-tap is irreversible in pegging).

### P6 — Tap anything to inspect it ✅

- **Phone:** tapping a piece (or a Mod, Burner, gauge or log line) slides
  up a **detail sheet** from the bottom; tap outside it to close.
- **Desktop:** hover shows a quick tooltip; click opens the same panel.
- **A piece's panel shows:** name, archetype, rarity; both effects in
  plain words; **live state** (charges banked, growth so far, whether its
  second effect is active now); and what it did on its last fire.
- Tapping a log line highlights the piece that caused it.
- No conflict with play: cards in hand use tap-to-lift (P5); everything
  else uses tap-to-inspect.

Wording and layout are settled in the mockups (P3). Chosen over
long-press (less discoverable, clashes with text selection and browser
menus on a phone) and over always-visible text on each piece (doesn't
fit the phone).

**The user's note:** "alpha" and "beta" are development labels and may
not be clear to players. Resolved as P7.

### P7 — Players see "Process" and "Hook" (alpha and beta stay in code) ✅

- **Process:** what a piece does every time your turn fires (the alpha).
- **Hook:** the extra effect when its condition is met (the beta). That
  can boost the Process, do something different, or fire instantly
  outside the turn.

In a panel: "**Process:** Credit 1. **Hook:** each pair you score, +1
(up to 2)." In programming, a hook is code attached to an event that
runs when the event happens, the same "when X, do Y" shape. Chosen
over Escalation (the user liked it, but Hook fits a broader range of
effects), Interrupt (it implies stopping something, and in Magic it
means responding to the opponent), Trigger, Callback and Thread. The
code keeps `alpha` and `beta`; this is display text only.

### P8 — Combat resolves live during pegging, suit tallies included ✅

Found while starting milestone 1. Today the engine plays the whole
Cribbage hand (discards, pegging, show) first, then replays its record
for combat: every suit tally for the hand up front, then each scoring
event in order, firing turns at the exact moments they were earned. So
turns land between plays in *event order*, but every pegging choice is
made against the combat state as it stood when the hand began.

The user's call: **make it live.** Each pegging play resolves in full
(its suit tally, then its scoring events, then any turns and instant
Hooks they trigger) before the next card is chosen, so the player pegs
with the current gauges and turns visible. The show still resolves item
by item after pegging, and Disrupt still lands on the next hand.

Consequences:
- **Suit tallies arrive play by play** instead of all at hand start,
  so a turn fired early in a hand sees fewer suit charges. Mostly that
  hits suit Hooks (Fuzzer).
- **Burner decisions move to mid-pegging**, at the turn they precede.
- **Simulation results shift**, so milestone 1 ends with a balance
  re-check (class victory, the gatekeeper curve, Exploit Heat).

## Milestone 1 — progress

**Checkpoint 1** (`096eca6`): pegging split into `startPegging` /
`advancePegging` / `playPeggingCard`; `playPegging` rebuilt on them,
event-for-event identical. `scripts/engine-bench.ts` times 960 real
fights; the baseline is 93 fights/s.

**Checkpoint 2:** `combatGenerator` (combat.ts) yields a `CombatRequest`
at each decision: `discard` (unless Disrupt forces it), `play`, `burner`.
It is resumed with the answer. Each request carries a read-only
`CombatView` (combat state, log, hands, hand index, dealer), which is
what the UI will draw while the player decides. Requests come for both
sides; the driver decides who answers. `playCombat` is now the
simulation driver: it answers every request from the strategies, so
every existing caller is unchanged.

- **Live resolution (P8):** His Heels resolves at the cut; each pegging
  play resolves its suit tally, then its scoring, then any turns and
  instant Hooks, before the next card is chosen; the show resolves item
  by item. A test asserts a turn fires between two plays of one hand.
- **A fight can now end mid-hand.** Its last `HandResult` is then
  partial (pegging so far, no show). The game.ts regression test checks
  that it is an exact prefix of the full hand.
- **Speed:** 90 fights/s against the 93 baseline (~3%, near the noise),
  with the fights themselves now playing out differently.
- Only one existing test needed changing (that regression test); the
  rest don't pin exact fight outcomes. Balance figures do shift, which
  is checkpoint 3's job.

**Checkpoint 3 — balance re-check:** no re-tune needed. Raw output:
`docs/calibration/live-resolution-recheck.txt`.

| class | before (balance pass) | live |
|---|---|---|
| Blackhat | 17.0% | 16.0% |
| Operator | 13.3% | 13.7% |
| Breacher | 16.0% | 16.3% |
| Eidolon | 18.7% | 18.7% |
| Warden | 14.3% | 14.3% |
| Wraith | 17.0% | 17.0% |

The gatekeeper curve is 70.2 / 64.3 / 59.2 / 52.7, unchanged. The
non-Exploit classes are identical: the only thing live resolution
changes in the simulation is *when suit tallies arrive*, and the only
suit Hook in the game is Fuzzer. Cribbage choices never depended on
combat within a hand, and turns already resolved at their exact
scoring moments. Exploit Heat endings 21–27%, inside B2's band.

**Milestone 1 is complete.**

## Milestone 2 — progress

**Layout chosen** (from the P3 mockups, the user's picks): **compact** on
phones, with the full log and the full loadouts as side drawers (log
from the left, loadouts from the right, opened by the log ticker and a
top-right button); **drawers** on desktop, with both panels always open
on a darker background. The crib isn't drawn (it is always 4 cards); a
"you deal / they deal" label stays. Piece detail opens over the log
drawer. `src/ui/FightScreen.svelte`; the mockups stay at `#mock`,
`#tabs`, `#drawers`, `#compact`.

**Wiring plan** (approved): 1. a real fight you can play; 2. turns
stepped through (P4); 3. the rest of a hand (cut, His Heels, the show
item by item, hand transitions, Cribbage lines in the log, the burner
prompt); 4. desktop keys and hover, and a phone playthrough.

- **Per-fire gauge snapshots (the user's call, option 1):** each
  `FireEvent` gains a small snapshot of both sides' gauges, so the
  step-through can move the gauges piece by piece. P4 had assumed the
  existing record was enough; it says what each piece did, not what the
  gauges read afterward. Checkpoint 2 re-runs the engine bench.

**Checkpoint 1:** `src/ui/live-fight.svelte.ts` is the UI driver: it
runs `combatGenerator`, answers the enemy's requests with the
skill-dial AI a real run uses (enemy skill, thresholds, scaling and
baseline Trace as `resolveFight` sets them, pitched at the enemy's first
layer past the opener window), and stops at the player's discard and
play requests. Each pause publishes a fresh copy of the request (the
engine mutates one state in place; new identities are what make Svelte
redraw). Burner requests auto-decline until checkpoint 3.

- A test-harness **setup screen** (pick a class and an enemy) and a
  **result panel** (breached / contained, fight again, change setup).
- The hand handles the **discard** (lift two, "Send to crib"); the
  starter shows face down until it is cut.
- `src/ui/live-fight.test.ts`: a live fight answered the way the
  simulation would answer it ends exactly as `playCombat` does (same
  winner, same fire log), for three class/enemy pairs.

**Checkpoint 2 — turns stepped through (P4):**

- **Engine:** `FireEvent.gauges` holds both sides' meters (win gauge and
  threshold, initiative and threshold, Ward, Trace) just after the fire
  resolved, recorded in `fireLoadoutOnce` and `fireImmediateBetas`
  (`readGauges`, resolve.ts). Engine bench: 97 fights/s against the 90
  baseline, so no measurable cost.
- **`src/ui/replay.svelte.ts`:** at each engine pause the screen hands it
  the log and the live gauges; it steps through the new fires: the piece
  lights up (filled in its suit colour), its log line appears, the gauges
  move to that fire's reading. 330 ms a fire for yours, 200 ms for the
  enemy's, at normal speed; the last fire holds lit one more beat.
- **Speed:** slow ×1.8 / normal / fast ×0.4, cycled by a chip in the
  header, kept in local storage (`cribexe.turnSpeed`).
- **Tap anywhere to skip** to the end of the turn ("tap to skip" shows
  while stepping); the hand can't be played until the turn is done.
- The result panel waits until the final turn has played out.
- `src/ui/replay.test.ts` covers the stepping, enemy pace, skip, and a
  new pause arriving mid-batch.
- The table (the pile, the starter) still updates at once, ahead of the
  turns; the hand flow around it is checkpoint 3.

**Checkpoint 3 split (the user's call):** after playing checkpoint 2 the
user asked for card-play animations (theirs and the enemy's), a scoring
animation, and an animated show. **3a** is pegging, animated; **3b** is
the show and hand transitions (the show records which cards make each
combination; a show panel steps through each hand and the crib; a
between-hands banner; the Burner prompt).

- **Instant Hooks are spelled out** (the user's call): the log's ⚡
  marker, which phones drew as a yellow emoji, is now "(instant Hook)";
  the detail panel's Hook reads "instant (outside the turn) · the moment
  …".

**Checkpoint 3a — pegging, animated:**

- **Engine:** `CombatBeat` (combat.ts), a timeline beside the fire log:
  a hand starting, the cut, each pegging event (play, go, go point), and
  each scoring occurrence as it lands on the scorer's initiative gauge
  (with both sides' gauges then, and the phase: cut, peg or show). Each
  beat's `firesBefore` places the fires between beats exactly. On
  `CombatView.timeline` and `CombatResult.timeline`. Bench: 87 fights/s
  with it against 84 without, on the same run (the machine was slower
  that day; no measurable cost).
- **`src/ui/timeline.ts`** merges beats and fires into one ordered list
  of steps, rebuilds the table at any step (hand, dealer, starter, the
  pile since the last reset, the count, cards left), and words each step
  for the log.
- **The replay plays steps,** not just fires; each step holds its own
  beat (your card 300 ms, theirs 500, points 600, a fire 330 / 200, the
  cut 550, a new hand 700, at normal speed).
- **Cards:** yours flies up from the hand onto the pile; theirs flips
  out of their face-down stack. **Scores:** a callout ("+ fifteen for 2",
  "− pair for 2") pops over the pile in the scorer's colour while their
  INIT gauge fills. Show scores use the same callout until 3b.
- **The log** now carries the table too: hands, the cut, each card
  played with the count, go, and every score, alongside the fires
  (`$` yours, `>` theirs).
- While the replay is still on an earlier hand, the next hand's cards
  wait ("…") instead of showing ahead of the animation.
- **The pile sweeps off after a go point or a 31** (the user's ask, so
  a fresh count is obvious): a UI-only `clear` step is placed once that
  play's scoring and any turns it bought are done, just before the next
  table beat; the cards slide off, tilt and fade (450 ms at normal
  speed), and the count reads 0 before the next card lands. A reset at
  the end of what has happened so far (the enemy took the go and it's
  your card) sweeps at once instead of waiting for your card; the last
  go of a hand sweeps before the show.
- **The count holds still:** the pile row keeps one card's height when
  empty, and the phone ticker is three fixed single-line rows.

**Checkpoint 3b — the show, hand transitions, Burners:**

- **Engine:** show scoring events carry their cards (`ShowScoreEvent`,
  `countHandEvents` / `countCribEvents`). They are derived in a separate
  pass so `countHand` / `countCrib`, which the AI calls for every
  candidate discard against every unseen starter, pay nothing: building
  them inline cost ~20% of simulation speed, the separate pass costs
  none (96-98 fights/s against 95). New beats: `show` (a hand or the
  crib laid out, with its total; its `points` beats follow, each with
  its cards) and `burner` (a Burner spent, with the gauges after).
- **Show panel** (`src/ui/ShowPanel.svelte`), in the table's place: "your
  hand" / "their crib" in the owner's colour, the four cards dealt in and
  the starter set apart, each score lifting and lighting its cards while
  the rest dim, the running count announced the way it's said at the
  table ("fifteen 2 · fifteen 4 · pair 6"); a hand that scores nothing
  says "nineteen (no score)". Show runs are named by their points (run of
  3-5, double run, double run of 4, triple run, double double run).
- **Between hands:** a "HAND 4 · you deal · your crib" banner over the
  table.
- **Burners:** before each of your turns, while you carry one, the hand
  area asks "Your turn is about to fire. Burn one?" with each Burner and
  its effect, or "not now"; a spent Burner pops a callout and a log line.
  The test-harness setup has a "carry Burners" toggle (one Flash Drive,
  one EMP Charge). The engine asks before every one of your turns while
  any remain, as designed.
- The table area is a fixed height, so the show panel and the banner
  don't move the layout; a long ticker line no longer widens the page.

**Mods and Burners on screen** (the user's ask: they were live in every
fight but shown nowhere; placement and the trigger flash both the
user's call, before checkpoint 4):

- **Chips** on each side's gauge row: `◆ n` Mods (both sides) and `⏏ n`
  Burners left (yours); tapping one opens the loadouts drawer.
- **The loadouts drawer / desktop left panel** lists THEIR MODS, YOUR
  MODS and YOUR BURNERS under the loadouts (spent Burners struck
  through); not in the piece row, which reads as firing order.
- **The detail panel** has a Mod / Burner variant: name, whose, kind
  ("Wraith class Mod", "gatekeeper Mod", "Burner · common") and its
  rules in words.
- **Rules text for the six class bridge Mods** is written now
  (`src/ui/kit.ts`, from the engine's own constants, in each owner's
  voice); the general Mods get theirs in milestone 3, when they appear as
  rewards. Gatekeeper Mods already had text.
- **The trigger flash:** every Mod that actually does something is noted
  in a fight-wide record (`CombatState.modTriggers`, a side record the
  state copies share). A trigger during a piece's fire rides on that fire
  (`FireEvent.mods`): the fire's log line gains "· ◆ Null Session" and
  the chip flashes with it. Others become `mod` beats (a bridge on
  scoring or a turn's start, Adaptation, start-of-fight Mods) with a
  "◆ your Siphon" callout over the table or the show panel. Bench: no
  cost (104 fights/s with it, 96 without, same run).
- The ⏏ glyph is forced to its text form so phones don't draw an emoji.

**Pile overflow on phones** (the user's call): six pile cards fit in a
row; a 7th lies over the 2nd and 3rd and an 8th over the 4th and 5th,
canted 8° clockwise (a count never runs past 8 cards). Desktop keeps one
row.

**Checkpoint 4 — desktop input and the phone pass:**

- **Keys (P5):** 1-6 tap the card in that position (a lifted card's
  number again plays it), Enter sends the discard or plays the lifted
  card; Space / Enter / Esc skip a turn that's playing out (a skipping
  Enter never also plays a card); Esc closes the detail panel or a
  drawer; at the Burner prompt 1-n burn and Esc keeps them. Key hints
  show under the cards and on the Burner buttons only with a keyboard
  and a mouse (`hover: hover` and `pointer: fine`).
- **Hover tips (P6), desktop only** (`src/ui/tip.ts`, one shared tip):
  a piece in brief (name, Process, Hook, in its owner's voice), each
  Mod and Burner, the Breach / Containment and Initiative meters, Ward,
  Trace, and the Mod / Burner chips. A click still opens the full panel.
- **Numbers:** quarter values show exactly (Fuzzer's +0.75 Trace, no
  longer "+0.8"); other fractions, scaled enemy values, to one decimal.
- **Phone pass in the preview:** no sideways or vertical scrolling at
  320×568, 360×740, 375×667 and 375×812. The 320-wide case needed two
  fixes: the hand shrinks a little (six full cards need 342px), and the
  header keeps its buttons on one line, the enemy's name shortening
  with "…".
- The real-phone playthrough is the user's (the preview can't stand in
  for a thumb on glass).
- **Both sides read the same way** (the user's call): subroutine
  badges, then the meters, then the information badges (Ward, Trace,
  Mods, Burners) on their own line. The enemy's badges used to sit below
  its meters, and a short badge row could ride the meter line.
- **Show scores get a toast** (the user's ask), like pegging's, in the
  scorer's colour, floated in the gap above the show panel so it covers
  neither the panel nor the enemy's section (it fits the ~32px gap on a
  320px phone).
- **The result panel sums the points each side scored** (the user's
  ask): pegging, hands, crib, his heels and the total that fed
  initiative, counted from the timeline's scoring beats
  (`pointsSummary`), so a show cut short by the fight's end counts only
  what was actually scored.

## Settled in passing (Claude's calls, noted for the record)

- **Milestone 1 converts the combat loops first** (pegging, the hand
  cycle, combat), since milestone 2 needs only a fight. The run loop
  (map moves, rewards, Shop, Merge, Events) is converted at the start of
  milestone 3.
- **UI work happens on a new branch, `playable`**, off `master`, the
  same pattern as `archetype-redesign`.
- **Settings** (turn-step speed, etc.) persist in the browser's local
  storage. No accounts or server.
- **Running-log content and granularity**, and the panel wording, are
  settled in the mockups (P3).

## Backlog items raised here

- An optional **tutorial run**: a bespoke, single-layer, hard-coded
  layout that guides the player.
- The **style / chrome guide** (milestone 4).
- Drag and drop as an alternative card input, if playtesting wants it.
- Hosting: a custom domain pointed at the GitHub-hosted site, and itch.io.

## Open

None. The plan is ready to execute, starting with milestone 1.
