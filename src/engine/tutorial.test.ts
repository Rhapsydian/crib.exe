import { describe, it, expect } from 'vitest';
import { playRun, runRequests, opportunisticTraversal } from './run';
import { SYNERGY_AWARE_PROFILE } from './profiles';
import { TUTORIAL_LAYER, TUTORIAL_OPTIONS } from './tutorial';
import { isReachable } from './map-types';
import { ENEMY_ROSTER, enemyById } from './enemies';

// Session 63, docs/tutorial-design.md T4-T5: the guided run's frame.
describe('the guided first run', () => {
  const run = () => playRun({ ...SYNERGY_AWARE_PROFILE, ...TUTORIAL_OPTIONS, traversalStrategy: opportunisticTraversal, playerSkill: 0.85 });

  it('is one layer, on the hand-made map, ending at its gatekeeper', () => {
    const result = run();
    const encounters = result.log.filter((e) => e.type === 'encounter');
    expect(encounters.every((e) => e.type === 'encounter' && e.layerIndex === 0)).toBe(true);
    const visited = encounters.map((e) => (e.type === 'encounter' ? e.nodeId : ''));
    for (const id of visited) expect(TUTORIAL_LAYER.nodes.some((n) => n.id === id)).toBe(true);
    if (result.outcome === 'victory') {
      expect(result.layersCompleted).toBe(1);
      expect(visited.at(-1)).toBe('t-gatekeeper');
    }
  }, 60_000);

  it('walks the outline: fight, fight, Shop, Safehouse, gatekeeper, in that order', () => {
    expect(TUTORIAL_LAYER.nodes.map((n) => n.type)).toEqual(['relay', 'regularFight', 'regularFight', 'shop', 'safehouse', 'gatekeeperFight']);
    expect(isReachable(TUTORIAL_LAYER, TUTORIAL_LAYER.entryNodeId, TUTORIAL_LAYER.gatekeeperNodeId)).toBe(true);
    expect(TUTORIAL_LAYER.nodes.find((n) => n.id === TUTORIAL_LAYER.gatekeeperNodeId)?.assignedEnemyId).toBe('firewall-beta');
  });

  it('meets Firewall Beta, a gentler Firewall Prime that real runs never draw', () => {
    expect(enemyById('firewall-beta')?.name).toBe('Firewall Beta');
    expect(enemyById('firewall-beta')?.mods).toEqual(['rate-limit']);
    expect(ENEMY_ROSTER.some((e) => e.id === 'firewall-beta')).toBe(false);
    expect(enemyById('firewall-beta')!.magnitudeScaler!).toBeLessThan(enemyById('firewall-prime')!.magnitudeScaler!);
  });

  it('offers no rewards after its gatekeeper, since the run ends there', () => {
    const gen = runRequests({ ...SYNERGY_AWARE_PROFILE, ...TUTORIAL_OPTIONS, traversalStrategy: opportunisticTraversal, playerSkill: 0.85 });
    let step = gen.next();
    let atGatekeeper = false;
    let rewardsAfter = 0;
    while (!step.done) {
      const r = step.value;
      if (r.kind === 'fightStart') atGatekeeper = r.tier === 'gatekeeper';
      if (atGatekeeper && r.kind === 'reward') rewardsAfter++;
      step = gen.next(r.fallback());
    }
    expect(step.value.outcome).toBe('victory');
    expect(atGatekeeper).toBe(true);
    expect(rewardsAfter).toBe(0);
  }, 60_000);

  it('starts Blackhat, with a Flash Drive, a banked Port Scan and 40 Data', () => {
    const first = runRequests({ ...SYNERGY_AWARE_PROFILE, ...TUTORIAL_OPTIONS, traversalStrategy: opportunisticTraversal, playerSkill: 0.85 }).next();
    if (first.done || first.value.kind !== 'move') throw new Error('expected the map first');
    const player = first.value.playerState;
    expect(player.classId).toBe('exploit-overclock');
    expect(player.carriedBurnerIds).toEqual(['flash-drive']);
    expect(player.material).toEqual({ 'port-scan': 1 });
    expect(player.data).toBe(40);
    expect(first.value.graph.nodes.map((n) => n.id)).toEqual(TUTORIAL_LAYER.nodes.map((n) => n.id));
  });
});
