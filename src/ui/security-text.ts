import { SECURITY_HEAT_STEP, SECURITY_STRENGTH_STEP } from '../engine/meta';

/**
 * What each Security Level adds, for the class select (session 71,
 * docs/meta-progression-design.md MP14). Levels stack: each line names
 * only the new rule, and every level also makes enemies stronger and
 * Heat build faster. Kept beside meta.ts's securityRules; a change to one
 * is a change to the other.
 */
const EVERY = `every level: enemies ${Math.round(SECURITY_STRENGTH_STEP * 1000) / 10}% stronger and ${Math.round(SECURITY_HEAT_STEP * 100)}% more Heat`;

const ADDS: Record<number, string> = {
  1: 'Elites take a second Mod',
  2: 'Some Heat carries over between layers; enemy Containment −5% and your Breach +5%',
  3: 'Shop prices +15%',
  4: 'Enemies play better Cribbage',
  5: 'Rewards offer 2 choices, not 3; enemy Containment −5% and your Breach +5% more',
  6: 'Heat allowance −10%; more Heat carries over',
  7: 'Layer 3 and 4 gatekeepers take a second Mod; Shop prices +30%',
  8: 'Regular enemies take a Mod; enemy Containment −5% and your Breach +5% more',
  9: 'Safehouse rest sheds less Heat',
  10: 'The final gatekeeper takes three Mods; elites take a third',
};

export const SECURITY_LEVEL_TEXT: Record<number, string> = Object.fromEntries(
  Object.entries(ADDS).map(([level, text]) => [level, `adds: ${text}. Plus everything below, and ${EVERY}.`]),
);
