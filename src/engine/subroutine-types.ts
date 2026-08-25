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
/** Breach/Containment redesign (session 22+): builds an accumulating
 * shield on the caster's own side, no longer archetype-scoped -- the
 * shield absorbs the opponent's future non-Piercing directBurst offense
 * (denying the gauge-fill it would otherwise cause) until depleted;
 * Piercing always bypasses it. Archetype-scoping was dropped since
 * Piercing already supplies the one counter-play axis that matters. */
export interface WardPayload {
  kind: 'ward';
  amount: number;
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

/**
 * Reduces the caster's own in-combat Heat (CombatSideState.heat -- the
 * risk/reward-burst accumulator surfaced via CombatResult.
 * playerHeatGenerated), floored so it can't go below a set point.
 * Session 21+ content pass: no archetype's documented payload catalog
 * includes a heat-reduction effect (Exploit's risk/reward burst only
 * *costs* Heat), but Ghost's *Low Profile* starting Cantrip needs one --
 * reusing an Exploit-flavored payload would be thematically wrong for a
 * class with zero Exploit access. Filed under Root (Ghost's other
 * archetype), matching Root's own "any piece of the system" framing.
 */
export interface SelfHeatReductionPayload {
  kind: 'selfHeatReduction';
  amount: number;
  floor: number;
}

/**
 * Root recon (session 24, Root mechanical redesign): three
 * `firesAt`-only payloads, one per hand-lifecycle moment, each
 * revealing a different, real piece of intel to the caster. No fields
 * of their own -- the actual revealed cards are supplied at fire time
 * by combat.ts (resolve.ts's resolvePayload `revealedCards` option),
 * not baked into content authoring, since which cards are "the
 * opponent's hand" or "the crib" only exists as combat.ts's own local
 * state during a hand, never persisted into CombatState itself.
 * Reveals *data*, not decisions -- the caster's own discard/pegging
 * strategy still has to do something with it (see deal.ts's
 * DiscardContext.knownOpponentHand, pegging.ts's PlayContext.
 * knownCrib/knownOpponentHand); a no-op with the current baseline
 * strategies, which don't consume those fields yet.
 */
export interface RevealOpponentHandPayload {
  kind: 'revealOpponentHand';
}

export interface RevealCribPayload {
  kind: 'revealCrib';
}

export interface RevealOpponentKeptHandPayload {
  kind: 'revealOpponentKeptHand';
}

/**
 * Root manipulation (session 24 checkpoint D): forces a specific card
 * out of the opponent's hand and into this hand's crib -- a surgical
 * upgrade on cribbageLayerManipulation's forceDiscard (which dictates
 * *both* discarded cards via discardHighestTwo). `firesAt: 'onDealt'`
 * only. No fields of its own, same reasoning as the recon payloads --
 * resolve.ts's ai.ts-backed targeting (bestCardToForce) picks the
 * specific card *and* its best companion from combat.ts's supplied
 * revealedCards (the opponent's dealt hand), needing no recon
 * prerequisite (decision 3: payload resolution already has full state
 * access, unlike a strategy function).
 */
export interface ForceDiscardCardPayload {
  kind: 'forceDiscardCard';
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
  | ScheduledSabotagePayload
  | SelfHeatReductionPayload
  | RevealOpponentHandPayload
  | RevealCribPayload
  | RevealOpponentKeptHandPayload
  | ForceDiscardCardPayload;

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
  /** Fires at a fixed Cribbage hand-lifecycle moment instead of the
   * normal turn-gate -- Root mechanical redesign (session 24), the
   * engine seam recon/manipulation payloads need. Orthogonal to
   * `reactive`, same relationship: a `firesAt` subroutine bypasses
   * fireReadySubroutines'/fireNewlyReadyReactiveSubroutines' normal
   * paths entirely (resolve.ts's fireHandLifecycleSubroutines is the
   * only thing that ever fires it) and is expected never to also be
   * `reactive` -- readiness (via `trigger`) still governs whether it's
   * *armed*, `firesAt` only says *when* an armed one actually fires. */
  firesAt?: HandLifecycleMoment;
}

/** The three real Cribbage lifecycle moments a `firesAt` subroutine can
 * hook -- see SubroutineDefinition.firesAt and resolve.ts's
 * fireHandLifecycleSubroutines. 'onDealt': right after this hand's
 * cards are dealt, before either side discards. 'onCribSelected':
 * after both sides have discarded (the crib now exists), before the
 * cut. 'onPlayPhaseStart': after the cut, before the first peg play. */
export type HandLifecycleMoment = 'onDealt' | 'onCribSelected' | 'onPlayPhaseStart';
