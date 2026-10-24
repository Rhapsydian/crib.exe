import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
let shown = 0;
for (let seed = 0; seed < 40 && shown < 2; seed++) {
  const r = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId: 'exploit-daemon', traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
  if (r.outcome !== 'noRouteRemains') continue;
  shown++;
  const tail = r.log.slice(-12).map((e: any) => e.type === 'move' ? `move ${e.from}->${e.to}` : e.type === 'encounter' ? `enc ${e.nodeId} ${e.nodeType} ${e.outcome.newState}` : e.type);
  console.log(seed, tail.join(' | '));
}
