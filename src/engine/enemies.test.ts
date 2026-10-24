import { describe, it, expect } from 'vitest';
import { AUTHORED_GATEKEEPERS } from './content/enemies';
import { GATEKEEPER_MODS } from './gatekeeper-mods';
import { createRng } from './rng';
import { createNode } from './map-types';
import { playCombat } from './combat';
import { CLASS_STARTING_LOADOUTS, ALL_POOL_SUBROUTINES, ALL_SUBROUTINES } from './subroutines';
import { hasCreditPath, type SubroutineDefinition } from './subroutine-types';
import {
  ENEMY_ROSTER,
  enemyCombatOptions,
  eligibleEnemies,
  pickRegularOrEliteEnemy,
  assignGatekeeperEnemy,
  gatekeeperEnemyForNode,
  enemySkill,
  magnitudeScalerFor,
  gaugeThresholdFor,
  winThresholdFor,
  scaledEnemyLoadout,
  type EnemyDefinition,
} from './enemies';

// Session 51: rewritten for the SKELETON roster (A11) -- one regular per
// archetype, two elites, one gatekeeper per layer, no passives. The old
// roster's per-enemy assertions (Null Session's 65 override, the stealth
// gatekeepers, minLayer > 1 regulars) retired with it.

describe('ENEMY_ROSTER structural integrity', () => {
  it('E2 shape (session 60, CP4; sessions 67-68): 13 regular, 12 elite (3/6/9/12 eligible by layer), four gatekeepers per layer; every layer adds new regulars', () => {
    expect(ENEMY_ROSTER.filter((e) => e.tier === 'regular')).toHaveLength(13);
    expect(ENEMY_ROSTER.filter((e) => e.tier === 'elite')).toHaveLength(12);
    expect([1, 2, 3, 4].map((l) => ENEMY_ROSTER.filter((e) => e.tier === 'elite' && e.minLayer <= l).length)).toEqual([3, 6, 9, 12]);
    for (let layer = 1; layer <= 4; layer++) expect(ENEMY_ROSTER.some((e) => e.tier === 'regular' && e.minLayer === layer), `layer ${layer}`).toBe(true);
    for (let layer = 1; layer <= 4; layer++) {
      expect(ENEMY_ROSTER.filter((e) => e.tier === 'gatekeeper' && e.minLayer === layer), `layer ${layer}`).toHaveLength(4);
    }
  });

  it('E6: Honeypot enemies never appear before layer 2', () => {
    for (const enemy of ENEMY_ROSTER.filter((e) => e.archetypes.includes('honeypot'))) expect(enemy.minLayer, enemy.id).toBeGreaterThanOrEqual(2);
  });

  it('E4: regulars carry no Mod; elites and gatekeepers one Mod of their own tier; no enemy a class Mod', () => {
    for (const enemy of ENEMY_ROSTER) {
      expect(enemyCombatOptions(enemy), enemy.id).not.toHaveProperty('opponentBridge');
      if (enemy.tier === 'regular') expect(enemy.mods, enemy.id).toBeUndefined();
      else {
        expect(enemy.mods, enemy.id).toHaveLength(1);
        expect(GATEKEEPER_MODS[enemy.mods![0]].tier, enemy.id).toBe(enemy.tier);
      }
    }
  });

  it('every id is globally unique', () => {
    const ids = ENEMY_ROSTER.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Session 43's standing rule: every enemy loadout needs a credit path,
  // UNLESS the enemy is explicitly designed to stall to the hand-20
  // resolution instead (the user's own amendment). No enemy uses that
  // exemption -- exempt one here by id rather than loosening the check.
  it('every enemy can credit its own win gauge (session 28 regression guard)', () => {
    for (const enemy of ENEMY_ROSTER) {
      expect(enemy.loadout.some(hasCreditPath), `${enemy.name} (${enemy.id}) has no credit path`).toBe(true);
    }
  });

  it("every enemy's pieces belong to its own declared archetypes", () => {
    for (const enemy of ENEMY_ROSTER) {
      for (const piece of enemy.loadout) expect(enemy.archetypes, `${enemy.id}/${piece.id}`).toContain(piece.archetype);
    }
  });
});

describe('eligibleEnemies', () => {
  it('regular/elite eligibility is a floor -- a layer-1 enemy stays eligible at every later layer', () => {
    for (let layer = 1; layer <= 4; layer++) {
      expect(eligibleEnemies('regular', layer).some((e) => e.id === 'pentest-script')).toBe(true);
    }
  });

  it('regular/elite eligibility never includes an enemy whose minLayer is above the given layer', () => {
    for (let layer = 1; layer <= 4; layer++) {
      for (const tier of ['regular', 'elite'] as const) {
        expect(eligibleEnemies(tier, layer).every((e) => e.minLayer <= layer), `${tier} @ ${layer}`).toBe(true);
      }
    }
  });

  it('gatekeeper eligibility is an exact match, not a floor', () => {
    expect(eligibleEnemies('gatekeeper', 1).map((e) => e.id)).toEqual(['the-concierge', 'firewall-prime', 'the-house', 'bandwidth-cap']);
    expect(eligibleEnemies('gatekeeper', 2).map((e) => e.id)).toEqual(['quarantine-ward', 'zero-sum', 'signature-lock', 'sandbox']);
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
    expect(pickRegularOrEliteEnemy('elite', 4, 10, createRng(1)).tier).toBe('elite');
  });
});

describe('assignGatekeeperEnemy / gatekeeperEnemyForNode', () => {
  const graph = () => ({ nodes: [createNode('gk', 'gatekeeperFight')], edges: [], entryNodeId: 'gk', gatekeeperNodeId: 'gk' });

  it('assigns a valid, real gatekeeper id for the given layer', () => {
    const enemy = gatekeeperEnemyForNode(assignGatekeeperEnemy(graph(), 2, createRng(1)).nodes[0]);
    expect(enemy.tier).toBe('gatekeeper');
    expect(enemy.minLayer).toBe(2);
  });

  it('is deterministic for a fixed seed', () => {
    const a = assignGatekeeperEnemy(graph(), 3, createRng(42));
    const b = assignGatekeeperEnemy(graph(), 3, createRng(42));
    expect(a.nodes[0].assignedEnemyId).toBe(b.nodes[0].assignedEnemyId);
  });

  it("throws loudly when ablation excludes a layer's whole stable", () => {
    expect(() => assignGatekeeperEnemy(graph(), 1, createRng(1), ['the-concierge', 'firewall-prime', 'the-house', 'bandwidth-cap'])).toThrow();
  });

  it('ablating all but one of a layer leaves that one assigned', () => {
    const g = assignGatekeeperEnemy(graph(), 1, createRng(1), ['the-concierge', 'the-house', 'bandwidth-cap']);
    expect(g.nodes[0].assignedEnemyId).toBe('firewall-prime');
  });
});

describe('enemySkill', () => {
  it('is pinned low (0.15, session 67) during the opener window regardless of tier/layer', () => {
    expect(enemySkill('gatekeeper', 4, 0)).toBe(0.15);
    expect(enemySkill('regular', 1, 0)).toBe(0.15);
  });

  it('starts regulars at 0.25 and elites at 0.6 on layer 1 (session 67, E3)', () => {
    expect(enemySkill('regular', 1, 10)).toBeCloseTo(0.25);
    expect(enemySkill('elite', 1, 10)).toBeCloseTo(0.6);
    expect(enemySkill('gatekeeper', 1, 10)).toBeCloseTo(0.75);
  });

  it('is tier-primary: a higher tier is never weaker than a lower one at the same layer, past the opener window', () => {
    expect(enemySkill('regular', 2, 10)).toBeLessThan(enemySkill('elite', 2, 10));
    expect(enemySkill('elite', 2, 10)).toBeLessThan(enemySkill('gatekeeper', 2, 10));
  });

  it('is layer-secondary: the same tier climbs modestly from layer 1 to layer 4', () => {
    expect(enemySkill('regular', 1, 10)).toBeLessThan(enemySkill('regular', 4, 10));
  });
});

describe('magnitudeScalerFor (session 39 per-layer difficulty scaler)', () => {
  const gate = (layer: number) => ENEMY_ROSTER.find((e) => e.tier === 'gatekeeper' && e.minLayer === layer)!;

  it('every gatekeeper has its own stored magnitudeScaler set', () => {
    for (const gatekeeper of ENEMY_ROSTER.filter((e) => e.tier === 'gatekeeper')) expect(gatekeeper.magnitudeScaler).toBeDefined();
  });

  it("reads a gatekeeper's own stored value, not a live layer formula", () => {
    expect(magnitudeScalerFor(gate(1), 1, 10)).toBe(gate(1).magnitudeScaler);
    expect(magnitudeScalerFor(gate(4), 4, 10)).toBe(gate(4).magnitudeScaler);
    // A gatekeeper's authored scale (content/enemies.ts) becomes its stored value.
    const authored = AUTHORED_GATEKEEPERS.find((e) => e.id === 'quarantine-ward')!;
    expect(ENEMY_ROSTER.find((e) => e.id === 'quarantine-ward')!.magnitudeScaler).toBe(authored.scale);
  });

  it('regular/elite are pinned to 1 (no scaling) during the opener window regardless of layer', () => {
    expect(magnitudeScalerFor(ENEMY_ROSTER.find((e) => e.tier === 'regular')!, 4, 0)).toBe(1);
  });

  it('regular/elite climb from layer 1 to layer 4, past the opener window', () => {
    const regular = ENEMY_ROSTER.find((e) => e.tier === 'regular')!;
    const elite = ENEMY_ROSTER.find((e) => e.tier === 'elite')!;
    expect(magnitudeScalerFor(regular, 1, 10)).toBeLessThan(magnitudeScalerFor(regular, 4, 10));
    expect(magnitudeScalerFor(elite, 1, 10)).toBeLessThan(magnitudeScalerFor(elite, 4, 10));
  });

  it("regular/elite: the authored scale at the enemy's first layer, then the player-following layer curve", () => {
    const pentest = ENEMY_ROSTER.find((e) => e.id === 'pentest-script')!; // first layer 1, scale 1.25
    const firewall = ENEMY_ROSTER.find((e) => e.id === 'legacy-firewall')!; // first layer 2, scale 1.2
    expect(magnitudeScalerFor(pentest, 1, 10)).toBeCloseTo(1.25);
    expect(magnitudeScalerFor(firewall, 2, 10)).toBeCloseTo(1.2);
    expect(magnitudeScalerFor(pentest, 2, 10) / magnitudeScalerFor(pentest, 1, 10)).toBeCloseTo(1.4);
  });
});

describe('gaugeThresholdFor/winThresholdFor (session 40, per-side threshold plumbing)', () => {
  const gatekeeper = () => ENEMY_ROSTER.find((e) => e.tier === 'gatekeeper')!;

  it('no skeleton gatekeeper carries a threshold override or tempo dial', () => {
    for (const enemy of ENEMY_ROSTER.filter((e) => e.tier === 'gatekeeper')) {
      expect(enemy.gaugeThresholdScaler, enemy.id).toBeUndefined();
      expect(enemy.winThreshold, enemy.id).toBeUndefined();
    }
  });

  it('falls back to flatDefault for a gatekeeper with no override set', () => {
    expect(gaugeThresholdFor(gatekeeper(), 1, 10, 12)).toBe(12);
    expect(winThresholdFor(gatekeeper(), 1, 10, 50)).toBe(50);
  });

  it("scales flatDefault by a gatekeeper's own tempo dial when set (session 48)", () => {
    // Inverse polarity to magnitudeScaler: this scales the *threshold*,
    // so below 1 is a faster, more dangerous enemy.
    const faster: EnemyDefinition = { ...gatekeeper(), gaugeThresholdScaler: 0.75 };
    expect(gaugeThresholdFor(faster, 1, 10, 12)).toBe(9);
    const slower: EnemyDefinition = { ...gatekeeper(), gaugeThresholdScaler: 1.5 };
    expect(gaugeThresholdFor(slower, 1, 10, 12)).toBe(18);
    // Tracks the base rather than pinning a number.
    expect(gaugeThresholdFor(faster, 1, 10, 8)).toBe(6);
    // Rounded, and floored at 1 for gauges.ts's addPoints loop guard.
    const absurd: EnemyDefinition = { ...gatekeeper(), gaugeThresholdScaler: 0.01 };
    expect(gaugeThresholdFor(absurd, 1, 10, 12)).toBe(1);
  });

  it('winThreshold stays an absolute override -- it is not denominated in anything that moves', () => {
    const overridden: EnemyDefinition = { ...gatekeeper(), winThreshold: 30 };
    expect(winThresholdFor(overridden, 1, 10, 50)).toBe(30);
  });

  it('regular/elite always return flatDefault, regardless of layer or fightsResolved', () => {
    const regular = ENEMY_ROSTER.find((e) => e.tier === 'regular')!;
    const elite = ENEMY_ROSTER.find((e) => e.tier === 'elite')!;
    expect(gaugeThresholdFor(regular, 4, 10, 12)).toBe(12);
    expect(winThresholdFor(elite, 4, 10, 50)).toBe(50);
  });
});

describe('scaledEnemyLoadout', () => {
  const credit: SubroutineDefinition = {
    id: 'test-credit',
    name: 'test-credit',
    archetype: 'exploit',
    alpha: { verb: 'credit', amount: 10 },
    beta: { source: 'cards', category: 'pair', shape: 'stepped', at: 2, effect: { verb: 'suppress', amount: 4 } },
  };
  const disrupt: SubroutineDefinition = { id: 'test-disrupt', name: 'test-disrupt', archetype: 'exploit', alpha: { verb: 'disrupt', action: 'revealHand' } };

  it('scales the alpha and the beta effect proportionally', () => {
    const [scaled] = scaledEnemyLoadout([credit], 1.5);
    expect(scaled.alpha).toEqual({ verb: 'credit', amount: 15 });
    expect(scaled.beta?.effect).toEqual({ verb: 'suppress', amount: 6 });
  });

  it('leaves a magnitude-less effect unchanged', () => {
    expect(scaledEnemyLoadout([disrupt], 1.5)[0].alpha).toEqual({ verb: 'disrupt', action: 'revealHand' });
  });

  it('never changes when a beta applies -- magnitude scaling only', () => {
    const [scaled] = scaledEnemyLoadout([credit], 1.5);
    expect(scaled.beta).toMatchObject({ source: 'cards', category: 'pair', shape: 'stepped', at: 2 });
  });

  it('a multiplier of 1 is a genuine no-op (same array reference)', () => {
    const loadout = [credit];
    expect(scaledEnemyLoadout(loadout, 1)).toBe(loadout);
  });
});

// ---------------------------------------------------------------------
// Alarms (session 47's tracers; direct Heat since session 58).
// ---------------------------------------------------------------------

describe('enemy alarms', () => {
  it('alarms are enemy-only, and never on a shared pool piece', () => {
    // Enemies may raise the PLAYER's Heat (a threat, like a debuff). A
    // pool piece's definition is the same object the player can draw, so
    // an alarm belongs only on bespoke enemy pieces.
    const poolIds = new Set(ALL_POOL_SUBROUTINES.map((p) => p.id));
    for (const enemy of ENEMY_ROSTER) {
      for (const piece of enemy.loadout) {
        if (!piece.heatPressure) continue;
        expect(poolIds.has(piece.id), `${enemy.id}/${piece.id} carries an alarm but is a shared pool piece`).toBe(false);
      }
    }
  });

  it('no player-side piece carries an alarm, which would be inert', () => {
    for (const piece of ALL_SUBROUTINES) expect(piece.heatPressure ?? 0, piece.id).toBe(0);
  });

  it('a real fight against an authored enemy, with its Mods, resolves to a winner', () => {
    const enemy = ENEMY_ROSTER.find((e) => e.id === 'quarantine-ward')!;
    const result = playCombat([CLASS_STARTING_LOADOUTS['exploit-honeypot'], enemy.loadout], {
      seed: 5,
      gaugeThreshold: [8, 8],
      winThreshold: [50, 50],
      classId: 'exploit-honeypot',
      ...enemyCombatOptions(enemy),
    });
    expect(result.heatGenerated).toBeGreaterThanOrEqual(0);
    expect(result.winner === 0 || result.winner === 1).toBe(true);
  });
});
