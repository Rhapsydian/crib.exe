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

export type Tag = 'trap' | 'piercing' | 'firewall' | 'worm' | 'daemon';

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
  | { kind: 'enemyState'; condition: 'breachContainmentBelow'; value: number }
  | { kind: 'enemyState'; condition: 'breachContainmentAbove'; value: number }
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
export interface DirectBurstPayload {
  kind: 'directBurst';
  amount: number;
}
export interface PiercingPayload {
  kind: 'piercing';
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
  /** Only meaningful when cadence is 'globalPulse': how many combined
   * points (scored by either side) trigger the next tick, per
   * DESIGN.md's "ticks every X combined points scored by either side."
   * Ignored for 'castersTurnPulse'. */
  pointsPerTick?: number;
}
/**
 * The 3 canonical debuff kinds (session 21+ content pass) — reused
 * across pieces rather than each subroutine inventing its own:
 * **throttled** dents the target's own scoring as it's credited to
 * their gauge; **corrupted** reduces the magnitude of the target's own
 * fired payloads; **choked** temporarily raises the target's gauge
 * threshold (Root's `enemyGaugeThreshold` manipulation target is the
 * permanent, non-expiring counterpart).
 */
export type DebuffKind = 'throttled' | 'corrupted' | 'choked';

export interface DebuffPayload {
  kind: 'debuff';
  debuffId: DebuffKind;
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
  /** See DotPayload.pointsPerTick — same meaning, only for 'globalPulse'. */
  pointsPerTick?: number;
}
export interface CleansePayload {
  kind: 'cleanse';
  /** Omit to cleanse any one active debuff, or target a specific one. */
  debuffId?: DebuffKind;
}

// --- Root (3) ---
export interface InstantManipulationPayload {
  kind: 'instantManipulation';
  /** 'enemyGaugeThreshold' (session 21+) permanently raises the enemy's
   * gauge threshold, no duration — the persistent counterpart to
   * Malware's temporary 'choked' debuff. */
  target: 'enemyGauge' | 'suitTally' | 'subroutineProgress' | 'enemyGaugeThreshold';
  amount: number;
  /** Required when target is 'subroutineProgress'. */
  targetSubroutineId?: string;
}
/**
 * Manipulates the underlying Cribbage layer itself, not combat state
 * directly. Always resolves at the next deal (like Scheduled Sabotage) —
 * a fired subroutine can only ever act after this hand's deal/discard/
 * cut have already happened, so there's nothing "instant" to apply to.
 * - **forceDiscard**: forces the *target* (not the caster) to discard
 *   their two highest-ranked cards next hand instead of their normal
 *   strategy — a forced-bad-discard, not a literal specific-card
 *   target (no hidden-information concept to target against here).
 * - **peekCrib**: reveals the crib's contents. No mechanical effect in
 *   this engine currently — nothing consumes "known" information (no
 *   real AI/UI exists yet that could use it); a real gap only once one
 *   does.
 * - **skewCut**: biases next hand's cut toward a Jack if the caster is
 *   that hand's dealer, away from one otherwise (His Heels only ever
 *   credits the dealer, so the bias direction always favors the
 *   caster).
 * - **markSuit**: immediately credits the caster's own suitTally
 *   Accumulator subroutines watching `suit` with one tally point, as if
 *   a card of that suit had been played.
 */
export interface CribbageLayerManipulationPayload {
  kind: 'cribbageLayerManipulation';
  action: 'forceDiscard' | 'peekCrib' | 'skewCut' | 'markSuit';
  /** Required when action is 'markSuit'. */
  suit?: Suit;
}
/** Fires now, but the wrapped effect doesn't resolve until a future
 * Cribbage-flow checkpoint. */
export interface ScheduledSabotagePayload {
  kind: 'scheduledSabotage';
  resolvesAt: 'nextDeal';
  effect: PayloadEffect;
}

export type PayloadEffect =
  | DirectBurstPayload
  | PiercingPayload
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
  /** Fires the instant it becomes ready, bypassing the normal turn-gate
   * (fireReadySubroutines only runs on the owning side's own triggered
   * turn). On selfState/enemyState (level-triggered) conditions, arms
   * edge-triggered by default — see
   * SubroutineRuntimeState.lastConditionTrue — so it fires once per
   * false→true transition rather than refiring on every continuous-
   * evaluation pass while the condition stays true. Accumulator/
   * Occurrence-triggered Reactive needs no such debounce — those are
   * already discrete crossing events, not a continuously-true level. */
  reactive?: boolean;
}
