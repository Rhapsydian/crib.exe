import type { PlayerIndex } from './pegging';
import type { Card } from './cards';
import type { Archetype, BetaEffect, Effect, SubroutineDefinition, TempoEffect } from './subroutine-types';
import { ARCHETYPE_SUITS } from './subroutine-types';
import type { ClassId } from './classes';
import { CLASS_DEFINITIONS } from './classes';
import {
  ADAPTATION_EVERY,
  ADAPTATION_STEP,
  STATEFUL_INSPECTION_THRESHOLD,
  STATEFUL_INSPECTION_KEEP,
  RATE_LIMIT_THRESHOLD,
  SPOTLIGHT_HEAT,
  ZERO_SUM_SHARE,
  ZERO_SUM_THRESHOLD,
  ROLLBACK_AT,
  ROLLBACK_TO,
  POWER_SIPHON_GROWTH,
  ESCALATION_STEP,
  ESCALATION_MAX,
  INTERFERENCE_LOSS,
  HARD_LIMIT_WARD,
  LOCKOUT_EVERY,
  PURGE_COUNTS,
  COLLECTION_KEEP,
  HARDENED_COUNTS,
  BEHAVIOR_ANALYSIS_WARD,
  REFLECTION_SHARE,
  COUNTER_TRACE_HEAT,
  type GatekeeperModId,
} from './gatekeeper-mods';
import type { EnemyPassiveId } from './enemies';
import type { ModId } from './mod-types';
import {
  reactiveModSubroutines,
  AMPLIFIER_BONUS,
  CACHE_PREFETCH_CHARGES,
  FIRMWARE_PATCH_BONUS,
  MOD_SMALL,
  MOD_MEDIUM,
  THRESHOLD_EXPLOIT_REDUCTION,
  NOBS_EXPLOIT_CREDIT,
  RUN_SPLICER_PAIRS,
  DEEP_CACHE_START_CHARGES,
  LAST_WORD_INITIATIVE,
  LUCKY_CUT_CREDIT,
  WARD_CONVERTER_SHARE,
  HOT_STANDBY_SHARE,
  DEEP_CACHE_CAP_MULTIPLIER,
  ROOT_CAUSE_COUNTS,
  PERSISTENT_PAYLOAD_MULTIPLIER,
  FIFTEEN_FOLD_RULE,
  PAIR_FOLD_RULE,
  GLASS_CANNON_CREDIT,
  GLASS_CANNON_ENEMY_START,
  OVERCLOCKED_KERNEL_TURNS,
} from './mods';
import type { BurnerId, CombatBurnerEffect } from './burner-types';
import {
  addCharges,
  removeCharges,
  betaCharges,
  betaScale,
  chargeFromAbsorbed,
  chargeFromOccurrence,
  chargeFromSuitPlayed,
  createInitialState,
  evaluateStateCondition,
  immediateBetaReady,
  recordFire,
  spendCharges,
  withinFiringGates,
  occurrenceCount,
  occurrencePoints,
  type FiredThisTurn,
  type ScoringOccurrence,
  type ScoringRule,
  type SubroutineRuntimeState,
  type SuitPlayed,
  type TriggerContext,
} from './triggers';
import { createInitiativeGauge, createDuelGauge, addDuelProgress, reduceDuelProgress, shrinkDuelThreshold, type InitiativeGauge, type DuelGauge } from './gauges';
import { bestCardToForce } from './ai';

/**
 * Combat resolution for the alpha/beta model (session 51; DESIGN.md
 * "Archetypes & Subroutines", docs/archive/archetype-redesign.md A1-A11).
 *
 * When a side gets a turn, every installed piece fires its **alpha** --
 * top to bottom, like a script -- and each whose criteria are met also
 * applies its **beta** (session 50's D11). A beta with the `immediate`
 * shape instead fires on its own, the moment its criteria are met,
 * outside anyone's turn (fireImmediateBetas).
 *
 * Effects are the seven verbs. Each side races its own win gauge
 * (Breach for the player, Containment for the enemy): only a side's own
 * Credit advances it; the opponent's Suppress pushes it back and the
 * opponent's Ward absorbs credit before it lands. "Mitigation can't win
 * alone" stays a free structural property.
 *
 * What this replaced -- 22 payload kinds, DoT/HoT tick lists and their
 * two cadences, three debuffs, scheduled sabotage, four separate firing
 * paths (turn, reactive, hand-lifecycle, rare-occurrence/hand-outcome),
 * the six old class passives and the 34 enemy passives -- is described in
 * docs/archive/design-history.md. The enemy-passive registry is not rebuilt here:
 * the skeleton roster carries no passives, and the real roster's hooks
 * are written when it is (EnemyPassiveId is empty until then).
 */

export interface LoadoutEntry {
  definition: SubroutineDefinition;
  state: SubroutineRuntimeState;
  /** A temporary subroutine a Burner installed (session 64, BE3): the
   * turns it has left to fire, and the Burner it came from. */
  temp?: { firesLeft: number; burnerId: BurnerId };
}

/** A temporary initiative-threshold change (Tempo `threshold` with a
 * `duration` -- the old `choked`). Stores the *actually applied* delta,
 * after flooring, so reverting it restores exactly what was changed
 * rather than drifting when something else touched the same threshold
 * in between (session 28's real hang was precisely that drift). */
export interface TimedTempo {
  thresholdDelta: number;
  remainingTurns: number;
}

/** A Disrupt effect armed for the next hand (see DisruptEffect). */
export type PendingDisrupt = 'revealHand' | 'revealCrib' | 'forceDiscard';

export interface CombatSideState {
  gauge: InitiativeGauge;
  /** This side's initiative threshold at the start of combat (session 48)
   * -- threshold changes and the reduction floor resolve against this
   * fixed snapshot, never the live threshold, or repeated changes would
   * compound. Never mutated. */
  startingThreshold: number;
  /** This side's own progress toward its own win (gauges.ts's DuelGauge).
   * Only its own Credit advances it; only the opponent's Suppress or a
   * steal reduces it. */
  winGauge: DuelGauge;
  /** Win threshold at the start of combat (session 48) -- escalation
   * derives its shrink and floor from it. Never mutated. */
  startingWinThreshold: number;
  /** Heat raised against this side during this fight by the opponent's
   * alarms (`heatPressure`, Spotlight), surfaced as
   * CombatResult.heatGenerated and added to run Heat. The enemy side's
   * value is never read -- Heat is player-only. */
  heat: number;
  loadout: LoadoutEntry[];
  /** Accumulating shield from Ward: absorbs the opponent's incoming
   * non-piercing Credit until depleted. */
  wardShield: number;
  /** Points scored so far this hand (pegging and show), reset at each
   * deal -- for `handPointsAtLeast` state betas. */
  handPoints: number;
  /** This side's fifteens and pairs repriced (the Folds,
   * docs/mods-design.md M7); Cribbage's own 2 when absent. */
  scoringRule?: ScoringRule;
  /** Temporary threshold changes on this side's initiative gauge. */
  timedTempo: TimedTempo[];
  /** Disrupt effects this side has armed for the next hand. */
  pendingDisrupt: PendingDisrupt[];
  /** Recon intel, valid for the current hand only -- cleared at the start
   * of every hand (clearHandKnowledge). */
  knownOpponentHand?: Card[];
  knownCrib?: Card[];
  /** A forced discard pair for this hand, set on the *target* of a
   * forceDiscard, consumed by combat.ts when building that side's
   * discard. Hand-scoped like the recon fields above. */
  forcedDiscardPair?: [Card, Card];
  /** Generic per-side scratch bookkeeping for passives and Mods -- one-shot
   * flags and counters keyed by convention as `${id}:${field}`. */
  passiveState: Record<string, number>;
  /** Hand-long Burner bonuses (session 64): for the rest of this hand,
   * each of this side's fifteens / pairs also does `effect`. Cleared at
   * every deal. */
  handBonuses?: { category: 'fifteen' | 'pair'; effect: Effect; handsLeft: number }[];
}

export interface CombatState {
  sides: [CombatSideState, CombatSideState];
  /** The player's class, if any (always side 0). Its class-exclusive Mod
   * is folded into ownedModIds by createCombatState. */
  classId?: ClassId;
  /** Each side's class bridge passive (step 3, C1), by class. Side 0's is
   * its class's; side 1 has none in real play -- the slot exists so a
   * pricing duel can give a bridge to the test side in either seat. */
  bridges: [ClassId | undefined, ClassId | undefined];
  /** Each side's gatekeeper Mods (step 3, E4; gatekeeper-mods.ts). Side
   * 1's are a gatekeeper's own; side 0's exist only for pricing duels. */
  sideMods: [GatekeeperModId[], GatekeeperModId[]];
  /** Passives side 1 (the enemy) carries. Empty for the skeleton roster. */
  enemyPassiveIds: EnemyPassiveId[];
  /** Mods side 0 (the player) owns, including the class's own. */
  ownedModIds: ModId[];
  /** Combat-context Burners side 0 carried in -- a start-of-combat
   * snapshot; used ones are surfaced via CombatResult, not removed here. */
  carriedBurnerIds: BurnerId[];
  /** Each side's class Mod is its "II" version (session 65,
   * docs/mods-design.md M10). Side 1's exists only for pricing duels. */
  bridgeUpgraded?: [boolean, boolean];
  /** Side 0's benched subroutines, for Hot Standby (session 65): their
   * Processes fire after the loadout at half strength. */
  standby?: SubroutineDefinition[];
  /** A side record, not state (milestone 2, the user's ask): every Mod
   * that actually does something appends here, so the UI can flash it.
   * One mutable list shared by every copy of the state in a fight (the
   * spreads carry the reference); combat.ts creates it and drains it --
   * fires take their own (`FireEvent.mods`), the rest become timeline
   * beats. Absent outside a fight, where noting is a no-op. */
  modTriggers?: ModTrigger[];
}

/** A Mod, either kind: a player/class Mod (mods.ts, bridges included as
 * `bridge-<class>`) or a gatekeeper's (gatekeeper-mods.ts). */
export type ModRef = { kind: 'mod'; id: ModId } | { kind: 'gatekeeper'; id: GatekeeperModId };

/** A Mod owned by `side` acting. */
export interface ModTrigger {
  side: PlayerIndex;
  mod: ModRef;
}

function noteMod(combatState: CombatState, side: PlayerIndex, mod: ModRef): void {
  combatState.modTriggers?.push({ side, mod });
}
const gk = (id: GatekeeperModId): ModRef => ({ kind: 'gatekeeper', id });
const ownMod = (id: ModId): ModRef => ({ kind: 'mod', id });
/** A class bridge, as the Mod that carries it. */
const bridgeMod = (classId: ClassId): ModRef => ({ kind: 'mod', id: `bridge-${classId}` as ModId });

export function createCombatSideState(definitions: SubroutineDefinition[], gaugeThreshold: number, winThreshold: number): CombatSideState {
  return {
    gauge: createInitiativeGauge(gaugeThreshold),
    startingThreshold: gaugeThreshold,
    winGauge: createDuelGauge(winThreshold),
    startingWinThreshold: winThreshold,
    heat: 0,
    loadout: definitions.map((definition) => ({ definition, state: createInitialState() })),
    wardShield: 0,
    handPoints: 0,
    timedTempo: [],
    pendingDisrupt: [],
    knownOpponentHand: undefined,
    knownCrib: undefined,
    forcedDiscardPair: undefined,
    passiveState: {},
  };
}

