# Tuning pass (session 69)

**Status: designing.** After the content pass (Burners, Events, Mods,
subroutines, enemies): Heat, win rates by class, and Mod supply. Decided
live, one question at a time.

Where things stood (simulated player, skill 0.85): run victory 25.5%
(target 24-30%, enemies E6); runs end on a lost gatekeeper 55%, on Heat
~17% (maxed ~12%, caught after a gatekeeper toll ~7%), with no route left
~2%. Heat in per run ~145-175: fights ~60% (baselines and win
performance), moves ~32%, lost fights ~5-8%, Events ~3%. Classes 20-30%
(Breacher 30.0, Wraith 25.0, Eidolon 24.0, Blackhat 23.0, Warden 22.0,
Operator 20.0). Mods at a run's end (besides the class Mod): 7.2 across
all runs, 11.1 in winning runs (the user's earlier aim: ~10 by a run's
end).

## Decisions
- **T1. Order and targets (the user):** Heat first (Heat ends about 10%
  of runs), then Mod supply (about 10 Mods by a winning run's end), then
  class win rates (each within about ±3 points of the average).
- **T2. An exploration target by layer (the user: Heat barely matters on
  layer 1, and layer 4 allows little but a straight route).** About the
  same share of each layer explorable, roughly 60-65% of its nodes, with
  Heat peaking near 70% of the allowance on every layer. Measured before
  (simulated player): nodes visited 76 / 72 / 59 / 48%, peak Heat 57 / 67
  / 75 / 79% of the allowance, the allowance shrinking 76 / 68 / 61 / 53
  while fights cost more. Levers in order: the allowance by layer first,
  then fight Heat's growth, then move cost.

## Built

- **Heat, the allowance (T2).** `scripts/layer-explore.ts`. The simulated
  player explores up to its Heat safety margin, so its peak Heat stays
  near 65-79% whatever the allowance; the allowance sets how much it can
  explore. Tried (60 to 80 seeds a class): 62 / 70 / 80 / 88 visited 69-73%
  of every layer, Heat ending 8.6%, victory 28.1%; 60 / 72 / 85 / 95 a
  little looser (victory 31.1%); **56 / 63 / 72 / 80** chosen: visited 71 /
  65 / 66 / 65%, peak Heat 65 / 68 / 75 / 79%, Heat ending 12.3% (maxed
  7.7, caught after a toll 4.6), victory 26.9%. DESIGN.md's "tightening
  with depth" reversed.
- **Heat, done for now (the user).** Two dials noted, should Heat come
  up again: layer 1's allowance to ~52 (it still leaves 71% explorable),
  and flattening fight Heat's growth at layers 3-4 (mostly cuts tolls that
  catch a player after a gatekeeper; Heat ends 12.3% against ~10%).
- **T3. Mod supply stays as is (the user):** 12.4 Mods by a winning run's
  end (Shop 4.8, elites 4.1, gatekeepers and Caches 3.1, Events 0.5; 7.0
  across all runs; `scripts/mod-supply.ts`), with run victory a touch
  under 24-30% (classes 19.7-28.7%, average 23.4%, 300 seeds a class).
  Classes next.
- **Classes (T1: each within ±3 of the average), one round through the
  class Mods:** Lateral Movement +1.5 initiative a pair (was 1); Backdoor
  Maintenance Suppress 1.5 a fifteen (was 1); Invocation three-quarters of
  a fire's growth (was half); Phase Shift Credits over a Ward of 5 (was 4).
  Full runs (300 seeds a class): Operator 28.3, Breacher 26.7, Wraith
  26.3, Blackhat 24.7, Eidolon 24.0, Warden 23.7%; **average 25.6%**,
  every class within ±3 (was 19.7-28.7%, average 23.4%).
