# Text audit — subroutines, Mods, Burners (session 60)

> **Status: complete (session 60); historical.** The wording rules were implemented; the class Mods it skipped were rewritten in their redesign the same session.

Every rules text as players see it today was dumped with
`npx tsx scripts/text-dump.ts`. The class Mods are skipped (they're
being reworked). Almost every problem comes from a handful of templates in
`src/ui/describe.ts`, so the fix is a set of wording rules, each applied
everywhere it fits.

## What's wrong, by pattern

| # | Problem | Today | Where it shows |
|---|---|---|---|
| 1 | A bare "+1" with no subject: +1 *what*? | Buffer Overflow: "each fifteen you score: +1 (up to 1)" | 14 Hooks |
| 2 | "(up to N)" doesn't say what's capped, or that charges bank between fires | Port Scan: "each pair you score: +1 (up to 2)" | every graded Hook |
| 3 | "after 3× each pair…" is garbled | Man in the Middle: "after 3× each pair the opponent scores: force a discard next hand" | stepped Hooks |
| 4 | Instant Hooks read as fragments | Ping: "instant (outside the turn) · the moment a pair you score (×2): fire again" | 5 Hooks |
| 5 | "card" where it means a playing card, unexplained | Fuzzer: "each card of this suit you play" — which suit? | Fuzzer |
| 6 | Jargon with no explanation | "charge the next piece", "Empower", "Haste", "Slow", "steal", "(piercing)", "plain Credit" | many |
| 7 | "win gauge" instead of the names on screen | "while their win gauge is under ½" | 7 Hooks |
| 8 | Odd counting phrases | "every 1 Ward absorbed", "every 10 points you score" (it's "10 since it last fired") | Honeytoken, progress Hooks |
| 9 | A number that rounds to 0 | Turbo Mode: "lower your initiative threshold 0" (really 1/24, about 4%) | Turbo Mode |
| 10 | Mods that describe mechanics, not effects | Threshold Exploit: "Hooks that need several hits need 1 fewer"; Cache Prefetch: "Hooks that count scoring or progress start each fight with 1 charge" | 4 Mods |

## Rules (approved and implemented in session 60)

The user's review settled: "subroutine", never "piece"; Empower says what
gets bigger; a charge is "one extra count" (with the edge cases in the
glossary); Haste/Slow spell out the initiative; the glossary (R11) is in.
The templates are `src/ui/describe.ts`, `MOD_TEXT` in `src/ui/kit.ts` and
`burnerText` in `src/ui/reward-text.ts`.

**R1. Say what gets bigger.** An "enhance" Hook names the Process's own
verb: *"+1"* → *"Credits 1 more"* (or Suppresses / Wards 1 more).

**R2. Graded Hooks count since the last fire, with the cap as an amount.**
- Buffer Overflow: *"each fifteen you score: +1 (up to 1)"* → *"Credits 1 more if you've scored a fifteen since it last fired."*
- Port Scan: *"each pair you score: +1 (up to 2)"* → *"Credits 1 more for each pair you've scored since it last fired (at most 2 more)."*
- Doorknob Rattle: *"each go you score: Slow them ⅜ turn (up to 2)"* → *"For each go you've scored since it last fired, drains ⅜ of a turn from their initiative (at most twice)."*

**R3. Stepped Hooks: "once … since it last fired".**
- Man in the Middle: *"after 3× each pair the opponent scores: force a discard next hand"* → *"Once the opponent has scored 3 pairs since it last fired: next hand, they're forced to throw away a card that hurts them."*
- Watchdog Timer: *"every 10 points you score: Credit 1"* → *"If you've scored 10+ points since it last fired: also Credit 1."*
- Cron Job: *"every 3rd fire: Suppress 1"* → *"Every 3rd time it fires: also Suppress 1."*

**R4. Instant Hooks lead with "Instant" and read as a sentence.**
- Ping: *"instant (outside the turn) · the moment a pair you score (×2): fire again"* → *"Instant: each time you score 2 pairs, it fires an extra time right away, outside the turn."*
- Priority Override: *"… the moment you've scored 12+ this hand: Haste ¾ turn"* → *"Instant: the moment you've scored 12 points this hand, fills ¾ of a turn on your initiative."*

**R5. Name the suit, with its icon.** Fuzzer: *"each card of this suit you play: +1, and also gives the opponent 1.75 (up to 2)"* → *"Credits 1 more for each [bug icon] Exploit card you've played since it last fired (at most 2 more) — but whenever it does, it also adds 1.75 to their Containment."* (The icon renders as the suit's, as in the coach.)

**R6. Replace jargon with what happens.** Keep the game's terms where they're
taught on screen (Credit, Suppress, Ward), and spell out the rest:

| Today | Proposed |
|---|---|
| Empower the next piece +1 | Empower 1: the next subroutine's Process Credits, Suppresses or Wards 1 more this turn |
| charge the next piece 1 | give the next subroutine's Hook one extra count |
| Haste ¾ turn | add ¾ of a turn (9 initiative) to your initiative gauge — the number from the live threshold in a fight, the usual 12 elsewhere |
| Slow them ⅜ turn | remove ⅜ of a turn (4.5 initiative) from their initiative gauge |
| steal 1 | take 1 from their Containment and add it to your Breach |
| Credit 2 from your Ward | spend 2 of your Ward to Credit 2 |
| (piercing) | (ignores their Ward) |
| plain Credit (Mods) | Credit (not steals or Ward-spending) |

**R7. Use the on-screen gauge names.** *"while their win gauge is under ½"* →
*"while their Containment is under half"*; yours is Breach.

**R8. Natural counting.** Honeytoken: *"every 1 Ward absorbed: Credit 1 (piercing) (up to 2)"* →
*"For each point of their Credit your Ward has absorbed since it last fired, also Credits 1 that ignores their Ward (at most 2)."*

**R9. Threshold changes as a percentage.** Turbo Mode: *"lower your initiative threshold 0"* → *"lowers your initiative threshold by 4% (your turns come a little sooner)."*

**R10. Mods say the effect:**
- Threshold Exploit → *"Hooks that wait for several events (\"once you've scored 3 pairs\") need one fewer (never fewer than 1)."* (Corrected while implementing: the Mod only shortens "once N events" Hooks, not "every Nth fire" or points Hooks.)
- Cache Prefetch → *"Hooks that count scoring or points start each fight with one charge already banked."*
- Firmware Patch → *"Your Hooks do 1 more whenever they Credit, Suppress or Ward — or add to a Process that does."*
- Boot Sector / Rootkit Persistence / Session Hijack Relay → *"Each of your turns, an extra Overclock piece fires after your loadout: Credit 1."* (in place of "a free … piece below your loadout")

**R11. A glossary in the detail panel.** When a text uses a
term (Credit, Suppress, Ward, Empower, Haste/Slow, charge, steal), the
detail panel lists a one-line definition under the rules. It helps players
who tap a piece to learn it; the hover tip stays short.

## Fine as they are

The Burners read well (Recon Ping is set aside). Most Mods are clear:
Light Footing, Warm Boot, Vendor Discount, Backup Generator, Petty Cache,
Cold Boot, Quiet Hours, Petty Theft, Init Script, the Amplifiers, Salvage
Protocol, Fast Learner, Black Budget, Heat Sink.

Also: the state line says "Hook count: N" (was "N charges banked"); enemy
text is re-voiced in one pass so gauge names swap too (their Containment
is your Breach); the Fuzzer's suit renders as its icon and name.

The class Mods' text is left for their redesign.
