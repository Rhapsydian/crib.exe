# Session logs

One log per working session: its goal, the decisions made (and why),
the work completed with commits, what was deferred, and notes on the
problems solved along the way. The early logs are prose; from about
session 35 they follow that structure.

Sessions 22-28 have no log of their own: they are covered by the
combined [00-prior-sessions-1-28.md](00-prior-sessions-1-28.md). Session
50 has none either: it was never closed out, and its record is
[`docs/archive/run-economy-design.md`](../archive/run-economy-design.md)
and its commits.

## Design from scratch (sessions 1-14)

| Session | Date | What happened |
|---|---|---|
| [1](session-01-2026-08-23.md) | 2026-08-23 | The project's kickoff: a hacking roguelite with Cribbage for combat, designed from nothing |
| [2](session-02-2026-08-23.md) | 2026-08-23 | The four subroutine archetypes, named and defined |
| [3](session-03-2026-08-23.md) | 2026-08-23 | What subroutine effects do, and the trigger catalog |
| [4](session-04-2026-08-23.md) | 2026-08-23 | Which trigger families each archetype leans into |
| [5](session-05-2026-08-23.md) | 2026-08-23 | The Cribbage scoring occurrences, catalogued as triggers |
| [6](session-06-2026-08-23.md) | 2026-08-23 | Suit theming: each suit named for its archetype |
| [7](session-07-2026-08-23.md) | 2026-08-23 | How subroutines are acquired in a run, and the loadout's slot cap |
| [8](session-08-2026-08-23.md) | 2026-08-23 | Class specialization |
| [9](session-09-2026-08-23.md) | 2026-08-23 | How a lost fight turns into Heat |
| [10](session-10-2026-08-23.md) | 2026-08-23 | Subroutine tags, a classification across archetypes |
| [11](session-11-2026-08-23.md) | 2026-08-23 | Class starting passives |
| [12](session-12-2026-08-23.md) | 2026-08-23 | The first named subroutines: each class's starting loadout |
| [13](session-13-2026-08-23.md) | 2026-08-23 | The class unlock order |
| [14](session-14-2026-08-23.md) | 2026-08-23 | The standing rule: a headless engine, fully separate from the UI |

## The engine (sessions 15-21, and 22-28)

| Session | Date | What happened |
|---|---|---|
| [15](session-15-2026-08-23.md) | 2026-08-23 | Scoping the Cribbage engine (phase 1) |
| [16](session-16-2026-08-23.md) | 2026-08-23 | Building it: a rules-correct, headless, tested 2-player Cribbage engine |
| [17](session-17-2026-08-24.md) | 2026-08-24 | Scoping the combat wrapper (phase 2) |
| [18](session-18-2026-08-24.md) | 2026-08-24 | Building it |
| [19](session-19-2026-08-24.md) | 2026-08-24 | Scoping the network map and run structure (phase 3) |
| [20](session-20-2026-08-24.md) | 2026-08-24 | Building it |
| [21](session-21-2026-08-24.md) | 2026-08-24 | Scoping classes, Mods, Merge and Burners (phase 4) |
| [22-28](00-prior-sessions-1-28.md) | | Phase 4 built, the Breach/Containment redesign, the tunable-skill AI, the enemy library and the sweep harness (combined log) |

## Systems and balance (sessions 29-49)