export function createCombatState(
  playerLoadout: SubroutineDefinition[],
  enemyLoadout: SubroutineDefinition[],
  gaugeThreshold: [number, number],
  classId?: ClassId,
  winThreshold: [number, number] = [100, 100],
  enemyPassiveIds: EnemyPassiveId[] = [],
  ownedModIds: ModId[] = [],
  carriedBurnerIds: BurnerId[] = [],
  opponentBridge?: ClassId,
  sideMods: [GatekeeperModId[], GatekeeperModId[]] = [[], []],
): CombatState {
  // The class's own exclusive Mod is always active whenever classId is
  // set -- folded in here rather than required from every caller.
  const classModId = classId ? CLASS_DEFINITIONS[classId].startingPassiveId : undefined;
  const effectiveModIds = classModId && !ownedModIds.includes(classModId) ? [...ownedModIds, classModId] : ownedModIds;
  // Reactive-subroutine Mods (session 30's "fires outside the loadout"
  // bucket) are appended to side 0's loadout: no slot, no cap, otherwise
  // ordinary entries that fire on the player's turns.
  const modded = modAdjustedLoadout([...playerLoadout, ...reactiveModSubroutines(effectiveModIds)], effectiveModIds);
  // Hardened (session 68, E11): the player's waiting Hooks need one more count.
  const playerLoadoutWithMods = sideMods[1].includes('hardened') ? hardenedLoadout(modded) : modded;
  return {
    sides: [
      createCombatSideState(playerLoadoutWithMods, gaugeThreshold[0], winThreshold[0]),
      createCombatSideState(enemyLoadout, gaugeThreshold[1], winThreshold[1]),
    ],
    classId,
    bridges: [classId, opponentBridge],
    sideMods,
    enemyPassiveIds,
    ownedModIds: effectiveModIds,
    carriedBurnerIds,
  };
}

/** Hardened (E11): a Hook that waits for counts needs HARDENED_COUNTS
 * more (graded Hooks lose that many from their count when they fire). */
function hardenedLoadout(loadout: SubroutineDefinition[]): SubroutineDefinition[] {
  return loadout.map((piece) => {
    const beta = piece.beta;
    if (!beta || (beta.source !== 'cards' && beta.source !== 'progress')) return piece;
    if (beta.shape === 'stepped') return { ...piece, beta: { ...beta, at: beta.at + HARDENED_COUNTS } };
    if (beta.shape === 'immediate') return { ...piece, beta: { ...beta, at: (beta.at ?? 1) + HARDENED_COUNTS } };
    return piece;
  });
}

/** Clears both sides' hand-scoped intel and forced discards -- called once
 * per hand, before that hand's deal, so nothing stale carries over. */
export function clearHandKnowledge(combatState: CombatState): CombatState {
  return rewriteLoadouts(purgeHooks(clearHandKnowledgeOnly(combatState)));
}

/** Rewrite (session 68, E11): at the start of each hand, the opponent's
 * top and bottom installed subroutines swap. */
function rewriteLoadouts(combatState: CombatState): CombatState {
  let state = combatState;
  for (const side of [0, 1] as PlayerIndex[]) {
    if (!hasSideMod(state, side, 'rewrite')) continue;
    const victim = opponentOf(side);
    const bottom = bottomInstalledIndex(state, victim);
    if (bottom <= 0) continue;
    noteMod(state, side, gk('rewrite'));
    const loadout = [...state.sides[victim].loadout];
    [loadout[0], loadout[bottom]] = [loadout[bottom], loadout[0]];
    state = withSide(state, victim, { loadout });
  }
  return state;
}

/** Purge (session 67, E4): at the start of each hand, each of the
 * opponent's Hooks loses counts. */
function purgeHooks(combatState: CombatState): CombatState {
  let state = combatState;
  for (const side of [0, 1] as PlayerIndex[]) {
    if (!hasSideMod(state, side, 'purge')) continue;
    const victim = opponentOf(side);
    if (!state.sides[victim].loadout.some((e) => e.state.charges > 0)) continue;
    noteMod(state, side, gk('purge'));
    state = mapLoadout(state, victim, (e) => removeCharges(e.state, PURGE_COUNTS));
  }
  return state;
}

function clearHandKnowledgeOnly(combatState: CombatState): CombatState {
  const sides = combatState.sides.map((sideState, side): CombatSideState => {
    const hands = (sideState.passiveState[HANDS_SEEN] ?? 0) + 1;
    // Adaptation: every few hands, the owner's growth caps rise.
    const adapting = combatState.sideMods[side].includes('adaptation') && hands % ADAPTATION_EVERY === 0;
    if (adapting) noteMod(combatState, side as PlayerIndex, gk('adaptation'));
    const loadout = adapting
      ? sideState.loadout.map((entry) => {
          const { growth, growthCap } = entry.definition.alpha;
          if (growth === undefined) return entry;
          return { ...entry, definition: { ...entry.definition, alpha: { ...entry.definition.alpha, growthCap: (growthCap ?? 0) + ADAPTATION_STEP } } };
        })
      : sideState.loadout;
    return {
      ...sideState,
      loadout,
      knownOpponentHand: undefined,
      knownCrib: undefined,
      forcedDiscardPair: undefined,
      // A hand-long Burner bonus counts down a hand (Noise Floor lasts two).
      handBonuses: sideState.handBonuses?.map((b) => ({ ...b, handsLeft: b.handsLeft - 1 })).filter((b) => b.handsLeft > 0),
      handPoints: 0,
      passiveState: { ...sideState.passiveState, [HANDS_SEEN]: hands, [RECEPTION_SPENT]: 0, [ROOT_ACCESS_SPENT]: 0, [DAEMON_OVERCLOCK_THIS_HAND]: 0, [EXPLOIT_DAEMON_THIS_HAND]: 0, [LATERAL_PAIRS_THIS_HAND]: 0, [BURNER_HOOKS_TWICE]: Math.max(0, (sideState.passiveState[BURNER_HOOKS_TWICE] ?? 0) - 1) },
    };
  }) as [CombatSideState, CombatSideState];
  return { ...combatState, sides };
}

function opponentOf(side: PlayerIndex): PlayerIndex {
  return (1 - side) as PlayerIndex;
}

function replaceSide(sides: [CombatSideState, CombatSideState], side: PlayerIndex, newState: CombatSideState): [CombatSideState, CombatSideState] {
  const copy = sides.slice() as [CombatSideState, CombatSideState];
  copy[side] = newState;
  return copy;
}

function withSide(combatState: CombatState, side: PlayerIndex, patch: Partial<CombatSideState>): CombatState {
  return { ...combatState, sides: replaceSide(combatState.sides, side, { ...combatState.sides[side], ...patch }) };
}

/** Credits `side`'s own win gauge -- the one way a gauge ever advances. */
/** Whether `side` carries gatekeeper Mod `id` (gatekeeper-mods.ts). */
export function hasSideMod(combatState: CombatState, side: PlayerIndex, id: GatekeeperModId): boolean {
  return combatState.sideMods[side].includes(id);
}

// Per-side scratch keys for the gatekeeper Mods' turn/hand bookkeeping.
const GAINED_THIS_TURN = 'gk:gained';
const NULL_SESSION_SPENT = 'gk:null-spent';
const RECEPTION_SPENT = 'gk:reception-spent';
// Burners' turn flags (session 64): set by the Burner, spent by the turn.
const BURNER_FIRE_TWICE = 'burner:fireTwice';
const BURNER_HOOKS_TWICE = 'burner:hooksTwice';
const BURNER_SKIP_TURN = 'burner:skipTurn';
const ROOT_ACCESS_SPENT = 'gk:root-spent';
const HANDS_SEEN = 'gk:hands';

export function creditWinGauge(combatState: CombatState, side: PlayerIndex, creditAmount: number): CombatState {
  if (creditAmount <= 0) return combatState;
  let state = combatState;
  // Glass Cannon (session 65): each Credit the player scores is higher.
  const glass = side === 0 && hasMod(state, 'glass-cannon');
  if (glass) noteMod(state, 0, ownMod('glass-cannon'));
  let amount = glass ? creditAmount + GLASS_CANNON_CREDIT : creditAmount;
  const opponent = opponentOf(side);
  const scratch = state.sides[side].passiveState;
  // Null Session: the first Credit `side` would gain each turn is discarded.
  if (hasSideMod(state, opponent, 'null-session') && !scratch[NULL_SESSION_SPENT]) {
    noteMod(state, opponent, gk('null-session'));
    return withSide(state, side, { passiveState: { ...scratch, [NULL_SESSION_SPENT]: 1 } });
  }
  const gained = scratch[GAINED_THIS_TURN] ?? 0;
  // Stateful Inspection (session 68, E14): Credit `side` gains past the
  // threshold in a turn is halved. Rate Limit is the same rule, looser
  // (the tutorial's).
  for (const [id, threshold] of [['stateful-inspection', STATEFUL_INSPECTION_THRESHOLD], ['rate-limit', RATE_LIMIT_THRESHOLD]] as const) {
    if (!hasSideMod(state, opponent, id)) continue;
    const over = Math.max(0, gained + amount - threshold) - Math.max(0, gained - threshold);
    if (over <= 0) continue;
    noteMod(state, opponent, gk(id));
    amount -= over * (1 - STATEFUL_INSPECTION_KEEP);
  }
  if (amount <= 0) return state;
  // Zero-Sum: Credit past the threshold in a turn feeds the opponent.
  if (hasSideMod(state, opponent, 'zero-sum')) {
    const excess = Math.max(0, gained + amount - ZERO_SUM_THRESHOLD) - Math.max(0, gained - ZERO_SUM_THRESHOLD);
    if (excess > 0) noteMod(state, opponent, gk('zero-sum'));
    if (excess > 0) state = withSide(state, opponent, { winGauge: addDuelProgress(state.sides[opponent].winGauge, excess * ZERO_SUM_SHARE).gauge });
  }
  let { gauge } = addDuelProgress(state.sides[side].winGauge, amount);
  // Rollback (EM2): the first time `side`'s gauge passes the mark (short of
  // a win -- a gain that goes straight to full beats it), it drops back.
  if (hasSideMod(state, opponent, 'rollback') && !state.sides[opponent].passiveState[ROLLBACK_SPENT]) {
    if (gauge.progress >= gauge.threshold * ROLLBACK_AT && gauge.progress < gauge.threshold) {
      noteMod(state, opponent, gk('rollback'));
      gauge = { ...gauge, progress: gauge.threshold * ROLLBACK_TO };
      state = withSide(state, opponent, { passiveState: { ...state.sides[opponent].passiveState, [ROLLBACK_SPENT]: 1 } });
    }
  }
  return withSide(state, side, { winGauge: gauge, passiveState: { ...state.sides[side].passiveState, [GAINED_THIS_TURN]: gained + amount } });
}

const ROLLBACK_SPENT = 'rollback:spent';
const ESCALATION_STEPS = 'escalation:steps';

/** Grows each of `side`'s growing subroutines by `fires` fires' worth of
 * its own growth, still up to its cap -- Eidolon's class Mod and Power
 * Siphon. */
function growDaemons(combatState: CombatState, side: PlayerIndex, fires: number, archetype?: Archetype): CombatState {
  return mapLoadout(combatState, side, (entry) => {
    const { growth, growthCap } = entry.definition.alpha;
    if (growth === undefined || (archetype && entry.definition.archetype !== archetype)) return entry.state;
    return { ...entry.state, growthTotal: Math.min(entry.state.growthTotal + growth * fires, growthCap ?? Infinity) };
  });
}

