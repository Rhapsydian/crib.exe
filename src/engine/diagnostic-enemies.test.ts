import { describe, it, expect } from 'vitest';
import { CREDIT_PILLAR_IDS, PILLAR_IDS, pillarEnemy, allPillars, type DiagnosticEnemyId } from './diagnostic-enemies';
import { ENEMY_ROSTER, eligibleEnemies, pickRegularOrEliteEnemy, assignGatekeeperEnemy } from './enemies';
import { createRng } from './rng';
import { generateLayer } from './map-gen';
import { playCombat } from './combat';
import { CLASS_DEFINITIONS } from './classes';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD, CONTAINMENT_THRESHOLD } from './encounters';

// Session 51: ported to one pillar per verb (credit, suppress, tempo).
// The DoT, Drain and Throttle pillars retired with their mechanics; see
// diagnostic-enemies.ts's header. The unreachability guards are unchanged.

const SPEC = { scalar: 5, pointsCooldown: 12 };

describe('diagnostic pillars -- unreachable in real play', () => {
  // The load-bearing guarantee. Pillars are calibration fixtures; if one
  // ever reached a real run it would corrupt exactly the balance numbers
  // it exists to produce -- the same contamination that hit session 50's
  // own tier labelling. Asserted against every selection path rather
  // than trusted.
  const pillarIds = new Set<string>(PILLAR_IDS);

  it('is absent from ENEMY_ROSTER', () => {
    expect(ENEMY_ROSTER.filter((e) => pillarIds.has(e.id))).toEqual([]);
  });

  it('is never returned by eligibleEnemies, at any tier or layer', () => {
    for (const tier of ['regular', 'elite', 'gatekeeper'] as const) {
      for (let layer = 1; layer <= 4; layer++) {
        expect(eligibleEnemies(tier, layer).some((e) => pillarIds.has(e.id))).toBe(false);
      }
    }
  });

  it('is never drawn by pickRegularOrEliteEnemy, including the opener window', () => {
    for (const tier of ['regular', 'elite'] as const) {
      for (let layer = 1; layer <= 4; layer++) {
        for (let seed = 0; seed < 60; seed++) {
          // fightsResolved 0 exercises the opener window, which uses a
          // different candidate list than the normal path.
          for (const fightsResolved of [0, 9]) {
            const picked = pickRegularOrEliteEnemy(tier, layer, fightsResolved, createRng(seed));
            expect(pillarIds.has(picked.id)).toBe(false);
          }
        }
      }
    }
  });

  it('is never assigned to a gatekeeper node', () => {
    for (let layer = 1; layer <= 4; layer++) {
      for (let seed = 0; seed < 40; seed++) {
        const graph = assignGatekeeperEnemy(generateLayer({ rng: createRng(seed), nodeCount: 10 }), layer, createRng(seed + 1));
        const node = graph.nodes.find((n) => n.id === graph.gatekeeperNodeId);
        expect(pillarIds.has(String(node?.assignedEnemyId))).toBe(false);
      }
    }
  });
});

describe('diagnostic pillars -- shape', () => {
  it('gives every pillar exactly one piece, no passive, no beta, and the points-cooldown frequency knob', () => {
    // A pillar with two pieces, a beta or a passive would be measuring more
    // than one variable, which defeats the entire point of the suite.
    for (const id of PILLAR_IDS) {
      const enemy = pillarEnemy(id, SPEC);
      expect(enemy.loadout).toHaveLength(1);
      expect(enemy.passiveIds).toEqual([]);
      expect(enemy.loadout[0].beta).toBeUndefined();
      expect(enemy.loadout[0].pointsCooldown).toBe(SPEC.pointsCooldown);
    }
  });

  it("threads the scalar into each pillar's alpha amount", () => {
    for (const id of PILLAR_IDS) {
      const alpha = pillarEnemy(id, { ...SPEC, scalar: 7 }).loadout[0].alpha;
      expect(alpha.verb !== 'disrupt' && alpha.amount, id).toBe(7);
    }
  });

  it('covers one distinct verb per pillar', () => {
    const verbs = allPillars(SPEC).map((e) => e.loadout[0].alpha.verb);
    expect(new Set(verbs).size).toBe(PILLAR_IDS.length);
  });

  it('the tempo pillar slows the PLAYER (opponent target, threshold mode)', () => {
    expect(pillarEnemy('pillar-tempo', SPEC).loadout[0].alpha).toMatchObject({ verb: 'tempo', target: 'opponent', mode: 'threshold' });
  });
});

