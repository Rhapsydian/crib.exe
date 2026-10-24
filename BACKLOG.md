# crib.exe — Backlog

What is still to do. Completed work lives in `docs/archive/roadmap-history.md`
and `docs/session-logs/`.

**Convention for this file** (session 48): it stays forward-looking.
When an item is finished, it moves to `docs/archive/roadmap-history.md` or is
summarised in a session log; it does not accumulate here. **Do not stack
session updates in this file**: "Current state" is rewritten each
session, and the open-items list is pruned, not appended to.

**Standing principle** (session 14, `DESIGN.md` → Architecture): game
logic stays fully separate from the UI and simulable headlessly; the UI
is a thin interface onto the engine.

---

## Current state (end of session 67)

The game is playable in the browser on desktop and phones
(<https://rhapsydian.github.io/crib.exe/>, branch `playable`): a full
four-layer run with six classes, a guided tutorial, first-time tips, plain
Cribbage with a coach and lessons, and saves. Milestone 5 (polish and
playtesting) is under way. 881 tests, `npm run check` clean.

**The content pass is on `content-pass`** (pushed; the user merges it into
`playable` after playing it locally; save version 2): Burners and Events
(`docs/burners-events-design.md`), Mods (`docs/mods-design.md`),
subroutines (`docs/subroutines-design.md`), and the enemy pool's batch 1:
twelve elites calibrated to 80-85% player wins by layer, enemy Cribbage
skill raised, the ejection fix (`docs/enemies-design.md`). Run endings:
victory 31.2% (target 24-30%), lost gatekeeper 50.8%, Heat 16.9%.

---

## Priorities (the user, session 63)

In this order:

1. **More content**, all of it: subroutines, Mods, Burners, Events, and
   enemies of all three tiers. Player side first, then enemies.
   **Burners and the first ten new Events are done** (session 64), **Mods
   and their six Events** (session 65), **subroutines** (session 66),
   **elites** (session 67). Next: the enemy pool's batch 2 (gatekeepers:
   8 new, 4 per layer, 70-75% player wins, 5+ hands; regulars: 8 new for
   variety), then Heat, win-rate and Mod-supply tuning; Event mini-games
   after. The user's notes:
   - **Burners:** the economy ones (Data, Shop discounts) are the only
     ones worth carrying; tune up the combat and map Burners.
   - **Events** can be a source of rare, high-value Burners.
   - **Curses / negative-effect Mods** were bundled with a future Events
     design session.
   - Enemy-only effects (Trace, Wipe, Strip) stay off the player pool; a
     player-side Suspend ("your bottom subroutine skips a turn") was
     floated in session 60.
2. **Meta-progression.** Ideas so far: more Burner slots (session 64).
   Undesigned: plan it in a `/decision-session`.
   `DESIGN.md` requires it to credit how deep a run got, including
   *breached, then caught*, below a full continue. Related, also
   undesigned: **ascension-style difficulty**, and the session-56
   observation that **player power plateaus after layer 2** once the six
   slots fill (slot unlocks, stronger Merge, rares).
