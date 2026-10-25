# Daily Runs (session 72)

**Status: approved; building on branch `daily-runs`.** The last
major content piece: a run of the day, the same for everyone, with its
own score and twists. Decided live, one question at a time. Built on
branch `daily-runs` (from `meta-progression`, whose run setup and
play-without mode it uses).

From BACKLOG (the user, session 62): the date hashed into a seed, a random
class, daily-only Mods that bend the rules; a server leaderboard as a
stretch goal.

## Decisions

- **DR1. Shape (the user):** a fixed, fair run; **the first attempt each
  day counts**, later attempts are tracked as practice with the best kept
  "for fun". **Phase 1 only:** no server or leaderboard; bragging by
  screenshot and a share line.
- **DR2. The daily score**, itemized on the end card (tuned later by
  simulation):

  | Part | Points |
  |---|---|
  | Each layer breached | 1000 (breached, then caught: 750) |
  | Victory | +1000 |
  | Each elite beaten | +150 |
  | Each Cache opened (the user) | +100 |
  | Data earned over the run (the user; not Data left, which rewards hoarding) | +1 per Data |
  | Cribbage rating | +5 per point |

  Regular fights score nothing of their own (they pay Data); time taken
  doesn't count (it would rush Cribbage).
- **DR3. Daily Mods in four categories (the user):**
  - **Glitch:** Cribbage and fight rules (how you play);
  - **Advisory:** the network: map, Heat, economy (how you route);
  - **Bulletin:** your starting kit (what you start with);
  - **Directive:** the day's scoring twist (what you chase).
- **DR4. A day's makeup:** **one Directive, plus two or three from
  Glitch, Advisory and Bulletin** (the user), drawn by the day's seed;
  some pairs never appear together. **The Directive is dealt from a
  shuffled deck**, one a day (checkpoint 1: random draws repeated within
  a week), so none repeats within its 13-day cycle.
- **DR5. The fixed setup (the user):** the date as `YYYY-MM-DD` with a salt
  is hashed into the day's seed, which rolls the class and the Mods; the
  class is random from all six (unlocked or not; a taste of locked ones,
  unlocking nothing); **no upgrades**; extra starting subroutines or
  Burners come only from Bulletins; **Security Level always 0** (its rules
  may inspire daily Mods). The local calendar date; the share line names
  the date.
- **DR6. Rep:** the scored attempt earns normal Rep (no Security Level
  bonus); practice earns none; a daily counts as a finished run but not
  toward class unlocks or Security Levels.
- **DR7. Bulletin caps (the user):** at most **one** extra starting
  subroutine and at most **two** starting Burners per day, however many
  Bulletins roll; slot Bulletins don't stack (at most one extra
  subroutine slot and one extra Burner slot). Random parts (which Burner,
  which subroutine) are rolled by the day's seed and named in the
  briefing.
- **DR8. Extra slots as Bulletins (the user):** a Burner slot, and a
  subroutine slot rolled more rarely (the strongest upgrade measured).
- **DR9. Screens (the user):** a main-menu Daily Run entry (the date, the
  class, the day's Mods in brief, today's score); a briefing before the
  run (class and every Mod in full; "this is your scored attempt"); the
  end card's itemized score and a copyable share line ("crib.exe daily
  2026-10-25 · 3,410 · L3 · Breacher · Cribbage 82%"); per day, the scored
  attempt's score and the best practice score; **a streak** (consecutive
  days with a scored attempt) and **the last 14 days' scores**.
