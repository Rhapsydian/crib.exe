# Enemies (session 67)

**Status: designing.** The last piece of the content pass (`BACKLOG.md` →
Priorities): more enemies of all three tiers, and elites with teeth.
Decided live, one question at a time.

Where enemies stood: 13 regulars (by first layer 5/4/2/2; eligible from
their first layer on, scaled up by layer: 5/9/11/13 to draw from), 6
elites (2/2/1/1; 2/4/5/6 to draw from), 8 gatekeepers (2 per layer, that
layer's only), each gatekeeper with its own Mod and each elite with one.
Players beat elites about 98% of the time; gatekeepers about 73% (session
64's runs, all layers together).

## Decisions

- **E1. What each tier is for, and its target (the user; player win
  rates):**
  - **Regulars** stay loot piñatas that cost Heat: their difficulty is
    fine, they need more variety.
  - **Elites** need variety and real teeth: **80-85% player wins**, with
    power adjusted to the layer they appear on so the rate holds at every
    layer.
  - **Gatekeepers** need variety: **at least 3, preferably 4 per layer**,
    for real run-to-run variation; **70-75% player wins**.
- **E2. How many: +22, elites first.** Regulars +8 (2 per layer: 7/13/
  17/21 to draw from), elites +6 (1/1/2/2: 3/6/9/12), gatekeepers +8
  (2 per layer: 4 per layer, each with its own Mod). Batch 1: the six
  elites and retuning all twelve to 80-85% per layer. Batch 2:
  gatekeepers (70-75% per layer) and regulars (variety, difficulty as is).
- **E3. Where elites' teeth come from (the user):** a little more
  Cribbage skill, the rest from Mods and size.
  - **Enemy Cribbage skill** (0-1; the simulated player plays at 0.85):
    elites from 0.50 to **0.60 at layer 1** (+0.03 a layer: 0.69 at layer
    4); regulars from 0.15 to **0.25 at layer 1** (0.34 at layer 4), on
    feedback that really poor enemy plays feel frustrating; gatekeepers
    unchanged (0.75 to 0.84); **the opener** (a run's first three fights,
    always easy regulars with reduced numbers) from 0 to **0.15**, so it
    stops making plays that look random.
  - **Elites' remaining teeth from Mods and size:** each elite a distinct
    threat that asks something of a build (its Mod and loadout); a
    separate elite layer curve tuned so each layer's elites average 80-85%
    player wins, each elite's own scale nudged into about 75-90%; measured
    in full runs, by layer.
- **E4. The six new elites**, each aimed at a kind of build (loadouts
  drafted at build time from matching player and enemy-only subroutines,
  leaning into the Mod; numbers calibrated per E3):
  - Layer 1, **Jamming Array** (Exploit, Overclock). **Interference:**
    each time one of your Instant Hooks goes off, your Breach loses 2.
    (Redrafted: a rule that only delayed Instant Hooks would barely move a
    result, the user noted; a cost per Hook scales with reliance.)
  - Layer 2, **Memory Governor** (Daemon, Honeypot). **Hard Limit:** your
    Ward can't go above 6.
  - Layer 3, **Lockdown Service** (Exploit, Daemon). **Lockout:** every
    second turn it takes, your top subroutine skips your next turn.
  - Layer 3, **Fast Path Router** (Overclock, Honeypot). **Fast Path:**
    points it scores while pegging count double toward its initiative.
  - Layer 4, **Purge Daemon** (Daemon, Overclock). **Purge:** at the start
    of each hand, each of your Hooks loses 1 count.
  - Layer 4, **Reaper Process** (Exploit, Honeypot). **Collection:** at the
    end of each hand, your growing subroutines lose half their growth.

## Checkpoint plan (batch 1: elites)

Each checkpoint: engine, text, tests, `npm run check`, then a pause for
sign-off. Measurement: a new `scripts/enemy-rates.ts` (player win rate by
tier and layer, from full runs' fight logs: elites and gatekeepers at real
player strength), plus `run-outcomes.ts`.

1. **Cribbage skill and a baseline.** Regulars 0.25, elites 0.60, opener
   0.15 (E3); `enemy-rates.ts`; the per-layer win rates before any elite
   change (and gatekeepers per layer, for batch 2).
2. **The six elite Mods and elites** (E4): engine rules, loadouts, text,
   tests.
3. **Calibration:** a separate elite layer curve so each layer's elites
   average 80-85% player wins, then each elite's own scale into about
   75-90%. Full-run class rates reported.
4. **Screens:** the new Mods in the fight kit and the enemy's details;
   browser check at desktop and phone width.
- **E5. Fight length (the user):** elite and gatekeeper fights should
  average at least 5 hands; faster is too fast, whichever side wins.
  Breach and Containment gauge sizes may be adjusted per fight to tune
  rate and length together. `enemy-rates.ts` reports mean hands a fight.

## Built

- **Checkpoint 1, Cribbage skill and a baseline.** Skill per E3
  (`enemies.ts`); `scripts/enemy-rates.ts`. Player win rates and mean
  hands a fight (100 seeds a class):

  | | Layer 1 | Layer 2 | Layer 3 | Layer 4 |
  |---|---|---|---|---|
  | Elites, old skill | 99.7% | 100% | 99.4% | 100% |
  | Elites, new skill | 99.5%, 7.0 hands | 99.3%, 5.5 | 99.4%, 4.2 | 100%, 3.0 |
  | Gatekeepers, new skill | 79.8%, 8.5 hands | 86.9%, 5.0 | 81.5%, 3.5 | 83.5%, 2.7 |

  The skill bump barely moves the rates. **Fights shorten by layer**:
  the player's power outgrows a fixed Breach gauge, so layer 3-4 elites
  and gatekeepers end in 2.4-4.2 hands, under E5's 5. Firewall Prime runs
  12.1 hands (No Way In's cap). Regulars: players win ~100% everywhere.
- **Checkpoint 3, elite calibration (in progress).**
  `scripts/fight-calibrate.ts` captures the player at every elite fight
  of full runs and replays those fights under trial settings.
  `ELITE_LAYER_TUNING` (enemies.ts): elite strength 1.55/1.6/1.8/2.2 on
  top of the shared layer curve; both win gauges 1/1/1.4/2.2 by layer.
  Per-elite scales nudged (Intrusion Alarm 1.0, Threat Hunter 2.8, Fast
  Path Router 1.25, Hypervisor 1.1, Purge Daemon 1.6, Reaper Process 1.5,
  Jamming Array 1.2, Lockdown Service 1.65, Incident Response 1.05,
  Memory Governor 1.5): replayed, eleven of twelve within 73-90% (Reaper
  Process: 11 fights, too few). Full runs: elites 86.9 / 83.3 / 79.9 /
  86.2% by layer, 5.8-7.7 hands. **But full-run victory fell from about
  40% to about 21%:** a third of runs now end `noRouteRemains`, since a
  lost elite closes its node (DESIGN.md: impassable) and closures can cut
  the gatekeeper off; 0.38 elite losses a run. Open: what losing a
  regular or elite should do to the map.
- **E6. Full-run victory 24-30% (the user), and closures stay.** A drop
  from ~40% was wanted anyway. Losing a regular or elite still closes its
  node: runs should occasionally end with no route forward, but far less
  than a third of them; map generation is the lever.
- **E7. No new map rule (the user: re-measure first).** The third of runs
  ending with no route was a bug: a lost regular or elite closed its node
  but left the player standing on it, so the route check found no way
  out. Ejecting the player back where they came from (as DESIGN.md says)
  fixed it. Measured (`scripts/run-endings.ts`, 50 seeds a class): with an
  elite-free-route rule, victory 28.0%, no route 0%; without it, victory
  24.3%, no route 0.3% ("on occasion"). The rule was dropped. Heat now
  ends ~13% of runs (lost elites cost Heat; 0.49 lost a run), for the Heat
  pass.
- **E8. Skeleton Key set aside (the user).** With no route left in ~0.3%
  of runs, reopening a closed node is too rare to carry a Burner for. Its
  rework (perhaps a contraband "lose a gatekeeper, try once more") is
  flagged for the gatekeeper pass.
- **E9. A warning card for bigger gauges (the user):** a first-time card
  at layer 3 and again at layer 4 saying the Breach and Containment gauges
  are bigger there. Elites have them now; gatekeepers will in batch 2,
  regulars won't. **The card is built after the gatekeeper tuning, with
  its wording settled then** (the user), so it covers both tiers.
