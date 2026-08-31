import {
  CREDIT_CAPABLE_PAYLOAD_KINDS,
  hasCreditCapablePiece,
  type Archetype,
  type SubroutineDefinition,
  type TriggerFamily,
} from './subroutine-types';
import type { RunPlayerState } from './run';
import { CLASS_DEFINITIONS, type ClassId } from './classes';
import { rarityOf, type Rarity } from './rewards';

/**
 * Bench & installed-loadout management (Phase 4 checkpoint D): a
 * player's `installedLoadout` (active, evaluated each fight, capped) vs.
 * `bench` (owned, uninstalled) -- pure between-fights functions, same
 * "legal-not-good scripted decision" shape as discardStrategy/
 * traversalStrategy. Mid-combat, a subroutine's only lever is Togglable
 * (session 3) -- install/uninstall/reorder are deliberately
 * between-fights only.
 */

export const INSTALLED_SLOT_CAP = 6; // TBD/playtesting -- floated as flavor only, session 7

/** Number of installedLoadout entries that actually count against
 * slotCap -- excludes any entry granted by a Mod (Phase 5 Mods
 * checkpoint F: `grantedByMod` tracks these by subroutine id), which are
 * cap-exempt and removal-locked (see uninstallSubroutine below) but
 * otherwise ordinary loadout members. */
function cappedInstalledCount(playerState: RunPlayerState): number {
  return playerState.installedLoadout.filter((piece) => !playerState.grantedByMod[piece.id]).length;
}

/** Moves `id` from bench to installedLoadout, appended at the end. A
 * no-op if `id` isn't on the bench, or if the cap-counted portion of
 * installedLoadout is already at `slotCap`. */
export function installSubroutine(playerState: RunPlayerState, id: string, slotCap: number = INSTALLED_SLOT_CAP): RunPlayerState {
  if (cappedInstalledCount(playerState) >= slotCap) return playerState;
  const index = playerState.bench.findIndex((piece) => piece.id === id);
  if (index === -1) return playerState;
  const piece = playerState.bench[index];
  const bench = playerState.bench.slice();
  bench.splice(index, 1);
  return { ...playerState, bench, installedLoadout: [...playerState.installedLoadout, piece] };
}

/** Moves `id` from installedLoadout to bench, appended at the end of the
 * bench. A no-op if `id` isn't currently installed, or if it's a
 * Mod-granted entry (locked against removal, Phase 5 Mods checkpoint F). */
export function uninstallSubroutine(playerState: RunPlayerState, id: string): RunPlayerState {
  if (playerState.grantedByMod[id]) return playerState;
  const index = playerState.installedLoadout.findIndex((piece) => piece.id === id);
  if (index === -1) return playerState;
  const piece = playerState.installedLoadout[index];
  const installedLoadout = playerState.installedLoadout.slice();
  installedLoadout.splice(index, 1);
  return { ...playerState, installedLoadout, bench: [...playerState.bench, piece] };
}

/** Inserts a Mod-granted subroutine directly into installedLoadout,
 * always-slotted, cap-exempt, and locked against removal (Phase 5 Mods
 * checkpoint F -- Auxiliary Process's own mechanism, session 31). No
 * bench step: unlike a normal acquisition, a granted piece is never
 * "owned but not installed." reorderInstalled needs no special-casing --
 * a granted entry participates in normal ordering/chaining like any
 * other loadout member, only exempt from the cap and removal. */
export function installGrantedSubroutine(playerState: RunPlayerState, subroutine: SubroutineDefinition, grantingModId: string): RunPlayerState {
  return {
    ...playerState,
    installedLoadout: [...playerState.installedLoadout, subroutine],
    grantedByMod: { ...playerState.grantedByMod, [subroutine.id]: grantingModId },
  };
}

/** Moves the installedLoadout entry at `fromIndex` to `toIndex` --
 * firing order matters (chainFinisherScaling's payoff, Primed/Sleeper
 * Cell's "first Exploit/Root subroutine" targeting), so this is a real
 * lever, not cosmetic. A no-op if either index is out of range. */
export function reorderInstalled(playerState: RunPlayerState, fromIndex: number, toIndex: number): RunPlayerState {
  const loadout = playerState.installedLoadout;
  if (fromIndex < 0 || fromIndex >= loadout.length || toIndex < 0 || toIndex >= loadout.length) return playerState;
  const reordered = loadout.slice();
  const [piece] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, piece);
  return { ...playerState, installedLoadout: reordered };
}