- **DR10. The pool** (first batch; ● needs a new mechanic):

  **Glitch**
  | Name | Effect |
  |---|---|
  | Lucky Sevens | Each 7 you play while pegging Credits 3. |
  | Suit Surge | The day's suit is drawn; each card of it you peg adds 1 initiative. |
  | Fifteen Flood | Fifteens score 1 more, for both sides. |
  | Running Wild (the user's name) | Runs score double; pairs score 1 less (never below 1). |
  | Nobs and Heels | His Nobs and His Heels are worth 4. |
  | ● Early Cut | The cut card is turned before the discard: you discard knowing the starter. |
  | ● Short Count | The pegging count resets at 21, not 31. |

  **Advisory**
  | Name | Effect |
  |---|---|
  | Port Flood | Twice as many Shops on the map. |
  | Quiet Network | Moves cost no Heat; fights cost 50% more Heat. |
  | Hardened Elites | Every elite takes a second Mod. |
  | Cold Trail | A quarter of your Heat carries over between layers. |
  | Memory Leak | Install only 5 subroutines. |
  | Lean Times | Fights pay half the Data; Shop prices −30%. |
  | Cache Bloom | More Caches on the map. |

  **Bulletin**
  | Name | Effect |
  |---|---|
  | Go Bag | Start with two common Burners (rolled). |
  | Contraband Drop | Start with one contraband Burner (rolled). |
  | Field Kit | An uncommon subroutine (rolled) as a 4th starter. |
  | Veteran Loadout | Every starting subroutine begins at rank II. |
  | Seed Money | Start with 150 Data. |
  | New Hardware (the user's direction) | Your class Mod starts as its II version. |
  | Burner Rig | Carry 4 Burners. |
  | Expanded Memory (rare) | Install 7 subroutines. |

  **Directive** (deepened to 13 so a repeat takes ~2 weeks, the user)
  | Name | Effect |
  |---|---|
  | Bounty Hunt | Elites score double (300 each). |
  | Treasure Map | Caches score triple (300 each). |
  | Payday | Data earned counts double. |
  | Card Sharp | The Cribbage rating counts double. |
  | Deep Dive | Layers 3 and 4 score double. |
  | Clean Sweep | Each regular fight won scores 50. |
  | ● Ghost Run | Each layer breached with Heat under half its allowance scores +500. |
  | Shopping Spree | Each Data you spend scores 1. |
  | Full Arsenal | Each Mod held at the end scores 100. |
  | Merge Master | Each Merge scores 150. |
  | Burn Rate (the user's pick) | Each Burner you use scores 100. |
  | Clean Breach | Each gatekeeper beaten before it reaches half its Containment scores +300. |
  | Flawless Form | A Cribbage rating of 90% or better scores +1,000. |

  **Short Count: 21 is the 31** (the user): the count's limit moves,
  and everything tied to 31 follows it: pegging to exactly 21 scores 2
  and resets; Thirty-One, Last Word and Backdoor Maintenance II fire on
  21; the AI and the review coach plan around 21. Its text: "The count
  stops at 21, not 31. Anything that happens on 31 happens on 21."

  **Turncoat Crib scrapped (the user, checkpoint 4):** too subtle to read
  as a Glitch (only whose crib changed) and the harshest Mod measured
  (−25 points of victory, mostly by evening out a skilled player's crib
  edge); replaced by **Early Cut** (the user's pick over Open Book, since
  there's no recon in the game; −8 measured). The AI, the coach and the
  review coach score a kept hand exactly when the starter is known.

  **Never together:** Memory Leak / Expanded Memory; Go Bag / Contraband
  Drop (the Burner cap); Lean Times / Payday; Quiet Network / Ghost Run.
- **Deferred:** playing a chosen seed (BACKLOG; the daily is a seed of
  the day, so it can follow cheaply later); a server leaderboard.

## Tuning (checkpoint 6)

Measured with `scripts/daily-check.ts` (skill 0.85; `--part=mods` forces
one Mod at a time on the same seeds). Aims: each Glitch, Advisory and
Bulletin alone within about ±15 points of victory (Expanded Memory, rare
by design, excepted); each Directive adding a few hundred points.

- **Veteran Loadout:** rank I, not rank II (+30 → +10).
- **Fifteen Flood:** fifteens score 1 more for both sides, not double
  (−17 → −11).
- **Scoring Glitches adjust on top of a Fold, never overwrite it (the
  user):** Fifteen Flood adds 1 (Fifteen Fold's fifteens 3 → 4, Pair
  Fold's 1 → 2); Running Wild doubles runs and takes 1 from each pair,
  never below 1 (Pair Fold's pairs 5 → 4). Before this, Running Wild's
  "pairs score 1" erased Pair Fold's upside, and Fifteen Flood gave
  fractional points.
- **Treasure Map:** Caches score 500 each (+93 → +280).
- **Ghost Run:** under 60% of the allowance, not half (+108 → +338).
- Left as measured: Memory Leak −16 (one of the hard days), Running Wild
  −12.5, Quiet Network and Cold Trail −13, Cache Bloom −12, Early Cut −8,
  Expanded Memory +22 (rare); Flawless Form pays nothing to the 87%
  simulated player but the full-strength AI clears 90% every run.
- Directives now add +280 (Treasure Map) to +765 (Deep Dive); the base
  score's depth share stays ~57%.

## Technical notes

- **The day pins the run:** the daily's date (and so its seed, class and
  Mods) is recorded in the run's setup and save, so a replay rebuilds it;
  a daily saved before a game update won't resume, like any save.
- **Daily Mods as run options** beside upgrades and Security Levels, so
  the simulation can measure each one.
- **Scoring reads the run's log and end state;** Data earned, Data spent,
  Merges and Burners used need tallies the log may not keep yet.
- **Records** (scored score, best practice, streak, history) live in the
  profile, which survives updates.

## Checkpoint plan

1. **The day:** date → salted seed; the class and Mod rolls (makeup,
   blocked pairs, caps, the rare slot); Bulletin item rolls; the daily in
   the run setup and save.
2. **The score:** the itemized score with each Directive; the tallies it
   needs; tests; a simulated check that no part swamps depth.
3. **Advisories and Bulletins** in the engine (mostly existing
   mechanics: map weights, Heat, Data, caps, starters, ranks).
4. **Glitches**, including Turncoat Crib and Short Count; measure each
   one's impact.
5. **The screens:** the menu entry, briefing, end card and share line
   (copy), records, streak and history; Rep.
6. **Tuning:** score weights and Mod strengths by simulation; any blocked
   pairs the numbers suggest.
