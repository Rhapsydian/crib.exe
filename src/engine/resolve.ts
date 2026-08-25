import type { PlayerIndex } from './pegging';
import type { Archetype, PayloadEffect, SubroutineDefinition, TickCadence } from './subroutine-types';
import {
  createInitialState,
  evaluateEnemyState,
  evaluateSelfState,
  isReady,
  resetAfterFire,
  type SubroutineRuntimeState,
  type TriggerContext,
} from './triggers';
import { createInitiativeGauge, createBreachContainment, pushBreachContainment, type InitiativeGauge } from './gauges';

/**
 * Fire-on-turn resolution (session 17 checkpoint E): given that a side's
 * turn has already been triggered (Checkpoint F's job, via the
 * initiative gauge), iterate that side's loadout top-to-bottom, fire
 * every subroutine that's ready and not toggled off, and resolve its
 * payload against Breach/Containment or the opposing side's state.
 */

export interface ActiveDebuff {
  debuffId: string;
  magnitude: number;
  remainingDuration: number;
}

/** A registered DoT/HoT tick, still awaiting Checkpoint F's per-hand
 * orchestrator to actually resolve ticks on the right cadence. */
export interface ActiveTick {
  amountPerTick: number;
  cadence: TickCadence;
  remainingDuration: number;
}

export interface LoadoutEntry {
  definition: SubroutineDefinition;
  state: SubroutineRuntimeState;
}

export interface CombatSideState {
  gauge: InitiativeGauge;
  heat: number;
  loadout: LoadoutEntry[];
  debuffs: ActiveDebuff[];
  /** Archetypes currently warded against; consumed the moment a matching
   * non-piercing payload would otherwise land. */
  wards: Archetype[];
  dots: ActiveTick[];
  hots: ActiveTick[];
}

/** A Root scheduledSabotage payload fired now but resolves at a future
 * Cribbage-flow checkpoint (e.g. next deal) -- Checkpoint F's orchestrator
 * consumes and clears these once it has hand-boundary hooks to do so. */
export interface PendingSabotage {
  casterSide: PlayerIndex;
  effect: PayloadEffect;
}

export interface CombatState {
  breachContainment: number;
  sides: [CombatSideState, CombatSideState];
  pendingSabotage: PendingSabotage[];
}

export function createCombatSideState(definitions: SubroutineDefinition[], gaugeThreshold: number): CombatSideState {
  return {
    gauge: createInitiativeGauge(gaugeThreshold),
    heat: 0,
    loadout: definitions.map((definition) => ({ definition, state: createInitialState() })),
    debuffs: [],
    wards: [],
    dots: [],
    hots: [],
  };
}

export function createCombatState(
  playerLoadout: SubroutineDefinition[],
  enemyLoadout: SubroutineDefinition[],
  gaugeThreshold: number,
): CombatState {
  return {
    breachContainment: createBreachContainment(),
    sides: [createCombatSideState(playerLoadout, gaugeThreshold), createCombatSideState(enemyLoadout, gaugeThreshold)],
    pendingSabotage: [],
  };
}

function opponentOf(side: PlayerIndex): PlayerIndex {
  return (1 - side) as PlayerIndex;
}

function replaceSide(
  sides: [CombatSideState, CombatSideState],
  side: PlayerIndex,
  newState: CombatSideState,
): [CombatSideState, CombatSideState] {
  const copy = sides.slice() as [CombatSideState, CombatSideState];
  copy[side] = newState;
  return copy;
}

/** Breach/Containment's 0-100 scale is defined relative to side 0's
 * favor (100 = fully Breach, side 0's favor). A push "toward the caster"
 * therefore pushes up for side 0 and down for side 1. */
function pushTowardCaster(value: number, amount: number, caster: PlayerIndex) {
  return pushBreachContainment(value, amount, caster === 0);
}

function consumeWard(sideState: CombatSideState, archetype: Archetype): { sideState: CombatSideState; blocked: boolean } {
  const index = sideState.wards.indexOf(archetype);
  if (index === -1) return { sideState, blocked: false };
  const wards = sideState.wards.slice();
  wards.splice(index, 1);
  return { sideState: { ...sideState, wards }, blocked: true };
}

