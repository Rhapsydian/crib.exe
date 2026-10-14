# Authoring (step 3) — working decision record

Step 3 of the archetype redesign (`docs/archetype-redesign.md` A10):
author the real subroutine pool, then the classes, then the enemy roster,
against `DESIGN.md` → Pricing. Started session 54 (`/decision-session`,
2026-10-14).

## Decisions

### S1 — Rarity is about what the beta does, not raw power ✅

Every piece keeps an alpha and a beta (session 51's model). Rarity
changes the beta's character; priced output per turn rises only modestly
(a rare perhaps 20–30% above a common), because CP6b found big flat
power erodes the skill signal.

- **Common:** a straightforward alpha, and a beta that fires often on an
  easy-to-read trigger, in the archetype's signature shape. Usually it
  enhances the alpha or uses the same verb. Commons carry every
  archetype's credit path.
- **Uncommon:** the beta gets a condition or a twist. That can be a
  rarer trigger (pair royal, run of 4+, the opponent's scoring, a big
  hand), a different effect from the alpha, or a sequence link to other
  pieces.
- **Rare:** a build-around. The beta, or the piece, bends a rule and
  invites a strategy. Usually priced by direct duel, since these are
  the cases the formula hands off.

### S2 — No seed concepts; Claude drafts, the user reacts ✅

The user has no favourite pieces: the game has never been in a playable
state, so there's nothing yet to have favourites from. Claude drafts
each archetype's pieces for the user to react to. This raises a later
decision (S-open below): whether a minimal playable build should come
early, since until then every piece is judged by simulation alone.

### S3 — Reuse the old pool's names, not its mechanics ✅

Names and themes from the archived 159-piece pool
(`docs/design-history.md`) are reused where they fit the new archetypes.
Every piece gets new mechanics, designed against the seven verbs and
the Pricing rules. Names tied to retired themes (Malware, Encryption,
Root) stay archived unless they genuinely fit.

### S4 — Author first; a playable build comes after ✅

The user chose to stay with the planned order: author the content, then
build the UI. This first set isn't the final content, so playtesting
can reshape it later. The interleaved option (draft Exploit, build a
one-fight UI, play it) was offered and declined.

### S5 — Initial set: 36 pieces, 9 per archetype (4 common, 3 uncommon, 2 rare) ✅

An initial set, explicitly to be built on later. A class draws on 18
on-class pieces for its 3 open slots. Two rares per archetype give two
different build-arounds. Growing the pool later only means following
the same Pricing rules.

### S6 — Power budget per rarity, in Credit per turn ✅

| rarity | target | band |
|---|---|---|
| common | 2.0 | 1.8–2.2 |
| uncommon | 2.25 | 2.0–2.5 (expected value) |
| rare | 2.5 | 2.2–2.8, in the build it invites |

- Bands rather than exact numbers, because the instrument resolves only
  ±0.1–0.3 (turns-to-win steps).
- An uncommon's average output (formula or duel) must land in its band:
  swingier is allowed, stronger on average is not.
- A rare is priced by duel in the build it invites, and must be at least
  common-level on its own, so picking one is never a trap.
- These are opening figures. Fight-length and win-rate tuning after step
  3 can scale all three together; the ratios matter more than the
  absolute numbers.

### S7 — One archetype per checkpoint: Exploit → Daemon → Overclock → Honeypot ✅

Each checkpoint has five stages:

1. **Draft:** Claude proposes the archetype's 9 pieces on paper (name,
   rarity, alpha, beta, role, expected price).
2. **React:** the user cuts, changes or renames them live, before any
   code.
3. **Build and price:** the pieces go into the pool alongside the
   skeleton. The formula prices what it can; the rares, and whatever the
   formula hands off, are priced by duel.
4. **Check:** the credit rule (a kit of this archetype's commons alone
   can win); every piece inside its rarity band (S6); skill retention
   ≥ 0.5 on this-archetype kits, early and late; and the archetype's
   watch items (Heat for Exploit, conversion for Honeypot).
5. **Sign-off**, then the next archetype.

