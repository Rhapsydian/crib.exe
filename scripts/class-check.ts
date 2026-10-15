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
 * The kits here are PROVISIONAL: chosen to show each bridge off, following
 * A9 (offense with a credit path, utility from the other archetype, a
 * piece that shows off the passive), a noisy Exploit piece in Exploit
 * classes, and partner credit in Honeypot classes (S11). The real starting
 * loadouts are decided next.
 *
 * PROVENANCE: isolated duels at skill 0.85, no other Mods. Not a full-run
 * metric.
 *
 * Usage:
 *   npx tsx scripts/class-check.ts [--seeds=200] [--classes=a,b] [--skip=retention]
 */
import { playCombat } from '../src/engine/combat';
import { discardSkillStrategy, pegSkillStrategy } from '../src/engine/ai';
import { GAUGE_THRESHOLD, BREACH_THRESHOLD } from '../src/engine/encounters';
import { creditPiece, crossing } from '../src/engine/pricing';
import { cribbageSkillEdge, skillRetention, SKILL_RETENTION_FLOOR } from '../src/engine/skill-retention';
import type { ClassId } from '../src/engine/classes';
import type { PlayerIndex } from '../src/engine/pegging';
import type { SubroutineDefinition } from '../src/engine/subroutine-types';
import { EXPLOIT_POOL } from '../src/engine/content/exploit';
import { DAEMON_POOL } from '../src/engine/content/daemon';
import { OVERCLOCK_POOL } from '../src/engine/content/overclock';
import { HONEYPOT_POOL } from '../src/engine/content/honeypot';

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

const ALL = [EXPLOIT_POOL, DAEMON_POOL, OVERCLOCK_POOL, HONEYPOT_POOL].flatMap((p) => [...p.commons, ...p.uncommons, ...p.rares]);
const p = (id: string): SubroutineDefinition => {
  const found = ALL.find((x) => x.id === id);
  if (!found) throw new Error(`no piece ${id}`);
  return found;
};

/** Provisional kits: [start (3 pieces), late (6)]. */
const KITS: Record<ClassId, [SubroutineDefinition[], SubroutineDefinition[]]> = {
  // Exploit betas Empower the next piece: alternate Exploit and its targets.
  'exploit-overclock': [
    [p('fuzzer'), p('ping'), p('buffer-overflow')],
    [p('fuzzer'), p('ping'), p('port-scan'), p('burst-clock'), p('jackpot'), p('grand-slam')],
  ],
  // Fifteens Suppress: fifteen-heavy Exploit plus Daemon ramp.
  'exploit-daemon': [
    [p('fuzzer'), p('watchdog-timer'), p('cron-job')],
    [p('fuzzer'), p('buffer-overflow'), p('watchdog-timer'), p('cron-job'), p('race-condition'), p('memory-leak')],
  ],
  // Overclock betas grow Daemon pieces.
  'daemon-overclock': [
    [p('cron-job'), p('ping'), p('steady-drip')],
    [p('fork-bomb'), p('ping'), p('cron-job'), p('elevated-session'), p('steady-drip'), p('priority-override')],
  ],
  // Pairs bank Ward, which Tarpit and Sinkhole spend.
  'exploit-honeypot': [
    [p('port-scan'), p('tarpit'), p('fuzzer')],
    [p('port-scan'), p('tarpit'), p('fuzzer'), p('sinkhole'), p('credential-stuffing'), p('air-gapped-vault')],
  ],
  // Suppress banks Ward.
  'daemon-honeypot': [
    [p('cron-job'), p('watchdog-timer'), p('tarpit')],
    [p('cron-job'), p('watchdog-timer'), p('tarpit'), p('patch'), p('sinkhole'), p('heartbeat-monitor')],
  ],
  // Every turn banks Ward; Overclock's extra turns bank more.
  'overclock-honeypot': [
    [p('ping'), p('tarpit'), p('rate-limiting')],
    [p('ping'), p('tarpit'), p('burst-clock'), p('elevated-session'), p('sinkhole'), p('honeytoken')],
  ],
};

const GRID = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
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
function retention(classId: ClassId, kit: SubroutineDefinition[], cribbageWin: number): number {
  let wins = 0;
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
    }
  }
  return skillRetention({ winRate: wins / (2 * seeds), se: 0, fights: 2 * seeds }, { winRate: cribbageWin, se: 0, fights: 1 })!;
}

const classes = args.classes ? (args.classes.split(',') as ClassId[]) : (Object.keys(KITS) as ClassId[]);
const cribbage = skip.has('retention') ? null : cribbageSkillEdge({ high: 0.85, low: 0.5 }, 2000);
console.log(`\nBRIDGE PRICES -- Credit per turn, budget ${BAND.join('-')} (C2); ${seeds} seeds x 2 seats; skill 0.85. Isolated duels, provisional kits.`);
console.log(`${'class'.padEnd(20)} ${'kit'.padEnd(6)} bridge  band   retention (with bridge, 0.85 v 0.5; floor ${SKILL_RETENTION_FLOOR})`);
for (const classId of classes) {
  KITS[classId].forEach((kit, i) => {
    const { price } = bridgePrice(classId, kit);
    const band = price === null ? '  ?  ' : price < BAND[0] ? 'LOW  ' : price > BAND[1] ? 'HIGH ' : 'ok   ';
    const ret = cribbage ? retention(classId, kit, cribbage.winRate) : null;
    console.log(`${classId.padEnd(20)} ${(i === 0 ? 'start' : 'late').padEnd(6)} ${price === null ? '  -- ' : price.toFixed(2).padStart(5)}   ${band}  ${ret === null ? '' : `${ret.toFixed(2)} ${ret >= SKILL_RETENTION_FLOOR ? 'ok' : 'FAIL'}`}`);
  });
}
