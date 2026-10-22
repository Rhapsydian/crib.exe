# Enemy review (session 60)

> **Status: complete (session 60); historical.** Its open item, the player-side content pass, is the next priority in `BACKLOG.md`.

Why (the user): the content pool is shallow. Enemies are mostly player
loadouts scaled up, elites lost their only Mod when class Mods became
the player's alone (docs/class-mod-redesign.md K6), and the roster is
thin (six regulars, none new after layer 2).

Order (the user's call): elite Mods and the gatekeeper Mod text first;
enemy-only subroutines and roster breadth after, as a content pass.

## Gatekeeper Mod text

Rewritten to docs/text-audit.md's rules ("Hook", "subroutine", what
actually happens). Null Session now says the whole first gain is lost,
however large -- what the engine does.

## Elite Mods

Frame: each bends **one rule the player can feel**, like a gatekeeper
Mod but smaller; thematic to the elite and its two archetypes; never a
class Mod. The elites' scales are re-tuned after all four exist.

- **EM1. Threat Intel Feed (was Zero-Day Broker; Exploit/Overclock): Reverse Engineering** --
  every fifteen and pair you score also counts toward its Hooks. A
  defender studying your moves; its spike engine (Zero-Day Chain on
  fifteens, Port Scan on pairs) runs off your scoring too. Chosen over
  "your hand is revealed to it" (the player barely feels it).

- **EM2. Incident Response (Exploit/Daemon): Rollback** -- the first time
  each fight your Breach passes three-quarters, it pushes it back to
  half. Incident response restoring a known-good state: Daemon healing as
  one visible moment, landing you where Heartbeat Monitor heals harder. A
  big once-a-fight swing (a quarter of your Breach); the scale re-tune
  absorbs it. Chosen over faster growth past half (barely felt).

- **EM3. Blackout Cell (Daemon/Honeypot): Power Siphon** -- whenever its
  Ward absorbs your Credit, its growing subroutines grow (amount set at
  implementation, tuned with the scale). Honeypot's absorbing feeds
  Daemon's ramp: hitting its shield speeds Memory Leak up. Chosen over
  "Dead Air" (your Hooks stop while its Ward is over 4), the user's
  reason: that would be fun only with control of the loadout in combat,
  and every loadout choice is locked in before the fight.
- **Principle from EM3:** enemy Mods shouldn't ask for in-fight
  reactions the player can't make. The player's levers are the loadout
  (set before the fight) and the Cribbage they play.

- **EM4. Intrusion Alarm (Overclock/Honeypot): Escalation** -- each of
  its turns lowers its initiative threshold by 5% (at most 25%). The alarm
  grows more frantic: "win fast" now applies to its tempo too, and its
  noisy subroutines fire more often the longer the fight runs. The
  player's answer is a faster loadout and better Cribbage. The user's
  concern: 5%/25% may be over-tuned -- measure it; if the scale re-tune
  can't absorb it, lower the step or the cap. Chosen over "Rapid
  Response" (Ward absorbs -> it gains initiative), too like Power Siphon.

## Elite Mods: measured value and retune

Kit power (roster-check.ts, 60 seeds x 2 seats, skill 0.85), first
layer, without -> with the Mod, at the old scales:

| Elite | Mod | Without | With | Mod worth |
|---|---|---|---|---|
| Threat Intel Feed | Reverse Engineering | 6.4 | 6.6 | +0.2 |
| Incident Response | Rollback | 6.8 | 7.9 | +1.1 |
| Blackout Cell | Power Siphon | 10.1 | 10.7 | +0.6 |
| Intrusion Alarm | Escalation | 6.8 | 7.8 | +1.0 |

- Escalation is worth about +15%, not over-tuned (the user's concern).
- Reverse Engineering is worth almost nothing: its Hooks' caps (Port
  Scan up to 2, Zero-Day Chain 1 a fire) fill up anyway (fixed below).
- Scales re-tuned to E3's budget: Threat Intel Feed 0.9 -> 1.05 (7.7 /
  7.7), Incident Response 0.95 -> 0.93 (7.9 / 7.7), Blackout Cell 1.5 ->
  1.47 (10.6 / 10.5), Intrusion Alarm 1 -> 1.12 (9.2 / 10.5 -- authored
  under budget on purpose, its Heat alarm making up the rest; it was 8.7
  with its old class Mod).

## Content pass

