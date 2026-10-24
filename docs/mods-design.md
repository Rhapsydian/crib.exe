# Mods (session 65)

**Status: designed; building (checkpoint plan below).** The second piece of the player-side content pass
(`BACKLOG.md` → Priorities; `docs/burners-events-design.md` BE9): more
Mods, double-edged Mods, upgrades for the six class Mods, and the Events
that offer them. Decided live, one question at a time.

Where Mods stood: 37 (six class Mods, 31 general, Static Shield set aside),
nearly all small number bumps (start with 2 Ward, +1 to an archetype's
Processes, 20% off at the Shop, Data per win). Few change how you play:
the three that add a subroutine, and Threshold Exploit.

## Decisions

- **M1. What new Mods are like: a mix.** Commons stay the existing small,
  steady bumps. Most new Mods (uncommon and rare) are **rule-benders** that
  change how the Cribbage or the loadout works and give a run its
  identity. **Double-edged** Mods (help and hurt) are their own category,
  mostly from Events.
- **M2. Double-edged Mods.** The upside clearly better than a rare Mod; the
  downside a real cost, about half the upside's value. Mostly from Events
  (behind a risky choice or as a bargain), perhaps occasionally a
  gatekeeper's Mod reward; never the Shop. **Permanent**: a Mod, once
  gained, can never be removed (the user: no purge option, now or later). Illustrations, not the list: Overclocked Kernel (first turn
  fires twice / a longer initiative bar), Ghost Credentials (free moves /
  fights' Heat +50%), Black Market Ties (Shop -30% / +4 Heat a visit),
  Glass Cannon (Credit +2 / the enemy starts at 10 Containment).
- **M3. Class Mod upgrades.** One upgrade per class (a "II" version) that
  keeps the Mod's trigger and adds a **second, class-flavoured clause** (a
  new rule, not just bigger numbers). Offered by **Events**: a shared one
  for every class (a gamble: success upgrades, failure costs Heat or
  Data), and possibly a deeper one offering it as a pricier sure thing.
- **M4. How many.** About 12 rule-benders (6 uncommon, 6 rare) in the
  normal Mod pool (elite and gatekeeper rewards, the Shop); about 6
  double-edged Mods and the 6 class upgrades from Events. The general
  pool goes from 31 to ~43, plus ~12 Event-only. **Supply unchanged**
  (Mods still come at the same points; more variety, not more Mods). The
  existing commons stay; the four Amplifiers might retire later, once
  rule-benders can replace them.
- **M5. Their Events.** Five or six new Events (18 → ~24 of the ~30):
  **Firmware Update** (all layers), the shared class-upgrade gamble; a
  deeper class-upgrade Event (layer 3+) as a pricier sure thing; and three
  or four Events offering double-edged Mods, each with a story that
  explains the trade. Each with a scene and a line per outcome; drafted as
  a slate for review before building.
- **M6. The rule-benders** (numbers to be measured):
  - Uncommon: **Nobs Exploit** (His Nobs also Credits 4); **Run Splicer**
    (each run also counts as a pair, for your Hooks and class Mod); **Last
    Word** (each go point you score, the last card or 31, gives you 2
    additional initiative: the user's wording); **Lucky Cut** (a cut card
    of one of your class's suits: Credit 3); **Ward Converter** (at the end
    of each hand, a third of your remaining Ward becomes Credit); **Mirror
    Hand** (the enemy's first pair each hand also counts toward your pair
    Hooks).
  - Rare: **Hot Standby** (after your loadout fires each turn, your benched
    subroutines fire their Processes too, at half strength; no Hooks:
    replaced Reverse Polarity, which a player could undo by reordering);
    **Echo Chamber** (at the end of each of your turns, your top subroutine
    fires again); **Thirty-One** (pegging to exactly 31 gives you a turn at
    once); **Deep Cache** (your Hooks bank counts up to twice their usual
    limit); **Root Cause** (each Hook that goes off gives the subroutine
    below it 1 count toward its own Hook); **Persistent Payload** (your
    Burners' temporary subroutines last twice as long).
- **M7. The first double-edged pair:** **Fifteen Fold** (your fifteens are
  worth 3 points instead of 2, your pairs only 1) and its reverse **Pair
  Fold** (pairs 5, fifteens 1), balanced for fifteens being about twice as
  common; measured before they ship. Fifteen Fold moved here from the
  rare slate (as a plain rare it was about twice a class Mod). Each pair
  inside a pair royal or double pair royal is repriced (a royal's 6 and
  a double royal's 12 become 3 and 6 under Fifteen Fold, 15 and 30 under
  Pair Fold). **Both apply to pegging as well as the show.** Measured
  (1,000 games at skill 0.85, `scripts/occurrence-frequency.ts`, each
  pair inside a royal counted): per side per hand, 2.68 fifteens and 1.62
  pairs. Fifteen Fold: +2.68 / -1.62 points. Pair Fold at 4: +3.23 /
  -2.68, too close to even, so **Pair Fold's pairs are worth 5** (+4.85 /
  -2.68; net +2.17 a hand against Fifteen Fold's +1.06, accepted as
  swingier). The combat measurement at build time settles both.
