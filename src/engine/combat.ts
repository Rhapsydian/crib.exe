import { createRng, deriveAiNoiseSeed } from './rng';
import type { Card } from './cards';
import { createDeck, shuffle } from './deck';
import { deal, discardToCrib, discardLowestTwo, cut, hisHeels, type DiscardContext, type DiscardStrategy } from './deal';
import { advancePegging, playLowestLegal, playPeggingCard, startPegging, type PeggingEvent, type PlayContext, type PlayStrategy } from './pegging';
import { countHandEvents, countCribEvents, type ShowScoreEvent } from './scoring';
import type { HandResult, PlayerIndex } from './game';
import type { SubroutineDefinition } from './subroutine-types';
import type { GatekeeperModId } from './gatekeeper-mods';
import type { ClassId } from './classes';
import type { EnemyPassiveId } from './enemies';
import type { ModId } from './mod-types';
import type { BurnerId, BurnerTiming } from './burner-types';
import { BURNER_DEFINITIONS } from './burners';
import { OVERCLOCKED_KERNEL_BAR } from './mods';
import {
  occurrencesFromPeggingEvent,
  occurrencesFromHandEvents,
  occurrenceFromHisHeels,
  occurrencePoints,
  pairsIn,
  repriceOccurrence,
  suitPlayedFromPeggingEvent,
  type ScoringOccurrence,
} from './triggers';
import { addPoints, shrinkDuelThreshold, type InitiativeGauge } from './gauges';
import {
  applyModGaugeCross50Passives,
  applyModOnCombatStartPassives,
  applyOccurrence,
  applySuitPlayed,
  clearHandKnowledge,
  applyCutMods,
  applyHandEndMods,
  applyShowMods,
  bridgeUpgradedFor,
  addSideHeat,
  countLateralPairs,
  armThirtyOne,
  playerHasMod,
  createCombatState,
  fireImmediateBetas,
  fireTurn,
  forceOpponentDiscard,
  applyCombatBurner,
  tickTempSubroutines,
  takeSkippedTurn,
  revealCrib,
  revealOpponentHand,
  takePendingDisrupt,
  type CombatState,
  type CombatSideState,
  type FireEvent,
  type GaugeReading,
  type ModRef,
  readGauges,
} from './resolve';

/**
 * The combat orchestrator (session 17 checkpoint F; re-pointed to the
 * alpha/beta model in session 51): plays real hands of Cribbage, feeds
 * each hand's scoring into both sides' initiative gauges and beta charges
 * one discrete event at a time, in the real chronological order (his heels
 * at the cut, pegging play-by-play, then non-dealer hand / dealer hand /
 * crib at the show), fires a side's whole loadout the instant its gauge
 * crosses its threshold, fires `immediate` betas the instant their
 * criteria are met, and continues until Breach/Containment resolves.
 */

/** System strain (S12) starts on the player's third turn in a row. */
export const STRAIN_FROM = 3;

export interface CombatOptions {
  /** System strain (session 66, S12): the Heat the player's third
   * consecutive turn adds, rising by this much each further turn. Absent:
   * no strain (duels). */
  strainHeat?: number;
  /** The player's class Mod is its "II" version (session 65, M10). */
  classModUpgraded?: boolean;
  /** The player's benched subroutines (session 65): Hot Standby fires
   * their Processes at half strength. */
  benched?: SubroutineDefinition[];
  /** The fight's tier, when it's part of a run (session 64): the simulated
   * player saves its combat Burners for elites and gatekeepers. */
  fightTier?: 'regular' | 'elite' | 'gatekeeper';
  seed: number;
  /** Per-side initiative-gauge threshold (session 40: was one shared
   * scalar applied to both sides; gauges.ts's InitiativeGauge always
   * modeled a side's own threshold independently, the symmetry was only
   * ever imposed here). Index 0 is the player's own, index 1 the
   * enemy's. */
  gaugeThreshold: [number, number];
  /** Per-side threshold for each side's own win-gauge (gauges.ts's
   * DuelGauge) -- independent per side (session 40 redesign; previously
   * one shared scalar, see gaugeThreshold's own note above). Defaults to
   * [100, 100], mirroring the old shared scalar's scale, though it's an
   * independent TBD/playtesting number now, not tied to any 0-100 shared
   * axis. */
  winThreshold?: [number, number];
  /** Per-side discard/play strategies (session 24, tunable-skill AI
   * checkpoint A) -- each side gets its own, rather than one shared
   * function used for both. Both default to `[discardLowestTwo,
   * discardLowestTwo]` / `[playLowestLegal, playLowestLegal]`,
   * preserving every existing call site's behavior exactly. */
  discardStrategies?: [DiscardStrategy, DiscardStrategy];
  playStrategies?: [PlayStrategy, PlayStrategy];
  startingDealer?: PlayerIndex;
  /** Which starting passive (if any) to check at its hook points --
   * Phase 4 checkpoint B. Only side 0 (the player) ever has a class. */
  classId?: ClassId;
  /** A class bridge passive for side 1 (step 3, C2) -- diagnostic only,
   * so a pricing duel can give a bridge to the test side in either seat.
   * Never set by real play. */
  opponentBridge?: ClassId;
  /** Each side's gatekeeper Mods (step 3, E4). Side 1's are a
   * gatekeeper's; side 0's only for pricing duels. */
  gatekeeperMods?: [GatekeeperModId[], GatekeeperModId[]];
  /** Which passive(s) side 1 (the enemy) carries this combat -- Phase 5
   * checkpoint B. Defaults to none, same "absent = no passives active"
   * treatment classId already gets. */
  enemyPassiveIds?: EnemyPassiveId[];
  /** Which Mod(s) side 0 (the player) owns this combat, beyond the
   * current class's own guaranteed class-exclusive one (see
   * resolve.ts's createCombatState) -- Phase 5 Mods checkpoint B.
   * Defaults to none. */
  ownedModIds?: ModId[];
  /** Which Burner(s) side 0 (the player) is carrying into this combat,
   * already filtered to combat-context ones -- Phase 5 Burners
   * checkpoint B, mirroring ownedModIds' side-0-only convention.
   * Defaults to none. */
  carriedBurnerIds?: BurnerId[];
  /** Per-side Burner-activation strategy (checkpoint C wires the actual
   * call site) -- mirrors discardStrategies/playStrategies' per-side
   * tuple shape. Side 1 (the enemy) has no Burner economy and should
   * always return null; both default to `() => null` (no Burner ever
   * activated), preserving every existing call site's behavior exactly. */
  burnerActivationStrategies?: [BurnerActivationStrategy, BurnerActivationStrategy];
}

