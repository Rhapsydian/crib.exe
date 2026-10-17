import type { PlayerIndex } from './pegging';
import type { Card } from './cards';
import type { Archetype, BetaEffect, Effect, SubroutineDefinition, TempoEffect } from './subroutine-types';
import type { ClassId } from './classes';
import { CLASS_DEFINITIONS } from './classes';
import {
  ADAPTATION_EVERY,
  ADAPTATION_STEP,
  NO_WAY_IN_CAP,
  SPOTLIGHT_TRACE,
  ZERO_SUM_SHARE,
  ZERO_SUM_THRESHOLD,
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
} from './mods';
import type { BurnerId } from './burner-types';
import {
  addCharges,
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
  type FiredThisTurn,
  type ScoringOccurrence,
  type SubroutineRuntimeState,
  type SuitPlayed,
  type TriggerContext,
} from './triggers';
import { createInitiativeGauge, createDuelGauge, addDuelProgress, reduceDuelProgress, shrinkDuelThreshold, type InitiativeGauge, type DuelGauge } from './gauges';
import { bestCardToForce } from './ai';

/**
 * Combat resolution for the alpha/beta model (session 51; DESIGN.md
 * "Archetypes & Subroutines", docs/archetype-redesign.md A1-A11).
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
 * docs/design-history.md. The enemy-passive registry is not rebuilt here:
 * the skeleton roster carries no passives, and the real roster's hooks
 * are written when it is (EnemyPassiveId is empty until then).
 */

export interface LoadoutEntry {
  definition: SubroutineDefinition;
  state: SubroutineRuntimeState;
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
  /** Noise generated within this fight only (session 47), raised and
   * lowered by effects' `trace` deltas, floored at 0, surfaced as
   * CombatResult.traceGenerated and folded into run Heat. The enemy side's
   * value is never read -- Trace is player-only. */
  trace: number;
  loadout: LoadoutEntry[];
  /** Accumulating shield from Ward: absorbs the opponent's incoming
   * non-piercing Credit until depleted. */
  wardShield: number;
  /** Points scored so far this hand (pegging and show), reset at each
   * deal -- for `handPointsAtLeast` state betas. */
  handPoints: number;
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
}

