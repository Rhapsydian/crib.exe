import type { LayerGraph, MapNode, NodeType } from './map-types';
import type { ClassId } from './classes';
import type { BurnerId } from './burner-types';
import type { RunOptions } from './run';

/**
 * The guided first run (session 63, docs/tutorial-design.md T1-T5): one
 * small hand-made layer, always the same seed and class, taught by a
 * coach as each thing first appears. Underneath it is an ordinary run
 * (the same screens, saves and rules); these options are all that make
 * it the tutorial.
 *
 * The path is one line, in the outline's order (T4): a fight, its reward,
 * a second fight, a Shop, a Safehouse, then an easy gatekeeper. Both
 * fights and the gatekeeper fall inside the run's opener window
 * (enemies.ts: the first three fights use the easiest regulars at the
 * lowest skill), so they come out gentle without special enemies.
 */

/** Blackhat: its Hooks fire on fifteens and pairs, often and visibly (T4). */
export const TUTORIAL_CLASS: ClassId = 'exploit-overclock';
/** Chosen in checkpoint 5 (scripts/tutorial-seed.ts): the first hand's
 * keep, 7 6 8 8, scores fifteens, a pair and a double run, and the
 * simulated player wins the tutorial at every skill from 0 to 0.85 (T5). */
export const TUTORIAL_SEED = 21;

const node = (id: string, type: NodeType, x: number, y: number, extra: Partial<MapNode> = {}): MapNode => ({
  id,
  type,
  state: type === 'relay' ? 'inert' : 'unresolved',
  x,
  y,
  ...extra,
});

/** Bottom to top, one route, zig-zagging so the map reads as a climb. The
 * gatekeeper is Firewall Beta (enemies.ts), a gentler Firewall Prime whose
 * Mod (no more than 8 Credit a turn) is a clear rule-bend for the coach to
 * point out. */
export const TUTORIAL_LAYER: LayerGraph = {
  nodes: [
    node('t-start', 'relay', 0.5, 0.94),
    node('t-fight-1', 'regularFight', 0.32, 0.78),
    node('t-fight-2', 'regularFight', 0.66, 0.62),
    node('t-shop', 'shop', 0.36, 0.46),
    node('t-safehouse', 'safehouse', 0.64, 0.3),
    node('t-gatekeeper', 'gatekeeperFight', 0.5, 0.1, { assignedEnemyId: 'firewall-beta' }),
  ],
  edges: [
    { a: 't-start', b: 't-fight-1' },
    { a: 't-fight-1', b: 't-fight-2' },
    { a: 't-fight-2', b: 't-shop' },
    { a: 't-shop', b: 't-safehouse' },
    { a: 't-safehouse', b: 't-gatekeeper' },
  ],
  entryNodeId: 't-start',
  gatekeeperNodeId: 't-gatekeeper',
};

/** What makes a run the guided run: one layer (the hand-made one), a
 * carried combat Burner to arm in the second fight, a banked copy of Port
 * Scan so the Safehouse's Merge is a real option, and enough Data to buy
 * something at the Shop. */
export const TUTORIAL_OPTIONS: Pick<RunOptions, 'classId' | 'seed' | 'layerNodeCounts' | 'layerGraphs' | 'startingData' | 'startingMaterial' | 'carriedBurnerIdsOverride'> = {
  classId: TUTORIAL_CLASS,
  seed: TUTORIAL_SEED,
  layerNodeCounts: [TUTORIAL_LAYER.nodes.length],
  layerGraphs: [TUTORIAL_LAYER],
  startingData: 40,
  startingMaterial: { 'port-scan': 1 },
  carriedBurnerIdsOverride: ['flash-drive' as BurnerId],
};
