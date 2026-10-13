import { describe, it, expect } from 'vitest';
import { combatSkillEdge, cribbageSkillEdge, skillRetention, SKILL_RETENTION_FLOOR } from './skill-retention';
import { creditPiece } from './pricing';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from './encounters';
import { ALL_CLASS_IDS, CLASS_DEFINITIONS } from './classes';

// Checkpoint 6b's guard: an engine or content change that drowns out
// Cribbage skill fails the suite instead of passing unnoticed. Small
// samples, so the check is coarse -- `scripts/skill-check.ts` is the
// measurement; this is the tripwire.

const MATCHUP = { high: 0.85, low: 0.25 };
const OPTIONS = { seeds: 25, gaugeThreshold: GAUGE_THRESHOLD, winThreshold: BREACH_THRESHOLD };

describe('skillRetention', () => {
  it('is the combat edge over the Cribbage edge, and null with no Cribbage edge', () => {
    const r = (winRate: number) => ({ winRate, se: 0, fights: 1 });
    expect(skillRetention(r(0.7), r(0.9))).toBeCloseTo(0.5);
    expect(skillRetention(r(0.7), r(0.5))).toBeNull();
  });
});

describe('skill still decides fights (checkpoint 6b)', () => {
  const cribbage = cribbageSkillEdge(MATCHUP, 300);

  it('plain Cribbage has a clear edge at this matchup', () => {
    expect(cribbage.winRate).toBeGreaterThan(0.8);
  });

  it('a plain Credit mirror keeps the signal (turns come from points)', () => {
    const combat = combatSkillEdge([creditPiece(1)], MATCHUP, OPTIONS);
    expect(skillRetention(combat, cribbage)!).toBeGreaterThanOrEqual(SKILL_RETENTION_FLOOR);
  });

  it.each(ALL_CLASS_IDS)('%s starting loadout keeps retention above the floor', (classId) => {
    const combat = combatSkillEdge(CLASS_DEFINITIONS[classId].startingLoadout, MATCHUP, OPTIONS);
    expect(skillRetention(combat, cribbage)!).toBeGreaterThanOrEqual(SKILL_RETENTION_FLOOR);
  }, 30_000);
});
