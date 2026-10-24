/**
 * Enemy Mods (step 3, enemies; `docs/archive/authoring-design.md` E4): the light
 * registry DESIGN.md's Enemy Design asks for. Each gatekeeper carries ONE
 * bespoke Mod, which may bend a rule (S8); since session 60 each elite
 * carries a smaller one (docs/archive/enemy-review.md EM1-EM4), and no enemy
 * carries a class Mod. (The id type keeps its old name.) The logic lives at resolve.ts's hook sites, each
 * a lookup by id (`hasSideMod`) rather than a per-enemy branch, so more
 * can be added without new wiring.
 *
 * Amounts are first-pass, tuned with each gatekeeper's budget and then
 * its layer's pass-rate target (E3).
 */
export type GatekeeperModId =
  | 'reception-protocol'
  | 'no-way-in'
  | 'rate-limit'
  | 'containment'
  | 'zero-sum'
  | 'adaptation'
  | 'spotlight'
  | 'null-session'
  | 'root-access'
  | 'reverse-engineering'
  | 'rollback'
  | 'power-siphon'
  | 'escalation'
  | 'evidence-chain'
  | 'resource-quota'
  // Session 67's elites (docs/enemies-design.md E4)
  | 'interference'
  | 'hard-limit'
  | 'lockout'
  | 'fast-path'
  | 'purge'
  | 'collection'
  // Session 68's gatekeepers (docs/enemies-design.md E11)
  | 'house-edge'
  | 'throttled-link'
  | 'hardened'
  | 'behavior-analysis'
  | 'pattern-match'
  | 'reflection'
  | 'counter-trace'
  | 'rewrite';

export interface GatekeeperModDefinition {
  id: GatekeeperModId;
  name: string;
  /** What it does, in the player's voice (docs/archive/text-audit.md). */
  text: string;
  /** Which tier carries it -- the tag on screen ("elite Mod"). */
  tier: 'elite' | 'gatekeeper';
}

/** No Way In: the most Credit its opponent may gain in one of their turns. */
export const NO_WAY_IN_CAP = 6;
/** Rate Limit: No Way In, loosened for the tutorial's Firewall Beta
 * (session 63, the user's call: the tutorial should be fairly easy). */
export const RATE_LIMIT_CAP = 8;
/** Zero-Sum: Credit its opponent gains past this in a turn... */
export const ZERO_SUM_THRESHOLD = 4;
/** ...feeds the Zero-Sum owner this share of the excess. */
export const ZERO_SUM_SHARE = 0.5;
/** Adaptation: every this-many hands, its growth caps rise... */
export const ADAPTATION_EVERY = 3;
/** ...by this much. */
export const ADAPTATION_STEP = 1;
/** Spotlight: Heat added to its opponent's layer every time one of its pieces fires. */
export const SPOTLIGHT_HEAT = 0.125;
/** Rollback (EM2): the first time the opponent's gauge passes this share,
 * it is pushed back to ROLLBACK_TO. */
export const ROLLBACK_AT = 0.75;
export const ROLLBACK_TO = 0.5;
/** Power Siphon (EM3): each absorption grows each growing subroutine by
 * this many fires' worth of its growth. */
export const POWER_SIPHON_GROWTH = 1;
/** Escalation (EM4): each of its turns lowers its initiative threshold by
 * this share of its starting threshold, up to ESCALATION_MAX in all. */
export const ESCALATION_STEP = 0.05;
export const ESCALATION_MAX = 0.25;
/** Interference (session 67, E4): Breach its opponent loses per Instant
 * Hook going off. TBD/measured. */
export const INTERFERENCE_LOSS = 2;
/** Hard Limit: the most Ward its opponent can hold. */
export const HARD_LIMIT_WARD = 6;
/** Lockout: every this-many of its turns, its opponent's top subroutine
 * skips their next turn. */
