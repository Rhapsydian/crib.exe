import { describe, expect, it } from 'vitest';
import { playCombat } from '../engine/combat';
import { CLASS_STARTING_LOADOUTS } from '../engine/subroutines';
import { discardSkillStrategy, pegSkillStrategy } from '../engine/ai';
import { mergeSteps } from './timeline';
import { stepSound } from './sound-steps';

// Go-live step 4: a fight's steps and their sounds.
describe('stepSound', () => {
  const r = playCombat([CLASS_STARTING_LOADOUTS['exploit-overclock'], CLASS_STARTING_LOADOUTS['daemon-honeypot']], {
    seed: 5,
    gaugeThreshold: [12, 12],
    winThreshold: [50, 50],
    discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.85)],
    playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.85)],
  });
  const sounds = mergeSteps(r.timeline, r.log).map(stepSound);

  it('gives a fight its moments: hands, cuts, both sides\' cards, the table clearing, points, turns, fires', () => {
    for (const id of ['handStart', 'cut', 'cardYou', 'cardThem', 'clear', 'peg', 'show', 'turnYou', 'turnThem', 'fire'] as const) expect(sounds).toContain(id);
  });

  it('starts each hand once', () => {
    expect(sounds.filter((s) => s === 'handStart').length).toBe(r.hands.length);
  });
});