/** Decides which (if any) of a reward's offered options -- or, later, a
 * Shop purchase -- a script acquires. Returns null to decline. Mirrors
 * discardStrategy/traversalStrategy's own "legal-not-good scripted
 * decision" pattern; no real AI exists yet, same as everywhere else in
 * this project. */
export type AcquisitionStrategy = (options: SubroutineDefinition[], playerState: RunPlayerState) => SubroutineDefinition | null;

/** Always takes the first offered option -- legal-not-good, not "good"
 * play (no rarity/synergy judgment). */
export const alwaysAcquireFirst: AcquisitionStrategy = (options) => options[0] ?? null;

/** Acquires `piece`: if its id is already owned (installed or benched),
 * it becomes banked Merge material instead of a second, slot-hungry
 * copy (DESIGN.md's Duplicate Subroutines section; checkpoint E,
 * merge.ts). Otherwise it's added to bench, then immediately tried for
 * install -- a freshly-acquired new piece defaults to "try to put it to
 * use," falling back to sitting on the bench once installedLoadout is
 * full at `slotCap`. */
export function acquireSubroutine(playerState: RunPlayerState, piece: SubroutineDefinition, slotCap: number = INSTALLED_SLOT_CAP): RunPlayerState {
  const alreadyOwned =
    playerState.installedLoadout.some((owned) => owned.id === piece.id) || playerState.bench.some((owned) => owned.id === piece.id);
  if (alreadyOwned) {
    const material = { ...playerState.material, [piece.id]: (playerState.material[piece.id] ?? 0) + 1 };
    return { ...playerState, material };
  }
  const withBench = { ...playerState, bench: [...playerState.bench, piece] };
  return installSubroutine(withBench, piece.id, slotCap);
}

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint B) -- the
// synergy-aware acquisition ladder. Every scripted run before this used
// alwaysAcquireFirst, which makes a sweep unable to distinguish a real
// class-balance problem from the AI simply never making a good pick (see
// DESIGN.md's "Gameplay Simulation Heuristics" section for the full
// reasoning). Deliberately a *lexicographic priority ladder*, not a
// numeric weighted score: there's no calibration target for "is a rare
// off-archetype piece better than a common on-archetype one" the way
// ai.ts's skill dial has exact Cribbage EV to calibrate against, so an
// explicit ordered tie-break is honest where tuned weights would be
// false precision. Same no-weights shape opportunisticTraversal already
// uses to resolve its own priorities.
//
// This ladder is shared, not private: shop.ts (the Shop half of the same
// decision), merge.ts (checkpoint E's Merge target) and this file's own
// checkpoint G swap-out all rank subroutines the same way rather than
// each inventing a second scoring shape.
// ---------------------------------------------------------------------

/** One subroutine's position on the ladder, as a lexicographically
 * comparable tuple -- lower is better at every position, so a plain
 * element-by-element comparison resolves the whole ladder (see
 * compareLadderRanks). Kept as an explicit named type rather than a bare
 * number[] so the three rungs stay legible at the call sites that read
 * them. */
export interface LadderRank {
  /** 0 when this piece fills a credit-gap, 1 when it doesn't -- rung 1,
   * the highest-priority consideration. */
  creditGap: 0 | 1;
  /** 0 on-archetype, 1 neutral/universal, 2 off-archetype -- rung 2. */
  archetype: 0 | 1 | 2;
  /** 0 rare, 1 uncommon, 2 common -- rung 3, the tie-break. */
  rarity: 0 | 1 | 2;
}

const RARITY_LADDER_POSITION: Record<Rarity, 0 | 1 | 2> = { rare: 0, uncommon: 1, common: 2 };

/** Rung 3's position for a rarity -- rarer is better. Exported so the
 * Mod and Burner ladders (checkpoints C/D) break their own ties the same
 * way rather than each restating the ordering. */
export function rarityLadderPosition(rarity: Rarity): 0 | 1 | 2 {
  return RARITY_LADDER_POSITION[rarity];
}

/** Rung 2's position for an archetype, shared by all three item ladders.
 * 0 on-archetype, 1 universal, 2 off-archetype.
 *
 * Two different things map onto the middle position, for the same
 * reason. A `neutral` subroutine is suit-independent by construction, so
 * it's always live for any class; a Mod with **no** archetype field at
 * all (the archetype-agnostic majority of the Mod pool) is universal in
 * exactly the same sense. Neither is as good as content reinforcing one
 * of the class's own 2 specializations, but both beat content the class
 * will rarely lean on. */