/** Context passed to a BurnerActivationStrategy for one turn's decision
 * -- mirrors DiscardStrategy/PlayStrategy/CutStrategy's plain-function-
 * over-one-context-object shape (deal.ts/pegging.ts). availableBurnerIds
 * (checkpoint C) is combatState.carriedBurnerIds with this combat's
 * already-used copies removed one-for-one -- carriedBurnerIds itself is
 * a fixed start-of-combat snapshot (checkpoint B), so this is the field
 * a strategy should actually pick from. */
export interface BurnerActivationContext {
  combatState: CombatState;
  side: PlayerIndex;
  isDealer: boolean;
  availableBurnerIds: BurnerId[];
  /** Which offer this is (session 64, BE2): "now" right after your
   * discard or card, "nextTurn" at the start of your turn. Only Burners
   * of that timing are available. */
  timing: BurnerTiming;
  /** The fight's tier, when known (CombatOptions.fightTier). */
  fightTier?: 'regular' | 'elite' | 'gatekeeper';
}

/** Picks which (if any) available Burner to activate this turn, or null
 * to activate none. Called once per turn-loop iteration (checkpoint C's
 * call site, this file's per-occurrence turn loop), before that
 * iteration's fireReadySubroutines call -- an "opening move" framing.
 * Returning an id not present in ctx.availableBurnerIds is treated the
 * same as null (silently ignored). */
export type BurnerActivationStrategy = (ctx: BurnerActivationContext) => BurnerId | null;

/** Default for both sides until checkpoint C gives scripts a real
 * choice to make -- never activates a Burner. */
export const neverActivateBurner: BurnerActivationStrategy = () => null;

export interface CombatResult {
  winner: PlayerIndex;
  log: FireEvent[];
  /** See CombatBeat. */
  timeline: CombatBeat[];
  hands: HandResult[];
  /** Each side's own highest win-gauge fill fraction (progress/threshold,
   * 0-1) reached at any point in the match -- session 9's "how far the
   * player pushed toward their own win before losing" idea, ported to the
   * two-gauge redesign (session 22+). A side's gauge only ever increases
   * via its own offense and never decreases on its own (unlike the old
   * shared scalar, which could get dragged back), so this peak is really
   * "how close did this side get before the match ended," used by Phase 3's
   * Heat formula for margin-of-loss. Index 0 is the player's own peak. */
  peakFillFraction: [number, number];
  /** Each side's win-gauge fill fraction (progress/threshold, clamped to
   * 0-1) at the moment the fight ended (session 52). Unlike the peak, this
   * is what is on screen when the fight resolves -- R6's performance term
   * reads the enemy's (index 1). */
  finalFillFraction: [number, number];
  /** Heat the enemy's alarms (`heatPressure`, Spotlight) raised against
   * the player (side 0) during this fight -- surfaced so encounters.ts can
   * add it to run Heat, win or lose. Heat is player-only (session 43). */
  heatGenerated: number;
  /** How the match actually ended (session 27, checkpoint E): 'threshold'
   * -- a side genuinely crossed its own win-gauge threshold, the normal
   * way. 'attrition' -- neither side had, by HARD_RESOLUTION_HAND, so
   * the defender (side 1) won by having successfully denied the
   * attacker (side 0) a breach in time, not by generating any progress
   * of its own. Surfaced so a balance sweep can tell "real offense" wins
   * apart from "successfully stalled" wins -- see resolveHardTiebreak's
   * own doc comment for why an attrition win no longer needs the
   * defender to have any win-gauge progress at all. */
  resolvedBy: 'threshold' | 'attrition';
  /** Which carried Burner(s) side 0 actually activated this combat --
   * Phase 5 Burners checkpoint B, mirroring heatGenerated's own
   * three-hop pattern (combat.ts -> encounters.ts's EncounterOutcome ->
   * run.ts, which removes these from RunPlayerState.carriedBurnerIds
   * once the fight resolves). Always empty until checkpoint C's
   * activation strategy is actually wired up and used. */
  burnersUsedThisCombat: BurnerId[];
}

function replaceSideGauge(combatState: CombatState, side: PlayerIndex, gauge: InitiativeGauge): CombatState {
  const sides = combatState.sides.slice() as [CombatSideState, CombatSideState];
  sides[side] = { ...sides[side], gauge };
  return { ...combatState, sides };
}

/** carriedBurnerIds minus already-used copies, one-for-one (not a Set
 * difference -- duplicate ids are legal, checkpoint B). Same logic
 * run.ts's own end-of-encounter removal uses, scoped here to one
 * in-progress combat instead of a whole run. */
function remainingBurnerIds(carried: BurnerId[], used: BurnerId[]): BurnerId[] {
  const remaining = [...carried];
  for (const usedId of used) {
    const index = remaining.indexOf(usedId);
    if (index !== -1) remaining.splice(index, 1);
  }
  return remaining;
}

/** A side wins the instant its own win-gauge reaches its own threshold.
 * If both sides somehow cross in the same step (including from an
 * escalation-driven threshold shrink), side 0 resolves first --
 * deterministic, matches the engine's existing fixed side-processing
 * order elsewhere. */
function resolution(combatState: CombatState): PlayerIndex | null {
  const [side0, side1] = combatState.sides;
  if (side0.winGauge.progress >= side0.winGauge.threshold) return 0;
  if (side1.winGauge.progress >= side1.winGauge.threshold) return 1;
  return null;
}

/** Fires every `immediate` beta whose criteria are now met, appends the
 * events to `log`, and reports whether the match resolved -- an immediate
 * beta can credit a gauge like any fire. Call after every step that can
 * bank a charge or change a state condition: a scoring occurrence, a
 * card played, a turn, escalation. */
function immediates(
  combatState: CombatState,
  handDealer: PlayerIndex,
  log: FireEvent[],
): { combatState: CombatState; winner: PlayerIndex | null } {
  const fired = fireImmediateBetas(combatState, handDealer);
  log.push(...fired.events);
  return { combatState: fired.combatState, winner: resolution(fired.combatState) };
}

