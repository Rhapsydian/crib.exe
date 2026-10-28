/**
 * No-route tail (a debugging aid, written while making a lost fight eject
 * the player back where they came from): plays Operator runs until two end
 * with no route left, and prints the last dozen log entries of each, to
 * see what closed the way forward.
 *
 * Usage:
 *   npx tsx scripts/noroute-tail.ts
 */
import { playRun, opportunisticTraversal, type RunEvent } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';

const describe = (e: RunEvent): string =>
  e.type === 'move' ? `move ${e.from}->${e.to}` : e.type === 'encounter' ? `enc ${e.nodeId} ${e.nodeType} ${e.outcome.newState}` : e.type;

let shown = 0;
for (let seed = 0; seed < 40 && shown < 2; seed++) {
  const r = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId: 'exploit-daemon', traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
  if (r.outcome !== 'noRouteRemains') continue;
  shown++;
  console.log(seed, r.log.slice(-12).map(describe).join(' | '));
}
