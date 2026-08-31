import type { Suit } from './cards';

/**
 * Pure type system for Phase 2 (session 17 checkpoint B). No runtime
 * logic lives here — trigger evaluation is triggers.ts, payload
 * resolution is resolve.ts.
 */

/** 'neutral' (session 28's Neutral Archetype) is a genuine 5th value,
 * not one of the other 4 reused for flavor -- it naturally fails every
 * archetype-specific passive check (Primed's `=== 'root'`, Sleeper
 * Cell's `=== 'malware'`, etc.) without needing new exclusion logic,
 * and correctly has no suit affiliation at all (see SUIT_ARCHETYPES
 * below, which stays a 4-entry map -- Cribbage only has 4 real suits, a
 * neutral piece was never going to get a 5th one). No class or enemy
 * ever "specializes" in it (ClassDefinition/EnemyDefinition.archetypes
 * never includes it) -- it's a small, shared toolbox anyone can draw
 * from, built entirely from trigger families that don't depend on suit
 * (see DESIGN.md's "Neutral Archetype" section). */
export type Archetype = 'exploit' | 'malware' | 'encryption' | 'root' | 'neutral';

/** The 4 real, suited archetypes -- excludes 'neutral', which has no
 * suit and which no class/enemy ever specializes in. Used for
 * ClassDefinition/EnemyDefinition.archetypes so indexing ARCHETYPE_POOLS
 * (subroutines.ts) or SUIT_ARCHETYPES by a class/enemy's own archetypes
 * stays exhaustive without a 'neutral' case neither structure has. */
export type SuitedArchetype = Exclude<Archetype, 'neutral'>;

/** Suits are still the generic 0-3 slots from cards.ts; real suit-name
 * theming is a UI concern, not the engine's. */
