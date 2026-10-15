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

### S9 — Growth is priced in a mid-length fight (host Credit 4) ✅

Growth's worth depends on fight length. Measured fight lengths:

| fight | hands |
|---|---|
| the standard host-2 duel | ~10 |
| host 4 | ~8 |
| host 8 | ~5 |
| an early 3-piece kit mirror | ~10 |
| a late 6-piece kit mirror | ~4 |

(A turn is one initiative-gauge fill, about 1.06 per hand at skill 0.85,
so turns and hands run nearly one to one.)

**Pieces with growth are priced against a Credit-4 host (~8 hands)**, with
their host-2 and host-8 prices reported as the range. Everything else
stays at host 2. Ramp is meant to be strongest in long fights, and
Daemon's healing is what keeps fights long. **This amends DESIGN.md →
Pricing.**

The user's framing for the pass: be mindful of balance with real
measurements, but this pass needn't be perfect.

### S10 — Conversion keeps its Ward bypass ✅

Credit stolen from the opponent and Credit spent from your own Ward skip
the opponent's Ward and incoming-credit Mods. Only plain Credit is
absorbed. The user's call: keep the bypass, since it is what makes
Honeypot the answer to a defensive opponent. It is contained by keeping
steals small (1 point) and conditional, and the steal pieces are priced
a second time against a host carrying Ward, to measure the bypass
directly.

### S11 — Honeypot carries its own skill-scaled offense; Honeypot classes still carry partner credit ✅

Found at checkpoint 4: when a kit's offense is mostly conversion,
Cribbage skill helps the opponent. The better player's extra turns send
more Credit into the weaker player's Ward, where it converts back
against them. Measured as a retention of −0.62 to −0.85 in
conversion-only mirrors, against 0.98 with one plain-Credit piece added.

The user's call (option 2, with option 1 as backstop):

- **Two of the four Honeypot commons have a plain Credit alpha**, with
  conversion in their betas, so Honeypot's own offense scales with your
  turns.
- **Backstop:** Honeypot classes still carry the partner archetype's
  credit piece in their starting loadout (A9), and retention is checked
  on class kits too.

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

## Checkpoint 2 — Daemon

`src/engine/content/daemon.ts`: 9 pieces, not yet wired. Raw output:
`docs/calibration/step3-cp2-daemon.txt`. Growth pieces are priced at
host 4 (S9).

| piece | rarity | alpha | beta | price |
|---|---|---|---|---|
| Cron Job | C | Credit 1, +0.25/fire (to +2) | every 3rd fire: Suppress 1 | 2.10 (host 2: 2.49, host 8: 1.20) |
| Watchdog Timer | C | Suppress 1 | every 10 points: Credit 1 | 1.96 |
| Steady Drip | C | Credit 1, +0.25/fire (to +1) | every 20 points: +1 | 2.20 (band edge) |
| Patch | C | Suppress 1, +0.25/fire (to +1) | every 2nd fire: Credit 1 | 1.96 |
| Memory Leak | U | Credit 0, +0.5/fire (to +3) | every 25 points: Suppress 2 | 2.50 (host 2: 2.83, host 8: 1.70) |
| Heartbeat Monitor | U | Suppress 1 | while the opponent's win gauge is over ½: +3 | 2.44 |
| Failover | U | Credit 1 | while your win gauge is under ½: +3 | 2.12 |
| Load Balancer | R | Credit 2 | every 15 points: charge every other piece | 2.00 alone, 2.35 with Cron Job + Watchdog |
| Fork Bomb | R | Credit 1, +0.25/fire (to +2) | every 4th fire: Credit 3 | 2.60 |

Tuning from the draft, all measured:

- **Growth was overtuned everywhere.** Memory Leak's +1/fire to +4
  priced 4.3. Reduced to +0.5/fire to +3, with its Suppress 3 → 2.
  Steady Drip went from +0.5 to +2 down to +0.25 to +1, and Fork Bomb
  from +0.5 to +4 and Credit 4 down to +0.25 to +2 and Credit 3.
