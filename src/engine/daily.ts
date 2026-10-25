import { createRng, type Rng } from './rng';
import type { ClassId } from './classes';
import type { BurnerId } from './burner-types';
import type { Archetype } from './subroutine-types';
import { BURNER_DEFINITIONS } from './burners';
import { ARCHETYPE_POOLS } from './subroutines';
import { CLASS_ORDER, STARTING_BURNERS, type RunSetup } from './meta';

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
  | 'turncoat-crib'
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
  def('fifteen-flood', 'Fifteen Flood', 'glitch', 'Fifteens score double, for both sides.'),
  def('running-wild', 'Running Wild', 'glitch', 'Runs score double; pairs score 1.'),
  def('nobs-and-heels', 'Nobs and Heels', 'glitch', 'His Nobs and His Heels are worth 4.'),
  def('turncoat-crib', 'Turncoat Crib', 'glitch', 'The crib belongs to the non-dealer.'),
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
  def('veteran-loadout', 'Veteran Loadout', 'bulletin', 'Every starting subroutine begins at rank II.'),
  def('seed-money', 'Seed Money', 'bulletin', 'Start with 150 Data.'),
  def('new-hardware', 'New Hardware', 'bulletin', 'Your class Mod starts as its II version.'),
  def('burner-rig', 'Burner Rig', 'bulletin', 'Carry 4 Burners.'),
  def('expanded-memory', 'Expanded Memory', 'bulletin', 'Install 7 subroutines.', { weight: 0.3 }),
  def('bounty-hunt', 'Bounty Hunt', 'directive', 'Elites score double (300 each).'),
  def('treasure-map', 'Treasure Map', 'directive', 'Caches score triple (300 each).'),
  def('payday', 'Payday', 'directive', 'Data earned counts double.'),
  def('card-sharp', 'Card Sharp', 'directive', 'The Cribbage rating counts double.'),
  def('deep-dive', 'Deep Dive', 'directive', 'Layers 3 and 4 score double.'),
  def('clean-sweep', 'Clean Sweep', 'directive', 'Each regular fight won scores 50.'),
  def('ghost-run', 'Ghost Run', 'directive', 'Each layer breached with Heat under half its allowance scores +500.'),
  def('shopping-spree', 'Shopping Spree', 'directive', 'Each Data you spend scores 1.'),
  def('full-arsenal', 'Full Arsenal', 'directive', 'Each Mod you hold at the end scores 100.'),
  def('merge-master', 'Merge Master', 'directive', 'Each Merge scores 150.'),
  def('burn-rate', 'Burn Rate', 'directive', 'Each Burner you use scores 100.'),
  def('clean-breach', 'Clean Breach', 'directive', 'Each gatekeeper beaten before it reaches half its Containment scores +300.'),
  def('flawless-form', 'Flawless Form', 'directive', 'A Cribbage rating of 90% or better scores +1,000.'),
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
