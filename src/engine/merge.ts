import type { PayloadEffect, SubroutineDefinition, TriggerFamily } from './subroutine-types';
import type { RunPlayerState } from './run';
import { HEAT_HIGH_FRACTION, HEAT_MAX } from './heat';
import { CREDIT_CAPABLE_PAYLOAD_KINDS } from './subroutine-types';
import { archetypeLadderPosition } from './loadout';

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
    case 'sessionHijack':
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
    case 'drainingHot':
      return { ...payload, amountPerTick: transform(payload.amountPerTick) };
    case 'wardCounter':
      // Encryption offense (session 40 continued) -- amount transforms
      // exactly like plain ward's own case above; ratio is a conversion
      // fraction, not a raw magnitude, and deliberately untouched here
      // (same reasoning wardBash's fraction is excluded entirely, below).
      return { ...payload, amount: transform(payload.amount) };
    case 'debuff':
      return { ...payload, magnitude: transform(payload.magnitude) };
    case 'wardBash':
      // fraction is a 0-1 share of the caster's *current* wardShield,
      // not an absolute amount -- multiplying it by a magnitudeScaler or
      // additively bumping it via Merge would push it outside 0-1 and
      // has no sensible meaning here. Deliberately excluded, same
      // default: null fallback every other non-magnitude payload
      // (cleanse, cribbageLayerManipulation, scheduledSabotage, etc.)
      // already gets.
      return null;
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

/** Which id a 'merge' Safehouse action spends itself on. Promoted to a
 * real pluggable strategy type in session 46 (checkpoint E) -- until
 * then this secondary choice was hardcoded at encounters.ts's own
 * Safehouse case, since Rest-vs-Merge was DESIGN.md's named trade-off
 * and this wasn't. A null return means "nothing worth merging," which
 * resolveEncounter treats as a fall-back to Rest. */
export type MergeTargetStrategy = (playerState: RunPlayerState) => string | null;

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

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint E) -- a
// synergy-aware Merge target, alongside pickMergeTarget rather than
// replacing it (every existing caller and test stays on the
// legal-not-good default).
//
// Session 45's spec said "reuse checkpoint B's ladder, with banked
// material demoted to the tie-break." Implementing it surfaced a real
// wrinkle the spec hadn't hit: loadout.ts's fillsCreditGap *inverts*
// when applied to a Merge candidate. It asks "would acquiring this close
// an open gap?", so an installed credit-capable piece scores as NOT
// filling a gap (it already closed its own), while a benched one in a
// gap archetype scores as filling it -- even though merging a benched
// piece upgrades something that never fires. Reused literally, the
// ladder would rank benched pieces above installed ones, which is
// backwards for this decision.
//
// So this ladder keeps the *spirit* of that rung (prefer strengthening
// something that can actually push toward a win) while ordering on what
// a Merge decision actually turns on. Rungs, in order:
//   1. installed before benched -- an upgrade only pays off on a piece
//      that fires. This is the rung the naive reuse got backwards.
//   2. credit-capable before defensive-only -- upgrading a ward makes
//      losing slower; upgrading a wardCounter makes winning likelier.
//   3. on-archetype before universal before off-archetype -- shared with
//      the other two ladders via archetypeLadderPosition.
//   4. most banked material -- today's entire criterion, demoted to the
//      tie-break exactly as the spec intended.
//
// Rarity is deliberately absent: unlike an acquisition, the base piece
// is already owned, and its rarity says nothing about what one more
// rank is worth.
// ---------------------------------------------------------------------

/** Every owned copy of `id`, installed or benched -- Merge upgrades
 * whichever exists (mergeSubroutine touches both). */
function ownedPiece(playerState: RunPlayerState, id: string): { piece: SubroutineDefinition; installed: boolean } | null {
  const installed = playerState.installedLoadout.find((piece) => piece.id === id);
  if (installed) return { piece: installed, installed: true };
  const benched = playerState.bench.find((piece) => piece.id === id);
  if (benched) return { piece: benched, installed: false };
  return null;
}

/** Which banked ids are actually worth spending a Safehouse visit on.
 * Filters two ways the legal-not-good default does not:
 *
 * - **rank-capped ids**, which mergeSubroutine refuses outright
 *   (`rank >= MERGE_RANK_CAP` returns the state unchanged). pickMergeTarget
 *   happily returns one, and resolveEncounter then burns the whole visit
 *   on a no-op -- no Merge *and* no Rest. Declining instead lets the
 *   Safehouse fall back to Rest, which is strictly better.
 * - **ids with no owned copy at all**, which mergeSubroutine also
 *   refuses. Defensive: material is only ever banked by acquiring a
 *   duplicate of something owned, so this shouldn't arise. */
function mergeableIds(playerState: RunPlayerState): string[] {
  return Object.entries(playerState.material)
    .filter(([id, count]) => count > 0 && (playerState.rank[id] ?? 0) < MERGE_RANK_CAP && ownedPiece(playerState, id) !== null)
    .map(([id]) => id);
}

/** Synergy-aware Merge target -- see this section's header for the rung
 * order and why it isn't a literal reuse of the acquisition ladder.
 * Returns null when nothing is worth merging, which resolveEncounter
 * already treats as "fall back to Rest." */
export function synergyAwareMergeTarget(playerState: RunPlayerState): string | null {
  const candidates = mergeableIds(playerState);
  if (candidates.length === 0) return null;

  const rankOf = (id: string): [number, number, number, number] => {
    const owned = ownedPiece(playerState, id)!;
    return [
      owned.installed ? 0 : 1,
      CREDIT_CAPABLE_PAYLOAD_KINDS.has(owned.piece.payload.kind) ? 0 : 1,
      archetypeLadderPosition(owned.piece.archetype, playerState.classId),
      -(playerState.material[id] ?? 0), // negated: more banked material is better
    ];
  };

  return candidates.reduce((best, id) => {
    const a = rankOf(id);
    const b = rankOf(best);
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] < b[i] ? id : best;
    }
    return best; // exact tie -- keep the earlier id, matching pickMergeTarget's insertion-order bias
  });
}