export interface ResolveContext {
  /** How many other subroutines already fired earlier this same turn --
   * chainFinisherScaling's payoff for loadout sequencing. */
  priorFireCountThisTurn: number;
}

/** Resolves one subroutine's payload against Breach/Containment or the
 * opposing side's state. `archetype` comes from the firing subroutine's
 * definition (payloads themselves don't carry it) -- needed for ward
 * matching. */
export function resolvePayload(
  payload: PayloadEffect,
  archetype: Archetype,
  combatState: CombatState,
  caster: PlayerIndex,
  context: ResolveContext = { priorFireCountThisTurn: 0 },
): CombatState {
  const target = opponentOf(caster);

  switch (payload.kind) {
    case 'directBurst': {
      const { sideState, blocked } = consumeWard(combatState.sides[target], archetype);
      const sides = replaceSide(combatState.sides, target, sideState);
      if (blocked) return { ...combatState, sides };
      const { value } = pushTowardCaster(combatState.breachContainment, payload.amount, caster);
      return { ...combatState, breachContainment: value, sides };
    }
    case 'piercing': {
      // Ignores wards entirely -- Exploit's counter to defense-heavy builds.
      const { value } = pushTowardCaster(combatState.breachContainment, payload.amount, caster);
      return { ...combatState, breachContainment: value };
    }
    case 'chainFinisherScaling': {
      const amount = payload.baseAmount + payload.perPriorFire * context.priorFireCountThisTurn;
      const { value } = pushTowardCaster(combatState.breachContainment, amount, caster);
      return { ...combatState, breachContainment: value };
    }
    case 'riskRewardBurst': {
      const { value } = pushTowardCaster(combatState.breachContainment, payload.amount, caster);
      const casterState = combatState.sides[caster];
      const sides = replaceSide(combatState.sides, caster, { ...casterState, heat: casterState.heat + payload.heatCost });
      return { ...combatState, breachContainment: value, sides };
    }
    case 'dot': {
      const targetState = combatState.sides[target];
      const dots = [
        ...targetState.dots,
        { amountPerTick: payload.amountPerTick, cadence: payload.cadence, remainingDuration: payload.duration },
      ];
      const sides = replaceSide(combatState.sides, target, { ...targetState, dots });
      return { ...combatState, sides };
    }
    case 'debuff': {
      const targetState = combatState.sides[target];
      const debuffs = [
        ...targetState.debuffs,
        { debuffId: payload.debuffId, magnitude: payload.magnitude, remainingDuration: payload.duration },
      ];
      const sides = replaceSide(combatState.sides, target, { ...targetState, debuffs });
      return { ...combatState, sides };
    }
    case 'instantCounterPush': {
      const { value } = pushTowardCaster(combatState.breachContainment, payload.amount, caster);
      return { ...combatState, breachContainment: value };
    }
    case 'ward': {
      const casterState = combatState.sides[caster];
      const sides = replaceSide(combatState.sides, caster, { ...casterState, wards: [...casterState.wards, payload.blocksArchetype] });
      return { ...combatState, sides };
    }
    case 'hot': {
      const casterState = combatState.sides[caster];
      const hots = [
        ...casterState.hots,
        { amountPerTick: payload.amountPerTick, cadence: payload.cadence, remainingDuration: payload.duration },
      ];
      const sides = replaceSide(combatState.sides, caster, { ...casterState, hots });
      return { ...combatState, sides };
    }
    case 'cleanse': {
      const casterState = combatState.sides[caster];
      const index = payload.debuffId
        ? casterState.debuffs.findIndex((d) => d.debuffId === payload.debuffId)
        : casterState.debuffs.length > 0
          ? 0
          : -1;
      if (index === -1) return combatState;
      const debuffs = casterState.debuffs.slice();
      debuffs.splice(index, 1);
      const sides = replaceSide(combatState.sides, caster, { ...casterState, debuffs });
      return { ...combatState, sides };
    }
    case 'instantManipulation': {
      if (payload.target === 'enemyGauge') {
        const targetState = combatState.sides[target];
        const progress = Math.max(0, targetState.gauge.progress - payload.amount);
        const sides = replaceSide(combatState.sides, target, { ...targetState, gauge: { ...targetState.gauge, progress } });
        return { ...combatState, sides };
      }
      if (payload.target === 'subroutineProgress' && payload.targetSubroutineId) {
        const casterState = combatState.sides[caster];
        const index = casterState.loadout.findIndex((entry) => entry.definition.id === payload.targetSubroutineId);
        if (index === -1) return combatState;
        const entry = casterState.loadout[index];
        const loadout = casterState.loadout.slice();
        loadout[index] = {
          ...entry,
          state: { ...entry.state, accumulatedProgress: entry.state.accumulatedProgress + payload.amount },
        };
        const sides = replaceSide(combatState.sides, caster, { ...casterState, loadout });
        return { ...combatState, sides };
      }
      // suitTally: no suit-tally state exists anywhere in CombatState yet
      // -- same later-content-pass gap noted in triggers.ts.
      return combatState;
    }
    case 'cribbageLayerManipulation':
      // Needs hooks into the Cribbage deal/discard/cut flow that don't
      // exist in this engine's data model -- real wiring waits until
      // combat.ts (checkpoint F) connects to game.ts's per-hand flow.
      return combatState;
    case 'scheduledSabotage':
      return { ...combatState, pendingSabotage: [...combatState.pendingSabotage, { casterSide: caster, effect: payload.effect }] };
  }
}

