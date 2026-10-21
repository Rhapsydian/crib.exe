import type { RunResult } from '../engine/run';
import type { NodeType } from '../engine/map-types';
import { enemyById } from '../engine/enemies';
import { layerHeatAllowance } from '../engine/heat';

/**
 * The end-of-run screen's story of the run (session 63, the user's
 * sketch sign-off): one row per layer reached -- every node visited in
 * order (relays left out), whether each fight was won, the enemies
 * fought, and how the layer ended -- plus who or what ended the run.
 * Pure over the run's own log, so RunEnd only draws it.
 */
export interface LayerStop {
  type: NodeType;
  /** A fight only: won (the node cleared), else lost. */
  won?: boolean;
}

export interface LayerRow {
  /** 1-based. */
  layer: number;
  stops: LayerStop[];
  /** The enemies fought here, in order, gatekeeper last. */
  enemies: string[];
  gatekeeper: string | null;
  ending: 'breached' | 'quarantined' | 'traced' | 'breachedThenCaught' | 'noRoute';
  /** A trace evasion after its gatekeeper (session 63): the final scores
   * (yours, its) and whether you slipped away. */
  evasion?: { scores: [number, number]; escaped: boolean };
}

export interface RunSummary {
  layers: LayerRow[];
  /** The ending in one line, naming the enemy or layer that ended it. */
  headline: string;
  finalHeat: number;
  /** The last layer's Heat allowance. */
  allowance: number;
}

const FIGHTS: NodeType[] = ['regularFight', 'eliteFight', 'gatekeeperFight'];
const enemyName = (id: string) => enemyById(id)?.name ?? id;

export function summarizeRun(result: RunResult): RunSummary {
  const rows = new Map<number, LayerRow>();
  for (const e of result.log) {
    if (e.type === 'evasion') {
      const row = rows.get(e.layerIndex);
      if (row) row.evasion = { scores: e.finalScores, escaped: e.escaped };
      continue;
    }
    if (e.type !== 'encounter' || e.nodeType === 'relay') continue;
    const row = rows.get(e.layerIndex) ?? { layer: e.layerIndex + 1, stops: [], enemies: [], gatekeeper: null, ending: 'breached' };
    rows.set(e.layerIndex, row);
    const fight = FIGHTS.includes(e.nodeType);
    row.stops.push(fight ? { type: e.nodeType, won: e.outcome.newState === 'inert' } : { type: e.nodeType });
    if (e.outcome.fight) {
      const name = enemyName(e.outcome.fight.enemyId);
      row.enemies.push(name);
      if (e.nodeType === 'gatekeeperFight') row.gatekeeper = name;
    }
  }
  const layers = [...rows.values()].sort((a, b) => a.layer - b.layer);
  const last = layers.at(-1);
  const where = last?.layer ?? 1;
  const gk = last?.gatekeeper ?? 'A gatekeeper';
  if (last && result.outcome !== 'victory') {
    last.ending = { quarantined: 'quarantined', heatMaxed: 'traced', breachedThenCaught: 'breachedThenCaught', noRouteRemains: 'noRoute' }[result.outcome] as LayerRow['ending'];
  }
  const headline = {
    victory: `You breached all four layers${last?.gatekeeper ? `; ${last.gatekeeper} was the last to fall` : ''}. The network is yours.`,
    quarantined: `${gk} purged you at layer ${where}.`,
    heatMaxed: `Your Heat maxed out on layer ${where}. They found you.`,
    breachedThenCaught: last?.evasion
      ? `You beat ${gk}, but its toll maxed your Heat, and it traced you (${last.evasion.scores[0]}-${last.evasion.scores[1]} in the evasion). Layer ${where} counts as breached.`
      : `You beat ${gk}, but its toll maxed your Heat. Layer ${where} counts as breached.`,
    noRouteRemains: `Closed nodes cut off every path to layer ${where}'s gatekeeper.`,
  }[result.outcome];
  return { layers, headline, finalHeat: result.finalHeat, allowance: layerHeatAllowance(where - 1, result.playerState.maxHeatBonus) };
}
