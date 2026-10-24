import type { Suit } from './cards';

/**
 * Pure type system for subroutines -- session 51's archetype and
 * subroutine redesign (DESIGN.md "Archetypes & Subroutines";
 * docs/archive/archetype-redesign.md A1-A11). No runtime logic lives here --
 * beta criteria are evaluated in triggers.ts, effects resolve in
 * resolve.ts.
 *
 * Every subroutine has two effects:
 *
 * - an **alpha**, which fires on every turn the owning side gets
 *   (session 50's D11: nothing gates whether a piece acts); and
 * - an optional **beta**, which fires when its criteria are met -- either
 *   enhancing the alpha, adding a different effect to the turn's fire, or
 *   firing immediately outside the turn.
 *
 * Everything this replaces -- the 22 payload kinds, the 8 trigger
 * families, tags, Togglable, `reactive`/`firesAt`, the Neutral archetype
 * -- is described in docs/archive/design-history.md.
 */

/**
 * The four archetypes (A2, A7), each built from one way to win and one
 * kind of utility:
 *
 * - **exploit** -- Spike / Control. Big beta moments on Cribbage scoring;
 *   steers the cards and the opponent's tempo.
 * - **daemon** -- Ramp / Healing. Alphas that grow over the fight; pushes
 *   the opponent's gauge back.
 * - **overclock** -- Tempo / Empowerment. Wins by taking more turns;
 *   boosts other subroutines.
 * - **honeypot** -- Conversion / Defense. Banks defense and turns it, and
 *   the opponent's own progress, into its own.
 *
 * No 5th value: session 28's 'neutral' archetype existed only because two
 * of the old four had no way to credit their own gauge. A3's
 * archetype-level credit rule removes that gap at the root.
 */
export type Archetype = 'exploit' | 'daemon' | 'overclock' | 'honeypot';

export const ARCHETYPES: readonly Archetype[] = ['exploit', 'daemon', 'overclock', 'honeypot'];

/** Suits are still the generic 0-3 slots from cards.ts, and each is bound
 * 1:1 to the archetype of the same name (A1) -- scoring with Daemon cards
 * *is* charging your Daemon subroutines. Real suit-name theming (icon,
 * colour) is a UI concern, not the engine's. */
export const SUIT_ARCHETYPES: Record<Suit, Archetype> = {
  0: 'exploit',
  1: 'daemon',
  2: 'overclock',
  3: 'honeypot',
};

/** The inverse of SUIT_ARCHETYPES -- which suit tallies charge a given
 * archetype's `cards`/`suit` betas. */
export const ARCHETYPE_SUITS: Record<Archetype, Suit> = {
  exploit: 0,
  daemon: 1,
  overclock: 2,
  honeypot: 3,
};

/** The Cribbage scoring categories a `cards` beta can watch, unified
 * across the pegging play phase and the show/count phase. His Heels is
 * deliberately absent (A5): one occurrence per game, dealer only, and
 * entirely outside either player's control. */
export type OccurrenceCategory =
  | 'fifteen'
  | 'pair'
  | 'run'
  | 'flush'
  | 'hisNobs'
  | 'thirtyOne'
  | 'go';

// ---------------------------------------------------------------------
// Effects: the seven verbs (A4, A5)
// ---------------------------------------------------------------------

/**
 * Fields every effect can carry, whatever its verb.
 *
 * `feed` is a noisy piece's drawback (session 58, replacing Trace): this
 * much is added straight to the OPPONENT's win gauge each time the effect
 * resolves -- unshielded by Ward, untouched by Mods. On a player piece it
 * hands the enemy Containment; on an enemy piece it hands the player
 * Breach. Paid inside the fight, so the duel sims price it like any
 * other effect (DESIGN Pricing rule 3e).
 */
interface EffectBase {
  feed?: number;
}

/**
 * Fills the caster's own win gauge -- the one verb every archetype needs
 * a path to (A3's credit rule).
 *
 * `piercing` ignores the opponent's Ward (the old `piercing` payload kind,
 * now a modifier). `from` says what pays for the credit:
 *
 * - absent: nothing -- plain credit.
 * - 'ward': spends the caster's own Ward shield 1:1, crediting only what
 *   was actually there (the old Ward Bash).
 * - 'opponent': takes from the opponent's win gauge 1:1, capped at what
 *   they had banked (the old Session Hijack). You can only steal what is
 *   there.
 *
 * The two `from` sources are Honeypot's conversion betas (A4) -- banked
 * defense and the opponent's own progress turned into the caster's.
 */
