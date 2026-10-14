/**
 * Overclock skill A/B (step 2, checkpoint 6b follow-up).
 *
 * Checkpoint 6b found the Overclock classes retain the least Cribbage
 * skill. Overclock's skeleton kit is skill-blind twice over: Turbo's
 * flat gauge haste grants turns without points, and its other betas
 * fire on piece order or dealer status, never on the cards. This tests
 * the two proposed authoring rules, plus the user's lever-3 idea
 * expressed with existing sources:
 *
 *   A   control -- the skeleton as is;
 *   B1  lever 1 -- Turbo's gauge haste becomes a one-turn threshold cut
 *       of the same fraction ("your points go further");
 *   B2  lever 2 -- Overclock's state/sequence betas charge from scoring
 *       instead, at about the same rate (matched with beta-pricing.ts's
 *       expectedScale; effect unchanged);
 *   B   both;
 *   C   lever 3, approximated -- B1, plus betas on points scored
 *       (`progress: points`, banked) at the same rates;
 *   D   lever 3 proper -- the betas become "while you've scored 12+ this
 *       hand" (`state: handPointsAtLeast`, the per-hand source), with the
 *       effect scaled so the expected output per turn matches the control:
 *       a rarer, bigger boost that a better player clears more often.
 *
 * Each variant is measured for RETENTION (0.85 v 0.5, as
 * scripts/skill-check.ts) and POWER: its win rate against the control
 * loadout at equal skill 0.85. Power near 50% means the swap didn't just
 * make the build weaker (a weaker build fights longer, which would
 * inflate retention on its own).
 *
 * Variants rewrite the pieces actually present -- Merge upgrades kept --
 * so starting and late-run loadouts are compared like for like.
 *
 * PROVENANCE: isolated mirrors, no passive/Mods, skeleton content.
 *
 * Usage:
 *   npx tsx scripts/overclock-ab.ts [--seeds=300] [--powerSeeds=150] [--late=5] [--classes=a,b] [--variants=A,D] [--handScale=3,1,2]
 */
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import { mirrorWinRate } from '../src/engine/pricing';
import { combatSkillEdge, cribbageSkillEdge, skillRetention } from '../src/engine/skill-retention';
import { playRun, opportunisticTraversal } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { CLASS_DEFINITIONS, type ClassId } from '../src/engine/classes';
import type { BetaSource, BetaShape, SubroutineDefinition } from '../src/engine/subroutine-types';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const seeds = Number(args.seeds ?? 300);
const powerSeeds = Number(args.powerSeeds ?? 150);
const lateCount = Number(args.late ?? 5);
const classes = (args.classes ?? 'exploit-overclock,daemon-overclock,overclock-honeypot').split(',') as ClassId[];

type Trigger = BetaSource & BetaShape;
/** Replacement triggers per Overclock piece, matched to the control's
 * rate: Burst Clock's always-on anyPrior ~1.0, Voltage Boost's
 * non-dealer 0.38, Pipeline's adjacency ~0.5-1. */
const CARD_TRIGGERS: Record<string, Trigger> = {
  'burst-clock': { source: 'cards', category: 'fifteen', shape: 'graded', cap: 1 }, // 0.91
  'voltage-boost': { source: 'cards', category: 'run', shape: 'graded', cap: 1 }, // 0.52
  pipeline: { source: 'cards', category: 'pair', shape: 'graded', cap: 1 }, // 0.80
} as Record<string, Trigger>;
const POINTS_TRIGGERS: Record<string, Trigger> = {
  'burst-clock': { source: 'progress', metric: 'points', per: 8, shape: 'stepped', at: 1 }, // 0.99
  'voltage-boost': { source: 'progress', metric: 'points', per: 30, shape: 'stepped', at: 1 }, // ~0.4
  pipeline: { source: 'progress', metric: 'points', per: 15, shape: 'stepped', at: 1 }, // ~0.8
} as Record<string, Trigger>;

/** Big-hand triggers: 12+ points this hand holds on ~34% of turns at
 * skill 0.85 (measured), so each effect is scaled to the control's rate. */
const HAND_TRIGGERS: Record<string, Trigger> = {
  'burst-clock': { source: 'state', condition: { kind: 'handPointsAtLeast', amount: 12 }, shape: 'whileTrue' },
  'voltage-boost': { source: 'state', condition: { kind: 'handPointsAtLeast', amount: 12 }, shape: 'whileTrue' },
  pipeline: { source: 'state', condition: { kind: 'handPointsAtLeast', amount: 12 }, shape: 'whileTrue' },
} as Record<string, Trigger>;
/** Effect multipliers that hold output per turn: 1.0 / 0.34, 0.38 / 0.34,
 * ~0.7 / 0.34, rounded to whole amounts. */
const [burstK, voltageK, pipelineK] = (args.handScale ?? '3,1,2').split(',').map(Number);
const HAND_SCALE: Record<string, number> = { 'burst-clock': burstK, 'voltage-boost': voltageK, pipeline: pipelineK };

