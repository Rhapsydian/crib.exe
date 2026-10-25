import { describe, expect, it } from 'vitest';
import { playCombat, type CombatOptions } from '../engine/combat';
import { CLASS_STARTING_LOADOUTS } from '../engine/subroutines';
import { discardSkillStrategy, pegSkillStrategy } from '../engine/ai';
import { mergeSteps, stepGauges } from './timeline';

// Session 72: a daily effect that moves a meter must move it ON SCREEN.
// The fight screen redraws its gauges only from steps that carry a
// reading, so this walks the steps as the replay does. (Suit Surge once
// added its initiative in the engine while the INIT bar sat still: the
// engine-level tests passed, the screen didn't show it.)
describe('daily effects reach the gauges on screen', () => {
  const fight = (glitches: CombatOptions['glitches']) =>
    playCombat([CLASS_STARTING_LOADOUTS['daemon-overclock'], CLASS_STARTING_LOADOUTS['exploit-overclock']], {
      seed: 3,
      gaugeThreshold: [12, 12],
      winThreshold: [50, 50],
      classId: 'daemon-overclock',
      discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.5)],
      playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.5)],
      glitches,
    });

  /** Each step of a daily effect `id`: the reading the screen showed just
   * before it, and the one it shows at it. */
  const onScreen = (glitches: CombatOptions['glitches'], id: string) => {
    const r = fight(glitches);
    let shown = stepGauges(mergeSteps(r.timeline, r.log)[0]) ?? null;
    const at: { before: typeof shown; now: typeof shown }[] = [];
    for (const step of mergeSteps(r.timeline, r.log)) {
      const reading = stepGauges(step);
      if (step.type === 'beat' && step.beat.kind === 'daily' && step.beat.id === id) at.push({ before: shown, now: reading });
      if (reading) shown = reading;
    }
    return at;
  };

  it('Suit Surge: its step shows the initiative it added', () => {
    const steps = onScreen({ suitSurge: 'overclock' }, 'suit-surge');
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) expect(s.now).not.toBeNull();
    expect(steps.some((s) => s.before && s.now && s.now[0].initiative === s.before[0].initiative + 1)).toBe(true);
  });

  it('Lucky Sevens: its step shows the Credit it added', () => {
    const steps = onScreen({ luckySevens: 3 }, 'lucky-sevens');
    expect(steps.length).toBeGreaterThan(0);
    for (const s of steps) expect(s.now).not.toBeNull();
    expect(steps.some((s) => s.before && s.now && s.now[0].win > s.before[0].win)).toBe(true);
  });
});
