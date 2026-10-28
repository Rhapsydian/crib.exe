/**
 * Meta-progression pacing (session 71, docs/design/meta-progression.md
 * MP11): what upgrades do to runs, and how fast Rep buys them.
 *
 * --part=maxed: victory and layers breached by class, fresh against
 *   every upgrade bought (and a 4th starter), the same seeds.
 * --part=career: simulated careers. Each run plays the newest unlocked
 *   class (all six in turn once unlocked), with the profile's upgrades and
 *   picks; its Rep and class milestone are awarded as the game does; then
 *   the cheapest affordable purchase is made, repeatedly. Reports the run
 *   each milestone falls on (MP11's targets: power tracks ~30, commons
 *   ~20, uncommons ~50, the library ~100) and victory by stretch of runs.
 *
 * PROVENANCE: synergy acquisition, opportunistic traversal and
 * Safehouse, current content; skill 0.85 unless --skill.
 *
 * --policy=power buys every upgrade before the library and Burners
 * (cheapest first within each); the default is cheapest-first overall.
 *
 * Usage:
 *   npx tsx scripts/meta-pacing.ts --part=maxed [--seeds=100] [--skill=0.85]
 *   npx tsx scripts/meta-pacing.ts --part=security [--seeds=30] [--levels=0,5,10] [--fresh]
 *   npx tsx scripts/meta-pacing.ts --part=career [--careers=6] [--runs=120] [--skill=0.85]
 */
import { playRun, opportunisticTraversal, type RunResult } from '../src/engine/run';
import { opportunisticSafehouseStrategy } from '../src/engine/merge';
import { SYNERGY_AWARE_PROFILE } from '../src/engine/profiles';
import { ALL_CLASS_IDS, CLASS_DEFINITIONS, type ClassId } from '../src/engine/classes';
import {
  CLASS_ORDER,
  LIBRARY_PRICE,
  STARTING_BURNERS,
  STARTING_BURNER_PRICE,
  UPGRADE_TRACKS,
  firstGatekeeperBeaten,
  libraryOffers,
  nextClass,
  repForRun,
  upgradeLevel,
  upgradePrice,
  type RunSetup,
  type UpgradeId,
} from '../src/engine/meta';
import { ALL_SUBROUTINES } from '../src/engine/subroutines';
import { rarityOf } from '../src/engine/rewards';
import type { BurnerId } from '../src/engine/burner-types';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] ?? 'true';
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const skill = Number(args.skill ?? 0.85);
const TRACKS = Object.keys(UPGRADE_TRACKS) as UpgradeId[];
const MAXED = Object.fromEntries(TRACKS.map((id) => [id, UPGRADE_TRACKS[id].levels]));

function run(seed: number, classId: ClassId, setup?: RunSetup): RunResult {
  return playRun({
    ...SYNERGY_AWARE_PROFILE,
    seed,
    classId,
    traversalStrategy: opportunisticTraversal,
    safehouseStrategy: opportunisticSafehouseStrategy,
    playerSkill: skill,
    setup,
  });
}

/** The simulated player's 4th starter: the rarest unlocked subroutine of
 * its class's archetypes, else any. */
function pickStarter(classId: ClassId, library: readonly string[]): string | undefined {
  const order = { rare: 0, uncommon: 1, common: 2 } as const;
  const own = CLASS_DEFINITIONS[classId].archetypes;
  const candidates = ALL_SUBROUTINES.filter((p) => library.includes(p.id)).sort(
    (a, b) => Number(!own.includes(a.archetype)) - Number(!own.includes(b.archetype)) || order[rarityOf(a.id)] - order[rarityOf(b.id)],
  );
  return candidates[0]?.id;
}