// Escalation (session 22+): a match still resolves faster once it's
// gone on long enough that "genuinely competitive" tuning can afford
// to be patient early on -- see BACKLOG.md for the sharp positive-
// feedback/stalemate risk this exists to bound. Retuned session 26:
// starts at hand 10 (this project's own empirical finding is that
// normal, healthy fights already converge in ~10-25 hands on their
// own -- close to a real Cribbage game's typical 9-12 -- so this is
// squarely a stalemate rescue for the slow tail, not a broad tempo
// pacer for the typical case), and shrinks fast enough to reach the
// floor by hand 20 -- "effectively sudden death" by then, not just a
// gentle nudge. Since a side's own banked progress never resets when its
// threshold shrinks, reaching the floor while either side already has
// meaningful progress banked resolves the match almost immediately --
// that's what makes hand 20 feel like sudden death for most fights. It's
// not a guarantee on its own, though -- see HARD_RESOLUTION_HAND below
// for the actual backstop that makes hand 20 a true, unconditional
// deadline. All TBD/playtesting, same placeholder convention as
// everywhere else in this project.
//
// Session 48 made the shrink rate and the floor *derived per side*
// rather than flat constants. They were 4/hand and 10, both silently
// calibrated against a single shared win threshold of 50: (50 - 10) / 10
// hands of escalation = 4. That assumption broke the moment
// encounters.ts split BREACH_THRESHOLD from CONTAINMENT_THRESHOLD and
// gave meta-progression a socket to move them independently -- a flat
// 4/hand against a player bar lowered to 40 would reach the floor at
// hand 17 while the enemy's reached it at 20, handing out a three-hand
// sudden-death window as a side effect of an unrelated upgrade. Deriving
// both from each side's own starting bar reproduces exactly 4 and 10 at
// 50, and keeps "reach your own floor precisely at the deadline" true at
// any value either side actually starts from.
const ESCALATION_START_HAND = 10;
/** Hands of escalation before a side reaches its own floor --
 * HARD_RESOLUTION_HAND minus ESCALATION_START_HAND, i.e. the floor is
 * reached exactly as the deadline lands. */
const ESCALATION_HANDS = 10;
/** A side's escalation floor, as a share of its own starting win
 * threshold -- 1/5 reproduces the old flat 10 against the old shared
 * base of 50. */
const ESCALATION_MIN_FRACTION = 1 / 5;

/** A side's own escalation floor. Exported for tests -- the derivation
 * is the whole point of session 48's change here, and asserting it
 * directly is far more robust than calibrating a stochastic fight to
 * straddle it. */
export function escalationFloorFor(startingWinThreshold: number): number {
  return Math.max(1, Math.round(startingWinThreshold * ESCALATION_MIN_FRACTION));
}

/** A side's own per-hand escalation shrink -- whatever rate carries it
 * from its starting bar to its own floor across exactly
 * ESCALATION_HANDS. Exported for tests, same reasoning as above. */
export function escalationShrinkPerHandFor(startingWinThreshold: number): number {
  return Math.max(1, (startingWinThreshold - escalationFloorFor(startingWinThreshold)) / ESCALATION_HANDS);
}

/** Shrinks both sides' own win-gauge thresholds toward their own floors,
 * never touching progress. Called once per hand once the match has run
 * at least ESCALATION_START_HAND hands, so even a slow trickle of
 * progress eventually crosses the (shrinking) bar. Each side's rate is
 * derived from its own starting bar, so a side that starts higher
 * shrinks faster and still lands on its floor at the same hand -- see
 * the note above for why that stopped being true with one flat rate. */
function applyEscalation(combatState: CombatState): CombatState {
  const sides = combatState.sides.map((sideState) =>
    ({
      ...sideState,
      winGauge: shrinkDuelThreshold(
        sideState.winGauge,
        escalationShrinkPerHandFor(sideState.startingWinThreshold),
        escalationFloorFor(sideState.startingWinThreshold),
      ),
    })) as [CombatSideState, CombatSideState];
  return { ...combatState, sides };
}

// Hard resolution deadline (session 26, continued): escalation alone
// only makes hand 20 *feel* like sudden death -- it lowers the bar,
// but can't force either gauge upward, so a genuinely mutual
// stalemate (both sides suppressing each other's progress as fast as
// it accumulates, or a kit that can never land a hit at all -- see
// subroutines.test.ts's solo-Encryption-pool case) can still run past
// whatever hand-count bound existed at the time without ever crossing
// either threshold, throwing instead of returning a result. Found as a
// real, if rare, occurrence in this session's own 500-seed re-sweep
// (Ghost, once its passive rework let it genuinely contest). The user's
// call: no fight should ever fail to resolve, full stop -- so at the
// end of hand 20 (the same hand escalation's own shrink schedule
// already reaches its floor by), force a real winner regardless of
// whether either threshold was actually crossed. This made the old
// FIGHT_MAX_HANDS/maxHands concept vestigial from this point on --
// every real fight resolves well before it could ever matter -- and it
// was finally removed outright in session 39 rather than kept as an
// unreachable defensive bound.
const HARD_RESOLUTION_HAND = 20;

/**
 * Consecutive turns one side may take without the other acting before
 * the fight is declared systemically broken (session 47).
 *
 * A turn is normally bought by *scoring*, so one side taking dozens in a
 * row is not a difficulty outlier -- it means something is granting turns
 * faster than they are consumed. That is exactly what session 47 found:
 * Cold Call Hastes its own initiative gauge, and once Merge lifts it to
 * the gauge threshold one fire buys a whole turn, which fires it again.
 * Grants compound across occurrences (1, 2, 4, ...) until the process
 * dies on a 4GB heap.
 *
 * Deliberately a **loud, fatal throw rather than a silent cap**. A cap
 * would convert this class of bug into a quiet dominant strategy and
 * hide the next one -- and there has already been a next one: session 28
 * found the Choked/Haste threshold variant the same way. scripts/sweep.ts
 * documents killing a hung sweep from outside and reading the last
 * printed line; this turns that into an immediate, located failure with
 * the state needed to reproduce it.
 *
 * Sized to catch *non-termination*, not merely strong tempo. The first
 * run of this detector immediately found a second, milder degeneracy: a
 * side whose initiative threshold has been ground down to
 * MIN_INITIATIVE_THRESHOLD (1) takes a turn per point scored, and was
 * observed taking 53 in a row. That case still terminates -- it is
 * bounded by points actually scored in the hand -- so it is a balance
 * problem, not a hang, and must not be fatal. A true runaway compounds
 * without bound (the Cold Call case reached a 4GB heap), so it blows
 * through any threshold set above the bounded cases.
 */
const MAX_CONSECUTIVE_TURNS = 200;

