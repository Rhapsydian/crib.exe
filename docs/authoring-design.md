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

## Open

Deferred to the point where they're needed, since neither blocks the
archetype checkpoints:

- **Bridge passives:** decided with the classes, once all four
  archetypes exist. A passive is shaped by which pieces it can feed.
- **Enemy construction:** decided with the roster, after the classes.