if (args.part === 'maxed') {
  const seeds = Number(args.seeds ?? 100);
  console.log(`\nFULLY UPGRADED -- ${seeds} seeds/class, skill ${skill}. Fresh vs every upgrade + the class's best common as 4th starter.\n`);
  console.log(`${'class'.padEnd(12)}  fresh: victory layers | maxed: victory layers`);
  let fv = 0, mv = 0;
  for (const classId of ALL_CLASS_IDS) {
    let a = 0, al = 0, b = 0, bl = 0;
    const starter = pickStarter(classId, ALL_SUBROUTINES.filter((p) => rarityOf(p.id) === 'common').map((p) => p.id));
    for (let seed = 0; seed < seeds; seed++) {
      const f = run(seed, classId);
      const m = run(seed, classId, { upgrades: MAXED, starter, burner: 'flash-drive' });
      a += Number(f.outcome === 'victory');
      al += f.layersCompleted;
      b += Number(m.outcome === 'victory');
      bl += m.layersCompleted;
    }
    fv += a;
    mv += b;
    const p = (n: number) => `${((100 * n) / seeds).toFixed(1).padStart(5)}%`;
    console.log(`${CLASS_DEFINITIONS[classId].name.padEnd(12)}  ${p(a)}  ${(al / seeds).toFixed(2)}     |  ${p(b)}  ${(bl / seeds).toFixed(2)}`);
  }
  const n = seeds * ALL_CLASS_IDS.length;
  console.log(`\nall: fresh ${((100 * fv) / n).toFixed(1)}%, maxed ${((100 * mv) / n).toFixed(1)}%`);
}

if (args.part === 'each') {
  // Each track bought out alone (and the 4th starter alone), against fresh.
  const seeds = Number(args.seeds ?? 30);
  const victory = (setup?: RunSetup | ((c: ClassId) => RunSetup)) => {
    let v = 0;
    for (const classId of ALL_CLASS_IDS) for (let seed = 0; seed < seeds; seed++) v += Number(run(seed, classId, typeof setup === 'function' ? setup(classId) : setup).outcome === 'victory');
    return (100 * v) / (seeds * ALL_CLASS_IDS.length);
  };
  const fresh = victory();
  console.log(`
EACH TRACK ALONE -- ${seeds} seeds x 6 classes, skill ${skill}. Fresh ${fresh.toFixed(1)}%.
`);
  const commons = ALL_SUBROUTINES.filter((p) => rarityOf(p.id) === 'common').map((p) => p.id);
  const configs: [string, RunSetup | ((c: ClassId) => RunSetup)][] = [
    ...TRACKS.map((id): [string, RunSetup] => [id, { upgrades: { [id]: UPGRADE_TRACKS[id].levels } }]),
    ['4th starter', (c: ClassId) => ({ starter: pickStarter(c, commons) })],
  ];
  for (const [name, setup] of configs) {
    const v = victory(setup);
    console.log(`  ${name.padEnd(16)} ${v.toFixed(1).padStart(5)}%  (${v - fresh >= 0 ? '+' : ''}${(v - fresh).toFixed(1)})`);
  }
}

