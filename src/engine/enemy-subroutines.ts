import type { SubroutineDefinition } from './subroutine-types';
import { BREACH_CONTAINMENT_THRESHOLD } from './subroutines';

/**
 * Enemy-only subroutine catalog (session 39). Structurally separate from
 * subroutines.ts's ALL_POOL_SUBROUTINES/ARCHETYPE_POOLS: never included in
 * ALL_SUBROUTINES, never reachable through a player's Merge/Shop/reward
 * draw -- enemies.ts's pool() lookup is the only thing that ever resolves
 * an id from here.
 *
 * Exists because the roster's own design always allowed enemy content to
 * be "fully bespoke to one enemy" (DESIGN.md, cited in enemies.ts's own
 * pool() doc comment), but the session-27 roster draft used only
 * player-pool pieces for speed, every single enemy, no bespoke content at
 * all -- which produced enemy-side pieces gated on mechanics that don't
 * structurally exist for an enemy. The session-39 roster audit found the
 * concrete case: Heat-gated triggers. Enemies never accumulate Heat at
 * all (the only Heat-raising pool piece, Payload Multiplier, requires
 * Heat already above threshold to fire in the first place -- no pool
 * piece can ever be the first mover), so every enemy-held selfState:
 * heatAbove trigger is unconditionally dead. These 5 pieces are direct,
 * theme-appropriate replacements for the 5 dead pieces that audit found
 * (7 dead instances across the roster, since two of the five -- Air Gap
 * and Backchannel -- were each shared by two enemies).
 *
 * User-directed scope, explicitly: this is a fix for the currently-broken
 * slots only, not a wholesale replacement of the roster's shared-pool
 * content. The broader "give every enemy real bespoke content" initiative
 * is intentionally banked in BACKLOG.md, not attempted here.
 *
 * Tier constants below are seeded at the same magnitudes as the
 * player-facing pieces each entry replaces (a like-for-like swap, not a
 * balance retune) but kept as this catalog's own copy rather than
 * importing subroutines.ts's private COMMON/UNCOMMON/CAPPED -- enemy-only
 * content is meant to be free to diverge from player tuning over time
 * (the banked broader initiative), not permanently coupled to it.
 */
const ENEMY_COMMON = { tick: 2, duration: 3 };
const ENEMY_UNCOMMON = { burst: 8 };
const ENEMY_CAPPED = { common: 7 };