export function buildTriggerContext(
  combatState: CombatState,
  side: PlayerIndex,
  firedSubroutineIdsThisTurn: ReadonlySet<string>,
  isDealer: boolean,
): TriggerContext {
  const own = combatState.sides[side];
  const enemy = combatState.sides[opponentOf(side)];
  // Breach/Containment is defined relative to side 0's favor; "the
  // enemy's favor" flips depending on which side is asking.
  const enemyBreachContainmentFavor = side === 0 ? 100 - combatState.breachContainment : combatState.breachContainment;
  return {
    self: { heat: own.heat, isDealer },
    enemy: {
      breachContainment: enemyBreachContainmentFavor,
      gaugeFillFraction: enemy.gauge.progress / enemy.gauge.threshold,
      activeDebuffIds: enemy.debuffs.map((d) => d.debuffId),
    },
    firedSubroutineIdsThisTurn,
  };
}

/**
 * Latches `ready` for every selfState/enemyState-triggered subroutine on
 * both sides whose live condition is currently true -- the sticky-latch
 * fix isReady() above now depends on. Non-Reactive subroutines never
 * have `ready` unset once latched (matches accumulator/occurrence's
 * existing "banked, not re-checked" behavior). Reactive subroutines on
 * these two families arm edge-triggered instead: `lastConditionTrue` is
 * tracked every pass regardless of whether it's already ready, so a
 * Reactive piece only latches on an actual false→true transition, not
 * on every call while the condition stays continuously true (it fires
 * immediately once armed -- see fireNewlyReadyReactiveSubroutines below
 * -- so re-latching on every pass would refire it constantly).
 *
 * Safe and cheap to call after any state change that could affect a
 * condition: a gauge update, a payload resolution (Heat/Breach-
 * Containment/debuffs), or a new hand's dealer becoming known.
 * firedSubroutineIdsThisTurn is irrelevant here (chained/always aren't
 * touched) so an empty set is passed to buildTriggerContext.
 */
export function refreshTriggerReadiness(combatState: CombatState, handDealer: PlayerIndex): CombatState {
  let state = combatState;
  for (const side of [0, 1] as PlayerIndex[]) {
    const sideState = state.sides[side];
    const context = buildTriggerContext(state, side, EMPTY_FIRED_SET, side === handDealer);
    const loadout = sideState.loadout.map((entry) => {
      const trigger = entry.definition.trigger;
      if (trigger.kind !== 'selfState' && trigger.kind !== 'enemyState') return entry;

      const conditionTrue =
        trigger.kind === 'selfState' ? evaluateSelfState(trigger, context.self) : evaluateEnemyState(trigger, context.enemy);
      const justArmed = entry.definition.reactive ? conditionTrue && !entry.state.lastConditionTrue : conditionTrue;

      return {
        ...entry,
        state: { ...entry.state, ready: entry.state.ready || justArmed, lastConditionTrue: conditionTrue },
      };
    });
    state = { ...state, sides: replaceSide(state.sides, side, { ...sideState, loadout }) };
  }
  return state;
}