export const LOCKOUT_EVERY = 2;
/** Fast Path: its pegging points count this many times toward its initiative. */
export const FAST_PATH_MULTIPLIER = 2;
/** Purge: counts each of its opponent's Hooks loses at the start of a hand. */
export const PURGE_COUNTS = 1;
/** Collection: the share of growth its opponent's subroutines keep at the
 * end of a hand. */
export const COLLECTION_KEEP = 0.5;
/** House Edge (session 68, E11): its crib points count this many times
 * toward its initiative. TBD/measured. */
export const HOUSE_EDGE_MULTIPLIER = 2;
/** Throttled Link: how much longer its opponent's initiative bar is. */
export const THROTTLED_LINK_BAR = 3;
/** Hardened: extra counts its opponent's Hooks need to go off. */
export const HARDENED_COUNTS = 1;
/** Behavior Analysis: Ward it gains for each turn its opponent takes. */
export const BEHAVIOR_ANALYSIS_WARD = 2;
/** Reflection: the share of Credit its Ward absorbs that it Credits back. */
export const REFLECTION_SHARE = 0.5;
/** Counter-Trace: Heat its opponent gains per Hook going off. */
export const COUNTER_TRACE_HEAT = 1;

const pct = (n: number) => `${Math.round(n * 100)}%`;
const share = (n: number) => ({ 0.5: 'half', 0.75: 'three-quarters', 0.25: 'a quarter' })[n] ?? pct(n);

