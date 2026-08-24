import type { Suit } from './cards';

/**
 * Pure type system for Phase 2 (session 17 checkpoint B). No runtime
 * logic lives here — trigger evaluation is triggers.ts, payload
 * resolution is resolve.ts.
 */

export type Archetype = 'exploit' | 'malware' | 'encryption' | 'root';

/** Suits are still the generic 0-3 slots from cards.ts; real suit-name
 * theming is a UI concern, not the engine's. */
export const SUIT_ARCHETYPES: Record<Suit, Archetype> = {
  0: 'exploit',
  1: 'malware',
  2: 'encryption',
  3: 'root',
};

export type Tag = 'trap' | 'backdoor' | 'firewall' | 'worm' | 'daemon';

/** The 8 session-5 occurrence categories, unified across the pegging
 * play phase and the show/count phase. */
export type OccurrenceCategory =
  | 'fifteen'
  | 'pair'
  | 'run'
  | 'flush'
  | 'hisNobs'
  | 'hisHeels'
  | 'thirtyOne'
  | 'go';

export type AccumulatorTrigger =
  | { kind: 'accumulator'; metric: 'points'; threshold: number }
  | { kind: 'accumulator'; metric: 'suitTally'; suit: Suit; threshold: number };

export type OccurrenceTrigger =
  | { kind: 'occurrence'; category: OccurrenceCategory; variation: 'instant' }
  | { kind: 'occurrence'; category: OccurrenceCategory; variation: 'threshold'; bankTarget: number }
  | { kind: 'occurrence'; category: OccurrenceCategory; variation: 'scaling'; cap: number };

export type EnemyStateTrigger =
  | { kind: 'enemyState'; condition: 'controlBreachBelow'; value: number }
  | { kind: 'enemyState'; condition: 'controlBreachAbove'; value: number }
  | { kind: 'enemyState'; condition: 'gaugeFillAbove'; fraction: number }
  | { kind: 'enemyState'; condition: 'hasDebuff'; debuffId: string };

export type SelfStateTrigger =
  | { kind: 'selfState'; condition: 'heatAbove'; value: number }
  | { kind: 'selfState'; condition: 'heatBelow'; value: number }
  | { kind: 'selfState'; condition: 'isDealer' }
  | { kind: 'selfState'; condition: 'isNonDealer' };

/** References another subroutine in the same loadout by id — that
 * subroutine firing feeds this one's condition. */
export interface ChainedTrigger {
  kind: 'chained';
  afterSubroutineId: string;
}

/** No real condition — fires every turn that side gets ("Cantrip"). */
export interface AlwaysTrigger {
  kind: 'always';
}

/**
 * The 6 trigger families. Togglable is deliberately NOT a 7th member —
 * DESIGN.md is explicit it's an orthogonal property, so it lives on
 * SubroutineDefinition instead.
 */
export type TriggerFamily =
  | AccumulatorTrigger
  | OccurrenceTrigger
  | EnemyStateTrigger
  | SelfStateTrigger
  | ChainedTrigger
  | AlwaysTrigger;

/** Malware DoT / Encryption HoT tick cadence (DESIGN.md: a per-subroutine
 * property, not universal). Global pulse ticks off combined points from
 * either side; caster's-turn pulse ticks only when the caster gets a turn. */
export type TickCadence = 'globalPulse' | 'castersTurnPulse';

// --- Exploit (4) ---
export interface InstantBurstPayload {
  kind: 'instantBurst';
  amount: number;
}
export interface PiercingBurstPayload {
  kind: 'piercingBurst';
  amount: number;
}
export interface ChainFinisherScalingPayload {
  kind: 'chainFinisherScaling';
  baseAmount: number;
  perPriorFire: number;
}
export interface RiskRewardBurstPayload {
  kind: 'riskRewardBurst';
  amount: number;
  heatCost: number;
}

// --- Malware (2) ---
export interface DotPayload {
  kind: 'dot';
  amountPerTick: number;
  cadence: TickCadence;
  duration: number;
}
export interface DebuffPayload {
  kind: 'debuff';
  debuffId: string;
  magnitude: number;
  duration: number;
}

// --- Encryption (4) ---
export interface InstantCounterPushPayload {
  kind: 'instantCounterPush';
  amount: number;
}
/** Blocks the next incoming payload of a given archetype the moment it
 * would fire — reactive negation. */
export interface WardPayload {
  kind: 'ward';
  blocksArchetype: Archetype;
}
export interface HotPayload {
  kind: 'hot';
  amountPerTick: number;
  cadence: TickCadence;
  duration: number;
}
export interface CleansePayload {
  kind: 'cleanse';
  /** Omit to cleanse any one active debuff, or target a specific one. */
  debuffId?: string;
}

// --- Root (3) ---
export interface InstantManipulationPayload {
  kind: 'instantManipulation';
  target: 'enemyGauge' | 'suitTally' | 'subroutineProgress';
  amount: number;
  /** Required when target is 'subroutineProgress'. */
  targetSubroutineId?: string;
}
/** Manipulates the underlying Cribbage layer itself, not combat state
 * directly — force a discard, peek the crib, skew the cut, mark a suit. */
export interface CribbageLayerManipulationPayload {
  kind: 'cribbageLayerManipulation';
  action: 'forceDiscard' | 'peekCrib' | 'skewCut' | 'markSuit';
}
/** Fires now, but the wrapped effect doesn't resolve until a future
 * Cribbage-flow checkpoint. */
export interface ScheduledSabotagePayload {
  kind: 'scheduledSabotage';
  resolvesAt: 'nextDeal';
  effect: PayloadEffect;
}

export type PayloadEffect =
  | InstantBurstPayload
  | PiercingBurstPayload
  | ChainFinisherScalingPayload
  | RiskRewardBurstPayload
  | DotPayload
  | DebuffPayload
  | InstantCounterPushPayload
  | WardPayload
  | HotPayload
  | CleansePayload
  | InstantManipulationPayload
  | CribbageLayerManipulationPayload
  | ScheduledSabotagePayload;

export interface SubroutineDefinition {
  id: string;
  name: string;
  archetype: Archetype;
  trigger: TriggerFamily;
  payload: PayloadEffect;
  tags: Tag[];
  /** Whether this subroutine carries a manual on/off switch at all,
   * orthogonal to its trigger family. The actual current on/off state is
   * runtime, not definition, data — see SubroutineRuntimeState.toggledOn
   * in triggers.ts. */
  togglable?: boolean;
}