/** Reduces `side`'s own win gauge, floored at 0. */
export function reduceWinGauge(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  if (amount <= 0) return combatState;
  return withSide(combatState, side, { winGauge: reduceDuelProgress(combatState.sides[side].winGauge, amount) });
}

/** Shrinks `side`'s own win threshold, floored at `minThreshold` -- the
 * primitive escalation and a future Mod share. Never touches progress. */
export function adjustSideWinThreshold(combatState: CombatState, side: PlayerIndex, amount: number, minThreshold: number): CombatState {
  if (amount <= 0) return combatState;
  return withSide(combatState, side, { winGauge: shrinkDuelThreshold(combatState.sides[side].winGauge, amount, minThreshold) });
}

/**
 * Floor for any reduction to a side's initiative threshold, as a fraction
 * of its own *starting* threshold (session 48). Must stay above 0:
 * gauges.ts's addPoints loops `while progress >= threshold`, so a
 * threshold of 0 hangs the engine. 1/3 caps tempo swings at 3x at any
 * starting threshold.
 */
const MIN_INITIATIVE_THRESHOLD_FRACTION = 1 / 3;

function minInitiativeThreshold(combatState: CombatState, side: PlayerIndex): number {
  return Math.max(1, Math.round(combatState.sides[side].startingThreshold * MIN_INITIATIVE_THRESHOLD_FRACTION));
}

/** A fraction of one turn, in gauge points, against `side`'s *live*
 * threshold -- the unit for Tempo `gauge` mode (session 48). */
function turnFraction(combatState: CombatState, side: PlayerIndex, fraction: number): number {
  return fraction * combatState.sides[side].gauge.threshold;
}

/** A fraction of `side`'s *starting* threshold -- the unit for Tempo
 * `threshold` mode. Starting, not live, so repeated changes add rather
 * than compound (session 48). */
function thresholdFraction(combatState: CombatState, side: PlayerIndex, fraction: number): number {
  return fraction * combatState.sides[side].startingThreshold;
}

/** Moves `side`'s initiative threshold by `delta` (positive raises it),
 * floored, and returns the delta actually applied -- what a timed change
 * must later revert. */
function shiftThreshold(combatState: CombatState, side: PlayerIndex, delta: number): { combatState: CombatState; applied: number } {
  const gauge = combatState.sides[side].gauge;
  const threshold = Math.max(minInitiativeThreshold(combatState, side), gauge.threshold + delta);
  return { combatState: withSide(combatState, side, { gauge: { ...gauge, threshold } }), applied: threshold - gauge.threshold };
}

// ---------------------------------------------------------------------
// Passive / Mod registry helpers
// ---------------------------------------------------------------------

function hasMod(combatState: CombatState, id: ModId): boolean {
  return combatState.ownedModIds.includes(id);
}

function passiveStat(combatState: CombatState, side: PlayerIndex, key: string): number {
  return combatState.sides[side].passiveState[key] ?? 0;
}

function setPassiveStat(combatState: CombatState, side: PlayerIndex, key: string, value: number): CombatState {
  const sideState = combatState.sides[side];
  return withSide(combatState, side, { passiveState: { ...sideState.passiveState, [key]: value } });
}

// ---------------------------------------------------------------------
// Mods that reshape the player's pieces for one fight (session 51 re-
// points). Applied once, to combat-local copies, in createCombatState --
// the run's own loadout is never touched, so a Mod lost or gained between
// fights takes effect on the next fight with no bookkeeping.
// ---------------------------------------------------------------------

const AMPLIFIERS: Partial<Record<ModId, Archetype>> = {
  'exploit-amplifier': 'exploit',
  'daemon-amplifier': 'daemon',
  'overclock-amplifier': 'overclock',
  'honeypot-amplifier': 'honeypot',
};

/** Verbs whose amount is gauge points -- the only ones a flat Mod bonus
 * may touch. Tempo is a fraction of a turn or threshold (session 48);
 * Charge, Empower and Disrupt are not output. */
function isPointsEffect(effect: Effect | BetaEffect): boolean {
  return effect.verb === 'credit' || effect.verb === 'suppress' || effect.verb === 'ward';
}

/**
 * - An archetype **Amplifier** adds AMPLIFIER_BONUS to that archetype's
 *   points alphas (was a flat credit per fire -- under D11 that would be a
 *   credit per piece per turn).
 * - **Firmware Patch** adds FIRMWARE_PATCH_BONUS to every beta effect in
 *   points, including an `enhance` on a points alpha (was Tagged Firmware;
 *   tags are gone).
 * - **Threshold Exploit** lowers every stepped beta's `at` by one, never
 *   below 1 (was "fewer banked occurrences to fire").
 */
function modAdjustedLoadout(loadout: SubroutineDefinition[], ownedModIds: ModId[]): SubroutineDefinition[] {
  const amplified = new Set(ownedModIds.map((id) => AMPLIFIERS[id]).filter((a): a is Archetype => a !== undefined));
  const firmware = ownedModIds.includes('firmware-patch');
  const thresholdExploit = ownedModIds.includes('threshold-exploit');
  const deepCache = ownedModIds.includes('deep-cache');
  if (amplified.size === 0 && !firmware && !thresholdExploit && !deepCache) return loadout;

  return loadout.map((piece) => {
    let next = piece;
    if (amplified.has(piece.archetype) && isPointsEffect(next.alpha) && next.alpha.verb !== 'disrupt') {
      next = { ...next, alpha: { ...next.alpha, amount: next.alpha.amount + AMPLIFIER_BONUS } };
    }
    const beta = next.beta;
    if (beta && firmware) {
      const boostable = beta.effect.verb === 'enhance' ? isPointsEffect(next.alpha) : isPointsEffect(beta.effect);
      if (boostable && beta.effect.verb !== 'disrupt') {
        next = { ...next, beta: { ...beta, effect: { ...beta.effect, amount: beta.effect.amount + FIRMWARE_PATCH_BONUS } } };
      }
    }
    if (next.beta?.shape === 'stepped' && thresholdExploit) {
      next = { ...next, beta: { ...next.beta, at: Math.max(1, next.beta.at - THRESHOLD_EXPLOIT_REDUCTION) } };
    }
    // Deep Cache (session 65): a counting Hook banks up to twice its limit.
    if (next.beta?.shape === 'graded' && deepCache) {
      next = { ...next, beta: { ...next.beta, cap: next.beta.cap * DEEP_CACHE_CAP_MULTIPLIER } };
    }
    return next;
  });
}

// ---------------------------------------------------------------------
// Class bridge passives (step 3, C1: one bespoke rule per class, each
// making one archetype feed the other). Session 60 (docs/class-mod-
// redesign.md, K1-K5): every bridge now triggers on a fifteen or a pair
// the owner scores -- three each -- since the owner's own scoring is the
// channel Cribbage skill reaches a fight through (CP6b, S11). Fifteens
// come about twice as often as pairs, so a pair bridge pays about twice
// as much. Amounts are measured against C2's +1.0 Credit/turn budget.
// ---------------------------------------------------------------------

/** Exploit + Overclock (K2): each pair you score adds this fraction of a
 * turn to your initiative gauge. */
export const BRIDGE_EXPLOIT_OVERCLOCK_HASTE = 1 / 12;
/** Exploit + Daemon: each fifteen you score also Suppresses... */
export const BRIDGE_EXPLOIT_DAEMON_SUPPRESS = 1;
/** ...and the first fifteen each hand Suppresses this much more (session
 * 62: Operator sat under the band). */
export const BRIDGE_EXPLOIT_DAEMON_FIRST = 1;
const EXPLOIT_DAEMON_THIS_HAND = 'bridge-exploit-daemon:hand';
/** Daemon + Overclock (K3): each fifteen you score grows each Daemon
 * piece by this share of one fire's growth (still up to its cap). */
export const BRIDGE_DAEMON_OVERCLOCK_GROWTH = 0.5;
/** ...and, on the first fifteen each hand, gives each Overclock piece's
 * Hook this many extra counts. */
export const BRIDGE_DAEMON_OVERCLOCK_COUNTS = 1;
const DAEMON_OVERCLOCK_THIS_HAND = 'bridge-daemon-overclock:hand';
/** Exploit + Honeypot: each pair you score banks Ward. */
export const BRIDGE_EXPLOIT_HONEYPOT_WARD = 1.5;
/** Daemon + Honeypot (K4): each pair you score Suppresses this much and
 * banks this much Ward. */
export const BRIDGE_DAEMON_HONEYPOT_SUPPRESS = 1;
export const BRIDGE_DAEMON_HONEYPOT_WARD = 1.5;
/** Overclock + Honeypot (K5): the first fifteen(s) you score each hand
 * you deal bank this much Ward and add this fraction of a turn to your initiative
 * gauge (1/12: one point at the usual threshold of 12). Limited per hand
 * rather than shrunk to tiny amounts, the user's call: small fractions
 * read badly. */
// The "II" clauses (session 65, docs/mods-design.md M10). TBD/measured.
/** Lateral Movement II: the pair each hand that gives a turn at once (was
 * a pair royal: measured +0.7 victory). */
export const BRIDGE_II_BLACKHAT_PAIRS = 2;
/** Hardened Perimeter II: Ward for each pair the opponent scores. */
export const BRIDGE_II_WARDEN_WARD = 1;
/** Invocation II: fires' worth of growth the Daemons start each fight with. */
export const BRIDGE_II_EIDOLON_FIRES = 3;
/** Invocation II: fires' worth the Daemons' growth caps rise by (the
 * user's addition: the head start alone ran into the caps, +4.7). */
export const BRIDGE_II_EIDOLON_CAP_FIRES = 3;
/** Foothold II: the share of blocked Credit that Credits back. */
export const BRIDGE_II_BREACHER_SHARE = 1 / 3;
/** Phase Shift II: initiative when Ward fully blocks a hit. */
export const BRIDGE_II_WRAITH_INITIATIVE = 1;

/** Phase Shift (session 68, docs/enemies-design.md E17; was "the first
 * fifteen each hand you deal: Ward 0.5 and 1 initiative", the weakest
 * class Mod by far): each fifteen its owner scores Wards this much, and
 * while the owner's Ward is over BRIDGE_OVERCLOCK_HONEYPOT_ABOVE it also
 * Credits BRIDGE_OVERCLOCK_HONEYPOT_CREDIT. TBD/measured. */
export const BRIDGE_OVERCLOCK_HONEYPOT_WARD = 1;
export const BRIDGE_OVERCLOCK_HONEYPOT_ABOVE = 4;
export const BRIDGE_OVERCLOCK_HONEYPOT_CREDIT = 1;

const bankWard = (combatState: CombatState, side: PlayerIndex, amount: number) => addWard(combatState, side, amount);

/** Adds Ward to `side`, held under the opponent's Hard Limit (session 67,
 * E4) when it has one. */
function addWard(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  const next = combatState.sides[side].wardShield + amount;
  if (!hasSideMod(combatState, opponentOf(side), 'hard-limit') || next <= HARD_LIMIT_WARD) return withSide(combatState, side, { wardShield: next });
  noteMod(combatState, opponentOf(side), gk('hard-limit'));
  return withSide(combatState, side, { wardShield: Math.max(combatState.sides[side].wardShield, HARD_LIMIT_WARD) });
}
const haste = (combatState: CombatState, side: PlayerIndex, fraction: number) =>
  resolveTempo({ verb: 'tempo', target: 'own', mode: 'gauge', amount: fraction }, combatState, side);

