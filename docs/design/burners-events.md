# Burners and Events

> **Status:** built in [session 64](../session-logs/session-64-2026-10-23.md), live since v0.9.0. **Decisions:** BE1-BE10. **Summary:** [DESIGN.md → Burners](../../DESIGN.md#burners), [Events](../../DESIGN.md#events).

The first
half of the player-side content pass ([`BACKLOG.md`](../../BACKLOG.md) → Priorities). Decided
live, one question at a time.

## Burners

The problem (the designer, session 63): the economy Burners (Data, Shop
discounts) are the only ones worth carrying. A combat Burner was a lump at
the start of a turn (Flash Drive: Credit 5, a tenth of a fight).

- **BE1. Three kinds of combat Burner.** Lumps, resized to be worth a slot
  (about a fifth of a fight); rule-benders that bend a rule for a turn or
  a hand, most new ones, scaled by rarity; and **temporary subroutines**
  (the designer's category, BE3).
- **BE2. Each Burner says when it acts.** Its text leads with its timing.
  **"Now:"** takes effect as soon as it's armed and can be toggled off
  again until your next decision in the fight (a discard or a card),
  which commits it and spends it (the designer's refinement). **"Next turn:"**
  fires at the start of your next turn, as before. One armed at a time,
  the same toggle under your gauges.
- **BE3. Temporary subroutines.** A Burner slots a subroutine in at the
  top or the bottom of your firing order: an extra slot, not counted
  against your 6. Armed as "Next turn:", installed when that turn starts;
  it fires a set number of turns (2-4 by rarity, a countdown badge), then
  leaves, and it always leaves at the end of the fight. A Process and a
  Hook like any subroutine; no ranks or Merge; "the next subroutine" and
  adjacency effects treat it like any slot. One at a time (a second
  replaces the first). Its name carries the ⏏ prefix, and a plain
  **"Burner · N left" tag sits where a rank would go** (the designer's call:
  the icon once, on the name).
- **BE4. Map Burners are Heat tools.** Ghost Protocol buffed (next 3
  moves free); new: lower your Heat now, the next fight's Heat halved, the
  next gatekeeper's Heat toll halved, and **Tunnel**, pass through a Shop
  or Safehouse without visiting it (the designer's addition: reach what's
  behind it without spending it). Recon Ping retired (no fog of war).
  **Skeleton Key** stays, flagged: the designer is rarely contained outside
  gatekeepers, so a closed node is rare; that is a symptom to check in
  the enemy pass (regular / elite difficulty), and the key's fate follows.
- **BE5. Events and Burners.** Three or four **contraband** Burners are
  offered only by Events, usually behind the riskier choice; Events can
  also grant Burners from the general pool (the designer).
- **BE6. Pool and carry.** 24 Burners; the carry limit stays 3.
  More Burner slots is a meta-progression idea ([`BACKLOG.md`](../../BACKLOG.md)).
- **BE7. The slate** (numbers are starting points, tuned by measurement):

| Burner | Rarity | Kind | Text |
|---|---|---|---|
| Cold Wallet, Stolen Coupon, Loyalty Token, Insider Tip | - | economy | unchanged |
| Flash Drive | common | lump | Next turn: Credit 10. |
| EMP Charge | uncommon | lump | Next turn: Suppress 12. |
| Patch Tuesday | common | lump | Next turn: Ward 10. |
| Packet Storm | common | rule-bend | Now: each fifteen you score this hand also Credits 2. |
| Noise Floor | uncommon | rule-bend | Now: each pair you score this hand also Suppresses 2. |
| Overclock Script | uncommon | rule-bend | Next turn: your loadout fires twice. |
| Zero-Day | rare | rule-bend | Next turn: each of your Hooks that goes off applies twice. |
| Bootstrap Loader | uncommon | temp, top | Process: Empower the next subroutine 2. Fires 3 turns. |
| Logic Bomb | uncommon | temp, bottom | Process: Credit 2. Hook: Credit 1 per subroutine that fired its Hook this turn. Fires 3 turns. |
| Honeynet Shim | common | temp, bottom | Process: Ward 3. Fires 3 turns. |
| Ghost Protocol | uncommon | map | Your next 3 moves cost no Heat. |
| Skeleton Key | rare | map | unchanged (under review, BE4) |
| Log Wiper | common | map | Now: lower your Heat by 10. |
| Proxy Chain | uncommon | map | The next fight's Heat is halved, win or lose. |
| Spoofed Credentials | rare | map | The next gatekeeper's Heat toll is halved. |
| Tunnel | uncommon | map | Your next move passes through a Shop or Safehouse without visiting it. |
| Denial of Service | contraband | rule-bend | Now: the enemy's next turn is skipped. |
| Botnet | contraband | temp, bottom | Process: Credit 3. Hook (fifteens): Credit 3 more. Fires 5 turns. |
| Golden Ticket | contraband | map | The next gatekeeper has no Heat toll. |
| Kill Switch | contraband | lump | Now: the enemy's Containment drops by half. |

Player-text rule (the designer): "your" only for what the player has (Heat,
moves, loadout, Hooks); the network's things are "the next gatekeeper",
"the next fight", never "your next gatekeeper".

## Events

- **BE8. A library of about 30**, growing across sessions (the designer:
  Events are the game's story moments; Slay the Spire-like variety). Kinds:
  pitfalls; steep bargains (a powerful reward at a high price); gambles;
  **games** (Event mini-games); **double-edged Mods** (a Mod that helps
  and hurts); **class Mod upgrades** (gamble to upgrade your starting
  Mod). Some gated by layer, so deeper Events carry bigger stakes.
- **BE9. Phased.** This session: the Burner rework, Event scene text,
  and a first batch of about 10 new Events using what exists (pitfalls,
  bargains, gambles, contraband and general Burners). Next: double-edged
  Mods and class Mod upgrades with the Mods session, their Events with
  them; then Event mini-games.
- **BE10. Every Event has story.** A scene that sets up the choice, and a
  line for what happened after it (the designer: never a bare choice). The
  existing eight get theirs written too.

## Screens

The arm row under your gauges (fight), with the timing in each button:

```
 BREACH  ███████░░░░  31/50   INIT ████░░ 7/12
 ⛨ 2   ◆ 3   ⏏ 2
 [⏏ Packet Storm · Now ✓]  [⏏ Flash Drive · Next turn]
  Packet Storm is on for this hand. Undo it until you discard or play.
```

A temporary subroutine in your loadout (fight panel and loadout lists):

```
 YOUR LOADOUT · Breacher
 ⏏ Bootstrap Loader   Burner · 2 left       ← top, extra slot
   Fuzzer             rank II
   Cache Hit
   Port Scan          rank I
```

An Event (story first, then the choices, each with its risk shown):

```
 EVENT · Dead Man's Switch                     LAYER 2
 A forgotten maintenance script is still counting down in
 the backbone: whoever wrote it never came back to disarm
 it. Its trigger logic is elegant. Its payload is not.

 [ Defuse it quietly ]            safe · −3 Heat
 [ Repurpose its trigger logic ]  65%: a Mod · 35%: +4 Heat
 [ Let it detonate ]              a gamble
```

After choosing, a line of what happened ("The payload fizzles. In the
wreckage you find…") above the result, as the notice screen shows now.

## Build history

1. **Burner engine.** BE2's timing (Now / Next turn, commit on your next
   decision), turn- and hand-long rule-bends, temporary subroutines
   (extra slot, countdown, removal), the map Burners (Heat now, the next
   fight's Heat, the next gatekeeper's toll, Tunnel), contraband
   (Event-only), Recon Ping retired. The simulated player uses them.
   Tests.
2. **The slate, measured.** BE7 in content; each Burner's effect measured
   (with and without, the designer's rule) and tuned to its rarity; Burner
   supply rechecked; full-run balance re-measured.
3. **Burner screens.** The arm row with timing; the temporary subroutine
   with its ⏏ Burner tag and countdown; Tunnel on the map; the reward,
   Shop and swap screens. Browser-checked on desktop and phone.
4. **Event story.** Scene text and outcome lines in the Event format and
   screen; written for the existing eight; Burner grants (general and
   contraband) as outcomes; the "Pass -- keep moving" double dash fixed.
5. **The first batch of Events.** About 10 new ones (pitfalls, bargains,
   gambles; contraband behind risky choices; some layer-gated), drafted
   as a slate with their story for the designer's review before they're
   built, then measured.