/** Forces a winner at the hard resolution deadline (session 27,
 * checkpoint E revision): the defender, side 1, unconditionally --
 * "attrition." Reaching this function at all already means side 0 (the
 * attacker) failed to cross its own Breach threshold in time (normal
 * resolution() would have ended the match already if it had), so under
 * the Breach/Containment fiction that's containment achieved, full
 * stop -- not a race decided by whoever's *closer*. This replaces
 * session 26's fraction-comparison version (only an exact tie went to
 * the defender; a side 0 with any nonzero fractional lead, however
 * thin, used to win outright without ever actually breaching) --
 * "closer" was never the right question once a stalemate itself is the
 * defense's real win condition, particularly for kits with no
 * win-gauge-crediting offense of their own (an Encryption-only or
 * Root-only kit can *only* ever win this way, by design -- see
 * DESIGN.md). Real difficulty consequence, not scoped to those kits:
 * *every* fight the attacker hasn't already closed out by hand 20 is
 * now a loss, where previously a narrow fractional lead could still
 * win it. */
function resolveHardTiebreak(): PlayerIndex {
  return 1;
}


/**
 * A decision the combat generator needs answered (milestone 1,
 * `docs/playable-design.md` P1): which two cards to discard, which card to
 * peg, or which Burner (if any) to activate before a turn. The generator
 * yields one and is resumed with the answer -- `[Card, Card]`, a `Card`,
 * or a `BurnerId | null` respectively. Requests are yielded for BOTH
 * sides; a driver decides who answers each (the AI, or a human).
 */
export type CombatRequest =
  | { kind: 'discard'; side: PlayerIndex; context: DiscardContext; view: CombatView }
  | { kind: 'play'; side: PlayerIndex; context: PlayContext; view: CombatView; pegging: PeggingView }
  | { kind: 'burner'; side: PlayerIndex; context: BurnerActivationContext; view: CombatView };

/** The pegging table as it stands at a play request: what the player
 * holds (legal or not), and how many cards the opponent has left. */
export interface PeggingView {
  hand: Card[];
  opponentCardsLeft: number;
  /** Every pegging event so far this hand, both sides, in order. */
  events: readonly PeggingEvent[];
}

/** The fight as it stands when a request is yielded -- what a UI draws
 * while the player decides (gauges, Ward, Heat, loadout state, the log).
 * Read-only: the generator owns the fight. */
export interface CombatView {
  combatState: CombatState;
  log: readonly FireEvent[];
  timeline: readonly CombatBeat[];
  hands: readonly HandResult[];
  /** The hand being played (0-based), and its dealer. */
  handIndex: number;
  dealer: PlayerIndex;
}

export type CombatAnswer = [Card, Card] | Card | BurnerId | null;

/**
 * The fight's running timeline (milestone 2 checkpoint 3a): everything
 * that happens at the table, in order, for the UI to animate -- a hand
 * starting, the cut, each pegging event (a card played, a go, the go
 * point), and each scoring occurrence as it lands on the scorer's
 * initiative gauge. Fires stay in `log`; each beat's `firesBefore` is
 * the log's length when the beat happened, which places every fire
 * between the beats exactly. Not read by the engine.
 */
/** Omit over each member of a union (plain Omit collapses it). */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type CombatBeat = (
  | { kind: 'hand'; handIndex: number; dealer: PlayerIndex }
  | { kind: 'cut'; starter: Card; dealer: PlayerIndex }
  | { kind: 'peg'; event: PeggingEvent }
  | {
      kind: 'points';
      phase: 'cut' | 'peg' | 'show';
      occurrence: ScoringOccurrence;
      /** Both sides' meters once the points are on the gauge, before any
       * turn they buy. */
      gauges: [GaugeReading, GaugeReading];
      /** At the show, the cards that make the score. */
      cards?: Card[];
    }
  | {
      /** A hand laid out at the show (checkpoint 3b): the non-dealer's,
       * then the dealer's, then the crib (the dealer's). Its points beats
       * follow; `total` is what they add up to. */
      kind: 'show';
      owner: 'hand' | 'crib';
      player: PlayerIndex;
      cards: Card[];
      starter: Card;
      total: number;
    }
  | {
      /** A Mod that acted outside any fire (a fire carries its own in
       * `FireEvent.mods`): a bridge on scoring or a turn's start, a
       * gatekeeper's per-hand Mod, a start-of-fight Mod. */
      kind: 'mod';
      side: PlayerIndex;
      mod: ModRef;
    }
  | {
      /** A turn starting (the user's ask: a toast for every turn, either
       * side). Comes before the turn's Burner offer and its fires. */
      kind: 'turn';
      side: PlayerIndex;
    }
  | {
      /** System strain (S12): the player's turns in a row, and the Heat
       * this one added. */
      kind: 'strain';
      heat: number;
      turns: number;
    }
  | {
      /** A Burner spent before a turn. */
      kind: 'burner';
      side: PlayerIndex;
      burnerId: BurnerId;
      gauges: [GaugeReading, GaugeReading];
    }
) & { firesBefore: number };

/**
 * Plays a fight to its end, answering every request from the given
 * strategies (the simulation driver). Behaves as playCombat always has;
 * the fight itself lives in combatGenerator.
 */
export function playCombat(loadouts: [SubroutineDefinition[], SubroutineDefinition[]], options: CombatOptions): CombatResult {
  const {
    discardStrategies = [discardLowestTwo, discardLowestTwo],
    playStrategies = [playLowestLegal, playLowestLegal],
    burnerActivationStrategies = [neverActivateBurner, neverActivateBurner],
  } = options;
  const fight = combatGenerator(loadouts, options);
  let step = fight.next();
  while (!step.done) {
    const request = step.value;
    const answer: CombatAnswer =
      request.kind === 'discard'
        ? discardStrategies[request.side](request.context)
        : request.kind === 'play'
          ? playStrategies[request.side](request.context)
          : burnerActivationStrategies[request.side](request.context);
    step = fight.next(answer);
  }
  return step.value;
}

/**
 * One fight, as a generator: it yields a CombatRequest at each decision
 * and is resumed with the answer (see CombatRequest). Combat resolves
 * LIVE during pegging (P8): each play's suit tally, then its scoring
 * events, then any turns and instant Hooks they trigger, all resolve
 * before the next card is chosen -- so a player pegs against the current
 * gauges. The cut's His Heels resolves at the cut; the show resolves item
 * by item after pegging. Disrupt still lands on the next hand.
 */
