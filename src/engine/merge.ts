import type { PayloadEffect, SubroutineDefinition, TriggerFamily } from './subroutine-types';
import type { RunPlayerState } from './run';
import { HEAT_HIGH_FRACTION, HEAT_MAX } from './heat';

/**
 * Duplicate material & Merge (Phase 4 checkpoint E): acquiring an
 * already-owned subroutine becomes bench material instead of a second
 * copy (loadout.ts's acquireSubroutine); Merge spends it to upgrade the
 * base copy already owned. DESIGN.md's Duplicate Subroutines section:
 * "improves magnitude/efficiency only -- bigger payload, lower trigger
 * threshold, a higher Scaling bank cap -- never payload sub-type or
 * trigger family."
 */

export const MERGE_MAGNITUDE_BONUS = 3; // TBD/playtesting
const MERGE_TRIGGER_EASE_AMOUNT = 2; // TBD/playtesting
const MERGE_SCALING_CAP_BONUS = 2; // TBD/playtesting
export const MERGE_RANK_CAP = 3; // TBD/playtesting, same treatment as the slot cap

// Total banked material (summed across every subroutine id) counted as
// "high" by the opportunistic Safehouse strategy below -- TBD/playtesting.
export const MATERIAL_HIGH_THRESHOLD = 2;

/** Eases whichever numeric "how much banked progress needed" knob a
 * trigger carries, floored/ceilinged sensibly -- shared by Operator's
 * Primed passive (resolve.ts) and Merge's own trigger-knob fallback,
 * since both are "make this condition easier to satisfy." Occurrence's
 * 'scaling' variation is deliberately excluded here: unlike 'threshold',
 * it already fires unconditionally on every occurrence (see
 * triggers.ts's updateSubroutineState -- `ready` is true regardless of
 * `cap`), so there's no firing-ease knob to touch. Its `cap` is a
 * scaling ceiling, not a gate -- Merge treats raising it as a separate,
 * power-improving case below (increasedScalingCap), not an "easier to
 * fire" one. 'instant' Occurrence and the non-numeric trigger kinds
 * (chained/always/enemyState) have no knob at all here either. */
export function easeTriggerCondition(trigger: TriggerFamily, amount: number): TriggerFamily {
  if (trigger.kind === 'accumulator') return { ...trigger, threshold: Math.max(1, trigger.threshold - amount) };
  if (trigger.kind === 'occurrence' && trigger.variation === 'threshold') {
    return { ...trigger, bankTarget: Math.max(1, trigger.bankTarget - amount) };
  }
  if (trigger.kind === 'selfState' && trigger.condition === 'heatAbove') {
    return { ...trigger, value: Math.max(0, trigger.value - amount) };
  }
  if (trigger.kind === 'selfState' && trigger.condition === 'heatBelow') {
    return { ...trigger, value: trigger.value + amount };
  }
  return trigger;
}

/** Merge-only: raises Occurrence: Scaling's bank cap, a genuine power
 * improvement (DESIGN.md's "higher Scaling bank cap") distinct from
 * easeTriggerCondition's "easier to fire" -- see that function's own
 * comment on why 'scaling' is excluded there. */
function increasedScalingCap(trigger: TriggerFamily, amount: number): TriggerFamily {
  if (trigger.kind === 'occurrence' && trigger.variation === 'scaling') return { ...trigger, cap: trigger.cap + amount };
  return trigger;
}

/** Merge's trigger-knob fallback, used only when the payload itself has
 * no magnitude to improve: tries easeTriggerCondition first (Accumulator/
 * Occurrence:threshold/Self-state heat), then falls back to
 * increasedScalingCap for Occurrence: scaling. A piece with neither (e.g.
 * a Chained-triggered Ward) is a true no-op -- not expected to occur
 * across the 78 authored subroutines (every one has a payload magnitude
 * or one of these knobs), so this doesn't specially guard against it. */
function improveTriggerKnob(trigger: TriggerFamily): TriggerFamily {
  const eased = easeTriggerCondition(trigger, MERGE_TRIGGER_EASE_AMOUNT);
  if (eased !== trigger) return eased;
  return increasedScalingCap(trigger, MERGE_SCALING_CAP_BONUS);
}

