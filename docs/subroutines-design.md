# Subroutines (session 66)

**Status: built (session 66, checkpoints 1-4).** The third piece of the player-side content pass
(`BACKLOG.md` → Priorities): more subroutines, more variety in what they
do, and a look at Merge. Decided live, one question at a time.

Where subroutines stood: 36, 9 per archetype (4 common, 3 uncommon, 2
rare). Hooks watch fifteens (7, counting the enemy's) and pairs (3 own);
nothing watches runs, flushes, His Nobs or 31s. 24 of 36 Processes just
Credit (one Empower, one Tempo, three Suppress, Ward only on Honeypot);
stealing, Charge, Disrupt and Ward-spending Credit barely appear. Few
Hooks wait for several events (stepped).

## Decisions

- **S1. How many: +16, to 52.** Four per archetype: 1 common, 2 uncommon,
  1 rare (each archetype 13: 5/5/3). The user: enough depth without
  diluting the pool, since Merging needs copies to turn up.
- **S2. Runs get Hooks; flushes, His Nobs and 31s don't** (the user: runs
  are the third most frequent score; the others are too rare to build a
  Hook on).
- **S3. Processes need more variety** (the user agrees): fewer plain
  Credits among the new sixteen.
- **S4. Merge rank III also buffs the Process** (the user's idea, the
  feedback being that ranks don't feel impactful): ranks I-III keep the
  Hook bump; rank III adds a percentage of the Process's base amount,
  authored per subroutine within 50-150%: weaker or situational Processes
  higher (~150% for 1-point or conditional ones, ~100% typical, ~50% big),
  rarer subroutines higher (three copies of a rare is a feat). Rounded to
  half points; on the definition, so the Merge screen shows it. All 52
  get one; measured against Merged subroutines without it.
- **S5. Existing tools plus one new mechanic, Suspend** ("the enemy's
  bottom subroutine skips its next turn"; Resource Quota's rule, player
  side), **only as a Hook's effect, never a Process** (the user). The rest
  from what the engine already has: Credit variants (steal, from Ward,
  piercing), Tempo, Empower, Charge, Disrupt, Suppress, Ward, growth; Hooks
  on scoring (runs included), the enemy's scoring, points, fires, Ward
  absorbed, gauge levels, loadout position. Trace, Wipe and Strip stay
  enemy-only.
- **S6. The same four roles per archetype**, each in its own flavour:
  (1) a Run Hook (common or uncommon); (2) a pair or stepped Hook
  (uncommon), for the thin builds (Mirror Hand, Run Splicer, the pair class
  Mods, Threshold Exploit); (3) a new, non-Credit Process (uncommon); (4) a
  rare build-definer (Suspend lives on one or two rares' Hooks). Drafted
  one archetype at a time.
- **S7. The Exploit slate** (numbers measured at build time):
  - **Sequence Attack** (common, Run Hook): Process: Credit 1. Hook:
    Credits 2 more for each run you've scored since it last fired (at most
    4 more). Rank III 150%.
  - **Replay Attack** (uncommon, stepped pair Hook): Process: Credit 1.
    Hook: Once you've scored 3 pairs since its Hook last went off, it
    Credits 6 more. Rank III 150%.
  - **Packet Sniffer** (uncommon, new Process): Process: Take 1 of their
    Containment and add it to your Breach. Hook: While their Containment is
    over half, it takes 2 more. Rank III 100%.
  - **Circuit Breaker** (drafted as Kill Switch) (rare, build-definer): Process: Credit 2. Hook: Once
    you've scored 3 fifteens since its Hook last went off, their bottom
    subroutine skips its next turn (Suspend). Rank III 100%.
- **S8. Each run counts** (the M8 treatment for runs, the user's ask): a
  show run group is recorded with how many runs it holds (4-4-5-6: two;
  4-4-4-5-6: three; 4-4-5-5-6: four), and everything that counts runs
  counts each (Run Hooks, Run Splicer, any run bonus). Points unchanged.
  Pegging already scores one run per play (correct Cribbage). Stored with
  the run, not derived from its points (pegging's run of 6 scores 6 and is
  one run). Built first. **Run Splicer may need retuning** (a double run
  now gives four pairs): re-measure it.
- **S9. The Daemon slate:**
  - **Rolling Update** (common, Run Hook): Process: Credit 1, growing 0.25
    each time it fires (up to 2). Hook: Suppresses 1 for each run you've
    scored since it last fired (at most 3). Rank III 150%.
  - **Thread Pool** (uncommon, stepped pair Hook): Process: Suppress 1,
    growing 0.25 each time it fires (up to 2). Hook: Once you've scored 2
    pairs since its Hook last went off, it Suppresses 4 more. Rank III 100%.
  - **Backpressure** (drafted as Throttle) (uncommon, new Process): Process: Their initiative bar is
    1 longer for their next 2 turns. Hook: Every 3rd time it fires, also
    Suppress 2. Rank III 150%.
  - **Deadlock** (rare, build-definer): Process: Credit 1, growing 0.5 each
    time it fires (up to 4). Hook: Every 4th time it fires, their bottom
    subroutine skips its next turn (Suspend). Rank III 75%.
- **S10. The Overclock slate:**
  - **Pipeline Flush** (common, Run Hook): Process: Credit 1. Hook:
    Instant: every time you score a run, add ¼ of a turn (3 initiative) to
    your initiative gauge right away. Rank III 150%.
  - **Superscalar** (uncommon, stepped pair Hook): Process: Credit 1. Hook:
    Once you've scored 3 pairs since its Hook last went off, also Empower 1
    the rest of your loadout this turn. Rank III 150%.
  - **Branch Predictor** (uncommon, new Process): Process: Give the next
    subroutine's Hook one extra count. Hook: Gives it 2 instead if you've
    scored a fifteen since it last fired. Rank III 100%.
  - **Clock Skew** (rare, build-definer): Process: Remove ⅛ of a turn (1.5
    initiative) from their initiative gauge. Hook: Instant: every time
    you've scored 2 runs, add ½ a turn (6 initiative) to your initiative
    gauge right away. Rank III 150%.
- **S11. The Honeypot slate** (Anomaly Detector, drafted as Tripwire, stays on
  the opponent's runs, the user's call):
  - **Anomaly Detector** (drafted as Tripwire) (common, Run Hook): Process: Ward 2. Hook: For each run
    the opponent has scored since it last fired, also Credit 2 that ignores
    their Ward (at most 4). Rank III 100%.
  - **Mantrap** (uncommon, stepped pair Hook): Process: Ward 1. Hook: Once
    you've scored 3 pairs since its Hook last went off, also take 3 from
    their Containment and add it to your Breach. Rank III 150%.
  - **Bait File** (drafted as Canary Token) (uncommon, new Process): Process: Spend up to 2 of
    your Ward to Credit that much. Hook: For each pair the opponent has
    scored since it last fired, also Ward 2 (at most 4). Rank III 100%.
  - **Reflector** (rare, build-definer): Process: Ward 2. Hook: For every 3
    of their Credit your Ward has absorbed since it last fired, Credit 2
    that ignores their Ward (at most 6). Rank III 75%.

## Checkpoint plan

Each checkpoint: engine, text, tests, `npm run check`, then a pause for
sign-off. Measurement: a new `scripts/subroutine-check.ts` (each new
subroutine swapped into the six class loadouts against the layer-2
elites, with and without, as a multiple of its rarity's existing average),
then full runs (`run-outcomes.ts`). Shifts reported, not chased.

1. **Foundations.** S8: show run groups carry their run count, and
   everything that counts runs counts each (Run Splicer re-measured).
   S5: Suspend as a Hook effect (Resource Quota's skip, player side). S4:
   Merge rank III adds an authored percentage of the Process; the 36
   existing subroutines get theirs by the guideline (drafted for the
   user's review); measured against rank III without it.
2. **The sixteen** (S7, S9-S11): definitions, rarities, archetype pools,
   text. `subroutine-check.ts` built here; tuned against their rarity's
   existing subroutines.
3. **Full runs and Merge.** Class rates after the sixteen and rank III;
   the simulated player's acquisition and Merge picks sanity-checked with
   the bigger pool (S1: Merging still has to happen).
4. **Screens.** Suspend, stealing, Charge and spending-Ward Processes in
   the text; the Merge screen's rank III before/after; the new
   subroutines in rewards, Shop and the loadout. Browser check on desktop
   and phone width.
- **S12. System strain** (the user's playtest note: Priority Override and
  Elevated Session snowball): from the player's fourth consecutive turn on
  (turns with no enemy turn between, across hands; every source of turns
  counts), each extra turn adds Heat, starting near the small Event amount
  (~4 at layer 1, scaled by layer) and rising with each further turn.
  Player only. Shown on the fight's Heat gauge, as a log line ("System
  strain: +4 Heat (4 turns in a row)") and with a first-time tip card.
  Built in checkpoint 1; measured. **Starts at the fourth turn, not the
  third** (the user, after measuring): a third turn in a row came in 47%
  of ordinary fights (7% of player turns) and took full-run victory from
  38.7% to 23.3%; a fourth is 0.5% of player turns. To keep an eye on.

## Built

- **Checkpoint 1, foundations.** S8 (`runs` on show run groups and
  occurrences; `occurrenceCount`), S5 (`suspend`, `HOOK_ONLY_VERBS`; a
  Merge loosens it), S4 (`content/rank-three.ts`, `rankThreeBonus`; the 36
  shares drafted by the guideline and approved, Cache Hit at 100% by the
  user's call), S12 (`STRAIN_FROM` 4, `strainHeat` from
  `SYSTEM_STRAIN_LOSSES`, a `strain` beat, log line and tip;
  `subroutine-foundations.test.ts`). Measured:
  - Run Splicer after S8: 0.69 of the uncommon average (unchanged: the
    fixture rarely scores double runs). No retune.
  - Rank III: about +0.5 victory, because the simulated player ends only
    9% of runs with a rank III subroutine (0.11 a run). Checkpoint 3
    looks at Merge frequency.
  - Strain at 3 turns: 47% of ordinary fights strained, victory 38.7 to
    23.3%. At 4: Blackhat's starting loadout strained in 13% of fights
    (0.5 Heat a fight), an Overclock snowball loadout in 48% (4 Heat a
    fight at layer 1). Full runs (300 a class): Blackhat 33.3, Operator
    34.0, Eidolon 30.0, Breacher 44.3, Warden 43.0, Wraith 28.3; average
    35.5% (38.7 without strain); heat-maxed 2-6%. The Overclock classes
    pay most (Wraith -7.7).
  - **Strain re-shaped (the user): a small first step, doubling.** About
    1.5 Heat on the fourth turn in a row at layer 1 (2.4 at layer 4), then
    3, 6, 12. Blackhat's starting loadout: 0.2 strain Heat a fight; the
    Overclock snowball 1.6 (was 4.0 on the linear ramp). Full runs:
    Blackhat 35.3, Operator 38.3, Eidolon 33.7, Breacher 46.0, Warden 43.7,
    Wraith 35.3; average 38.7% (the same as without strain), heat-maxed
    2-3%. The user's aim: a balance between haste and not drawing too much
    attention, discouraging leaning too hard into haste. The size of the
    first step is a dial for the Heat tuning pass.
- **Checkpoint 2, names.** Four drafted names clashed with existing ones
  and were renamed (for the user's review): Kill Switch (a contraband
  Burner) → Circuit Breaker; Throttle and Canary Token (enemy subroutines)
  → Backpressure and Bait File; Tripwire (a regular enemy) → Anomaly Detector (the user: Motion Sensor read too physical).
- **Checkpoint 2, measured** (`scripts/subroutine-check.ts`: each
  subroutine in the top slot of six-subroutine class loadouts, against a
  Credit 1 placeholder, vs the layer-2 elites, 30 seeds; as a multiple of
  its archetype's existing average at its rarity). The first two fixtures
  were wrong (swapping against a different common per class; the last
  slot, which leaves Charge-next and Empower-the-rest nothing below). One
  tuning round (the user approved): Mantrap takes 2; Thread Pool waits for
  3 pairs; Packet Sniffer's Hook takes 1 more; Anomaly Detector Credits 1
  a run; Pipeline Flush ⅙ of a turn; Reflector every 4 absorbed; Bait
  File's Hook Wards 3; **Branch Predictor reworked** to Charge every
  other Hook (charging only the next measured below zero). After it:
  Sequence Attack ~0.8 (vs other archetypes' commons), Replay Attack ~1.4
  (vs all uncommons), Packet Sniffer 3.3, Circuit Breaker 1.47; Rolling
  Update 1.14, Thread Pool 2.30, Backpressure 1.38, Deadlock 1.05;
  Pipeline Flush 1.28, Superscalar 1.30, Branch Predictor 0.97, Clock
  Skew 1.30; Anomaly Detector 1.63, Mantrap 2.25, Bait File 1.62,
  Reflector 1.53. The measure is the enemy's Containment, so anything
  that lowers it directly (Suppress, stealing, Ward) reads high.
- **Checkpoint 3, full runs and Merge.** Full runs with all sixteen (300
  a class): Blackhat 31.3, Operator 38.0, Eidolon 34.7, Breacher 47.0,
  Warden 46.0, Wraith 36.0; average 38.8% (38.7 before them): no class
  jumps, so the duel check's high readings (Suppress, stealing) don't
  carry into runs; Blackhat -4.0 is the largest move (noise about ±2.7).
  `scripts/merge-frequency.ts`: installed subroutines by rank at a run's
  end, per run, 4.50 / 1.18 / 0.34 / 0.13; **10.7% of runs end with a
  rank III** (9.3% with 36 subroutines); 1.57 copies left banked a run.
- **S13. Owned subroutines are three times as likely in reward draws**
  (the user, after checkpoint 3's 10.7%): fight rewards, Caches and Black
  Budget's redraw weight a subroutine you own (installed or benched) x3,
  so Merge copies turn up; the Shop is unchanged. Aim: a quarter to a
  third of runs reach rank III. Measured (`merge-frequency.ts`, 50 seeds a
  class), x1 / x2 / x3: runs reaching rank III 10.7 / 14.7 / 27.7%; rank
  II or III per run 0.47 / 0.75 / 0.90; different subroutines offered per
  run 25.2 / 22.9 / 21.0; owned at the end 8.1 / 7.8 / 7.7. The user chose
  x3 after weighing the variety cost (doubling was the first call).
  Full runs at x3 (300 a class): Blackhat 33.0, Operator 43.0, Eidolon
  35.3, Breacher 50.7, Warden 47.7, Wraith 32.7; average 40.4% (38.8).
- **Checkpoint 4, screens.** The new Processes and Hooks read from
  `describe.ts` (Suspend standalone, Charge "gives 1 more count"); the
  Merge preview shows rank III's Process bonus (Buffer Overflow rank II →
  III: Credit 1 → 2.5); the strain log line and tip. **Found while
  checking: Merging a Suspend Hook** loosened Circuit Breaker toward
  "every fifteen" (a near-permanent lock), so a Suspend Hook never
  changes on a Merge (the Process grows instead), and Suspends don't
  stack (one pending skip at most). Checked in the browser at phone width
  (a reward of three new subroutines, the Safehouse Merge preview).
