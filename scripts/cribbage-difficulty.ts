/**
 * Difficulty calibration for vanilla Cribbage (milestone 4, V2).
 *
 * Plays each difficulty level (basic-cribbage.ts's DIFFICULTIES) against
 * reference players -- a competent player (skill 0.85, the project's
 * standing diagnostic default) and a perfect one (1.0) -- and each
 * neighbouring pair of levels against each other, seats and first deal
 * alternating. Each step up should be a noticeable step: the reference's
 * win rate falls level by level, and each level beats the one below.
 *
 * Uses playCribbageGame, the driver of the game a person plays. Cribbage
 * is luck-heavy, so differences are a few points to ~15 at most.
 *
 * PROVENANCE: AI vs AI at the skill dial (ai.ts); a stand-in, not a
 * measurement of people.
 *
 * Usage:
 *   npx tsx scripts/cribbage-difficulty.ts [--games=1000] [--levels=learn:0.3,easy:0.4,...]
 */
import { DIFFICULTIES, playCribbageGame, type Difficulty } from '../src/engine/basic-cribbage';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const games = Number(args.games ?? 1000);
// --levels overrides the skills under test, e.g. --levels=learn:0.25,easy:0.45
const levels: [string, number][] = args.levels
  ? args.levels.split(',').map((pair) => {
      const [name, skill] = pair.split(':');
      return [name, Number(skill)];
    })
  : (Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => [d, DIFFICULTIES[d].skill]);

/** How often skill `a` beats skill `b`, seats and first deal alternating. */
function winRate(a: number, b: number): number {
  let wins = 0;
  for (let seed = 1; seed <= games; seed++) {
    const aSeat = (seed % 2) as 0 | 1;
    const skills: [number, number] = aSeat === 0 ? [a, b] : [b, a];
    const r = playCribbageGame({ seed, skills, startingDealer: ((seed >> 1) % 2) as 0 | 1 });
    if (r.winner === aSeat) wins++;
  }
  return wins / games;
}

const pct = (x: number) => `${(100 * x).toFixed(1).padStart(5)}%`;
const se = (100 * Math.sqrt(0.25 / games)).toFixed(1);
console.log(`\nCRIBBAGE DIFFICULTY -- ${games} games per pairing, seats alternating (1 SE ~ ${se} pts).`);
console.log(`${'level'.padEnd(10)} skill   competent (0.85) wins   perfect (1.0) wins   beats the level below`);
let below: [string, number] | null = null;
for (const [name, skill] of levels) {
  const vsCompetent = winRate(0.85, skill);
  const vsPerfect = winRate(1, skill);
  const step = below ? `${pct(winRate(skill, below[1]))} vs ${below[0]}` : '--';
  console.log(`${name.padEnd(10)} ${skill.toFixed(2).padStart(5)}   ${pct(vsCompetent).padStart(22)}   ${pct(vsPerfect).padStart(18)}   ${step}`);
  below = [name, skill];
}