export const ENEMY_ONLY_SUBROUTINES: SubroutineDefinition[] = [
  {
    id: 'memory-leak',
    name: 'Memory Leak',
    archetype: 'malware',
    // Replaces Corrupted Cache (subroutines.ts) on Keylogger Process.
    // Keylogger Process's own kit already covers occurrence:pair
    // (Keylogger itself), so this picks a different category rather
    // than duplicating it.
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'dot', amountPerTick: ENEMY_COMMON.tick, cadence: 'castersTurnPulse', duration: ENEMY_COMMON.duration },
    tags: ['daemon'],
  },
  {
    id: 'fracture-point',
    name: 'Fracture Point',
    archetype: 'exploit',
    // Replaces Payload Multiplier on Zero-Day Broker. The original
    // doubly coupled itself to Heat (a heatAbove trigger AND its own
    // riskRewardBurst payload's extra heatCost) -- "risk" has no
    // enemy-side analog at all (Heat is a player-only run-level
    // resource), so this drops the risk/reward mechanic entirely rather
    // than forcing it onto a condition enemies structurally can't have.
    // Plain burst, same magnitude, on a fresh occurrence category
    // (Zero-Day Broker's kit already covers pair via Zero-Day Chain, run
    // via Buffer Overrun).
    trigger: { kind: 'occurrence', category: 'fifteen', variation: 'instant' },
    payload: { kind: 'directBurst', amount: ENEMY_UNCOMMON.burst + 2 },
    tags: [],
  },
  {
    id: 'escalating-response',
    name: 'Escalating Response',
    archetype: 'neutral',
    // Replaces Overclock on Zero Trust Node -- "increasingly aggressive
    // defense as the intrusion progresses," now keyed to something an
    // enemy can actually read instead of Heat.
    //
    // Uses breachContainmentAbove, NOT gaugeFillAbove -- an earlier draft
    // of this piece used gaugeFillAbove (matching Honeypot/Vulnerability
    // Scan's own precedent) and empirically fired 15+ times in an
    // 18-20-hand match. Root cause, confirmed by reading
    // resolve.ts:1396: gaugeFillAbove reads gauges.ts's InitiativeGauge
    // (the turn-cadence meter, `gauge`), which is DESIGNED to cycle --
    // "overshoot carries into the next cycle" (gauges.ts's addPoints) --
    // so it crosses any given fraction roughly every other turn by
    // construction, not a rare or escalating signal at all.
    // breachContainmentAbove instead reads the real win-gauge
    // (`winGauge.progress/threshold`, resolve.ts:1391) -- "how close is
    // the opponent to winning," matching this piece's actual intent and
    // the same condition DNS Poisoning already uses for its own "come
    // from behind" identity. High threshold (the same
    // BREACH_CONTAINMENT_THRESHOLD.high DNS Poisoning uses) for a late,
    // hard punish; Fail-Secure below uses the low threshold for an
    // earlier, proactive reaction.
    //
    // reactive:true is still structurally required, independent of
    // which condition is used -- see subroutine-types.ts's own
    // `reactive` doc comment and resolve.ts's refreshTriggerReadiness: a
    // non-reactive selfState/enemyState trigger re-arms on every single
    // evaluation pass while its condition holds (no false->true edge
    // debounce), so once armed it would refire every remaining turn
    // rather than once per real renewed crossing. Matches DNS
    // Poisoning's own reactive:true for the same trigger family.
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'directBurst', amount: ENEMY_UNCOMMON.burst },
    tags: [],
    reactive: true,
  },
  {
    id: 'fail-secure',
    name: 'Fail-Secure',
    archetype: 'encryption',
    // Replaces Air Gap on Hardened Perimeter and Firewall Prime -- the
    // original finding this whole audit started from. "Fail-secure" is a
    // real systems-design term (default to the safe/closed state the
    // instant something goes wrong), fitting "ward up defensively" at
    // least as well as Air Gap's own isolation flavor did.
    //
    // breachContainmentAbove, not gaugeFillAbove -- see Escalating
    // Response's own comment above for why (gaugeFillAbove reads the
    // cyclical InitiativeGauge, not real win-progress; empirically fired
    // 26+ times in an 18-hand match before this fix). Low threshold
    // (BREACH_CONTAINMENT_THRESHOLD.low) for a proactive, early defensive
    // reaction, rather than Escalating Response's later punish at the
    // high threshold. reactive:true for the same structural reason
    // (matches Air Gap's own original reactive:true too).
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.low },
    payload: { kind: 'ward', amount: ENEMY_CAPPED.common },
    tags: ['firewall'],
    reactive: true,
  },
  {
    id: 'intercept',
    name: 'Intercept',
    archetype: 'root',
    // Replaces Backchannel on Backchannel Handler and Ghost in the
    // Machine -- the original fired "while the caster's own Heat is
    // running hot" per its own doc comment. Both enemies that carried it
    // already carry DNS Poisoning, whose own doc comment frames
    // breachContainmentAbove(high) as "the instant the enemy pulls
    // significantly ahead" -- reusing that exact condition here fits
    // Root's whole "come from behind" identity at least as well as the
    // original Heat framing did.
    //
    // firesAt:onCribSelected means this doesn't go through the
    // reactive/ready-flag machinery at all -- fireHandLifecycleSubroutines
    // checks the trigger condition fresh at that one fixed moment each
    // hand (isReady called directly, not the precomputed ready flag),
    // so it's naturally bounded to at most once per hand regardless of
    // reactive. Matches the original Backchannel's own choice not to set
    // it.
    trigger: { kind: 'enemyState', condition: 'breachContainmentAbove', value: BREACH_CONTAINMENT_THRESHOLD.high },
    payload: { kind: 'revealCrib' },
    tags: [],
    firesAt: 'onCribSelected',
  },
];
