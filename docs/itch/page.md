# crib.exe on itch.io: the page

Go-live step 9. The text for the itch.io page, and how to fill in its
settings. Draft: settle wording with the user before it goes up.

## Settings

| Field | Value |
|---|---|
| Title | crib.exe |
| Project URL | rhapsydian.itch.io/cribexe |
| Short description (tagline) | A hacking roguelite where every fight is a game of Cribbage. |
| Classification | Games |
| Kind of project | HTML (played in the browser) |
| Release status | In development until 1.0, then Released |
| Pricing | No minimum: "$0 or donate" (pay what you want, free to play) |
| Uploads | The `html5` channel, pushed with butler (see below); "This file will be played in the browser" |
| Embed size | 1280 × 800 (wide enough for the desktop layout, 900px and up) |
| Mobile friendly | Yes, orientation: portrait |
| Frame options | Fullscreen button: on. Scrollbars: on (the Shop and reward screens scroll). Automatically start on page load: on (the game makes no sound until a click, so sound isn't blocked) |
| Genre | Card Game |
| Tags | roguelite, roguelike, cribbage, card-game, cyberpunk, hacking, turn-based, strategy, singleplayer, mobile |
| AI disclosure | Yes: developed with Claude Code (as About says) |
| Links | cribexe.com, the Discord, the GitHub source |
| Community | Comments on (the release-candidate note asks for reports there or on the Discord) |
| Visibility | Draft, then Restricted for a check inside itch's frame, Public at 1.0 |

Upload, as Pixelyph does (`C:\Users\husbando\tools\butler\butler.exe`,
already logged in):

```
npm run build
butler push dist rhapsydian/cribexe:html5 --userversion 0.9.1
```

## Description

> **Release candidate.** crib.exe is in final testing before 1.0: everything
> planned for launch is in, and what's left is fixes from your reports.
> Your progress carries over to 1.0. Found a bug or have an idea? Tell us
> on the [Discord](https://discord.gg/HxCry3uRpa) (#bug-reports, #feedback)
> or in the comments below.

> **Break into a network, four layers deep. Every fight is a game of
> Cribbage.**

You're a hacker working through a guarded network. Each layer is a
branching map of fights, Shops, Quiet Hosts, Caches and Events, with a
gatekeeper at the top, and every move raises your Heat. Max it out and
you're traced.

**How a fight works.** Play Cribbage against the system you're breaking
into. The points you score in pegging, your hand and your crib fill your
initiative, and when it fills you take a turn: every subroutine in your
loadout fires, top to bottom, building your Breach. Fill it before the
enemy's subroutines fill its Containment.

**Build your kit.** Pick up new subroutines after each win and order them
so they feed each other. Add Mods that bend the rules for the rest of the
run, and one-use Burners for when a fight turns. Refactor spare copies to
rank your subroutines up.

### What's in it

- **6 classes**, each with its own Mod and starting loadout
- **52 subroutines** across four archetypes, one per suit: Exploit,
  Daemon, Overclock and Honeypot
- **Dozens of Mods**, **24 Burners** and **24 Events**
- **49 enemies**, from regular fights to elites and gatekeepers that bend
  a rule of their own
- **A Daily Run:** the same class and twists for everyone, one scored
  attempt a day
- **A guided tutorial**, and a coach that rates your Cribbage play
- **Plain Cribbage** too: four difficulty levels, a coach, and short
  lessons if you're new to the game

### New to Cribbage?

Choose **Learn to play** on the main menu: five short lessons, then a
game with a coach. The tutorial run explains the roguelite side as you
play.

### Controls

Tap or click. Plays on desktop and on phones (portrait). Sound and turn
speed are in Settings.

### Saves

Your progress is saved in your browser. It's separate from the copy at
cribexe.com: to move it across, use **Settings → Export progress**, then
**Import** on the other.

### Links

- Play it on the web: https://cribexe.com
- Discord (bug reports, ideas, Daily scores): https://discord.gg/HxCry3uRpa
- Source: https://github.com/Rhapsydian/crib.exe

Made by **Rhapsydian** (Justin Stephens), developed with Claude Code.
Card sounds: Keyboard soundpack 1 by unicaegames (CC0). Icons: Tabler
Icons (MIT).