export function archetypeLadderPosition(archetype: Archetype | undefined, classId: ClassId): 0 | 1 | 2 {
  if (archetype === undefined || archetype === 'neutral') return 1;
  const classArchetypes: readonly Archetype[] = CLASS_DEFINITIONS[classId].archetypes;
  return classArchetypes.includes(archetype) ? 0 : 2;
}

/** Whether acquiring `piece` would close a real credit-gap -- i.e. give
 * the class a way to actually push toward a threshold win somewhere it
 * currently can't. A defensive-only piece can never qualify, whatever
 * its archetype: that inability is exactly the structural hole session
 * 40 existed to fix.
 *
 * Neutral is handled deliberately, not incidentally (session 46, after
 * measuring): a neutral piece is suit-independent by construction and
 * therefore always live for every class, so it closes *any* of the
 * class's open gaps rather than one specific archetype's. That matters
 * because 4 of the 6 classes start a run with a credit-capable piece
 * missing in one of their own two specializations (Saboteur/Operator:
 * root; Warden: encryption; Ghost: both), which is the very gap session
 * 28's Neutral Archetype was created to be able to fill.
 *
 * Note this does NOT let neutral outrank on-archetype content: a
 * credit-capable neutral piece and a credit-capable on-archetype piece
 * both land on rung 1, and rung 2 then resolves the tie toward
 * on-archetype. Neutral only wins when nothing on-archetype is on offer.
 *
 * An off-archetype piece never fills a gap -- it's content the class's
 * own two specializations won't reinforce, so prioritizing it would be
 * chasing a gap the class was never built to cover. */
export function fillsCreditGap(piece: SubroutineDefinition, playerState: RunPlayerState): boolean {
  if (!CREDIT_CAPABLE_PAYLOAD_KINDS.has(piece.payload.kind)) return false;
  const classArchetypes: readonly Archetype[] = CLASS_DEFINITIONS[playerState.classId].archetypes;
  if (piece.archetype === 'neutral') {
    return classArchetypes.some((archetype) => !hasCreditCapablePiece(playerState.installedLoadout, archetype));
  }
  if (!classArchetypes.includes(piece.archetype)) return false;
  return !hasCreditCapablePiece(playerState.installedLoadout, piece.archetype);
}

/** Ranks one piece on the 3-rung ladder. Neutral sits deliberately
 * *between* on- and off-archetype: a neutral piece is suit-independent
 * by construction (see subroutine-types.ts's Archetype comment), so it's
 * always live for this class, where an off-archetype piece is content
 * the class's own two specializations won't reinforce. */
export function ladderRank(piece: SubroutineDefinition, playerState: RunPlayerState): LadderRank {
  return {
    creditGap: fillsCreditGap(piece, playerState) ? 0 : 1,
    archetype: archetypeLadderPosition(piece.archetype, playerState.classId),
    rarity: rarityLadderPosition(rarityOf(piece.id)),
  };
}

/** Lexicographic comparison, `Array.prototype.sort`-shaped: negative
 * when `a` ranks better than `b`. Rungs are compared in declaration
 * order and the first difference wins outright -- that "first difference
 * wins" is the whole point of a ladder over a weighted sum, where a
 * large enough rarity edge could otherwise outvote a credit-gap. */
export function compareLadderRanks(a: LadderRank, b: LadderRank): number {
  return a.creditGap - b.creditGap || a.archetype - b.archetype || a.rarity - b.rarity;
}

/** Picks the best of `options` by the ladder, or null when there's
 * nothing to pick from. Ties (identical rank tuples) fall to the
 * earliest option, matching alwaysAcquireFirst's own bias and keeping
 * the choice deterministic for a given offered slate. Never declines an
 * offer -- neither does alwaysAcquireFirst, and "should a scripted
 * player ever refuse a free piece" is a separate question this
 * checkpoint doesn't open. */
export function bestByLadder(options: SubroutineDefinition[], playerState: RunPlayerState): SubroutineDefinition | null {
  if (options.length === 0) return null;
  return options.reduce((best, option) =>
    compareLadderRanks(ladderRank(option, playerState), ladderRank(best, playerState)) < 0 ? option : best,
  );
}

/** The synergy-aware half of session 46's "smart player" profile,
 * paired with shop.ts's synergyAwareShopStrategy (they resolve the same
 * decision against two different offer shapes). Opt-in only --
 * alwaysAcquireFirst stays playRun's default for every existing caller
 * and test. */