/** A scoring occurrence: every bridge is keyed on the owner's own
 * fifteens or pairs. `_dealer`, this hand's dealer, is unused since Phase
 * Shift stopped caring who deals (session 68). */
function applyBridgeOnOccurrence(combatState: CombatState, occurrence: ScoringOccurrence, _dealer: PlayerIndex | undefined): CombatState {
  const side = occurrence.player;
  const bridge = combatState.bridges[side];
  if (!bridge) return combatState;
  const fifteen = occurrence.category === 'fifteen';
  const pair = occurrence.category === 'pair';
  // Backdoor Maintenance II (M10): go points count as fifteens for it.
  const goPoint = occurrence.category === 'go' || occurrence.category === 'thirtyOne';
  if (bridge === 'exploit-daemon' && (fifteen || (goPoint && isBridgeUpgraded(combatState, side)))) {
    noteMod(combatState, side, bridgeMod(bridge));
    const first = !combatState.sides[side].passiveState[EXPLOIT_DAEMON_THIS_HAND];
    const marked = first ? withSide(combatState, side, { passiveState: { ...combatState.sides[side].passiveState, [EXPLOIT_DAEMON_THIS_HAND]: 1 } }) : combatState;
    return reduceWinGauge(marked, opponentOf(side), BRIDGE_EXPLOIT_DAEMON_SUPPRESS + (first ? BRIDGE_EXPLOIT_DAEMON_FIRST : 0));
  }
  if (bridge === 'exploit-honeypot' && pair) {
    noteMod(combatState, side, bridgeMod(bridge));
    return bankWard(combatState, side, BRIDGE_EXPLOIT_HONEYPOT_WARD);
  }
  if (bridge === 'exploit-overclock' && pair) {
    noteMod(combatState, side, bridgeMod(bridge));
    return haste(combatState, side, BRIDGE_EXPLOIT_OVERCLOCK_HASTE);
  }
  if (bridge === 'daemon-overclock' && fifteen) {
    noteMod(combatState, side, bridgeMod(bridge));
    // Both halves (session 62, the user's call): Daemons grow on every
    // fifteen, and on the first fifteen each hand every Overclock
    // subroutine's Hook gets one extra count -- so the Mod pays whether
    // Eidolon builds Daemons or an Overclock chain. (On every fifteen, the
    // counts took Eidolon from 12% to 33%: a limit, not a fraction.)
    let state = growDaemons(combatState, side, BRIDGE_DAEMON_OVERCLOCK_GROWTH, 'daemon');
    if (state.sides[side].passiveState[DAEMON_OVERCLOCK_THIS_HAND]) return state;
    state = withSide(state, side, { passiveState: { ...state.sides[side].passiveState, [DAEMON_OVERCLOCK_THIS_HAND]: 1 } });
    return mapLoadout(state, side, (entry) =>
      entry.definition.archetype === 'overclock' ? addCharges(entry.state, entry.definition, BRIDGE_DAEMON_OVERCLOCK_COUNTS) : entry.state,
    );
  }
  if (bridge === 'daemon-honeypot' && pair) {
    noteMod(combatState, side, bridgeMod(bridge));
    return bankWard(reduceWinGauge(combatState, opponentOf(side), BRIDGE_DAEMON_HONEYPOT_SUPPRESS), side, BRIDGE_DAEMON_HONEYPOT_WARD);
  }
  // Phase Shift (E17): each fifteen Wards; over a Ward of 4, it also Credits.
  if (bridge === 'overclock-honeypot' && fifteen) {
    noteMod(combatState, side, bridgeMod(bridge));
    const ward = combatState.sides[side].wardShield;
    const warded = bankWard(combatState, side, BRIDGE_OVERCLOCK_HONEYPOT_WARD);
    return ward > BRIDGE_OVERCLOCK_HONEYPOT_ABOVE ? creditWinGauge(warded, side, BRIDGE_OVERCLOCK_HONEYPOT_CREDIT) : warded;
  }
  return combatState;
}

/** The start of one of `side`'s turns. */
function applyBridgeOnTurnStart(combatState: CombatState, side: PlayerIndex): CombatState {
  // Gatekeeper Mods' per-turn counters (No Way In, Zero-Sum, Null
  // Session) restart with each of this side's turns.
  let state = withSide(combatState, side, { passiveState: { ...combatState.sides[side].passiveState, [GAINED_THIS_TURN]: 0, [NULL_SESSION_SPENT]: 0 } });
  // Escalation (EM4): each of the owner's turns lowers its own initiative
  // threshold a step, up to the cap (a share of the starting threshold).
  const steps = state.sides[side].passiveState[ESCALATION_STEPS] ?? 0;
  if (hasSideMod(state, side, 'escalation') && (steps + 1) * ESCALATION_STEP <= ESCALATION_MAX + 1e-9) {
    noteMod(state, side, gk('escalation'));
    state = resolveTempo({ verb: 'tempo', target: 'own', mode: 'threshold', amount: ESCALATION_STEP }, state, side);
    state = withSide(state, side, { passiveState: { ...state.sides[side].passiveState, [ESCALATION_STEPS]: steps + 1 } });
  }
  return state;
}

// Model-independent Mod hooks carried over from Phase 5.

const MOD_GAUGE_CROSS_FRACTION = 0.5;

/** Warm Boot (start with a small Ward), Cold Boot (start with a small
 * credit) and Cache Prefetch (every banking beta starts with a charge;
 * session 51, was Overclocked Accumulator) -- once per fight, before the
 * first hand. */
export function applyModOnCombatStartPassives(combatState: CombatState): CombatState {
  let state = combatState;
  if (hasMod(state, 'warm-boot')) noteMod(state, 0, ownMod('warm-boot'));
  if (hasMod(state, 'cold-boot')) noteMod(state, 0, ownMod('cold-boot'));
  if (hasMod(state, 'cache-prefetch')) noteMod(state, 0, ownMod('cache-prefetch'));
  if (hasMod(state, 'warm-boot')) state = addWard(state, 0, MOD_SMALL);
  if (hasMod(state, 'cold-boot')) state = creditWinGauge(state, 0, MOD_SMALL);
  if (hasMod(state, 'cache-prefetch')) state = mapLoadout(state, 0, (entry) => addCharges(entry.state, entry.definition, CACHE_PREFETCH_CHARGES));
  // Invocation II (M10): the Daemon subroutines' growth caps rise, and
  // they start with some fires' growth.
  for (const side of [0, 1] as PlayerIndex[]) {
    if (!bridgeUpgradedFor(state, side, 'daemon-overclock')) continue;
    const loadout = state.sides[side].loadout.map((entry) => {
      const { growth, growthCap } = entry.definition.alpha;
      if (entry.definition.archetype !== 'daemon' || growth === undefined || growthCap === undefined) return entry;
      return { ...entry, definition: { ...entry.definition, alpha: { ...entry.definition.alpha, growthCap: growthCap + growth * BRIDGE_II_EIDOLON_CAP_FIRES } } };
    });
    state = growDaemons(withSide(state, side, { loadout }), side, BRIDGE_II_EIDOLON_FIRES, 'daemon');
  }
  // The Folds (session 65): the player's fifteens and pairs repriced.
  if (hasMod(state, 'fifteen-fold')) state = withSide(state, 0, { scoringRule: { ...FIFTEEN_FOLD_RULE } });
  if (hasMod(state, 'pair-fold')) state = withSide(state, 0, { scoringRule: { ...PAIR_FOLD_RULE } });
  // Glass Cannon: the enemy starts the fight with some Containment.
  if (hasMod(state, 'glass-cannon')) {
    const gauge = state.sides[1].winGauge;
    state = withSide(state, 1, { winGauge: { ...gauge, progress: gauge.progress + gauge.threshold * GLASS_CANNON_ENEMY_START } });
  }
  if (hasMod(state, 'deep-cache')) {
    noteMod(state, 0, ownMod('deep-cache'));
    state = mapLoadout(state, 0, (entry) => addCharges(entry.state, entry.definition, DEEP_CACHE_START_CHARGES));
  }
  return state;
}

/** Early Momentum (push the first time the player's gauge crosses half)
 * and First Contact (pull the first time the enemy's does). */
export function applyModGaugeCross50Passives(combatState: CombatState): CombatState {
  let state = combatState;
  if (hasMod(state, 'early-momentum') && passiveStat(state, 0, 'early-momentum:fired') === 0) {
    const gauge = state.sides[0].winGauge;
    if (gauge.progress >= gauge.threshold * MOD_GAUGE_CROSS_FRACTION) {
      noteMod(state, 0, ownMod('early-momentum'));
      state = creditWinGauge(setPassiveStat(state, 0, 'early-momentum:fired', 1), 0, MOD_SMALL);
    }
  }
  if (hasMod(state, 'first-contact') && passiveStat(state, 0, 'first-contact:fired') === 0) {
    const gauge = state.sides[1].winGauge;
    if (gauge.progress >= gauge.threshold * MOD_GAUGE_CROSS_FRACTION) {
      noteMod(state, 0, ownMod('first-contact'));
      state = reduceWinGauge(setPassiveStat(state, 0, 'first-contact:fired', 1), 1, MOD_SMALL);
    }
  }
  return state;
}

/** Static Shield (small, every incoming credit) and Surge Protector
 * (bigger, first incoming credit each fight) -- applied to plain Credit
 * aimed at the player, before Ward absorbs it. */
function applyModIncomingCreditPassives(combatState: CombatState, target: PlayerIndex, amount: number): { combatState: CombatState; amount: number } {
  if (target !== 0) return { combatState, amount };
  let state = combatState;
  let remaining = amount;
  if (hasMod(state, 'static-shield') && remaining > 0) {
    noteMod(state, 0, ownMod('static-shield'));
    remaining = Math.max(0, remaining - MOD_SMALL);
  }
  if (hasMod(state, 'surge-protector') && passiveStat(state, 0, 'surge-protector:used') === 0) {
    noteMod(state, 0, ownMod('surge-protector'));
    remaining = Math.max(0, remaining - MOD_MEDIUM);
    state = setPassiveStat(state, 0, 'surge-protector:used', 1);
  }
  return { combatState: state, amount: remaining };
}

// ---------------------------------------------------------------------
// Charges from the Cribbage layer
// ---------------------------------------------------------------------

function mapLoadout(
  combatState: CombatState,
  side: PlayerIndex,
  fn: (entry: LoadoutEntry, index: number) => SubroutineRuntimeState,
): CombatState {
  const sideState = combatState.sides[side];
  const loadout = sideState.loadout.map((entry, index) => ({ ...entry, state: fn(entry, index) }));
  return withSide(combatState, side, { loadout });
}

/** Feeds one scoring occurrence into every piece on both sides --
 * cards betas, points-progress betas, and points cooldowns. Each piece
 * decides for itself whether the scorer is a side it watches. */
