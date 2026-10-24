# crib.exe patch notes: the content update

What's new for testers since the current demo build. This update roughly
doubles the game's content: new Burners, Events, Mods, subroutines and
enemies, plus a full balance pass and a Cribbage review coach.

> **Heads up:** a run saved on the old build won't continue after the
> update. Finish it first, or just start fresh.

## Highlights

- **Review coach.** Every fight's result card now rates your Cribbage
  ("Cribbage: 82% (Sharp)"). Tap it to see your costliest mistakes from
  that fight, with the cards laid out and what the coach would have done
  instead. Your rating for the whole run is on the end-of-run card.
- **Burners got a real role in fights.** Arm one from the Burner row in a
  fight. Each one says when it acts ("Now" or "Next turn"), and some install
  a temporary subroutine for a few turns.
- **Many more Events,** each with a short story, and some only appear
  deeper in the network.
- **New Mods:** rule-benders, double-edged Mods with a big upside and a
  real cost, and a "II" upgrade for every class Mod (from Events).
- **16 new subroutines** (four per archetype), and **rank III now
  strengthens the Process too**, not just the Hook.
- **22 new enemies.** Elites now have teeth, gatekeepers get harder layer
  by layer, and each layer's gatekeeper is named on the map.
- **Balance pass:** a full run should be won about a quarter of the time,
  with the six classes close together.

## New: the review coach

- After each fight, the result card shows **Cribbage: N% (label)**. The
  ladder runs **Learning, Steady, Sharp, Expert, Flawless**.
- The rating measures how close your discards and pegging plays came to
  the coach's best, by the points each choice gave up. Discards count
  double. Plays where your choice didn't matter aren't counted.
- **Tap the rating** for the review: up to three of the fight's costliest
  mistakes, one of them a pegging play when there is one.
  - A discard shows the whole hand you were dealt, the two you threw, and
    whose crib they went into.
  - A pegging play shows the table: the count and the cards on it, your
    hand (with the card you played raised), the cut, and how many cards
    they held.
- For a sense of scale: the game's own simulated player rates about 87
  (Sharp), and the AI at full strength about 95 (Expert).

## New Burners

Burners now say when they act. **Now** acts as soon as you arm it (you can
disarm it until your next discard or card). **Next turn** acts at the start
of your next turn. You can carry 3. **Contraband** Burners come only from
Events (or Shops, with Black Market Ties).

**In fights**
- **Patch Tuesday** (common): Next turn, Ward 8.
- **Packet Storm** (common): each fifteen you score this hand also Credits 3.
- **Noise Floor** (uncommon): each pair you score this hand and the next
  also Suppresses 6.
- **Overclock Script** (uncommon): your loadout fires twice on each of
  your next two turns.
- **Zero-Day** (rare): for 4 hands, every Hook in your loadout goes off,
  and applies twice.
- **Bootstrap Loader** (uncommon): a temporary subroutine at the top for 3
  turns that Empowers the rest of your loadout.
- **Logic Bomb** (uncommon): a temporary subroutine at the bottom for 3
  turns that Credits more for each Hook that fired.
- **Honeynet Shim** (common): a temporary Ward subroutine for 3 turns.
- **Denial of Service** (rare, contraband): the enemy's next 2 turns are
  skipped.
- **Botnet** (rare, contraband): a temporary subroutine for 6 turns,
  Credit 4, plus 4 more on fifteens.
- **Kill Switch** (rare, contraband): the enemy's Containment drops to 0.

**On the map** (Heat tools)
- **Log Wiper** (common): lower your Heat by 10.
- **Proxy Chain** (uncommon): the next 3 fights' Heat is halved.
- **Spoofed Credentials** (rare): the next gatekeeper has no Heat toll.
- **Tunnel** (uncommon): pass through the next Shop or Safehouse without
  using it up. It stays for later.
- **Golden Ticket** (rare, contraband): Heat to 0, and the next gatekeeper
  has no Heat toll.

