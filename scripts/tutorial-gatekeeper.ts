/**
 * The tutorial's gatekeeper (session 63, the user's ask: turn Firewall
 * Prime down for the tutorial only). The guided run reaches its
 * gatekeeper after two fights, far less built than a real run's layer 1,
 * so it meets Firewall Beta (enemies.ts: Firewall Prime turned down,
 * with Rate Limit's looser cap), whose strength can be dialled further
 * per node (MapNode.gatekeeperScale). This measures the tutorial's pass rate at
 * the gatekeeper over many deals, per strength and player skill.
 *
 * Usage:
 *   npx tsx scripts/tutorial-gatekeeper.ts [--seeds=300] [--scales=1,0.85,0.7] [--skills=0.3,0.6,0.85]
 */
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { TUTORIAL_LAYER, TUTORIAL_OPTIONS } from '../src/engine/tutorial';

const list = (name: string, d: number[]) => {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a ? a.split('=')[1].split(',').map(Number) : d;
};
const seeds = list('seeds', [300])[0];
const scales = list('scales', [1, 0.85, 0.7]);
const skills = list('skills', [0.3, 0.6, 0.85]);

console.log(`gatekeeper pass rate (of runs that reach it), ${seeds} seeds`);
console.log(`scale  ${skills.map((s) => `skill ${s}`.padEnd(14)).join('')}`);
for (const scale of scales) {
  const layer = { ...TUTORIAL_LAYER, nodes: TUTORIAL_LAYER.nodes.map((n) => (n.type === 'gatekeeperFight' ? { ...n, gatekeeperScale: scale } : n)) };
  const cells = skills.map((skill) => {
    let reached = 0;
    let won = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const r = playRun({ ...SYNERGY_AWARE_PROFILE, traversalStrategy: opportunisticTraversal, playerSkill: skill, ...TUTORIAL_OPTIONS, layerGraphs: [layer], seed });
      const atGatekeeper = r.log.some((e) => e.type === 'encounter' && e.nodeType === 'gatekeeperFight');
      if (atGatekeeper) reached++;
      if (r.outcome === 'victory') won++;
    }
    return `${((100 * won) / Math.max(1, reached)).toFixed(1)}% (${reached})`.padEnd(14);
  });
  console.log(`${String(scale).padEnd(7)}${cells.join('')}`);
}