export const synergyAwareAcquisition: AcquisitionStrategy = (options, playerState) => bestByLadder(options, playerState);

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint F) -- loadout
// reorder. reorderInstalled has existed since Phase 4 with a doc comment
// stressing that firing order is "a real lever, not cosmetic," and
// nothing has ever called it -- not even a legal-not-good default. This
// is the first decision-maker for it.
//
// A fully general optimizer (searching permutations against simulated
// outcomes) was considered and rejected by session 45 as its own
// research project. This is a fixed rule reusing the ChainedTrigger
// classification the engine already carries.
//
// Two passes, in order:
//   1. **Prerequisites before dependents.** Same-turn firing resolves
//      top-to-bottom (resolve.ts), so a chained piece only credits this
//      turn if whatever it chains off fired earlier in the same pass --
//      otherwise it waits for the next turn, or never fires at all.
//   2. **Chain finishers last.** A chainFinisherScaling payload scales
//      with how many pieces already fired this turn, so it wants to be
//      as late in the order as possible.
//
// Pass 2 deliberately wins where the two conflict (a finisher that is
// also some other piece's prerequisite): its whole payoff is positional
// in a way a chained trigger's is not.
//
// Scope note, measured rather than assumed: session 45's spec wrote pass
// 1 against ChainedTrigger's `afterSubroutineId` variant only, but *no*
// piece in the game uses it -- session 42's pool expansion converted
// every chain to `afterArchetype`/`afterTag` because id-pairs can't be
// guaranteed to co-occur in a run. Pass 1 handles all three variants
// (decided live with the user), so it covers the 14 real chained pieces
// instead of zero. The id variant is kept because it stays correct and
// becomes live the moment a matched-pair Event or starting kit uses it.
// ---------------------------------------------------------------------

/** A full-loadout transform rather than a choice between options -- the
 * first strategy type in this project with nothing to pick from, so it
 * takes and returns RunPlayerState directly. */
export type ReorderStrategy = (playerState: RunPlayerState) => RunPlayerState;

/** The default: acquisition order, i.e. exactly what every run has done
 * until now. Named rather than left implicit so the option's default is
 * greppable alongside alwaysAcquireFirst and friends. */
export const keepAcquisitionOrder: ReorderStrategy = (playerState) => playerState;

/** Whether `piece` satisfies `trigger`'s chain condition -- the same
 * three match modes ChainedTrigger itself defines. */
function satisfiesChain(trigger: Extract<TriggerFamily, { kind: 'chained' }>, piece: SubroutineDefinition): boolean {
  if ('afterSubroutineId' in trigger) return piece.id === trigger.afterSubroutineId;
  if ('afterArchetype' in trigger) return piece.archetype === trigger.afterArchetype;
  return piece.tags.includes(trigger.afterTag);
}

/** Reorders the installed loadout per this section's two passes. Pure,
 * and idempotent -- running it twice changes nothing the second time,
 * which is what lets run.ts apply it once per node rather than at every
 * individual acquisition call site. */
export const synergyAwareReorder: ReorderStrategy = (playerState) => {
  let state = playerState;

  // Pass 1. Each iteration fixes at most one violation and restarts, so
  // the bound is generous rather than tight; the cap exists because a
  // chain cycle (A after B, B after A) is expressible in the type system
  // and would otherwise spin forever. A cycle simply stops early with
  // the order it has reached -- an unsatisfiable chain is dead content
  // regardless of how it's ordered.
  const maxPasses = state.installedLoadout.length * state.installedLoadout.length + 1;
  for (let pass = 0; pass < maxPasses; pass++) {
    const loadout = state.installedLoadout;
    let movedSomething = false;
    for (let i = 0; i < loadout.length; i++) {
      const trigger = loadout[i].trigger;
      if (trigger.kind !== 'chained') continue;
      // Already satisfied by something earlier in the order -- nothing to do.
      if (loadout.slice(0, i).some((earlier) => satisfiesChain(trigger, earlier))) continue;
      const laterIndex = loadout.findIndex((candidate, index) => index > i && satisfiesChain(trigger, candidate));
      if (laterIndex === -1) continue; // nothing installed satisfies it at all
      state = reorderInstalled(state, laterIndex, i);
      movedSomething = true;
      break;
    }
    if (!movedSomething) break;
  }

  // Pass 2. Moving each finisher to the end in its existing relative
  // order leaves the finishers trailing in that same relative order.
  const finisherIds = state.installedLoadout.filter((piece) => piece.payload.kind === 'chainFinisherScaling').map((piece) => piece.id);
  for (const id of finisherIds) {
    const from = state.installedLoadout.findIndex((piece) => piece.id === id);
    if (from !== -1) state = reorderInstalled(state, from, state.installedLoadout.length - 1);
  }

  return state;
};

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint G) -- swap-out
// on a full loadout. acquireSubroutine has no swap path at all: once
// installedLoadout hits the cap, every newly-owned piece sits on the
// bench forever, and only Merge (upgrading something already installed)
// can improve the active kit after that point. That's a real ceiling on
// how good a scripted run's loadout can get, and it's been there since
// Phase 4.
//
// New behavior, deliberately NOT a change to acquireSubroutine itself --
// every existing caller and test depends on bench-forever, and moving
// that default would shift every sweep baseline on disk.
//
// The subtle part is which installed piece to evict, and the acquisition
// ladder can't be used directly to answer it. ladderRank's credit-gap
// rung asks "would acquiring this close an open gap?", which reads
// backwards for a piece that is already installed: the class's only
// credit-capable Encryption piece scores as NOT filling a gap, precisely
// because it is the thing filling it. Ranked naively, that piece looks
// cheap to evict, and a swap could reopen the very gap rung 1 exists to
// close -- the same inversion checkpoint E hit with Merge targets.
//
// Fixed by evaluating every piece counterfactually, against the loadout
// *without* it. For a candidate that means the current loadout (so it
// reduces to plain fillsCreditGap); for an installed piece it means
// "would removing this open a gap?" One predicate, one scale, both sides
// comparable -- so a sole credit provider is correctly protected from
// eviction without a special case.
// ---------------------------------------------------------------------