**Passive**
- **Restore Point** (rare, contraband): if you lose a gatekeeper fight,
  the fight starts over instead of quarantining you. Once.

*Retired:* Recon Ping. Skeleton Key became Restore Point.

## New Events

16 new Events (24 in all). Every Event, old and new, now has a scene and a
line of story for each outcome. Some only appear from layer 2 or 3, with
bigger stakes. Some choices need Data. Each Event comes up at most once per
run.

Honeypot Lure · Sysadmin on Call · Forked Repository · Ghost in the
Mailroom · The Bounty Board · Firmware Update · The Mining Rig · The
Counting Engine · Dead Man's Login · The Darknet Broker · Rogue Process ·
Audit Season · The Fence · Cold Storage · Root Shell · Clean Room

## New Mods

**Rule-benders**
- **Nobs Exploit** (uncommon): each Jack in your hand or crib at the show
  Credits 4.
- **Run Splicer** (uncommon): each run you score also counts as two pairs
  for your Hooks and class Mod.
- **Last Word** (uncommon): each go point gives 2 extra initiative.
- **Lucky Cut** (uncommon): a cut in your class's suits Credits 4.
- **Ward Converter** (uncommon): at the end of each hand, Credit your
  remaining Ward (Honeypot classes).
- **Mirror Hand** (uncommon): the enemy's pairs count toward your pair
  Hooks.
- **Hot Standby** (rare): your benched subroutines fire their Processes
  each turn.
- **Echo Chamber** (rare): your top subroutine fires again at the end of
  each turn.
- **Thirty-One** (rare): pegging to 31 gives you a turn at once, and your
  Hooks all go off.
- **Deep Cache** (rare): Hooks bank up to twice their usual counts, and
  start each fight with one banked.
- **Root Cause** (rare): each Hook that goes off gives the subroutine
  below it a count.
- **Persistent Payload** (rare): your Burners' timed effects last twice as
  long.
- **Proof of Concept** / **Lure Template** (uncommon): the next Exploit /
  Honeypot subroutine you gain is Merged once for free. These join Salvage
  Protocol and Fast Learner, one for each archetype.

**Double-edged** (from Events: a big upside with a real cost, and you keep
them for the run)
- **Fifteen Fold:** fifteens worth 3, pairs worth 1.
- **Pair Fold:** pairs worth 5, fifteens worth 1. (You can't hold both
  Folds.)
- **Overclocked Kernel:** your first two turns each fight fire twice, but
  your initiative bar is 2 longer.
- **Ghost Credentials:** moving adds no Heat, but fights add 25% more.
- **Black Market Ties:** Shops 30% cheaper and selling contraband, but
  each visit adds 8 Heat.
- **Glass Cannon:** each Credit is 2 higher, but enemies start a quarter
  of the way to containing you.

**Class Mod II** (from Events): each class Mod gains a second clause:
Lateral Movement II, Backdoor Maintenance II, Invocation II, Foothold II,
Hardened Perimeter II, Phase Shift II.

## New subroutines

Four per archetype (52 in all). Tap any subroutine in a fight or the Shop
for its full rules.

- **Exploit:** Sequence Attack, Replay Attack, Packet Sniffer, Circuit
  Breaker.
- **Daemon:** Rolling Update, Thread Pool, Backpressure, Deadlock.
- **Overclock:** Pipeline Flush, Superscalar, Branch Predictor, Clock
  Skew.
- **Honeypot:** Anomaly Detector, Mantrap, Bait File, Reflector.

New mechanics along with them:
- **Run Hooks:** some Hooks now count runs, and each run in a group counts
  (4-4-5-6 is two runs).
- **Suspend:** a few Hooks make one of the enemy's subroutines skip its
  next turn.

## New enemies

- **Regulars** (more variety): Port Knocker, Scheduler Bot, Spam Filter,
  Packet Logger, Credential Harvester, Load Shedder, Decoy Grid, Rootkit
  Scanner.
