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
- **Wraith left at ~21%** (the user's call: "we can do further tuning
  later").

**Checkpoint 2 — a run you can play** (class choice, the map, fights, the
end):

- **Engine:** two notices in the run, `fightStart` (the enemy, tier,
  layer) and `fightEnd` (the full CombatResult) -- nothing to decide,
  no-op fallbacks, so simulations are unchanged.
- **`src/ui/live-run.svelte.ts`:** the run's UI driver. The player
  answers map moves and their own fight decisions; every other decision
  (rewards, Safehouse, Shop, Event, Cache contents' picks, loadout order,
  drops, Burners outside fights) is answered for now by the
  synergy-aware strategies, and each is noted ("took Tarpit (subroutine
  reward)") until checkpoints 3-4 give them screens.
- **Class choice** (`ClassSelect.svelte`): six cards (suits, class Mod and
  its rules, starting pieces); "test a single fight" goes to `#test`.
- **The map** (`RunMap.svelte` over a shared `MapView.svelte`): layer,
  class, Heat against the layer's allowance, Data, Mods, Burners; tap a
  linked node for its card (what it is, what it gives, "Move here · +2
  Heat"), tap again or Move to go; cleared nodes dim, closed ones are
  struck through; a loadout drawer (loadout, bench 0-3, Mods); the last
  auto-decided notes. A banner opens each layer.
- **Fights** reuse the fight screen through a `FightSession` interface
  (the test fight and run fights both provide it); the result panel says
  "continue".
- **The end** (`RunEnd.svelte`): ROOT ACCESS / QUARANTINED / TRACED /
  BREACHED, THEN CAUGHT / NO ROUTE, layers breached, fights won, the
  final loadout, "new contract".
- **Found and fixed:** a Burner prompt with two of the same Burner (they
  stack) keyed its buttons by id and broke the screen; it now shows each
  kind once with a count.
- `window.__run` exposes the live run in development builds only, for
  driving a run from the console.
- Verified in the preview at phone size: a full run played on screen
  through three layer banners to the end screen; `live-run.test.ts`
  plays whole runs through the driver and reaches layer 2.

### Checkpoint 3 — rewards and loadout management

- **Reward screens** (`RewardScreen.svelte`): after a win, one screen per
  reward -- subroutine, Mod (elite and gatekeeper wins), Burner -- with
  the Data the encounter paid on the first. Each option shows its rules
  in words; a piece says where it lands (installs, goes to the bench,
  becomes Merge material, or forces a drop). Tap to select, take, or
  skip.
- **A person's picks are never swapped in for them**: a new piece
  installs if there's room, otherwise waits on the bench (`LiveRun` runs
  with plain `acquireSubroutine`, not the simulated player's swap-out),
  and the after-encounter reorder keeps the player's order.
- **The loadout drawer edits** (`LoadoutEditor.svelte`, M2: any time
  outside a fight): tap a piece to read it, move it up or down, bench or
  install it, or tap a piece on the other side to swap them. Each change
  answers the map's move pause with a `LoadoutArrangement`; the engine
  checks it (`arrangeLoadout`: the owned pieces exactly, caps kept,
  Mod-granted pieces stay installed) and asks the move again. The drawer
  also lists Mods and Burners with their rules.
- **A full bench** (`DropScreen.svelte`): drop any piece, the new one
  marked; dropping an installed piece puts the new one in its slot
  (`replaceInstalledWithNewest`).
- **Rules text for the 31 general Mods** (`kit.ts` `MOD_TEXT`,
  `modText`), written from the code. Noticed along the way: Static
  Shield (-2 from each plain Credit the opponent gains) may be strong;
  Black Budget redraws the piece choice rare-weighted rather than
  upgrading it a tier as its comment says; Salvage Protocol and Fast
  Learner have no archetype gate, so classes without Daemon/Overclock
  pieces can be offered dead picks; Surge Protector is spent even when
  Static Shield already zeroed that Credit.
- **The user's follow-ups:** Static Shield set aside (`MODS_SET_ASIDE`:
  defined, never offered); Salvage Protocol gated on Daemon and Fast
  Learner on Overclock (their `archetype`), so only classes that can use
  them see them; Recon Ping set aside (`BURNERS_SET_ASIDE`) -- no fog of
  war for now, it returns if fog of war does. Every reward screen can be
  skipped. **A Burner arriving at the carry cap can be swapped in**
  (`BurnerSwapScreen.svelte`; a `burnerSwap` request from rewards, Shop
  buys, Event grants and Caches): swap out a carried one, or keep yours.
  The simulated player keeps its own, so simulations are unchanged.
- Verified in the preview at phone size: subroutine, Burner and Mod
  reward screens; reorder, bench and swap in the drawer (checked against
  the engine's state); a drop that turned out an installed piece.

### Checkpoint 4 — Safehouse, Shop, Event and Cache screens; map Burners

- **The Shop is one visit, bought freely** (the user's call): all three
  slates on one screen; buy any offering you can afford, each once;
  reroll each slate once; leave. In the engine the visit is a loop of
  `shop` requests (`ShopVisit` / `ShopAction`), replacing the old fixed
  sequence of `shopReroll` and `shopBuy` asks; purchases are lists
  (`shopPurchases`, `modShopPurchases`, `burnerShopPurchases`). The
  simulated player's answers (`shopFallback`) replay its old sequence --
  three reroll decisions, then at most one buy per slate -- but all three
  slates are now drawn up front, so the RNG order changed and seeds see
  different slates. Shop Burners are offered on entry
  (`ShopBurnerScreen`), as before.
- **Safehouse** (`SafehouseScreen`): Rest (Heat before → after) or Merge,
  listing each piece with banked material and the line(s) one rank
  changes; the Merge target the run asks next is taken from that pick.
- **Event** (`EventScreen`): the choices with what each can do -- a sure
  choice in full, a risky one with its odds, a gamble as unknown -- then
  a notice of what happened (`eventResult`, before any bonus fight).
  The event request now carries its layer, to price Heat.
- **Cache**: a notice of what it held (`cacheOpened`); a piece or Mod
  choice follows on the reward screen.
- **Map Burners from the map** (a `MapBurnerUse` answer to the move
  pause): Ghost Protocol from the card ("next move free", and the move
  shows as free); Skeleton Key by tapping a closed node. The pre-move
  `mapBurner` ask is answered "no" for a person, except when the
  gatekeeper is cut off -- the run would end before the map -- when the
  simulated player's rescue is used and noted.
- **Found along the way:** the Dead Man's Switch Event granted Static
  Shield by name, past the set-aside -- now Surge Protector, with a test
  that no Event names a set-aside item. The Shop Burner texts were wrong
  (they work on the whole visit; Insider Tip makes each slate's wildcard
  rare, not every offering) -- fixed.
- `LiveRun` now answers nothing for the player by strategy: every
  request kind has its own handling (an exhaustive switch).
- Verified in the preview at phone size: the Shop (two buys, a reroll,
  leaving -- the pieces and Merge material landed), a Merge at a
  Safehouse, an Event and its outcome, a Cache bundle, Ghost Protocol
  from the map, the Shop Burner prompt. Skeleton Key's reopen was checked
  by tests only (no closed node came up in the preview runs).

### Checkpoint 5 — save and resume; the phone pass

- **A save is the run's answers** (`run-save.ts`): a run is a
  deterministic function of class, seed and the player's answers, so a
  save stores those (by id -- a piece id, a choice id, a card's rank and
  suit) and resuming replays them into a fresh run, landing exactly where
  it was, mid-fight included. Written to this browser's localStorage after
  every answer (wrapped: blocked storage just means unsaved), cleared when
  the run ends. The class screen offers "resume run · class · layer".
- **Trade-off:** a save doesn't survive a game update that changes rules
  or content -- a stored answer stops fitting its request, the replay
  refuses it, and the class screen says so and offers a new run.
- **Found while testing:** a request's context is a copy that still shares
  the engine's AI-noise generator (its state lives in a closure). The UI
  never draws from it, so saves are safe; tests that drive fights with the
  AI now give it its own generator.
- **Phone pass:** every run screen checked at 320px wide (a small phone)
  -- no sideways scrolling anywhere; the map's nodes all on screen; the
  fight screen's six cards fit; the end screen fits.
- Verified in the preview: a run played to mid-fight, the page reloaded,
  resumed -- the same hand, count and answer count; the save cleared at
  the run's end.
- **Balance note (found this checkpoint):** victory fell after the
  set-aside commit (`f0aa007`) -- Blackhat 23 -> 15%, Wraith 26 -> 18%,
  Warden 13 -> 7% -- measured at the commits either side of the Shop
  change, which itself moved nothing. Static Shield, overtuned, was
  carrying the simulated player, and the gatekeepers were tuned with it in
  the pool. **Re-tuned** (the user's call): the curve had fallen to
  67.7 / 60.4 / 46.0 / 33.3; the eight gatekeeper scales were cut (Null
  Session 2.14 -> 1.68, Root Authority 1.74 -> 1.37 the largest) and now
  sit within 0.5 of every target. Victory 16.3-26.0% (Warden low, Breacher
  and Wraith high). `docs/calibration/m3-static-shield-retune.txt`.

### Detour: Trace removed (session 58, the user's call)

Exploit's Trace was the hard lever: a noisy piece's cost showed up as
run-end Heat deaths, far from the choice. The user's replacement:

- **Fights post Heat directly.** A fight costs its baseline, plus Heat
  per % of Containment at the end; a loss costs the baseline plus 150%
  of the full Containment term (the user's example: 5, +6 at 60%, +15 on
  a loss). Today's loss multiplied the baseline too; now it doesn't.
- **Noisy pieces feed the opponent's gauge.** Fuzzer's and Jackpot's
  riders (`feed`) add straight to the opponent's win gauge -- your
  Containment, or an enemy's Breach if it carries one. The +1 Credit
  premium stays; the feed is priced so the piece duels back at its
  rarity band (`scripts/feed-price.ts`): **Fuzzer 1.75, Jackpot 2.5**.
- **Alarms add Heat directly.** Tripwire, Intrusion Alarm, Total
  Compromise and the Spotlight Mod (`heatPressure`), win or lose.
- Heat sources are now: moves, fights, Events, alarms.
- **Retune:** allowances held (76/68/61/53) -- Heat endings fell to 5-9%
  for every class. The gatekeepers slipped 1-6 points (the Exploit kits
  pay their feed in-fight now) and were re-tuned within 0.7 of the
  curve. Victory 12.7-25.7% (Warden low, Wraith high).
  `docs/calibration/m3-trace-removal.txt`.
- **On screen:** a noisy piece reads "...and also gives the opponent 1¾";
  an enemy's alarm piece shows an Alarm line; a ▲ chip on your gauges
  shows Heat its alarms raised this fight.
- Tools: `trace-price.ts` retired; `scripts/run-outcomes.ts` is the
  full-run outcome report.

## Milestone 4 — vanilla Cribbage and learning to play (planned session 58)

Plain 2-player Cribbage to 121 at several difficulties, with a "Learn to
play" mode, built before the roguelite polish so testers learn the card
game the combat rests on (the user's call). Decisions, live:

- **V1 — Learn to play is short lessons, then coached games** (the
  user's call). Four or five lessons on set-up deals (the goal and the
  deal; counting fifteens, pairs and runs; pegging to 31 and "go"; the
  show and the crib; choosing a discard), then real games against an easy
  opponent with a coach that explains each phase, compares your discard
  with its own, and walks through each count.
- **V2 — four difficulty levels** (the user's call): Learn to play (AI
  skill ~0.3, coach on), Easy (~0.4; tuned to 0.6), Normal (~0.75), Hard (1.0). The
  opponent's skill and the coach's help are separate dials. Exact skill
  values are tuned at build time with a skill-vs-skill check, so each step
  is a noticeable step.
- **V3 — the coach is a toggle at every level** (the user's call): on in
  Learn to play, off by default elsewhere.
- **V4 — the game counts every hand, at every level** (the user's call).
  Counting your own hand, and muggins, is a long-term backlog idea the
  user may never add.
- **V5 — a main menu as the front door, with a nudge and no gating**
  (the user's call): Learn to play (lessons, replayable, ticked off as
  done; then a coached game), Play Cribbage (difficulty and coach toggle),
  and the crib.exe run (with its resume). A first visit highlights Learn
  to play ("new to Cribbage? start here"); nothing is locked.
- **V6 — a pegboard, mocked up first** (the user's call; plain score bars
  stay in the running): a straight two-track strip, a folded "street"
  board and a minimal bar with peg markers, in the game's terminal style,
  with the skunk line (91) and 121 marked and the back peg leapfrogging.
- **Checkpoints** (approved): 1. the game engine to 121 (pausable,
  skunks) and a difficulty calibration script; 2. pegboard mockups; 3.
  Play Cribbage -- the main menu, difficulty and coach picker, the game
  screen, the pegboard, an end screen, saves; 4. the coach; 5. Learn to
  play -- lessons, progress, the coached game, the first-visit nudge, a
  phone pass.
- Smaller calls (Claude's): the end screen names a skunk (loser under
  91) or double skunk (under 61), no match scoring; vanilla games save as
  a replay of answers, like runs; lessons are authored as data; the
  coach's on-screen form is designed in its checkpoint.
- **Checkpoint 1 done:** `basic-cribbage.ts` gains `cribbageGame`, the
  game a person plays -- paused at every discard and pegging card for both
  sides, ending the instant someone reaches 121 (after His Heels, any
  pegging event, or a show item; the show in order), with a timeline for
  the UI and the skunk -- and `playCribbageGame`, its simulation driver.
  The session-39 `playBasicCribbageGame` (whole hands scored at once)
  stays as it was: skill-retention and two diagnostics measure with it.
  **Difficulty tuned** (`scripts/cribbage-difficulty.ts`): the dial is
  steep low down (0.4 played much like 0.3), so Easy moved 0.4 -> 0.6;
  the ladder is now even -- a competent player wins 94 / 75 / 58 / 43%,
  each level beats the one below 66-76%
  (`docs/calibration/m4-cribbage-difficulty.txt`).
- **V7 — the score is shown as minimal bars (mockup C)** (the user's
  call, from `#pegboard`): two progress bars with each player's back peg
  as a ghost tick and the skunk lines (61, 91) dashed, matching combat's
  gauges. The strip (A) and street board (B) stay in the mockup.
- **Checkpoint 3 done -- Play Cribbage.**
  - **A main menu** is the front door (`MainMenu.svelte`): Learn to play
    (for now it deals a Learn-to-play game; lessons come in checkpoint
    5), Play Cribbage (its setup opens in place: the four levels and the
    coach toggle, which defaults per level), and the crib.exe run (the
    class screen gains a "menu" link back). A first visit highlights Learn
    to play; choosing any mode clears the nudge. Each mode shows its
    resume.
  - **The game screen** (`CribbageScreen.svelte`) reuses the fight
    screen's machinery: the game's timeline is translated into fight
    beats (`cribbage-steps.ts`), so the replay stepper, table, show panel,
    callouts, hand banners and log lines work unchanged, and a score is a
    gauge filling to 121, which the replay animates into the bars
    (`ScoreBars.svelte`, V7, the back peg a ghost tick). A full log
    drawer, speed, skip, desktop keys.
  - **The end panel**: win or lose, the score, hands, level, any skunk,
    and the points by pegging / hands / crib / His Heels; play again or
    back to the menu.
  - **Saves** like a run's (`live-cribbage.svelte.ts`): answers replayed
    from the seed; resumable from the menu; cleared at the end.
  - Verified in the preview: the menu and setup; a discard and the
    opponent's lead by real taps; a game driven to the end panel; a save
    resumed after a reload; no overflow at 320px. (The screenshot tool
    clipped this session's captures, so layout was checked by measuring
    the page.)
- **Checkpoint 4 done -- the coach** (`coach.ts`, `CoachPanel.svelte`).
  Its on-screen form (Claude's call, for the user's review): a panel in
  the log ticker's place while the coach is on (the full log one tap
  away), a "◈ coach" pill in the game's header to switch it mid-game.
  What it says, at each of your decisions:
  - at a discard: what discarding is for (fuller the first hand) and
    whose crib it is; from the second hand, last hand's count walked
    through ("Their hand: 3 fifteens for 6, a run for 3 = 9"), and after
    the first show, what the show is;
  - at a pegging card: a hint -- take an immediate score ("Play 5:
    fifteen for 2"), else avoid leaving 5 or 21 (a ten-card makes 15 or
    31), and lead under 5 -- then a review of your discard beside its own
    ("You kept 4 K 8 A (a fifteen), about 4.2 with the cut. I'd keep 4 3 3
    8 (2 fifteens, a pair of 3s), about 8.7, and throw K A into your
    crib") and what pegging is.
  The coach's own choices are the AI's at full strength; averages are
  over every possible cut. Verified in the preview with real taps (a
  deliberately weak discard drew the review above); fits at 320px.
- **Checkpoint 4 follow-ups (the user's review):**
  - **No more layout shift:** the hand sits in a fixed-height slot on
    both the Cribbage and fight screens, so an empty hand or the wait
    doesn't move anything above it (measured: one position through
    twelve decisions).
  - **Titled coach sections:** NOW, then YOUR LAST PLAY / YOUR DISCARD,
    LAST HAND'S COUNT, and HOW IT WORKS (first time only), so last hand's
    count is never read as current advice.
  - **Past tense** for reviews ("I would have kept ... and thrown ...").
  - **Pegging review** after each of your plays: what it scored and any
    easy score it handed over, beside the coach's own pick ("You played
    6 (no score; it left them a 15 off your lead with a 9). I would have
    played 4 (no score)."). The coach's pick follows its own advice (most
    points, then no easy score for them; the AI breaks ties), so the
    hint and the review never disagree.
  - **Pegging judged properly** (the user caught "Good play" on bad
    plays): every play is now valued as the points it scores less the
    opponent's expected best reply, over every card they could still
    hold (the deck less your hand, the cut and the cards played; more
    cards left, more likely they hold the scorer). "Good play" only when
    yours is within a whisker of the best; otherwise the coach names its
    pick and the threat ("then any 4 would give them fifteen for 2";
    "any ten-card (10, J, Q, K)"). The NOW hint uses the same judgement.
  - **Discards get a suggestion first**, like pegging (the user caught the
    inconsistency): "Keep 9 6 9 6 (4 fifteens, two pairs), about 12.8 with
    the cut. Throw 2 3 into your crib." A discard within a whisker of the
    coach's counts as good in the review.
  - **A suggestions switch** (the user's call): with it off, the coach
    still explains each phase and reviews your discards and plays, but
    doesn't suggest first. In the setup under the coach, and in the coach
    panel's header mid-game; saved with the game.
- Rules note (Claude's call): a game ends the instant a player reaches
  121, mid-pegging included; the show counts non-dealer, dealer, crib, in
  that order, which decides close games.

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