/** Applies `transform` to whichever field carries a payload's "how hard
 * does this hit" magnitude, or returns null if the payload has none
 * (Ward/Cleanse/Cribbage-Layer Manipulation, and Scheduled Sabotage's
 * own top-level shape -- its wrapped inner effect isn't recursed into, a
 * deliberate simplification). Generic by field name rather than a
 * per-payload-kind table beyond that dispatch, per the plan's own
 * "resolved generically" decision. The shared engine behind both
 * improvedPayloadMagnitude (additive, below) and enemies.ts's
 * scaledPayloadMagnitude (multiplicative, session 39's per-layer
 * difficulty scaler) -- factored out so the one big kind-by-kind dispatch
 * only has to exist once. */
function transformPayloadMagnitude(payload: PayloadEffect, transform: (amount: number) => number): PayloadEffect | null {
  switch (payload.kind) {
    case 'directBurst':
    case 'piercing':
    case 'riskRewardBurst':
    case 'instantCounterPush':
    case 'instantManipulation':
    case 'selfHeatReduction':
    case 'ward':
      // Breach/Containment redesign (session 22+): Ward became an
      // accumulating shield amount, no longer archetype-scoped -- now a
      // genuine magnitude this can transform, same as any other payload
      // with an `amount` field.
      return { ...payload, amount: transform(payload.amount) };
    case 'chainFinisherScaling':
      return { ...payload, baseAmount: transform(payload.baseAmount) };
    case 'dot':
    case 'hot':
      return { ...payload, amountPerTick: transform(payload.amountPerTick) };
    case 'debuff':
      return { ...payload, magnitude: transform(payload.magnitude) };
    default:
      return null;
  }
}

/** Bumps a payload's magnitude by a flat additive amount -- Merge's own
 * upgrade shape. Exported (session 25) for Operator's reworked Primed
 * passive (`resolve.ts`) to reuse -- the same generic magnitude bump,
 * applied to the caster's next Exploit fire instead of a permanent
 * Merge upgrade. */
export function improvedPayloadMagnitude(payload: PayloadEffect, amount: number): PayloadEffect | null {
  return transformPayloadMagnitude(payload, (current) => current + amount);
}

/** Scales a payload's magnitude by a multiplier -- enemies.ts's per-layer
 * difficulty scaler (session 39), proportional rather than flat so it
 * doesn't hit low- and high-magnitude payloads unevenly the way a flat
 * bonus would. `multiplier` of 1 is a no-op (still returns a new object
 * for a magnitude-bearing payload, same "null only for a genuinely
 * magnitude-less payload" contract as improvedPayloadMagnitude). */
export function scaledPayloadMagnitude(payload: PayloadEffect, multiplier: number): PayloadEffect | null {
  return transformPayloadMagnitude(payload, (current) => current * multiplier);
}

/** Shrinks a payload's magnitude linearly by `decayPerFire` for every
 * prior fire this combat (`fireCount`), floored at `floor` -- the
 * mechanism behind SubroutineDefinition.magnitudeDecayPerFire (session
 * 39, Firewall Prime's Zero Trust redesign). A self-limiting alternative
 * to a hard fire cap: still hits close to full strength the first couple
 * of times, but tapers toward `floor` rather than stopping outright, so
 * persistent pressure eventually gets real relief instead of hitting an
 * infinite wall. `fireCount` is the count *before* this fire (how many
 * times it's already fired, not counting the current one) -- resolve.ts's
 * payloadForFire reads it straight from the still-unincremented runtime
 * state, since resetAfterFire (which increments it) hasn't run yet at
 * the point a fire's own payload gets resolved. */
export function decayedPayloadMagnitude(
  payload: PayloadEffect,
  fireCount: number,
  decayPerFire: number,
  floor: number,
): PayloadEffect | null {
  return transformPayloadMagnitude(payload, (current) => Math.max(floor, current - decayPerFire * fireCount));
}

function upgradedDefinition(definition: SubroutineDefinition): SubroutineDefinition {
  const improvedPayload = improvedPayloadMagnitude(definition.payload, MERGE_MAGNITUDE_BONUS);
  if (improvedPayload) return { ...definition, payload: improvedPayload };
  return { ...definition, trigger: improveTriggerKnob(definition.trigger) };
}

