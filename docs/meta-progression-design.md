# Meta-progression (session 71)

**Status: designed, awaiting the checkpoint plan's approval.** Progression
between runs: Rep, class unlocks, upgrades, the subroutine and Burner
library, and ascension. Decided live, one question at a time.

Where things stood: all six classes selectable from the start; nothing
carries between runs; run saves break on any game update. Balance (the
simulated player, skill 0.85): victory ~26%, elites 82-84%, gatekeepers
86 / 82 / 76 / 74% by layer, classes 23.7-28.3%. DESIGN.md asked that a
run's depth be credited, *breached, then caught* below a full continue
(R8).

## Decisions

- **MP1. What it's for (the user):** onboarding (classes unlock as you
  learn), long-term goals (the library), and incremental power (upgrades
  you feel run to run). **The balance targets describe a fresh player
  with no upgrades;** upgrades make runs easier on top of them.
- **MP2. Classes unlock by milestone:** beating the **first gatekeeper**
  with the class before it, for every class.
- **MP3. Rep** is the currency, earned mainly by depth:

  | Source | Rep (first pass; set by pacing, MP11) |
  |---|---|
  | Each layer breached and continued | 10 / 15 / 20 / 25 by layer |
  | Breached, then caught | that layer's Rep at 75% |
  | Each elite beaten | +2 |
  | Full-run victory | +20 |
  | The tutorial, once | a grant worth one small upgrade |

  Regular fights and Data earn none (they'd reward padding a run); the
  Cribbage rating earns none (the coach teaches, it doesn't judge).
- **MP4. Class order:** Blackhat (the tutorial's class) → Breacher →
  Operator → Warden → Eidolon → Wraith: about one new idea per class
  (Ward, then Suppress and fifteens, then combinations), the fiddliest
  last.
- **MP5. A testing switch, `?unlockall`,** opens every class and the
  whole library. **REMOVE BEFORE RELEASE** (the user: not around
  forever); flagged in BACKLOG and in the code.
- **MP6. A steep Rep fallback:** the next locked class can be bought for
  about 3-4 first-gatekeeper runs' worth of Rep, so no one is walled out.
- **MP7. The upgrade tracks** (prices by MP11):

  | Track (names to theme) | Levels | Per level | Bought out |
  |---|---|---|---|
  | Enemy Containment bigger | 5 | +3% | +15% |
  | Your Breach smaller | 5 | −3% | −15% |
  | Fight Heat (the user's addition) | 5 | −4% | −20% |
  | Safehouse rest Heat (now 12) | 4 | +3 | 24 |
  | Shop prices (multiplies with other discounts) | 5 | −4% | −20% |
  | Exploit / Daemon / Overclock / Honeypot power (the user's addition) | 5 each | +4% to that archetype's Process | +20% |
  | Burner slots (now 3) | 2 | +1 | 5 |
  | Subroutine slot (now 6) | 1 | +1 | 7 |

  Movement Heat gets no track (already small, the user).
- **MP8. The library (the user's design):** unlocked subroutines can
  start a run as a **4th starter** (added, not swapped: six slots fill
  fast). The store shows **one subroutine per archetype**, its next in a
  fixed order (simplest first); **all 20 commons** across every archetype
  before any uncommon is shown, all 20 uncommons before the 12 rares;
  prices climb by rarity, rares very high. The 4th starter can be from
  **any archetype**. Unlocks never change a run's reward pool (the
  targets assume the full pool).
- **MP9. Starting Burner:** the 6 common Burners (Flash Drive, Patch
  Tuesday, Packet Storm, Honeynet Shim, Log Wiper, Stolen Coupon) can be
  unlocked; choose one to carry into a run.
- **MP10. The profile:** Rep, unlocks, upgrades, ascension progress and
  records, stored apart from run saves, with its own version and forward
  migrations, so a game update never wipes it. Browser-local, like saves.
- **MP11. Pacing:** the tutorial grant buys a first upgrade; something
  affordable after almost every early run; **all power tracks in ~30
  runs** (the big slots mid-arc); all commons ~20 runs, uncommons ~50,
  **the whole library ~100 runs**; prices rise level by level. Set by
  measurement (a progression script), tuned for a player a little below
  the simulated one.
- **MP12. No refunds.** A **testing-only `?resetprofile`** flag wipes the
  profile (**REMOVE BEFORE RELEASE**, as MP5). No settings menu yet;
  **profile export/import** waits for one (BACKLOG; an opaque code with a
  checksum, since a profile only cheats yourself and a Daily Runs
  leaderboard would verify by replay, not by profile).
- **MP13. Ascension (the user):** unlocks once **all six classes are
  unlocked and a full run is won**. **10 levels**, unlocked **globally**
  (win at a level, open the next, any class); pick any unlocked level at
  run start. **+15% Rep per level** (2.5x at 10).
- **MP14. The ladder:** every level also makes enemies **+4% stronger**
  (subroutines and gauges; +40% at 10); rules accumulate, and earlier ones
  escalate:

  | Level | New rule | Escalates |
  |---|---|---|
  | 1 | Elites take a second Mod | |
  | 2 | Less Heat reset between layers (D6) | |
  | 3 | Shop prices +15% | |
  | 4 | Enemy Cribbage skill +0.1 | |
  | 5 | Rewards offer 2 choices, not 3 | |
  | 6 | Heat allowance −10% | less Heat reset again |
  | 7 | Gatekeepers take a second Mod | Shop prices +30% |
  | 8 | Regulars take a Mod | Cribbage skill +0.2 |
  | 9 | Safehouse rest sheds half the Heat | allowance −20% |
  | 10 | The final gatekeeper takes three Mods | elites a third Mod |

  Targets (a fully upgraded simulated player): victory ~40-50% at 0,
  ~20% at 5, **~3-5% at 10** (the user: very hard, bragging rights).
  Tuned by measurement.
- **MP15. Bragging rights:** an ascension badge on the end-of-run card,
  and each class's highest level beaten on the class select (unlocks stay
  global).
- **MP16. The screens:** the store is a **main-menu screen, the Message
  Board** (the user's name), not listed until the first finished run
  (the tutorial counts), then introduced once by a card saying what it
  is; its menu line carries a description ("spend Rep on upgrades,
  subroutines and Burners"). Tabs: Upgrades, Library, Burners. The class
  select shows locked classes with their requirement and fallback price,
  the starting subroutine and Burner picks, and the ascension picker; the
  end-of-run card itemizes Rep earned and announces unlocks.

## Technical notes

- **A run's save must pin what shaped it:** the upgrades, starting picks
  and ascension level at the run's start are recorded in the save (save
  version 3), so a replay rebuilds the same run even after later
  purchases.
- **Upgrades enter the engine as run options** (gauge multipliers, Heat
  factors, price factor, archetype Process factors, slot and Burner caps,
  starting extras), so the simulation measures them like any other
  option.
- **Ascension rules are run options too:** an enemy strength factor,
  extra Mods by tier, Heat reset and allowance factors, price factor,
  skill offset, reward count, rest factor.

## Checkpoint plan

1. **The profile and Rep:** profile storage (versioned, migrating),
   `?resetprofile`; Rep from a finished run (MP3) and the tutorial grant;
   the end-of-run Rep breakdown; save version 3 pinning a run's setup.
2. **Classes:** the unlock chain and fallback purchase, `?unlockall`,
   the class select's locked rows.
3. **Upgrades in the engine:** every MP7 track as a run option, the 4th
   starter and starting Burner; tests.
4. **The Message Board:** its reveal and introduction card, the three
   tabs (MP8's library order), buying; the class select's starting picks.
5. **Pacing and prices:** a progression script (the simulated player
   buying as it earns); the fully upgraded win rate; prices set to MP11.
6. **Ascension:** the rules and strength factor, its unlock, the picker,
   the badge and per-class records; measured and tuned to MP14's
   targets.