- **M8. A pair royal counts as three pairs, a double pair royal as six,**
  for your Hooks and class Mod (today each counts as one).
- **M9. The other four double-edged Mods** (to be measured at build time):
  - **Overclocked Kernel:** "Your first turn each fight fires your loadout
    twice, but your initiative bar is 2 longer." (At 14 points you get about
    86% of your turns: roughly even over a fight, strongest in short ones.
    If it measures weak, strengthen the opening, not the bar.)
  - **Ghost Credentials:** "Moving on the map adds no Heat, but each fight
    adds 25% more Heat." (Measured, `scripts/heat-sources.ts`: per run
    about 49 Heat from moves and 81 from fights. At +50% it netted only
    about -8; at +25% about -29.)
  - **Black Market Ties:** "Shop prices are 30% lower and each Shop sells a
    contraband Burner, but each Shop visit adds 8 Heat." (About 4-5 Shops a
    run: 32-40 Heat; 4 was too cheap.)
  - **Glass Cannon:** "Each Credit you score is 2 higher, but each enemy
    starts the fight at 10 Containment."
- **M10. The class Mod upgrades** ("II": the Mod's text unchanged, plus a
  clause leaning on the class's other archetype; numbers measured at build
  time):
  - **Lateral Movement II** (Blackhat): "A pair royal or better gives you
    a turn at once."
  - **Backdoor Maintenance II** (Operator): "Your go points (the last card,
    or 31) count as fifteens for this Mod."
  - **Invocation II** (Eidolon): "Your Daemon subroutines start each fight
    with one fire's growth already in them."
  - **Foothold II** (Breacher): "When your Ward blocks an enemy hit, Credit
    a third of what it blocked."
  - **Hardened Perimeter II** (Warden): "Each pair the enemy scores also
    gives you Ward 1."
  - **Phase Shift II** (Wraith): "When your Ward fully blocks an enemy hit,
    add 2 initiative."
- **M11. The six Events** (18 → 24; Heat in the usual small/medium/large
  multiples; Data prices set at measurement). Hair Trigger dropped (the
  user).
  - **Firmware Update** (all layers). "A vendor's update server is pushing
    signed firmware to every machine on the segment. Slip your class Mod
    into the queue and it might come back upgraded."
    - Push it through (gamble): 60% the upgrade, "The patch installs
      cleanly. Your class Mod comes back sharper than it left."; 40%
      medium Heat, "The signature check fails. Your class Mod comes back
      unchanged, and the server reports the attempt."
    - Leave it: "The update rolls on without you."
  - **Clean Room** (layer 3+). "An air-gapped lab, one engineer, no logs.
    Custom firmware for anyone who can pay, and no questions for anyone
    who does."
    - Pay in Data (~60): the upgrade, "The engineer works in silence and
      hands it back finished."
    - Pay in favours: large Heat and the upgrade, "The engineer wants a
      favour, and the favour is a loud one."
    - Leave: "The door seals behind you."
  - **The Mining Rig.** "A cryptominer's rig in a forgotten server closet,
    cooled by a desk fan and hope. Its tuning scripts push hardware well
    past what it was rated for."
    - Borrow its timing scripts: Overclocked Kernel, "Your first moves
      come fast now. Everything after comes slower."
    - Strip out its safeties: Glass Cannon, "No limits and no margin, for
      either side."
    - Leave it running: "The fan rattles on."
  - **The Counting Engine.** "A casino's back-office algorithm that counts
    cards for the house. Someone left its weights exposed, and it has
    opinions about which hands matter."
    - Learn its fifteens: Fifteen Fold, "It values fifteens above
      everything. Now so do you."
    - Learn its pairs: Pair Fold, "It hunts pairs and ignores the rest.
      Now so do you."
    - Close the session: "The house keeps its secrets."
  - **Dead Man's Login.** "An employee left months ago, but their
    credentials never did. Someone is selling them, still valid and still
    trusted by every door on the map."
    - Buy them (Data): Ghost Credentials, "You walk the network unseen,
      but every fight you pick draws more attention."
    - Lift them from the seller (gamble): 50% Ghost Credentials, "You take
      the login and leave the seller none the wiser."; 50% an elite
      fight, "The seller was bait, and the buyer list goes to security."
    - Pass: "Some doors are better left closed."
  - **The Fence** (layer 2+). "A fence who moves stolen code offers a
    standing arrangement: better prices and rarer stock, as long as you
    keep coming back. Every visit leaves a trail."
    - Shake on it: Black Market Ties, "Every Shop will know your face now,
      and so will everyone watching them."
    - Decline: "The fence shrugs. There's always another buyer."
  - An Event offering a Mod you already hold greys that choice out (as
    unaffordable choices are).