export interface CreditEffect extends EffectBase {
  verb: 'credit';
  amount: number;
  piercing?: boolean;
  from?: 'ward' | 'opponent';
}

/** Pushes the opponent's win gauge back -- Daemon's "healing". Instant
 * only: a lasting Suppress would re-create the old HoT, and an alpha
 * already fires every turn. */
export interface SuppressEffect extends EffectBase {
  verb: 'suppress';
  amount: number;
}

/** Adds to the caster's Ward shield, which absorbs the opponent's
 * incoming non-piercing credit until depleted -- Honeypot's defense, and
 * its conversion fuel. */
export interface WardEffect extends EffectBase {
  verb: 'ward';
  amount: number;
}

/**
 * Boosts the magnitude of other subroutines' effects later in this same
 * turn -- Overclock's utility, and the reason loadout order matters to
 * it. `scope: 'next'` boosts only the next piece to fire; `'rest'` boosts
 * every remaining piece this turn. Expires at the end of the turn either
 * way: an Empower that carried across turns would make order irrelevant.
 */
export interface EmpowerEffect extends EffectBase {
  verb: 'empower';
  amount: number;
  scope: 'next' | 'rest';
}

/**
 * Speeds the caster's initiative or slows the opponent's.
 *
 * `mode: 'gauge'` moves gauge progress, denominated in **fractions of a
 * turn** against the affected side's live threshold. `mode: 'threshold'`
 * moves the threshold itself, denominated in **fractions of the starting
 * threshold** (session 48's invariants -- never a point count, and never
 * resolved against a value this effect is itself mutating).
 *
 * `duration` applies to `'threshold'` only: a temporary threshold change
 * lasting that many of the affected side's turns (the old `choked`
 * debuff). Absent means permanent.
 */
export interface TempoEffect extends EffectBase {
  verb: 'tempo';
  target: 'own' | 'opponent';
  mode: 'gauge' | 'threshold';
  amount: number;
  duration?: number;
}

/**
 * Acts on the Cribbage layer -- Exploit's control. A turn happens
 * mid-hand, after the moment any of these would matter, so a Disrupt
 * effect **arms for the next hand** and resolves at the right point in
 * it: the opponent's dealt hand is revealed once dealt; `revealCrib`
 * makes the opponent discard FIRST, so the caster chooses its own
 * discards seeing the two cards already in the crib (the moment crib
 * knowledge matters -- session 52, the design's original intent); and
 * `forceDiscard` pulls one adversarially chosen card from the opponent's
 * hand into the crib before they discard. One timing
 * mechanism, replacing session 24's three hand-lifecycle moments and
 * `scheduledSabotage` alike.
 */
export interface DisruptEffect extends EffectBase {
  verb: 'disrupt';
  action: 'revealHand' | 'revealCrib' | 'forceDiscard';
}

/**
 * Adds charges to a beta -- this piece's own, the next piece's in
 * loadout order, or every other installed piece's. Distinct from Empower
 * (which boosts *output*): Charge feeds *criteria*. An alpha may be
 * nothing but Charge (A5, the user's own call) -- a piece whose job is
 * powering a beta, its own or a neighbour's.
 */
export interface ChargeEffect extends EffectBase {
  verb: 'charge';
  amount: number;
  target: 'self' | 'next' | 'all';
}

/**
 * The three enemy-only effects (session 60, docs/archive/enemy-review.md CP1),
 * each aimed at something the player builds before the fight. Authored
 * only on enemy subroutines (content/enemy-subroutines.ts); a test keeps
 * them out of the player pool.
 *
 * - **Trace**: the opponent gains `amount` Heat -- a run cost, inert on
 *   the enemy side (Heat is the player's alone). Never scaled with the
 *   enemy's layer: Heat amounts read the same at every layer.
 * - **Wipe**: each of the opponent's Hooks loses `amount` banked counts
 *   (Charge's opposite; only counting Hooks hold counts). Whole counts,
 *   so never scaled either.
 * - **Strip**: the opponent loses `amount` Ward.
 */
