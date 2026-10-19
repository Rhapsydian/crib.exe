/**
 * Enemy Mods (step 3, enemies; `docs/authoring-design.md` E4): the light
 * registry DESIGN.md's Enemy Design asks for. Each gatekeeper carries ONE
 * bespoke Mod, which may bend a rule (S8); since session 60 each elite
 * carries a smaller one (docs/enemy-review.md EM1-EM4), and no enemy
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
  | 'resource-quota';

export interface GatekeeperModDefinition {
  id: GatekeeperModId;
  name: string;
  /** What it does, in the player's voice (docs/text-audit.md). */
  text: string;
  /** Which tier carries it -- the tag on screen ("elite Mod"). */
  tier: 'elite' | 'gatekeeper';
}

/** No Way In: the most Credit its opponent may gain in one of their turns. */
export const NO_WAY_IN_CAP = 6;
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

const pct = (n: number) => `${Math.round(n * 100)}%`;
const share = (n: number) => ({ 0.5: 'half', 0.75: 'three-quarters', 0.25: 'a quarter' })[n] ?? pct(n);

export const GATEKEEPER_MODS: Record<GatekeeperModId, GatekeeperModDefinition> = {
  'reception-protocol': { id: 'reception-protocol', name: 'Reception Protocol', text: 'The first time one of its Exploit Hooks goes off each hand, it applies twice.', tier: 'gatekeeper' },
  'no-way-in': { id: 'no-way-in', name: 'No Way In', text: `You can't gain more than ${NO_WAY_IN_CAP} Credit in one turn.`, tier: 'gatekeeper' },
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
  escalation: { id: 'escalation', name: 'Escalation', text: `Each of its turns lowers its initiative threshold by ${pct(ESCALATION_STEP)} (at most ${pct(ESCALATION_MAX)} in all), so its turns come faster.`, tier: 'elite' },
};
