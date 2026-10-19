# Enemy review (session 60)

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

- **EM1. Zero-Day Broker (Exploit/Overclock): Reverse Engineering** --
  every fifteen and pair you score also counts toward its Hooks. A
  broker profiting from your moves; its spike engine (Zero-Day Chain on
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
| Zero-Day Broker | Reverse Engineering | 6.4 | 6.6 | +0.2 |
| Incident Response | Rollback | 6.8 | 7.9 | +1.1 |
| Blackout Cell | Power Siphon | 10.1 | 10.7 | +0.6 |
| Intrusion Alarm | Escalation | 6.8 | 7.8 | +1.0 |

- Escalation is worth about +15%, not over-tuned (the user's concern).
- Reverse Engineering is worth almost nothing: its Hooks' caps (Port
  Scan up to 2, Zero-Day Chain 1 a fire) fill up anyway. It's felt, but
  doesn't change the numbers.
- Scales re-tuned to E3's budget: Zero-Day Broker 0.9 -> 1.05 (7.7 /
  7.7), Incident Response 0.95 -> 0.93 (7.9 / 7.7), Blackout Cell 1.5 ->
  1.47 (10.6 / 10.5), Intrusion Alarm 1 -> 1.12 (9.2 / 10.5 -- authored
  under budget on purpose, its Heat alarm making up the rest; it was 8.7
  with its old class Mod).

## Open

- Enemy-only subroutines and roster breadth (the content pass).
