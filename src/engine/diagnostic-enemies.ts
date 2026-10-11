/**
 * Diagnostic pillar enemies (session 50) — calibration fixtures, never
 * production content.
 *
 * Each pillar is a minimal expression of exactly ONE enemy win
 * condition: a single subroutine, no passive, one tunable scalar. Sweep
 * that scalar and the trigger's cooldown, and you get a response curve
 * saying what a given win condition is worth — which the project has
 * never had. Production enemies were authored before any such instrument
 * existed, which is how the roster ended up with 11 enemies at a 100%
 * player win rate and a `magnitudeScaler` that measurably does nothing.
 *
 * Same move as the synthetic gatekeeper (`RunOptions.gatekeeperOverrides`):
 * make the thing you want to understand a controlled variable.
 *
 * **Not in `ENEMY_ROSTER`, deliberately.** Every selection path —
 * `eligibleEnemies`, `pickRegularOrEliteEnemy`, `assignGatekeeperEnemy` —
 * filters that array, so a definition absent from it is unreachable by
 * construction rather than by a flag someone can forget to check.
 * `diagnostic-enemies.test.ts` asserts this rather than trusting it.
 *
 * ## Why every pillar shares one trigger
 *
 * Every pillar's alpha fires each turn gated by `pointsCooldown`, so a sweep moves
 * exactly one variable at a time and pillars stay comparable to each
 * other. Trigger *frequency* is then a separate second axis, because
 * `pointsCooldown` "ticks only on the owning side's own scoring"
 * (`subroutine-types.ts`) — the same dependency a real occurrence
 * trigger has, which is what makes the two mappable.
 *
 * Fire rate is `min(turnRate, ownPoints / cooldown)`. Enemies score
 * ~11–12 points/hand and take ~1.03 turns/hand at `GAUGE_THRESHOLD` 12,
 * so the useful sweep range is roughly N = 8 → 320, logarithmically:
 *
 * | cooldown | fires/hand | equivalent occurrence |
 * |---|---|---|
 * | ~11 | ~1.0 (turn-limited) | fifteen / pair / go |
 * | ~30 | 0.37 | thirtyOne |
 * | ~50 | 0.22 | hisNobs |
 * | ~300 | 0.036 | flush |
 *
 * That mapping is an approximation until validated: a cooldown fires
 * *evenly* while occurrences arrive in *clusters*, and in a
 * threshold race burstiness can carry a gauge over the line in a way
 * even output cannot. See the plan's burstiness checkpoint.
 *
 * ## Session 51: one pillar per verb
 *
 * The archetype redesign (DESIGN.md "Archetypes & Subroutines") replaced
 * payload kinds with seven verbs, and step 2 of that redesign re-aligns
 * this suite one pillar per verb. This file carries the three pillars
 * that map directly: Burst became **Credit**, Suppress stayed, Tempo
 * stayed -- and Drain, which was sustained HoT suppression, folded into
 * Suppress, since a per-turn Suppress alpha IS sustained suppression now.
 * The two DoT pillars and Throttle have no verb counterpart and are gone.
 * Ward, Empower, Disrupt and Charge cannot win alone (D14), so their
 * pillars need a design -- a credit base plus the verb under test -- and
 * are step 2's work, not a port.
 */
import type { EnemyDefinition, EnemyTier } from './enemies';
import type { Effect, SubroutineDefinition } from './subroutine-types';

export const PILLAR_IDS = ['pillar-credit', 'pillar-suppress', 'pillar-tempo'] as const;

export type DiagnosticEnemyId = (typeof PILLAR_IDS)[number];

/** Pillars that win by filling their own Containment gauge; the rest win
 * by denial (attrition at the hand-20 deadline) and never credit. Two
 * families with different success metrics (D14). */
export const CREDIT_PILLAR_IDS: readonly DiagnosticEnemyId[] = ['pillar-credit'];

export interface PillarSpec {
  /** The single knob under test: gauge points for credit/suppress, a
   * fraction of the player's starting threshold for tempo. */
  scalar: number;
  /** Fires every turn, gated by this many of the caster's OWN scored
   * points. This is the frequency axis. */
  pointsCooldown: number;
  /** Drives `enemySkill`, and `magnitudeScalerFor` for regular/elite, if
   * a pillar is ever routed through `resolveFight` rather than
   * `playCombat` directly. Defaults to 'regular'. */
  tier?: EnemyTier;
}

/** The pillar's one alpha. No beta: a beta is a second variable, and the
 * pillar exists to price one alpha at a time (step 2 adds beta pillars). */
function alphaFor(id: DiagnosticEnemyId, spec: PillarSpec): Effect {
  switch (id) {
    case 'pillar-credit':
      return { verb: 'credit', amount: spec.scalar };
    case 'pillar-suppress':
      return { verb: 'suppress', amount: spec.scalar };
    case 'pillar-tempo':
      // Raises the PLAYER's initiative threshold by a fraction of their
      // starting threshold, i.e. slows them -- the unambiguous direction.
      return { verb: 'tempo', target: 'opponent', mode: 'threshold', amount: spec.scalar };
  }
}

const PILLAR_NAMES: Record<DiagnosticEnemyId, string> = {
  'pillar-credit': 'Pillar: Credit',
  'pillar-suppress': 'Pillar: Suppress',
  'pillar-tempo': 'Pillar: Tempo',
};

/**
 * Builds one pillar at a given point in the sweep. A factory rather than
 * static data because the whole purpose is to vary `scalar` and
 * `pointsCooldown` — static definitions would need the sweep to mutate
 * them, which is how a fixture quietly stops matching what it claims.
 */
export function pillarEnemy(id: DiagnosticEnemyId, spec: PillarSpec): EnemyDefinition {
  // Archetype is inert here: archetypes matter to Mods, bridge passives
  // and sequence betas, all of which are player-side only.
  const piece: SubroutineDefinition = {
    id: `${id}-piece`,
    name: PILLAR_NAMES[id],
    archetype: 'exploit',
    alpha: alphaFor(id, spec),
    pointsCooldown: spec.pointsCooldown,
  };
  return {
    id,
    name: PILLAR_NAMES[id],
    tier: spec.tier ?? 'regular',
    // Inert for a fixture -- an enemy's archetypes drive flavour and
    // gatekeeper stables, neither of which a pillar participates in.
    archetypes: ['exploit'],
    minLayer: 1,
    loadout: [piece],
    // No passive, on purpose: a passive is a second variable, and
    // Blackout Cell (the one genuinely dangerous elite) carries two.
    passiveIds: [],
  };
}

/** Every pillar at one sweep point — convenience for a harness that
 * wants the whole suite at matched settings. */
export function allPillars(spec: PillarSpec): EnemyDefinition[] {
  return PILLAR_IDS.map((id) => pillarEnemy(id, spec));
}
