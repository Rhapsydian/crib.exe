import { createRng, type Rng } from './rng';
import type { ClassId } from './classes';
import type { BurnerId } from './burner-types';
import type { Archetype } from './subroutine-types';
import { BURNER_DEFINITIONS } from './burners';
import { ALL_SUBROUTINES, ARCHETYPE_POOLS } from './subroutines';
import { CLASS_ORDER, NO_META_BONUSES, STARTING_BURNERS, type RunSetup } from './meta';
import { upgradedDefinition } from './merge';
import type { SubroutineDefinition } from './subroutine-types';
import type { RunEvent, RunPlayerState, RunResult } from './run';
import type { FightGlitches, ScoringRule } from './triggers';
import { layerHeatAllowance } from './heat';

/**
 * Daily Runs (session 72, docs/daily-runs-design.md): the run of the day.
 * The date, as YYYY-MM-DD with a salt, is hashed into the day's seed
 * (DR5); the seed rolls the class and the day's Mods (DR4) and drives the
 * run itself, so everyone playing that date plays the same run.
 */

/** Salted so a day's seed isn't guessable from the date alone. */
export const DAILY_SALT = 'crib.exe/daily/v1';

/** A date as YYYY-MM-DD, in the local calendar (DR5). */
export function dailyDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The day's seed: FNV-1a over the salted date, kept positive. */
export function dailySeed(date: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${DAILY_SALT}:${date}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 2 ** 31;
}

export type DailyCategory = 'glitch' | 'advisory' | 'bulletin' | 'directive';

export type DailyModId =
  // Glitch: Cribbage and fight rules.
  | 'lucky-sevens'
  | 'suit-surge'
  | 'fifteen-flood'
  | 'running-wild'
  | 'nobs-and-heels'
  | 'early-cut'
  | 'short-count'
  // Advisory: the network.
  | 'port-flood'
  | 'quiet-network'
  | 'hardened-elites'
  | 'cold-trail'
  | 'memory-leak'
  | 'lean-times'
  | 'cache-bloom'
  // Bulletin: the starting kit.
  | 'go-bag'
  | 'contraband-drop'
  | 'field-kit'
  | 'veteran-loadout'
  | 'seed-money'
  | 'new-hardware'
  | 'burner-rig'
  | 'expanded-memory'
  // Directive: the day's scoring twist.
  | 'bounty-hunt'
  | 'treasure-map'
  | 'payday'
  | 'card-sharp'
  | 'deep-dive'
  | 'clean-sweep'
  | 'ghost-run'
  | 'shopping-spree'
  | 'full-arsenal'
  | 'merge-master'
  | 'burn-rate'
  | 'clean-breach'
  | 'flawless-form';

export interface DailyModDefinition {
  id: DailyModId;
  name: string;
  category: DailyCategory;
  text: string;
  /** Relative chance to be drawn (default 1; the subroutine slot is rare,
   * DR8). */
  weight?: number;
  /** What a Bulletin starts you with, for the caps (DR7). */
  starts?: { subroutines?: number; burners?: number };
}

const def = (id: DailyModId, name: string, category: DailyCategory, text: string, extra: Partial<DailyModDefinition> = {}): [DailyModId, DailyModDefinition] => [id, { id, name, category, text, ...extra }];

