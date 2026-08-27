import { describe, it, expect } from 'vitest';
import { createRng } from './rng';
import { createNode } from './map-types';
import {
  ENEMY_ROSTER,
  eligibleEnemies,
  pickRegularOrEliteEnemy,
  assignGatekeeperEnemy,
  gatekeeperEnemyForNode,
  enemySkill,
} from './enemies';

/**
 * Phase 5 checkpoint E: roster-integrity tests for the real 32-enemy
 * roster (checkpoint D) and the selection/skill-dial machinery
 * (checkpoint C), plus a direct regression guard for this session's own
 * finding -- 9 enemies originally shipped with zero payload capable of
 * crediting their own win-gauge at all (DESIGN.md's Neutral Archetype
 * section), fixed via a neutral-piece retrofit.
 */

const CREDIT_CAPABLE_PAYLOAD_KINDS = new Set(['directBurst', 'piercing', 'chainFinisherScaling', 'riskRewardBurst', 'dot']);

describe('ENEMY_ROSTER structural integrity', () => {
  it('has exactly 32 enemies: 12 regular, 8 elite, 12 gatekeeper', () => {
    expect(ENEMY_ROSTER).toHaveLength(32);
    expect(ENEMY_ROSTER.filter((e) => e.tier === 'regular')).toHaveLength(12);
    expect(ENEMY_ROSTER.filter((e) => e.tier === 'elite')).toHaveLength(8);
    expect(ENEMY_ROSTER.filter((e) => e.tier === 'gatekeeper')).toHaveLength(12);
  });

  it('every id is globally unique', () => {
    const ids = ENEMY_ROSTER.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every gatekeeper has an exact-layer stable of at least 2 members for each of the 4 layers', () => {
    for (let layer = 1; layer <= 4; layer++) {
      const stable = ENEMY_ROSTER.filter((e) => e.tier === 'gatekeeper' && e.minLayer === layer);
      expect(stable.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("every enemy has at least one payload kind capable of crediting its own win-gauge -- the session 28 regression guard (9 enemies originally had none: Legacy Firewall, Access Gate, Hardened Workstation, Zero Trust Node, Backchannel Handler, Firewall Prime, Ghost Process, Null Session, Ghost in the Machine)", () => {
    for (const enemy of ENEMY_ROSTER) {
      const canCredit = enemy.loadout.some((piece) => CREDIT_CAPABLE_PAYLOAD_KINDS.has(piece.payload.kind));
      expect(canCredit, `${enemy.name} (${enemy.id}) has no credit-capable payload`).toBe(true);
    }
  });
});

describe('eligibleEnemies', () => {
  it('regular/elite eligibility is a floor -- a layer-1 enemy stays eligible at every later layer', () => {
    for (let layer = 1; layer <= 4; layer++) {
      expect(eligibleEnemies('regular', layer).some((e) => e.id === 'script-kiddie')).toBe(true);
    }
  });

  it('regular/elite eligibility excludes an enemy whose minLayer is above the given layer', () => {
    expect(eligibleEnemies('regular', 2).some((e) => e.id === 'hardened-workstation')).toBe(false); // minLayer 3
    expect(eligibleEnemies('regular', 3).some((e) => e.id === 'hardened-workstation')).toBe(true);
  });

  it('gatekeeper eligibility is an exact match, not a floor', () => {
    expect(eligibleEnemies('gatekeeper', 1).map((e) => e.id)).not.toContain('incident-response'); // layer 2
    expect(eligibleEnemies('gatekeeper', 2).map((e) => e.id)).toContain('incident-response');
    expect(eligibleEnemies('gatekeeper', 1).length).toBeGreaterThanOrEqual(2);
  });
});

describe('pickRegularOrEliteEnemy', () => {
  it('restricts to layer-1 Regular identities during the opener window (fightsResolved < 3), regardless of requested tier', () => {
    const rng = createRng(1);
    for (let fightNumber = 0; fightNumber < 3; fightNumber++) {
      const picked = pickRegularOrEliteEnemy('elite', 4, fightNumber, rng);
      expect(picked.tier).toBe('regular');
      expect(picked.minLayer).toBe(1);
    }
  });

  it('picks from the real tier/layer pool once past the opener window', () => {
    const rng = createRng(1);
    const picked = pickRegularOrEliteEnemy('elite', 4, 10, rng);
    expect(picked.tier).toBe('elite');
  });
});

describe('assignGatekeeperEnemy / gatekeeperEnemyForNode', () => {
  it('assigns a valid, real gatekeeper id for the given layer', () => {
    const graph = { nodes: [createNode('gk', 'gatekeeperFight')], edges: [], entryNodeId: 'gk', gatekeeperNodeId: 'gk' };
    const assigned = assignGatekeeperEnemy(graph, 2, createRng(1));
    const node = assigned.nodes[0];
    expect(node.assignedEnemyId).toBeDefined();
    const enemy = gatekeeperEnemyForNode(node);
    expect(enemy.tier).toBe('gatekeeper');
    expect(enemy.minLayer).toBe(2);
  });

  it('is deterministic for a fixed seed', () => {
    const graph = { nodes: [createNode('gk', 'gatekeeperFight')], edges: [], entryNodeId: 'gk', gatekeeperNodeId: 'gk' };
    const a = assignGatekeeperEnemy(graph, 3, createRng(42));
    const b = assignGatekeeperEnemy(graph, 3, createRng(42));
    expect(a.nodes[0].assignedEnemyId).toBe(b.nodes[0].assignedEnemyId);
  });
});

describe('enemySkill', () => {
  it('is pinned to the floor during the opener window regardless of tier/layer', () => {
    expect(enemySkill('gatekeeper', 4, 0)).toBe(0);
  });

  it('is tier-primary: a higher tier is never weaker than a lower one at the same layer, past the opener window', () => {
    expect(enemySkill('regular', 2, 10)).toBeLessThan(enemySkill('elite', 2, 10));
    expect(enemySkill('elite', 2, 10)).toBeLessThan(enemySkill('gatekeeper', 2, 10));
  });

  it('is layer-secondary: the same tier climbs modestly from layer 1 to layer 4', () => {
    expect(enemySkill('regular', 1, 10)).toBeLessThan(enemySkill('regular', 4, 10));
  });
});