if (args.part === 'security') {
  // Victory by Security Level (MP14's targets, fully upgraded: ~90% at 0,
  // ~20% at 5, ~3-5% at 10), and a fresh player at a few levels.
  const seeds = Number(args.seeds ?? 30);
  const levels = (args.levels ?? '0,1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
  const commons = ALL_SUBROUTINES.filter((p) => rarityOf(p.id) === 'common').map((p) => p.id);
  const at = (level: number, maxed: boolean) => {
    let v = 0, layers = 0, heat = 0;
    for (const classId of ALL_CLASS_IDS) for (let seed = 0; seed < seeds; seed++) {
      const r = run(seed, classId, maxed ? { upgrades: MAXED, starter: pickStarter(classId, commons), burner: 'flash-drive', securityLevel: level } : { securityLevel: level });
      v += Number(r.outcome === 'victory');
      heat += Number(r.outcome === 'heatMaxed' || r.outcome === 'breachedThenCaught');
      layers += r.layersCompleted;
    }
    const n = seeds * ALL_CLASS_IDS.length;
    return `${((100 * v) / n).toFixed(1).padStart(5)}%  ${(layers / n).toFixed(2)}  (Heat ends ${((100 * heat) / n).toFixed(0)}%)`;
  };
  console.log(`
SECURITY LEVELS -- ${seeds} seeds x 6 classes, skill ${skill}.
`);
  console.log('level   maxed: victory layers' + (args.fresh ? ' | fresh: victory layers' : ''));
  for (const level of levels) console.log(`${String(level).padStart(5)}   ${at(level, true)}` + (args.fresh ? `      | ${at(level, false)}` : ''));
}

if (args.part === 'career') {
  const careers = Number(args.careers ?? 6);
  const runs = Number(args.runs ?? 120);
  const milestones: Record<string, number[]> = { classes: [], tracks: [], commons: [], uncommons: [], library: [], burners: [], slot: [], burnerSlots: [] };
  const repPerRun: number[] = new Array(runs).fill(0);
  const winsByStretch: number[] = new Array(Math.ceil(runs / 10)).fill(0);
  for (let c = 0; c < careers; c++) {
    let rep = 20; // the tutorial's grant
    const upgrades: Record<string, number> = {};
    const library: string[] = [];
    const burners: BurnerId[] = [];
    const classes: ClassId[] = ['exploit-overclock'];
    const seen = new Set<string>();
    const mark = (key: string, i: number) => {
      if (!seen.has(key)) seen.add(key), milestones[key].push(i + 1);
    };
    for (let i = 0; i < runs; i++) {
      const classId = classes.length < CLASS_ORDER.length ? classes[classes.length - 1] : CLASS_ORDER[i % CLASS_ORDER.length];
      const result = run(10_000 * (c + 1) + i, classId, { upgrades: { ...upgrades }, starter: pickStarter(classId, library), burner: burners[0] });
      const earned = repForRun(result).total;
      rep += earned;
      repPerRun[i] += earned / careers;
      winsByStretch[Math.floor(i / 10)] += Number(result.outcome === 'victory');
      if (firstGatekeeperBeaten(result)) {
        const next = nextClass(classId);
        if (next && !classes.includes(next)) classes.push(next);
      }
      if (classes.length === CLASS_ORDER.length) mark('classes', i);
      // The cheapest affordable purchase, again and again.
      for (;;) {
        const options: { price: number; buy: () => void; upgrade?: boolean }[] = [];
        for (const id of TRACKS) {
          const price = upgradePrice(id, upgradeLevel(upgrades, id));
          if (price !== null) options.push({ price, upgrade: true, buy: () => (upgrades[id] = upgradeLevel(upgrades, id) + 1) });
        }
        for (const o of libraryOffers(library)) options.push({ price: LIBRARY_PRICE[o.rarity], buy: () => library.push(o.piece.id) });
        for (const id of STARTING_BURNERS) if (!burners.includes(id)) options.push({ price: STARTING_BURNER_PRICE, buy: () => burners.push(id) });
        // --policy=power: upgrades before the library and Burners.
        const powerFirst = args.policy === 'power';
        const affordable = options.filter((o) => o.price <= rep);
        const upgradesLeft = powerFirst && options.some((o) => o.upgrade);
        const best = (upgradesLeft ? options.filter((o) => o.upgrade && o.price <= rep) : affordable).sort((a, b) => a.price - b.price)[0];
        if (!best && upgradesLeft) break;
        if (!best) break;
        rep -= best.price;
        best.buy();
      }
      if (TRACKS.every((id) => upgradeLevel(upgrades, id) === UPGRADE_TRACKS[id].levels)) mark('tracks', i);
      if ((upgrades.subroutineSlot ?? 0) >= 1) mark('slot', i);
      if ((upgrades.burnerSlots ?? 0) >= 2) mark('burnerSlots', i);
      if (libraryOffers(library)[0]?.rarity !== 'common') mark('commons', i);
      if (libraryOffers(library).every((o) => o.rarity === 'rare')) mark('uncommons', i);
      if (libraryOffers(library).length === 0) mark('library', i);
      if (burners.length === STARTING_BURNERS.length) mark('burners', i);
    }
  }
  const med = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] : NaN);
  console.log(`\nCAREERS -- ${careers} careers x ${runs} runs, skill ${skill}, ${args.policy === 'power' ? 'upgrades-first' : 'cheapest-first'} purchases.\n`);
  console.log('run reached (median of careers that reached it; reached/careers):');
  for (const [k, xs] of Object.entries(milestones)) console.log(`  ${k.padEnd(12)} ${String(med(xs)).padStart(4)}   (${xs.length}/${careers})`);
  const avg = (from: number, to: number) => (repPerRun.slice(from, to).reduce((a, b) => a + b, 0) / (to - from)).toFixed(1);
  console.log(`\nRep per run: runs 1-10 ${avg(0, 10)}, 11-30 ${avg(10, 30)}, 31-60 ${avg(30, 60)}, 61+ ${avg(60, runs)}`);
  console.log(`victory by 10 runs: ${winsByStretch.map((w, k) => `${((100 * w) / (Math.min(10, runs - 10 * k) * careers)).toFixed(0)}%`).join(' / ')}`);
}
