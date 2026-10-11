import {
  hasCreditCapablePiece,
  hasCreditPath,
  matchesSequence,
  type Archetype,
  type SubroutineDefinition,
} from './subroutine-types';
import type { RunPlayerState } from './run';
import { CLASS_DEFINITIONS, type ClassId } from './classes';
import { rarityOf, type Rarity } from './rewards';

/**
 * Bench & installed-loadout management (Phase 4 checkpoint D): a
 * player's `installedLoadout` (active, evaluated each fight, capped) vs.
 * `bench` (owned, uninstalled) -- pure between-fights functions, same
 * "legal-not-good scripted decision" shape as discardStrategy/
 * traversalStrategy. Install/uninstall/reorder are deliberately
 * between-fights only, and since session 51 removed Togglable there is
 * no mid-combat lever at all.
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
 * firing order matters (`sequence` betas, Empower boosting the pieces
 * after it, Charge feeding the next piece), so this is a real lever, not
 * cosmetic. A no-op if either index is out of range. */
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
 * The middle position is for a Mod with **no** archetype field at all
 * (the archetype-agnostic majority of the Mod pool): always live for any
 * class, but not reinforcing either of its specializations. Every
 * subroutine has one of the four archetypes since session 51 removed
 * `neutral`, so subroutines only ever land on 0 or 2. */
export function archetypeLadderPosition(archetype: Archetype | undefined, classId: ClassId): 0 | 1 | 2 {
  if (archetype === undefined) return 1;
  const classArchetypes: readonly Archetype[] = CLASS_DEFINITIONS[classId].archetypes;
  return classArchetypes.includes(archetype) ? 0 : 2;
}

/** Whether acquiring `piece` would close a real credit-gap -- give the
 * class a way to push toward a threshold win in one of its own two
 * archetypes where its installed kit currently has none. A piece with no
 * credit path (neither its alpha nor its beta credits) can never qualify,
 * and neither can an off-archetype piece: prioritizing it would chase a
 * gap the class was never built to cover. A3's credit rule means every
 * starting loadout already has a credit path; this rung matters once
 * swaps and Merge choices start reshaping the installed kit. */
export function fillsCreditGap(piece: SubroutineDefinition, playerState: RunPlayerState): boolean {
  if (!hasCreditPath(piece)) return false;
  const classArchetypes: readonly Archetype[] = CLASS_DEFINITIONS[playerState.classId].archetypes;
  if (!classArchetypes.includes(piece.archetype)) return false;
  return !hasCreditCapablePiece(playerState.installedLoadout, piece.archetype);
}

/** Ranks one piece on the 3-rung ladder. */
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
// Gameplay Simulation Heuristics (session 46, checkpoint F; re-pointed
// session 51) -- loadout reorder.
//
// A fully general optimizer (searching permutations against simulated
// outcomes) was considered and rejected by session 45 as its own
// research project. This is a fixed rule over the `sequence` beta source:
// a piece whose beta wants a particular neighbour or predecessor gets one
// moved into place --
//
//   - `adjacent` (positional, either side -- A12): if neither the slot
//     above nor below matches, a matching piece moves into the nearest
//     neighbouring slot (below if it came from below, above if from above).
//   - `anyPrior` (firing order): if nothing earlier matches, a matching
//     piece moves up to sit directly above.
//
// Without this a sequence beta only applies when acquisition order happens
// to line it up. D13 makes this a prerequisite for measuring chain content
// at all: no simulated run had ever reordered a loadout before it existed.
//
// Session 46's second pass (chain finishers last) retired with the
// chain-finisher payload kind. Empower now has the strongest positional
// payoff -- it boosts pieces *after* it -- and is the obvious next rule,
// left for when real Empower content exists to measure it against.
// ---------------------------------------------------------------------

/** A full-loadout transform rather than a choice between options -- the
 * first strategy type in this project with nothing to pick from, so it
 * takes and returns RunPlayerState directly. */
export type ReorderStrategy = (playerState: RunPlayerState) => RunPlayerState;

/** The default: acquisition order, i.e. exactly what every run has done
 * until now. Named rather than left implicit so the option's default is
 * greppable alongside alwaysAcquireFirst and friends. */
export const keepAcquisitionOrder: ReorderStrategy = (playerState) => playerState;

/** Reorders the installed loadout so every `sequence` beta's
 * prerequisite sits where the beta needs it. Pure, and idempotent --
 * running it twice changes nothing the second time, which is what lets
 * run.ts apply it once per node rather than at every acquisition call
 * site. */
