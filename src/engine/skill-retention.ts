import type { SubroutineDefinition } from './subroutine-types';
import type { PlayerIndex } from './pegging';
import { playCombat } from './combat';
import { playBasicCribbageGame } from './basic-cribbage';
import { discardSkillStrategy, pegSkillStrategy } from './ai';
import type { WinRate } from './pricing';

/**
 * Skill retention (step 2, checkpoint 6b): does Cribbage skill still
 * decide fights once loadouts are installed?
 *
 * Skill reaches a fight through points: points fill the initiative gauge,
 * so the better player takes more turns, and card-sourced betas charge
 * from their scoring. But every alpha fires flat each turn, so a loadout
 * strong enough could drown the Cribbage out. Retention measures how much
 * of Cribbage's own skill signal survives:
 *
 *     retention = (skill edge in a loadout mirror) / (skill edge in pure Cribbage)
 *
 * where a skill edge is the better player's win rate minus 0.5, at the
 * same pair of skill levels. 1.0 means the loadout keeps all of plain
 * Cribbage's signal; near 0 means the outcome no longer depends on how
 * well you play.
 *
 * Loadout mirrors carry no class passive or Mods (playCombat applies
 * those to side 0 only, so a mirror can't hold them); the run-level check
 * in `scripts/skill-check.ts` covers the whole build.
 */

/** The lowest retention a shipped loadout may have (checkpoint 6b).
 * PROVISIONAL, pending the user's call: at least half of plain Cribbage's
 * skill edge must survive. The skeleton measures 0.75-1.12 on starting
 * loadouts and 0.55-0.94 late in runs (0.85 v 0.5;
 * `docs/calibration/step2-cp6b-skill-retention.txt`). */
export const SKILL_RETENTION_FLOOR = 0.5;

export interface SkillMatchup {
  high: number;
  low: number;
}

export interface SkillEdgeOptions {
  /** Seeds; each is played with the better player in both seats. */
  seeds: number;
  gaugeThreshold: number;
  winThreshold: number;
  seedOffset?: number;
}

/** How often the higher-skill side wins a mirror of `loadout`. */
export function combatSkillEdge(loadout: SubroutineDefinition[], matchup: SkillMatchup, options: SkillEdgeOptions): WinRate {
  const { seeds, gaugeThreshold, winThreshold, seedOffset = 0 } = options;
  let wins = 0;
  for (let s = 0; s < seeds; s++) {
    const seed = seedOffset + s;
    for (const highSeat of [0, 1] as PlayerIndex[]) {
      const skills: [number, number] = highSeat === 0 ? [matchup.high, matchup.low] : [matchup.low, matchup.high];
      const result = playCombat([loadout, loadout], {
        seed,
        gaugeThreshold: [gaugeThreshold, gaugeThreshold],
        winThreshold: [winThreshold, winThreshold],
        discardStrategies: [discardSkillStrategy(skills[0]), discardSkillStrategy(skills[1])],
        playStrategies: [pegSkillStrategy(skills[0]), pegSkillStrategy(skills[1])],
      });
      if (result.winner === highSeat) wins++;
    }
  }
  return toWinRate(wins, 2 * seeds);
}

/** How often the higher-skill side wins plain Cribbage to 121 -- the
 * reference signal. The dealer alternates by seed parity, as in
 * `scripts/cribbage-skill-matrix.ts`. */
export function cribbageSkillEdge(matchup: SkillMatchup, games: number, seedOffset = 0): WinRate {
  let wins = 0;
  for (let g = 0; g < games; g++) {
    const seed = seedOffset + g;
    const result = playBasicCribbageGame({ seed, playerSkill: matchup.high, enemySkill: matchup.low, startingDealer: (seed % 2) as PlayerIndex });
    if (result.winner === 0) wins++;
  }
  return toWinRate(wins, games);
}

/** Retention: the loadout's skill edge over plain Cribbage's. Null when
 * Cribbage itself shows no edge at this matchup (nothing to retain). */
export function skillRetention(combat: WinRate, cribbage: WinRate): number | null {
  const reference = cribbage.winRate - 0.5;
  return reference <= 0 ? null : (combat.winRate - 0.5) / reference;
}

function toWinRate(wins: number, fights: number): WinRate {
  const winRate = wins / fights;
  return { winRate, se: Math.sqrt((winRate * (1 - winRate)) / fights), fights };
}
