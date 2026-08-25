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

/** Moves `id` from bench to installedLoadout, appended at the end. A
 * no-op if `id` isn't on the bench, or if installedLoadout is already
 * at `slotCap`. */
export function installSubroutine(playerState: RunPlayerState, id: string, slotCap: number = INSTALLED_SLOT_CAP): RunPlayerState {
  if (playerState.installedLoadout.length >= slotCap) return playerState;
  const index = playerState.bench.findIndex((piece) => piece.id === id);
  if (index === -1) return playerState;
  const piece = playerState.bench[index];
  const bench = playerState.bench.slice();
  bench.splice(index, 1);
  return { ...playerState, bench, installedLoadout: [...playerState.installedLoadout, piece] };
}

/** Moves `id` from installedLoadout to bench, appended at the end of the
 * bench. A no-op if `id` isn't currently installed. */
export function uninstallSubroutine(playerState: RunPlayerState, id: string): RunPlayerState {
  const index = playerState.installedLoadout.findIndex((piece) => piece.id === id);
  if (index === -1) return playerState;
  const piece = playerState.installedLoadout[index];
  const installedLoadout = playerState.installedLoadout.slice();
  installedLoadout.splice(index, 1);
  return { ...playerState, installedLoadout, bench: [...playerState.bench, piece] };
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

/** Adds `piece` to bench, then immediately tries to install it -- a
 * freshly-acquired piece defaults to "try to put it to use," falling
 * back to sitting on the bench once installedLoadout is full at
 * `slotCap`. Acquiring an id that's already owned isn't specially
 * handled here (no dedup, no Merge-material conversion) -- that's
 * Checkpoint E's job; a duplicate id simply becomes a second bench/
 * installed entry for now. */
export function acquireSubroutine(playerState: RunPlayerState, piece: SubroutineDefinition, slotCap: number = INSTALLED_SLOT_CAP): RunPlayerState {
  const withBench = { ...playerState, bench: [...playerState.bench, piece] };
  return installSubroutine(withBench, piece.id, slotCap);
}