describe('diagnostic pillars -- they actually do something in a real fight', () => {
  // A fixture that silently fails to fire would produce a calibration
  // table of zeros that looks like data. Each pillar must measurably
  // move the fight against a real class loadout.
  const fight = (id: DiagnosticEnemyId, scalar: number, seed: number) =>
    playCombat([CLASS_DEFINITIONS['exploit-overclock'].startingLoadout, pillarEnemy(id, { scalar, pointsCooldown: 6 }).loadout], {
      seed,
      gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
      winThreshold: [BREACH_THRESHOLD, CONTAINMENT_THRESHOLD],
      classId: 'exploit-overclock',
    });

  it('fires: every pillar appears in a real combat log', () => {
    for (const id of PILLAR_IDS) {
      const fired = [0, 1, 2, 3, 4].some((seed) => fight(id, 6, seed).log.some((e) => e.side === 1 && e.subroutineId === `${id}-piece`));
      expect(fired, `${id} never fired across 5 seeds`).toBe(true);
    }
  });

  // The pillars split into two families with DIFFERENT success metrics,
  // which the first draft of this test missed. CREDIT pillars advance the
  // enemy's own Containment gauge. DENIAL pillars never touch it -- they
  // suppress the player and win at HARD_RESOLUTION_HAND by attrition, so
  // their enemy peak fill is 0 at every scalar. Measuring them with one
  // metric would have produced a table of zeros that looked like data.
  const CREDIT_PILLARS = CREDIT_PILLAR_IDS;
  const DENIAL_PILLARS = PILLAR_IDS.filter((id) => !CREDIT_PILLAR_IDS.includes(id));
  const SEEDS = [0, 1, 2, 3, 4, 5, 6, 7];

  it('credit pillars: a bigger scalar advances the enemy gauge further', () => {
    for (const id of CREDIT_PILLARS) {
      const enemyPeak = (scalar: number) => SEEDS.reduce((sum, seed) => sum + fight(id, scalar, seed).peakFillFraction[1], 0);
      expect(enemyPeak(12), `${id} did not improve with a larger scalar`).toBeGreaterThan(enemyPeak(2));
    }
  });

  it('denial pillars: never credit the enemy gauge, and a bigger scalar holds the player back further', () => {
    for (const id of DENIAL_PILLARS) {
      const enemyPeak = (scalar: number) => SEEDS.reduce((sum, seed) => sum + fight(id, scalar, seed).peakFillFraction[1], 0);
      const playerPeak = (scalar: number) => SEEDS.reduce((sum, seed) => sum + fight(id, scalar, seed).peakFillFraction[0], 0);
      const hands = (scalar: number) => SEEDS.reduce((sum, seed) => sum + fight(id, scalar, seed).hands.length, 0);
      // Structural: these win by denial, so the enemy gauge stays empty.
      expect(enemyPeak(12), `${id} credited the enemy gauge`).toBe(0);
      // Directional: NOT player peak fill. Peak is a high-water mark, so
      // pushing a gauge back after it peaked does not lower it, and the
      // player wins nearly always -- peak is pinned above 1.0 regardless.
      // Fight LENGTH is what actually responds to a denial knob.
      expect(hands(120), `${id} did not lengthen the fight at a larger scalar`).toBeGreaterThan(hands(1));
      void playerPeak;
    }
  });
});