export const synergyAwareReorder: ReorderStrategy = (playerState) => {
  let state = playerState;

  // Each iteration fixes at most one violation and restarts, so the bound
  // is generous rather than tight; the cap exists because a chain cycle
  // (A wants B first, B wants A first) is expressible and would otherwise
  // spin forever. A cycle stops early with the order it has reached -- an
  // unsatisfiable chain stays unsatisfied however it's ordered.
  const maxPasses = state.installedLoadout.length * state.installedLoadout.length + 1;
  for (let pass = 0; pass < maxPasses; pass++) {
    const loadout = state.installedLoadout;
    let movedSomething = false;
    for (let i = 0; i < loadout.length; i++) {
      const beta = loadout[i].beta;
      if (beta?.source !== 'sequence') continue;
      const matches = (index: number) => index >= 0 && index < loadout.length && matchesSequence(beta.match, loadout[index]);
      const satisfied =
        beta.reach === 'adjacent' ? matches(i - 1) || matches(i + 1) : loadout.slice(0, i).some((earlier) => matchesSequence(beta.match, earlier));
      if (satisfied) continue;
      const candidateIndex = loadout.findIndex((candidate, index) => index !== i && matchesSequence(beta.match, candidate));
      if (candidateIndex === -1) continue; // nothing installed satisfies it at all
      if (beta.reach === 'adjacent') {
        // Into the nearest neighbouring slot: a later candidate moves up to
        // sit directly below (i + 1); an earlier one moves down to sit
        // directly above (removing it shifts this piece to i - 1, so
        // inserting at i - 1 lands it just above).
        state = candidateIndex > i ? reorderInstalled(state, candidateIndex, i + 1) : reorderInstalled(state, candidateIndex, i - 1);
      } else {
        // anyPrior needs it earlier: a later candidate moves up to slot i,
        // pushing this piece down one.
        state = reorderInstalled(state, candidateIndex, i);
      }
      movedSomething = true;
      break;
    }
    if (!movedSomething) break;
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

/** How a run applies an acquired subroutine. Both acquireSubroutine
 * (bench-forever when full) and acquireSubroutineWithSwap satisfy it, so
 * playRun can be handed either without either function knowing about the
 * other -- the same pluggable shape every other decision in this engine
 * uses. */
export type SubroutineAcquirer = (playerState: RunPlayerState, piece: SubroutineDefinition, slotCap: number) => RunPlayerState;

/** Ranks `piece` as if the installed loadout were `loadoutWithoutPiece`.
 * See this section's header for why the counterfactual matters. */
function swapRank(piece: SubroutineDefinition, playerState: RunPlayerState, loadoutWithoutPiece: SubroutineDefinition[]): LadderRank {
  return ladderRank(piece, { ...playerState, installedLoadout: loadoutWithoutPiece });
}

/** Compares two pieces for the swap decision on the first two rungs
 * only, deliberately ignoring rarity.
 *
 * Measured, not assumed. rarityOf() reports 'common' for every one of
 * the 18 class starting-loadout pieces -- not because they're weak, but
 * because they carry no authored rarity at all (rewards.ts derives
 * rarity structurally from which pool array a piece lives in, and
 * starting pieces live in none). Including the rarity rung therefore
 * parked every hand-designed starting piece at the bottom of the
 * eviction order, and a session-46 ablation sweep measured the result:
 * 73% of starting-loadout pieces were dismantled for whatever the pool
 * happened to offer, dropping the full synergy profile to 10/240 wins
 * against the dumb baseline's own 26/240. Dropping this one rung took it
 * to 47/240.
 *
 * The underlying rule is the same one checkpoint E's Merge ladder
 * already follows: rarity is a statement about how a piece is
 * *distributed*, not how good it is in a loadout, and it's only
 * meaningful for pieces that were actually authored into a rarity tier.
 * It stays on the acquisition ladder, where every option genuinely comes
 * from a pool, and stays off both decisions that rank pieces already
 * owned. */
function compareSwapRanks(a: LadderRank, b: LadderRank): number {
  return a.creditGap - b.creditGap || a.archetype - b.archetype;
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

  // A class's starting kit is never evicted (session 47). The ladder can
  // only see payload kinds, so it cannot tell that a piece is load-bearing
  // for the class's own passive -- and it got this catastrophically wrong
  // for Ghost. `ward` is not credit-capable, so Steganography ranked
  // bottom and was swapped out in 72% of runs; Return to Sender's primary
  // hook is ward absorption, so throwing the ward away left the passive
  // with nothing to fire on and turned Ghost from the best class under the
  // legal-not-good defaults (24.7%) into the worst under this profile
  // (8.0%). Starting loadouts are hand-designed and frequently
  // load-bearing in ways a payload-kind ladder cannot infer, so they are
  // protected wholesale rather than case by case.
  //
  // A deliberately blunt rule: there are surely starting pieces a strong
  // enough offer *should* displace, and this forgoes those. That is the
  // cheaper error -- benching a good acquisition costs one slot, while
  // evicting a class's engine costs the run.
  const startingIds = new Set(CLASS_DEFINITIONS[playerState.classId].startingLoadout.map((piece) => piece.id));
  const evictable = playerState.installedLoadout.filter(
    (installed) => !playerState.grantedByMod[installed.id] && !startingIds.has(installed.id),
  );
  if (evictable.length === 0) return acquireSubroutine(playerState, piece, slotCap); // benches it

  const worst = evictable.reduce((worstSoFar, installed) => {
    const withoutInstalled = playerState.installedLoadout.filter((other) => other.id !== installed.id);
    const withoutWorst = playerState.installedLoadout.filter((other) => other.id !== worstSoFar.id);
    return compareSwapRanks(swapRank(installed, playerState, withoutInstalled), swapRank(worstSoFar, playerState, withoutWorst)) > 0
      ? installed
      : worstSoFar;
  });

  const withoutWorst = playerState.installedLoadout.filter((other) => other.id !== worst.id);
  const candidateRank = swapRank(piece, playerState, playerState.installedLoadout);
  const worstRank = swapRank(worst, playerState, withoutWorst);
  // Strictly better, not merely equal -- a tie isn't worth the churn of
  // benching a piece that's already doing its job. With rarity off the
  // comparison this is a genuinely high bar: a candidate has to close a
  // credit-gap the incumbent doesn't, or be on-archetype where the
  // incumbent isn't. That's intended -- an installed piece is a known
  // quantity and the loadout is the run's whole engine.
  if (compareSwapRanks(candidateRank, worstRank) >= 0) return acquireSubroutine(playerState, piece, slotCap); // benches it

  const evicted = uninstallSubroutine(playerState, worst.id);
  const withCandidateBenched = { ...evicted, bench: [...evicted.bench, piece] };
  return installSubroutine(withCandidateBenched, piece.id, slotCap);
}
