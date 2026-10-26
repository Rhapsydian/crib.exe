import { SECURITY_REP_STEP, securityRules, type SecurityRules } from '../engine/meta';

/**
 * A Security Level's effects as a list, for the class select (session 71,
 * docs/meta-progression-design.md MP14; a list since session 72, the
 * user's ask). Worked out from the engine's own rules (meta.ts
 * securityRules), so the list is always what the level applies. Levels
 * stack: each line is the total at this level, and `isNew` marks a rule
 * this level adds or changes (not the Rep, strength and Heat that grow
 * every level).
 */
export interface SecurityEffect {
  text: string;
  isNew: boolean;
}

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const MODS = ['', 'a second Mod', 'a third Mod'];

/** Each effect's line at `r`, or null where the rule isn't in force; keyed
 * so a level's lines can be compared with the level below's. */
function lines(r: SecurityRules): [string, string | null][] {
  return [
    ['rep', r.level ? `+${pct(SECURITY_REP_STEP * r.level)} Rep` : null],
    ['strength', r.enemyStrength > 1 ? `Enemies ${pct(r.enemyStrength - 1)} stronger` : null],
    ['heat', r.heatGain > 1 ? `${pct(r.heatGain - 1)} more Heat` : null],
    ['elite', r.extraMods.elite ? `Elites take ${MODS[r.extraMods.elite]}` : null],
    ['regular', r.extraMods.regular ? 'Regular enemies take a Mod' : null],
    ['gatekeeper', r.extraMods.gatekeeper ? 'Layer 3 and 4 gatekeepers take a second Mod' : null],
    ['final', r.extraMods.finalGatekeeper ? 'The final gatekeeper takes three Mods' : null],
    ['carry', r.heatCarry ? `${pct(r.heatCarry)} of your Heat carries over between layers` : null],
    ['gauges', r.containment < 1 ? `Enemy Containment −${pct(1 - r.containment)} and your Breach +${pct(r.breach - 1)}` : null],
    ['shop', r.shopPrice > 1 ? `Shop prices +${pct(r.shopPrice - 1)}` : null],
    ['skill', r.skillOffset ? 'Enemies play better Cribbage' : null],
    ['rewards', r.rewardChoices < 3 ? `Rewards offer ${r.rewardChoices} choices, not 3` : null],
    ['allowance', r.allowance < 1 ? `Heat allowance −${pct(1 - r.allowance)}` : null],
    ['rest', r.rest < 1 ? `A Quiet Host rest sheds ${pct(1 - r.rest)} less Heat` : null],
  ];
}

/** Everything Security Level `level` does, in a list (empty at 0). */
export function securityEffects(level: number): SecurityEffect[] {
  const below = new Map(level > 0 ? lines(securityRules(level - 1)) : []);
  // Rep, strength and Heat grow every level, so "new" would mark them always.
  const scaling = new Set(['rep', 'strength', 'heat']);
  return lines(securityRules(level)).flatMap(([key, text]) => (text ? [{ text, isNew: !scaling.has(key) && below.get(key) !== text }] : []));
}
