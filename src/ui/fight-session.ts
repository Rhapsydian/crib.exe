import type { CombatAnswer, CombatResult } from '../engine/combat';
import type { FightSnapshot } from './snapshot';
import type { FightTier } from '../engine/heat';
import type { SkillDecision } from './skill-review';

/** The run's Heat as a fight starts, and how that fight charges it. */
export interface FightHeatContext {
  heat: number;
  allowance: number;
  tier: FightTier;
  /** 0-based. */
  layerIndex: number;
  /** Heat Sink's refund on a win here, if any. */
  refund: number;
  /** Ghost Credentials' multiple on the fight's Heat (session 65). */
  multiplier?: number;
}

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
  /** A run's fight only (session 63): what its Heat bar needs. */
  readonly heat?: FightHeatContext;
  answer(answer: CombatAnswer): void;
  /** The player's discards and plays so far (the review coach, session
   * 70). */
  readonly skill?: readonly SkillDecision[];
}

/** A result-panel button. */
export interface ResultAction {
  label: string;
  onclick: () => void;
}