| Session | Date | What happened |
|---|---|---|
| [29](session-29-2026-08-27.md) | 2026-08-27 | The first log in this convention |
| [30](session-30-2026-08-27.md) | 2026-08-27 | Mods: the shape of the relic equivalent |
| [31](session-31-2026-08-27.md) | 2026-08-27 | Mods: the hook-point catalog |
| [32](session-32-2026-08-27.md) | 2026-08-27 | Mods: a sample of real content, to test the catalog |
| [33](session-33-2026-08-27.md) | 2026-08-27 | Mods: the implementation plan |
| [34](session-34-2026-08-27.md) | 2026-08-27 | Mods: built |
| [35](session-35-2026-08-28.md) | 2026-08-28 | Why runs ended almost only in Quarantine |
| [36](session-36-2026-08-28.md) | 2026-08-28 | Burners and Events designed |
| [37](session-37-2026-08-28.md) | 2026-08-28 | Burners and Events: the implementation plan |
| [38](session-38-2026-08-28.md) | 2026-08-28 | Burners and Events built, and a balance sweep |
| [39](session-39-2026-08-28.md) | 2026-08-28 | A middle-ground route through the map for the simulated player |
| [40](session-40-2026-08-30.md) | 2026-08-29 to 30 | Separate win gauges for each side, a gatekeeper pass, an archetype audit |
| [41](session-41-2026-08-31.md) | 2026-08-31 | Planning a bigger player subroutine pool |
| [42](session-42-2026-08-31.md) | 2026-08-31 | The player pool expanded |
| [43](session-43-2026-08-31.md) | 2026-08-31 | The enemy pool expanded |
| [44](session-44-2026-08-31.md) | 2026-08-31 | The Mod pool expanded |
| [45](session-45-2026-08-31.md) | 2026-08-31 | Scoping a class audit, which became a better simulated player |
| [46](session-46-2026-08-31.md) | 2026-08-31 | The simulated player's heuristics built |
| [47](session-47-2026-09-01.md) | 2026-09-01 | Trace, three engine bugs, and a broken measuring instrument found |
| [48](session-48-2026-09-06.md) | 2026-09-06 | Turn economy, an instrument audit, and a documentation restructure |
| [49](session-49-2026-09-06.md) | 2026-09-06 | Synthetic gatekeepers: measuring with the roster held still |

## The redesign (sessions 51-56)

| Session | Date | What happened |
|---|---|---|
| [51](session-51-2026-10-11.md) | 2026-10-11 | The archetypes and subroutine model redesigned from scratch |
| [52](session-52-2026-10-12.md) | 2026-10-12 | Recalibration: the Heat economy and a pricing instrument |
| [53](session-53-2026-10-13.md) | 2026-10-13 to 14 | Recalibration finished: verb and Hook prices, skill retention |
| [54](session-54-2026-10-14.md) | 2026-10-14 to 15 | Authoring: every archetype's subroutines and the six classes |
| [55](session-55-2026-10-15.md) | 2026-10-15 | Authoring the enemy roster |
| [56](session-56-2026-10-16.md) | 2026-10-16 | The class balance pass |

## Playable (sessions 57-63)

| Session | Date | What happened |
|---|---|---|
| [57](session-57-2026-10-17.md) | 2026-10-16 to 17 | The UI planned; a pausable engine and one playable fight |
| [58](session-58-2026-10-17.md) | 2026-10-17 | A whole run in the browser; the map generator redesigned |
| [59](session-59-2026-10-18.md) | 2026-10-18 | Plain Cribbage with a coach, and lessons |
| [60](session-60-2026-10-18.md) | 2026-10-18 | Polish: a text audit, class Mods redesigned, an enemy review |
| [61](session-61-2026-10-19.md) | 2026-10-19 | Playtest notes, and Merge reworked |
| [62](session-62-2026-10-20.md) | 2026-10-20 | The economy: a simulated player that shops like a person |
| [63](session-63-2026-10-21.md) | 2026-10-21 | Ready for testers: a guided tutorial, tips, the trace evasion |

## Content and release (sessions 64-73)

| Session | Date | What happened |
|---|---|---|
| [64](session-64-2026-10-23.md) | 2026-10-23 | Content pass: Burners reworked, Events given stories |
| [65](session-65-2026-10-23.md) | 2026-10-23 | Content pass: Mods |
| [66](session-66-2026-10-24.md) | 2026-10-23 to 24 | Content pass: subroutines |
| [67](session-67-2026-10-24.md) | 2026-10-24 | Content pass: enemies, batch 1 (elites) |
| [68](session-68-2026-10-24.md) | 2026-10-24 | Content pass: enemies, batch 2 (gatekeepers and regulars) |
| [69](session-69-2026-10-24.md) | 2026-10-24 | The tuning pass: Heat, Mod supply, class win rates |
| [70](session-70-2026-10-24.md) | 2026-10-24 | Playtest fixes, two Mods, and the review coach |
| [71](session-71-2026-10-24.md) | 2026-10-24 | Meta-progression |
| [72](session-72-2026-10-25.md) | 2026-10-25 | Daily Runs, and one AI for every opponent and the coach |
| [73](session-73-2026-10-27.md) | 2026-10-26 to 27 | Go-live: the release candidate, and itch.io |
