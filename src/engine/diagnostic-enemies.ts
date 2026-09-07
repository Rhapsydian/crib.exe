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
 * All seven fire on `always` gated by `pointsCooldown`, so a sweep moves
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
 */
import type { EnemyDefinition, EnemyTier } from './enemies';
import type { PayloadEffect, SubroutineDefinition } from './subroutine-types';

export const PILLAR_IDS = [
  'pillar-burst',
  'pillar-dot-turn',
  'pillar-dot-points',
  'pillar-suppress',
  'pillar-drain',
  'pillar-tempo',
  'pillar-throttle',
] as const;

export type DiagnosticEnemyId = (typeof PILLAR_IDS)[number];

export interface PillarSpec {
  /** The single payload knob under test. Units differ per pillar — gauge
   * points for burst/suppress, points-per-tick for the DoTs, shield for
   * drain, a fraction of a starting threshold for tempo, and debuff
   * DURATION (not magnitude — see payloadFor) for throttle. */
  scalar: number;
  /** Fires every turn, gated by this many of the caster's OWN scored
   * points. This is the frequency axis. */
  pointsCooldown: number;
  /** Tick count for the two DoT pillars. Ignored by the others. */
  duration?: number;
  /** Combined points (either side) per tick, `globalPulse` only —
   * i.e. DoT-Points. Ignored by the others. */
  pointsPerTick?: number;
  /** Drives `enemySkill`, and `magnitudeScalerFor` for regular/elite, if
   * a pillar is ever routed through `resolveFight` rather than
   * `playCombat` directly. Defaults to 'regular'. */
  tier?: EnemyTier;
}

const DEFAULT_DURATION = 3;
const DEFAULT_POINTS_PER_TICK = 8;

/** Payload per pillar. `neutral` archetype throughout, deliberately: a
 * suited archetype would expose the payload to archetype-specific Ward
 * blocking and Mod amplification, which is exactly the kind of hidden
 * second variable a calibration fixture must not have. */
function payloadFor(id: DiagnosticEnemyId, spec: PillarSpec): PayloadEffect {
  const duration = spec.duration ?? DEFAULT_DURATION;
  switch (id) {
    case 'pillar-burst':
      return { kind: 'directBurst', amount: spec.scalar };
    case 'pillar-dot-turn':
      return { kind: 'dot', amountPerTick: spec.scalar, cadence: 'castersTurnPulse', duration };
    case 'pillar-dot-points':
      return {
        kind: 'dot',
        amountPerTick: spec.scalar,
        cadence: 'globalPulse',
        duration,
        pointsPerTick: spec.pointsPerTick ?? DEFAULT_POINTS_PER_TICK,
      };
    case 'pillar-suppress':
      return { kind: 'instantCounterPush', amount: spec.scalar };
    case 'pillar-drain':
      // Sustained denial: HoT reduces the OPPONENT's gauge over ticks,
      // the counterpart to instantCounterPush's one-shot (see
      // subroutine-types.ts's CAPPED tier note). Replaced a `ward`-based
      // "Stall" pillar in checkpoint 2: ward absorbs incoming offense
      // against the warded side, but the player wins by filling their
      // OWN Breach gauge, which an enemy shield never touches -- so it
      // measured a flat line at every scalar. Ward is mitigation, not a
      // win condition, and a pillar has to be a win condition.
      return { kind: 'hot', amountPerTick: spec.scalar, cadence: 'castersTurnPulse', duration };
    case 'pillar-tempo':
      // Positive raises the PLAYER's initiative threshold (a fraction of
      // their starting threshold), i.e. slows them -- the unambiguous
      // direction, unlike 'enemyGauge' where sign carries the meaning.
      return { kind: 'instantManipulation', target: 'enemyGaugeThreshold', amount: spec.scalar };
    case 'pillar-throttle':
      // NOTE: the scalar drives DURATION here, not magnitude. Session 50
      // found that `applyThrottled` checks only for the debuff's
      // PRESENCE and then applies module constants
      // (THROTTLED_REDUCTION/THROTTLED_FLOOR) -- `magnitude` is stored on
      // the debuff record and never read. Same for `corrupted`
      // (CORRUPTED_MULTIPLIER); only `choked` reads its magnitude. So
      // magnitude is a dead knob for this debuff kind and sweeping it
      // would produce a flat line that looked like a finding. Duration is
      // the axis that actually moves the fight. See BACKLOG.
      return { kind: 'debuff', debuffId: 'throttled', magnitude: spec.scalar, duration: spec.scalar };
  }
}

const PILLAR_NAMES: Record<DiagnosticEnemyId, string> = {
  'pillar-burst': 'Pillar: Burst',
  'pillar-dot-turn': 'Pillar: DoT (own turn)',
  'pillar-dot-points': 'Pillar: DoT (combined points)',
  'pillar-suppress': 'Pillar: Suppress',
  'pillar-drain': 'Pillar: Drain (sustained denial)',
  'pillar-tempo': 'Pillar: Tempo',
  'pillar-throttle': 'Pillar: Throttle',
};

/**
 * Builds one pillar at a given point in the sweep. A factory rather than
 * static data because the whole purpose is to vary `scalar` and
 * `pointsCooldown` — static definitions would need the sweep to mutate
 * them, which is how a fixture quietly stops matching what it claims.
 */
export function pillarEnemy(id: DiagnosticEnemyId, spec: PillarSpec): EnemyDefinition {
  const piece: SubroutineDefinition = {
    id: `${id}-piece`,
    name: PILLAR_NAMES[id],
    archetype: 'neutral',
    trigger: { kind: 'always' },
    payload: payloadFor(id, spec),
    tags: [],
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
