/**
 * The tutorial's seed (session 63, docs/design/tutorial.md T5,
 * checkpoint 5): the guided run always plays one seed, so every tester
 * gets the same deals. A good one shows Blackhat working at once -- the
 * first hand's best keep holds a fifteen and a pair -- and is winnable
 * by a new player, not just a strong one.
 *
 * Per seed: the first hand you're dealt, the keep the simulated player
 * makes and what it scores; then the tutorial's outcome at three skills
 * (a new player, a fair one, the usual simulated player), with fights
 * won.
 *
 * Usage:
 *   npx tsx scripts/tutorial-seed.ts [--seeds=200] [--from=1] [--skills=0.3,0.6,0.85] [--list=12,21]
 */
import { runRequests, opportunisticTraversal, type RunResult } from '../src/engine/run';
import type { RunRequest } from '../src/engine/run-requests';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { TUTORIAL_CLASS, TUTORIAL_OPTIONS } from '../src/engine/tutorial';
import { cardValue, type Card } from '../src/engine/cards';

const rankLabel = (r: number) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' })[r] ?? String(r);
/** Fifteens and pairs in a keep (coach.ts's keepScore is UI-side). */
function keepScore(cards: Card[]): { pts: number; parts: string[] } {
  let fifteens = 0;
  for (let m = 1; m < 1 << cards.length; m++) if (cards.reduce((t, c, i) => (m & (1 << i) ? t + cardValue(c) : t), 0) === 15) fifteens++;
  let pairs = 0;
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) if (cards[i].rank === cards[j].rank) pairs++;
  const parts = [...(fifteens ? [`${fifteens} fifteen(s)`] : []), ...(pairs ? [`${pairs} pair(s)`] : [])];
  return { pts: fifteens * 2 + pairs * 2, parts };
}

const arg = (name: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? d);
const seeds = arg('seeds', 200);
const from = arg('from', 1);
const skillsArg = process.argv.find((a) => a.startsWith('--skills='));
const SKILLS = skillsArg ? skillsArg.split('=')[1].split(',').map(Number) : [0.3, 0.6, 0.85];
const listArg = process.argv.find((a) => a.startsWith('--list='));
const LIST = listArg ? listArg.split('=')[1].split(',').map(Number) : null;

function drive(seed: number, skill: number, onDiscard?: (hand: Card[], thrown: [Card, Card]) => void): RunResult {
  const run = runRequests({ ...SYNERGY_AWARE_PROFILE, classId: TUTORIAL_CLASS, traversalStrategy: opportunisticTraversal, playerSkill: skill, ...TUTORIAL_OPTIONS, seed });
  let step = run.next();
  let first = true;
  while (!step.done) {
    const r = step.value as RunRequest;
    const answer = r.fallback();
    if (first && r.kind === 'combat' && r.request.kind === 'discard') {
      first = false;
      onDiscard?.(r.request.context.hand, answer as [Card, Card]);
    }
    step = run.next(answer);
  }
  return step.value;
}

const same = (a: Card, b: Card) => a.rank === b.rank && a.suit === b.suit;
console.log('seed  first hand        keep        score  parts                                   wins by skill (encounters)');
for (const seed of LIST ?? Array.from({ length: seeds }, (_, i) => from + i)) {
  let hand: Card[] = [];
  let kept: Card[] = [];
  const results = SKILLS.map((skill) => drive(seed, skill));
  drive(seed, 0.85, (h, thrown) => {
    hand = h;
    kept = h.filter((c) => !thrown.some((t) => same(t, c)));
  });
  const { pts, parts } = keepScore(kept);
  const fifteen = parts.some((p) => /fifteen/.test(p));
  const pair = parts.some((p) => /pair/.test(p));
  const mark = fifteen && pair ? '*' : ' ';
  const outs = results.map((r) => `${r.outcome === 'victory' ? 'W' : '-'}(${r.log.filter((e) => e.type === 'encounter').length})`).join(' ');
  const cards = (cs: Card[]) => cs.map((c) => rankLabel(c.rank)).join(' ');
  console.log(`${String(seed).padEnd(5)}${mark} ${cards(hand).padEnd(18)}${cards(kept).padEnd(12)}${String(pts).padEnd(7)}${parts.join(', ').padEnd(40)}${outs}`);
}
