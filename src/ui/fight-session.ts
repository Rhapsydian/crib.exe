import type { CombatAnswer, CombatResult } from '../engine/combat';
import type { FightSnapshot } from './snapshot';

/**
 * What the fight screen needs from whoever runs the fight: the standalone
 * test fight (live-fight.svelte.ts) or a fight inside a run
 * (live-run.svelte.ts). The current frame to draw (null between
 * decisions), the result once it's over, and where the player's answers
 * go.
 */
export interface FightSession {
  readonly frame: FightSnapshot | null;
  readonly result: CombatResult | null;
  readonly enemyName: string;
  /** A small detail line for the result panel ("seed 1234", "layer 2"). */
  readonly detail: string;
  answer(answer: CombatAnswer): void;
}

/** A result-panel button. */
export interface ResultAction {
  label: string;
  onclick: () => void;
}
