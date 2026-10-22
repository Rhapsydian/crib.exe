# Class Mod redesign (session 60)

> **Status: complete (session 60); historical.** The class Mods as built are in `DESIGN.md`; its "Open" item, the enemy review, was done the same session (`docs/archive/enemy-review.md`). Operator's, Warden's, Breacher's and Eidolon's Mods were retuned in sessions 61-62.

The user's goal: the six class Mods (the bridges) feel uneven. The ones
that trigger on every fifteen feel good. Rework all six so each triggers
on a **fifteen or a pair** you score, stays thematic, and still bridges
the class's two archetypes.

## Measurement

`scripts/occurrence-frequency.ts --games=300` (skill 0.85): fifteens
5.3 per hand, pairs 2.7 per hand. The stored per-turn table
(`beta-frequency-data.ts`) agrees: 2.45 fifteens and 1.24 pairs per
turn. Fifteens are about **twice** as common, so a pair trigger pays
about twice as much per trigger. Budget: C2's +1.0 Credit per turn,
which is about 0.4-0.5 per fifteen or 0.8-1 per pair.

## Decisions (user, live)

- **K1. Half and half:** three class Mods trigger on fifteens, three on
  pairs.
- **K2. Blackhat (Exploit + Overclock):** each pair you score adds ⅙ of
  a turn to your initiative gauge (was: an Exploit Hook that applies
  Empowers the next subroutine +1). Pegging pairs pull your next turn
  forward mid-hand. Pair, because pairs mostly come in pegging, the
  skill-driven part of the hand.

- **K3. Eidolon (Daemon + Overclock):** each fifteen you score grows each
  of your Daemon subroutines by half of one fire's growth, still up to
  its cap (was: an Overclock Hook that applies grows each Daemon 1
  step). An overclocked daemon runs its clock faster. The Overclock side
  is thematic, not mechanical: the Haste version was turned down as too
  close to Blackhat. Amount (½) to be confirmed by simulation.

- **K4. Warden (Daemon + Honeypot):** each pair you score Suppresses 0.5
  and banks 0.5 Ward (was: Suppress you deal also banks that much Ward,
  up to 1 a turn). Keeps the identity (healing feeds the shield) and
  feeds Tarpit, the class's conversion engine. A Ward-gated or
  Ward-spending version was turned down: Tarpit drains Ward above 3, so
  it would fight its own Mod. Pair, leaving fifteens for Wraith.

- **K5. Wraith (Overclock + Honeypot):** each fifteen you score banks
  0.25 Ward and adds ½ initiative (1/24 of a turn) to your gauge (was:
  each of your turns banks 0.5 Ward). The small, frequent version of
  Blackhat's tempo and Breacher's Ward together; feeds Tarpit and gives
  Ping and Tarpit more turns.

Already on the pattern: Operator (Exploit + Daemon: each fifteen,
Suppress 0.5) and Breacher (Exploit + Honeypot: each pair, Ward 1).

Final: fifteens 3 (Operator, Eidolon, Wraith), pairs 3 (Breacher,
Blackhat, Warden).

- **K6. No enemy carries a class Mod** (the user's call): class Mods are
  the player's alone. The 12 elites and gatekeepers that carried one lost
  it (elites now have no Mod; gatekeepers keep their bespoke Mod). They
  will get **new enemy Mod designs** in the coming enemy review.

- **K7. Names:** Blackhat's class Mod is **Lateral Movement** (was Exploit
  Chain), Wraith's is **Phase Shift** (was Siphon).

- **K8. Retune** (docs/calibration/s60-class-mod-retune.txt): gatekeepers
  re-tuned back onto the curve first. Tempo turned out pricier than the
  budget assumed: Lateral Movement cut to 1/12 of a turn (1 initiative)
  per pair. Phase Shift: rather than tiny fractions (the user's call:
  they read badly), a limit -- **the first fifteen you score each hand
  you deal: Ward 0.5 and 1/12 of a turn (1 initiative)**. Final victory:
  Blackhat 22.7, Operator 16.7, Eidolon 20.7, Breacher 25.0, Warden 19.3,
  Wraith 27.0. Wraith and Breacher stay a little high; both were before
  this work, and Wraith wins 22.7% with no class Mod at all.

## Open

- Enemy review: new Mods for the elites and gatekeepers.
