# Enemies

> **Status:** built in [session 67](../session-logs/session-67-2026-10-24.md) and [session 68](../session-logs/session-68-2026-10-24.md), live since v0.9.0: elites, gatekeepers, regulars, calibration, Wraith, and Skeleton Key reworked as Restore Point. **Decisions:** E1-E18. **Summary:** [DESIGN.md → Enemy Design](../../DESIGN.md#enemy-design).

The last piece of the content pass ([`BACKLOG.md`](../../BACKLOG.md) →
Priorities): more enemies of all three tiers, and elites with teeth.
Decided live, one question at a time.

Where enemies stood: 13 regulars (by first layer 5/4/2/2; eligible from
their first layer on, scaled up by layer: 5/9/11/13 to draw from), 6
elites (2/2/1/1; 2/4/5/6 to draw from), 8 gatekeepers (2 per layer, that
layer's only), each gatekeeper with its own Mod and each elite with one.
Players beat elites about 98% of the time; gatekeepers about 73% (session
64's runs, all layers together).

## Decisions

- **E1. What each tier is for, and its target (the designer; player win
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
- **E3. Where elites' teeth come from (the designer):** a little more
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
    result, the designer noted; a cost per Hook scales with reliance.)
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

- **E10. Batch 2's order (session 68, the designer):** design and build the
  eight new gatekeepers, then calibrate all sixteen together (as elites
  were: a gatekeeper gauge curve by layer for 5+ hands, each gatekeeper's
  own strength for 70-75%, by replay; Firewall Prime's 12-hand fights
  need its No Way In cap loosened), then the eight regulars (variety,
  difficulty unchanged), then the bigger-gauge card (E9) and the Skeleton
  Key rework (E8).

- **E11. The eight new gatekeepers** (signature subroutine and
  four-subroutine loadout drafted at build; strength and gauges per E10;
  the player can't see a gatekeeper before its fight, so these are about
  adapting in it, not preparing):
  - Layer 1, **The House** (Exploit, Overclock). **House Edge:** points
    from its crib count double toward its initiative.
  - Layer 1, **Bandwidth Cap** (Daemon, Overclock). **Throttled Link:**
    your initiative bar is 3 longer.
  - Layer 2, **Signature Lock** (Exploit, Daemon). **Hardened:** your
    Hooks need one more count to go off.
  - Layer 2, **Sandbox** (Exploit, Honeypot). **Behavior Analysis:** each
    turn you take gives it Ward 2. (Drafted as Detonation Chamber; the
    user: the name didn't match the effect.)
  - Layer 3, **Watchtower** (Exploit, Overclock). **Pattern Match:** the
    first run you score each hand gives it a turn at once.
  - Layer 3, **Mirror Fabric** (Overclock, Honeypot). **Reflection:**
    whenever its Ward absorbs your Credit, it Credits half of what was
    absorbed.
  - Layer 4, **Black Ice** (Exploit, Daemon, Honeypot). **Counter-Trace:**
    each time one of your Hooks goes off, you gain 1 Heat. (Drafted as
    Trace Burn.)
  - Layer 4, **System Architect** (Daemon, Overclock, Honeypot).
    **Rewrite:** at the start of each hand, it swaps your top and bottom
    subroutines. (Drafted as The Architect.)
- **E12. The map names the layer's gatekeeper (the designer):** its name
  above the gatekeeper node, so the run can shape itself around it.

- **E15. Wraith before the final retune (the designer).** Wraith is weak from
  its first fight (players win 58% of layer-1 elite fights with it, ~88%
  with the others; 55-59% against layer-2 gatekeepers, ~89%), in 8-10-hand
  fights: too little damage to finish. Because calibration averaged the
  classes, layers 1-2 read 89% for the other five. Order: the regulars,
  then fix Wraith (its opening: starting loadout or class Mod), then
  retune elites and gatekeepers.

- **E16. The eight new regulars** (no Mods; variety from loadouts, six
  using session 66's subroutines, four with one enemy-only subroutine; at
  today's regular difficulty): layer 1 **Port Knocker** (Sequence Attack,
  Pipeline Flush), **Scheduler Bot** (Rolling Update, Cache Hit); layer 2
  **Spam Filter** (Bait File, Buffer Overflow, Session Reset), **Packet
  Logger** (Thread Pool, Steady Drip); layer 3 **Credential Harvester**
  (Packet Sniffer, Mantrap), **Load Shedder** (Backpressure, Superscalar,
  Throttle); layer 4 **Decoy Grid** (Anomaly Detector, Tarpit,
  Countermeasure), **Rootkit Scanner** (Replay Attack, Rolling Update,
  Audit Log). No Suspend on regulars.

## Build history

### Checkpoint plan, batch 1: elites

Each checkpoint: engine, text, tests, `npm run check`, then a pause for
sign-off. Measurement: a new [`scripts/enemy-rates.ts`](../../scripts/enemy-rates.ts) (player win rate by
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
- **E5. Fight length (the designer):** elite and gatekeeper fights should
  average at least 5 hands; faster is too fast, whichever side wins.
  Breach and Containment gauge sizes may be adjusted per fight to tune
  rate and length together. `enemy-rates.ts` reports mean hands a fight.

### Checkpoint plan, batch 2: gatekeepers and regulars

Each checkpoint: engine, text, tests, `npm run check`, then a pause for
sign-off.

5. **The eight gatekeepers** (E11): Mods, signature subroutines,
   loadouts, text, tests.
6. **Calibrating all sixteen** (E10): a gatekeeper gauge curve by layer
   (5+ hands), each gatekeeper's own strength (70-75% player wins), by
   `fight-calibrate.ts --tier=gatekeeper`; Firewall Prime's cap; full-run
   victory toward 24-30% (E6).
7. **The eight regulars:** a slate for review first (variety; difficulty
   as today), then built.
8. **Screens and loose ends:** the gatekeeper's name above its map node
   (E12); the bigger-gauge card (E9, wording settled then); the Skeleton
   Key rework (E8); browser check at desktop and phone width.

### Built

- **Checkpoint 1, Cribbage skill and a baseline.** Skill per E3
  (`enemies.ts`); [`scripts/enemy-rates.ts`](../../scripts/enemy-rates.ts). Player win rates and mean
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
- **Checkpoint 3, elite calibration.**
  [`scripts/fight-calibrate.ts`](../../scripts/fight-calibrate.ts) captures the player at every elite fight
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
- **E6. Full-run victory 24-30% (the designer), and closures stay.** A drop
  from ~40% was wanted anyway. Losing a regular or elite still closes its
  node: runs should occasionally end with no route forward, but far less
  than a third of them; map generation is the lever.
- **E7. No new map rule (the designer: re-measure first).** The third of runs
  ending with no route was a bug: a lost regular or elite closed its node
  but left the player standing on it, so the route check found no way
  out. Ejecting the player back where they came from (as DESIGN.md says)
  fixed it. Measured ([`scripts/run-endings.ts`](../../scripts/run-endings.ts), 50 seeds a class): with an
  elite-free-route rule, victory 28.0%, no route 0%; without it, victory
  24.3%, no route 0.3% ("on occasion"). The rule was dropped. Heat now
  ends ~13% of runs (lost elites cost Heat; 0.49 lost a run), for the Heat
  pass.
- **E8. Skeleton Key set aside (the designer).** With no route left in ~0.3%
  of runs, reopening a closed node is too rare to carry a Burner for. Its
  rework (perhaps a contraband "lose a gatekeeper, try once more") is
  flagged for the gatekeeper pass.
- **E9. A warning card for bigger gauges (the designer):** a first-time card
  at layer 3 and again at layer 4 saying the Breach and Containment gauges
  are bigger there. Elites have them now; gatekeepers will in batch 2,
  regulars won't. **The card is built after the gatekeeper tuning, with
  its wording settled then** (the designer), so it covers both tiers.
- **Checkpoint 3, elite calibration (done).** After the ejection fix, two
  nudge rounds: `ELITE_LAYER_TUNING` strength 1.55 / 1.6 / 1.75 / 2.3,
  gauges 1 / 1 / 1.4 / 2.2; scales Threat Hunter 2.3, Purge Daemon 1.8,
  Reaper Process 1.7, Blackout Cell 1.45, Intrusion Alarm 0.95. Full runs
  (150 seeds a class): **players win 85.5 / 82.8 / 82.9 / 81.9% of elite
  fights by layer, in 6.4-7.4 hands**; each elite 79.6-91.3% (Reaper
  Process on 23 fights). Run endings (100 seeds a class): victory 31.2%,
  quarantined 50.8%, Heat 16.9%, no route left 1.2%; 0.41 elites lost a
  run. Victory sits just over 24-30% before the gatekeeper batch, which
  takes gatekeepers from 78-84% player wins to 70-75% and so pulls it
  down. By class (the round before): Breacher 35.7, Warden 32.7, Operator
  31.0, Eidolon 26.0, Blackhat 22.0, Wraith 18.7%.
- **Checkpoint 4, screens.** The six elite Mods show in the fight kit
  with an "elite Mod" tag and their rule; each flashes "◆ their …" in
  the log when it acts (checked in the browser over five fights each).
  Fast Path never announced itself: now it does. The bigger-gauge card
  waits for the gatekeeper pass (E9). Batch 1 done.
- **Checkpoint 6, gatekeeper calibration.**
  `GATEKEEPER_LAYER_GAUGES` 1.15 / 1.1 / 2.2 / 2.6 (enemies.ts); each
  gatekeeper's own scale by replay (`fight-calibrate.ts --tier=gatekeeper`);
  No Way In's cap 6 → 9 (Firewall Prime ran 12 hands), so the tutorial's
  Rate Limit 8 → 12 to stay looser. Replayed: all sixteen 68-77% player
  wins, layers 72-74%, 5.7-7.4 hands (Firewall Prime 11). Full runs (100
  seeds a class): gatekeepers 75.0 / 79.8 / 75.4 / 70.5% by layer;
  elites 84-87%. **Victory 19.2%**, under E6's 24-30%: four gatekeepers
  at ~72.5% alone leave ~28% of runs (0.725^4), before Heat and the rest.
  By class: Breacher 27.5, Blackhat 22.5, Eidolon 22.0, Warden 18.0,
  Operator 17.0, Wraith 8.0%. Open: E1's gatekeeper rate against E6's
  victory.
- **E13. Gatekeepers get harder by layer (the designer's pick of four):**
  players win about **85 / 80 / 75 / 72%** by layer (replacing E1's flat
  70-75%): four gatekeepers at a flat 72.5% leave only ~28% of runs
  through all four (0.725^4) before Heat, so E6's 24-30% victory needs a
  ramp; ~37% through all four, ~26-28% victory after Heat. Gentle for
  newcomers at layer 1, a wall at layer 4.
- **E14. Firewall Prime reworked (the designer): Stateful Inspection**
  replaces No Way In: "Credit you gain past 6 in one turn is halved." (a
  hard cap made its fights grind, and hit burst builds hardest). The
  tutorial's Rate Limit is the same rule past 9. Its loadout swaps
  Watchdog Timer for Port Scan: two Suppress subroutines had walled the
  player's Breach for 11 hands whatever its strength.
- **Checkpoint 6, gatekeeper calibration (done).** `GATEKEEPER_LAYER_GAUGES`
  1.15 / 1.1 / 2.2 / 2.6 and `GATEKEEPER_LAYER_STRENGTH` 0.85 / 0.92 /
  0.98 / 1.03 (on each gatekeeper's own scale). Replayed: each gatekeeper
  66-85%, Firewall Prime 79% in 9.5 hands. Full runs (150 seeds a class):
  **players win 85.8 / 84.1 / 76.5 / 70.7% of gatekeeper fights by layer,
  6-7 hands**; elites 83.7-85.5%. Run endings (100 seeds a class): victory
  23.3%, quarantined 53.8%, Heat 21.5% (maxed 12.2, caught after a breach
  9.3), no route 1.3%. By class (200 seeds): Breacher 32.0, Blackhat
  27.0, Eidolon 24.5, Warden 24.0, Operator 20.5, Wraith 9.5%. Victory sits
  a point under E6's band with Heat now ending a fifth of runs: the Heat
  pass is the lever.
- **Checkpoint 7, the regulars.** Built per E16. Measured (100 seeds a
  class): players win 100% against every regular, old and new; the new
  eight's fights match their layer's (5.7-5.9 hands from layer 1, 4.9-5.2
  from layer 2, 4.0 from layer 3, 2.9-3.0 at layer 4). 21 regulars,
  7/13/17/21 eligible by layer.
- **E17. Wraith's Phase Shift reworked (the designer, after measuring both
  options):** "Each fifteen you score: Ward 1. While your Ward is over 4,
  each fifteen also Credits 1." (was the first fifteen on hands Wraith
  deals: Ward 0.5 and 1 initiative, paying at most every other hand, the
  weakest class Mod by far). Measured (300 runs): Wraith victory 9.5% →
  31.3% (Ward into damage) against 28.3% for a tempo version (Ward 1 and 1
  initiative a fifteen), which also pushed Heat losses to 19% through
  system strain. Phase Shift II unchanged; fine tuning in the win-rate
  pass. Next: retune elites and gatekeepers (E15).
- **The retune after Wraith (E15).** Without Wraith pulling the average
  down, elites read 84-89% and gatekeepers 89/87/77/72%. Retuned:
  `ELITE_LAYER_TUNING` strength 1.68 / 1.7 / 1.85 / 2.3,
  `GATEKEEPER_LAYER_STRENGTH` 0.89 / 0.98 / 1.0 / 1.0. Full runs (150
  seeds a class): **players win 82.4 / 82.3 / 83.5 / 83.2% of elite
  fights and 85.9 / 81.6 / 76.3 / 73.5% of gatekeeper fights by layer**,
  6-7 hands. Run endings (100 seeds): **victory 25.5%**, quarantined
  55.0%, Heat 17.2%, no route 2.3%. By class (200 seeds): Breacher 30.0,
  Wraith 25.0, Eidolon 24.0, Blackhat 23.0, Warden 22.0, Operator 20.0%.
- **E9, the card's wording (the designer):** layer 3 "The deeper you go, the
  bigger the systems: from layer 3, elite and gatekeeper Breach and
  Containment gauges are bigger, so those fights take longer to win, and
  to lose."; layer 4 "The core runs the biggest systems: elite and
  gatekeeper Breach and Containment gauges are bigger still." ("Digging in"
  read as a battlefield, not a network.) First-time tips at the first
  elite or gatekeeper fight on each layer.
- **E18. Skeleton Key reworked (the designer):** contraband (Event-only):
  "If you lose a gatekeeper fight, you aren't quarantined: the fight
  starts over, once. Used up when it saves you." The lost attempt costs no
  Heat; the toll is still due on the win; the retry is a new deal. Marked
  `passive` (works by itself), so it is kept rather than sold as a no-use
  Burner. Measured (100 seeds a class): starting with a Key, victory 25.5
  → 34.0% (+8.5) and it saves 58% of runs (gatekeeper losses are the
  commonest ending); at the Events' natural supply, 1.7% of runs ever hold
  one, it saves 0.8%, victory unchanged at 25.5%.
- **Checkpoint 8, screens and loose ends (done):** the gatekeeper named
  above its map node (E12, checked at phone width with the longest name);
  the bigger-gauge card (E9); the Skeleton Key (E18) with its notice.
  Batch 2 done.
- **E18, renamed Restore Point (the designer):** "Skeleton Key" fit opening a
  locked node; coming back from a failed fight is a restore. The old
  Key's leftovers went with it: tapping closed nodes to reopen them on the
  map, and the simulated player's map strategy for it (four tests
  retired). It stays a rare find through the contraband Event grants, no
  dedicated Event for now; revisit in the next Events batch.