export interface TraceEffect extends EffectBase {
  verb: 'trace';
  amount: number;
}
export interface WipeEffect extends EffectBase {
  verb: 'wipe';
  amount: number;
}
export interface StripEffect extends EffectBase {
  verb: 'strip';
  amount: number;
}

/** The enemy's bottom subroutine skips its next `amount` turns (session
 * 66, docs/subroutines-design.md S5): Resource Quota's rule, on the
 * player's side. A Hook's effect only, never a Process (the user). */
export interface SuspendEffect extends EffectBase {
  verb: 'suspend';
  amount: number;
}

export type Effect =
  | CreditEffect
  | SuppressEffect
  | WardEffect
  | EmpowerEffect
  | TempoEffect
  | DisruptEffect
  | ChargeEffect
  | TraceEffect
  | WipeEffect
  | StripEffect
  | SuspendEffect;

export type Verb = Effect['verb'];

export const VERBS: readonly Verb[] = ['credit', 'suppress', 'ward', 'empower', 'tempo', 'disrupt', 'charge', 'trace', 'wipe', 'strip', 'suspend'];

/** Verbs only a Hook may carry, never a Process (S5). */
export const HOOK_ONLY_VERBS: readonly Verb[] = ['suspend'];

/** The enemy-only verbs (CP1). */
export const ENEMY_ONLY_VERBS: readonly Verb[] = ['trace', 'wipe', 'strip'];

/** An alpha is one effect, plus an optional `growth`: added to its
 * magnitude each time the piece fires (A5). That is how Ramp -- Daemon's
 * offensive theme -- is expressed; without it Daemon could only ramp
 * through its beta. `growthCap` bounds the total growth, so a long fight
 * cannot run it away unboundedly. */
export type Alpha = Effect & { growth?: number; growthCap?: number };

/** A beta's own effect: either a full verb effect bundled onto the fire
 * (the "different effect" relationship), or `enhance` -- added to the
 * alpha's own magnitude (the "enhance" relationship, which D13 calls
 * firing *elevated*). */
export type BetaEffect = Effect | { verb: 'enhance'; amount: number; feed?: number };

// ---------------------------------------------------------------------
// Beta criteria: source x shape (A5)
// ---------------------------------------------------------------------

/**
 * What a beta watches. Each source produces **charges**: a counter for
 * `cards`/`progress`, a 1-or-0 for `state`/`sequence` (D15: a condition
 * is a charge of 1).
 *
 * - `cards`: one charge per Cribbage scoring occurrence of `category`, or
 *   with `category: 'suit'` one per card of the piece's own archetype's
 *   suit played (A1: the archetype's own suit tally). `watch` (default
 *   'own') and `minMagnitude` absorb session 40's rare-occurrence
 *   family -- watching the opponent's scoring is a distinct signal, and a
 *   pair occurrence's magnitude is real points (2/6/12), so
 *   `minMagnitude: 6` really does mean "pair royal or better".
 * - `progress`: one charge per `per` units of progress -- own points
 *   scored, this piece's own fires, or Ward absorbed by the caster's side.
 * - `state`: true/false conditions on the fight right now. Gauge
 *   conditions read the real **win** gauge as a fraction of its
 *   threshold, never the cyclical initiative gauge (session 40's
 *   gaugeFillAbove lesson).
 * - `sequence`: the piece's place in the loadout (D13, A12). `adjacent`
 *   checks the slots directly above and below -- a positional, either-side
 *   test, fixed by the arrangement; `anyPrior` checks every earlier piece
 *   that fired elevated this turn (its beta applied). Matches by id,
 *   archetype or verb -- id matching is reserved for pieces guaranteed to
 *   be co-present, e.g. a class's own fixed starting loadout (session
 *   41's dead-chain lesson).
 */