export function applyOccurrence(combatState: CombatState, occurrence: ScoringOccurrence, dealer?: PlayerIndex): CombatState {
  let state = withSide(combatState, occurrence.player, { handPoints: combatState.sides[occurrence.player].handPoints + occurrencePoints(occurrence) });
  // A pair royal counts as three pairs, a double pair royal as six, for
  // the class Mod and the Burner bonuses as for Hooks (M8).
  const count = occurrenceCount(occurrence);
  for (let k = 0; k < count; k++) state = applyBridgeOnOccurrence(state, occurrence, dealer);
  // Hand-long Burner bonuses (Packet Storm, Noise Floor): the scorer's own
  // fifteens / pairs also do their effect.
  for (const bonus of state.sides[occurrence.player].handBonuses ?? []) {
    if (bonus.category !== occurrence.category) continue;
    for (let k = 0; k < count; k++) state = resolveEffect(bonus.effect, state, occurrence.player);
  }
  for (const side of [0, 1] as PlayerIndex[]) {
    state = mapLoadout(state, side, (entry) => chargeFromOccurrence(entry.state, entry.definition, occurrence, side));
    // Reverse Engineering (EM1): the opponent's fifteens and pairs also
    // count toward this side's Hooks, as if this side had scored them.
    if (occurrence.player !== side && (occurrence.category === 'fifteen' || occurrence.category === 'pair') && hasSideMod(state, side, 'reverse-engineering')) {
      noteMod(state, side, gk('reverse-engineering'));
      const mirrored = { ...occurrence, player: side };
      state = mapLoadout(state, side, (entry) => chargeFromOccurrence(entry.state, entry.definition, mirrored, side));
    }
  }
  // Hardened Perimeter II (M10): each pair the opponent scores gives Ward.
  const defender = opponentOf(occurrence.player);
  if (occurrence.category === 'pair' && bridgeUpgradedFor(state, defender, 'daemon-honeypot')) {
    noteMod(state, defender, bridgeMod('daemon-honeypot'));
    state = bankWard(state, defender, BRIDGE_II_WARDEN_WARD * count);
  }
  return applyRuleBendersOnOccurrence(state, occurrence, dealer);
}

/** Lateral Movement II: pairs `side` has scored this hand. */
const LATERAL_PAIRS_THIS_HAND = 'bridge-ii:lateral-pairs';

/** Lateral Movement II (M10): counts `pairs` more this hand; `turn` when
 * the count reaches BRIDGE_II_BLACKHAT_PAIRS (once a hand). */
export function countLateralPairs(combatState: CombatState, side: PlayerIndex, pairs: number): { combatState: CombatState; turn: boolean } {
  const before = passiveStat(combatState, side, LATERAL_PAIRS_THIS_HAND);
  const after = before + pairs;
  const turn = before < BRIDGE_II_BLACKHAT_PAIRS && after >= BRIDGE_II_BLACKHAT_PAIRS;
  if (turn) noteMod(combatState, side, bridgeMod('exploit-overclock'));
  return { combatState: setPassiveStat(combatState, side, LATERAL_PAIRS_THIS_HAND, after), turn };
}

/** Adds Heat raised against `side` this fight (S12's system strain). */
export function addSideHeat(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  return withSide(combatState, side, { heat: combatState.sides[side].heat + amount });
}

/** Whether `side`'s class Mod is its "II" version (M10). */
function isBridgeUpgraded(combatState: CombatState, side: PlayerIndex): boolean {
  return combatState.bridgeUpgraded?.[side] ?? false;
}

/** Whether `side` has class `classId`'s Mod upgraded (combat.ts's
 * Lateral Movement II). */
export function bridgeUpgradedFor(combatState: CombatState, side: PlayerIndex, classId: ClassId): boolean {
  return combatState.bridges[side] === classId && isBridgeUpgraded(combatState, side);
}

// Rule-benders (session 65, docs/mods-design.md M6): the player's own.
/** Thirty-One: the turn it gives sets off every Hook. */
const THIRTY_ONE_HOOKS = 'thirty-one:hooks';
/** Overclocked Kernel: doubled turns taken this fight. */
const KERNEL_TURNS = 'overclocked-kernel:turns';

/** The rule-bender Mods that read a scoring occurrence (side 0's). */
function applyRuleBendersOnOccurrence(combatState: CombatState, occurrence: ScoringOccurrence, dealer: PlayerIndex | undefined): CombatState {
  let state = combatState;
  const own = occurrence.player === 0;
  // Last Word: each go point (the last card, or 31) adds initiative.
  if (own && (occurrence.category === 'go' || occurrence.category === 'thirtyOne') && hasMod(state, 'last-word')) {
    noteMod(state, 0, ownMod('last-word'));
    state = haste(state, 0, LAST_WORD_INITIATIVE / state.sides[0].startingThreshold);
  }
  // Run Splicer: each run also counts as two pairs, for the Hooks and the
  // class Mod (not points).
  if (own && occurrence.category === 'run' && hasMod(state, 'run-splicer')) {
    noteMod(state, 0, ownMod('run-splicer'));
    const pair: ScoringOccurrence = { category: 'pair', player: 0, magnitude: 2 };
    for (let k = 0; k < RUN_SPLICER_PAIRS * occurrenceCount(occurrence); k++) {
      state = applyBridgeOnOccurrence(state, pair, dealer);
      state = mapLoadout(state, 0, (entry) => chargeFromOccurrence(entry.state, entry.definition, pair, 0));
    }
  }
  // Mirror Hand: each pair the enemy scores also counts toward the
  // player's pair Hooks.
  if (!own && occurrence.category === 'pair' && hasMod(state, 'mirror-hand')) {
    noteMod(state, 0, ownMod('mirror-hand'));
    const mirrored: ScoringOccurrence = { ...occurrence, player: 0 };
    state = mapLoadout(state, 0, (entry) => chargeFromOccurrence(entry.state, entry.definition, mirrored, 0));
  }
  return state;
}

/** The cut (session 65): Lucky Cut Credits when the cut card is one of
 * the player's class's suits. */
export function applyCutMods(combatState: CombatState, starter: Card): CombatState {
  if (!hasMod(combatState, 'lucky-cut') || !combatState.classId) return combatState;
  const suits = CLASS_DEFINITIONS[combatState.classId].archetypes.map((a) => ARCHETYPE_SUITS[a]);
  if (!suits.includes(starter.suit)) return combatState;
  noteMod(combatState, 0, ownMod('lucky-cut'));
  return creditWinGauge(combatState, 0, LUCKY_CUT_CREDIT);
}

/** The end of a hand (session 65): Ward Converter Credits a share of the
 * player's remaining Ward (the Ward stays). */
export function applyHandEndMods(combatState: CombatState): CombatState {
  let state = combatState;
  // Collection (session 67, E4): the opponent's growing subroutines lose
  // half their growth.
  for (const side of [0, 1] as PlayerIndex[]) {
    if (!hasSideMod(state, side, 'collection')) continue;
    const victim = opponentOf(side);
    if (!state.sides[victim].loadout.some((e) => e.state.growthTotal > 0)) continue;
    noteMod(state, side, gk('collection'));
    state = mapLoadout(state, victim, (e) => (e.state.growthTotal > 0 ? { ...e.state, growthTotal: e.state.growthTotal * COLLECTION_KEEP } : e.state));
  }
  const ward = state.sides[0].wardShield;
  if (!hasMod(state, 'ward-converter') || ward <= 0) return state;
  noteMod(state, 0, ownMod('ward-converter'));
  return creditWinGauge(state, 0, ward * WARD_CONVERTER_SHARE);
}

/** The show (session 65): Nobs Exploit Credits for each Jack in the
 * player's hand or crib (`cards`, without the cut card). */
export function applyShowMods(combatState: CombatState, player: PlayerIndex, cards: Card[]): CombatState {
  if (player !== 0 || !hasMod(combatState, 'nobs-exploit')) return combatState;
  const jacks = cards.filter((c) => c.rank === 11).length;
  if (jacks === 0) return combatState;
  noteMod(combatState, 0, ownMod('nobs-exploit'));
  return creditWinGauge(combatState, 0, jacks * NOBS_EXPLOIT_CREDIT);
}

/** Thirty-One (session 65): the next player turn sets off every Hook. */
export function armThirtyOne(combatState: CombatState): CombatState {
  noteMod(combatState, 0, ownMod('thirty-one'));
  return setPassiveStat(combatState, 0, THIRTY_ONE_HOOKS, 1);
}

/** Whether the player owns Mod `id` (combat.ts's Thirty-One). */
export function playerHasMod(combatState: CombatState, id: ModId): boolean {
  return hasMod(combatState, id);
}

/** Notes a gatekeeper or elite Mod acting, for combat.ts (Fast Path). */
export function noteSideMod(combatState: CombatState, side: PlayerIndex, id: GatekeeperModId): void {
  noteMod(combatState, side, gk(id));
}

/** Notes a player Mod acting, for combat.ts. */
export function notePlayerMod(combatState: CombatState, id: ModId): void {
  noteMod(combatState, 0, ownMod(id));
}

/** Feeds one pegging play into every piece on both sides -- the suit
 * tally that charges an archetype's `cards`/`suit` betas. */
export function applySuitPlayed(combatState: CombatState, suitPlayed: SuitPlayed): CombatState {
  let state = combatState;
  for (const side of [0, 1] as PlayerIndex[]) {
    state = mapLoadout(state, side, (entry) => chargeFromSuitPlayed(entry.state, entry.definition, suitPlayed, side));
  }
  return state;
}

// ---------------------------------------------------------------------
// Resolving one effect
// ---------------------------------------------------------------------

/** Turn-scoped state shared across one side's pass through its loadout:
 * pending Empower bonuses. Empower deliberately lasts only the turn it
 * fires in (DESIGN.md) -- outside a turn there is nothing to boost, so an
 * immediate beta's Empower passes `undefined` and does nothing. */
interface TurnBuffer {
  empowerNext: number;
  empowerRest: number;
}

/** Which verbs Empower boosts: the ones whose amount is gauge points.
 * Tempo is excluded -- its amount is a fraction of a turn or threshold,
 * and a flat bonus there would mean "plus N whole turns" (session 48's
 * invariant). Charge, Empower and Disrupt are not output. */
function empowerable(effect: Effect): boolean {
  return effect.verb === 'credit' || effect.verb === 'suppress' || effect.verb === 'ward';
}

/** A noisy effect's drawback (`feed`): progress added straight to the
 * caster's opponent's win gauge -- no Ward, no Mods. */
function applyFeed(combatState: CombatState, caster: PlayerIndex, amount: number | undefined): CombatState {
  if (!amount || amount <= 0) return combatState;
  const target = opponentOf(caster);
  return withSide(combatState, target, { winGauge: addDuelProgress(combatState.sides[target].winGauge, amount).gauge });
}

/**
 * Resolves one effect for `caster`. `loadoutIndex` is the firing piece's
 * position (for Charge's `self`/`next`); `turn` is the turn buffer, absent
 * outside a turn. Exported for Burners and tests.
 */
