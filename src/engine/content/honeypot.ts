import type { SubroutineDefinition } from '../subroutine-types';
import type { ArchetypePool } from '../subroutines';
import type { PricingContext } from './overclock';


/** A plain Credit piece, for pricing positions. Local rather than
 * pricing.ts's creditPiece: content must not import the combat engine
 * (classes -> subroutines -> content would close a cycle). Same shape. */
function creditPiece(amount: number, id: string): SubroutineDefinition {
  return { id, name: id, archetype: 'exploit', alpha: { verb: 'credit', amount } };
}

/**
 * Honeypot's authored pool (step 3, checkpoint 4; `docs/archive/authoring-design.md`).
 * Conversion / Defense: Ward absorbs the opponent's incoming Credit, and
 * banked defense -- or the opponent's own progress -- becomes yours.
 * Signature beta: a different effect on State/Progress (Ward absorbed,
 * Ward above a level).
 *
 * The user's two watch items: defense that never converts (every common
 * has a credit path, and the turtle kit must still finish fights), and
 * conversion bypassing Ward (S10: kept; steals stay small and conditional,
 * and are priced again against a host carrying Ward). Not yet wired into
 * acquisition (S7).
 */

// --- Commons ---

/** The plain conversion: bank Ward, then spend it as Credit. Spends
 * YOUR banked Ward, not Ward absorbed: absorbed-fuelled conversion is
 * powered by the opponent's attacks, so at volume it inverts skill
 * (checkpoint 4: a Tarpit that turned every 2 absorbed into 2 Credit
 * gave its kits a retention of -0.3 to -0.85). Spending your own Ward
 * scales with your own turns. Credit from Ward bypasses the opponent's
 * Ward (S10), so a Honeypot mirror still finishes. */
const TARPIT: SubroutineDefinition = {
  id: 'tarpit',
  name: 'Tarpit',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 2 },
  beta: { source: 'state', condition: { kind: 'wardAbove', amount: 3 }, shape: 'whileTrue', effect: { verb: 'credit', amount: 2, from: 'ward' } },
};

/** Plain Credit, plus each point of Ward absorbed returns as piercing
 * Credit (cap 2 a turn). The plain alpha is S11's skill-scaled offense:
 * conversion alone inverts skill. Needs Ward from other pieces to absorb
 * anything, so it is priced beside one. */
const HONEYTOKEN: SubroutineDefinition = {
  id: 'honeytoken',
  name: 'Honeytoken',
  archetype: 'honeypot',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'progress', metric: 'absorbed', per: 1, shape: 'graded', cap: 2, effect: { verb: 'credit', amount: 1, piercing: true } },
};

/** Defense with a credit tail. */
const BASIC_AUTH: SubroutineDefinition = {
  id: 'basic-auth',
  name: 'Basic Auth',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 2 },
  beta: { source: 'state', condition: { kind: 'wardAbove', amount: 4 }, shape: 'whileTrue', effect: { verb: 'credit', amount: 1 } },
};

/** Plain Credit (S11), and their fifteens raise your wall. */
const RATE_LIMITING: SubroutineDefinition = {
  id: 'rate-limiting',
  name: 'Rate Limiting',
  archetype: 'honeypot',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'fifteen', watch: 'opponent', shape: 'graded', cap: 2, effect: { verb: 'ward', amount: 1 } },
};

// --- Uncommons ---

/** Spends the defense it banked. */
const SINKHOLE: SubroutineDefinition = {
  id: 'sinkhole',
  name: 'Sinkhole',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 2 },
  beta: { source: 'state', condition: { kind: 'wardAbove', amount: 4 }, shape: 'whileTrue', effect: { verb: 'credit', amount: 3, from: 'ward' } },
};

/** Small, conditional conversion: a steal, which bypasses Ward (S10). */
const FAIL2BAN: SubroutineDefinition = {
  id: 'fail2ban',
  name: 'Fail2Ban',
  archetype: 'honeypot',
  alpha: { verb: 'credit', amount: 1 },
  beta: { source: 'cards', category: 'pair', watch: 'opponent', shape: 'stepped', at: 1, effect: { verb: 'credit', amount: 1, from: 'opponent' } },
};

/** A wall that rises while the opponent is past halfway. (Drafted as
 * an immediate Ward 4 at 3/4, which fired too rarely: 1.27.) */
const DEEP_PACKET_INSPECTION: SubroutineDefinition = {
  id: 'deep-packet-inspection',
  name: 'Deep Packet Inspection',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 1 },
  beta: { source: 'state', condition: { kind: 'opponentGaugeAbove', fraction: 0.5 }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 3 } },
};

// --- Rares ---

/** Stack enough Ward to absorb everything the opponent sends, and every
 * 2 absorbed steals 1. The steal bypasses Ward (S10), which is worth
 * +1.3 Credit a turn at volume (checkpoint 4), so it stays small: Ward 2
 * with a cap-3 steal priced 3.64 alone. */
