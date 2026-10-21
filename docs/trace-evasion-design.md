# Trace evasion (session 63)

**Status: designed, not built.** The user's idea, decided live in session
63. `scripts/evasion-check.ts` holds the measurements below.

## The problem

*Breached, then caught* (recalibration R8) ends a run in the moment of
winning its hardest fight: you beat the gatekeeper, its Heat toll (charged
after the fight, bigger the closer it came to containing you) takes you
past the layer's limit, and the run is over. The user, after being caught
this way: "a bit unsatisfying." Session 63 made the toll visible (posted on
the map card; the fight's Heat bar shows what a win now would cost). This
note turns the ending itself into a last chance.

## The rule

When you **beat a gatekeeper and its toll maxes your Heat**, and only
then, the run doesn't end at once. The gatekeeper tries to trace you, and you
play a **trace evasion**: a short game of plain Cribbage. No subroutines,
Mods, Burners or initiative.

- **TE1. Head start, from the fight:** the gatekeeper starts **1 point
  ahead for every 10% of Containment it had** when you beat it, rounded
  down. For example, 52% gives a 5-point lead. You won, so its Containment
  was under 100% and the lead is 0-9. (The user's call over a lead equal to
  the Heat overage, which could be unbounded and turn the evasion into "a
  painful lost cause".) It follows the toll: a closer fight means a bigger
  toll, a likelier evasion and a bigger lead.
- **TE2. Three hands, and you deal twice** (the 1st and 3rd hands, so two
  cribs to its one). The dealer's edge is the runner's compensation for the
  head start, and three hands keeps the evasion short. (Chosen over four
  even hands. On the numbers below, four hands made a weak player's escape
  rare.)
- **TE3. Finish strictly ahead to escape.** A tie goes to the network.
- **TE4. Escape:** the breach stands, Heat resets for the next layer as
  after any breach, and the run goes on. Escaping the **layer-4**
  gatekeeper wins the run.
- **TE5. Fail:** the run ends as *breached, then caught*, as now, but
  only after you lost the evasion.
- **TE6. Every time it triggers,** with no once-per-run limit (the user's
  call). The head start already scales with how close the fight was.
- **TE7. The gatekeeper plays at its own Cribbage skill** (enemySkill for
  its tier and layer), so evading Root Authority is harder than evading
  Firewall Prime.
- **TE8. No coach.** The Cribbage coach stays off, even in the tutorial:
  the evasion is a real test of your Cribbage. (Firewall Beta's toll is
  small enough that the tutorial should rarely trigger one.)

## The numbers (`scripts/evasion-check.ts`, session 63)

Escape odds by head start against a layer-2 gatekeeper's skill (0.78),
2,000 games per row:

| Setup | Your skill | lead 0 | 3 | 6 | 9 |
|---|---|---|---|---|---|
| 3 hands, you deal twice | 0.3 | 39% | 30% | 22% | 16% |
| | 0.6 | 51% | 43% | 33% | 25% |
| | 0.85 | 70% | 61% | 51% | 42% |
| 4 hands, even | 0.3 | 19% | 14% | 10% | 7% |
| | 0.6 | 33% | 26% | 19% | 15% |
| | 0.85 | 53% | 45% | 37% | 29% |

In the simulated player's runs (150 per class), *breached, then caught*
ends 3% of runs, mostly on layers 3-4, with head starts of 3-9 (typically
~6). With those leads, 3 hands escape 22% / 33% / 50% of them at skill
0.3 / 0.6 / 0.85. Expected effect on full-run victory: about +1 point
(~19% to ~20%), to be confirmed once the simulated player plays evasions.

## On screen

- **Intro:** after the fight's result, a short card. The headline is
  "TRACE EVASION", for example: "Firewall Prime is tracing you. Outscore it
  over 3 hands to slip away. It starts 5 points up (its Containment hit
  52%). You deal first." Then a button to begin.
- **The game:** the plain Cribbage screen (as Play Cribbage), with the two
  scores as bars, the head start shown, and "hand 1 of 3".
- **The result:** "SLIPPED THE TRACE" (on to the next layer, or ROOT
  ACCESS on layer 4) or "TRACED" (the run's end screen, *breached, then
  caught*, its line saying the evasion failed and the score).
- **Elsewhere:** the map card's and Heat bar's warnings change from "gets
  you caught" to "means a trace evasion" for the gatekeeper. The toll tip
  and the coach's gatekeeper-next text say the same. The end screen's layer
  row shows the evasion and its score.

## Build plan (checkpoints)

1. **The engine.** `cribbageGame` (basic-cribbage.ts, permanent engine
   code) gains a hand limit and starting scores. `evasionGame`: the
   head start from Containment fill, 3 hands, you deal 1st and 3rd,
   escape when strictly ahead. Tests: the lead table, the dealer pattern,
   ties.
2. **The run.** run.ts, at a beaten gatekeeper whose toll maxes Heat:
   requests the evasion's decisions (the simulated player answers them by
   its skill), then escape (Heat reset, next layer or victory) or
   *breached, then caught*. Logged; saves replay it. Re-measure full-run
   victory by class (expect ~+1 point) and the escape rate against the
   table above.
3. **The screens.** The intro card, the evasion on the Cribbage screen,
   and the result. LiveRun's new pause, the end screen's text and layer
   row. Checked in the browser on desktop and phone, including a resumed
   save mid-evasion.
4. **The words.** The map card, Heat bar, toll tip and coach texts;
   README, BACKLOG; DESIGN.md's Heat section (R8 amended).