export function resolveEffect(
  effect: Effect,
  combatState: CombatState,
  caster: PlayerIndex,
  loadoutIndex?: number,
  turn?: TurnBuffer,
): CombatState {
  const target = opponentOf(caster);
  const state = applyFeed(combatState, caster, effect.feed);

  switch (effect.verb) {
    case 'credit': {
      if (effect.from === 'ward') {
        // Spend own Ward 1:1, crediting only what was actually there.
        const spent = Math.min(state.sides[caster].wardShield, effect.amount);
        return creditWinGauge(withSide(state, caster, { wardShield: state.sides[caster].wardShield - spent }), caster, spent);
      }
      if (effect.from === 'opponent') {
        // Take from the opponent's gauge 1:1, capped at what they had.
        const stolen = Math.min(state.sides[target].winGauge.progress, effect.amount);
        return creditWinGauge(reduceWinGauge(state, target, stolen), caster, stolen);
      }
      // Containment: the target's Ward absorbs piercing Credit too.
      if (effect.piercing) {
        if (!hasSideMod(state, target, 'containment')) return creditWinGauge(state, caster, effect.amount);
        noteMod(state, target, gk('containment'));
      }
      // Plain credit: the target's incoming-credit Mods, then its Ward.
      // Conversion credits above are transfers, not attacks, and skip both.
      const incoming = applyModIncomingCreditPassives(state, target, effect.amount);
      const targetState = incoming.combatState.sides[target];
      const absorbed = Math.min(targetState.wardShield, incoming.amount);
      let next = withSide(incoming.combatState, target, { wardShield: targetState.wardShield - absorbed });
      // Absorbed Ward feeds the defender's `absorbed` betas -- Honeypot's
      // conversion fuel.
      if (absorbed > 0) next = mapLoadout(next, target, (entry) => chargeFromAbsorbed(entry.state, entry.definition, absorbed));
      // Power Siphon (EM3): an absorption grows the defender's growing subroutines.
      if (absorbed > 0 && hasSideMod(next, target, 'power-siphon')) {
        noteMod(next, target, gk('power-siphon'));
        next = growDaemons(next, target, POWER_SIPHON_GROWTH);
      }
      // Reflection (session 68, E11): the defender Credits half of what its
      // Ward absorbed.
      if (absorbed > 0 && hasSideMod(next, target, 'reflection')) {
        noteMod(next, target, gk('reflection'));
        next = creditWinGauge(next, target, absorbed * REFLECTION_SHARE);
      }
      // Foothold II (M10): Ward that blocks a hit Credits a third of it.
      if (absorbed > 0 && bridgeUpgradedFor(next, target, 'exploit-honeypot')) {
        noteMod(next, target, bridgeMod('exploit-honeypot'));
        next = creditWinGauge(next, target, absorbed * BRIDGE_II_BREACHER_SHARE);
      }
      // Phase Shift II (M10): Ward that fully blocks a hit adds initiative.
      if (absorbed > 0 && absorbed >= incoming.amount && bridgeUpgradedFor(next, target, 'overclock-honeypot')) {
        noteMod(next, target, bridgeMod('overclock-honeypot'));
        next = haste(next, target, BRIDGE_II_WRAITH_INITIATIVE / next.sides[target].startingThreshold);
      }
      return creditWinGauge(next, caster, incoming.amount - absorbed);
    }
    case 'suppress':
      return reduceWinGauge(state, target, effect.amount);
    case 'ward':
      return addWard(state, caster, effect.amount);
    case 'empower':
      if (turn) {
        if (effect.scope === 'next') turn.empowerNext += effect.amount;
        else turn.empowerRest += effect.amount;
      }
      return state;
    case 'tempo':
      return resolveTempo(effect, state, caster);
    case 'disrupt':
      return withSide(state, caster, { pendingDisrupt: [...state.sides[caster].pendingDisrupt, effect.action] });
    case 'charge': {
      // `next` is the following piece in loadout order, if there is one --
      // no wrap-around, so the last piece's `next` charges nothing.
      return mapLoadout(state, caster, (entry, index) => {
        const hit =
          effect.target === 'all'
            ? index !== loadoutIndex
            : effect.target === 'self'
              ? index === loadoutIndex
              : loadoutIndex !== undefined && index === loadoutIndex + 1;
        return hit ? addCharges(entry.state, entry.definition, effect.amount) : entry.state;
      });
    }
    // The enemy-only effects (CP1), each on the caster's opponent.
    case 'trace':
      return giveHeat(state, caster, effect.amount);
    case 'wipe':
      return mapLoadout(state, opponentOf(caster), (entry) => removeCharges(entry.state, effect.amount));
    case 'strip': {
      const victim = opponentOf(caster);
      return withSide(state, victim, { wardShield: Math.max(0, state.sides[victim].wardShield - effect.amount) });
    }
    case 'suspend': {
      // Suspend (S5): the target's bottom subroutine skips its next turn(s).
      // Suspends don't stack: a second before that turn changes nothing.
      const victim = opponentOf(caster);
      const turns = Math.max(1, Math.round(effect.amount));
      return withSide(state, victim, { passiveState: { ...state.sides[victim].passiveState, [SUSPENDED_TURNS]: Math.max(state.sides[victim].passiveState[SUSPENDED_TURNS] ?? 0, turns) } });
    }
  }
}

/** Suspend (S5): turns `side`'s bottom subroutine still skips. */
const SUSPENDED_TURNS = 'suspend:turns';
/** Lockout (E4): `side`'s top subroutine skips its next turn; the
 * Lockout owner's turns taken. */
const LOCKED_TOP = 'gk:locked-top';
const LOCKOUT_TURNS = 'gk:lockout-turns';

function resolveTempo(effect: TempoEffect, combatState: CombatState, caster: PlayerIndex): CombatState {
  const affected = effect.target === 'own' ? caster : opponentOf(caster);
  // Own tempo speeds up (more progress, lower threshold); opponent tempo
  // slows down (less progress, higher threshold).
  const sign = effect.target === 'own' ? 1 : -1;
  if (effect.mode === 'gauge') {
    const gauge = combatState.sides[affected].gauge;
    // Progress past the threshold isn't lost: addPoints carries overflow,
    // so the turn it buys fires on the next scoring event.
    const progress = Math.max(0, gauge.progress + sign * turnFraction(combatState, affected, effect.amount));
    return withSide(combatState, affected, { gauge: { ...gauge, progress } });
  }
  const { combatState: shifted, applied } = shiftThreshold(combatState, affected, -sign * thresholdFraction(combatState, affected, effect.amount));
  if (effect.duration === undefined || applied === 0) return shifted;
  const timedTempo = [...shifted.sides[affected].timedTempo, { thresholdDelta: applied, remainingTurns: effect.duration }];
  return withSide(shifted, affected, { timedTempo });
}

/** Counts down `side`'s timed threshold changes by one of its own turns,
 * reverting each that expires by exactly the delta it applied (floored
 * again, in case the threshold has since moved). */
function tickTimedTempo(combatState: CombatState, side: PlayerIndex): CombatState {
  let state = combatState;
  const remaining: TimedTempo[] = [];
  for (const timed of state.sides[side].timedTempo) {
    if (timed.remainingTurns > 1) remaining.push({ ...timed, remainingTurns: timed.remainingTurns - 1 });
    else state = shiftThreshold(state, side, -timed.thresholdDelta).combatState;
  }
  return withSide(state, side, { timedTempo: remaining });
}

// ---------------------------------------------------------------------
// Firing
// ---------------------------------------------------------------------

export interface FireEvent {
  subroutineId: string;
  side: PlayerIndex;
  /** The alpha as it actually resolved -- growth, Empower and an `enhance`
   * beta already folded into its amount. */
  alpha: Effect;
  /** A "different effect" beta, as it resolved, when it applied. */
  beta?: Effect;
  /** Whether the beta applied (D13's "fired elevated"). */
  elevated: boolean;
  /** The beta's raw charge count when this fire was evaluated -- banked
   * charges for cards/progress, 1/0 for state, matching neighbours or
   * elevated predecessors for sequence; 0 with no beta. Uncapped, unlike
   * the scale the beta applied at. Recorded for measurement (step 2's
   * beta frequency table reads it), not used by the engine. */
  charges: number;
  /** True for an `immediate` beta firing outside the turn. */
  immediate: boolean;
  /** Both sides' meters just after this fire resolved (milestone 2, the
   * user's call): what lets the UI's step-through (playable-design P4)
   * move the gauges piece by piece rather than jump once per turn.
   * Index 0 is the player's. Not read by the engine. */
  gauges: [GaugeReading, GaugeReading];
  /** Mods that acted during this fire (either side's), for the UI. */
  mods?: ModTrigger[];
}

/** One side's meters at a moment, as plain numbers. */
export interface GaugeReading {
  win: number;
  winThreshold: number;
  initiative: number;
  initiativeThreshold: number;
  ward: number;
  heat: number;
}

/** The Mod triggers noted since `mark`, taken out of the shared record
 * to ride on the fire that caused them. */
function takeMods(combatState: CombatState, mark: number): { mods?: ModTrigger[] } {
  const sink = combatState.modTriggers;
  if (!sink || sink.length <= mark) return {};
  return { mods: sink.splice(mark) };
}

export function readGauges(combatState: CombatState): [GaugeReading, GaugeReading] {
  const read = (s: CombatSideState): GaugeReading => ({
    win: s.winGauge.progress,
    winThreshold: s.winGauge.threshold,
    initiative: s.gauge.progress,
    initiativeThreshold: s.gauge.threshold,
    ward: s.wardShield,
    heat: s.heat,
  });
  return [read(combatState.sides[0]), read(combatState.sides[1])];
}

/** `index` is the piece's loadout slot, for `adjacent` betas (A12) --
 * its neighbours are the slots directly above and below. */
export function buildTriggerContext(
  combatState: CombatState,
  side: PlayerIndex,
  isDealer: boolean,
  firedThisTurn: readonly FiredThisTurn[] = [],
  index?: number,
): TriggerContext {
  const own = combatState.sides[side];
  const opponent = combatState.sides[opponentOf(side)];
  const neighbours = index === undefined ? [] : [own.loadout[index - 1], own.loadout[index + 1]].filter((e) => e !== undefined).map((e) => e.definition);
  return {
    isDealer,
    ownWard: own.wardShield,
    ownGaugeFraction: own.winGauge.progress / own.winGauge.threshold,
    opponentGaugeFraction: opponent.winGauge.progress / opponent.winGauge.threshold,
    ownHandPoints: own.handPoints,
    firedThisTurn,
    neighbours,
  };
}

function withAmount<T extends Effect>(effect: T, amount: number): T {
  return effect.verb === 'disrupt' ? effect : { ...effect, amount };
}

/** The alpha's amount before any beta: base, plus accrued growth, plus
 * this turn's Empower (empowerable verbs only). */
function alphaAmount(entry: LoadoutEntry, turn: TurnBuffer | undefined): number {
  const alpha = entry.definition.alpha;
  if (alpha.verb === 'disrupt') return 0;
  const empower = turn && empowerable(alpha) ? turn.empowerNext + turn.empowerRest : 0;
  return alpha.amount + entry.state.growthTotal + empower;
}

/** Resolves an alpha at `amount`, plus a "different effect" beta at
 * `betaScale` if one applies, and records the fire. Shared by turn fires
 * and immediate extra fires. */
function resolveFire(
  combatState: CombatState,
  side: PlayerIndex,
  index: number,
  alpha: Effect,
  betaEffect: BetaEffect | undefined,
  scale: number,
  turn: TurnBuffer | undefined,
): { combatState: CombatState; beta?: Effect } {
  let state = resolveEffect(alpha, combatState, side, index, turn);
  let resolvedBeta: Effect | undefined;
  if (betaEffect && betaEffect.verb !== 'enhance' && scale > 0) {
    resolvedBeta = betaEffect.verb === 'disrupt' ? betaEffect : withAmount(betaEffect, betaEffect.amount * scale);
    state = resolveEffect(resolvedBeta, state, side, index, turn);
  }
  if (betaEffect?.verb === 'enhance' && scale > 0) state = applyFeed(state, side, betaEffect.feed);
  return { combatState: state, beta: resolvedBeta };
}

/** Applies a piece's alarm: Heat raised against the opponent each time
 * it fires (session 47's tracers, direct since session 58). */