function retrigger(piece: SubroutineDefinition, triggers: Record<string, Trigger>, scale: Record<string, number> = {}): SubroutineDefinition {
  const t = triggers[piece.id];
  if (!t || !piece.beta) return piece;
  const k = scale[piece.id] ?? 1;
  const e = piece.beta.effect;
  const effect = k === 1 || e.verb === 'disrupt' ? e : { ...e, amount: e.amount * k };
  return { ...piece, beta: { ...t, effect } as SubroutineDefinition['beta'] };
}

/** Lever 1: Turbo's gauge haste -> a one-turn threshold cut of the same
 * fraction, which saves the same fraction of a turn but scales with the
 * points you score into it. */
function thresholdTempo(piece: SubroutineDefinition): SubroutineDefinition {
  const a = piece.alpha;
  if (a.verb !== 'tempo' || a.target !== 'own' || a.mode !== 'gauge') return piece;
  return { ...piece, alpha: { ...a, mode: 'threshold', duration: 1 } };
}

const VARIANTS: Record<string, (p: SubroutineDefinition) => SubroutineDefinition> = {
  'A  control': (p) => p,
  'B1 threshold tempo': thresholdTempo,
  'B2 card betas': (p) => retrigger(p, CARD_TRIGGERS),
  'B  both': (p) => retrigger(thresholdTempo(p), CARD_TRIGGERS),
  'C  points betas': (p) => retrigger(thresholdTempo(p), POINTS_TRIGGERS),
  'D  big-hand betas': (p) => retrigger(p, HAND_TRIGGERS, HAND_SCALE),
};
const only = args.variants ? new Set(args.variants.split(',')) : null;

const matchup = { high: 0.85, low: 0.5 };
const cribbage = cribbageSkillEdge(matchup, 2000);
const edgeOptions = { gaugeThreshold: GAUGE_THRESHOLD, winThreshold: BREACH_THRESHOLD };
const pct = (x: number) => `${(100 * x).toFixed(1)}%`.padStart(6);

function lateLoadouts(classId: ClassId): SubroutineDefinition[][] {
  const found: SubroutineDefinition[][] = [];
  for (let seed = 0; found.length < lateCount && seed < 200; seed++) {
    const result = playRun({ ...SYNERGY_AWARE_PROFILE, seed, classId, traversalStrategy: opportunisticTraversal, safehouseStrategy: opportunisticSafehouseStrategy, playerSkill: 0.85 });
    if (result.layersCompleted >= 2) found.push(result.playerState.installedLoadout);
  }
  return found;
}

/** Pooled retention and power over a set of loadouts sharing the seed budget. */
function measure(loadouts: SubroutineDefinition[][], variant: (p: SubroutineDefinition) => SubroutineDefinition): { retain: number; skillWin: number; power: number } {
  const per = Math.max(1, Math.round(seeds / loadouts.length));
  const perPower = Math.max(1, Math.round(powerSeeds / loadouts.length));
  let skillWins = 0, skillFights = 0, powerWins = 0, powerFights = 0;
  loadouts.forEach((control, j) => {
    const v = control.map(variant);
    const s = combatSkillEdge(v, matchup, { ...edgeOptions, seeds: per, seedOffset: j * per });
    skillWins += s.winRate * s.fights;
    skillFights += s.fights;
    const p = mirrorWinRate(v, control, { ...edgeOptions, seeds: perPower, skill: 0.85, seedOffset: 10_000 + j * perPower });
    powerWins += p.winRate * p.fights;
    powerFights += p.fights;
  });
  const skillWin = skillWins / skillFights;
  const retain = skillRetention({ winRate: skillWin, se: 0, fights: skillFights }, cribbage)!;
  return { retain, skillWin, power: powerWins / powerFights };
}

console.log(`\nOVERCLOCK A/B -- retention at 0.85 v 0.5 (plain Cribbage ${pct(cribbage.winRate)}) and power vs control at 0.85.`);
console.log(`Isolated mirrors, no passive/Mods, skeleton content. ${seeds} seeds x 2 seats retention, ${powerSeeds} x 2 power.\n`);
console.log(`${'loadout'.padEnd(34)} ${'variant'.padEnd(20)} skill-win  retain   power vs A`);
for (const classId of classes) {
  const sets: [string, SubroutineDefinition[][]][] = [
    [`${classId} start`, [CLASS_DEFINITIONS[classId].startingLoadout]],
    [`${classId} late`, lateLoadouts(classId)],
  ];
  for (const [name, loadouts] of sets) {
    for (const [vName, variant] of Object.entries(VARIANTS)) {
      const changed = loadouts.some((l) => l.some((p) => variant(p) !== p));
      if (!changed && !vName.startsWith('A')) continue; // identical to control
      if (only && !only.has(vName.slice(0, 2).trim())) continue;
      const m = measure(loadouts, variant);
      console.log(`${name.padEnd(34)} ${vName.padEnd(20)} ${pct(m.skillWin)}    ${m.retain.toFixed(2).padStart(5)}    ${vName.startsWith('A') ? '   --' : pct(m.power)}`);
    }
  }
}
