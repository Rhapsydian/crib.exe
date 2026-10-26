# crib.exe patch notes: star ratings and a clearer Cribbage review

**Play it at cribexe.com.**

What's new since the AI and rating update (now in
`docs/patch-notes/2026-10-25-ai-rating.html`): the Cribbage rating in
stars, a reward for flawless play, a rebuilt review screen, and clearer
choices when you start a run.

## Highlights

- **Star ratings.** Your Cribbage rating is now 1 to 5 stars, from
  Learning to Flawless.
- **Clean work pays.** A Flawless fight avoids 1 Heat.
- **A clearer review.** Your choice and the coach's side by side, in
  numbers, with cards shown as small colored chips.
- **Play Cribbage** ends with a star rating too, and picks up where you
  left off when you resume.
- **Starting a run:** pick your auxiliary subroutine and Burner from
  lists with their full rules, and step through Security Levels with
  their effects listed.

## Star ratings

The rating is still based on the points you give up per hand compared
with the coach, now shown as stars:

| Stars | Rating | Points given up per hand |
|---|---|---|
| ★☆☆☆☆ | Learning | more than 4.0 |
| ★★☆☆☆ | Steady | 4.0 or less |
| ★★★☆☆ | Sharp | 2.5 or less |
| ★★★★☆ | Expert | 1.2 or less |
| ★★★★★ | Flawless | 0.4 or less |

The review tells you how far you are from the next star: *"You gave up an
average of 1.6 points a hand. Expert is 1.2 or less."*

## Flawless Cribbage

A fight with a Flawless rating avoids 1 Heat, win or lose. The fight's
end card says so: *"Flawless Cribbage: clean work, 1 Heat avoided."*

## The review

- **Cards as chips.** Every card in the review, the coach and the log
  is a small badge with its suit icon and rank, outlined in the suit's
  color.
- **Your choice beside the coach's, in numbers.** For a discard: what you
  kept and threw, its points in hand, what the cut adds on average, and
  what the crib is worth (negative when it's theirs), then the coach's
  keep, then the difference. For pegging: the table, your card's points
  and the opponent's expected reply, then the coach's card. A short line
  under each says why. The numbers add up to the difference shown.
- **The three costliest choices**, whatever they cost.
- **The coach** uses the same layout when it looks back at your last
  discard or play, in fights and in Play Cribbage.

## Play Cribbage

- A game ends with its star rating and the same review.
- Resuming a saved game opens where you left off, instead of replaying
  every hand.

## Starting a run

- **Auxiliary subroutine** (it was the "4th starting subroutine"): tap
  *Select auxiliary subroutine* for a list of everything you've unlocked,
  grouped by archetype, with full rules. Your class's own subroutines
  can't be picked.
- **Starting Burner:** the same, with each Burner's rules.
- Your picks show their full rules on the screen, with *change* and
  *clear*.
- **Security Level:** step through levels with ◀ ▶; the effects at that
  level are listed, with the new ones marked.

## Daily Runs

- The Cribbage line pays by stars: 100 / 200 / 350 / 500 / 700 (doubled
  on Card Sharp days).
- **Flawless Form** pays at 5 stars.
- The share line shows your stars: `Cribbage ★★★★☆`.

## Fixes

- On iPhone, a quick double tap no longer zooms the page.