const EMPTY_FIRED_SET: ReadonlySet<string> = new Set();

/**
 * Fires every subroutine whose `ready` flag just flipped false→true
 * between `before` and `after` (comparing loadout entries index-by-
 * index, both sides) and is Reactive -- bypassing the normal turn-gate
 * entirely. Call right after any step that can change readiness
 * (applying an occurrence, or refreshTriggerReadiness) so Reactive
 * pieces fire the instant they arm rather than waiting for the owning
 * side's next turn. Processes side 0 then side 1, loadout order within
 * each side, the same deterministic order fireReadySubroutines uses.
 * priorFireCountThisTurn is always 0 here -- chain-finisher scaling's
 * "how many fired earlier this turn" concept doesn't apply to a fire
 * that isn't happening on anyone's turn.
 */
export function fireNewlyReadyReactiveSubroutines(
  before: CombatState,
  after: CombatState,
): { combatState: CombatState; events: FireEvent[] } {
  let state = after;
  const events: FireEvent[] = [];
  for (const side of [0, 1] as PlayerIndex[]) {
    const beforeLoadout = before.sides[side].loadout;
    const loadoutLength = state.sides[side].loadout.length;
    for (let i = 0; i < loadoutLength; i++) {
      const entry = state.sides[side].loadout[i];
      const justBecameReady = !beforeLoadout[i].state.ready && entry.state.ready;
      if (!justBecameReady || !entry.definition.reactive) continue;

      state = resolvePayload(entry.definition.payload, entry.definition.archetype, state, side, {
        priorFireCountThisTurn: 0,
      });
      events.push({ subroutineId: entry.definition.id, side, payload: entry.definition.payload });
      state = updateLoadoutEntryState(state, side, i, resetAfterFire(state.sides[side].loadout[i].state));
    }
  }
  return { combatState: state, events };
}

function updateLoadoutEntryState(
  combatState: CombatState,
  side: PlayerIndex,
  index: number,
  newState: SubroutineRuntimeState,
): CombatState {
  const sideState = combatState.sides[side];
  const loadout = sideState.loadout.slice();
  loadout[index] = { ...loadout[index], state: newState };
  const sides = replaceSide(combatState.sides, side, { ...sideState, loadout });
  return { ...combatState, sides };
}

export interface FireEvent {
  subroutineId: string;
  side: PlayerIndex;
  payload: PayloadEffect;
}

/**
 * Iterates `side`'s loadout top-to-bottom, firing every subroutine that
 * is both ready and not toggled off. Chained triggers fed by an earlier
 * fire in this same pass are re-evaluated for later subroutines
 * immediately (loadout-order sequencing), but each subroutine is only
 * evaluated once per pass -- not re-scanned after firing.
 */
export function fireReadySubroutines(
  combatState: CombatState,
  side: PlayerIndex,
  selfContext: { isDealer: boolean },
): { combatState: CombatState; events: FireEvent[] } {
  let state = combatState;
  const events: FireEvent[] = [];
  const firedIds = new Set<string>();
  const loadoutLength = state.sides[side].loadout.length;

  for (let i = 0; i < loadoutLength; i++) {
    const entry = state.sides[side].loadout[i];
    const triggerContext = buildTriggerContext(state, side, firedIds, selfContext.isDealer);
    if (!isReady(entry.definition, entry.state, triggerContext)) continue;
    if (!entry.state.toggledOn) continue;

    state = resolvePayload(entry.definition.payload, entry.definition.archetype, state, side, {
      priorFireCountThisTurn: events.length,
    });
    events.push({ subroutineId: entry.definition.id, side, payload: entry.definition.payload });
    firedIds.add(entry.definition.id);
    state = updateLoadoutEntryState(state, side, i, resetAfterFire(entry.state));
  }

  return { combatState: state, events };
}