## Checkpoint plan

Each checkpoint: engine, text, tests, `npm run check`, then a pause for
sign-off. Measurement uses a new `scripts/mod-check.ts` (each Mod with and
without it, like `burner-check.ts`: Containment prevented against a
layer's elites for combat Mods, Heat or Data for map and Shop Mods, as a
multiple of a reference Mod) and `scripts/run-outcomes.ts` for class
victory rates. Win-rate shifts are reported, not chased (session 64).

1. **Scoring foundations.** M8: a pair royal reaches Hooks and class Mods
   as three pair occurrences, a double pair royal as six (one place, where
   occurrences are extracted). A per-side scoring rule for the Folds
   (fifteen and pair points, show and pegging, inside each royal). Measure
   M8's class shift on its own first, since it moves Blackhat, Breacher
   and Warden before any new Mod exists.
2. **The 12 rule-benders (M6).** Engine hooks, authored text, into the
   general pool by rarity. `scripts/mod-check.ts` built here; tune
   uncommons and rares against today's Mods of the same rarity.
3. **The 6 double-edged Mods (M7, M9).** A `doubleEdged` flag keeps them
   out of the reward and Shop pools. Combat ones (the Folds, Overclocked
   Kernel, Glass Cannon) and run ones (Ghost Credentials' move and fight
   Heat; Black Market Ties' prices, contraband stock and visit Heat).
   Measured with the simulated player against M2 (downside about half the
   upside).
4. **The 6 class Mod upgrades (M10).** A "II" Mod per class that replaces
   the class Mod in place (the run state remembers the upgrade; saves
   still replay), with its added clause. Measured per class.
5. **The 6 Events (M11).** New Event effects: grant a named Mod, upgrade
   the class Mod; a choice greys out when its Mod is already held (or the
   class Mod is already II). Layer gates, story text, Data prices set by
   measurement. Full-run class rates after.
6. **Screens.** Mod cards and the kit: the II name and text; a
   "Double-edged Mod" tag where the rarity sits; the Shop's contraband
   Burner slot under Black Market Ties; Event choices naming the Mod they
   grant. Browser check on desktop and phone width.

   ```
   ┌ Glass Cannon ─────────── Double-edged Mod ┐
   │ Each Credit you score is 2 higher, but    │
   │ each enemy starts the fight at 10         │
   │ Containment.                              │
   └───────────────────────────────────────────┘
   ┌ Lateral Movement II ──── Blackhat class Mod ┐
   │ Each pair you score: +1 initiative.        │
   │ A pair royal or better gives you a turn at │
   │ once.                                      │
   └────────────────────────────────────────────┘
   ```

- **M13. Content first, supply later (the user, after checkpoint 2's
  jump to 36.1%).** Finish the Mods content; tune Mod supply (draw
  weights, how many) afterwards.
- **M12. Raw Cribbage stays raw (the user).** No Folds in the trace
  evasion; the evasion, and any Cribbage-skill check added later, is plain
  Cribbage skill, untouched by Mods.

## Built

- **Checkpoint 1, scoring foundations.** `triggers.ts`: `pairsIn`,
  `occurrenceCount` (a royal is 3 pairs, a double royal 6; Hooks, class
  Mods and Burner bonuses; a `minMagnitude` Hook still counts the royal
  once), `ScoringRule` and `repriceOccurrence` (an occurrence keeps its
  table `magnitude` and gains repriced `points`, read through
  `occurrencePoints` by the gauge, hand points, point-fed Hooks and the
  timeline). `CombatSideState.scoringRule` reprices in `combat.ts`'s
  `resolveOccurrence` and the show total; nothing sets it until the Folds
  (checkpoint 3). M8 measured (`run-outcomes.ts`, 300 seeds a class),
  session 64 → now: Blackhat 29.7 → 31.7, Operator 29.3 → 28.7, Eidolon
  25.0 → 25.3, Breacher 31.0 → 31.3, Warden 22.7 → 24.3, Wraith 21.0 →
  19.3; average 26.5 → 26.8%. The pair classes gain 0-2 points, about the
  run-to-run noise at this sample.
- **Checkpoint 2, the rule-benders.** All twelve built (`mods.ts`,
  `resolve.ts`, `combat.ts`; combat gets the bench for Hot Standby) with a
  test each (`rule-benders.test.ts`). `scripts/mod-check.ts`: each combat
  Mod with and without it, six class loadouts of six commons against the
  layer-2 elites, as a multiple of the existing Mods' average fill cut at
  its rarity (uncommon 7.81 points, rare 8.32). Tuned in two rounds (the
  user approved each); final rules and multiples:
  - Uncommon: **Nobs Exploit** "Each Jack in your hand or crib at the show
    Credits 4." (was His Nobs Credits 4: 0.11) 0.61; **Run Splicer** a run
    counts as two pairs, 0.66; **Last Word** as designed, 0.89; **Lucky
    Cut** Credit 4, 0.88; **Ward Converter** "At the end of each hand,
    Credit your remaining Ward." (the Ward stays; Honeypot classes only;
    spending a third of it measured -0.08) 0.69; **Mirror Hand** every
    enemy pair, 0.33 (kept: a pair-Hook build's Mod, which the commons
    fixture barely has; adding fifteens would copy Reverse Engineering).
  - Rare: **Hot Standby** at full strength, 1.12; **Echo Chamber** as
    designed, 0.85; **Thirty-One** "Pegging to 31 gives you a turn at
    once, and your Hooks all go off on it.", 0.67; **Deep Cache** plus
    one count banked at the start of each fight, 0.80; **Root Cause** as
    designed, 0.88; **Persistent Payload** every timed Burner effect
    (temporary subroutines, effects lasting turns or hands), 0.52 (a
    floor: the fixture carries only Bootstrap Loader).
  - Fixture limits: Threshold Exploit measures 0 (no stepped Hooks in the
    commons); build-dependent Mods read low.
  - Full runs after checkpoint 2 (`run-outcomes.ts`, 300 seeds a class):
    Blackhat 35.7, Operator 36.7, Eidolon 32.3, Breacher 42.0, Warden
    37.0, Wraith 33.0; average 36.1% (was 26.8 after checkpoint 1). The
    supply is unchanged; the pool's new uncommons and rares are worth
    more than the commons they displace in the draw.
