/**
 * Gatekeeper Mods (step 3, enemies; `docs/authoring-design.md` E4): the
 * light registry DESIGN.md's Enemy Design asks for. Each gatekeeper
 * carries its pair's class bridge plus ONE of these bespoke Mods, which
 * may bend a rule (S8). The logic lives at resolve.ts's hook sites, each
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
  | 'root-access';

export interface GatekeeperModDefinition {
  id: GatekeeperModId;
  name: string;
  /** What it does, for a reader of the roster. */
  text: string;
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

export const GATEKEEPER_MODS: Record<GatekeeperModId, GatekeeperModDefinition> = {
  'reception-protocol': { id: 'reception-protocol', name: 'Reception Protocol', text: 'Its first Exploit beta each hand applies twice.' },
  'no-way-in': { id: 'no-way-in', name: 'No Way In', text: `You can't gain more than ${NO_WAY_IN_CAP} Credit in a single turn.` },
  containment: { id: 'containment', name: 'Containment', text: 'Its Ward absorbs piercing Credit too.' },
  'zero-sum': { id: 'zero-sum', name: 'Zero-Sum', text: `Whenever you gain more than ${ZERO_SUM_THRESHOLD} Credit in a turn, it gains half the excess.` },
  adaptation: { id: 'adaptation', name: 'Adaptation', text: `Every ${ADAPTATION_EVERY}rd hand, its growth caps rise by ${ADAPTATION_STEP}.` },
  spotlight: { id: 'spotlight', name: 'Spotlight', text: 'Every fire of its pieces adds Heat to you.' },
  'null-session': { id: 'null-session', name: 'Null Session', text: 'The first Credit you would gain each turn is discarded.' },
  'root-access': { id: 'root-access', name: 'Root Access', text: 'On its first turn each hand, its whole loadout fires twice.' },
};