- **Elites**, each built to test a kind of build:
  - **Jamming Array** (Interference): each of your Instant Hooks costs you
    2 Breach.
  - **Memory Governor** (Hard Limit): your Ward can't go above 6.
  - **Lockdown Service** (Lockout): every second turn it takes, your top
    subroutine skips a turn.
  - **Fast Path Router** (Fast Path): its pegging points count double
    toward its initiative.
  - **Purge Daemon** (Purge): each hand, your Hooks lose a count.
  - **Reaper Process** (Collection): each hand, your growing subroutines
    lose half their growth.
- **Gatekeepers,** four per layer now, named on the map above their node:
  - **The House** (House Edge): its crib points count double toward its
    initiative.
  - **Bandwidth Cap** (Throttled Link): your initiative bar is 3 longer.
  - **Signature Lock** (Hardened): your Hooks need one more count.
  - **Sandbox** (Behavior Analysis): each turn you take gives it Ward 2.
  - **Watchtower** (Pattern Match): your first run each hand gives it a
    turn.
  - **Mirror Fabric** (Reflection): it Credits half of what its Ward
    absorbs.
  - **Black Ice** (Counter-Trace): each of your Hooks that goes off adds 1
    Heat.
  - **System Architect** (Rewrite): each hand, it swaps your top and
    bottom subroutines.
- **Firewall Prime reworked:** Stateful Inspection (Credit past 6 a turn
  is halved) replaces its hard cap.

## Rule and balance changes

- **Enemies play better Cribbage:** regulars no longer make really poor
  plays, and elites play well.
- **Elites and gatekeepers scale with depth.** From layer 3 their Breach
  and Containment gauges are bigger, so fights last longer (a tip explains
  this the first time). Gatekeepers get harder each layer.
- **System strain:** taking four or more turns in a row adds Heat,
  doubling with each extra turn.
- **Heat allowance grows by layer** (56 / 63 / 72 / 80), so later layers
  are as explorable as the first.
- **Rank III** also strengthens a subroutine's Process.
- **A pair royal counts as three pairs** (a double pair royal as six) for
  Hooks, class Mods and Burners.
- **Subroutines you own are three times as likely in rewards,** to help
  Merging.
- **Class Mods retuned** so every class wins about as often: Lateral
  Movement, Backdoor Maintenance, Invocation and Phase Shift changed.
  Phase Shift (Wraith) was reworked.
- **Salvage Protocol and Fast Learner** say clearly what they do, and skip
  a subroutine already at rank III.

## Screen and quality-of-life changes

- **View log** on the fight result card shows the fight's log (on phones,
  it slides the log drawer open). Tap **result ▸** to come back.
- **Shop warnings:** buying more subroutines than you have room for, or a
  Burner when you already carry 3, now tells you what you'd have to give
  up. A Shop Burner says when you'll get to use it.
- **Reward swaps** show each subroutine's rank and how many copies you
  have banked.
- **Event choices** show the Mod they grant, with its rules.
- **Map Burners** have their own buttons, and an "In effect" note shows
  what's active.
- **Clearer tutorial text** on initiative: your points fill only your
  initiative. Your subroutines fill your Breach.

## Fixes

- Losing a regular or elite fight could leave you stranded on the closed
  node and end the run with "no route forward". You're now moved back
  correctly.
- If a fight's Heat catches you, you no longer get offered that fight's
  rewards.

## What we'd like you to watch for

- **The review coach:** does your rating feel fair? Are the mistakes it
  picks the ones you'd want to learn from?
- **Elites and gatekeepers:** too hard, too easy, too long? The aim is
  winning about 4 in 5 elite fights, and gatekeepers getting harder from
  about 85% down to about 72% by layer 4, with fights lasting 5 hands or
  more.
- **Heat:** does it feel like a real choice on layers 3 and 4?
- **New content:** any Burner, Mod or subroutine that feels useless, or
  too strong to pass up.
- **Anything confusing** in the text, especially the new Burner timings
  and double-edged Mods.
