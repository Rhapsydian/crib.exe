/**
 * Layer exploration (session 69, docs/archive/tuning-design.md T2): per layer, how
 * much of the map the simulated player visits, its non-gatekeeper fights,
 * and its highest Heat as a share of the layer's allowance; plus how runs
 * end. Target: about 60-65% of each layer's nodes, Heat peaking near 70%,
 * Heat ending about 10% of runs.
 *
 * Usage:
 *   npx tsx scripts/layer-explore.ts [--seeds=60]
 */
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { ALL_CLASS_IDS } from '../src/engine/classes';
import { layerHeatAllowance } from '../src/engine/heat';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const seeds = Number(args.seeds ?? 60);
const L = [0, 1, 2, 3].map(() => ({ reached: 0, visited: 0, nodes: 0, fights: 0, peak: 0 }));
const ends: Record<string, number> = {};
let runs = 0;
for (const classId of ALL_CLASS_IDS) {
  for (let seed = 0; seed < seeds; seed++) {
    const r = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
    runs++;
    ends[r.outcome] = (ends[r.outcome] ?? 0) + 1;
    let layer = -1, nodes = 0, fights = 0, peak = 0;
    let seen = new Set<string>();
    const close = () => {
      if (layer < 0) return;
      const c = L[layer];
      c.reached++;
      c.visited += seen.size;
      c.nodes += nodes;
      c.fights += fights;
      c.peak += peak / layerHeatAllowance(layer, r.playerState.maxHeatBonus);
    };
    for (const e of r.log) {
      if (e.type === 'layerGenerated') {
        close();
        layer = e.layerIndex;
        seen = new Set();
        peak = 0;
        fights = 0;
        nodes = e.nodeCount;
      }
      if (e.type === 'move') {
        seen.add(e.to);
        peak = Math.max(peak, e.heatAfter);
      }
      if (e.type === 'encounter') {
        peak = Math.max(peak, e.heatAfter);
        if (e.outcome.fight && e.outcome.fight.tier !== 'gatekeeper') fights++;
      }
    }
    close();
  }
}
console.log(`LAYER EXPLORATION -- ${seeds} seeds x 6 classes`);
L.forEach((c, i) => console.log(`layer ${i + 1}: visited ${((100 * c.visited) / c.nodes).toFixed(0)}% of ${(c.nodes / c.reached).toFixed(1)} nodes, ${(c.fights / c.reached).toFixed(1)} fights, peak Heat ${((100 * c.peak) / c.reached).toFixed(0)}% (${c.reached} reached)`));
console.log(Object.entries(ends).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((100 * v) / runs).toFixed(1)}%`).join('  '));