- **Heartbeat Monitor** +2 → **+3** (1.8 → 2.44).
- **Failover:** under ¼ +2 → **under ½ +3**. Under ¼ rarely holds in a
  fight you go on to win.
- **Load Balancer:** alpha Credit 1 → **2**. Alone, its charges have
  nothing to feed, so it was 1.0, below the rare floor of "at least a
  common on its own".
- **Exploit's Race Condition** +2 → **+3**. Daemon's real Suppress
  pieces are Suppress 1, not checkpoint 1's Suppress-2 stand-in. With
  Watchdog Timer it prices 2.53; with Patch and Heartbeat Monitor,
  2.34; alone, 2.56.

Kits: the credit rule holds; retention is **0.81–1.02**, the highest yet,
as predicted, because ramp and healing make fights long. Daemon makes no
noise.

**Watch item: Fork Bomb's build isn't confirmed.** Priced above the
Haste ¼ stand-in it is 2.60, the same as alone, so the Overclock stand-in
added nothing. Re-check it against Overclock's real pieces at
checkpoint 3.

## Checkpoint 3 — Overclock

`src/engine/content/overclock.ts`: 9 pieces, not yet wired. Raw output:
`docs/calibration/step3-cp3-overclock.txt`. Pieces that depend on their
neighbours are priced in their designed position. `priceAddition` now
takes a numeric placement, so a piece can be inserted mid-build.

| piece | rarity | alpha | beta | price |
|---|---|---|---|---|
| Ping | C | Credit 1 | every 2nd pair: fire again (immediate) | 1.80 |
| Cache Hit | C | Empower 1 (next) | each fifteen: +1 (cap 1) | 1.89 above a Credit piece |
| Burst Clock | C | Credit 1 | +1 per Overclock neighbour (cap 2) | 2.10 beside Ping |
| Elevated Session | C | Credit 1 | every 2nd go: Haste ¾ turn (immediate) | 1.88 |
| Priority Override | U | Credit 1 | the moment you reach 12+ this hand: Haste ¾ turn | 2.15 |
| Port Forward | U | Credit 1 | every 2nd pair: Empower 2 (next) | 2.12 above a Credit piece |
| Grand Slam | U | Credit 1 | +1 per earlier elevated Overclock fire this turn (cap 3) | 2.00 after an Overclock pair |
| Chain Reaction | R | Credit 2 | per earlier elevated Overclock fire: Empower every piece below +¼ (cap 2) | 2.00 alone, 2.25 in build |
| Turbo Mode | R | each fire: initiative threshold −1/24, permanent (floor ⅓; 15-point cooldown) | every 2nd fifteen: Credit 3 (immediate) | 2.56 alone, 2.76 with Fork Bomb + Cron Job |

Tuning from the draft, all measured:

- **Flat haste is worth little.** Elevated Session's ⅛-turn alpha haste
  with its cooldown priced 0.96. The haste moved into the beta, as a big
  occasional ¾ turn. Priority Override's haste went from ¼ to **¾** as
  well (1.46 → 2.15).
- **Measurement trap, now designed out:** inserting a sequence piece
  beside Burst Clock gives *Burst Clock* an extra Overclock neighbour,
  so the price measured that neighbour's bonus. Grand Slam's "3.25"
  didn't move with its cap. Sequence pieces are now priced with a
  neutral spacer. **Authoring rule: price a sequence piece away from
  other adjacency pieces, or the price includes their bonus.**
- **Chain Reaction** scales with every piece below it. Empower +1 each
  priced 4.25 with only two below, so it's now **+¼** per piece per
  earlier fire. It grows past band in bigger builds by design, since it
  is the build-around.
- **Turbo Mode's** beta Credit 2 → **3** (1.87 alone, under the rare
  floor).
- **Fork Bomb's build is confirmed** (the checkpoint 2 watch item): 2.30
  beside Turbo Mode and 2.90 [2.50, 3.30] beside Elevated Session, both
  up from its 2.60 with the stand-in. The second is slightly high, which
  is acceptable for this pass.