Exploit goes first: it is the provisional starter and has the clearest
theme. Honeypot goes last: it carries both of the user's watch items, and
conversion needs the other archetypes' offense to measure against.
Overclock comes after Daemon because it is the retention risk. The
classes come after all four archetypes; until then the class starting
loadouts stay on skeleton pieces, and the skeleton is retired when the
classes switch over.

### S8 — Rares stay inside the model; rule-bending belongs to Mods ✅

The user's call. A rare's build-around comes from the existing verbs,
sources and shapes (Charge, conditions, opponent-watching), never from
a new piece-level rule like "your fifteens count as runs". Mods are
where rules bend.

## Checkpoint 1 — Exploit

`src/engine/content/exploit.ts`: 9 pieces, not yet wired into
acquisition (the skeleton keeps feeding runs until the classes switch
over). Checked by `scripts/archetype-check.ts`. Raw output:
`docs/calibration/step3-cp1-exploit.txt`.

| piece | rarity | alpha | beta | price |
|---|---|---|---|---|
| Buffer Overflow | C | Credit 1 | each fifteen: +1 (cap 1) | 1.89 |
| Port Scan | C | Credit 1 | each pair: +1 (cap 2) | 2.15 |
| Fuzzer | C | Credit 1 | each Exploit-suit card played: +1, +1 Trace (cap 2) | 1.85 |
| Doorknob Rattle | C | Credit 1 | each go: Slow the opponent 3/8 turn (cap 2) | 1.83 |
| Credential Stuffing | U | Credit 1 | each opponent fifteen: +1 (cap 2) | 2.15 |
| Jackpot | U | Credit 1 | while 12+ this hand: +3, +1 Trace | 2.12 |
| Man in the Middle | U | Credit 2 | opponent's 3rd pair: force a discard next hand | 2.19 |
| Zero-Day Chain | R | Credit 2 | each fifteen: charge the next piece | 2.00 alone, 2.49 above Port Scan |
| Race Condition | R | Credit 1 | while the opponent's win gauge is under ½: +2 | 2.14 alone, 2.40 with Suppress 2 |

Tuning from the first draft, all measured:

- **Doorknob Rattle:** Slow ⅛ → **⅜ turn**. Slow is worth less than its
  size suggests: ⅛ priced 1.42 and ¼ priced 1.71.
- **Jackpot:** +4 → **+3** (2.52, just over the band).
- **Man in the Middle:** 2nd → **3rd opponent pair** (2.51 → 2.19).
- **Zero-Day Chain's build:** above Buffer Overflow, the charge was
  wasted, because Buffer Overflow's cap-1 beta is already full when a
  fifteen lands. Above Port Scan it turns fifteens into pair bonuses
  (2.10 → 2.49). **Authoring rule: a Charge partner needs cap to spare
  when the charge arrives.**
- **Race Condition:** under ¼ → **under ½**. The condition reads the
  opponent's *win* gauge, and Exploit's Slow moves their *initiative*
  gauge, so no Exploit piece can build toward it. Its build is
  cross-archetype: Suppress (Daemon's healing) lifts it to 2.40. It's a
  rare for the Exploit + Daemon class. Re-check it against Daemon's real
  pieces at checkpoint 2.

Kits:

| kit | threshold wins | retention | Trace per fight |
|---|---|---|---|
| skeleton Exploit (CP6's reference) | 100% | 0.67 | 4.27 |
| commons only | 100% (credit rule ✅) | 0.86 | 4.35 |
| early (3 pieces) | 100% | 0.94 | 0 |
| late spike (6) | 100% | 0.59 | 3.92 |
| late control (6) | 100% | 0.70 | 0 |

- **Retention** stays above the floor everywhere. The late spike build
  is lowest, at 0.59.
- **Noise** matches the skeleton's Fuzzer, which produced CP6's 3–5×
  Heat endings, in every kit that carries Fuzzer or Jackpot. Control
  kits are quiet. Exploit's Heat identity therefore depends on picking
  the noisy pieces, so the starting loadouts should include one when
  the classes are authored. Run-level Heat is re-measured then.

## Open

Deferred to the point where they're needed, since neither blocks the
archetype checkpoints:

- **Bridge passives:** decided with the classes, once all four
  archetypes exist. A passive is shaped by which pieces it can feed.
- **Enemy construction:** decided with the roster, after the classes.
