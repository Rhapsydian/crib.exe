/**
 * Archetype check (step 3; `docs/authoring-design.md` S6, S7).
 *
 * Runs one authored archetype's checkpoint checks:
 *
 *   1. PRICES -- every piece's formula price (beta-pricing.ts) and direct
 *      duel price (pricing.ts, against a Credit-2 host), against its
 *      rarity band (S6). Rares are also priced IN THE BUILD they invite:
 *      the rare placed directly above its build pieces, so `next`-targeted
 *      Charge lands where it's meant to.
 *   2. CREDIT RULE -- the commons-only kit must win by crossing its
 *      threshold, not by attrition (A3).
 *   3. RETENTION -- skill retention at 0.85 v 0.5 on every kit, against
 *      the 0.5 floor (DESIGN.md -> Pricing, rule 5).
 *   4. NOISE -- own Trace per fight for every kit. For Exploit, the CP6
 *      reference: ~7-10 Trace a run, about 1-1.5 a fight, reproduced the
 *      3-5x Heat-ending target.
 *
 * PROVENANCE: isolated duels and mirrors, equal skill 0.85 except the
 * retention matchup, no passive/Mods. Not a full-run metric.
 *
 * Usage:
 *   npx tsx scripts/archetype-check.ts --archetype=exploit [--seeds=200] [--skip=prices,kits] [--only=id,...]
 */
import { creditPiece, refinedPrice, type MirrorOptions } from '../src/engine/pricing';
import { piecePrice } from '../src/engine/beta-pricing';
import { combatSkillEdge, cribbageSkillEdge, skillRetention, SKILL_RETENTION_FLOOR } from '../src/engine/skill-retention';
import { playCombat } from '../src/engine/combat';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import type { ArchetypePool } from '../src/engine/subroutines';
import type { SubroutineDefinition } from '../src/engine/subroutine-types';
import { EXPLOIT_POOL, EXPLOIT_RARE_BUILDS, EXPLOIT_KITS } from '../src/engine/content/exploit';
import { DAEMON_POOL, DAEMON_RARE_BUILDS, DAEMON_KITS, DAEMON_CROSS_BUILDS } from '../src/engine/content/daemon';
import { HONEYPOT_POOL, HONEYPOT_RARE_BUILDS, HONEYPOT_KITS, HONEYPOT_WARD_CHECKS, HONEYPOT_CONTEXTS } from '../src/engine/content/honeypot';
import { OVERCLOCK_POOL, OVERCLOCK_RARE_BUILDS, OVERCLOCK_KITS, OVERCLOCK_CROSS_BUILDS, OVERCLOCK_CONTEXTS, type PricingContext } from '../src/engine/content/overclock';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const seeds = Number(args.seeds ?? 200);
const skip = new Set((args.skip ?? '').split(',').filter(Boolean));
const only = args.only ? new Set(args.only.split(',')) : null;

interface AuthoredArchetype {
  pool: ArchetypePool;
  /** The build a rare invites: pieces placed below it, or a full
   * pricing position. */
  rareBuilds: Record<string, SubroutineDefinition[] | PricingContext>;
  /** Non-rares priced in their designed position instead of alone. */
  contexts?: Record<string, PricingContext>;
  kits: Record<string, SubroutineDefinition[]>;
  /** Earlier archetypes' rares re-priced against this one's real pieces. */
  crossBuilds?: [SubroutineDefinition, SubroutineDefinition[]][];
  /** Pieces re-priced against a host carrying Ward (S10's bypass check). */
  wardChecks?: [SubroutineDefinition, PricingContext][];
}
const ARCHETYPES: Record<string, AuthoredArchetype> = {
  exploit: { pool: EXPLOIT_POOL, rareBuilds: EXPLOIT_RARE_BUILDS, kits: EXPLOIT_KITS },
  daemon: { pool: DAEMON_POOL, rareBuilds: DAEMON_RARE_BUILDS, kits: DAEMON_KITS, crossBuilds: DAEMON_CROSS_BUILDS },
  honeypot: { pool: HONEYPOT_POOL, rareBuilds: HONEYPOT_RARE_BUILDS, kits: HONEYPOT_KITS, wardChecks: HONEYPOT_WARD_CHECKS, contexts: HONEYPOT_CONTEXTS },
  overclock: { pool: OVERCLOCK_POOL, rareBuilds: OVERCLOCK_RARE_BUILDS, kits: OVERCLOCK_KITS, crossBuilds: OVERCLOCK_CROSS_BUILDS, contexts: OVERCLOCK_CONTEXTS },
};
const archetype = ARCHETYPES[args.archetype ?? 'exploit'];
if (!archetype) throw new Error(`unknown --archetype=${args.archetype}`);