export function* combatGenerator(
  loadouts: [SubroutineDefinition[], SubroutineDefinition[]],
  options: CombatOptions,
): Generator<CombatRequest, CombatResult, CombatAnswer> {
  const {
    seed,
    gaugeThreshold,
    winThreshold = [100, 100],
    startingDealer = 0,
    classId,
    opponentBridge,
    gatekeeperMods,
    enemyPassiveIds = [],
    ownedModIds = [],
    carriedBurnerIds = [],
    benched = [],
    classModUpgraded = false,
    strainHeat = 0,
  } = options;

  const rng = createRng(seed);
  // Session 26: a separate, decorrelated stream for AI-decision noise
  // (see rng.ts's deriveAiNoiseSeed) -- never consumed by
  // shuffles/cuts, so adding or changing how often the AI "rolls dice"
  // can't perturb `rng`'s own sequence, which many existing tests
  // assert exact deals/starters against.
  const aiRng = createRng(deriveAiNoiseSeed(seed));
  let dealer: PlayerIndex = startingDealer;
  // Loop detector bookkeeping (session 47) -- see MAX_CONSECUTIVE_TURNS.
  // Spans the whole fight rather than resetting per hand: a runaway
  // compounds across occurrences and hands alike.
  let consecutiveTurns = 0;
  let lastTurnSide: PlayerIndex | null = null;
  let scores: [number, number] = [0, 0];
  // Overclocked Kernel (session 65): the player's initiative bar is longer.
  const thresholds: [number, number] = ownedModIds.includes('overclocked-kernel') ? [gaugeThreshold[0] + OVERCLOCKED_KERNEL_BAR, gaugeThreshold[1]] : gaugeThreshold;
  const created = createCombatState(loadouts[0], loadouts[1], thresholds, classId, winThreshold, enemyPassiveIds, ownedModIds, carriedBurnerIds, opponentBridge, gatekeeperMods);
  let combatState = applyModOnCombatStartPassives({ ...created, modTriggers: [], standby: benched, bridgeUpgraded: [classModUpgraded, false] });
  const hands: HandResult[] = [];
  const log: FireEvent[] = [];
  const timeline: CombatBeat[] = [];
  let peakFillFraction: [number, number] = [0, 0];
  // Checkpoint C populates this from the real activation call site --
  // always empty until burnerActivationStrategies is actually wired up.
  const burnersUsedThisCombat: BurnerId[] = [];

  const finish = (winner: PlayerIndex, resolvedBy: 'threshold' | 'attrition' = 'threshold'): CombatResult => (flushMods(), {
    winner,
    log,
    timeline,
    hands,
    peakFillFraction,
    finalFillFraction: [
      Math.min(1, combatState.sides[0].winGauge.progress / combatState.sides[0].winGauge.threshold),
      Math.min(1, combatState.sides[1].winGauge.progress / combatState.sides[1].winGauge.threshold),
    ],
    heatGenerated: combatState.sides[0].heat,
    resolvedBy,
    burnersUsedThisCombat,
  });

  /** Applies one step's result, tracks each side's running win-gauge
   * fill-fraction peak, and returns the winner if the step resolved the
   * match -- every state-changing step in this loop goes through this so
   * peak tracking and resolution checks stay uniform. Also runs the
   * gauge-crosses-half Mod hooks, which need to see every step uniformly
   * whatever caused it, and re-derives the winner afterward. */
  const step = (result: { combatState: CombatState; winner: PlayerIndex | null }): PlayerIndex | null => {
    combatState = applyModGaugeCross50Passives(result.combatState);
    const [side0, side1] = combatState.sides;
    peakFillFraction = [
      Math.max(peakFillFraction[0], side0.winGauge.progress / side0.winGauge.threshold),
      Math.max(peakFillFraction[1], side1.winGauge.progress / side1.winGauge.threshold),
    ];
    return result.winner !== null ? result.winner : resolution(combatState);
  };

  /** Resolves one scoring occurrence live: its charges and instant Hooks,
   * then the scorer's initiative gauge, then every turn it buys (each
   * preceded by a Burner request). Returns the winner if it decided the
   * fight. */
  // Built as the engine pauses, so any Mod triggers still pending go out first.
  const view = (handIndex: number, handDealer: PlayerIndex): CombatView => {
    flushMods();
    return { combatState, log, timeline, hands, handIndex, dealer: handDealer };
  };
  const beat = (b: DistributiveOmit<CombatBeat, 'firesBefore'>): void => {
    timeline.push({ ...b, firesBefore: log.length } as CombatBeat);
    flushMods();
  };
  /** Mod triggers no fire took become beats where they stand. */
  function flushMods(): void {
    const sink = combatState.modTriggers;
    if (!sink || sink.length === 0) return;
    for (const t of sink.splice(0)) timeline.push({ kind: 'mod', side: t.side, mod: t.mod, firesBefore: log.length });
  }
  let phase: 'cut' | 'peg' | 'show' = 'cut';

  /** Offers `side` its available Burners of one timing (session 64,
   * BE2) and applies the one chosen. Only the player carries Burners. */
  function* offerBurner(side: PlayerIndex, timing: BurnerTiming, handIndex: number, handDealer: PlayerIndex): Generator<CombatRequest, PlayerIndex | null, CombatAnswer> {
    if (side !== 0) return null;
    const availableBurnerIds = remainingBurnerIds(combatState.carriedBurnerIds, burnersUsedThisCombat).filter((id) => BURNER_DEFINITIONS[id].combat?.timing === timing);
    if (availableBurnerIds.length === 0) return null;
    const chosenBurnerId = (yield {
      kind: 'burner',
      side,
      context: { combatState, side, isDealer: side === handDealer, availableBurnerIds, timing, fightTier: options.fightTier },
      view: view(handIndex, handDealer),
    }) as BurnerId | null;
    const burnerDef = chosenBurnerId && availableBurnerIds.includes(chosenBurnerId) ? BURNER_DEFINITIONS[chosenBurnerId] : undefined;
    if (!chosenBurnerId || !burnerDef?.combat) return null;
    burnersUsedThisCombat.push(chosenBurnerId);
    const afterBurner = applyCombatBurner(combatState, side, chosenBurnerId, burnerDef.combat.effect);
    beat({ kind: 'burner', side, burnerId: chosenBurnerId, gauges: readGauges(afterBurner) });
    return step({ combatState: afterBurner, winner: resolution(afterBurner) });
  }

  function* resolveOccurrence(
    tableOccurrence: ScoringOccurrence,
    handDealer: PlayerIndex,
    handIndex: number,
    cards?: Card[],
  ): Generator<CombatRequest, PlayerIndex | null, CombatAnswer> {
    // The scorer's own scoring rule (the Folds) reprices it first.
    const occurrence = repriceOccurrence(tableOccurrence, combatState.sides[tableOccurrence.player].scoringRule);
    // Charges first, so a beta charged by this very occurrence applies
    // on the turn it buys.
    let winner = step(immediates(applyOccurrence(combatState, occurrence, handDealer), handDealer, log));
    if (winner !== null) return winner;

    let points = occurrencePoints(occurrence);
    // Lateral Movement II (session 65, M10): the scorer's second pair each
    // hand gives a turn at once (a pair royal is three pairs).
    if (occurrence.category === 'pair' && bridgeUpgradedFor(combatState, occurrence.player, 'exploit-overclock')) {
      const counted = countLateralPairs(combatState, occurrence.player, pairsIn(occurrence));
      combatState = counted.combatState;
      if (counted.turn) {
        const g = combatState.sides[occurrence.player].gauge;
        points = Math.max(points, g.threshold - g.progress);
      }
    }
    // Thirty-One (session 65): pegging to exactly 31 gives the player a
    // turn at once.
    if (occurrence.player === 0 && occurrence.category === 'thirtyOne' && playerHasMod(combatState, 'thirty-one')) {
      combatState = armThirtyOne(combatState);
      const g = combatState.sides[0].gauge;
      points = Math.max(points, g.threshold - g.progress);
    }
    const { gauge, turnsTriggered } = addPoints(combatState.sides[occurrence.player].gauge, points);
    combatState = replaceSideGauge(combatState, occurrence.player, gauge);
    beat({ kind: 'points', phase, occurrence, gauges: readGauges(combatState), ...(cards ? { cards } : {}) });

    if (turnsTriggered > 0) {
      consecutiveTurns = occurrence.player === lastTurnSide ? consecutiveTurns + turnsTriggered : turnsTriggered;
      lastTurnSide = occurrence.player;
      if (consecutiveTurns > MAX_CONSECUTIVE_TURNS) {
        const side = occurrence.player;
        const g = combatState.sides[side].gauge;
        throw new Error(
          `playCombat: side ${side} has taken ${consecutiveTurns} consecutive turns without the opponent acting -- ` +
            `a systemic turn loop, not legitimate play (see MAX_CONSECUTIVE_TURNS). ` +
            `hand=${handIndex} seed=${seed} classId=${classId ?? 'none'} ` +
            `gauge=${g.progress}/${g.threshold} turnsTriggeredThisOccurrence=${turnsTriggered} ` +
            `loadout=[${combatState.sides[side].loadout.map((e) => e.definition.id).join(' ')}]`,
        );
      }
    }

    for (let turn = 0; turn < turnsTriggered; turn++) {
      beat({ kind: 'turn', side: occurrence.player });
      // System strain (S12): the player's third turn in a row and every
      // one after adds Heat, more each turn.
      const inARow = consecutiveTurns - turnsTriggered + turn + 1;
      if (occurrence.player === 0 && strainHeat > 0 && inARow >= STRAIN_FROM) {
        const heat = strainHeat * (inARow - STRAIN_FROM + 1);
        combatState = addSideHeat(combatState, 0, heat);
        beat({ kind: 'strain', heat, turns: inARow });
      }
      // Denial of Service (session 64): a skipped turn fires nothing.
      const skip = takeSkippedTurn(combatState, occurrence.player);
      if (skip.skipped) {
        combatState = skip.combatState;
        continue;
      }
      // "Next turn" Burners (checkpoint C; session 64 BE2): an opening
      // move resolved before this turn's automatic subroutine fires.
      winner = yield* offerBurner(occurrence.player, 'nextTurn', handIndex, handDealer);
      if (winner !== null) return winner;

      const fired = fireTurn(combatState, occurrence.player, { isDealer: occurrence.player === handDealer });
      // Triggers left over from the turn (its start: a bridge, Root
      // Access) go before its fires.
      flushMods();
      log.push(...fired.events);
      winner = step({ combatState: fired.combatState, winner: resolution(fired.combatState) });
      if (winner !== null) return winner;
      // Temporary subroutines (BE3) count down a turn, and leave at zero.
      combatState = tickTempSubroutines(combatState, occurrence.player);

      // A turn can bank charges or flip a condition for either side.
      winner = step(immediates(combatState, handDealer, log));
      if (winner !== null) return winner;
    }
    return null;
  }

  /** Resolves one pegging event live (P8): a play's suit tally, then its
   * scoring occurrences; a go point's occurrence. */
  function* resolvePeggingEvent(event: PeggingEvent, handDealer: PlayerIndex, handIndex: number): Generator<CombatRequest, PlayerIndex | null, CombatAnswer> {
    beat({ kind: 'peg', event });
    const suitPlayed = suitPlayedFromPeggingEvent(event);
    if (suitPlayed) {
      const winner = step(immediates(applySuitPlayed(combatState, suitPlayed), handDealer, log));
      if (winner !== null) return winner;
    }
    for (const occurrence of occurrencesFromPeggingEvent(event)) {
      const winner = yield* resolveOccurrence(occurrence, handDealer, handIndex);
      if (winner !== null) return winner;
    }
    return null;
  }

  // HARD_RESOLUTION_HAND is the only real bound -- its own unconditional
  // check below always returns by the loop's last iteration, so there's
  // no separate "maxHands" concept above it anymore (removed: user
  // request, session 39 -- FIGHT_MAX_HANDS/maxHands had been vestigial
  // since session 27 introduced the hard deadline, "left in place as a
  // defensive outer bound" at the time rather than removed).
  for (let i = 0; i < HARD_RESOLUTION_HAND; i++) {
    let winner: PlayerIndex | null = null;

    // Escalation: once the match has run long enough, both sides' own
    // win-gauge thresholds start shrinking each hand -- a shrink can
    // itself resolve the match if banked progress already exceeds the
    // new, lower threshold, and can flip a gauge-fraction state condition
    // (immediates() re-checks those, not just resolution).
    if (i >= ESCALATION_START_HAND) {
      winner = step(immediates(applyEscalation(combatState), dealer, log));
      if (winner !== null) return finish(winner);
    }

    // Disrupt (session 51): effects armed on earlier turns resolve during
    // this hand, each at the point it matters -- one timing mechanism
    // replacing session 24's three hand-lifecycle firing moments and the
    // next-deal Cribbage-layer manipulation queue alike.
    combatState = clearHandKnowledge(combatState);
    beat({ kind: 'hand', handIndex: i, dealer });
    const disrupt = takePendingDisrupt(combatState);
    combatState = disrupt.combatState;
    const armed = (side: PlayerIndex, action: 'revealHand' | 'revealCrib' | 'forceDiscard'): boolean => disrupt.pending[side].includes(action);

    const nonDealer: PlayerIndex = (1 - dealer) as PlayerIndex;
    const shuffled = shuffle(createDeck(), rng);
    const { hands: dealtHands, stock } = deal(shuffled);

    // After the deal: reveal the opponent's dealt hand, and pull one
    // adversarially chosen card out of it into the crib.
    for (const side of [0, 1] as PlayerIndex[]) {
      const opponent = (1 - side) as PlayerIndex;
      if (armed(side, 'revealHand')) combatState = revealOpponentHand(combatState, side, dealtHands[opponent]);
      if (armed(side, 'forceDiscard')) combatState = forceOpponentDiscard(combatState, side, dealtHands[opponent], dealer === opponent);
    }

    // Reveal Crib (session 52, the design's intent): the revealing side
    // chooses its discards SEEING the two cards its opponent has already
    // put in the crib -- so the opponent discards first. If both sides
    // armed it, neither gets the edge and the order is unchanged. The
    // first discard of the hand draws from aiRng first either way, so a
    // hand with no Reveal Crib is byte-identical to before.
    // A forced discard (Disrupt) is decided by the engine, so no request
    // is yielded for that side.
    function* discardFor(side: PlayerIndex, knownCribCards?: [Card, Card]): Generator<CombatRequest, ReturnType<typeof discardToCrib>, CombatAnswer> {
      const context: DiscardContext = { hand: dealtHands[side], isOwnCrib: dealer === side, knownOpponentHand: combatState.sides[side].knownOpponentHand, knownCribCards, rng: aiRng };
      const forced = combatState.sides[side].forcedDiscardPair;
      const chosen = forced ?? ((yield { kind: 'discard', side, context, view: view(i, dealer) }) as [Card, Card]);
      // "Now" Burners commit with your decision (BE2): offered right after
      // it, applied before it resolves.
      if (!forced) yield* offerBurner(side, 'now', i, dealer);
      const strategy: DiscardStrategy = () => chosen;
      return discardToCrib(context, strategy);
    }
    const revealer: PlayerIndex | null = armed(0, 'revealCrib') !== armed(1, 'revealCrib') ? (armed(0, 'revealCrib') ? 0 : 1) : null;
    let d0: ReturnType<typeof discardToCrib>;
    let d1: ReturnType<typeof discardToCrib>;
    if (revealer === 0) {
      d1 = yield* discardFor(1);
      d0 = yield* discardFor(0, d1.discarded as [Card, Card]);
    } else if (revealer === 1) {
      d0 = yield* discardFor(0);
      d1 = yield* discardFor(1, d0.discarded as [Card, Card]);
    } else {
      d0 = yield* discardFor(0);
      d1 = yield* discardFor(1);
    }
    const crib = [...d0.discarded, ...d1.discarded];

    // The revealing side also keeps the full crib for pegging.
    for (const side of [0, 1] as PlayerIndex[]) {
      if (armed(side, 'revealCrib')) combatState = revealCrib(combatState, side, crib);
    }

    const { starter } = cut(stock, rng);
    const heelsPoints = hisHeels(starter);
    scores[dealer] += heelsPoints;

    // At the start of play a revealed hand narrows to the opponent's kept
    // four -- the later, smaller reveal supersedes the dealt six exactly
    // when it becomes the relevant one (pegging cares about kept cards).
    const keptForSide: [Card[], Card[]] = [d0.keptHand, d1.keptHand];
    for (const side of [0, 1] as PlayerIndex[]) {
      if (armed(side, 'revealHand')) combatState = revealOpponentHand(combatState, side, keptForSide[(1 - side) as PlayerIndex]);
    }

    const kept: [Card[], Card[]] = [d0.keptHand, d1.keptHand];

    // The hand's record, pushed up front and filled in as the hand plays,
    // so a fight that ends mid-hand still records it (its later fields
    // stay empty).
    const hand: HandResult = {
      dealer,
      starter,
      hisHeelsPoints: heelsPoints,
      peggingScores: [0, 0],
      nonDealerHandScore: 0,
      dealerHandScore: 0,
      cribScore: 0,
      scoresAfter: scores,
      peggingEvents: [],
      nonDealerHandEvents: [],
      dealerHandEvents: [],
      cribEvents: [],
    };
    hands.push(hand);

    // The cut: His Heels resolves now.
    phase = 'cut';
    beat({ kind: 'cut', starter, dealer });
    // Lucky Cut (session 65).
    winner = step(immediates(applyCutMods(combatState, starter), dealer, log));
    if (winner !== null) return finish(winner);
    const heels = occurrenceFromHisHeels(heelsPoints, dealer);
    if (heels) {
      winner = yield* resolveOccurrence(heels, dealer, i);
      if (winner !== null) return finish(winner);
    }

    // Pegging, live (P8). Each side's own recon (knownCrib/knownOpponentHand)
    // is static once pegging starts, as before.
    phase = 'peg';
    const pegging = startPegging(kept[0], kept[1], nonDealer);
    hand.peggingEvents = pegging.events;
    hand.peggingScores = pegging.scores;
    for (;;) {
      const advanced = advancePegging(pegging);
      for (const event of advanced.events) {
        winner = yield* resolvePeggingEvent(event, dealer, i);
        if (winner !== null) return finish(winner);
      }
      if (!advanced.decision) break;
      const { player, legalCards, count, sequence } = advanced.decision;
      const card = (yield {
        kind: 'play',
        side: player,
        context: { legalCards, count, sequence, knownCrib: combatState.sides[player].knownCrib, knownOpponentHand: combatState.sides[player].knownOpponentHand, rng: aiRng },
        view: view(i, dealer),
        pegging: { hand: pegging.hands[player].slice(), opponentCardsLeft: pegging.hands[(1 - player) as PlayerIndex].length, events: pegging.events },
      }) as Card;
      // "Now" Burners commit with your card (BE2), before it resolves.
      winner = yield* offerBurner(player, 'now', i, dealer);
      if (winner !== null) return finish(winner);
      const played = playPeggingCard(pegging, card);
      winner = yield* resolvePeggingEvent(played, dealer, i);
      if (winner !== null) return finish(winner);
    }
    scores[0] += pegging.scores[0];
    scores[1] += pegging.scores[1];

    // The show, item by item: non-dealer hand, dealer hand, crib.
    phase = 'show';
    const nonDealerEvents = countHandEvents(kept[nonDealer], starter);
    const dealerEvents = countHandEvents(kept[dealer], starter);
    const cribEvents = countCribEvents(crib, starter);
    hand.nonDealerHandEvents = nonDealerEvents;
    hand.nonDealerHandScore = hand.nonDealerHandEvents.reduce((sum, e) => sum + e.points, 0);
    scores[nonDealer] += hand.nonDealerHandScore;
    hand.dealerHandEvents = dealerEvents;
    hand.dealerHandScore = hand.dealerHandEvents.reduce((sum, e) => sum + e.points, 0);
    scores[dealer] += hand.dealerHandScore;
    hand.cribEvents = cribEvents;
    hand.cribScore = hand.cribEvents.reduce((sum, e) => sum + e.points, 0);
    scores[dealer] += hand.cribScore;
    const show: [owner: 'hand' | 'crib', player: PlayerIndex, cards: Card[], events: ShowScoreEvent[], total: number][] = [
      ['hand', nonDealer, kept[nonDealer], nonDealerEvents, hand.nonDealerHandScore],
      ['hand', dealer, kept[dealer], dealerEvents, hand.dealerHandScore],
      ['crib', dealer, crib, cribEvents, hand.cribScore],
    ];
    for (const [owner, player, cards, events, tableTotal] of show) {
      const occurrences = occurrencesFromHandEvents(events, player);
      // The total as this side scores it (the Folds reprice it).
      const rule = combatState.sides[player].scoringRule;
      const total = rule ? occurrences.reduce((sum, o) => sum + occurrencePoints(repriceOccurrence(o, rule)), 0) : tableTotal;
      beat({ kind: 'show', owner, player, cards, starter, total });
      // Nobs Exploit (session 65): the Jacks in the player's hand or crib.
      winner = step(immediates(applyShowMods(combatState, player, cards), dealer, log));
      if (winner !== null) return finish(winner);
      for (let k = 0; k < occurrences.length; k++) {
        winner = yield* resolveOccurrence(occurrences[k], dealer, i, events[k].cards);
        if (winner !== null) return finish(winner);
      }
    }

    // Ward Converter (session 65): the end of the hand.
    winner = step(immediates(applyHandEndMods(combatState), dealer, log));
    if (winner !== null) return finish(winner);

    dealer = (1 - dealer) as PlayerIndex;

    if (i + 1 >= HARD_RESOLUTION_HAND) return finish(resolveHardTiebreak(), 'attrition');
  }

  // Provably unreachable: the loop runs exactly HARD_RESOLUTION_HAND
  // iterations, and the `i + 1 >= HARD_RESOLUTION_HAND` check above
  // always returns by the last one, unconditionally. Kept only to
  // satisfy TypeScript's control-flow analysis (it can't prove that on
  // its own) -- not a real safety net anymore.
  throw new Error('playCombat: unreachable -- HARD_RESOLUTION_HAND always forces a result before this point');
}

