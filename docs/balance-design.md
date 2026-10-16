# Class balance pass — working decision record

Follows step 3 (`docs/authoring-design.md`), which authored the pool,
the classes and the enemy roster and tuned the gatekeepers to the
per-layer pass-rate curve for all classes pooled. Started session 56
(`/decision-session`, 2026-10-16).

Starting point (session 55, `docs/calibration/step3-final-run-level.txt`;
300 runs per class, synergy acquisition, opportunistic traversal, skill
0.85):

| class | victory | Heat endings | quarantined |
|---|---|---|---|
| Blackhat | 14% | 25% | 60% |
| Operator | 11% | 37% | 52% |
| Breacher | 14% | 42% | 44% |
| Eidolon | 31% | 7% | 62% |
| Warden | 27% | 8% | 65% |
| Wraith | 28% | 9% | 62% |

## Decisions

### B1 — Every class inside 10–20% victory ✅

The per-class reading DESIGN.md has used since session 49, and what the
Slay the Spire ascension-0 benchmark measures: a new player's chance
with any character. The inner aim is about 15% ± 5, clear of the band's
edges. This was chosen over "the average in band, classes allowed to
differ". Eidolon, Warden and Wraith come down; the Exploit classes hold
or lift a little.

### B2 — Exploit keeps its Heat identity, trimmed to 20–30% Heat endings ✅

Exploit runs ending on Heat went from 24–30% (before the roster) to
25–42%, because the three tracers hit noisy builds hardest. Skill
matters least for Exploit runs (+7–9 victory points against +17–23 for
the others), since a run that ends on Heat barely depends on Cribbage
play.

- **Targets:** Exploit Heat endings ≈ 20–30% (a ratio of ~3–4×, inside
  the user's 3–5×), and an Exploit skill gap of +10 points or more.
- **Lever: the tracers** (Tripwire, Intrusion Alarm, Total Compromise),
  the newest source of Exploit Heat. Fuzzer, the class's own noise, is
  untouched.
- Exploit victory is expected to rise a few points and must stay inside
  10–20% (B1).

### B3 — Strong classes come down through their bridges first ✅

Eidolon (31%), Warden (27%) and Wraith (28%) are tuned through their
own bridge Mods first (Invocation, Hardened Perimeter, Siphon), since
each touches exactly one class. Starting loadouts are the second lever,
only if a bridge alone can't do it. Archetype pieces stay as priced:
they are shared with the Exploit classes and the enemy roster. The
gatekeeper curve stays too: it moves every class alike, so it can't
close a gap between them.

Bridges are now tuned against measured victory, not just C2's duel
budget, which becomes a starting point. The overshoot is mostly late:
Invocation reaches ~2.0 Credit a turn; the others 1.05–1.14.

### B4 — The real cause: Heat is a second way to lose that only Exploit has. The gatekeeper curve comes down; Fuzzer's noise is the Exploit lever ✅

Measured this session, and revising B2's lever and B3:

- **Halving all three tracers moved Exploit Heat endings by about 1
  point** (25/37/42% → 25/36/41%). The tracers were not the cause.
  Exploit's own noise is: 16–26 Trace a run, against 7–10 in the
  skeleton era, now that Fuzzer starts in every Exploit loadout. The
  gatekeeper toll also grew once gatekeepers were tuned to closer fights.
  Tracers restored to their original values.
- **Switching the three strong classes' bridges off entirely left them
  at 26–28%** (halved: 26–31%). Bridges carry at most ~5 points, so they
  are a weak balance lever. Restored to their original values.
- **The gap between the classes is Heat, not strength.** Non-Exploit runs
  lose almost only to gatekeepers (Heat endings 5–8%). Exploit runs lose
  to gatekeepers about as often, plus 20–30% to Heat. Session 49's
  78 / 72 / 66 / 60 curve was calibrated when every class shared one way
  to lose.

The user's call:

- **The gatekeeper curve comes down to about 75 / 69 / 63 / 57**, so the
  non-Exploit classes land near 18–20%. This amends session 49's
  DESIGN.md target.
- **Fuzzer's Trace rider is the Exploit lever** (B2 had kept it
  untouched, on the wrong premise). It is set so the Exploit classes
  hold ~15–18% victory with 20–30% Heat endings. Measured: +1 → 11–15%
  victory and 25–42% Heat endings; +½ → 21–24% and 18–25%; +¾ → 17–18%
  and 24–34%.
- **Watch item, recorded for future passes: bridges are a weak balance
  lever.** Class power differences mostly come from elsewhere.

## Open

Being worked through live.