/** The first pool (DR10), the user's names where they chose them. */
export const DAILY_MODS: Record<DailyModId, DailyModDefinition> = Object.fromEntries([
  def('lucky-sevens', 'Lucky Sevens', 'glitch', 'Each 7 you play while pegging Credits 3.'),
  def('suit-surge', 'Suit Surge', 'glitch', "Each card of the day's suit you play while pegging adds 1 initiative."),
  def('fifteen-flood', 'Fifteen Flood', 'glitch', 'Fifteens score 1 more, for both sides.'),
  def('running-wild', 'Running Wild', 'glitch', 'Runs score double; pairs score 1 less (never below 1).'),
  def('nobs-and-heels', 'Nobs and Heels', 'glitch', 'His Nobs and His Heels are worth 4.'),
  def('early-cut', 'Early Cut', 'glitch', 'The cut card is turned before the discard: you choose your discard knowing the starter.'),
  def('short-count', 'Short Count', 'glitch', 'The count stops at 21, not 31. Anything that happens on 31 happens on 21.'),
  def('port-flood', 'Port Flood', 'advisory', 'Twice as many Shops on the map.'),
  def('quiet-network', 'Quiet Network', 'advisory', 'Moves cost no Heat; fights cost 50% more Heat.'),
  def('hardened-elites', 'Hardened Elites', 'advisory', 'Every elite takes a second Mod.'),
  def('cold-trail', 'Cold Trail', 'advisory', 'A quarter of your Heat carries over between layers.'),
  def('memory-leak', 'Memory Leak', 'advisory', 'Install only 5 subroutines.'),
  def('lean-times', 'Lean Times', 'advisory', 'Fights pay half the Data; Shop prices −30%.'),
  def('cache-bloom', 'Cache Bloom', 'advisory', 'More Caches on the map.'),
  def('go-bag', 'Go Bag', 'bulletin', 'Start with two common Burners.', { starts: { burners: 2 } }),
  def('contraband-drop', 'Contraband Drop', 'bulletin', 'Start with a contraband Burner.', { starts: { burners: 1 } }),
  def('field-kit', 'Field Kit', 'bulletin', 'An uncommon subroutine joins your starters.', { starts: { subroutines: 1 } }),
  def('veteran-loadout', 'Veteran Loadout', 'bulletin', 'Every starting subroutine begins at rank I.'),
  def('seed-money', 'Seed Money', 'bulletin', 'Start with 150 Data.'),
  def('new-hardware', 'New Hardware', 'bulletin', 'Your class Mod starts as its II version.'),
  def('burner-rig', 'Burner Rig', 'bulletin', 'Carry 4 Burners.'),
  def('expanded-memory', 'Expanded Memory', 'bulletin', 'Install 7 subroutines.', { weight: 0.3 }),
  def('bounty-hunt', 'Bounty Hunt', 'directive', 'Elites score double (300 each).'),
  def('treasure-map', 'Treasure Map', 'directive', 'Caches score 500 each.'),
  def('payday', 'Payday', 'directive', 'Data earned counts double.'),
  def('card-sharp', 'Card Sharp', 'directive', 'The Cribbage rating counts double.'),
  def('deep-dive', 'Deep Dive', 'directive', 'Layers 3 and 4 score double.'),
  def('clean-sweep', 'Clean Sweep', 'directive', 'Each regular fight won scores 50.'),
  def('ghost-run', 'Ghost Run', 'directive', 'Each layer breached with Heat under 60% of its allowance scores +500.'),
  def('shopping-spree', 'Shopping Spree', 'directive', 'Each Data you spend scores 1.'),
  def('full-arsenal', 'Full Arsenal', 'directive', 'Each Mod you hold at the end scores 100.'),
  def('merge-master', 'Refactor Master', 'directive', 'Each Refactor scores 150.'),
  def('burn-rate', 'Burn Rate', 'directive', 'Each Burner you use scores 100.'),
  def('clean-breach', 'Clean Breach', 'directive', 'Each gatekeeper beaten before it reaches half its Containment scores +300.'),
  def('flawless-form', 'Flawless Form', 'directive', 'A Flawless Cribbage rating (96% or better) scores +1,000.'),
]) as Record<DailyModId, DailyModDefinition>;

/** Pairs that never appear on the same day (DR10). */
export const DAILY_BLOCKED_PAIRS: readonly [DailyModId, DailyModId][] = [
  ['memory-leak', 'expanded-memory'],
  ['go-bag', 'contraband-drop'],
  ['lean-times', 'payday'],
  ['quiet-network', 'ghost-run'],
];
/** DR7: at most one extra starting subroutine and two starting Burners. */
export const DAILY_MAX_SUBROUTINES = 1;
export const DAILY_MAX_BURNERS = 2;

/** One of the day's Mods, with whatever it rolled. */
export interface DailyMod {
  id: DailyModId;
  /** Go Bag's and Contraband Drop's Burners. */
  burners?: BurnerId[];
  /** Field Kit's subroutine. */
  subroutine?: string;
  /** Suit Surge's suit. */
  suit?: Archetype;
}

export interface DailyPlan {
  date: string;
  seed: number;
  classId: ClassId;
  /** The Directive first, then the others in the order drawn. */
  mods: DailyMod[];
}

function weightedPick<T extends { weight?: number }>(rng: Rng, items: readonly T[]): T {
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0);
  let r = rng.next() * total;
  for (const item of items) {
    r -= item.weight ?? 1;
    if (r < 0) return item;
  }
  return items[items.length - 1];
}

const ARCHETYPES: readonly Archetype[] = ['exploit', 'daemon', 'overclock', 'honeypot'];

/** Days since 1970-01-01 for a YYYY-MM-DD date. */
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The day's Directive, dealt from a shuffled deck of all of them, one a
 * day, so none repeats within its cycle (the user deepened the pool so a
 * repeat takes ~2 weeks). */
