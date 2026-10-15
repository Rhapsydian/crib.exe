/**
 * Class check (step 3, classes; `docs/authoring-design.md` C1, C2).
 *
 * Prices each class's bridge passive, in Credit per turn, against C2's
 * budget (+1.0, band 0.75-1.25). It is priced in a starting kit and a
 * late kit: the test side is the kit plus its bridge, the reference side
 * the kit plus Credit Δ, and both are padded to the same piece count. The
 * bridge goes to the test side in both seats (`opponentBridge`), and seeds
 * are played in both seats. Also reports skill retention on each kit
 * with its bridge.
 *
 * The start kit is each class's authored starting loadout
 * (`content/starting-loadouts.ts`, C3); the late kit adds three on-class
 * pieces. Also checks the credit rule (the start kit, mirrored, wins by
 * threshold).
 *
 * PROVENANCE: isolated duels at skill 0.85, no other Mods. Not a full-run
 * metric.
 *
 * Usage:
 *   npx tsx scripts/class-check.ts [--seeds=200] [--classes=a,b] [--skip=retention] [--alt]
 */
import { playCombat } from '../src/engine/combat';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import { creditPiece, crossing } from '../src/engine/pricing';
import { cribbageSkillEdge, skillRetention, SKILL_RETENTION_FLOOR } from '../src/engine/skill-retention';
import type { ClassId } from '../src/engine/classes';
import type { PlayerIndex } from '../src/engine/pegging';
import type { SubroutineDefinition } from '../src/engine/subroutine-types';
import { AUTHORED_STARTING_LOADOUTS, authoredPiece } from '../src/engine/content/starting-loadouts';

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

const p = authoredPiece;
const start = AUTHORED_STARTING_LOADOUTS;

/** [start (the authored starting loadout, C3), late (it plus three
 * on-class pieces)]. `--alt` adds alternative starts to compare. */
const KITS: Record<ClassId, [SubroutineDefinition[], SubroutineDefinition[]]> = {
  'exploit-overclock': [start['exploit-overclock'], [...start['exploit-overclock'], p('burst-clock'), p('jackpot'), p('grand-slam')]],
  'exploit-daemon': [start['exploit-daemon'], [...start['exploit-daemon'], p('watchdog-timer'), p('race-condition'), p('memory-leak')]],
  'daemon-overclock': [start['daemon-overclock'], [...start['daemon-overclock'], p('fork-bomb'), p('elevated-session'), p('priority-override')]],
  'exploit-honeypot': [start['exploit-honeypot'], [...start['exploit-honeypot'], p('sinkhole'), p('credential-stuffing'), p('air-gapped-vault')]],
  'daemon-honeypot': [start['daemon-honeypot'], [...start['daemon-honeypot'], p('patch'), p('sinkhole'), p('heartbeat-monitor')]],
  'overclock-honeypot': [start['overclock-honeypot'], [...start['overclock-honeypot'], p('burst-clock'), p('elevated-session'), p('honeytoken')]],
};
const ALTERNATIVES: Partial<Record<ClassId, SubroutineDefinition[]>> = {
  // The drafted start, kept for comparison: one Daemon growth piece.
  'daemon-overclock': [p('cron-job'), p('ping'), p('elevated-session')],
};

const GRID = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4];
const BAND = [0.75, 1.25];

function fight(loadouts: [SubroutineDefinition[], SubroutineDefinition[]], seed: number, bridgeSeat: PlayerIndex | null, classId: ClassId, skills: [number, number] = [0.85, 0.85]) {
  return playCombat(loadouts, {
    seed,
    gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
    winThreshold: [BREACH_THRESHOLD, BREACH_THRESHOLD],
    discardStrategies: [discardSkillStrategy(skills[0]), discardSkillStrategy(skills[1])],
    playStrategies: [pegSkillStrategy(skills[0]), pegSkillStrategy(skills[1])],
    classId: bridgeSeat === 0 ? classId : undefined,
    opponentBridge: bridgeSeat === 1 ? classId : undefined,
  });
}