const ZERO_TRUST: SubroutineDefinition = {
  id: 'zero-trust',
  name: 'Zero Trust',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 1 },
  beta: { source: 'progress', metric: 'absorbed', per: 2, shape: 'graded', cap: 1, effect: { verb: 'credit', amount: 1, from: 'opponent' } },
};

/** Makes surplus Ward -- normally worthless (step 2) -- into offense:
 * stack Ward far past need. */
const AIR_GAPPED_VAULT: SubroutineDefinition = {
  id: 'air-gapped-vault',
  name: 'Air-Gapped Vault',
  archetype: 'honeypot',
  alpha: { verb: 'credit', amount: 2 },
  beta: { source: 'state', condition: { kind: 'wardAbove', amount: 8 }, shape: 'whileTrue', effect: { verb: 'enhance', amount: 3 } },
};

// --- Session 66 (docs/design/subroutines.md S6-S11): a Run Hook, a
// stepped pair Hook, a new Process and a rare build-definer. TBD/measured.

/** Run Hook: the opponent's runs, punished (the user's call). */
const ANOMALY_DETECTOR: SubroutineDefinition = {
  id: 'anomaly-detector',
  name: 'Anomaly Detector',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 2 },
  beta: { source: 'cards', category: 'run', watch: 'opponent', shape: 'graded', cap: 2, effect: { verb: 'credit', amount: 1, piercing: true } },
};

/** Stepped pair Hook: a pair build turned into stealing. */
const MANTRAP: SubroutineDefinition = {
  id: 'mantrap',
  name: 'Mantrap',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 1 },
  beta: { source: 'cards', category: 'pair', shape: 'stepped', at: 3, effect: { verb: 'credit', amount: 2, from: 'opponent' } },
};

/** New Process: spending Ward, fed by the opponent's pairs. */
const BAIT_FILE: SubroutineDefinition = {
  id: 'bait-file',
  name: 'Bait File',
  archetype: 'honeypot',
  alpha: { verb: 'credit', amount: 2, from: 'ward' },
  beta: { source: 'cards', category: 'pair', watch: 'opponent', shape: 'graded', cap: 2, effect: { verb: 'ward', amount: 3 } },
};

/** Rare: the harder they hit your Ward, the harder it hits back. */
const REFLECTOR: SubroutineDefinition = {
  id: 'reflector',
  name: 'Reflector',
  archetype: 'honeypot',
  alpha: { verb: 'ward', amount: 2 },
  beta: { source: 'progress', metric: 'absorbed', per: 4, shape: 'graded', cap: 3, effect: { verb: 'credit', amount: 2, piercing: true } },
};

export const HONEYPOT_POOL: ArchetypePool = {
  commons: [TARPIT, HONEYTOKEN, BASIC_AUTH, RATE_LIMITING, ANOMALY_DETECTOR],
  uncommons: [SINKHOLE, FAIL2BAN, DEEP_PACKET_INSPECTION, MANTRAP, BAIT_FILE],
  rares: [ZERO_TRUST, AIR_GAPPED_VAULT, REFLECTOR],
};

/** Honeytoken needs Ward of its own side to absorb anything. */
const WARD_PARTNER: SubroutineDefinition = { id: 'ward-partner', name: 'Ward 2 (partner)', archetype: 'honeypot', alpha: { verb: 'ward', amount: 2 } };
export const HONEYPOT_CONTEXTS: Record<string, PricingContext> = {
  honeytoken: { host: [creditPiece(2, 'host'), WARD_PARTNER], at: 2 },
};

export const HONEYPOT_RARE_BUILDS: Record<string, SubroutineDefinition[] | PricingContext> = {
  'zero-trust': [BASIC_AUTH],
  'air-gapped-vault': [BASIC_AUTH, DEEP_PACKET_INSPECTION],
};

/** S10: the steal pieces priced again against a host carrying Ward 2 on
 * both sides. The reference side's Credit is partly absorbed by that
 * Ward; a steal isn't, so the gap is the bypass's worth. */
const WARD_HOST: SubroutineDefinition = { id: 'host-ward', name: 'Ward 2 (host)', archetype: 'honeypot', alpha: { verb: 'ward', amount: 2 } };
export const HONEYPOT_WARD_CHECKS: [SubroutineDefinition, PricingContext][] = [
  [FAIL2BAN, { host: [creditPiece(2, 'host'), WARD_HOST], at: 2 }],
  [ZERO_TRUST, { host: [creditPiece(2, 'host'), WARD_HOST], at: 2 }],
];

export const HONEYPOT_KITS: Record<string, SubroutineDefinition[]> = {
  'commons only': [TARPIT, HONEYTOKEN, BASIC_AUTH, RATE_LIMITING],
  early: [BASIC_AUTH, TARPIT, HONEYTOKEN],
  // Watch item 1: stacked with defense, it must still finish fights.
  turtle: [BASIC_AUTH, RATE_LIMITING, DEEP_PACKET_INSPECTION, SINKHOLE, TARPIT, ZERO_TRUST],
  'late conversion': [AIR_GAPPED_VAULT, BASIC_AUTH, RATE_LIMITING, SINKHOLE, ZERO_TRUST, HONEYTOKEN],
};
