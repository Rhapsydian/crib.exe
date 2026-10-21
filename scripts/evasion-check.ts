/**
 * Trace evasion (session 63, proposed): when you beat a gatekeeper but its
 * toll maxes your Heat, a short game of plain Cribbage decides whether you
 * slip away. The gatekeeper starts ahead by 1 point per 10% of the
 * Containment it had (rounded down); you need to finish strictly ahead.
 *
 * Part A: escape odds by head start, for 3 hands (you deal the 1st and
 * 3rd: two cribs to its one) and 4 hands (even cribs, you deal first),
 * at three player skills against a gatekeeper's Cribbage skill.
 * Part B: how big the head start really is when runs end "breached, then
 * caught" (the simulated player, every class), and the escape rate that
 * gives.
 *
 * Usage:
 *   npx tsx scripts/evasion-check.ts [--games=2000] [--runSeeds=150]
 */
import { playHands } from '../src/engine/game';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { enemySkill } from '../src/engine/enemies';
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { fightPerformanceWeight } from '../src/engine/heat';
import { ALL_CLASS_IDS } from '../src/engine/classes';

const arg = (name: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? d);
const GAMES = arg('games', 2000);
const RUN_SEEDS = arg('runSeeds', 150);
const PLAYER_SKILLS = [0.3, 0.6, 0.85];
const HAND_COUNTS = [3, 4];
const LEADS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const pct = (n: number, d: number) => `${((100 * n) / Math.max(1, d)).toFixed(0)}%`;

/** Your margin (yours minus its) in each of GAMES evasion games. */
function margins(hands: number, playerSkill: number, gkSkill: number): number[] {
  const out: number[] = [];
  for (let seed = 1; seed <= GAMES; seed++) {
    const r = playHands(hands, {
      seed: 900_000 + seed,
      startingDealer: 0,
      discardStrategies: [discardSkillStrategy(playerSkill), discardSkillStrategy(gkSkill)],
      playStrategies: [pegSkillStrategy(playerSkill), pegSkillStrategy(gkSkill)],
    });
    out.push(r.finalScores[0] - r.finalScores[1]);
  }
  return out;
}
const escapeRate = (m: number[], lead: number) => m.filter((x) => x > lead).length / m.length;

// Part A, against a mid-depth gatekeeper's skill (layer 2).
const gkSkill = enemySkill('gatekeeper', 2, 99);
console.log(`PART A: escape odds by head start, ${GAMES} games each, gatekeeper skill ${gkSkill.toFixed(2)}`);
const table = new Map<string, number[]>();
for (const hands of HAND_COUNTS) {
  for (const skill of PLAYER_SKILLS) {
    const m = margins(hands, skill, gkSkill);
    table.set(`${hands}:${skill}`, m);
    const mean = m.reduce((a, b) => a + b, 0) / m.length;
    console.log(`${hands} hands, skill ${skill}: mean margin ${mean >= 0 ? '+' : ''}${mean.toFixed(1)} | ` + LEADS.map((l) => `${l}:${pct(escapeRate(m, l) * 100, 100)}`).join(' '));
  }
}

// Part B: the head starts real runs hand out.
console.log(`\nPART B: "breached, then caught" in ${RUN_SEEDS} runs per class (skill 0.85)`);
const leads: { layer: number; lead: number }[] = [];
let runs = 0;
for (const classId of ALL_CLASS_IDS) {
  for (let seed = 1; seed <= RUN_SEEDS; seed++) {
    runs++;
    const r = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
    if (r.outcome !== 'breachedThenCaught') continue;
    const last = [...r.log].reverse().find((e) => e.type === 'encounter' && e.nodeType === 'gatekeeperFight');
    if (!last || last.type !== 'encounter') continue;
    const fill = last.outcome.heatSources.performance / fightPerformanceWeight('gatekeeper', last.layerIndex);
    leads.push({ layer: last.layerIndex + 1, lead: Math.floor(Math.min(0.99, fill) * 10) });
  }
}
console.log(`${leads.length} of ${runs} runs (${pct(leads.length, runs)}); by layer: ${[1, 2, 3, 4].map((l) => `L${l} ${leads.filter((x) => x.layer === l).length}`).join(', ')}`);
const dist = LEADS.map((l) => leads.filter((x) => x.lead === l).length);
console.log(`head start: ${LEADS.map((l, i) => `${l}:${dist[i]}`).join(' ')}`);
for (const hands of HAND_COUNTS) {
  for (const skill of PLAYER_SKILLS) {
    const m = table.get(`${hands}:${skill}`)!;
    const expected = leads.reduce((sum, x) => sum + escapeRate(m, x.lead), 0) / Math.max(1, leads.length);
    console.log(`${hands} hands, skill ${skill}: escape ${pct(expected * 100, 100)} of these runs`);
  }
}