function directiveFor(date: string): DailyModDefinition {
  const day = dayNumber(date);
  const size = Object.values(DAILY_MODS).filter((m) => m.category === 'directive').length;
  const cycle = Math.floor(day / size);
  const deck = directiveDeck(cycle);
  // A cycle never opens on the card the last one closed on (only the
  // first two cards can move, so the previous cycle's last card is its
  // shuffle's own).
  if (deck[0] === directiveDeck(cycle - 1)[size - 1]) [deck[0], deck[1]] = [deck[1], deck[0]];
  return deck[day % size];
}

/** A cycle's shuffled deck of Directives (Fisher-Yates, seeded by the
 * cycle). */
function directiveDeck(cycle: number): DailyModDefinition[] {
  const deck = Object.values(DAILY_MODS).filter((m) => m.category === 'directive');
  const rng = createRng(dailySeed(`directives-${cycle}`));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

/** The day's class and Mods (DR4-DR8): one Directive, then two or three
 * from Glitch, Advisory and Bulletin, never a blocked pair, within the
 * Bulletin caps; each random part rolled from the same seed. */
export function rollDaily(date: string): DailyPlan {
  const seed = dailySeed(date);
  // A stream of its own, apart from the run's (which uses `seed`).
  const rng = createRng(seed ^ 0x5bd1e995);
  const classId = CLASS_ORDER[rng.nextInt(CLASS_ORDER.length)];
  const all = Object.values(DAILY_MODS);
  const directive = directiveFor(date);
  const picked: DailyModDefinition[] = [directive];
  const extras = 2 + rng.nextInt(2);
  const blocked = (id: DailyModId) => DAILY_BLOCKED_PAIRS.some(([a, b]) => (a === id && picked.some((p) => p.id === b)) || (b === id && picked.some((p) => p.id === a)));
  const starts = (key: 'subroutines' | 'burners') => picked.reduce((n, p) => n + (p.starts?.[key] ?? 0), 0);
  const fits = (m: DailyModDefinition) =>
    !picked.includes(m) &&
    !blocked(m.id) &&
    starts('subroutines') + (m.starts?.subroutines ?? 0) <= DAILY_MAX_SUBROUTINES &&
    starts('burners') + (m.starts?.burners ?? 0) <= DAILY_MAX_BURNERS;
  for (let i = 0; i < extras; i++) {
    const open = all.filter((m) => m.category !== 'directive' && fits(m));
    if (!open.length) break;
    picked.push(weightedPick(rng, open));
  }
  const commons = STARTING_BURNERS;
  const contraband = (Object.keys(BURNER_DEFINITIONS) as BurnerId[]).filter((id) => BURNER_DEFINITIONS[id].contraband);
  const uncommons = Object.values(ARCHETYPE_POOLS).flatMap((p) => p.uncommons);
  const mods = picked.map((m): DailyMod => {
    if (m.id === 'go-bag') {
      const first = commons[rng.nextInt(commons.length)];
      const rest = commons.filter((id) => id !== first);
      return { id: m.id, burners: [first, rest[rng.nextInt(rest.length)]] };
    }
    if (m.id === 'contraband-drop') return { id: m.id, burners: [contraband[rng.nextInt(contraband.length)]] };
    if (m.id === 'field-kit') return { id: m.id, subroutine: uncommons[rng.nextInt(uncommons.length)].id };
    if (m.id === 'suit-surge') return { id: m.id, suit: ARCHETYPES[rng.nextInt(ARCHETYPES.length)] };
    return { id: m.id };
  });
  return { date, seed, classId, mods };
}

/** How a daily starts (DR5): the day's class and seed, with no upgrades or
 * picks (plain), and the date pinned in the setup so a replay rebuilds
 * the day. `practice` marks attempts after the scored one (DR1). */
export function dailyRunStart(date: string, practice = false): { classId: ClassId; seed: number; setup: RunSetup } {
  const plan = rollDaily(date);
  return { classId: plan.classId, seed: plan.seed, setup: { plain: true, daily: { date, ...(practice ? { practice: true } : {}) } } };
}

/** Where a Cribbage rating turns Flawless: the review ladder's top step
 * (ui/skill-review.ts) and Flawless Form's bar, one number (session 72,
 * the user: tie them together). 96 is at most 0.4 points given up a hand. */
export const FLAWLESS_RATING = 96;

/** The daily score's parts (DR2; tuned later by simulation). */
export const DAILY_SCORE = {
  layer: 1000,
  caughtLayer: 750,
  victory: 1000,
  elite: 150,
  cache: 100,
  perData: 1,
  perRatingPoint: 5,
} as const;

export interface ScoreLine {
  label: string;
  points: number;
  /** Changed or added by the day's Directive. */
  directive?: boolean;
}

/**
 * A daily run's score, itemized for the end card (DR2), with the day's
 * Directive applied. `rating` is the run's Cribbage rating (0-100; the
 * review coach works it out in the UI), or null with none.
 */
export function dailyScore(result: RunResult, directive: DailyModId, rating: number | null): { lines: ScoreLine[]; total: number } {
  const S = DAILY_SCORE;
  const lines: ScoreLine[] = [];
  const encounters = result.log.filter((e): e is Extract<RunEvent, { type: 'encounter' }> => e.type === 'encounter');
  const won = (e: Extract<RunEvent, { type: 'encounter' }>) => e.outcome.newState === 'inert';
  const cleared = result.log.flatMap((e) => (e.type === 'layerCleared' ? [e.layerIndex] : []));
  cleared.forEach((layerIndex, i) => {
    const caught = result.outcome === 'breachedThenCaught' && i === cleared.length - 1;
    const base = caught ? S.caughtLayer : S.layer;
    const deep = directive === 'deep-dive' && layerIndex >= 2;
    lines.push({ label: `Layer ${layerIndex + 1} breached${caught ? ', then caught' : ''}${deep ? ' (×2)' : ''}`, points: deep ? base * 2 : base, directive: deep || undefined });
  });
  if (result.outcome === 'victory') lines.push({ label: 'Victory', points: S.victory });
  const elites = encounters.filter((e) => e.nodeType === 'eliteFight' && won(e)).length;
  if (elites) lines.push({ label: `${elites} elite${elites === 1 ? '' : 's'} beaten${directive === 'bounty-hunt' ? ' (×2)' : ''}`, points: elites * S.elite * (directive === 'bounty-hunt' ? 2 : 1), directive: directive === 'bounty-hunt' || undefined });
  const caches = encounters.filter((e) => e.nodeType === 'cache').length;
  if (caches) lines.push({ label: `${caches} Cache${caches === 1 ? '' : 's'} opened${directive === 'treasure-map' ? ' (500 each)' : ''}`, points: caches * (directive === 'treasure-map' ? 500 : S.cache), directive: directive === 'treasure-map' || undefined });
  const earned = result.tally?.dataEarned ?? 0;
  if (earned) lines.push({ label: `${earned} Data earned${directive === 'payday' ? ' (×2)' : ''}`, points: Math.round(earned * S.perData * (directive === 'payday' ? 2 : 1)), directive: directive === 'payday' || undefined });
  if (rating !== null) lines.push({ label: `Cribbage ${rating}%${directive === 'card-sharp' ? ' (×2)' : ''}`, points: rating * S.perRatingPoint * (directive === 'card-sharp' ? 2 : 1), directive: directive === 'card-sharp' || undefined });
  // The Directives that add a line of their own.
  const add = (label: string, points: number) => points > 0 && lines.push({ label, points, directive: true });
  if (directive === 'clean-sweep') {
    const regulars = encounters.filter((e) => e.nodeType === 'regularFight' && won(e)).length;
    add(`${regulars} regular fights won`, regulars * 50);
  }
  if (directive === 'ghost-run') {
    const quiet = encounters.filter((e) => e.nodeType === 'gatekeeperFight' && won(e) && e.heatAfter < layerHeatAllowance(e.layerIndex, result.playerState.maxHeatBonus) * 0.6).length;
    add(`${quiet} layer${quiet === 1 ? '' : 's'} breached under 60% Heat`, quiet * 500);
  }
  if (directive === 'shopping-spree') add(`${result.tally?.dataSpent ?? 0} Data spent`, result.tally?.dataSpent ?? 0);
  if (directive === 'full-arsenal') {
    const mods = result.playerState.ownedModIds.length - 1; // the class Mod isn't one you picked up
    add(`${mods} Mods held`, mods * 100);
  }
  if (directive === 'merge-master') add(`${result.tally?.merges ?? 0} Refactors`, (result.tally?.merges ?? 0) * 150);
  if (directive === 'burn-rate') add(`${result.tally?.burnersUsed ?? 0} Burners used`, (result.tally?.burnersUsed ?? 0) * 100);
  if (directive === 'clean-breach') {
    const clean = encounters.filter((e) => e.nodeType === 'gatekeeperFight' && won(e) && (e.outcome.fight?.finalFillFraction[1] ?? 1) < 0.5).length;
    add(`${clean} gatekeeper${clean === 1 ? '' : 's'} beaten before half Containment`, clean * 300);
  }
  if (directive === 'flawless-form' && rating !== null && rating >= FLAWLESS_RATING) add(`Flawless Form: Cribbage ${FLAWLESS_RATING}%+`, 1000);
  return { lines, total: lines.reduce((s, l) => s + l.points, 0) };
}

/** What a day's Advisories change during the run (beyond the caps and
 * prices, which go through the upgrades' MetaBonuses: a daily has no
 * upgrades of its own). */
export interface DailyEffects {
  /** Multiplies move Heat (Quiet Network: 0). */
  moveHeat: number;
  /** The share of Heat kept between layers (Cold Trail). */
  heatCarry: number;
  /** Multiplies the Data fights pay (Lean Times). */
  fightData: number;
  /** Extra Mods for each elite (Hardened Elites). */
  eliteMods: number;
  /** The day's Glitches, for every fight (never the trace evasion, which
   * stays plain Cribbage, M12). */
  glitches?: FightGlitches;
}

/** The day's Glitches as fights read them. */
export function dailyGlitches(plan: DailyPlan): FightGlitches | undefined {
  const has = (id: DailyModId) => plan.mods.some((m) => m.id === id);
  const rule: ScoringRule = {};
  if (has('fifteen-flood')) rule.fifteenPlus = 1;
  if (has('running-wild')) (rule.runTimes = 2), (rule.pairMinus = 1);
  if (has('nobs-and-heels')) (rule.hisNobs = 4), (rule.hisHeels = 4);
  const g: FightGlitches = {};
  if (Object.keys(rule).length) g.rule = rule;
  if (has('lucky-sevens')) g.luckySevens = 3;
  const surge = plan.mods.find((m) => m.id === 'suit-surge')?.suit;
  if (surge) g.suitSurge = surge;
  if (has('early-cut')) g.earlyCut = true;
  if (has('short-count')) g.countLimit = 21;
  return Object.keys(g).length ? g : undefined;
}

/** Port Flood's and Cache Bloom's effect on each layer's map. */
export function dailyMapOptions(plan: DailyPlan): { extraShops: number; cacheChance?: number } {
  const has = (id: DailyModId) => plan.mods.some((m) => m.id === id);
  return { extraShops: has('port-flood') ? 1 : 0, cacheChance: has('cache-bloom') ? 1 : undefined };
}

/** Rank I for a starting subroutine (Veteran Loadout; checkpoint 6: rank
 * II measured +30 victory): Merged once. */
function rankOne(piece: SubroutineDefinition): SubroutineDefinition {
  return upgradedDefinition(piece);
}

/** A daily's start: its Bulletins (the kit) and Advisories (the run's
 * effects) applied to a fresh player (DR3, DR7). */
export function applyDailyStart(state: RunPlayerState, plan: DailyPlan): RunPlayerState {
  const has = (id: DailyModId) => plan.mods.some((m) => m.id === id);
  let s: RunPlayerState = { ...state };
  const meta = { ...NO_META_BONUSES, process: { ...NO_META_BONUSES.process } };
  if (has('memory-leak')) meta.subroutineSlots = -1;
  if (has('expanded-memory')) meta.subroutineSlots = 1;
  if (has('burner-rig')) meta.burnerSlots = 1;
  if (has('lean-times')) meta.shopPrice = 0.7;
  if (has('quiet-network')) meta.fightHeat = 1.5;
  s.meta = meta;
  s.daily = { moveHeat: has('quiet-network') ? 0 : 1, heatCarry: has('cold-trail') ? 0.25 : 0, fightData: has('lean-times') ? 0.5 : 1, eliteMods: has('hardened-elites') ? 1 : 0, glitches: dailyGlitches(plan) };
  if (has('veteran-loadout')) {
    s.installedLoadout = s.installedLoadout.map(rankOne);
    s.rank = { ...s.rank, ...Object.fromEntries(s.installedLoadout.map((p) => [p.id, 1])) };
  }
  for (const m of plan.mods) {
    if (m.burners) s.carriedBurnerIds = [...s.carriedBurnerIds, ...m.burners];
    if (m.subroutine) {
      const piece = ALL_SUBROUTINES.find((p) => p.id === m.subroutine);
      if (piece) s.installedLoadout = [...s.installedLoadout, piece];
    }
  }
  if (has('seed-money')) s.data += 150;
  if (has('new-hardware')) s.classModUpgraded = true;
  return s;
}
