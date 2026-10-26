import { describe, expect, it } from 'vitest';
import { playCombat } from '../engine/combat';
import { discardSkillStrategy, pegSkillStrategy } from '../engine/ai';
import { BREACH_THRESHOLD, CONTAINMENT_THRESHOLD, GAUGE_THRESHOLD } from '../engine/encounters';
import {
  ENEMY_ROSTER,
  enemyCombatOptions,
  enemySkill,
  gaugeThresholdFor,
  magnitudeScalerFor,
  OPENER_FIGHT_WINDOW,
  scaledEnemyLoadout,
  winThresholdFor,
} from '../engine/enemies';
import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
import { LiveFight } from './live-fight.svelte';
import { decisionFor, rateSkill, type SkillDecision } from './skill-review';

// The UI driver must be a faithful driver: a live fight answered the way
// the simulation would answer it ends exactly as playCombat does.
describe('LiveFight', () => {
  const cases: [ClassId, string][] = [
    ['exploit-overclock', 'pentest-script'],
    ['daemon-honeypot', 'threat-intel-feed'],
    ['overclock-honeypot', 'quarantine-ward'],
  ];

  for (const [classId, enemyId] of cases) {
    it(`matches playCombat: ${classId} vs ${enemyId}`, () => {
      const enemy = ENEMY_ROSTER.find((e) => e.id === enemyId)!;
      const seed = 4242;
      const playerDiscard = discardSkillStrategy(0.85);
      const playerPeg = pegSkillStrategy(0.85);

      const live = new LiveFight({ classId, enemy, seed });
      let frames = 0;
      let previous: typeof live.frame = null;
      while (!live.result) {
        const frame = live.frame!;
        expect(frame).not.toBe(previous);
        previous = frame;
        frames++;
        const r = frame.request;
        live.answer(r.kind === 'discard' ? playerDiscard(r.context) : r.kind === 'play' ? playerPeg(r.context) : null);
      }

      const layer = enemy.minLayer;
      const skill = enemySkill(enemy.tier, layer, OPENER_FIGHT_WINDOW);
      const sim = playCombat([CLASS_DEFINITIONS[classId].startingLoadout, scaledEnemyLoadout(enemy.loadout, magnitudeScalerFor(enemy, layer, OPENER_FIGHT_WINDOW))], {
        seed,
        gaugeThreshold: [GAUGE_THRESHOLD, gaugeThresholdFor(enemy, layer, OPENER_FIGHT_WINDOW, GAUGE_THRESHOLD)],
        winThreshold: [BREACH_THRESHOLD, winThresholdFor(enemy, layer, OPENER_FIGHT_WINDOW, CONTAINMENT_THRESHOLD)],
        classId,
        ...enemyCombatOptions(enemy),
        discardStrategies: [playerDiscard, discardSkillStrategy(skill)],
        playStrategies: [playerPeg, pegSkillStrategy(skill)],
      });

      expect(frames).toBeGreaterThan(5);
      expect(live.result.winner).toBe(sim.winner);
      expect(live.result.log).toEqual(sim.log);
      expect(live.result.finalFillFraction).toEqual(sim.finalFillFraction);
    });
  }
});

// Session 72: a fight rates its own Cribbage (it waives Heat on Flawless),
// and the review rates the same choices for the player. They must agree.
describe("a fight's own rating", () => {
  it('matches the review coach, choice for choice', () => {
    for (const [classId, enemyId, skill] of [['exploit-overclock', 'pentest-script', 0.85], ['daemon-honeypot', 'threat-intel-feed', 0.4], ['overclock-honeypot', 'quarantine-ward', 1]] as const) {
      for (const seed of [1, 2, 3]) {
        const live = new LiveFight({ classId, enemy: ENEMY_ROSTER.find((e) => e.id === enemyId)!, seed });
        const discard = discardSkillStrategy(skill);
        const peg = pegSkillStrategy(skill);
        const decisions: SkillDecision[] = [];
        while (!live.result) {
          const r = live.frame!.request;
          const answer = r.kind === 'discard' ? discard(r.context) : r.kind === 'play' ? peg(r.context) : null;
          const d = decisionFor(r, answer as never);
          if (d) decisions.push(d);
          live.answer(answer as never);
        }
        const review = rateSkill(decisions, false)!;
        const tally = live.result.skill!;
        expect(tally.hands).toBe(review.hands);
        expect(tally.counted).toBe(review.decisions);
        expect(tally.lost / tally.hands).toBeCloseTo(review.lostPerHand, 9);
        if (skill === 1) expect(review.stars).toBe(5);
      }
    }
  }, 120_000);
});
