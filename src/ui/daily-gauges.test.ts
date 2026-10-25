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

// Session 72 (the user's reports: the Breach bar short of full at the
// victory flash, gauges leaping, initiative animating backwards): every
// step the screen can stop on carries a reading, and the last one is the
// fight's true end.
describe('what the fight screen draws, step by step', () => {
  const classes = ['exploit-overclock', 'daemon-overclock', 'exploit-honeypot', 'daemon-honeypot'] as const;
  const fights = classes.flatMap((classId, k) =>
    [undefined, { suitSurge: 'overclock' as const, luckySevens: 3, rule: { fifteenPlus: 1 } }].map((glitches) =>
      playCombat([CLASS_STARTING_LOADOUTS[classId], CLASS_STARTING_LOADOUTS[classes[(k + 1) % 4]]], {
        seed: 11 + k,
        gaugeThreshold: [12, 12],
        winThreshold: [50, 50],
        classId,
        discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.6)],
        playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.6)],
        glitches,
      }),
    ),
  );

  it('every step carries a reading (no beat leaves the gauges standing still)', () => {
    for (const r of fights) for (const step of mergeSteps(r.timeline, r.log)) if (step.type !== 'clear') expect(stepGauges(step)).not.toBeNull();
  });

  it("each side's fill count only rises, so the bar wraps forward, never back", () => {
    for (const r of fights) {
      let last: [number, number] = [0, 0];
      for (const step of mergeSteps(r.timeline, r.log)) {
        const g = stepGauges(step);
        if (!g) continue;
        const now: [number, number] = [g[0].initiativeFills ?? 0, g[1].initiativeFills ?? 0];
        expect(now[0]).toBeGreaterThanOrEqual(last[0]);
        expect(now[1]).toBeGreaterThanOrEqual(last[1]);
        last = now;
      }
      // Fills counted at least once a fight: turns happened.
      expect(last[0] + last[1]).toBeGreaterThan(0);
    }
  });

  it("the last reading drawn is the fight's end: the winner's gauge full", () => {
    for (const r of fights) {
      const steps = mergeSteps(r.timeline, r.log);
      const end = steps[steps.length - 1];
      expect(end.type === 'beat' && end.beat.kind === 'end').toBe(true);
      const g = stepGauges(end)!;
      expect(Math.min(1, g[0].win / g[0].winThreshold)).toBeCloseTo(r.finalFillFraction[0]);
      expect(Math.min(1, g[1].win / g[1].winThreshold)).toBeCloseTo(r.finalFillFraction[1]);
      if (r.resolvedBy === 'threshold') expect(g[r.winner].win).toBeGreaterThanOrEqual(g[r.winner].winThreshold);
    }
  });
});