// ---------------------------------------------------------------------
// Gameplay Simulation Heuristics (session 46, checkpoint H) -- the
// combat-context half of Burner activation. Before this, Burners were
// not merely used badly by scripted runs but never used at all:
// neverActivateBurner here, neverActivateMapBurner in run.ts and
// neverActivateShopBurner in shop.ts were the only strategies that
// existed anywhere in production code, so any sweep measuring class
// balance was measuring a player with a third of their toolkit
// permanently switched off.
//
// Deliberately unconditional on the first own-turn opportunity, with no
// hoarding logic. Reserving combat Burners for elite/gatekeeper fights
// was considered and explicitly deferred by session 45 -- it's a
// second-order heuristic layered on top of activation itself, and worth
// building only if sweep data shows it matters. The user's own framing
// for shipping the simple version: "any use is better than no use."
// ---------------------------------------------------------------------

/** Activates the first available combat-context Burner each turn the
 * player gets. Side 1 (the enemy) has no Burner economy at all and
 * always declines, matching the tuple's own documented contract.
 *
 * availableBurnerIds is this combat's carried inventory minus copies
 * already spent (combat.ts's own remainingBurnerIds bookkeeping), so
 * "first available" naturally spends one per turn until they run out
 * rather than trying to fire the same one repeatedly. Map- and
 * shop-context Burners are filtered out here: they're carried in the
 * same inventory but have no combatEffect to resolve. */
