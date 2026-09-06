/**
 * Shared `--syntheticGatekeepers` flag parsing for the diagnostic
 * scripts (session 49).
 *
 * The engine option is RunOptions.gatekeeperOverrides (see run.ts and
 * encounters.ts's SyntheticGatekeeper). This file only turns a CLI
 * string into it, so gatekeeper-check.ts, layer-funnel.ts and sweep.ts
 * all spell the flag the same way instead of parsing it three times.
 *
 * Syntax: four comma-separated slots, one per layer.
 *   1,1,1,1              every layer's gatekeeper fight is a free pass
 *   0.78,0.55,0.97,0.66  hold the roster at a designed/measured curve
 *   1,real,1,1           layer 2 fights for real, the rest are synthetic
 *   1,pin:zero-sum,1,1   layer 2 fights for real AND always draws Zero-Sum
 *
 * `pin:` is how one gatekeeper's cost is measured against a controlled
 * background -- the complement of --excludeGatekeeper, which can only
 * remove. Note the two compose: pinning is implemented as excluding the
 * layer's other stable members.
 *
 * IMPORTANT: any number produced with this flag set is NOT a plain
 * full-run metric. Say so when reporting one, the same way the
 * playerSkill and full-run-derived conventions are called out.
 */
import type { GatekeeperOverride } from '../src/engine/run';
import type { EnemyId } from '../src/engine/enemies';

/**
 * Mean `traceGenerated` on a real gatekeeper WIN, per layer -- measured
 * session 49 over 400 seeds x 6 classes at synergy/opportunistic/skill
 * 0.85. Supplied by default because trace feeds Heat, and Heat is its
 * own run-ending path: a synthetic generating none would lengthen runs
 * for a reason unrelated to gatekeepers.
 *
 * These are MEANS. Real trace is heavily skewed (median 0), and the mean
 * alone undercounts Heat deaths by roughly 1pp of run outcomes -- pass
 * an empirical sample array directly to the engine option if that
 * matters for what is being measured. Also measured under `synergy`
 * acquisition, while gatekeeper-check.ts's own runs use the floor
 * defaults; close enough for a Heat correction, not a calibration
 * target.
 */
export const MEASURED_GATEKEEPER_TRACE: [number, number, number, number] = [2.8, 2.68, 1.06, 0.76];

export type GatekeeperOverrides = [GatekeeperOverride?, GatekeeperOverride?, GatekeeperOverride?, GatekeeperOverride?];

export function parseSyntheticGatekeepers(spec: string | undefined, trace: [number, number, number, number] = MEASURED_GATEKEEPER_TRACE): GatekeeperOverrides | undefined {
  if (spec === undefined) return undefined;
  const slots = spec.split(',');
  if (slots.length !== 4) {
    throw new Error(`--syntheticGatekeepers needs exactly 4 comma-separated slots (one per layer), got ${slots.length}: "${spec}"`);
  }
  return slots.map((raw, i): GatekeeperOverride | undefined => {
    const slot = raw.trim();
    if (slot === '' || slot === 'real') return undefined;
    if (slot.startsWith('pin:')) {
      const enemyId = slot.slice(4) as EnemyId;
      if (!enemyId) throw new Error(`--syntheticGatekeepers slot ${i + 1}: "pin:" needs an enemy id`);
      return { kind: 'pinned', enemyId };
    }
    const passRate = Number(slot);
    if (!Number.isFinite(passRate) || passRate < 0 || passRate > 1) {
      throw new Error(`--syntheticGatekeepers slot ${i + 1}: expected a pass rate in [0,1], "real", or "pin:<enemyId>", got "${slot}"`);
    }
    return { kind: 'synthetic', passRate, traceGenerated: trace[i] };
  }) as GatekeeperOverrides;
}

/** One-line provenance for a diagnostic's own output header, so a number
 * measured under a synthetic roster can never be mistaken for a plain
 * full-run one further down the line. */
export function describeSyntheticGatekeepers(overrides: GatekeeperOverrides | undefined): string {
  if (!overrides) return 'gatekeepers: REAL (no synthetic override)';
  const parts = overrides.map((o, i) => {
    if (!o) return `L${i + 1}=real`;
    return o.kind === 'pinned' ? `L${i + 1}=pin:${o.enemyId}` : `L${i + 1}=p${o.passRate}`;
  });
  return `gatekeepers: SYNTHETIC [${parts.join(' ')}] -- NOT a plain full-run metric`;
}
