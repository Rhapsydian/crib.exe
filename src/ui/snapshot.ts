import { combatGenerator, type CombatAnswer, type CombatRequest } from '../engine/combat';
import { discardSkillStrategy, pegSkillStrategy } from '../engine/ai';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD, CONTAINMENT_THRESHOLD } from '../engine/encounters';
import { ENEMY_ROSTER, enemyCombatOptions, scaledEnemyLoadout, type EnemyDefinition } from '../engine/enemies';
import { CLASS_DEFINITIONS, type ClassId } from '../engine/classes';
import { authoredPiece } from '../engine/content/starting-loadouts';

/**
 * A real mid-fight moment for the layout mockups (P3): the engine is run
 * (AI on both sides) until it is the player's turn to peg, partway
 * through a hand that already has some combat history. Nothing on the
 * mockup screens is invented -- every number comes from this paused fight.
 */
export interface FightSnapshot {
  request: Extract<CombatRequest, { kind: 'play' }>;
  classId: ClassId;
  className: string;
  enemy: EnemyDefinition;
}

export function mockSnapshot(): FightSnapshot {
  const classId: ClassId = 'exploit-overclock';
  // A mid-run Blackhat: its start, plus a few on-class pickups.
  const loadout = [...CLASS_DEFINITIONS[classId].startingLoadout, authoredPiece('burst-clock'), authoredPiece('jackpot'), authoredPiece('zero-day-chain')];
  const enemy = ENEMY_ROSTER.find((e) => e.id === 'quarantine-ward')!;
  const enemyLoadout = scaledEnemyLoadout(enemy.loadout, enemy.magnitudeScaler ?? 1);
  const strategies = { discard: [discardSkillStrategy(0.85), discardSkillStrategy(0.78)] as const, play: [pegSkillStrategy(0.85), pegSkillStrategy(0.78)] as const };

  for (let seed = 1; seed < 200; seed++) {
    const fight = combatGenerator([loadout, enemyLoadout], {
      seed,
      gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
      winThreshold: [BREACH_THRESHOLD, CONTAINMENT_THRESHOLD],
      classId,
      ...enemyCombatOptions(enemy),
    });
    let step = fight.next();
    while (!step.done) {
      const r = step.value;
      if (r.kind === 'play' && r.side === 0 && r.view.handIndex >= 2 && r.view.log.length >= 6 && r.pegging.events.length >= 3 && r.pegging.hand.length >= 2) {
        return { request: r, classId, className: CLASS_DEFINITIONS[classId].name, enemy };
      }
      const answer: CombatAnswer = r.kind === 'discard' ? strategies.discard[r.side](r.context) : r.kind === 'play' ? strategies.play[r.side](r.context) : null;
      step = fight.next(answer);
    }
  }
  throw new Error('mockSnapshot: no suitable moment found');
}