export const synergyAwareCombatBurnerActivation: BurnerActivationStrategy = (ctx) => {
  if (ctx.side !== 0) return null;
  // Saved for elites and gatekeepers (session 64), unless a regular fight
  // is going badly: the enemy's Containment past 60%.
  if (ctx.fightTier === 'regular') {
    const enemy = ctx.combatState.sides[1].winGauge;
    if (enemy.progress < enemy.threshold * 0.6) return null;
  }
  // Session 64: "Next turn" Burners go on the first turn offered; "Now"
  // ones by what they do -- a hand-long bonus at the hand's start (no
  // points yet), Kill Switch once the enemy is half way, the rest at once.
  const usable = ctx.availableBurnerIds.find((id) => {
    const effect = BURNER_DEFINITIONS[id].combat?.effect;
    if (!effect) return false;
    if (effect.kind === 'handBonus' && effect.effect.verb !== 'suppress') {
      const side = ctx.combatState.sides[0];
      return side.handPoints === 0 && !(side.handBonuses ?? []).length;
    }
    if (effect.kind === 'drainEnemy') {
      const enemy = ctx.combatState.sides[1].winGauge;
      return enemy.progress >= enemy.threshold / 2;
    }
    // Suppress Burners wait until there's Containment to take back.
    const suppresses = (effect.kind === 'effect' && effect.effect.verb === 'suppress') || (effect.kind === 'handBonus' && effect.effect.verb === 'suppress');
    if (suppresses) {
      const enemy = ctx.combatState.sides[1].winGauge;
      if (enemy.progress < enemy.threshold * 0.3) return false;
      if (effect.kind === 'handBonus') return ctx.combatState.sides[0].handPoints === 0 && !(ctx.combatState.sides[0].handBonuses ?? []).length;
      return true;
    }
    return true;
  });
  return usable ?? null;
};