3. **Daily Runs** (the user, session 62). The date is hashed into a
   seed: everyone gets the same run that day, with a randomly chosen
   class and one or more **daily-only Mods** that bend the rules in
   unusual ways (e.g. something happens whenever a card of a given rank or
   suit is played). Stretch goal: players upload a successful run's log
   (the save's replay of answers) to a **daily leaderboard** that verifies
   it by replaying it server-side. Notes: the demo is static GitHub Pages,
   so a leaderboard needs a backend; saves break across game updates, so
   a daily run's log must pin the game version. A way to **play a chosen
   seed** (the end screen now shows it) is a natural first step.

**Art:** the user is happy with the current look; no sprite pass. At
most, refine some of the map icons.

---

## Open items

Balance and content:
- **Restore Point** (was Skeleton Key, session 68): a contraband second
  try at a lost gatekeeper; only ~1.7% of runs find one through the
  contraband Event grants. A dedicated Event to chase it is an option for
  the next Events batch.
- **Class spread widening** (session 66): Breacher 50.7%, Warden 47.7%,
  Operator 43.0% against Wraith 32.7% and Blackhat 33.0% (system strain
  and diluted Exploit/Overclock pools); for the win-rate pass.
- **System strain** (S12): its first step (~1.5 Heat at layer 1, doubling)
  is a dial for the Heat pass; the user is keeping an eye on it.
- **Heat ends ~13-17% of runs** since elites bite (0.4 elites lost a run,
  each costing Heat); for the Heat pass.
- **Gatekeepers at 78-84% player wins, 2.8-8.7 hands** (layer 3-4 fights
  under 4 hands; Firewall Prime 12): batch 2 brings them to 70-75% and 5+
  hands, likely with layer-scaled gauges like elites.
- **Heat rarely ends a simulated run** (1-3% heat-maxed or caught), so
  Ghost Credentials (-26 Heat a run) and Black Market Ties (+19) measure
  ~0 victory (session 65). Revisit both with Heat tuning.
- **Mirror Hand** (0.33 of the uncommon average) and **Persistent
  Payload** (a fixture floor) are unmeasured in builds that suit them; the
  six-commons duel fixture reads build-dependent Mods low.
- **Elites barely threaten a 6-subroutine loadout** (97.7% player wins at
  layer 2, session 64's Burner check) and regular/elite losses are rare
  (the user: rarely contained outside gatekeepers). Look at regular and
  elite difficulty in the enemy pass; **Skeleton Key**'s fate follows (a
  closed node only comes from such a loss).
- **Blackhat vs Firewall Prime: 36%** at layer 1 (its bursts hit No Way
  In's cap), against 59.7% overall for the class.
- **The Concierge vs Warden** (a tester's run, session 64): contained at
  78% Breach after being out-pegged 11-24 and out-cribbed 3-20. The
  Concierge (scale 1.42, Reception Protocol each hand) ends fights in about
  5 hands at ~10 Containment a turn: the worst case for a slow-ramping
  class. Warden beats it 77% (vs 100% against Firewall Prime). Consider a
  trim for onboarding (its scale, or Reception Protocol once per fight).
- **Win rates** on `content-pass`: average 38.0% (Breacher 42.0% to
  Eidolon 34.0%, session 65); the reworked Burners added ~6 points, the
  Mods ~11 (most from the rule-benders raising the pool's uncommon and
  rare share at the same supply: the user's call is content first, then
  tune supply). The user (session
  64): testers new to Cribbage find it too hard, so higher is welcome;
  report shifts, don't chase the old 15-20% band. Warden gains from Burners
  as much as the rest once they're saved for elites and gatekeepers; it's
  strongest of all at layer 1 (89%) and falls off deeper.
- **Mods:** ~12 at the layer-4 gatekeeper (Shop 4.6, elites 4.1,
  gatekeepers 3.0) against the user's ~10 by a run's end. Trims left: Mod
  rewards from gatekeepers, Event Mods.
- **Data left over:** the simulated player reaches layer 4 with ~90-140
  Data unspent; the Shop runs out of wanted things first.
- **Zero-Sum** has a strength cliff between scale 1.49 and 1.53 (its
  "Credit past 4 a turn" rule); its 1.49 was set between measurements.
- **Selling isn't fully modelled:** the simulated player sells only what
  it can't use (session 62); more Data from selling isn't otherwise in
  the numbers.
- **Set aside, to revisit:** Static Shield (overtuned) and Recon Ping
  (returns if the map gets fog of war).
- **Mod findings** from writing their rules text: Black Budget redraws
  the piece choice rare-weighted, not a tier up as its comment says;
  Surge Protector is spent even when another effect already zeroed that
  Credit.
- **Watch in playtesting:** Threat Hunter is the loudest elite (by
  design); Rollback is a big once-a-fight swing; Resource Quota rewards
  ordering your weakest subroutine last, which the simulated player
  doesn't optimise.
- **Pricing tools:** kit power (roster-check) can't see effects aimed at
  the player's Hooks or Ward, or Mods like Resource Quota; enemies
  carrying those are priced by parity (`scripts/enemy-parity.ts`).

Not yet seen in the browser (tests cover the engine side):
- the trace evasion's escape result (SLIPPED THE TRACE);
- the elite choose-one screen in a real run;
- the Shop's Sell section, the Safehouse's "merge everything", rank marks
  and "+N banked";
- the leftover-pegging-card fix (made from the code; confirm in play);
- Skeleton Key's reopen, on a phone;
- the tutorial's "Burner fired" coach step in the seed-21 run.

UI and text:
- **Lesson texts** (`src/ui/lessons.ts`) still use double dashes.
- **Breached, then caught** at layer 4 shows "4/4 layers breached" under
  a losing title (the rules' count); revisit if testers find it odd.
- **The coach is a first model:** pegging plays are judged one reply
  deep, against random opponent cards; the crib table takes the other
  two crib cards as random.
- **Difficulty levels:** Easy (0.6) may still be hard for a true beginner;
  moving it is one number.
- **Pegboard:** the strip and street-board mockups remain at #pegboard if
  the bars ever feel too plain.
- **A style / chrome guide** (milestone 5): deferred in session 60 as
  mostly codifying the existing look.

Platform:
- **Saves don't survive a game update** that changes rules or content
  (they are a replay of answers); a snapshot save would, at the cost of
  making the run engine resumable from state.
- **CI:** the deploy workflow's actions target Node 20 (deprecated);
  bump `actions/checkout` and `actions/setup-node`.
- **Hosting:** a custom domain on the GitHub-hosted site, and itch.io.
- **Drag and drop** as an alternative card input.

Code and tools:
- **The simulated player holds Tunnel** (it wants every Shop and
  Safehouse on its route), so Tunnel's value isn't in the numbers.
- **burner-check.ts's Heat-saved figures** include Burners picked up during
  the run (a rough ranking only), and its Containment measure tops out near
  2x Flash Drive (contraband sits there).
- **Dead exports:** `adjustSideWinThreshold` (`resolve.ts`, no callers)
  and several `loadout.ts` / `mods.ts` / `shop.ts` helpers; separating
  dead code from legitimate API is judgment work.
- The legacy `EnemyPassiveId` slot in playCombat's positional signature
  is always empty; remove it with that parameter.
- `layer-funnel.ts` doesn't take `--syntheticGatekeepers`; `sweep.ts` and
  `gatekeeper-check.ts` do.
- Aggregating classes over shared seeds doesn't multiply the sample (the
  map is built before any class divergence); prefer per-class numbers.
- Sessions 22-28 have no individual logs (only the combined
  `00-prior-sessions-1-28.md`).

---

## Banked ideas (not scheduled)

- **Self-counting and muggins** for plain Cribbage: a long-term maybe.
- **Higher tiers of Root's `forceDiscardCard`** (session 24): force both
  discarded cards rather than one. Content, not a new engine capability.
- **A "support" subroutine category** (session 22): pieces whose job is
  to buff or enable other subroutines. Worth weighing in the content pass.
- **Enemy-piece acquisition** (session 28): the 20 enemy-only subroutines
  are unreachable by design; whether some should reach rewards or the
  Shop was never revisited.
- **Rename the `Go` occurrence category to `Last-Card`** (session 22):
  cosmetic.

---

## Roadmap status

| phase | status |
|---|---|
| 0 — Design passes | ✅ complete (sessions 2–13, 27, 36) |
| 1 — Core Cribbage engine | ✅ complete (session 16) |
| 2 — Combat wrapper | ✅ complete (session 18) |
| 3 — Network map / run structure | ✅ complete (session 20) |
| 4 — Meta-progression systems (classes, Mods, Merge, Burners) | ✅ complete (session 22); between-run progression still undesigned |
| 5 — Content, balance & polish | 🔄 archetype redesign and authored content done (sessions 51–56); playable in the browser (sessions 57–63, milestones 1–4); polish, the content pass and retuning under way |

Detail for every completed phase is in `docs/archive/roadmap-history.md`; the
playable-game milestones are in `docs/playable-design.md`.