export function createCombatSideState(definitions: SubroutineDefinition[], gaugeThreshold: number, winThreshold: number): CombatSideState {
  return {
    gauge: createInitiativeGauge(gaugeThreshold),
    startingThreshold: gaugeThreshold,
    winGauge: createDuelGauge(winThreshold),
    startingWinThreshold: winThreshold,
    trace: 0,
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
  const playerLoadoutWithMods = modAdjustedLoadout([...playerLoadout, ...reactiveModSubroutines(effectiveModIds)], effectiveModIds);
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

/** Clears both sides' hand-scoped intel and forced discards -- called once
 * per hand, before that hand's deal, so nothing stale carries over. */
export function clearHandKnowledge(combatState: CombatState): CombatState {
  const sides = combatState.sides.map((sideState, side): CombatSideState => {
    const hands = (sideState.passiveState[HANDS_SEEN] ?? 0) + 1;
    // Adaptation: every few hands, the owner's growth caps rise.
    const adapting = combatState.sideMods[side].includes('adaptation') && hands % ADAPTATION_EVERY === 0;
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
      handPoints: 0,
      passiveState: { ...sideState.passiveState, [HANDS_SEEN]: hands, [RECEPTION_SPENT]: 0, [ROOT_ACCESS_SPENT]: 0 },
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
const ROOT_ACCESS_SPENT = 'gk:root-spent';
const HANDS_SEEN = 'gk:hands';

export function creditWinGauge(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  if (amount <= 0) return combatState;
  let state = combatState;
  const opponent = opponentOf(side);
  const scratch = state.sides[side].passiveState;
  // Null Session: the first Credit `side` would gain each turn is discarded.
  if (hasSideMod(state, opponent, 'null-session') && !scratch[NULL_SESSION_SPENT]) {
    return withSide(state, side, { passiveState: { ...scratch, [NULL_SESSION_SPENT]: 1 } });
  }
  const gained = scratch[GAINED_THIS_TURN] ?? 0;
  // No Way In: a per-turn cap on what `side` can gain.
  if (hasSideMod(state, opponent, 'no-way-in')) amount = Math.min(amount, Math.max(0, NO_WAY_IN_CAP - gained));
  if (amount <= 0) return state;
  // Zero-Sum: Credit past the threshold in a turn feeds the opponent.
  if (hasSideMod(state, opponent, 'zero-sum')) {
    const excess = Math.max(0, gained + amount - ZERO_SUM_THRESHOLD) - Math.max(0, gained - ZERO_SUM_THRESHOLD);
    if (excess > 0) state = withSide(state, opponent, { winGauge: addDuelProgress(state.sides[opponent].winGauge, excess * ZERO_SUM_SHARE).gauge });
  }
  const { gauge } = addDuelProgress(state.sides[side].winGauge, amount);
  return withSide(state, side, { winGauge: gauge, passiveState: { ...state.sides[side].passiveState, [GAINED_THIS_TURN]: gained + amount } });
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
  if (amplified.size === 0 && !firmware && !thresholdExploit) return loadout;

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
    return next;
  });
}

// ---------------------------------------------------------------------
// Class bridge passives (step 3, C1: one bespoke rule per class, each
// making one archetype feed the other). Every bridge is driven by the
// owner's own scoring or own turns -- never the opponent's -- since that
// is the channel Cribbage skill reaches a fight through (CP6b, S11).
// Amounts are measured against C2's +1.0 Credit/turn budget.
// ---------------------------------------------------------------------

/** Exploit + Overclock: an Exploit beta that applies Empowers the next
 * piece this turn. */
export const BRIDGE_EXPLOIT_OVERCLOCK_EMPOWER = 1;
/** Exploit + Daemon: each fifteen you score also Suppresses. */
export const BRIDGE_EXPLOIT_DAEMON_SUPPRESS = 0.5;
/** Daemon + Overclock: an Overclock beta that applies grows each Daemon
 * piece by this many of its own growth steps. */
export const BRIDGE_DAEMON_OVERCLOCK_STEPS = 1;
/** Exploit + Honeypot: each pair you score banks Ward. */
export const BRIDGE_EXPLOIT_HONEYPOT_WARD = 1;
/** Daemon + Honeypot: Suppress you deal banks that much Ward, up to this
 * much per turn of yours. */
export const BRIDGE_DAEMON_HONEYPOT_CAP = 1;
/** Overclock + Honeypot: each turn you take banks Ward. */
export const BRIDGE_OVERCLOCK_HONEYPOT_WARD = 0.75;

const DAEMON_HONEYPOT_BANKED = 'bridge-daemon-honeypot:banked';

/** A piece fired (on a turn, or as an immediate beta): bridges keyed on
 * "a beta of archetype A applied". */
function applyBridgeOnFire(combatState: CombatState, side: PlayerIndex, fired: SubroutineDefinition, elevated: boolean, turn: TurnBuffer | undefined): CombatState {
  const bridge = combatState.bridges[side];
  if (!bridge || !elevated) return combatState;
  if (bridge === 'exploit-overclock' && fired.archetype === 'exploit' && turn) {
    turn.empowerNext += BRIDGE_EXPLOIT_OVERCLOCK_EMPOWER;
    return combatState;
  }
  if (bridge === 'daemon-overclock' && fired.archetype === 'overclock') {
    return mapLoadout(combatState, side, (entry) => {
      const { growth, growthCap } = entry.definition.alpha;
      if (entry.definition.archetype !== 'daemon' || growth === undefined) return entry.state;
      const growthTotal = Math.min(entry.state.growthTotal + growth * BRIDGE_DAEMON_OVERCLOCK_STEPS, growthCap ?? Infinity);
      return { ...entry.state, growthTotal };
    });
  }
  return combatState;
}

/** A scoring occurrence: bridges keyed on the owner's own scoring. */
function applyBridgeOnOccurrence(combatState: CombatState, occurrence: ScoringOccurrence): CombatState {
  const side = occurrence.player;
  const bridge = combatState.bridges[side];
  if (bridge === 'exploit-daemon' && occurrence.category === 'fifteen') return reduceWinGauge(combatState, opponentOf(side), BRIDGE_EXPLOIT_DAEMON_SUPPRESS);
  if (bridge === 'exploit-honeypot' && occurrence.category === 'pair') {
    return withSide(combatState, side, { wardShield: combatState.sides[side].wardShield + BRIDGE_EXPLOIT_HONEYPOT_WARD });
  }
  return combatState;
}

/** The start of one of `side`'s turns. */
function applyBridgeOnTurnStart(combatState: CombatState, side: PlayerIndex): CombatState {
  const bridge = combatState.bridges[side];
  // Gatekeeper Mods' per-turn counters (No Way In, Zero-Sum, Null
  // Session) restart with each of this side's turns.
  let state = withSide(combatState, side, { passiveState: { ...combatState.sides[side].passiveState, [GAINED_THIS_TURN]: 0, [NULL_SESSION_SPENT]: 0 } });
  if (bridge === 'daemon-honeypot') {
    state = withSide(state, side, { passiveState: { ...state.sides[side].passiveState, [DAEMON_HONEYPOT_BANKED]: 0 } });
  }
  if (bridge === 'overclock-honeypot') {
    state = withSide(state, side, { wardShield: state.sides[side].wardShield + BRIDGE_OVERCLOCK_HONEYPOT_WARD });
  }
  return state;
}

/** `side` dealt `amount` Suppress: Daemon + Honeypot banks it as Ward. */
function applyBridgeOnSuppress(combatState: CombatState, side: PlayerIndex, amount: number): CombatState {
  if (combatState.bridges[side] !== 'daemon-honeypot') return combatState;
  const sideState = combatState.sides[side];
  const banked = sideState.passiveState[DAEMON_HONEYPOT_BANKED] ?? 0;
  const ward = Math.max(0, Math.min(amount, BRIDGE_DAEMON_HONEYPOT_CAP - banked));
  if (ward === 0) return combatState;
  return withSide(combatState, side, {
    wardShield: sideState.wardShield + ward,
    passiveState: { ...sideState.passiveState, [DAEMON_HONEYPOT_BANKED]: banked + ward },
  });
}

// Model-independent Mod hooks carried over from Phase 5.

const MOD_GAUGE_CROSS_FRACTION = 0.5;

/** Warm Boot (start with a small Ward), Cold Boot (start with a small
 * credit) and Cache Prefetch (every banking beta starts with a charge;
 * session 51, was Overclocked Accumulator) -- once per fight, before the
 * first hand. */
export function applyModOnCombatStartPassives(combatState: CombatState): CombatState {
  let state = combatState;
  if (hasMod(state, 'warm-boot')) state = withSide(state, 0, { wardShield: state.sides[0].wardShield + MOD_SMALL });
  if (hasMod(state, 'cold-boot')) state = creditWinGauge(state, 0, MOD_SMALL);
  if (hasMod(state, 'cache-prefetch')) state = mapLoadout(state, 0, (entry) => addCharges(entry.state, entry.definition, CACHE_PREFETCH_CHARGES));
  return state;
}

/** Early Momentum (push the first time the player's gauge crosses half)
 * and First Contact (pull the first time the enemy's does). */
export function applyModGaugeCross50Passives(combatState: CombatState): CombatState {
  let state = combatState;
  if (hasMod(state, 'early-momentum') && passiveStat(state, 0, 'early-momentum:fired') === 0) {
    const gauge = state.sides[0].winGauge;
    if (gauge.progress >= gauge.threshold * MOD_GAUGE_CROSS_FRACTION) {
      state = creditWinGauge(setPassiveStat(state, 0, 'early-momentum:fired', 1), 0, MOD_SMALL);
    }
  }
  if (hasMod(state, 'first-contact') && passiveStat(state, 0, 'first-contact:fired') === 0) {
    const gauge = state.sides[1].winGauge;
    if (gauge.progress >= gauge.threshold * MOD_GAUGE_CROSS_FRACTION) {
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
  if (hasMod(state, 'static-shield')) remaining = Math.max(0, remaining - MOD_SMALL);
  if (hasMod(state, 'surge-protector') && passiveStat(state, 0, 'surge-protector:used') === 0) {
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
export function applyOccurrence(combatState: CombatState, occurrence: ScoringOccurrence): CombatState {
  let state = withSide(combatState, occurrence.player, { handPoints: combatState.sides[occurrence.player].handPoints + occurrence.magnitude });
  state = applyBridgeOnOccurrence(state, occurrence);
  for (const side of [0, 1] as PlayerIndex[]) {
    state = mapLoadout(state, side, (entry) => chargeFromOccurrence(entry.state, entry.definition, occurrence, side));
  }
  return state;
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

function applyTrace(combatState: CombatState, side: PlayerIndex, delta: number | undefined): CombatState {
  if (!delta) return combatState;
  return withSide(combatState, side, { trace: Math.max(0, combatState.sides[side].trace + delta) });
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
  const state = applyTrace(combatState, caster, effect.trace);

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
      if (effect.piercing && !hasSideMod(state, target, 'containment')) return creditWinGauge(state, caster, effect.amount);
      // Plain credit: the target's incoming-credit Mods, then its Ward.
      // Conversion credits above are transfers, not attacks, and skip both.
      const incoming = applyModIncomingCreditPassives(state, target, effect.amount);
      const targetState = incoming.combatState.sides[target];
      const absorbed = Math.min(targetState.wardShield, incoming.amount);
      let next = withSide(incoming.combatState, target, { wardShield: targetState.wardShield - absorbed });
      // Absorbed Ward feeds the defender's `absorbed` betas -- Honeypot's
      // conversion fuel.
      if (absorbed > 0) next = mapLoadout(next, target, (entry) => chargeFromAbsorbed(entry.state, entry.definition, absorbed));
      return creditWinGauge(next, caster, incoming.amount - absorbed);
    }
    case 'suppress':
      return applyBridgeOnSuppress(reduceWinGauge(state, target, effect.amount), caster, effect.amount);
    case 'ward':
      return withSide(state, caster, { wardShield: state.sides[caster].wardShield + effect.amount });
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
  }
}

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
}

/** One side's meters at a moment, as plain numbers. */
export interface GaugeReading {
  win: number;
  winThreshold: number;
  initiative: number;
  initiativeThreshold: number;
  ward: number;
  trace: number;
}

export function readGauges(combatState: CombatState): [GaugeReading, GaugeReading] {
  const read = (s: CombatSideState): GaugeReading => ({
    win: s.winGauge.progress,
    winThreshold: s.winGauge.threshold,
    initiative: s.gauge.progress,
    initiativeThreshold: s.gauge.threshold,
    ward: s.wardShield,
    trace: s.trace,
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
  if (betaEffect?.verb === 'enhance' && scale > 0) state = applyTrace(state, side, betaEffect.trace);
  return { combatState: state, beta: resolvedBeta };
}

/** Applies an alpha's own Trace pressure on the opponent (session 47's
 * enemy-side "make the player visible"). */
function applyTracePressure(combatState: CombatState, side: PlayerIndex, definition: SubroutineDefinition): CombatState {
  // Spotlight: every fire of the owner's pieces adds Trace to its opponent.
  const pressure = (definition.tracePressure ?? 0) + (hasSideMod(combatState, side, 'spotlight') ? SPOTLIGHT_TRACE : 0);
  return pressure > 0 ? applyTrace(combatState, opponentOf(side), pressure) : combatState;
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
  const events: FireEvent[] = [];
  const pass = fireLoadoutOnce(state, side, selfContext);
  state = pass.combatState;
  events.push(...pass.events);
  // Root Access: on the owner's first turn each hand, the loadout fires twice.
  if (hasSideMod(state, side, 'root-access') && !state.sides[side].passiveState[ROOT_ACCESS_SPENT]) {
    state = withSide(state, side, { passiveState: { ...state.sides[side].passiveState, [ROOT_ACCESS_SPENT]: 1 } });
    const again = fireLoadoutOnce(state, side, selfContext);
    state = again.combatState;
    events.push(...again.events);
  }
  return { combatState: tickTimedTempo(state, side), events };
}

/** One top-to-bottom pass of `side`'s loadout (fireTurn's body). */
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

  for (let i = 0; i < loadoutLength; i++) {
    const entry = state.sides[side].loadout[i];
    if (!withinFiringGates(entry.definition, entry.state)) continue;

    const { definition } = entry;
    const beta = definition.beta;
    const context = buildTriggerContext(state, side, selfContext.isDealer, firedThisTurn, i);
    const charges = beta ? betaCharges(definition, entry.state, context) : 0;
    let scale = beta ? betaScale(beta, charges) : 0;
    const elevated = scale > 0;
    // Reception Protocol: the owner's first Exploit beta each hand applies twice.
    if (elevated && definition.archetype === 'exploit' && hasSideMod(state, side, 'reception-protocol') && !state.sides[side].passiveState[RECEPTION_SPENT]) {
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
    state = applyTracePressure(resolved.combatState, side, definition);
    state = mapLoadout(state, side, (e, index) => (index === i ? recordFire(e.state, definition) : e.state));
    state = applyBridgeOnFire(state, side, definition, elevated, turn);

    events.push({ subroutineId: definition.id, side, alpha, beta: resolved.beta, elevated, charges, immediate: false, gauges: readGauges(state) });
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
      state = applyBridgeOnFire(state, side, definition, true, undefined);
      const firedCharges = beta.source === 'cards' || beta.source === 'progress' ? entry.state.charges : 1;
      events.push({ subroutineId: definition.id, side, alpha: alpha ?? (definition.alpha as Effect), beta: resolvedBeta, elevated: true, charges: firedCharges, immediate: true, gauges: readGauges(state) });
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