const BANDS = { common: [1.8, 2.2], uncommon: [2.0, 2.5], rare: [2.2, 2.8] } as const;
const options: MirrorOptions = { seeds, skill: 0.85, gaugeThreshold: GAUGE_THRESHOLD, winThreshold: BREACH_THRESHOLD };
// `--host=N`: the host's Credit per turn. 2 is the Pricing rules' home
// ground; a bigger host shortens the fight, which matters for growth.
const HOST = creditPiece(Number(args.host ?? 2), 'host');
/** S9: a piece with growth is priced against a Credit-4 host (~8 hands),
 * with hosts 2 and 8 (~10 and ~5 hands) reported as its range. */
const GROWTH_HOST = creditPiece(4, 'host');
const hasGrowth = (p: SubroutineDefinition) => (p.alpha as { growth?: number }).growth !== undefined;
const GRID = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5];
const fmt = (x: number | null | undefined) => (x === null || x === undefined ? '  -- ' : x.toFixed(2).padStart(5));
const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(6);

function duel(addition: SubroutineDefinition, host: SubroutineDefinition[], placement: 'after' | 'before' | number) {
  const { coarse, fine } = refinedPrice(host, addition, GRID, options, placement);
  return fine ?? coarse;
}

function inBand(price: number | null, band: readonly [number, number]): string {
  if (price === null) return '  ?  ';
  return price < band[0] ? 'LOW  ' : price > band[1] ? 'HIGH ' : 'ok   ';
}

if (!skip.has('prices')) {
  console.log(`\nPRICES -- Credit per turn vs a Credit-${args.host ?? 2} host, skill 0.85, ${seeds} seeds x 2 seats. Isolated duels.`);
  console.log(`${'piece'.padEnd(22)} ${'rarity'.padEnd(9)} formula  duel  [ low,  high]  band`);
  for (const rarity of ['common', 'uncommon', 'rare'] as const) {
    const pieces = rarity === 'common' ? archetype.pool.commons : rarity === 'uncommon' ? archetype.pool.uncommons : archetype.pool.rares;
    for (const piece of pieces) {
      if (only && !only.has(piece.id)) continue;
      const formula = piecePrice(piece).total;
      const host = hasGrowth(piece) && !args.host ? GROWTH_HOST : HOST;
      const context = archetype.contexts?.[piece.id];
      const alone = context ? duel(piece, context.host, context.at) : duel(piece, [host], 'after');
      // A rare alone must be at least common-level (S6).
      const aloneBand = rarity === 'rare' ? ([2.0, Infinity] as const) : BANDS[rarity];
      const where = context ? ` (in position: ${context.host.map((h) => h.name).join(', ')}; at ${context.at})` : '';
      console.log(`${piece.name.padEnd(22)} ${rarity.padEnd(9)} ${fmt(formula)}   ${fmt(alone.price)} [${fmt(alone.low)}, ${fmt(alone.high)}]  ${inBand(alone.price, aloneBand)}${rarity === 'rare' ? ' (alone, >= 2.0)' : ''}${where}`);
      if (hasGrowth(piece) && !args.host) {
        const range = [2, 8].map((h) => duel(piece, [creditPiece(h, 'host')], 'after').price);
        console.log(`${''.padEnd(22)} ${'growth'.padEnd(9)}   --    priced at host 4; range host 2 ${fmt(range[0])}, host 8 ${fmt(range[1])}`);
      }
      const build = archetype.rareBuilds[piece.id];
      if (rarity === 'rare' && build) {
        const position = Array.isArray(build) ? { host: [...build, host], at: 0 } : build;
        const inBuild = duel(piece, position.host, position.at);
        console.log(`${''.padEnd(22)} ${'in build'.padEnd(9)}   --    ${fmt(inBuild.price)} [${fmt(inBuild.low)}, ${fmt(inBuild.high)}]  ${inBand(inBuild.price, BANDS.rare)} (in ${position.host.map((b) => b.name).join(', ')}; at ${position.at})`);
      }
    }
  }
}

