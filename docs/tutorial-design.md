# Tutorial design (session 63)

The user wants testers to be able to pick the game up: the Cribbage side
already teaches itself (five Learn-to-play lessons and a coached game,
session 59), but the roguelite layer -- Breach and Containment, points
buying turns, subroutines (Process, Hook, firing order), the map and
Heat, rewards, Shops, Safehouses, Mods and Burners -- has no teaching at
all.

## Decisions (user, live)

- **T1. Shape: a guided first run, plus first-time tips.** A short,
  fixed run that is real play (one small layer, a scripted map, gentle
  enemies, an easy gatekeeper), with a coach panel explaining each new
  thing the first time it appears. Then, in normal runs, a one-line tip
  the first time each remaining mechanic shows up (first Safehouse,
  Merge, elite Mod...). Chosen over scripted lessons (most authoring,
  furthest from play) and tips alone (nothing walks a newcomer through).

- **T2. The guided run assumes the Cribbage basics,** with a detour: a
  first screen asks whether you know Cribbage, and "new to Cribbage"
  sends you to the existing Learn-to-play lessons first. Chosen over
  teaching Cribbage inside the run (two learning curves in one, and the
  lessons already exist).

- **T3. The Cribbage coach in the guided run's fights: a switch,
  starting off.** The tutorial's own coach explains the roguelite; card
  advice on top would crowd it, and Learn-to-play graduates just had it.
  Bringing the coach into the fight screen is new work (the logic
  exists).

- **T4. The guided run's outline** -- one small layer, ~15-20 minutes,
  a fixed map:
  1. Class pre-set to **Blackhat** (its Hooks fire often and visibly);
     its class Mod in one line.
  2. **The map:** nodes, moving, Heat per move.
  3. **First fight** (gentle enemy): points fill initiative and buy
     turns; Breach vs Containment; the first Process and first Hook.
  4. **Reward:** pick a subroutine; firing order matters.
  5. **Second fight:** an armed **Burner** fires; Hooks build and go off.
  6. **Shop:** buy; selling and Mods mentioned.
  7. **Safehouse:** the user's emphasis -- point out both options
     explicitly: **Rest to lower Heat, or Merge banked copies** (a
     banked copy placed beforehand so Merge is real).
  8. **Gatekeeper** (easy): its rule-bending Mod pointed out; the win
     ends the tutorial with "start a real run".
  Left to first-time tips: elites, Events, Caches.

- **T5. A fixed seed with a reacting coach.** The guided run always uses
  one seed -- chosen so the first fight gives an early fifteen and pair
  -- so every tester gets the same deals; the coach watches for events
  ("the first time a Hook went off") rather than following a script, so
  a tester playing their own way still gets each explanation when its
  moment comes. Saves and resumes like a normal run. Chosen over fully
  scripted hands (rigid, far more authoring) and a random seed (moments
  might come late).

- **T6. First-time tips: banners, once each, with a reset.** A small
  banner at the top (a sentence or two, "got it"), never blocking play,
  shown once per mechanic, remembered per browser; "show tips again" in
  the menu (for a new tester on the same machine). The tips: elites (a
  rule-bending Mod; a subroutine OR a Mod on a win), Events, Caches,
  Quarantine (when first caught), Heat past three-quarters, Merge ranks
  (the first rank mark), the Mod panel (once several are held), Instant
  Hooks (the first one), and an enemy's Wipe / Strip / Trace (the first
  enemy with one).

Calls made without a fork (stated here, not asked):
- **Entry point:** "Tutorial" in the roguelite section of the main menu,
  and the first-visit nudge (V5) points there.
- **Where the tutorial coach speaks:** the same banner on the map and
  between-fight screens; in fights, its own panel where the log ticker
  sits (as the Cribbage coach does in Cribbage).
- **The guided run is a run like any other underneath** (saves, the
  same screens), marked as the tutorial so it uses its fixed layer, class,
  seed and coach.

## Plan (checkpoints)

1. **First-time tips:** the banner, its memory and reset, and the nine
   tips wired to their triggers.
2. **The guided run's frame:** the menu entry and Cribbage question; a
   tutorial run -- Blackhat, the fixed seed, one hand-made layer (fight,
   reward, fight, Shop, Safehouse, gatekeeper), a gentle enemy, a carried
   Burner and a banked copy placed for the Safehouse, an easy gatekeeper;
   its end screen pointing to a real run.
3. **The tutorial coach:** event detection (first turn, first Process,
   first Hook, first Burner, the Safehouse's two options...) and its
   texts, on the map, the between-fight screens and in fights.
4. **The Cribbage coach switch in fights** (off by default; on in the
   guided run's switch).
5. **The seed and a playthrough:** pick the seed whose first fight gives
   an early fifteen and pair; play it end to end in the browser.
