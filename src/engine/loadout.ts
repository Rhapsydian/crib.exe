import type { SubroutineDefinition } from './subroutine-types';
import type { RunPlayerState } from './run';

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
