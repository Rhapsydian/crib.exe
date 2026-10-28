# Reddit posts: r/roguelikes and r/cribbage

Drafts for the release candidate. Check each subreddit's rules before
posting (self-promotion limits, flair, and r/roguelikes' weekly threads).
Post as a text post with the link inside, and stay to answer comments.

## r/roguelikes

Title: **crib.exe: a free browser roguelite where every fight is a game of Cribbage (release candidate, looking for testers)**

Flair: the subreddit's own-game or release flair, if offered.

---

I've been building crib.exe, a hacking roguelite where the fights are games of Cribbage, and it's now a release candidate. I'd love feedback before 1.0.

**The loop:** you break into a network four layers deep. Each layer is a branching map of fights, Shops, Events, Caches and Quiet Hosts, with a gatekeeper at the top. Every move raises your Heat, and if it maxes out you're traced.

**The fights:** you play Cribbage against the system you're hacking. Points from pegging, your hand and your crib fill your initiative. When it fills, your loadout of subroutines fires top to bottom, building your Breach. Fill it before the enemy fills your Containment.

**The build:** after each win you pick new subroutines and order them so they feed each other (the order matters a lot). Mods bend rules for the whole run, one-use Burners save a bad fight, and spare copies rank subroutines up.

What's in it:

- 6 classes, 52 subroutines across four archetypes (one per suit)
- Dozens of Mods, 24 Burners, 24 Events, 49 enemies; gatekeepers each bend a rule
- A Daily Run: same class and twists for everyone, one scored attempt a day
- A tutorial run, plus a coach that rates your Cribbage play after each hand

You don't need to know Cribbage: there are five short lessons on the main menu.

Free, plays in the browser on desktop and phones, no account or ads:

- itch.io: https://rhapsydian.itch.io/cribexe
- Web: https://cribexe.com

I'm most interested in balance (builds that feel too strong or useless) and anything confusing. There's a Discord for reports: https://discord.gg/HxCry3uRpa. It was developed with Claude Code, and the source is on GitHub.

---

Note: r/roguelikes leans toward traditional roguelikes; check its rules on roguelites and self-promotion first. For a lower-key start, use r/roguelikedev's weekly Sharing Saturday thread (below).

## r/cribbage

Title: **I made a free Cribbage game with a coach that rates your discards and pegging (plus a roguelite mode)**

---

I've been working on crib.exe, a free browser game built around Cribbage, and I'd like feedback from people who know the game well.

**Plain Cribbage:**

- Standard two-player Cribbage against the computer, four difficulty levels
- A coach that rates each discard and pegging play, and shows what it would have done and how many points that was worth
- Five short lessons for new players, then a coached game

**The roguelite mode,** if you want something different: every fight is a Cribbage game. Your points power a loadout of "subroutines" in a hacking-themed run through four layers of a network, with a Daily Run anyone can compare scores on.

It plays in the browser on desktop and phones, with no account and no ads:

- https://cribexe.com
- https://rhapsydian.itch.io/cribexe

I'd especially like to hear if the coach ever rates a play in a way you disagree with, or if the scoring or counting is ever off. Reports are welcome here or on the Discord: https://discord.gg/HxCry3uRpa.

## r/roguelikedev: Sharing Saturday

A comment in the weekly "Sharing Saturday" thread, not a post of its own.
It's a dev log: what changed this week, a GIF or screenshot, a link at the
end. New accounts are fine there. Attach `docs/itch/gameplay.gif` or a
screenshot (upload to imgur or Reddit, then link it).

---

**crib.exe** ([itch.io](https://rhapsydian.itch.io/cribexe) | [web](https://cribexe.com))

A hacking roguelite where every fight is a game of Cribbage: your pegging, hand and crib points fill your initiative, and when it fills, your loadout of subroutines fires top to bottom to breach the enemy.

This week was go-live. The release candidate is out on itch.io, and most of the week went to testers' reports:

- **A runaway combo.** Branch Predictor (Charge every Hook) plus Elevated Session (an Instant Hook that grants a bonus turn) chained up to 12 turns in a row. Charge no longer feeds Instant Hooks, which now say "Hook · Instant" on the card. Across 200 seeded fights, the pair went from 2.81 turns a hand back to 1.43, the same as Elevated Session alone.
- **Reworking Branch Predictor.** Without that combo it was weak, so I measured a handful of replacements against the uncommon average (the fill it adds when cut into real loadouts). Counts only came in at 0.62x, and "Empower the rest" at 2.48x. I picked Credit 1 plus "on a pair, every other Hook gets a count" at 1.02x.
- **Event rolls on screen.** Risky Event choices show a bar of the odds and a sweeping marker. A gamble's segments shift and hide behind "?" until it lands.
- **Fairer Cribbage ratings.** Stars are judged on the figure the review shows, and a play within a hair of the coach's own costs nothing.

Next: more testing before 1.0. If you try it, I'd like to hear which builds feel too strong or useless.

[GIF]

## r/playmygame

A feedback request. Check the rules for the title format and flair (it
usually wants the platform and a link in the post).

Title: **[Browser] crib.exe: a hacking roguelite where every fight is a game of Cribbage. Looking for feedback before 1.0**

---

**Play:** https://rhapsydian.itch.io/cribexe (or https://cribexe.com). Free, desktop or phone, no account.

**What it is:** you break into a network four layers deep. Fights are games of Cribbage against the system you're hacking: points from pegging, your hand and your crib fill your initiative, and when it fills, your loadout of subroutines fires top to bottom to fill your Breach before the enemy fills its Containment. Between fights you pick new subroutines, Mods and Burners, and every move on the map raises your Heat.

**New to Cribbage?** Choose Learn to play: five short lessons, then a coached game. The tutorial run teaches the rest.

**What I'd like feedback on:**

- Did the first run make sense? Where did you get lost?
- Any build or subroutine that felt far too strong, or useless
- Bugs, especially on phones (the build number on the About page helps)

A run takes a while, but it saves as you go, and the Daily Run is shorter. Reports are welcome here or on the Discord: https://discord.gg/HxCry3uRpa. Thanks for playing!
