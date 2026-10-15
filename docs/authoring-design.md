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

## Classes

Bridge passives are **class-exclusive Mods granted at run start**
(DESIGN.md → Classes; today six placeholder bridge Mods in `mods.ts`
share one generic charge rule). Because they're Mods, they may bend
rules (S8).

### C1 — Bespoke bridges, one small rule-bend per class ✅

Each class's bridge is designed around what its two archetypes do,
within A8's "one archetype feeds the other". Each needs its own small
engine hook and its own measurement. The bridge is the class's identity:
the thing that run has and no other class does. This was chosen over one
shared rule tuned per class, or a few shared mechanisms.

### C2 — A bridge is worth about +1.0 Credit per turn (band 0.75–1.25) ✅

The bridge is measured in the class's starting loadout and checked in a
late-run build. It may grow late, but not far past the band. Each class
kit with its bridge also gets the retention check (floor 0.5; Honeypot
classes carry their partner-credit piece, per S11). The user's note:
tune upward later if bridges don't feel impactful enough.

Instrument note: today class passives and Mods apply only to side 0, so
a mirror can't hold one. Pricing a bridge needs the duel to give it to
the test side in both seats, a small engine change made at build time.

### Bridges — built and priced

The placeholder rule in `resolve.ts` is replaced by six bespoke hooks
(`applyBridgeOnFire`, `…OnOccurrence`, `…OnTurnStart`, `…OnSuppress`).
Each side of a combat now carries its own bridge (`CombatState.bridges`;
side 1's exists only for pricing duels, via `opponentBridge`). Priced by
`scripts/class-check.ts` in provisional kits (start = 3 pieces,
late = 6). Raw output: `docs/calibration/step3-classes-bridges.txt`.

| class | bridge | price start / late | retention start / late |
|---|---|---|---|
| Exploit + Overclock | an Exploit beta that applies Empowers the next piece **+½** this turn | 0.73 / 0.87 | 0.89 / 0.73 |
| Exploit + Daemon | each fifteen you score also Suppresses **½** | 1.12 / 1.00 | 0.97 / 0.81 |
| Daemon + Overclock | an Overclock beta that applies grows each Daemon piece one step | 0.65 / 1.43 | 0.93 / 0.51 |
| Exploit + Honeypot | each pair you score banks Ward 1 | 1.26 / 1.37 | 1.04 / 0.88 |
| Daemon + Honeypot | Suppress you deal banks that much Ward, up to **1** a turn | 1.02 / 1.14 | 1.09 / 0.81 |
| Overclock + Honeypot | each turn you take banks Ward 1 | 0.98 / 1.05 | 1.07 / 0.80 |

- **Tuned from the draft:** Exploit + Overclock's Empower 1 → ½
  (1.55 / 1.91); Exploit + Daemon's Suppress 1 → ½ (2.15 / 2.00); Daemon
  + Honeypot's cap 2 → 1 (1.30 / 2.01).
- **Daemon + Overclock scales with Overclock betas owned:** low in a
  3-piece start with only Ping (0.65), high late (1.43). Its starting
  loadout should carry two Overclock beta pieces; settle it with the
  loadouts. It also has the lowest late retention (0.51, just over the
  floor), the Overclock watch item again.
- Exploit + Overclock (0.73) and Exploit + Honeypot (1.26–1.37) sit
  just outside the band, which is acceptable for this pass.

### C3 — Starting loadouts are commons only ✅

Every class starts with plain, readable pieces. Uncommons and rares
arrive through rewards, the Shop and Events, so a run's first rare is a
find and steers the run (S1). Three commons is about 6 Credit a turn plus
the bridge, so classes start level. Daemon + Overclock gets its two
Overclock beta pieces from commons (Ping, Elevated Session). This was
chosen over allowing one uncommon where it shows the bridge better.

### Starting loadouts — built and priced

`src/engine/content/starting-loadouts.ts` (not yet wired). Raw output:
`docs/calibration/step3-starting-loadouts.txt`.

| class | loadout (top → bottom) | bridge start / late | retention start / late |
|---|---|---|---|
| Exploit + Overclock | Fuzzer → Cache Hit → Port Scan | 0.85 / 1.28 | 0.88 / 0.70 |
| Exploit + Daemon | Buffer Overflow → Fuzzer → Cron Job | 1.07 / 1.00 | 0.90 / 0.81 |
| Daemon + Overclock | Cron Job → Ping → **Steady Drip** | 0.82 / 1.97 | 0.94 / 0.53 |
| Exploit + Honeypot | Port Scan → Tarpit → Fuzzer | 1.26 / 1.37 | 1.04 / 0.88 |
| Daemon + Honeypot | Cron Job → Watchdog Timer → Tarpit | 1.02 / 1.14 | 1.09 / 0.81 |
| Overclock + Honeypot | Ping → Tarpit → Rate Limiting | 0.98 / 0.91 | 1.07 / 0.82 |

Every loadout passes the credit rule: its mirror ends by threshold
100% of the time (one late kit, 80%).

Changes from the draft, measured in these loadouts:

- **Exploit + Overclock's Empower ½ → back to 1.** Routed through Cache
  Hit (an Empower piece) it priced 0.40. At 1 it is 0.85 / 1.28.
- **Daemon + Overclock: 1 → 2 growth steps, and Steady Drip replaces
  Elevated Session.** The bridge multiplies Overclock betas by Daemon
  growth pieces, so a 3-piece start needs two of the latter. Measured:
  0.40 drafted, 0.56 at 2 steps, 0.82 with Steady Drip.
- **Watch item: Daemon + Overclock scales hard late** (1.97). It is
  bounded, since bridge growth can't pass a piece's own growth cap, but
  it is the most build-dependent bridge, and its late retention is the
  lowest (0.53). Revisit in playtesting or with fight-length tuning.

### C4 — Class names ✅

| class | name | source |
|---|---|---|
| Exploit + Overclock | **Blackhat** | old roster: "pure offense, reckless, Heat-hungry" |
| Exploit + Daemon | **Operator** | old roster: "setup-and-strike" |
| Daemon + Overclock | **Eidolon** | new (the user's). *Daemon* and *eidolon* are both Greek spirit words: the class that summons its daemons and drives them faster |
| Exploit + Honeypot | **Breacher** | old roster: "hit hard, then hold the position you just took" |
| Daemon + Honeypot | **Warden** | old roster: "patient and grindy, wins by outlasting" |
| Overclock + Honeypot | **Wraith** | renamed from Ghost (the user's call, after C4): a wraith *drains* you, which is the class's conversion; Ghost suggested evasion. With Eidolon it makes a deliberate two-spirits motif |

Saboteur is retired: its identity belonged to the old Malware archetype.
Other names considered for Daemon + Overclock: Cryptominer, Botmaster,
Scheduler, Proclist, and Overwatch (rejected: it's a well-known game's
name, and its meaning is closer to Warden's). Eidolon's known cost is a
thematic overlap with Ghost, now Wraith (two spirit names, kept as a
deliberate motif).

Class ids stay pair-based (`exploit-overclock`, …); the names are display
data.

### C5 — Bridge Mod names ✅

Blackhat **Exploit Chain** · Operator **Backdoor Maintenance** · Eidolon
**Invocation** · Breacher **Foothold** (the old Breacher passive's name) ·
Warden **Hardened Perimeter** · Wraith **Siphon** (was Ghost's Spoofed Traffic, renamed with the class). In code:
`ClassDefinition.name` and the bridge Mods' names in `mods.ts`.

### C6 — Unlock order: Blackhat → Operator → Eidolon → Breacher → Warden → Wraith ✅

Kept from A8's provisional order. Each unlock adds at most one new
archetype beside a familiar one. Honeypot arrives fourth, through its
simplest pairing; Wraith, the hardest, comes last. Not enforced: there is
no save or profile layer yet, so all six are selectable. It fixes the
default class (Blackhat).

## Wiring — the authored pool in real runs

`subroutines.ts` now serves the 36 authored pieces and C3's starting
loadouts. The skeleton pool moved to `skeleton-pool.ts` and feeds only
the **skeleton enemy roster**, until enemies are authored. Raw output:
`docs/calibration/step3-wired-run-level.txt` (300 runs per class, synergy
acquisition, opportunistic traversal, skill 0.85).

| class | victory | heatMaxed + caught | quarantined | own noise/run | skill gap (0.5 → 0.85) |
|---|---|---|---|---|---|
| Blackhat | 27.3% | 24.3% | 47.3% | 17.7 | +12.7 pts |
| Operator | 16.3% | 26.0% | 57.7% | 19.7 | +14.0 |
| Eidolon | **41.3%** | 6.4% | 52.0% | 0 | +24.7 |
| Breacher | 17.0% | 29.6% | 53.3% | 21.6 | +14.0 |
| Warden | 19.0% | 3.3% | 77.7% | 0 | +10.7 |
| Wraith | 22.7% | 6.3% | 70.3% | 0 | +11.3 |

- **Exploit's Heat target is met:** Heat endings average **26.6%**
  across the Exploit classes against **5.3%** for the others, about
  **5×**, at the top of the user's 3–5× band. Own noise is 18–22 Trace a
  run, up from the skeleton's 7–10, because Fuzzer now starts in every
  Exploit kit. It lands almost all as "breached, then caught", as CP6
  predicted. Watch it: one more noisy piece would push past 5×.
- **Skill still decides runs:** better Cribbage adds 11–25 points of
  victory in every class. Class-kit retention is 0.66–1.10.
- **Eidolon is the outlier at 41% victory**, about double the others,
  consistent with its bridge's late scaling (the Daemon + Overclock
  watch item). The first tuning candidate.
- **Victory is 16–27% for the other five,** near the user's 10–20% band.
  But these runs still face the skeleton enemies, and quarantine
  (gatekeeper losses, 47–78%) is the dominant ending. Win-rate tuning
  waits for the authored enemy roster, per R1.

## Enemies (session 55)

### E1 — The session 27/43/49 enemy design holds, with three updates ✅

Kept: tiers scale authoring effort; regular and elite enemies are
stronger commons from the player's catalog; every gatekeeper has at
least one bespoke thematic piece; every enemy needs a credit path; the
per-layer gatekeeper pass-rate target of 0.78 / 0.72 / 0.66 / 0.60;
enemy skill by tier; opening punching bags.

Updates:

1. **Regular and elite enemies draw from the authored 36-piece pool.**
   Depth comes from more and better pieces (uncommons, rares), not just
   magnitude, which session 49 found to be a weak lever. Per-piece
   prices make enemy strength a measured number.
2. **Gatekeepers' bespoke pieces are priced** with the same instrument.
3. **Two-archetype elites and gatekeepers may carry a class bridge** as
   a passive (side 1's bridge slot already exists). Gatekeepers still get
   bespoke passives on top.

### E2 — Initial roster: 18 enemies (6 regular, 4 elite, 8 gatekeepers, 2 per layer) ✅

An initial set, **explicitly to be expanded later** (the user's note),
like the 36-piece pool (S5). Two gatekeepers per layer gives runs variety
while keeping each layer's pair tunable against the pass-rate target;
session 49's within-layer spread is the problem to keep testable. Going
to 3–4 per layer comes once the first pair holds. Six regulars cover each
archetype alone plus two pairs; four elites spread across the
archetypes. Opening punching bags reuse the easiest regular.

### E3 — Difficulty in two stages: power budget, then pass-rate tuning ✅

1. **Author to a power budget set from the player's measured power.**
   Measure the priced output of real players' loadouts at each layer,
   then set budgets as fractions of it: regular ≈ 0.6×, elite ≈ 0.9×,
   gatekeeper ≈ 1.0–1.1× (first guesses; enemy skill is part of
   strength, so measurement refines them).
2. **Tune gatekeepers to the pass-rate target** (0.78 / 0.72 / 0.66 /
   0.60) with `gatekeeper-check.ts` against realistic accumulated
   states, other layers held still (`--syntheticGatekeepers`). Both of
   a layer's pair must land near target, keeping within-layer spread
   small. Regulars and elites are checked loosely: win rates by tier,
   and no run ending dominated by one enemy.

This was chosen over tuning everything straight to pass rates, the trial
and error that gave the old roster 11 enemies at a 100% player win rate.

### E4 — Enemy Mods: none on regulars, a bridge on elites, a bridge plus one bespoke Mod on gatekeepers ✅

**Terminology (the user's call): enemies carry Mods, not "passives"**,
the same word as the player's. Bridges are already Mods, so an enemy's
bridge is the same thing on the other side. In code, `enemyPassiveIds` /
`EnemyPassiveId` get renamed to enemy Mods when the roster is built.

- **Regulars: no Mod.** Their identity is their 1–3 pieces; they
  recur many times a run, so they stay readable and easy to tune.
- **Elites: one class bridge**, for their archetype pair. It reuses the
  six priced bridges and teaches what a bridge does from the other side.
- **Gatekeepers: a bridge plus one bespoke Mod.** The bespoke one
  carries the set piece's identity and, like any Mod, may bend rules
  (S8). Eight of them, each priced by duel inside the gatekeeper's
  budget, on a light registry so more can be added later.

This was chosen over session 27's bespoke passives on every tier (~18
mechanics, mostly on fights the player sees many times).

### E5 — Process: measure, then one checkpoint per tier ✅

1. Measure the player's priced power by layer (E3 stage 1): a budget
   table, signed off before any enemy is drafted.
2. Regulars (6): draft → react → build and price to budget.
3. Elites (4), each with its bridge.
4. Gatekeepers (8) with their bespoke Mods and the Mod registry. Drafted
   together as a deliberate four-layer climb; tuned layer by layer to the
   pass-rate target (E3 stage 2).
5. Retire the skeleton roster and `skeleton-pool.ts`; re-measure full
   runs (victory per class against 10–20%, endings, Eidolon's outlier).

Enemy names reuse the archived session-27 roster where they fit, as the
pieces did (S3).

### E6 — Honeypot enemies hold back until layer 2 ✅

All Honeypot enemies (regular, elite, gatekeeper) get `minLayer: 2`.
Layer 1 shows Exploit, Daemon and Overclock, whose effects read directly
as "it hits me, it heals, it goes fast". Ward and conversion arrive once
the player has a working loadout. Opening punching bags come from layer
1, so they are never Honeypot.

### E7 — Trace pressure on a few "tracer" enemies, time-boxed ✅

The user's framing: an enemy that "doesn't bother to contain you so much
as draw a ton of attention to you." Session 47's `tracePressure` (Trace
added to the player each time the piece fires) gets its first use:

- one regular tracer, from layer 2, with small pressure;
- one elite, with larger pressure (win fast or pay in Heat);
- at most one gatekeeper whose bespoke Mod centres on it.

Priced in Heat via CP6's Trace table (1 Trace ≈ 2.5–3.6% of a layer's
allowance), outside the Credit budget. Watch item: Exploit, already at
~5× Heat endings, takes tracers hardest; the run-level re-measure checks
it stays inside 3–5×.

**Time-box (the user's condition):** if tracers prove difficult to
balance, don't sink time into them. Backlog Trace pressure as a revisit
item and replace the tracer enemies with ordinary ones.

### Enemy step 1 — the player's power by layer, and the budget table

`scripts/player-power.ts`: 20 runs per class (synergy, opportunistic,
skill 0.85), every gatekeeper a guaranteed pass so every run reaches all
four layers. The player is captured at each gatekeeper and priced as
**kit power**: the flat Credit per turn their loadout (with its bridge)
ties in a seat-swapped duel. Raw output:
`docs/calibration/step3-player-power.txt`.

| | start | end of L1 | end of L2 | end of L3 | end of L4 |
|---|---|---|---|---|---|
| player kit power (all classes) | 6.8 | 10.3 | 13.1 | 13.5 | 13.9 |
| pieces installed | 3 | ~4.7 | ~5.9 | ~6.1 | ~6.1 |

**Finding: player power plateaus after layer 2.** The 6 slots fill
during layer 2, and from then on a layer adds only ~0.4 Credit a turn
(Merge ranks, better picks). This is not an enemy problem, but it shapes
the budgets: enemies that kept climbing at layers 3–4 would outrun the
player. The difficulty climb there comes mostly from enemy skill, which
rises by layer, plus the modest budget rise below. **Watch item for
later:** late-run progression feels flat by this measure. Whether layers
3–4 should offer the player more growth (slot unlocks, stronger Merge,
rares) is a progression question, not a roster one.

Budgets, using the power the player has *during* the layer (midway
between its start and end) for regulars and elites, and *end-of-layer*
power for gatekeepers:

| tier | fraction | L1 | L2 | L3 | L4 |
|---|---|---|---|---|---|
| (player during the layer) | | 8.5 | 11.7 | 13.3 | 13.7 |
| regular | 0.6× | 5.1 | 7.0 | 8.0 | 8.2 |
| elite | 0.9× | 7.7 | 10.5 | 12.0 | 12.3 |
| (player at the gatekeeper) | | 10.3 | 13.1 | 13.5 | 13.9 |
| gatekeeper | 1.0–1.1× | 10.3–11.3 | 13.1–14.4 | 13.5–14.9 | 13.9–15.3 |

Regulars and elites recur across layers, so each is authored to its
first layer's budget and scales up from there by `magnitudeScalerFor`.
Its step may need retuning to follow this flatter curve.

Skeleton reference, same instrument: regulars 2.0–11.0, elites 7.2–13.8,
gatekeepers 13.4 / 10.6 / 14.5 / 13.4 (L1–L4), so today's L1 gatekeeper
sits at 1.3× and L2's at 0.8× the player. That's the within-layer and
cross-layer unevenness session 49 found, now visible as numbers.

### Enemy step 2 — the six regulars

`src/engine/content/enemies.ts` (not yet wired; E5 step 5). Priced as
kit power by `scripts/roster-check.ts`. Raw output:
`docs/calibration/step3-regulars.txt`.

| regular | archetype | layers | pieces | scale | power L1 / L2 / L3 / L4 (budget) |
|---|---|---|---|---|---|
| Pentest Script | Exploit | 1+ | Port Scan → Buffer Overflow | 1.25 | 4.9 / 7.4 / 8.4 / 8.4 (5.1 / 7.0 / 8.0 / 8.2) |
| Quarantine Daemon | Daemon | 1+ | Watchdog Timer → Cron Job | 1.15 | 5.0 / 6.7 / 7.3 / 7.7 |
| Relay Node | Overclock | 1+ | Ping → Burst Clock | 1.4 | 4.9 / 7.4 / 8.2 / 8.5 |
| Patch Runner | Exploit + Daemon | 1+ | Port Scan → Patch | 1.3 | 5.5 / 7.5 / 8.3 / 8.7 |
| Legacy Firewall | Honeypot | 2+ | Basic Auth → Tarpit → Rate Limiting | 1.2 | — / 7.4 / 8.6 / 8.8 |
| Tripwire (tracer) | Overclock + Exploit | 2+ | Ping (+¼ Trace pressure) → Doorknob Rattle | 1.6 | — / 5.6 / 6.4 / 6.7, plus 2.7 Trace a fight (7.5% of layer 2's allowance) |

- **Authored scale** (`AuthoredEnemy.scale`) lands a two-common kit on
  budget; two commons as written price ~4–4.5.
- **A layer scaler that follows the player** (`ENEMY_LAYER_SCALER`, 1 /
  1.4 / 1.6 / 1.65) replaces enemies.ts's linear +0.3 a layer, which
  would undershoot layer 2 and overshoot layer 4. It's adopted by the
  engine at wiring.
- **Tripwire (E7) balances easily.** Extra Trace is measured as with
  versus without its pressure, so the player's own noise cancels out.
  Its Credit is deliberately below budget, since the threat is the Heat.
  The time-box was not triggered. The run-level check of Exploit's
  Heat band comes at wiring.
- **Name:** "Script Kiddie" became **Pentest Script** (working name; the
  user wasn't keen on "kiddie"). Alternatives offered: Auto-Scanner,
  Probe Script, Hunter Script.
- **Infrastructure:** `kitPower` moved into `pricing.ts`, shared by
  `player-power.ts` and `roster-check.ts`.

### Enemy step 3 — the four elites

`src/engine/content/enemies.ts` (not yet wired). Priced as kit power
**with each elite's bridge Mod** (`AuthoredEnemy.bridge`; side 1's
bridge slot). Raw output: `docs/calibration/step3-elites.txt`.

| elite | pair (bridge Mod) | layers | pieces | scale | power by layer (budget 7.7 / 10.5 / 12.0 / 12.3) |
|---|---|---|---|---|---|
| Zero-Day Broker | Exploit + Overclock (Exploit Chain) | 1+ | Zero-Day Chain → Port Scan → Credential Stuffing | 0.9 | 8.2 / 9.8 / 12.3 / 12.7 |
| Incident Response | Exploit + Daemon (Backdoor Maintenance) | 1+ | Race Condition → Heartbeat Monitor → Cron Job | 0.95 | 8.0 / 9.8 / 10.9 / 11.3 |
| Blackout Cell | Daemon + Honeypot (Hardened Perimeter) | 2+ | Memory Leak → Sinkhole → Basic Auth | 1.5 | — / 10.8 / 11.7 / 12.3 |
| Intrusion Alarm (tracer) | Overclock + Honeypot (Siphon) | 2+ | Priority Override → Elevated Session (each +⅛ Trace pressure) → Tarpit | 1 | — / 8.7 / 9.9 / 10.1, plus 5.1 Trace a fight (14% of layer 2's allowance) |

- **Trace pressure multiplies with how often a piece fires.** At the
  drafted ½ a fire, Intrusion Alarm pushed 20 Trace a fight (57% of the
  allowance): its pieces fire on turns *and* as immediate betas, and the
  measurement fights starting kits, which make for long fights. At ⅛ it
  is 5.1, double Tripwire's, which is the intended "win fast or pay".
  Measured against starting kits, so it's an upper bound; a stronger
  real player ends the fight sooner.
- The time-box was not triggered: two tracers balanced with one sizing
  step each. Run-level Exploit Heat is re-checked at wiring.

### Enemy step 4a — the eight gatekeepers, built; stage 1 pricing

`src/engine/content/enemies.ts`: 8 gatekeepers with 8 bespoke pieces.
`src/engine/gatekeeper-mods.ts`: the Mod registry (E4), with eight
Mods looked up by id at resolve.ts's hook sites: the per-turn Credit
cap and tax, first-Credit discard, piercing absorption, Trace per fire,
a doubled first Exploit beta, a double first turn, and rising growth
caps. Each has a unit test (`gatekeeper-mods.test.ts`). Each side of a
combat carries `sideMods`; side 0's exist only for pricing duels. Raw
output: `docs/calibration/step3-gatekeepers-stage1.txt`.

| layer | gatekeeper | bridge | bespoke Mod | stage-1 power (budget) |
|---|---|---|---|---|
| 1 | The Concierge | Exploit Chain | Reception Protocol | 9.4 (10.8) |
| 1 | Firewall Prime | Backdoor Maintenance | No Way In | can't be priced this way |
| 2 | Quarantine Ward | Hardened Perimeter | Containment | 12.9 (13.8), scale 1.35 |
| 2 | Zero-Sum | Siphon | Zero-Sum | 12.1 (13.8) |
| 3 | Adaptive Threat | Invocation | Adaptation | 12.6 (14.2) |
| 3 | Total Compromise (tracer) | Foothold | Spotlight | 10.1 (14.2), plus 2.9 Trace a fight (9% of layer 3) |
| 4 | Null Session | Siphon | Null Session | can't be priced this way |
| 4 | Root Authority | Invocation | Root Access | 13.8 (14.6) |

**Instrument limit, expected:** kit power measures a kit against a
single flat-Credit opponent. Mods that act on the *opponent's gain* (No
Way In's cap, Null Session's discard) neutralise that reference
entirely, so no Credit amount ever ties them. Their strength exists only
relative to a real player, so they are priced by stage 2, which is
where every gatekeeper is finally tuned anyway (E3).

Stage 2 needs the authored gatekeepers in real runs, since
`gatekeeper-check.ts` pins a gatekeeper inside real runs. That means
wiring the roster (E5 step 5) before stage 2 rather than after.

### Enemy steps 4b and 5 — wired in, and gatekeepers tuned to the pass-rate curve

**Wired** (`f74c33f`): `ENEMY_ROSTER` is the 18 authored enemies. Each
enemy fight passes its bridge and gatekeeper Mods (`enemyCombatOptions`).
Regular and elite magnitude follows `ENEMY_LAYER_SCALER` from the
enemy's authored first-layer scale; a gatekeeper's authored scale is its
stored `magnitudeScaler`. `skeleton-pool.ts` is deleted. Total
Compromise swapped Jackpot for Credential Stuffing, because Jackpot's
beta writes Trace to its owner and Trace is player-only (a standing
test). The legacy `EnemyPassiveId` slot remains always empty in
playCombat's positional signature; remove it with that parameter.

**Stage 2** (E3): `gatekeeper-check.ts`, 300 seeds per class, every layer
synthetic, so every run reaches every gatekeeper. Each captured state is
re-fought against the real gatekeeper at the real enemy skill dial.
Pass rate moves about 1 point per 0.01 of scale, so two rounds of
interpolation plus one nudge landed it. Raw output:
`docs/calibration/step3-gatekeepers-stage2.txt`.

| layer | target | gatekeeper | baseline → final | scale |
|---|---|---|---|---|
| 1 | 78% | Firewall Prime | 74.1 → **78.0** | 0.96 |
| 1 | | The Concierge | 83.1 → **79.8** | 1.06 |
| 2 | 72% | Quarantine Ward | 59.3 → **72.1** | 1.22 |
| 2 | | Zero-Sum | 91.1 → **74.3** | 1.17 |
| 3 | 66% | Adaptive Threat | 75.1 → **65.9** | 1.18 |
| 3 | | Total Compromise | 98.9 → **65.0** | 1.6 |
| 4 | 60% | Null Session | 91.8 → **60.8** | 1.35 |
| 4 | | Root Authority | 65.0 → **61.1** | 1.07 |

The curve across all classes is **78.8 / 73.3 / 65.4 / 61.0%** against
78 / 72 / 66 / 60. **Within-layer spread is at most 2.3 points**, against
session 49's up to 57: the problem session 49 found is closed.

Noted, not changed: a gatekeeper reached inside the run's opening window
(the first 3 fights, by beelining) plays at skill 0, because
`enemySkill`'s opener pin applies to every tier.

### Step 3's full-run result

300 runs per class with everything authored: pool, classes and roster.
Raw output: `docs/calibration/step3-final-run-level.txt`.

| class | victory | Heat endings (maxed + caught) | quarantined | skill gap (0.5 → 0.85) | late retention |
|---|---|---|---|---|---|
| Blackhat | 14.3% | 25.4% | 60.3% | +7.3 pts | 0.53 |
| Operator | 11.0% | 36.6% | 52.3% | +7.3 | 0.58 |
| Eidolon | **31.0%** | 6.7% | 62.0% | +20.0 | 0.60 |
| Breacher | 14.3% | **41.7%** | 44.0% | +8.7 | 0.69 |
| Warden | **27.0%** | 7.6% | 64.7% | +23.3 | 0.98 |
| Wraith | **27.7%** | 9.3% | 62.3% | +16.7 | 0.76 |

- **The three Exploit classes sit inside the 10–20% band; the three
  others are above it (27–31%).** Mean 20.9%.
- **Exploit's Heat ratio is 4.4×**, inside the user's 3–5×. But the
  absolute rate is now 25–42%, up from 24–30% before the roster, because
  the tracers add to it. "Breached, then caught" is the commonest way an
  Exploit run ends. That pins Exploit victory near the band's floor.
- **Skill matters least for Exploit runs** (+7–9 points against +17–23
  for the others): their runs end on Heat, which Cribbage skill barely
  moves. Late-run retention passes the floor everywhere; Blackhat is
  closest, at 0.53.
- **Not separable by gatekeeper tuning:** the gatekeepers are on curve
  for the pooled cohort. The class split comes from Heat (Exploit) and
  from build strength (Eidolon, the standing watch item). It needs its
  own pass.

## Open

Deferred to the point where they're needed, since neither blocks the
archetype checkpoints:

- **Bridge passives:** decided with the classes, once all four
  archetypes exist. A passive is shaped by which pieces it can feed.
- **Enemy construction:** decided with the roster, after the classes.