function applyHeatPressure(combatState: CombatState, side: PlayerIndex, definition: SubroutineDefinition): CombatState {
  // Spotlight: every fire of the owner's pieces adds Heat to its opponent.
  const spotlight = hasSideMod(combatState, side, 'spotlight');
  if (spotlight) noteMod(combatState, side, gk('spotlight'));
  const pressure = (definition.heatPressure ?? 0) + (spotlight ? SPOTLIGHT_HEAT : 0);
  return giveHeat(combatState, side, pressure);
}

/** `side` raises `amount` Heat on its opponent -- alarms, Spotlight and
 * Trace alike. Evidence Chain (EM5): the owner also Credits that much. */
function giveHeat(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  if (amount <= 0) return combatState;
  const target = opponentOf(side);
  let state = withSide(combatState, target, { heat: combatState.sides[target].heat + amount });
  if (hasSideMod(state, side, 'evidence-chain')) {
    noteMod(state, side, gk('evidence-chain'));
    state = creditWinGauge(state, side, amount);
  }
  return state;
}

/**
 * One turn for `side`: every installed piece fires its alpha top to
 * bottom, and each whose beta's criteria are met applies its beta. Then
 * this side's timed threshold changes count down one turn.
 *
 * The context is rebuilt per piece, since an earlier fire can change
 * what a later piece's state condition sees -- and `firedThisTurn` is the
 * ordering record `sequence` betas read.
 */
export function fireTurn(
  combatState: CombatState,
  side: PlayerIndex,
  selfContext: { isDealer: boolean },
): { combatState: CombatState; events: FireEvent[] } {
  let state = applyBridgeOnTurnStart(combatState, side);
  // Behavior Analysis (session 68, E11): each turn `side` takes gives the
  // owner Ward.
  if (hasSideMod(state, opponentOf(side), 'behavior-analysis')) {
    noteMod(state, opponentOf(side), gk('behavior-analysis'));
    state = addWard(state, opponentOf(side), BEHAVIOR_ANALYSIS_WARD);
  }
  const events: FireEvent[] = [];
  const pass = fireLoadoutOnce(state, side, selfContext);
  state = pass.combatState;
  events.push(...pass.events);
  // Overclock Script (session 64): this turn, the loadout fires twice.
  if (state.sides[side].passiveState[BURNER_FIRE_TWICE]) {
    const again = fireLoadoutOnce(state, side, selfContext);
    state = again.combatState;
    events.push(...again.events);
  }
  // Fire twice counts down a turn (it may last two). Hooks twice lasts
  // the hand: clearHandKnowledge ends it.
  const ps = state.sides[side].passiveState;
  if (ps[BURNER_FIRE_TWICE]) {
    state = withSide(state, side, { passiveState: { ...ps, [BURNER_FIRE_TWICE]: ps[BURNER_FIRE_TWICE] - 1 } });
  }
  // Root Access: on the owner's first turn each hand, the loadout fires twice.
  if (hasSideMod(state, side, 'root-access') && !state.sides[side].passiveState[ROOT_ACCESS_SPENT]) {
    noteMod(state, side, gk('root-access'));
    state = withSide(state, side, { passiveState: { ...state.sides[side].passiveState, [ROOT_ACCESS_SPENT]: 1 } });
    const again = fireLoadoutOnce(state, side, selfContext);
    state = again.combatState;
    events.push(...again.events);
  }
  // Overclocked Kernel (session 65): the player's first turns each fight
  // fire the loadout twice.
  const kernelTurns = passiveStat(state, 0, KERNEL_TURNS);
  if (side === 0 && hasMod(state, 'overclocked-kernel') && kernelTurns < OVERCLOCKED_KERNEL_TURNS) {
    noteMod(state, 0, ownMod('overclocked-kernel'));
    state = setPassiveStat(state, 0, KERNEL_TURNS, kernelTurns + 1);
    const again = fireLoadoutOnce(state, side, selfContext);
    state = again.combatState;
    events.push(...again.events);
  }
  // A Suspend lasts the turn (every pass of it), then counts down; so does
  // a Lockout on the top subroutine.
  const suspendedTurns = state.sides[side].passiveState[SUSPENDED_TURNS] ?? 0;
  if (suspendedTurns > 0) state = setPassiveStat(state, side, SUSPENDED_TURNS, suspendedTurns - 1);
  if ((state.sides[side].passiveState[LOCKED_TOP] ?? 0) > 0) state = setPassiveStat(state, side, LOCKED_TOP, 0);
  // Lockout (E4): every second turn its owner takes locks the opponent's top.
  if (hasSideMod(state, side, 'lockout')) {
    const taken = passiveStat(state, side, LOCKOUT_TURNS) + 1;
    state = setPassiveStat(state, side, LOCKOUT_TURNS, taken);
    if (taken % LOCKOUT_EVERY === 0) state = setPassiveStat(state, opponentOf(side), LOCKED_TOP, 1);
  }
  if (side === 0) {
    if (state.sides[0].passiveState[THIRTY_ONE_HOOKS]) state = setPassiveStat(state, 0, THIRTY_ONE_HOOKS, 0);
    state = hotStandby(state);
    const echo = echoChamber(state);
    state = echo.combatState;
    events.push(...echo.events);
  }
  return { combatState: tickTimedTempo(state, side), events };
}

/** Counter-Trace (session 68, E11): `side`'s Hook going off gives it Heat. */
function counterTrace(combatState: CombatState, side: PlayerIndex): CombatState {
  const owner = opponentOf(side);
  if (!hasSideMod(combatState, owner, 'counter-trace')) return combatState;
  noteMod(combatState, owner, gk('counter-trace'));
  return giveHeat(combatState, owner, COUNTER_TRACE_HEAT);
}

/** Root Cause (session 65): a player Hook going off gives the subroutine
 * below it a count toward its own Hook. */
function rootCause(combatState: CombatState, side: PlayerIndex, index: number): CombatState {
  if (side !== 0 || !hasMod(combatState, 'root-cause') || index + 1 >= combatState.sides[0].loadout.length) return combatState;
  noteMod(combatState, 0, ownMod('root-cause'));
  return mapLoadout(combatState, 0, (e, i) => (i === index + 1 ? addCharges(e.state, e.definition, ROOT_CAUSE_COUNTS) : e.state));
}

/** Hot Standby (session 65): after the loadout fires, each benched
 * subroutine's Process fires at half strength; their Hooks don't. */
function hotStandby(combatState: CombatState): CombatState {
  const benched = combatState.standby ?? [];
  if (!hasMod(combatState, 'hot-standby') || benched.length === 0) return combatState;
  noteMod(combatState, 0, ownMod('hot-standby'));
  let state = combatState;
  for (const piece of benched) {
    const alpha = piece.alpha as Effect;
    if (alpha.verb === 'disrupt') continue;
    state = resolveEffect(withAmount(alpha, alpha.amount * HOT_STANDBY_SHARE), state, 0);
  }
  return state;
}

/** Echo Chamber (session 65): at the end of each of the player's turns,
 * the top subroutine fires again (its Process; its Hook already went off
 * or didn't). */
function echoChamber(combatState: CombatState): { combatState: CombatState; events: FireEvent[] } {
  const entry = combatState.sides[0].loadout[0];
  if (!hasMod(combatState, 'echo-chamber') || !entry || !withinFiringGates(entry.definition, entry.state)) return { combatState, events: [] };
  const modMark = combatState.modTriggers?.length ?? 0;
  noteMod(combatState, 0, ownMod('echo-chamber'));
  const alpha = withAmount(entry.definition.alpha as Effect, alphaAmount(entry, undefined));
  let state = resolveFire(combatState, 0, 0, alpha, undefined, 0, undefined).combatState;
  state = applyHeatPressure(state, 0, entry.definition);
  state = mapLoadout(state, 0, (e, index) => (index === 0 ? recordFire(e.state, entry.definition) : e.state));
  return { combatState: state, events: [{ subroutineId: entry.definition.id, side: 0, alpha, elevated: false, charges: 0, immediate: false, gauges: readGauges(state), ...takeMods(state, modMark) }] };
}

/** One top-to-bottom pass of `side`'s loadout (fireTurn's body). */
/** The index of `side`'s bottom installed subroutine: reactive Mods'
 * pieces (appended after the loadout, side 0 only) don't count. */
function bottomInstalledIndex(combatState: CombatState, side: PlayerIndex): number {
  const loadout = combatState.sides[side].loadout;
  const reactive = side === 0 ? new Set(reactiveModSubroutines(combatState.ownedModIds).map((d) => d.id)) : new Set<string>();
  for (let i = loadout.length - 1; i >= 0; i--) if (!reactive.has(loadout[i].definition.id)) return i;
  return -1;
}

function fireLoadoutOnce(
  combatState: CombatState,
  side: PlayerIndex,
  selfContext: { isDealer: boolean },
): { combatState: CombatState; events: FireEvent[] } {
  let state = combatState;
  const events: FireEvent[] = [];
  const firedThisTurn: FiredThisTurn[] = [];
  const turn: TurnBuffer = { empowerNext: 0, empowerRest: 0 };
  const loadoutLength = state.sides[side].loadout.length;
  // Resource Quota (EM6): the side's bottom installed subroutine doesn't
  // fire -- the last entry that isn't a reactive Mod's appended piece.
  const quota = hasSideMod(state, opponentOf(side), 'resource-quota');
  // Suspend (S5) skips the same subroutine, for this turn.
  const suspended = (state.sides[side].passiveState[SUSPENDED_TURNS] ?? 0) > 0;
  const quotaSkip = quota || suspended ? bottomInstalledIndex(state, side) : -1;
  // Lockout (E4): this turn the top subroutine skips.
  const lockedTop = (state.sides[side].passiveState[LOCKED_TOP] ?? 0) > 0 ? 0 : -1;

  for (let i = 0; i < loadoutLength; i++) {
    const entry = state.sides[side].loadout[i];
    if (i === quotaSkip) {
      if (quota) noteMod(state, opponentOf(side), gk('resource-quota'));
      continue;
    }
    if (i === lockedTop) {
      noteMod(state, opponentOf(side), gk('lockout'));
      continue;
    }
    if (!withinFiringGates(entry.definition, entry.state)) continue;

    const { definition } = entry;
    const beta = definition.beta;
    const modMark = state.modTriggers?.length ?? 0;
    const context = buildTriggerContext(state, side, selfContext.isDealer, firedThisTurn, i);
    const counted = beta ? betaCharges(definition, entry.state, context) : 0;
    // Hardened (E11): a graded Hook counts one fewer.
    const hardened = beta?.shape === 'graded' && (beta.source === 'cards' || beta.source === 'progress') && hasSideMod(state, opponentOf(side), 'hardened');
    const charges = hardened ? Math.max(0, counted - HARDENED_COUNTS) : counted;
    let scale = beta ? betaScale(beta, charges) : 0;
    // Zero-Day (session 64): for the rest of the hand, every Hook goes off
    // and applies twice (an instant Hook keeps its own timing).
    if (beta && beta.shape !== 'immediate' && state.sides[side].passiveState[BURNER_HOOKS_TWICE]) scale = Math.max(scale, 1) * 2;
    // Thirty-One (session 65): on the turn it gave, every Hook goes off.
    if (beta && beta.shape !== 'immediate' && state.sides[side].passiveState[THIRTY_ONE_HOOKS]) scale = Math.max(scale, 1);
    const elevated = scale > 0;
    // Reception Protocol: the owner's first Exploit beta each hand applies twice.
    if (elevated && definition.archetype === 'exploit' && hasSideMod(state, side, 'reception-protocol') && !state.sides[side].passiveState[RECEPTION_SPENT]) {
      noteMod(state, side, gk('reception-protocol'));
      scale *= 2;
      state = withSide(state, side, { passiveState: { ...state.sides[side].passiveState, [RECEPTION_SPENT]: 1 } });
    }

    let amount = alphaAmount(entry, turn);
    if (beta?.effect.verb === 'enhance' && elevated) amount += beta.effect.amount * scale;
    const alpha = withAmount(definition.alpha as Effect, amount);
    // The "next" Empower is spent by whichever piece fires next, whether
    // or not its verb could use it.
    turn.empowerNext = 0;

    // Banked charges are consumed the moment the beta is evaluated, before
    // anything resolves -- so a charge this same fire banks (Charge
    // `self`, Ward absorbed mid-fire) survives to the next turn rather
    // than being wiped. Live sources (state/sequence) have nothing to spend.
    if (elevated && (beta?.source === 'cards' || beta?.source === 'progress')) {
      state = mapLoadout(state, side, (e, index) => (index === i ? spendCharges(e.state) : e.state));
    }

    const resolved = resolveFire(state, side, i, alpha, beta?.effect, scale, turn);
    state = applyHeatPressure(resolved.combatState, side, definition);
    state = mapLoadout(state, side, (e, index) => (index === i ? recordFire(e.state, definition) : e.state));

    if (elevated) state = rootCause(state, side, i);
    if (elevated) state = counterTrace(state, side);
    events.push({ subroutineId: definition.id, side, alpha, beta: resolved.beta, elevated, charges, immediate: false, gauges: readGauges(state), ...takeMods(state, modMark) });
    firedThisTurn.push({ definition, elevated });
  }

  return { combatState: state, events };
}