export const SUIT_ARCHETYPES: Record<Suit, SuitedArchetype> = {
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
  | { kind: 'accumulator'; metric: 'suitTally'; suit: Suit; threshold: number }
  /** Session 28's Neutral Archetype (Circuit Breaker): banks the total
   * amount of the caster's own Ward/instantCounterPush/hot payloads
   * cast this match -- fed from resolve.ts's creditMitigationBanked,
   * called wherever those three payload kinds resolve. Suit-independent
   * like 'points', unlike 'suitTally'. */
  | { kind: 'accumulator'; metric: 'mitigationBanked'; threshold: number };

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

/** References something that fired earlier in the same turn's own
 * resolution pass, feeding this one's condition. Three match modes
 * (session 41's redesign): `afterSubroutineId` (a specific piece, by id)
 * stays reserved for contexts that guarantee both halves are present
 * together — a class's own starting loadout, or a future Event that
 * grants a matched pair at once — since nothing in the acquisition system
 * (shop slate, combat rewards) guarantees a player ever draws a specific
 * id-pair together in one run. Pool content instead matches on
 * `afterArchetype` (any piece of that archetype fired) or `afterTag` (any
 * piece carrying that tag fired) — broader, so a chained pool piece can
 * never end up permanently dead for classes that don't own its old
 * id-specific partner. */
export type ChainedTrigger =
  | { kind: 'chained'; afterSubroutineId: string }
  | { kind: 'chained'; afterArchetype: Archetype }
  | { kind: 'chained'; afterTag: Tag };

/** No real condition — fires every turn that side gets ("Cantrip"). */
export interface AlwaysTrigger {
  kind: 'always';
}

/**
 * Root-native, session 40 continued: watches a specific occurrence
 * category at or above a magnitude floor, from *either* side, not just
 * the caster's own -- the one deliberate break from Occurrence's own
 * "scoped to the caster's own scoring events" rule (DESIGN.md). Fires
 * the instant a qualifying occurrence happens (resolve.ts's
 * fireRareOccurrenceSubroutines), completely independent of whose turn
 * it is -- no `reactive` flag needed, this trigger family doesn't go
 * through the normal ready-flag pipeline at all. `minMagnitude` is what
 * makes "rare" real rather than aspirational: a Pair occurrence's own
 * magnitude is real *points*, not a count-of-a-kind (scoring.ts's
 * pairEvents/pegging.ts's own breakdown: n*(n-1) -- 2 for a bare pair, 6
 * for pair royal, 12 for double pair royal), so `minMagnitude: 6`
 * genuinely means "pair royal or better," not "any pair." Pairs with any
 * existing credit-capable payload (sessionHijack, directBurst, etc.) --
 * no new payload kind needed, the novelty is entirely in the trigger.
 */
export interface RareOccurrenceTrigger {
  kind: 'rareOccurrence';
  category: OccurrenceCategory;
  minMagnitude: number;
  watchSide: 'own' | 'enemy' | 'either';
}

/**
 * Root-native, session 40 continued: watches one phase's own aggregate
 * total for a resolved hand -- crib/hand/pegging scores are each already
 * computed onto HandResult (game.ts) before any turn-based processing
 * begins, so this checks the real number directly rather than
 * approximating from individual occurrences. Fires once per qualifying
 * hand (resolve.ts's fireHandOutcomeSubroutines), right after that
 * hand's HandResult is built -- same "bypasses the normal ready-flag
 * pipeline entirely" treatment as RareOccurrenceTrigger above, for the
 * same reason: this has nothing to do with turn-based readiness.
 *
 * `phase: 'crib'` only ever resolves for a hand where `side` (resolved
 * from the caster's own perspective) is actually that hand's dealer --
 * the crib belongs to the dealer, so a hand where the specified side
 * isn't dealing simply doesn't trigger this pass, not an error.
 * `phase: 'hand'` resolves to `side`'s own kept-hand score regardless of
 * dealer role (dealerHandScore or nonDealerHandScore, whichever `side`
 * actually was that hand). `phase: 'pegging'` reads peggingScores
 * directly.
 */
export interface HandOutcomeTrigger {
  kind: 'handOutcome';
  phase: 'crib' | 'hand' | 'pegging';
  side: 'own' | 'enemy';
  comparison: 'above' | 'below';
  value: number;
}

/**
 * The 8 trigger families (6 original + RareOccurrenceTrigger/
 * HandOutcomeTrigger, session 40 continued). Togglable is deliberately
 * NOT a member — DESIGN.md is explicit it's an orthogonal property, so
 * it lives on SubroutineDefinition instead.
 */
export type TriggerFamily =
  | AccumulatorTrigger
  | OccurrenceTrigger
  | EnemyStateTrigger
  | SelfStateTrigger
  | ChainedTrigger
  | AlwaysTrigger
  | RareOccurrenceTrigger
  | HandOutcomeTrigger;

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

/**
 * Encryption offense, part 1 of 3 (session 40 continued -- Encryption's
 * payload catalog had zero kinds that credit the caster's own gauge,
 * confirmed directly from resolve.ts's dispatch; "mitigation can't win
 * alone" was a deliberate structural property, but Encryption having no
 * native path to ever win outright was a real gap, not the same thing).
 * Generalizes Ghost's Return to Sender passive (resolve.ts,
 * RETURN_TO_SENDER_RATIO) from a single class-locked Mod into a real,
 * native Encryption payload kind any subroutine can use.
 *
 * Adds to the caster's own wardShield exactly like plain Ward, but also
 * arms an ongoing "counter" effect for the rest of the combat: every
 * future absorb on this side (from *any* ward source, not just this
 * cast) also credits `ratio` of the absorbed amount to this side's own
 * gauge. Armed via passiveState (resolve.ts's passiveStat/
 * setPassiveStat), not a new CombatSideState field -- wardShield is a
 * single pooled number, not tracked per-casting-subroutine, so "my ward
 * absorbing something" can only ever mean "this side's ward," the same
 * scope Return to Sender itself already uses. If more than one
 * wardCounter piece is ever active at once, the most recently fired one's
 * ratio simply overwrites the stored value -- not additive. Ratio
 * TBD/playtesting; expect it below Return to Sender's own 0.25 (that
 * ratio was tuned as one class's entire win condition, not a bonus
 * stacked on top of a normal defensive kit).
 */
export interface WardCounterPayload {
  kind: 'wardCounter';
  amount: number;
  ratio: number;
}

/**
 * Encryption offense, part 2 of 3 (session 40 continued -- see
 * WardCounterPayload's own header for the shared context). Same shape as
 * HotPayload, but each tick also credits `ratio` of that tick's own
 * amount to the caster's own gauge, on top of the full amount still
 * reducing the opponent's -- both effects happen every tick, not a split
 * of one pool. Implemented via a new optional ActiveTick.selfCreditRatio
 * field (resolve.ts) rather than a third tick list alongside dots/hots --
 * keeps every existing dots/hots-enumerating function (tickGlobalPulse,
 * tickCastersTurnPulse, tickExpiryExtendOnce, etc.) untouched. Ratio
 * TBD/playtesting, same reasoning as WardCounterPayload.
 */
export interface DrainingHotPayload {
  kind: 'drainingHot';
  amountPerTick: number;
  cadence: TickCadence;
  duration: number;
  /** See DotPayload.pointsPerTick -- same meaning, only for 'globalPulse'. */
  pointsPerTick?: number;
  ratio: number;
}

/**
 * Encryption offense, part 3 of 3 (session 40 continued -- see
 * WardCounterPayload's own header for the shared context). "Ward Bash" --
 * cashes in a fraction of the caster's *current* wardShield for an
 * instant credit to their own gauge, reducing wardShield by the same
 * spent amount. Structurally simpler than the other two: reads/writes
 * wardShield and winGauge directly, no new persistent state at all --
 * unlike WardCounterPayload, this doesn't need attribution to "whose"
 * ward it is, since it's spending the pooled value at cast time, not
 * reacting to a future absorb event.
 *
 * `fraction` (0-1) is expected to vary by rarity tier rather than needing
 * a separate "consume everything" flag: a low fraction (common/uncommon)
 * spends a modest slice and leaves meaningful shield behind; a high
 * fraction (rare, up to and including 1.0) naturally consumes nearly or
 * exactly the whole shield as the cost of the bigger payout -- the
 * "large percentage -> ward consumed" behavior falls out of the same
 * field, not a second mechanic. A fraction of 0 (or an empty shield) is
 * a natural, harmless no-op, same as every other zero-amount payload.
 * Conversion is 1:1 (amount spent == amount credited) for this first
 * draft -- fraction itself is the only tuning knob, not a separate
 * multiplier on top of it.
 */
export interface WardBashPayload {
  kind: 'wardBash';
  fraction: number;
}

// --- Root (4) ---

/**
 * Root offense (session 40 continued -- confirmed from resolvePayloadCore's
 * dispatch, same as Encryption before this session's WardCounterPayload/
 * DrainingHotPayload/WardBashPayload: Root has zero payload kinds that
 * credit the caster's own gauge). Two shapes were weighed: extending
 * InstantManipulationPayload with a new 'ownWinGauge' target (rejected --
 * mechanically indistinguishable from directBurst wearing Root's flavor
 * text, no new tension) vs. this: "Session Hijack," a genuine two-sided
 * transfer, steals progress directly out of the opponent's own win-gauge
 * and credits it to the caster's -- composes for free from two
 * already-existing primitives (reduceWinGauge + creditWinGauge), but is
 * mechanically new to the catalog regardless (nothing else does a
 * coupled dual-side transfer). More distinctly Root's own identity than
 * a relabeled burst: not "I hit you" (Exploit) or "I drain/absorb you"
 * (Encryption), but "I redirect your own intrusion progress into my
 * session" -- session hijacking is a real hacking term (intercepting and
 * taking over an active connection), a direct thematic fit.
 *
 * The credited amount is capped at what the opponent actually had banked
 * (see resolve.ts's own case) -- crediting the full requested `amount`
 * regardless of the opponent's actual progress would make this strictly
 * better against a near-empty gauge than a full one, backwards from "you
 * can only steal what's there." 1:1 transfer for this first draft (no
 * separate efficiency ratio); doesn't feed mitigationBanked -- offense,
 * not defensive effort, same reasoning WardBashPayload was excluded.
 */
export interface SessionHijackPayload {
  kind: 'sessionHijack';
  amount: number;
}

export interface InstantManipulationPayload {
  kind: 'instantManipulation';
  /** 'enemyGaugeThreshold' (session 21+) permanently raises the enemy's
   * gauge threshold, no duration — the persistent counterpart to
   * Malware's temporary 'choked' debuff. 'ownGauge'/'ownGaugeThreshold'
   * (session 24, Root mechanical redesign) are haste, completing the
   * slow/haste pair the enemy-facing targets already gave Root --
   * see resolve.ts's instantManipulation case for the mechanics. */
  target: 'enemyGauge' | 'suitTally' | 'subroutineProgress' | 'enemyGaugeThreshold' | 'ownGauge' | 'ownGaugeThreshold';
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
 *   target. Session 24 added a real specific-card version instead --
 *   see ForceDiscardCardPayload, a `firesAt: 'onDealt'` payload that
 *   resolves in the *same* hand rather than deferring to the next one.
 * - **peekCrib**: reveals the crib's contents. Still a genuine no-op as
 *   specified here (see resolve.ts's consumePendingCribbageManipulation)
 *   -- by the time this deferred-to-next-hand action applies, the crib
 *   it would reveal has already been fully scored. Session 24 added the
 *   real, working version instead: RevealCribPayload, a
 *   `firesAt: 'onCribSelected'` payload that resolves in the same hand,
 *   before that crib is scored.
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
  | WardCounterPayload
  | DrainingHotPayload
  | WardBashPayload
  | SessionHijackPayload
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
  /** Caps how many times this subroutine can ever fire in one combat,
   * regardless of how many more times its trigger condition would
   * otherwise re-arm it (session 39). Undefined means unlimited, the
   * default and pre-existing behavior for every subroutine. Currently
   * only enforced for the reactive selfState/enemyState re-arm path
   * (see resolve.ts's refreshTriggerReadiness) -- a Reactive piece whose
   * level condition keeps re-triggering (e.g. an opponent's gauge
   * repeatedly crossing back above a threshold) would otherwise fire
   * every single time, unbounded. Not yet checked for
   * accumulator/occurrence trigger re-arming; extend there too if a
   * future piece needs the same cap on a non-reactive trigger. */
  maxFiresPerCombat?: number;
  /** How much this payload's own magnitude shrinks per prior fire this
   * combat (session 39) -- a self-limiting alternative to
   * `maxFiresPerCombat` for a payload that should keep firing but hit
   * diminishing returns rather than a hard wall. Requires
   * `magnitudeFloor` alongside it (the minimum it decays down to, never
   * below). Undefined means no decay, the default. See merge.ts's
   * decayedPayloadMagnitude for the actual formula and resolve.ts's
   * payloadForFire for where it's applied (every real fire-dispatch
   * path: fireReadySubroutines, fireNewlyReadyReactiveSubroutines,
   * fireHandLifecycleSubroutines). */
  magnitudeDecayPerFire?: number;
  /** The floor `magnitudeDecayPerFire` decays down to and never below.
   * Ignored (and meaningless) without `magnitudeDecayPerFire` set. */
  magnitudeFloor?: number;
}

/** The three real Cribbage lifecycle moments a `firesAt` subroutine can
 * hook -- see SubroutineDefinition.firesAt and resolve.ts's
 * fireHandLifecycleSubroutines. 'onDealt': right after this hand's
 * cards are dealt, before either side discards. 'onCribSelected':
 * after both sides have discarded (the crib now exists), before the
 * cut. 'onPlayPhaseStart': after the cut, before the first peg play. */
export type HandLifecycleMoment = 'onDealt' | 'onCribSelected' | 'onPlayPhaseStart';
