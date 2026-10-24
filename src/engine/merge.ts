import { RANK_THREE_DEFAULT_SHARE, RANK_THREE_PROCESS_SHARE } from './content/rank-three';
import type { Beta, BetaEffect, Effect, SubroutineDefinition } from './subroutine-types';
import type { RunPlayerState } from './run';
import { HEAT_HIGH_FRACTION, currentHeatCeiling } from './heat';
import { hasCreditPath, isTempo } from './subroutine-types';
import { archetypeLadderPosition } from './loadout';

/**
 * Duplicate material & Merge (Phase 4 checkpoint E; re-pointed session
 * 51): acquiring an already-owned subroutine becomes bench material
 * instead of a second copy (loadout.ts's acquireSubroutine); Merge spends
 * it to upgrade the base copy already owned.
 *
 * Since session 51 Merge upgrades the **beta** (DESIGN.md "Subroutine
 * acquisition"): the old upgrade axis, "easier to trigger", stopped
 * existing once every piece fires every turn (D11). It never changes the
 * alpha's verb or the beta's source -- those are the piece's identity.
 * How much one rank is *worth* is unpriced (price it with step 2's rules);
 * the bonuses below are placeholders sized to the skeleton pool's
 * per-turn floor (~1.5-2), not tuned.
 */

/** Flat bonus a rank adds to an amount in gauge points. Was 3 against a
 * common burst of 5; the per-turn floor is now ~1.5-2, so 1. */
export const MERGE_MAGNITUDE_BONUS = 1; // TBD/playtesting
/** The same bonus for a Tempo amount, which is a fraction of a turn or
 * threshold (session 48) -- a flat +1 there would mean a whole extra
 * turn. An eighth of a turn, matching the skeleton's smallest Tempo. */
export const MERGE_TEMPO_BONUS = 1 / 8; // TBD/playtesting
/** How far a rank loosens a beta's shape when its effect has no amount
 * to grow: one fewer charge needed, or one more charge counted. */
const MERGE_SHAPE_STEP = 1; // TBD/playtesting
export const MERGE_RANK_CAP = 3; // TBD/playtesting, same treatment as the slot cap

// Total banked material (summed across every subroutine id) counted as
// "high" by the opportunistic Safehouse strategy below -- TBD/playtesting.
export const MATERIAL_HIGH_THRESHOLD = 2;

/** Bumps an effect's amount by one rank -- the flat bonus for gauge
 * points, the fractional one for Tempo. Disrupt has no amount; returned
 * unchanged. `tempoUnits` forces the fractional bonus: an `enhance` beta
 * adds to its alpha's amount, so on a Tempo alpha it is denominated in
 * turns even though `enhance` itself is not a Tempo effect -- a flat +1
 * there would be a whole extra turn (session 48's invariant). */
function bumpedEffect<T extends Effect | BetaEffect>(effect: T, tempoUnits = isTempo(effect)): T {
  if (effect.verb === 'disrupt') return effect;
  return { ...effect, amount: effect.amount + (tempoUnits ? MERGE_TEMPO_BONUS : MERGE_MAGNITUDE_BONUS) };
}

/** Loosens a beta's shape by one step: a graded beta counts one more
 * charge, a stepped or immediate one needs one fewer (never below 1).
 * Returns the SAME object when there is nothing to loosen -- whileTrue
 * has no knob, and a stepped/immediate beta already at 1 is at its floor
 * -- so upgradedDefinition can tell "loosened" from "no-op" by identity
 * and fall through to the alpha rather than waste the rank. */
function loosenedShape(beta: Beta): Beta {
  switch (beta.shape) {
    case 'graded':
      return { ...beta, cap: beta.cap + MERGE_SHAPE_STEP };
    case 'stepped':
      return beta.at > 1 ? { ...beta, at: Math.max(1, beta.at - MERGE_SHAPE_STEP) } : beta;
    case 'immediate':
      return (beta.at ?? 1) > 1 ? { ...beta, at: Math.max(1, (beta.at ?? 1) - MERGE_SHAPE_STEP) } : beta;
    case 'whileTrue':
      return beta;
  }
}

/**
 * One Merge rank's upgrade:
 *
 * - a beta whose effect has an amount gets a bigger effect;
 * - a beta whose effect has none (Disrupt) gets a looser shape;
 * - a piece with no beta, or a whileTrue Disrupt beta with no knob at
 *   all, upgrades its alpha instead -- a rank is never silently wasted
 *   unless the piece has no magnitude anywhere.
 */