export type BetaSource =
  | {
      source: 'cards';
      category: OccurrenceCategory | 'suit';
      watch?: 'own' | 'opponent' | 'either';
      minMagnitude?: number;
    }
  | { source: 'progress'; metric: 'points' | 'fires' | 'absorbed'; per: number }
  | {
      source: 'state';
      condition:
        | { kind: 'dealer' }
        | { kind: 'nonDealer' }
        | { kind: 'wardAbove'; amount: number }
        | { kind: 'ownGaugeAbove'; fraction: number }
        | { kind: 'ownGaugeBelow'; fraction: number }
        | { kind: 'opponentGaugeAbove'; fraction: number }
        | { kind: 'opponentGaugeBelow'; fraction: number }
        /** Session 53 (checkpoint 6b): true once this side has scored at
         * least `amount` points this hand -- pegging and show alike,
         * resetting at each deal. The skill-carrying condition: points
         * per TURN are fixed by the initiative gauge, but points per HAND
         * are not, so a better player clears a hand threshold more often.
         * As `immediate`, it fires the moment the hand crosses it. */
        | { kind: 'handPointsAtLeast'; amount: number };
    }
  | {
      source: 'sequence';
      reach: 'adjacent' | 'anyPrior';
      match: { id: string } | { archetype: Archetype } | { verb: Verb } | { any: true };
    };

/**
 * How a beta responds to its charges.
 *
 * - `graded`: on the turn's fire, the beta's amount is multiplied by
 *   charges banked, up to `cap`. Charges reset when spent.
 * - `stepped`: on the turn's fire, the beta applies at full amount once
 *   `at` charges have banked. Charges reset when spent.
 * - `whileTrue`: on the turn's fire, the beta applies if its condition
 *   holds right now. For `state` and `sequence` sources; nothing banks.
 * - `immediate`: the beta fires the moment `at` charges have banked (or,
 *   for a `state` source, the moment the condition turns true), outside
 *   the turn gate entirely. An `enhance` effect here means an extra,
 *   elevated fire of the alpha -- D12's "extra fire". Not meaningful for a
 *   `sequence` source, which only exists inside a turn.
 */
export type BetaShape =
  | { shape: 'graded'; cap: number }
  | { shape: 'stepped'; at: number }
  | { shape: 'whileTrue' }
  | { shape: 'immediate'; at?: number };

/** A beta is one source, one shape and one effect -- one bundle, never a
 * stack (D12), so an alpha and a beta are each independently priceable
 * (`beta-pricing.ts`, `pricing.ts`). */
export type Beta = BetaSource & BetaShape & { effect: BetaEffect };

// ---------------------------------------------------------------------
// The subroutine itself
// ---------------------------------------------------------------------

export interface SubroutineDefinition {
  id: string;
  name: string;
  archetype: Archetype;
  alpha: Alpha;
  /** Absent only on skeleton/test content -- every authored piece is
   * expected to carry one (the user's framing: every subroutine has two
   * effects). */
  beta?: Beta;
  /** Points this piece's own side must *score* after a fire before it
   * may fire again (session 47). Denominated in real Cribbage scoring
   * because that is the one quantity a piece cannot manufacture -- a
   * Tempo piece writes gauge progress directly and never produces a
   * scoring occurrence, so the gate can never be fed by the thing it
   * gates. More load-bearing under D11, where it suppresses a guaranteed
   * per-turn fire. */
  pointsCooldown?: number;
  /** Caps how many times this piece can fire in one combat (session 39).
   * Mostly for `immediate` betas, the one path that can re-fire outside
   * the turn gate. Undefined means unlimited. */
  maxFiresPerCombat?: number;
  /** Heat this piece adds to the player's layer each time it fires
   * (session 47's tracers, made direct in session 58) -- enemy-side
   * content: an alarm. Heat is player-only, so it is inert on a player
   * piece. */
  heatPressure?: number;
  /** Merge ranks this copy has (merge.ts's upgradedDefinition counts
   * them; session 61) -- display and sell price only; the engine reads
   * the upgraded numbers, never this. Absent means rank 0. */
  rank?: number;
}

/** The magnitude field of an effect, or undefined for a verb with none
 * (Disrupt). One place that knows which verbs carry an `amount`, for
 * Merge, enemy scaling, Empower and `enhance` alike. */
export function effectAmount(effect: Effect | BetaEffect): number | undefined {
  return effect.verb === 'disrupt' ? undefined : effect.amount;
}

/**
 * Which shapes make sense for which sources (A5). The type system allows
 * any pairing; this is the authoring rule, enforced by tests over every
 * piece rather than by a much larger type.
 *
 * - `cards`/`progress` bank a counter, so `graded`, `stepped` and
 *   `immediate`. Not `whileTrue`: there is no condition to be true.
 * - `state` is a condition, so `whileTrue` or `immediate` (fires on the
 *   false -> true edge). Graded/stepped would mean a counter it doesn't
 *   have (D15: a condition is a charge of 1).
 * - `sequence` only exists inside a turn, so `whileTrue`, or `graded`
 *   counting how many matching pieces fired earlier this turn (the old
 *   chain-finisher shape). Never `immediate`.
 */
