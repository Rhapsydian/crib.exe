# crib.exe patch notes: one AI and a clearer Cribbage rating

**Play it at cribexe.com.**

A small update since the progression and Daily Runs notes (now in
`docs/patch-notes/2026-10-25.html`). It brings the Cribbage coach and
the computer's play together, a rating you can check yourself, and a
handful of fixes from playtest reports.

## Highlights

- **One Cribbage AI.** The coach and the computer opponent now think the
  same way. What the coach recommends is exactly what the opponent plays
  at full strength.
- **A simpler Cribbage rating.** Your rating is now plain arithmetic:
  100, less 10 for each point you gave up per hand.
- **Flawless Form** now needs a Flawless rating (96% or better).

## One AI

The coach and the opponent used to judge pegging differently: the coach
weighed what the other player might be holding, while the opponent
followed a few rules of thumb. Head to head, the coach's way won 57% of
games. Now there's one way, the coach's, everywhere:

- In fights, trace evasion, and Play Cribbage, the opponent pegs the way
  the coach would, more or less carefully by its skill.
- Hard in Play Cribbage plays exactly what the coach recommends.
- When a Mod shows you the opponent's hand, the coach takes it into
  account too.

Expect opponents to peg a little more sharply: they now avoid leaving
counts you can score off, based on what you could actually be holding.

## The Cribbage rating

Each discard and pegging play is compared with what the coach would have
done, in points. Your rating adds up the points you gave up, divides by
the hands played, and takes 10 off 100 for each point:

- Gave up 2.0 points a hand: **80**.
- Gave up 0.5 points a hand: **95**.

The review now says it in words: *"You gave up 3.7 points a hand to the
coach's choices, over 11 hands."* It lists only mistakes that cost a whole
point or more. Most players will see their ratings go up: small slips now
cost only what they're worth.

The labels are unchanged: Learning, Steady (60+), Sharp (75+), Expert
(88+) and Flawless (96+). A run's rating counts every hand from every
fight.

## Daily Runs

- The score's Cribbage line uses the new rating (5 points per rating
  point, doubled on Card Sharp days).
- **Flawless Form:** a Flawless rating (96% or better) scores +1,000. It
  used to be 90%, which the new rating made too easy to reach.

## Fixes

- The INIT bar no longer replays its fill when pegging ends.
- The tutorial's cards stay on their own screen: the reward explanation no
  longer pops up at the start of the next fight.
- The Quiet Host's Refactor preview shows suit icons instead of
  `[[suit:0]]`.
- The elite tip waits until an elite is one move away, not the start of
  the run.
- In the loadout, a long subroutine name keeps its rank beside it, and
  "+1 banked" stays on one line.
