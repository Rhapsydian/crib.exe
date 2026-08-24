import { neighborsOf, type LayerGraph, type RunPosition } from './map-types';
import { HEAT_PER_MOVE } from './heat';

/**
 * Movement (session 19/20 checkpoint D): free-roam within a layer -- any
 * connected edge, any direction, any number of times. A closed node is
 * never a legal target, which is what makes it genuinely impassable
 * rather than merely reward-free (see DESIGN.md Map & Run Structure).
 * Layer-to-layer transitions are the run orchestrator's job, not this
 * module's -- traversal only ever moves within the current layer's graph.
 */

/** Directly-connected nodes the player could move to right now --
 * excludes closed nodes, but includes inert (already resolved) ones,
 * since those stay fully passable forever after. */
export function legalMoves(graph: LayerGraph, position: RunPosition): string[] {
  return neighborsOf(graph, position.nodeId).filter((id) => {
    const node = graph.nodes.find((n) => n.id === id);
    return node !== undefined && node.state !== 'closed';
  });
}

export interface MoveResult {
  position: RunPosition;
  heatCost: number;
}

export function move(graph: LayerGraph, position: RunPosition, targetNodeId: string): MoveResult {
  if (!legalMoves(graph, position).includes(targetNodeId)) {
    throw new Error(`move: "${targetNodeId}" is not a legal move from "${position.nodeId}"`);
  }
  return { position: { ...position, nodeId: targetNodeId }, heatCost: HEAT_PER_MOVE };
}