/** Spends 1 banked material to rank up the owned copy of `id` (found in
 * installedLoadout or bench, wherever it currently lives), applying
 * upgradedDefinition's generalized rule in place. A no-op if there's no
 * material banked for `id`, the id isn't owned at all, or it's already
 * at MERGE_RANK_CAP. */
export function mergeSubroutine(playerState: RunPlayerState, id: string): RunPlayerState {
  const material = playerState.material[id] ?? 0;
  const rank = playerState.rank[id] ?? 0;
  if (material <= 0 || rank >= MERGE_RANK_CAP) return playerState;

  const installedIndex = playerState.installedLoadout.findIndex((piece) => piece.id === id);
  const benchIndex = playerState.bench.findIndex((piece) => piece.id === id);
  if (installedIndex === -1 && benchIndex === -1) return playerState;

  const installedLoadout =
    installedIndex === -1
      ? playerState.installedLoadout
      : playerState.installedLoadout.map((piece, i) => (i === installedIndex ? upgradedDefinition(piece) : piece));
  const bench =
    benchIndex === -1 ? playerState.bench : playerState.bench.map((piece, i) => (i === benchIndex ? upgradedDefinition(piece) : piece));

  return {
    ...playerState,
    installedLoadout,
    bench,
    material: { ...playerState.material, [id]: material - 1 },
    rank: { ...playerState.rank, [id]: rank + 1 },
  };
}

/** What a script does at a Safehouse: Rest (reduce Heat) or Merge --
 * DESIGN.md's deliberate trade-off, one action per visit (a node goes
 * inert after its first resolved encounter regardless of type). */
export type SafehouseAction = 'rest' | 'merge';
/** `heat` is the run's current Heat at the moment of the Safehouse visit
 * -- added alongside opportunisticSafehouseStrategy below, since Rest-vs-
 * Merge can't be Heat-aware without it. preferMergeWhenAvailable ignores
 * it, same as beelineToGatekeeper already ignores TraversalStrategy's own
 * `heat` parameter -- a function with fewer declared params still
 * satisfies the wider type. */
export type SafehouseStrategy = (playerState: RunPlayerState, heat: number) => SafehouseAction;

/** Legal-not-good default, mirroring discardStrategy/traversalStrategy/
 * acquisitionStrategy's own pattern: Merge whenever there's any banked
 * material at all, otherwise Rest. */
export const preferMergeWhenAvailable: SafehouseStrategy = (playerState) =>
  Object.values(playerState.material).some((count) => count > 0) ? 'merge' : 'rest';

/** The Rest-vs-Merge half of the opportunistic player profile (paired
 * with run.ts's opportunisticTraversal, decided in the same
 * /decision-session): Heat pressure and banked material both pull a
 * script toward a Safehouse in the first place (see opportunisticTraversal's
 * own comment), but only one action can be taken per visit. Heat wins the
 * tie when both are true at once -- it's the run-ending resource, so
 * relieving it is safety-critical in a way Merge's power gain isn't;
 * material alone (Heat not high) still prefers Merge, matching
 * preferMergeWhenAvailable's own default lean whenever Heat isn't the
 * pressing concern. */
export const opportunisticSafehouseStrategy: SafehouseStrategy = (playerState, heat) => {
  const heatHigh = heat >= HEAT_HIGH_FRACTION * (HEAT_MAX + playerState.maxHeatBonus);
  if (heatHigh) return 'rest';
  return preferMergeWhenAvailable(playerState, heat);
};

/** Which id to spend Merge on, when a script chose 'merge' -- the id
 * with the most banked material (ties broken by insertion order). Not
 * exposed as its own pluggable strategy; Rest-vs-Merge is DESIGN.md's
 * named trade-off, this secondary choice isn't. Null if nothing is
 * banked (SafehouseStrategy chose 'merge' with nothing to spend it on --
 * callers should fall back to Rest in that case). */
export function pickMergeTarget(playerState: RunPlayerState): string | null {
  const entries = Object.entries(playerState.material).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
