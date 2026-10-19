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