/**
 * Fires every `immediate` beta, on both sides, whose criteria are now met
 * -- outside the turn gate. Call after any step that can bank a charge or
 * change a state condition. Side 0 then side 1, loadout order within each,
 * matching fireTurn's determinism. Also refreshes every `state` beta's
 * last-known condition, so an immediate state beta fires once per
 * false -> true edge rather than continuously.
 *
 * An `enhance` immediate beta is an extra, elevated fire of the alpha
 * (D12's "extra fire"); any other effect fires on its own. Either way the
 * piece's fire cap applies -- this is the one path that can re-fire
 * outside a turn, which is what maxFiresPerCombat now exists for.
 */
export function fireImmediateBetas(combatState: CombatState, dealer: PlayerIndex): { combatState: CombatState; events: FireEvent[] } {
  let state = combatState;
  const events: FireEvent[] = [];
  for (const side of [0, 1] as PlayerIndex[]) {
    const loadoutLength = state.sides[side].loadout.length;
    for (let i = 0; i < loadoutLength; i++) {
      const entry = state.sides[side].loadout[i];
      const { definition } = entry;
      const beta = definition.beta;
      if (!beta) continue;
      const context = buildTriggerContext(state, side, side === dealer);
      const ready = immediateBetaReady(definition, entry.state, context) && withinFiringGates(definition, entry.state);
      const conditionNow = beta.source === 'state' ? evaluateStateCondition(beta.condition, context) : entry.state.lastConditionTrue;

      if (!ready) {
        if (conditionNow !== entry.state.lastConditionTrue) {
          state = mapLoadout(state, side, (e, index) => (index === i ? { ...e.state, lastConditionTrue: conditionNow } : e.state));
        }
        continue;
      }

      // Spend first, for the same reason fireTurn does.
      const modMark = state.modTriggers?.length ?? 0;
      state = mapLoadout(state, side, (e, index) => (index === i ? { ...spendCharges(e.state), lastConditionTrue: conditionNow } : e.state));
      let alpha: Effect | undefined;
      let resolvedBeta: Effect | undefined;
      if (beta.effect.verb === 'enhance') {
        alpha = withAmount(definition.alpha as Effect, alphaAmount(entry, undefined) + beta.effect.amount);
        state = resolveFire(state, side, i, alpha, beta.effect, 1, undefined).combatState;
      } else {
        resolvedBeta = beta.effect;
        state = resolveEffect(resolvedBeta, state, side, i);
      }

      // An extra alpha fire is a real fire (growth, `fires` progress); a
      // standalone beta effect only counts against the fire cap.
      state = mapLoadout(state, side, (e, index) => (index === i ? (alpha ? recordFire(e.state, definition) : { ...e.state, fireCount: e.state.fireCount + 1 }) : e.state));
      state = rootCause(state, side, i);
      state = counterTrace(state, side);
      // Interference (E4): an Instant Hook going off costs its owner Breach.
      if (hasSideMod(state, opponentOf(side), 'interference')) {
        noteMod(state, opponentOf(side), gk('interference'));
        state = reduceWinGauge(state, side, INTERFERENCE_LOSS);
      }
      const firedCharges = beta.source === 'cards' || beta.source === 'progress' ? entry.state.charges : 1;
      events.push({ subroutineId: definition.id, side, alpha: alpha ?? (definition.alpha as Effect), beta: resolvedBeta, elevated: true, charges: firedCharges, immediate: true, gauges: readGauges(state), ...takeMods(state, modMark) });
    }
  }
  return { combatState: state, events };
}

// ---------------------------------------------------------------------
// Disrupt -- armed on a turn, resolved during the next hand
// ---------------------------------------------------------------------

/** Takes and clears every side's armed Disrupt effects for this hand.
 * combat.ts applies them at the right moments: reveals and the forced
 * discard after the deal, the crib reveal once it is selected. */
export function takePendingDisrupt(combatState: CombatState): { combatState: CombatState; pending: [PendingDisrupt[], PendingDisrupt[]] } {
  const pending: [PendingDisrupt[], PendingDisrupt[]] = [combatState.sides[0].pendingDisrupt, combatState.sides[1].pendingDisrupt];
  const sides = combatState.sides.map((s): CombatSideState => ({ ...s, pendingDisrupt: [] })) as [CombatSideState, CombatSideState];
  return { combatState: { ...combatState, sides }, pending };
}

/** Reveals `cards` as the opponent's hand to `side` (dealt hand after the
 * deal, superseded by the kept hand at the start of play). */
export function revealOpponentHand(combatState: CombatState, side: PlayerIndex, cards: Card[]): CombatState {
  return withSide(combatState, side, { knownOpponentHand: cards });
}

/** Reveals the crib to `side`. */
export function revealCrib(combatState: CombatState, side: PlayerIndex, cards: Card[]): CombatState {
  return withSide(combatState, side, { knownCrib: cards });
}

/** Forces one adversarially chosen card (plus its best companion) out of
 * the opponent's dealt hand into the crib -- ai.ts's bestCardToForce,
 * signed from the target's own crib perspective. */
export function forceOpponentDiscard(combatState: CombatState, caster: PlayerIndex, targetDealtHand: Card[], targetIsOwnCrib: boolean): CombatState {
  return withSide(combatState, opponentOf(caster), { forcedDiscardPair: bestCardToForce(targetDealtHand, targetIsOwnCrib) });
}

// ---------------------------------------------------------------------
// Burners in a fight (session 64, docs/burners-events-design.md BE1-BE3)
// ---------------------------------------------------------------------

/** Applies one combat Burner's effect for `side` (the player). */
export function applyCombatBurner(combatState: CombatState, side: PlayerIndex, burnerId: BurnerId, effect: CombatBurnerEffect): CombatState {
  const sideState = combatState.sides[side];
  const flag = (key: string, onSide: PlayerIndex = side, count = 1): CombatState =>
    withSide(combatState, onSide, { passiveState: { ...combatState.sides[onSide].passiveState, [key]: count } });
  // Persistent Payload (session 65): the player's timed Burner effects last
  // twice as long.
  const timed = effect.kind === 'handBonus' || effect.kind === 'fireTwice' || effect.kind === 'hooksTwice' || effect.kind === 'skipEnemyTurn';
  const persistent = side === 0 && timed && hasMod(combatState, 'persistent-payload');
  if (persistent) noteMod(combatState, 0, ownMod('persistent-payload'));
  const last = (n: number) => (persistent ? n * PERSISTENT_PAYLOAD_MULTIPLIER : n);
  switch (effect.kind) {
    case 'effect':
      return resolveEffect(effect.effect, combatState, side);
    case 'handBonus':
      return withSide(combatState, side, { handBonuses: [...(sideState.handBonuses ?? []), { category: effect.category, effect: effect.effect, handsLeft: last(effect.hands ?? 1) }] });
    case 'fireTwice':
      return flag(BURNER_FIRE_TWICE, side, last(effect.turns));
    case 'hooksTwice':
      return flag(BURNER_HOOKS_TWICE, side, last(effect.hands));
    case 'skipEnemyTurn':
      return flag(BURNER_SKIP_TURN, opponentOf(side), last(effect.turns));
    case 'drainEnemy': {
      const enemy = opponentOf(side);
      const gauge = combatState.sides[enemy].winGauge;
      return withSide(combatState, enemy, { winGauge: { ...gauge, progress: gauge.progress * (1 - effect.fraction) } });
    }
    case 'tempSubroutine':
      return installTempSubroutine(combatState, side, burnerId, effect);
  }
}

/** A temporary subroutine goes in at the top or the bottom of `side`'s
 * installed loadout (above any reactive Mod pieces), replacing any other
 * temporary one: one at a time (BE3). */
function installTempSubroutine(
  combatState: CombatState,
  side: PlayerIndex,
  burnerId: BurnerId,
  effect: Extract<CombatBurnerEffect, { kind: 'tempSubroutine' }>,
): CombatState {
  const without = combatState.sides[side].loadout.filter((e) => !e.temp);
  // Persistent Payload (session 65): the player's last twice as long.
  const persistent = side === 0 && hasMod(combatState, 'persistent-payload');
  if (persistent) noteMod(combatState, 0, ownMod('persistent-payload'));
  const fires = persistent ? effect.fires * PERSISTENT_PAYLOAD_MULTIPLIER : effect.fires;
  const entry: LoadoutEntry = { definition: effect.subroutine, state: createInitialState(), temp: { firesLeft: fires, burnerId } };
  const cleared = withSide(combatState, side, { loadout: without });
  const at = effect.position === 'top' ? 0 : bottomInstalledIndex(cleared, side) + 1;
  return withSide(cleared, side, { loadout: [...without.slice(0, at), entry, ...without.slice(at)] });
}

/** After one of `side`'s turns: each temporary subroutine has one turn
 * fewer left, and leaves when it has none. */
export function tickTempSubroutines(combatState: CombatState, side: PlayerIndex): CombatState {
  const loadout = combatState.sides[side].loadout;
  if (!loadout.some((e) => e.temp)) return combatState;
  const next = loadout
    .map((e) => (e.temp ? { ...e, temp: { ...e.temp, firesLeft: e.temp.firesLeft - 1 } } : e))
    .filter((e) => !e.temp || e.temp.firesLeft > 0);
  return withSide(combatState, side, { loadout: next });
}

/** Whether `side`'s next turn is to be skipped (Denial of Service); if so,
 * the skip is spent. */
export function takeSkippedTurn(combatState: CombatState, side: PlayerIndex): { combatState: CombatState; skipped: boolean } {
  const left = combatState.sides[side].passiveState[BURNER_SKIP_TURN] ?? 0;
  if (!left) return { combatState, skipped: false };
  return { combatState: withSide(combatState, side, { passiveState: { ...combatState.sides[side].passiveState, [BURNER_SKIP_TURN]: left - 1 } }), skipped: true };
}