export const VALID_SHAPES: Record<BetaSource['source'], readonly BetaShape['shape'][]> = {
  cards: ['graded', 'stepped', 'immediate'],
  progress: ['graded', 'stepped', 'immediate'],
  state: ['whileTrue', 'immediate'],
  sequence: ['whileTrue', 'graded'],
};

export function isValidBeta(beta: Beta): boolean {
  return VALID_SHAPES[beta.source].includes(beta.shape);
}

/** Whether `piece` satisfies a `sequence` beta's match -- by id,
 * archetype or the verb of its alpha. One definition shared by beta
 * evaluation (triggers.ts) and the reorder heuristic (loadout.ts), so the
 * two can never disagree about what a chain wants. */
export function matchesSequence(match: Extract<BetaSource, { source: 'sequence' }>['match'], piece: SubroutineDefinition): boolean {
  if ('any' in match) return true;
  if ('id' in match) return piece.id === match.id;
  if ('archetype' in match) return piece.archetype === match.archetype;
  return piece.alpha.verb === match.verb;
}

/** Multiplies every magnitude a piece carries -- its alpha, its alpha's
 * growth, and its beta's effect -- by `multiplier`. Multiplicative, so
 * unit-agnostic: safe on Tempo's fractions (session 48). Used for
 * per-layer enemy scaling. A multiplier of 1 returns the piece unchanged. */
export function scaledDefinition(piece: SubroutineDefinition, multiplier: number): SubroutineDefinition {
  if (multiplier === 1) return piece;
  // Disrupt has no amount; Trace (Heat) and Wipe (whole counts) read the
  // same at every layer (CP1). Charge is Hook counts too, so it scales
  // but stays whole (session 63: a scaled Zero-Day Chain gave Ping 1.68).
  const scale = <T extends Effect | BetaEffect>(effect: T): T =>
    effect.verb === 'disrupt' || effect.verb === 'trace' || effect.verb === 'wipe'
      ? effect
      : effect.verb === 'charge'
        ? { ...effect, amount: Math.max(1, Math.round(effect.amount * multiplier)) }
        : { ...effect, amount: effect.amount * multiplier };
  // Spread so the growth writes below can never mutate the source piece
  // (scale() returns a Disrupt effect as-is).
  const alpha = { ...scale(piece.alpha) } as Alpha;
  if (alpha.growth !== undefined) alpha.growth *= multiplier;
  if (alpha.growthCap !== undefined) alpha.growthCap *= multiplier;
  return { ...piece, alpha, beta: piece.beta ? { ...piece.beta, effect: scale(piece.beta.effect) } : undefined };
}

/** Whether an effect is Tempo -- whose amount is a fraction of a turn or
 * of a threshold, so anything doing *additive* arithmetic on it (a flat
 * Merge bonus, a flat Empower) must not treat it as points: adding 3 to a
 * fraction means "plus three whole turns" (session 48's invariant).
 * Multiplicative scaling is unit-agnostic and does not need to care. */
export function isTempo(effect: Effect | BetaEffect): effect is TempoEffect {
  return effect.verb === 'tempo';
}

/** Whether a piece can credit the win gauge through either of its
 * effects -- the primitive behind A3's credit rule and the simulation
 * heuristics' credit-gap step. A beta of `enhance` counts if the alpha
 * itself is Credit, since it only ever makes that credit bigger. */
export function hasCreditPath(piece: SubroutineDefinition): boolean {
  if (piece.alpha.verb === 'credit') return true;
  return piece.beta?.effect.verb === 'credit';
}

/** Whether `loadout` already contains a piece of `archetype` with a
 * credit path (session 46's credit-gap ladder step, re-pointed to the
 * verb model). Checks the *installed* loadout at every call site -- a
 * benched piece isn't evaluated in a fight, so it doesn't close a gap. */
export function hasCreditCapablePiece(loadout: SubroutineDefinition[], archetype: Archetype): boolean {
  return loadout.some((piece) => piece.archetype === archetype && hasCreditPath(piece));
}