/** Ranks `piece` as if the installed loadout were `loadoutWithoutPiece`.
 * See this section's header for why the counterfactual matters. */
function swapRank(piece: SubroutineDefinition, playerState: RunPlayerState, loadoutWithoutPiece: SubroutineDefinition[]): LadderRank {
  return ladderRank(piece, { ...playerState, installedLoadout: loadoutWithoutPiece });
}

/** acquireSubroutine's behavior, plus a swap-out step when the loadout
 * is full: rank every evictable installed piece counterfactually, and if
 * `piece` outranks the worst of them, uninstall that one and install
 * `piece` instead. Falls back to benching when it doesn't -- same result
 * as acquireSubroutine, just arrived at deliberately.
 *
 * Mod-granted entries are excluded from eviction: they're cap-exempt and
 * removal-locked (uninstallSubroutine refuses them outright), so evicting
 * one silently fails and would waste the acquisition. */
export function acquireSubroutineWithSwap(
  playerState: RunPlayerState,
  piece: SubroutineDefinition,
  slotCap: number = INSTALLED_SLOT_CAP,
): RunPlayerState {
  const alreadyOwned =
    playerState.installedLoadout.some((owned) => owned.id === piece.id) || playerState.bench.some((owned) => owned.id === piece.id);
  if (alreadyOwned) return acquireSubroutine(playerState, piece, slotCap);

  // Room to spare -- nothing to decide, this is plain acquisition.
  if (cappedInstalledCount(playerState) < slotCap) return acquireSubroutine(playerState, piece, slotCap);

  const evictable = playerState.installedLoadout.filter((installed) => !playerState.grantedByMod[installed.id]);
  if (evictable.length === 0) return acquireSubroutine(playerState, piece, slotCap); // benches it

  const worst = evictable.reduce((worstSoFar, installed) => {
    const withoutInstalled = playerState.installedLoadout.filter((other) => other.id !== installed.id);
    const withoutWorst = playerState.installedLoadout.filter((other) => other.id !== worstSoFar.id);
    return compareLadderRanks(swapRank(installed, playerState, withoutInstalled), swapRank(worstSoFar, playerState, withoutWorst)) > 0
      ? installed
      : worstSoFar;
  });

  const withoutWorst = playerState.installedLoadout.filter((other) => other.id !== worst.id);
  const candidateRank = swapRank(piece, playerState, playerState.installedLoadout);
  const worstRank = swapRank(worst, playerState, withoutWorst);
  // Strictly better, not merely equal -- a tie isn't worth the churn of
  // benching a piece that's already doing its job.
  if (compareLadderRanks(candidateRank, worstRank) >= 0) return acquireSubroutine(playerState, piece, slotCap); // benches it

  const evicted = uninstallSubroutine(playerState, worst.id);
  const withCandidateBenched = { ...evicted, bench: [...evicted.bench, piece] };
  return installSubroutine(withCandidateBenched, piece.id, slotCap);
}