if (!skip.has('cross') && archetype.crossBuilds?.length) {
  console.log(`
CROSS-ARCHETYPE BUILDS -- earlier rares against this archetype's real pieces (rare band ${BANDS.rare.join('-')}).`);
  for (const [rare, build] of archetype.crossBuilds) {
    if (only && !only.has(rare.id)) continue;
    const r = duel(rare, [...build, HOST], 'before');
    console.log(`${rare.name.padEnd(22)} above ${build.map((b) => b.name).join(', ').padEnd(36)} ${fmt(r.price)} [${fmt(r.low)}, ${fmt(r.high)}]  ${inBand(r.price, BANDS.rare)}`);
  }
}

if (!skip.has('ward') && archetype.wardChecks?.length) {
  console.log(`
WARD BYPASS (S10) -- steals priced against a host carrying Ward 2 on both sides, vs their plain price above.`);
  for (const [piece, position] of archetype.wardChecks) {
    if (only && !only.has(piece.id)) continue;
    const r = duel(piece, position.host, position.at);
    console.log(`${piece.name.padEnd(22)} vs Ward host  ${fmt(r.price)} [${fmt(r.low)}, ${fmt(r.high)}]`);
  }
}

if (!skip.has('kits')) {
  const matchup = { high: 0.85, low: 0.5 };
  const cribbage = cribbageSkillEdge(matchup, 2000);
  console.log(`\nKITS -- credit rule, skill retention (0.85 v 0.5; floor ${SKILL_RETENTION_FLOOR}; plain Cribbage ${pct(cribbage.winRate)}), own Trace per fight.`);
  console.log(`${'kit'.padEnd(16)} pieces  threshold-wins  retain  floor   Trace/fight  hands/fight`);
  // (The skeleton reference row retired with skeleton-pool.ts; its
  // numbers -- the noise target among them -- are in the step3-cp*
  // calibration files.)
  const kits: [string, SubroutineDefinition[]][] = Object.entries(archetype.kits);
  for (const [name, kit] of kits) {
    // Credit rule and noise: the kit mirrored at equal skill, kit in seat 0
    // (only side 0 accumulates Trace), seeds alternating the dealer.
    let threshold = 0, trace = 0, handsPlayed = 0;
    for (let seed = 0; seed < seeds; seed++) {
      const r = playCombat([kit, kit], {
        seed,
        gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
        winThreshold: [BREACH_THRESHOLD, BREACH_THRESHOLD],
        discardStrategies: [discardSkillStrategy(0.85), discardSkillStrategy(0.85)],
        playStrategies: [pegSkillStrategy(0.85), pegSkillStrategy(0.85)],
      });
      if (r.resolvedBy === 'threshold') threshold++;
      trace += r.traceGenerated;
      handsPlayed += r.hands.length;
    }
    const edge = combatSkillEdge(kit, matchup, { seeds, gaugeThreshold: GAUGE_THRESHOLD, winThreshold: BREACH_THRESHOLD });
    const retain = skillRetention(edge, cribbage)!;
    console.log(
      `${name.padEnd(16)} ${String(kit.length).padStart(6)}  ${pct(threshold / seeds)}         ${retain.toFixed(2).padStart(5)}   ${retain >= SKILL_RETENTION_FLOOR ? 'ok  ' : 'FAIL'}    ${(trace / seeds).toFixed(2).padStart(6)}      ${(handsPlayed / seeds).toFixed(1).padStart(5)}`,
    );
  }
}
