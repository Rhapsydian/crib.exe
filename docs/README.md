# crib.exe documentation

Start with [`DESIGN.md`](../DESIGN.md), the settled design and the
reasoning behind it. The folders here hold the detail: the decision
record behind each system, the release work, the measurements, and the
history.

Each design record numbers its decisions with its own prefix (S1, E4,
MP13), and the code's comments cite them that way, for example
`docs/design/enemies.md E18`. A few prefixes repeat across eras (S and E
in the authoring record, T in the tuning record): the file named beside
the decision says which is meant.

## Design: the systems as built

[`design/`](design/): one record per system, each with its decisions,
how they were measured, and a build history.

| File | Covers | Decisions |
|---|---|---|
| [subroutines.md](design/subroutines.md) | The subroutine pool, run counting, rank III, Suspend, system strain | S1-S13 |
| [enemies.md](design/enemies.md) | Enemy tiers and targets, the elites, gatekeepers and regulars, calibration, Restore Point | E1-E18 |
| [mods.md](design/mods.md) | Rule-benders, double-edged Mods, class Mod upgrades, and their Events | M1-M14 |
| [burners-events.md](design/burners-events.md) | The Burner rework and the Events' stories | BE1-BE10 |
| [meta-progression.md](design/meta-progression.md) | Rep, the class chain, upgrades, the library, Security Levels | MP1-MP17 |
| [daily-runs.md](design/daily-runs.md) | The daily seed, its score, Glitches, Advisories, Bulletins and Directives | DR1-DR10 |
| [trace-evasion.md](design/trace-evasion.md) | The trace evasion: a last chance after a gatekeeper's toll | TE1-TE8 |
| [tutorial.md](design/tutorial.md) | The guided tutorial run and first-time tips | T1-T6 |

## Release

[`release/`](release/) and [`itch/`](itch/): getting the game out.

| File | Holds |
|---|---|
| [release/go-live-plan.md](release/go-live-plan.md) | The go-live checklist, steps 1-9, from cleanup to itch.io |
| [itch/page.md](itch/page.md) | The itch.io page: its settings, its text, uploading with butler, and the 1.0 checklist |
| [itch/description.html](itch/description.html) | The page's description, rendered for pasting into itch's editor |
| [itch/devlog-rc.md](itch/devlog-rc.md) | The release candidate's devlog post (`devlog-rc.html` is the same, rendered for pasting) |
| [itch/reddit.md](itch/reddit.md) | Drafts for Reddit posts |
| [itch/screenshots/](itch/screenshots/), [gameplay.gif](itch/gameplay.gif), [cover.png](itch/cover.png) | The page's images, rendered from the game's own components |
| [`../PATCH_NOTES.md`](../PATCH_NOTES.md) | Unreleased changes, then the latest release's notes; every release's notes are in [`../public/patch-notes/`](../public/patch-notes/) |

## Measurement

| File | Holds |
|---|---|
| [tools.md](tools.md) | The balance and diagnostic scripts, and how to read their numbers |
| [calibration/](calibration/README.md) | Raw output from the larger measurement passes |

## History

| File | Holds |
|---|---|
| [session-logs/](session-logs/README.md) | One log per working session: goals, decisions, results |
| [`../BACKLOG.md`](../BACKLOG.md) | What's still to do |

[`archive/`](archive/): finished records, each marked as historical. The
settled results are in `DESIGN.md`.

| File | Covers |
|---|---|
| [run-economy-design.md](archive/run-economy-design.md) | Session 50: the per-layer Heat economy and the per-turn model (D1-D15) |
| [archetype-redesign.md](archive/archetype-redesign.md) | Session 51: the archetypes and subroutine model redesigned (A1-A12) |
| [recalibration-design.md](archive/recalibration-design.md) | Sessions 52-53: pricing, verb and Hook prices, skill retention (R1-R8) |
| [authoring-design.md](archive/authoring-design.md) | Sessions 54-55: authoring the pool, the classes and the roster (S1-S11, C1-C6, E1-E7) |
| [balance-design.md](archive/balance-design.md) | Session 56: the class balance pass (B1-B7) |
| [playable-design.md](archive/playable-design.md) | Sessions 57-59: the UI over the headless engine, milestones 1-4 (P1-P8) |
| [class-mod-redesign.md](archive/class-mod-redesign.md) | Session 60: the class Mods redesigned (K1-K8) |
| [enemy-review.md](archive/enemy-review.md) | Session 60: the enemy roster reviewed (EM1-EM6) |
| [text-audit.md](archive/text-audit.md) | Session 60: the rules-text wording rules |
| [tuning-design.md](archive/tuning-design.md) | Session 69: Heat by layer, Mod supply, class win rates (T1-T3) |
| [session-39-gatekeeper-balance-audit.md](archive/session-39-gatekeeper-balance-audit.md) | Session 39: an audit of a roster since rebuilt |
| [design-history.md](archive/design-history.md) | `DESIGN.md` sections superseded in session 51, verbatim |
| [roadmap-history.md](archive/roadmap-history.md) | Completed roadmap work, and sections moved out of `BACKLOG.md` and `README.md` |
