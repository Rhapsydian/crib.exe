import { describe, expect, it } from 'vitest';
import { repForRun, LAYER_REP, ELITE_REP, VICTORY_REP, CLASS_ORDER, firstGatekeeperBeaten, nextClass } from './meta';
import { CLASS_DEFINITIONS } from './classes';
import type { RunEvent, RunResult } from './run';

// Session 71 (docs/design/meta-progression.md MP3): what a run earns.
const result = (outcome: RunResult['outcome'], log: RunEvent[]): RunResult => ({ outcome, layersCompleted: 0, finalHeat: 0, log, playerState: {} as RunResult['playerState'] });
const cleared = (layerIndex: number): RunEvent => ({ type: 'layerCleared', layerIndex });
const elite = (won: boolean): RunEvent => ({ type: 'encounter', layerIndex: 0, nodeId: 'e', nodeType: 'eliteFight', outcome: { newState: won ? 'inert' : 'closed' } as never, heatAfter: 0 });

describe('Rep for a run', () => {
  it('pays each layer breached, by depth, plus elites beaten and a victory', () => {
    const r = repForRun(result('victory', [elite(true), cleared(0), elite(false), cleared(1), elite(true), cleared(2), cleared(3)]));
    expect(r.total).toBe(LAYER_REP.reduce((a, b) => a + b, 0) + 2 * ELITE_REP + VICTORY_REP);
    expect(r.lines.map((l) => l.label)).toEqual(['Layer 1 breached', 'Layer 2 breached', 'Layer 3 breached', 'Layer 4 breached', '2 elites beaten', 'Victory']);
  });

  it('pays a layer breached, then caught, below a full continue', () => {
    const r = repForRun(result('breachedThenCaught', [cleared(0), cleared(1)]));
    expect(r.lines).toEqual([
      { label: 'Layer 1 breached', rep: LAYER_REP[0] },
      { label: 'Layer 2 breached, then caught', rep: Math.round(LAYER_REP[1] * 0.75) },
    ]);
  });

  it('the class chain covers every class once, Blackhat first (MP4)', () => {
    expect(new Set(CLASS_ORDER)).toEqual(new Set(Object.keys(CLASS_DEFINITIONS)));
    expect(CLASS_ORDER[0]).toBe('exploit-overclock');
    expect(nextClass('exploit-overclock')).toBe('exploit-honeypot');
    expect(nextClass('overclock-honeypot')).toBeNull();
  });

  it("the milestone is layer 1's gatekeeper beaten, not a later one or a loss (MP2)", () => {
    const gk = (layerIndex: number, won: boolean): RunEvent => ({ type: 'encounter', layerIndex, nodeId: 'g', nodeType: 'gatekeeperFight', outcome: { newState: won ? 'inert' : 'closed' } as never, heatAfter: 0 });
    expect(firstGatekeeperBeaten(result('quarantined', [gk(0, true), gk(1, false)]))).toBe(true);
    expect(firstGatekeeperBeaten(result('quarantined', [gk(0, false)]))).toBe(false);
    expect(firstGatekeeperBeaten(result('quarantined', [gk(1, true)]))).toBe(false);
  });

  it('pays nothing for a run lost on layer 1 without an elite', () => {
    expect(repForRun(result('quarantined', [elite(false)]))).toEqual({ lines: [], total: 0 });
  });
});
