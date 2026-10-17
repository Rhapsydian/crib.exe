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
- **A toast for every turn** (the user's ask), either side, in pegging
  and the show: "▶ YOUR TURN" filled green, "▶ THEIR TURN" filled red,
  in the same gap above the table as the show toasts (pegging's score
  callout sits over the pile, so the two never meet). The engine records
  a `turn` beat at each turn's start, ahead of its Burner offer and its
  fires; the log gains "▶ your turn" lines. Bench: no cost.

## Milestone 3 — a playable run (started session 58)

**Proposed checkpoints:** 1. the run loop as a pausable generator
(combat nested inside; the simulation byte-identical); 2. class choice,
the map, fights and end screens; 3. rewards and loadout management;
4. Safehouse, Shop and Event screens, map Burners; 5. save and resume, a
phone pass.

- **M1 — the map shows only the current layer** (the user's call): a
  passed gatekeeper is one-way, so earlier layers aren't drawn. This
  replaces DESIGN.md's "all layers render as one continuous, growing
  diagram".
- **Map layout: mockups first** (the user's call), at `#map`, over real
  generated layers (`src/ui/mockups/map/`): *layered* (rows by hops from
  the entry, gatekeeper on top, row links bowed into arcs), *force* (a
  seeded spring layout, entry and gatekeeper pinned), *schematic* (the
  layered rows on a grid, right-angle traces, one lane per link). Tap a
  linked node to walk.
- **M2 — the bench is the inactive storage, capped at 3** (the user's
  call). The engine's bench was unlimited; with a cap, a new piece
  arriving to a full loadout and a full bench means choosing one to drop
  (the new piece included, i.e. turning the reward down). Pieces swap
  between loadout and bench any time outside a fight; duplicates still
  become Merge material without taking a slot. The simulated player gets
  the same choice, and the class victory check is re-run once.
- **Map generation is up for redesign** (the user: "a bit of a mess").
  Measured over 500 layers a size, today's generator (a random tree plus
  ~n/2 links between any two nodes) averages ~2.9 links a node with hubs
  of up to 9, and the gatekeeper sits 1.5-1.8 moves from the entry --
  **one move away in 37-52% of layers**, which all but removes the
  beeline-or-explore tension. The user asked for mockups of three
  directions, plus a hex-grid option, all at `#map`
  (`src/ui/mockups/map/gen.ts`), each placing nodes first and linking
  only near neighbours so the map draws itself:
  - *scatter* (even spacing, non-crossing near-neighbour links);
  - *subnets* (clusters of 2-4; each boundary crossed through a router
    relay plus one direct link);
  - *hybrid* (scatter's spacing and links, in regions with two links
    between neighbouring regions);
  - *hex* on each: scatter and hybrid build on two non-crossing lanes
    from entry to gatekeeper, links only between neighbouring cells
    (hybrid: each hex row a subnet, the lanes the only links between
    rows); subnets snap to the grid.

  Over 300 maps per size all six pass the resilience rule. Entry to
  gatekeeper: scatter 2.9-3.7 moves, subnets 3.5-5.0, hybrid 3.2-4.8;
  hex 3 (8 nodes) or 4 (10-12), fixed by the row count. Busiest node:
  4 (subnets, hybrid), 5-7 (scatter). Any of them lengthens the walk,
  so the Heat economy and gatekeeper curve need a re-check after.
- **M3 — scatter, free, is the user's pick so far;** subnets dropped
  ("they just add noise to the map and don't have any functional
  purpose"). Free scatter does not snap to a grid; a *snapped* toggle
  (the free scatter moved to the nearest hex cell, then linked from the
  snapped positions) was added for comparison: same 3-4 moves, but
  denser (up to 8 links on a node, more short options once nodes line
  up).
- **Scatter, free, confirmed for refinement** (the user's call); the
  other generators, the snapped toggle and the old layout styles are
  removed from the mockup. A faint hex grid sits behind the map.
- **Nodes centre on the backdrop's hexes** (the user's call): the
  generator nudges each node to its nearest free hex before linking, so
  links come from the drawn positions and still never cross. The grid is
  defined once (`VIEW`, `backdropCells` in gen.ts) and shared with the
  screen. Same character as free scatter: 2.9-3.7 moves to the
  gatekeeper, ~3 links a node, all resilient (300 maps a size).
- **A longer climb, nothing behind the gatekeeper** (the user's calls):
  links longer than 1.35x the typical gap between neighbours are
  dropped (long links were the shortcuts), the entry keeps its three
  nearest links and the gatekeeper exactly its two nearest, and the
  entry and gatekeeper are never linked. A layer is rejected if any node
  is reachable only through the gatekeeper (breaching it moves you on,
  so that node could never be used). Moves to the gatekeeper: 8 nodes
  3.1 (was 2.9), 10 nodes 3.8 (3.4), 12 nodes 4.3 (3.7); ~2.8 links a
  node; all resilient, none behind the gatekeeper (300 maps a size).
- **M4 — no layer under 10 nodes** (the user's call: 8-node layers read
  as too sparse); the mockup offers 10, 12 and 14.
- **M5 — layer sizes 10 / 12 / 12 / 14** (the user's call, was
  10 / 12 / 12 / 8): the run climbs toward a bigger final layer.
  Measured climbs: 10 nodes 3.8 moves, 12 nodes 4.3, 14 nodes 5.0. Lands
  with the new generator; Heat is re-evaluated then ("we were going to
  have to do that anyway").
- **M6 — an empty relay is never a dead end** (the user's rule: a
  passage to nowhere is a vestigial place no one would walk to). Every
  relay but the entry has at least two links; one left with fewer gets
  its shortest unused link, else the layer is regenerated. Over 300
  layers a size: 807 relays, none a dead end.
- **M7 — node types are dealt, not rolled** (the user's call). Rolling
  each node independently (fight 40%, elite 15%, Safehouse 15%, Shop,
  Event, relay 10% each) left 28-43% of layers with no Shop, as many with
  no Event, and up to 26% of 14-node layers with 3+ elites. Each layer
  now gets a set core plus flex slots (fight / elite / Event / relay):

  | layer (nodes) | fights | elites | Safehouse | Shop | Event | flex |
  |---|---|---|---|---|---|---|
  | 1 (10) | 3 | 1 | 1 | 1 | 1 | 1 |
  | 2 (12) | 4 | 1 | 1 | 1 | 1 | 2 |
  | 3 (12) | 3 | 2 | 1 | 1 | 1 | 2 |
  | 4 (14) | 4 | 2 | 2 | 1 | 1 | 2 |

  Placement rules: no elite next to the entry; a Safehouse within two
  moves of the gatekeeper; two of the same special node never adjacent.
- **M8 — a Cache node** (the user's idea): a chance per layer of a
  remote dead end holding a free reward, its risk the extra Heat of the
  detour and walking back.
  - **Contents** (the user's call): randomly one of an elite-tier
    subroutine pick (one of three, as an elite win offers), a bundle of
    Data plus 1-2 Burners, or -- rarely, later layers only -- a Mod.
    Starting odds (Claude's, to tune): layers 1-2 60 / 40 / 0, layers 3-4
    55 / 40 / 5.
  - **Frequency and placement** (the user's call, Claude's proposal): an
    extra node on top of the layer's 10/12/12/14, at 35% on layer 1 and
    50% on layers 2-4 (~2 a run); a dead end hung off the node farthest
    from the shortest entry-to-gatekeeper route (so always a detour of 2+
    moves out and back), never off the entry or gatekeeper; visible from
    the start, with its own symbol.
- **Built into the mockup** (`layerMap` in `gen.ts`; `#map` now picks a
  layer, L1-L4, and can force a Cache for review). Types are dealt after
  linking, so a relay simply goes only where it has 2+ links. Over 300
  layers each, every rule holds on every map: resilient, nothing behind
  the gatekeeper, no elite beside the entry, a Safehouse within two
  moves of the gatekeeper, no matching specials adjacent, no dead-end
  relay. Caches: 32 / 53 / 44 / 50% of layers (targets 35 / 50 / 50 /
  50), always a true dead end, always 2+ moves off the shortest route
  (2.6-3.2 on average, each way); when the farthest node has no room,
  the next farthest takes it. Climbs: 3.8 / 4.4 / 4.3 / 5.0 moves.
- **M9 — no two nodes on neighbouring hexes** (the user's call, after a
  Safehouse and an elite touched): snapping skips any hex next to one
  already taken, and the Cache obeys the same spacing. Over 300 layers
  each: no adjacent pairs, the closest pair one empty hex apart; climbs,
  Cache rates and resilience unchanged.

**Checkpoint 1, part 1 — the run as a pausable engine:**
`src/engine/run-requests.ts` defines `RunRequest`: every decision the run
used to hand a strategy (map Burner, move, the player's own fight
decisions, Safehouse Rest/Merge and Merge target, shop Burner, the three
rerolls and purchases, Event choice, the three reward picks, loadout
order) is yielded, and the run resumes with the answer. Each request
carries `fallback`, the exact strategy call made before, so
`driveWithFallbacks` (now behind `playRun` and `resolveEncounter`, both
unchanged for their 100+ callers) reproduces the old runs. Inside a
fight only the player's requests surface; the enemy's are answered in the
engine (`fightRequests`). Proof: 1,200 runs (6 classes x 100 seeds, the
default profile and the synergy-aware one with skill 0.85) fingerprinted
before and after: 0 differ, same speed (39.2 s / 39.5 s).
`run-requests.test.ts` checks every decision kind appears, no enemy
request surfaces, and a driver's own answer steers the run.

**Checkpoint 1, part 2 — the new map generator in the engine:**
`map-gen.ts` is rebuilt from the mockup (scatter on the hex backdrop,
non-crossing near-neighbour links, resilience, nothing behind the
gatekeeper, dealt types under the placement rules, the Cache); node
positions are stored on `MapNode` (`x`, `y`), so the screen draws what
was generated. `NodeType` gains `cache`; its encounter rolls an elite-tier
subroutine pick, a bundle (an elite win's Data + 1-2 Burners,
`cacheBurners`), or on layers 3-4 a Mod pick. Layer sizes 10/12/12/14.
A caller that forces type weights, or a non-standard size, still rolls
by weight; layers too small for the rules (the tests' 2-8 node layers)
get a relaxed pass. The simulated player's opportunistic routing takes a
Cache right after fights when the detour fits its Heat reserve. The
`#map` mockup now draws the engine's generator; its prototype is gone.

**Checkpoint 1, part 3 — the bench capped at 3:** `BENCH_CAP` (loadout.ts);
after any acquisition (a reward, a Shop purchase, an Event grant) a bench
over its cap raises a `drop` request; the simulated player drops the
acquisition ladder's weakest bench piece (`weakestOnBench`). A dropped
piece's Merge material stays banked by id. `RunOptions.benchCap`
(Infinity restores the old unlimited bench). Tests: the bench never ends
a run above 3, drops are asked, a driver's named piece is the one
dropped.

**Checkpoint 1, part 4 — the two-lever Heat pass** (the user's call, run
while they were away; raw numbers in `docs/calibration/m3-two-lever.txt`):

- On the new maps at the old allowances, victory fell to 1-7% and
  Heat-maxed endings rose from ~2% to 13-22%: fight Trace is 58-73% of
  Heat, and every layer now deals more fights to win.
- **Lever 1, layer allowances 40/36/32/28 -> 76/68/61/53 (x1.9):** swept
  x1.6 / x1.75 / x1.9 at 300 runs a class; x1.9 restores the shape of
  Heat endings (Exploit 18-28% maxed or caught, the rest ~10%).
- **Lever 2, gatekeepers re-tuned to 70.5 / 64.5 / 58.5 / 52.5:** three
  rounds of gatekeeper-check.ts; final scales Firewall Prime 0.96, The
  Concierge 1.45, Quarantine Ward 1.6, Zero-Sum 1.48, Adaptive Threat
  2.19, Total Compromise 2.1, Null Session 2.17, Root Authority 1.74; all
  within 0.9 points of target (curve 70.2 / 64.2 / 58.1 / 52.3).
- **Class spread** (300 runs a class): Blackhat 18.7%, Operator 11.0%,
  Eidolon 19.0%, Breacher 14.3%, Warden 11.7%, Wraith 22.7% (20.7% at
  600 runs). Wraith was over the band, so per B3 (strong classes come
  down through their bridge first) **Siphon went 0.75 -> 0.5 Ward a
  turn**; that moved it ~1.6 points and softened Zero-Sum, which shares
  the bridge and was re-tuned. Wraith ends at ~21%, at the band's edge
  -- a decision left for the user (see below).
- One test assumed old absolute Heat costs (a high-Heat detour) and now
  derives its Heat from the costs themselves.

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