Kits: the credit rule holds. **Retention is 0.61–0.92**, above the floor
but lower than with the draft's weaker haste (commons-only kit 0.88 →
0.70, late tempo 0.75 → 0.64). Big hastes are the skill cost CP6b
predicted. **Watch item: late Overclock fights are very short** (2.8–3.6
hands), the shortest so far, and fight length is what retention tracks.
Revisit with the win-rate and fight-length tuning after step 3.

## Checkpoint 4 — Honeypot

`src/engine/content/honeypot.ts`: 9 pieces, not yet wired. Raw output:
`docs/calibration/step3-cp4-honeypot.txt`.

| piece | rarity | alpha | beta | price |
|---|---|---|---|---|
| Tarpit | C | Ward 2 | while your Ward is over 3: Credit 2 from your Ward | 1.91 |
| Honeytoken | C | Credit 1 | each Ward absorbed: Credit 1, piercing (cap 2) | 2.21 beside Ward 2 (band edge) |
| Basic Auth | C | Ward 2 | while your Ward is over 4: Credit 1 | 1.90 |
| Rate Limiting | C | Credit 1 | each opponent fifteen: Ward 1 (cap 2) | 2.12 |
| Sinkhole | U | Ward 2 | while your Ward is over 4: Credit 3 from your Ward | 1.90 (just low) |
| Fail2Ban | U | Credit 1 | each opponent pair: steal 1 | 2.21 |
| Deep Packet Inspection | U | Ward 1 | while the opponent is past ½: +3 | 1.99 (band edge) |
| Zero Trust | R | Ward 1 | every 2 Ward absorbed: steal 1 (cap 1) | 1.77 alone (just low), 2.33 with Basic Auth |
| Air-Gapped Vault | R | Credit 2 | while your Ward is over 8: +3 | 2.00 alone, 2.47 with Basic Auth + DPI |

**The user's watch items, both measured:**

- **Defense that never converts: found and fixed.** The first draft's
  all-commons kit finished only 2% of mirror fights: both sides' Ward
  absorbed the other's plain Credit, and the fights stalled to the
  hand limit. Conversion that bypasses Ward (S10) is what lets Honeypot
  finish. Every kit now ends by threshold, the turtle included.
- **Conversion bypassing Ward: measured, contained.** At volume, the
  first draft's Zero Trust (Ward 2, cap-3 steals) gained +1.3 Credit a
  turn against a Ward host (3.64 → 4.92). The final small steals gain
  ~0 (Fail2Ban 2.21 → 2.23, Zero Trust 2.21 against Ward).

**New finding: absorbed-fuelled conversion inverts skill (S11).** Ward
absorbed is powered by the *opponent's* attacks. When a kit's offense is
mostly that kind of conversion, the better player's extra turns feed the
weaker player's conversions. Retention measured −0.33 to −1.02. Two
things fixed it, both measured:

- plain Credit alphas on Honeytoken and Rate Limiting (S11);
- **Tarpit rebuilt to spend your own banked Ward** instead of Ward
  absorbed.

Lower conversion rates alone did not help (−0.4 to −0.56).

**Authoring rule:** Honeypot's main conversion spends your own Ward,
which scales with your turns. Absorbed-fuelled conversion stays small
(cap 1–2). Final kits: retention **0.78–0.92**; credit rule ✅.

Other tuning: Fail2Ban now steals on every opponent pair (it was every
2nd); Deep Packet Inspection is "while the opponent is past ½, +3" (an
immediate Ward 4 at ¾ fired too rarely, 1.27). Four pieces sit at or
just outside their band edges (Honeytoken, Sinkhole, DPI, Zero Trust
alone), all within ~0.25, which is acceptable for this pass.

## Open

Deferred to the point where they're needed, since neither blocks the
archetype checkpoints:

- **Bridge passives:** decided with the classes, once all four
  archetypes exist. A passive is shaped by which pieces it can feed.
- **Enemy construction:** decided with the roster, after the classes.