- **Checkpoint 3, the double-edged Mods.** All six built, flagged
  `doubleEdged` (never in the reward or Shop pool); a new `mod` Heat source
  for Ghost Credentials and Black Market Ties (`double-edged.test.ts`).
  Measured as full runs starting with the Mod (`mod-check.ts --part=run`,
  100 seeds a class; none 39.0%; the rares Hot Standby, Root Cause and
  Echo Chamber +10.2 to +11.8 victory):
  - **Fifteen Fold** +9.5, **Pair Fold** +9.7 (net about a rare: kept).
  - **Overclocked Kernel**: one doubled turn measured +1.3 (the longer
    bar ate it), so "Your first two turns each fight fire your loadout
    twice, but your initiative bar is 2 longer.": +12.7.
  - **Glass Cannon**: +2 Credit and a flat 10 measured +19.7 (10 is about
    a fifth of a typical Containment limit); now "Each Credit you score
    is 2 higher, but each enemy starts the fight with 25% of its
    Containment filled.": +12.5 (the user's pick; +1 and 15% measured
    +11.2; the head start is the sensitive knob: +1 and a fifth +2.2).
  - **Ghost Credentials** -25.6 Heat a run, **Black Market Ties** +19.1
    Heat a run (with 30% off and contraband stock); both about 0 victory,
    since Heat ends only 1-3% of the simulated player's runs. Kept, to
    revisit when the enemy pass makes Heat bite.
- **Checkpoint 4, the class Mod upgrades.** All six built: the run state's
  `classModUpgraded` reaches combat as `bridgeUpgraded`; the II text is the
  class Mod's plus its clause (`classModFor(classId, true)`;
  `class-upgrades.test.ts`). Measured as full runs with the upgrade from
  the start (`mod-check.ts --part=class`, 150 seeds a class, about ±4
  points of noise): first pass Blackhat +0.7, Operator +10.0, Eidolon
  +0.7, Breacher +7.3, Warden +11.3, Wraith +20.0. Tuned:
  - **Lateral Movement II**: a pair royal is too rare, so "Your second
    pair each hand gives you a turn at once (a pair royal counts as three
    pairs).": +7.3.
  - **Invocation II**: three fires' growth, not one: +4.7.
  - **Phase Shift II**: 1 initiative, not 2: +8.7.