/** Rank III's Process bonus (S4): the authored share of the Process's
 * base amount (a growing Process with none: of its growth cap). Points
 * round to the nearest half (at least a half), Charge counts to a whole
 * (at least one); Tempo stays exact. */
export function rankThreeBonus(definition: SubroutineDefinition): number {
  const alpha = definition.alpha;
  if (alpha.verb === 'disrupt') return 0;
  const base = alpha.amount > 0 ? alpha.amount : (alpha.growthCap ?? 0);
  const raw = base * (RANK_THREE_PROCESS_SHARE[definition.id] ?? RANK_THREE_DEFAULT_SHARE);
  if (raw <= 0) return 0;
  if (isTempo(alpha)) return raw;
  if (alpha.verb === 'charge') return Math.max(1, Math.round(raw));
  return Math.max(0.5, Math.round(raw * 2) / 2);
}

export function upgradedDefinition(definition: SubroutineDefinition): SubroutineDefinition {
  const upgraded = upgradedDefinitionOnce(definition);
  // Rank III, the last (S4): the Process gets its bonus too.
  if (upgraded.rank !== MERGE_RANK_CAP || upgraded.alpha.verb === 'disrupt') return upgraded;
  return { ...upgraded, alpha: { ...upgraded.alpha, amount: upgraded.alpha.amount + rankThreeBonus(definition) } };
}

function upgradedDefinitionOnce(definition: SubroutineDefinition): SubroutineDefinition {
  // A growing subroutine (Daemon's ramp) also grows further: its strength
  // is mostly growth, which a bigger Hook barely touched, so Merge-led
  // Daemon kits fell behind (session 61). Tempo growth gets the tempo step.
  const { growth, growthCap } = definition.alpha;
  const alpha =
    growth === undefined ? definition.alpha : { ...definition.alpha, growthCap: (growthCap ?? 0) + (isTempo(definition.alpha) ? MERGE_TEMPO_BONUS : MERGE_MAGNITUDE_BONUS) };
  const ranked = { ...definition, alpha, rank: (definition.rank ?? 0) + 1 };
  const { beta } = definition;
  // A Suspend Hook stays as it is (S5): another turn skipped, or a looser
  // trigger, per rank would soon lock the enemy's bottom subroutine out
  // (Circuit Breaker at "every fifteen"); the Process grows instead.
  if (beta?.effect.verb === 'suspend') return { ...ranked, alpha: bumpedEffect(alpha) };
  if (beta && beta.effect.verb !== 'disrupt') {
    const tempoUnits = beta.effect.verb === 'enhance' ? isTempo(definition.alpha) : isTempo(beta.effect);
    return { ...ranked, beta: { ...beta, effect: bumpedEffect(beta.effect, tempoUnits) } };
  }
  if (beta) {
    const loosened = loosenedShape(beta);
    if (loosened !== beta) return { ...ranked, beta: loosened };
  }
  return { ...ranked, alpha: bumpedEffect(alpha) };
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

/** A Safehouse Merge (session 61, the user's call): spends every banked
 * copy, across every owned subroutine, ranking each as far as its copies
 * allow (up to MERGE_RANK_CAP). Copies past the cap stay banked (they
 * sell at a Shop). */
export function mergeEverything(playerState: RunPlayerState): RunPlayerState {
  let state = playerState;
  for (const id of Object.keys(state.material)) {
    for (;;) {
      const next = mergeSubroutine(state, id);
      if (next === state) break;
      state = next;
    }
  }
  return state;
}

/** What mergeEverything would do: each subroutine it ranks, from and to. */
export function mergePlan(playerState: RunPlayerState): { piece: SubroutineDefinition; from: number; to: number }[] {
  const after = mergeEverything(playerState);
  return [...playerState.installedLoadout, ...playerState.bench]
    .map((piece) => ({ piece, from: playerState.rank[piece.id] ?? 0, to: after.rank[piece.id] ?? 0 }))
    .filter((p) => p.to > p.from);
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
  const heatHigh = heat >= HEAT_HIGH_FRACTION * currentHeatCeiling(playerState);
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
//   2. credit path before none -- upgrading a pure Ward makes losing
//      slower; upgrading a piece that credits makes winning likelier.
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
      hasCreditPath(owned.piece) ? 0 : 1,
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
