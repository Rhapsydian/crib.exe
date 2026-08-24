/**
 * Phase 3 (session 19/20): the network-map graph data model. A run's
 * position is free-roam within a layer (any connected edge, any
 * direction, any number of times) and one-way between layers -- see
 * DESIGN.md's Map & Run Structure section.
 */

export type NodeType = 'regularFight' | 'gatekeeperFight' | 'safehouse' | 'shop' | 'event' | 'relay';

/**
 * `closed` (a lost regular/elite fight) is genuinely impassable, not
 * merely reward-free -- that distinction is what makes the "no route
 * forward remains" run-ending condition meaningful. `inert` (a resolved
 * encounter, of any node type) stays fully passable forever after.
 */
export type NodeState = 'unresolved' | 'inert' | 'closed';

export interface MapNode {
  id: string;
  type: NodeType;
  state: NodeState;
}

/** Undirected -- movement is free-roam in either direction. */
export interface MapEdge {
  a: string;
  b: string;
}

export interface LayerGraph {
  nodes: MapNode[];
  edges: MapEdge[];
  entryNodeId: string;
  gatekeeperNodeId: string;
}

export interface RunPosition {
  layerIndex: number;
  nodeId: string;
}

/**
 * Relay nodes have no encounter at all, so they're created already
 * `inert` rather than `unresolved` -- reusing "passable, nothing to
 * resolve" instead of adding a separate always-passable concept.
 */
export function createNode(id: string, type: NodeType): MapNode {
  return { id, type, state: type === 'relay' ? 'inert' : 'unresolved' };
}