export const GATEKEEPER_MODS: Record<GatekeeperModId, GatekeeperModDefinition> = {
  'reception-protocol': { id: 'reception-protocol', name: 'Reception Protocol', text: 'The first time one of its Exploit Hooks goes off each hand, it applies twice.', tier: 'gatekeeper' },
  'no-way-in': { id: 'no-way-in', name: 'No Way In', text: `You can't gain more than ${NO_WAY_IN_CAP} Credit in one turn.`, tier: 'gatekeeper' },
  'rate-limit': { id: 'rate-limit', name: 'Rate Limit', text: `You can't gain more than ${RATE_LIMIT_CAP} Credit in one turn.`, tier: 'gatekeeper' },
  containment: { id: 'containment', name: 'Containment', text: 'Its Ward also absorbs your Credit that ignores Ward.', tier: 'gatekeeper' },
  'zero-sum': { id: 'zero-sum', name: 'Zero-Sum', text: `Whenever you gain more than ${ZERO_SUM_THRESHOLD} Credit in a turn, half of everything past ${ZERO_SUM_THRESHOLD} is added to its Containment too.`, tier: 'gatekeeper' },
  adaptation: { id: 'adaptation', name: 'Adaptation', text: `Every ${ADAPTATION_EVERY}rd hand, its growing subroutines can grow ${ADAPTATION_STEP} further.`, tier: 'gatekeeper' },
  spotlight: { id: 'spotlight', name: 'Spotlight', text: `Each time one of its subroutines fires, you gain ${SPOTLIGHT_HEAT} Heat.`, tier: 'gatekeeper' },
  'null-session': { id: 'null-session', name: 'Null Session', text: 'Each turn, the first Credit you would gain is lost, however much it is.', tier: 'gatekeeper' },
  'root-access': { id: 'root-access', name: 'Root Access', text: 'On its first turn each hand, its whole loadout fires twice.', tier: 'gatekeeper' },
  // --- Elites (session 60, EM1-EM4) ---
  'reverse-engineering': { id: 'reverse-engineering', name: 'Reverse Engineering', text: 'Every fifteen and pair you score also counts toward its Hooks.', tier: 'elite' },
  rollback: { id: 'rollback', name: 'Rollback', text: `The first time each fight your Breach passes ${share(ROLLBACK_AT)}, it pushes it back to ${share(ROLLBACK_TO)}.`, tier: 'elite' },
  'power-siphon': {
    id: 'power-siphon',
    name: 'Power Siphon',
    text: `Whenever its Ward absorbs your Credit, each of its growing subroutines grows ${POWER_SIPHON_GROWTH === 1 ? "as much as one fire's growth" : `${POWER_SIPHON_GROWTH} fires' worth`}.`,
    tier: 'elite',
  },
  'evidence-chain': { id: 'evidence-chain', name: 'Evidence Chain', text: 'Whenever it gives you Heat, it also Credits that much.', tier: 'elite' },
  'resource-quota': { id: 'resource-quota', name: 'Resource Quota', text: "Your bottom subroutine doesn't fire.", tier: 'elite' },
  // --- Session 67's elites (E4): each aimed at a kind of build ---
  interference: { id: 'interference', name: 'Interference', text: `Each time one of your Instant Hooks goes off, your Breach loses ${INTERFERENCE_LOSS}.`, tier: 'elite' },
  'hard-limit': { id: 'hard-limit', name: 'Hard Limit', text: `Your Ward can't go above ${HARD_LIMIT_WARD}.`, tier: 'elite' },
  lockout: { id: 'lockout', name: 'Lockout', text: `Every ${LOCKOUT_EVERY === 2 ? 'second' : `${LOCKOUT_EVERY}th`} turn it takes, your top subroutine skips your next turn.`, tier: 'elite' },
  'fast-path': { id: 'fast-path', name: 'Fast Path', text: `Points it scores while pegging count ${FAST_PATH_MULTIPLIER === 2 ? 'double' : `${FAST_PATH_MULTIPLIER} times`} toward its initiative.`, tier: 'elite' },
  purge: { id: 'purge', name: 'Purge', text: `At the start of each hand, each of your Hooks loses ${PURGE_COUNTS === 1 ? '1 count' : `${PURGE_COUNTS} counts`}.`, tier: 'elite' },
  collection: { id: 'collection', name: 'Collection', text: `At the end of each hand, your growing subroutines lose ${COLLECTION_KEEP === 0.5 ? 'half' : pct(1 - COLLECTION_KEEP)} their growth.`, tier: 'elite' },
  // --- Session 68's gatekeepers (E11): each changes how the fight plays ---
  'house-edge': { id: 'house-edge', name: 'House Edge', text: `Points from its crib count ${HOUSE_EDGE_MULTIPLIER === 2 ? 'double' : `${HOUSE_EDGE_MULTIPLIER} times`} toward its initiative.`, tier: 'gatekeeper' },
  'throttled-link': { id: 'throttled-link', name: 'Throttled Link', text: `Your initiative bar is ${THROTTLED_LINK_BAR} longer.`, tier: 'gatekeeper' },
  hardened: { id: 'hardened', name: 'Hardened', text: `Your Hooks need ${HARDENED_COUNTS === 1 ? 'one more count' : `${HARDENED_COUNTS} more counts`} to go off.`, tier: 'gatekeeper' },
  'behavior-analysis': { id: 'behavior-analysis', name: 'Behavior Analysis', text: `Each turn you take gives it Ward ${BEHAVIOR_ANALYSIS_WARD}.`, tier: 'gatekeeper' },
  'pattern-match': { id: 'pattern-match', name: 'Pattern Match', text: 'The first run you score each hand gives it a turn at once.', tier: 'gatekeeper' },
  reflection: { id: 'reflection', name: 'Reflection', text: `Whenever its Ward absorbs your Credit, it Credits ${REFLECTION_SHARE === 0.5 ? 'half' : pct(REFLECTION_SHARE)} of what was absorbed.`, tier: 'gatekeeper' },
  'counter-trace': { id: 'counter-trace', name: 'Counter-Trace', text: `Each time one of your Hooks goes off, you gain ${COUNTER_TRACE_HEAT} Heat.`, tier: 'gatekeeper' },
  rewrite: { id: 'rewrite', name: 'Rewrite', text: 'At the start of each hand, it swaps your top and bottom subroutines.', tier: 'gatekeeper' },
  escalation: { id: 'escalation', name: 'Escalation', text: `Each of its turns lowers its initiative threshold by ${pct(ESCALATION_STEP)} (at most ${pct(ESCALATION_MAX)} in all), so its turns come faster.`, tier: 'elite' },
};