/** The bridge's price in `kit`: the Δ where kit + bridge ties kit + Credit Δ. */
function bridgePrice(classId: ClassId, kit: SubroutineDefinition[]): { price: number | null; curve: number[] } {
  const test = [...kit, creditPiece(0, 'pad')];
  const curve = GRID.map((delta) => {
    const reference = [...kit, creditPiece(delta, 'delta')];
    let wins = 0;
    for (let seed = 0; seed < seeds; seed++) {
      for (const seat of [0, 1] as PlayerIndex[]) {
        const loadouts: [SubroutineDefinition[], SubroutineDefinition[]] = seat === 0 ? [test, reference] : [reference, test];
        if (fight(loadouts, seed, seat, classId).winner === seat) wins++;
      }
    }
    return wins / (2 * seeds);
  });
  return { price: crossing(GRID, curve), curve };
}

/** Retention of `kit` with its bridge on both sides (a class mirror). */
function retention(classId: ClassId, kit: SubroutineDefinition[], cribbageWin: number): { retain: number; threshold: number } {
  let wins = 0;
  let threshold = 0;
  for (let seed = 0; seed < seeds; seed++) {
    for (const highSeat of [0, 1] as PlayerIndex[]) {
      const skills: [number, number] = highSeat === 0 ? [0.85, 0.5] : [0.5, 0.85];
      const r = playCombat([kit, kit], {
        seed,
        gaugeThreshold: [GAUGE_THRESHOLD, GAUGE_THRESHOLD],
        winThreshold: [BREACH_THRESHOLD, BREACH_THRESHOLD],
        discardStrategies: [discardSkillStrategy(skills[0]), discardSkillStrategy(skills[1])],
        playStrategies: [pegSkillStrategy(skills[0]), pegSkillStrategy(skills[1])],
        classId,
        opponentBridge: classId,
      });
      if (r.winner === highSeat) wins++;
      if (r.resolvedBy === 'threshold') threshold++;
    }
  }
  return {
    retain: skillRetention({ winRate: wins / (2 * seeds), se: 0, fights: 2 * seeds }, { winRate: cribbageWin, se: 0, fights: 1 })!,
    threshold: threshold / (2 * seeds),
  };
}

const classes = args.classes ? (args.classes.split(',') as ClassId[]) : (Object.keys(KITS) as ClassId[]);
const cribbage = skip.has('retention') ? null : cribbageSkillEdge({ high: 0.85, low: 0.5 }, 2000);
console.log(`\nBRIDGE PRICES -- Credit per turn, budget ${BAND.join('-')} (C2); ${seeds} seeds x 2 seats; skill 0.85. Isolated duels, authored starting loadouts.`);
console.log(`${'class'.padEnd(20)} ${'kit'.padEnd(6)} bridge  band   retention (with bridge, 0.85 v 0.5; floor ${SKILL_RETENTION_FLOOR})   threshold wins (credit rule)`);
for (const classId of classes) {
  const kits = [...KITS[classId], ...(args.alt && ALTERNATIVES[classId] ? [ALTERNATIVES[classId]!] : [])];
  kits.forEach((kit, i) => {
    const { price } = bridgePrice(classId, kit);
    const band = price === null ? '  ?  ' : price < BAND[0] ? 'LOW  ' : price > BAND[1] ? 'HIGH ' : 'ok   ';
    const ret = cribbage ? retention(classId, kit, cribbage.winRate) : null;
    console.log(`${classId.padEnd(20)} ${(['start', 'late', 'alt'][i]).padEnd(6)} ${price === null ? '  -- ' : price.toFixed(2).padStart(5)}   ${band}  ${ret === null ? '' : `${ret.retain.toFixed(2)} ${ret.retain >= SKILL_RETENTION_FLOOR ? 'ok  ' : 'FAIL'}                          ${(100 * ret.threshold).toFixed(0)}%`}`);
  });
}