The user: the content pool is shallow on both sides (enemies and the
player's subroutines, Mods, Burners); start with enemies. Enemy-only
subroutines are their own set; any that could later join the player
pool get flagged.

- **CP1. Three new enemy-only effects**, each aimed at something the
  player builds before the fight:
  - **Trace** -- you gain N Heat (a run cost, priced like `feed`/alarms).
  - **Wipe** -- your Hooks lose N counts (Charge's opposite).
  - **Strip** -- you lose N Ward.
  Chosen over the existing seven effects only: enemies built from those
  would differ mostly in their numbers.
- **CP2. Twelve enemy-only subroutines**, three per archetype, each new
  effect four times (src/engine/content/enemy-subroutines.ts): Session
  Reset, Audit Log, Privilege Drop (Exploit); Log Rotation,
  Endpoint Agent, Garbage Collector (Daemon); Throttle, Packet Filter,
  Context Switch (Overclock); Honeynet, Countermeasure, Canary Token
  (Honeypot). Trace Hooks trigger on the enemy's own play, never yours
  (Canary Token, on your Breach, is the exception). Player-pool
  candidates: none as written (all use enemy-only effects).
- **Built:** the effects resolve in resolve.ts (Wipe via triggers.ts's
  removeCharges); Trace and Wipe never scale with an enemy's layer (Heat
  and whole counts read the same everywhere); text reads from your side
  ("you gain 1 Heat", "each of your Hooks loses 1 count", "you lose 2
  Ward"); glossary entries for Heat and Wipe's counts. Pricing: Wipe and
  Strip act in the fight, so kit power prices them; Trace is a run cost,
  reported by roster-check.ts as Heat per fight against the layer's
  allowance, like alarms.
- **CP3. Names read as defenders** (the user: you play the intruder, so
  enemies are the network defending itself, not attacker tools). Renamed:
  Payload Wiper -> Session Reset, Credential Dump -> Audit Log,
  Persistence Agent -> Endpoint Agent, Packet Storm -> Packet Filter, and
  the elite Zero-Day Broker -> Threat Intel Feed.
- **CP4. Roster breadth: 7 regulars, 2 deep elites.** Regulars: Session
  Monitor (L1), Wireless IDS, Log Shipper (L2), Honeyfarm, EDR Sensor
  (L3), Integrity Monitor, Firewall Cluster (L4). Elites: **Threat Hunter**
  (L3, Exploit/Honeypot; Audit Log, Honeynet, Fail2Ban) with **EM5
  Evidence Chain** -- whenever it gives you Heat (Trace or an alarm), it
  Credits that much; **Hypervisor** (L4, Daemon/Overclock; Priority
  Override, Context Switch, Fork Bomb -- Context Switch needs an Overclock
  neighbour) with **EM6 Resource Quota** -- your bottom subroutine (not a
  reactive Mod's) doesn't fire. Regulars per layer 4/6/6/6 -> 5/8/10/12;
  elites 2/4/4/4 -> 2/4/5/6.
- **Sandbox rejected for Hypervisor** ("your Instant Hooks wait for your
  next turn"): with-and-without duels against the six classes moved win
  rates by 0-1 points -- four classes start with no Instant Hooks, and an
  extra fire is worth the same later. Resource Quota, same test with
  6-subroutine loadouts: -13 to -23 points for five classes (0 for one
  whose bottom slot did little -- the intended answer: order your weakest
  last).
- **Pricing method for these enemies: parity** (scripts/enemy-parity.ts).
  Kit power duels a plain Credit reference with no Hooks or Ward, so it
  can't see Wipe, Strip or Resource Quota; and win rate saturates (the
  player wins nearly every regular fight). Instead: the enemy's
  Containment fill at the fight's end, against six 6-subroutine class
  loadouts, matched to its tier's existing enemies at its first layer;
  Heat-heavy ones sit 70-85% of that, like Intrusion Alarm and Tripwire.
- **Trace cut** after the first pricing (Heat per fight was up to a third
  of a layer's allowance): Audit Log every 2 fifteens -> every 4;
  Honeynet every 2 absorbed, at most 2 -> every 3, at most 1; Canary
  Token 2 Heat -> 1. Wireless IDS and Log Shipper gained a third
  subroutine (Tarpit, Steady Drip): two-piece Wipe/Strip kits had too
  little to scale.
- **Result:** final scales Session Monitor 1.4, Wireless IDS 2.6, Log
  Shipper 2.1, Honeyfarm 2.15, EDR Sensor 1.4, Integrity Monitor 1.6,
  Firewall Cluster 1.52, Threat Hunter 1.75, Hypervisor 1.25. Full runs
  (300/class): victory Blackhat 21.0, Operator 16.0, Eidolon 20.3,
  Breacher 20.3, Warden 17.0, Wraith 22.0 -- the tightest spread yet;
  alarm Heat per run up a little (1.5-5.9), Heat-maxed runs 1.3-3.0%.
- **EM1 follow-up: Reverse Engineering given something to feed.** Its
  Hooks were all capped (Zero-Day Chain 1 a fire, Port Scan 2) or already
  counted your scoring (Credential Stuffing), so the Mod was worth +0.2.
  Credential Stuffing -> Ping (no cap: fires again every 2 pairs):
  Threat Intel Feed is now Zero-Day Chain, Ping, Port Scan, the Mod worth
  +1.4 kit power (6.7 -> 8.1), scale 1.05 -> 1.0 (budget 7.7). Rejected:
  Ping + Port Scan + Turbo Mode (the Mod worth +5.1 -- most of the
  elite's strength, too swingy for a layer-1 elite).

## Open

- The player-side content pass (subroutines, Mods, Burners).
